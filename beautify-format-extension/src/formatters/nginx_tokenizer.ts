
export enum TokenType {
    Whitespace,
    Comment,
    String,
    Punctuation, // { } ;
    Word,        // Directives, values, variables
    Unknown
}

export interface Token {
    type: TokenType;
    text: string;
    line: number;
    col: number;
    endLine: number;
}

export class NginxTokenizer {
    private code: string;
    private pos: number = 0;
    private line: number = 1;
    private col: number = 1;

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
            const startLine = this.line;
            const startCol = this.col;

            // Whitespace
            if (/\s/.test(char)) {
                let text = '';
                while (this.pos < this.code.length && /\s/.test(this.code[this.pos])) {
                    const c = this.code[this.pos];
                    text += c;
                    this.advance(c);
                }
                tokens.push({ type: TokenType.Whitespace, text, line: startLine, col: startCol, endLine: this.line });
                continue;
            }

            // Comment
            if (char === '#') {
                let text = '';
                while (this.pos < this.code.length && this.code[this.pos] !== '\n') {
                    const c = this.code[this.pos];
                    text += c;
                    this.advance(c);
                }
                tokens.push({ type: TokenType.Comment, text, line: startLine, col: startCol, endLine: this.line });
                continue;
            }

            // Strings ("..." or '...')
            if (char === '"' || char === "'") {
                const quote = char;
                let text = quote;
                this.advance(quote); // Skip opening quote
                let escaped = false;
                while (this.pos < this.code.length) {
                    const c = this.code[this.pos];
                    text += c;
                    this.advance(c);
                    if (escaped) {
                        escaped = false;
                    } else {
                        if (c === '\\') {
                            escaped = true;
                        } else if (c === quote) {
                            break;
                        }
                    }
                }
                tokens.push({ type: TokenType.String, text, line: startLine, col: startCol, endLine: this.line });
                continue;
            }

            // Punctuation
            if (char === '{' || char === '}' || char === ';') {
                tokens.push({ type: TokenType.Punctuation, text: char, line: startLine, col: startCol, endLine: this.line });
                this.advance(char);
                continue;
            }

            // Word (Directives, parameters)
            let text = '';
            while (this.pos < this.code.length) {
                const c = this.code[this.pos];
                if (/\s/.test(c) || c === '{' || c === '}' || c === ';' || c === '#' || c === '"' || c === "'") {
                    break;
                }
                text += c;
                this.advance(c);
            }
            if (text.length > 0) {
                tokens.push({ type: TokenType.Word, text, line: startLine, col: startCol, endLine: this.line });
            } else {
                 const c = this.code[this.pos];
                 tokens.push({ type: TokenType.Unknown, text: c, line: startLine, col: startCol, endLine: this.line });
                 this.advance(c);
            }
        }
        return tokens;
    }

    private advance(char: string) {
        if (char === '\n') {
            this.line++;
            this.col = 1;
        } else {
            this.col++;
        }
        this.pos++;
    }
}
