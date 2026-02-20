
import { CTokenizer, Token, TokenType } from './c_tokenizer';

export function formatCDeep(text: string): string {
    const tokenizer = new CTokenizer(text);
    const tokens = tokenizer.tokenize();

    if (tokens.length === 0) return '';

    // Configuration
    const INDENT_SIZE = 4;
    const INDENT_STRING = ' '.repeat(INDENT_SIZE);

    // Filter out whitespace and newlines, we will reconstruct them
    const meaningfulTokens = tokens.filter(t => t.type !== TokenType.Whitespace && t.type !== TokenType.Newline);

    let outputLines: string[] = [];
    let currentLine = '';
    let indentLevel = 0;

    // State
    let parenDepth = 0; // To handle 'for' loops (semicolons)

    // Helper to get current indent string
    const getIndent = (offset: number = 0) => {
        return INDENT_STRING.repeat(Math.max(0, indentLevel + offset));
    };

    // Helper to push line
    const pushLine = () => {
        if (currentLine.trim() !== '') {
            outputLines.push(currentLine);
        } else if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== '') {
             // Allow max 1 empty line
             outputLines.push('');
        }
        currentLine = '';
    };

    // Helper to append text
    const append = (str: string) => {
        if (currentLine === '') {
            // Apply indentation logic
            let offset = 0;
            const trimmedStr = str.trim();

            // Dedent Case/Default
            if (trimmedStr === 'case' || trimmedStr === 'default') {
                offset = -1;
            }
            // Preprocessor at column 0
            else if (trimmedStr.startsWith('#')) {
                currentLine = str; // No indent
                return;
            }

            currentLine = getIndent(offset) + str;
        } else {
            currentLine += str;
        }
    };

    const isTypeLike = (t: Token) => {
         if (t.type === TokenType.Keyword) {
             return ['int', 'char', 'bool', 'void', 'float', 'double', 'long', 'short', 'unsigned', 'signed', 'auto', 'const', 'struct', 'union', 'enum', 'size_t', 'ssize_t', 'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t', 'uintptr_t', 'intptr_t', 'ptrdiff_t', 'wchar_t'].includes(t.text);
         }
         if (t.type === TokenType.Identifier) {
             // Heuristics for Types
             // Ends with _t, or PascalCase (often used for structs in C via typedef), or ALL_CAPS (macros/types)
             return /_t$/.test(t.text) || /^[A-Z]/.test(t.text);
         }
         return false;
    };

    for (let i = 0; i < meaningfulTokens.length; i++) {
        const token = meaningfulTokens[i];
        const next = i + 1 < meaningfulTokens.length ? meaningfulTokens[i+1] : null;
        const prev = i > 0 ? meaningfulTokens[i-1] : null;

        // --- Logic Update State (Pre-Append) ---
        if (token.text === '}') {
            indentLevel = Math.max(0, indentLevel - 1);
            if (currentLine.trim() !== '') pushLine();
        }

        // --- Spacing Logic ---
        let spaceBefore = false;

        if (currentLine !== '') {
            // Default: Space if both are words/numbers
            const prevWord = /\w$/.test(currentLine); // check end of current line
            const currWord = /^\w/.test(token.text);
            if (prevWord && currWord) spaceBefore = true;

            // Operator Spacing
            if (token.type === TokenType.Operator) {
                const text = token.text;

                // No space before:
                if (['.', '->', ')', ']', ';', ',', '++', '--'].includes(text)) {
                    spaceBefore = false;
                }
                // < and > (Comparison only in C, no templates)
                else if (text === '<' || text === '>') {
                    // Standard spacing for binary operators
                    spaceBefore = true;
                }
                // * and & (Pointer/Address-of vs Multiplication/BitwiseAnd)
                else if (text === '*' || text === '&') {
                    // C Style: int *p; (or int* p;)
                    // Let's enforce `int *p` (Linux kernel style / common C style)
                    // If prev is TypeLike -> Space (int *p)
                    // If prev is Operator -> No Space (**p, &*p, (*p))

                    if (prev && isTypeLike(prev)) {
                        spaceBefore = true;
                    } else if (prev && (prev.type === TokenType.Operator || ['(', '[', '{', '=', 'return', ',', ':'].includes(prev.text))) {
                        spaceBefore = false; // Cast: (int*) or Dereference: *p
                        if (prev.text === ')' && text === '*') spaceBefore = true; // (type) *val -> multiplication? (type)*val -> cast? Ambiguous.
                    } else {
                        spaceBefore = true; // Binary operator: a * b
                    }
                }
                // Other Binary
                else if (['=', '+=', '-=', '*=', '/=', '%=', '==', '!=', '<=', '>=', '&&', '||', '+', '-', '/', '%', '^', '|', '&', '?', ':', '<<', '>>'].includes(text)) {
                    if (text !== '*' && text !== '&') {
                         spaceBefore = true;
                         // Case label colon handled below
                         if (text === ':' && prev && (prev.text === 'default' || prev.text === 'case')) {
                             spaceBefore = false;
                         }
                    }
                }
                // Unary ! ~
                else if (['!', '~'].includes(text)) {
                    spaceBefore = true;
                    if (prev && (prev.type === TokenType.Operator || prev.text === '(' || prev.text === '[')) spaceBefore = false;
                }
            }

            // Space After Previous Token check
            if (prev) {
                if (prev.type === TokenType.Operator) {
                    const txt = prev.text;
                    if (['.', '->', '!', '~', '++', '--'].includes(txt)) {
                        spaceBefore = false;
                    }
                    else if (txt === '*' || txt === '&') {
                        // Pointer/Dereference context?
                        // If it was binary * (a * b), we want space.
                        // If it was unary * (*p), we want NO space.

                        // Heuristic: If we decided * was binary (spaceBefore=true), then space after is likely too.
                        // But here we are processing `token` and looking at `prev`.

                        // Re-evaluate context of `prev`:
                        const prevPrev = i > 1 ? meaningfulTokens[i-2] : null;

                        let prevIsUnary = false;
                        if (!prevPrev || prevPrev.type === TokenType.Operator || ['(', '[', '{', '=', 'return', ',', 'case'].includes(prevPrev.text)) {
                             prevIsUnary = true;
                        } else if (isTypeLike(prevPrev)) {
                             // int * p -> This is declaration.
                             // We want int *p. So prev (*) is unary-ish (pointer).
                             prevIsUnary = true;
                        }

                        if (prevIsUnary) {
                            spaceBefore = false; // *p
                        } else {
                            spaceBefore = true; // a * b
                        }
                    }
                    else if (txt === '(' || txt === '[') {
                        spaceBefore = false;
                    }
                    else {
                        spaceBefore = true;
                    }
                }
                else if (prev.type === TokenType.Punctuation) {
                    if (prev.text === '(' || prev.text === '[') spaceBefore = false;
                    if (prev.text === ')' || prev.text === ']') spaceBefore = true;
                    if (prev.text === ',') spaceBefore = true;
                    if (prev.text === ';') spaceBefore = true;
                    if (prev.text === '{') spaceBefore = true;
                }
                else if (prev.type === TokenType.Keyword) {
                    if (['if', 'for', 'while', 'switch'].includes(prev.text)) {
                         if (token.text === '(') spaceBefore = true;
                    }
                    else if (['return', 'case', 'goto', 'sizeof'].includes(prev.text)) {
                        spaceBefore = true;
                    }
                }
            }

            if (token.text === ';') spaceBefore = false;
            if (token.text === ',') spaceBefore = false;
            if (token.text === ')') spaceBefore = false;
            if (token.text === ']') spaceBefore = false;
            if (token.text === '{') spaceBefore = true; // Always space before {
            if (token.text === '(') {
                 if (prev && prev.type === TokenType.Identifier) spaceBefore = false; // Function call
            }
            if (token.text === '[') {
                if (prev && prev.type === TokenType.Identifier) spaceBefore = false; // Array access
                else if (prev && prev.text === ']') spaceBefore = false;
            }

            // Fix case label spacing: case 1 : -> case 1:
            if (token.text === ':' && currentLine.trim().startsWith('case ')) {
                spaceBefore = false;
            }
        }

        if (spaceBefore && currentLine !== '') append(' ');
        append(token.text);

        if (token.text === '{') {
            indentLevel++;
            pushLine();
        } else if (token.text === '}') {
            if (next && (next.text === ';' || next.text === ',')) {
                 // struct X { ... }; -> Stay on same line
            } else {
                pushLine();
            }
        } else if (token.text === ';') {
            if (parenDepth === 0) pushLine();
        } else if (token.text === ':') {
             // Case label
             if (prev && (prev.text === 'default' || (i > 1 && meaningfulTokens[i-2].text === 'case'))) {
                  pushLine();
             }
        } else if (token.type === TokenType.Preprocessor) {
            pushLine();
        } else if (token.type === TokenType.Comment) {
            pushLine();
        }

        if (token.text === '(') parenDepth++;
        else if (token.text === ')') parenDepth = Math.max(0, parenDepth - 1);
    }

    if (currentLine.trim() !== '') pushLine();

    return outputLines.join('\n');
}
