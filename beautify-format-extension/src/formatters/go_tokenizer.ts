export enum TokenType {
    Whitespace,
    Comment,
    String,
    Keyword,
    Operator,
    Punctuation,
    Identifier,
    Number,
    Newline,
    Unknown
}

export interface Token {
    type: TokenType;
    text: string;
    line: number;
    col: number;
}

export class GoTokenizer {
    private code: string;
    private pos: number = 0;
    private line: number = 1;
    private col: number = 1;

    private static readonly KEYWORDS = new Set([
        'break', 'default', 'func', 'interface', 'select', 'case', 'defer', 'go', 'map', 'struct',
        'chan', 'else', 'goto', 'package', 'switch', 'const', 'fallthrough', 'if', 'range', 'type',
        'continue', 'for', 'import', 'return', 'var'
    ]);

    private static readonly OPERATORS = new Set([
        '+', '-', '*', '/', '%', '&', '|', '^', '<<', '>>', '&^',
        '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '&^=',
        '&&', '||', '<-', '++', '--', '==', '<', '>', '=', '!', '!=', '<=', '>=', ':=', '...'
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

            // Whitespace (excluding newline)
            if (/[ \t]/.test(char)) {
                let text = '';
                const startCol = this.col;
                const startLine = this.line;
                while (this.pos < this.code.length && /[ \t]/.test(this.code[this.pos])) {
                    text += this.code[this.pos];
                    this.advance();
                }
                tokens.push({ type: TokenType.Whitespace, text, line: startLine, col: startCol });
                continue;
            }

            // Comment
            if (char === '/') {
                if (this.pos + 1 < this.code.length && this.code[this.pos + 1] === '/') {
                    // Line comment
                    let text = '';
                    const startCol = this.col;
                    const startLine = this.line;
                    while (this.pos < this.code.length && this.code[this.pos] !== '\n' && this.code[this.pos] !== '\r') {
                        text += this.code[this.pos];
                        this.advance();
                    }
                    tokens.push({ type: TokenType.Comment, text, line: startLine, col: startCol });
                    continue;
                } else if (this.pos + 1 < this.code.length && this.code[this.pos + 1] === '*') {
                    // Block comment
                    let text = '';
                    const startCol = this.col;
                    const startLine = this.line;
                    text += '/*';
                    this.advance(); // /
                    this.advance(); // *

                    while (this.pos < this.code.length) {
                        if (this.code[this.pos] === '*' && this.pos + 1 < this.code.length && this.code[this.pos + 1] === '/') {
                            text += '*/';
                            this.advance();
                            this.advance();
                            break;
                        }
                        text += this.code[this.pos];
                        // Handle newlines in block comments to update line numbers correctly
                        if (this.code[this.pos] === '\n') {
                            this.line++;
                            this.col = 0; // Will become 1 after advance
                        }
                        this.advance();
                    }
                    tokens.push({ type: TokenType.Comment, text, line: startLine, col: startCol });
                    continue;
                }
            }

            // String
            if (char === '"' || char === '`') {
                const stringMatch = this.matchString();
                if (stringMatch) {
                    const startLine = this.line;
                    const startCol = this.col;
                    tokens.push({ type: TokenType.String, text: stringMatch, line: startLine, col: startCol });
                    this.advanceString(stringMatch);
                    continue;
                }
            }

            // Character literal (rune)
            if (char === "'") {
                const charMatch = this.matchChar();
                if (charMatch) {
                    const startLine = this.line;
                    const startCol = this.col;
                    tokens.push({ type: TokenType.String, text: charMatch, line: startLine, col: startCol });
                    this.advanceStr(charMatch);
                    continue;
                }
            }

            // Number
            if (/\d/.test(char) || (char === '.' && this.pos + 1 < this.code.length && /\d/.test(this.code[this.pos + 1]))) {
                const numMatch = this.matchNumber();
                if (numMatch) {
                    const startLine = this.line;
                    const startCol = this.col;
                    tokens.push({ type: TokenType.Number, text: numMatch, line: startLine, col: startCol });
                    this.advanceStr(numMatch);
                    continue;
                }
            }

            // Identifier or Keyword
            if (/[a-zA-Z_]/.test(char)) {
                let text = '';
                const startCol = this.col;
                const startLine = this.line;

                while (this.pos < this.code.length && /[a-zA-Z0-9_]/.test(this.code[this.pos])) {
                    text += this.code[this.pos];
                    this.advance();
                }

                const type = GoTokenizer.KEYWORDS.has(text) ? TokenType.Keyword : TokenType.Identifier;
                tokens.push({ type, text, line: startLine, col: startCol });
                continue;
            }

            // Operators (multi-char first)
            let opMatch = '';
            // Try 3 chars (e.g. <<=, >>=, &^=, ...)
            const threeChars = this.code.substr(this.pos, 3);
            if (GoTokenizer.OPERATORS.has(threeChars)) {
                opMatch = threeChars;
            } else {
                // Try 2 chars
                const twoChars = this.code.substr(this.pos, 2);
                if (GoTokenizer.OPERATORS.has(twoChars)) {
                    opMatch = twoChars;
                } else {
                    // Try 1 char
                    if (GoTokenizer.OPERATORS.has(char)) {
                        opMatch = char;
                    }
                }
            }

            if (opMatch) {
                const startLine = this.line;
                const startCol = this.col;
                tokens.push({ type: TokenType.Operator, text: opMatch, line: startLine, col: startCol });
                this.advanceStr(opMatch);
                continue;
            }

            // Punctuation
            if ('()[]{},:;.'.includes(char)) {
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
        const lines = str.split(/\r\n|\r|\n/);
        if (lines.length > 1) {
            this.line += lines.length - 1;
            this.col = lines[lines.length - 1].length + 1;
        } else {
            this.col += str.length;
        }
        this.pos += str.length;
    }

    private matchString(): string | null {
        const quoteChar = this.code[this.pos];
        if (quoteChar !== '"' && quoteChar !== '`') return null;

        let currentString = quoteChar;
        let searchPos = this.pos + 1;

        if (quoteChar === '`') {
            // Raw string literal (can span lines, no escapes)
            while (searchPos < this.code.length) {
                const c = this.code[searchPos];
                currentString += c;
                searchPos++;
                if (c === '`') {
                    return currentString;
                }
            }
        } else {
            // Interpreted string literal
            while (searchPos < this.code.length) {
                const c = this.code[searchPos];
                if (c === '\\') {
                    if (searchPos + 1 < this.code.length) {
                        currentString += c + this.code[searchPos + 1];
                        searchPos += 2;
                        continue;
                    }
                }
                currentString += c;
                searchPos++;
                if (c === '"') {
                    return currentString;
                }
            }
        }

        return currentString; // Return what we have even if unclosed, for resilience
    }

    private matchChar(): string | null {
        // Rune literal '...'
        let currentString = "'";
        let searchPos = this.pos + 1;

        while (searchPos < this.code.length) {
            const c = this.code[searchPos];
            if (c === '\\') {
                if (searchPos + 1 < this.code.length) {
                    currentString += c + this.code[searchPos + 1];
                    searchPos += 2;
                    continue;
                }
            }
            currentString += c;
            searchPos++;
            if (c === "'") {
                return currentString;
            }
        }
        return currentString;
    }

    private matchNumber(): string | null {
        const remaining = this.code.substring(this.pos);

        // Hex
        const hexMatch = remaining.match(/^0[xX][0-9a-fA-F]+(_[0-9a-fA-F]+)*/);
        if (hexMatch) return hexMatch[0];

        // Octal
        const octMatch = remaining.match(/^0[oO]?[0-7]+(_[0-7]+)*/);
        if (octMatch) {
             // 0123 is octal in Go, or 0o123
             // But 0 is just 0.
             // Regex might match 0.123 partially if not careful.
             // We need to check if it's followed by a dot for floats.
             // But matchNumber is called only if it starts with digit or dot-digit.
             if (!remaining.startsWith('0.') && !remaining.startsWith('0e') && !remaining.startsWith('0E')) {
                 return octMatch[0];
             }
        }

        // Binary
        const binMatch = remaining.match(/^0[bB][01]+(_[01]+)*/);
        if (binMatch) return binMatch[0];

        // Float / Int / Imaginary
        // 1.23, .23, 123.45, 1e6, 1.2e+10, 1i, 1.2i
        const numberRegex = /^(\d+(_\d+)*(\.\d+(_\d+)*)?|\.\d+(_\d+)*)([eE][+-]?\d+(_\d+)*)?[i]?/;
        const match = remaining.match(numberRegex);

        if (match) return match[0];

        return null;
    }
}
