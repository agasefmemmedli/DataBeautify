
export enum TokenType {
    Keyword,
    Identifier,
    String,
    Number,
    Operator,
    Punctuation,
    Comment,
    Whitespace,
    Unknown,
    HeredocStart,
    HeredocBody,
    HeredocEnd,
    Symbol,
    Regex
}

export interface Token {
    type: TokenType;
    text: string;
    line: number;
    column: number;
}

export class RubyTokenizer {
    private text: string;
    private pos: number;
    private line: number;
    private column: number;

    private keywords = new Set([
        'alias', 'and', 'begin', 'break', 'case', 'class', 'def', 'defined?',
        'do', 'else', 'elsif', 'end', 'ensure', 'false', 'for', 'if',
        'in', 'module', 'next', 'nil', 'not', 'or', 'redo', 'rescue',
        'retry', 'return', 'self', 'super', 'then', 'true', 'undef',
        'unless', 'until', 'when', 'while', 'yield', '__FILE__', '__LINE__'
    ]);

    private operators = new Set([
        '+', '-', '*', '/', '%', '**',
        '==', '!=', '>', '<', '>=', '<=', '<=>', '===',
        '=', '+=', '-=', '*=', '/=', '%=', '**=',
        '&&', '||', '!', '~', '&', '|', '^', '<<', '>>',
        '..', '...', '::', '->', '=>',
        '||=', '&&=', '<<=', '>>=', '&=', '|=', '^='
    ]);

    constructor(text: string) {
        this.text = text;
        this.pos = 0;
        this.line = 1;
        this.column = 1;
    }

