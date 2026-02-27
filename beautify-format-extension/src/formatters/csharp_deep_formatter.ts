
import { CsharpTokenizer, Token, TokenType } from './csharp_tokenizer';

interface FormatterToken extends Token {
    hasPrecedingSpace: boolean;
}

export function formatCSharpDeep(text: string): string {
    const tokenizer = new CsharpTokenizer(text);
    const tokens = tokenizer.tokenize();

    if (tokens.length === 0) return '';

    const INDENT_SIZE = 4;
    const INDENT_STRING = ' '.repeat(INDENT_SIZE);

    // Filter meaningful tokens
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
    let angleDepth = 0; // Generics nesting
    let inAutoProp = false;
    let inAttribute = false;
    let initializerStack: boolean[] = []; // true if current brace scope is an initializer
    let switchIndentStack: boolean[] = [];

    const getIndent = (offset: number = 0) => {
        return INDENT_STRING.repeat(Math.max(0, indentLevel + offset));
    };

    const pushLine = () => {
        if (currentLine.trim() !== '') {
            outputLines.push(currentLine);
        } else if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== '') {
             outputLines.push('');
        }
        currentLine = '';
    };

    const append = (str: string) => {
        if (currentLine === '') {
            let offset = 0;
            const trimmedStr = str.trim();

            if (trimmedStr.startsWith('.') || trimmedStr.startsWith('?.')) {
                offset = 1;
            }
            // LINQ Continuation Indent
            if (['where', 'orderby', 'select', 'group', 'join', 'let'].includes(trimmedStr)) {
                 offset = 1;
            }

            if (trimmedStr.startsWith('#')) {
                if (trimmedStr.startsWith('#region') || trimmedStr.startsWith('#endregion')) {
                    // Respect indent
                } else {
                    currentLine = str;
                    return;
                }
            }

            currentLine = getIndent(offset) + str;
        } else {
            currentLine += str;
        }
    };

    // Helper: Is this < likely a start of a Generic Type Argument List?
    const isGenericStart = (index: number): boolean => {
        if (meaningfulTokens[index].text !== '<') return false;

        let depth = 0;
        for (let k = index + 1; k < meaningfulTokens.length; k++) {
            const t = meaningfulTokens[k];

            if (t.text === '>') {
                if (depth === 0) return true;
                depth--;
            }
            else if (t.text === '<') depth++;
            else if (t.text === '>>') {
                if (depth === 0) return true;
                depth -= 2;
                if (depth < 0) return true;
            }
            else {
                if ([';', '(', '{', '}', '=', 'return', 'class', 'namespace', 'if', 'for', 'while', 'switch', 'case', 'default'].includes(t.text)) return false;

                if (t.type === TokenType.Operator) {
                    if (t.text === '.' || t.text === ',' || t.text === '?' || t.text === '[' || t.text === ']') continue;
                    return false;
                }

                if (t.type === TokenType.Keyword) {
                    const allowedKeywords = [
                        'bool', 'byte', 'sbyte', 'char', 'decimal', 'double', 'float', 'int', 'uint', 'long', 'ulong', 'object', 'short', 'ushort', 'string', 'void', 'dynamic', 'var',
                        'in', 'out', 'readonly', 'new'
                    ];
                    if (!allowedKeywords.includes(t.text)) return false;
                }
            }
        }
        return false;
    };

    const isCaseColon = (index: number): boolean => {
        if (meaningfulTokens[index].text !== ':') return false;
        for (let k = index - 1; k >= 0; k--) {
            const t = meaningfulTokens[k];
            if (t.text === 'case' || t.text === 'default') return true;
            if (t.text === ';' || t.text === '{' || t.text === '}') return false;
        }
        return false;
    };


    for (let i = 0; i < meaningfulTokens.length; i++) {
        const token = meaningfulTokens[i];
        const next = i + 1 < meaningfulTokens.length ? meaningfulTokens[i+1] : null;
        const prev = i > 0 ? meaningfulTokens[i-1] : null;

        // --- Context Analysis ---

        // Auto-Property detection (get; set;)
        let isCurrentAutoPropStart = false;
        if (token.text === '{') {
            if (next && ['get', 'set', 'init', 'add', 'remove'].includes(next.text)) {
                 let isAccessor = false;
                 let depth = 0;
                 for (let k = i + 1; k < meaningfulTokens.length; k++) {
                     const t = meaningfulTokens[k];
                     if (t.text === '{') depth++;
                     else if (t.text === '}') {
                         if (depth === 0) { isAccessor = true; break; }
                         depth--;
                     }
                     else if (['=', '=>', '(', ')'].includes(t.text)) {
                         if (depth === 0) { isAccessor = false; break; }
                     }
                 }
                 if (isAccessor) {
                     inAutoProp = true;
                     isCurrentAutoPropStart = true;
                 }
            }
        }

        // Initializer detection
        let isInitializerStart = false;
        if (token.text === '{' && !isCurrentAutoPropStart) {
            if (prev) {
                if (['=', '=>', 'return', 'else', 'do'].includes(prev.text)) {
                     if (prev.text === '=' || prev.text === '=>' || prev.text === 'return') isInitializerStart = true;
                }
                else if (prev.text === ']') isInitializerStart = true;
                else if (prev.text === ')') {
                    // Check for new Type() {
                    let p = i - 1;
                    let parenCount = 0;
                    let foundNew = false;
                    while (p >= 0) {
                        const pt = meaningfulTokens[p];
                        if (pt.text === ')') parenCount++;
                        else if (pt.text === '(') {
                            parenCount--;
                            if (parenCount === 0) {
                                let beforeParen = p - 1;
                                if (beforeParen >= 0) {
                                     // Skip generics
                                     if (meaningfulTokens[beforeParen].text === '>') {
                                         let depth = 0;
                                         while (beforeParen >= 0) {
                                             if (meaningfulTokens[beforeParen].text === '>') depth++;
                                             else if (meaningfulTokens[beforeParen].text === '<') {
                                                 depth--;
                                                 if (depth === 0) { beforeParen--; break; }
                                             }
                                             else if (meaningfulTokens[beforeParen].text === ';') break;
                                             beforeParen--;
                                         }
                                     }
                                     // Check for Identifier or new
                                     if (beforeParen >= 0) {
                                         if (meaningfulTokens[beforeParen].text === 'new') foundNew = true;
                                         else if (meaningfulTokens[beforeParen].type === TokenType.Identifier) {
                                             if (beforeParen > 0 && meaningfulTokens[beforeParen-1].text === 'new') foundNew = true;
                                         }
                                     }
                                }
                                break;
                            }
                        }
                        if (pt.text === ';' || pt.text === '{' || pt.text === '}') break; // Safety
                        p--;
                    }
                    if (foundNew) {
                         // Check if it's inside a 'where' clause (constraint)
                         let isConstraint = false;
                         let w = p - 1;
                         while (w >= 0) {
                             const wt = meaningfulTokens[w];
                             if (wt.text === 'where') { isConstraint = true; break; }
                             if (wt.text === ';' || wt.text === '{' || wt.text === '}') break;
                             w--;
                         }
                         if (!isConstraint) isInitializerStart = true;
                    }
                } else if (prev.type === TokenType.Identifier || prev.text === '>') {
                     let p = i - 1;
                     if (prev.text === '>') {
                         let depth = 0;
                         while (p >= 0) {
                             if (meaningfulTokens[p].text === '>') depth++;
                             else if (meaningfulTokens[p].text === '<') {
                                 depth--;
                                 if (depth === 0) { p--; break; }
                             }
                             if (meaningfulTokens[p].text === ';') break;
                             p--;
                         }
                     }
                     if (p >= 0 && meaningfulTokens[p].type === TokenType.Identifier) {
                         if (p > 0 && meaningfulTokens[p-1].text === 'new') isInitializerStart = true;
                     }
                }
            }
        }

        let keepInline = false;
        if (token.text === '{') {
            if (isCurrentAutoPropStart) {
                keepInline = true;
            } else if (isInitializerStart) {
                // Heuristic: keep inline if short and simple
                let length = 0;
                let hasInnerBrace = false;
                for (let k = i + 1; k < meaningfulTokens.length; k++) {
                    const t = meaningfulTokens[k];
                    if (t.text === '}') break;
                    if (t.text === '{') { hasInnerBrace = true; break; }
                    length += t.text.length + 1;
                    if (length > 80) break; // Limit length
                }
                if (!hasInnerBrace && length < 80) keepInline = true;
            } else {
                // Empty block
                if (next && next.text === '}') keepInline = true;
            }
        }

        // --- Dedent before processing token (for closing braces) ---
        if (token.text === '}') {
            indentLevel = Math.max(0, indentLevel - 1);
            if (switchIndentStack.length > 0) {
                const wasCaseIndented = switchIndentStack.pop();
                if (wasCaseIndented) {
                    indentLevel = Math.max(0, indentLevel - 1);
                }
            }
            if (inAutoProp) inAutoProp = false;
        }
        else if (token.text === 'case' || token.text === 'default') {
             if (switchIndentStack.length > 0 && switchIndentStack[switchIndentStack.length - 1]) {
                 indentLevel = Math.max(0, indentLevel - 1);
                 switchIndentStack[switchIndentStack.length - 1] = false;
             }
        }

        // --- Newline Logic ---
        let forceNewline = false;
        let preserveNewline = false;

        if (token.text === '{') {
            if (!keepInline) forceNewline = true;
        }
        else if (token.text === '}') {
            const isInitializerScope = initializerStack.length > 0 && initializerStack[initializerStack.length - 1];
            if (prev && prev.text === '{') {
                // Empty block or start of inline block
            } else {
                if (isInitializerScope) {
                     // Initializer scope - usually keep logic as is (preserve or force)
                } else if (inAutoProp) {
                    // keep inline
                } else {
                    forceNewline = true; // Standard block always new line
                }
            }
        }
        else if (['else', 'catch', 'finally', 'while'].includes(token.text)) {
             if (token.text === 'while' && prev && prev.text === '}') {
                 forceNewline = true; // do-while
             } else {
                 forceNewline = true;
             }
        }
        else if (['where', 'orderby', 'select', 'group', 'join', 'let'].includes(token.text)) {
             forceNewline = true;
        }
        else if (token.text === 'case' || token.text === 'default') {
            forceNewline = true;
        }

        // Preserve Newline Logic
        if (prev && token.line > prev.line) {
             let shouldPreserve = true;

             if (forceNewline) shouldPreserve = false;
             else if (token.text === '{' && keepInline) shouldPreserve = false;
             else if (token.text === '}' && !forceNewline) shouldPreserve = false;
             else if ([';', ',', ')', ']'].includes(token.text)) shouldPreserve = false;
             else if (token.text === '.') shouldPreserve = true;

             if (shouldPreserve) preserveNewline = true;
        }

        // Apply Newline
        if (forceNewline) {
            if (currentLine.trim() !== '') pushLine();
        } else if (preserveNewline) {
            if (currentLine.trim() !== '') pushLine();
        }

        // Blank lines
        if (prev && token.line > prev.line + 1) {
             // Only insert blank line if we actually started a new line (due to force or preserve)
             if (currentLine === '') {
                 if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== '') {
                     outputLines.push('');
                 }
             }
        }

        if (token.text === '[' && currentLine.trim() === '') {
            inAttribute = true;
        }

        // --- Spacing Logic ---
        let spaceBefore = false;

        // 1. Default based on word adjacency
        if (currentLine !== '') {
            const prevWord = /\w$/.test(currentLine) || currentLine.endsWith('?') || currentLine.endsWith(']') || currentLine.endsWith(')');
            const currWord = /^\w/.test(token.text);
            if (prevWord && currWord) spaceBefore = true;
        }

        // 2. Rules based on Previous Token
        if (prev) {
            if (prev.type === TokenType.Operator) {
                 if (prev.text === '.' || prev.text === '?.') spaceBefore = false;
                 else if (prev.text === '<' && angleDepth > 0) spaceBefore = false;
                 else if (['++', '--', '!', '('].includes(prev.text)) spaceBefore = false;
                 else if (prev.text === 'default') spaceBefore = true;
                 else if (prev.text === 'sizeof' || prev.text === 'typeof') spaceBefore = false;
                 else spaceBefore = true;
            }
            else if (prev.type === TokenType.Punctuation) {
                if (['(', '['].includes(prev.text)) spaceBefore = false;
                if (['}', ')', ']', ',', ';'].includes(prev.text)) spaceBefore = true;
                if (prev.text === '{') {
                    // Space after { if it's inline
                    if (currentLine.trim().endsWith('{')) spaceBefore = true;
                }
            }
            else if (prev.type === TokenType.Keyword) {
                if (['if', 'for', 'foreach', 'while', 'switch', 'catch', 'using', 'lock', 'fixed'].includes(prev.text)) {
                    if (token.text === '(') spaceBefore = true;
                }
                else if (['new', 'typeof', 'sizeof', 'default', 'checked', 'unchecked', 'nameof'].includes(prev.text)) {
                    if (token.text === '(') spaceBefore = false;
                    else if (token.text === '[') spaceBefore = false;
                    else spaceBefore = true;
                }
                else spaceBefore = true;
            }
            else if (prev.type === TokenType.Identifier) {
                 if (token.text === '(') spaceBefore = false;
                 if (token.text === '[') spaceBefore = false;
            }
        }

        // 3. Rules based on Current Token
        if (token.type === TokenType.Operator) {
            const text = token.text;

            if (['.', '?.', '::', '++', '--', '!'].includes(text)) spaceBefore = false;
            else if (text === '<') {
                if (isGenericStart(i)) {
                    spaceBefore = false;
                    angleDepth++;
                } else {
                    spaceBefore = true;
                }
            }
            else if (text === '>') {
                if (angleDepth > 0) {
                    spaceBefore = false;
                    angleDepth--;
                } else {
                    spaceBefore = true;
                }
            }
            else if (text === '*' || text === '&') {
                if (prev && prev.type === TokenType.Keyword) spaceBefore = false;
                else if (prev && (prev.text === '(' || prev.text === ',' || prev.text === '=')) spaceBefore = false;
                else spaceBefore = true;
            }
            else if (['=', '+=', '-=', '*=', '/=', '%=', '==', '!=', '<=', '>=', '&&', '||', '+', '-', '/', '%', '^', '|', '??', '??=', '=>', '<<', '>>'].includes(text)) {
                spaceBefore = true;
            }
            else if (text === ':') {
                if (isCaseColon(i)) spaceBefore = false;
                else {
                    if (prev && prev.type === TokenType.Identifier && parenDepth > 0) spaceBefore = false;
                    else spaceBefore = true;
                }
            }
            else if (text === '?') {
                 if (prev && (prev.type === TokenType.Keyword || prev.type === TokenType.Identifier || prev.text === '>')) {
                     if (next && (next.text === ':' || next.type === TokenType.Number || next.type === TokenType.String)) spaceBefore = true;
                     else spaceBefore = false;
                 } else spaceBefore = true;
            }
        }

        if (token.text === ';') spaceBefore = false;
        if (token.text === ',') spaceBefore = false;
        if (token.text === ')') spaceBefore = false;
        if (token.text === ']') spaceBefore = false;
        if (token.text === '{') spaceBefore = true;
        if (token.text === '}') spaceBefore = true;
        if (token.text === '(') {
            if (prev && (prev.type === TokenType.Identifier || prev.text === '>' || prev.text === ')' || prev.text === ']')) spaceBefore = false;
        }

        if (token.text === '.' && currentLine.trim() === '') spaceBefore = false;
        if (token.text === '.') {
             if (prev && prev.text === ')') spaceBefore = false;
        }
        if (token.text === '[') {
            if (prev && prev.type === TokenType.Keyword && ['int', 'string', 'bool', 'byte', 'char', 'long', 'short', 'float', 'double', 'decimal', 'object', 'void'].includes(prev.text)) {
                spaceBefore = false;
            }
        }

        // Comment spacing
        if (token.type === TokenType.Comment) {
             spaceBefore = true;
        }

        if (spaceBefore && currentLine !== '' && !currentLine.endsWith(' ')) append(' ');
        append(token.text);

        // --- Post-Token State Update ---

        if (token.text === ']') {
             if (inAttribute) inAttribute = false;
        }

        if (token.text === '{') {
            indentLevel++;
            initializerStack.push(isInitializerStart || isCurrentAutoPropStart);
            if (!isCurrentAutoPropStart && !inAutoProp) {
                switchIndentStack.push(false);
            }
        }
        else if (token.text === '}') {
            if (initializerStack.length > 0) initializerStack.pop();
        }
        else if (token.text === ':') {
             if (isCaseColon(i)) {
                 if (switchIndentStack.length > 0) {
                     indentLevel++;
                     switchIndentStack[switchIndentStack.length - 1] = true;
                 }
                 pushLine();
             }
        }

        if (token.text === '(') parenDepth++;
        else if (token.text === ')') parenDepth = Math.max(0, parenDepth - 1);
    }

    if (currentLine.trim() !== '') pushLine();

    return outputLines.join('\n');
}
