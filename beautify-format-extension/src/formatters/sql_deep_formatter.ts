
// Re-implementing with improvements...

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
            // Ensure single space before AS if needed, or align
            const padding = ' '.repeat(maxPreAsLen - preAs.length + 1);
            processedLines.push(`${preAs}${padding}${postAs}`);
        });
        buffer = [];
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith('--') || trimmed.startsWith('/*')) {
            flushBuffer();
            processedLines.push(line);
            continue;
        }

        // Regex to find standalone AS
        const asMatch = line.match(/^(\s+.*)\bAS\b\s+(.*)$/i);
        if (asMatch && !line.includes('(') && !line.includes(')')) {
            const matchIndex = line.search(/\bAS\b/i);
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

export function tokenizeSQL(text: string): Token[] {
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
        'CROSS', 'NATURAL', 'WITH', 'TOP', 'OFFSET', 'FETCH', 'CONSTRAINT', 'ASC', 'DESC', 'NULLS',
        'FIRST', 'LAST', 'PARTITION', 'OVER', 'WINDOW', 'CAST', 'TRY_CAST', 'COALESCE', 'RANK', 'DENSE_RANK',
        'ROW_NUMBER', 'FULL'
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
            let value = char;
            i++;
            if (i < len) {
                const next = text[i];
                const combined = value + next;
                if (['<=', '>=', '!=', '<>', '+=', '-=', '*=', '/=', '%='].includes(combined)) {
                    value = combined;
                    i++;
                }
            }
            tokens.push({ type: 'SYMBOL', value });
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
    const formattedLines: string[] = [];
    let currentLine = '';
    let indentLevel = 0;
    const INDENT_SIZE = 4;
    const INDENT_STR = ' '.repeat(INDENT_SIZE);

    const parenStack: string[] = [];

    function pushLine() {
        if (currentLine.trim() !== '') {
            formattedLines.push(currentLine);
        }
        currentLine = '';
    }

    // Helper to get previous non-whitespace/comment token
    const getEffectivePrev = (idx: number) => {
        for (let j = idx - 1; j >= 0; j--) {
            if (tokens[j].type !== 'WHITESPACE' && tokens[j].type !== 'NEWLINE' && tokens[j].type !== 'COMMENT') {
                return tokens[j];
            }
        }
        return null;
    };

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const prevToken = getEffectivePrev(i);

        if (token.type === 'WHITESPACE') continue;
        if (token.type === 'NEWLINE') continue;

        if (token.type === 'COMMENT') {
            pushLine();
            formattedLines.push(INDENT_STR.repeat(Math.max(0, indentLevel)) + token.value);
            continue;
        }

        // --- Logic ---

        // Dedent Check
        if (token.type === 'SYMBOL' && token.value === ')') {
            indentLevel = Math.max(0, indentLevel - 1);
            parenStack.pop();
        } else if (token.type === 'KEYWORD' && ['END', 'ELSE', 'ELSIF'].includes(token.value)) {
             indentLevel = Math.max(0, indentLevel - 1);
             pushLine();
        }

        // Newline Check (Pre-Token)
        if (token.type === 'KEYWORD') {
            const val = token.value;
            // Clauses that always start a new line
            if (['FROM', 'WHERE', 'GROUP', 'ORDER', 'HAVING', 'LIMIT', 'UNION', 'EXCEPT', 'INTERSECT', 'WITH'].includes(val)) {
                if (parenStack.length === 0 || parenStack[parenStack.length-1] === 'subquery') {
                    pushLine();
                }
            }
            // Join Logic: LEFT, RIGHT, INNER, OUTER, FULL, JOIN
            else if (['JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'NATURAL'].includes(val)) {
                // If it's a join type, start new line
                // But if it's JOIN following a join type, DON'T start new line
                let isContinuation = false;
                if (prevToken && ['LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'NATURAL'].includes(prevToken.value)) {
                    isContinuation = true;
                }

                // console.log(`DEBUG: Token: ${val}, Prev: ${prevToken ? prevToken.value : 'null'}, isContinuation: ${isContinuation}`);

                if (!isContinuation) {
                    pushLine();
                }
            }
            // ON
            else if (val === 'ON') {
                pushLine();
            }
            // Logical Ops
            else if (['AND', 'OR'].includes(val)) {
                pushLine();
            }
        }

        // Comma
        if (token.type === 'SYMBOL' && token.value === ',') {
            currentLine += ',';
            pushLine();
            continue;
        }

        // Semicolon
        if (token.type === 'SYMBOL' && token.value === ';') {
            currentLine += ';';
            pushLine();
            formattedLines.push('');
            continue;
        }

        // Append to Current Line
        if (currentLine === '') {
            let extraIndent = 0;
            if (token.type === 'KEYWORD' && token.value === 'ON') {
                extraIndent = 1;
            }

            currentLine = INDENT_STR.repeat(Math.max(0, indentLevel + extraIndent)) + token.value;
        } else {
            // Spacing
            const lastChar = currentLine[currentLine.length - 1];
            let space = true;

            if (token.type === 'SYMBOL' && ['.', '::'].includes(token.value)) space = false;
            else if (prevToken && prevToken.type === 'SYMBOL' && ['.', '::'].includes(prevToken.value)) space = false;
            else if (token.value === '(' && prevToken && prevToken.type === 'IDENTIFIER') space = false; // Func
            else if (lastChar === '(') space = false;
            else if (lastChar === ' ') space = false; // Already has space (e.g. from previous token logic? No, only currentLine update)

            if (space) currentLine += ' ' + token.value;
            else currentLine += token.value;
        }

        // Indent Check (Post-Token)
        if (token.type === 'SYMBOL' && token.value === '(') {
            if (prevToken && (prevToken.type === 'KEYWORD' || prevToken.type === 'IDENTIFIER')) {
                if (['IN', 'VALUES'].includes(prevToken.value)) {
                    parenStack.push('values');
                    indentLevel++;
                    pushLine();
                } else {
                    parenStack.push('func');
                }
            } else {
                parenStack.push('subquery');
                indentLevel++;
                pushLine();
            }
        } else if (token.type === 'KEYWORD') {
            if (['CASE'].includes(token.value)) {
                indentLevel++;
                parenStack.push('case');
            }
        }
    }

    pushLine();

    // Call processSQLDeep for alignment
    return processSQLDeep(formattedLines.join('\n'));
}
