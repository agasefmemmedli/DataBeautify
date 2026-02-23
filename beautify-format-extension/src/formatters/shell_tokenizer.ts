export enum TokenType {
    Whitespace,
    Comment,
    String,
    Keyword,
    Operator,
    Assignment, // For = in VAR=VAL
    Punctuation,
    Identifier,
    Number,
    Newline,
    HeredocStart,
    HeredocBody,
    HeredocEnd,
    Variable, // $VAR, ${VAR}
    Unknown
}

export interface Token {
    type: TokenType;
    text: string;
    line: number;
    col: number;
}

export class ShellTokenizer {
    private code: string;
    private pos: number = 0;
    private line: number = 1;
    private col: number = 1;

    private static readonly KEYWORDS = new Set([
        'if', 'then', 'else', 'elif', 'fi',
        'case', 'esac', 'for', 'select', 'while', 'until', 'do', 'done',
        'function', 'time', '[[', ']]', '{', '}', '(', ')', '!',
        'in', 'return', 'exit', 'break', 'continue', 'local', 'declare', 'readonly', 'export'
    ]);

    // Operators that might affect formatting or parsing
    // Added =, ^, !
    private static readonly OPERATORS = new Set([
        '&&', '||', ';;', '|', '&', ';', '>>', '<<', '<<-', '<', '>',
        '+=', '-=', '*=', '/=', '%=', '==', '!=', '<=', '>=', '=~',
        '${', '$((', '$(', '((', '))', '>&', '&>', '2>&1', '1>&2',
        '+', '-', '*', '/', '%', '~', '--', '++',
        '=', '^', '!'
    ]);

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
                this.advance();
                this.line++;
                this.col = 1;
                continue;
            }
            if (char === '\r') {
                if (this.pos + 1 < this.code.length && this.code[this.pos + 1] === '\n') {
                    tokens.push({ type: TokenType.Newline, text: '\r\n', line: this.line, col: this.col });
                    this.advance(2);
                } else {
                    tokens.push({ type: TokenType.Newline, text: '\r', line: this.line, col: this.col });
                    this.advance();
                }
                this.line++;
                this.col = 1;
                continue;
            }

            // Whitespace (excluding newline)
            if (/[ \t]/.test(char)) {
                let text = '';
                const startCol = this.col;
                const startLine = this.line;
                while (this.pos < this.code.length && /[ \t]/.test(this.code[this.pos])) {
                    text += this.code[this.pos];
                    this.advance();
                }
                tokens.push({ type: TokenType.Whitespace, text, line: startLine, col: startCol });
                continue;
            }

            // Comment
            if (char === '#') {
                const isStart = this.pos === 0 || /\s/.test(this.code[this.pos - 1]);
                if (isStart) {
                    let text = '';
                    const startCol = this.col;
                    const startLine = this.line;
                    while (this.pos < this.code.length && this.code[this.pos] !== '\n' && this.code[this.pos] !== '\r') {
                        text += this.code[this.pos];
                        this.advance();
                    }
                    tokens.push({ type: TokenType.Comment, text, line: startLine, col: startCol });
                    continue;
                }
                // If not a comment, fall through to Identifier
            }

            // String
            if (char === '"' || char === "'" || char === '`') {
                const stringMatch = this.matchString();
                if (stringMatch) {
                    const startLine = this.line;
                    const startCol = this.col;
                    tokens.push({ type: TokenType.String, text: stringMatch, line: startLine, col: startCol });
                    this.advanceString(stringMatch);
                    continue;
                }
            }

            // Heredoc Start (<< or <<-)
            if (char === '<' && this.pos + 1 < this.code.length && this.code[this.pos + 1] === '<') {
                let op = '<<';
                if (this.pos + 2 < this.code.length && this.code[this.pos + 2] === '-') {
                    op = '<<-';
                }

                const startLine = this.line;
                const startCol = this.col;

                tokens.push({ type: TokenType.HeredocStart, text: op, line: startLine, col: startCol });
                this.advance(op.length);
                continue;
            }

            // Assignment check: VAR=VAL
            if (char === '=') {
                const prevToken = tokens.length > 0 ? tokens[tokens.length - 1] : null;
                const isImmediate = prevToken &&
                    (prevToken.type === TokenType.Identifier || prevToken.type === TokenType.String || prevToken.type === TokenType.Variable) &&
                    (prevToken.col + prevToken.text.length === this.col);

                const nextChar = this.pos + 1 < this.code.length ? this.code[this.pos + 1] : '';

                if (isImmediate && nextChar !== '=' && nextChar !== '~') {
                    tokens.push({ type: TokenType.Assignment, text: '=', line: this.line, col: this.col });
                    this.advance();
                    continue;
                }
            }

            // Operators (multi-char first)
            let opMatch = '';
            // Try 4 chars
            const fourChars = this.code.substr(this.pos, 4);
            if (ShellTokenizer.OPERATORS.has(fourChars)) {
                opMatch = fourChars;
            } else {
                // Try 3 chars
                const threeChars = this.code.substr(this.pos, 3);
                if (ShellTokenizer.OPERATORS.has(threeChars)) {
                    opMatch = threeChars;
                } else {
                    // Try 2 chars
                    const twoChars = this.code.substr(this.pos, 2);
                    if (ShellTokenizer.OPERATORS.has(twoChars)) {
                        opMatch = twoChars;
                    } else {
                        // Try 1 char
                        if (ShellTokenizer.OPERATORS.has(char)) {
                            opMatch = char;
                        }
                    }
                }
            }

            if (opMatch) {
                const startLine = this.line;
                const startCol = this.col;
                if (opMatch === '[[' || opMatch === ']]') {
                     tokens.push({ type: TokenType.Keyword, text: opMatch, line: startLine, col: startCol });
                } else {
                     tokens.push({ type: TokenType.Operator, text: opMatch, line: startLine, col: startCol });
                }
                this.advance(opMatch.length);
                continue;
            }

            // Variable $VAR
            if (char === '$') {
                const startLine = this.line;
                const startCol = this.col;

                if (this.pos + 1 >= this.code.length || /[\s]/.test(this.code[this.pos+1])) {
                    // Just $
                } else {
                    let varName = '$';
                    let currentPos = this.pos + 1;

                    if (/[?#$!*@0-9-]/.test(this.code[currentPos])) {
                        varName += this.code[currentPos];
                        tokens.push({ type: TokenType.Variable, text: varName, line: startLine, col: startCol });
                        this.advance(2);
                        continue;
                    }

                    if (/[a-zA-Z_]/.test(this.code[currentPos])) {
                        while (currentPos < this.code.length && /[a-zA-Z0-9_]/.test(this.code[currentPos])) {
                            varName += this.code[currentPos];
                            currentPos++;
                        }
                        tokens.push({ type: TokenType.Variable, text: varName, line: startLine, col: startCol });
                        this.advance(varName.length);
                        continue;
                    }
                }
            }

            // Identifier or Keyword
            if (/[^\s\n\r]/.test(char)) {
                let text = '';
                const startCol = this.col;
                const startLine = this.line;

                while (this.pos < this.code.length) {
                    const c = this.code[this.pos];

                    if (/[\s\n\r]/.test(c)) break;
                    if ('"\'`'.includes(c)) break;
                    if (';&|<>()/{}'.includes(c)) break;
                    if (c === '$') break;
                    if (c === '\\') {
                         if (this.pos + 1 < this.code.length) {
                             text += c + this.code[this.pos + 1];
                             this.advance(2);
                             continue;
                         }
                    }

                    // Check if char is start of an operator we care about splitting
                    if (ShellTokenizer.OPERATORS.has(c)) break;

                    text += c;
                    this.advance();
                }

                if (text === '') {
                    // Fallback (e.g. backslash alone at end?)
                    text = char;
                    this.advance();
                }

                const type = ShellTokenizer.KEYWORDS.has(text) ? TokenType.Keyword : TokenType.Identifier;
                tokens.push({ type, text, line: startLine, col: startCol });
                continue;
            }

            tokens.push({ type: TokenType.Unknown, text: char, line: this.line, col: this.col });
            this.advance();
        }

        return tokens;
    }

    private advance(n: number = 1) {
        this.pos += n;
        this.col += n;
    }

    private advanceString(str: string) {
        const lines = str.split(/\r\n|\r|\n/);
        if (lines.length > 1) {
            this.line += lines.length - 1;
            this.col = lines[lines.length - 1].length + 1;
        } else {
            this.col += str.length;
        }
        this.pos += str.length;
    }

    private matchString(): string | null {
        const quoteChar = this.code[this.pos];
        if (quoteChar !== '"' && quoteChar !== "'" && quoteChar !== '`') return null;

        let currentString = quoteChar;
        let searchPos = this.pos + 1;

        if (quoteChar === "'") {
            while (searchPos < this.code.length) {
                const c = this.code[searchPos];
                currentString += c;
                searchPos++;
                if (c === "'") {
                    return currentString;
                }
            }
        } else {
            while (searchPos < this.code.length) {
                const c = this.code[searchPos];
                if (c === '\\') {
                    if (searchPos + 1 < this.code.length) {
                        currentString += c + this.code[searchPos + 1];
                        searchPos += 2;
                        continue;
                    }
                }
                currentString += c;
                searchPos++;
                if (c === quoteChar) {
                    return currentString;
                }
            }
        }

        return currentString;
    }
}
