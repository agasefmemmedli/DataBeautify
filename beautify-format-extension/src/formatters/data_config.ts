import * as vscode from 'vscode';
import { applyEdit } from '../utils';
import { formatGraphQLDeep } from './graphql_deep_formatter';
import { formatSQLDeep } from './sql_deep_formatter';
import { formatYAMLDeep } from './yaml_deep_formatter';
import { formatTOMLDeep } from './toml_deep_formatter';
import { formatCSVDeep, validateCSV } from './csv_deep_formatter';

/**
 * Handle YAML formatting and validation
 */
export async function handleYAML(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Lazy load dependencies
    let prettier: any;

    try {
        prettier = await import('prettier');
    } catch (e) {
        console.warn('Prettier failed to load:', e);
    }

    // Use Custom Deep Formatter (Resilient + Alignment)
    // We prioritize this over Prettier because it supports vertical alignment
    try {
        formatted = formatYAMLDeep(text);

        await applyEdit(editor, formatted);
        vscode.window.showInformationMessage('YAML formatted successfully!');
        return;
    } catch (deepError: any) {
        // Fallback to Prettier if deep formatter fails (unlikely)
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
            vscode.window.showInformationMessage('YAML formatted successfully (Prettier fallback)!');
            return;
        } catch (e) {
            // Both failed
            vscode.window.showErrorMessage(`Failed to format YAML: ${deepError.message}`);
            return;
        }
    }

    await applyEdit(editor, formatted);

    // Check if there were errors in the original text (formatYAMLDeep handles resilience but we might want to warn)
    // Since formatYAMLDeep consumes errors internally, we don't get validation messages out easily unless we parse again here.
    // For performance, we skip re-parsing. The user will see a formatted result even if input was invalid.

    vscode.window.showInformationMessage('YAML formatted successfully (resilient mode)!');
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
        prettier = await import('prettier');
        tomlPlugin = await import('prettier-plugin-toml');
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
        formatted = formatTOMLDeep(text);
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

    // Deep Formatting logic (Vertical Alignment)
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];

        let sectionBuffer: { type: string, raw: string, key?: string, value?: string, comment?: string }[] = [];

        const processBuffer = () => {
            if (sectionBuffer.length === 0) return;

            // Calculate max key length in this buffer
            let maxKeyLen = 0;
            sectionBuffer.forEach(item => {
                if (item.type === 'property' && item.key) {
                    if (item.key.length > maxKeyLen) maxKeyLen = item.key.length;
                }
            });

            // Output buffer
            sectionBuffer.forEach(item => {
                if (item.type === 'property' && item.key) {
                    const padding = ' '.repeat(maxKeyLen - item.key.length);
                    let line = `${item.key}${padding} = ${item.value}`;
                    if (item.comment) {
                        line += ` ${item.comment}`;
                    }
                    formattedLines.push(line);
                } else {
                    formattedLines.push(item.raw);
                }
            });
            sectionBuffer = [];
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '') {
                // Empty line acts as separator for visual grouping?
                // Or just preserve?
                // If we want alignment across the whole section including empty lines, buffer it.
                // But typically empty line resets alignment context in many formatters?
                // Let's stick to: Alignment is per Section. Empty lines don't break alignment within section.
                sectionBuffer.push({ type: 'empty', raw: '' });
                continue;
            }

            // Section Header
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                processBuffer(); // Flush previous section
                // Ensure blank line before section if not start
                if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                    formattedLines.push('');
                }
                formattedLines.push(trimmed);
                continue;
            }

            // Comment
            if (trimmed.startsWith(';') || trimmed.startsWith('#')) {
                sectionBuffer.push({ type: 'comment', raw: trimmed });
                continue;
            }

            // Property
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
                    sectionBuffer.push({ type: 'property', raw: line, key, value, comment });
                } else {
                    sectionBuffer.push({ type: 'property', raw: line, key, value: valuePart });
                }
            } else {
                // Unknown
                sectionBuffer.push({ type: 'unknown', raw: trimmed });
            }
        }

        processBuffer(); // Flush remaining

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
            const match = trimmed.match(/^(export\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.*)$/);

            if (match) {
                const prefix = match[1] ? 'export ' : '';
                const key = match[2];
                let remainder = match[3].trim();
                let value = '';
                let comment = '';

                // Value parsing logic
                if (remainder.length > 0) {
                    const firstChar = remainder[0];
                    if (firstChar === '"' || firstChar === "'") {
                        // Quoted value
                        const quoteChar = firstChar;
                        let endQuoteIdx = -1;
                        for (let j = 1; j < remainder.length; j++) {
                            if (remainder[j] === quoteChar && remainder[j-1] !== '\\') {
                                endQuoteIdx = j;
                                break;
                            }
                        }

                        if (endQuoteIdx !== -1) {
                            value = remainder.substring(0, endQuoteIdx + 1);
                            const afterValue = remainder.substring(endQuoteIdx + 1).trim();
                            if (afterValue.startsWith('#')) {
                                comment = afterValue;
                            }
                        } else {
                            // Unclosed quote, treat as raw value
                             if (!validationMessage) {
                                validationMessage = `Unclosed quote at line ${i + 1}`;
                            }
                            value = remainder;
                        }
                    } else {
                        // Unquoted value
                        // Find comment start
                        let commentIdx = -1;
                        for (let j = 0; j < remainder.length; j++) {
                            // Basic check for comment start (space followed by #)
                            if (remainder[j] === '#' && (j === 0 || /\s/.test(remainder[j-1]))) {
                                commentIdx = j;
                                break;
                            }
                        }

                        if (commentIdx !== -1) {
                            value = remainder.substring(0, commentIdx).trim();
                            comment = remainder.substring(commentIdx).trim();
                        } else {
                            value = remainder;
                        }

                        // Apply quoting if needed (contains spaces or special chars)
                        // Special chars: # (handled above), =, $, spaces
                        // If value is empty, leave empty.
                        if (value.length > 0 && (/\s/.test(value) || value.includes('='))) {
                             value = `"${value}"`;
                        }
                    }
                }

                formattedLines.push(`${prefix}${key}=${value}${comment ? ' ' + comment : ''}`);
            } else {
                // If it doesn't match the pattern, it's a potential syntax error
                if (!validationMessage && trimmed.length > 0) {
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

    // Validate CSV
    validationMessage = validateCSV(text);

    try {
        // Deep Formatting
        formatted = formatCSVDeep(text);
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
    let prettier: any;

    try {
        prettier = await import('prettier');
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
            parser: 'graphql',
            tabWidth: 2,
            printWidth: 120,
            bracketSpacing: true
        });

        await applyEdit(editor, formatted);
        vscode.window.showInformationMessage('GraphQL formatted successfully!');
        return;

    } catch (prettierError: any) {
        // Fallback to manual formatting if Prettier fails
    }

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
        formatted = formatGraphQLDeep(text);
    } catch (error: any) {
        // Fallback to basic resilience if deep formatter fails
        console.warn('Deep GraphQL formatter failed:', error);
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

    // Deep Formatting
    try {
        formatted = await formatSQLDeep(text);

        await applyEdit(editor, formatted);

        if (validationMessage) {
            vscode.window.showWarningMessage(`SQL has syntax issues but was beautified. ${validationMessage}`);
        } else {
            vscode.window.showInformationMessage('SQL formatted successfully!');
        }
        return;
    } catch (e: any) {
        console.warn('Deep SQL formatting failed:', e);
        // Fallback to resilient formatting logic
    }

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

    // Try Deep Formatting with Prettier first
    try {
        const prettier = await import('prettier');
        const prismaPlugin = await import('prettier-plugin-prisma');

        formatted = await prettier.format(text, {
            parser: 'prisma-parse',
            plugins: [prismaPlugin.default || prismaPlugin],
            tabWidth: 2,
            printWidth: 120,
        });

        await applyEdit(editor, formatted);
        vscode.window.showInformationMessage('Prisma schema formatted successfully!');
        return;

    } catch (e) {
        console.warn('Prettier-Prisma failed, falling back to custom formatter:', e);
    }

    // Resilient formatting logic (Deep Formatting Fallback)
    try {
        formatted = formatPrismaDeep(text);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Prisma: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Prisma schema has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Prisma schema formatted successfully (resilient mode)!');
    }
}

