
export enum TokenType {
    Whitespace,
    Comment,
    String,
    Char,
    Preprocessor, // Annotation in Java
    Keyword,
    Operator,
    Punctuation,
    Identifier,
    Number,
    Newline,
    Attribute, // Not strictly used for Java in same way as C#, but we use Preprocessor/Annotation
    Unknown
}

export interface Token {
    type: TokenType;
    text: string;
    line: number;
    col: number;
}

export class JavaTokenizer {
    private code: string;
    private pos: number = 0;
    private line: number = 1;
    private col: number = 1;

    // Java Keywords (Java 17+)
    private static readonly KEYWORDS = new Set([
        'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const',
        'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float',
        'for', 'goto', 'if', 'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native',
        'new', 'package', 'private', 'protected', 'public', 'return', 'short', 'static', 'strictfp',
        'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient', 'try', 'void',
        'volatile', 'while', 'true', 'false', 'null',
        // Contextual keywords (Java 9+ modules, records, sealed classes)
        'module', 'requires', 'exports', 'opens', 'to', 'uses', 'provides', 'with',
        'record', 'var', 'yield', 'sealed', 'non-sealed', 'permits', 'when'
    ]);

    // Java Operators
    private static readonly OPERATORS = new Set([
        '->', '::', '...',
        '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=',
        '&=', '|=', '^=', '<<=', '>>=', '>>>=', '>>>', '<<', '>>', '++', '--', '&&', '||',
        '+', '-', '*', '/', '%', '^', '&', '|', '~', '!', '=', '<', '>', '?', ':', ',', ';'
    ]);

    // Regexes (Sticky)
    private readonly reWhitespace = /[ \t]+/y;
    private readonly reIdentifier = /[a-zA-Z_$][a-zA-Z0-9_$]*/y;
    private readonly reHex = /0x[0-9a-fA-F_]+[lL]?/y;
    private readonly reBin = /0b[01_]+[lL]?/y;
    private readonly reNumber = /(\d[\d_]*\.?\d*([eE][+-]?\d+)?[fFdD]?|\.\d+([eE][+-]?\d+)?[fFdD]?)[lL]?/y;

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

            // Whitespace
            if (char === ' ' || char === '\t') {
                this.reWhitespace.lastIndex = this.pos;
                const match = this.reWhitespace.exec(this.code);
                if (match) {
                    tokens.push({ type: TokenType.Whitespace, text: match[0], line: this.line, col: this.col });
                    this.advanceStr(match[0]);
                    continue;
                }
            }

            // Comment (// or /*)
            if (char === '/') {
                if (this.pos + 1 < this.code.length) {
                    const next = this.code[this.pos + 1];
                    if (next === '/') {
                        // Line comment
                        let end = this.code.indexOf('\n', this.pos + 2);
                        if (end === -1) end = this.code.length;
                        // Check \r
                        const ret = this.code.indexOf('\r', this.pos + 2);
                        if (ret !== -1 && ret < end) end = ret;

                        const text = this.code.substring(this.pos, end);
                        tokens.push({ type: TokenType.Comment, text, line: this.line, col: this.col });
                        this.advanceStr(text);
                        continue;
                    } else if (next === '*') {
                        // Block comment / Javadoc
                        let end = this.code.indexOf('*/', this.pos + 2);
                        if (end === -1) end = this.code.length;
                        else end += 2;

                        const text = this.code.substring(this.pos, end);
                        tokens.push({ type: TokenType.Comment, text, line: this.line, col: this.col });
                        this.advanceStr(text);
                        continue;
                    }
                }
            }

            // Annotation (@Identifier)
            if (char === '@') {
                this.reIdentifier.lastIndex = this.pos + 1;
                const match = this.reIdentifier.exec(this.code);
                if (match) {
                    const text = '@' + match[0];
                    tokens.push({ type: TokenType.Preprocessor, text, line: this.line, col: this.col });
                    this.advanceStr(text);
                    continue;
                }
            }

            // String Literals
            // Text Block """...""" (Java 15+)
            if (char === '"' && this.pos + 2 < this.code.length && this.code[this.pos + 1] === '"' && this.code[this.pos + 2] === '"') {
                const str = this.matchTextBlock();
                if (str) {
                    tokens.push({ type: TokenType.String, text: str, line: this.line, col: this.col });
                    this.advanceStr(str);
                    continue;
                }
            }

            // Standard String "..."
            if (char === '"') {
                const str = this.matchString();
                if (str) {
                    tokens.push({ type: TokenType.String, text: str, line: this.line, col: this.col });
                    this.advanceStr(str);
                    continue;
                }
            }

            // Char ('...')
            if (char === '\'') {
                const ch = this.matchChar();
                if (ch) {
                    tokens.push({ type: TokenType.Char, text: ch, line: this.line, col: this.col });
                    this.advanceStr(ch);
                    continue;
                }
            }

