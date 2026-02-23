import { tokenize, Token, TokenType } from './kotlin_tokenizer';

interface KotlinFormatterOptions {
    indentSize?: number;
    printWidth?: number;
}

export function formatKotlinDeep(text: string, options: KotlinFormatterOptions = {}): string {
    const indentSize = options.indentSize || 4;
    let tokens = tokenize(text);

    // 1. Sort Imports
    tokens = sortImports(tokens);

    // 2. Format Tokens
    let formatted = '';
    let indentLevel = 0;
    let newline = true; // Start on a new line
    let lastToken: Token | null = null;

    const indent = () => ' '.repeat(Math.max(0, indentLevel * indentSize));

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        // Peek next non-whitespace token
        let nextToken: Token | null = null;
        for (let j = i + 1; j < tokens.length; j++) {
            if (tokens[j].type !== 'WHITESPACE') {
                nextToken = tokens[j];
                break;
            }
        }

        // Handle Whitespace (preserve blank lines and synthetic newlines from imports)
        if (token.type === 'WHITESPACE') {
            const newlines = (token.value.match(/\n/g) || []).length;

            // If it's a synthetic token (line 0) OR explicit newline
            if (token.line === 0 || newlines > 0) {
                // Determine how many newlines to apply
                // If it's synthetic or we want to preserve blank lines
                const effectiveNewlines = (token.line === 0) ? 1 : Math.min(newlines, 2);

                // If we need a newline and not already there
                if (effectiveNewlines > 0) {
                    // Check if formatted already ends with newline
                    let existingNewlines = 0;
                    if (formatted.endsWith('\n\n')) existingNewlines = 2;
                    else if (formatted.endsWith('\n')) existingNewlines = 1;

                    if (existingNewlines < effectiveNewlines) {
                        formatted += '\n'.repeat(effectiveNewlines - existingNewlines);
                    }
                    newline = true;
                }
            }
            continue;
        }

        // Handle Comments
        if (token.type === 'COMMENT' || token.type === 'BLOCK_COMMENT') {
            if (!newline && lastToken) {
                formatted += ' ';
            } else if (newline) {
                formatted += indent();
                newline = false;
            }
            formatted += token.value.trim();
            // Force newline after comment
            formatted += '\n';
            newline = true;
            lastToken = token;
            continue;
        }

        // Adjust Indentation BEFORE printing the token (Closing braces)
        if (token.value === '}' || token.value === ')' || token.value === ']') {
            indentLevel = Math.max(0, indentLevel - 1);
        }

        // Check if we should force a newline before this token
        // e.g. } before else is fine on same line, but } before class is not.
        // e.g. closing brace of enum or class body should be on new line usually.
        if (token.value === '}' && !newline) {
             // Force newline before } if it closes a block (heuristic)
             // Unless it's empty block `{ }` or lambda `{ it }`
             if (lastToken && lastToken.value !== '{') {
                 // Check distance or type?
                 // For deep formatting, let's force newline before } if it's not a short lambda.
                 // Hard to judge short lambda.
                 // Let's rely on original whitespace? If original had newline, we respected it above.
                 // If original did NOT have newline, we are here with newline=false.
                 // We should add space at least.
             }
        }

        // Start new line with indentation if needed
        if (newline) {
            formatted += indent();
            newline = false;
        } else {
            // Add space if needed
            if (lastToken && shouldAddSpace(lastToken, token, nextToken)) {
                formatted += ' ';
            }
        }

        // Append Token
        formatted += token.value;

        // Adjust Indentation AFTER printing the token (Opening braces)
        if (token.value === '{' || token.value === '(' || token.value === '[') {
            indentLevel++;
        }

        // Handle Post-Token Newlines
        if (token.value === '{') {
            formatted += '\n';
            newline = true;
        } else if (token.value === ';') {
            formatted += '\n';
            newline = true;
        } else if (token.value === '}') {
            // Check if next token requires staying on same line
            if (nextToken && (
                nextToken.value === 'else' ||
                nextToken.value === 'catch' ||
                nextToken.value === 'finally' ||
                (lastToken && lastToken.value === 'do' && nextToken.value === 'while')
            )) {
                // Stay on same line (space added by shouldAddSpace)
                newline = false;
            } else if (nextToken && (nextToken.value === ',' || nextToken.value === ')' || nextToken.value === ']' || nextToken.value === ';' || nextToken.value === '.')) {
                 newline = false;
            } else {
                formatted += '\n';
                newline = true;
            }
        } else if (token.type === 'ANNOTATION') {
             // Force newline if next is a declaration keyword
             if (nextToken && ['class', 'data', 'fun', 'val', 'var', 'constructor', 'interface', 'object', 'enum'].includes(nextToken.value)) {
                 formatted += '\n';
                 newline = true;
             }
        } else if (token.value === ')' && nextToken && ['class', 'data', 'fun', 'val', 'var', 'constructor'].includes(nextToken.value)) {
             // Closing paren of annotation args or primary constructor?
             // Primary constructor: class Foo(args) { ... } -> { is next.
             // Annotation: @Foo(args) class ... -> class is next.
             formatted += '\n';
             newline = true;
        }

        lastToken = token;
    }

    return formatted.trim() + '\n';
}

