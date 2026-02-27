
export enum TokenType {
    Whitespace,
    Comment,
    String,
    Keyword,
    Identifier,
    Operator,
    Punctuation,
    Number,
    Decorator, // @Annotation
    Unknown
}

export interface Token {
    type: TokenType;
    text: string;
    line: number;
    col: number;
}

export class DartTokenizer {
    private text: string;
    private pos: number;
    private line: number;
    private col: number;
    private tokens: Token[];

    constructor(text: string) {
        this.text = text;
        this.pos = 0;
        this.line = 1;
        this.col = 1;
        this.tokens = [];
    }

    public tokenize(): Token[] {
        while (this.pos < this.text.length) {
            const char = this.text[this.pos];

            // Whitespace
            if (/\s/.test(char)) {
                this.readWhitespace();
                continue;
            }

            // Comments
            if (char === '/') {
                if (this.match('//')) {
                    this.readLineComment();
                    continue;
                }
                if (this.match('/*')) {
                    this.readBlockComment();
                    continue;
                }
            }

            // Strings (Raw and Normal)
            if (char === 'r') {
                if (this.match("r'") || this.match('r"')) {
                    this.readRawString();
                    continue;
                }
            }
            if (char === "'" || char === '"') {
                this.readString();
                continue;
            }

            // Numbers
            if (/[0-9]/.test(char)) {
                this.readNumber();
                continue;
            }

            // Decorators (Annotations)
            if (char === '@') {
                this.readDecorator();
                continue;
            }

            // Identifiers and Keywords
            if (/[a-zA-Z_$]/.test(char)) {
                this.readIdentifier();
                continue;
            }

            // Operators and Punctuation
            this.readOperatorOrPunctuation();
        }

        return this.tokens;
    }

    private addToken(type: TokenType, text: string) {
        this.tokens.push({
            type,
            text,
            line: this.line,
            col: this.col
        });

        // Update line/col
        for (const char of text) {
            if (char === '\n') {
                this.line++;
                this.col = 1;
            } else {
                this.col++;
            }
        }
    }

    private match(str: string): boolean {
        return this.text.substr(this.pos, str.length) === str;
    }

    private readWhitespace() {
        let text = '';
        while (this.pos < this.text.length && /\s/.test(this.text[this.pos])) {
            text += this.text[this.pos];
            this.pos++;
        }
        this.addToken(TokenType.Whitespace, text);
    }

    private readLineComment() {
        let text = '';
        while (this.pos < this.text.length && this.text[this.pos] !== '\n') {
            text += this.text[this.pos];
            this.pos++;
        }
        this.addToken(TokenType.Comment, text);
    }

    private readBlockComment() {
        let text = '/*';
        this.pos += 2; // skip /*
        while (this.pos < this.text.length) {
            if (this.match('*/')) {
                text += '*/';
                this.pos += 2;
                break;
            }
            text += this.text[this.pos];
            this.pos++;
        }
        this.addToken(TokenType.Comment, text);
    }

    private readRawString() {
        // r"..." or r'...' or r"""...""" or r'''...'''
        let text = 'r';
        this.pos++; // skip r
        const quote = this.text[this.pos];
        let isTriple = false;

        if (this.match(quote + quote + quote)) {
            isTriple = true;
            text += quote + quote + quote;
            this.pos += 3;
        } else {
            text += quote;
            this.pos++;
        }

        while (this.pos < this.text.length) {
            if (isTriple) {
                if (this.match(quote + quote + quote)) {
                    text += quote + quote + quote;
                    this.pos += 3;
                    break;
                }
            } else {
                if (this.text[this.pos] === quote) {
                    text += quote;
                    this.pos++;
                    break;
                }
            }
            text += this.text[this.pos];
            this.pos++;
        }
        this.addToken(TokenType.String, text);
    }

    private readString() {
        const quote = this.text[this.pos];
        let isTriple = false;
        let text = '';

        if (this.match(quote + quote + quote)) {
            isTriple = true;
            text += quote + quote + quote;
            this.pos += 3;
        } else {
            text += quote;
            this.pos++;
        }

        while (this.pos < this.text.length) {
            const char = this.text[this.pos];

            if (char === '\\') {
                // Escape sequence
                text += char;
                this.pos++;
                if (this.pos < this.text.length) {
                    text += this.text[this.pos];
                    this.pos++;
                }
                continue;
            }

            if (isTriple) {
                if (this.match(quote + quote + quote)) {
                    text += quote + quote + quote;
                    this.pos += 3;
                    break;
                }
            } else {
                if (char === quote) {
                    text += char;
                    this.pos++;
                    break;
                }
            }

            // Note: We are treating interpolation ${...} as part of the string token for now.
            // A more advanced tokenizer would split string parts and interpolation expressions.
            // But for deep formatting, we usually want to treat strings as atomic blocks unless we format inside interpolation.
            // For now, atomic string is safer to avoid breaking interpolation.

            text += char;
            this.pos++;
        }
        this.addToken(TokenType.String, text);
    }

