export enum TokenType {
    Whitespace,
    Comment,
    String,
    Attribute, // @...
    BlockAttribute, // @@...
    Keyword, // model, enum, etc.
    Identifier,
    BraceOpen,
    BraceClose,
    ParenOpen,
    ParenClose,
    BracketOpen,
    BracketClose,
    Equals,
    Colon,
    Comma,
    QuestionMark,
    Dot,
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

        // Comment // or ///
        if (char === '/' && text[current + 1] === '/') {
            let value = '';
            const startLine = line;
            const startColumn = column;
            while (current < text.length && text[current] !== '\n') {
                value += text[current];
                current++;
                column++;
            }
            tokens.push({ type: TokenType.Comment, value, line: startLine, column: startColumn });
            continue;
        }

        // String "..."
        if (char === '"') {
            let value = '"';
            const startLine = line;
            const startColumn = column;
            current++;
            column++;
            while (current < text.length && text[current] !== '"') {
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
                value += '"';
                current++;
                column++;
            }
            tokens.push({ type: TokenType.String, value, line: startLine, column: startColumn });
            continue;
        }

        // Attributes @ and @@
        if (char === '@') {
            let value = '@';
            const startLine = line;
            const startColumn = column;
            current++;
            column++;
            if (text[current] === '@') {
                value += '@';
                current++;
                column++;
                // Block Attribute @@id
                 while (current < text.length && /[a-zA-Z0-9_\.]/.test(text[current])) {
                    value += text[current];
                    current++;
                    column++;
                }
                tokens.push({ type: TokenType.BlockAttribute, value, line: startLine, column: startColumn });
            } else {
                // Regular Attribute @id
                 while (current < text.length && /[a-zA-Z0-9_\.]/.test(text[current])) {
                    value += text[current];
                    current++;
                    column++;
                }
                tokens.push({ type: TokenType.Attribute, value, line: startLine, column: startColumn });
            }
            continue;
        }

        // Punctuation
        if (char === '{') { tokens.push({ type: TokenType.BraceOpen, value: '{', line, column }); current++; column++; continue; }
        if (char === '}') { tokens.push({ type: TokenType.BraceClose, value: '}', line, column }); current++; column++; continue; }
        if (char === '(') { tokens.push({ type: TokenType.ParenOpen, value: '(', line, column }); current++; column++; continue; }
        if (char === ')') { tokens.push({ type: TokenType.ParenClose, value: ')', line, column }); current++; column++; continue; }
        if (char === '[') { tokens.push({ type: TokenType.BracketOpen, value: '[', line, column }); current++; column++; continue; }
        if (char === ']') { tokens.push({ type: TokenType.BracketClose, value: ']', line, column }); current++; column++; continue; }
        if (char === '=') { tokens.push({ type: TokenType.Equals, value: '=', line, column }); current++; column++; continue; }
        if (char === ':') { tokens.push({ type: TokenType.Colon, value: ':', line, column }); current++; column++; continue; }
        if (char === ',') { tokens.push({ type: TokenType.Comma, value: ',', line, column }); current++; column++; continue; }
        if (char === '.') { tokens.push({ type: TokenType.Dot, value: '.', line, column }); current++; column++; continue; }
        if (char === '?') { tokens.push({ type: TokenType.QuestionMark, value: '?', line, column }); current++; column++; continue; }

        // Identifier / Keyword
        if (/[a-zA-Z0-9_]/.test(char)) {
            let value = '';
            const startLine = line;
            const startColumn = column;
            while (current < text.length && /[a-zA-Z0-9_]/.test(text[current])) {
                value += text[current];
                current++;
                column++;
            }
            // Check keywords
            const keywords = ['model', 'enum', 'type', 'datasource', 'generator'];
            if (keywords.includes(value)) {
                tokens.push({ type: TokenType.Keyword, value, line: startLine, column: startColumn });
            } else {
                tokens.push({ type: TokenType.Identifier, value, line: startLine, column: startColumn });
            }
            continue;
        }

        // Unknown
        tokens.push({ type: TokenType.Unknown, value: char, line, column });
        current++;
        column++;
    }
    return tokens;
}
