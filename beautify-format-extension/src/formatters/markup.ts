import * as vscode from 'vscode';
import { applyEdit } from '../utils';

/**
 * Handle Markdown formatting and validation
 */
export async function handleMarkdown(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Markdown
    validationMessage = validateMarkdown(text);

    // Try Deep Formatting with Prettier (Standard Style)
    try {
        const prettier = await import('prettier');

        formatted = await prettier.format(text, {
            parser: "markdown",
            tabWidth: 2,
            useTabs: false,
            proseWrap: "preserve", // Don't enforce line wrapping unless user wants it (safer default)
            printWidth: 80,
        });
    } catch (prettierError: any) {
        console.warn('Prettier Markdown formatting failed, falling back to custom formatter', prettierError);

        // Resilient formatting logic (Fallback)
        try {
            const lines = text.split('\n');
                const formattedLines: string[] = [];
                let inCodeBlock = false;
                let inTable = false;
                let tableRows: string[][] = [];

                const flushTable = (rows: string[][]) => {
                    if (rows.length === 0) return;
                    const maxWidths: number[] = [];
                    rows.forEach(row => {
                        row.forEach((cell, i) => {
                            maxWidths[i] = Math.max(maxWidths[i] || 0, cell.trim().length);
                        });
                    });

                    rows.forEach((row, rowIndex) => {
                        const isSeparator = rowIndex === 1 && row.every(cell => /^\s*:?-+:?\s*$/.test(cell));
                        const formattedRow = row.map((cell, i) => {
                            const trimmed = cell.trim();
                            if (isSeparator) {
                                const hasLeftColon = trimmed.startsWith(':');
                                const hasRightColon = trimmed.endsWith(':');
                                let content = '-'.repeat(Math.max(3, maxWidths[i]));
                                if (hasLeftColon && hasRightColon) {
                                    content = ':' + '-'.repeat(Math.max(1, maxWidths[i] - 2)) + ':';
                                } else if (hasLeftColon) {
                                    content = ':' + '-'.repeat(Math.max(2, maxWidths[i] - 1));
                                } else if (hasRightColon) {
                                    content = '-'.repeat(Math.max(2, maxWidths[i] - 1)) + ':';
                                }
                                return content;
                            }
                            return ' ' + trimmed.padEnd(maxWidths[i]) + ' ';
                        }).join('|');
                        formattedLines.push('|' + formattedRow + '|');
                    });
                };

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const trimmed = line.trim();

                    // Code blocks
                    if (trimmed.startsWith('```')) {
                        if (inTable) {
                            flushTable(tableRows);
                            tableRows = [];
                            inTable = false;
                        }
                        inCodeBlock = !inCodeBlock;
                        // Ensure blank line before code block if not at start
                        if (inCodeBlock && formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                            formattedLines.push('');
                        }
                        formattedLines.push(trimmed);
                        continue;
                    }

                    if (inCodeBlock) {
                        formattedLines.push(line);
                        continue;
                    }

                    // Tables
                    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
                        inTable = true;
                        const cells = trimmed.split('|').slice(1, -1);
                        tableRows.push(cells);
                        continue;
                    } else if (inTable) {
                        flushTable(tableRows);
                        tableRows = [];
                        inTable = false;
                    }

                    // Empty lines
                    if (trimmed === '') {
                        formattedLines.push('');
                        continue;
                    }

                    // Headers
                    if (trimmed.startsWith('#')) {
                        const match = trimmed.match(/^(#+)(.*)$/);
                        if (match) {
                            const level = match[1];
                            const content = match[2].trim();
                            // Ensure blank line before header if not at start
                            if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                                formattedLines.push('');
                            }
                            formattedLines.push(`${level} ${content}`);
                            continue;
                        }
                    }

                    // Horizontal Rules
                    if (/^(\s*[-*_]){3,}\s*$/.test(line)) {
                        if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                            formattedLines.push('');
                        }
                        formattedLines.push('---');
                        continue;
                    }

                    // Lists
                    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
                    if (listMatch) {
                        const indent = listMatch[1];
                        let marker = listMatch[2];
                        if (marker === '*' || marker === '+') marker = '-'; // Normalize
                        const content = listMatch[3].trim();
                        formattedLines.push(`${indent}${marker} ${content}`);
                        continue;
                    }

                    // Blockquotes
                    if (trimmed.startsWith('>')) {
                        const content = trimmed.substring(1).trim();
                        formattedLines.push(`> ${content}`);
                        continue;
                    }

                    // Regular text
                    formattedLines.push(trimmed);
                }

                if (inTable) {
                    flushTable(tableRows);
                }

                formatted = formattedLines.join('\n');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to format Markdown: ${error.message}`);
            return;
        }

        if (!validationMessage) {
            validationMessage = "Deep formatting (Prettier) failed. Applied resilient formatting.";
        }
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Markdown has potential issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Markdown formatted successfully!');
    }
}

/**
 * Custom resilient Markdown validator
 */
function validateMarkdown(text: string): string | undefined {
    let inCodeBlock = false;
    let codeBlockLine = 0;
    let inTable = false;
    let tableStartLine = 0;
    let tableColumnCount = 0;
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.startsWith('```')) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                codeBlockLine = i + 1;
            } else {
                inCodeBlock = false;
            }
            continue;
        }

        if (inCodeBlock) continue;

        if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
            const cells = trimmed.split('|').slice(1, -1);
            if (!inTable) {
                inTable = true;
                tableStartLine = i + 1;
                tableColumnCount = cells.length;
            } else {
                if (cells.length !== tableColumnCount) {
                    // Only report if it's not the separator line which might have different splitting if not careful
                    // but usually it should have the same number of pipes.
                    // Actually, let's be lenient on separators but strict on data rows.
                    const isSeparator = cells.every(cell => /^\s*:?-+:?\s*$/.test(cell));
                    if (!isSeparator) {
                        return `Inconsistent column count in table at line ${i + 1} (expected ${tableColumnCount}, got ${cells.length})`;
                    }
                }
            }
        } else {
            inTable = false;
        }
    }

    if (inCodeBlock) {
        return `Unclosed code block starting at line ${codeBlockLine}`;
    }

    return undefined;
}

