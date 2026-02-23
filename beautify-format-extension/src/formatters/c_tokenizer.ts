
export enum TokenType {
    Whitespace,
    Comment,
    String,
    Char,
    Preprocessor,
    Keyword,
    Operator,
    Punctuation,
    Identifier,
    Number,
    Newline,
    Attribute, // [[...]] or __attribute__((...))
    Unknown
}

export interface Token {
    type: TokenType;
    text: string;
    line: number;
    col: number;
}

export class CTokenizer {
    private code: string;
    private pos: number = 0;
    private line: number = 1;
    private col: number = 1;

    // C Keywords (C17 + C23 common)
    private static readonly KEYWORDS = new Set([
        'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extern',
        'float', 'for', 'goto', 'if', 'inline', 'int', 'long', 'register', 'restrict', 'return', 'short', 'signed',
        'sizeof', 'static', 'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while',
        '_Alignas', '_Alignof', '_Atomic', '_Bool', '_Complex', '_Generic', '_Imaginary', '_Noreturn', '_Static_assert', '_Thread_local',
        // C23 / Common Extensions
        'alignas', 'alignof', 'bool', 'constexpr', 'false', 'nullptr', 'static_assert', 'thread_local', 'true', 'typeof', 'typeof_unqual',
        'asm', '__asm__', '__attribute__', '__extension__', '__restrict', '__restrict__', '__volatile__', '__inline__', '__thread',
        // Common Libraries/Frameworks/Conventions
        'NULL', 'int8_t', 'uint8_t', 'int16_t', 'uint16_t', 'int32_t', 'uint32_t', 'int64_t', 'uint64_t', 'size_t', 'ssize_t', 'ptrdiff_t', 'intptr_t', 'uintptr_t',
        'wchar_t', 'char16_t', 'char32_t'
    ]);

    // C Operators
    private static readonly OPERATORS = new Set([
        '->', '++', '--', '&&', '||', '<<', '>>', '==', '!=', '<=', '>=',
        '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=',
        '+', '-', '*', '/', '%', '^', '&', '|', '~', '!', '=', '<', '>', '?', ':', ',', ';', '.'
    ]);

