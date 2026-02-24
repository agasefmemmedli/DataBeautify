
export enum TokenType {
    Whitespace,
    Comment,
    String,
    Keyword,
    Operator,
    Punctuation,
    Identifier,
    Number,
    Newline,
    Attribute, // @identifier
    Directive, // #identifier
    Unknown
}

export interface Token {
    type: TokenType;
    text: string;
    line: number;
    col: number;
}

export class SwiftTokenizer {
    private code: string;
    private pos: number = 0;
    private line: number = 1;
    private col: number = 1;

    // Swift Keywords
    private static readonly KEYWORDS = new Set([
        'associatedtype', 'class', 'deinit', 'enum', 'extension', 'fileprivate', 'func', 'import', 'init', 'inout', 'internal', 'let', 'open', 'operator', 'private', 'protocol', 'public', 'rethrows', 'static', 'struct', 'subscript', 'typealias', 'var', 'break', 'case', 'continue', 'default', 'defer', 'do', 'else', 'fallthrough', 'for', 'guard', 'if', 'in', 'repeat', 'return', 'switch', 'where', 'while', 'as', 'Any', 'catch', 'false', 'is', 'nil', 'super', 'self', 'Self', 'throw', 'throws', 'true', 'try', 'async', 'await', 'actor', 'convenience', 'dynamic', 'final', 'indirect', 'lazy', 'mutating', 'nonmutating', 'optional', 'override', 'required', 'weak', 'unowned'
    ]);

    // Swift Operators (Common ones, excluding custom operators)
    private static readonly OPERATORS = new Set([
        '/', '=', '-', '+', '!', '*', '%', '<', '>', '&', '|', '^', '~', '?',
        '==', '!=', '>=', '<=', '&&', '||', '??', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=',
        '<<', '>>', '...', '..<', '->', '===', '!==', '~=', '<<=', '>>='
    ]);

    // Regexes (Sticky)
    private readonly reWhitespace = /[ \t]+/y;
    private readonly reIdentifier = /([a-zA-Z_$][a-zA-Z0-9_$]*|`[a-zA-Z_][a-zA-Z0-9_]*`)/y;
    private readonly reHex = /0x[0-9a-fA-F_]+/y;
    private readonly reBin = /0b[01_]+/y;
    private readonly reOct = /0o[0-7_]+/y;
    private readonly reNumber = /\d[0-9_]*(\.[0-9_]+)?([eE][+-]?[0-9_]+)?/y;

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

            // Comment
            if (char === '/') {
                if (this.pos + 1 < this.code.length) {
                    const next = this.code[this.pos + 1];
                    if (next === '/') {
                        // Line comment
                        let end = this.code.indexOf('\n', this.pos + 2);
                        if (end === -1) end = this.code.length;
                        const ret = this.code.indexOf('\r', this.pos + 2);
                        if (ret !== -1 && ret < end) end = ret;

                        const text = this.code.substring(this.pos, end);
                        tokens.push({ type: TokenType.Comment, text, line: this.line, col: this.col });
                        this.advanceStr(text);
                        continue;
                    } else if (next === '*') {
                        // Block comment (nested)
                        const text = this.matchBlockComment();
                        if (text) {
                            tokens.push({ type: TokenType.Comment, text, line: this.line, col: this.col });
                            this.advanceStr(text);
                            continue;
                        }
                    }
                }
            }

            // Attribute (@identifier)
            if (char === '@') {
                this.reIdentifier.lastIndex = this.pos + 1;
                const match = this.reIdentifier.exec(this.code);
                if (match) {
                    const text = '@' + match[0];
                    tokens.push({ type: TokenType.Attribute, text, line: this.line, col: this.col });
                    this.advanceStr(text);
                    continue;
                }
            }

            // Directive (#identifier)
            if (char === '#') {
                // Check if it's a raw string delimiter first?
                // Swift raw strings are #"..."#
                // But normally # starts a directive unless followed by "
                if (this.pos + 1 < this.code.length && this.code[this.pos + 1] === '"') {
                    // Raw string start
                    const str = this.matchRawString();
                    if (str) {
                        tokens.push({ type: TokenType.String, text: str, line: this.line, col: this.col });
                        this.advanceStr(str);
                        continue;
                    }
                }

                this.reIdentifier.lastIndex = this.pos + 1;
                const match = this.reIdentifier.exec(this.code);
                if (match) {
                    const text = '#' + match[0];
                    tokens.push({ type: TokenType.Directive, text, line: this.line, col: this.col });
                    this.advanceStr(text);
                    continue;
                }
            }