/**
 * Handle MDX formatting and validation
 */
export async function handleMDX(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate MDX
    validationMessage = validateMDX(text);

    // Try Deep Formatting with Prettier (Standard Style)
    try {
        const prettier = await import('prettier');

        formatted = await prettier.format(text, {
            parser: "mdx",
            tabWidth: 2,
            useTabs: false,
            proseWrap: "preserve",
            printWidth: 80,
            singleQuote: false,
            jsxSingleQuote: false,
            bracketSpacing: true
        });
    } catch (prettierError: any) {
        console.warn('Prettier MDX formatting failed, falling back to custom formatter', prettierError);

        // Resilient formatting logic (Fallback)
        try {
            const lines = text.split('\n');
        const formattedLines: string[] = [];
        let inCodeBlock = false;
        let inTable = false;
        let tableRows: string[][] = [];
        let inFrontmatter = false;
        let jsxIndentLevel = 0;

        const flushTable = (rows: string[][]) => {
            if (rows.length === 0) return;
            const maxWidths: number[] = [];
            rows.forEach(row => {
                row.forEach((cell, i) => {
                    maxWidths[i] = Math.max(maxWidths[i] || 0, cell.trim().length);
                });
            });

            rows.forEach((row, rowIndex) => {
                const isSeparator = rowIndex === 1 && row.every(cell => /^\s*:?-+:?\s*$/.test(cell));
                const formattedRow = row.map((cell, i) => {
                    const trimmed = cell.trim();
                    if (isSeparator) {
                        const hasLeftColon = trimmed.startsWith(':');
                        const hasRightColon = trimmed.endsWith(':');
                        let content = '-'.repeat(Math.max(3, maxWidths[i]));
                        if (hasLeftColon && hasRightColon) {
                            content = ':' + '-'.repeat(Math.max(1, maxWidths[i] - 2)) + ':';
                        } else if (hasLeftColon) {
                            content = ':' + '-'.repeat(Math.max(2, maxWidths[i] - 1));
                        } else if (hasRightColon) {
                            content = '-'.repeat(Math.max(2, maxWidths[i] - 1)) + ':';
                        }
                        return content;
                    }
                    return ' ' + trimmed.padEnd(maxWidths[i]) + ' ';
                }).join('|');
                formattedLines.push('|' + formattedRow + '|');
            });
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Frontmatter
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

            // ESM imports/exports
            if (!inCodeBlock && /^(import|export)\b/.test(trimmed)) {
                formattedLines.push(trimmed);
                continue;
            }

            // Code blocks
            if (trimmed.startsWith('```')) {
                if (inTable) {
                    flushTable(tableRows);
                    tableRows = [];
                    inTable = false;
                }
                inCodeBlock = !inCodeBlock;
                if (inCodeBlock && formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                    formattedLines.push('');
                }
                formattedLines.push(trimmed);
                continue;
            }

            if (inCodeBlock) {
                formattedLines.push(line);
                continue;
            }

            // Tables
            if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
                inTable = true;
                const cells = trimmed.split('|').slice(1, -1);
                tableRows.push(cells);
                continue;
            } else if (inTable) {
                flushTable(tableRows);
                tableRows = [];
                inTable = false;
            }

            // Empty lines
            if (trimmed === '') {
                formattedLines.push('');
                continue;
            }

            // JSX elements
            if (trimmed.startsWith('<') || trimmed.startsWith('</') || jsxIndentLevel > 0) {
                // Determine indentation for this line
                let currentLineIndent = jsxIndentLevel;
                if (trimmed.startsWith('</') || trimmed.startsWith('/>')) {
                    currentLineIndent = Math.max(0, jsxIndentLevel - 1);
                }

                formattedLines.push('  '.repeat(currentLineIndent) + trimmed);

                // Update indent level for next line
                const openTags = (trimmed.match(/<[a-zA-Z][a-zA-Z0-9]*/g) || []).length;
                const closeTags = (trimmed.match(/<\/[a-zA-Z][a-zA-Z0-9]*>|\/>/g) || []).length;
                jsxIndentLevel = Math.max(0, jsxIndentLevel + openTags - closeTags);
                continue;
            }

            // Headers
            if (trimmed.startsWith('#')) {
                const match = trimmed.match(/^(#+)(.*)$/);
                if (match) {
                    const level = match[1];
                    const content = match[2].trim();
                    if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                        formattedLines.push('');
                    }
                    formattedLines.push(`${level} ${content}`);
                    continue;
                }
            }

            // Lists
            const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
            if (listMatch) {
                const indent = listMatch[1];
                let marker = listMatch[2];
                if (marker === '*' || marker === '+') marker = '-';
                const content = listMatch[3].trim();
                formattedLines.push(`${indent}${marker} ${content}`);
                continue;
            }

            // Blockquotes
            if (trimmed.startsWith('>')) {
                const content = trimmed.substring(1).trim();
                formattedLines.push(`> ${content}`);
                continue;
            }

            // Regular text
            formattedLines.push(trimmed);
        }

        if (inTable) {
            flushTable(tableRows);
        }

        formatted = formattedLines.join('\n');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to format MDX: ${error.message}`);
            return;
        }

        if (!validationMessage) {
            validationMessage = "Deep formatting (Prettier) failed. Applied resilient formatting.";
        }
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`MDX has potential issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('MDX formatted successfully!');
    }
}

/**
 * Custom resilient MDX validator
 */
function validateMDX(text: string): string | undefined {
    let inCodeBlock = false;
    let codeBlockLine = 0;
    const jsxStack: { tag: string, line: number }[] = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.startsWith('```')) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                codeBlockLine = i + 1;
            } else {
                inCodeBlock = false;
            }
            continue;
        }

        if (inCodeBlock) continue;

        // Basic JSX tag tracking
        const tagMatches = line.matchAll(/<(\/)?([a-zA-Z][a-zA-Z0-9]*)[^>]*(\/)?>/g);
        for (const match of tagMatches) {
            const isClosing = match[1] === '/';
            const tagName = match[2];
            const isSelfClosing = match[3] === '/';

            if (isSelfClosing) continue;

            if (isClosing) {
                if (jsxStack.length === 0) {
                    return `Unexpected closing tag </${tagName}> at line ${i + 1}`;
                }
                const last = jsxStack.pop()!;
                if (last.tag !== tagName) {
                    return `Mismatched closing tag </${tagName}> at line ${i + 1} (expected </${last.tag}> from line ${last.line})`;
                }
            } else {
                jsxStack.push({ tag: tagName, line: i + 1 });
            }
        }
    }

    if (inCodeBlock) {
        return `Unclosed code block starting at line ${codeBlockLine}`;
    }

    if (jsxStack.length > 0) {
        const last = jsxStack.pop()!;
        return `Unclosed JSX tag <${last.tag}> starting at line ${last.line}`;
    }

    return undefined;
}

