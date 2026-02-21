export enum TokenType {
    Whitespace,
    Comment,
    String,
    AtKeyword,
    Word, // Identifier, Value, Number, Unit
    Colon,
    Semicolon,
    BraceOpen,
    BraceClose,
    ParenthesisOpen,
    ParenthesisClose,
    Comma,
    Operator, // >, +, ~, *, /, %, =, !
    Dot,
    Hash,
    Unknown
}

export interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
}

export function tokenize(text: string): Token[] {
    const tokens: Token[] = [];
    let current = 0;
    let line = 1;
    let column = 1;

    while (current < text.length) {
        const char = text[current];

        // Whitespace
        if (/\s/.test(char)) {
             let value = '';
             const startLine = line;
             const startColumn = column;
             while (current < text.length && /\s/.test(text[current])) {
                 if (text[current] === '\n') {
                     line++;
                     column = 1;
                 } else {
                     column++;
                 }
                 value += text[current];
                 current++;
             }
             tokens.push({ type: TokenType.Whitespace, value, line: startLine, column: startColumn });
             continue;
        }

        // Comment /* ... */
        if (char === '/' && text[current + 1] === '*') {
            let value = '/*';
            const startLine = line;
            const startColumn = column;
            current += 2;
            column += 2;

            while (current < text.length && !(text[current] === '*' && text[current + 1] === '/')) {
                if (text[current] === '\n') {
                    line++;
                    column = 1;
                } else {
                    column++;
                }
                value += text[current];
                current++;
            }

            if (current < text.length) {
                value += '*/';
                current += 2;
                column += 2;
            }

            tokens.push({ type: TokenType.Comment, value, line: startLine, column: startColumn });
            continue;
        }

        // String
        if (char === '"' || char === "'") {
            let value = char;
            const quote = char;
            const startLine = line;
            const startColumn = column;
            current++;
            column++;

            while (current < text.length && text[current] !== quote) {
                if (text[current] === '\\') {
                    value += text[current];
                    current++;
                    column++;
                    if (current < text.length) {
                        value += text[current];
                        if (text[current] === '\n') {
                            line++;
                            column = 1;
                        } else {
                            column++;
                        }
                        current++;
                    }
                    continue;
                }
                if (text[current] === '\n') {
                    line++;
                    column = 1;
                } else {
                    column++;
                }
                value += text[current];
                current++;
            }

            if (current < text.length) {
                value += quote;
                current++;
                column++;
            }

            tokens.push({ type: TokenType.String, value, line: startLine, column: startColumn });
            continue;
        }

        // AtKeyword
        if (char === '@') {
            let value = '@';
            const startLine = line;
            const startColumn = column;
            current++;
            column++;

            while (current < text.length && /[a-zA-Z0-9_-]/.test(text[current])) {
                value += text[current];
                current++;
                column++;
            }
            tokens.push({ type: TokenType.AtKeyword, value, line: startLine, column: startColumn });
            continue;
        }

        // Dot
        if (char === '.') {
            tokens.push({ type: TokenType.Dot, value: '.', line, column });
            current++; column++; continue;
        }

        // Hash
        if (char === '#') {
            tokens.push({ type: TokenType.Hash, value: '#', line, column });
            current++; column++; continue;
        }

        // Punctuation
        if (char === '{') { tokens.push({ type: TokenType.BraceOpen, value: '{', line, column }); current++; column++; continue; }
        if (char === '}') { tokens.push({ type: TokenType.BraceClose, value: '}', line, column }); current++; column++; continue; }
        if (char === ':') { tokens.push({ type: TokenType.Colon, value: ':', line, column }); current++; column++; continue; }
        if (char === ';') { tokens.push({ type: TokenType.Semicolon, value: ';', line, column }); current++; column++; continue; }
        if (char === '(') { tokens.push({ type: TokenType.ParenthesisOpen, value: '(', line, column }); current++; column++; continue; }
        if (char === ')') { tokens.push({ type: TokenType.ParenthesisClose, value: ')', line, column }); current++; column++; continue; }
        if (char === ',') { tokens.push({ type: TokenType.Comma, value: ',', line, column }); current++; column++; continue; }

        // Operators
        if (['>', '+', '~', '*', '/', '%', '=', '!'].includes(char)) {
            tokens.push({ type: TokenType.Operator, value: char, line, column });
            current++; column++; continue;
        }

        // Word (Alphanumeric + - _)
        if (/[a-zA-Z0-9_-]/.test(char)) {
            let value = '';
            const startLine = line;
            const startColumn = column;
            while (current < text.length && /[a-zA-Z0-9_-]/.test(text[current])) {
                value += text[current];
                current++;
                column++;
            }
            tokens.push({ type: TokenType.Word, value, line: startLine, column: startColumn });
            continue;
        }

        // Unknown
        tokens.push({ type: TokenType.Unknown, value: char, line, column });
        current++;
        column++;
    }

    return tokens;
}
