import * as vscode from 'vscode';
import { applyEdit } from '../utils';
import { formatGraphQLDeep } from './graphql_deep_formatter';
import { formatSQLDeep } from './sql_deep_formatter';
import { formatYAMLDeep } from './yaml_deep_formatter';
import { formatTOMLDeep } from './toml_deep_formatter';
import { formatCSVDeep, validateCSV } from './csv_deep_formatter';
import { formatENVDeep } from './env_deep_formatter';
import { formatPrismaDeep, validatePrisma } from './prisma_deep_formatter';
import { formatINIDeep } from './ini_deep_formatter';
import { formatMongoDBDeep } from './mongodb_deep_formatter';

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
        formatted = formatINIDeep(text);
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

    // Resilient formatting logic
    try {
        formatted = formatENVDeep(text);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format ENV: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    vscode.window.showInformationMessage('ENV formatted successfully!');
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
 * Handle MongoDB Shell formatting and validation
 */
export async function handleMongoDB(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate MongoDB
    validationMessage = validateMongoDB(text);

    // Deep Formatting (Resilient + MongoDB specific)
    try {
        formatted = formatMongoDBDeep(text);
    } catch (deepError: any) {
        console.warn('Deep MongoDB formatter failed, falling back to js-beautify:', deepError);

        // Fallback to js-beautify
        const jsbeautify = require('js-beautify');
        try {
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
    }

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
