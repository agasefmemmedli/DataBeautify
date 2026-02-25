
export enum TokenType {
    Whitespace,
    Comment,
    String,
    Punctuation, // { } ;
    Word,        // Directives, values, variables
    Variable,    // ${var}
    LuaBlock,    // content_by_lua_block { ... }
    Unknown
}

export interface Token {
    type: TokenType;
    text: string;
    line: number;
    col: number;
    endLine: number;
}

export class NginxTokenizer {
    private code: string;
    private pos: number = 0;
    private line: number = 1;
    private col: number = 1;
    private expectingLuaBlock = false;

    constructor(code: string) {
        this.code = code;
    }

    tokenize(): Token[] {
        const tokens: Token[] = [];
        this.pos = 0;
        this.line = 1;
        this.col = 1;
        this.expectingLuaBlock = false;

        while (this.pos < this.code.length) {
            const char = this.code[this.pos];
            const startLine = this.line;
            const startCol = this.col;

            // Handle Lua Block Expectation
            if (this.expectingLuaBlock) {
                if (/\s/.test(char)) {
                     // Emit whitespace normally, keep expecting
                } else if (char === '#') {
                     // Emit comment normally, keep expecting
                } else if (char === '{') {
                    // Start Lua Block
                    let text = char;
                    this.advance(char);
                    let braceLevel = 1;
                    let inString = false;
                    let quoteChar = '';

                    while (this.pos < this.code.length && braceLevel > 0) {
                        const c = this.code[this.pos];

                        if (inString) {
                            text += c;
                            this.advance(c);
                            if (c === '\\') {
                                 // escape next
                                 if (this.pos < this.code.length) {
                                     const next = this.code[this.pos];
                                     text += next;
                                     this.advance(next);
                                 }
                            } else if (c === quoteChar) {
                                inString = false;
                            }
                            continue;
                        }

                        // Comments --
                        if (c === '-' && this.pos + 1 < this.code.length && this.code[this.pos + 1] === '-') {
                            // Consume comment until newline
                            text += c;
                            this.advance(c);
                            while (this.pos < this.code.length) {
                                const next = this.code[this.pos];
                                text += next;
                                this.advance(next);
                                if (next === '\n') break;
                            }
                            continue;
                        }

                        // Long brackets [[ ... ]]
                        if (c === '[' && this.pos + 1 < this.code.length && this.code[this.pos + 1] === '[') {
                            text += c; this.advance(c); // [
                            text += '['; this.advance('['); // [

                            while (this.pos < this.code.length) {
                                const next = this.code[this.pos];
                                text += next;
                                this.advance(next);
                                if (text.endsWith(']]')) break;
                            }
                            continue;
                        }

                        // Strings
                        if (c === '"' || c === "'") {
                            inString = true;
                            quoteChar = c;
                            text += c;
                            this.advance(c);
                            continue;
                        }

                        // Braces
                        if (c === '{') braceLevel++;
                        else if (c === '}') braceLevel--;

                        text += c;
                        this.advance(c);
                    }

                    tokens.push({ type: TokenType.LuaBlock, text, line: startLine, col: startCol, endLine: this.line });
                    this.expectingLuaBlock = false;
                    continue;
                } else {
                    // Found something else, stop expecting
                    this.expectingLuaBlock = false;
                }
            }

            // Whitespace
            if (/\s/.test(char)) {
                let text = '';
                while (this.pos < this.code.length && /\s/.test(this.code[this.pos])) {
                    const c = this.code[this.pos];
                    text += c;
                    this.advance(c);
                }
                tokens.push({ type: TokenType.Whitespace, text, line: startLine, col: startCol, endLine: this.line });
                continue;
            }

            // Comment
            if (char === '#') {
                let text = '';
                while (this.pos < this.code.length && this.code[this.pos] !== '\n') {
                    const c = this.code[this.pos];
                    text += c;
                    this.advance(c);
                }
                tokens.push({ type: TokenType.Comment, text, line: startLine, col: startCol, endLine: this.line });
                continue;
            }

            // Strings ("..." or '...')
            if (char === '"' || char === "'") {
                const quote = char;
                let text = quote;
                this.advance(quote); // Skip opening quote
                let escaped = false;
                while (this.pos < this.code.length) {
                    const c = this.code[this.pos];
                    text += c;
                    this.advance(c);
                    if (escaped) {
                        escaped = false;
                    } else {
                        if (c === '\\') {
                            escaped = true;
                        } else if (c === quote) {
                            break;
                        }
                    }
                }
                tokens.push({ type: TokenType.String, text, line: startLine, col: startCol, endLine: this.line });
                continue;
            }

            // Variable interpolation ${...}
            if (char === '$' && this.pos + 1 < this.code.length && this.code[this.pos + 1] === '{') {
                let text = '$';
                this.advance('$');
                text += '{';
                this.advance('{');

                while (this.pos < this.code.length) {
                    const c = this.code[this.pos];
                    text += c;
                    this.advance(c);
                    if (c === '}') break;
                }
                tokens.push({ type: TokenType.Variable, text, line: startLine, col: startCol, endLine: this.line });
                continue;
            }

            // Punctuation
            if (char === '{' || char === '}' || char === ';') {
                tokens.push({ type: TokenType.Punctuation, text: char, line: startLine, col: startCol, endLine: this.line });
                this.advance(char);
                continue;
            }

            // Word (Directives, parameters)
            let text = '';
            while (this.pos < this.code.length) {
                const c = this.code[this.pos];
                if (/\s/.test(c) || c === '{' || c === '}' || c === ';' || c === '#' || c === '"' || c === "'" || c === '$') {
                    break;
                }
                text += c;
                this.advance(c);
            }
            if (text.length > 0) {
                tokens.push({ type: TokenType.Word, text, line: startLine, col: startCol, endLine: this.line });

                // Check if this word triggers a Lua block expectation
                if (text.endsWith('_by_lua_block')) {
                    this.expectingLuaBlock = true;
                }
            } else {
                 const c = this.code[this.pos];
                 tokens.push({ type: TokenType.Unknown, text: c, line: startLine, col: startCol, endLine: this.line });
                 this.advance(c);
            }
        }
        return tokens;
    }

    private advance(char: string) {
        if (char === '\n') {
            this.line++;
            this.col = 1;
        } else {
            this.col++;
        }
        this.pos++;
    }
}
