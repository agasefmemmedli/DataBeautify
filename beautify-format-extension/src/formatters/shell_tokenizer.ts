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
    HeredocStart,
    HeredocBody,
    HeredocEnd,
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
    // Added ${, $((, $(, (( to prevent splitting
    private static readonly OPERATORS = new Set([
        '&&', '||', ';;', '|', '&', ';', '>>', '<<', '<<-', '<', '>',
        '=', '+=', '-=', '*=', '/=', '%=', '==', '!=', '<=', '>=',
        '${', '$((', '$(', '(('
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
            // Strictly check for start of line or preceding whitespace
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
                // If not a comment, fall through to Identifier or Unknown
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
                // Check for <<-
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

            // Number (basic shell numbers)
            if (/\d/.test(char)) {
                let text = '';
                const startCol = this.col;
                const startLine = this.line;
                while (this.pos < this.code.length && /\d/.test(this.code[this.pos])) {
                    text += this.code[this.pos];
                    this.advance();
                }
                tokens.push({ type: TokenType.Number, text, line: startLine, col: startCol });
                continue;
            }

            // Operators (multi-char first)
            // Check operators BEFORE identifiers to catch ${ before $VAR
            let opMatch = '';
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

            if (opMatch) {
                // If the operator is $ and next char is part of identifier, we might want to parse as identifier $VAR
                // But $ is not in OPERATORS set above?
                // Wait, OPERATORS does NOT contain '$'.
                // So $ will fall through to Identifier.
                // But ${ is in OPERATORS. So ${VAR} -> ${ is operator.
                // $(( is in OPERATORS.
                // So this logic works.
                const startLine = this.line;
                const startCol = this.col;
                tokens.push({ type: TokenType.Operator, text: opMatch, line: startLine, col: startCol });
                this.advance(opMatch.length);
                continue;
            }

            // Identifier or Keyword
            // Shell identifiers can contain many things, but usually alphanumeric + _
            // Also variables $VAR
            if (/[a-zA-Z_$]/.test(char) || (char === '.' && this.pos + 1 < this.code.length && /[a-zA-Z_]/.test(this.code[this.pos + 1]))) {
                let text = '';
                const startCol = this.col;
                const startLine = this.line;

                while (this.pos < this.code.length) {
                    const c = this.code[this.pos];
                    // Allow # inside identifier (e.g. word#suffix)
                    if (/[a-zA-Z0-9_$#]/.test(c)) {
                        text += c;
                        this.advance();
                    } else if (c === '{' && text.endsWith('$')) {
                        // Variable expansion ${VAR}
                        // But wait, we handle ${ as operator now.
                        // So if we see $, we consumed it as Identifier start.
                        // Then next char is {.
                        // `text` so far is `$`. `c` is `{`.
                        // If we break here, we emit `$`. Next loop sees `{` -> Operator?
                        // No, `{` is not in OPERATORS (only `{` keyword logic handled later? No, `{` is in keywords).
                        // If `{` is keyword, `echo ${` -> `echo`, `$`, `{`.
                        // This splits ${.
                        // We want ${ to be single token if possible, OR handled by operator logic.
                        // Operator logic runs BEFORE Identifier logic.
                        // So ${ should be caught by Operator logic.
                        // But Operator logic needs to match `${`.
                        // Does `threeChars` or `twoChars` see `${`?
                        // Yes.
                        // But does `char` match `Identifier` logic?
                        // `char` is `$`.
                        // `Operator` logic runs first. `$` is NOT in `OPERATORS` (single char).
                        // So `opMatch` is empty.
                        // Falls to Identifier logic. `$` matches identifier start.
                        // So it starts consuming `$`.
                        // Next char `{`.
                        // `/[a-zA-Z0-9_$#]/.test('{')` is false.
                        // So it breaks.
                        // Emits `$`.
                        // Next loop: `{`. Matches Keyword `{`? Or Punctuation?
                        // This splits `${`.
                        // FIX: Add `$` to OPERATORS? No, `$VAR` is identifier.
                        // FIX: In Identifier loop, if we have just `$`, and see `{`, maybe backtrack?
                        // BETTER FIX: Check for `${` in Operator logic logic explicitly even if `$` is not operator.
                        // But `twoChars` check handles `${` if `${` is in OPERATORS.
                        // So if `${` is in OPERATORS, `opMatch` will be `${`.
                        // So we consume `${` as Operator.
                        // Identifier logic won't even run.
                        // THIS IS CORRECT.
                        break;
                    } else {
                        break;
                    }
                }

                // If text is empty (e.g. starting with . but failed lookahead?), consume char
                if (text === '') {
                    text = char;
                    this.advance();
                }

                const type = ShellTokenizer.KEYWORDS.has(text) ? TokenType.Keyword : TokenType.Identifier;
                tokens.push({ type, text, line: startLine, col: startCol });
                continue;
            }

            // Punctuation and other symbols not covered by operators
            if ('()[]{},:;.'.includes(char)) {
                tokens.push({ type: TokenType.Punctuation, text: char, line: this.line, col: this.col });
                this.advance();
                continue;
            }

            // Unknown / Catch-all (e.g. @, %, ^ if not operators)
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
            // Single quotes: no escapes inside, except usually ' cannot appear inside '...'
            // But we just search for next '
            while (searchPos < this.code.length) {
                const c = this.code[searchPos];
                currentString += c;
                searchPos++;
                if (c === "'") {
                    return currentString;
                }
            }
        } else {
            // Double quotes and backticks: support escapes
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

        return currentString; // Return unclosed string to be resilient
    }
}
