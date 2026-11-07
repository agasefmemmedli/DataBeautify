import { format as sqlFormat } from 'sql-formatter';
import { indentLines, joinCreateOrReplace, lexOptionsFor, lexSQL, restoreTightParens, SqlToken, tokenSignature } from './sql_lexer';

export type KeywordCase = 'preserve' | 'upper' | 'lower';

export interface PlsqlOptions {
    tabSize: number;
    insertSpaces: boolean;
    keywordCase: KeywordCase;
    printWidth?: number;
}

// PL/SQL keywords whose case follows the keywordCase setting (data types are left alone)
const KEYWORDS = new Set(`
AND AS AUTHID BEFORE AFTER BEGIN BODY BULK BY CASE CLOSE COLLECT COMMIT CONSTANT CONTINUE CREATE CURSOR
DECLARE DEFAULT DEFINER DELETE DETERMINISTIC EACH EDITIONABLE ELSE ELSIF END EXCEPTION EXECUTE EXIT FETCH
FOR FORALL FROM FUNCTION GOTO IF IMMEDIATE IN INSERT INSTEAD INTO IS LIMIT LOOP MERGE NOCOPY NONEDITIONABLE
NOT NULL OF ON OPEN OR OTHERS OUT PACKAGE PIPE PIPELINED PRAGMA PROCEDURE RAISE RECORD REF REFERENCING
REPLACE RETURN RETURNING REVERSE ROLLBACK ROW SAVEPOINT SELECT SET THEN TRIGGER TYPE UPDATE USING VALUES
WHEN WHERE WHILE`.split(/\s+/).filter(Boolean));

const DML = new Set(['SELECT', 'WITH', 'INSERT', 'UPDATE', 'DELETE', 'MERGE']);
// After IS/AS these words mean "not a block" (e.g. CREATE TYPE t AS OBJECT (...))
const NOT_A_BODY = new Set(['LANGUAGE', 'EXTERNAL', 'OBJECT', 'TABLE', 'VARRAY', 'RECORD', 'REF', 'VARYING']);
const TRIGGER_CLAUSES = new Set(['BEFORE', 'AFTER', 'INSTEAD', 'FOR', 'REFERENCING', 'WHEN', 'FOLLOWS', 'PRECEDES', 'COMPOUND']);

interface Frame {
    kind: 'unit' | 'if' | 'loop' | 'case';
    indent: number;
    begun?: boolean;      // BEGIN seen (unit)
    exception?: boolean;  // inside EXCEPTION section (unit)
}

/**
 * Lay out PL/SQL code (no SQL*Plus commands): one statement per line, blocks indented,
 * SQL statements formatted by sql-formatter. Only whitespace between tokens is changed.
 */
export function formatPlsqlCode(src: string, opts: PlsqlOptions): string {
    return new PlsqlPrinter(src, opts).print();
}

class PlsqlPrinter {
    private toks: SqlToken[];
    private lines: string[] = [];
    private stack: Frame[] = [];
    private cur = 0;
    private indentUnit: string;
    private width: number;

    constructor(private src: string, private opts: PlsqlOptions) {
        this.toks = lexSQL(src, lexOptionsFor('plsql'));
        this.indentUnit = opts.insertSpaces ? ' '.repeat(opts.tabSize) : '\t';
        this.width = opts.printWidth ?? 100;
    }

    print(): string {
        let i = 0;
        while (i < this.toks.length) {
            i = this.statement(i);
        }
        while (this.lines.length && this.lines[this.lines.length - 1] === '') this.lines.pop();
        return this.lines.join('\n');
    }

    // ---- helpers -------------------------------------------------------------

    private kw(i: number): string {
        const t = this.toks[i];
        return t && t.type === 'word' ? t.text.toUpperCase() : '';
    }

    private top(): Frame | undefined {
        return this.stack[this.stack.length - 1];
    }

    private emit(indent: number, text: string) {
        this.lines.push(this.indentUnit.repeat(Math.max(0, indent)) + text);
    }

    private blank() {
        if (this.lines.length && this.lines[this.lines.length - 1] !== '') this.lines.push('');
    }

    private word(t: SqlToken): string {
        if (t.type !== 'word' || this.opts.keywordCase === 'preserve' || !KEYWORDS.has(t.text.toUpperCase())) return t.text;
        return this.opts.keywordCase === 'upper' ? t.text.toUpperCase() : t.text.toLowerCase();
    }

