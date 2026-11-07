import { applyEdits, format as jsoncFormat, parse as jsoncParse, ParseError, printParseErrorCode } from 'jsonc-parser';
import { jsonrepair } from 'jsonrepair';
import { formatJSONDeep } from './json_deep_formatter';
import { JSONTokenizer, TokenType } from './json_tokenizer';
import { FormatError, FormatResult, IndentOptions, lineColumn } from './result';

/**
 * Format strict JSON (.json).
 *
 * - Valid JSON: formatted, and the result is checked to hold exactly the same data.
 * - JSON with comments / trailing commas: comments are kept, trailing commas dropped.
 * - Broken JSON: auto-fixed only if the fix produces valid JSON; otherwise FormatError.
 */
export function formatJSON(text: string, opts: IndentOptions): FormatResult {
    const strict = tryStrictParse(text);
    if (strict.ok) {
        const out = formatJSONDeep(text, { ...opts, isJSONC: false });
        const check = tryStrictParse(out);
        if (check.ok && sameValue(strict.value, check.value)) {
            return { text: out, repaired: false };
        }
        return { text: safeFormat(text, opts), repaired: false };
    }

    // Comments or trailing commas only: keep the comments instead of deleting them
    if (jsoncErrors(text).length === 0) {
        const out = formatJSONDeep(text, { ...opts, isJSONC: true, trailingCommas: false });
        if (sameJSONC(text, out)) {
            return { text: out, repaired: false };
        }
        return { text: safeFormat(text, opts), repaired: false };
    }

    // Broken input: accept a fix only if it is valid JSON
    const issue = describeSyntaxError(text);
    const hadComments = extractComments(text).length > 0;
    const attempts = [
        () => formatJSONDeep(text, { ...opts, isJSONC: false }),
        () => formatJSONDeep(jsonrepair(text), { ...opts, isJSONC: false }),
    ];
    const valid: string[] = [];
    for (const attempt of attempts) {
        try {
            const out = attempt();
            if (tryStrictParse(out).ok) valid.push(out);
        } catch {
            // try the next approach
        }
    }
    if (valid.length === 0) {
        throw new FormatError(`Could not fix the syntax error (${issue}). The file was not changed.`);
    }
    // A fix that only touched punctuation (commas, colons, quotes, brackets) is applied directly.
    // Anything else is a guess: prefer jsonrepair's guess, and ask the user first.
    const safe = valid.find(out => keepsLiterals(text, out));
    const text2 = safe ?? valid[valid.length - 1];
    return { text: text2, repaired: true, issue, commentsRemoved: hadComments, needsConfirmation: safe === undefined };
}

/**
 * Format JSON with comments (.jsonc). Comments are always preserved.
 */
export function formatJSONC(text: string, opts: IndentOptions): FormatResult {
    const inputValid = jsoncErrors(text).length === 0;
    let out: string | undefined;
    try {
        out = formatJSONDeep(text, { ...opts, isJSONC: true });
    } catch {
        out = undefined;
    }

    if (inputValid) {
        if (out !== undefined && sameJSONC(text, out)) {
            return { text: out, repaired: false };
        }
        return { text: safeFormat(text, opts), repaired: false };
    }

    const issue = describeSyntaxError(text);
    if (out !== undefined && jsoncErrors(out).length === 0 && sameList(extractComments(text), extractComments(out))) {
        return { text: out, repaired: true, issue, needsConfirmation: !keepsLiterals(text, out) };
    }
    throw new FormatError(`Could not fix the syntax error (${issue}). The file was not changed.`);
}

export function describeSyntaxError(text: string): string {
    const errors = jsoncErrors(text);
    if (errors.length > 0) {
        return `${printParseErrorCode(errors[0].error)} at ${lineColumn(text, errors[0].offset)}`;
    }
    try {
        JSON.parse(text);
    } catch (e: any) {
        return e.message;
    }
    return 'unknown error';
}

export function extractComments(text: string): string[] {
    return new JSONTokenizer(text).tokenize()
        .filter(t => t.type === TokenType.Comment)
        .map(t => t.text.trim());
}

/**
 * True when the fix kept every key, value and bracket: same text, same order, same role.
 * Keys may gain quotes; values must keep their type, so NaN -> "NaN" or 1-2 -> "1-2"
 * count as changes.
 */
export function keepsLiterals(before: string, after: string): boolean {
    // Brackets must match too: where a missing bracket belongs (or which extra one
    // to drop) cannot be known for sure, so such fixes are always confirmed
    return sameList(literals(before), literals(after));
}

const LITERAL_TYPES = [TokenType.String, TokenType.Number, TokenType.Boolean, TokenType.Null, TokenType.Unknown];

function literals(text: string): string[] {
    const tokens = new JSONTokenizer(text).tokenize()
        .filter(t => t.type !== TokenType.Whitespace && t.type !== TokenType.Comment);
    const result: string[] = [];
    tokens.forEach((t, i) => {
        // Brackets define the structure, so they are part of the comparison
        if ([TokenType.BraceOpen, TokenType.BracketOpen, TokenType.BraceClose, TokenType.BracketClose].includes(t.type)) {
            result.push(t.text);
            return;
        }
        if (!LITERAL_TYPES.includes(t.type)) return;
        const isKey = tokens[i + 1]?.type === TokenType.Colon;
        const content = literalContent(t.text, t.type);
        result.push(isKey ? `key:${content}` : `${TokenType[t.type]}:${content}`);
    });
    return result;
}

// The text of a literal without quotes; single-quoted strings are converted like the formatter does
function literalContent(text: string, type: TokenType): string {
    if (type !== TokenType.String || text.length < 2) return text;
    const quote = text[0];
    if (text[text.length - 1] !== quote) return text; // unterminated: never equal to a fixed string
    const inner = text.slice(1, -1);
    return quote === "'" ? inner.replace(/\\'/g, "'").replace(/"/g, '\\"') : inner;
}

// Plain jsonc-parser formatting: never changes content, used as a fallback
function safeFormat(text: string, opts: IndentOptions): string {
    const edits = jsoncFormat(text, undefined, { tabSize: opts.tabSize, insertSpaces: opts.insertSpaces, eol: '\n' });
    return applyEdits(text, edits);
}

function jsoncErrors(text: string): ParseError[] {
    const errors: ParseError[] = [];
    jsoncParse(text, errors, { allowTrailingComma: true, disallowComments: false });
    return errors;
}

// Same data and same comments
function sameJSONC(before: string, after: string): boolean {
    if (jsoncErrors(after).length > 0) return false;
    const a = jsoncParse(before, [], { allowTrailingComma: true });
    const b = jsoncParse(after, [], { allowTrailingComma: true });
    return sameValue(a, b) && sameList(extractComments(before), extractComments(after));
}

function tryStrictParse(text: string): { ok: true, value: unknown } | { ok: false } {
    try {
        return { ok: true, value: JSON.parse(text) };
    } catch {
        return { ok: false };
    }
}

function sameValue(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

function sameList(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((x, i) => x === b[i]);
}
