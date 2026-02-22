
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
    Attribute, // [[...]]
    Unknown
}

export interface Token {
    type: TokenType;
    text: string;
    line: number;
    col: number;
}

export class CppTokenizer {
    private code: string;
    private pos: number = 0;
    private line: number = 1;
    private col: number = 1;

    // C++ Keywords (Updated for C++20/23)
    private static readonly KEYWORDS = new Set([
        'alignas', 'alignof', 'and', 'and_eq', 'asm', 'auto', 'bitand', 'bitor', 'bool', 'break',
        'case', 'catch', 'char', 'char8_t', 'char16_t', 'char32_t', 'class', 'compl', 'concept', 'const',
        'consteval', 'constexpr', 'constinit', 'const_cast', 'continue', 'co_await', 'co_return', 'co_yield',
        'decltype', 'default', 'delete', 'do', 'double', 'dynamic_cast', 'else', 'enum', 'explicit',
        'export', 'extern', 'false', 'float', 'for', 'friend', 'goto', 'if', 'import', 'inline', 'int', 'long',
        'module', 'mutable', 'namespace', 'new', 'noexcept', 'not', 'not_eq', 'nullptr', 'operator', 'or', 'or_eq',
        'private', 'protected', 'public', 'register', 'reinterpret_cast', 'requires', 'return', 'short',
        'signed', 'sizeof', 'static', 'static_assert', 'static_cast', 'struct', 'switch', 'template',
        'this', 'thread_local', 'throw', 'true', 'try', 'typedef', 'typeid', 'typename', 'union',
        'unsigned', 'using', 'virtual', 'void', 'volatile', 'wchar_t', 'while', 'xor', 'xor_eq'
    ]);

    // C++ Operators (multi-char first)
    private static readonly OPERATORS = new Set([
        '::', '.*', '->*', '->', '++', '--', '&&', '||', '<<', '>>', '==', '!=', '<=', '>=',
        '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '<=>',
        '+', '-', '*', '/', '%', '^', '&', '|', '~', '!', '=', '<', '>', '?', ':', ',', ';'
    ]);

