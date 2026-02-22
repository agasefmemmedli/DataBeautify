export interface Token {
    type: 'Section' | 'Key' | 'Value' | 'Comment' | 'Whitespace' | 'Operator';
    value: string;
    line: number;
    column: number;
}

export function tokenizeGitConfig(text: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    let line = 0;
    let column = 0;

    while (i < text.length) {
        const char = text[i];

        // Whitespace
        if (/\s/.test(char)) {
            let value = '';
            const startLine = line;
            const startCol = column;
            while (i < text.length && /\s/.test(text[i])) {
                const c = text[i];
                if (c === '\n') {
                    line++;
                    column = 0;
                } else {
                    column++;
                }
                value += c;
                i++;
            }
            tokens.push({ type: 'Whitespace', value, line: startLine, column: startCol });
            continue;
        }

        // Comment
        if (char === '#' || char === ';') {
            let value = '';
            const startLine = line;
            const startCol = column;
            while (i < text.length) {
                const c = text[i];
                if (c === '\n' || c === '\r') break;
                value += c;
                column++;
                i++;
            }
            tokens.push({ type: 'Comment', value, line: startLine, column: startCol });
            continue;
        }

        // Section
        if (char === '[') {
            let value = '';
            const startLine = line;
            const startCol = column;

            // Read until ] but respect quotes and escapes
            let inQuote = false;
            let escaped = false;

            while (i < text.length) {
                const c = text[i];

                // Break on newline (error recovery)
                if (c === '\n' || c === '\r') break;

                value += c;
                column++;
                i++;

                if (escaped) {
                    escaped = false;
                    continue;
                }
                if (c === '\\') {
                    escaped = true;
                    continue;
                }
                if (c === '"') {
                    inQuote = !inQuote;
                    continue;
                }
                if (!inQuote && c === ']') {
                    break;
                }
            }
            tokens.push({ type: 'Section', value, line: startLine, column: startCol });
            continue;
        }

        // Operator
        if (char === '=') {
            tokens.push({ type: 'Operator', value: '=', line, column });
            column++;
            i++;
            continue;
        }

        // Key or Value?
        let lastSigToken: Token | null = null;
        for (let j = tokens.length - 1; j >= 0; j--) {
            if (tokens[j].type !== 'Whitespace' && tokens[j].type !== 'Comment') {
                lastSigToken = tokens[j];
                break;
            }
        }

        // Determine if we crossed a newline since last significant token
        let sawNewline = false;
        const endSearchIdx = lastSigToken ? tokens.indexOf(lastSigToken) : -1;

        for (let j = tokens.length - 1; j > endSearchIdx; j--) {
            if (tokens[j].type === 'Whitespace' && tokens[j].value.includes('\n')) {
                sawNewline = true;
                break;
            }
        }

        let isKey = false;
        if (!lastSigToken || lastSigToken.type === 'Section' || lastSigToken.type === 'Value') {
            isKey = true;
        } else if (lastSigToken.type === 'Key') {
            if (sawNewline) {
                isKey = true; // Boolean key followed by new key
            } else {
                // Invalid syntax or key continuation? Assume new key for recovery
                isKey = true;
            }
        } else if (lastSigToken.type === 'Operator') {
            if (sawNewline) {
                isKey = true; // Empty value (implicit) followed by new key
            } else {
                isKey = false; // Value part
            }
        }

        if (isKey) {
            let value = '';
            const startLine = line;
            const startCol = column;
            while (i < text.length) {
                const c = text[i];
                // Allow underscore for resilience, although not strictly standard
                if (!/[a-zA-Z0-9-_]/.test(c)) {
                    break;
                }
                value += c;
                column++;
                i++;
            }
            // If value is empty (e.g. hit a special char immediately), consume one char to avoid loop
            if (value === '') {
                 // But wait, if we are here, char is NOT whitespace, #, ;, [, =.
                 // So it must be some other char.
                 // If it's not alphanumeric, we consume it as part of Key?
                 // Or just skip it?
                 // Let's treat it as part of Key for robustness.
                 value += text[i];
                 column++;
                 i++;
            }
            tokens.push({ type: 'Key', value, line: startLine, column: startCol });
        } else {
            // Value
            let value = '';
            const startLine = line;
            const startCol = column;
            let inQuote = false;
            let escaped = false;

            while (i < text.length) {
                const c = text[i];

                if (escaped) {
                    escaped = false;
                    value += c;
                    if (c === '\n') {
                        line++;
                        column = 0;
                    } else {
                        column++;
                    }
                    i++;
                    continue;
                }

                if (c === '\\') {
                    escaped = true;
                    value += c;
                    column++;
                    i++;
                    continue;
                }

                if (c === '"') {
                    inQuote = !inQuote;
                    value += c;
                    column++;
                    i++;
                    continue;
                }

                if (!inQuote) {
                    if (c === '#' || c === ';') {
                        break;
                    }
                    if (c === '\n' || c === '\r') {
                        break;
                    }
                }

                if (c === '\n') {
                    line++;
                    column = 0;
                } else {
                    column++;
                }
                value += c;
                i++;
            }
            tokens.push({ type: 'Value', value, line: startLine, column: startCol });
        }
    }

    return tokens;
}