/**
 * Handle LaTeX formatting and validation
 */
export async function handleLaTeX(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate LaTeX
    validationMessage = validateLaTeX(text);

    // Resilient Deep Formatting logic
    try {
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

            // Filter out \begin{document} / \end{document} from indent counting if we want to suppress main indent
            const netBegin = beginMatches.filter(m => !m.includes('{document}')).length;
            const netEnd = endMatches.filter(m => !m.includes('{document}')).length;

            // 2. \[ ... \]
            let mathOpen = 0;
            let mathClose = 0;
            if (lineWithoutComment.includes('\\[')) mathOpen++;
            if (lineWithoutComment.includes('\\]')) mathClose++;

            // 3. { ... } blocks (only if they are clearly structural, e.g. at end of line)
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

        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format LaTeX: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`LaTeX has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('LaTeX formatted successfully!');
    }
}

/**
 * Helper to align table-like content
 */
function formatAlignedTable(lines: string[], delimiter: string = '&'): string[] {
    // 1. Parse rows and columns
    const rows = lines.map(line => {
        if (line.trim() === '') return ['']; // preserve empty lines as empty rows

        // Handle \hline or similar which shouldn't be aligned with &
        if (line.trim().startsWith('\\hline') || line.trim().startsWith('\\cline')) {
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
        if (row.length > 1) { // Only calculate for rows that actually have columns
            row.forEach((col, i) => {
                colWidths[i] = Math.max(colWidths[i] || 0, col.trim().length);
            });
        }
    });

    // 3. Reconstruct lines
    return rows.map(row => {
        if (row.length === 1) return row[0]; // \hline or text without &

        return row.map((col, i) => {
            const trimmed = col.trim();
            // Don't pad the last column
            if (i === row.length - 1) return trimmed;
            return trimmed.padEnd(colWidths[i]);
        }).join(` ${delimiter} `);
    });
}

/**
 * Custom resilient LaTeX validator
 */
function validateLaTeX(text: string): string | undefined {
    const stack: { env: string, line: number, col: number }[] = [];
    const braceStack: { line: number, col: number }[] = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];

            if (char === '%') {
                break; // Comment starts
            }

            if (char === '\\') {
                // Check if it's a structural command
                const remaining = line.substring(j);
                if (remaining.startsWith('\\begin{')) {
                    const endIdx = line.indexOf('}', j + 7);
                    if (endIdx !== -1) {
                        const envName = line.substring(j + 7, endIdx);
                        stack.push({ env: envName, line: i + 1, col: j + 1 });
                        j = endIdx;
                        continue;
                    }
                } else if (remaining.startsWith('\\end{')) {
                    const endIdx = line.indexOf('}', j + 5);
                    if (endIdx !== -1) {
                        const envName = line.substring(j + 5, endIdx);
                        if (stack.length === 0) {
                            return `Unexpected \\end{${envName}} at line ${i + 1}, col ${j + 1}`;
                        }
                        const last = stack.pop()!;
                        if (last.env !== envName) {
                            return `Mismatched \\end{${envName}} at line ${i + 1}, col ${j + 1} (expected closure for \\begin{${last.env}} from line ${last.line})`;
                        }
                        j = endIdx;
                        continue;
                    }
                }
                // Otherwise it's just a command or escaped char, skip next char
                j++;
                continue;
            }

            // Braces
            if (char === '{') {
                braceStack.push({ line: i + 1, col: j + 1 });
            } else if (char === '}') {
                if (braceStack.length > 0) {
                    braceStack.pop();
                }
            }
        }
    }

    if (stack.length > 0) {
        const last = stack.pop()!;
        return `Unclosed environment \\begin{${last.env}} starting at line ${last.line}`;
    }

    if (braceStack.length > 0) {
        const last = braceStack.pop()!;
        return `Unclosed brace '{' starting at line ${last.line}`;
    }

    return undefined;
}

/**
 * Handle Astro formatting and validation
 */
export async function handleAstro(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Lazy load dependencies
    const jsbeautify = require('js-beautify');

    // Validate Astro
    validationMessage = validateAstro(text);

    // Resilient formatting logic
    try {
        // Astro structure:
        // ---
        // frontmatter (TS/JS)
        // ---
        // template (HTML/JSX-like)

        const frontmatterRegex = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/m;
        const match = text.match(frontmatterRegex);

        let frontmatter = '';
        let template = text;
        let frontmatterRaw = '';

        if (match) {
            frontmatterRaw = match[0];
            const content = match[1];
            // Format frontmatter as TypeScript
            // Use js-beautify.js
            /* eslint-disable */
            const formattedContent = jsbeautify.js(content, {
                indent_size: 2,
                indent_char: ' ',
                max_preserve_newlines: 2,
                preserve_newlines: true,
                keep_array_indentation: false,
                break_chained_methods: false,
                brace_style: 'collapse',
                space_before_conditional: true,
                unescape_strings: false,
                jslint_happy: false,
                end_with_newline: false,
                wrap_line_length: 0,
                comma_first: false,
                e4x: true,
                indent_empty_lines: false
            });
            /* eslint-enable */
            frontmatter = `---\n${formattedContent}\n---`;
            template = text.substring(frontmatterRaw.length).trim();
        }

        // Format template as HTML (with some JSX awareness)
        // We use js-beautify.html, similar to Svelte/Vue
        /* eslint-disable */
        const options: any = {
            indent_size: 2,
            indent_char: ' ',
            max_preserve_newlines: 2,
            preserve_newlines: true,
            indent_scripts: 'normal',
            end_with_newline: false,
            wrap_line_length: 0,
            indent_inner_html: false,
            js: {
                indent_size: 2,
                indent_char: ' ',
                max_preserve_newlines: 2,
                preserve_newlines: true,
                keep_array_indentation: false,
                break_chained_methods: false,
                brace_style: 'collapse',
                space_before_conditional: true,
                unescape_strings: false,
                jslint_happy: false,
                end_with_newline: false,
                wrap_line_length: 0,
                comma_first: false,
                e4x: true,
                indent_empty_lines: false
            },
            css: {
                indent_size: 2,
                indent_char: ' ',
                selector_separator_newline: true,
                newline_between_rules: true,
                end_with_newline: false
            }
        };
        const formattedTemplate = jsbeautify.html(template, options);
        /* eslint-enable */

        if (frontmatter) {
            formatted = `${frontmatter}\n\n${formattedTemplate}`;
        } else {
            formatted = formattedTemplate;
        }

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Astro: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Astro has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Astro formatted successfully!');
    }
}

/**
 * Custom resilient Astro validator
 */
function validateAstro(text: string): string | undefined {
    // Check for frontmatter
    const trimmed = text.trim();
    if (trimmed.startsWith('---')) {
        const parts = text.split('---');
        // Valid frontmatter should result in at least 3 parts (empty pre, content, post)
        // Or if it's the only thing, 2 parts?
        // text: "---\nfoo\n---" -> ["", "\nfoo\n", ""]
        if (parts.length < 3) {
            return "Unclosed frontmatter (missing closing '---')";
        }
    }

    // Basic HTML validation for template
    const lines = text.split('\n');
    let inFrontmatter = false;
    if (trimmed.startsWith('---')) {
        inFrontmatter = true;
    }

    const stack: { tag: string, line: number }[] = [];
    const voidTags = [
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
    ];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (inFrontmatter) {
            if (line.trim() === '---' && i > 0) {
                inFrontmatter = false;
            }
            continue;
        }

        // Simple tag matching
        // <Tag>, </Tag>, <Tag />, <Component />
        const regex = /<\/?([a-zA-Z0-9.\-_]+)[^>]*>/g;
        let match;
        while ((match = regex.exec(line)) !== null) {
            const fullTag = match[0];
            const tagName = match[1];
            const isClosing = fullTag.startsWith('</');
            const isSelfClosing = fullTag.endsWith('/>');

            if (isSelfClosing || voidTags.includes(tagName.toLowerCase())) {
                continue;
            }

            if (isClosing) {
                if (stack.length === 0) {
                    return `Unexpected closing tag </${tagName}> at line ${i + 1}`;
                }
                const last = stack.pop()!;
                if (last.tag !== tagName) {
                     return `Mismatched closing tag </${tagName}> at line ${i + 1} (expected </${last.tag}> from line ${last.line})`;
                }
            } else {
                stack.push({ tag: tagName, line: i + 1 });
            }
        }
    }

    if (stack.length > 0) {
        const last = stack.pop()!;
        return `Unclosed tag <${last.tag}> starting at line ${last.line}`;
    }

    return undefined;
}

/**
 * Handle Handlebars formatting and validation
 */
export async function handleHandlebars(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Handlebars
    validationMessage = validateHandlebars(text);

    // Deep Formatting logic (Prettier)
    try {
        const prettier = await import('prettier');

        formatted = await prettier.format(text, {
            parser: 'glimmer',
            tabWidth: 2,
            useTabs: false,
            printWidth: 80,
            singleQuote: false,
            bracketSameLine: false
        });
    } catch (prettierError: any) {
        console.warn('Prettier Handlebars formatting failed, falling back to custom formatter', prettierError);

        // Resilient formatting logic (Fallback)
        try {
            const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;

        // Void tags that don't need closing
        const voidTags = [
            'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
            'link', 'meta', 'param', 'source', 'track', 'wbr'
        ];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '') {
                formattedLines.push('');
                continue;
            }

            // Check for dedentation triggers at the start of the line
            let currentIndent = indentLevel;

            // Closing Handlebars block: {{/if}}, {{/each}}, etc.
            if (/^{{\/[a-zA-Z0-9_.-]+/.test(trimmed)) {
                currentIndent = Math.max(0, indentLevel - 1);
            }
            // Middle Handlebars block: {{else}}, {{^}}
            else if (/^{{\s*(else|\^)/.test(trimmed)) {
                currentIndent = Math.max(0, indentLevel - 1);
            }
            // Closing HTML tag: </div>
            else if (/^<\/[a-zA-Z0-9]+/.test(trimmed)) {
                currentIndent = Math.max(0, indentLevel - 1);
            }

            // Apply indentation
            formattedLines.push('  '.repeat(currentIndent) + trimmed);

            // Calculate indentation for the NEXT line
            let netChange = 0;

            // Remove comments for analysis
            const lineNoComments = line.replace(/{{!--[\s\S]*?--}}/g, '').replace(/{{![\s\S]*?}}/g, '').replace(/<!--[\s\S]*?-->/g, '');

            // Check for Handlebars block openers
            // {{#if ...}}, {{#each ...}}, {{#with ...}}, {{#block ...}}
            // Excluding self-closing or inline usage if any (though standard block helpers are usually multiline)
            const hbsOpeners = (lineNoComments.match(/{{#[a-zA-Z0-9_.-]+[^}]*}}/g) || []).length;
            const hbsClosers = (lineNoComments.match(/{{\/[a-zA-Z0-9_.-]+}}/g) || []).length;

            // Check for HTML tag openers
            // <div ...> but not <img ...> or <div ... />
            let htmlOpeners = 0;
            let htmlClosers = 0;

            // Simple regex for HTML tags - this is resilient/approximate
            const tagRegex = /<\/?([a-zA-Z0-9]+)[^>]*>/g;
            let match;
            while ((match = tagRegex.exec(lineNoComments)) !== null) {
                const fullTag = match[0];
                const tagName = match[1].toLowerCase();
                const isClosing = fullTag.startsWith('</');
                const isSelfClosing = fullTag.endsWith('/>');

                if (isClosing) {
                    htmlClosers++;
                } else if (!isSelfClosing && !voidTags.includes(tagName)) {
                    htmlOpeners++;
                }
            }

            // Middle blocks (else, ^) don't change net indent for next line relative to previous
            // but effectively we dedented current line, so we need to indent back for content
            if (/^{{\s*(else|\^)/.test(trimmed)) {
                // If we had {{else}}, we printed it at indent-1.
                // The next line should be at indent.
                // So if currentIndent was indent-1, next indent is currentIndent + 1 = indent.
                // No net change to the *base* indentLevel from the start of this line's processing perspective?
                // Actually:
                // if (cond)
                //   stuff
                // else
                //   stuff
                // /if
                // Initial: 0.
                // {{#if}}: current=0, next=1.
                // stuff: current=1, next=1.
                // {{else}}: current=0 (dedented), next=1 (indented back).
                // stuff: current=1, next=1.
                // {{/if}}: current=0 (dedented), next=0.

                // So for {{else}}, we want netChange to be 0 relative to the state *before* the dedent logic?
                // No, indentLevel is the state at start of loop.
                // If line is {{else}}, we used indentLevel-1.
                // Next line should be indentLevel.
                // So indentLevel (next) = indentLevel (current).
                // So netChange = 0.
                // BUT, hbsOpeners/Closers might be 0.
            }

            netChange = (hbsOpeners - hbsClosers) + (htmlOpeners - htmlClosers);
            indentLevel = Math.max(0, indentLevel + netChange);
        }

        formatted = formattedLines.join('\n');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to format Handlebars: ${error.message}`);
            return;
        }

        if (!validationMessage) {
            validationMessage = "Deep formatting (Prettier) failed. Applied resilient formatting.";
        }
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Handlebars has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Handlebars formatted successfully!');
    }
}

