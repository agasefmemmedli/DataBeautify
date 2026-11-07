export enum TokenType {
    BraceOpen,
    BraceClose,
    BracketOpen,
    BracketClose,
    Colon,
    Comma,
    String,
    Number,
    Boolean,
    Null,
    Comment,
    Whitespace,
    Unknown
}

export interface Token {
    type: TokenType;
    text: string;
    line: number;
    col: number;
}

export class JSONTokenizer {
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

            if (/\s/.test(char)) {
                tokens.push(this.readWhitespace());
            } else if (char === '{') {
                tokens.push({ type: TokenType.BraceOpen, text: '{', line: this.line, col: this.col });
                this.advance(1);
            } else if (char === '}') {
                tokens.push({ type: TokenType.BraceClose, text: '}', line: this.line, col: this.col });
                this.advance(1);
            } else if (char === '[') {
                tokens.push({ type: TokenType.BracketOpen, text: '[', line: this.line, col: this.col });
                this.advance(1);
            } else if (char === ']') {
                tokens.push({ type: TokenType.BracketClose, text: ']', line: this.line, col: this.col });
                this.advance(1);
            } else if (char === ':') {
                tokens.push({ type: TokenType.Colon, text: ':', line: this.line, col: this.col });
                this.advance(1);
            } else if (char === ',') {
                tokens.push({ type: TokenType.Comma, text: ',', line: this.line, col: this.col });
                this.advance(1);
            } else if (char === '"' || char === "'") {
                tokens.push(this.readString());
            } else if (char === '/' && (this.input[this.pos + 1] === '/' || this.input[this.pos + 1] === '*')) {
                tokens.push(this.readComment());
            } else if (/[0-9]/.test(char) || (char === '-' && /[0-9]/.test(this.input[this.pos + 1]))) {
                tokens.push(this.readNumber());
            } else if (/[\p{L}_$]/u.test(char)) {
                tokens.push(this.readIdentifier());
            } else {
                tokens.push({ type: TokenType.Unknown, text: char, line: this.line, col: this.col });
                this.advance(1);
            }
        }
        return tokens;
    }

    private readWhitespace(): Token {
        const startLine = this.line;
        const startCol = this.col;
        let text = '';
        while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
            text += this.input[this.pos];
            this.advance(1);
        }
        return { type: TokenType.Whitespace, text, line: startLine, col: startCol };
    }

    private readString(): Token {
        const startLine = this.line;
        const startCol = this.col;
        const quote = this.input[this.pos];
        let text = quote;
        this.advance(1);

        let escaped = false;
        while (this.pos < this.input.length) {
            const char = this.input[this.pos];
            text += char;
            this.advance(1);

            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === quote) {
                break;
            }
        }
        return { type: TokenType.String, text, line: startLine, col: startCol };
    }

    private readComment(): Token {
        const startLine = this.line;
        const startCol = this.col;
        let text = '';

        if (this.input.startsWith('//', this.pos)) {
            while (this.pos < this.input.length) {
                const char = this.input[this.pos];
                if (char === '\n') break;
                text += char;
                this.advance(1);
            }
        } else if (this.input.startsWith('/*', this.pos)) {
            while (this.pos < this.input.length) {
                if (this.input.startsWith('*/', this.pos)) {
                    text += '*/';
                    this.advance(2);
                    break;
                }
                text += this.input[this.pos];
                this.advance(1);
            }
        }
        return { type: TokenType.Comment, text, line: startLine, col: startCol };
    }

    private readNumber(): Token {
        const startLine = this.line;
        const startCol = this.col;
        let text = '';
        while (this.pos < this.input.length) {
            const char = this.input[this.pos];
            if (/[0-9+\-eE.]/.test(char)) {
                text += char;
                this.advance(1);
            } else {
                break;
            }
        }
        return { type: TokenType.Number, text, line: startLine, col: startCol };
    }

    private readIdentifier(): Token {
        const startLine = this.line;
        const startCol = this.col;
        let text = '';
        while (this.pos < this.input.length) {
            const char = this.input[this.pos];
            // Allow hyphens in identifiers for kebab-case unquoted keys
            if (/[\p{L}\p{N}_$\-]/u.test(char)) {
                text += char;
                this.advance(1);
            } else {
                break;
            }
        }
        if (text === 'true') return { type: TokenType.Boolean, text, line: startLine, col: startCol };
        if (text === 'false') return { type: TokenType.Boolean, text, line: startLine, col: startCol };
        if (text === 'null') return { type: TokenType.Null, text, line: startLine, col: startCol };

        return { type: TokenType.Unknown, text, line: startLine, col: startCol };
    }

    private advance(n: number) {
        for (let i = 0; i < n; i++) {
            if (this.pos >= this.input.length) break;
            if (this.input[this.pos] === '\n') {
                this.line++;
                this.col = 1;
            } else {
                this.col++;
            }
            this.pos++;
        }
    }
}
