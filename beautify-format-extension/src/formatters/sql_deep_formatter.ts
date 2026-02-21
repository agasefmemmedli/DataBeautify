export async function formatSQLDeep(text: string): Promise<string> {
    // Dynamic import to handle ESM module
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
    const lines = formatted.split('\n');
    const processedLines: string[] = [];

    // Alignment logic for AS aliases
    // We want to align 'AS alias' in SELECT lists if they are on consecutive lines.
    // e.g.
    // SELECT
    //     col1       AS c1,
    //     column2    AS c2
    // FROM ...

    let buffer: { line: string, asIndex: number }[] = [];

    function flushBuffer() {
        if (buffer.length === 0) return;

        // Find max position of AS
        // But we need to account for indentation.
        // And ensure we don't align if AS is too far away or structure is different.
        // Simple heuristic: align if AS is present.

        let maxPreAsLen = 0;
        buffer.forEach(item => {
            const preAs = item.line.substring(0, item.asIndex).trimEnd();
            if (preAs.length > maxPreAsLen) maxPreAsLen = preAs.length;
        });

        buffer.forEach(item => {
            const preAs = item.line.substring(0, item.asIndex).trimEnd();
            const postAs = item.line.substring(item.asIndex).trim(); // "AS alias,"
            // Check if AS is actually AS (whole word)
            // It should be because we regexed for \bAS\b
            const padding = ' '.repeat(maxPreAsLen - preAs.length + 1);
            processedLines.push(`${preAs}${padding}${postAs}`);
        });
        buffer = [];
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check for AS alias
        // Only if line starts with indentation (part of select list usually)
        // And matches pattern: ... AS ...
        // Ignore lines with subqueries or complex structures for now to avoid breaking things.
        // Simple regex: ^\s+.*\bAS\b.*$
        // Exclude if AS is at the start (CTE?)
        // Exclude if line ends with ( (subquery start)

        const asMatch = line.match(/^(\s+.*)\bAS\b\s+(.*)$/);
        if (asMatch && !line.trim().startsWith('WITH') && !line.includes('(') && !line.includes(')')) {
            // Check if it's a valid alias assignment
            // e.g. "    col1 AS c1,"
            const pre = asMatch[1];
            // We want the index of AS in the original string
            const asIndex = line.lastIndexOf('AS');
            // Ensure AS is standalone word
            if (/\bAS\b/.test(line)) {
                 buffer.push({ line, asIndex });
                 continue;
            }
        }

        // Flush if we hit a line that doesn't match
        flushBuffer();
        processedLines.push(line);
    }
    flushBuffer();

    return processedLines.join('\n');
}
