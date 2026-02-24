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
    Frontmatter, // --- ... ---
    Whitespace,
    Unknown
}

export interface Token {
    type: TokenType;
    text: string;
    line: number;
    col: number;
}

interface TokenizerState {
    type: 'NORMAL' | 'STRING_DOUBLE' | 'STRING_SINGLE' | 'TEMPLATE' | 'COMMENT_LINE' | 'COMMENT_BLOCK';
    targetDepth?: number;
}

export class AstroTokenizer {
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

        // Check for Frontmatter at start
        if (this.input.startsWith('---')) {
            const frontmatter = this.readFrontmatter();
            if (frontmatter) {
                tokens.push(frontmatter);
            }
        }

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
                // Potential expression
                tokens.push(this.readExpressionToken());
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

    private readFrontmatter(): Token | null {
        // --- ... ---
        const startLine = this.line;
        const startCol = this.col;

        // Find closing ---
        const endIdx = this.input.indexOf('\n---', this.pos + 3);
        if (endIdx !== -1) {
            const length = (endIdx + 4) - this.pos;
            const text = this.input.substring(this.pos, this.pos + length);

            // Advance
            const token = { type: TokenType.Frontmatter, text, line: startLine, col: startCol };
            this.advance(length);
            return token;
        }
        return null;
    }

    private readExpressionToken(): Token {
        const startLine = this.line;
        const startCol = this.col;
        const text = this.readExpression();
        return { type: TokenType.Expression, text, line: startLine, col: startCol };
    }

    // Reads { ... } balanced with JS comment awareness
    private readExpression(): string {
        const startPos = this.pos;
        const stack: TokenizerState[] = [{ type: 'NORMAL', targetDepth: 0 }];
        let braceDepth = 0;

        while (this.pos < this.input.length) {
            const char = this.input[this.pos];
            const nextChar = this.input[this.pos + 1];
            const currentState = stack[stack.length - 1];

            if (currentState.type === 'COMMENT_LINE') {
                if (char === '\n') {
                    stack.pop();
                }
                this.advance(1);
                continue;
            }

            if (currentState.type === 'COMMENT_BLOCK') {
                if (char === '*' && nextChar === '/') {
                    stack.pop();
                    this.advance(2);
                } else {
                    this.advance(1);
                }
                continue;
            }

            if (currentState.type === 'STRING_DOUBLE') {
                if (char === '\\') {
                    this.advance(2);
                    continue;
                }
                if (char === '"') {
                    stack.pop();
                }
                this.advance(1);
                continue;
            }

            if (currentState.type === 'STRING_SINGLE') {
                if (char === '\\') {
                    this.advance(2);
                    continue;
                }
                if (char === "'") {
                    stack.pop();
                }
                this.advance(1);
                continue;
            }

            if (currentState.type === 'TEMPLATE') {
                if (char === '\\') {
                    this.advance(2);
                    continue;
                }
                if (char === '$' && nextChar === '{') {
                    stack.push({ type: 'NORMAL', targetDepth: braceDepth });
                    braceDepth++;
                    this.advance(2);
                    continue;
                }
                if (char === '`') {
                    stack.pop();
                }
                this.advance(1);
                continue;
            }

            if (currentState.type === 'NORMAL') {
                // Comments
                if (char === '/' && nextChar === '/') {
                    stack.push({ type: 'COMMENT_LINE' });
                    this.advance(2);
                    continue;
                }
                if (char === '/' && nextChar === '*') {
                    stack.push({ type: 'COMMENT_BLOCK' });
                    this.advance(2);
                    continue;
                }

                // Strings
                if (char === '"') {
                    stack.push({ type: 'STRING_DOUBLE' });
                    this.advance(1);
                    continue;
                }
                if (char === "'") {
                    stack.push({ type: 'STRING_SINGLE' });
                    this.advance(1);
                    continue;
                }
                if (char === '`') {
                    stack.push({ type: 'TEMPLATE' });
                    this.advance(1);
                    continue;
                }

                // Braces
                if (char === '{') {
                    braceDepth++;
                    this.advance(1);
                    continue;
                }
                if (char === '}') {
                    braceDepth--;
                    this.advance(1);

                    if (braceDepth === currentState.targetDepth!) {
                        if (stack.length > 1) {
                            stack.pop(); // End of interpolation
                        } else {
                            // End of top-level expression
                            return this.input.substring(startPos, this.pos);
                        }
                    }
                    continue;
                }

                this.advance(1);
                continue;
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
