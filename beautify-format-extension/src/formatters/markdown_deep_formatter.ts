export function formatMarkdownDeep(text: string): string {
    const lines = text.split(/\r?\n/);
    const formattedLines: string[] = [];

    let inCodeBlock = false;
    let codeBlockFence = '';
    let inTable = false;
    let tableRows: string[][] = [];
    let inFrontmatter = false;
    let tableAlignments: ('left' | 'center' | 'right' | null)[] = [];

    // Helper to protect code spans
    // Splits by backticks (inline code) and only processes text parts
    const processOutsideCode = (str: string, processor: (s: string) => string): string => {
        const parts: string[] = [];
        let lastIndex = 0;
        // Regex to match inline code spans: `...` or ``...``
        // Matches balanced backticks: (`+)([^]*?)\1
        const regex = /(`+)([^]*?)\1/g;
        let match;

        while ((match = regex.exec(str)) !== null) {
            // Add text before match, processed
            const before = str.substring(lastIndex, match.index);
            parts.push(processor(before));

            // Add code span as is
            parts.push(match[0]);

            lastIndex = regex.lastIndex;
        }

        // Add remaining text, processed
        const remaining = str.substring(lastIndex);
        parts.push(processor(remaining));

        return parts.join('');
    };

    // Emphasis normalization helper
    const normalizeEmphasis = (str: string): string => {
        return processOutsideCode(str, (s) => {
            let res = s;
            // ***bold italic*** -> **_bold italic_**
            res = res.replace(/(?<!\\)\*\*\*(.+?)(?<!\\)\*\*\*/g, '**_$1_**');
            // *italic* -> _italic_
            res = res.replace(/(?<!\*|\\)\*(?!\*)(.+?)(?<!\*|\\)\*(?!\*)/g, '_$1_');
            return res;
        });
    };

    const flushTable = () => {
        if (tableRows.length === 0) return;

        // Determine alignments from the separator line (index 1)
        if (tableRows.length >= 2) {
             const separatorRow = tableRows[1];
             const isSeparator = separatorRow.every(cell => /^\s*:?-+:?\s*$/.test(cell));
             if (isSeparator) {
                 tableAlignments = separatorRow.map(cell => {
                     const trimmed = cell.trim();
                     if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
                     if (trimmed.endsWith(':')) return 'right';
                     return 'left';
                 });
             }
        }

        // Calculate max width for each column
        const colWidths: number[] = [];
        tableRows.forEach(row => {
            row.forEach((cell, i) => {
                const len = cell.trim().length;
                colWidths[i] = Math.max(colWidths[i] || 0, len);
                if (i < colWidths.length) {
                    colWidths[i] = Math.max(colWidths[i], 3);
                }
            });
        });

        // Format rows
        tableRows.forEach((row, rowIndex) => {
            const isSeparator = rowIndex === 1 && row.every(cell => /^\s*:?-+:?\s*$/.test(cell));

            const formattedRow = row.map((cell, i) => {
                const trimmed = cell.trim();
                const width = colWidths[i];
                const alignment = tableAlignments[i] || 'left';

                if (isSeparator) {
                    if (alignment === 'center') {
                        return `:${'-'.repeat(Math.max(1, width - 2))}:`;
                    } else if (alignment === 'right') {
                        return `${'-'.repeat(Math.max(1, width - 1))}:`;
                    } else {
                        return `:${'-'.repeat(Math.max(1, width - 1))}`;
                    }
                } else {
                    if (alignment === 'center') {
                        const padding = width - trimmed.length;
                        const leftPad = Math.floor(padding / 2);
                        const rightPad = padding - leftPad;
                        return ' '.repeat(leftPad) + trimmed + ' '.repeat(rightPad);
                    } else if (alignment === 'right') {
                        return trimmed.padStart(width);
                    } else {
                        return trimmed.padEnd(width);
                    }
                }
            }).join(' | ');

            formattedLines.push(`| ${formattedRow} |`);
        });

        tableRows = [];
        tableAlignments = [];
    };

    const getLevel = (indent: string): number => {
        const spaces = indent.replace(/\t/g, '  ').length;
        return Math.floor(spaces / 2);
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
                inCodeBlock = true;
                codeBlockFence = currentFence;
                if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                    formattedLines.push('');
                }
                formattedLines.push(trimmed);
            } else {
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
        if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.indexOf('|', 1) !== -1) {
            if (!inTable) {
                if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                    formattedLines.push('');
                }
                inTable = true;
            }
            const cells: string[] = [];
            let currentCell = '';
            let escaped = false;
            let inBackticks = false;

            const content = trimmed.substring(1, trimmed.length - 1);
            for (let j = 0; j < content.length; j++) {
                const char = content[j];

                if (char === '`' && !escaped) {
                    inBackticks = !inBackticks;
                }

                if (escaped) {
                    currentCell += char;
                    escaped = false;
                } else if (char === '\\') {
                    currentCell += char;
                    escaped = true;
                } else if (char === '|' && !inBackticks) {
                    cells.push(normalizeEmphasis(currentCell.trim()));
                    currentCell = '';
                } else {
                    currentCell += char;
                }
            }
            cells.push(normalizeEmphasis(currentCell.trim()));
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
                let content = match[2].trim();
                content = normalizeEmphasis(content);
                if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                    formattedLines.push('');
                }
                formattedLines.push(`${level} ${content}`);
                continue;
            }
        }

        // 5. Horizontal Rules
        if (/^(\s*[-*_]){3,}\s*$/.test(line)) {
            if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                formattedLines.push('');
            }
            formattedLines.push('---');
            continue;
        }

        // 6. Blockquotes
        if (trimmed.startsWith('>')) {
            let processed = line.trim();
            const match = processed.match(/^((?:>\s?)+)(.*)$/);
            if (match) {
                let markers = match[1].replace(/\s/g, '');
                markers = markers.split('').join(' ');
                let content = match[2].trim();
                content = normalizeEmphasis(content);

                if (content === '') {
                    formattedLines.push(markers);
                } else {
                    formattedLines.push(`${markers} ${content}`);
                }
            } else {
                formattedLines.push(processed);
            }
            continue;
        }

        // 7. Lists
        const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
        if (listMatch) {
            const indent = listMatch[1];
            let marker = listMatch[2];
            let content = listMatch[3].trim();
            content = normalizeEmphasis(content);

            if (['*', '+'].includes(marker)) {
                marker = '-';
            }

            const level = getLevel(indent);
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

        // 9. Regular Text
        const leadingSpace = line.match(/^\s*/)?.[0] || '';
        let processedContent = trimmed;
        processedContent = normalizeEmphasis(processedContent);

        if (leadingSpace.length >= 2) {
             const level = getLevel(leadingSpace);
             formattedLines.push('  '.repeat(level) + processedContent);
        } else {
            formattedLines.push(processedContent);
        }
    }

    if (inTable) {
        flushTable();
    }

    let result = formattedLines.join('\n');
    if (!result.endsWith('\n')) {
        result += '\n';
    }
    return result;
}
