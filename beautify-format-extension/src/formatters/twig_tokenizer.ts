export enum TokenType {
    TagOpen,
    TagClose,
    TagSelfClose, // Used for HTML self-closing
    TagEnd, // Used for HTML >
    OutputOpen, // {{
    OutputClose, // }}
    Text,
    Comment, // {# ... #}
    BlockOpen, // {% block ... %}
    BlockClose, // {% endblock %}
    BlockInverse, // {% else %}
    RawBlock, // {% verbatim %} ... {% endverbatim %}
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

export class TwigTokenizer {
    private input: string;
    private pos: number = 0;
    private line: number = 1;
    private col: number = 1;

    // Void elements in HTML
    private voidTags = new Set([
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
    ]);

    // Raw blocks in Twig
    private rawBlocks = new Set(['verbatim', 'autoescape']); // autoescape is technically parsed but content is raw-like? No, usually parsed. Verbatim is raw.

    constructor(input: string) {
        this.input = input;
    }

    public tokenize(): Token[] {
        const tokens: Token[] = [];

        while (this.pos < this.input.length) {
            const char = this.input[this.pos];

            // 1. Twig Comment: {# ... #}
            if (char === '{' && this.input.startsWith('{#', this.pos)) {
                tokens.push(this.readTwigComment());
                continue;
            }

            // 2. Twig Tags: {% ... %}
            if (char === '{' && this.input.startsWith('{%', this.pos)) {
                tokens.push(this.readTwigTag());
                continue;
            }

            // 3. Twig Outputs: {{ ... }}
            if (char === '{' && this.input.startsWith('{{', this.pos)) {
                tokens.push(this.readTwigOutput());
                continue;
            }

            // 4. HTML Tags: <...>
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

            // 5. Text
            tokens.push(this.readText());
        }
        return tokens;
    }

    private readTwigComment(): Token {
        const startLine = this.line;
        const startCol = this.col;
        const startPos = this.pos;

        // Consume {# or {#-
        let openTag = '{#';
        if (this.input.startsWith('{#-', this.pos)) {
            openTag = '{#-';
        }
        this.advance(openTag.length);

        // Read content until #} or -#}
        while (this.pos < this.input.length) {
            if (this.input.startsWith('-#}', this.pos)) {
                this.advance(3);
                break;
            }
            if (this.input.startsWith('#}', this.pos)) {
                this.advance(2);
                break;
            }
            this.advance(1);
        }

        return { type: TokenType.Comment, text: this.input.substring(startPos, this.pos), line: startLine, col: startCol };
    }

    private readTwigTag(): Token {
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

        this.advance(endTag.length); // Consume closing

        const fullText = this.input.substring(startPos, this.pos);
        const trimmedContent = content.trim();
        const firstWord = trimmedContent.split(/\s+/)[0];

        let type = TokenType.TagOpen; // Generic tag

        if (firstWord === 'verbatim') {
             return this.readTwigRawBlock(firstWord, startPos, startLine, startCol);
        }

        if (/^end/.test(firstWord)) {
            type = TokenType.BlockClose;
        } else if (/^(block|if|for|macro|embed|apply|sandbox|autoescape|with|filter|trans|spaceless)$/.test(firstWord)) {
            type = TokenType.BlockOpen;
        } else if (firstWord === 'set') {
            // Check if it's block set or inline set
            // Inline: {% set foo = 'bar' %}
            // Block: {% set foo %} ... {% endset %}
            if (trimmedContent.includes('=')) {
                type = TokenType.TagOpen; // Inline
            } else {
                type = TokenType.BlockOpen; // Block
            }
        } else if (/^(else|elseif)$/.test(firstWord)) {
            type = TokenType.BlockInverse;
        } else {
            // extends, include, import, use, do, flush
            type = TokenType.TagOpen;
        }

        return { type, text: fullText, line: startLine, col: startCol };
    }

    private readTwigOutput(): Token {
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
        let text = '<';
        this.advance(1);

        while (this.pos < this.input.length && /[^<>\s]/.test(this.input[this.pos])) {
            text += this.input[this.pos];
            this.advance(1);
        }

        tokens.push({ type: TokenType.TagOpen, text, line: startLine, col: startCol });

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
                // Twig inside tag
                if (this.input.startsWith('{%', this.pos)) {
                    tokens.push(this.readTwigTag());
                } else if (this.input.startsWith('{{', this.pos)) {
                    tokens.push(this.readTwigOutput());
                } else if (this.input.startsWith('{#', this.pos)) {
                    tokens.push(this.readTwigComment());
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
                                    if (c === '{' && (this.input.startsWith('{{', this.pos) || this.input.startsWith('{%', this.pos) || this.input.startsWith('{#', this.pos))) {
                                        // Capture twig inside attribute value
                                        if (this.input.startsWith('{{', this.pos)) {
                                            const output = this.readTwigOutput();
                                            val += output.text;
                                        } else if (this.input.startsWith('{#', this.pos)) {
                                            const comment = this.readTwigComment();
                                            val += comment.text;
                                        } else {
                                            const tag = this.readTwigTag();
                                            val += tag.text;
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
                    // Unexpected
                    this.advance(1);
                }
            }
        }
        return tokens;
    }

    private readTwigRawBlock(tagName: string, startPos: number, line: number, col: number): Token {
        // We already consumed {% verbatim %}
        // Read until {% endverbatim %}
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
            if (char === '{' && (this.input.startsWith('{%', this.pos) || this.input.startsWith('{{', this.pos) || this.input.startsWith('{#', this.pos))) {
                break;
            }
            if (char === '<' && (this.input.startsWith('<!--', this.pos) || this.input.startsWith('</', this.pos) || /^<[a-zA-Z]/.test(this.input.substring(this.pos)))) {
                break;
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
