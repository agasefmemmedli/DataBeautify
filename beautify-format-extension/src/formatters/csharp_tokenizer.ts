
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
    Attribute, // [...]
    Unknown
}

export interface Token {
    type: TokenType;
    text: string;
    line: number;
    col: number;
}

export class CsharpTokenizer {
    private code: string;
    private pos: number = 0;
    private line: number = 1;
    private col: number = 1;

    // C# Keywords (Contextual included for simplicity)
    private static readonly KEYWORDS = new Set([
        'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch', 'char', 'checked',
        'class', 'const', 'continue', 'decimal', 'default', 'delegate', 'do', 'double', 'else',
        'enum', 'event', 'explicit', 'extern', 'false', 'finally', 'fixed', 'float', 'for', 'foreach',
        'goto', 'if', 'implicit', 'in', 'int', 'interface', 'internal', 'is', 'lock', 'long',
        'namespace', 'new', 'null', 'object', 'operator', 'out', 'override', 'params', 'private',
        'protected', 'public', 'readonly', 'ref', 'return', 'sbyte', 'sealed', 'short', 'sizeof',
        'stackalloc', 'static', 'string', 'struct', 'switch', 'this', 'throw', 'true', 'try', 'typeof',
        'uint', 'ulong', 'unchecked', 'unsafe', 'ushort', 'using', 'virtual', 'void', 'volatile', 'while',
        'add', 'alias', 'ascending', 'async', 'await', 'by', 'descending', 'dynamic', 'equals', 'from',
        'get', 'global', 'group', 'init', 'into', 'join', 'let', 'managed', 'nameof', 'nint', 'not',
        'notnull', 'nuint', 'on', 'orderby', 'partial', 'record', 'remove', 'required', 'scoped',
        'select', 'set', 'unmanaged', 'value', 'var', 'when', 'where', 'with', 'yield'
    ]);

    // C# Operators
    private static readonly OPERATORS = new Set([
        '??=', '??', '?.', '=>', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=',
        '&=', '|=', '^=', '<<=', '>>=', '>>>', '<<', '>>', '++', '--', '&&', '||',
        '+', '-', '*', '/', '%', '^', '&', '|', '~', '!', '=', '<', '>', '?', ':', ',', ';'
    ]);

