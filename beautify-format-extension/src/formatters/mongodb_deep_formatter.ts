
import { tokenize, Token, TokenType } from './mongodb_tokenizer';

interface DeepFormatterOptions {
    tabSize: number;
    insertSpaces: boolean;
    printWidth?: number;
}

export async function formatMongoDBDeep(text: string, options: DeepFormatterOptions = { tabSize: 2, insertSpaces: true, printWidth: 120 }): Promise<string> {
    try {
        // --- 1. Attempt Prettier Formatting with Masking ---
        const prettier = await import('prettier');

        // Mask lines that start with MongoDB Shell commands (use, show, it, cls, exit, quit)
        // These are not valid JS, so we comment them out for Prettier.
        const lines = text.split('\n');
        const maskedLines: string[] = [];
        const maskedIndices: number[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            // Check for shell commands at start of line
            if (/^(use|show|it|cls|exit|quit)(\s|$)/.test(trimmed)) {
                maskedLines.push(`// SHELL_CMD_MASK_${i}: ${line}`);
                maskedIndices.push(i);
            } else {
                maskedLines.push(line);
            }
        }

        const maskedText = maskedLines.join('\n');

        // Format with Prettier (parser: 'babel' handles modern JS/TS features used in MongoDB Shell)
        const formattedMasked = await prettier.format(maskedText, {
            parser: 'babel',
            tabWidth: options.tabSize,
            useTabs: !options.insertSpaces,
            printWidth: options.printWidth,
            semi: false, // MongoDB Shell usually omits semis
            singleQuote: false, // MongoDB usually uses double quotes
            trailingComma: 'none', // Strict JSON style often preferred
            bracketSpacing: true, // { foo: bar }
            arrowParens: 'avoid',
        });

        // Restore masked lines
        // The formatter might have moved comments or changed indentation.
        // We look for the marker pattern.
        const restoredLines = formattedMasked.split('\n').map(line => {
            const match = line.match(/\/\/ SHELL_CMD_MASK_(\d+): (.*)$/);
            if (match) {
                // Restore original content, but keep indentation if possible?
                // Actually, for shell commands, we usually want them at indentation level 0 or current level.
                // Since they are top-level commands usually, let's just restore the content.
                // But wait, if they were indented (e.g. inside a block? No, usually top level).
                // If they were indented, Prettier might have indented the comment.
                // Let's preserve the indentation of the comment.
                const indent = line.substring(0, line.indexOf('//'));
                return indent + match[2].trim();
            }
            return line;
        });

        return restoredLines.join('\n');

    } catch (error) {
        // Fallback to resilient token-based formatting
        // console.warn('Prettier formatting failed, falling back to custom deep formatter:', error);
        return formatMongoDBDeepFallback(text, options);
    }
}

