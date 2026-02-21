export enum TokenType {
    Comment,
    Whitespace,
    Newline,
    Symbol, // [ ] { } = , .
    String, // "...", '...', """...""", '''...'''
    Identifier, // bare keys
    Number,
    Boolean,
    Date,
    Unknown
}

export interface Token {
    type: TokenType;
    value: string;
    line: number;
    col: number;
}

export class TOMLTokenizer {
    private input: string;
    private pos: number = 0;
    private line: number = 1;
    private col: number = 1;

    constructor(input: string) {
        this.input = input;
    }

    public tokenize(): Token[] {
        const tokens: Token[] = [];
        while (this.pos < this.input.length) {
            const char = this.input[this.pos];

            if (char === '\n' || (char === '\r' && this.input[this.pos + 1] === '\n')) {
                const value = char === '\r' ? '\r\n' : '\n';
                tokens.push({ type: TokenType.Newline, value, line: this.line, col: this.col });
                this.advance(value.length);
                continue;
            }

            if (/\s/.test(char)) {
                let value = '';
                while (this.pos < this.input.length && /\s/.test(this.input[this.pos]) && this.input[this.pos] !== '\n' && this.input[this.pos] !== '\r') {
                    value += this.input[this.pos];
                    this.advance(1);
                }
                tokens.push({ type: TokenType.Whitespace, value, line: this.line, col: this.col - value.length }); // Correct col? No, advance updates col.
                // Wait, advance updates this.col. So if I push after loop, the col is correct for start?
                // No, I should capture start position.
                // Refactor loop slightly.
                continue;
            }

            if (char === '#') {
                let value = '';
                while (this.pos < this.input.length && this.input[this.pos] !== '\n' && this.input[this.pos] !== '\r') {
                    value += this.input[this.pos];
                    this.advance(1);
                }
                tokens.push({ type: TokenType.Comment, value, line: this.line, col: this.col - value.length });
                continue;
            }

            if (['=', '[', ']', '{', '}', ',', '.'].includes(char)) {
                tokens.push({ type: TokenType.Symbol, value: char, line: this.line, col: this.col });
                this.advance(1);
                continue;
            }

            if (char === '"' || char === "'") {
                tokens.push(this.readString());
                continue;
            }

            if (/[a-zA-Z0-9_\-]/.test(char)) {
                // Identifier, Number, Boolean, Date
                tokens.push(this.readWord());
                continue;
            }

            // Unknown
            tokens.push({ type: TokenType.Unknown, value: char, line: this.line, col: this.col });
            this.advance(1);
        }
        return tokens;
    }

    private advance(n: number = 1) {
        for (let i = 0; i < n; i++) {
            if (this.pos >= this.input.length) break;
            const char = this.input[this.pos];
            if (char === '\n') {
                this.line++;
                this.col = 1;
            } else {
                this.col++;
            }
            this.pos++;
        }
    }

    private readString(): Token {
        const startLine = this.line;
        const startCol = this.col;
        const quote = this.input[this.pos];
        let value = quote;
        this.advance(1); // Skip first quote

        let isMultiline = false;
        if (this.pos + 1 < this.input.length && this.input[this.pos] === quote && this.input[this.pos + 1] === quote) {
            isMultiline = true;
            value += quote + quote;
            this.advance(2);
        }

        while (this.pos < this.input.length) {
            const char = this.input[this.pos];

            if (isMultiline) {
                if (char === quote && this.input[this.pos + 1] === quote && this.input[this.pos + 2] === quote) {
                     // Check for escaping?
                     // Basic strings (""") use backslash escape. Literal strings (''') do not.
                     if (quote === '"' && this.input[this.pos - 1] === '\\' && this.input[this.pos - 2] !== '\\') {
                         // Escaped quote? No, wait.
                         // In multiline string, """ can be escaped.
                     }
                     // Keep it simple: if we find 3 quotes, it ends, unless escaped (for basic).
                     if (quote === '"' && this.isEscaped(this.pos)) {
                         value += char;
                         this.advance(1);
                         continue;
                     }

                     value += quote + quote + quote;
                     this.advance(3);
                     break;
                }
            } else {
                if (char === quote && (quote === "'" || !this.isEscaped(this.pos))) {
                    value += char;
                    this.advance(1);
                    break;
                }
                if (char === '\n' || char === '\r') {
                     // Single line string cannot contain unescaped newline
                     break;
                }
            }

            value += char;
            this.advance(1);
        }

        return { type: TokenType.String, value, line: startLine, col: startCol };
    }

    private isEscaped(index: number): boolean {
        let backslashCount = 0;
        let i = index - 1;
        while (i >= 0 && this.input[i] === '\\') {
            backslashCount++;
            i--;
        }
        return backslashCount % 2 !== 0;
    }

    private readWord(): Token {
        const startLine = this.line;
        const startCol = this.col;
        let value = '';

        // TOML identifiers: A-Za-z0-9_-
        // Values: true, false, dates (1979-05-27T07:32:00Z), numbers (1.2, -10, 1_000, 0x123)
        // We will read until a delimiter (whitespace, symbol, newline)
        // But date can contain ':', '-', '+', 'T', 'Z' which might be confusing if we treat ':' as symbol?
        // Actually TOML doesn't use ':' as separator, it uses '='.
        // But inline tables use ':'? No, TOML inline tables use `key = val`.
        // So ':' is only used in times.
        // '.' is used in floats and dotted keys.

        // So we consume until whitespace, comment #, or strict symbols [ ] { } = ,
        // We should allow . in words for now (dotted keys, floats) or split it?
        // If we split ., then 1.2 becomes NUMBER . NUMBER.
        // If we split ., then key.subkey becomes IDENT . IDENT.
        // This is safer for formatting.

        // Allowed chars in a "word": A-Za-z0-9_ - + :
        // Note: . is treated as symbol in main loop.

        while (this.pos < this.input.length) {
            const char = this.input[this.pos];
            if (/\s/.test(char) || ['#', '=', '[', ']', '{', '}', ',', '"', "'"].includes(char)) {
                break;
            }
            if (char === '.') {
                // If previous char was digit and next char is digit, maybe it's a float?
                // But simplified tokenizer can treat . as symbol and formatter can merge if needed?
                // Or let's treat . as part of word if it looks like a number?
                // Complex. Let's treat . as Symbol always.
                // Wait, if I treat . as symbol, then 3.14 is NUMBER SYMBOL NUMBER.
                // 192.168.1.1 is NUMBER SYMBOL NUMBER SYMBOL...
                // dotted.key is IDENT SYMBOL IDENT.
                // This seems consistent.
                break;
            }
            value += char;
            this.advance(1);
        }

        // Determine type
        let type = TokenType.Identifier;
        if (value === 'true' || value === 'false') {
            type = TokenType.Boolean;
        } else if (/^[+-]?\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?(?:[eE][+-]?\d+(?:_\d+)*)?$/.test(value)) {
             type = TokenType.Number;
        } else if (/^[+-]?nan$/.test(value) || /^[+-]?inf$/.test(value)) {
             type = TokenType.Number;
        } else if (/^0x[0-9a-fA-F_]+$/.test(value) || /^0o[0-7_]+$/.test(value) || /^0b[0-1_]+$/.test(value)) {
             type = TokenType.Number;
        } else if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(value)) {
             type = TokenType.Date;
        } else if (/^\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)) {
             type = TokenType.Date; // Local Time
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
             type = TokenType.Date; // Local Date
        }

        return { type, value, line: startLine, col: startCol };
    }
}
