
import { CsharpTokenizer, Token, TokenType } from './csharp_tokenizer';

interface FormatterToken extends Token {
    hasPrecedingSpace: boolean;
}

export function formatCSharpDeep(text: string): string {
    const tokenizer = new CsharpTokenizer(text);
    const tokens = tokenizer.tokenize();

    if (tokens.length === 0) return '';

    // Configuration
    const INDENT_SIZE = 4;
    const INDENT_STRING = ' '.repeat(INDENT_SIZE);

    // Filter out whitespace and newlines but mark tokens
    const meaningfulTokens: FormatterToken[] = [];
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.type === TokenType.Whitespace || t.type === TokenType.Newline) continue;

        let hasSpace = false;
        if (i > 0) {
            const prevT = tokens[i-1];
            if (prevT.type === TokenType.Whitespace || prevT.type === TokenType.Newline) hasSpace = true;
        }
        meaningfulTokens.push({ ...t, hasPrecedingSpace: hasSpace });
    }

    let outputLines: string[] = [];
    let currentLine = '';
    let indentLevel = 0;

    // State
    let parenDepth = 0;
    let angleDepth = 0; // Generics
    let inAutoProp = false;
    let inAttribute = false;

    // Track if a block has active case indentation
    // true = we indented for a case label, so we must dedent before next case or block end
    let blockCaseStack: boolean[] = [];
    let potentialCaseLabel = false;

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

            if (trimmedStr.startsWith('.') || trimmedStr.startsWith('?.')) {
                // Method chaining indent
                offset = 1;
            }
            if (trimmedStr.startsWith('where') || trimmedStr.startsWith('orderby') || trimmedStr.startsWith('select') || trimmedStr.startsWith('group') || trimmedStr.startsWith('join')) {
                // LINQ indentation
                offset = 1;
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
             return ['bool', 'byte', 'char', 'decimal', 'double', 'float', 'int', 'long', 'object', 'sbyte', 'short', 'string', 'uint', 'ulong', 'ushort', 'void', 'dynamic', 'var', 'record', 'struct', 'enum', 'class', 'interface', 'delegate', 'task', 'span', 'memory'].includes(t.text);
         }
         if (t.type === TokenType.Identifier) {
             // Heuristic: PascalCase usually Types.
             return /^[A-Z]/.test(t.text);
         }
         return false;
    };

    for (let i = 0; i < meaningfulTokens.length; i++) {
        const token = meaningfulTokens[i];
        const next = i + 1 < meaningfulTokens.length ? meaningfulTokens[i+1] : null;
        const prev = i > 0 ? meaningfulTokens[i-1] : null;

        // --- Pre-Analysis ---
        let isAutoPropContext = false;
        if (token.text === '{') {
            if (next && ['get', 'set', 'init'].includes(next.text)) {
                let k = i + 1;
                while (k < meaningfulTokens.length) {
                    const t = meaningfulTokens[k];
                    if (t.text === '}') {
                        isAutoPropContext = true;
                        break;
                    }
                    if (t.text === '{' || t.text === '(' || t.text === '=' || t.text === '=>') {
                        isAutoPropContext = false;
                        break;
                    }
                    k++;
                }
            }
        }

        // --- Newline / Indentation Logic ---

        let forceNewline = false;
        let preserveNewline = false;

        // Allman Style
        if (token.text === '{') {
            if (!isAutoPropContext) {
                if (prev && (prev.text === '=' || prev.text === 'new' || prev.text === 'return' || prev.text === '=>')) {
                    // Inline allowed
                } else {
                    forceNewline = true;
                }
            }
        }
        else if (token.text === '}') {
            if (!inAutoProp) {
                if (prev && prev.text !== '{') forceNewline = true;
                else if (prev && prev.text === '{') {
                    forceNewline = true;
                }
            }
        }
        else if (['else', 'catch', 'finally'].includes(token.text)) {
            forceNewline = true;
        }
        else if (['from', 'where', 'select', 'group', 'orderby', 'join', 'let'].includes(token.text)) {
            if (prev && token.line > prev.line) preserveNewline = true;
        }
        else if (token.text === '.' || token.text === '?.') {
             if (prev && token.line > prev.line) preserveNewline = true;
        }
        else if (prev && token.line > prev.line) {
            if (token.text !== ';') {
                preserveNewline = true;
            }
        }

        // --- Switch Case Indentation Adjustments (Pre-Append) ---
        if (token.text === 'case' || token.text === 'default') {
            if (blockCaseStack.length > 0 && blockCaseStack[blockCaseStack.length - 1]) {
                indentLevel = Math.max(0, indentLevel - 1);
                blockCaseStack[blockCaseStack.length - 1] = false;
            }
            potentialCaseLabel = true;
        }

        // --- Application of Newline ---

        if (token.text === '}') {
            if (!inAutoProp) {
                // Dedent for case content if active
                if (blockCaseStack.length > 0 && blockCaseStack[blockCaseStack.length - 1]) {
                    indentLevel = Math.max(0, indentLevel - 1);
                    blockCaseStack[blockCaseStack.length - 1] = false; // Popped later
                }

                indentLevel = Math.max(0, indentLevel - 1);

                if (blockCaseStack.length > 0) blockCaseStack.pop();
            } else {
                indentLevel = Math.max(0, indentLevel - 1);
            }
            if (inAutoProp) inAutoProp = false;
        }

        if (forceNewline) {
            if (currentLine.trim() !== '') pushLine();
        } else if (preserveNewline) {
            if (currentLine.trim() !== '') pushLine();
        }

        if (prev && token.line > prev.line + 1) {
            if (currentLine.trim() !== '') pushLine();
            if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== '') {
                outputLines.push('');
            }
        }

        if (token.text === '[' && currentLine.trim() === '') {
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
                    let looksLikeGeneric = false;
                    if (prev && isTypeLike(prev)) {
                        if (next && (isTypeLike(next) || next.text === '>' || next.text === ',' || next.text === '[' || next.text === '(' || next.text === '?')) {
                             looksLikeGeneric = true;
                        }
                    }

                    let looksLikeComparison = false;
                    if (next && (next.type === TokenType.Number || (!isTypeLike(next) && next.text !== '>' && next.text !== ',' && next.text !== '[' && next.text !== '(' && next.text !== '?'))) {
                         looksLikeComparison = true;
                    }

                    if (looksLikeGeneric && !looksLikeComparison) {
                        spaceBefore = false;
                        angleDepth++;
                    } else if (looksLikeComparison) {
                        spaceBefore = true;
                    } else {
                        // Ambiguous: trust user space
                        if (token.hasPrecedingSpace) spaceBefore = true;
                        else {
                            spaceBefore = false;
                            angleDepth++;
                        }
                    }
                }
                else if (text === '>') {
                    if (angleDepth > 0) {
                        spaceBefore = false;
                        angleDepth = Math.max(0, angleDepth - 1);
                    } else {
                        spaceBefore = true;
                    }
                }
                else if (text === '*' || text === '&') {
                    if (prev && prev.type === TokenType.Keyword && isTypeLike(prev)) {
                        spaceBefore = false;
                    }
                    else if (prev && (prev.type === TokenType.Operator || ['(', '[', '{', '=', 'return', 'throw', ',', ':'].includes(prev.text))) {
                        spaceBefore = false;
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
                    } else if (prev && prev.type === TokenType.Identifier && indentLevel === 0) {
                        if (parenDepth > 0) spaceBefore = false;
                        else spaceBefore = false;
                    } else if (prev && prev.type === TokenType.Identifier) {
                         if (parenDepth > 0) spaceBefore = false;
                         else spaceBefore = true;
                    } else {
                        spaceBefore = true;
                    }
                }
                else if (text === '?') {
                    if (prev && (isTypeLike(prev) || (prev.type === TokenType.Identifier && next && (next.text === '.' || next.text === '[' || next.text === ';' || next.text === ')' || next.text === ',' || next.text === '=' || next.text === '>' || next.text === '??')))) {
                        spaceBefore = false;
                    } else if (prev && (prev.type === TokenType.Identifier && next && next.text === '?')) {
                        spaceBefore = false;
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
                        // Check if we are inside a generic based on angleDepth logic decided at '<'
                        // If angleDepth > 0, we assumed generic start.
                        // BUT, if angleDepth was 0 before '<', and '<' set it to 1, then we are inside.
                        // If '<' decided it was comparison, it didn't increment.
                        // So checking angleDepth here IS correct.
                        if (angleDepth > 0) spaceBefore = false;
                        else spaceBefore = true;
                    } else if (['(', '['].includes(txt)) {
                        spaceBefore = false;
                    } else if (txt === '>') {
                        if (['(', '[', '.', ',', ';', ')', ']'].includes(token.text)) spaceBefore = false;
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

            if (token.text === ';') {
                spaceBefore = false;
            }
            if (token.text === ',') spaceBefore = false;
            if (token.text === ')') spaceBefore = false;
            if (token.text === ']') spaceBefore = false;
            if (token.text === '.') spaceBefore = false;
            if (token.text === '?.') spaceBefore = false;

            if (token.text === '(') {
                if (prev && (prev.type === TokenType.Identifier || prev.text === '>' || prev.text === ')' || prev.text === ']')) spaceBefore = false;
            }
            if (token.text === '[') {
                if (prev && (prev.type === TokenType.Identifier || prev.text === ']' || prev.text === ')')) {
                    spaceBefore = false;
                }
            }
            if (token.text === '{') spaceBefore = true;
        }

        // Semicolon Attachment Logic
        if (token.text === ';') {
            if (currentLine === '' && outputLines.length > 0) {
                const lastLine = outputLines[outputLines.length - 1];
                if (lastLine.trim().endsWith('}') || lastLine.trim().endsWith(']')) {
                    outputLines[outputLines.length - 1] += ';';
                    continue;
                }
            }
        }

        if (spaceBefore && currentLine !== '') append(' ');
        append(token.text);

        // --- State Updates (Post-Append) ---

        if (token.text === '{') {
            indentLevel++;
            if (isAutoPropContext) {
                inAutoProp = true;
            } else {
                blockCaseStack.push(false); // Push block context
                if (!forceNewline && !preserveNewline) {
                    // Inline
                } else {
                    pushLine();
                }
            }
        } else if (token.text === '}') {
            if (!inAutoProp) {
                if (!forceNewline && !preserveNewline && prev && prev.text !== '{') {
                    // e.g. { 1, 2 }
                } else {
                    pushLine();
                }
            }
        } else if (token.text === ';') {
            if (parenDepth === 0 && !inAutoProp) pushLine();
        } else if (token.text === ':') {
            if (potentialCaseLabel) {
                // Determine if it's really a case label or part of ternary
                let isTernary = false;
                let k = i - 1;
                while (k >= 0) {
                    const t = meaningfulTokens[k];
                    if (t.text === 'case' || t.text === 'default') break;
                    if (t.text === ';' || t.text === '{' || t.text === '}') { isTernary = true; break; } // Shouldn't happen if potentialCaseLabel is managed right
                    if (t.text === '?') { isTernary = true; break; }
                    k--;
                }

                if (!isTernary) {
                    pushLine();
                    if (blockCaseStack.length > 0) {
                        indentLevel++;
                        blockCaseStack[blockCaseStack.length - 1] = true;
                    }
                    potentialCaseLabel = false;
                } else {
                    // Ternary colon
                }
            } else if (prev && (prev.text === 'case' || prev.text === 'default')) {
                // Fallback for empty case "case:"
                pushLine();
                if (blockCaseStack.length > 0) {
                    indentLevel++;
                    blockCaseStack[blockCaseStack.length - 1] = true;
                }
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
