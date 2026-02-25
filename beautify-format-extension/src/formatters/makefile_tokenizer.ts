export enum TokenType {
    Comment = 'Comment',
    Directive = 'Directive',
    Assignment = 'Assignment', // :=, =, +=, ?=, !=
    Variable = 'Variable', // $(...) or ${...}
    Function = 'Function', // $(call ...) or other functions
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
                    // newline will be consumed in next iteration
                    continue;
                }
            }

            // 5. Comment
            if (char === '#') {
                let comment = '';
                const startLine = this.line;
                const startCol = this.col;

                // Capture until newline
                while (this.pos < this.text.length && this.text[this.pos] !== '\n') {
                    comment += this.text[this.pos];
                    this.advance();
                }
                this.tokens.push({ type: TokenType.Comment, text: comment, line: startLine, col: startCol });
                continue;
            }

            // 6. Assignment Operators and Target Separators
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

            // 7. Variables / Functions $(...) or ${...}
            if (char === '$') {
                const startLine = this.line;
                const startCol = this.col;

                // Check if it's a variable reference
                if (this.peek(1) === '(' || this.peek(1) === '{') {
                    const opener = this.peek(1);
                    const closer = opener === '(' ? ')' : '}';

                    let variable = '$' + opener;
                    this.advance(2); // consume $ and opener

                    let balance = 1;

                    while (this.pos < this.text.length && balance > 0) {
                        const c = this.text[this.pos];
                        if (c === opener) balance++;
                        else if (c === closer) balance--;
                        else if (c === '\n') {
                            // Should not span across lines without continuation?
                            // But usually inside parens newlines are allowed if escaped?
                            // Let's assume valid makefile.
                        }

                        variable += c;
                        this.advance();
                    }

                    if (variable.startsWith(`$${opener}call`) || variable.startsWith(`$${opener}shell`)) {
                        this.tokens.push({ type: TokenType.Function, text: variable, line: startLine, col: startCol });
                    } else {
                        this.tokens.push({ type: TokenType.Variable, text: variable, line: startLine, col: startCol });
                    }
                    continue;
                } else {
                    // Single char variable $V or just $
                    if (this.pos + 1 < this.text.length) {
                        const next = this.peek(1);
                        this.tokens.push({ type: TokenType.Variable, text: '$' + next, line: startLine, col: startCol });
                        this.advance(2);
                        continue;
                    }
                }
            }

            // 8. Words / Text
            let word = '';
            const startLine = this.line;
            const startCol = this.col;

            while (this.pos < this.text.length) {
                const c = this.text[this.pos];
                if (/\s/.test(c) || c === '\n' || c === '\t') break;
                if (c === '#') break;
                if (':+?!='.includes(c)) {
                    const remaining = this.text.substring(this.pos);
                    if (remaining.startsWith('::=') || remaining.startsWith('::') || remaining.startsWith(':=') || remaining.startsWith('?=') || remaining.startsWith('+=') || remaining.startsWith('!=')) {
                        break;
                    }
                    if (c === '=' || c === ':') break;
                }
                if (c === '$') break;
                if (c === '\\' && this.peek(1) === '\n') break;

                word += c;
                this.advance();
            }

            if (word) {
                const directives = ['include', '-include', 'sinclude', 'vpath', 'export', 'unexport', 'override', 'undefine', 'private', 'ifeq', 'ifneq', 'ifdef', 'ifndef', 'else', 'endif', 'define', 'endef'];
                if (directives.includes(word)) {
                    this.tokens.push({ type: TokenType.Directive, text: word, line: startLine, col: startCol });
                } else {
                    this.tokens.push({ type: TokenType.Text, text: word, line: startLine, col: startCol });
                }
            } else {
                // Determine if we are stuck
                if (this.text[this.pos] === '\\') {
                    this.tokens.push({ type: TokenType.Text, text: '\\', line: this.line, col: this.col });
                    this.advance();
                } else if (this.pos < this.text.length) {
                    this.tokens.push({ type: TokenType.Text, text: this.text[this.pos], line: this.line, col: this.col });
                    this.advance();
                }
            }
        }

        return this.tokens;
    }
}
