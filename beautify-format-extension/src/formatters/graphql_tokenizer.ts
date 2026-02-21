export enum TokenType {
    Whitespace,
    Comment,
    String,
    BlockString,
    Number,
    Punctuator,
    Name,
    Newline,
    Unknown
}

export interface Token {
    type: TokenType;
    text: string;
    line: number;
    col: number;
}

export class GraphQLTokenizer {
    private code: string;
    private pos: number = 0;
    private line: number = 1;
    private col: number = 1;

    // Punctuators
    private static readonly PUNCTUATORS = new Set([
        '!', '$', '(', ')', '...', ':', '=', '@', '[', ']', '{', '|', '}', ','
    ]);

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

            // Whitespace (Space, Tab)
            if (/[ \t]/.test(char)) {
                let start = this.pos;
                let text = '';
                while (this.pos < this.code.length && /[ \t]/.test(this.code[this.pos])) {
                    text += this.code[this.pos];
                    this.pos++;
                    this.col++;
                }
                tokens.push({ type: TokenType.Whitespace, text, line: this.line, col: this.col - text.length });
                continue;
            }

            // Comment (#...)
            if (char === '#') {
                let start = this.pos;
                let end = this.code.indexOf('\n', this.pos + 1);
                if (end === -1) end = this.code.length;
                else if (this.code[end - 1] === '\r') end--;

                const text = this.code.substring(start, end);
                tokens.push({ type: TokenType.Comment, text, line: this.line, col: this.col });
                this.advanceStr(text);
                continue;
            }

            // String ("...") and Block String ("""...""")
            if (char === '"') {
                if (this.pos + 2 < this.code.length && this.code[this.pos + 1] === '"' && this.code[this.pos + 2] === '"') {
                    // Block String
                    const str = this.matchBlockString();
                    if (str) {
                        tokens.push({ type: TokenType.BlockString, text: str, line: this.line, col: this.col });
                        this.advanceStr(str);
                        continue;
                    }
                } else {
                    // Normal String
                    const str = this.matchString();
                    if (str) {
                        tokens.push({ type: TokenType.String, text: str, line: this.line, col: this.col });
                        this.advanceStr(str);
                        continue;
                    }
                }
            }

            // Number (Integer or Float)
            // -? (0|[1-9][0-9]*) (\.[0-9]+)? ([eE][+-]?[0-9]+)?
            if (char === '-' || /\d/.test(char)) {
                const num = this.matchNumber();
                if (num) {
                    tokens.push({ type: TokenType.Number, text: num, line: this.line, col: this.col });
                    this.advanceStr(num);
                    continue;
                }
            }

            // Punctuator (...)
            if (this.pos + 2 < this.code.length && this.code.substring(this.pos, this.pos + 3) === '...') {
                tokens.push({ type: TokenType.Punctuator, text: '...', line: this.line, col: this.col });
                this.advanceStr('...');
                continue;
            }

            // Single char Punctuator
            if (GraphQLTokenizer.PUNCTUATORS.has(char)) {
                tokens.push({ type: TokenType.Punctuator, text: char, line: this.line, col: this.col });
                this.advance();
                continue;
            }

            // Name / Identifier
            if (/[_A-Za-z]/.test(char)) {
                let start = this.pos;
                while (this.pos < this.code.length && /[_0-9A-Za-z]/.test(this.code[this.pos])) {
                    this.pos++;
                    this.col++;
                }
                const text = this.code.substring(start, this.pos);
                // Adjust col/pos back because loop overshoots by 1 logically (wait, no, loop stops at first non-matching char)
                // But we already incremented pos/col inside loop.
                tokens.push({ type: TokenType.Name, text, line: this.line, col: this.col - text.length });
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

    private matchString(): string | null {
        let currentPos = this.pos;
        if (this.code[currentPos] !== '"') return null;
        currentPos++;

        while (currentPos < this.code.length) {
            const char = this.code[currentPos];
            if (char === '\\') {
                currentPos += 2;
                continue;
            } else if (char === '"') {
                return this.code.substring(this.pos, currentPos + 1);
            } else if (char === '\n' || char === '\r') {
                // GraphQL strings cannot contain unescaped newline
                return null;
            }
            currentPos++;
        }
        return null;
    }

    private matchBlockString(): string | null {
        let currentPos = this.pos;
        if (this.code.substring(currentPos, currentPos + 3) !== '"""') return null;
        currentPos += 3;

        while (currentPos < this.code.length) {
            if (this.code.substring(currentPos, currentPos + 3) === '"""') {
                // Check if escaped (preceded by odd number of backslashes?)
                // Actually block strings can contain """ if escaped like \"""
                let backslashCount = 0;
                let i = currentPos - 1;
                while (i >= this.pos && this.code[i] === '\\') {
                    backslashCount++;
                    i--;
                }

                if (backslashCount % 2 === 0) {
                     return this.code.substring(this.pos, currentPos + 3);
                }
            }
            currentPos++;
        }
        return null; // Unclosed block string
    }

    private matchNumber(): string | null {
        let currentPos = this.pos;
        if (this.code[currentPos] === '-') currentPos++;

        if (currentPos >= this.code.length || !/\d/.test(this.code[currentPos])) return null;

        // Integer part
        if (this.code[currentPos] === '0') {
            currentPos++;
            if (currentPos < this.code.length && /\d/.test(this.code[currentPos])) return null; // Leading zero not allowed unless single 0
        } else {
            while (currentPos < this.code.length && /\d/.test(this.code[currentPos])) currentPos++;
        }

        // Fraction part
        if (currentPos < this.code.length && this.code[currentPos] === '.') {
            currentPos++;
            if (currentPos >= this.code.length || !/\d/.test(this.code[currentPos])) return null; // Must have digit after dot
            while (currentPos < this.code.length && /\d/.test(this.code[currentPos])) currentPos++;
        }

        // Exponent part
        if (currentPos < this.code.length && (this.code[currentPos] === 'e' || this.code[currentPos] === 'E')) {
            currentPos++;
            if (currentPos < this.code.length && (this.code[currentPos] === '+' || this.code[currentPos] === '-')) currentPos++;
            if (currentPos >= this.code.length || !/\d/.test(this.code[currentPos])) return null; // Must have digit after exponent
            while (currentPos < this.code.length && /\d/.test(this.code[currentPos])) currentPos++;
        }

        // Ensure strictly valid number format, but tokenizer can be loose if needed.
        // Returning substring
        return this.code.substring(this.pos, currentPos);
    }
}
