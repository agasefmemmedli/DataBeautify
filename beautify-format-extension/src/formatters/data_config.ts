import * as vscode from 'vscode';
import { applyEdit, detectDelimiter, splitCSVLine, loadESM } from '../utils';

/**
 * Handle YAML formatting and validation
 */
export async function handleYAML(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Lazy load dependencies
    const YAML = require('yaml');
    let prettier: any;

    try {
        prettier = await loadESM('prettier');
    } catch (e) {
        console.warn('Prettier failed to load:', e);
    }

    // Try Deep Formatting with Prettier first
    try {
        if (!prettier) {
            throw new Error('Prettier module not available');
        }

        const format = prettier.format || (prettier.default && prettier.default.format);
        if (!format) {
            throw new Error('Prettier format function not found');
        }

        formatted = await format(text, {
            parser: 'yaml',
            tabWidth: 2,
            singleQuote: true,
            printWidth: 120,
            bracketSpacing: true
        });

        await applyEdit(editor, formatted);
        vscode.window.showInformationMessage('YAML formatted successfully!');
        return;

    } catch (prettierError: any) {
        // Fallback to YAML package if Prettier fails
    }

    // Fallback: Resilient formatting using 'yaml' package
    try {
        const doc = YAML.parseDocument(text);
        if (doc.errors.length > 0) {
            const firstError = doc.errors[0];
            validationMessage = firstError.message;
            // Fault-tolerance: Clear errors to allow toString() to proceed
            doc.errors = [];
        }

        // Format YAML
        formatted = doc.toString({
            indent: 2,
            indentSeq: true,
            simpleKeys: true
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format YAML: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`YAML has syntax issues but was beautified. First error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('YAML formatted successfully (resilient mode)!');
    }
}

/**
 * Handle TOML formatting and validation
 */
export async function handleTOML(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Lazy load dependencies
    const smolToml = require('smol-toml');
    let prettier: any;
    let tomlPlugin: any;

    try {
        prettier = await loadESM('prettier');
        tomlPlugin = await loadESM('prettier-plugin-toml');
    } catch (e) {
        console.warn('Prettier or TOML plugin failed to load:', e);
    }

    // Try Deep Formatting with Prettier first
    try {
        if (!prettier || !tomlPlugin) {
            throw new Error('Prettier module not available');
        }

        const format = prettier.format || (prettier.default && prettier.default.format);
        const plugin = tomlPlugin.default || tomlPlugin;

        formatted = await format(text, {
            parser: 'toml',
            plugins: [plugin],
            tabWidth: 2,
            printWidth: 120,
            trailingComma: 'none',
            singleQuote: false,
            bracketSpacing: true
        });

        await applyEdit(editor, formatted);
        vscode.window.showInformationMessage('TOML formatted successfully!');
        return;

    } catch (prettierError: any) {
        // Fallback to manual formatting if Prettier fails
    }

    // Validate TOML using smol-toml
    try {
        smolToml.parse(text);
    } catch (e: any) {
        if (e.line !== undefined) {
            validationMessage = `${e.message} at line ${e.line}, col ${e.column}`;
        } else {
            validationMessage = e.message;
        }
    }

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let inMultilineString = false;
        let multilineStringChar = '';
        let currentIndent = '';

        for (let line of lines) {
            // If we are inside a multiline string, preserve the line exactly
            if (inMultilineString) {
                formattedLines.push(line);
                if (line.includes(multilineStringChar.repeat(3))) {
                    inMultilineString = false;
                }
                continue;
            }

            const trimmed = line.trim();

            // Handle comments and empty lines
            if (trimmed === '' || trimmed.startsWith('#')) {
                const indent = (trimmed === '') ? '' : currentIndent;
                formattedLines.push(indent + trimmed);
                continue;
            }

            // Identify if this line starts a multiline string
            let pendingMultilineToggle = false;
            let pendingMultilineChar = '';
            if (trimmed.includes('"""') || trimmed.includes("'''")) {
                const char = trimmed.includes('"""') ? '"' : "'";
                // Check if the triple quote is not inside a comment
                const commentIdx = trimmed.indexOf('#');
                const tripleIdx = trimmed.indexOf(char.repeat(3));
                if (commentIdx === -1 || tripleIdx < commentIdx) {
                    const matches = trimmed.match(new RegExp(char.repeat(3), 'g'));
                    if (matches && matches.length % 2 !== 0) {
                        pendingMultilineToggle = true;
                        pendingMultilineChar = char;
                    }
                }
            }

            // Handle table headers [table] or [[table]]
            if (trimmed.startsWith('[') && trimmed.endsWith(']') && !trimmed.includes('=')) {
                formattedLines.push(trimmed);
                currentIndent = '  ';
                if (pendingMultilineToggle) {
                    inMultilineString = true;
                    multilineStringChar = pendingMultilineChar;
                }
                continue;
            }

            // Handle key = value
            let eqIndex = -1;
            let inKeyString = false;
            let keyStringChar = '';
            for (let i = 0; i < trimmed.length; i++) {
                const char = trimmed[i];
                if ((char === '"' || char === "'") && (i === 0 || trimmed[i - 1] !== '\\')) {
                    if (!inKeyString) {
                        inKeyString = true;
                        keyStringChar = char;
                    } else if (keyStringChar === char) {
                        inKeyString = false;
                    }
                } else if (char === '=' && !inKeyString) {
                    eqIndex = i;
                    break;
                }
            }

            if (eqIndex > 0) {
                const key = trimmed.substring(0, eqIndex).trim();
                const valuePart = trimmed.substring(eqIndex + 1).trim();

                let commentStart = -1;
                let inValueString = false;
                let valueStringChar = '';

                for (let i = 0; i < valuePart.length; i++) {
                    const char = valuePart[i];
                    if ((char === '"' || char === "'") && (i === 0 || valuePart[i - 1] !== '\\')) {
                        if (!inValueString) {
                            inValueString = true;
                            valueStringChar = char;
                        } else if (valueStringChar === char) {
                            inValueString = false;
                        }
                    } else if (char === '#' && !inValueString) {
                        commentStart = i;
                        break;
                    }
                }

                if (commentStart !== -1) {
                    const value = valuePart.substring(0, commentStart).trim();
                    const comment = valuePart.substring(commentStart);
                    formattedLines.push(`${currentIndent}${key} = ${value} ${comment}`);
                } else {
                    formattedLines.push(`${currentIndent}${key} = ${valuePart}`);
                }
                if (pendingMultilineToggle) {
                    inMultilineString = true;
                    multilineStringChar = pendingMultilineChar;
                }
                continue;
            }

            // Fallback for anything else
            formattedLines.push(currentIndent + trimmed);
            if (pendingMultilineToggle) {
                inMultilineString = true;
                multilineStringChar = pendingMultilineChar;
            }
        }
        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format TOML: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`TOML has syntax issues but was beautified. Error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('TOML formatted successfully!');
    }
}

/**
 * Handle INI formatting and validation
 */
export async function handleINI(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Lazy load dependencies
    const ini = require('ini');

    // Validate INI using 'ini' package
    try {
        ini.parse(text);
    } catch (e: any) {
        validationMessage = e.message;
    }

    // Deep Formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '') {
                // Only add blank line if the previous line is not blank
                if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                    formattedLines.push('');
                }
                continue;
            }

            // Handle comments
            if (trimmed.startsWith(';') || trimmed.startsWith('#')) {
                formattedLines.push(trimmed);
                continue;
            }

            // Handle sections [section]
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                // Ensure blank line before section if not at the start
                if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                    formattedLines.push('');
                }
                formattedLines.push(trimmed);
                continue;
            }

            // Handle key = value
            let splitIdx = -1;
            const eqIdx = trimmed.indexOf('=');
            const colIdx = trimmed.indexOf(':');

            if (eqIdx !== -1 && colIdx !== -1) {
                splitIdx = Math.min(eqIdx, colIdx);
            } else {
                splitIdx = eqIdx !== -1 ? eqIdx : colIdx;
            }

            if (splitIdx > 0) {
                const key = trimmed.substring(0, splitIdx).trim();
                const separator = '='; // Standardize to '='
                const valuePart = trimmed.substring(splitIdx + 1).trim();

                // Check for inline comments
                let commentStart = -1;
                let inString = false;
                let quoteChar = '';

                for (let j = 0; j < valuePart.length; j++) {
                    const char = valuePart[j];
                    if ((char === '"' || char === "'") && (j === 0 || valuePart[j - 1] !== '\\')) {
                        if (!inString) {
                            inString = true;
                            quoteChar = char;
                        } else if (quoteChar === char) {
                            inString = false;
                        }
                    } else if ((char === ';' || char === '#') && !inString) {
                        commentStart = j;
                        break;
                    }
                }

                if (commentStart !== -1) {
                    const value = valuePart.substring(0, commentStart).trim();
                    const comment = valuePart.substring(commentStart).trim();
                    formattedLines.push(`${key} ${separator} ${value} ${comment}`);
                } else {
                    formattedLines.push(`${key} ${separator} ${valuePart}`);
                }
                continue;
            }

            // Fallback
            formattedLines.push(trimmed);
        }

        // Remove trailing empty lines
        while (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] === '') {
            formattedLines.pop();
        }

        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format INI: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`INI has syntax issues but was beautified. Error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('INI formatted successfully!');
    }
}

/**
 * Handle ENV formatting and validation
 */
export async function handleENV(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Handle comments and empty lines
            if (trimmed === '' || trimmed.startsWith('#')) {
                formattedLines.push(trimmed);
                continue;
            }

            // Handle export KEY=VALUE or KEY=VALUE
            // KEY must start with letter or underscore, followed by letters, numbers or underscores
            const exportMatch = trimmed.match(/^(export\s+)?([a-z_][a-z0-9_]*)\s*=\s*(.*)$/i);
            if (exportMatch) {
                const isExport = exportMatch[1] ? 'export ' : '';
                const key = exportMatch[2];
                const value = exportMatch[3];
                formattedLines.push(`${isExport}${key} = ${value}`);
            } else {
                // If it doesn't match the pattern, it's a potential syntax error
                if (!validationMessage) {
                    validationMessage = `Potential issue at line ${i + 1}: "${trimmed}"`;
                }
                formattedLines.push(trimmed);
            }
        }
        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format ENV: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`ENV has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('ENV formatted successfully!');
    }
}

