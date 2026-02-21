export enum TokenType {
    TagOpen,
    TagClose,
    TagSelfClose,
    TagEnd, // >
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
}

export class HTMLTokenizer {
    private input: string;
    private pos: number = 0;
    private line: number = 1;
    private col: number = 1;

    // Void elements in HTML (no closing tag)
    private voidTags = new Set([
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr'
    ]);

    // Raw text elements (content is not parsed as tags)
    private rawTextTags = new Set(['script', 'style', 'textarea', 'title']);

    constructor(input: string) {
        this.input = input;
    }

    public tokenize(): Token[] {
        const tokens: Token[] = [];
        let currentTagName: string | null = null;

        while (this.pos < this.input.length) {
            const char = this.input[this.pos];

            // Handle Raw Text Elements content
            if (currentTagName && this.rawTextTags.has(currentTagName.toLowerCase())) {
                const closeTag = `</${currentTagName}`;
                const closeIndex = this.input.toLowerCase().indexOf(closeTag, this.pos);

                if (closeIndex !== -1) {
                    // Extract content up to closing tag
                    const content = this.input.substring(this.pos, closeIndex);
                    if (content.length > 0) {
                        tokens.push({ type: TokenType.Text, text: content, line: this.line, col: this.col });
                        this.advance(content.length);
                    }
                    // Reset currentTagName so we can parse the closing tag normally
                    currentTagName = null;
                    continue;
                } else {
                    // No closing tag found, treat rest as text
                    const content = this.input.substring(this.pos);
                    tokens.push({ type: TokenType.Text, text: content, line: this.line, col: this.col });
                    this.advance(content.length);
                    break;
                }
            }

            if (char === '<') {
                if (this.input.startsWith('<!--', this.pos)) {
                    tokens.push(this.readComment());
                } else if (this.input.startsWith('<![CDATA[', this.pos)) {
                    tokens.push(this.readCDATA());
                } else if (/^<!DOCTYPE/i.test(this.input.substring(this.pos, this.pos + 9))) {
                    tokens.push(this.readDoctype());
                } else if (this.input.startsWith('<?', this.pos)) {
                    tokens.push(this.readPI());
                } else if (this.input.startsWith('</', this.pos)) {
                    tokens.push(this.readTagClose());
                    currentTagName = null; // Closing tag ends the scope (though scope is handled by parser mostly)
                } else {
                    const openTokens = this.readTagOpen();
                    tokens.push(...openTokens);

                    // Check if we entered a raw text tag
                    const tagToken = openTokens.find(t => t.type === TokenType.TagOpen);
                    if (tagToken) {
                        const tagName = tagToken.text.substring(1).trim(); // Remove <
                        if (this.rawTextTags.has(tagName.toLowerCase())) {
                            // Check if it was self-closing
                            const lastToken = openTokens[openTokens.length - 1];
                            if (lastToken.type !== TokenType.TagSelfClose) {
                                currentTagName = tagName;
                            }
                        }
                    }
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
        return { type: TokenType.Comment, text, line: startLine, col: startCol };
    }

    private readCDATA(): Token {
        const startLine = this.line;
        const startCol = this.col;
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
        return { type: TokenType.CDATA, text, line: startLine, col: startCol };
    }

    private readDoctype(): Token {
        const startLine = this.line;
        const startCol = this.col;
        let text = '';
        let depth = 0;

        while (this.pos < this.input.length) {
            const char = this.input[this.pos];
            if (char === '<') depth++;

            text += char;
            this.advance(1);

            if (char === '>') {
                depth--;
                if (depth <= 0) {
                     break;
                }
            }
        }
        return { type: TokenType.Doctype, text, line: startLine, col: startCol };
    }

    private readPI(): Token {
        const startLine = this.line;
        const startCol = this.col;
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
        return { type: TokenType.PI, text, line: startLine, col: startCol };
    }

    private readTagClose(): Token {
        const startLine = this.line;
        const startCol = this.col;
        let text = '';

        // Consume </
        text += '</';
        this.advance(2);

        // Read Name
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

        return { type: TokenType.TagClose, text, line: startLine, col: startCol };
    }

    private readTagOpen(): Token[] {
        const tokens: Token[] = [];
        const startLine = this.line;
        const startCol = this.col;
        let text = '';

        // Consume <
        text += '<';
        this.advance(1);

        // Read Name
        while (this.pos < this.input.length && /[^<>\s/="'=]/.test(this.input[this.pos])) {
            text += this.input[this.pos];
            this.advance(1);
        }

        tokens.push({ type: TokenType.TagOpen, text, line: startLine, col: startCol });

        // Read Attributes
        while (this.pos < this.input.length) {
            this.skipWhitespace();
            if (this.pos >= this.input.length) break;

            const char = this.input[this.pos];

            if (char === '>') {
                tokens.push({ type: TokenType.TagEnd, text: '>', line: this.line, col: this.col });
                this.advance(1);
                break;
            } else if (this.input.startsWith('/>', this.pos)) {
                 tokens.push({ type: TokenType.TagSelfClose, text: '/>', line: this.line, col: this.col });
                 this.advance(2);
                 break;
            } else {
                // Attribute Name
                const attrLine = this.line;
                const attrCol = this.col;
                let attrName = '';
                // Allow anything except space, quote, =, >, /
                while (this.pos < this.input.length && /[^<>\s/="'=]/.test(this.input[this.pos])) {
                    attrName += this.input[this.pos];
                    this.advance(1);
                }

                if (attrName) {
                    tokens.push({ type: TokenType.AttributeName, text: attrName, line: attrLine, col: attrCol });

                    this.skipWhitespace();
                    if (this.pos < this.input.length && this.input[this.pos] === '=') {
                        this.advance(1); // Consume =
                        this.skipWhitespace();

                        // Value
                        if (this.pos < this.input.length) {
                            const valLine = this.line;
                            const valCol = this.col;
                            const quote = this.input[this.pos];
                            let val = '';

                            if (quote === '"' || quote === "'") {
                                val += quote; // Include quote in text for now? Or just content?
                                // XMLTokenizer included quote. Let's include quote to preserve style if needed,
                                // OR better: strip quotes and re-add them in formatter.
                                // Wait, XMLTokenizer: `val = quote; ... val += c`. So it includes quotes.
                                this.advance(1);
                                while (this.pos < this.input.length) {
                                    const c = this.input[this.pos];
                                    if (c === quote) {
                                        val += c;
                                        this.advance(1);
                                        break;
                                    }
                                    val += c;
                                    this.advance(1);
                                }
                            } else {
                                 // Unquoted value
                                 while (this.pos < this.input.length && !/\s|>|\//.test(this.input[this.pos])) {
                                     val += this.input[this.pos];
                                     this.advance(1);
                                 }
                            }
                            tokens.push({ type: TokenType.AttributeValue, text: val, line: valLine, col: valCol });
                        }
                    }
                } else {
                    // unexpected char? just consume to avoid loop
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
        let text = '';
        while (this.pos < this.input.length && this.input[this.pos] !== '<') {
            text += this.input[this.pos];
            this.advance(1);
        }
        return { type: TokenType.Text, text, line: startLine, col: startCol };
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
