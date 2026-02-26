
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

    // Switch case indentation handling
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
            if (['from', 'where', 'orderby', 'select', 'group', 'join', 'let'].includes(trimmedStr)) {
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
                if (depth === 0) {
                     return true;
                }
                depth--;
            }
            else if (t.text === '<') {
                depth++;
            }
            else if (t.text === '>>') {
                if (depth === 0) return true;
                depth -= 2;
                if (depth < 0) return true;
            }
            else {
                if ([';', '(', '{', '}', '=', 'return', 'class', 'namespace', 'if', 'for', 'while', 'switch', 'case', 'default'].includes(t.text)) {
                    return false;
                }

                if (t.type === TokenType.Operator) {
                    if (t.text === '.' || t.text === ',' || t.text === '?') continue;
                    if (t.text === '[') {
                        let arrayCloseFound = false;
                        for (let m = k + 1; m < meaningfulTokens.length; m++) {
                            const nt = meaningfulTokens[m];
                            if (nt.text === ']') { arrayCloseFound = true; k = m; break; }
                            if (nt.text === ',') continue;
                            if (nt.type === TokenType.Whitespace || nt.type === TokenType.Newline) continue;
                            return false;
                        }
                        if (!arrayCloseFound) return false;
                        continue;
                    }
                    return false;
                }

                if (t.type === TokenType.Keyword) {
                    const allowedKeywords = [
                        'bool', 'byte', 'sbyte', 'char', 'decimal', 'double', 'float', 'int', 'uint', 'long', 'ulong', 'object', 'short', 'ushort', 'string', 'void', 'dynamic', 'var',
                        'in', 'out', 'readonly'
                    ];
                    if (!allowedKeywords.includes(t.text)) return false;
                }

                if (t.type === TokenType.Punctuation) {
                     if (t.text === ',') continue;
                     if (t.text === '[') {
                        // Same array logic as above (in case [ is punctuation)
                        let arrayCloseFound = false;
                        for (let m = k + 1; m < meaningfulTokens.length; m++) {
                            const nt = meaningfulTokens[m];
                            if (nt.text === ']') { arrayCloseFound = true; k = m; break; }
                            if (nt.text === ',') continue;
                            if (nt.type === TokenType.Whitespace || nt.type === TokenType.Newline) continue;
                            return false;
                        }
                        if (!arrayCloseFound) return false;
                        continue;
                     }
                     // Any other punctuation is INVALID
                     return false;
                }

                if (t.type === TokenType.Number || t.type === TokenType.String || t.type === TokenType.Char) return false;
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

        // --- Pre-Analysis / Context Updates ---

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
                         if (depth === 0) {
                             isAccessor = true;
                             break;
                         }
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

        // --- Newline Logic ---
        let forceNewline = false;
        let preserveNewline = false;

        if (token.text === '{') {
            if (!inAutoProp) {
                const isInitializer = prev && (['new', '=', '=>', 'return', 'else'].includes(prev.text) || prev.text === ']' || prev.text === ')');
                if (prev && (prev.text === '=>' || prev.text === '=')) {
                    // Allow inline
                } else if (isInitializer) {
                    // Allow inline
                } else {
                    forceNewline = true;
                }
            }
        }
        else if (token.text === '}') {
            if (!inAutoProp) {
                if (prev && prev.text === '{') {
                     // Empty block
                } else {
                    forceNewline = true;
                }
            }
        }
        else if (['else', 'catch', 'finally', 'while'].includes(token.text)) {
             if (token.text === 'while') {
                 if (prev && prev.text === '}') {
                     forceNewline = true;
                 } else {
                     forceNewline = true;
                 }
             } else {
                 forceNewline = true;
             }
        }
        else if (['from', 'where', 'select', 'group', 'orderby', 'join', 'let'].includes(token.text)) {
             if (prev && token.line > prev.line) preserveNewline = true;
        }
        else if (token.text === '.') {
             if (prev && token.line > prev.line) preserveNewline = true;
        }
        else if (prev && token.line > prev.line) {
             if (token.text !== ';' && token.text !== ',' && token.text !== ')' && token.text !== ']') {
                 preserveNewline = true;
             }
        }

        // --- Dedent Logic ---
        if (token.text === '}') {
            // Always decrement indentation when closing a block
            indentLevel = Math.max(0, indentLevel - 1);

            if (!inAutoProp) {
                if (switchIndentStack.length > 0) {
                     const wasCaseIndented = switchIndentStack.pop();
                     if (wasCaseIndented) {
                         indentLevel = Math.max(0, indentLevel - 1);
                     }
                }
            }
            if (inAutoProp) inAutoProp = false;
        }
        else if (token.text === 'case' || token.text === 'default') {
             if (switchIndentStack.length > 0 && switchIndentStack[switchIndentStack.length - 1]) {
                 indentLevel = Math.max(0, indentLevel - 1);
                 switchIndentStack[switchIndentStack.length - 1] = false;
             }
             forceNewline = true;
        }

        // --- Apply Newline ---
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
                if (prev.text === '{') spaceBefore = true;
            }
            else if (prev.type === TokenType.Keyword) {
                if (['if', 'for', 'foreach', 'while', 'switch', 'catch', 'using', 'lock', 'fixed'].includes(prev.text)) {
                    if (token.text === '(') spaceBefore = true;
                }
                else if (['new', 'typeof', 'sizeof', 'default', 'checked', 'unchecked', 'nameof'].includes(prev.text)) {
                    if (token.text === '(') spaceBefore = false;
                    else spaceBefore = true;
                }
                else {
                    spaceBefore = true;
                }
            }
            else if (prev.type === TokenType.Identifier) {
                 if (token.text === '(') spaceBefore = false;
            }
        }

        // 3. Rules based on Current Token (Override)
        if (token.type === TokenType.Operator) {
            const text = token.text;

            if (['.', '?.', '::', '++', '--', '!'].includes(text)) {
                spaceBefore = false;
            }
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
                // else if (prev && prev.type === TokenType.Identifier && /^[A-Z]/.test(prev.text)) spaceBefore = false; // Too risky for properties
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
                     if (next && (next.text === ':' || next.type === TokenType.Number || next.type === TokenType.String)) {
                         spaceBefore = true; // Ternary
                     } else {
                         spaceBefore = false; // Nullable
                     }
                 } else {
                     spaceBefore = true;
                 }
            }
        }

        // Punctuation overrides
        if (token.text === ';') spaceBefore = false;
        if (token.text === ',') spaceBefore = false;
        if (token.text === ')') spaceBefore = false;
        if (token.text === ']') spaceBefore = false;
        if (token.text === '{') spaceBefore = true;
        if (token.text === '(') {
            if (prev && (prev.type === TokenType.Identifier || prev.text === '>' || prev.text === ')' || prev.text === ']')) spaceBefore = false;
        }

        if (spaceBefore && currentLine !== '' && !currentLine.endsWith(' ')) append(' ');
        append(token.text);

        // --- Post-Token State Update ---

        if (token.text === '{') {
            indentLevel++;
            if (!isCurrentAutoPropStart && !inAutoProp) {
                switchIndentStack.push(false);
            }
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
        else if (token.text === ']' && inAttribute) {
            inAttribute = false;
        }

        if (token.text === '(') parenDepth++;
        else if (token.text === ')') parenDepth = Math.max(0, parenDepth - 1);
    }

    if (currentLine.trim() !== '') pushLine();

    return outputLines.join('\n');
}
