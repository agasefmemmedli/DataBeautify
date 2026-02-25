import { NginxTokenizer, TokenType, Token } from './nginx_tokenizer';

interface ExtendedToken extends Token {
    precededByWhitespace: boolean;
}

export function formatNginxDeep(text: string): string {
    const tokenizer = new NginxTokenizer(text);
    const rawTokens = tokenizer.tokenize();

    // Pre-process tokens to track whitespace adjacency
    const tokens: ExtendedToken[] = [];

    for (let i = 0; i < rawTokens.length; i++) {
        const t = rawTokens[i];
        if (t.type === TokenType.Whitespace) continue;

        const prev = i > 0 ? rawTokens[i-1] : null;
        // Check if previous token was whitespace
        const precededByWhitespace = prev ? prev.type === TokenType.Whitespace : false;

        tokens.push({ ...t, precededByWhitespace });
    }

    let formatted = '';
    let indentLevel = 0;
    const indentString = '    '; // 4 spaces

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const nextToken = i + 1 < tokens.length ? tokens[i + 1] : null;
        const prevToken = i > 0 ? tokens[i - 1] : null;

        // Check current state of formatted string
        const prevChar = formatted.length > 0 ? formatted[formatted.length - 1] : '';
        const isNewLine = prevChar === '\n' || formatted === '';

        // Handle Closing Brace '}'
        if (token.type === TokenType.Punctuation && token.text === '}') {
            indentLevel = Math.max(0, indentLevel - 1);
            if (!isNewLine) {
                 formatted += '\n';
            }
            // Check for blank lines preservation
            // If original code had blank lines before }, preserve?
            // Usually we compact inside blocks, but let's stick to standard indent.
            formatted += indentString.repeat(indentLevel) + '}';
            formatted += '\n';

            if (indentLevel === 0 && nextToken && nextToken.text !== '}') {
                 if (!formatted.endsWith('\n\n')) {
                     formatted += '\n';
                 }
            }
            continue;
        }

        // Handle Indentation for new lines
        if (isNewLine) {
            if (prevToken && token.line > prevToken.endLine + 1) {
                if (!formatted.endsWith('\n\n')) {
                    formatted += '\n';
                }
            }
            formatted += indentString.repeat(indentLevel);
        } else {
            // Handle spacing between tokens on same line
            const currentPrevChar = formatted.length > 0 ? formatted[formatted.length - 1] : '';

            if (token.type === TokenType.Punctuation && token.text === ';') {
                // No space before semicolon
            } else if ((token.type === TokenType.Punctuation && token.text === '{') || token.type === TokenType.LuaBlock) {
                // Space before opening brace/block ALWAYS
                if (currentPrevChar !== ' ') formatted += ' ';
            } else if (token.type === TokenType.Variable || token.type === TokenType.Word || token.type === TokenType.String || token.type === TokenType.Unknown) {
                // Use whitespace tracking
                if (token.precededByWhitespace && currentPrevChar !== ' ') {
                    formatted += ' ';
                }
            }
        }

        // Append Token Text
        formatted += token.text;

        // Post-Token Handling (Newlines)
        if (token.type === TokenType.LuaBlock) {
             formatted += '\n';
        } else if (token.type === TokenType.Punctuation && token.text === '{') {
            indentLevel++;
            formatted += '\n';
        } else if (token.type === TokenType.Punctuation && token.text === ';') {
            if (nextToken && nextToken.type === TokenType.Comment && nextToken.line === token.endLine) {
                 formatted += ' ';
            } else {
                formatted += '\n';
            }
        } else if (token.type === TokenType.Comment) {
            formatted += '\n';
        }
    }

    return formatted.replace(/\n\n\n+/g, '\n\n').trim() + '\n';
}
