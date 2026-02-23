
import { tokenize, Token, TokenType } from './mongodb_tokenizer';

interface DeepFormatterOptions {
    tabSize: number;
    insertSpaces: boolean;
    printWidth?: number;
}

export function formatMongoDBDeep(text: string, options: DeepFormatterOptions = { tabSize: 2, insertSpaces: true, printWidth: 120 }): string {
    // --- Pre-processing: Sort Imports (require/import) ---
    // We carefully sort only consecutive blocks of `import ...` or `const ... = require(...)`
    // We do NOT sort `load()` or `use` as order matters significantly in scripts.
    const lines = text.split('\n');
    const sortedLines: string[] = [];
    let importBlock: string[] = [];
    let isImportBlock = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Check for import/require
        const isImport = /^import\s/.test(trimmed) || /^(const|let|var)\s+.*=\s*require\(/.test(trimmed);

        if (isImport) {
            importBlock.push(line);
            isImportBlock = true;
        } else {
            if (isImportBlock) {
                // End of block, sort and push
                // Sort by clean content (ignoring variable names for now, simple string sort)
                // Ideally we parse, but line-based sort is standard for "Optimize Imports"
                importBlock.sort();
                sortedLines.push(...importBlock);
                importBlock = [];
                isImportBlock = false;
            }
            // If empty line between imports, maybe keep accumulating?
            // Standard behavior usually breaks block on empty line or comment.
            // We'll break on non-empty non-import.
            if (trimmed === '' && isImportBlock) {
                 // allow gaps? No, simpler to flush.
            }
            sortedLines.push(line);
        }
    }
    if (isImportBlock) {
        importBlock.sort();
        sortedLines.push(...importBlock);
    }

    text = sortedLines.join('\n');

    // --- Tokenization ---
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
        type: 'object' | 'array' | 'function' | 'other';
        inline: boolean;
    }
    const blockStack: BlockState[] = [];

    let lastToken: Token | null = null;
    let newlinePending = 0; // 0=none, 1=newline, 2=blank line
    let spacePending = false;

    // Helper to look ahead for closing brace on same line
    const isShortBlock = (startIndex: number) => {
        let length = 0;
        for (let i = startIndex + 1; i < tokens.length; i++) {
            const t = tokens[i];
            if (t.value === '}' || t.value === ']') return length < 50;
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
                currentLineLength = indentLevel * indentSize;
                newlinePending = 0;
                spacePending = false;
            } else if (spacePending) {
                 if (formatted.length > 0 && !formatted.endsWith(' ')) { formatted += ' '; currentLineLength++; }
                spacePending = false;
            }
            formatted += token.value;
            currentLineLength += token.value.length;
            newlinePending = 1;
            lastToken = token;
            continue;
        }

        if (token.type === 'BlockComment') {
             if (newlinePending > 0) {
                formatted = formatted.trimEnd();
                formatted += '\n'.repeat(newlinePending) + getIndent(indentLevel);
                currentLineLength = indentLevel * indentSize;
                newlinePending = 0;
                spacePending = false;
            } else if (spacePending) {
                 if (formatted.length > 0 && !formatted.endsWith(' ')) { formatted += ' '; currentLineLength++; }
                spacePending = false;
            }
            formatted += token.value;
            currentLineLength += token.value.length;
            spacePending = true;
            lastToken = token;
            continue;
        }

        // --- Core Formatting Logic ---

        // 1. Dedent before closing brace/bracket
        if (token.value === '}' || token.value === ']') {
            const currentBlock = blockStack.pop();
            const isInline = currentBlock ? currentBlock.inline : false;

            indentLevel = Math.max(0, indentLevel - 1);

            if (!isInline) {
                 newlinePending = 1;
            } else {
                spacePending = true;
                newlinePending = 0;
            }
        }

        // 2. MongoDB Shell Commands
        if (token.type === 'Keyword' && ['use', 'show', 'exit', 'quit', 'cls'].includes(token.value)) {
            if (lastToken && lastToken.value !== ';') {
                newlinePending = Math.max(newlinePending, 1);
            } else {
                newlinePending = Math.max(newlinePending, 1);
            }
        }

        // 3. Prevent space before certain punctuation
        if ([':', '.', ')', ']', ';', ','].includes(token.value)) {
            spacePending = false;
        }

        // 4. Line Wrapping (Basic)
        // If adding this token would exceed printWidth, force a newline
        // Only if we are not already pending newline
        // And if token is not punctuation that should stay attached (like , or ;) - actually usually we break AFTER , or ;
        // We break BEFORE operators or long strings
        if (newlinePending === 0 && currentLineLength + (spacePending ? 1 : 0) + token.value.length > printWidth) {
            // Check if we can break here
            // Good break points: Before Operator, After Comma (handled by comma logic), Before Keyword
            // We avoid breaking inside strings or short identifiers if possible, but hard limit enforcement requires it.
            // For now, let's break if it's safe-ish.
            if (token.type !== 'Punctuation' || token.value === '{' || token.value === '[') {
                 // Indent + 1 for wrapped line?
                 // Simple strategy: newline + indent + 1 level?
                 // For deep formatter, we usually respect indentation.
                 // Let's just force newlinePending=1.
                 newlinePending = 1;
                 // Maybe bump indent for continuation?
                 // Handling continuation indent is tricky without AST.
                 // We will skip explicit continuation indent for now to rely on block structure.
            }
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

        // 5. Post-Token Logic

        // Indent after open brace/bracket
        if (token.value === '{' || token.value === '[') {
            const isShort = isShortBlock(i);

            if (isShort) {
                spacePending = true;
                indentLevel++;
                blockStack.push({ type: token.value === '{' ? 'object' : 'array', inline: true });
            } else {
                newlinePending = 1;
                blockStack.push({ type: token.value === '{' ? 'object' : 'array', inline: false });
                indentLevel++;
            }
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
             if (['if', 'for', 'while', 'switch', 'catch', 'async', 'use', 'show', 'return', 'throw', 'case'].includes(token.value)) {
                 spacePending = true;
             }
        }

        // Space around operators
        if (token.type === 'Operator') {
             if (!['!', '++', '--', '~', '?.', '.', '(', ')', '[', ']'].includes(token.value)) {
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
                 if (nextToken.value === '(') {
                 } else {
                     newlinePending = 1;
                 }
             }

             if (nextToken.type === 'Operator' && !['!', '++', '--', '~', '?.', '.', '(', ')', '[', ']', ';', ','].includes(nextToken.value)) {
                 spacePending = true;
             }
        }

        lastToken = token;
    }

    return formatted.trim() + '\n';
}
