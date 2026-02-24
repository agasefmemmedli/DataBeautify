export type TokenType =
    | 'WHITESPACE'
    | 'COMMENT'
    | 'BLOCK_COMMENT'
    | 'STRING'
    | 'MULTILINE_STRING'
    | 'KEYWORD'
    | 'IDENTIFIER'
    | 'NUMBER'
    | 'OPERATOR'
    | 'PUNCTUATION'
    | 'ANNOTATION'
    | 'UNKNOWN';

export interface Token {
    type: TokenType;
    value: string;
    line: number;
    col: number;
}

const KEYWORDS = new Set([
    'as', 'break', 'class', 'continue', 'do', 'else', 'false', 'for', 'fun', 'if', 'in', 'interface', 'is', 'null', 'object', 'package', 'return', 'super', 'this', 'throw', 'true', 'try', 'typealias', 'val', 'var', 'when', 'while',
    'by', 'catch', 'constructor', 'delegate', 'dynamic', 'field', 'file', 'finally', 'get', 'import', 'init', 'param', 'property', 'receiver', 'set', 'setparam', 'where',
    'actual', 'abstract', 'annotation', 'companion', 'const', 'crossinline', 'data', 'enum', 'expect', 'external', 'final', 'infix', 'inline', 'inner', 'internal', 'lateinit', 'noinline', 'open', 'operator', 'out', 'override', 'private', 'protected', 'public', 'reified', 'sealed', 'suspend', 'tailrec', 'vararg',
    'it' // Implicit lambda parameter
]);

const OPERATORS = new Set([
    '+', '-', '*', '/', '%', '=', '+=', '-=', '*=', '/=', '%=',
    '++', '--', '&&', '||', '!', '==', '!=', '===', '!==',
    '<', '>', '<=', '>=', '!!', '?.', '?:', '::', '..', '->',
    'as?', 'in', '!in', 'is', '!is', '?'
]);