    /** Index of the first token at paren depth 0 matching pred, searching from `from`. -1 if a `;` comes first (when stopAtSemicolon) or not found. */
    private find(from: number, pred: (i: number) => boolean, stopAtSemicolon = true): number {
        let depth = 0;
        for (let i = from; i < this.toks.length; i++) {
            const t = this.toks[i];
            if (depth === 0 && pred(i)) return i;
            if (t.text === '(') depth++;
            else if (t.text === ')') depth = Math.max(0, depth - 1);
            else if (depth === 0 && stopAtSemicolon && t.text === ';') return -1;
        }
        return -1;
    }

    private matchingParen(open: number): number {
        let depth = 0;
        for (let i = open; i < this.toks.length; i++) {
            if (this.toks[i].text === '(') depth++;
            else if (this.toks[i].text === ')' && --depth === 0) return i;
        }
        return -1;
    }

    private semicolonFrom(i: number): number {
        const j = this.find(i, k => this.toks[k].text === ';', false);
        return j === -1 ? this.toks.length - 1 : j;
    }

    /**
     * Print tokens [from, to] as lines. Tokens stay on one line, keeping "space or no space"
     * from the source; a line comment forces a line break. Long lines with parentheses
     * get one argument per line.
     */
    private emitTokens(from: number, to: number, indent: number, breakBefore?: (i: number) => boolean) {
        const out: [number, string][] = [[indent, '']];
        for (let i = from; i <= to; i++) {
            const t = this.toks[i];
            const prev = this.toks[i - 1];
            const line = out[out.length - 1];
            const prevIsLineComment = i > from && prev.type === 'comment' && prev.text.startsWith('--');
            if (i > from && (prevIsLineComment || (t.type === 'comment' && t.newlineBefore) || breakBefore?.(i))) {
                out.push([indent + 1, this.word(t)]);
                continue;
            }
            line[1] += (i > from && t.spaceBefore ? ' ' : '') + this.word(t);
        }
        for (const [ind, text] of out) {
            if (ind === indent && text.length + ind * this.indentUnit.length > this.width && !breakBefore) {
                this.emitWrapped(text, from, to, ind);
            } else {
                this.emit(ind, text);
            }
        }
    }

    // Break "name(a, b, c) rest" into one argument per line when it is too long
    private emitWrapped(text: string, from: number, to: number, indent: number) {
        const open = this.find(from, i => this.toks[i].text === '(', false);
        if (open === -1 || open > to || this.toks.slice(from, to + 1).some(t => t.type === 'comment')) {
            this.emit(indent, text);
            return;
        }
        let depth = 0;
        let close = -1;
        const commas: number[] = [];
        for (let i = open; i <= to; i++) {
            const t = this.toks[i].text;
            if (t === '(') depth++;
            else if (t === ')') { depth--; if (depth === 0) { close = i; break; } }
            else if (t === ',' && depth === 1) commas.push(i);
        }
        // A query in parentheses is not an argument list
        const hasQuery = this.toks.slice(open, close + 1).some(t => t.type === 'word' && DML.has(t.text.toUpperCase()));
        if (close === -1 || commas.length === 0 || hasQuery) {
            this.emit(indent, text);
            return;
        }
        const join = (a: number, b: number) => {
            let s = '';
            for (let i = a; i <= b; i++) s += (i > a && this.toks[i].spaceBefore ? ' ' : '') + this.word(this.toks[i]);
            return s;
        };
        this.emit(indent, join(from, open));
        let start = open + 1;
        for (const comma of [...commas, close]) {
            const end = comma === close ? close - 1 : comma;
            if (end >= start) this.emit(indent + 1, join(start, end));
            start = comma + 1;
        }
        this.emit(indent, join(close, to));
    }

    // Format a SQL statement with sql-formatter; fall back to one line if that fails or changes tokens
    private emitSql(from: number, to: number, indent: number) {
        const raw = this.src.slice(this.toks[from].start, this.toks[to].end);
        try {
            const lex = lexOptionsFor('plsql');
            let formatted = sqlFormat(raw, {
                language: 'plsql',
                tabWidth: this.opts.tabSize,
                useTabs: !this.opts.insertSpaces,
                keywordCase: this.opts.keywordCase,
            });
            const ignoreCase = this.opts.keywordCase !== 'preserve';
            if (tokenSignature(raw, lex, ignoreCase).join('\n') === tokenSignature(formatted, lex, ignoreCase).join('\n')) {
                formatted = joinCreateOrReplace(restoreTightParens(raw, formatted, lex));
                this.lines.push(...indentLines(formatted, this.indentUnit.repeat(indent), lex));
                return;
            }
        } catch {
            // not understood by sql-formatter: keep it on one line
        }
        this.emitTokens(from, to, indent);
    }

