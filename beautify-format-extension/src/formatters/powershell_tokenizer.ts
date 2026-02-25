export interface Token {
    type: 'Comment' | 'String' | 'Variable' | 'Operator' | 'Keyword' | 'Punctuation' | 'Whitespace' | 'Identifier' | 'Unknown';
    value: string;
    line: number;
    col: number;
}

export function tokenize(text: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    let line = 1;
    let col = 1;

    const keywords = new Set([
        'if', 'else', 'elseif', 'foreach', 'for', 'while', 'do', 'until', 'switch',
        'function', 'filter', 'workflow', 'class', 'enum', 'configuration',
        'try', 'catch', 'finally', 'throw', 'return', 'break', 'continue', 'exit',
        'in', 'data', 'dynamicparam', 'param', 'begin', 'process', 'end',
        'trap', 'using', 'assembly', 'command', 'module', 'namespace', 'type'
    ]);

    const operators = new Set([
        '-eq', '-ne', '-gt', '-ge', '-lt', '-le', '-like', '-notlike', '-match', '-notmatch',
        '-contains', '-notcontains', '-in', '-notin', '-replace', '-split', '-join', '-is', '-isnot',
        '-as', '-and', '-or', '-xor', '-not', '-band', '-bor', '-bxor', '-bnot',
        '-f', '-c', '-i', '-ieq', '-ine', '-igt', '-ige', '-ilt', '-ile', '-ilike', '-inotlike',
        '-imatch', '-inotmatch', '-icontains', '-inotcontains', '-iin', '-inotin', '-ireplace', '-isplit',
        '-ceq', '-cne', '-cgt', '-cge', '-clt', '-cle', '-clike', '-cnotlike', '-cmatch', '-cnotmatch',
        '-ccontains', '-cnotcontains', '-cin', '-cnotin', '-creplace', '-csplit'
    ]);

    while (i < text.length) {
        const char = text[i];
        const nextChar = text[i + 1];

        // Whitespace
        if (/\s/.test(char)) {
            let value = '';
            const startCol = col;
            while (i < text.length && /\s/.test(text[i])) {
                if (text[i] === '\n') {
                    line++;
                    col = 0;
                }
                value += text[i];
                col++;
                i++;
            }
            tokens.push({ type: 'Whitespace', value, line, col: startCol });
            continue;
        }

        // Comments
        if (char === '#') {
            let value = '';
            const startCol = col;
            while (i < text.length && text[i] !== '\n') {
                value += text[i];
                col++;
                i++;
            }
            tokens.push({ type: 'Comment', value, line, col: startCol });
            continue;
        }

        if (char === '<' && nextChar === '#') {
            let value = '<#';
            const startCol = col;
            i += 2;
            col += 2;
            while (i < text.length) {
                if (text[i] === '#' && text[i + 1] === '>') {
                    value += '#>';
                    i += 2;
                    col += 2;
                    break;
                }
                if (text[i] === '\n') {
                    line++;
                    col = 0;
                }
                value += text[i];
                col++;
                i++;
            }
            tokens.push({ type: 'Comment', value, line, col: startCol });
            continue;
        }

        // Variables
        if (char === '$') {
            let value = '$';
            const startCol = col;
            i++;
            col++;

            if (text[i] === '{') {
                // Scoped variable ${env:path}
                while (i < text.length) {
                    value += text[i];
                    col++;
                    i++;
                    if (text[i - 1] === '}') break;
                }
            } else {
                // Regular variable $var
                while (i < text.length && /[a-zA-Z0-9_?^:]/.test(text[i])) {
                    value += text[i];
                    col++;
                    i++;
                }
            }
            tokens.push({ type: 'Variable', value, line, col: startCol });
            continue;
        }

        // Strings
        // Here-Strings check must come before regular strings
        if (char === '@' && (nextChar === '"' || nextChar === "'")) {
            // Check for Here-String Start
            // Here-String must be followed by newline (or carriage return) immediately?
            // Actually, syntax is @' <newline> ... <newline> '@
            // But strict parser requires check for newline.
            // We'll be lenient and treat it as String if it looks like one.

            const quote = nextChar;
            let value = '@' + quote;
            const startCol = col;
            i += 2;
            col += 2;

            // Find end: newline + quote + @
            while (i < text.length) {
                const c = text[i];
                if (c === '\n') {
                    line++;
                    col = 0;
                }
                value += c;

                if (value.endsWith('\n' + quote + '@') || value.endsWith('\r' + quote + '@')) {
                     col++;
                     i++;
                     break;
                }
                col++;
                i++;
            }
            tokens.push({ type: 'String', value, line, col: startCol });
            continue;
        }

        if (char === '"') {
            let value = '"';
            const startCol = col;
            i++;
            col++;
            while (i < text.length) {
                if (text[i] === '`') { // Escape
                     value += text[i];
                     col++;
                     i++;
                     if (i < text.length) {
                         value += text[i];
                         col++;
                         i++;
                     }
                     continue;
                }
                if (text[i] === '"') {
                    value += '"';
                    col++;
                    i++;
                    break;
                }
                if (text[i] === '\n') {
                    line++;
                    col = 0;
                }
                value += text[i];
                col++;
                i++;
            }
            tokens.push({ type: 'String', value, line, col: startCol });
            continue;
        }

        if (char === "'") {
            let value = "'";
            const startCol = col;
            i++;
            col++;
            while (i < text.length) {
                if (text[i] === "'") {
                    if (text[i+1] === "'") { // Escaped single quote
                        value += "''";
                        col += 2;
                        i += 2;
                        continue;
                    }
                    value += "'";
                    col++;
                    i++;
                    break;
                }
                if (text[i] === '\n') {
                    line++;
                    col = 0;
                }
                value += text[i];
                col++;
                i++;
            }
            tokens.push({ type: 'String', value, line, col: startCol });
            continue;
        }

        // Operators (starting with -)
        if (char === '-' && /[a-zA-Z]/.test(nextChar)) {
             let value = '-';
             const startCol = col;
             i++;
             col++;
             while (i < text.length && /[a-zA-Z]/.test(text[i])) {
                 value += text[i];
                 col++;
                 i++;
             }
             // Check if it's a known operator or just a parameter
             if (operators.has(value.toLowerCase())) {
                 tokens.push({ type: 'Operator', value, line, col: startCol });
             } else {
                 // Parameter
                 tokens.push({ type: 'Identifier', value, line, col: startCol });
             }
             continue;
        }

        // Dot / Range / Static
        if (char === '.') {
            if (nextChar === '.') {
                tokens.push({ type: 'Operator', value: '..', line, col });
                i += 2;
                col += 2;
            } else {
                tokens.push({ type: 'Operator', value: '.', line, col });
                i++;
                col++;
            }
            continue;
        }

        if (char === ':') {
            if (nextChar === ':') {
                tokens.push({ type: 'Operator', value: '::', line, col });
                i += 2;
                col += 2;
            } else {
                tokens.push({ type: 'Punctuation', value: ':', line, col });
                i++;
                col++;
            }
            continue;
        }

        // Punctuation / Single Char Operators
        if (/[(){}\[\],;]/.test(char)) {
            tokens.push({ type: 'Punctuation', value: char, line, col });
            i++;
            col++;
            continue;
        }

        // Other Operators
        // Handle % and ? specially as Alias/Identifier if standalone?
        // Actually, let's treat % as Operator for now (consistent with |), but ? as Identifier/Alias.

        if (char === '?' && !/[a-zA-Z0-9_]/.test(nextChar)) {
             // Alias for Where-Object
             tokens.push({ type: 'Identifier', value: '?', line, col });
             i++;
             col++;
             continue;
        }

        if (char === '%' && !/[a-zA-Z0-9_]/.test(nextChar)) {
             // Alias for ForEach-Object
             // Treat as Identifier so it behaves like command
             tokens.push({ type: 'Identifier', value: '%', line, col });
             i++;
             col++;
             continue;
        }

        if (/[|+=*/!&\-]/.test(char)) {
             let value = char;
             const startCol = col;
             i++;
             col++;

             // Check for multi-char ops: +=, -=, *=, /=, %=, ++, --
             if (/[=+-]/.test(text[i])) {
                  value += text[i];
                  i++;
                  col++;
             }
             tokens.push({ type: 'Operator', value, line, col: startCol });
             continue;
        }

        // Identifiers / Keywords
        if (/[a-zA-Z0-9_]/.test(char)) {
            let value = '';
            const startCol = col;
            while (i < text.length && /[a-zA-Z0-9_\-]/.test(text[i])) {
                value += text[i];
                col++;
                i++;
            }
            if (keywords.has(value.toLowerCase())) {
                tokens.push({ type: 'Keyword', value, line, col: startCol });
            } else {
                tokens.push({ type: 'Identifier', value, line, col: startCol });
            }
            continue;
        }

        // Unknown
        tokens.push({ type: 'Unknown', value: char, line, col });
        i++;
        col++;
    }

    return tokens;
}
