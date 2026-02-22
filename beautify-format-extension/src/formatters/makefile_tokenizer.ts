export enum TokenType {
    Comment = 'Comment',
    Directive = 'Directive',
    Assignment = 'Assignment', // :=, =, +=, ?=, !=
    Variable = 'Variable', // $(...)
    Text = 'Text',
    Whitespace = 'Whitespace',
    Newline = 'Newline',
    Continuation = 'Continuation', // \ at end of line
    Operator = 'Operator', // : or ::
    Tab = 'Tab'
}

export interface Token {
    type: TokenType;
    text: string;
    line: number;
    col: number;
}

export class MakefileTokenizer {
    private text: string;
    private pos: number;
    private line: number;
    private col: number;
    private tokens: Token[];

    constructor(text: string) {
        this.text = text;
        this.pos = 0;
        this.line = 1;
        this.col = 1;
        this.tokens = [];
    }

    private peek(offset: number = 0): string {
        return this.pos + offset < this.text.length ? this.text[this.pos + offset] : '';
    }

    private advance(count: number = 1) {
        for (let i = 0; i < count; i++) {
            if (this.text[this.pos] === '\n') {
                this.line++;
                this.col = 1;
            } else {
                this.col++;
            }
            this.pos++;
        }
    }

    tokenize(): Token[] {
        while (this.pos < this.text.length) {
            const char = this.text[this.pos];

            // 1. Newline
            if (char === '\n') {
                this.tokens.push({ type: TokenType.Newline, text: '\n', line: this.line, col: this.col });
                this.advance();
                continue;
            }

            // 2. Tab (Special whitespace for recipes)
            if (char === '\t') {
                this.tokens.push({ type: TokenType.Tab, text: '\t', line: this.line, col: this.col });
                this.advance();
                continue;
            }

            // 3. Whitespace (excluding newline and tab)
            if (/\s/.test(char)) {
                let whitespace = '';
                const startLine = this.line;
                const startCol = this.col;

                while (this.pos < this.text.length) {
                    const c = this.text[this.pos];
                    if (!/\s/.test(c) || c === '\n' || c === '\t') break;
                    whitespace += c;
                    this.advance();
                }
                if (whitespace) {
                    this.tokens.push({ type: TokenType.Whitespace, text: whitespace, line: startLine, col: startCol });
                }
                continue;
            }

            // 4. Continuation (Backslash followed immediately by newline)
            if (char === '\\') {
                if (this.peek(1) === '\n') {
                    this.tokens.push({ type: TokenType.Continuation, text: '\\', line: this.line, col: this.col });
                    this.advance(); // consume \
                    // newline will be consumed in next iteration?
                    // Usually continuation includes the newline in logic, but tokenizer splits them.
                    // Tokenizer output: Continuation(\), Newline(\n)
                    continue;
                }
                // Otherwise it's part of text? Or escaped char?
                // Let's treat it as part of text if not followed by newline.
            }

            // 5. Comment
            if (char === '#') {
                let comment = '';
                const startLine = this.line;
                const startCol = this.col;

                while (this.pos < this.text.length && this.text[this.pos] !== '\n') {
                    comment += this.text[this.pos];
                    this.advance();
                }
                this.tokens.push({ type: TokenType.Comment, text: comment, line: startLine, col: startCol });
                continue;
            }

            // 6. Assignment Operators and Target Separators
            // Operators: =, :=, ::=, +=, ?=, !=
            // Separators: :, ::
            if (':+?!='.includes(char)) {
                const remaining = this.text.substring(this.pos);
                let op = '';
                let type = TokenType.Assignment;

                if (remaining.startsWith('::=')) op = '::=';
                else if (remaining.startsWith('::')) { op = '::'; type = TokenType.Operator; }
                else if (remaining.startsWith(':=')) op = ':=';
                else if (remaining.startsWith('?=')) op = '?=';
                else if (remaining.startsWith('+=')) op = '+=';
                else if (remaining.startsWith('!=')) op = '!=';
                else if (char === '=') op = '=';
                else if (char === ':') { op = ':'; type = TokenType.Operator; }

                if (op) {
                    this.tokens.push({ type: type, text: op, line: this.line, col: this.col });
                    this.advance(op.length);
                    continue;
                }
            }

            // 7. Words (Text, Directives, Variables)
            let word = '';
            const startLine = this.line;
            const startCol = this.col;

            // Consume until separator or whitespace
            while (this.pos < this.text.length) {
                const c = this.text[this.pos];
                if (/\s/.test(c) || c === '\n' || c === '\t') break;
                if (c === '#') break;
                // Break on operators
                if (':+?!='.includes(c)) {
                    // Check if it really is an operator start
                    const remaining = this.text.substring(this.pos);
                    if (remaining.startsWith('::=') || remaining.startsWith('::') || remaining.startsWith(':=') || remaining.startsWith('?=') || remaining.startsWith('+=') || remaining.startsWith('!=') || c === '=' || c === ':') {
                        break;
                    }
                }

                // Handle variable/function references $(...) or ${...}
                if (c === '$') {
                    word += c;
                    this.advance();
                    if (this.pos < this.text.length) {
                        const next = this.text[this.pos];
                        if (next === '(' || next === '{') {
                            const opener = next;
                            const closer = opener === '(' ? ')' : '}';
                            word += opener;
                            this.advance();
                            let balance = 1;
                            while (this.pos < this.text.length && balance > 0) {
                                const innerC = this.text[this.pos];
                                if (innerC === opener) balance++;
                                else if (innerC === closer) balance--;
                                word += innerC;
                                this.advance();
                            }
                        } else {
                            // Single char variable $V
                            word += next;
                            this.advance();
                        }
                    }
                    continue;
                }

                word += c;
                this.advance();
            }

            if (word) {
                if (['include', '-include', 'sinclude', 'vpath', 'export', 'unexport', 'override', 'undefine', 'private', 'ifeq', 'ifneq', 'ifdef', 'ifndef', 'else', 'endif', 'define', 'endef'].includes(word)) {
                    this.tokens.push({ type: TokenType.Directive, text: word, line: startLine, col: startCol });
                } else {
                    this.tokens.push({ type: TokenType.Text, text: word, line: startLine, col: startCol });
                }
            } else {
                // If we didn't consume anything (e.g. we hit an operator immediately inside loop but outside special handling?), handled by operator logic above.
                // But if we have some char that is not handled? e.g. backslash not followed by newline?
                if (this.pos < this.text.length && char === '\\') {
                     this.tokens.push({ type: TokenType.Text, text: '\\', line: this.line, col: this.col });
                     this.advance();
                } else if (this.pos < this.text.length && this.tokens.length > 0 && this.tokens[this.tokens.length-1].line === startLine && this.tokens[this.tokens.length-1].col === startCol) {
                    // Infinite loop protection
                    // Consume one char as text
                    this.tokens.push({ type: TokenType.Text, text: char, line: this.line, col: this.col });
                    this.advance();
                }
            }
        }

        return this.tokens;
    }
}
