// ... (imports)

// Re-implementing with improvements...
// I will rewrite the whole file to ensure correctness as I cannot edit partial content easily.

export async function formatSQLDeep(text: string): Promise<string> {
    try {
        const { format } = await import('sql-formatter');

        // 1. Base Formatting with sql-formatter
        let formatted = format(text, {
            language: 'sql',
            keywordCase: 'upper',
            tabWidth: 4,
            linesBetweenQueries: 2,
            indentStyle: 'standard'
        });

        // 2. Post-processing for Deep Formatting
        return processSQLDeep(formatted);
    } catch (e) {
        // Fallback immediately if sql-formatter fails
        return formatSQLFallback(text);
    }
}

/**
 * Shared post-processing logic for alignment (AS aliases)
 */
function processSQLDeep(text: string): string {
    const lines = text.split('\n');
    const processedLines: string[] = [];

    // Alignment logic for AS aliases
    let buffer: { line: string, asIndex: number }[] = [];

    function flushBuffer() {
        if (buffer.length === 0) return;

        // Find max position of AS
        let maxPreAsLen = 0;
        buffer.forEach(item => {
            const preAs = item.line.substring(0, item.asIndex).trimEnd();
            if (preAs.length > maxPreAsLen) maxPreAsLen = preAs.length;
        });

        buffer.forEach(item => {
            const preAs = item.line.substring(0, item.asIndex).trimEnd();
            const postAs = item.line.substring(item.asIndex).trim();
            const padding = ' '.repeat(maxPreAsLen - preAs.length + 1);
            processedLines.push(`${preAs}${padding}${postAs}`);
        });
        buffer = [];
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check for AS alias
        // And matches pattern: ... AS ...
        // Ignore lines with subqueries or complex structures for now.
        const asMatch = line.match(/^(\s+.*)\bAS\b\s+(.*)$/);
        if (asMatch && !line.trim().startsWith('WITH') && !line.includes('(') && !line.includes(')')) {
            const matchIndex = line.search(/\bAS\b/);
            if (matchIndex !== -1) {
                 buffer.push({ line, asIndex: matchIndex });
                 continue;
            }
        }

        flushBuffer();
        processedLines.push(line);
    }
    flushBuffer();

    return processedLines.join('\n');
}

type TokenType = 'KEYWORD' | 'IDENTIFIER' | 'STRING' | 'COMMENT' | 'SYMBOL' | 'WHITESPACE' | 'NEWLINE';
interface Token { type: TokenType; value: string; }

function tokenizeSQL(text: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    const len = text.length;
    const peek = (n = 1) => text.substring(i, i + n);

    const keywords = new Set([
        'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'UPDATE', 'DELETE', 'JOIN', 'LEFT', 'RIGHT',
        'INNER', 'OUTER', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'SET', 'VALUES', 'CREATE',
        'TABLE', 'DROP', 'ALTER', 'UNION', 'ALL', 'AND', 'OR', 'IN', 'EXISTS', 'BETWEEN', 'LIKE',
        'IS', 'NULL', 'NOT', 'DISTINCT', 'AS', 'ON', 'USING', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
        'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'DEFAULT', 'UNIQUE', 'CHECK', 'INDEX', 'VIEW',
        'DATABASE', 'SCHEMA', 'TRIGGER', 'PROCEDURE', 'FUNCTION', 'DECLARE', 'BEGIN', 'COMMIT', 'ROLLBACK',
        'CROSS', 'NATURAL', 'WITH'
    ]);

    while (i < len) {
        const char = text[i];

        if (/\s/.test(char)) {
            let value = '';
            while (i < len && /\s/.test(text[i])) {
                value += text[i];
                i++;
            }
            if (value.includes('\n')) {
                 tokens.push({ type: 'NEWLINE', value: '\n' });
            } else {
                 tokens.push({ type: 'WHITESPACE', value: ' ' });
            }
            continue;
        }

        if (char === '-' && peek(2) === '--') {
            let value = '';
            while (i < len && text[i] !== '\n') {
                value += text[i];
                i++;
            }
            tokens.push({ type: 'COMMENT', value });
            continue;
        }
        if (char === '/' && peek(2) === '/*') {
            let value = '/*';
            i += 2;
            while (i < len && !peek(2).startsWith('*/')) {
                value += text[i];
                i++;
            }
            if (i < len) { value += '*/'; i += 2; }
            tokens.push({ type: 'COMMENT', value });
            continue;
        }

        if (char === "'" || char === '"' || char === '`') {
            const quote = char;
            let value = quote;
            i++;
            while (i < len) {
                if (text[i] === quote) {
                    if (peek(2) === quote + quote) {
                        value += quote + quote;
                        i += 2;
                        continue;
                    }
                    value += quote;
                    i++;
                    break;
                }
                if (text[i] === '\\') {
                     if (i + 1 < len) {
                         value += '\\' + text[i+1];
                         i += 2;
                         continue;
                     }
                }
                value += text[i];
                i++;
            }
            tokens.push({ type: 'STRING', value });
            continue;
        }

        if (/[(),;.*=<>!+\-%]/.test(char)) {
            tokens.push({ type: 'SYMBOL', value: char });
            i++;
            continue;
        }

        if (/[a-zA-Z0-9_]/.test(char)) {
            let value = '';
            while (i < len && /[a-zA-Z0-9_]/.test(text[i])) {
                value += text[i];
                i++;
            }
            if (keywords.has(value.toUpperCase())) {
                tokens.push({ type: 'KEYWORD', value: value.toUpperCase() });
            } else {
                tokens.push({ type: 'IDENTIFIER', value });
            }
            continue;
        }

        tokens.push({ type: 'SYMBOL', value: char });
        i++;
    }
    return tokens;
}

