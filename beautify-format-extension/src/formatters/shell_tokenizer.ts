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
        'in', 'return', 'exit', 'break', 'continue', 'local', 'declare', 'readonly', 'export',
        'trap', 'set', 'unset', 'shift', 'eval', 'exec', 'read', 'cd', 'echo', 'printf', 'let',
        'alias', 'unalias', 'source', '.', 'test'
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

            // Line Continuation (Backslash + Newline)
            if (char === '\\') {
                if (this.pos + 1 < this.code.length) {
                    const next = this.code[this.pos + 1];
                    if (next === '\n' || next === '\r') {
                        // Skip backslash + newline and treat as whitespace for tokenizing,
                        // but maybe we want to preserve it?
                        // If we preserve it as a Token, the formatter can decide indentation.
                        // Let's create a 'LineContinuation' token?
                        // Or just treat as whitespace but special.
                        // For deep formatter, we want to indent the next line.
                        // Let's emit a specific token.
                        let text = '\\';
                        let len = 1;
                        if (next === '\r') {
                            if (this.pos + 2 < this.code.length && this.code[this.pos + 2] === '\n') {
                                text += '\r\n';
                                len += 2;
                            } else {
                                text += '\r';
                                len++;
                            }
                        } else {
                            text += '\n';
                            len++;
                        }

                        // We will emit this as Newline but with special text so formatter knows it is continuation?
                        // Or maybe 'Whitespace'? No, Newline is structural.
                        // Let's use Newline but the text is '\\\n'.
                        // But wait, standard Newline token is just '\n'.
                        // If we include '\', it's part of the token.
                        tokens.push({ type: TokenType.Newline, text: text, line: this.line, col: this.col });
                        this.advance(len);
                        this.line++;
                        this.col = 1;
                        continue;
                    }
                }
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
                // Check if it's start of word (not inside ${#...} which is handled by Variable logic, but here we are at top level loop)
                // Actually ${#var} starts with $ which is handled below.
                // But `echo #comment` vs `echo word#notcomment`
                // Standard shell: # starts comment if it is at the start of a token.
                // i.e. preceded by whitespace or start of line.
                // Or if previous char was control operator?

                const isStart = this.pos === 0 || /\s/.test(this.code[this.pos - 1]) || /[;&|(){}]/.test(this.code[this.pos - 1]);

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
                // Identifier followed immediately by =
                // But careful with ==
                const nextChar = this.pos + 1 < this.code.length ? this.code[this.pos + 1] : '';
                if (nextChar !== '=' && nextChar !== '~') {
                    // Check if previous token was Identifier/Variable/String and adjacent
                    const isImmediate = prevToken &&
                        (prevToken.type === TokenType.Identifier || prevToken.type === TokenType.String || prevToken.type === TokenType.Variable) &&
                        (prevToken.col + prevToken.text.length === this.col);

                    if (isImmediate) {
                        tokens.push({ type: TokenType.Assignment, text: '=', line: this.line, col: this.col });
                        this.advance();
                        continue;
                    }
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

                    // Special parameters: $? $# $$ $! $* $@ $0 $- $_
                    if (/[?#$!*@0-9\-_]/.test(this.code[currentPos])) {
                        varName += this.code[currentPos];
                        tokens.push({ type: TokenType.Variable, text: varName, line: startLine, col: startCol });
                        this.advance(2);
                        continue;
                    }

                    // ${...} or $((...)) or $(...)
                    if (this.code[currentPos] === '{' || this.code[currentPos] === '(') {
                        // Let operator logic handle $(( and $(
                        // But ${ is handled here or operator?
                        // We have ${ in OPERATORS. So it might be picked up by Operator logic if we don't handle it here.
                        // But Operator logic is checked BEFORE Variable logic.
                        // Wait, I put Operator check BEFORE Variable check?
                        // Yes. So ${ will be tokenized as Operator '${'.
                        // Is that fine?
                        // If it is tokenized as Operator, we need to handle matching '}' in tokenizer or parser.
                        // For formatting, we treat ${...} as a unit ideally?
                        // But it can contain nested strings and commands.
                        // Deep formatting usually prefers to tokenize content if we want to format inside.
                        // But for shell, formatting inside ${} is rare unless it is complex.
                        // Let's rely on Operator for ${ and handle bracing in Formatter?
                        // But wait, if I put Operator check BEFORE, then $ will be consumed by ${ check if present.
                        // Correct.

                        // What about plain $VAR?
                        // Operator check will NOT match $VAR unless $ is in OPERATORS (it is not, only ${, $((, $( ).
                        // So $VAR falls through to here.
                    } else if (/[a-zA-Z_]/.test(this.code[currentPos])) {
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
                    if (';&|<>()/{}'.includes(c)) break; // Stop at operators
                    if (c === '$') break;
                    if (c === '\\') {
                         if (this.pos + 1 < this.code.length) {
                             text += c + this.code[this.pos + 1];
                             this.advance(2);
                             continue;
                         }
                    }
                    if (c === '#') {
                        // Comment start check again?
                        // word#foo is valid.
                        // But typically we tokenize until separator.
                        // If we hit #, is it a separator? No.
                        // Unless we want to be very precise.
                    }

                    // Check if char is start of an operator we care about splitting
                    if (ShellTokenizer.OPERATORS.has(c)) break;

                    text += c;
                    this.advance();
                }

                if (text === '') {
                    // Fallback (e.g. backslash alone at end? or char matched break condition immediately)
                    // If we broke because of operator, we should have matched operator above.
                    // But maybe it's a single char operator not in the set?
                    // e.g. ',' (comma) is not in OPERATORS.
                    // '.' (dot) is in KEYWORDS but not OPERATORS?
                    // If it is '.', it matches Operator check (no) -> Variable (no) -> Identifier loop.
                    // Identifier loop stops at ... wait, '.' is not in break list.
                    // So '.' is consumed as Identifier.

                    if (this.pos < this.code.length) {
                         text = this.code[this.pos];
                         this.advance();
                    }
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