/**
 * Handle CSV formatting and validation
 */
export async function handleCSV(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    try {
        const delimiter = detectDelimiter(text);
        const lines = text.split('\n');
        const rows: string[][] = [];
        let hasUnclosedQuotes = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() === '') {
                rows.push([]);
                continue;
            }

            // Split and check for unclosed quotes
            let inQuotes = false;
            for (let j = 0; j < line.length; j++) {
                if (line[j] === '"') {
                    if (inQuotes && j + 1 < line.length && line[j + 1] === '"') {
                        j++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                }
            }
            if (inQuotes) {
                hasUnclosedQuotes = true;
                if (!validationMessage) {
                    validationMessage = `Unclosed quotes at line ${i + 1}`;
                }
            }

            rows.push(splitCSVLine(line, delimiter));
        }

        // Calculate max widths
        const maxWidths: number[] = [];
        for (const row of rows) {
            for (let i = 0; i < row.length; i++) {
                maxWidths[i] = Math.max(maxWidths[i] || 0, row[i].length);
            }
        }

        // Check for inconsistent column count
        const headerRow = rows.find(r => r.length > 0);
        const headerCount = headerRow ? headerRow.length : 0;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].length > 0 && rows[i].length !== headerCount && !validationMessage) {
                validationMessage = `Inconsistent column count at line ${i + 1} (expected ${headerCount}, got ${rows[i].length})`;
            }
        }

        // Format
        const formattedLines = rows.map(row => {
            if (row.length === 0) {
                return '';
            }
            return row.map((cell, i) => {
                if (i === row.length - 1) {
                    return cell; // Don't pad last column
                }
                return cell.padEnd(maxWidths[i]);
            }).join(` ${delimiter} `);
        });

        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format CSV: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`CSV has issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('CSV formatted successfully!');
    }
}

/**
 * Handle GraphQL formatting and validation
 */
export async function handleGraphQL(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Lazy load dependencies
    const graphql = require('graphql');

    // Validate GraphQL using graphql package
    try {
        graphql.parse(text);
    } catch (e: any) {
        if (e.locations && e.locations.length > 0) {
            validationMessage = `${e.message} at line ${e.locations[0].line}, col ${e.locations[0].column}`;
        } else {
            validationMessage = e.message;
        }
    }

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;
        let inTripleString = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '' && !inTripleString) {
                formattedLines.push('');
                continue;
            }

            // Handle multiline strings (triple quotes)
            if (inTripleString) {
                formattedLines.push(line);
                if (trimmed.includes('"""')) {
                    const matches = (trimmed.match(/"""/g) || []).length;
                    if (matches % 2 !== 0) {
                        inTripleString = false;
                    }
                }
                continue;
            }

            if (trimmed.includes('"""')) {
                const matches = (trimmed.match(/"""/g) || []).length;
                if (matches % 2 !== 0) {
                    inTripleString = true;
                }
            }

            // Count leading closing braces to adjust indentation for CURRENT line
            let leadingClosingCount = 0;
            let j = 0;
            while (j < trimmed.length && (trimmed[j] === '}' || trimmed[j] === ')' || trimmed[j] === ']')) {
                leadingClosingCount++;
                j++;
            }

            indentLevel = Math.max(0, indentLevel - leadingClosingCount);

            formattedLines.push('  '.repeat(indentLevel) + trimmed);

            // Calculate net brace change for NEXT line, excluding leading closing braces
            let netChange = 0;
            let inString = false;
            const remaining = trimmed.substring(leadingClosingCount);

            for (let k = 0; k < remaining.length; k++) {
                const char = remaining[k];
                if (char === '"' && (k === 0 || remaining[k-1] !== '\\')) {
                    inString = !inString;
                    continue;
                }
                if (inString) {
                    continue;
                }
                if (char === '#') {
                    break; // Comment
                }

                if (char === '{' || char === '(' || char === '[') {
                    netChange++;
                }
                if (char === '}' || char === ')' || char === ']') {
                    netChange--;
                }
            }

            indentLevel = Math.max(0, indentLevel + netChange);
        }
        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format GraphQL: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`GraphQL has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('GraphQL formatted successfully!');
    }
}