/**
 * Custom resilient Handlebars validator
 */
function validateHandlebars(text: string): string | undefined {
    const stack: { tag: string, line: number, type: 'hbs' | 'html' }[] = [];
    const lines = text.split('\n');

    // Void tags that don't need closing
    const voidTags = [
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
    ];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Remove comments
        const lineNoComments = line.replace(/{{!--[\s\S]*?--}}/g, '').replace(/{{![\s\S]*?}}/g, '').replace(/<!--[\s\S]*?-->/g, '');

        // Find all tags in order
        const regex = /({{#([a-zA-Z0-9_.-]+)[^}]*}})|({{\/([a-zA-Z0-9_.-]+)}})|(<\/?([a-zA-Z0-9]+)[^>]*>)/g;
        let match;

        while ((match = regex.exec(lineNoComments)) !== null) {
            if (match[1]) { // Handlebars Open: {{#name ...}}
                const tagName = match[2];
                stack.push({ tag: tagName, line: i + 1, type: 'hbs' });
            } else if (match[3]) { // Handlebars Close: {{/name}}
                const tagName = match[4];
                if (stack.length === 0) {
                    return `Unexpected closing block {{/${tagName}}} at line ${i + 1}`;
                }
                const last = stack.pop()!;
                if (last.type !== 'hbs' || last.tag !== tagName) {
                    return `Mismatched closing block {{/${tagName}}} at line ${i + 1} (expected {{/${last.tag}}} from line ${last.line})`;
                }
            } else if (match[5]) { // HTML Tag
                const fullTag = match[5];
                const tagName = match[6].toLowerCase();
                const isClosing = fullTag.startsWith('</');
                const isSelfClosing = fullTag.endsWith('/>');

                if (isSelfClosing || voidTags.includes(tagName)) {
                    continue;
                }

                if (isClosing) {
                    // Try to match with the last HTML tag, skipping any HBS blocks that might be interleaved
                    // (though valid HBS usually nests strictly)
                    // But for resilience, let's just look at the stack top
                    if (stack.length === 0) {
                        return `Unexpected closing tag </${tagName}> at line ${i + 1}`;
                    }
                    const last = stack.pop()!;
                    // If we find an HBS block, it means we have something like {{#if}} </div> {{/if}} which is invalid nesting
                    if (last.type === 'hbs') {
                         return `Mismatched closing tag </${tagName}> at line ${i + 1} (expected {{/${last.tag}}} from line ${last.line})`;
                    }
                    if (last.tag !== tagName) {
                        return `Mismatched closing tag </${tagName}> at line ${i + 1} (expected </${last.tag}> from line ${last.line})`;
                    }
                } else {
                    stack.push({ tag: tagName, line: i + 1, type: 'html' });
                }
            }
        }
    }

    if (stack.length > 0) {
        const last = stack.pop()!;
        if (last.type === 'hbs') {
            return `Unclosed block {{#${last.tag}}} starting at line ${last.line}`;
        } else {
            return `Unclosed tag <${last.tag}> starting at line ${last.line}`;
        }
    }

    return undefined;
}

/**
 * Handle Twig formatting and validation
 */
export async function handleTwig(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Twig
    validationMessage = validateTwig(text);

    // Deep Formatting logic (Prettier)
    try {
        const prettier = await import('prettier');
        const twigPlugin = await import('@sanderjn/prettier-plugin-twig-melody');

        formatted = await prettier.format(text, {
            parser: 'melody',
            plugins: [twigPlugin],
            tabWidth: 2,
            useTabs: false,
            printWidth: 80,
            singleQuote: false,
            bracketSameLine: false
        });
    } catch (prettierError: any) {
        console.warn('Prettier Twig formatting failed, falling back to custom formatter', prettierError);

        // Resilient formatting logic
        try {
            const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;

        // Void tags that don't need closing
        const voidTags = [
            'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
            'link', 'meta', 'param', 'source', 'track', 'wbr'
        ];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '') {
                formattedLines.push('');
                continue;
            }

            // Check for dedentation triggers at the start of the line
            let currentIndent = indentLevel;

            // Closing Twig block: {% endif %}, {% endblock %}, etc.
            if (/^{%\s*end(if|for|block|macro|embed|apply|sandbox|autoescape|verbatim|set|with|filter|trans)\b/.test(trimmed)) {
                currentIndent = Math.max(0, indentLevel - 1);
            }
            // Middle Twig block: {% else %}, {% elseif %}
            else if (/^{%\s*(else|elseif)\b/.test(trimmed)) {
                currentIndent = Math.max(0, indentLevel - 1);
            }
            // Closing HTML tag: </div>
            else if (/^<\/[a-zA-Z0-9]+/.test(trimmed)) {
                currentIndent = Math.max(0, indentLevel - 1);
            }
            // Closing brace } or ]
            else if (trimmed.startsWith('}') || trimmed.startsWith(']')) {
                 currentIndent = Math.max(0, indentLevel - 1);
            }

            // Apply indentation
            formattedLines.push('  '.repeat(currentIndent) + trimmed);

            // Calculate indentation for the NEXT line
            let netChange = 0;

            // Remove comments for analysis
            const lineNoComments = line.replace(/{#[\s\S]*?#}/g, '').replace(/<!--[\s\S]*?-->/g, '');

            // Check for Twig block openers/closers
            const twigTagRegex = /{%-?\s*([a-zA-Z0-9_]+)([^%]*?)-?%}/g;
            let twigMatch;
            let twigOpeners = 0;
            let twigClosers = 0;

            while ((twigMatch = twigTagRegex.exec(lineNoComments)) !== null) {
                const tagName = twigMatch[1];
                const content = twigMatch[2];

                if (/^end/.test(tagName)) {
                    twigClosers++;
                } else if (/^(block|if|for|macro|embed|apply|sandbox|autoescape|verbatim|with|filter|trans)$/.test(tagName)) {
                    twigOpeners++;
                } else if (tagName === 'set') {
                    // Only count as opener if it's a block set (no '=' assignment)
                    if (!content.includes('=')) {
                        twigOpeners++;
                    }
                }
            }

            // Check for HTML tag openers
            let htmlOpeners = 0;
            let htmlClosers = 0;

            const tagRegex = /<\/?([a-zA-Z0-9]+)[^>]*>/g;
            let match;
            while ((match = tagRegex.exec(lineNoComments)) !== null) {
                const fullTag = match[0];
                const tagName = match[1].toLowerCase();
                const isClosing = fullTag.startsWith('</');
                const isSelfClosing = fullTag.endsWith('/>');

                if (isClosing) {
                    htmlClosers++;
                } else if (!isSelfClosing && !voidTags.includes(tagName)) {
                    htmlOpeners++;
                }
            }

            // Check for brace openers/closers (approximate for objects/arrays)
            const braceOpeners = (lineNoComments.match(/\{|\[/g) || []).length;
            const braceClosers = (lineNoComments.match(/\}|\]/g) || []).length;
            // Ignore double braces used for Twig {{ }}
            const variableOpeners = (lineNoComments.match(/{{/g) || []).length;
            const variableClosers = (lineNoComments.match(/}}/g) || []).length;

            // Adjust brace count by removing variable braces
            // Each {{ is 2 {, each }} is 2 }
            const realBraceOpeners = braceOpeners - (variableOpeners * 2);
            const realBraceClosers = braceClosers - (variableClosers * 2);

            // Only count if positive (simple heuristic)
            const netBraceChange = Math.max(0, realBraceOpeners) - Math.max(0, realBraceClosers);

            netChange = (twigOpeners - twigClosers) + (htmlOpeners - htmlClosers) + netBraceChange;

            // Special handling for intermediate tags: they essentially reset indent for themselves but keep it for content
            // Logic handled by dedent at start, so just ensure we don't double count if we consider them openers?
            // No, 'else' is not in the openers regex above. So it's fine.

            indentLevel = Math.max(0, indentLevel + netChange);
        }

        formatted = formattedLines.join('\n');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to format Twig: ${error.message}`);
            return;
        }

        if (!validationMessage) {
            validationMessage = "Deep formatting (Prettier) failed. Applied resilient formatting.";
        }
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Twig has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Twig formatted successfully!');
    }
}

/**
 * Custom resilient Twig validator
 */
function validateTwig(text: string): string | undefined {
    const stack: { tag: string, line: number, type: 'twig' | 'html' }[] = [];
    const lines = text.split('\n');

    const voidTags = [
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
    ];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Remove comments
        const lineNoComments = line.replace(/{#[\s\S]*?#}/g, '').replace(/<!--[\s\S]*?-->/g, '');

        // Regex for tags
        const regex = /({%\s*(block|if|for|macro|embed|apply|sandbox|autoescape|verbatim|set|with|filter|trans)\b)|({%\s*end(block|if|for|macro|embed|apply|sandbox|autoescape|verbatim|set|with|filter|trans)\b)|(<\/?([a-zA-Z0-9]+)[^>]*>)/g;
        let match;

        while ((match = regex.exec(lineNoComments)) !== null) {
            if (match[1]) { // Twig Open
                const tagName = match[2];
                // 'set' can be self-closing (assignment) or block
                if (tagName === 'set' && lineNoComments.includes('=')) {
                    continue;
                }
                stack.push({ tag: tagName, line: i + 1, type: 'twig' });
            } else if (match[3]) { // Twig Close
                const tagName = match[4];
                if (stack.length === 0) {
                    return `Unexpected closing block {% end${tagName} %} at line ${i + 1}`;
                }
                const last = stack.pop()!;
                if (last.type !== 'twig' || last.tag !== tagName) {
                    return `Mismatched closing block {% end${tagName} %} at line ${i + 1} (expected {% end${last.tag} %} for ${last.tag} from line ${last.line})`;
                }
            } else if (match[5]) { // HTML Tag
                const fullTag = match[5];
                const tagName = match[6].toLowerCase();
                const isClosing = fullTag.startsWith('</');
                const isSelfClosing = fullTag.endsWith('/>');

                if (isSelfClosing || voidTags.includes(tagName)) {
                    continue;
                }

                if (isClosing) {
                    if (stack.length === 0) {
                        return `Unexpected closing tag </${tagName}> at line ${i + 1}`;
                    }
                    const last = stack.pop()!;
                    // If we find a Twig block, it means invalid nesting
                    if (last.type === 'twig') {
                         return `Mismatched closing tag </${tagName}> at line ${i + 1} (expected {% end${last.tag} %} from line ${last.line})`;
                    }
                    if (last.tag !== tagName) {
                        return `Mismatched closing tag </${tagName}> at line ${i + 1} (expected </${last.tag}> from line ${last.line})`;
                    }
                } else {
                    stack.push({ tag: tagName, line: i + 1, type: 'html' });
                }
            }
        }
    }

    if (stack.length > 0) {
        const last = stack.pop()!;
        if (last.type === 'twig') {
            return `Unclosed block {% ${last.tag} %} starting at line ${last.line}`;
        } else {
            return `Unclosed tag <${last.tag}> starting at line ${last.line}`;
        }
    }

    return undefined;
}

/**
 * Handle Liquid formatting and validation
 */
export async function handleLiquid(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Liquid
    validationMessage = validateLiquid(text);

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;

        // Void tags that don't need closing
        const voidTags = [
            'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
            'link', 'meta', 'param', 'source', 'track', 'wbr'
        ];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '') {
                formattedLines.push('');
                continue;
            }

            // Check for dedentation triggers at the start of the line
            let currentIndent = indentLevel;

            // Closing Liquid block: {% endif %}, {% endfor %}, etc.
            if (/^{%\s*end(if|unless|case|for|tablerow|capture|form|paginate|comment|schema|style|javascript|stylesheet)\b/.test(trimmed)) {
                currentIndent = Math.max(0, indentLevel - 1);
            }
            // Middle Liquid block: {% else %}, {% elsif %}, {% when %}
            else if (/^{%\s*(else|elsif|when)\b/.test(trimmed)) {
                currentIndent = Math.max(0, indentLevel - 1);
            }
            // Closing HTML tag: </div>
            else if (/^<\/[a-zA-Z0-9]+/.test(trimmed)) {
                currentIndent = Math.max(0, indentLevel - 1);
            }

            // Apply indentation
            formattedLines.push('  '.repeat(currentIndent) + trimmed);

            // Calculate indentation for the NEXT line
            let netChange = 0;

            // Remove comments for analysis
            const lineNoComments = line.replace(/{% comment %}[\s\S]*?{% endcomment %}/g, '').replace(/<!--[\s\S]*?-->/g, '');

            // Check for Liquid block openers/closers
            const liquidTagRegex = /{%-?\s*([a-zA-Z0-9_]+)([^%]*?)-?%}/g;
            let liquidMatch;
            let liquidOpeners = 0;
            let liquidClosers = 0;

            while ((liquidMatch = liquidTagRegex.exec(lineNoComments)) !== null) {
                const tagName = liquidMatch[1];

                if (/^end/.test(tagName)) {
                    liquidClosers++;
                } else if (/^(if|unless|case|for|tablerow|capture|form|paginate|comment|schema|style|javascript|stylesheet)$/.test(tagName)) {
                    liquidOpeners++;
                }
            }

            // Check for HTML tag openers
            let htmlOpeners = 0;
            let htmlClosers = 0;

            const tagRegex = /<\/?([a-zA-Z0-9]+)[^>]*>/g;
            let match;
            while ((match = tagRegex.exec(lineNoComments)) !== null) {
                const fullTag = match[0];
                const tagName = match[1].toLowerCase();
                const isClosing = fullTag.startsWith('</');
                const isSelfClosing = fullTag.endsWith('/>');

                if (isClosing) {
                    htmlClosers++;
                } else if (!isSelfClosing && !voidTags.includes(tagName)) {
                    htmlOpeners++;
                }
            }

            netChange = (liquidOpeners - liquidClosers) + (htmlOpeners - htmlClosers);
            indentLevel = Math.max(0, indentLevel + netChange);
        }

        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Liquid: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Liquid has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Liquid formatted successfully!');
    }
}

/**
 * Custom resilient Liquid validator
 */
function validateLiquid(text: string): string | undefined {
    const stack: { tag: string, line: number, type: 'liquid' | 'html' }[] = [];
    const lines = text.split('\n');

    const voidTags = [
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
    ];

    // Block tags that need closing
    const blockTags = [
        'if', 'unless', 'case', 'for', 'tablerow', 'capture', 'form',
        'paginate', 'comment', 'schema', 'style', 'javascript', 'stylesheet'
    ];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Remove comments (simple heuristic)
        const lineNoComments = line.replace(/<!--[\s\S]*?-->/g, '');

        // Regex for tags
        // ({%\s*(block_tag)\b)|({%\s*end(block_tag)\b)|(<\/?([a-zA-Z0-9]+)[^>]*>)
        const regex = /({%-?\s*([a-zA-Z0-9_]+)[^%]*?-?%})|(<\/?([a-zA-Z0-9]+)[^>]*>)/g;
        let match;

        while ((match = regex.exec(lineNoComments)) !== null) {
            if (match[1]) { // Liquid Tag
                const tagName = match[2];

                if (tagName.startsWith('end')) {
                    const baseName = tagName.substring(3);
                    if (stack.length === 0) {
                        return `Unexpected closing block {% ${tagName} %} at line ${i + 1}`;
                    }
                    const last = stack.pop()!;
                    if (last.type !== 'liquid' || last.tag !== baseName) {
                        return `Mismatched closing block {% ${tagName} %} at line ${i + 1} (expected {% end${last.tag} %} for ${last.tag} from line ${last.line})`;
                    }
                } else if (blockTags.includes(tagName)) {
                    stack.push({ tag: tagName, line: i + 1, type: 'liquid' });
                }
            } else if (match[3]) { // HTML Tag
                const fullTag = match[3];
                const tagName = match[4].toLowerCase();
                const isClosing = fullTag.startsWith('</');
                const isSelfClosing = fullTag.endsWith('/>');

                if (isSelfClosing || voidTags.includes(tagName)) {
                    continue;
                }

                if (isClosing) {
                    if (stack.length === 0) {
                        return `Unexpected closing tag </${tagName}> at line ${i + 1}`;
                    }
                    const last = stack.pop()!;
                    // If we find a Liquid block, it means invalid nesting
                    if (last.type === 'liquid') {
                         return `Mismatched closing tag </${tagName}> at line ${i + 1} (expected {% end${last.tag} %} from line ${last.line})`;
                    }
                    if (last.tag !== tagName) {
                        return `Mismatched closing tag </${tagName}> at line ${i + 1} (expected </${last.tag}> from line ${last.line})`;
                    }
                } else {
                    stack.push({ tag: tagName, line: i + 1, type: 'html' });
                }
            }
        }
    }

    if (stack.length > 0) {
        const last = stack.pop()!;
        if (last.type === 'liquid') {
            return `Unclosed block {% ${last.tag} %} starting at line ${last.line}`;
        } else {
            return `Unclosed tag <${last.tag}> starting at line ${last.line}`;
        }
    }

    return undefined;
}

/**
 * Handle Jupyter Notebook (.ipynb) formatting and validation
 */
export async function handleIPYNB(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate IPYNB
    validationMessage = validateIPYNB(text);

    // Lazy load dependencies
    const { jsonrepair } = require('jsonrepair');

    try {
        let notebook: any;
        try {
            notebook = JSON.parse(text);
        } catch (e) {
            // Fault-tolerance: try to repair JSON if parsing fails
            const repairedText = jsonrepair(text);
            notebook = JSON.parse(repairedText);
        }

        if (notebook.cells && Array.isArray(notebook.cells)) {
            notebook.cells.forEach((cell: any) => {
                if (cell.cell_type === 'code' && cell.source) {
                    let source: string;
                    let isArray = false;
                    if (Array.isArray(cell.source)) {
                        source = cell.source.join('');
                        isArray = true;
                    } else {
                        source = cell.source;
                    }

                    // We need formatPythonCore here. It's in scripting_compiled.ts
                    // But we can duplicate it or move it to utils.
                    // To avoid circular dependency or import issues, I'll inline a simple version or
                    // move it to utils in the next step.
                    // For now, I'll duplicate the simple logic to be safe and fast.
                    const formattedSource = formatPythonCoreLocal(source);

                    if (isArray) {
                        // Split back into array of strings, matching Jupyter standard
                        const lines = formattedSource.split('\n');
                        cell.source = lines.map((line, i) => i < lines.length - 1 ? line + '\n' : line);
                    } else {
                        cell.source = formattedSource;
                    }
                }
            });
        }

        // Jupyter notebooks standardly use 1-space indentation for JSON
        formatted = JSON.stringify(notebook, null, 1);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Jupyter Notebook: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Jupyter Notebook has potential issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Jupyter Notebook formatted successfully!');
    }
}

/**
 * Custom resilient Jupyter Notebook validator
 */
function validateIPYNB(text: string): string | undefined {
    try {
        const notebook = JSON.parse(text);
        if (!notebook.cells || !Array.isArray(notebook.cells)) {
            return "Missing 'cells' array in notebook structure.";
        }
        if (notebook.nbformat === undefined) {
            return "Missing 'nbformat' in notebook metadata.";
        }
    } catch (e: any) {
        return `Invalid JSON structure: ${e.message}`;
    }
    return undefined;
}

// Local copy of python formatter for IPYNB to avoid cross-module dependency on scripting_compiled
function formatPythonCoreLocal(text: string): string {
    const lines = text.split('\n');
    const formattedLines: string[] = [];
    let indentLevel = 0;
    let forceNextIndent = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '') {
            formattedLines.push('');
            continue;
        }

        const deindentKeywords = ['elif ', 'elif:', 'else:', 'except ', 'except:', 'finally:'];
        const shouldDeindent = deindentKeywords.some(kw => trimmed.startsWith(kw));

        if (shouldDeindent) {
            indentLevel = Math.max(0, indentLevel - 1);
        } else if (!forceNextIndent) {
            const userIndent = line.length - line.trimStart().length;
            const userLevel = Math.floor(userIndent / 4);
            if (userLevel < indentLevel) {
                indentLevel = userLevel;
            }
        }

        formattedLines.push('    '.repeat(indentLevel) + trimmed);

        if (trimmed.endsWith(':')) {
            indentLevel++;
            forceNextIndent = true;
        } else {
            forceNextIndent = false;
        }
    }
    return formattedLines.join('\n');
}