/**
 * Custom Deep Formatter for Prisma
 * Handles indentation and vertical alignment
 */
function formatPrismaDeep(text: string): string {
    const lines = text.split('\n');
    const finalLines: string[] = [];

    let inBlock = false;
    let blockLines: string[] = [];
    let blockStartLine = '';

    // Simple state machine to identify blocks
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line === '') {
            if (inBlock) {
                // Preserve empty lines inside block, but max 1
                if (blockLines.length > 0 && blockLines[blockLines.length - 1] !== '') {
                    blockLines.push('');
                }
            } else {
                if (finalLines.length > 0 && finalLines[finalLines.length - 1] !== '') {
                    finalLines.push('');
                }
            }
            continue;
        }

        // Comment handling
        if (line.startsWith('//') || line.startsWith('///')) {
            if (inBlock) {
                blockLines.push(line);
            } else {
                finalLines.push(line);
            }
            continue;
        }

        // Block Start
        if (line.endsWith('{') && !inBlock) {
            inBlock = true;
            blockStartLine = line;
            continue;
        }

        // Block End
        if (line === '}' && inBlock) {
            inBlock = false;
            // Process block
            finalLines.push(blockStartLine);
            const formattedBlock = formatPrismaBlockContent(blockLines, blockStartLine);
            finalLines.push(...formattedBlock);
            finalLines.push('}');
            blockLines = [];
            continue;
        }

        if (inBlock) {
            blockLines.push(line);
        } else {
            finalLines.push(line);
        }
    }

    // Handle unclosed block (fault tolerance)
    if (inBlock) {
        finalLines.push(blockStartLine);
        finalLines.push(...blockLines.map(l => '  ' + l));
    }

    return finalLines.join('\n');
}

