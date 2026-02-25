export enum TokenType {
    TagOpen,
    TagClose,
    TagSelfClose, // Used for HTML self-closing />
    TagEnd, // Used for HTML >
    OutputOpen, // {{
    OutputClose, // }}
    Text,
    Comment, // {% comment %} ... {% endcomment %} or <!-- ... -->
    BlockOpen, // {% if ... %}
    BlockClose, // {% endif %}
    BlockInverse, // {% else %}
    RawBlock, // {% schema %} ... {% endschema %}
    AttributeName,
    AttributeValue,
    Whitespace,
    Unknown
}

export interface Token {
    type: TokenType;
    text: string;
    line: number;
    col: number;
}

export class LiquidTokenizer {
    private input: string;
    private pos: number = 0;
    private line: number = 1;
    private col: number = 1;

    // Standard Liquid blocks
    private blockTags = new Set([
        'if', 'unless', 'case', 'for', 'tablerow', 'capture', 'form', 'paginate'
    ]);

    // Inverse blocks (intermediate)
    private inverseTags = new Set([
        'else', 'elsif', 'when'
    ]);

    // Raw blocks (content not parsed as Liquid/HTML usually)
    private rawBlocks = new Set([
        'schema', 'style', 'javascript', 'stylesheet', 'raw'
    ]);

    constructor(input: string) {
        this.input = input;
    }

    public tokenize(): Token[] {
        const tokens: Token[] = [];

        while (this.pos < this.input.length) {
            const char = this.input[this.pos];

            // 1. Liquid Tags: {% ... %}
            if (char === '{' && (this.input.startsWith('{%', this.pos))) {
                const tag = this.readLiquidTag();
                if (tag) {
                    tokens.push(tag);
                    continue;
                }
            }

            // 2. Liquid Outputs: {{ ... }}
            if (char === '{' && (this.input.startsWith('{{', this.pos))) {
                tokens.push(this.readLiquidOutput());
                continue;
            }

            // 3. HTML Tags: <...>
            if (char === '<') {
                if (this.input.startsWith('<!--', this.pos)) {
                    tokens.push(this.readHTMLComment());
                    continue;
                } else if (this.input.startsWith('</', this.pos)) {
                    tokens.push(this.readHTMLTagClose());
                    continue;
                } else if (/^<[a-zA-Z]/.test(this.input.substring(this.pos))) {
                    tokens.push(...this.readHTMLTagOpen());
                    continue;
                }
            }

            // 4. Text / Whitespace
            tokens.push(this.readText());
        }
        return tokens;
    }

    private readLiquidTag(): Token | null {
        const startLine = this.line;
        const startCol = this.col;
        const startPos = this.pos;

        // Consume {% or {%-
        let openTag = '{%';
        if (this.input.startsWith('{%-', this.pos)) {
            openTag = '{%-';
        }
        this.advance(openTag.length);

        // Read content until %} or -%}
        let content = '';
        let endTag = '';

        while (this.pos < this.input.length) {
            if (this.input.startsWith('-%}', this.pos)) {
                endTag = '-%}';
                break;
            }
            if (this.input.startsWith('%}', this.pos)) {
                endTag = '%}';
                break;
            }
            content += this.input[this.pos];
            this.advance(1);
        }

        if (endTag === '') {
             // Unterminated tag
             return { type: TokenType.Unknown, text: this.input.substring(startPos), line: startLine, col: startCol };
        }

        this.advance(endTag.length); // Consume closing

        const fullText = this.input.substring(startPos, this.pos);
        const trimmedContent = content.trim();
        const firstWord = trimmedContent.split(/\s+/)[0];

        if (firstWord === 'comment') {
            return this.readLiquidCommentBlock(startPos, startLine, startCol);
        }

        if (this.rawBlocks.has(firstWord)) {
            return this.readLiquidRawBlock(firstWord, startPos, startLine, startCol);
        }

        let type = TokenType.TagOpen;

        if (/^end/.test(firstWord)) {
            type = TokenType.BlockClose;
        } else if (this.blockTags.has(firstWord)) {
            type = TokenType.BlockOpen;
        } else if (this.inverseTags.has(firstWord)) {
            type = TokenType.BlockInverse;
        }

        return { type, text: fullText, line: startLine, col: startCol };
    }

    private readLiquidOutput(): Token {
        const startLine = this.line;
        const startCol = this.col;
        const startPos = this.pos;

        // Consume {{ or {{-
        let openTag = '{{';
        if (this.input.startsWith('{{-', this.pos)) {
            openTag = '{{-';
        }
        this.advance(openTag.length);

        while (this.pos < this.input.length) {
            if (this.input.startsWith('-}}', this.pos)) {
                this.advance(3);
                break;
            }
            if (this.input.startsWith('}}', this.pos)) {
                this.advance(2);
                break;
            }
            this.advance(1);
        }

        return { type: TokenType.OutputOpen, text: this.input.substring(startPos, this.pos), line: startLine, col: startCol };
    }

