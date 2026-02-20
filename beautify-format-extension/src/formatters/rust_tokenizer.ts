
export enum TokenType {
    Whitespace,
    Comment,
    String,
    Char,
    Lifetime,
    Keyword,
    Operator,
    Punctuation,
    Identifier,
    Number,
    Newline,
    Attribute,
    Macro,
    Unknown
}

export interface Token {
    type: TokenType;
    text: string;
    line: number;
    col: number;
}

export class RustTokenizer {
    private code: string;
    private pos: number = 0;
    private line: number = 1;
    private col: number = 1;

    // Rust Keywords
    private static readonly KEYWORDS = new Set([
        'as', 'break', 'const', 'continue', 'crate', 'else', 'enum', 'extern', 'false', 'fn',
        'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub',
        'ref', 'return', 'self', 'Self', 'static', 'struct', 'super', 'trait', 'true',
        'type', 'unsafe', 'use', 'where', 'while', 'async', 'await', 'dyn', 'abstract',
        'become', 'box', 'do', 'final', 'macro', 'override', 'priv', 'typeof', 'unsized',
        'virtual', 'yield', 'try', 'union'
    ]);

    // Rust Operators
    private static readonly OPERATORS = new Set([
        '+', '-', '*', '/', '%', '^', '!', '&', '|', '&&', '||', '<<', '>>', '+=', '-=',
        '*=', '/=', '%=', '^=', '&=', '|=', '<<=', '>>=', '=', '==', '!=', '>', '<',
        '>=', '<=', '@', '_', '.', '..', '...', '..=', ',', ';', ':', '::', '->', '=>',
        '#', '$', '?'
    ]);

    // Regexes (Sticky)
    private readonly reWhitespace = /[ \t]+/y;
    private readonly reIdentifier = /[a-zA-Z_][a-zA-Z0-9_]*/y;
    private readonly reHex = /0x[0-9a-fA-F_]+([uUiI][0-9]+)?/y;
    private readonly reBin = /0b[01_]+([uUiI][0-9]+)?/y;
    private readonly reOct = /0o[0-7_]+([uUiI][0-9]+)?/y;
    // Note: Float regex needs to match 1.0 but NOT 1..
    // (\d[0-9_]*(\.[0-9_]+)?([eE][+-]?[0-9_]+)?)([uUiIfF][0-9]+)?
    private readonly reNumber = /(\d[0-9_]*(\.[0-9_]+)?([eE][+-]?[0-9_]+)?)([uUiIfF][0-9]+)?/y;