            // Number
            if (/\d/.test(char) || (char === '.' && this.pos + 1 < this.code.length && /\d/.test(this.code[this.pos + 1]))) {
                this.reHex.lastIndex = this.pos;
                if (this.reHex.test(this.code)) {
                    this.reHex.lastIndex = this.pos;
                    const match = this.reHex.exec(this.code);
                    if (match) {
                        tokens.push({ type: TokenType.Number, text: match[0], line: this.line, col: this.col });
                        this.advanceStr(match[0]);
                        continue;
                    }
                }
                this.reBin.lastIndex = this.pos;
                if (this.reBin.test(this.code)) {
                    this.reBin.lastIndex = this.pos;
                    const match = this.reBin.exec(this.code);
                    if (match) {
                        tokens.push({ type: TokenType.Number, text: match[0], line: this.line, col: this.col });
                        this.advanceStr(match[0]);
                        continue;
                    }
                }
                this.reNumber.lastIndex = this.pos;
                const match = this.reNumber.exec(this.code);
                if (match) {
                    tokens.push({ type: TokenType.Number, text: match[0], line: this.line, col: this.col });
                    this.advanceStr(match[0]);
                    continue;
                }
            }

            // Identifier or Keyword
            if (/[a-zA-Z_$]/.test(char)) {
                this.reIdentifier.lastIndex = this.pos;
                const match = this.reIdentifier.exec(this.code);
                if (match) {
                    const text = match[0];
                    const type = JavaTokenizer.KEYWORDS.has(text) ? TokenType.Keyword : TokenType.Identifier;
                    tokens.push({ type, text, line: this.line, col: this.col });
                    this.advanceStr(text);
                    continue;
                }
            }

            // Operators (4 chars - unlikely in Java but checked for future)
            // 3 chars (>>>=, ...)
            const threeChars = this.code.substr(this.pos, 3);
            if (JavaTokenizer.OPERATORS.has(threeChars)) {
                tokens.push({ type: TokenType.Operator, text: threeChars, line: this.line, col: this.col });
                this.advanceStr(threeChars);
                continue;
            }
            // 2 chars (->, ::, ==, ...)
            const twoChars = this.code.substr(this.pos, 2);
            if (JavaTokenizer.OPERATORS.has(twoChars)) {
                tokens.push({ type: TokenType.Operator, text: twoChars, line: this.line, col: this.col });
                this.advanceStr(twoChars);
                continue;
            }
            // 1 char
            if (JavaTokenizer.OPERATORS.has(char)) {
                const type = ',;'.includes(char) ? TokenType.Punctuation : TokenType.Operator;
                tokens.push({ type, text: char, line: this.line, col: this.col });
                this.advanceStr(char);
                continue;
            }

            // Punctuation (Braces/Parens)
            if ('()[]{}'.includes(char)) {
                tokens.push({ type: TokenType.Punctuation, text: char, line: this.line, col: this.col });
                this.advance();
                continue;
            }

            // Unknown
            tokens.push({ type: TokenType.Unknown, text: char, line: this.line, col: this.col });
            this.advance();
        }

        return tokens;
    }

    private advance() {
        this.pos++;
        this.col++;
    }

    private advanceStr(str: string) {
        for (const char of str) {
            if (char === '\n') {
                this.line++;
                this.col = 1;
            } else {
                this.col++;
            }
        }
        this.pos += str.length;
    }

    private matchString(): string | null {
        // "..."
        let start = this.pos;
        if (this.code[start] !== '"') return null;

        let currentPos = start + 1;
        while (currentPos < this.code.length) {
            const char = this.code[currentPos];
            if (char === '\\') {
                currentPos += 2; // Skip escaped char
                continue;
            } else if (char === '"') {
                return this.code.substring(this.pos, currentPos + 1);
            } else if (char === '\n' || char === '\r') {
                // Java strings (standard) cannot span lines unescaped
                // But let's be resilient and allow it or break?
                // Standard Java doesn't allow unescaped newlines in "strings".
                // But for formatter, we should probably terminate or continue?
                // Let's assume unclosed string if newline found.
                // But wait, user might have error.
                // Let's break at newline to avoid consuming rest of file.
                return null;
            }
            currentPos++;
        }
        return null;
    }

    private matchTextBlock(): string | null {
        // """..."""
        let start = this.pos;
        let currentPos = start + 3;
        while (currentPos < this.code.length) {
            if (this.code[currentPos] === '"' &&
                currentPos + 2 < this.code.length &&
                this.code[currentPos+1] === '"' &&
                this.code[currentPos+2] === '"') {

                // Check if escaped by backslashes
                let backslashes = 0;
                let k = currentPos - 1;
                while (k >= start + 3 && this.code[k] === '\\') {
                    backslashes++;
                    k--;
                }

                if (backslashes % 2 === 0) {
                    // Not escaped, so it is the terminator
                    return this.code.substring(this.pos, currentPos + 3);
                }
                // Else: escaped, continue searching
            }
            currentPos++;
        }
        return null; // Unterminated text block
    }

    private matchChar(): string | null {
        let currentPos = this.pos;
        if (this.code[currentPos] !== '\'') return null;
        currentPos++;

        while (currentPos < this.code.length) {
            const char = this.code[currentPos];
            if (char === '\\') {
                currentPos += 2;
                continue;
            } else if (char === '\'') {
                return this.code.substring(this.pos, currentPos + 1);
            } else if (char === '\n' || char === '\r') {
                return null;
            }
            currentPos++;
        }
        return null;
    }
}