function formatPrismaBlockContent(lines: string[], startLine: string): string[] {
    const isModelOrType = startLine.startsWith('model') || startLine.startsWith('type');
    const isEnum = startLine.startsWith('enum');
    const isConfig = startLine.startsWith('datasource') || startLine.startsWith('generator');

    if (isModelOrType) {
        // Parse fields: name type [attributes...]
        const fields = lines.map(line => {
            if (line === '' || line.startsWith('/')) return { raw: line, isComment: true };

            // Basic tokenizer for fields
            // Split by whitespace
            const tokens = line.split(/\s+/);
            if (tokens.length < 2) return { raw: line, isComment: false, tokens };

            return {
                name: tokens[0],
                type: tokens[1],
                rest: tokens.slice(2).join(' '),
                isComment: false
            };
        });

        // Calculate widths
        let maxName = 0;
        let maxType = 0;

        fields.forEach(f => {
            if (!f.isComment && f.name) {
                maxName = Math.max(maxName, f.name.length);
                maxType = Math.max(maxType, f.type!.length);
            }
        });

        return fields.map(f => {
            if (f.isComment || !f.name) return '  ' + (f.raw || '');
            const namePad = f.name.padEnd(maxName);
            const typePad = f.type!.padEnd(maxType);
            const rest = f.rest ? ' ' + f.rest : '';
            return `  ${namePad} ${typePad}${rest}`;
        });
    }

    if (isConfig) {
        // Key = Value
        const props = lines.map(line => {
            if (line === '' || line.startsWith('/')) return { raw: line, isComment: true };
            const eq = line.indexOf('=');
            if (eq === -1) return { raw: line, isComment: false };

            return {
                key: line.substring(0, eq).trim(),
                val: line.substring(eq + 1).trim(),
                isKV: true,
                isComment: false
            };
        });

        let maxKey = 0;
        props.forEach(p => {
            if (p.isKV) maxKey = Math.max(maxKey, p.key!.length);
        });

        return props.map(p => {
            if (p.isComment || !p.isKV) return '  ' + (p.raw || '');
            const keyPad = p.key!.padEnd(maxKey);
            return `  ${keyPad} = ${p.val}`;
        });
    }

    // Default indentation for enums or others
    return lines.map(l => '  ' + l);
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
    let prettier: any;

    try {
        prettier = await import('prettier');
    } catch (e) {
        console.warn('Prettier failed to load:', e);
    }

    // Validate MongoDB
    validationMessage = validateMongoDB(text);

    // Deep Formatting with Prettier
    let prettierSuccess = false;
    try {
        if (prettier) {
            // Mask Shell Commands
            // MongoDB Shell commands like 'use db', 'show collections', 'it', 'cls' are not valid JS.
            // We comment them out with a special marker to preserve them during JS formatting.
            const maskedText = text.replace(/^(\s*)(use|show|it|cls|exit|quit)(\b.*)?$/gm, '$1// __MONGO_SHELL__ $2$3');

            const format = prettier.format || (prettier.default && prettier.default.format);
            if (format) {
                formatted = await format(maskedText, {
                    parser: 'babel',
                    tabWidth: 2,
                    printWidth: 120,
                    semi: true,
                    singleQuote: false,
                    trailingComma: 'none',
                    bracketSpacing: true
                });

                // Unmask Shell Commands
                formatted = formatted.replace(/^(\s*)\/\/ __MONGO_SHELL__ (.*)$/gm, '$1$2');
                prettierSuccess = true;
            }
        }
    } catch (prettierError) {
        console.warn('Prettier failed for MongoDB, falling back to js-beautify:', prettierError);
    }

    if (!prettierSuccess) {
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
    }

    await applyEdit(editor, formatted!);

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
