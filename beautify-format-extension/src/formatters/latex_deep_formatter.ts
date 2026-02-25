export function formatLaTeXDeep(text: string): string {
    const lines = text.split('\n');
    const formattedLines: string[] = [];
    let indentLevel = 0;
    const indentSize = 2; // Standard 2-space indentation

    // Alignment state
    const alignableEnvs = new Set([
        'tabular', 'array', 'align', 'align*', 'alignat', 'alignat*',
        'flalign', 'flalign*', 'matrix', 'pmatrix', 'bmatrix', 'Bmatrix',
        'vmatrix', 'Vmatrix', 'cases'
    ]);
    // Verbatim-like environments where formatting should be disabled
    const verbatimEnvs = new Set([
        'verbatim', 'verbatim*', 'lstlisting', 'minted', 'raw', 'comment'
    ]);

    let inAlignableEnv = false;
    let envBuffer: string[] = [];
    let currentEnvName = '';

    let inVerbatimEnv = false;
    let currentVerbatimEnvName = '';

    for (let i = 0; i < lines.length; i++) {
        const originalLine = lines[i];

        // --- Verbatim Handling ---
        if (inVerbatimEnv) {
            // Check for end of verbatim environment
            // The \end{...} must be on its own line usually, or at least detectable
            // Escape special regex chars in env name (like *)
            const escapedEnvName = currentVerbatimEnvName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const endMatch = originalLine.match(new RegExp(`\\\\end\\{${escapedEnvName}\\}`));
            if (endMatch) {
                inVerbatimEnv = false;
                currentVerbatimEnvName = '';
                // Indent the end tag correctly? Usually verbatim end tag indentation matches the start tag.
                // For safety, we just push the line as is, or maybe indent it to current level?
                // Standard LaTeX formatters often keep verbatim content untouched.
                // Let's indent the \end line to match the outer block level.
                formattedLines.push(' '.repeat(indentLevel * indentSize) + originalLine.trim());
            } else {
                formattedLines.push(originalLine); // Keep verbatim content exactly as is
            }
            continue;
        }

        const trimmed = originalLine.trim();

        if (trimmed === '') {
            if (inAlignableEnv) {
                envBuffer.push('');
            } else {
                formattedLines.push('');
            }
            continue;
        }

        // --- Comment Handling ---
        // Separate code from comment to analyze structure
        let codePart = trimmed;
        let commentPart = '';

        // Find comment start (%) that is not escaped
        let commentIdx = -1;
        for (let j = 0; j < trimmed.length; j++) {
            if (trimmed[j] === '%') {
                // Check if escaped
                let escaped = false;
                let k = j - 1;
                while (k >= 0 && trimmed[k] === '\\') {
                    escaped = !escaped;
                    k--;
                }
                if (!escaped) {
                    commentIdx = j;
                    break;
                }
            }
        }

        if (commentIdx !== -1) {
            codePart = trimmed.substring(0, commentIdx).trimEnd();
            commentPart = trimmed.substring(commentIdx);
        }

        // If line is ONLY comment, just indent and push
        if (codePart === '') {
             formattedLines.push(' '.repeat(indentLevel * indentSize) + commentPart);
             continue;
        }

        // --- Structure Analysis on codePart ---

        // Check for verbatim start
        const beginMatch = codePart.match(/\\begin\{([^}]+)\}/);
        if (beginMatch) {
            const envName = beginMatch[1];
            if (verbatimEnvs.has(envName)) {
                inVerbatimEnv = true;
                currentVerbatimEnvName = envName;
                formattedLines.push(' '.repeat(indentLevel * indentSize) + trimmed);
                // We don't change indentLevel for verbatim internal content usually,
                // but the \end line matches \begin.
                continue;
            }
        }

        // Check for alignment start
        if (beginMatch) {
            const envName = beginMatch[1];
            if (alignableEnvs.has(envName) && !inAlignableEnv) {
                inAlignableEnv = true;
                currentEnvName = envName;

                // Indent and push the start line (reconstruct with comment)
                const lineOutput = ' '.repeat(indentLevel * indentSize) + codePart + (commentPart ? ' ' + commentPart : '');
                formattedLines.push(lineOutput);

                indentLevel++;
                continue;
            }
        }

        // Check for alignment end
        if (inAlignableEnv) {
            const endMatch = codePart.match(/\\end\{([^}]+)\}/);
            if (endMatch && endMatch[1] === currentEnvName) {
                // Flush buffer
                const alignedBuffer = formatAlignedTable(envBuffer);
                // Add aligned lines with correct indentation
                alignedBuffer.forEach(l => formattedLines.push(' '.repeat(indentLevel * indentSize) + l));

                envBuffer = [];
                inAlignableEnv = false;
                currentEnvName = '';
                indentLevel = Math.max(0, indentLevel - 1); // Dedent for the end line

                // Add the end line
                const lineOutput = ' '.repeat(indentLevel * indentSize) + codePart + (commentPart ? ' ' + commentPart : '');
                formattedLines.push(lineOutput);
                continue;
            } else {
                // Add to buffer (store the FULL trimmed line including comment for alignment processing)
                // We will handle comment extraction inside formatAlignedTable if needed,
                // but usually comments in tables are at the end of rows.
                envBuffer.push(trimmed);
                continue;
            }
        }

        // --- Standard Indentation Logic ---

        // Calculate Dedent BEFORE printing
        // Check if line STARTS with a closing delimiter or \end
        // Triggers: \end{...}, ], }, \], \)
        let tempDedent = 0;

        if (codePart.startsWith('\\end{') ||
            codePart.startsWith('}') ||
            codePart.startsWith(']') ||
            codePart === '\\]' ||
            codePart === '\\)') {
            tempDedent = 1;
        } else if (codePart.startsWith('\\else') || codePart.startsWith('\\fi')) {
             // LaTeX programming constructs
             tempDedent = 1;
        }

        const currentLineIndent = Math.max(0, indentLevel - tempDedent);

        // Reconstruct line
        const finalLine = ' '.repeat(currentLineIndent * indentSize) + codePart + (commentPart ? ' ' + commentPart : '');
        formattedLines.push(finalLine);

        // Calculate Indent Change for NEXT line
        // 1. Environments \begin{...} / \end{...}
        const allBegins = codePart.match(/\\begin\{[^}]+\}/g) || [];
        const allEnds = codePart.match(/\\end\{[^}]+\}/g) || [];

        const beginMatches = allBegins.filter(m => !m.includes('{document}')).length;
        const endMatches = allEnds.filter(m => !m.includes('{document}')).length;

        // Filter out document env? Usually standard.
        // Also, if we had a begin on this line that triggered align/verbatim, we already handled it?
        // No, we only handled the START of align/verbatim.
        // If we are here, we are NOT in align/verbatim (or just started it, but we `continue`d for start of align/verbatim).
        // Wait, if we started align/verbatim, we `continue`d. So we are not here.
        // So we are dealing with standard environments like itemize, enumerate, etc.

        // 2. Math Delimiters \[ \] \( \)
        // Note: inline math $...$ usually doesn't indent, but \[...\] does.
        const mathDisplayOpen = (codePart.match(/\\\[/g) || []).length;
        const mathDisplayClose = (codePart.match(/\\\]/g) || []).length;

        // 3. Braces { }
        // We need to be careful. LaTeX uses braces for arguments everywhere.
        // We only want to indent if it looks like a block?
        // A simple heuristic: if a line ends with `{` (ignoring comment), indent.
        // If a line starts with `}`, dedent (handled above).
        // But what if `\command{arg}` is on one line?
        // We can count net braces, but we must exclude escaped braces `\{`.

        let braceOpen = 0;
        let braceClose = 0;

        // Remove escaped braces for counting
        const cleanCode = codePart.replace(/\\\{/g, '').replace(/\\\}/g, '');

        for (const char of cleanCode) {
            if (char === '{') braceOpen++;
            if (char === '}') braceClose++;
        }

        // Net change
        let netChange = (beginMatches - endMatches) + (mathDisplayOpen - mathDisplayClose);

        // For braces, we only indent if there is a net positive on this line,
        // AND the line ends with an opening brace (strong signal for block).
        // OR if we just want strictly structure-based indentation.
        // Let's rely on standard LaTeX practice: indent environments and display math.
        // Braces are tricky. `\textbf{...}` shouldn't indent if on one line.
        // `\newcommand{...}{ ...` might want indent.

        if (netChange === 0) {
             if (braceOpen > braceClose) {
                 // Only indent if it looks like a block start (ends with {)
                 if (codePart.endsWith('{')) {
                     netChange += 1;
                 }
             } else if (braceClose > braceOpen) {
                 // Dedent if more closing braces (and likely one of them closed a block)
                 // But be careful not to double dedent if tempDedent already handled it?
                 // No, indentLevel is for NEXT line.
                 netChange -= 1;
             }
        }

        // Apply change
        indentLevel = Math.max(0, indentLevel + netChange);

        // Special case: if we just dedented temp (e.g. found \end),
        // the indentLevel update logic above might double count the \end deduction?
        // `endMatches` will be 1. `netChange` will be -1.
        // `indentLevel` was used as `indentLevel - 1` for printing.
        // Now `indentLevel` becomes `indentLevel - 1`. Correct.

        // But wait, if we had `\begin{...} ... \end{...}` on one line?
        // `netChange` is 0. `indentLevel` stays same. Correct.
    }

    return formattedLines.join('\n');
}

