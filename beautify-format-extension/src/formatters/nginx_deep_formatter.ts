import { NginxTokenizer, TokenType, Token } from './nginx_tokenizer';

export function formatNginxDeep(text: string): string {
    const tokenizer = new NginxTokenizer(text);
    const rawTokens = tokenizer.tokenize();

    // Filter out whitespace tokens but keep them for reference if needed?
    // Actually we just need non-whitespace tokens
    const tokens = rawTokens.filter(t => t.type !== TokenType.Whitespace);

    let formatted = '';
    let indentLevel = 0;
    const indentString = '    '; // 4 spaces

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const nextToken = i + 1 < tokens.length ? tokens[i + 1] : null; // Next significant token
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
            formatted += indentString.repeat(indentLevel) + '}';
            formatted += '\n';

            // Add blank line after block if followed by another block or word (not another closing brace)
            // But we can also check line gap.
            // If original had blank line, preserve it?
            // "Deep Formatting" often enforces blank lines between top-level blocks.
            // Let's enforce it if we are at indentLevel 0.
            if (indentLevel === 0 && nextToken && nextToken.text !== '}') {
                 formatted += '\n';
            }
            continue;
        }

        // Handle Indentation for new lines
        if (isNewLine) {
            // Check for blank lines preservation using endLine
            if (prevToken && token.line > prevToken.endLine + 1) {
                if (!formatted.endsWith('\n\n')) {
                    formatted += '\n';
                }
            }
            formatted += indentString.repeat(indentLevel);
        } else {
            // Handle spacing between tokens on same line
            if (token.type === TokenType.Punctuation && token.text === ';') {
                // No space before semicolon
            } else if (token.type === TokenType.Punctuation && token.text === '{') {
                // Space before opening brace
                if (prevChar !== ' ') formatted += ' ';
            } else {
                // Default space between words/values
                // But avoid double spaces if prevChar is space
                if (prevChar !== ' ') formatted += ' ';
            }
        }

        // Append Token Text
        formatted += token.text;

        // Post-Token Handling (Newlines)
        if (token.type === TokenType.Punctuation && token.text === '{') {
            indentLevel++;
            formatted += '\n';
        } else if (token.type === TokenType.Punctuation && token.text === ';') {
            // Check if next token is a comment on the same line
            if (nextToken && nextToken.type === TokenType.Comment && nextToken.line === token.endLine) {
                 formatted += ' ';
            } else {
                formatted += '\n';
            }
        } else if (token.type === TokenType.Comment) {
            formatted += '\n';
        }
    }

    // Post-processing to clean up excessive newlines
    return formatted.replace(/\n\n\n+/g, '\n\n').trim() + '\n';
}