    // Regexes (Sticky)
    private readonly reWhitespace = /[ \t]+/y;
    private readonly reIdentifier = /@?[a-zA-Z_][a-zA-Z0-9_]*/y; // C# identifiers can start with @
    private readonly reHex = /0x[0-9a-fA-F_]+(?:[uU][lL]?|[lL][uU]?)?/y;
    private readonly reBin = /0b[01_]+(?:[uU][lL]?|[lL][uU]?)?/y;
    private readonly reNumber = /(\d[\d_]*\.?\d*([eE][+-]?\d+)?|\.\d+([eE][+-]?\d+)?)(?:[fFdDmM]|[uU][lL]?|[lL][uU]?)?/y;

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
                // Check if likely preprocessor
                let k = this.pos + 1;
                while (k < this.code.length && /[ \t]/.test(this.code[k])) k++;
                // Check identifier
                this.reIdentifier.lastIndex = k;
                const match = this.reIdentifier.exec(this.code);
                if (match) {
                    const directive = match[0];
                    if (['if', 'else', 'elif', 'endif', 'define', 'undef', 'warning', 'error', 'line', 'region', 'endregion', 'pragma', 'nullable'].includes(directive)) {
                        let end = this.pos;
                        while (end < this.code.length) {
                            if (this.code[end] === '\n' || this.code[end] === '\r') break;
                            end++;
                        }
                        const text = this.code.substring(this.pos, end);
                        tokens.push({ type: TokenType.Preprocessor, text, line: this.line, col: this.col });
                        this.advanceStr(text);
                        continue;
                    }
                }
            }

            // String Literals
            // @"..."
            if (char === '@' && this.pos + 1 < this.code.length && this.code[this.pos + 1] === '"') {
                const str = this.matchVerbatimString();
                if (str) {
                    tokens.push({ type: TokenType.String, text: str, line: this.line, col: this.col });
                    this.advanceStr(str);
                    continue;
                }
            }
            // $@"..." or @$"..."
            if ((char === '$' && this.pos + 1 < this.code.length && this.code[this.pos + 1] === '@') ||
                (char === '@' && this.pos + 1 < this.code.length && this.code[this.pos + 1] === '$')) {
                // Check next char is "
                if (this.pos + 2 < this.code.length && this.code[this.pos + 2] === '"') {
                    const str = this.matchVerbatimString(); // Verbatim logic handles quote doubling, interpolation braces are inside string content for now
                    if (str) {
                        tokens.push({ type: TokenType.String, text: str, line: this.line, col: this.col });
                        this.advanceStr(str);
                        continue;
                    }
                }
            }
            // $"{...}" (Interpolated) - handled same as normal string but different prefix?
            // "..."
            if (char === '"' || (char === '$' && this.pos + 1 < this.code.length && this.code[this.pos + 1] === '"')) {
                const str = this.matchString();
                if (str) {
                    tokens.push({ type: TokenType.String, text: str, line: this.line, col: this.col });
                    this.advanceStr(str);
                    continue;
                }
            }
            // Raw string literals """...""" (C# 11)
            // Starts with at least 3 quotes.
            if (char === '"' && this.pos + 2 < this.code.length && this.code[this.pos + 1] === '"' && this.code[this.pos + 2] === '"') {
                const str = this.matchRawString();
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

            // Attribute ([...])
            // Attributes appear before classes, methods, properties, parameters.
            // Distinguishing [Attribute] from array[index] or collection expression [1, 2].
            // Heuristic: If it's at start of line or after preprocessor/comment/semicolon/brace, it's likely attribute.
            // But we tokenize everything. We can tag it as Attribute if it looks like one?
            // Actually, for formatting, treating [ ... ] as punctuation/operator is fine, but if we can identify attributes we can force newlines.
            // Let's stick to standard tokenizing and handle context in formatter.

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
            if (/[a-zA-Z_@]/.test(char)) {
                this.reIdentifier.lastIndex = this.pos;
                const match = this.reIdentifier.exec(this.code);
                if (match) {
                    const text = match[0];
                    const type = CsharpTokenizer.KEYWORDS.has(text) ? TokenType.Keyword : TokenType.Identifier;
                    tokens.push({ type, text, line: this.line, col: this.col });
                    this.advanceStr(text);
                    continue;
                }
            }

            // Operators
            const threeChars = this.code.substr(this.pos, 3);
            if (CsharpTokenizer.OPERATORS.has(threeChars)) {
                tokens.push({ type: TokenType.Operator, text: threeChars, line: this.line, col: this.col });
                this.advanceStr(threeChars);
                continue;
            }
            const twoChars = this.code.substr(this.pos, 2);
            if (CsharpTokenizer.OPERATORS.has(twoChars)) {
                tokens.push({ type: TokenType.Operator, text: twoChars, line: this.line, col: this.col });
                this.advanceStr(twoChars);
                continue;
            }
            if (CsharpTokenizer.OPERATORS.has(char)) {
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
        // "..." or $"..."
        let start = this.pos;
        if (this.code[start] === '$') start++;
        if (this.code[start] !== '"') return null;

        let currentPos = start + 1;
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

    private matchVerbatimString(): string | null {
        // @"..." or $@"..." or @$"..."
        let start = this.pos;
        if (this.code[start] === '$' || this.code[start] === '@') {
            start++;
            if (this.code[start] === '$' || this.code[start] === '@') start++;
        }
        if (this.code[start] !== '"') return null;

        let currentPos = start + 1;
        while (currentPos < this.code.length) {
            const char = this.code[currentPos];
            if (char === '"') {
                if (currentPos + 1 < this.code.length && this.code[currentPos + 1] === '"') {
                    currentPos += 2; // Quote doubling escape
                    continue;
                }
                return this.code.substring(this.pos, currentPos + 1);
            }
            currentPos++;
        }
        return null;
    }

    private matchRawString(): string | null {
        // """...""" or $"""..."""
        // Logic: matches >=3 quotes start, ends with same number of quotes
        let start = this.pos;
        if (this.code[start] === '$') start++; // interpolation prefix allowed

        let quoteCount = 0;
        while (start + quoteCount < this.code.length && this.code[start + quoteCount] === '"') {
            quoteCount++;
        }
        if (quoteCount < 3) return null;

        let currentPos = start + quoteCount;
        while (currentPos < this.code.length) {
            if (this.code[currentPos] === '"') {
                // Check if we have matching end sequence
                let endQuotes = 0;
                while (currentPos + endQuotes < this.code.length && this.code[currentPos + endQuotes] === '"') {
                    endQuotes++;
                }
                if (endQuotes >= quoteCount) {
                    return this.code.substring(this.pos, currentPos + endQuotes);
                }
                currentPos += endQuotes; // Skip these quotes as they weren't enough
            } else {
                currentPos++;
            }
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
