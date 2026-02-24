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

enum State {
    DATA,
    TAG_OPEN,
    TAG_NAME,
    SELF_CLOSING_START_TAG,
    BEFORE_ATTRIBUTE_NAME,
    ATTRIBUTE_NAME,
    AFTER_ATTRIBUTE_NAME,
    BEFORE_ATTRIBUTE_VALUE,
    ATTRIBUTE_VALUE_DOUBLE_QUOTED,
    ATTRIBUTE_VALUE_SINGLE_QUOTED,
    ATTRIBUTE_VALUE_UNQUOTED,
    AFTER_ATTRIBUTE_VALUE_QUOTED,
    MARKUP_DECLARATION_OPEN,
    COMMENT_START,
    COMMENT_START_DASH,
    COMMENT,
    COMMENT_END_DASH,
    COMMENT_END,
    CDATA_START,
    CDATA,
    CDATA_END_1,
    CDATA_END_2,
    DOCTYPE,
    PI,
    PI_END,
    RAW_TEXT_TAG
}

export class HTMLTokenizer {
    private input: string;
    private pos: number = 0;
    private line: number = 1;
    private col: number = 1;
    private state: State = State.DATA;
    private buffer: string = '';
    private tokens: Token[] = [];
    private currentTag: string = '';

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

    private emit(type: TokenType, text: string = this.buffer) {
        if (text.length > 0) {
            this.tokens.push({ type, text, line: this.line, col: this.col - text.length }); // Approx col
        }
        this.buffer = '';
    }

    private advance() {
        if (this.pos >= this.input.length) return false;
        const char = this.input[this.pos];
        if (char === '\n') {
            this.line++;
            this.col = 1;
        } else {
            this.col++;
        }
        this.pos++;
        return true;
    }

    private peek(offset: number = 0): string | null {
        if (this.pos + offset >= this.input.length) return null;
        return this.input[this.pos + offset];
    }