function shouldAddSpace(last: Token, current: Token, next: Token | null): boolean {
    // No space before comma, semicolon, dot, safe call, double bang, range, scope, question mark
    if (['.', '?.', '!!', '..', '::', ',', ';', '?'].includes(current.value)) return false;

    // No space after dot, safe call, double bang, range, scope, open paren/bracket/brace
    if (['.', '?.', '!!', '..', '::', '(', '[', '{'].includes(last.value)) return false;

    // No space before closing paren/bracket
    if (current.value === ')' || current.value === ']') return false;

    // Space after keywords (control flow)
    if (last.type === 'KEYWORD' && ['if', 'while', 'for', 'catch', 'when'].includes(last.value)) {
        return current.value === '(';
    }

    // Space before open brace
    if (current.value === '{') return true;

    // Space before closing brace (if not newline)
    if (current.value === '}') return true;

    // Space around binary operators
    if (last.type === 'OPERATOR' || current.type === 'OPERATOR') {
        // Exceptions for Unary
        if (['!', '++', '--'].includes(last.value)) return false;
        if (['!', '++', '--', '+', '-'].includes(current.value)) {
            if (last.type === 'OPERATOR' || ['(', '{', '[', ',', 'return', 'if', 'while'].includes(last.value)) {
                return false;
            }
        }

        if (['.', '?.', '!!', '..', '::'].includes(last.value) || ['.', '?.', '!!', '..', '::'].includes(current.value)) return false;

        // Generics < >
        if (current.value === '<') {
            // Heuristic: Uppercase Identifier (Type) likely starts Generic -> No space
            if (last.type === 'IDENTIFIER' && /^[A-Z]/.test(last.value)) return false;
            // Also if lowercase but next is Uppercase Identifier? `mutableListOf<String>`
            if (next && next.type === 'IDENTIFIER' && /^[A-Z]/.test(next.value)) return false;

            return true;
        }
        if (current.value === '>') {
             if (last.type === 'IDENTIFIER' || last.value === '?') return false;
             return true;
        }
        if (last.value === '<') {
             // Heuristic: if current is Uppercase Identifier, assume Generic -> No space
             if (current.type === 'IDENTIFIER' && /^[A-Z]/.test(current.value)) return false;
             return true;
        }

        // Arrow ->
        if (current.value === '->' || last.value === '->') return true;

        return true;
    }

    // Space after comma
    if (last.value === ',') return true;

    // Space after colon (type declaration)
    if (last.value === ':') return true;
    if (current.value === ':') return false;

    // Space between Keyword and Identifier/Keyword
    if (last.type === 'KEYWORD' && (current.type === 'IDENTIFIER' || current.type === 'KEYWORD' || current.type === 'NUMBER' || current.type === 'STRING')) {
        return true;
    }

    // Space between Identifier and Keyword (e.g. `x in list`, `infix fun`)
    if (last.type === 'IDENTIFIER' && current.type === 'KEYWORD') {
        return true;
    }

    // Space between Number/Identifier and Identifier/Keyword/Number (e.g. `10 step 2`, `x step y`, `val x = 1`)
    if ((last.type === 'NUMBER' || last.type === 'IDENTIFIER') && (current.type === 'IDENTIFIER' || current.type === 'KEYWORD' || current.type === 'NUMBER')) {
        return true;
    }

    // Space between identifier and quote? `x "foo"`. Yes.
    if (last.type === 'IDENTIFIER' && (current.type === 'STRING' || current.type === 'MULTILINE_STRING')) {
        return true;
    }

    // Space after closing brace if on same line (e.g. `} else`)
    if (last.value === '}' && current.value !== ',' && current.value !== ';' && current.value !== '.' && current.value !== ')' && current.value !== ']') {
        return true;
    }

    return false;
}

function sortImports(tokens: Token[]): Token[] {
    const imports: Token[][] = [];
    const nonImports: Token[] = [];

    let currentImport: Token[] = [];
    let inImport = false;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === 'KEYWORD' && token.value === 'import') {
            inImport = true;
            currentImport = [token];
        } else if (inImport) {
            currentImport.push(token);
            // Stop at explicit newline or semicolon
            if (token.value === ';' || (token.type === 'WHITESPACE' && token.value.includes('\n'))) {
                inImport = false;
                imports.push(currentImport);
                currentImport = [];
            }
        } else {
            nonImports.push(token);
        }
    }

    if (imports.length === 0) return tokens;

    // Sort imports
    imports.sort((a, b) => {
        const pathA = a.map(t => t.value).join('').replace(/^import\s+/, '').trim();
        const pathB = b.map(t => t.value).join('').replace(/^import\s+/, '').trim();
        return pathA.localeCompare(pathB);
    });

    // We need to insert imports back.
    let insertIndex = 0;
    let seenPackage = false;

    for (let i = 0; i < nonImports.length; i++) {
        if (nonImports[i].value === 'package') {
            seenPackage = true;
        }
        if (seenPackage && (nonImports[i].value === ';' || (nonImports[i].type === 'WHITESPACE' && nonImports[i].value.includes('\n')))) {
            insertIndex = i + 1;
            break;
        }
    }

    // Flatten imports
    const sortedImportTokens: Token[] = [];
    if (insertIndex > 0) {
        sortedImportTokens.push({ type: 'WHITESPACE', value: '\n\n', line: 0, col: 0 });
    }

    imports.forEach(imp => {
        // Filter out existing newlines from the import tokens to clean them up
        const cleanImp = imp.filter(t => t.type !== 'WHITESPACE');
        sortedImportTokens.push(...cleanImp);
        sortedImportTokens.push({ type: 'WHITESPACE', value: '\n', line: 0, col: 0 });
    });

    sortedImportTokens.push({ type: 'WHITESPACE', value: '\n', line: 0, col: 0 });

    const finalTokens = [
        ...nonImports.slice(0, insertIndex),
        ...sortedImportTokens,
        ...nonImports.slice(insertIndex)
    ];

    return finalTokens;
}