    public tokenize(): Token[] {
        const tokens: Token[] = [];
        let inHeredoc = false;
        let heredocDelimiter = '';
        let heredocIndent = false; // <<-EOF or <<~EOF allow indent

        while (this.pos < this.text.length) {
            const startLine = this.line;
            const startColumn = this.column;
            const char = this.text[this.pos];

            // Heredoc Handling
            if (inHeredoc) {
                // Read line by line
                let lineEnd = this.text.indexOf('\n', this.pos);
                if (lineEnd === -1) lineEnd = this.text.length;

                const lineContent = this.text.substring(this.pos, lineEnd);
                const trimmedContent = lineContent.trim();

                // Check for end delimiter
                if (trimmedContent === heredocDelimiter) {
                    // This is the end
                    tokens.push(this.createToken(TokenType.HeredocEnd, lineContent, startLine, startColumn));
                    inHeredoc = false;
                    heredocDelimiter = '';
                } else {
                    tokens.push(this.createToken(TokenType.HeredocBody, lineContent, startLine, startColumn));
                }

                this.advance(lineContent.length);
                if (this.pos < this.text.length && this.text[this.pos] === '\n') {
                    // Consume newline
                    const nlLine = this.line;
                    const nlCol = this.column;
                    tokens.push(this.createToken(TokenType.Whitespace, '\n', nlLine, nlCol));
                    this.advance(1);
                }
                continue;
            }

            // Whitespace
            if (/\s/.test(char)) {
                let value = '';
                // Note: we advanced one by one, so capturing startLine/startColumn is correct for the block
                while (this.pos < this.text.length && /\s/.test(this.text[this.pos])) {
                    value += this.text[this.pos];
                    this.advance(1);
                }
                tokens.push(this.createToken(TokenType.Whitespace, value, startLine, startColumn));
                continue;
            }

            // Comments
            if (char === '#') {
                let value = '';
                while (this.pos < this.text.length && this.text[this.pos] !== '\n') {
                    value += this.text[this.pos];
                    this.advance(1);
                }
                tokens.push(this.createToken(TokenType.Comment, value, startLine, startColumn));
                continue;
            }

            // Strings
            if (char === '"' || char === "'") {
                const quote = char;
                let value = quote;
                this.advance(1);

                let escaped = false;
                while (this.pos < this.text.length) {
                    const c = this.text[this.pos];
                    value += c;
                    this.advance(1);

                    if (escaped) {
                        escaped = false;
                    } else if (c === '\\') {
                        escaped = true;
                    } else if (c === quote) {
                        break;
                    }
                }
                tokens.push(this.createToken(TokenType.String, value, startLine, startColumn));
                continue;
            }

            // Percent Strings/Arrays/Regex (%q, %Q, %w, %W, %i, %I, %r, %x)
            if (char === '%' && this.pos + 1 < this.text.length) {
                const next = this.text[this.pos + 1];
                if (/[qQwWiIrxs]/.test(next) || /[^a-zA-Z0-9\s]/.test(next)) {
                    // It's likely a percent literal
                    // Determine delimiter
                    let delimiterStart = next;
                    let contentStart = 2; // %x
                    if (/[^a-zA-Z0-9\s]/.test(next)) {
                        delimiterStart = next;
                        contentStart = 1; // %|
                    } else {
                        // %q{
                        if (this.pos + 2 < this.text.length) {
                             delimiterStart = this.text[this.pos + 2];
                             contentStart = 3;
                        } else {
                            // incomplete
                        }
                    }

                    // Matching delimiter
                    let delimiterEnd = delimiterStart;
                    if (delimiterStart === '{') delimiterEnd = '}';
                    if (delimiterStart === '[') delimiterEnd = ']';
                    if (delimiterStart === '(') delimiterEnd = ')';
                    if (delimiterStart === '<') delimiterEnd = '>';

                    let value = this.text.substring(this.pos, this.pos + contentStart);
                    this.advance(contentStart);

                    let depth = 1;
                    let escaped = false;

                    while (this.pos < this.text.length) {
                        const c = this.text[this.pos];
                        value += c;
                        this.advance(1);

                        if (escaped) {
                            escaped = false;
                        } else if (c === '\\') {
                            escaped = true;
                        } else if (c === delimiterStart && delimiterStart !== delimiterEnd) {
                            depth++;
                        } else if (c === delimiterEnd) {
                            depth--;
                            if (depth === 0) break;
                        }
                    }

                    // Identify type
                    if (next === 'r') tokens.push(this.createToken(TokenType.Regex, value, startLine, startColumn));
                    else tokens.push(this.createToken(TokenType.String, value, startLine, startColumn));
                    continue;
                }
            }

            // Regex Literal /.../
            // Difficult to distinguish from division.
            // Heuristic: start of line, after operator, after (, [, {, ,, ;
            // Or if previous token was keyword (unless return/when/elsif?)
            if (char === '/') {
                const prev = this.getPreviousSignificantToken(tokens);
                let isRegex = false;
                if (!prev) {
                    isRegex = true;
                } else {
                    if (prev.type === TokenType.Operator || prev.type === TokenType.Punctuation || prev.type === TokenType.Keyword) {
                        // Check if keyword is one that expects expression
                        if (prev.type === TokenType.Keyword) {
                            const val = prev.text;
                            if (['if', 'unless', 'while', 'until', 'case', 'when', 'elsif', 'return', 'next', 'break', 'and', 'or', 'not'].includes(val)) {
                                isRegex = true;
                            } else {
                                // method name? def / ... invalid.
                                // object.method / ... division.
                            }
                        } else if (prev.text === ')' || prev.text === ']') {
                            isRegex = false; // (1+2) / 3
                        } else {
                            isRegex = true; // = /regex/, , /regex/
                        }
                    }
                }

                if (isRegex) {
                    let value = '/';
                    this.advance(1);
                    let escaped = false;
                    while (this.pos < this.text.length) {
                        const c = this.text[this.pos];
                        value += c;
                        this.advance(1);
                        if (escaped) {
                            escaped = false;
                        } else if (c === '\\') {
                            escaped = true;
                        } else if (c === '/') {
                            break;
                        }
                    }
                    // Flags? /regex/im
                    while (this.pos < this.text.length && /[a-z]/.test(this.text[this.pos])) {
                        value += this.text[this.pos];
                        this.advance(1);
                    }
                    tokens.push(this.createToken(TokenType.Regex, value, startLine, startColumn));
                    continue;
                }
            }

            // Heredoc Start
            // <<EOF, <<-EOF, <<~EOF, <<'EOF', <<"EOF"
            if (char === '<' && this.text[this.pos+1] === '<') {
                const remaining = this.text.substring(this.pos);
                const heredocMatch = remaining.match(/^<<([-~]?)(["']?)([a-zA-Z0-9_]+)\2/);

                if (heredocMatch) {
                    // It IS a heredoc start
                    inHeredoc = true;
                    heredocIndent = heredocMatch[1].length > 0;
                    heredocDelimiter = heredocMatch[3];

                    const fullMatch = heredocMatch[0];
                    tokens.push(this.createToken(TokenType.HeredocStart, fullMatch, startLine, startColumn));
                    this.advance(fullMatch.length);
                    continue;
                }
            }

            // Symbols :symbol
            if (char === ':') {
                // Check if followed by identifier characters?
                if (this.pos + 1 < this.text.length && /[a-zA-Z0-9_@]/.test(this.text[this.pos + 1])) {
                     // Check if previous token prevents it from being symbol?
                     // e.g. { key: value } -> key: is punctuation/operator-ish in hash map syntax (1.9+)
                     // But :symbol is standard.
                     // Also :: is scope resolution.
                     if (this.text[this.pos + 1] === ':') {
                         tokens.push(this.createToken(TokenType.Operator, '::', startLine, startColumn));
                         this.advance(2);
                         continue;
                     }

                     // Distinguish :symbol from key: value
                     // key: value -> the colon is at the END of identifier.
                     // :symbol -> colon at start.
                     // If we are here, we are at ':'.
                     // If it was key:, we would have parsed 'key' as identifier, then see ':'.
                     // So here it must be :symbol or just : operator.

                     // Read identifier
                     let value = ':';
                     this.advance(1);

                     // quoted symbol? :'foo'
                     if (this.text[this.pos] === "'" || this.text[this.pos] === '"') {
                         const quote = this.text[this.pos];
                         value += quote;
                         this.advance(1);
                         let escaped = false;
                         while (this.pos < this.text.length) {
                             const c = this.text[this.pos];
                             value += c;
                             this.advance(1);
                             if (escaped) escaped = false;
                             else if (c === '\\') escaped = true;
                             else if (c === quote) break;
                         }
                     } else {
                         while (this.pos < this.text.length && /[a-zA-Z0-9_@?!]/.test(this.text[this.pos])) {
                             value += this.text[this.pos];
                             this.advance(1);
                         }
                     }
                     tokens.push(this.createToken(TokenType.Symbol, value, startLine, startColumn));
                     continue;
                }
            }

            // Numbers
            if (/\d/.test(char)) {
                let value = '';
                while (this.pos < this.text.length && /[\d_.]/.test(this.text[this.pos])) {
                    // prevent double dot ..
                    if (this.text[this.pos] === '.' && this.text[this.pos+1] === '.') break;
                    value += this.text[this.pos];
                    this.advance(1);
                }
                tokens.push(this.createToken(TokenType.Number, value, startLine, startColumn));
                continue;
            }

            // Global Variables ($var, $1)
            if (char === '$') {
                let value = '$';
                this.advance(1);
                while (this.pos < this.text.length && /[a-zA-Z0-9_]/.test(this.text[this.pos])) {
                    value += this.text[this.pos];
                    this.advance(1);
                }
                tokens.push(this.createToken(TokenType.Identifier, value, startLine, startColumn));
                continue;
            }

            // Identifier or Keyword (@var, @@var, name)
            if (/[a-zA-Z_@]/.test(char)) {
                let value = '';
                while (this.pos < this.text.length && /[a-zA-Z0-9_@?!]/.test(this.text[this.pos])) {
                    value += this.text[this.pos];
                    this.advance(1);
                }

                // Check if it's a key in hash syntax (key:)
                if (this.text[this.pos] === ':') {
                     // key: value
                     // Unless it is ::
                     if (this.text[this.pos+1] !== ':') {
                         value += ':';
                         this.advance(1);
                         tokens.push(this.createToken(TokenType.Identifier, value, startLine, startColumn)); // Treated as identifier (key)
                         continue;
                     }
                }

                if (this.keywords.has(value)) {
                    tokens.push(this.createToken(TokenType.Keyword, value, startLine, startColumn));
                } else {
                    tokens.push(this.createToken(TokenType.Identifier, value, startLine, startColumn));
                }
                continue;
            }

            // Operators and Punctuation
            // Check 3 chars
            if (this.pos + 2 < this.text.length) {
                const threeChars = char + this.text[this.pos+1] + this.text[this.pos+2];
                if (this.operators.has(threeChars)) {
                    tokens.push(this.createToken(TokenType.Operator, threeChars, startLine, startColumn));
                    this.advance(3);
                    continue;
                }
            }

            // Check 2 chars
            if (this.pos + 1 < this.text.length) {
                const twoChars = char + this.text[this.pos+1];
                if (this.operators.has(twoChars)) {
                    tokens.push(this.createToken(TokenType.Operator, twoChars, startLine, startColumn));
                    this.advance(2);
                    continue;
                }
            }

            if (this.operators.has(char)) {
                tokens.push(this.createToken(TokenType.Operator, char, startLine, startColumn));
                this.advance(1);
                continue;
            }

            if (/[(){}\[\],;.]/.test(char)) {
                tokens.push(this.createToken(TokenType.Punctuation, char, startLine, startColumn));
                this.advance(1);
                continue;
            }

            // Unknown
            tokens.push(this.createToken(TokenType.Unknown, char, startLine, startColumn));
            this.advance(1);
        }

        return tokens;
    }

    private advance(n: number) {
        for (let i = 0; i < n; i++) {
            if (this.pos < this.text.length) {
                if (this.text[this.pos] === '\n') {
                    this.line++;
                    this.column = 1;
                } else {
                    this.column++;
                }
                this.pos++;
            }
        }
    }

    private createToken(type: TokenType, text: string, line: number, column: number): Token {
        return {
            type,
            text,
            line,
            column
        };
    }

    private getPreviousSignificantToken(tokens: Token[]): Token | null {
        for (let i = tokens.length - 1; i >= 0; i--) {
            if (tokens[i].type !== TokenType.Whitespace && tokens[i].type !== TokenType.Comment) {
                return tokens[i];
            }
        }
        return null;
    }
}