    private readonly reChar = /'([^'\\]|\\.)'/y;
    private readonly reLifetime = /'([a-zA-Z_][a-zA-Z0-9_]*)/y;

    constructor(code: string) {
        this.code = code;
    }

    tokenize(): Token[] {
        const tokens: Token[] = [];
        this.pos = 0;
        this.line = 1;
        this.col = 1;

        while (this.pos < this.code.length) {
            const char = this.code[this.pos];

            // Newline
            if (char === '\n') {
                tokens.push({ type: TokenType.Newline, text: '\n', line: this.line, col: this.col });
                this.pos++;
                this.line++;
                this.col = 1;
                continue;
            }
            if (char === '\r') {
                if (this.pos + 1 < this.code.length && this.code[this.pos + 1] === '\n') {
                    tokens.push({ type: TokenType.Newline, text: '\r\n', line: this.line, col: this.col });
                    this.pos += 2;
                } else {
                    tokens.push({ type: TokenType.Newline, text: '\r', line: this.line, col: this.col });
                    this.pos++;
                }
                this.line++;
                this.col = 1;
                continue;
            }

            // Whitespace
            if (char === ' ' || char === '\t') {
                this.reWhitespace.lastIndex = this.pos;
                const match = this.reWhitespace.exec(this.code);
                if (match) {
                    tokens.push({ type: TokenType.Whitespace, text: match[0], line: this.line, col: this.col });
                    this.advanceStr(match[0]);
                    continue;
                }
            }

            // Comment
            if (char === '/') {
                if (this.pos + 1 < this.code.length) {
                    const next = this.code[this.pos + 1];
                    if (next === '/') {
                        // Line comment
                        let end = this.code.indexOf('\n', this.pos + 2);
                        if (end === -1) end = this.code.length;
                        // Check \r
                        const ret = this.code.indexOf('\r', this.pos + 2);
                        if (ret !== -1 && ret < end) end = ret;

                        const text = this.code.substring(this.pos, end);
                        tokens.push({ type: TokenType.Comment, text, line: this.line, col: this.col });
                        this.advanceStr(text);
                        continue;
                    } else if (next === '*') {
                        // Block comment
                        let end = this.code.indexOf('*/', this.pos + 2);
                        if (end === -1) end = this.code.length;
                        else end += 2; // include */

                        const text = this.code.substring(this.pos, end);
                        tokens.push({ type: TokenType.Comment, text, line: this.line, col: this.col });
                        this.advanceStr(text);
                        continue;
                    }
                }
            }

            // Attribute (#![...] or #[...])
            if (char === '#') {
                const nextChar = this.pos + 1 < this.code.length ? this.code[this.pos + 1] : '';
                const nextNextChar = this.pos + 2 < this.code.length ? this.code[this.pos + 2] : '';

                if (nextChar === '[' || (nextChar === '!' && nextNextChar === '[')) {
                    // This is an attribute start
                    const startPos = this.pos;
                    const startLine = this.line;
                    const startCol = this.col;

                    let current = startPos;
                    // consume # [ or # ! [
                    if (nextChar === '!') current += 3; else current += 2;

                    let depth = 1; // we already consumed one [
                    let inString = false;
                    let quoteChar = '';

                    while (current < this.code.length) {
                        const c = this.code[current];

                        if (inString) {
                            if (c === '\\') {
                                current++;
                            } else if (c === quoteChar) {
                                inString = false;
                            }
                        } else {
                            if (c === '"') {
                                inString = true;
                                quoteChar = '"';
                            } else if (c === '[') {
                                depth++;
                            } else if (c === ']') {
                                depth--;
                                if (depth === 0) {
                                    current++; // Consume closing ]
                                    break;
                                }
                            }
                        }
                        current++;
                    }

                    if (depth === 0) {
                        const text = this.code.substring(startPos, current);
                        tokens.push({ type: TokenType.Attribute, text, line: startLine, col: startCol });
                        this.advanceStr(text);
                        continue;
                    }
                }
            }

            // Raw String (r"..." or r#"..."#)
            if (char === 'r' || (char === 'b' && this.pos + 1 < this.code.length && this.code[this.pos + 1] === 'r')) {
                // Check if it really is raw string start
                // offset for r or br
                let offset = (char === 'b') ? 1 : 0;
                if (this.code[this.pos + offset] === 'r') {
                    // Check next
                    if (this.pos + offset + 1 < this.code.length) {
                        const next = this.code[this.pos + offset + 1];
                        if (next === '"' || next === '#') {
                            const rawString = this.matchRawString();
                            if (rawString) {
                                tokens.push({ type: TokenType.String, text: rawString, line: this.line, col: this.col });
                                this.advanceString(rawString);
                                continue;
                            }
                        }
                    }
                }
            }

            // Standard String ("...") or Byte String (b"...")
            if (char === '"' || (char === 'b' && this.pos + 1 < this.code.length && this.code[this.pos + 1] === '"')) {
                const stringMatch = this.matchString();
                if (stringMatch) {
                    tokens.push({ type: TokenType.String, text: stringMatch, line: this.line, col: this.col });
                    this.advanceString(stringMatch);
                    continue;
                }
            }

            // Char or Lifetime ('...') or Byte Char (b'...')
            if (char === '\'' || (char === 'b' && this.pos + 1 < this.code.length && this.code[this.pos + 1] === '\'')) {
                const charOrLifetime = this.matchCharOrLifetime();
                if (charOrLifetime) {
                    const type = charOrLifetime.endsWith('\'') ? TokenType.Char : TokenType.Lifetime;
                    tokens.push({ type, text: charOrLifetime, line: this.line, col: this.col });
                    this.advanceStr(charOrLifetime);
                    continue;
                }
            }

            // Number
            if (/\d/.test(char)) {
                const numMatch = this.matchNumber();
                if (numMatch) {
                    tokens.push({ type: TokenType.Number, text: numMatch, line: this.line, col: this.col });
                    this.advanceStr(numMatch);
                    continue;
                }
            }

            // Identifier or Keyword
            if (/[a-zA-Z_]/.test(char)) {
                this.reIdentifier.lastIndex = this.pos;
                const match = this.reIdentifier.exec(this.code);
                if (match) {
                    let text = match[0];
                    const startLine = this.line;
                    const startCol = this.col;

                    // Lookahead for Macro !
                    // Must be immediately after ID, no space.
                    const endPos = this.pos + text.length;
                    if (endPos < this.code.length && this.code[endPos] === '!') {
                        // It is a macro if ! is not !=
                        // Check next char
                        const afterBang = endPos + 1 < this.code.length ? this.code[endPos + 1] : '';
                        if (afterBang !== '=') {
                            text += '!';
                            // Special case handling for macro_rules!
                            if (text === 'macro_rules!' || !RustTokenizer.KEYWORDS.has(match[0])) {
                                tokens.push({ type: TokenType.Macro, text, line: startLine, col: startCol });
                                this.advanceStr(text);
                                continue;
                            }
                        }
                    }

                    const type = RustTokenizer.KEYWORDS.has(text) ? TokenType.Keyword : TokenType.Identifier;
                    tokens.push({ type, text, line: startLine, col: startCol });
                    this.advanceStr(text);
                    continue;
                }
            }

            // Operators & Punctuation
            // Try 3 chars
            const threeChars = this.code.substr(this.pos, 3);
            if (RustTokenizer.OPERATORS.has(threeChars)) {
                const type = ',;'.includes(threeChars) ? TokenType.Punctuation : TokenType.Operator;
                tokens.push({ type, text: threeChars, line: this.line, col: this.col });
                this.advanceStr(threeChars);
                continue;
            }
            // Try 2 chars
            const twoChars = this.code.substr(this.pos, 2);
            if (RustTokenizer.OPERATORS.has(twoChars)) {
                const type = ',;'.includes(twoChars) ? TokenType.Punctuation : TokenType.Operator;
                tokens.push({ type, text: twoChars, line: this.line, col: this.col });
                this.advanceStr(twoChars);
                continue;
            }
            // Try 1 char
            if (RustTokenizer.OPERATORS.has(char)) {
                const type = ',;'.includes(char) ? TokenType.Punctuation : TokenType.Operator;
                tokens.push({ type, text: char, line: this.line, col: this.col });
                this.advanceStr(char);
                continue;
            }

            // Punctuation (Braces/Parens)
            if ('()[]{}'.includes(char)) {
                tokens.push({ type: TokenType.Punctuation, text: char, line: this.line, col: this.col });
                this.advance();
                continue;
            }

            // Unknown
            tokens.push({ type: TokenType.Unknown, text: char, line: this.line, col: this.col });
            this.advance();
        }

        return tokens;
    }

    private advance() {
        this.pos++;
        this.col++;
    }

    private advanceStr(str: string) {
        for (const char of str) {
            if (char === '\n') {
                this.line++;
                this.col = 1;
            } else {
                this.col++;
            }
        }
        this.pos += str.length;
    }

    private advanceString(str: string) {
        this.advanceStr(str);
    }

    private matchString(): string | null {
        // Standard string "..."
        let currentPos = this.pos;
        if (this.code[currentPos] === 'b') currentPos++; // b"
        if (this.code[currentPos] !== '"') return null;
        currentPos++;

        while (currentPos < this.code.length) {
            const char = this.code[currentPos];

            if (char === '\\') {
                currentPos += 2;
                continue;
            } else if (char === '"') {
                return this.code.substring(this.pos, currentPos + 1);
            }
            currentPos++;
        }
        return null;
    }

    private matchRawString(): string | null {
        // r"..." or r#"..."#
        // b prefix handled by logic calling this
        let prefixLen = 0;
        if (this.code[this.pos] === 'b') prefixLen++;
        prefixLen++; // r

        let hashes = '';
        let offset = prefixLen;
        while (this.pos + offset < this.code.length && this.code[this.pos + offset] === '#') {
            hashes += '#';
            offset++;
        }

        if (this.code[this.pos + offset] !== '"') return null;

        const endSeq = '"' + hashes;
        let currentPos = this.pos + offset + 1;

        while (currentPos < this.code.length) {
            if (this.code.startsWith(endSeq, currentPos)) {
                return this.code.substring(this.pos, currentPos + endSeq.length);
            }
            currentPos++;
        }

        return null;
    }

    private matchCharOrLifetime(): string | null {
        // Regex check from current pos
        this.reChar.lastIndex = this.pos;
        const charMatch = this.reChar.exec(this.code);
        if (charMatch) {
            // Also check b'...'
            // reChar doesn't handle b prefix?
            // If starts with b, increment pos?
            // Handled by manual check below
            return charMatch[0];
        }

        // Check b'c' manually if regex fails?
        if (this.code[this.pos] === 'b' && this.code[this.pos+1] === '\'') {
             // byte char
             // Reuse regex but from pos+1?
             this.reChar.lastIndex = this.pos + 1;
             const m = this.reChar.exec(this.code);
             if (m) return 'b' + m[0];
        }

        this.reLifetime.lastIndex = this.pos;
        const lifetimeMatch = this.reLifetime.exec(this.code);
        if (lifetimeMatch) {
            return lifetimeMatch[0];
        }

        return null;
    }

    private matchNumber(): string | null {
        this.reHex.lastIndex = this.pos;
        const hex = this.reHex.exec(this.code);
        if (hex) return hex[0];

        this.reBin.lastIndex = this.pos;
        const bin = this.reBin.exec(this.code);
        if (bin) return bin[0];

        this.reOct.lastIndex = this.pos;
        const oct = this.reOct.exec(this.code);
        if (oct) return oct[0];

        this.reNumber.lastIndex = this.pos;
        const num = this.reNumber.exec(this.code);
        if (num) {
            const text = num[0];
            // Check for range ..
            // If followed by ., it might be range
            const endPos = this.pos + text.length;
            if (text.endsWith('.') && endPos < this.code.length && this.code[endPos] === '.') {
                 // matched 1. followed by . -> 1..
                 // Backtrack the dot
                 return text.substring(0, text.length - 1);
            }
            return text;
        }
        return null;
    }
}
