
import { format as sqlFormat } from 'sql-formatter';

export async function formatSQLDeep(text: string): Promise<string> {
    try {
        // 1. Base Formatting with sql-formatter
        let formatted = sqlFormat(text, {
            language: 'postgresql', // Using PostgreSQL as it covers standard SQL + extra features commonly used
            keywordCase: 'upper',
            tabWidth: 4,
            linesBetweenQueries: 2,
            indentStyle: 'standard',
            logicalOperatorNewline: 'before',
            expressionWidth: 60,
            denseOperators: false
        });

        // 2. Post-processing for Deep Formatting
        return processSQLDeep(formatted);
    } catch (e) {
        // Fallback immediately if sql-formatter fails
        return formatSQLFallback(text);
    }
}

/**
 * Shared post-processing logic for alignment (AS aliases, =, Types)
 */
function processSQLDeep(text: string): string {
    const lines = text.split('\n');
    const processedLines: string[] = [];

    // Buffers for different alignment contexts
    let aliasBuffer: { line: string, index: number }[] = [];
    let assignmentBuffer: { line: string, index: number }[] = [];
    let typeBuffer: { line: string, nameEndIndex: number }[] = [];

    // Context flags
    let inCreateTable = false;
    let inUpdate = false;
    let inUpdateSet = false;

    function flushAliasBuffer() {
        if (aliasBuffer.length === 0) return;

        let maxPre = 0;
        aliasBuffer.forEach(item => {
            const pre = item.line.substring(0, item.index).trimEnd();
            if (pre.length > maxPre) maxPre = pre.length;
        });

        aliasBuffer.forEach(item => {
            const pre = item.line.substring(0, item.index).trimEnd();
            const post = item.line.substring(item.index).trim();
            const padding = ' '.repeat(maxPre - pre.length + 1);
            processedLines.push(`${pre}${padding}${post}`);
        });
        aliasBuffer = [];
    }

    function flushAssignmentBuffer() {
        if (assignmentBuffer.length === 0) return;

        let maxPre = 0;
        assignmentBuffer.forEach(item => {
            const pre = item.line.substring(0, item.index).trimEnd();
            if (pre.length > maxPre) maxPre = pre.length;
        });

        assignmentBuffer.forEach(item => {
            const pre = item.line.substring(0, item.index).trimEnd();
            const post = item.line.substring(item.index).trim();
            const padding = ' '.repeat(maxPre - pre.length + 1);
            processedLines.push(`${pre}${padding}${post}`);
        });
        assignmentBuffer = [];
    }

    function flushTypeBuffer() {
        if (typeBuffer.length === 0) return;

        let maxNameLen = 0;
        typeBuffer.forEach(item => {
            const name = item.line.substring(0, item.nameEndIndex).trimEnd();
            if (name.length > maxNameLen) maxNameLen = name.length;
        });

        typeBuffer.forEach(item => {
            const name = item.line.substring(0, item.nameEndIndex).trimEnd();
            const rest = item.line.substring(item.nameEndIndex).trim();
            const padding = ' '.repeat(maxNameLen - name.length + 1);
            processedLines.push(`${name}${padding}${rest}`);
        });
        typeBuffer = [];
    }

    function flushAll() {
        flushAliasBuffer();
        flushAssignmentBuffer();
        flushTypeBuffer();
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const upperLine = line.toUpperCase();

        if (trimmed.startsWith('--') || trimmed.startsWith('/*')) {
            flushAll();
            processedLines.push(line);
            continue;
        }

        if (trimmed === '') {
            flushAll();
            processedLines.push(line);
            continue;
        }

        // Detect Start of CREATE TABLE
        if (upperLine.includes('CREATE TABLE')) {
            inCreateTable = true;
            flushAll();
            processedLines.push(line);
            continue;
        }

        // Detect End of CREATE TABLE
        // Check if this line is the end (contains `);`)
        if (inCreateTable && trimmed.endsWith(');')) {
            // Check if this line also has a column definition
            // e.g. "  status VARCHAR(20));"
            // The regex expects space between name and type.
            // But usually the closing paren ); is attached to the last line or on a new line.
            // If on a new line, it won't match the regex anyway.
            // If on the same line, we strip ); for matching purpose?
            // Let's try to match ignoring trailing `);`
            const cleanLine = line.replace(/\);$/, '').trimEnd();
            const match = cleanLine.match(/^(\s+[a-zA-Z0-9_"]+)\s+([a-zA-Z0-9_]+.*)$/);

            if (match) {
                 const namePart = match[1];
                 typeBuffer.push({ line, nameEndIndex: namePart.length });
            } else {
                 // Just closing brace
                 flushTypeBuffer();
                 processedLines.push(line);
                 inCreateTable = false;
                 continue;
            }
            flushTypeBuffer(); // Flush everything including this line
            inCreateTable = false;
            continue;
        }

        // Detect End of CREATE TABLE (isolated closing paren)
        if (inCreateTable && trimmed === ');') {
            flushTypeBuffer();
            processedLines.push(line);
            inCreateTable = false;
            continue;
        }

        // Detect UPDATE
        if (upperLine.startsWith('UPDATE ')) {
            inUpdate = true;
            flushAll();
            processedLines.push(line);
            continue;
        }

        // Detect SET (could be on same line as UPDATE or next)
        if (inUpdate && upperLine.trim().startsWith('SET')) {
             inUpdateSet = true;
             flushAll();
             processedLines.push(line);
             continue;
        }

        // Detect End of SET (WHERE or ;)
        if (inUpdateSet && (upperLine.trim().startsWith('WHERE') || trimmed.endsWith(';'))) {
             flushAssignmentBuffer();
             inUpdateSet = false;
             inUpdate = false; // Reset update too
             processedLines.push(line);
             continue;
        }

        // Logic for Aliases (AS)
        // Only if not in special contexts to avoid conflicts
        if (!inCreateTable && !inUpdateSet) {
            const asMatch = line.match(/^(\s+.*)\bAS\b\s+(.*)$/i);
            if (asMatch && !line.includes('(') && !line.includes(')')) { // Simple alias only
                const matchIndex = line.search(/\bAS\b/i);
                if (matchIndex !== -1) {
                    aliasBuffer.push({ line, index: matchIndex });
                    continue;
                }
            } else {
                flushAliasBuffer();
            }
        }

        // Logic for Assignments (=) in UPDATE SET
        if (inUpdateSet) {
            const eqIndex = line.indexOf('=');
            if (eqIndex !== -1) {
                assignmentBuffer.push({ line, index: eqIndex });
                continue;
            } else {
                flushAssignmentBuffer();
            }
        }

        // Logic for Types in CREATE TABLE
        if (inCreateTable) {
            // Heuristic: Indented line, starts with identifier, then space, then type
            // e.g. "    id SERIAL PRIMARY KEY,"
            // We want to align "SERIAL"
            // Ignore lines that are just constraints like "CONSTRAINT ..." or "PRIMARY KEY ..." if they start with keywords
            // But we assume keywords are upper case.
            // Let's be stricter: must match identifier pattern.
            const match = line.match(/^(\s+[a-zA-Z0-9_"]+)\s+([a-zA-Z0-9_]+.*)$/);
            if (match) {
                // Exclude if the first word is a keyword like CONSTRAINT, PRIMARY, FOREIGN, CHECK, UNIQUE
                const firstWord = match[1].trim();
                const keywords = ['CONSTRAINT', 'PRIMARY', 'FOREIGN', 'CHECK', 'UNIQUE'];
                if (!keywords.includes(firstWord.toUpperCase())) {
                    const namePart = match[1];
                    typeBuffer.push({ line, nameEndIndex: namePart.length });
                    continue;
                }
            }
            flushTypeBuffer();
            // Just push the line if no match, but flush first
            processedLines.push(line);
            continue;
        }

        // If no match in buffers
        if (!inCreateTable && !inUpdateSet) {
             processedLines.push(line);
        }
    }
    flushAll();

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
        'ROW_NUMBER', 'FULL', 'JSONB', 'SERIAL', 'VARCHAR', 'TIMESTAMP', 'INT', 'INTEGER', 'BOOLEAN', 'TEXT'
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
                if (['<=', '>=', '!=', '<>', '+=', '-=', '*=', '/=', '%=', '::'].includes(combined)) {
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
                let isContinuation = false;
                if (prevToken && ['LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'NATURAL'].includes(prevToken.value)) {
                    isContinuation = true;
                }
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
            // CASE related
            else if (['WHEN', 'ELSE'].includes(val)) {
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
            else if (lastChar === ' ') space = false;

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
                pushLine(); // Break after CASE
            }
        }
    }

    pushLine();

    // Call processSQLDeep for alignment
    return processSQLDeep(formattedLines.join('\n'));
}