            // String ("..." or """...""")
            if (char === '"') {
                const str = this.matchString();
                if (str) {
                    tokens.push({ type: TokenType.String, text: str, line: this.line, col: this.col });
                    this.advanceStr(str);
                    continue;
                }
            }

            // Number
            if (/\d/.test(char)) {
                const num = this.matchNumber();
                if (num) {
                    tokens.push({ type: TokenType.Number, text: num, line: this.line, col: this.col });
                    this.advanceStr(num);
                    continue;
                }
            }

            // Identifier or Keyword
            if (/[a-zA-Z_`$]/.test(char)) {
                this.reIdentifier.lastIndex = this.pos;
                const match = this.reIdentifier.exec(this.code);
                if (match) {
                    const text = match[0];
                    const type = SwiftTokenizer.KEYWORDS.has(text) ? TokenType.Keyword : TokenType.Identifier;
                    tokens.push({ type, text, line: this.line, col: this.col });
                    this.advanceStr(text);
                    continue;
                }
            }

            // Operators & Punctuation
            const threeChars = this.code.substr(this.pos, 3);
            if (SwiftTokenizer.OPERATORS.has(threeChars)) {
                tokens.push({ type: TokenType.Operator, text: threeChars, line: this.line, col: this.col });
                this.advanceStr(threeChars);
                continue;
            }
            const twoChars = this.code.substr(this.pos, 2);
            if (SwiftTokenizer.OPERATORS.has(twoChars)) {
                tokens.push({ type: TokenType.Operator, text: twoChars, line: this.line, col: this.col });
                this.advanceStr(twoChars);
                continue;
            }
            if (SwiftTokenizer.OPERATORS.has(char)) {
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

    private matchBlockComment(): string | null {
        let depth = 1;
        let current = this.pos + 2;
        while (current < this.code.length) {
            if (this.code[current] === '/' && this.code[current + 1] === '*') {
                depth++;
                current += 2;
            } else if (this.code[current] === '*' && this.code[current + 1] === '/') {
                depth--;
                current += 2;
                if (depth === 0) {
                    return this.code.substring(this.pos, current);
                }
            } else {
                current++;
            }
        }
        return null; // Unclosed comment
    }

    private matchString(): string | null {
        const isMultiline = this.code.startsWith('"""', this.pos);
        const delimiter = isMultiline ? '"""' : '"';
        let current = this.pos + delimiter.length;

        while (current < this.code.length) {
            if (this.code[current] === '\\') {
                if (this.code[current + 1] === '(') {
                    // Interpolation: scan until matching )
                    current += 2;
                    let parenDepth = 1;
                    while (current < this.code.length && parenDepth > 0) {
                        if (this.code[current] === '(') parenDepth++;
                        else if (this.code[current] === ')') parenDepth--;
                        else if (this.code[current] === '"') {
                            // String inside interpolation.
                            // This is recursive and complex.
                            // Simplified: Skip until next quote. This fails on nested strings.
                            // Better: Just increment current.
                            // For deep formatting tokenization, we treat the whole thing as one string token.
                            // We risk breaking on `)` inside string inside interpolation.
                            // e.g. \( " ) " )
                            // To do this right we need full recursion.
                            // For this "Deep Formatter" v1, we assume balanced parens/quotes.
                        }
                        current++;
                    }
                    continue;
                } else {
                    current += 2; // Escape sequence
                    continue;
                }
            }

            if (this.code.startsWith(delimiter, current)) {
                return this.code.substring(this.pos, current + delimiter.length);
            }
            current++;
        }
        return null;
    }

    private matchRawString(): string | null {
        // #"..."# or ##"..."##
        let hashes = 0;
        let p = this.pos;
        while (p < this.code.length && this.code[p] === '#') {
            hashes++;
            p++;
        }
        if (this.code[p] !== '"') return null;

        const start = this.pos;
        const hashStr = '#'.repeat(hashes);
        const delimiter = '"' + hashStr;

        let current = p + 1;
        while (current < this.code.length) {
            if (this.code.startsWith(delimiter, current)) {
                return this.code.substring(start, current + delimiter.length);
            }
            current++;
        }
        return null;
    }

    private matchNumber(): string | null {
        this.reHex.lastIndex = this.pos;
        const hex = this.reHex.exec(this.code);
        if (hex) return hex[0];

        this.reBin.lastIndex = this.pos;
        const bin = this.reBin.exec(this.code);
        if (bin) return bin[0];

        this.reOct.lastIndex = this.pos;
        const oct = this.reOct.exec(this.code);
        if (oct) return oct[0];

        this.reNumber.lastIndex = this.pos;
        const num = this.reNumber.exec(this.code);
        if (num) return num[0];

        return null;
    }
}
