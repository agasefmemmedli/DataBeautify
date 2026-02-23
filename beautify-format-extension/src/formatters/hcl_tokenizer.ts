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
    Heredoc
}

export interface Token {
    type: TokenType;
    text: string;
    line: number;
    col: number;
}

export class HCLTokenizer {
    private code: string;
    private pos: number = 0;
    private line: number = 1;
    private col: number = 1;

    // Common HCL/Terraform keywords
    private static readonly KEYWORDS = new Set([
        'resource', 'data', 'variable', 'output', 'module', 'provider', 'terraform', 'locals',
        'true', 'false', 'null', 'if', 'else', 'for', 'in', 'dynamic', 'lifecycle', 'provisioner',
        'connection', 'backend', 'version', 'source', 'count', 'depends_on', 'for_each'
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
                const comment = this.readUntilNewline();
                tokens.push({ type: TokenType.Comment, text: comment, line: this.line, col: this.col - comment.length }); // Approx col
                continue;
            }
            if (char === '/' && this.pos + 1 < this.code.length) {
                if (this.code[this.pos + 1] === '/') {
                    const comment = this.readUntilNewline();
                    tokens.push({ type: TokenType.Comment, text: comment, line: this.line, col: this.col - comment.length });
                    continue;
                } else if (this.code[this.pos + 1] === '*') {
                    const comment = this.readBlockComment();
                    tokens.push({ type: TokenType.Comment, text: comment, line: this.line, col: this.col }); // Start col is tricky if multiline
                    continue;
                }
            }

            // Heredoc
            if (char === '<' && this.pos + 1 < this.code.length && this.code[this.pos + 1] === '<') {
                // Potential heredoc
                // Check if it matches <<-? identifier
                const remaining = this.code.substring(this.pos);
                const match = remaining.match(/^(<<-?)\s*([a-zA-Z0-9_]+)/);
                if (match) {
                    const operator = match[1];
                    const delimiter = match[2];
                    const indented = operator.includes('-');
                    const heredoc = this.readHeredoc(delimiter, indented);
                    tokens.push({ type: TokenType.Heredoc, text: heredoc, line: this.line, col: this.col });
                    continue;
                }
            }

            // String
            if (char === '"') {
                const str = this.readString();
                tokens.push({ type: TokenType.String, text: str, line: this.line, col: this.col });
                continue;
            }

            // Number
            if (/\d/.test(char) || (char === '.' && this.pos + 1 < this.code.length && /\d/.test(this.code[this.pos + 1]))) {
                const num = this.readNumber();
                tokens.push({ type: TokenType.Number, text: num, line: this.line, col: this.col });
                continue;
            }

            // Identifier or Keyword
            if (/[a-zA-Z_]/.test(char)) {
                const id = this.readIdentifier();
                const type = HCLTokenizer.KEYWORDS.has(id) ? TokenType.Keyword : TokenType.Identifier;
                tokens.push({ type, text: id, line: this.line, col: this.col });
                continue;
            }

            // Punctuation / Operators
            if ('{}[]()=.,:+-*/%&|!<>?'.includes(char)) {
                // Check for multi-char operators like ==, !=, >=, <=, &&, ||
                let text = char;
                this.advance();
                if (this.pos < this.code.length) {
                    const next = this.code[this.pos];
                    if ((char === '=' && next === '=') ||
                        (char === '!' && next === '=') ||
                        (char === '<' && next === '=') ||
                        (char === '>' && next === '=') ||
                        (char === '&' && next === '&') ||
                        (char === '|' && next === '|') ||
                        (char === '.' && next === '.' && this.pos + 1 < this.code.length && this.code[this.pos + 1] === '.')) { // ...
                        text += next;
                        this.advance();
                        if (char === '.' && text === '..') {
                             text += '.';
                             this.advance();
                        }
                    }
                }

                const type = '{}[](),.'.includes(text[0]) ? TokenType.Punctuation : TokenType.Operator;
                tokens.push({ type, text, line: this.line, col: this.col });
                continue;
            }

            // Unknown
            tokens.push({ type: TokenType.Unknown, text: char, line: this.line, col: this.col });
            this.advance();
        }

        return tokens;
    }

    private advance() {
        if (this.code[this.pos] === '\n') {
            this.line++;
            this.col = 1;
        } else {
            this.col++;
        }
        this.pos++;
    }

    private readUntilNewline(): string {
        let text = '';
        while (this.pos < this.code.length) {
            const char = this.code[this.pos];
            if (char === '\n' || char === '\r') break;
            text += char;
            this.advance();
        }
        return text;
    }

    private readBlockComment(): string {
        let text = '/*';
        this.advance(); // /
        this.advance(); // *

        while (this.pos < this.code.length) {
            const char = this.code[this.pos];
            if (char === '*' && this.pos + 1 < this.code.length && this.code[this.pos + 1] === '/') {
                text += '*/';
                this.advance();
                this.advance();
                break;
            }
            text += char;
            this.advance();
        }
        return text;
    }

    private readString(): string {
        let text = '"';
        this.advance(); // "

        while (this.pos < this.code.length) {
            const char = this.code[this.pos];
            if (char === '\\') {
                text += char;
                this.advance();
                if (this.pos < this.code.length) {
                    text += this.code[this.pos];
                    this.advance();
                }
                continue;
            }
            text += char;
            this.advance();
            if (char === '"') break;
        }
        return text;
    }

    private readNumber(): string {
        let text = '';
        while (this.pos < this.code.length) {
            const char = this.code[this.pos];
            if (/[0-9]/.test(char)) {
                text += char;
                this.advance();
            } else if (char === '.') {
                if (text.includes('.')) break;
                text += char;
                this.advance();
            } else if (char === 'e' || char === 'E') {
                if (text.includes('e') || text.includes('E')) break;
                text += char;
                this.advance();
                if (this.pos < this.code.length) {
                    const next = this.code[this.pos];
                    if (next === '+' || next === '-') {
                        text += next;
                        this.advance();
                    }
                }
            } else {
                break;
            }
        }
        return text;
    }

    private readIdentifier(): string {
        let text = '';
        while (this.pos < this.code.length) {
            const char = this.code[this.pos];
            if (/[a-zA-Z0-9_-]/.test(char)) {
                text += char;
                this.advance();
            } else {
                break;
            }
        }
        return text;
    }

    private readHeredoc(delimiter: string, indented: boolean): string {
        // Re-match start to consume it
        const remaining = this.code.substring(this.pos);
        const match = remaining.match(/^(<<-?\s*)([a-zA-Z0-9_]+)/);
        if (!match) return '';

        let text = match[0];
        const startLen = text.length;
        for(let i=0; i<startLen; i++) this.advance();

        while (this.pos < this.code.length) {
            const char = this.code[this.pos];
            text += char;
            this.advance();

            if (char === '\n') {
                const nextNewline = this.code.indexOf('\n', this.pos);
                const checkEnd = nextNewline === -1 ? this.code.length : nextNewline;
                const lineContent = this.code.substring(this.pos, checkEnd);

                let isMatch = false;
                if (indented) {
                    if (lineContent.trim() === delimiter) isMatch = true;
                } else {
                    const cleanLine = lineContent.replace(/\r$/, '');
                    if (cleanLine === delimiter) isMatch = true;
                }

                if (isMatch) {
                    text += lineContent;
                    for(let i=0; i<lineContent.length; i++) this.advance();
                    break;
                }
            }
        }

        return text;
    }
}
