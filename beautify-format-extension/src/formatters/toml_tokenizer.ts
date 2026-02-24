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

            // Newline
            if (char === '\n' || (char === '\r' && this.input[this.pos + 1] === '\n')) {
                const value = char === '\r' ? '\r\n' : '\n';
                tokens.push({ type: TokenType.Newline, value, line: this.line, col: this.col });
                this.advance(value.length);
                continue;
            }

            // Whitespace
            if (/[ \t]/.test(char)) {
                let value = '';
                const startLine = this.line;
                const startCol = this.col;
                while (this.pos < this.input.length && /[ \t]/.test(this.input[this.pos])) {
                    value += this.input[this.pos];
                    this.advance(1);
                }
                tokens.push({ type: TokenType.Whitespace, value, line: startLine, col: startCol });
                continue;
            }

            // Comment
            if (char === '#') {
                let value = '';
                const startLine = this.line;
                const startCol = this.col;
                while (this.pos < this.input.length && this.input[this.pos] !== '\n' && this.input[this.pos] !== '\r') {
                    value += this.input[this.pos];
                    this.advance(1);
                }
                tokens.push({ type: TokenType.Comment, value, line: startLine, col: startCol });
                continue;
            }

            // Symbols
            if (['=', '[', ']', '{', '}', ',', '.'].includes(char)) {
                tokens.push({ type: TokenType.Symbol, value: char, line: this.line, col: this.col });
                this.advance(1);
                continue;
            }

            // Strings
            if (char === '"' || char === "'") {
                tokens.push(this.readString());
                continue;
            }

            // Words (Identifier, Number, Boolean, Date)
            // Allowed start chars: A-Za-z0-9_-+
            if (/[a-zA-Z0-9_\-+]/.test(char)) {
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
            } else if (char === '\r' && this.input[this.pos + 1] === '\n') {
                // Next char is \n, will be handled next iteration of advance loop if n > 1
                // But if n=1, we just advance past \r.
                // If we are consuming \r\n as 2 chars, it works.
                this.col++;
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
        this.advance(1);

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
                     // Check escaping
                     if (quote === '"' && this.isEscaped(this.pos)) {
                         value += char;
                         this.advance(1);
                         continue;
                     }
                     // End of multiline string
                     value += quote + quote + quote;
                     this.advance(3);
                     break;
                }
            } else {
                if (char === quote) {
                    if (quote === "'" || !this.isEscaped(this.pos)) {
                        value += char;
                        this.advance(1);
                        break;
                    }
                }
                if (char === '\n' || char === '\r') {
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
        let hasDot = false;

        while (this.pos < this.input.length) {
            const char = this.input[this.pos];
            if (/[ \t\n\r]/.test(char) || ['#', '=', '[', ']', '{', '}', ',', '"', "'"].includes(char)) {
                break;
            }

            if (char === '.') {
                 // Allow dot if it's part of a float (3.14) or date (00:00:00.000)
                 // Check if valid float part: previously digits, next digits
                 if (!hasDot && /^\d+$/.test(value) && this.pos + 1 < this.input.length && /\d/.test(this.input[this.pos+1])) {
                     hasDot = true;
                     value += char;
                     this.advance(1);
                     continue;
                 }
                 // Check if valid date part: value looks like time, next is digit
                 if (!hasDot && /\d{2}:\d{2}:\d{2}$/.test(value) && this.pos + 1 < this.input.length && /\d/.test(this.input[this.pos+1])) {
                     hasDot = true;
                     value += char;
                     this.advance(1);
                     continue;
                 }
                 break;
            }

            value += char;
            this.advance(1);
        }

        // Determine type
        let type = TokenType.Identifier;
        if (value === 'true' || value === 'false') {
            type = TokenType.Boolean;
        }
        else if (/^[+-]?\d+(?:_\d+)*$/.test(value)) {
             type = TokenType.Number;
        } else if (/^0x[0-9a-fA-F_]+$/.test(value) || /^0o[0-7_]+$/.test(value) || /^0b[0-1_]+$/.test(value)) {
             type = TokenType.Number;
        }
        else if (/^[+-]?\d+(?:_\d+)*\.\d+(?:_\d+)*$/.test(value)) {
             type = TokenType.Number;
        }
        else if (/^[+-]?\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?[eE][+-]?\d+(?:_\d+)*$/.test(value)) {
             type = TokenType.Number;
        }
        else if (/^[+-]?nan$/.test(value) || /^[+-]?inf$/.test(value)) {
             type = TokenType.Number;
        }
        else if (/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value)) {
             type = TokenType.Date;
        } else if (/^\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)) {
             type = TokenType.Date;
        }

        return { type, value, line: startLine, col: startCol };
    }
}
