
import { tokenize, Token, TokenType } from './js_tokenizer';

interface DeepFormatterOptions {
    tabSize: number;
    insertSpaces: boolean;
    printWidth?: number;
}

export function formatJSDeep(text: string, options: DeepFormatterOptions): string {
    const tokens = tokenize(text);
    if (tokens.length === 0) return '';

    const indentChar = options.insertSpaces ? ' ' : '\t';
    const indentSize = options.insertSpaces ? options.tabSize : 1;

    const getIndent = (level: number) => {
        if (level < 0) level = 0;
        return indentChar.repeat(level * indentSize);
    };

    let formatted = '';
    let indentLevel = 0;

    // Switch Handling State
    const switchBaseLevels: number[] = [];
    // Stack of block types
    interface BlockState {
        type: 'switch' | 'other' | 'jsx' | 'paren';
        inline: boolean;
    }
    const blockStack: BlockState[] = [];

    let lastToken: Token | null = null;
    let newlinePending = 0; // 0=none, 1=newline, 2=blank line
    let spacePending = false;
    let pendingSwitch = false;
    let inJSXTag = false;
    let inDecorator = false;

    // Helper: Get next non-whitespace/comment token
    const getNextRealToken = (index: number): Token | null => {
        for (let k = index + 1; k < tokens.length; k++) {
            const t = tokens[k];
            if (t.type !== 'Whitespace' && t.type !== 'LineComment' && t.type !== 'BlockComment') {
                return t;
            }
        }
        return null;
    };

    // Helper: Get previous non-whitespace/comment token
    const getPrevRealToken = (index: number): Token | null => {
        for (let k = index - 1; k >= 0; k--) {
            const t = tokens[k];
            if (t.type !== 'Whitespace' && t.type !== 'LineComment' && t.type !== 'BlockComment') {
                return t;
            }
        }
        return null;
    };

    // Helper to identify generic brackets <T>
    const isGenericOpen = (index: number) => {
        const prev = getPrevRealToken(index);
        if (!prev) return false;

        // Allowed before generic open: Identifier, ), >, ]
        if (prev.type === 'Identifier' || prev.value === ')' || prev.value === '>' || prev.value === ']') {
            let depth = 1;
            for (let k = index + 1; k < Math.min(index + 50, tokens.length); k++) {
                const t = tokens[k];
                if (t.value === '<') depth++;
                else if (t.value === '>') {
                    depth--;
                    if (depth === 0) return true;
                }
                else if (t.value === ';' || t.value === '{' || t.value === '}' || t.value === '(' || t.value === ')') {
                    return false;
                }
            }
        }
        return false;
    };

    const isGenericClose = (index: number) => {
        let depth = 1;
        for (let k = index - 1; k >= Math.max(0, index - 50); k--) {
             const t = tokens[k];
             if (t.value === '>') depth++;
             else if (t.value === '<') {
                 depth--;
                 if (depth === 0) {
                     return isGenericOpen(k);
                 }
             }
             else if (t.value === ';' || t.value === '{' || t.value === '}' || t.value === '(' || t.value === ')') {
                 return false;
             }
        }
        return false;
    };

    // Helper to look ahead for closing brace on same line
    const isShortBlock = (startIndex: number) => {
        let length = 0;
        for (let i = startIndex + 1; i < tokens.length; i++) {
            const t = tokens[i];
            if (t.value === '}' || t.type === 'TemplateMiddle' || t.type === 'TemplateTail' || t.type === 'JSXExpressionEnd') return length < 50;
            if (t.value.includes('\n')) return false;
            length += t.value.length;
            if (length > 50) return false;
        }
        return false;
    };

    const isShortTag = (startIndex: number) => {
        let length = 0;
        let depth = 1;
        for (let k = startIndex + 1; k < tokens.length; k++) {
            const t = tokens[k];
            if (t.type === 'JSXTagOpen') depth++;
            if (t.type === 'JSXTagClose') depth--;

            if (depth === 0) {
                return length < 60;
            }

            if (t.value.includes('\n') && t.type === 'JSXText') return false;
            length += t.value.length;
            if (length > 60) return false;
        }
        return false;
    };

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const nextToken = tokens[i + 1];
        const nextRealToken = getNextRealToken(i);

        // --- JSX Handling ---
        if (token.type === 'JSXTagOpen') {
             if (newlinePending > 0) {
                 formatted = formatted.trimEnd();
                 formatted += '\n' + getIndent(indentLevel);
                 newlinePending = 0;
                 spacePending = false;
             } else if (!spacePending && formatted.length > 0 && !formatted.endsWith('\n') && !formatted.endsWith('(') && !formatted.endsWith('=')) {
                formatted += ' ';
             }

             formatted += token.value;
             inJSXTag = true;
             spacePending = true;
             // Handle Fragment <>
             if (token.value === '<>' || token.value === '< >') {
                 inJSXTag = false;
                 indentLevel++;
                 blockStack.push({ type: 'jsx', inline: false });
                 newlinePending = 1;
             }
             continue;
        }

        if (token.type === 'JSXTagClose') {
             const currentBlock = blockStack[blockStack.length - 1];
             let isInline = false;
             if (currentBlock && currentBlock.type === 'jsx') {
                 isInline = currentBlock.inline;
                 blockStack.pop();
                 if (!isInline) indentLevel = Math.max(0, indentLevel - 1);
             }

             if (!isInline && (formatted.trimEnd().endsWith('>') || formatted.trimEnd().endsWith('}'))) {
                 newlinePending = 1;
             }

             if (newlinePending > 0) {
                 formatted = formatted.trimEnd();
                 formatted += '\n' + getIndent(indentLevel);
                 newlinePending = 0;
                 spacePending = false;
             }

             formatted += token.value;
             if (!isInline) newlinePending = 1;
             continue;
        }

        if (token.type === 'JSXTagSelfClose') {
             if (spacePending) formatted += ' ';
             formatted += token.value;
             inJSXTag = false;
             newlinePending = 1;
             continue;
        }

        if (token.type === 'JSXAttributeName') {
            if (newlinePending > 0) {
                 formatted = formatted.trimEnd();
                 formatted += '\n' + getIndent(indentLevel + 1);
                 newlinePending = 0;
                 spacePending = false;
            } else if (spacePending) {
                formatted += ' ';
            }
            formatted += token.value;
            spacePending = false;
            continue;
        }

        if (token.type === 'JSXAttributeValue') {
            formatted += token.value;
            spacePending = true;
            continue;
        }

        if (token.type === 'JSXText') {
             if (!token.value.trim()) {
                  if (token.value.includes('\n')) newlinePending = 1;
                  else if (token.value.includes(' ')) spacePending = true;
                  continue;
             }

             if (/^\s/.test(token.value)) spacePending = true;

             if (newlinePending > 0) {
                  formatted = formatted.trimEnd();
                  formatted += '\n' + getIndent(indentLevel);
                  newlinePending = 0;
                  spacePending = false;
             } else if (spacePending) {
                  if (formatted.length > 0 && !formatted.endsWith(' ')) formatted += ' ';
                  spacePending = false;
             }

             formatted += token.value.trim();

             if (/\s$/.test(token.value)) spacePending = true;
             continue;
        }

        if (token.value === '>' && inJSXTag) {
             formatted += '>';
             inJSXTag = false;

             const short = isShortTag(i);
             if (short) {
                 blockStack.push({ type: 'jsx', inline: true });
                 spacePending = false;
             } else {
                 indentLevel++;
                 blockStack.push({ type: 'jsx', inline: false });
                 newlinePending = 1;
             }
             continue;
        }

        // --- Standard JS Handling ---

        // Pre-processing
        if (token.type === 'Whitespace') {
            const newlines = (token.value.match(/\n/g) || []).length;
            if (newlines > 1) newlinePending = Math.max(newlinePending, 2);
            else if (newlines === 1) newlinePending = Math.max(newlinePending, 1);
            else if (token.value.includes(' ') || token.value.includes('\t')) {
                // If previous token was < (generic), or next token is > (generic), suppress space
                // But we need to check if lastToken was specifically a generic open
                // Since we don't have token index in lastToken, we check tokens[i-1]
                const prev = getPrevRealToken(i);
                const next = getNextRealToken(i);

                let suppress = false;
                // Check previous token < generic
                let j = i - 1;
                while (j >= 0 && (tokens[j].type === 'Whitespace' || tokens[j].type === 'LineComment' || tokens[j].type === 'BlockComment')) {
                    j--;
                }
                if (j >= 0 && tokens[j].value === '<' && isGenericOpen(j)) suppress = true;

                // Check next token > generic
                let k = i + 1;
                while (k < tokens.length && (tokens[k].type === 'Whitespace' || tokens[k].type === 'LineComment' || tokens[k].type === 'BlockComment')) {
                    k++;
                }
                if (k < tokens.length && tokens[k].value === '>' && isGenericClose(k)) suppress = true;

                if (lastToken && (lastToken.type === 'TemplateHead' || lastToken.type === 'TemplateMiddle')) {
                    spacePending = false;
                } else if (!suppress) {
                    spacePending = true;
                }
            }
            continue;
        }

        if (token.type === 'LineComment') {
            if (lastToken && lastToken.line === token.line) {
                spacePending = true;
            } else {
                newlinePending = Math.max(newlinePending, 1);
            }
            if (newlinePending > 0) {
                formatted = formatted.trimEnd();
                formatted += '\n'.repeat(newlinePending) + getIndent(indentLevel);
                newlinePending = 0;
                spacePending = false;
            } else if (spacePending) {
                 if (formatted.length > 0 && !formatted.endsWith(' ')) formatted += ' ';
                spacePending = false;
            }
            formatted += token.value;
            newlinePending = 1;
            lastToken = token;
            continue;
        }

        if (token.type === 'BlockComment') {
             if (newlinePending > 0) {
                formatted = formatted.trimEnd();
                formatted += '\n'.repeat(newlinePending) + getIndent(indentLevel);
                newlinePending = 0;
                spacePending = false;
            } else if (spacePending) {
                 if (formatted.length > 0 && !formatted.endsWith(' ')) formatted += ' ';
                spacePending = false;
            }
            formatted += token.value;
            spacePending = true;
            lastToken = token;
            continue;
        }

        // Decorator Handling: ensure newline after decorator expression
        if (token.type === 'Decorator') {
            if (newlinePending > 0) {
                formatted = formatted.trimEnd();
                formatted += '\n'.repeat(newlinePending) + getIndent(indentLevel);
                newlinePending = 0;
            }
            formatted += token.value; // @
            spacePending = false; // No space after @
            inDecorator = true;
            lastToken = token;
            continue;
        }

        // Handle Identifier after Decorator (@foo)
        if (inDecorator && token.type === 'Identifier') {
            // This is the decorator name
            formatted += token.value;
            // Check if next *real* token is (
            if (nextRealToken && nextRealToken.value === '(') {
                // Continue decorator
            } else {
                // End of decorator
                inDecorator = false;
                newlinePending = 1;
            }
            lastToken = token;
            continue;
        }

        // Open Paren/Bracket
        if (token.value === '(' || token.value === '[') {
             let isBlock = false;

             if (nextToken && nextToken.type === 'Whitespace' && nextToken.value.includes('\n')) {
                 isBlock = true;
             }

             if (inDecorator && token.value === '(') {
                 // Decorator args
                 isBlock = false; // Usually inline
             }

             if (newlinePending > 0) {
                formatted = formatted.trimEnd();
                formatted += '\n'.repeat(newlinePending) + getIndent(indentLevel);
                newlinePending = 0;
                spacePending = false;
             } else if (spacePending) {
                 if (formatted.length > 0 && !formatted.endsWith(' ')) formatted += ' ';
                spacePending = false;
             }

             formatted += token.value;
             if (isBlock) {
                 indentLevel++;
                 blockStack.push({ type: 'paren', inline: false });
             } else {
                 blockStack.push({ type: 'paren', inline: true });
             }
             continue;
        }

        // Close Paren/Bracket
        if (token.value === ')' || token.value === ']') {
             spacePending = false;

             const block = blockStack.pop();
             if (block && !block.inline) {
                 indentLevel = Math.max(0, indentLevel - 1);
                 if (newlinePending === 0) {
                     if (!formatted.endsWith('\n') && !formatted.endsWith('\t')) {
                         newlinePending = 1;
                     }
                 }
             }

             if (newlinePending > 0) {
                formatted = formatted.trimEnd();
                formatted += '\n' + getIndent(indentLevel);
                newlinePending = 0;
                spacePending = false;
            }

             formatted += token.value;

             if (inDecorator && token.value === ')') {
                 inDecorator = false;
                 newlinePending = 1;
             }

             continue;
        }

        // 1. Dedent before closing brace
        if (token.value === '}' || token.type === 'TemplateMiddle' || token.type === 'TemplateTail' || token.type === 'JSXExpressionEnd') {
            const currentBlock = blockStack.pop();
            const isInline = currentBlock ? currentBlock.inline : false;

            if (currentBlock && currentBlock.type === 'switch') {
                const base = switchBaseLevels.pop();
                if (base !== undefined) indentLevel = base;
            } else {
                indentLevel = Math.max(0, indentLevel - 1);
            }

            if (!isInline) {
                 newlinePending = 1;
            } else {
                if (token.type === 'TemplateMiddle' || token.type === 'TemplateTail') {
                    spacePending = false;
                } else {
                    spacePending = true;
                }

                if (token.type === 'JSXExpressionEnd') {
                     spacePending = false;
                }
                newlinePending = 0;
            }
        }

        // 2. Case/Default Alignment
        if ((token.value === 'case' || token.value === 'default') && blockStack.length > 0 && blockStack[blockStack.length - 1].type === 'switch') {
             const base = switchBaseLevels[switchBaseLevels.length - 1];
             indentLevel = base + 1;
             newlinePending = 1;
        }

        // 3. Prevent space before certain punctuation
        if ([':', '.', ')', ']', ';', ','].includes(token.value)) {
            spacePending = false;
        }

        // 4. Handle Arrow Function =>
        if (token.value === '=>') {
            spacePending = true;
        }

        // Space before operators
        if (token.type === 'Operator') {
             if (token.value === '<' && isGenericOpen(i)) {
                 // Handled above
             } else if (token.value === '>' && isGenericClose(i)) {
                 // Handled above
             } else {
                 if (!['!', '++', '--', '~', '?.', '.', '?'].includes(token.value)) {
                     spacePending = true;
                 }
                 if (inJSXTag && token.value === '=') {
                     spacePending = false;
                 }
                 if (token.value === '?') {
                     if (nextToken && (nextToken.value === ':' || nextToken.value === '(' || nextToken.value === '.')) {
                         spacePending = false;
                     } else {
                         spacePending = true;
                     }
                 }
             }
        }

        // Apply Newline/Indentation
        if (newlinePending > 0) {
            formatted = formatted.trimEnd();
            formatted += '\n'.repeat(newlinePending) + getIndent(indentLevel);
            newlinePending = 0;
            spacePending = false;
        } else if (spacePending) {
             if (formatted.length > 0 && !formatted.endsWith(' ') && !formatted.endsWith('\n') && !formatted.endsWith('\t')) {
                formatted += ' ';
             }
             spacePending = false;
        }

        // Append Token
        // Generic Handling: Avoid space before < if generic
        if (token.value === '<' && isGenericOpen(i)) {
             if (formatted.endsWith(' ')) {
                 formatted = formatted.trimEnd(); // Remove space before generic <
             }
             formatted += token.value;
             lastToken = token;

             spacePending = false; // Suppress space for next token
             continue;
        }

        // Handle > generic close
        if (token.value === '>' && isGenericClose(i)) {
             if (formatted.endsWith(' ')) {
                 formatted = formatted.trimEnd(); // Remove space before generic >
             }
             formatted += token.value;
             lastToken = token;
             continue;
        }

        // If it was arrow function =>, ensure space before
        if (token.value === '=>') {
             if (!formatted.endsWith(' ')) {
                 formatted += ' ';
             }
        }

        formatted += token.value;

        // 4. Post-Token Logic

        // Indent after open brace
        if (token.value === '{' || token.type === 'TemplateHead' || token.type === 'TemplateMiddle' || token.type === 'JSXExpressionStart') {
            const isSwitch = pendingSwitch;
            pendingSwitch = false;

            if (isShortBlock(i) && !isSwitch) {
                if (token.type === 'TemplateHead' || token.type === 'TemplateMiddle' || token.type === 'JSXExpressionStart') {
                    spacePending = false;
                } else {
                    spacePending = true;
                }

                indentLevel++;
                blockStack.push({ type: 'other', inline: true });
            } else {
                newlinePending = 1;

                if (isSwitch) {
                    switchBaseLevels.push(indentLevel);
                    blockStack.push({ type: 'switch', inline: false });
                    indentLevel++;
                } else {
                    blockStack.push({ type: 'other', inline: false });
                    indentLevel++;
                }
            }
        }

        if (token.value === 'switch' && token.type === 'Keyword') {
            pendingSwitch = true;
        }

        // Indent after colon (Switch Case)
        if (token.value === ':' && blockStack.length > 0 && blockStack[blockStack.length - 1].type === 'switch') {
             const base = switchBaseLevels[switchBaseLevels.length - 1];
             if (indentLevel === base + 1) {
                 indentLevel++;
                 newlinePending = 1;
             } else {
                 spacePending = true;
             }
        }
        else if (token.value === ':') {
             spacePending = true;
        }

        // Newline after semicolon
        if (token.value === ';') {
            const currentBlock = blockStack[blockStack.length - 1];
            if (currentBlock && currentBlock.inline) {
                spacePending = true;
            } else {
                const lastNewline = formatted.lastIndexOf('\n');
                const currentLine = formatted.substring(lastNewline + 1);
                if (!currentLine.includes('for (')) {
                    newlinePending = 1;
                } else {
                    spacePending = true;
                }
            }
        }

        // Space after keywords
        if (token.type === 'Keyword') {
             if (['if', 'for', 'while', 'switch', 'catch', 'async'].includes(token.value)) {
                 spacePending = true;
             } else if (['else', 'return', 'throw', 'export', 'import', 'from', 'case', 'extends', 'implements', 'type', 'interface'].includes(token.value)) {
                 spacePending = true;
             }
        }

        // Space around operators
        if (token.type === 'Operator') {
             // TS Generics check inside operator logic to handle edge cases
             if (token.value === '<' && isGenericOpen(i)) {
                 // Handled above
             } else if (token.value === '>' && isGenericClose(i)) {
                 // Handled above
             } else {
                 if (!['!', '++', '--', '~', '?.', '.', '?'].includes(token.value)) {
                     spacePending = true;
                 }
                 if (inJSXTag && token.value === '=') {
                     spacePending = false;
                 }
                 if (token.value === '?') {
                     if (nextToken && (nextToken.value === ':' || nextToken.value === '(' || nextToken.value === '.')) {
                         spacePending = false;
                     } else {
                         spacePending = true;
                     }
                 }
             }
        }

        // Space after comma
        if (token.value === ',') {
            spacePending = true;
        }

        // Retroactive fixes
        if (nextToken) {
             if (nextToken.value === '{' && token.value !== '(' && token.value !== '[') {
                 // Check if we are in JSX attribute (e.g. value={...})
                 // If previous token was = and inJSXTag, then NO space.
                 if (!(inJSXTag && token.value === '=')) {
                     spacePending = true;
                 }

             }

             // Ensure space before => if current is )
             if (token.value === ')' && nextToken.value === '=>') {
                 spacePending = true;
             }

             // Ensure space before { if current is )
             if (token.value === ')' && nextToken.value === '{') {
                 spacePending = true;
             }
        }

        lastToken = token;
    }

    return formatted.trim() + '\n';
}
