// A small SQL lexer used to lay out PL/SQL and to check that formatting kept every token.

export type SqlTokenType = 'word' | 'number' | 'string' | 'qident' | 'param' | 'op' | 'punct' | 'comment';

export interface SqlToken {
    type: SqlTokenType;
    text: string;
    start: number;
    end: number;
    // Whitespace between the previous token and this one
    spaceBefore: boolean;
    newlineBefore: boolean;
    blankLineBefore: boolean;
}

export interface LexOptions {
    backslashEscapes: boolean; // 'it\'s' (MySQL family)
    hashComments: boolean;     // # comment (MySQL family)
    bracketIdents: boolean;    // [name] (T-SQL)
    dollarQuotes: boolean;     // $$ body $$ (PostgreSQL)
    qQuotes: boolean;          // q'[text]' (Oracle)
}

const MYSQL_LIKE = ['mysql', 'mariadb', 'singlestoredb', 'tidb', 'bigquery', 'hive', 'spark', 'clickhouse'];

export function lexOptionsFor(dialect: string): LexOptions {
    return {
        backslashEscapes: MYSQL_LIKE.includes(dialect),
        hashComments: MYSQL_LIKE.includes(dialect) && dialect !== 'spark' && dialect !== 'hive',
        bracketIdents: dialect === 'transactsql' || dialect === 'tsql',
        dollarQuotes: ['postgresql', 'redshift', 'snowflake', 'duckdb', 'sql'].includes(dialect),
        qQuotes: dialect === 'plsql',
    };
}

const MULTI_OPS = ['->>', '<>', '!=', '>=', '<=', ':=', '=>', '||', '::', '**', '->', '^=', '~=', '!<', '!>'];
const PUNCT = '(),;.[]{}';
const SIGILS = ':@&$#?';
const QUOTE_PAIRS: Record<string, string> = { '[': ']', '{': '}', '(': ')', '<': '>' };

export function lexSQL(text: string, opts: LexOptions): SqlToken[] {
    const tokens: SqlToken[] = [];
    let pos = 0;
    while (pos < text.length) {
        const wsStart = pos;
        while (pos < text.length && /\s/.test(text[pos])) pos++;
        if (pos >= text.length) break;
        const ws = text.slice(wsStart, pos);
        const newlines = (ws.match(/\n/g) ?? []).length;
        const start = pos;
        const [type, end] = readToken(text, pos, opts);
        pos = Math.max(end, pos + 1);
        tokens.push({
            type,
            text: text.slice(start, pos),
            start,
            end: pos,
            spaceBefore: ws.length > 0,
            newlineBefore: newlines > 0,
            blankLineBefore: newlines > 1,
        });
    }
    return tokens;
}

