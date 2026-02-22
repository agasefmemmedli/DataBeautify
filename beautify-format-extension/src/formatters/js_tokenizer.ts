
export type TokenType =
    | 'Whitespace'
    | 'LineComment'
    | 'BlockComment'
    | 'String'
    | 'Template' // Full template string or parts
    | 'Regex'
    | 'Keyword'
    | 'Identifier'
    | 'Number'
    | 'Operator'
    | 'Punctuation'
    | 'Decorator'
    | 'Unknown';

export interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
}

const KEYWORDS = new Set([
    'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
    'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof',
    'new', 'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while',
    'with', 'yield', 'let', 'static', 'enum', 'implements', 'interface', 'package', 'private',
    'protected', 'public', 'async', 'await', 'from', 'as', 'type', 'declare', 'namespace', 'abstract',
    'get', 'set', 'readonly', 'module', 'require', 'constructor'
]);

export function tokenize(text: string): Token[] {
    const tokens: Token[] = [];
    let line = 1;
    let column = 1;
    let pos = 0;
    const len = text.length;

    // Helper to add token
    const addToken = (type: TokenType, value: string) => {
        tokens.push({ type, value, line, column });
        const lines = value.split('\n');
        if (lines.length > 1) {
            line += lines.length - 1;
            column = lines[lines.length - 1].length + 1;
        } else {
            column += value.length;
        }
        pos += value.length;
    };

    while (pos < len) {
        const char = text[pos];

        // Whitespace
        if (/\s/.test(char)) {
            let value = char;
            let i = pos + 1;
            while (i < len && /\s/.test(text[i])) {
                value += text[i];
                i++;
            }
            addToken('Whitespace', value);
            continue;
        }

        // Comments
        if (char === '/') {
            if (text[pos + 1] === '/') {
                let value = '//';
                let i = pos + 2;
                while (i < len && text[i] !== '\n' && text[i] !== '\r') {
                    value += text[i];
                    i++;
                }
                addToken('LineComment', value);
                continue;
            } else if (text[pos + 1] === '*') {
                let value = '/*';
                let i = pos + 2;
                while (i < len) {
                    if (text[i] === '*' && text[i + 1] === '/') {
                        value += '*/';
                        break;
                    }
                    value += text[i];
                    i++;
                }
                addToken('BlockComment', value);
                continue;
            }
        }

        // Strings
        if (char === "'" || char === '"') {
            let value = char;
            let i = pos + 1;
            while (i < len) {
                if (text[i] === '\\') {
                    value += text[i];
                    if (i + 1 < len) {
                        value += text[i + 1];
                        i += 2;
                        continue;
                    }
                }
                value += text[i];
                if (text[i] === char) {
                    break;
                }
                i++;
            }
            addToken('String', value);
            continue;
        }

        // Template Literals (Basic handling - treats whole string as one token if possible, or handles parts)
        // For deep formatting, simply tokenizing the backtick content is often enough if we don't need to format *inside* the template expressions deeply right now.
        // But strict parsing would require recursing.
        // For resilience, let's treat it like a string but allow ${...} to be part of it?
        // No, if we want to format code inside ${...}, we need to break it out.
        // But for a tokenizer, maybe just treating it as a string is safer for now to avoid complexity?
        // Let's try to handle it as a single token for now to ensure we don't break simple cases.
        if (char === '`') {
             let value = char;
            let i = pos + 1;
            while (i < len) {
                if (text[i] === '\\') {
                    value += text[i];
                    if (i + 1 < len) {
                        value += text[i + 1];
                        i += 2;
                        continue;
                    }
                }
                value += text[i];
                if (text[i] === '`') {
                    break;
                }
                // TODO: Handle ${...} properly if we want deep formatting inside.
                // For now, we just consume it.
                i++;
            }
            addToken('Template', value);
            continue;
        }

        // Regex Literals
        // Heuristic: if previous token was keyword, punctuation (except ) and ]), or operator
        if (char === '/') {
            const lastToken = tokens.filter(t => t.type !== 'Whitespace' && t.type !== 'LineComment' && t.type !== 'BlockComment').pop();
            const isDivision = lastToken && (
                lastToken.type === 'Identifier' ||
                lastToken.type === 'Number' ||
                lastToken.type === 'String' ||
                lastToken.type === 'Template' ||
                (lastToken.type === 'Punctuation' && (lastToken.value === ')' || lastToken.value === ']'))
            );

            if (!isDivision) {
                let value = char;
                let i = pos + 1;
                let inClass = false;
                while (i < len) {
                    if (text[i] === '\\') {
                        value += text[i];
                        if (i + 1 < len) {
                            value += text[i + 1];
                            i += 2;
                            continue;
                        }
                    }
                    if (text[i] === '[') inClass = true;
                    if (text[i] === ']') inClass = false;

                    value += text[i];
                    if (text[i] === '/' && !inClass) {
                        // Check flags
                        i++;
                        while (i < len && /[a-zA-Z]/.test(text[i])) {
                            value += text[i];
                            i++;
                        }
                        // Adjust back since addToken adds length
                        // Wait, addToken advances pos by value.length.
                        // So I need to stop loop here.
                        break;
                    }
                    i++;
                }
                addToken('Regex', value);
                continue;
            } else {
                addToken('Operator', '/');
                continue;
            }
        }

        // Numbers
        if (/[0-9]/.test(char)) {
            let value = char;
            let i = pos + 1;
            // Hex
            if (char === '0' && (text[i] === 'x' || text[i] === 'X')) {
                value += text[i];
                i++;
                while (i < len && /[0-9a-fA-F]/.test(text[i])) {
                    value += text[i];
                    i++;
                }
            } else {
                while (i < len && /[0-9.]/.test(text[i])) {
                     // Handle multiple dots? Just consume for now.
                    value += text[i];
                    i++;
                }
            }
            addToken('Number', value);
            continue;
        }

        // Identifiers and Keywords
        if (/[a-zA-Z_$]/.test(char)) {
            let value = char;
            let i = pos + 1;
            while (i < len && /[a-zA-Z0-9_$]/.test(text[i])) {
                value += text[i];
                i++;
            }
            if (KEYWORDS.has(value)) {
                addToken('Keyword', value);
            } else {
                addToken('Identifier', value);
            }
            continue;
        }

        // Decorators
        if (char === '@') {
            addToken('Decorator', '@');
            continue;
        }

        // Operators
        if (/[+\-*/%=&|<>!^~?]/.test(char)) {
            // Check for multi-char operators
            let value = char;
            let i = pos + 1;
            const next = text[i];
            const next2 = text[i+1];

            if (
                (char === '=' && next === '>') || // =>
                (char === '?' && next === '.') || // ?.
                (char === '?' && next === '?') || // ??
                (char === '+' && next === '+') || // ++
                (char === '-' && next === '-') || // --
                (char === '&' && next === '&') || // &&
                (char === '|' && next === '|') || // ||
                (char === '<' && next === '=') || // <=
                (char === '>' && next === '=') || // >=
                (char === '=' && next === '=') || // ==
                (char === '!' && next === '=') || // !=
                (char === '*' && next === '*') || // **
                (char === '<' && next === '<') || // <<
                (char === '>' && next === '>')    // >>
            ) {
                value += next;
                if (text[i+1] === '=') { // ===, !==, <<=, >>=, **=
                     value += text[i+1];
                }
                 addToken('Operator', value);
                 continue;
            }

            // Handle ===, !== checked above partially
             if ((char === '=' || char === '!') && next === '=' && next2 === '=') {
                 value = char + '==';
                 addToken('Operator', value);
                 continue;
             }

            addToken('Operator', char);
            continue;
        }

        // Punctuation
        if (/[(){}\[\],:;.]/.test(char)) {
            addToken('Punctuation', char);
            continue;
        }

        // Unknown
        addToken('Unknown', char);
    }

    return tokens;
}
