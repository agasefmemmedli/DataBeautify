
import { CsharpTokenizer, Token, TokenType } from './csharp_tokenizer';

export function formatCSharpDeep(text: string): string {
    const tokenizer = new CsharpTokenizer(text);
    const tokens = tokenizer.tokenize();

    if (tokens.length === 0) return '';

    // Configuration
    const INDENT_SIZE = 4;
    const INDENT_STRING = ' '.repeat(INDENT_SIZE);

    // Filter out whitespace and newlines
    const meaningfulTokens = tokens.filter(t => t.type !== TokenType.Whitespace && t.type !== TokenType.Newline);

    let outputLines: string[] = [];
    let currentLine = '';
    let indentLevel = 0;

    // State
    let parenDepth = 0;
    let angleDepth = 0; // Generics
    let inAutoProp = false;
    let inAttribute = false;

    // Helper to get current indent string
    const getIndent = (offset: number = 0) => {
        return INDENT_STRING.repeat(Math.max(0, indentLevel + offset));
    };

    // Helper to push line
    const pushLine = () => {
        if (currentLine.trim() !== '') {
            outputLines.push(currentLine);
        } else if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== '') {
             outputLines.push('');
        }
        currentLine = '';
    };

    // Helper to append text
    const append = (str: string) => {
        if (currentLine === '') {
            let offset = 0;
            const trimmedStr = str.trim();

            // Dedent '}' is handled by loop logic decrementing indentLevel

            if (trimmedStr === 'case' || trimmedStr === 'default' || (trimmedStr.endsWith(':') && !trimmedStr.startsWith('case') && !trimmedStr.startsWith('default'))) {
                offset = -1;
            }

            if (trimmedStr.startsWith('#')) {
                currentLine = str;
                return;
            }

            currentLine = getIndent(offset) + str;
        } else {
            currentLine += str;
        }
    };

    const isTypeLike = (t: Token) => {
         if (t.type === TokenType.Keyword) {
             return ['bool', 'byte', 'char', 'decimal', 'double', 'float', 'int', 'long', 'object', 'sbyte', 'short', 'string', 'uint', 'ulong', 'ushort', 'void', 'dynamic', 'var'].includes(t.text);
         }
         if (t.type === TokenType.Identifier) {
             return /^[A-Z]/.test(t.text);
         }
         return false;
    };

    for (let i = 0; i < meaningfulTokens.length; i++) {
        const token = meaningfulTokens[i];
        const next = i + 1 < meaningfulTokens.length ? meaningfulTokens[i+1] : null;
        const prev = i > 0 ? meaningfulTokens[i-1] : null;

        // --- Newline / Indentation Logic ---

        let forceNewline = false;
        let preserveNewline = false;

        // Allman Style: Brace always on new line
        if (token.text === '{') {
            forceNewline = true;
        }
        else if (token.text === '}') {
            if (!inAutoProp) forceNewline = true;
        }
        // Attributes: Always on new line
        else if (token.text === '[' && currentLine.trim() === '') {
            // If detected as attribute start in loop logic below
        }
        // Else/Catch/Finally on new line (Allman)
        else if (['else', 'catch', 'finally'].includes(token.text)) {
            forceNewline = true;
        }
        // LINQ keywords often start new line
        else if (['from', 'where', 'select', 'group', 'orderby', 'join', 'let'].includes(token.text)) {
            // Only if they seem to be LINQ (context is hard, but usually safe to respect user newline or force it if complex)
            // We rely on user newline for LINQ to allow inline simple queries
            if (prev && token.line > prev.line) preserveNewline = true;
        }
        // Fluent API (.)
        else if (token.text === '.' || token.text === '?.') {
             if (prev && token.line > prev.line) preserveNewline = true;
        }
        // Generic preservation of user intent
        else if (prev && token.line > prev.line) {
            preserveNewline = true;
        }

        // --- Application of Newline ---

        // Handle '}' dedent before pushing line
        if (token.text === '}') {
            indentLevel = Math.max(0, indentLevel - 1);
            if (inAutoProp) inAutoProp = false;
        }

        if (forceNewline) {
            if (currentLine.trim() !== '') pushLine();
        } else if (preserveNewline) {
            if (currentLine.trim() !== '') pushLine();
        }

        // Check for empty lines in source
        if (prev && token.line > prev.line + 1) {
            if (currentLine.trim() !== '') pushLine();
            if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== '') {
                outputLines.push('');
            }
        }

        // Attribute Detection logic (refined)
        // If we are at start of line (just pushed or empty), check if [
        if (token.text === '[' && currentLine.trim() === '') {
            // Heuristic: is it an attribute?
            // If it's a statement start.
            // Attributes usually precede keywords (public, class, void) or types.
            // We assume yes for formatting purposes to track ]
            inAttribute = true;
        }

        // --- Spacing Logic ---
        let spaceBefore = false;

        if (currentLine !== '') {
            const prevWord = /\w$/.test(currentLine) || currentLine.endsWith('?') || currentLine.endsWith(']') || currentLine.endsWith(')');
            const currWord = /^\w/.test(token.text);
            if (prevWord && currWord) spaceBefore = true;

            if (token.type === TokenType.Operator) {
                const text = token.text;

                if (['.', '?.', '::', ')', ']', ';', ',', '++', '--', '!'].includes(text)) {
                    spaceBefore = false;
                }
                else if (text === '<') {
                    if (prev && (isTypeLike(prev) || prev.type === TokenType.Identifier)) {
                        if (next && isTypeLike(next)) spaceBefore = false;
                        else spaceBefore = true;
                    } else {
                        spaceBefore = true;
                    }
                    angleDepth++;
                }
                else if (text === '>') {
                    angleDepth = Math.max(0, angleDepth - 1);
                    if (next && (next.type === TokenType.Number || next.type === TokenType.String || ['new', 'true', 'false', 'null'].includes(next.text))) {
                        spaceBefore = true;
                    }
                    else if (prev && (isTypeLike(prev) || prev.text === '>')) {
                        spaceBefore = false;
                    }
                    else {
                        spaceBefore = true;
                    }
                }
                else if (text === '*' || text === '&') {
                    if (prev && prev.type === TokenType.Keyword && isTypeLike(prev)) {
                        spaceBefore = false;
                    }
                    else if (prev && (prev.type === TokenType.Operator || ['(', '[', '{', '=', 'return', 'throw', ',', ':'].includes(prev.text))) {
                        spaceBefore = false;
                        if (prev.text === ')' || prev.text === ']') spaceBefore = true;
                    }
                    else {
                        spaceBefore = true;
                    }
                }
                else if (['=', '+=', '-=', '*=', '/=', '%=', '==', '!=', '<=', '>=', '&&', '||', '+', '-', '/', '%', '^', '|', '??', '??=', '=>', '<<', '>>'].includes(text)) {
                    spaceBefore = true;
                }
                else if (text === ':') {
                    if (prev && (prev.text === 'case' || prev.text === 'default')) {
                        spaceBefore = false;
                    } else if (prev && prev.type === TokenType.Identifier) {
                        if (parenDepth > 0) spaceBefore = false;
                        else spaceBefore = true;
                    } else {
                        spaceBefore = true;
                    }
                }
            }

            if (prev) {
                if (prev.type === TokenType.Operator) {
                    const txt = prev.text;
                    if (['.', '?.', '::', '!', '++', '--'].includes(txt)) {
                        spaceBefore = false;
                    } else if (txt === '<') {
                        if (isTypeLike(token)) spaceBefore = false;
                        else spaceBefore = true;
                    } else if (['(', '['].includes(txt)) {
                        spaceBefore = false;
                    } else if (txt === '>') {
                        if (['>', '(', '[', '.', ',', ';'].includes(token.text)) spaceBefore = false;
                        else spaceBefore = true;
                    } else {
                        spaceBefore = true;
                    }
                }
                else if (prev.type === TokenType.Punctuation) {
                    if (['(', '['].includes(prev.text)) spaceBefore = false;
                    if ([')', ']', '}', ',', ';'].includes(prev.text)) spaceBefore = true;
                    if (prev.text === '{') spaceBefore = true;
                }
                else if (prev.type === TokenType.Keyword) {
                    if (['if', 'for', 'foreach', 'while', 'switch', 'catch', 'using', 'lock', 'fixed'].includes(prev.text)) {
                        if (token.text === '(') spaceBefore = true;
                    }
                    else if (['return', 'throw', 'case', 'goto', 'yield'].includes(prev.text)) {
                        spaceBefore = true;
                    }
                    else if (['new', 'typeof', 'sizeof', 'default', 'checked', 'unchecked'].includes(prev.text)) {
                        if (token.text === '(') spaceBefore = false;
                        else spaceBefore = true;
                    }
                }
            }

            if (token.text === ';') spaceBefore = false;
            if (token.text === ',') spaceBefore = false;
            if (token.text === ')') spaceBefore = false;
            if (token.text === ']') spaceBefore = false;
            if (token.text === '(') {
                if (prev && (prev.type === TokenType.Identifier || prev.text === '>')) spaceBefore = false;
            }
            if (token.text === '[') {
                if (prev && (prev.type === TokenType.Identifier || prev.text === ']' || prev.text === ')')) {
                    spaceBefore = false;
                }
            }
            if (token.text === '{') spaceBefore = true;
        }

        if (spaceBefore && currentLine !== '') append(' ');
        append(token.text);

        // --- State Updates (Post-Append) ---

        if (token.text === '{') {
            // AutoProp detection
            let possibleAutoProp = false;
            if (next && ['get', 'set', 'init'].includes(next.text)) {
                let k = i + 1;
                while (k < meaningfulTokens.length) {
                    const t = meaningfulTokens[k];
                    if (t.text === '}') {
                        possibleAutoProp = true;
                        break;
                    }
                    if (t.text === '{' || t.text === '(' || t.text === '=' || t.text === '=>') {
                        possibleAutoProp = false;
                        break;
                    }
                    k++;
                }
            }

            indentLevel++;
            if (possibleAutoProp) {
                inAutoProp = true;
            } else {
                pushLine(); // Allman: Newline after {
            }
        } else if (token.text === '}') {
            if (!inAutoProp) {
                pushLine(); // Allman: Newline after }
            }
        } else if (token.text === ';') {
            if (parenDepth === 0 && !inAutoProp) pushLine();
        } else if (token.text === ':') {
            if (prev && (prev.text === 'case' || prev.text === 'default')) {
                pushLine();
            }
        } else if (token.type === TokenType.Preprocessor) {
            pushLine();
        } else if (token.type === TokenType.Comment) {
            pushLine();
        } else if (token.text === ']' && inAttribute) {
            inAttribute = false;
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