function readToken(s: string, p: number, o: LexOptions): [SqlTokenType, number] {
    const c = s[p];
    const rest = s.slice(p, p + 3);

    // Comments
    if (rest.startsWith('--') || (o.hashComments && c === '#')) {
        const nl = s.indexOf('\n', p);
        let end = nl === -1 ? s.length : nl;
        if (s[end - 1] === '\r') end--;
        return ['comment', end];
    }
    if (rest.startsWith('/*')) {
        const close = s.indexOf('*/', p + 2);
        return ['comment', close === -1 ? s.length : close + 2];
    }

    // Prefixed strings: q'[...]', N'...', E'...', X'...', B'...', U&'...'
    const prefixed = /^(n?q)'(.)/i.exec(s.slice(p, p + 4));
    if (o.qQuotes && prefixed) {
        const open = prefixed[2];
        const close = (QUOTE_PAIRS[open] ?? open) + "'";
        const idx = s.indexOf(close, p + prefixed[0].length);
        return ['string', idx === -1 ? s.length : idx + 2];
    }
    const simplePrefix = /^(n|e|x|b|r|u&)'/i.exec(s.slice(p, p + 3));
    if (simplePrefix) {
        const backslash = o.backslashEscapes || simplePrefix[1].toLowerCase() === 'e';
        return ['string', readQuoted(s, p + simplePrefix[1].length, "'", backslash)];
    }

    if (c === "'") return ['string', readQuoted(s, p, "'", o.backslashEscapes)];
    if (c === '"') return ['qident', readQuoted(s, p, '"', false)];
    if (c === '`') return ['qident', readQuoted(s, p, '`', false)];
    if (c === '[' && o.bracketIdents) {
        const close = s.indexOf(']', p);
        return ['qident', close === -1 ? s.length : close + 1];
    }

    // $tag$ ... $tag$
    if (o.dollarQuotes && c === '$') {
        const tag = /^\$([A-Za-z_]\w*)?\$/.exec(s.slice(p));
        if (tag) {
            const idx = s.indexOf(tag[0], p + tag[0].length);
            return ['string', idx === -1 ? s.length : idx + tag[0].length];
        }
    }

    // Parameters and variables: :name, :1, @var, &&sub, $1, #temp
    if (SIGILS.includes(c)) {
        let q = p;
        while (q < s.length && SIGILS.includes(s[q])) q++;
        if (q < s.length && /[\p{L}\p{N}_]/u.test(s[q])) {
            while (q < s.length && /[\p{L}\p{N}_$#]/u.test(s[q])) q++;
            return ['param', q];
        }
    }

    if (/[\p{L}_]/u.test(c)) {
        let q = p + 1;
        while (q < s.length && /[\p{L}\p{N}_$#]/u.test(s[q])) q++;
        return ['word', q];
    }

    const num = /^(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(p, p + 64));
    if (num) return ['number', p + num[0].length];

    if (PUNCT.includes(c)) return ['punct', p + 1];

    for (const op of MULTI_OPS) {
        if (s.startsWith(op, p)) return ['op', p + op.length];
    }
    return ['op', p + 1];
}

function readQuoted(s: string, p: number, quote: string, backslash: boolean): number {
    let q = p + 1;
    while (q < s.length) {
        if (backslash && s[q] === '\\') { q += 2; continue; }
        if (s[q] === quote) {
            if (s[q + 1] === quote) { q += 2; continue; }
            return q + 1;
        }
        q++;
    }
    return s.length;
}

/**
 * The significant content of a document: every token except whitespace.
 * Comments are compared with their whitespace collapsed (formatters may re-indent them).
 */
export function tokenSignature(text: string, opts: LexOptions, ignoreWordCase: boolean): string[] {
    return lexSQL(text, opts).map(t => {
        if (t.type === 'comment') return 'comment:' + t.text.replace(/\s+/g, ' ').trim();
        if (t.type === 'word' && ignoreWordCase) return 'word:' + t.text.toUpperCase();
        return `${t.type}:${t.text}`;
    });
}

/**
 * sql-formatter writes "lag (x)" for functions it does not know. Put "(" back next to the
 * name wherever the source had no space there. Only whitespace changes; the token lists
 * of input and output must already be identical.
 */
export function restoreTightParens(input: string, output: string, opts: LexOptions): string {
    const a = lexSQL(input, opts);
    const b = lexSQL(output, opts);
    if (a.length !== b.length) return output;
    let result = '';
    let last = 0;
    for (let i = 1; i < b.length; i++) {
        const name = b[i - 1];
        if (b[i].text === '(' && a[i].text === '(' && !a[i].spaceBefore && b[i].spaceBefore
            && (name.type === 'word' || name.type === 'qident')
            && !output.slice(name.end, b[i].start).includes('\n')) {
            result += output.slice(last, name.end);
            last = b[i].start;
        }
    }
    return result + output.slice(last);
}

// sql-formatter puts "OR REPLACE" on its own line after CREATE
export function joinCreateOrReplace(text: string): string {
    return text.replace(/^([ \t]*CREATE)\n[ \t]*(OR\s+REPLACE\b)/gim, '$1 $2');
}

/** Prefix every line with `prefix`, except lines that start inside a multi-line string or comment. */
export function indentLines(text: string, prefix: string, opts: LexOptions): string[] {
    const tokens = lexSQL(text, opts);
    const lines = text.split('\n');
    let offset = 0;
    return lines.map(line => {
        const start = offset;
        offset += line.length + 1;
        const inside = tokens.some(t => t.start < start && start < t.end);
        if (inside) return line;
        return line.trim() ? prefix + line : '';
    });
}