    public tokenize(): Token[] {
        this.tokens = [];
        this.state = State.DATA;
        this.buffer = '';
        this.currentTag = '';

        while (this.pos < this.input.length) {
            const char = this.input[this.pos];

            switch (this.state) {
                case State.DATA:
                    if (char === '<') {
                        if (this.buffer.length > 0) {
                            this.emit(TokenType.Text);
                        }
                        this.state = State.TAG_OPEN;
                        this.advance();
                    } else {
                        this.buffer += char;
                        this.advance();
                    }
                    break;

                case State.TAG_OPEN:
                    if (char === '!') {
                        this.state = State.MARKUP_DECLARATION_OPEN;
                        this.advance();
                    } else if (char === '?') {
                         this.state = State.PI;
                         this.buffer = '<?';
                         this.advance();
                    } else if (char === '/') {
                        this.state = State.TAG_NAME; // Closing tag name
                        this.buffer = '</'; // Start buffer with </
                        this.advance();
                    } else if (/[a-zA-Z]/.test(char)) {
                        this.state = State.TAG_NAME;
                        this.buffer = '<'; // Start buffer with <
                        // Don't advance, re-process in TAG_NAME
                    } else {
                        // Invalid tag start, treat as text
                        this.tokens.push({ type: TokenType.Text, text: '<', line: this.line, col: this.col - 1 });
                        this.state = State.DATA;
                        // Don't advance, re-process current char
                    }
                    break;

                case State.TAG_NAME:
                    if (/[a-zA-Z0-9:-]/.test(char)) {
                        this.buffer += char;
                        this.advance();
                    } else {
                        // End of tag name
                        // Check if it's a closing tag
                        if (this.buffer.startsWith('</')) {
                            this.emit(TokenType.TagClose);
                        } else {
                            this.emit(TokenType.TagOpen);
                            this.currentTag = this.tokens[this.tokens.length - 1].text.substring(1).toLowerCase();
                        }
                        this.state = State.BEFORE_ATTRIBUTE_NAME;
                    }
                    break;

                case State.BEFORE_ATTRIBUTE_NAME:
                    if (/\s/.test(char)) {
                        this.advance(); // Skip whitespace
                    } else if (char === '/') {
                        this.state = State.SELF_CLOSING_START_TAG;
                        this.advance();
                    } else if (char === '>') {
                        this.tokens.push({ type: TokenType.TagEnd, text: '>', line: this.line, col: this.col });
                        this.advance();
                        // Check for raw text tag
                        if (this.currentTag && this.rawTextTags.has(this.currentTag) && !this.tokens.some(t => t.type === TokenType.TagClose && t.text === `</${this.currentTag}`)) {
                             this.state = State.RAW_TEXT_TAG;
                        } else {
                             this.state = State.DATA;
                        }
                        this.currentTag = ''; // Reset unless raw text
                    } else {
                        this.state = State.ATTRIBUTE_NAME;
                        this.buffer = ''; // Start attribute name
                    }
                    break;

                case State.ATTRIBUTE_NAME:
                    if (/\s|\/|'|"|=|>/.test(char)) {
                         // End of attribute name
                         if (char === '=') {
                             this.emit(TokenType.AttributeName);
                             this.state = State.BEFORE_ATTRIBUTE_VALUE;
                             this.advance();
                         } else {
                             this.emit(TokenType.AttributeName);
                             this.state = State.BEFORE_ATTRIBUTE_NAME;
                             // Re-process char (might be > or / or space)
                         }
                    } else {
                        this.buffer += char;
                        this.advance();
                    }
                    break;

                case State.BEFORE_ATTRIBUTE_VALUE:
                    if (/\s/.test(char)) {
                        this.advance();
                    } else if (char === '"') {
                        this.state = State.ATTRIBUTE_VALUE_DOUBLE_QUOTED;
                        this.buffer = ''; // Start value
                        this.advance();
                    } else if (char === "'") {
                        this.state = State.ATTRIBUTE_VALUE_SINGLE_QUOTED;
                        this.buffer = ''; // Start value
                        this.advance();
                    } else if (char === '>') {
                        // Missing value, unexpected >
                         this.state = State.DATA; // Or handle as error?
                         // Re-process in BEFORE_ATTRIBUTE_NAME will hit >
                         this.state = State.BEFORE_ATTRIBUTE_NAME;
                    } else {
                        this.state = State.ATTRIBUTE_VALUE_UNQUOTED;
                        this.buffer = '';
                    }
                    break;

                case State.ATTRIBUTE_VALUE_DOUBLE_QUOTED:
                    if (char === '"') {
                        this.emit(TokenType.AttributeValue);
                        this.state = State.AFTER_ATTRIBUTE_VALUE_QUOTED;
                        this.advance();
                    } else {
                        this.buffer += char;
                        this.advance();
                    }
                    break;

                case State.ATTRIBUTE_VALUE_SINGLE_QUOTED:
                    if (char === "'") {
                        this.emit(TokenType.AttributeValue);
                        this.state = State.AFTER_ATTRIBUTE_VALUE_QUOTED;
                        this.advance();
                    } else {
                        this.buffer += char;
                        this.advance();
                    }
                    break;

                case State.ATTRIBUTE_VALUE_UNQUOTED:
                    if (/\s|>/.test(char)) {
                        this.emit(TokenType.AttributeValue);
                        this.state = State.BEFORE_ATTRIBUTE_NAME;
                    } else {
                        this.buffer += char;
                        this.advance();
                    }
                    break;

                case State.AFTER_ATTRIBUTE_VALUE_QUOTED:
                     if (/\s/.test(char)) {
                         this.state = State.BEFORE_ATTRIBUTE_NAME;
                         this.advance();
                     } else if (char === '/' || char === '>') {
                         this.state = State.BEFORE_ATTRIBUTE_NAME;
                     } else {
                         // Missing space between attributes?
                         this.state = State.BEFORE_ATTRIBUTE_NAME;
                     }
                     break;

                case State.SELF_CLOSING_START_TAG:
                    if (char === '>') {
                        this.tokens.push({ type: TokenType.TagSelfClose, text: '/>', line: this.line, col: this.col - 1 });
                        this.advance();
                        this.state = State.DATA;
                        this.currentTag = '';
                    } else {
                        // Unexpected char after /, maybe it wasn't self closing but just a slash in attribute name (handled elsewhere)
                        // Or invalid. Treat as Before Attribute Name
                        this.state = State.BEFORE_ATTRIBUTE_NAME;
                    }
                    break;

                case State.MARKUP_DECLARATION_OPEN:
                    if (this.input.startsWith('--', this.pos)) {
                        this.state = State.COMMENT_START;
                        this.buffer = '<!--';
                        this.pos += 2;
                        this.col += 2; // Approximate
                    } else if (this.input.startsWith('[CDATA[', this.pos)) {
                        this.state = State.CDATA_START;
                        this.buffer = '<![CDATA[';
                        this.pos += 7;
                        this.col += 7;
                    } else if (/^DOCTYPE/i.test(this.input.substring(this.pos, this.pos + 7))) {
                        this.state = State.DOCTYPE;
                        this.buffer = '<!DOCTYPE';
                        this.pos += 7;
                        this.col += 7;
                    } else {
                        // Bogus comment or declaration
                        this.state = State.COMMENT; // Treat as comment until >
                        this.buffer = '<!';
                    }
                    break;

                case State.COMMENT_START:
                    this.state = State.COMMENT;
                    break;

                case State.COMMENT:
                    if (char === '-') {
                         this.state = State.COMMENT_END_DASH;
                    }
                    this.buffer += char;
                    this.advance();
                    break;

                case State.COMMENT_END_DASH:
                     if (char === '-') {
                         this.state = State.COMMENT_END;
                     } else {
                         this.state = State.COMMENT;
                     }
                     this.buffer += char;
                     this.advance();
                     break;

                case State.COMMENT_END:
                    if (char === '>') {
                        this.buffer += char;
                        this.emit(TokenType.Comment);
                        this.advance();
                        this.state = State.DATA;
                    } else {
                        // Not really end
                         if (char !== '-') {
                             this.state = State.COMMENT;
                         }
                         this.buffer += char;
                         this.advance();
                    }
                    break;

                case State.CDATA_START:
                    this.state = State.CDATA;
                    break;

                case State.CDATA:
                    if (char === ']') {
                        this.state = State.CDATA_END_1;
                    }
                    this.buffer += char;
                    this.advance();
                    break;

                case State.CDATA_END_1:
                    if (char === ']') {
                        this.state = State.CDATA_END_2;
                    } else {
                        this.state = State.CDATA;
                    }
                    this.buffer += char;
                    this.advance();
                    break;

                case State.CDATA_END_2:
                    if (char === '>') {
                        this.buffer += char;
                        this.emit(TokenType.CDATA);
                        this.advance();
                        this.state = State.DATA;
                    } else {
                        if (char !== ']') {
                             this.state = State.CDATA;
                        }
                        this.buffer += char;
                        this.advance();
                    }
                    break;

                case State.DOCTYPE:
                    if (char === '>') {
                        this.buffer += char;
                        this.emit(TokenType.Doctype);
                        this.advance();
                        this.state = State.DATA;
                    } else {
                        this.buffer += char;
                        this.advance();
                    }
                    break;

                case State.PI:
                    if (char === '?') {
                         this.state = State.PI_END;
                    }
                    this.buffer += char;
                    this.advance();
                    break;

                case State.PI_END:
                    if (char === '>') {
                        this.buffer += char;
                        this.emit(TokenType.PI);
                        this.advance();
                        this.state = State.DATA;
                    } else {
                        this.state = State.PI;
                        this.buffer += char;
                        this.advance();
                    }
                    break;

                case State.RAW_TEXT_TAG:
                     // Consume until </currentTag>
                     const closeTag = `</${this.currentTag}`;
                     // Case insensitive check? Standard says depends on doctype/browser, usually strict for <script>.
                     // Let's assume case insensitive for robustness.
                     if (this.input.substring(this.pos).toLowerCase().startsWith(closeTag)) {
                         // Emit text buffer
                         if (this.buffer.length > 0) {
                             this.emit(TokenType.Text);
                         }
                         this.state = State.TAG_OPEN; // Will handle </tag>
                         this.advance(); // Consume the '<'
                         this.currentTag = '';
                     } else {
                         this.buffer += char;
                         this.advance();
                     }
                     break;
            }
        }

        if (this.buffer.length > 0) {
            this.emit(TokenType.Text);
        }

        return this.tokens;
    }
}