    private readHTMLComment(): Token {
        const startLine = this.line;
        const startCol = this.col;
        const startPos = this.pos;
        let text = '';

        // Consume <!--
        this.advance(4);
        text += '<!--';

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

    private readHTMLTagClose(): Token {
        const startLine = this.line;
        const startCol = this.col;
        let text = '</';
        this.advance(2);

        while (this.pos < this.input.length && /[^<>\s]/.test(this.input[this.pos])) {
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

    private readHTMLTagOpen(): Token[] {
        const tokens: Token[] = [];
        const startLine = this.line;
        const startCol = this.col;
        let tagName = '';

        this.advance(1); // <

        while (this.pos < this.input.length && /[^<>\s/]/.test(this.input[this.pos])) {
            tagName += this.input[this.pos];
            this.advance(1);
        }

        tokens.push({ type: TokenType.TagOpen, text: '<' + tagName, line: startLine, col: startCol });

        // Attributes loop
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
                // Liquid inside tag (e.g. <div {% if x %}class="foo"{% endif %}>)
                if (this.input.startsWith('{%', this.pos)) {
                    const tag = this.readLiquidTag();
                    if (tag) tokens.push(tag);
                } else if (this.input.startsWith('{{', this.pos)) {
                    tokens.push(this.readLiquidOutput());
                } else {
                    this.advance(1); // Just a brace
                }
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
                        this.advance(1); // Consume =
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
                                    if (c === quote) {
                                        val += c;
                                        this.advance(1);
                                        break;
                                    }
                                    if (c === '{' && (this.input.startsWith('{{', this.pos) || this.input.startsWith('{%', this.pos))) {
                                        // Capture liquid inside attribute value
                                        if (this.input.startsWith('{{', this.pos)) {
                                            const output = this.readLiquidOutput();
                                            val += output.text;
                                        } else {
                                            const tag = this.readLiquidTag();
                                            if (tag) val += tag.text;
                                        }
                                        continue;
                                    }
                                    val += c;
                                    this.advance(1);
                                }
                                tokens.push({ type: TokenType.AttributeValue, text: val, line: valLine, col: valCol });
                            } else {
                                // Unquoted value
                                while (this.pos < this.input.length && !/\s|>|\//.test(this.input[this.pos])) {
                                     val += this.input[this.pos];
                                     this.advance(1);
                                }
                                tokens.push({ type: TokenType.AttributeValue, text: val, line: valLine, col: valCol });
                            }
                        }
                    }
                } else {
                    // Unexpected char inside tag, consume one
                    this.advance(1);
                }
            }
        }
        return tokens;
    }

    private readLiquidCommentBlock(startPos: number, line: number, col: number): Token {
        // We already consumed {% comment %} or {%- comment -%}
        // Now read until {% endcomment %}
        while (this.pos < this.input.length) {
            if (this.input.startsWith('{%', this.pos)) {
                const check = this.input.substring(this.pos);
                if (/^{%-?\s*endcomment\s*-?%}/.test(check)) {
                    const match = check.match(/^{%-?\s*endcomment\s*-?%}/);
                    this.advance(match![0].length);
                    break;
                }
            }
            this.advance(1);
        }
        return { type: TokenType.Comment, text: this.input.substring(startPos, this.pos), line, col };
    }

    private readLiquidRawBlock(tagName: string, startPos: number, line: number, col: number): Token {
        // We already consumed {% schema %} etc.
        // Read until {% endschema %}
        const regex = new RegExp(`^{%-?\\s*end${tagName}\\s*-?%}`);

        while (this.pos < this.input.length) {
            if (this.input.startsWith('{%', this.pos)) {
                const check = this.input.substring(this.pos);
                if (regex.test(check)) {
                    const match = check.match(regex);
                    this.advance(match![0].length);
                    break;
                }
            }
            this.advance(1);
        }
        return { type: TokenType.RawBlock, text: this.input.substring(startPos, this.pos), line, col };
    }

    private readText(): Token {
        const startLine = this.line;
        const startCol = this.col;
        let text = '';
        while (this.pos < this.input.length) {
            const char = this.input[this.pos];
            if (char === '{' && (this.input.startsWith('{%', this.pos) || this.input.startsWith('{{', this.pos))) {
                break;
            }
            if (char === '<' && (this.input.startsWith('<!--', this.pos) || this.input.startsWith('</', this.pos) || /^<[a-zA-Z]/.test(this.input.substring(this.pos)))) {
                break;
            }
            text += char;
            this.advance(1);
        }

        // Mark as whitespace if only whitespace
        const type = /^\s*$/.test(text) ? TokenType.Whitespace : TokenType.Text;
        return { type, text, line: startLine, col: startCol };
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