    // Regexes (Sticky)
    private readonly reWhitespace = /[ \t]+/y;
    private readonly reIdentifier = /[a-zA-Z_][a-zA-Z0-9_]*/y;
    // Hex: 0x... with optional suffix u, l, ll, z, etc.
    private readonly reHex = /0x[0-9a-fA-F']+(?:[uU][lL]{0,2}|[lL]{0,2}[uU]?)?/y;
    // Binary: 0b...
    private readonly reBin = /0b[01']+(?:[uU][lL]{0,2}|[lL]{0,2}[uU]?)?/y;
    // Float/Decimal:
    // Digits . Digits? Exponent? Suffix?
    // Digits Exponent Suffix?
    // . Digits Exponent? Suffix?
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
                        // Check \r
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
                // Check if identifier follows (possibly after spaces)
                let k = this.pos + 1;
                while (k < this.code.length && /[ \t]/.test(this.code[k])) k++;

                this.reIdentifier.lastIndex = k;
                const match = this.reIdentifier.exec(this.code);
                if (match) {
                    const directive = match[0];
                    // Common C/C++ preprocessor directives
                    if (['include', 'define', 'undef', 'if', 'ifdef', 'ifndef', 'else', 'elif', 'endif', 'error', 'line', 'pragma', 'version', 'extension', 'warning', 'region', 'endregion'].includes(directive)) {
                        // Consume until logical end of line (handling backslash continuations)
                        let end = this.pos;
                        while (end < this.code.length) {
                            if (this.code[end] === '\n' || this.code[end] === '\r') {
                                // Check for backslash continuation
                                let backslashPos = end - 1;
                                while (backslashPos >= this.pos && /[ \t]/.test(this.code[backslashPos])) backslashPos--;
                                if (backslashPos >= this.pos && this.code[backslashPos] === '\\') {
                                    // Continuation, skip newline char
                                    end++;
                                    if (end < this.code.length && this.code[end] === '\n') end++; // Handle \r\n
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

            // Raw String (R"delimiter(...)delimiter")
            if (char === 'R' && this.pos + 1 < this.code.length && this.code[this.pos + 1] === '"') {
                const rawString = this.matchRawString();
                if (rawString) {
                    tokens.push({ type: TokenType.String, text: rawString, line: this.line, col: this.col });
                    this.advanceStr(rawString);
                    continue;
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
                     // Temporarily advance to parse string content
                     this.pos += offset;
                     this.col += offset; // Approximate
                     const str = this.matchString();
                     // Revert
                     this.pos -= offset;
                     this.col -= offset;

                     if (str) {
                         const fullStr = prefix + str;
                         tokens.push({ type: TokenType.String, text: fullStr, line: this.line, col: this.col });
                         this.advanceStr(fullStr);
                         continue;
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
            // Prefixed Char (L'...', u'...', U'...')
            if ((char === 'L' || char === 'u' || char === 'U') && this.pos + 1 < this.code.length) {
                let offset = 1;
                if (char === 'u' && this.code[this.pos + 1] === '8') offset = 2;

                if (this.pos + offset < this.code.length && this.code[this.pos + offset] === '\'') {
                    this.pos += offset;
                    this.col += offset;
                    const ch = this.matchChar();
                    this.pos -= offset;
                    this.col -= offset;

                    if (ch) {
                        const fullChar = this.code.substring(this.pos, this.pos + offset) + ch;
                        tokens.push({ type: TokenType.Char, text: fullChar, line: this.line, col: this.col });
                        this.advanceStr(fullChar);
                        continue;
                    }
                }
            }

            // Attribute ([[...]])
            if (char === '[' && this.pos + 1 < this.code.length && this.code[this.pos + 1] === '[') {
                // Simple greedy match for ]]
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
                // Check Hex/Bin first
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

                // General number
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
                    const type = CppTokenizer.KEYWORDS.has(text) ? TokenType.Keyword : TokenType.Identifier;
                    tokens.push({ type, text, line: this.line, col: this.col });
                    this.advanceStr(text);
                    continue;
                }
            }

            // Operators & Punctuation
            // Try 3 chars
            const threeChars = this.code.substr(this.pos, 3);
            if (CppTokenizer.OPERATORS.has(threeChars)) {
                tokens.push({ type: TokenType.Operator, text: threeChars, line: this.line, col: this.col });
                this.advanceStr(threeChars);
                continue;
            }
            // Try 2 chars
            const twoChars = this.code.substr(this.pos, 2);
            if (CppTokenizer.OPERATORS.has(twoChars)) {
                tokens.push({ type: TokenType.Operator, text: twoChars, line: this.line, col: this.col });
                this.advanceStr(twoChars);
                continue;
            }
            // Try 1 char
            if (CppTokenizer.OPERATORS.has(char)) {
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

    private matchRawString(): string | null {
        // R"delimiter(content)delimiter"
        const start = this.pos;
        if (this.code[start] !== 'R' || this.code[start + 1] !== '"') return null;

        let delimiter = '';
        let i = start + 2;
        // Read delimiter until (
        while (i < this.code.length && this.code[i] !== '(') {
            if (this.code[i] === ' ' || this.code[i] === '"' || this.code[i] === ')') return null; // Invalid delimiter chars
            if (i - (start + 2) > 16) return null; // Max delimiter length check (sanity)
            delimiter += this.code[i];
            i++;
        }

        if (i >= this.code.length || this.code[i] !== '(') return null;
        i++; // skip (

        const endSequence = ')' + delimiter + '"';
        const contentStart = i;

        // Find end sequence
        const endIdx = this.code.indexOf(endSequence, contentStart);
        if (endIdx === -1) return null;

        return this.code.substring(start, endIdx + endSequence.length);
    }
}