    private readNumber() {
        let text = '';
        // Hex
        if (this.match('0x') || this.match('0X')) {
            text += this.text.substr(this.pos, 2);
            this.pos += 2;
            while (this.pos < this.text.length && /[0-9a-fA-F_]/.test(this.text[this.pos])) {
                 text += this.text[this.pos];
                 this.pos++;
            }
        } else {
            // Decimal / Float
            while (this.pos < this.text.length && /[0-9_]/.test(this.text[this.pos])) {
                text += this.text[this.pos];
                this.pos++;
            }
            if (this.pos < this.text.length && this.text[this.pos] === '.') {
                // Check if it's .. cascade or just dot operator vs float
                // 1.2 is float. 1.. is 1 and ..
                // If next is digit, it's float.
                if (this.pos + 1 < this.text.length && /[0-9]/.test(this.text[this.pos+1])) {
                    text += '.';
                    this.pos++;
                    while (this.pos < this.text.length && /[0-9_]/.test(this.text[this.pos])) {
                        text += this.text[this.pos];
                        this.pos++;
                    }
                    // Exponent
                    if (this.pos < this.text.length && (this.text[this.pos] === 'e' || this.text[this.pos] === 'E')) {
                         text += this.text[this.pos];
                         this.pos++;
                         if (this.pos < this.text.length && (this.text[this.pos] === '+' || this.text[this.pos] === '-')) {
                             text += this.text[this.pos];
                             this.pos++;
                         }
                         while (this.pos < this.text.length && /[0-9_]/.test(this.text[this.pos])) {
                             text += this.text[this.pos];
                             this.pos++;
                         }
                    }
                }
            }
        }
        this.addToken(TokenType.Number, text);
    }

    private readDecorator() {
        // @Annotation
        let text = '@';
        this.pos++;
        while (this.pos < this.text.length && /[a-zA-Z0-9_.]/.test(this.text[this.pos])) {
            text += this.text[this.pos];
            this.pos++;
        }
        this.addToken(TokenType.Decorator, text);
    }

    private readIdentifier() {
        let text = '';
        while (this.pos < this.text.length && /[a-zA-Z0-9_$]/.test(this.text[this.pos])) {
            text += this.text[this.pos];
            this.pos++;
        }

        // Check if keyword
        const keywords = [
            'abstract', 'as', 'assert', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
            'covariant', 'default', 'deferred', 'do', 'dynamic', 'else', 'enum', 'export', 'extends', 'extension',
            'external', 'factory', 'false', 'final', 'finally', 'for', 'function', 'get', 'hide', 'if', 'implements',
            'import', 'in', 'interface', 'is', 'late', 'library', 'mixin', 'new', 'null', 'on', 'operator', 'part',
            'required', 'rethrow', 'return', 'set', 'show', 'static', 'super', 'switch', 'sync', 'this', 'throw',
            'true', 'try', 'typedef', 'var', 'void', 'while', 'with', 'yield', 'record',
            // Data Beautifier Added Keywords
            'when', 'sealed', 'base', 'interface'
        ];

        if (keywords.includes(text)) {
            this.addToken(TokenType.Keyword, text);
        } else {
            this.addToken(TokenType.Identifier, text);
        }
    }

    private readOperatorOrPunctuation() {
        const char = this.text[this.pos];
        let text = char;

        // Multi-char operators
        if (['.', '?', '!', '=', '+', '-', '*', '/', '%', '<', '>', '&', '|', '^', '~', ':'].includes(char)) {
            const next = this.pos + 1 < this.text.length ? this.text[this.pos + 1] : '';
            const nextNext = this.pos + 2 < this.text.length ? this.text[this.pos + 2] : '';

            if (char === '.') {
                if (next === '.' && nextNext === '.') { // ...
                    text = '...';
                    if (this.pos + 3 < this.text.length && this.text[this.pos+3] === '?') { // ...?
                         text = '...?';
                    }
                } else if (next === '.') { // ..
                    text = '..';
                }
            } else if (char === '?') {
                if (next === '?') { // ??
                    text = '??';
                    if (nextNext === '=') text = '??=';
                } else if (next === '.') { // ?. or ?..
                    text = '?.';
                    if (nextNext === '.') text = '?..';
                }
            } else if (char === '=') {
                if (next === '>') text = '=>';
                else if (next === '=') text = '==';
            } else if (char === '!') {
                if (next === '=') text = '!=';
            } else if (char === '+') {
                if (next === '+') text = '++';
                else if (next === '=') text = '+=';
            } else if (char === '-') {
                if (next === '-') text = '--';
                else if (next === '=') text = '-=';
            } else if (char === '&') {
                if (next === '&') text = '&&';
                else if (next === '=') text = '&=';
            } else if (char === '|') {
                if (next === '|') text = '||';
                else if (next === '=') text = '|=';
            } else if (['*', '/', '%', '^', '~'].includes(char)) {
                if (next === '=') text += '=';
            } else if (char === '<') {
                if (next === '=') text = '<=';
                else if (next === '<') {
                    text = '<<';
                    if (nextNext === '=') text = '<<=';
                }
            } else if (char === '>') {
                if (next === '=') text = '>=';
                else if (next === '>') {
                    text = '>>';
                    if (nextNext === '=') text = '>>=';
                    else if (nextNext === '>') {
                        text = '>>>';
                        if (this.pos + 3 < this.text.length && this.text[this.pos+3] === '=') text = '>>>=';
                    }
                }
            } else if (char === ':') {
                 // just :
            }
        }

        // Punctuation
        if (['(', ')', '[', ']', '{', '}', ',', ';'].includes(char)) {
            this.addToken(TokenType.Punctuation, char);
            this.pos++;
            return;
        }

        this.addToken(TokenType.Operator, text);
        this.pos += text.length;
    }
}
