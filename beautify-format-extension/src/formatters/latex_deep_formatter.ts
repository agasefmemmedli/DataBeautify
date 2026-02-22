export function formatLaTeXDeep(text: string): string {
    const lines = text.split('\n');
    const formattedLines: string[] = [];
    let indentLevel = 0;

    // Alignment state
    const alignableEnvs = new Set([
        'tabular', 'array', 'align', 'align*', 'alignat', 'alignat*',
        'flalign', 'flalign*', 'matrix', 'pmatrix', 'bmatrix', 'Bmatrix',
        'vmatrix', 'Vmatrix', 'cases'
    ]);
    let inAlignableEnv = false;
    let envBuffer: string[] = [];
    let currentEnvName = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '') {
            if (inAlignableEnv) {
                envBuffer.push('');
            } else {
                formattedLines.push('');
            }
            continue;
        }

        // Remove comments for structural analysis
        let lineWithoutComment = trimmed;
        const commentIdx = trimmed.indexOf('%');
        if (commentIdx !== -1) {
            // Check if escaped
            let escaped = false;
            let k = commentIdx - 1;
            while (k >= 0 && trimmed[k] === '\\') {
                escaped = !escaped;
                k--;
            }
            if (!escaped) {
                lineWithoutComment = trimmed.substring(0, commentIdx);
            }
        }

        // Check for alignment environment start
        const beginMatch = lineWithoutComment.match(/\\begin\{([^}]+)\}/);
        if (beginMatch) {
            const envName = beginMatch[1];
            if (alignableEnvs.has(envName) && !inAlignableEnv) {
                inAlignableEnv = true;
                currentEnvName = envName;
                // Indent and push the start line
                formattedLines.push('    '.repeat(indentLevel) + trimmed);

                indentLevel++;
                continue;
            }
        }

        // Check for alignment environment end
        if (inAlignableEnv) {
            const endMatch = lineWithoutComment.match(/\\end\{([^}]+)\}/);
            if (endMatch && endMatch[1] === currentEnvName) {
                // Flush buffer
                const alignedBuffer = formatAlignedTable(envBuffer);
                // Add aligned lines with correct indentation
                alignedBuffer.forEach(l => formattedLines.push('    '.repeat(indentLevel) + l));

                envBuffer = [];
                inAlignableEnv = false;
                currentEnvName = '';
                indentLevel--; // Dedent for the end line

                // Add the end line
                formattedLines.push('    '.repeat(indentLevel) + trimmed);
                continue;
            } else {
                // Add to buffer
                envBuffer.push(trimmed);
                continue;
            }
        }

        // --- Standard Indentation Logic ---

        // Check dedent triggers
        let currentLineIndent = indentLevel;

        if (trimmed.startsWith('\\end{') || trimmed.startsWith(']') || (trimmed.startsWith('}') && !trimmed.startsWith('}{'))) {
            currentLineIndent = Math.max(0, indentLevel - 1);
        }
        if (trimmed === '\\]') {
            currentLineIndent = Math.max(0, indentLevel - 1);
        }

        // Apply indentation
        formattedLines.push('    '.repeat(currentLineIndent) + trimmed);

        // Calculate next indent
        // 1. \begin{...}
        const beginMatches = lineWithoutComment.match(/\\begin\{[^}]+\}/g) || [];
        const endMatches = lineWithoutComment.match(/\\end\{[^}]+\}/g) || [];

        // Filter out \begin{document} / \end{document}
        const netBegin = beginMatches.filter(m => !m.includes('{document}')).length;
        const netEnd = endMatches.filter(m => !m.includes('{document}')).length;

        // 2. \[ ... \]
        let mathOpen = 0;
        let mathClose = 0;
        if (lineWithoutComment.includes('\\[')) mathOpen++;
        if (lineWithoutComment.includes('\\]')) mathClose++;

        // 3. { ... } blocks
        // Only count braces that are not part of command arguments if possible?
        // Simple brace counting is dangerous in LaTeX because of \command{...}.
        // We probably only want to indent for explicit blocks or specific commands?
        // But the original code counted them at ends of lines.
        let braceOpen = 0;
        let braceClose = 0;
        if (lineWithoutComment.endsWith('{')) braceOpen++;
        if (lineWithoutComment.startsWith('}')) braceClose++;

        const netChange = (netBegin - netEnd) + (mathOpen - mathClose) + (braceOpen - braceClose);
        indentLevel = Math.max(0, indentLevel + netChange);
    }

    // Handle remaining buffer (if unclosed env)
    if (envBuffer.length > 0) {
            envBuffer.forEach(l => formattedLines.push('    '.repeat(indentLevel) + l));
    }

    return formattedLines.join('\n');
}

function formatAlignedTable(lines: string[], delimiter: string = '&'): string[] {
    // 1. Parse rows and columns
    const rows = lines.map(line => {
        if (line.trim() === '') return [''];

        if (line.trim().startsWith('\\hline') || line.trim().startsWith('\\cline') || line.trim().startsWith('%')) {
            return [line.trim()];
        }

        // Split by delimiter, respecting escaped &
        const parts: string[] = [];
        let currentPart = '';
        let escape = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (escape) {
                currentPart += char;
                escape = false;
            } else if (char === '\\') {
                currentPart += char;
                escape = true;
            } else if (char === delimiter && !escape) {
                parts.push(currentPart);
                currentPart = '';
            } else {
                currentPart += char;
            }
        }
        parts.push(currentPart);
        return parts;
    });

    // 2. Calculate max width for each column
    const colWidths: number[] = [];
    rows.forEach(row => {
        if (row.length > 1) {
            row.forEach((col, i) => {
                colWidths[i] = Math.max(colWidths[i] || 0, col.trim().length);
            });
        }
    });

    // 3. Reconstruct lines
    return rows.map(row => {
        if (row.length === 1) return row[0];

        return row.map((col, i) => {
            const trimmed = col.trim();
            // Don't pad the last column
            if (i === row.length - 1) return trimmed;
            return trimmed.padEnd(colWidths[i]);
        }).join(` ${delimiter} `);
    });
}
