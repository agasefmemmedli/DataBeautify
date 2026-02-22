export enum TokenType {
    TagOpen,
    TagClose,
    TagSelfClose,
    TagEnd, // >
    AttributeName,
    AttributeValue,
    Text,
    Comment, // <!-- -->
    MustacheComment, // {{!-- --}} or {{! }}
    BlockOpen, // {{#...}}
    BlockClose, // {{/...}}
    BlockInverse, // {{else}} or {{^...}}
    MustacheExpression, // {{...}} or {{{...}}} or {{>...}}
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

export class HandlebarsTokenizer {
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
                // Also need to check for mustache blocks inside raw text, but usually raw text is raw.
                // However, Handlebars can be inside script tags.
                // If we treat it as raw text, we won't format handlebars inside it.
                // Standard Prettier behavior: format content of script/style if possible, or leave as is.
                // Given "Deep Formatting", we probably want to tokenize handlebars inside scripts too.
                // But let's stick to standard behavior: if inside script, it's mostly JS.
                // If we want to support handlebars inside script, we need to tokenize it.
                // Let's defer that complexity and treat raw text as raw text for now, OR tokenize handlebars inside it?
                // The prompt example has <script> ... {{id}} ... </script>.
                // So we MUST tokenize handlebars inside raw text tags.

                // If we are in raw text, we look for {{ or </tagName.
                if (char === '{' && this.input.startsWith('{{', this.pos)) {
                    tokens.push(this.readMustacheToken());
                    continue;
                }

                if (char === '<' && this.input.startsWith(closeTag, this.pos)) {
                     // End of raw text
                     tokens.push(this.readTagClose());
                     currentTagName = null;
                     continue;
                }

                // Otherwise text
                tokens.push(this.readText(true)); // true = inside raw tag
                continue;
            }

            if (char === '{' && this.input.startsWith('{{', this.pos)) {
                tokens.push(this.readMustacheToken());
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
                tokens.push(this.readText(false));
            }
        }
        return tokens;
    }

    private readMustacheToken(): Token {
        const startLine = this.line;
        const startCol = this.col;

        // Determine type based on content
        // {{!-- comment --}}
        if (this.input.startsWith('{{!--', this.pos)) {
            return this.readMustacheBlockComment();
        }

        // {{! comment }}
        if (this.input.startsWith('{{!', this.pos)) {
            return this.readMustacheInlineComment();
        }

        const text = this.readMustache();
        const content = text.replace(/^\{\{\{?/, '').replace(/\}\}\}?$/, '').trim();

        let type = TokenType.MustacheExpression;
        if (content.startsWith('#')) {
            type = TokenType.BlockOpen;
        } else if (content.startsWith('/')) {
            type = TokenType.BlockClose;
        } else if (content.startsWith('^')) {
            // {{^}} can be "else" or block open {{^foo}}
            // Standard: {{^}} is else for {{#}}, {{^foo}} is "unless foo" (block open)
            // But usually {{^}} acts like {{else}} in formatting (dedent, print, indent)
            // If it has content, it's a block open.
            if (content === '^' || content.startsWith('^ ')) {
                 // Actually {{^}} is rare as standalone. {{^}} usually means {{else}} in some contexts?
                 // No, {{^}} is section (inverted).
                 // We treat it as BlockOpen for indentation purposes usually.
                 type = TokenType.BlockOpen;
            } else {
                 type = TokenType.BlockOpen;
            }
        } else if (content.startsWith('else')) {
            type = TokenType.BlockInverse;
        }

        // Refine {{^}} handling: if it is treated as "else", it should be BlockInverse?
        // In Mustache/Handlebars:
        // {{#foo}} ... {{/foo}}
        // {{^foo}} ... {{/foo}} (inverted section)
        // {{#foo}} ... {{else}} ... {{/foo}}
        // {{#foo}} ... {{^}} ... {{/foo}} (else)
        if (content === '^') {
            type = TokenType.BlockInverse;
        }

        return { type, text, line: startLine, col: startCol };
    }

    private readMustache(): string {
        const startPos = this.pos;
        let braceCount = 0;

        // Count opening braces
        while (this.pos < this.input.length && this.input[this.pos] === '{') {
            braceCount++;
            this.advance(1);
        }

        // Read until matching closing braces
        // Handle strings inside mustache
        let inString = false;
        let quoteChar = '';

        while (this.pos < this.input.length) {
            const char = this.input[this.pos];

            if (inString) {
                if (char === '\\') {
                    this.advance(2);
                    continue;
                }
                if (char === quoteChar) {
                    inString = false;
                }
                this.advance(1);
            } else {
                if (char === '"' || char === "'") {
                    inString = true;
                    quoteChar = char;
                    this.advance(1);
                } else if (char === '}') {
                    // Check if we have enough closing braces
                    // We need to match braceCount.
                    // E.g. {{ ... }} -> 2 braces. {{{ ... }}} -> 3 braces.
                    let closingCount = 0;
                    let lookahead = this.pos;
                    while (lookahead < this.input.length && this.input[lookahead] === '}') {
                        closingCount++;
                        lookahead++;
                    }

                    if (closingCount >= 2) { // Minimum 2 closing braces
                        // Assume it closes if >= 2.
                        // Ideally strictly match braceCount, but simple approach:
                        // Consume all closing braces? No.
                        // Consume braceCount if available, else consume what is there?
                        // Standard handlebars: }} or }}}

                        this.advance(closingCount); // Consume them
                        return this.input.substring(startPos, this.pos);
                    }
                    this.advance(1);
                } else {
                    this.advance(1);
                }
            }
        }
        return this.input.substring(startPos, this.pos);
    }

    private readMustacheBlockComment(): Token {
        const startLine = this.line;
        const startCol = this.col;
        const startPos = this.pos;
        // Consume {{!--
        this.advance(5);

        const endIdx = this.input.indexOf('--}}', this.pos);
        if (endIdx !== -1) {
            this.advance(endIdx - this.pos + 4);
        } else {
            // Unclosed, consume rest
            this.advance(this.input.length - this.pos);
        }

        return { type: TokenType.MustacheComment, text: this.input.substring(startPos, this.pos), line: startLine, col: startCol };
    }

    private readMustacheInlineComment(): Token {
        const startLine = this.line;
        const startCol = this.col;
        const startPos = this.pos;
        // Consume {{!
        this.advance(3);

        const endIdx = this.input.indexOf('}}', this.pos);
        if (endIdx !== -1) {
            this.advance(endIdx - this.pos + 2);
        } else {
            this.advance(this.input.length - this.pos);
        }

        return { type: TokenType.MustacheComment, text: this.input.substring(startPos, this.pos), line: startLine, col: startCol };
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
            } else if (char === '{' && this.input.startsWith('{{', this.pos)) {
                // Mustache token inside tag (attribute or loose)
                // Treat as attribute name/value or special token
                const mustacheToken = this.readMustacheToken();
                // We'll treat it as AttributeName for now as it's self-contained.
                // Or maybe a new token type in the stream?
                // readTagOpen returns Token[] so we can mix them.
                tokens.push(mustacheToken);
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

                            if (quote === '"' || quote === "'") {
                                this.advance(1);
                                val += quote;
                                while (this.pos < this.input.length) {
                                    const c = this.input[this.pos];
                                    // Handle mustache inside quoted attribute
                                    if (c === '{' && this.input.startsWith('{{', this.pos)) {
                                         // We capture it as part of value string
                                         val += this.readMustache();
                                         continue;
                                    }

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
                                     if (this.input[this.pos] === '{' && this.input.startsWith('{{', this.pos)) {
                                         val += this.readMustache();
                                         continue;
                                     }
                                     val += this.input[this.pos];
                                     this.advance(1);
                                 }
                                 tokens.push({ type: TokenType.AttributeValue, text: val, line: valLine, col: valCol });
                            }
                        }
                    }
                } else {
                    if (this.pos < this.input.length) {
                         // Unexpected? consume one char
                         this.advance(1);
                    } else {
                        break;
                    }
                }
            }
        }
        return tokens;
    }

    private readText(inRawTag: boolean): Token {
        const startLine = this.line;
        const startCol = this.col;
        let text = '';
        while (this.pos < this.input.length) {
            const char = this.input[this.pos];

            if (char === '{' && this.input.startsWith('{{', this.pos)) {
                break;
            }
            if (char === '<') {
                if (inRawTag) {
                     // Check if it's the closing tag
                     // Caller handles this check, but here we just stop at <
                     break;
                } else {
                     break;
                }
            }

            text += char;
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