    // Regexes (Sticky)
    private readonly reWhitespace = /[ \t]+/y;
    private readonly reIdentifier = /[a-zA-Z_][a-zA-Z0-9_]*/y;
    private readonly reHex = /0x[0-9a-fA-F']+(?:[uU][lL]{0,2}|[lL]{0,2}[uU]?)?/y;
    private readonly reBin = /0b[01']+(?:[uU][lL]{0,2}|[lL]{0,2}[uU]?)?/y;
    private readonly reNumber = /(\d[\d']*\.?\d*([eE][+-]?\d+)?|\.\d+([eE][+-]?\d+)?)(?:[fF]|[lL]|[uU])?/y;

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
                        const ret = this.code.indexOf('\r', this.pos + 2);
                        if (ret !== -1 && ret < end) end = ret;

                        const text = this.code.substring(this.pos, end);
                        tokens.push({ type: TokenType.Comment, text, line: this.line, col: this.col });
                        this.advanceStr(text);
                        continue;
                    } else if (next === '*') {
                        // Block comment
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

            // Preprocessor (#...)
            if (char === '#') {
                let k = this.pos + 1;
                while (k < this.code.length && /[ \t]/.test(this.code[k])) k++;
                this.reIdentifier.lastIndex = k;
                const match = this.reIdentifier.exec(this.code);
                if (match) {
                    const directive = match[0];
                    if (['include', 'define', 'undef', 'if', 'ifdef', 'ifndef', 'else', 'elif', 'endif', 'error', 'line', 'pragma', 'version', 'extension'].includes(directive)) {
                        let end = this.pos;
                        while (end < this.code.length) {
                            if (this.code[end] === '\n' || this.code[end] === '\r') {
                                let backslashPos = end - 1;
                                while (backslashPos >= this.pos && /[ \t]/.test(this.code[backslashPos])) backslashPos--;
                                if (backslashPos >= this.pos && this.code[backslashPos] === '\\') {
                                    end++;
                                    if (end < this.code.length && this.code[end] === '\n') end++;
                                    continue;
                                }
                                break;
                            }
                            end++;
                        }
                        const text = this.code.substring(this.pos, end);
                        tokens.push({ type: TokenType.Preprocessor, text, line: this.line, col: this.col });
                        this.advanceStr(text);
                        continue;
                    }
                }
            }

            // String ("...")
            if (char === '"') {
                const str = this.matchString();
                if (str) {
                    tokens.push({ type: TokenType.String, text: str, line: this.line, col: this.col });
                    this.advanceStr(str);
                    continue;
                }
            }
             // Prefixed String (L"...", u8"...", u"...", U"...")
            if ((char === 'L' || char === 'u' || char === 'U') && this.pos + 1 < this.code.length) {
                let offset = 1;
                if (char === 'u' && this.code[this.pos + 1] === '8') offset = 2;

                if (this.pos + offset < this.code.length && this.code[this.pos + offset] === '"') {
                     const prefix = this.code.substring(this.pos, this.pos + offset);
                     this.pos += offset;
                     this.col += offset;
                     const str = this.matchString();
                     if (str) {
                         this.pos -= offset;
                         this.col -= offset;
                         const fullStr = prefix + str;
                         tokens.push({ type: TokenType.String, text: fullStr, line: this.line, col: this.col });
                         this.advanceStr(fullStr);
                         continue;
                     } else {
                         this.pos -= offset;
                         this.col -= offset;
                     }
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

            // Attribute ([[...]])
            if (char === '[' && this.pos + 1 < this.code.length && this.code[this.pos + 1] === '[') {
                let end = this.code.indexOf(']]', this.pos + 2);
                if (end !== -1) {
                    end += 2;
                    const text = this.code.substring(this.pos, end);
                    tokens.push({ type: TokenType.Attribute, text, line: this.line, col: this.col });
                    this.advanceStr(text);
                    continue;
                }
            }

            // Number
            if (/\d/.test(char) || (char === '.' && this.pos + 1 < this.code.length && /\d/.test(this.code[this.pos + 1]))) {
                this.reHex.lastIndex = this.pos;
                const hex = this.reHex.exec(this.code);
                if (hex) {
                    tokens.push({ type: TokenType.Number, text: hex[0], line: this.line, col: this.col });
                    this.advanceStr(hex[0]);
                    continue;
                }
                this.reBin.lastIndex = this.pos;
                const bin = this.reBin.exec(this.code);
                if (bin) {
                    tokens.push({ type: TokenType.Number, text: bin[0], line: this.line, col: this.col });
                    this.advanceStr(bin[0]);
                    continue;
                }
                this.reNumber.lastIndex = this.pos;
                const num = this.reNumber.exec(this.code);
                if (num) {
                    tokens.push({ type: TokenType.Number, text: num[0], line: this.line, col: this.col });
                    this.advanceStr(num[0]);
                    continue;
                }
            }

            // Identifier or Keyword
            if (/[a-zA-Z_]/.test(char)) {
                this.reIdentifier.lastIndex = this.pos;
                const match = this.reIdentifier.exec(this.code);
                if (match) {
                    const text = match[0];
                    const type = CTokenizer.KEYWORDS.has(text) ? TokenType.Keyword : TokenType.Identifier;
                    tokens.push({ type, text, line: this.line, col: this.col });
                    this.advanceStr(text);
                    continue;
                }
            }

            // Operators & Punctuation
            const threeChars = this.code.substr(this.pos, 3);
            if (CTokenizer.OPERATORS.has(threeChars)) {
                tokens.push({ type: TokenType.Operator, text: threeChars, line: this.line, col: this.col });
                this.advanceStr(threeChars);
                continue;
            }
            const twoChars = this.code.substr(this.pos, 2);
            if (CTokenizer.OPERATORS.has(twoChars)) {
                tokens.push({ type: TokenType.Operator, text: twoChars, line: this.line, col: this.col });
                this.advanceStr(twoChars);
                continue;
            }
            if (CTokenizer.OPERATORS.has(char)) {
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
        let currentPos = this.pos;
        if (this.code[currentPos] !== '"') return null;
        currentPos++;

        while (currentPos < this.code.length) {
            const char = this.code[currentPos];
            if (char === '\\') {
                currentPos += 2;
                continue;
            } else if (char === '"') {
                return this.code.substring(this.pos, currentPos + 1);
            }
            currentPos++;
        }
        return null;
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
            }
            currentPos++;
        }
        return null;
    }
}
