
export type SCSSTokenType =
    | 'comment'
    | 'string'
    | 'brace_open'
    | 'brace_close'
    | 'paren_open'
    | 'paren_close'
    | 'bracket_open'
    | 'bracket_close'
    | 'semicolon'
    | 'colon'
    | 'comma'
    | 'at_keyword'
    | 'var'
    | 'word'
    | 'operator'
    | 'space'
    | 'interpolation_start'
    | 'interpolation_end'
    | 'unknown';

export interface SCSSToken {
    type: SCSSTokenType;
    value: string;
    line: number;
    col: number;
}

export function tokenizeSCSS(text: string): SCSSToken[] {
    const tokens: SCSSToken[] = [];
    let i = 0;
    let line = 1;
    let col = 1;

    while (i < text.length) {
        const char = text[i];
        const nextChar = text[i + 1];

        // Whitespace
        if (/\s/.test(char)) {
            let value = '';
            const startLine = line;
            const startCol = col;
            while (i < text.length && /\s/.test(text[i])) {
                if (text[i] === '\n') {
                    line++;
                    col = 1;
                } else {
                    col++;
                }
                value += text[i];
                i++;
            }
            tokens.push({ type: 'space', value, line: startLine, col: startCol });
            continue;
        }

        // Comments
        if (char === '/' && nextChar === '/') {
            let value = '//';
            const startLine = line;
            const startCol = col;
            i += 2;
            col += 2;
            while (i < text.length && text[i] !== '\n') {
                value += text[i];
                col++;
                i++;
            }
            tokens.push({ type: 'comment', value, line: startLine, col: startCol });
            continue;
        }

        if (char === '/' && nextChar === '*') {
            let value = '/*';
            const startLine = line;
            const startCol = col;
            i += 2;
            col += 2;
            while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
                if (text[i] === '\n') {
                    line++;
                    col = 1;
                } else {
                    col++;
                }
                value += text[i];
                i++;
            }
            if (i < text.length) {
                value += '*/';
                i += 2;
                col += 2;
            }
            tokens.push({ type: 'comment', value, line: startLine, col: startCol });
            continue;
        }

        // Strings
        if (char === '"' || char === "'") {
            let value = char;
            const startLine = line;
            const startCol = col;
            const quote = char;
            i++;
            col++;
            while (i < text.length) {
                const curr = text[i];
                if (curr === '\n') {
                    line++;
                    col = 1;
                } else {
                    col++;
                }
                value += curr;
                i++;
                if (curr === quote && text[i - 2] !== '\\') {
                    break;
                }
            }
            tokens.push({ type: 'string', value, line: startLine, col: startCol });
            continue;
        }

        // Interpolation Start #{
        if (char === '#' && nextChar === '{') {
            tokens.push({ type: 'interpolation_start', value: '#{', line, col });
            i += 2;
            col += 2;
            continue;
        }

        // Single Character Tokens
        if (char === '{') {
            tokens.push({ type: 'brace_open', value: '{', line, col });
            i++; col++; continue;
        }
        if (char === '}') {
            tokens.push({ type: 'brace_close', value: '}', line, col });
            i++; col++; continue;
        }
        if (char === '(') {
            tokens.push({ type: 'paren_open', value: '(', line, col });
            i++; col++; continue;
        }
        if (char === ')') {
            tokens.push({ type: 'paren_close', value: ')', line, col });
            i++; col++; continue;
        }
        if (char === '[') {
            tokens.push({ type: 'bracket_open', value: '[', line, col });
            i++; col++; continue;
        }
        if (char === ']') {
            tokens.push({ type: 'bracket_close', value: ']', line, col });
            i++; col++; continue;
        }
        if (char === ';') {
            tokens.push({ type: 'semicolon', value: ';', line, col });
            i++; col++; continue;
        }
        if (char === ':') {
            tokens.push({ type: 'colon', value: ':', line, col });
            i++; col++; continue;
        }
        if (char === ',') {
            tokens.push({ type: 'comma', value: ',', line, col });
            i++; col++; continue;
        }

        // Variables $var
        if (char === '$') {
            let value = '$';
            const startLine = line;
            const startCol = col;
            i++;
            col++;
            while (i < text.length && /[a-zA-Z0-9_-]/.test(text[i])) {
                value += text[i];
                col++;
                i++;
            }
            tokens.push({ type: 'var', value, line: startLine, col: startCol });
            continue;
        }

        // At-rules @import, @mixin
        if (char === '@') {
            let value = '@';
            const startLine = line;
            const startCol = col;
            i++;
            col++;
            while (i < text.length && /[a-zA-Z0-9_-]/.test(text[i])) {
                value += text[i];
                col++;
                i++;
            }
            tokens.push({ type: 'at_keyword', value, line: startLine, col: startCol });
            continue;
        }

        // Words (identifiers, numbers, units, etc.)
        if (/[a-zA-Z0-9_%-]/.test(char) || (char === '.' && /[a-zA-Z0-9_-]/.test(nextChar)) || (char === '#' && /[a-zA-Z0-9_-]/.test(nextChar))) {
            let value = '';
            const startLine = line;
            const startCol = col;

            // Check if it starts with . or #
            if (char === '.' || char === '#') {
                value += char;
                i++;
                col++;
            }

            while (i < text.length && /[a-zA-Z0-9_%-]/.test(text[i])) {
                value += text[i];
                col++;
                i++;
            }
            tokens.push({ type: 'word', value, line: startLine, col: startCol });
            continue;
        }

        // Operators
        if (/[+*\/=!<>&|]/.test(char) || char === '-') {
            // Handle negative numbers or subtraction?
            // If previous token was operator or space, maybe unary minus?
            // But here we just tokenize.
            tokens.push({ type: 'operator', value: char, line, col });
            i++;
            col++;
            continue;
        }

        // Unknown
        tokens.push({ type: 'unknown', value: char, line, col });
        i++;
        col++;
    }

    return tokens;
}
