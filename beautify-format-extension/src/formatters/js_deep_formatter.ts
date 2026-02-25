
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
                if (lastToken && (lastToken.type === 'TemplateHead' || lastToken.type === 'TemplateMiddle')) {
                    spacePending = false;
                } else {
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

        // Open Paren/Bracket
        if (token.value === '(' || token.value === '[') {
             let isBlock = false;
             if (nextToken && nextToken.type === 'Whitespace' && nextToken.value.includes('\n')) {
                 isBlock = true;
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

        // Indent after colon
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
            const lastNewline = formatted.lastIndexOf('\n');
            const currentLine = formatted.substring(lastNewline + 1);
            if (!currentLine.includes('for (')) {
                newlinePending = 1;
            } else {
                spacePending = true;
            }
        }

        // Space after keywords
        if (token.type === 'Keyword') {
             if (['if', 'for', 'while', 'switch', 'catch', 'async'].includes(token.value)) {
                 spacePending = true;
             } else if (['else', 'return', 'throw', 'export', 'import', 'from', 'case', 'extends', 'implements'].includes(token.value)) {
                 spacePending = true;
             }
        }

        // Space around operators
        if (token.type === 'Operator') {
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

             if (nextToken.type === 'Operator' && !['!', '++', '--', '~', '?.', '.', '(', ')', '[', ']', ';', ','].includes(nextToken.value)) {
                 if (nextToken.value === '?') {
                     const nextNext = tokens[i+2];
                     if (nextNext && (nextNext.value === ':' || nextNext.value === '(')) {
                         // No space before ?
                     } else {
                         spacePending = true;
                     }
                 } else {
                     spacePending = true;
                 }
             }
        }

        lastToken = token;
    }

    return formatted.trim() + '\n';
}
