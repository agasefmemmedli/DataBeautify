
import { CppTokenizer, Token, TokenType } from './cpp_tokenizer';

export function formatCppDeep(text: string): string {
    const tokenizer = new CppTokenizer(text);
    const tokens = tokenizer.tokenize();

    if (tokens.length === 0) return '';

    // Configuration
    const INDENT_SIZE = 4;
    const INDENT_STRING = ' '.repeat(INDENT_SIZE);

    // Filter out whitespace and newlines, we will reconstruct them
    // But keep comments as tokens
    const meaningfulTokens = tokens.filter(t => t.type !== TokenType.Whitespace && t.type !== TokenType.Newline);

    let outputLines: string[] = [];
    let currentLine = '';
    let indentLevel = 0;

    // State
    let parenDepth = 0; // To handle 'for' loops (semicolons)
    let angleDepth = 0; // To handle templates vs comparison

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

            // Dedent Access Specifiers
            if (trimmedStr === 'public' || trimmedStr === 'private' || trimmedStr === 'protected') {
                offset = -1;
            }
            // Dedent Case/Default
            else if (trimmedStr === 'case' || trimmedStr === 'default') {
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
             return ['int', 'char', 'bool', 'void', 'float', 'double', 'long', 'short', 'unsigned', 'signed', 'auto', 'const', 'typename', 'class', 'struct'].includes(t.text);
         }
         if (t.type === TokenType.Identifier) {
             // Heuristics for Types
             if (['vector', 'string', 'list', 'map', 'set', 'deque', 'queue', 'stack', 'pair', 'tuple', 'unique_ptr', 'shared_ptr', 'weak_ptr', 'iostream', 'ostream', 'istream'].includes(t.text)) return true;
             return /^[A-Z]/.test(t.text) || t.text.endsWith('_t');
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
                if (['.', '->', '::', ')', ']', ';', ',', '++', '--'].includes(text)) {
                    spaceBefore = false;
                }
                // < and >
                else if (text === '<') {
                    if (prev && prev.text === 'template') spaceBefore = true;
                    else if (prev && isTypeLike(prev)) {
                         // Type<
                         // Check next to decide if template.
                         // vector<int> -> Template
                         // vector<MyClass> -> Template
                         // vector<x> -> Template (heuristically if LHS is type)
                         // But if prev is 'x' (not TypeLike) -> x < y -> Space.

                         // If prev is TypeLike, assume Template open?
                         // MyClass<T> -> Yes.
                         // int< -> No (int cannot be template).
                         // vector< -> Yes.
                         // If prev is identifier (not keyword 'int'), and TypeLike (Pascal or list), treat as template.
                         if (prev.type === TokenType.Identifier) {
                             // Check next to allow 'x < y' where x is PascalCase? (Unlikely variable name)
                             // If next is TypeLike -> Template.
                             // If next is Identifier/Number -> Comparison?
                             // Safe bet: If LHS is TypeLike Identifier -> Template -> No Space.
                             spaceBefore = false;
                         } else {
                             // int < 5 -> Space
                             spaceBefore = true;
                         }
                    }
                    else if (prev && prev.type === TokenType.Identifier) {
                         // LHS is Identifier but NOT TypeLike (e.g. 'x').
                         // Check RHS (next).
                         // If RHS is TypeLike -> Template (e.g. func<int>()) -> No Space.
                         // If RHS is Not TypeLike -> Comparison (x < y) -> Space.
                         if (next && isTypeLike(next)) spaceBefore = false;
                         else spaceBefore = true;
                    }
                    else spaceBefore = true;
                    angleDepth++;
                }
                else if (text === '>') {
                    angleDepth = Math.max(0, angleDepth - 1);
                    if (prev && prev.text === '>') spaceBefore = false; // >>
                    else if (prev && prev.text === '<') spaceBefore = false; // <>
                    else spaceBefore = false; // vector<int>
                }
                // * and &
                else if (text === '*' || text === '&') {
                    if (prev && isTypeLike(prev)) {
                        spaceBefore = false;
                    } else if (prev && (prev.type === TokenType.Operator || ['(', '[', '{', '=', 'return', 'throw', ',', ':'].includes(prev.text))) {
                        spaceBefore = true;
                        if (prev.text === '(' || prev.text === '[' || prev.text === '{') spaceBefore = false;
                    } else {
                        spaceBefore = true;
                    }
                }
                // Other Binary
                else if (['=', '+=', '-=', '*=', '/=', '%=', '==', '!=', '<=', '>=', '&&', '||', '+', '-', '/', '%', '^', '|', '&', '?', ':', '<<', '>>'].includes(text)) {
                    if (text !== '*' && text !== '&') {
                        if (text === ':' && prev && (['public', 'private', 'protected', 'default'].includes(prev.text) || prev.text === 'case')) {
                            spaceBefore = false;
                        } else {
                            spaceBefore = true;
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
                    if (['.', '->', '::', '!', '~', '++', '--'].includes(txt)) {
                        spaceBefore = false;
                    }
                    else if (txt === '*' || txt === '&') {
                        const prevPrev = i > 1 ? meaningfulTokens[i-2] : null;

                        if (prevPrev && isTypeLike(prevPrev)) {
                            spaceBefore = true;
                        } else if (prevPrev && (prevPrev.type === TokenType.Operator || ['(', '[', '{', '=', 'return', 'throw', ',', ':'].includes(prevPrev.text))) {
                            spaceBefore = false;
                        } else {
                            spaceBefore = true;
                        }
                    }
                    else if (txt === '<') {
                        // Space after <
                        // If template open -> No space.
                        // If comparison -> Space.

                        // Use logic from "Space Before <" to infer context?
                        // If prev (lhs of <) was TypeLike Identifier -> Template -> No Space.
                        // If prev was Identifier (not TypeLike) -> Check current (RHS).
                        // If current is TypeLike -> Template -> No Space.
                        // Else -> Comparison -> Space.

                        const lhs = i > 1 ? meaningfulTokens[i-2] : null; // prev is <. lhs is token before <.

                        if (lhs && lhs.text === 'template') {
                            spaceBefore = false;
                        } else if (lhs && lhs.type === TokenType.Identifier) {
                            if (isTypeLike(lhs)) spaceBefore = false; // vector<int
                            else if (isTypeLike(token)) spaceBefore = false; // func<int
                            else spaceBefore = true; // x < y
                        } else {
                            spaceBefore = true; // 1 < 2
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
                    if (['if', 'for', 'while', 'switch', 'catch', 'template'].includes(prev.text)) {
                         if (token.text === '(' || token.text === '<') spaceBefore = true;
                    }
                    else if (['return', 'throw', 'case', 'goto', 'new', 'delete', 'using', 'namespace'].includes(prev.text)) {
                        spaceBefore = true;
                    }
                }
            }

            if (token.text === ';') spaceBefore = false;
            if (token.text === ',') spaceBefore = false;
            if (token.text === ')') spaceBefore = false;
            if (token.text === ']') spaceBefore = false;
            if (token.text === '(') {
                 if (prev && prev.type === TokenType.Identifier) spaceBefore = false;
            }
            if (token.text === '[') {
                if (prev && prev.type === TokenType.Identifier) spaceBefore = false;
                else if (prev && prev.text === ']') spaceBefore = false;
            }
        }

        if (spaceBefore && currentLine !== '') append(' ');
        append(token.text);

        if (token.text === '{') {
            indentLevel++;
            pushLine();
        } else if (token.text === '}') {
            if (next && (next.text === ';' || next.text === ',')) {
            } else {
                pushLine();
            }
        } else if (token.text === ';') {
            if (parenDepth === 0) pushLine();
        } else if (token.text === ':') {
             if (prev && (['public', 'private', 'protected', 'default'].includes(prev.text) || prev.text === 'case' || prev.type === TokenType.Identifier || prev.type === TokenType.Number)) {
                  if (prev && ['public', 'private', 'protected'].includes(prev.text)) pushLine();
                  else if (prev && (prev.text === 'default' || (i > 1 && meaningfulTokens[i-2].text === 'case'))) pushLine();
             }
        } else if (token.type === TokenType.Preprocessor) {
            pushLine();
        } else if (token.type === TokenType.Comment) {
            pushLine();
        }

        if (token.text === '(') parenDepth++;
        else if (token.text === ')') parenDepth = Math.max(0, parenDepth - 1);

        if (token.text === '<') angleDepth++;
        else if (token.text === '>') angleDepth = Math.max(0, angleDepth - 1);
    }

    if (currentLine.trim() !== '') pushLine();

    return outputLines.join('\n');
}
