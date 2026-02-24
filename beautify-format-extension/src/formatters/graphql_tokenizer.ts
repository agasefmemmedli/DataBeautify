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

            // Whitespace (Space, Tab, Comma treated as whitespace in GraphQL effectively, but kept as Punctuator usually.
            // Wait, GraphQL spec says comma is insignificant. But often kept as token for formatting.)
            // The previous tokenizer treated comma as Punctuator. Let's keep it that way for formatter control.
            if (/[ \t]/.test(char)) {
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
                let end = this.pos;
                while (end < this.code.length) {
                    const c = this.code[end];
                    if (c === '\n' || c === '\r') break;
                    end++;
                }

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
                // Note: pos/col already updated in loop
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
        // Correction: The loop above iterates characters but doesn't advance this.pos
        // because we want to calculate line/col changes.
        // But `this.pos += str.length` is done at the end.
        // Wait! If I do `this.pos += str.length` AFTER the loop, and the loop iterates `str`,
        // that's correct for `pos`. But `col` updates inside loop are correct.

        // Wait, the logic `this.pos += str.length` adds length to `pos`.
        // But the loop just calculates `line` and `col`.
        // However, if `str` was consumed by `substring` from `this.code`, `this.pos` was pointing to start of `str`.
        // So `this.pos` needs to move by `str.length`. Correct.

        // Wait, in the loop:
        // `this.pos` is NOT updated. `this.col` IS updated.
        // At end, `this.pos` is updated.
        // This is correct.
    }

    private matchString(): string | null {
        let currentPos = this.pos;
        if (this.code[currentPos] !== '"') return null;
        currentPos++; // Skip first quote

        while (currentPos < this.code.length) {
            const char = this.code[currentPos];
            if (char === '\\') {
                currentPos += 2; // Skip escape sequence
                continue;
            } else if (char === '"') {
                // Found closing quote
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
            if (currentPos < this.code.length && /\d/.test(this.code[currentPos])) {
                // Leading zero not allowed unless single 0.
                // But let's be lenient for tokenizer, just consume it.
                // Or follow spec strictly? Spec says no leading zeros.
                // If we return null, it might be parsed as something else or Unknown.
                // Let's consume it as number anyway for fault tolerance.
                while (currentPos < this.code.length && /\d/.test(this.code[currentPos])) currentPos++;
            }
        } else {
            while (currentPos < this.code.length && /\d/.test(this.code[currentPos])) currentPos++;
        }

        // Fraction part
        if (currentPos < this.code.length && this.code[currentPos] === '.') {
            currentPos++;
            if (currentPos >= this.code.length || !/\d/.test(this.code[currentPos])) {
                 // Trailing dot is invalid, but maybe we can return what we have so far?
                 // If we return null, it might be re-parsed.
                 // Let's assume valid number stops before dot if dot is not followed by digit?
                 // No, standard says it must have digit.
                 return null;
            }
            while (currentPos < this.code.length && /\d/.test(this.code[currentPos])) currentPos++;
        }

        // Exponent part
        if (currentPos < this.code.length && (this.code[currentPos] === 'e' || this.code[currentPos] === 'E')) {
            let ePos = currentPos;
            currentPos++;
            if (currentPos < this.code.length && (this.code[currentPos] === '+' || this.code[currentPos] === '-')) currentPos++;
            if (currentPos >= this.code.length || !/\d/.test(this.code[currentPos])) {
                // Invalid exponent
                return null;
            }
            while (currentPos < this.code.length && /\d/.test(this.code[currentPos])) currentPos++;
        }

        return this.code.substring(this.pos, currentPos);
    }
}
