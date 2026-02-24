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
    let beforeLastToken: Token | null = null;

    // Helper to print indentation
    const indent = (offset: number = 0) => ' '.repeat(Math.max(0, (indentLevel + offset) * indentSize));

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        // Peek next non-whitespace token
        let nextToken: Token | null = null;
        for (let j = i + 1; j < tokens.length; j++) {
            if (tokens[j].type !== 'WHITESPACE' && tokens[j].type !== 'COMMENT' && tokens[j].type !== 'BLOCK_COMMENT') {
                nextToken = tokens[j];
                break;
            }
        }

        // Handle Whitespace
        if (token.type === 'WHITESPACE') {
            const newlines = (token.value.match(/\n/g) || []).length;
            if (token.line === 0 || newlines > 0) {
                const effectiveNewlines = (token.line === 0) ? 1 : Math.min(newlines, 2);
                if (effectiveNewlines > 0) {
                    // Prevent multiple empty lines at start or duplicate newlines
                    if (formatted.endsWith('\n\n')) {
                        // Already has blank line
                    } else if (formatted.endsWith('\n')) {
                        if (effectiveNewlines > 1) formatted += '\n';
                    } else {
                        formatted += '\n'.repeat(effectiveNewlines);
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
            formatted += '\n';
            newline = true;
            lastToken = token;
            continue;
        }

        // --- Indentation Adjustments (Pre-print) ---
        if (token.value === '}' || token.value === ')' || token.value === ']') {
            indentLevel = Math.max(0, indentLevel - 1);
        }

        // Force newline before '}' if not empty block
        if (token.value === '}') {
            if (!newline) {
                // If previous token was '{', it's an empty block: {}
                if (lastToken && lastToken.value === '{') {
                    // Keep on same line (empty block)
                } else {
                    formatted += '\n';
                    newline = true;
                }
            }
        }

        // Print Indentation
        if (newline) {
            // Check for chained call at start of line
            let offset = 0;
            if ((token.value === '.' || token.value === '?.') && lastToken && lastToken.value !== '}') {
                 offset = 1; // Indent chained calls unless following a block close
            }
            formatted += indent(offset);
            newline = false;
        } else {
            // Add space if needed
            if (lastToken && shouldAddSpace(beforeLastToken, lastToken, token, nextToken)) {
                formatted += ' ';
            }
        }

        // Append Token
        formatted += token.value;

        // --- Indentation Adjustments (Post-print) ---
        if (token.value === '{' || token.value === '(' || token.value === '[') {
            indentLevel++;
        }

        // Force Newline After certain tokens
        if (token.value === '{') {
            // Always newline after { unless it's an empty block check?
            // We can look ahead.
            if (nextToken && nextToken.value === '}') {
                // Empty block {}, stay on line
            } else {
                formatted += '\n';
                newline = true;
            }
        } else if (token.value === ';') {
            formatted += '\n';
            newline = true;
        } else if (token.value === '}') {
            // If next is else, catch, finally, stay on line
            if (nextToken && ['else', 'catch', 'finally', 'while'].includes(nextToken.value)) {
                // Special case: do { } while() -> while stays on line.
                // } else -> else stays on line
                newline = false;
            } else if (nextToken && ['.', '?.', '!!', ',', ')', ']', ';'].includes(nextToken.value)) {
                 // Chained call after block, or comma, or closing paren -> stay on line
                 newline = false;
            } else {
                formatted += '\n';
                newline = true;
            }
        } else if (token.type === 'ANNOTATION') {
            // Newline after annotation unless it's parameterized (followed by parens)
            // or if it is a site target like @field:Annotation (handled by tokenizer?)
            if (nextToken && nextToken.value === '(') {
                newline = false;
            } else {
                formatted += '\n';
                newline = true;
            }
        } else if (token.value === ',') {
            // Maybe force newline in Enums?
            // We need context. For now, rely on source or soft handling.
        }

        beforeLastToken = lastToken;
        lastToken = token;
    }

    return formatted.trim() + '\n';
}

function shouldAddSpace(beforeLast: Token | null, last: Token, current: Token, next: Token | null): boolean {
    // No space before punctuations
    if (['.', '?.', '!!', '..', '::', ',', ';', ')', ']'].includes(current.value)) return false;

    // No space after punctuations
    if (['.', '?.', '!!', '..', '::', '(', '[', '{'].includes(last.value)) return false;

    // Special case: `> (` -> No space if `>` was Generic Close.
    if (last.value === '>' && current.value === '(') {
        // Check what came before `>`
        if (beforeLast) {
             if (beforeLast.type === 'IDENTIFIER' && /^[A-Z]/.test(beforeLast.value)) return false;
             if (beforeLast.value === '?') return false;
        }
        return true;
    }

    // Generics: < >
    // No space before < if it looks like generic
    if (current.value === '<') {
        // Common collection factory methods that take generics
        if (['listOf', 'mapOf', 'setOf', 'arrayOf', 'mutableListOf', 'mutableMapOf', 'mutableSetOf', 'arrayListOf'].includes(last.value)) return false;

        // Uppercase identifier likely means Type -> Generic
        if (last.type === 'IDENTIFIER' && /^[A-Z]/.test(last.value)) return false;

        // Nullable type argument List<String?>
        if (last.value === '?') return false;

        return true;
    }
    // No space after <
    if (last.value === '<') return false;

    // Logic for >
    if (current.value === '>') {
         // Heuristic: if last token is IDENTIFIER and starts with Uppercase, assume Generic -> No space.
         // e.g. List<String>
         if (last.type === 'IDENTIFIER' && /^[A-Z]/.test(last.value)) return false;
         if (last.value === '?') return false;
         if (last.value === '>') return false; // Nested generics >>

         return true;
    }

    // Logic for ? (Nullable type)
    if (current.value === '?') return false;

    // Type params: Map<K, V> -> space after comma is handled by "Space after comma" rule below.

    // Space after comma
    if (last.value === ',') return true;

    // Space after colon (declarations)
    if (last.value === ':') return true;
    // No space before colon (Kotlin style: `val x: Int`)
    if (current.value === ':') return false;

    // Space around Operators
    if (last.type === 'OPERATOR' || current.type === 'OPERATOR') {
        // Unary exceptions
        if (['!', '++', '--'].includes(last.value)) return false; // !x
        if (['!', '++', '--'].includes(current.value)) return false; // x++

        // + and - can be unary.
        if ((current.value === '+' || current.value === '-') &&
            (last.type === 'OPERATOR' || ['(', '[', '{', ',', 'return', '=', ':'].includes(last.value))) {
            return false;
        }

        // Range ..
        if (last.value === '..' || current.value === '..') return false;

        // Arrow ->
        if (last.value === '->' || current.value === '->') return true;

        return true;
    }

    // Space around assignments =
    if (last.value === '=' || current.value === '=') return true;

    // Space between Identifier/Keyword/Number and Identifier/Keyword/Number/String
    const isWordOrNum = (t: Token) => t.type === 'IDENTIFIER' || t.type === 'KEYWORD' || t.type === 'NUMBER';
    if (isWordOrNum(last) && (isWordOrNum(current) || current.type === 'STRING')) {
         return true;
    }

    // Keywords (Special cases override above?)
    if (last.type === 'KEYWORD') {
        if (['if', 'while', 'for', 'catch', 'when'].includes(last.value) && current.value === '(') return true;
        if (current.value === '{') return true;
    }
    if (current.type === 'KEYWORD') {
         if (last.value === '}') return true; // } else
         if (last.value === ')') return true; // ) {
    }

    // { }
    if (current.value === '{') return true; // foo {

    return false;
}

function sortImports(tokens: Token[]): Token[] {
    const imports: Token[][] = [];
    const nonImports: Token[] = [];

    let currentImport: Token[] = [];
    let inImport = false;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        // Check for import start
        if (!inImport && token.type === 'KEYWORD' && token.value === 'import') {
            inImport = true;
            currentImport = [token];
        } else if (inImport) {
            currentImport.push(token);
            // End import on newline or semicolon
            if (token.value === ';' || (token.type === 'WHITESPACE' && token.value.includes('\n'))) {
                inImport = false;
                imports.push(currentImport);
                currentImport = [];
            }
        } else {
            nonImports.push(token);
        }
    }
    // Capture trailing import if file ends without newline
    if (inImport && currentImport.length > 0) {
        imports.push(currentImport);
    }

    if (imports.length === 0) return tokens;

    // Sort imports based on text content
    imports.sort((a, b) => {
        const textA = a.map(t => t.value).join('').trim();
        const textB = b.map(t => t.value).join('').trim();
        return textA.localeCompare(textB);
    });

    // Find insertion point: after package declaration
    let insertIndex = 0;
    let packageFound = false;
    for (let i = 0; i < nonImports.length; i++) {
        if (nonImports[i].value === 'package') {
            packageFound = true;
        }
        if (packageFound) {
             // Look for end of package line
             if (nonImports[i].value === ';' || (nonImports[i].type === 'WHITESPACE' && nonImports[i].value.includes('\n'))) {
                 insertIndex = i + 1;
                 break;
             }
        }
    }

    // Construct new token list
    const result: Token[] = [];

    // Add pre-import tokens (package)
    result.push(...nonImports.slice(0, insertIndex));

    // Add separator
    if (insertIndex > 0) result.push({ type: 'WHITESPACE', value: '\n\n', line: 0, col: 0 });

    // Add imports
    imports.forEach(imp => {
        // Strip existing whitespace/newlines from import tokens to normalize
        const cleanImp = imp.filter(t => t.type !== 'WHITESPACE');
        result.push(...cleanImp);
        result.push({ type: 'WHITESPACE', value: '\n', line: 0, col: 0 });
    });

    result.push({ type: 'WHITESPACE', value: '\n', line: 0, col: 0 });

    // Add rest
    // Strip leading whitespace from rest if any, to avoid huge gaps
    let rest = nonImports.slice(insertIndex);
    while(rest.length > 0 && rest[0].type === 'WHITESPACE') {
        rest.shift();
    }
    result.push(...rest);

    return result;
}
