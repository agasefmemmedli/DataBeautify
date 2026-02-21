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
    Expression, // { ... }
    LogicBlockStart, // {#if ...}
    LogicBlockMiddle, // {:else ...}
    LogicBlockEnd, // {/if}
    LogicBlockTag, // {@html ...}
    Whitespace,
    Unknown
}

export interface Token {
    type: TokenType;
    text: string;
    line: number;
    col: number;
}

export class SvelteTokenizer {
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

            if (char === '{') {
                // Potential expression or logic block
                const exprToken = this.readExpressionToken();
                // Classify based on start char
                if (exprToken.text.startsWith('{#')) {
                    exprToken.type = TokenType.LogicBlockStart;
                } else if (exprToken.text.startsWith('{:')) {
                    exprToken.type = TokenType.LogicBlockMiddle;
                } else if (exprToken.text.startsWith('{/')) {
                    exprToken.type = TokenType.LogicBlockEnd;
                } else if (exprToken.text.startsWith('{@')) {
                    exprToken.type = TokenType.LogicBlockTag;
                }
                tokens.push(exprToken);
            } else if (char === '<') {
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
                    currentTagName = null;
                } else {
                    const openTokens = this.readTagOpen();
                    tokens.push(...openTokens);

                    // Check if we entered a raw text tag
                    const tagToken = openTokens.find(t => t.type === TokenType.TagOpen);
                    if (tagToken) {
                        const tagName = tagToken.text.substring(1).trim(); // Remove <
                        if (this.rawTextTags.has(tagName.toLowerCase())) {
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

    private readExpressionToken(): Token {
        const startLine = this.line;
        const startCol = this.col;
        const text = this.readExpression(); // Consumes and returns text including {}
        return { type: TokenType.Expression, text, line: startLine, col: startCol };
    }

    // Reads { ... } balanced
    private readExpression(): string {
        const startPos = this.pos;
        let braceCount = 0;
        let inString = false;
        let quoteChar = '';
        let inTemplateString = false;

        while (this.pos < this.input.length) {
            const char = this.input[this.pos];

            if (inString) {
                if (char === '\\') {
                    this.advance(2); // Skip escaped char
                    continue;
                }
                if (char === quoteChar) {
                    inString = false;
                }
                this.advance(1);
            } else if (inTemplateString) {
                if (char === '\\') {
                     this.advance(2);
                     continue;
                }
                if (char === '`') {
                    inTemplateString = false;
                }
                this.advance(1);
            } else {
                if (char === '"' || char === "'") {
                    inString = true;
                    quoteChar = char;
                    this.advance(1);
                } else if (char === '`') {
                    inTemplateString = true;
                    this.advance(1);
                } else if (char === '{') {
                    braceCount++;
                    this.advance(1);
                } else if (char === '}') {
                    braceCount--;
                    this.advance(1);
                    if (braceCount === 0) {
                        return this.input.substring(startPos, this.pos);
                    }
                } else {
                    this.advance(1);
                }
            }
        }
        // Unbalanced or end of file
        return this.input.substring(startPos, this.pos);
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

        text += '</';
        this.advance(2);

        while (this.pos < this.input.length && /[^<>\s/="'=]/.test(this.input[this.pos])) {
            text += this.input[this.pos];
            this.advance(1);
        }

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

        text += '<';
        this.advance(1);

        while (this.pos < this.input.length && /[^<>\s/="'=]/.test(this.input[this.pos])) {
            text += this.input[this.pos];
            this.advance(1);
        }

        tokens.push({ type: TokenType.TagOpen, text, line: startLine, col: startCol });

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
            } else if (char === '{') {
                // Spread attribute { ...spread }
                const exprLine = this.line;
                const exprCol = this.col;
                const exprText = this.readExpression();
                // Treat spread as an attribute without value? Or dedicated token?
                // Let's treat it as AttributeName for formatting purposes (it's self contained)
                tokens.push({ type: TokenType.AttributeName, text: exprText, line: exprLine, col: exprCol });
            } else {
                // Attribute Name
                const attrLine = this.line;
                const attrCol = this.col;
                let attrName = '';
                while (this.pos < this.input.length && /[^<>\s/="'={}]/.test(this.input[this.pos])) {
                    attrName += this.input[this.pos];
                    this.advance(1);
                }

                if (attrName) {
                    tokens.push({ type: TokenType.AttributeName, text: attrName, line: attrLine, col: attrCol });

                    this.skipWhitespace();
                    if (this.pos < this.input.length && this.input[this.pos] === '=') {
                        this.advance(1);
                        this.skipWhitespace();

                        if (this.pos < this.input.length) {
                            const valLine = this.line;
                            const valCol = this.col;
                            const quote = this.input[this.pos];
                            let val = '';

                            if (quote === '{') {
                                // Expression value
                                val = this.readExpression();
                                tokens.push({ type: TokenType.AttributeValue, text: val, line: valLine, col: valCol });
                            } else if (quote === '"' || quote === "'") {
                                this.advance(1);
                                val += quote;
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
                                tokens.push({ type: TokenType.AttributeValue, text: val, line: valLine, col: valCol });
                            } else {
                                 // Unquoted
                                 while (this.pos < this.input.length && !/\s|>|\//.test(this.input[this.pos])) {
                                     val += this.input[this.pos];
                                     this.advance(1);
                                 }
                                 tokens.push({ type: TokenType.AttributeValue, text: val, line: valLine, col: valCol });
                            }
                        }
                    }
                } else {
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
        while (this.pos < this.input.length && this.input[this.pos] !== '<' && this.input[this.pos] !== '{') {
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