export function tokenize(text: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    let line = 1;
    let col = 1;

    while (i < text.length) {
        const char = text[i];

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
            tokens.push({ type: 'WHITESPACE', value, line: startLine, col: startCol });
            continue;
        }

        // Comments
        if (char === '/' && text[i + 1] === '/') {
            let value = '';
            const startLine = line;
            const startCol = col;

            while (i < text.length && text[i] !== '\n') {
                value += text[i];
                col++;
                i++;
            }
            tokens.push({ type: 'COMMENT', value, line: startLine, col: startCol });
            continue;
        }

        if (char === '/' && text[i + 1] === '*') {
            let value = '';
            const startLine = line;
            const startCol = col;

            value += '/*';
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

            tokens.push({ type: 'BLOCK_COMMENT', value, line: startLine, col: startCol });
            continue;
        }

        // Strings
        if (char === '"') {
            const startLine = line;
            const startCol = col;

            // Triple quote
            if (text[i + 1] === '"' && text[i + 2] === '"') {
                let value = '"""';
                i += 3;
                col += 3;

                while (i < text.length && !(text[i] === '"' && text[i + 1] === '"' && text[i + 2] === '"')) {
                    if (text[i] === '\n') {
                        line++;
                        col = 1;
                    } else {
                        col++;
                    }
                    // Kotlin raw strings do not support escaping, but we need to handle $ if we wanted to be strict about templates
                    // For tokenizer purposes, we just consume characters.
                    // Note: Raw strings CAN contain " as long as it's not """.

                    value += text[i];
                    i++;
                }

                if (i < text.length) {
                    value += '"""';
                    i += 3;
                    col += 3;
                }
                tokens.push({ type: 'MULTILINE_STRING', value, line: startLine, col: startCol });
                continue;
            } else {
                // Regular string
                let value = '"';
                i++;
                col++;

                while (i < text.length) {
                    if (text[i] === '"' && text[i - 1] !== '\\') {
                        break;
                    }
                    if (text[i] === '\n') {
                        // Kotlin doesn't allow unescaped newlines in single-line strings usually, but let's be robust
                        line++;
                        col = 1;
                    } else {
                        col++;
                    }

                    if (text[i] === '\\') {
                         value += text[i];
                         i++;
                         col++;
                    }
                    if (i < text.length) {
                        value += text[i];
                        i++;
                    }
                }

                if (i < text.length) {
                    value += '"';
                    i++;
                    col++;
                }
                tokens.push({ type: 'STRING', value, line: startLine, col: startCol });
                continue;
            }
        }

        // Chars
        if (char === "'") {
            let value = "'";
            const startLine = line;
            const startCol = col;
            i++;
            col++;

            while (i < text.length) {
                if (text[i] === "'" && text[i - 1] !== '\\') {
                    break;
                }
                value += text[i];
                col++;
                i++;
            }

            if (i < text.length) {
                value += "'";
                i++;
                col++;
            }
            tokens.push({ type: 'STRING', value, line: startLine, col: startCol });
            continue;
        }

        // Annotations
        if (char === '@') {
            let value = '@';
            const startLine = line;
            const startCol = col;
            i++;
            col++;

            // Read identifier
            if (/[a-zA-Z_]/.test(text[i])) {
                while (i < text.length && /[a-zA-Z0-9_]/.test(text[i])) {
                    value += text[i];
                    i++;
                    col++;
                }
                // Optional target (e.g. @field:Annotation)
                if (text[i] === ':') {
                    value += ':';
                    i++;
                    col++;
                    while (i < text.length && /[a-zA-Z0-9_]/.test(text[i])) {
                        value += text[i];
                        i++;
                        col++;
                    }
                }
                tokens.push({ type: 'ANNOTATION', value, line: startLine, col: startCol });
                continue;
            } else {
                tokens.push({ type: 'PUNCTUATION', value: '@', line: startLine, col: startCol });
                continue;
            }
        }

        // Numbers
        if (/[0-9]/.test(char)) {
            let value = '';
            const startLine = line;
            const startCol = col;

            // Hex
            if (char === '0' && (text[i + 1] === 'x' || text[i + 1] === 'X')) {
                value += text[i] + text[i + 1];
                i += 2;
                col += 2;
                while (i < text.length && /[0-9a-fA-F_]/.test(text[i])) {
                    value += text[i];
                    i++;
                    col++;
                }
            } else if (char === '0' && (text[i + 1] === 'b' || text[i + 1] === 'B')) {
                // Binary
                value += text[i] + text[i + 1];
                i += 2;
                col += 2;
                while (i < text.length && /[0-1_]/.test(text[i])) {
                    value += text[i];
                    i++;
                    col++;
                }
            } else {
                // Decimal / Float
                while (i < text.length && /[0-9_]/.test(text[i])) {
                    value += text[i];
                    i++;
                    col++;
                }
                if (text[i] === '.' && /[0-9]/.test(text[i + 1])) {
                    value += '.';
                    i++;
                    col++;
                    while (i < text.length && /[0-9_]/.test(text[i])) {
                        value += text[i];
                        i++;
                        col++;
                    }
                }
                // Exponent
                if ((text[i] === 'e' || text[i] === 'E') && /[0-9+\-]/.test(text[i + 1])) {
                    value += text[i];
                    i++;
                    col++;
                    if (text[i] === '+' || text[i] === '-') {
                        value += text[i];
                        i++;
                        col++;
                    }
                    while (i < text.length && /[0-9_]/.test(text[i])) {
                        value += text[i];
                        i++;
                        col++;
                    }
                }
                // Suffix
                if (/[fFlL]/.test(text[i])) {
                    value += text[i];
                    i++;
                    col++;
                }
            }
            tokens.push({ type: 'NUMBER', value, line: startLine, col: startCol });
            continue;
        }

        // Identifiers and Keywords
        if (/[a-zA-Z_]/.test(char) || (char === '`' && /[a-zA-Z_]/.test(text[i+1]))) {
            let value = '';
            const startLine = line;
            const startCol = col;

            // Backtick identifier
            if (char === '`') {
                value += '`';
                i++;
                col++;
                while (i < text.length && text[i] !== '`') {
                    value += text[i];
                    i++;
                    col++;
                }
                if (i < text.length) {
                    value += '`';
                    i++;
                    col++;
                }
                tokens.push({ type: 'IDENTIFIER', value, line: startLine, col: startCol });
                continue;
            }

            while (i < text.length && /[a-zA-Z0-9_]/.test(text[i])) {
                value += text[i];
                i++;
                col++;
            }

            if (KEYWORDS.has(value)) {
                tokens.push({ type: 'KEYWORD', value, line: startLine, col: startCol });
            } else {
                tokens.push({ type: 'IDENTIFIER', value, line: startLine, col: startCol });
            }
            continue;
        }

        // Operators and Punctuation
        const startLine = line;
        const startCol = col;

        // 3-char operators
        const threeChar = text.substring(i, i + 3);
        if (OPERATORS.has(threeChar)) {
            tokens.push({ type: 'OPERATOR', value: threeChar, line: startLine, col: startCol });
            i += 3;
            col += 3;
            continue;
        }

        // 2-char operators
        const twoChar = text.substring(i, i + 2);
        if (OPERATORS.has(twoChar)) {
            tokens.push({ type: 'OPERATOR', value: twoChar, line: startLine, col: startCol });
            i += 2;
            col += 2;
            continue;
        }

        // 1-char operators
        if (OPERATORS.has(char)) {
            tokens.push({ type: 'OPERATOR', value: char, line: startLine, col: startCol });
            i++;
            col++;
            continue;
        }

        // Punctuation
        if ('{}()[],;:.'.includes(char)) {
            tokens.push({ type: 'PUNCTUATION', value: char, line: startLine, col: startCol });
            i++;
            col++;
            continue;
        }

        // Unknown
        tokens.push({ type: 'UNKNOWN', value: char, line: startLine, col: startCol });
        i++;
        col++;
    }

    return tokens;
}