export function formatSQLFallback(text: string): string {
    const tokens = tokenizeSQL(text);
    let formatted = '';
    let indentLevel = 0;
    let newlineRequested = false;
    let spaceRequested = false;
    const indentStr = '    ';

    // Helper to find previous meaningful token
    const getPrevToken = (index: number) => {
        for (let j = index - 1; j >= 0; j--) {
            if (tokens[j].type !== 'WHITESPACE' && tokens[j].type !== 'NEWLINE' && tokens[j].type !== 'COMMENT') {
                return tokens[j];
            }
        }
        return null;
    };

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === 'WHITESPACE') {
            spaceRequested = true;
            continue;
        }
        if (token.type === 'NEWLINE') {
            newlineRequested = true;
            continue;
        }
        if (token.type === 'COMMENT') {
            if (formatted.length > 0 && !formatted.endsWith('\n')) {
                 formatted += ' ';
            }
            formatted += token.value;
            formatted += '\n';
            newlineRequested = true;
            continue;
        }

        // Dedent Logic
        if (token.type === 'SYMBOL' && token.value === ')') {
            indentLevel = Math.max(0, indentLevel - 1);
            // Only newline if the block was long?
            // For resilience, let's assume yes.
            newlineRequested = true;
        }
        if (token.type === 'KEYWORD') {
            if (['FROM', 'WHERE', 'GROUP', 'ORDER', 'HAVING', 'LIMIT', 'UNION', 'EXCEPT', 'INTERSECT'].includes(token.value)) {
                newlineRequested = true;
            }
            if (token.value === 'END') {
                indentLevel = Math.max(0, indentLevel - 1);
                newlineRequested = true;
            }
            if (token.value === 'ELSE') {
                 newlineRequested = true;
            }
            if (token.value === 'WHEN') {
                 // WHEN usually starts new line in CASE
                 newlineRequested = true;
            }
        }

        // Apply Newline/Indent
        if (newlineRequested) {
            if (formatted.length > 0 && !formatted.endsWith('\n')) {
                formatted += '\n';
            }
            formatted += indentStr.repeat(indentLevel);
            newlineRequested = false;
            spaceRequested = false;
        } else if (spaceRequested) {
            // Avoid adding space if last char is ( or first char is ) or ,
            const lastChar = formatted.slice(-1);
            if (lastChar !== '(' && token.value !== ',' && token.value !== ';') {
                 if (formatted.length > 0 && !formatted.endsWith('\n') && !formatted.endsWith(' ')) {
                    formatted += ' ';
                }
            }
            spaceRequested = false;
        }

        // Append Token
        formatted += token.value;

        // Indent Logic (Post-Token)
        if (token.type === 'SYMBOL' && token.value === '(') {
            const prev = getPrevToken(i);
            // If function call, don't indent/newline immediately?
            // e.g. COUNT(
            let isFunc = false;
            if (prev && (prev.type === 'IDENTIFIER' || ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE'].includes(prev.value))) {
                isFunc = true;
            }

            // However, IN (...) should indent.
            // VALUES (...) should indent.
            if (prev && ['IN', 'VALUES'].includes(prev.value)) {
                isFunc = false;
            }

            if (!isFunc) {
                indentLevel++;
                newlineRequested = true;
            } else {
                // If it IS a function call, we might not want to indent, but we should track parens for nested stuff.
                // But my indentLevel logic uses simple counting.
                // If I don't increment indentLevel, nested parens won't indent.
                // Compromise: Increment indent but DO NOT newline immediately.
                indentLevel++;
            }
        }
        if (token.type === 'KEYWORD') {
            if (['CASE', 'BEGIN'].includes(token.value)) {
                indentLevel++;
            }
            if (['SELECT', 'FROM', 'WHERE', 'GROUP', 'ORDER', 'HAVING', 'LIMIT', 'UNION', 'SET', 'VALUES'].includes(token.value)) {
                 // Clause starters.
                 // We don't necessarily increase indent, but subsequent items might be indented?
                 // sql-formatter style:
                 // SELECT
                 //     col1
                 // Identifies SELECT as start of block?
                 // For fallback, keep it simple.
            }
            if (['JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'NATURAL'].includes(token.value)) {
                 newlineRequested = true;
            }
            if (token.value === 'ON') {
                 // ON usually on new line? or same line?
                 // JOIN x ON y
            }
        }
        if (token.type === 'SYMBOL' && (token.value === ';' || token.value === ',')) {
            newlineRequested = true;
        }
    }

    // Apply post-processing (AS alignment)
    return processSQLDeep(formatted);
}
