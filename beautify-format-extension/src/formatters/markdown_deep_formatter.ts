export function formatMarkdownDeep(text: string): string {
    const lines = text.split('\n');
    const formattedLines: string[] = [];

    let inCodeBlock = false;
    let codeBlockFence = '';
    let inTable = false;
    let tableRows: string[][] = [];
    let inFrontmatter = false;

    const flushTable = () => {
        if (tableRows.length === 0) return;

        // Calculate max width for each column
        const colWidths: number[] = [];
        tableRows.forEach(row => {
            row.forEach((cell, i) => {
                const len = cell.trim().length;
                colWidths[i] = Math.max(colWidths[i] || 0, len);
            });
        });

        // Format rows
        tableRows.forEach((row, rowIndex) => {
            // Check if it's a separator line (e.g. |---|:---:|)
            // Separator lines usually contain only dashes and colons
            const isSeparator = rowIndex === 1 && row.every(cell => /^\s*:?-+:?\s*$/.test(cell));

            const formattedRow = row.map((cell, i) => {
                const trimmed = cell.trim();
                const width = colWidths[i];

                if (isSeparator) {
                    // Handle alignment markers
                    const hasLeft = trimmed.startsWith(':');
                    const hasRight = trimmed.endsWith(':');

                    if (hasLeft && hasRight) {
                        return `:${'-'.repeat(Math.max(1, width - 2))}:`;
                    } else if (hasLeft) {
                        return `:${'-'.repeat(Math.max(1, width - 1))}`;
                    } else if (hasRight) {
                        return `${'-'.repeat(Math.max(1, width - 1))}:`;
                    } else {
                        return '-'.repeat(Math.max(1, width));
                    }
                } else {
                    // Pad content
                    return trimmed.padEnd(width);
                }
            }).join(' | ');

            formattedLines.push(`| ${formattedRow} |`);
        });

        tableRows = [];
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // 1. Frontmatter
        if (i === 0 && trimmed === '---') {
            inFrontmatter = true;
            formattedLines.push(trimmed);
            continue;
        }
        if (inFrontmatter) {
            formattedLines.push(line);
            if (trimmed === '---') {
                inFrontmatter = false;
            }
            continue;
        }

        // 2. Code Blocks
        if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
            if (inTable) {
                flushTable();
                inTable = false;
            }

            const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
            const currentFence = fenceMatch ? fenceMatch[1] : trimmed.substring(0, 3);

            if (!inCodeBlock) {
                // Starting a code block
                inCodeBlock = true;
                codeBlockFence = currentFence;

                // Ensure blank line before code block if not at start
                if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                    formattedLines.push('');
                }
                formattedLines.push(trimmed);
            } else {
                // Ending a code block
                if (trimmed.startsWith(codeBlockFence)) {
                    inCodeBlock = false;
                    formattedLines.push(trimmed);
                    codeBlockFence = '';
                } else {
                    formattedLines.push(line);
                }
            }
            continue;
        }

        if (inCodeBlock) {
            formattedLines.push(line);
            continue;
        }

        // 3. Tables
        // Simple table detection: starts and ends with | and has at least one | inside
        if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.indexOf('|', 1) !== -1) {
            if (!inTable) {
                // Ensure blank line before table
                if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                    formattedLines.push('');
                }
                inTable = true;
            }

            // Parse row
            const cells: string[] = [];
            let currentCell = '';
            let escaped = false;
            // Slice off first and last pipe
            const content = trimmed.substring(1, trimmed.length - 1);

            for (let j = 0; j < content.length; j++) {
                const char = content[j];
                if (escaped) {
                    currentCell += char;
                    escaped = false;
                } else if (char === '\\') {
                    currentCell += char;
                    escaped = true;
                } else if (char === '|') {
                    cells.push(currentCell);
                    currentCell = '';
                } else {
                    currentCell += char;
                }
            }
            cells.push(currentCell);
            tableRows.push(cells);
            continue;
        } else if (inTable) {
            flushTable();
            inTable = false;
        }

        // 4. Headers
        if (trimmed.startsWith('#')) {
            const match = trimmed.match(/^(#+)(.*)$/);
            if (match) {
                const level = match[1];
                const content = match[2].trim();

                // Ensure blank line before header
                if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                    formattedLines.push('');
                }

                formattedLines.push(`${level} ${content}`);
                continue;
            }
        }

        // 5. Horizontal Rules
        if (/^(\s*[-*_]){3,}\s*$/.test(line)) {
            // Ensure blank line before HR
            if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                formattedLines.push('');
            }
            // Normalize to ---
            formattedLines.push('---');
            continue;
        }

        // 6. Blockquotes
        if (trimmed.startsWith('>')) {
            const match = line.match(/^(\s*>+)(.*)$/);
            if (match) {
                const markers = match[1].trim();
                const text = match[2].trim();
                // Ensure space after markers
                formattedLines.push(`${markers} ${text}`);
            } else {
                formattedLines.push(`> ${trimmed.substring(1).trim()}`);
            }
            continue;
        }

        // 7. Lists
        const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
        if (listMatch) {
            const indent = listMatch[1];
            let marker = listMatch[2];
            const content = listMatch[3].trim();

            // Normalize marker for unordered lists to '-'
            if (['*', '+'].includes(marker)) {
                marker = '-';
            }

            let level = 0;
            if (indent.includes('\t')) {
                level = indent.length;
            } else {
                level = Math.floor(indent.length / 2);
            }

            const newIndent = '  '.repeat(level);
            formattedLines.push(`${newIndent}${marker} ${content}`);
            continue;
        }

        // 8. Empty Lines
        if (trimmed === '') {
            if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] === '') {
                continue;
            }
            formattedLines.push('');
            continue;
        }

        // 9. Regular Text (Paragraphs)
        const leadingSpace = line.match(/^\s*/)?.[0] || '';
        if (leadingSpace.length >= 2) {
             const level = Math.floor(leadingSpace.length / 2);
             formattedLines.push('  '.repeat(level) + trimmed);
        } else {
            formattedLines.push(trimmed);
        }
    }

    if (inTable) {
        flushTable();
    }

    // Join and ensure single newline at end
    let result = formattedLines.join('\n');
    if (!result.endsWith('\n')) {
        result += '\n';
    }
    return result;
}
