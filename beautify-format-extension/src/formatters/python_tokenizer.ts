
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
    Unknown,
    Decorator
}

export interface Token {
    type: TokenType;
    text: string;
    line: number;
    col: number;
}

export class PythonTokenizer {
    private code: string;
    private pos: number = 0;
    private line: number = 1;
    private col: number = 1;

    // Added match, case, type for Python 3.10+
    private static readonly KEYWORDS = new Set([
        'def', 'class', 'if', 'elif', 'else', 'while', 'for', 'in', 'try', 'except',
        'finally', 'with', 'as', 'import', 'from', 'return', 'yield', 'raise', 'break',
        'continue', 'pass', 'global', 'nonlocal', 'assert', 'del', 'lambda', 'async',
        'await', 'is', 'not', 'and', 'or', 'True', 'False', 'None', 'match', 'case', 'type'
    ]);

    private static readonly OPERATORS = new Set([
        '+', '-', '*', '/', '%', '**', '//', '@', '<<', '>>', '&', '|', '^', '~',
        '<', '>', '<=', '>=', '==', '!=', ':=', '=',
        '+=', '-=', '*=', '/=', '%=', '//=', '**=', '@=', '&=', '|=', '^=', '<<=', '>>=',
        '->', '...'
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
            if (char === '#') {
                let text = '';
                const startCol = this.col;
                const startLine = this.line;
                while (this.pos < this.code.length && this.code[this.pos] !== '\n' && this.code[this.pos] !== '\r') {
                    text += this.code[this.pos];
                    this.advance();
                }
                tokens.push({ type: TokenType.Comment, text, line: startLine, col: startCol });
                continue;
            }

            // String (incl. raw/format/unicode prefixes)
            const stringMatch = this.matchString();
            if (stringMatch) {
                const startLine = this.line;
                const startCol = this.col;
                tokens.push({ type: TokenType.String, text: stringMatch, line: startLine, col: startCol });
                this.advanceString(stringMatch);
                continue;
            }

            // Number
            // Hex/Bin/Oct or simple float/int
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

                // Read until non-identifier char
                while (this.pos < this.code.length && /[a-zA-Z0-9_]/.test(this.code[this.pos])) {
                    text += this.code[this.pos];
                    this.advance();
                }

                const type = PythonTokenizer.KEYWORDS.has(text) ? TokenType.Keyword : TokenType.Identifier;
                tokens.push({ type, text, line: startLine, col: startCol });
                continue;
            }

            // Operators (multi-char first)
            let opMatch = '';
            // Try 3 chars (e.g. **=, //=, ...)
            const threeChars = this.code.substring(this.pos, this.pos + 3);
            if (PythonTokenizer.OPERATORS.has(threeChars)) {
                opMatch = threeChars;
            } else {
                // Try 2 chars
                const twoChars = this.code.substring(this.pos, this.pos + 2);
                if (PythonTokenizer.OPERATORS.has(twoChars)) {
                    opMatch = twoChars;
                } else {
                    // Try 1 char
                    if (PythonTokenizer.OPERATORS.has(char)) {
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

            // Backslash (line continuation)
            if (char === '\\') {
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
        // Look for prefixes
        let prefix = '';
        let offset = 0;

        // Greedily consume letters to find prefix
        // Max prefix length is 2 (rf, fr, br, rb, u, b, r, f)
        while (this.pos + offset < this.code.length) {
            const c = this.code[this.pos + offset];
            if (c === "'" || c === '"') {
                break;
            }
            if (/[a-zA-Z]/.test(c)) {
                prefix += c;
                offset++;
            } else {
                return null; // Hit something else before quote
            }
        }

        if (prefix.length > 0) {
            // Enhanced prefix check for f, r, b, u and combinations
            if (!/^(r|u|f|b|fr|rf|br|rb|ur|ru)$/i.test(prefix)) {
                return null; // Invalid prefix
            }
        }

        if (this.pos + offset >= this.code.length) return null;

        const quoteChar = this.code[this.pos + offset];
        if (quoteChar !== "'" && quoteChar !== '"') return null;

        // Triple quote check
        let delimiter = quoteChar;
        if (this.pos + offset + 2 < this.code.length &&
            this.code[this.pos + offset + 1] === quoteChar &&
            this.code[this.pos + offset + 2] === quoteChar) {
            delimiter = quoteChar.repeat(3);
        }

        let currentString = this.code.substring(this.pos, this.pos + offset + delimiter.length);
        let searchPos = this.pos + offset + delimiter.length;

        while (searchPos < this.code.length) {
            // Check for end delimiter
            if (this.code.startsWith(delimiter, searchPos)) {
                // Check escaping
                let backslashCount = 0;
                let i = searchPos - 1;
                while (i >= this.pos && this.code[i] === '\\') {
                    backslashCount++;
                    i--;
                }

                // If even backslashes, delimiter is NOT escaped
                if (backslashCount % 2 === 0) {
                    currentString += delimiter;
                    return currentString;
                }
            }

            currentString += this.code[searchPos];
            searchPos++;
        }

        return null; // Unclosed string
    }

    private matchNumber(): string | null {
        const remaining = this.code.substring(this.pos);

        const hexMatch = remaining.match(/^0[xX][0-9a-fA-F]+(_[0-9a-fA-F]+)*/);
        if (hexMatch) return hexMatch[0];

        const binMatch = remaining.match(/^0[bB][01]+(_[01]+)*/);
        if (binMatch) return binMatch[0];

        const octMatch = remaining.match(/^0[oO][0-7]+(_[0-7]+)*/);
        if (octMatch) return octMatch[0];

        // Float/Int/Complex
        // Matches decimals, floats with exponents, and complex numbers (j)
        const numberRegex = /^(\d+(_\d+)*(\.\d+(_\d+)*)?|\.\d+(_\d+)*)([eE][+-]?\d+(_\d+)*)?[jJ]?/;
        const match = remaining.match(numberRegex);

        if (match) return match[0];

        return null;
    }
}