    private popTo(kind: Frame['kind']): Frame | undefined {
        for (let k = this.stack.length - 1; k >= 0; k--) {
            if (this.stack[k].kind === kind) {
                const frame = this.stack[k];
                this.stack.length = k;
                return frame;
            }
        }
        return undefined;
    }

    // ---- statements ----------------------------------------------------------

    private statement(i: number): number {
        const t = this.toks[i];
        if (t.blankLineBefore) this.blank();

        if (t.type === 'comment') {
            if (!t.newlineBefore && this.lines.length && this.lines[this.lines.length - 1] !== '') {
                this.lines[this.lines.length - 1] += ' ' + t.text;
            } else {
                this.emit(this.cur, t.text);
            }
            return i + 1;
        }

        // <<label>>
        if (t.text === '<' && this.toks[i + 1]?.text === '<' && this.toks[i + 2]?.type === 'word'
            && this.toks[i + 3]?.text === '>' && this.toks[i + 4]?.text === '>') {
            this.emit(this.cur, `<<${this.toks[i + 2].text}>>`);
            return i + 5;
        }

        const k = this.kw(i);
        const top = this.top();

        switch (k) {
            case 'CREATE': return this.create(i);
            case 'PROCEDURE':
            case 'FUNCTION': {
                const end = this.find(i, j => ['IS', 'AS'].includes(this.kw(j)));
                if (end !== -1 && !NOT_A_BODY.has(this.kw(end + 1))) return this.header(i, end);
                break;
            }
            case 'DECLARE':
                this.emitTokens(i, i, this.cur);
                this.stack.push({ kind: 'unit', indent: this.cur });
                this.cur++;
                return i + 1;
            case 'BEGIN':
                if (top && top.kind === 'unit' && !top.begun) {
                    top.begun = true;
                    this.emitTokens(i, i, top.indent);
                    this.cur = top.indent + 1;
                } else {
                    this.stack.push({ kind: 'unit', indent: this.cur, begun: true });
                    this.emitTokens(i, i, this.cur);
                    this.cur++;
                }
                return i + 1;
            case 'EXCEPTION':
                if (top && top.kind === 'unit' && top.begun && this.kw(i + 1) === 'WHEN') {
                    top.exception = true;
                    this.emitTokens(i, i, top.indent);
                    this.cur = top.indent + 1;
                    return i + 1;
                }
                break;
            case 'WHEN':
                if (top && (top.kind === 'case' || (top.kind === 'unit' && top.exception))) {
                    const end = this.find(i, j => this.kw(j) === 'THEN');
                    if (end !== -1) {
                        this.emitTokens(i, end, top.indent + 1);
                        this.cur = top.indent + 2;
                        return end + 1;
                    }
                }
                break;
            case 'IF': {
                const end = this.find(i, j => this.kw(j) === 'THEN');
                if (end !== -1) {
                    this.emitTokens(i, end, this.cur);
                    this.stack.push({ kind: 'if', indent: this.cur });
                    this.cur++;
                    return end + 1;
                }
                break;
            }
            case 'ELSIF':
            case 'ELSEIF':
                if (top?.kind === 'if') {
                    const end = this.find(i, j => this.kw(j) === 'THEN');
                    if (end !== -1) {
                        this.emitTokens(i, end, top.indent);
                        this.cur = top.indent + 1;
                        return end + 1;
                    }
                }
                break;
            case 'ELSE':
                if (top?.kind === 'if') {
                    this.emitTokens(i, i, top.indent);
                    this.cur = top.indent + 1;
                    return i + 1;
                }
                if (top?.kind === 'case') {
                    this.emitTokens(i, i, top.indent + 1);
                    this.cur = top.indent + 2;
                    return i + 1;
                }
                break;
            case 'LOOP':
                this.emitTokens(i, i, this.cur);
                this.stack.push({ kind: 'loop', indent: this.cur });
                this.cur++;
                return i + 1;
            case 'WHILE':
            case 'FOR': {
                // FOR r IN (SELECT ...) LOOP: the query gets its own lines
                if (k === 'FOR' && this.kw(i + 2) === 'IN' && this.toks[i + 3]?.text === '(' && DML.has(this.kw(i + 4))) {
                    const close = this.matchingParen(i + 3);
                    if (close !== -1 && this.kw(close + 1) === 'LOOP') {
                        this.emitTokens(i, i + 3, this.cur);
                        this.emitSql(i + 4, close - 1, this.cur + 1);
                        this.emitTokens(close, close + 1, this.cur);
                        this.stack.push({ kind: 'loop', indent: this.cur });
                        this.cur++;
                        return close + 2;
                    }
                }
                const end = this.find(i, j => this.kw(j) === 'LOOP');
                if (end !== -1) {
                    this.emitTokens(i, end, this.cur);
                    this.stack.push({ kind: 'loop', indent: this.cur });
                    this.cur++;
                    return end + 1;
                }
                break;
            }
            case 'CASE': {
                const end = this.find(i, j => this.kw(j) === 'WHEN');
                if (end !== -1) {
                    this.emitTokens(i, end - 1, this.cur);
                    this.stack.push({ kind: 'case', indent: this.cur });
                    this.cur++;
                    return end;
                }
                break;
            }
            case 'END': {
                const end = this.semicolonFrom(i);
                const next = this.kw(i + 1);
                const kind: Frame['kind'] = next === 'IF' ? 'if' : next === 'LOOP' ? 'loop' : next === 'CASE' ? 'case' : 'unit';
                const frame = this.popTo(kind);
                const indent = frame ? frame.indent : this.cur;
                this.emitTokens(i, end, indent);
                this.cur = indent;
                return end + 1;
            }
        }

        return this.plain(i);
    }

