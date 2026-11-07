export enum TokenType {
    TagOpen,
    TagClose,
    TagSelfClose,
    TagEnd,
    AttributeName,
    AttributeValue,
    Text,
    Comment,
    CDATA,
    Doctype,
    PI,
    Whitespace,
    Unknown
}

export interface Token {
    type: TokenType;
    text: string;
    line: number;
    col: number;
    // Offset of the token in the source text
    pos: number;
}

export class XMLTokenizer {
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

            if (char === '<') {
                if (this.input.startsWith('<!--', this.pos)) {
                    tokens.push(this.readComment());
                } else if (this.input.startsWith('<![CDATA[', this.pos)) {
                    tokens.push(this.readCDATA());
                } else if (this.input.startsWith('<!DOCTYPE', this.pos)) {
                    tokens.push(this.readDoctype());
                } else if (this.input.startsWith('<?', this.pos)) {
                    tokens.push(this.readPI());
                } else if (this.input.startsWith('</', this.pos)) {
                    tokens.push(this.readTagClose());
                } else {
                    tokens.push(...this.readTagOpen());
                }
            } else {
                tokens.push(this.readText());
            }
        }
        return tokens;
    }

    private readComment(): Token {
        const startLine = this.line;
        const startCol = this.col;
        const startPos = this.pos;
        let text = '';
        while (this.pos < this.input.length) {
            if (this.input.startsWith('-->', this.pos)) {
                text += '-->';
                this.advance(3);
                break;
            }
            text += this.input[this.pos];
            this.advance(1);
        }
        return { type: TokenType.Comment, text, line: startLine, col: startCol, pos: startPos };
    }

    private readCDATA(): Token {
        const startLine = this.line;
        const startCol = this.col;
        const startPos = this.pos;
        let text = '';
        while (this.pos < this.input.length) {
            if (this.input.startsWith(']]>', this.pos)) {
                text += ']]>';
                this.advance(3);
                break;
            }
            text += this.input[this.pos];
            this.advance(1);
        }
        return { type: TokenType.CDATA, text, line: startLine, col: startCol, pos: startPos };
    }

    private readDoctype(): Token {
        const startLine = this.line;
        const startCol = this.col;
        const startPos = this.pos;
        let text = '';
        let depth = 0;

        while (this.pos < this.input.length) {
            const char = this.input[this.pos];
            if (char === '<') depth++;

            text += char;
            this.advance(1);

            if (char === '>') {
                depth--;
                if (depth === 0) { // Closing > of outer doctype
                     break;
                }
            }
        }
        return { type: TokenType.Doctype, text, line: startLine, col: startCol, pos: startPos };
    }

    private readPI(): Token {
        const startLine = this.line;
        const startCol = this.col;
        const startPos = this.pos;
        let text = '';
        while (this.pos < this.input.length) {
            if (this.input.startsWith('?>', this.pos)) {
                text += '?>';
                this.advance(2);
                break;
            }
            text += this.input[this.pos];
            this.advance(1);
        }
        return { type: TokenType.PI, text, line: startLine, col: startCol, pos: startPos };
    }

    private readTagClose(): Token {
        const startLine = this.line;
        const startCol = this.col;
        const startPos = this.pos;
        let text = '';

        // Consume </
        text += '</';
        this.advance(2);

        // Read Name (Relaxed regex for Unicode support)
        while (this.pos < this.input.length && /[^<>\s/="'=]/.test(this.input[this.pos])) {
            text += this.input[this.pos];
            this.advance(1);
        }

        // Consume whitespace and >
        while (this.pos < this.input.length) {
            const char = this.input[this.pos];
            text += char;
            this.advance(1);
            if (char === '>') break;
        }

        return { type: TokenType.TagClose, text, line: startLine, col: startCol, pos: startPos };
    }

    private readTagOpen(): Token[] {
        const tokens: Token[] = [];
        const startLine = this.line;
        const startCol = this.col;
        const startPos = this.pos;
        let text = '';

        // Consume <
        text += '<';
        this.advance(1);

        // Read Name (Relaxed regex for Unicode support)
        while (this.pos < this.input.length && /[^<>\s/="'=]/.test(this.input[this.pos])) {
            text += this.input[this.pos];
            this.advance(1);
        }

        tokens.push({ type: TokenType.TagOpen, text, line: startLine, col: startCol, pos: startPos });

        // Read Attributes
        while (this.pos < this.input.length) {
            this.skipWhitespace();
            const char = this.input[this.pos];

            if (char === '>') {
                tokens.push({ type: TokenType.TagEnd, text: '>', line: this.line, col: this.col, pos: this.pos });
                this.advance(1);
                break;
            } else if (this.input.startsWith('/>', this.pos)) {
                 tokens.push({ type: TokenType.TagSelfClose, text: '/>', line: this.line, col: this.col, pos: this.pos });
                 this.advance(2);
                 break;
            } else {
                // Attribute Name (Relaxed regex)
                const attrLine = this.line;
                const attrCol = this.col;
                const attrPos = this.pos;
                let attrName = '';
                while (this.pos < this.input.length && /[^<>\s/="'=]/.test(this.input[this.pos])) {
                    attrName += this.input[this.pos];
                    this.advance(1);
                }

                if (attrName) {
                    tokens.push({ type: TokenType.AttributeName, text: attrName, line: attrLine, col: attrCol, pos: attrPos });

                    this.skipWhitespace();
                    if (this.input[this.pos] === '=') {
                        this.advance(1); // Consume =
                        this.skipWhitespace();

                        // Value
                        const valLine = this.line;
                        const valCol = this.col;
                        const valPos = this.pos;
                        const quote = this.input[this.pos];
                        let val = '';
                        if (quote === '"' || quote === "'") {
                            val = quote;
                            this.advance(1);
                            // In XML a backslash is an ordinary character, so the value
                            // simply ends at the next matching quote (e.g. path="C:\temp\").
                            while (this.pos < this.input.length) {
                                const c = this.input[this.pos];
                                val += c;
                                this.advance(1);
                                if (c === quote) break;
                            }
                        } else {
                             // Unquoted?
                             while (this.pos < this.input.length && !/\s|>|\//.test(this.input[this.pos])) {
                                 val += this.input[this.pos];
                                 this.advance(1);
                             }
                        }
                        tokens.push({ type: TokenType.AttributeValue, text: val, line: valLine, col: valCol, pos: valPos });
                    }
                } else {
                    // unexpected char? just consume to avoid loop and data loss
                    // If we are inside a tag and see unexpected char that is NOT > or /> or space, consume it
                    if (this.pos < this.input.length) {
                        this.advance(1);
                    } else {
                        break;
                    }
                }
            }
        }
        return tokens;
    }

    private readText(): Token {
        const startLine = this.line;
        const startCol = this.col;
        const startPos = this.pos;
        let text = '';
        while (this.pos < this.input.length && this.input[this.pos] !== '<') {
            text += this.input[this.pos];
            this.advance(1);
        }
        return { type: TokenType.Text, text, line: startLine, col: startCol, pos: startPos };
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

    private skipWhitespace() {
        while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
            this.advance(1);
        }
    }
}
