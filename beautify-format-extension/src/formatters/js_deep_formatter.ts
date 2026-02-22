
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
        type: 'switch' | 'other';
        inline: boolean;
    }
    const blockStack: BlockState[] = [];

    let lastToken: Token | null = null;
    let newlinePending = 0; // 0=none, 1=newline, 2=blank line
    let spacePending = false;
    let pendingSwitch = false;

    // Helper to look ahead for closing brace on same line
    const isShortBlock = (startIndex: number) => {
        let length = 0;
        for (let i = startIndex + 1; i < tokens.length; i++) {
            const t = tokens[i];
            if (t.value === '}') return length < 50;
            if (t.value.includes('\n')) return false;
            length += t.value.length;
            if (length > 50) return false;
        }
        return false;
    };

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const nextToken = tokens[i + 1];

        // --- Pre-processing (Whitespace/Comments) ---
        if (token.type === 'Whitespace') {
            const newlines = (token.value.match(/\n/g) || []).length;
            if (newlines > 1) newlinePending = Math.max(newlinePending, 2);
            else if (newlines === 1) newlinePending = Math.max(newlinePending, 1);
            else if (token.value.includes(' ') || token.value.includes('\t')) spacePending = true;
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

        // --- Core Formatting Logic ---

        // 1. Dedent before closing brace
        if (token.value === '}') {
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
                spacePending = true;
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
        if (token.value === '{') {
            const isSwitch = pendingSwitch;
            pendingSwitch = false;

            if (isShortBlock(i) && !isSwitch) {
                spacePending = true;
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

        // Indent after colon in case/default
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
             spacePending = true; // Space after colon
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

        // Retroactive fixes and Lookahead
        if (nextToken) {
             if (nextToken.value === '{') spacePending = true;

             // Space before operators
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