function formatMongoDBDeepFallback(text: string, options: DeepFormatterOptions): string {
    const tokens = tokenize(text);
    if (tokens.length === 0) return '';

    const indentChar = options.insertSpaces ? ' ' : '\t';
    const indentSize = options.insertSpaces ? options.tabSize : 1;
    const printWidth = options.printWidth || 120;

    const getIndent = (level: number) => {
        if (level < 0) level = 0;
        return indentChar.repeat(level * indentSize);
    };

    let formatted = '';
    let indentLevel = 0;
    let currentLineLength = 0;

    // Stack of block types
    interface BlockState {
        type: 'object' | 'array' | 'function' | 'paren' | 'other';
        inline: boolean;
    }
    const blockStack: BlockState[] = [];

    let lastToken: Token | null = null;
    let newlinePending = 0; // 0=none, 1=newline, 2=blank line
    let spacePending = false;

    // Helper to look ahead for closing brace on same line
    const isShortBlock = (startIndex: number) => {
        let length = 0;
        let depth = 1;
        for (let i = startIndex + 1; i < tokens.length; i++) {
            const t = tokens[i];
            if (t.value === '{' || t.value === '[') depth++;
            if (t.value === '}' || t.value === ']') depth--;

            if (depth === 0) return length < 50;

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
            else if (token.value.includes(' ') || token.value.includes('\t')) {
                 // Only add space if not already pending and not at start of line
                 if (!newlinePending) spacePending = true;
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

        // --- Core Formatting Logic ---

        // 1. Dedent before closing brace/bracket
        if (token.value === '}' || token.value === ']' || token.value === ')') {
            const currentBlock = blockStack.pop();
            const isInline = currentBlock ? currentBlock.inline : false;

            if (token.value !== ')') {
                indentLevel = Math.max(0, indentLevel - 1);
            }

            if (!isInline && token.value !== ')') {
                 newlinePending = 1;
            } else {
                if (token.value === '}') {
                    spacePending = true; // space before closing brace in inline object
                } else {
                    spacePending = false; // no space before closing bracket/paren
                }

                if (token.value === ')') {
                    spacePending = false;
                }
                newlinePending = 0;
            }
        }

        // 2. MongoDB Shell Commands
        if (token.type === 'Keyword' && ['use', 'show', 'exit', 'quit', 'cls'].includes(token.value)) {
            if (lastToken && lastToken.value !== ';') {
                newlinePending = Math.max(newlinePending, 1);
            }
        }

        // 3. Prevent space before certain punctuation
        if ([':', '.', ')', ']', ';', ','].includes(token.value)) {
            spacePending = false;
        }

        // Apply Newline/Indentation
        if (newlinePending > 0) {
            formatted = formatted.trimEnd();
            formatted += '\n'.repeat(newlinePending) + getIndent(indentLevel);
            currentLineLength = indentLevel * indentSize;
            newlinePending = 0;
            spacePending = false;
        } else if (spacePending) {
             if (formatted.length > 0 && !formatted.endsWith(' ') && !formatted.endsWith('\n') && !formatted.endsWith('\t')) {
                formatted += ' ';
                currentLineLength++;
             }
             spacePending = false;
        }

        // Append Token
        formatted += token.value;
        currentLineLength += token.value.length;

        // 4. Post-Token Logic

        // Indent after open brace/bracket
        if (token.value === '{' || token.value === '[') {
            const isShort = isShortBlock(i);

            if (isShort) {
                if (token.value === '{') spacePending = true; // space after open brace
                else spacePending = false; // no space after open bracket

                blockStack.push({ type: token.value === '{' ? 'object' : 'array', inline: true });
                // Indent level doesn't change for inline
            } else {
                newlinePending = 1;
                blockStack.push({ type: token.value === '{' ? 'object' : 'array', inline: false });
                indentLevel++;
            }
        }

        if (token.value === '(') {
            blockStack.push({ type: 'paren', inline: true }); // Treat parens as inline mostly, unless manual break
            spacePending = false;
        }

        // Space after colon
        if (token.value === ':') {
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
             if (['if', 'for', 'while', 'switch', 'catch', 'async', 'use', 'show', 'return', 'throw', 'case', 'function'].includes(token.value)) {
                 spacePending = true;
             }
        }

        // Space around operators
        if (token.type === 'Operator') {
             // Handle Unary Minus: if previous token was operator, keyword, or block start, then it's unary
             let isUnary = false;
             if (token.value === '-' || token.value === '+' || token.value === '!') {
                 if (!lastToken ||
                     lastToken.type === 'Operator' ||
                     lastToken.type === 'Keyword' ||
                     ['(', '[', '{', ',', ';', ':'].includes(lastToken.value)) {
                     isUnary = true;
                 }
             }

             if (isUnary) {
                 spacePending = false;
             } else if (!['++', '--', '~', '?.', '.', '(', ')', '[', ']'].includes(token.value)) {
                 spacePending = true;
             }
        }

        // Space after comma
        if (token.value === ',') {
            const currentBlock = blockStack[blockStack.length - 1];
            if (currentBlock && !currentBlock.inline) {
                newlinePending = 1;
            } else {
                spacePending = true;
            }
        }

        // Retroactive fixes and Lookahead
        if (nextToken) {
             if (nextToken.value === '{') spacePending = true;

             if (token.value === 'it' && token.type === 'Keyword') {
                 if (nextToken.value !== '(') {
                     newlinePending = 1;
                 }
             }

             if (nextToken.type === 'Operator') {
                 // Check if next is unary
                 let nextIsUnary = false;
                 if (nextToken.value === '-' || nextToken.value === '+' || nextToken.value === '!') {
                      // current token is token.value.
                      // if current is operator/keyword/punctuation, then next is unary.
                      if (token.type === 'Operator' || token.type === 'Keyword' || ['(', '[', '{', ',', ';', ':'].includes(token.value)) {
                          nextIsUnary = true;
                      }
                 }

                 if (!nextIsUnary && !['!', '++', '--', '~', '?.', '.', '(', ')', '[', ']', ';', ','].includes(nextToken.value)) {
                     spacePending = true;
                 }
             }
        }

        lastToken = token;
    }

    return formatted.trim() + '\n';
}