    private create(i: number): number {
        let j = i + 1;
        while (['OR', 'REPLACE', 'EDITIONABLE', 'NONEDITIONABLE', 'EDITIONING', 'FORCE', 'NOFORCE', 'NO'].includes(this.kw(j))) j++;
        const kind = this.kw(j);
        if (['PROCEDURE', 'FUNCTION', 'PACKAGE', 'TYPE'].includes(kind)) {
            const end = this.find(i, x => ['IS', 'AS'].includes(this.kw(x)));
            if (end !== -1 && !NOT_A_BODY.has(this.kw(end + 1))) return this.header(i, end);
            return this.plain(i);
        }
        if (kind === 'TRIGGER') {
            const end = this.find(i, x => ['DECLARE', 'BEGIN'].includes(this.kw(x)));
            if (end !== -1) {
                // One clause per line: BEFORE INSERT ON t / FOR EACH ROW / WHEN (...)
                this.emitTokens(i, end - 1, this.cur, x => x > j + 1 && TRIGGER_CLAUSES.has(this.kw(x)));
                return end;
            }
        }
        return this.plain(i);
    }

    // "CREATE ... IS", "PROCEDURE p(...) IS": opens a unit with a declaration section
    private header(i: number, isIndex: number): number {
        this.emitTokens(i, isIndex, this.cur);
        this.stack.push({ kind: 'unit', indent: this.cur });
        this.cur++;
        return isIndex + 1;
    }

    private plain(i: number): number {
        const end = this.semicolonFrom(i);
        const k = this.kw(i);
        const topLevel = this.stack.length === 0;

        if (DML.has(k) || (topLevel && this.toks[i].type === 'word')) {
            this.emitSql(i, end, this.cur);
            return end + 1;
        }

        // CURSOR c IS SELECT ... / OPEN c FOR SELECT ... / FORALL i IN 1 .. n UPDATE ...
        if (k === 'CURSOR' || k === 'OPEN' || k === 'FORALL') {
            const split = k === 'FORALL'
                ? this.find(i + 1, j => DML.has(this.kw(j))) - 1
                : this.find(i, j => ['IS', 'FOR'].includes(this.kw(j)) && DML.has(this.kw(j + 1)));
            if (split > i) {
                this.emitTokens(i, split, this.cur);
                this.emitSql(split + 1, end, this.cur + 1);
                return end + 1;
            }
        }

        this.emitTokens(i, end, this.cur);
        return end + 1;
    }
}