function formatAlignedTable(lines: string[], delimiter: string = '&'): string[] {
    // 1. Parse rows and columns
    const rows = lines.map(line => {
        const trimmed = line.trim();
        // Extract comment if any
        let content = trimmed;
        let comment = '';

        // Simple comment extraction (imperfect if % is inside string, but sufficient for tables)
        const commentIdx = content.indexOf('%');
        // Handle escaped %
        let safeCommentIdx = -1;
        if (commentIdx !== -1) {
             let escaped = false;
             let k = commentIdx - 1;
             while (k >= 0 && content[k] === '\\') {
                 escaped = !escaped;
                 k--;
             }
             if (!escaped) {
                 safeCommentIdx = commentIdx;
             }
        }

        if (safeCommentIdx !== -1) {
            content = trimmed.substring(0, safeCommentIdx).trimEnd();
            comment = trimmed.substring(safeCommentIdx);
        }

        if (content === '') return { cols: [''], comment };

        if (content.startsWith('\\hline') || content.startsWith('\\cline') || content.startsWith('\\noalign')) {
            return { cols: [content], comment, isSeparator: true };
        }

        // Split by delimiter, respecting escaped &
        const parts: string[] = [];
        let currentPart = '';
        let escape = false;
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
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

        // The last part might contain \\ (newline). We should ideally separate it?
        // But usually alignment aligns the `&`. The `\\` is attached to the last column.
        return { cols: parts.map(p => p.trim()), comment, isSeparator: false };
    });

    // 2. Calculate max width for each column
    const colWidths: number[] = [];
    rows.forEach(row => {
        if (!row.isSeparator && row.cols.length > 0) {
            row.cols.forEach((col, i) => {
                // If it's the last column, we might not want to pad it too much if it has \\?
                // But for alignment, we pad everything except maybe the very last visual column.
                colWidths[i] = Math.max(colWidths[i] || 0, col.length);
            });
        }
    });

    // 3. Reconstruct lines
    return rows.map(row => {
        if (row.isSeparator) {
            return row.cols[0] + (row.comment ? ' ' + row.comment : '');
        }

        const alignedCols = row.cols.map((col, i) => {
            // Don't pad the very last column of the row
            if (i === row.cols.length - 1) return col;
            return col.padEnd(colWidths[i]);
        });

        return alignedCols.join(` ${delimiter} `) + (row.comment ? ' ' + row.comment : '');
    });
}