/**
 * Handle SQL formatting and validation
 */
export async function handleSQL(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate SQL
    validationMessage = validateSQL(text);

    // Resilient formatting logic
    try {
        const keywords = [
            'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'UPDATE', 'DELETE', 'JOIN', 'LEFT', 'RIGHT',
            'INNER', 'OUTER', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'SET', 'VALUES', 'CREATE',
            'TABLE', 'DROP', 'ALTER', 'UNION', 'ALL', 'AND', 'OR', 'IN', 'EXISTS', 'BETWEEN', 'LIKE',
            'IS', 'NULL', 'NOT', 'DISTINCT', 'AS', 'ON', 'USING', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
            'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'DEFAULT', 'UNIQUE', 'CHECK', 'INDEX', 'VIEW',
            'DATABASE', 'SCHEMA', 'TRIGGER', 'PROCEDURE', 'FUNCTION', 'DECLARE', 'BEGIN', 'COMMIT', 'ROLLBACK'
        ];

        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;
        let inString = false;
        let quoteChar = '';
        let inBlockComment = false;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '' && !inString && !inBlockComment) {
                formattedLines.push('');
                continue;
            }

            // Keyword normalization and basic indentation
            // We'll process the line to find keywords and upper-case them
            let processedLine = '';
            let currentWord = '';

            for (let j = 0; j < line.length; j++) {
                const char = line[j];
                const nextChar = line[j + 1];

                if (inBlockComment) {
                    processedLine += char;
                    if (char === '*' && nextChar === '/') {
                        inBlockComment = false;
                        processedLine += '/';
                        j++;
                    }
                    continue;
                }

                if (inString) {
                    processedLine += char;
                    if (char === quoteChar && nextChar === quoteChar) {
                        processedLine += nextChar;
                        j++;
                    } else if (char === '\\') {
                        if (nextChar) {
                            processedLine += nextChar;
                            j++;
                        }
                    } else if (char === quoteChar) {
                        inString = false;
                    }
                    continue;
                }

                if (char === '-' && nextChar === '-') {
                    processedLine += line.substring(j);
                    break;
                }

                if (char === '/' && nextChar === '*') {
                    inBlockComment = true;
                    processedLine += '/*';
                    j++;
                    continue;
                }

                if (char === '"' || char === "'") {
                    inString = true;
                    quoteChar = char;
                    processedLine += char;
                    continue;
                }

                if (/[a-zA-Z_]/.test(char)) {
                    currentWord += char;
                } else {
                    if (currentWord) {
                        if (keywords.includes(currentWord.toUpperCase())) {
                            processedLine += currentWord.toUpperCase();
                        } else {
                            processedLine += currentWord;
                        }
                        currentWord = '';
                    }
                    processedLine += char;
                }
            }
            if (currentWord) {
                if (keywords.includes(currentWord.toUpperCase())) {
                    processedLine += currentWord.toUpperCase();
                } else {
                    processedLine += currentWord;
                }
            }

            const trimmedProcessed = processedLine.trim();

            // Adjust indent for leading closing parenthesis
            let currentLineIndent = indentLevel;
            if (trimmedProcessed.startsWith(')')) {
                // Peek at current state to decide if we should outdent
                // Since we haven't updated indentLevel yet for this line,
                // if it starts with ')', it should be outdented.
                currentLineIndent--;
            }

            // Apply indentation
            formattedLines.push('    '.repeat(Math.max(0, currentLineIndent)) + trimmedProcessed);

            // Calculate indent for next line
            if (!inBlockComment && !inString) {
                const openParens = (trimmedProcessed.match(/\(/g) || []).length;
                const closeParens = (trimmedProcessed.match(/\)/g) || []).length;
                indentLevel += (openParens - closeParens);
            }
        }
        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format SQL: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`SQL has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('SQL formatted successfully!');
    }
}

/**
 * Custom resilient SQL validator
 */
function validateSQL(text: string): string | undefined {
    let parenLevel = 0;
    let inString = false;
    let quoteChar = '';
    let inBlockComment = false;

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];

            if (inBlockComment) {
                if (char === '*' && nextChar === '/') {
                    inBlockComment = false;
                    j++;
                }
                continue;
            }

            if (inString) {
                if (char === quoteChar && nextChar === quoteChar) {
                    j++;
                } else if (char === '\\') {
                    j++;
                } else if (char === quoteChar) {
                    inString = false;
                }
                continue;
            }

            if (char === '-' && nextChar === '-') {
                break; // Line comment
            }

            if (char === '/' && nextChar === '*') {
                inBlockComment = true;
                j++;
                continue;
            }

            if (char === '"' || char === "'") {
                inString = true;
                quoteChar = char;
                continue;
            }

            if (char === '(') {
                parenLevel++;
            } else if (char === ')') {
                parenLevel--;
                if (parenLevel < 0) {
                    return `Extra closing parenthesis at line ${i + 1}, col ${j + 1}`;
                }
            }
        }
    }

    if (parenLevel > 0) {
        return `Missing ${parenLevel} closing parenthesis`;
    }
    if (inString) {
        return `Unclosed string literal`;
    }
    if (inBlockComment) {
        return `Unclosed block comment`;
    }

    return undefined;
}

/**
 * Handle Prisma formatting and validation
 */
export async function handlePrisma(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Prisma
    validationMessage = validatePrisma(text);

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;
        let inBlockComment = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '' && !inBlockComment) {
                formattedLines.push('');
                continue;
            }

            // Handle block comments /* */
            if (inBlockComment) {
                formattedLines.push(line);
                if (trimmed.includes('*/')) {
                    inBlockComment = false;
                }
                continue;
            }

            if (trimmed.startsWith('/*')) {
                inBlockComment = true;
                formattedLines.push('  '.repeat(indentLevel) + trimmed);
                if (trimmed.includes('*/')) {
                    inBlockComment = false;
                }
                continue;
            }

            // Indentation adjustment for closing brace at the START of the line
            let currentLineIndent = indentLevel;
            if (trimmed.startsWith('}')) {
                currentLineIndent--;
            }

            // Apply indentation (Prisma uses 2 spaces)
            formattedLines.push('  '.repeat(Math.max(0, currentLineIndent)) + trimmed);

            // Calculate net brace change for NEXT line
            let netChange = 0;
            let inString = false;

            for (let k = 0; k < trimmed.length; k++) {
                const char = trimmed[k];
                if (char === '"' && (k === 0 || trimmed[k - 1] !== '\\')) {
                    inString = !inString;
                    continue;
                }
                if (inString) { continue; }

                if (char === '/' && trimmed[k + 1] === '/') { break; } // Line comment

                if (char === '{') {
                    netChange++;
                } else if (char === '}') {
                    netChange--;
                }
            }

            indentLevel = Math.max(0, indentLevel + netChange);
        }
        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Prisma: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Prisma schema has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Prisma schema formatted successfully!');
    }
}

/**
 * Custom resilient Prisma validator
 */
function validatePrisma(text: string): string | undefined {
    let braceLevel = 0;
    let inString = false;
    let inBlockComment = false;

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];

            if (inBlockComment) {
                if (char === '*' && nextChar === '/') {
                    inBlockComment = false;
                    j++;
                }
                continue;
            }

            if (inString) {
                if (char === '\\') {
                    j++;
                } else if (char === '"') {
                    inString = false;
                }
                continue;
            }

            if (char === '/' && nextChar === '/') {
                break; // Line comment
            }

            if (char === '/' && nextChar === '*') {
                inBlockComment = true;
                j++;
                continue;
            }

            if (char === '"') {
                inString = true;
                continue;
            }

            if (char === '{') {
                braceLevel++;
            } else if (char === '}') {
                braceLevel--;
                if (braceLevel < 0) {
                    return `Extra closing brace at line ${i + 1}, col ${j + 1}`;
                }
            }
        }
    }

    if (braceLevel > 0) {
        return `Missing ${braceLevel} closing brace(s)`;
    }
    if (inString) {
        return `Unclosed string literal`;
    }
    if (inBlockComment) {
        return `Unclosed block comment`;
    }

    return undefined;
}

/**
 * Handle MongoDB Shell formatting and validation
 */
export async function handleMongoDB(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Lazy load dependencies
    const jsbeautify = require('js-beautify');

    // Validate MongoDB
    validationMessage = validateMongoDB(text);

    /* eslint-disable */
    try {
        // Format MongoDB (using js-beautify's JS formatter)
        formatted = jsbeautify.js(text, {
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
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format MongoDB Shell: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`MongoDB Shell script has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('MongoDB Shell script formatted successfully!');
    }
}

/**
 * Custom resilient MongoDB Shell validator
 */
function validateMongoDB(text: string): string | undefined {
    // Lazy load dependencies
    const acorn = require('acorn');

    // MongoDB Shell supports some specific commands like 'use', 'show', 'it', 'exit', 'quit', 'cls'
    // We'll comment them out for validation to avoid false positives with acorn
    const lines = text.split('\n');
    const processedLines = lines.map(line => {
        const trimmed = line.trim();
        if (/^\s*(use|show|it|exit|quit|cls)\b/i.test(trimmed)) {
            return '// ' + line;
        }
        return line;
    });
    const processedText = processedLines.join('\n');

    try {
        acorn.parse(processedText, { ecmaVersion: 'latest', sourceType: 'module' });
    } catch (e: any) {
        return `${e.message} at line ${e.loc?.line}, col ${e.loc?.column}`;
    }

    return undefined;
}
