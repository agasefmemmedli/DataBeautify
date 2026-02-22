export function formatMDXDeep(text: string): string {
    // 1. Mask Frontmatter to protect it
    const masks: string[] = [];
    const maskPrefix = '___MDX_MASK_';

    let maskedText = text;

    // Mask Frontmatter
    maskedText = maskedText.replace(/^---[\s\S]*?---/, (match) => {
        const placeholder = `${maskPrefix}${masks.length}___`;
        masks.push(match);
        return placeholder;
    });

    // Mask JSX blocks to protect them from Markdown formatter
    // This is tricky because JSX can be nested and multiline.
    // A simple regex might fail on nested tags.
    // However, for a "resilient fallback", we can try to mask strictly balanced tags or just rely on the Markdown formatter
    // if we can teach it to respect indentation of lines starting with <.

    // The current markdown_deep_formatter.ts handles lists and headers.
    // If we pass JSX through it, it might treat them as paragraphs and dedent them.

    // Let's iterate line by line instead of masking, extending the markdown logic.
    // But since we want to reuse code, maybe we can implement a custom loop here.

    const lines = maskedText.split('\n');
    const formattedLines: string[] = [];

    let inCodeBlock = false;
    let codeBlockFence = '';
    let inTable = false;
    let tableRows: string[][] = [];
    let jsxIndentLevel = 0;

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
            const isSeparator = rowIndex === 1 && row.every(cell => /^\s*:?-+:?\s*$/.test(cell));
            const formattedRow = row.map((cell, i) => {
                const trimmed = cell.trim();
                const width = colWidths[i];
                if (isSeparator) {
                    const hasLeft = trimmed.startsWith(':');
                    const hasRight = trimmed.endsWith(':');
                    if (hasLeft && hasRight) return `:${'-'.repeat(Math.max(1, width - 2))}:`;
                    if (hasLeft) return `:${'-'.repeat(Math.max(1, width - 1))}`;
                    if (hasRight) return `${'-'.repeat(Math.max(1, width - 1))}:`;
                    return '-'.repeat(Math.max(1, width));
                } else {
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

        // 0. Handle Masks (Frontmatter) - if it's a mask line, just push it
        if (trimmed.startsWith(maskPrefix)) {
            formattedLines.push(trimmed);
            continue;
        }

        // 1. Code Blocks
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

        // 2. ESM Imports/Exports (MDX specific)
        if (/^(import|export)\s/.test(trimmed)) {
            formattedLines.push(trimmed);
            continue;
        }

        // 3. JSX Elements (Simple Indentation)
        // Check if line looks like a tag start or end
        const isTagStart = /<[a-zA-Z][^>]*>?/.test(trimmed) && !trimmed.startsWith('<!--');
        const isTagEnd = /<\/[a-zA-Z][^>]*>/.test(trimmed);
        const isSelfClosing = /\/>$/.test(trimmed);

        if (isTagStart || isTagEnd || jsxIndentLevel > 0) {
            if (inTable) {
                flushTable();
                inTable = false;
            }

            // Heuristic indentation for JSX
            // If it starts with closing tag, dedent this line
            let currentLineIndent = jsxIndentLevel;
            if (trimmed.startsWith('</') || trimmed.startsWith('/>') || trimmed.startsWith('}')) {
                currentLineIndent = Math.max(0, jsxIndentLevel - 1);
            }

            formattedLines.push('  '.repeat(currentLineIndent) + trimmed);

            // Calculate next indentation
            // Count open tags and close tags
            // This is very rough but okay for a fallback
            const openTags = (trimmed.match(/<[a-zA-Z][a-zA-Z0-9]*(\s[^>]*)?>/g) || []).filter(t => !t.endsWith('/>')).length;
            const closeTags = (trimmed.match(/<\/[a-zA-Z][a-zA-Z0-9]*>/g) || []).length;

            // Also handle braces for JS expressions in JSX
            const openBraces = (trimmed.match(/\{/g) || []).length;
            const closeBraces = (trimmed.match(/\}/g) || []).length;

            let netChange = openTags - closeTags + (openBraces - closeBraces);

            // Correction for self-closing in match logic
            // The regex for openTags excludes /> ending, but complex props might trick it.

            jsxIndentLevel = Math.max(0, jsxIndentLevel + netChange);
            continue;
        }

        // 4. Tables
        if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.indexOf('|', 1) !== -1) {
            if (!inTable) {
                if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                    formattedLines.push('');
                }
                inTable = true;
            }
            const cells = trimmed.split('|').slice(1, -1);
            tableRows.push(cells);
            continue;
        } else if (inTable) {
            flushTable();
            inTable = false;
        }

        // 5. Headers
        if (trimmed.startsWith('#')) {
            const match = trimmed.match(/^(#+)(.*)$/);
            if (match) {
                if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                    formattedLines.push('');
                }
                formattedLines.push(`${match[1]} ${match[2].trim()}`);
                continue;
            }
        }

        // 6. Lists and others - Fallback to simple preservation or minimal formatting
        // Ideally we call formatMarkdownDeep logic here, but mixing line loops is hard.
        // Let's implement basic list handling.

        const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
        if (listMatch) {
            const indent = listMatch[1];
            let marker = listMatch[2];
            const content = listMatch[3].trim();

            if (['*', '+'].includes(marker)) marker = '-';

            // Preserve indentation level
            formattedLines.push(`${indent}${marker} ${content}`);
            continue;
        }

        // Default
        if (trimmed === '') {
            if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                formattedLines.push('');
            }
        } else {
            formattedLines.push(trimmed);
        }
    }

    if (inTable) {
        flushTable();
    }

    let result = formattedLines.join('\n');

    // Unmask
    result = result.replace(new RegExp(`${maskPrefix}(\\d+)___`, 'g'), (_: string, index: string) => {
        return masks[parseInt(index)];
    });

    if (!result.endsWith('\n')) {
        result += '\n';
    }

    return result;
}
