import * as vscode from 'vscode';
import xmlFormatter from 'xml-formatter';
import { jsonrepair } from 'jsonrepair';
import { XMLValidator } from 'fast-xml-parser';
import * as jsbeautify from 'js-beautify';
import { HTMLHint } from 'htmlhint';
import * as css from 'css';
import * as sass from 'sass';
import { SassFormatter } from 'sass-formatter';
import less from 'less';
import * as acorn from 'acorn';
import * as ts from 'typescript';
import * as svelte from 'svelte/compiler';
import phpParser from 'php-parser';
import { parse, ParseError } from 'jsonc-parser';
import * as YAML from 'yaml';
import * as smolToml from 'smol-toml';
import * as ini from 'ini';
import * as graphql from 'graphql';
import * as pythonAst from 'python-ast';
import * as javaAst from 'java-ast';

/**
 * This method is called when the extension is activated
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Beautify Format extension is now active!');

    // Register unified beautify command
    let beautifyCommand = vscode.commands.registerCommand('beautify-format.beautify', () => {
        beautify();
    });

    context.subscriptions.push(beautifyCommand);

    // Keep old commands for backward compatibility but map them to the new logic
    let formatJSONCommand = vscode.commands.registerCommand('beautify-format.formatJSON', () => {
        beautify('json');
    });
    let formatXMLCommand = vscode.commands.registerCommand('beautify-format.formatXML', () => {
        beautify('xml');
    });
    let formatCSSCommand = vscode.commands.registerCommand('beautify-format.formatCSS', () => {
        beautify('css');
    });

    let formatSCSSCommand = vscode.commands.registerCommand('beautify-format.formatSCSS', () => {
        beautify('scss');
    });
    let formatSASSCommand = vscode.commands.registerCommand('beautify-format.formatSASS', () => {
        beautify('sass');
    });
    let formatLESSCommand = vscode.commands.registerCommand('beautify-format.formatLESS', () => {
        beautify('less');
    });
    let formatJSCommand = vscode.commands.registerCommand('beautify-format.formatJS', () => {
        beautify('javascript');
    });
    let formatTSCommand = vscode.commands.registerCommand('beautify-format.formatTS', () => {
        beautify('typescript');
    });
    let formatJSXCommand = vscode.commands.registerCommand('beautify-format.formatJSX', () => {
        beautify('jsx');
    });
    let formatTSXCommand = vscode.commands.registerCommand('beautify-format.formatTSX', () => {
        beautify('tsx');
    });
    let formatVueCommand = vscode.commands.registerCommand('beautify-format.formatVue', () => {
        beautify('vue');
    });
    let formatSvelteCommand = vscode.commands.registerCommand('beautify-format.formatSvelte', () => {
        beautify('svelte');
    });
    let formatPHPCommand = vscode.commands.registerCommand('beautify-format.formatPHP', () => {
        beautify('php');
    });
    let formatJSONCCommand = vscode.commands.registerCommand('beautify-format.formatJSONC', () => {
        beautify('jsonc');
    });
    let formatYAMLCommand = vscode.commands.registerCommand('beautify-format.formatYAML', () => {
        beautify('yaml');
    });
    let formatTOMLCommand = vscode.commands.registerCommand('beautify-format.formatTOML', () => {
        beautify('toml');
    });
    let formatINICommand = vscode.commands.registerCommand('beautify-format.formatINI', () => {
        beautify('ini');
    });
    let formatENVCommand = vscode.commands.registerCommand('beautify-format.formatENV', () => {
        beautify('env');
    });
    let formatCSVCommand = vscode.commands.registerCommand('beautify-format.formatCSV', () => {
        beautify('csv');
    });
    let formatGraphQLCommand = vscode.commands.registerCommand('beautify-format.formatGraphQL', () => {
        beautify('graphql');
    });
    let formatPythonCommand = vscode.commands.registerCommand('beautify-format.formatPython', () => {
        beautify('python');
    });
    let formatJavaCommand = vscode.commands.registerCommand('beautify-format.formatJava', () => {
        beautify('java');
    });
    let formatKotlinCommand = vscode.commands.registerCommand('beautify-format.formatKotlin', () => {
        beautify('kotlin');
    });
    let formatCSharpCommand = vscode.commands.registerCommand('beautify-format.formatCSharp', () => {
        beautify('csharp');
    });
    let formatCPPCommand = vscode.commands.registerCommand('beautify-format.formatCPP', () => {
        beautify('cpp');
    });
    let formatGoCommand = vscode.commands.registerCommand('beautify-format.formatGo', () => {
        beautify('go');
    });
    let formatRustCommand = vscode.commands.registerCommand('beautify-format.formatRust', () => {
        beautify('rust');
    });
    let formatRubyCommand = vscode.commands.registerCommand('beautify-format.formatRuby', () => {
        beautify('ruby');
    });
    let formatSwiftCommand = vscode.commands.registerCommand('beautify-format.formatSwift', () => {
        beautify('swift');
    });

    let formatMakefileCommand = vscode.commands.registerCommand('beautify-format.formatMakefile', () => {
        beautify('makefile');
    });

    context.subscriptions.push(formatJSONCommand);
    context.subscriptions.push(formatXMLCommand);
    context.subscriptions.push(formatCSSCommand);
    context.subscriptions.push(formatSCSSCommand);
    context.subscriptions.push(formatSASSCommand);
    context.subscriptions.push(formatLESSCommand);
    context.subscriptions.push(formatJSCommand);
    context.subscriptions.push(formatTSCommand);
    context.subscriptions.push(formatJSXCommand);
    context.subscriptions.push(formatTSXCommand);
    context.subscriptions.push(formatVueCommand);
    context.subscriptions.push(formatSvelteCommand);
    context.subscriptions.push(formatPHPCommand);
    context.subscriptions.push(formatJSONCCommand);
    context.subscriptions.push(formatYAMLCommand);
    context.subscriptions.push(formatTOMLCommand);
    context.subscriptions.push(formatINICommand);
    context.subscriptions.push(formatENVCommand);
    context.subscriptions.push(formatCSVCommand);
    context.subscriptions.push(formatGraphQLCommand);
    context.subscriptions.push(formatPythonCommand);
    context.subscriptions.push(formatJavaCommand);
    context.subscriptions.push(formatKotlinCommand);
    context.subscriptions.push(formatCSharpCommand);
    context.subscriptions.push(formatCPPCommand);
    context.subscriptions.push(formatGoCommand);
    context.subscriptions.push(formatRustCommand);
    context.subscriptions.push(formatRubyCommand);
    context.subscriptions.push(formatSwiftCommand);
    context.subscriptions.push(formatMakefileCommand);

    let formatDartCommand = vscode.commands.registerCommand('beautify-format.formatDart', () => {
        beautify('dart');
    });
    context.subscriptions.push(formatDartCommand);

    let formatDockerfileCommand = vscode.commands.registerCommand('beautify-format.formatDockerfile', () => {
        beautify('dockerfile');
    });
    context.subscriptions.push(formatDockerfileCommand);

    let formatShellCommand = vscode.commands.registerCommand('beautify-format.formatShell', () => {
        beautify('shell');
    });
    context.subscriptions.push(formatShellCommand);

    let formatPowerShellCommand = vscode.commands.registerCommand('beautify-format.formatPowerShell', () => {
        beautify('powershell');
    });
    context.subscriptions.push(formatPowerShellCommand);

    let formatHCLCommand = vscode.commands.registerCommand('beautify-format.formatHCL', () => {
        beautify('hcl');
    });
    context.subscriptions.push(formatHCLCommand);

    let formatNginxCommand = vscode.commands.registerCommand('beautify-format.formatNginx', () => {
        beautify('nginx');
    });
    context.subscriptions.push(formatNginxCommand);

    let formatSQLCommand = vscode.commands.registerCommand('beautify-format.formatSQL', () => {
        beautify('sql');
    });
    context.subscriptions.push(formatSQLCommand);

    let formatPrismaCommand = vscode.commands.registerCommand('beautify-format.formatPrisma', () => {
        beautify('prisma');
    });
    context.subscriptions.push(formatPrismaCommand);

    let formatMongoDBCommand = vscode.commands.registerCommand('beautify-format.formatMongoDB', () => {
        beautify('mongodb');
    });
    context.subscriptions.push(formatMongoDBCommand);
}

/**
 * Handle MongoDB Shell formatting and validation
 */
async function handleMongoDB(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

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

/**
 * Handle Prisma formatting and validation
 */
async function handlePrisma(editor: vscode.TextEditor, text: string) {
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
 * Handle Nginx formatting and validation
 */
async function handleNginx(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Nginx
    validationMessage = validateNginx(text);

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;
        let stateStack: ('STRING' | 'NORMAL')[] = ['NORMAL'];
        let quoteChar = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '' && stateStack[stateStack.length - 1] === 'NORMAL') {
                formattedLines.push('');
                continue;
            }

            // Indentation adjustment for closing characters at the START of the line
            let currentLineIndent = indentLevel;
            if (stateStack[stateStack.length - 1] === 'NORMAL') {
                let j = 0;
                while (j < trimmed.length) {
                    if (trimmed[j] === '}') {
                        currentLineIndent--;
                    } else if (trimmed[j] === ' ' || trimmed[j] === '\t') {
                        // Skip whitespace between closing braces
                    } else {
                        break;
                    }
                    j++;
                }
            }

            // Apply indentation (standard 4 spaces for Nginx)
            formattedLines.push('    '.repeat(Math.max(0, currentLineIndent)) + trimmed);

            // Calculate net brace change for NEXT line
            let netChange = 0;
            for (let k = 0; k < trimmed.length; k++) {
                const char = trimmed[k];
                const currentState = stateStack[stateStack.length - 1];

                if (currentState === 'STRING') {
                    if (char === '\\') {
                        k++;
                    } else if (char === quoteChar) {
                        stateStack.pop();
                    }
                    continue;
                }

                if (char === '#') {
                    break; // Line comment
                }

                if (char === '"' || char === "'") {
                    stateStack.push('STRING');
                    quoteChar = char;
                    continue;
                }

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
        vscode.window.showErrorMessage(`Failed to format Nginx: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Nginx configuration has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Nginx configuration formatted successfully!');
    }
}

/**
 * Handle SQL formatting and validation
 */
async function handleSQL(editor: vscode.TextEditor, text: string) {
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
 * Custom resilient Nginx validator
 */
function validateNginx(text: string): string | undefined {
    let braceLevel = 0;
    let inString = false;
    let quoteChar = '';

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];

            if (inString) {
                if (char === '\\') {
                    j++;
                } else if (char === quoteChar) {
                    inString = false;
                }
                continue;
            }

            if (char === '#') {
                break; // Line comment
            }

            if (char === '"' || char === "'") {
                inString = true;
                quoteChar = char;
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

    return undefined;
}

/**
 * Handle Makefile formatting and validation
 */
async function handleMakefile(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Makefile
    validationMessage = validateMakefile(text);

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let inRecipe = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            if (trimmedLine === '') {
                formattedLines.push('');
                inRecipe = false;
                continue;
            }

            if (trimmedLine.startsWith('#')) {
                // Keep comments as they are but trim trailing whitespace
                formattedLines.push(line.trimEnd());
                continue;
            }

            // In Makefiles, any line starting with a tab is part of a recipe
            if (line.startsWith('\t')) {
                formattedLines.push('\t' + trimmedLine);
                inRecipe = true;
                continue;
            }

            // Not starting with a tab, so it's a top-level construct

            // Check for assignment: KEY op VALUE
            // ops: =, :=, ::=, +=, ?=, !=
            const assignmentMatch = trimmedLine.match(/^([a-zA-Z0-9._-]+)\s*(\?=|:=|::=|\+=|!=|=)\s*(.*)$/);
            if (assignmentMatch) {
                const [, key, op, value] = assignmentMatch;
                formattedLines.push(`${key} ${op} ${value.trim()}`);
                inRecipe = false;
                continue;
            }

            // Check for target definition: target: dependencies
            if (trimmedLine.includes(':')) {
                const colonIdx = trimmedLine.indexOf(':');
                const targetPart = trimmedLine.substring(0, colonIdx).trim();
                const depsPart = trimmedLine.substring(colonIdx + 1).trim();
                formattedLines.push(`${targetPart}: ${depsPart}`);
                inRecipe = true; // Subsequent indented lines are recipes
                continue;
            }

            // Directives (include, ifeq, etc.) or unknown
            // If it was indented but not with a tab, and we were in a recipe, maybe force it?
            // "Readability is King" - if it looks like a recipe line but missing a tab
            if (inRecipe && (line.startsWith(' ') || /^[a-z0-9]/i.test(trimmedLine))) {
                // This is risky if it's actually another target but without a colon (unlikely)
                // or a directive that the user forgot to unindent.
                // Let's stick to being safe: if it doesn't have a colon and we were in a recipe,
                // and it's not a known directive, assume it's a recipe.
                const directives = /^(include|sinclude|-include|ifdef|ifndef|ifeq|ifneq|else|endif|vpath|export|unexport|override|undefine|define|endef)\b/;
                if (!directives.test(trimmedLine)) {
                    formattedLines.push('\t' + trimmedLine);
                    continue;
                }
            }

            // Default fallback
            formattedLines.push(trimmedLine);
            inRecipe = false;
        }
        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Makefile: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Makefile has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Makefile formatted successfully!');
    }
}

/**
 * Custom resilient Makefile validator
 */
function validateMakefile(text: string): string | undefined {
    const lines = text.split('\n');
    let hasTarget = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '' || trimmed.startsWith('#')) continue;

        if (line.startsWith(' ')) {
            // Makefile recipes MUST start with a TAB, not spaces
            return `Line ${i + 1} starts with spaces. Makefile recipes must start with a TAB character.`;
        }

        if (trimmed.includes(':')) {
            if (line.startsWith('\t')) {
                // This might be okay if it's a command that happens to have a colon,
                // but usually targets shouldn't be indented.
            } else {
                hasTarget = true;
            }
        }

        if (line.startsWith('\t') && !hasTarget) {
            return `Recipe at line ${i + 1} defined before any target.`;
        }
    }

    if (!hasTarget && text.trim().length > 0) {
        // A Makefile without targets might be just variables, which is technically okay but often a sign of incompleteness if intended as a script.
        // But let's be lenient.
    }

    return undefined;
}

/**
 * Handle Terraform/HCL formatting and validation
 */
async function handleHCL(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate HCL using custom resilient validator
    validationMessage = validateHCL(text);

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;
        let inMultilineComment = false;
        let inHeredoc = false;
        let heredocDelimiter = '';
        let stateStack: ('STRING' | 'NORMAL')[] = ['NORMAL'];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '' && !inMultilineComment && !inHeredoc && stateStack[stateStack.length - 1] === 'NORMAL') {
                formattedLines.push('');
                continue;
            }

            // Handle Multiline Comments
            if (inMultilineComment) {
                formattedLines.push(line);
                if (trimmed.includes('*/')) {
                    inMultilineComment = false;
                }
                continue;
            }

            // Handle Heredocs
            if (inHeredoc) {
                formattedLines.push(line);
                if (trimmed === heredocDelimiter) {
                    inHeredoc = false;
                }
                continue;
            }

            // Indentation adjustment for closing characters at the START of the line
            let leadingClosingCount = 0;
            if (stateStack[stateStack.length - 1] === 'NORMAL') {
                let j = 0;
                while (j < trimmed.length && (trimmed[j] === '}' || trimmed[j] === ']' || trimmed[j] === ')')) {
                    leadingClosingCount++;
                    j++;
                }
            }

            if (leadingClosingCount > 0) {
                indentLevel = Math.max(0, indentLevel - leadingClosingCount);
            }

            // Apply indentation (HCL uses 2 spaces)
            formattedLines.push('  '.repeat(Math.max(0, indentLevel)) + trimmed);

            // Calculate net brace change for NEXT line
            let netChange = 0;
            for (let k = 0; k < trimmed.length; k++) {
                const char = trimmed[k];
                const nextChar = trimmed[k + 1];
                const currentState = stateStack[stateStack.length - 1];

                if (currentState === 'STRING') {
                    if (char === '\\') {
                        k++;
                    } else if (char === '"') {
                        stateStack.pop();
                    }
                    continue;
                }

                if (char === '#' || (char === '/' && nextChar === '/')) {
                    break; // Line comment
                }

                if (char === '/' && nextChar === '*') {
                    inMultilineComment = true;
                    k++;
                    continue;
                }

                if (char === '<' && nextChar === '<') {
                    // Potential heredoc
                    const remaining = trimmed.substring(k);
                    const heredocMatch = remaining.match(/^<<-?\s*([A-Z0-9_]+)/i);
                    if (heredocMatch) {
                        inHeredoc = true;
                        heredocDelimiter = heredocMatch[1];
                        break;
                    }
                }

                if (char === '"') {
                    stateStack.push('STRING');
                    continue;
                }

                if (char === '{' || char === '[' || char === '(') {
                    netChange++;
                } else if (char === '}' || char === ']' || char === ')') {
                    netChange--;
                }
            }

            indentLevel = Math.max(0, indentLevel + netChange);
        }
        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Terraform/HCL: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Terraform/HCL has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Terraform/HCL formatted successfully!');
    }
}

/**
 * Handle PowerShell formatting and validation
 */
async function handlePowerShell(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate PowerShell using custom resilient validator
    validationMessage = validatePowerShell(text);

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;
        let inHereString = false;
        let hereStringMarker = '';
        let blockCommentLevel = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '' && !inHereString && blockCommentLevel === 0) {
                formattedLines.push('');
                continue;
            }

            // Handle Here-Strings and Block Comments
            if (inHereString) {
                formattedLines.push(line);
                if (trimmed === hereStringMarker) {
                    inHereString = false;
                }
                continue;
            }

            if (blockCommentLevel > 0) {
                formattedLines.push(line);
                // Check for end of block comment
                let pos = 0;
                while ((pos = line.indexOf('#>', pos)) !== -1) {
                    blockCommentLevel--;
                    pos += 2;
                    if (blockCommentLevel === 0) break;
                }
                continue;
            }

            // Check for start of Here-String (must be at the end of the line)
            if (trimmed.endsWith('@"') || trimmed.endsWith("@'")) {
                inHereString = true;
                hereStringMarker = trimmed.endsWith('@"') ? '"@' : "'@";
                formattedLines.push('    '.repeat(indentLevel) + trimmed);
                continue;
            }

            // Check for start of Block Comment
            if (trimmed.startsWith('<#')) {
                blockCommentLevel++;
                formattedLines.push('    '.repeat(indentLevel) + trimmed);
                // Check if it ends on the same line
                let pos = 2;
                while ((pos = line.indexOf('#>', pos)) !== -1) {
                    blockCommentLevel--;
                    pos += 2;
                    if (blockCommentLevel === 0) break;
                }
                continue;
            }

            // Indentation adjustment for closing characters at the START of the line
            let leadingClosingCount = 0;
            let j = 0;
            while (j < trimmed.length && (trimmed[j] === '}' || trimmed[j] === ')' || trimmed[j] === ']')) {
                leadingClosingCount++;
                j++;
            }

            if (leadingClosingCount > 0) {
                indentLevel = Math.max(0, indentLevel - leadingClosingCount);
            }

            // Apply indentation
            formattedLines.push('    '.repeat(Math.max(0, indentLevel)) + trimmed);

            // Calculate net brace change for NEXT line
            let netChange = 0;
            let inString = false;
            let stringChar = '';

            for (let k = leadingClosingCount; k < trimmed.length; k++) {
                const char = trimmed[k];
                const nextChar = trimmed[k+1];

                if (inString) {
                    if (char === '`') { // PowerShell escape character
                        k++;
                    } else if (char === stringChar) {
                        if (nextChar === stringChar) {
                            k++; // Escaped quote "" or ''
                        } else {
                            inString = false;
                        }
                    }
                    continue;
                }

                if (char === '"' || char === "'") {
                    inString = true;
                    stringChar = char;
                    continue;
                }

                if (char === '#') break; // Line comment

                if (char === '<' && nextChar === '#') {
                    blockCommentLevel++;
                    k++;
                    continue;
                }

                if (char === '{' || char === '(' || char === '[') {
                    netChange++;
                } else if (char === '}' || char === ')' || char === ']') {
                    netChange--;
                }
            }

            indentLevel = Math.max(0, indentLevel + netChange);
        }
        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format PowerShell: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`PowerShell has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('PowerShell formatted successfully!');
    }
}

/**
 * Handle Shell Script formatting and validation
 */
async function handleShell(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Shell using custom resilient validator
    validationMessage = validateShell(text);

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;
        let inHeredoc = false;
        let heredocDelimiter = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '' && !inHeredoc) {
                formattedLines.push('');
                continue;
            }

            // Handle Heredoc
            if (inHeredoc) {
                formattedLines.push(line);
                if (trimmed === heredocDelimiter) {
                    inHeredoc = false;
                }
                continue;
            }

            const heredocMatch = line.match(/<<-?\s*["']?([A-Z0-9_]+)["']?/i);
            if (heredocMatch) {
                inHeredoc = true;
                heredocDelimiter = heredocMatch[1];
            }

            // Indentation adjustment
            const closers = /^(fi|done|esac|\}|\]|\]\])\b|^(\)\s*$)/;
            const intermediates = /^(then|do|else|elif|;;)\b/;

            let currentIndent = indentLevel;
            if (closers.test(trimmed) || intermediates.test(trimmed)) {
                currentIndent = Math.max(0, indentLevel - 1);
            }

            // Apply indentation
            formattedLines.push('  '.repeat(currentIndent) + trimmed);

            // Calculate indent for NEXT line
            const openers = /^(if|for|while|until|case)\b|(\{|\(|\[|\[\[)$/;
            const isOpener = openers.test(trimmed);
            const isCloser = closers.test(trimmed);

            // Special check for 'then' or 'do' at end of line
            const endsWithOpener = /[; \t](then|do)$/.test(trimmed);

            if (isOpener || endsWithOpener || intermediates.test(trimmed)) {
                indentLevel = currentIndent + 1;
            } else if (isCloser) {
                indentLevel = Math.max(0, currentIndent);
            } else if (trimmed.endsWith(')')) {
                // Potential case pattern
                indentLevel = currentIndent + 1;
            }
        }
        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Shell: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Shell Script has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Shell Script formatted successfully!');
    }
}

/**
 * Custom resilient PowerShell validator
 */
function validatePowerShell(text: string): string | undefined {
    const stack: { char: string, line: number, col: number }[] = [];
    let stateStack: ('STRING' | 'LITERAL_STRING' | 'HERE_STRING' | 'LITERAL_HERE_STRING' | 'NORMAL')[] = ['NORMAL'];
    let blockCommentLevel = 0;

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const currentState = stateStack[stateStack.length - 1];

        if (currentState === 'HERE_STRING') {
            if (trimmed === '"@') stateStack.pop();
            continue;
        }
        if (currentState === 'LITERAL_HERE_STRING') {
            if (trimmed === "'@") stateStack.pop();
            continue;
        }

        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];
            const currentStateInner = stateStack[stateStack.length - 1];

            if (blockCommentLevel > 0) {
                if (char === '#' && nextChar === '>') {
                    blockCommentLevel--;
                    j++;
                } else if (char === '<' && nextChar === '#') {
                    blockCommentLevel++;
                    j++;
                }
                continue;
            }

            if (currentStateInner === 'STRING') {
                if (char === '`') { // PowerShell escape
                    j++;
                } else if (char === '"') {
                    stateStack.pop();
                }
                continue;
            }

            if (currentStateInner === 'LITERAL_STRING') {
                if (char === "'") {
                    stateStack.pop();
                }
                continue;
            }

            // NORMAL state
            if (char === '#' && (j === 0 || /\s/.test(line[j - 1]))) {
                // Line comment
                break;
            }

            if (char === '<' && nextChar === '#') {
                blockCommentLevel++;
                j++;
                continue;
            }

            // Check for Here-Strings (must be at the end of the line)
            if (j === line.length - 2) {
                if (line.endsWith('@"')) {
                    stateStack.push('HERE_STRING');
                    j = line.length;
                    continue;
                }
                if (line.endsWith("@'")) {
                    stateStack.push('LITERAL_HERE_STRING');
                    j = line.length;
                    continue;
                }
            }

            if (char === '"') {
                if (nextChar === '"') {
                    j++; // Escaped quote ""
                } else {
                    stateStack.push('STRING');
                }
                continue;
            }
            if (char === "'") {
                if (nextChar === "'") {
                    j++; // Escaped quote ''
                } else {
                    stateStack.push('LITERAL_STRING');
                }
                continue;
            }

            if (char === '{' || char === '(' || char === '[') {
                stack.push({ char, line: i + 1, col: j + 1 });
            } else if (char === '}' || char === ')' || char === ']') {
                if (stack.length === 0) {
                    return `Unexpected closing character '${char}' at line ${i + 1}, col ${j + 1}`;
                }
                const last = stack.pop()!;
                if ((char === '}' && last.char !== '{') ||
                    (char === ')' && last.char !== '(') ||
                    (char === ']' && last.char !== '[')) {
                    return `Mismatched closing character '${char}' at line ${i + 1}, col ${j + 1} (expected closure for '${last.char}' from line ${last.line}, col ${last.col})`;
                }
            }
        }
    }

    if (blockCommentLevel > 0) return "Unclosed block comment";
    const lastState = stateStack.pop();
    if (lastState === 'HERE_STRING' || lastState === 'LITERAL_HERE_STRING') return "Unclosed here-string";
    if (lastState === 'STRING' || lastState === 'LITERAL_STRING') return "Unclosed string literal";

    if (stack.length > 0) {
        const last = stack.pop()!;
        return `Unclosed '${last.char}' from line ${last.line}, col ${last.col}`;
    }

    return undefined;
}

/**
 * Custom resilient HCL validator
 */
function validateHCL(text: string): string | undefined {
    const stack: { char: string, line: number, col: number }[] = [];
    let stateStack: ('STRING' | 'NORMAL')[] = ['NORMAL'];
    let inMultilineComment = false;
    let inHeredoc = false;
    let heredocDelimiter = '';
    const interpStack: number[] = [];

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (inHeredoc) {
            if (trimmed === heredocDelimiter) {
                inHeredoc = false;
            }
            continue;
        }

        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];
            const currentState = stateStack[stateStack.length - 1];

            if (inMultilineComment) {
                if (char === '*' && nextChar === '/') {
                    inMultilineComment = false;
                    j++;
                }
                continue;
            }

            if (currentState === 'STRING') {
                if (char === '\\') {
                    j++;
                } else if (char === '$' && nextChar === '{') {
                    stateStack.push('NORMAL');
                    interpStack.push(stack.length);
                    stack.push({ char: '{', line: i + 1, col: j + 2 });
                    j++;
                } else if (char === '"') {
                    stateStack.pop();
                }
                continue;
            }

            if (char === '#' || (char === '/' && nextChar === '/')) {
                break; // Line comment
            }

            if (char === '/' && nextChar === '*') {
                inMultilineComment = true;
                j++;
                continue;
            }

            if (char === '<' && nextChar === '<') {
                const remaining = line.substring(j);
                const heredocMatch = remaining.match(/^<<-?\s*([A-Z0-9_]+)/i);
                if (heredocMatch) {
                    inHeredoc = true;
                    heredocDelimiter = heredocMatch[1];
                    j = line.length;
                    continue;
                }
            }

            if (char === '"') {
                stateStack.push('STRING');
                continue;
            }

            if (char === '{' || char === '[' || char === '(') {
                stack.push({ char, line: i + 1, col: j + 1 });
            } else if (char === '}' || char === ']' || char === ')') {
                if (stack.length === 0) {
                    return `Unexpected closing character '${char}' at line ${i + 1}, col ${j + 1}`;
                }
                const last = stack.pop()!;
                if ((char === '}' && last.char !== '{') ||
                    (char === ']' && last.char !== '[') ||
                    (char === ')' && last.char !== '(')) {
                    return `Mismatched closing character '${char}' at line ${i + 1}, col ${j + 1} (expected closure for '${last.char}' from line ${last.line}, col ${last.col})`;
                }
                if (char === '}' && interpStack.length > 0 && stack.length === interpStack[interpStack.length - 1]) {
                    interpStack.pop();
                    stateStack.pop();
                }
            }
        }
    }

    if (inMultilineComment) return "Unclosed multiline comment";
    if (inHeredoc) return "Unclosed heredoc";
    if (stateStack.pop() === 'STRING') return "Unclosed string literal";
    if (stack.length > 0) {
        const last = stack.pop()!;
        return `Unclosed '${last.char}' from line ${last.line}, col ${last.col}`;
    }

    return undefined;
}

/**
 * Custom resilient Shell validator
 */
function validateShell(text: string): string | undefined {
    const stack: { word: string, line: number }[] = [];
    const lines = text.split('\n');
    let inString = false;
    let stringChar = '';
    let inHeredoc = false;
    let heredocDelimiter = '';

    const openers = ['if', 'for', 'while', 'until', 'case'];
    const closers: { [key: string]: string } = {
        'if': 'fi',
        'for': 'done',
        'while': 'done',
        'until': 'done',
        'case': 'esac'
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let trimmed = line.trim();

        if (inHeredoc) {
            if (trimmed === heredocDelimiter) {
                inHeredoc = false;
            }
            continue;
        }

        const heredocMatch = line.match(/<<-?\s*["']?([A-Z0-9_]+)["']?/i);
        if (heredocMatch) {
            inHeredoc = true;
            heredocDelimiter = heredocMatch[1];
        }

        // Simple string tracking
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if ((char === '"' || char === "'") && (j === 0 || line[j - 1] !== '\\')) {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar) {
                    inString = false;
                }
            }
        }

        if (inString) continue;

        // Remove comments
        const commentIdx = trimmed.indexOf('#');
        if (commentIdx !== -1) {
            trimmed = trimmed.substring(0, commentIdx).trim();
        }

        if (trimmed === '') continue;

        const tokens = trimmed.split(/\s+|;/);
        for (const token of tokens) {
            if (openers.includes(token)) {
                stack.push({ word: token, line: i + 1 });
            } else if (Object.values(closers).includes(token)) {
                if (stack.length === 0) {
                    return `Unexpected '${token}' at line ${i + 1}`;
                }
                const last = stack.pop()!;
                if (closers[last.word] !== token) {
                    return `Mismatched '${token}' at line ${i + 1} (expected closure for '${last.word}' from line ${last.line})`;
                }
            } else if (token === '{' || token === '(') {
                stack.push({ word: token, line: i + 1 });
            } else if (token === '}' || token === ')') {
                if (stack.length === 0) {
                    // Ignore lone ')' as it might be a case pattern
                    if (token === '}') return `Unexpected '}' at line ${i + 1}`;
                    continue;
                }
                const last = stack.pop()!;
                if ((token === '}' && last.word !== '{') || (token === ')' && last.word !== '(')) {
                    // Again, if it's ')' it might be a case pattern, so be careful
                    if (token === '}') return `Mismatched '}' at line ${i + 1}`;
                    // If it was '(', then it's a mismatch. But if last was something else, maybe ignore?
                    // Let's keep it simple.
                }
            }
        }
    }

    if (inString) return "Unclosed string literal";
    if (inHeredoc) return "Unclosed heredoc";
    if (stack.length > 0) {
        const last = stack.pop()!;
        return `Unclosed '${last.word}' from line ${last.line}`;
    }

    return undefined;
}

/**
 * Handle Dart formatting and validation
 */
async function handleDart(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Dart using custom resilient validator
    validationMessage = validateDart(text);

    /* eslint-disable */
    try {
        // Format Dart (using js-beautify's JS formatter which handles Dart well)
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
        vscode.window.showErrorMessage(`Failed to format Dart: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Dart has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Dart formatted successfully!');
    }
}

/**
 * Handle Swift formatting and validation
 */
async function handleSwift(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Swift using custom resilient validator
    validationMessage = validateSwift(text);

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;
        let stateStack: ('STRING' | 'MULTILINE_STRING' | 'NORMAL')[] = ['NORMAL'];
        let blockCommentLevel = 0;
        // Tracking interpolation braces to return to STRING state
        const interpBraceStack: number[] = [];
        let currentTotalBraceDepth = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '' && stateStack[stateStack.length - 1] === 'NORMAL' && blockCommentLevel === 0) {
                formattedLines.push('');
                continue;
            }

            // Indentation adjustment for closing braces at the START of the line
            let leadingClosingCount = 0;
            if (blockCommentLevel === 0 && stateStack[stateStack.length - 1] === 'NORMAL') {
                let j = 0;
                while (j < trimmed.length && (trimmed[j] === '}' || trimmed[j] === ')' || trimmed[j] === ']')) {
                    leadingClosingCount++;
                    j++;
                }
            }

            if (leadingClosingCount > 0) {
                indentLevel = Math.max(0, indentLevel - leadingClosingCount);
            }

            // Apply indentation (Swift uses 4 spaces)
            let currentLine = (blockCommentLevel > 0 || stateStack[stateStack.length - 1] !== 'NORMAL')
                ? line
                : '    '.repeat(Math.max(0, indentLevel)) + trimmed;

            formattedLines.push(currentLine);

            // Calculate net brace change for NEXT line and track state
            let netChange = 0;
            const textToProcess = (blockCommentLevel > 0 || stateStack[stateStack.length - 1] !== 'NORMAL')
                ? line
                : trimmed.substring(leadingClosingCount);

            for (let k = 0; k < textToProcess.length; k++) {
                const char = textToProcess[k];
                const nextChar = textToProcess[k + 1];
                const nextNextChar = textToProcess[k + 2];
                const currentState = stateStack[stateStack.length - 1];

                if (blockCommentLevel > 0) {
                    if (char === '*' && nextChar === '/') {
                        blockCommentLevel--;
                        k++;
                    } else if (char === '/' && nextChar === '*') {
                        blockCommentLevel++;
                        k++;
                    }
                    continue;
                }

                if (currentState === 'MULTILINE_STRING') {
                    if (char === '"' && nextChar === '"' && nextNextChar === '"') {
                        stateStack.pop();
                        k += 2;
                    }
                    continue;
                }

                if (currentState === 'STRING') {
                    if (char === '\\') {
                        if (nextChar === '(') {
                            stateStack.push('NORMAL');
                            interpBraceStack.push(currentTotalBraceDepth - leadingClosingCount + netChange);
                            netChange++;
                            k++;
                        } else {
                            k++; // Escape sequence
                        }
                    } else if (char === '"') {
                        stateStack.pop();
                    }
                    continue;
                }

                // NORMAL state
                if (char === '/' && nextChar === '/') {
                    // Line comment
                    break;
                }
                if (char === '/' && nextChar === '*') {
                    blockCommentLevel++;
                    k++;
                    continue;
                }
                if (char === '"' && nextChar === '"' && nextNextChar === '"') {
                    stateStack.push('MULTILINE_STRING');
                    k += 2;
                    continue;
                }
                if (char === '"') {
                    stateStack.push('STRING');
                    continue;
                }

                if (char === '{' || char === '(' || char === '[') {
                    netChange++;
                } else if (char === '}' || char === ')' || char === ']') {
                    if (char === ')' && interpBraceStack.length > 0 && (currentTotalBraceDepth - leadingClosingCount + netChange - 1) === interpBraceStack[interpBraceStack.length - 1]) {
                        interpBraceStack.pop();
                        stateStack.pop();
                    }
                    netChange--;
                }
            }

            currentTotalBraceDepth += (netChange - leadingClosingCount);
            indentLevel = Math.max(0, indentLevel + netChange);
        }
        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Swift: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Swift has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Swift formatted successfully!');
    }
}

/**
 * Handle Ruby formatting and validation
 */
async function handleRuby(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Ruby using custom resilient validator
    validationMessage = validateRuby(text);

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;

        // Keywords that start a block
        const blockOpeners = /^(class|module|def|begin|case|if|unless|while|until|for)\b/;
        // Keywords that end a block
        const blockClosers = /^end\b/;
        // Keywords that are middle of a block
        const blockIntermediates = /^(elsif|else|when|rescue|ensure)\b/;
        // 'do' at the end of a line (common for blocks)
        const doAtEnd = /\bdo\b(\s*\|.*\|)?\s*$/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '') {
                formattedLines.push('');
                continue;
            }

            // Adjust indent for the current line if it's a closer or intermediate
            let currentIndent = indentLevel;
            if (blockClosers.test(trimmed) || blockIntermediates.test(trimmed)) {
                currentIndent = Math.max(0, indentLevel - 1);
            }

            // Apply indentation (Ruby uses 2 spaces)
            formattedLines.push('  '.repeat(currentIndent) + trimmed);

            // Calculate indentation for the NEXT line
            let nextIndent = indentLevel;

            // If line starts with an opener or ends with 'do', increment indent
            // We check if it starts with an opener to avoid modifier if/unless
            if (blockOpeners.test(trimmed) || doAtEnd.test(trimmed) || blockIntermediates.test(trimmed)) {
                nextIndent = currentIndent + 1;
            } else if (blockClosers.test(trimmed)) {
                nextIndent = Math.max(0, indentLevel - 1);
            }

            indentLevel = nextIndent;
        }
        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Ruby: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Ruby has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Ruby formatted successfully!');
    }
}

/**
 * Custom resilient Ruby validator
 */
function validateRuby(text: string): string | undefined {
    const stack: { word: string, line: number }[] = [];
    const lines = text.split('\n');

    const openers = ['class', 'module', 'def', 'begin', 'case', 'if', 'unless', 'while', 'until', 'for'];
    const intermediates = ['elsif', 'else', 'when', 'rescue', 'ensure'];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let trimmed = line.trim();

        // Remove comments
        const commentIdx = trimmed.indexOf('#');
        if (commentIdx !== -1) {
            trimmed = trimmed.substring(0, commentIdx).trim();
        }

        if (trimmed === '') {
            continue;
        }

        // Split by semicolon for multiple statements on one line
        const statements = trimmed.split(';');
        for (const stmt of statements) {
            const tokens = stmt.trim().split(/\s+/);
            if (tokens.length === 0 || tokens[0] === '') {
                continue;
            }

            // Check if the statement starts with an opener
            const firstToken = tokens[0].replace(/[^a-z]/g, ''); // Simple cleanup

            if (openers.includes(firstToken)) {
                stack.push({ word: firstToken, line: i + 1 });
            } else if (firstToken === 'end') {
                if (stack.length === 0) {
                    return `Unexpected 'end' at line ${i + 1}`;
                }
                stack.pop();
            } else if (intermediates.includes(firstToken)) {
                if (stack.length === 0) {
                    return `Unexpected intermediate keyword '${firstToken}' at line ${i + 1}`;
                }
            }

            // Check for 'do' at end of statement
            if (stmt.trim().endsWith('do') || /\bdo\s*\|.*\|\s*$/.test(stmt.trim())) {
                stack.push({ word: 'do', line: i + 1 });
            }
        }
    }

    if (stack.length > 0) {
        const last = stack.pop()!;
        return `Unclosed '${last.word}' from line ${last.line}`;
    }

    return undefined;
}

/**
 * Validate Dart code for basic structural errors
 */
function validateDart(text: string): string | undefined {
    const braceStack: { char: string, line: number, col: number, isInterpolation?: boolean }[] = [];
    let stateStack: ('STRING' | 'MULTILINE_STRING' | 'NORMAL')[] = ['NORMAL'];
    let stringChar = ''; // ' or "
    let isRaw = false;
    let blockCommentLevel = 0;

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];
            const nextNextChar = line[j + 2];
            const currentState = stateStack[stateStack.length - 1];

            if (blockCommentLevel > 0) {
                if (char === '*' && nextChar === '/') {
                    blockCommentLevel--;
                    j++;
                } else if (char === '/' && nextChar === '*') {
                    blockCommentLevel++;
                    j++;
                }
                continue;
            }

            if (currentState === 'MULTILINE_STRING') {
                if (char === stringChar && nextChar === stringChar && nextNextChar === stringChar) {
                    stateStack.pop();
                    j += 2;
                    isRaw = false;
                }
                continue;
            }

            if (currentState === 'STRING') {
                if (char === '\\' && !isRaw) {
                    j++; // Escape sequence
                } else if (char === '$' && !isRaw) {
                    if (nextChar === '{') {
                        braceStack.push({ char: '{', line: i, col: j + 1, isInterpolation: true });
                        stateStack.push('NORMAL');
                        j++;
                    }
                } else if (char === stringChar) {
                    stateStack.pop();
                    isRaw = false;
                }
                continue;
            }

            // NORMAL state
            if (char === '/' && nextChar === '/') {
                // Line comment
                break;
            }
            if (char === '/' && nextChar === '*') {
                blockCommentLevel++;
                j++;
                continue;
            }

            // Strings
            let currentIsRaw = false;
            let checkIdx = j;
            if (char === 'r' && (nextChar === "'" || nextChar === '"')) {
                currentIsRaw = true;
                checkIdx = j + 1;
            }

            const checkChar = line[checkIdx];
            const checkNextChar = line[checkIdx + 1];
            const checkNextNextChar = line[checkIdx + 2];

            if (checkChar === "'" || checkChar === '"') {
                stringChar = checkChar;
                isRaw = currentIsRaw;
                if (checkNextChar === stringChar && checkNextNextChar === stringChar) {
                    stateStack.push('MULTILINE_STRING');
                    j = checkIdx + 2;
                } else {
                    stateStack.push('STRING');
                    j = checkIdx;
                }
                continue;
            }

            if (char === '{' || char === '(' || char === '[') {
                braceStack.push({ char, line: i, col: j });
            } else if (char === '}' || char === ')' || char === ']') {
                if (braceStack.length === 0) {
                    return `Unexpected closing character '${char}' at line ${i + 1}, col ${j + 1}`;
                }
                const last = braceStack.pop()!;
                if ((char === '}' && last.char !== '{') ||
                    (char === ')' && last.char !== '(') ||
                    (char === ']' && last.char !== '[')) {
                    return `Mismatched closing character '${char}' at line ${i + 1}, col ${j + 1} (expected closure for '${last.char}' from line ${last.line + 1}, col ${last.col + 1})`;
                }
                if (char === '}' && last.isInterpolation) {
                    stateStack.pop(); // Return from NORMAL (inside interpolation) to STRING
                }
            }
        }
    }

    if (blockCommentLevel > 0) {
        return "Unclosed block comment";
    }
    const lastState = stateStack.pop();
    if (lastState === 'MULTILINE_STRING') {
        return "Unclosed multiline string";
    }
    if (lastState === 'STRING') {
        return "Unclosed string literal";
    }

    if (braceStack.length > 0) {
        const last = braceStack.pop()!;
        return `Unclosed '${last.char}' from line ${last.line + 1}, col ${last.col + 1}`;
    }

    return undefined;
}

/**
 * Validate Kotlin code for basic structural errors
 */
function validateKotlin(text: string): string | undefined {
    const braceStack: { char: string, line: number, col: number }[] = [];
    let stateStack: ('STRING' | 'MULTILINE_STRING' | 'NORMAL')[] = ['NORMAL'];
    let blockCommentLevel = 0;

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];
            const nextNextChar = line[j + 2];
            const currentState = stateStack[stateStack.length - 1];

            if (blockCommentLevel > 0) {
                if (char === '*' && nextChar === '/') {
                    blockCommentLevel--;
                    j++;
                } else if (char === '/' && nextChar === '*') {
                    blockCommentLevel++;
                    j++;
                }
                continue;
            }

            if (currentState === 'MULTILINE_STRING') {
                if (char === '"' && nextChar === '"' && nextNextChar === '"') {
                    stateStack.pop();
                    j += 2;
                }
                continue;
            }

            if (currentState === 'STRING') {
                if (char === '\\') {
                    j++; // Escape sequence
                } else if (char === '"') {
                    stateStack.pop();
                }
                continue;
            }

            // NORMAL state
            if (char === '/' && nextChar === '/') {
                // Line comment
                break;
            }
            if (char === '/' && nextChar === '*') {
                blockCommentLevel++;
                j++;
                continue;
            }
            if (char === '"' && nextChar === '"' && nextNextChar === '"') {
                stateStack.push('MULTILINE_STRING');
                j += 2;
                continue;
            }
            if (char === '"') {
                stateStack.push('STRING');
                continue;
            }

            if (char === '{' || char === '(' || char === '[') {
                braceStack.push({ char, line: i, col: j });
            } else if (char === '}' || char === ')' || char === ']') {
                if (braceStack.length === 0) {
                    return `Unexpected closing character '${char}' at line ${i + 1}, col ${j + 1}`;
                }
                const last = braceStack.pop()!;
                if ((char === '}' && last.char !== '{') ||
                    (char === ')' && last.char !== '(') ||
                    (char === ']' && last.char !== '[')) {
                    return `Mismatched closing character '${char}' at line ${i + 1}, col ${j + 1} (expected closure for '${last.char}' from line ${last.line + 1}, col ${last.col + 1})`;
                }
            }
        }
    }

    if (blockCommentLevel > 0) {
        return "Unclosed block comment";
    }
    const lastState = stateStack.pop();
    if (lastState === 'MULTILINE_STRING') {
        return "Unclosed multiline string";
    }
    if (lastState === 'STRING') {
        return "Unclosed string literal";
    }

    if (braceStack.length > 0) {
        const last = braceStack.pop()!;
        return `Unclosed '${last.char}' from line ${last.line + 1}, col ${last.col + 1}`;
    }

    return undefined;
}

/**
 * Validate Swift code for basic structural errors
 */
function validateSwift(text: string): string | undefined {
    const braceStack: { char: string, line: number, col: number, isInterpolation?: boolean }[] = [];
    let stateStack: ('STRING' | 'MULTILINE_STRING' | 'NORMAL')[] = ['NORMAL'];
    let blockCommentLevel = 0;

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];
            const nextNextChar = line[j + 2];
            const currentState = stateStack[stateStack.length - 1];

            if (blockCommentLevel > 0) {
                if (char === '*' && nextChar === '/') {
                    blockCommentLevel--;
                    j++;
                } else if (char === '/' && nextChar === '*') {
                    blockCommentLevel++;
                    j++;
                }
                continue;
            }

            if (currentState === 'MULTILINE_STRING') {
                if (char === '"' && nextChar === '"' && nextNextChar === '"') {
                    stateStack.pop();
                    j += 2;
                }
                continue;
            }

            if (currentState === 'STRING') {
                if (char === '\\') {
                    if (nextChar === '(') {
                        braceStack.push({ char: '(', line: i, col: j + 1, isInterpolation: true });
                        stateStack.push('NORMAL');
                        j++;
                    } else {
                        j++; // Escape sequence
                    }
                } else if (char === '"') {
                    stateStack.pop();
                }
                continue;
            }

            // NORMAL state
            if (char === '/' && nextChar === '/') {
                // Line comment
                break;
            }
            if (char === '/' && nextChar === '*') {
                blockCommentLevel++;
                j++;
                continue;
            }
            if (char === '"' && nextChar === '"' && nextNextChar === '"') {
                stateStack.push('MULTILINE_STRING');
                j += 2;
                continue;
            }
            if (char === '"') {
                stateStack.push('STRING');
                continue;
            }

            if (char === '{' || char === '(' || char === '[') {
                braceStack.push({ char, line: i, col: j });
            } else if (char === '}' || char === ')' || char === ']') {
                if (braceStack.length === 0) {
                    return `Unexpected closing character '${char}' at line ${i + 1}, col ${j + 1}`;
                }
                const last = braceStack.pop()!;
                if ((char === '}' && last.char !== '{') ||
                    (char === ')' && last.char !== '(') ||
                    (char === ']' && last.char !== '[')) {
                    return `Mismatched closing character '${char}' at line ${i + 1}, col ${j + 1} (expected closure for '${last.char}' from line ${last.line + 1}, col ${last.col + 1})`;
                }
                if (char === ')' && last.isInterpolation) {
                    stateStack.pop(); // Return from NORMAL (inside interpolation) to STRING
                }
            }
        }
    }

    if (blockCommentLevel > 0) {
        return "Unclosed block comment";
    }
    const lastState = stateStack.pop();
    if (lastState === 'MULTILINE_STRING') {
        return "Unclosed multiline string";
    }
    if (lastState === 'STRING') {
        return "Unclosed string literal";
    }

    if (braceStack.length > 0) {
        const last = braceStack.pop()!;
        return `Unclosed '${last.char}' from line ${last.line + 1}, col ${last.col + 1}`;
    }

    return undefined;
}

/**
 * Handle Rust formatting and validation
 */
async function handleRust(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Rust using custom resilient validator
    validationMessage = validateRust(text);

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;
        let inRawString = false;
        let rawStringHashes = 0;
        let inString = false;
        let inChar = false;
        let blockCommentLevel = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '' && !inRawString && blockCommentLevel === 0) {
                formattedLines.push('');
                continue;
            }

            // Handle Rust raw strings r"..." or r#..."#
            if (inRawString) {
                formattedLines.push(line);
                const endMatch = line.match(new RegExp('"' + '#'.repeat(rawStringHashes)));
                if (endMatch) {
                    inRawString = false;
                }
                continue;
            }

            // Indentation adjustment for closing braces at the START of the line
            let leadingClosingCount = 0;
            if (blockCommentLevel === 0 && !inString && !inChar) {
                let j = 0;
                while (j < trimmed.length && (trimmed[j] === '}' || trimmed[j] === ')' || trimmed[j] === ']')) {
                    leadingClosingCount++;
                    j++;
                }
            }

            if (leadingClosingCount > 0) {
                indentLevel = Math.max(0, indentLevel - leadingClosingCount);
            }

            // Apply indentation
            let currentLine = (blockCommentLevel > 0 || inString || inChar) ? line : '    '.repeat(Math.max(0, indentLevel)) + trimmed;

            // Normalize => and -> operators (only if not in string/comment/rawstring)
            if (blockCommentLevel === 0 && !inString && !inChar && !inRawString) {
                // This is still a bit naive but better than global replace on the whole line if we were tracking state within the line.
                // To be truly robust we should do this character by character.
            }

            formattedLines.push(currentLine);

            // Calculate net brace change for NEXT line and track state
            let netChange = 0;
            const startIdx = (blockCommentLevel > 0 || inString || inChar) ? 0 : leadingClosingCount;
            const textToProcess = (blockCommentLevel > 0 || inString || inChar) ? line : trimmed.substring(leadingClosingCount);

            for (let k = 0; k < textToProcess.length; k++) {
                const char = textToProcess[k];
                const nextChar = textToProcess[k + 1];

                if (inRawString) {
                    const remaining = textToProcess.substring(k);
                    const endMatch = remaining.match(new RegExp('^"' + '#'.repeat(rawStringHashes)));
                    if (endMatch) {
                        inRawString = false;
                        k += endMatch[0].length - 1;
                    }
                    continue;
                }

                if (blockCommentLevel > 0) {
                    if (char === '*' && nextChar === '/') {
                        blockCommentLevel--;
                        k++;
                    } else if (char === '/' && nextChar === '*') {
                        blockCommentLevel++;
                        k++;
                    }
                    continue;
                }

                if (inString) {
                    if (char === '\\') {
                        k++;
                    } else if (char === '"') {
                        inString = false;
                    }
                    continue;
                }

                if (inChar) {
                    if (char === '\\') {
                        k++;
                    } else if (char === "'") {
                        inChar = false;
                    }
                    continue;
                }

                // Start of comment
                if (char === '/' && nextChar === '/') {
                    break; // Line comment, rest of line is ignored
                }
                if (char === '/' && nextChar === '*') {
                    blockCommentLevel++;
                    k++;
                    continue;
                }

                // Start of raw string
                if (char === 'r' && (nextChar === '"' || nextChar === '#')) {
                    let hashes = 0;
                    let m = k + 1;
                    while (m < textToProcess.length && textToProcess[m] === '#') {
                        hashes++;
                        m++;
                    }
                    if (m < textToProcess.length && textToProcess[m] === '"') {
                        inRawString = true;
                        rawStringHashes = hashes;
                        k = m;
                        continue;
                    }
                }

                if (char === '"') {
                    inString = true;
                    continue;
                }

                if (char === "'") {
                    const remaining = textToProcess.substring(k + 1);
                    if (/^([^'\\]|\\.)'/.test(remaining)) {
                        inChar = true;
                    }
                    continue;
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

        // Post-process to normalize operators outside of strings/comments
        // (A bit complex to do perfectly without a full parser, but let's keep it simple for now as per "resilient" goal)
        // Actually, the previous version was simpler. Let's stick to a slightly better version.
        formatted = formatted.split('\n').map(l => {
            // Only normalize if the line doesn't seem to be a multiline string/comment middle
            if (l.trim().startsWith('*') || l.trim().startsWith('"')) {
                return l;
            }
            return l.replace(/([^ ])=>/g, '$1 =>').replace(/=>([^ ])/g, '=> $1')
                    .replace(/([^ ])->/g, '$1 ->').replace(/->([^ ])/g, '-> $1');
        }).join('\n');

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Rust: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Rust has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Rust formatted successfully!');
    }
}

/**
 * Handle Go formatting and validation
 */
async function handleGo(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Go using custom resilient validator
    validationMessage = validateGo(text);

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;
        let extraIndent = 0;
        let inRawString = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '' && !inRawString) {
                formattedLines.push('');
                continue;
            }

            // Handle backtick raw strings
            if (inRawString) {
                formattedLines.push(line);
                if (trimmed.includes('`')) {
                    const matches = (trimmed.match(/`/g) || []).length;
                    if (matches % 2 !== 0) {
                        inRawString = false;
                    }
                }
                continue;
            }

            if (trimmed.includes('`')) {
                const matches = (trimmed.match(/`/g) || []).length;
                if (matches % 2 !== 0) {
                    inRawString = true;
                }
            }

            // Indentation adjustment for closing braces at the START of the line
            let leadingClosingCount = 0;
            let j = 0;
            while (j < trimmed.length && (trimmed[j] === '}' || trimmed[j] === ')' || trimmed[j] === ']')) {
                leadingClosingCount++;
                j++;
            }

            if (leadingClosingCount > 0) {
                indentLevel = Math.max(0, indentLevel - leadingClosingCount);
                extraIndent = 0;
            }

            // Handle case and default labels
            let currentExtraIndent = extraIndent;
            if (trimmed.startsWith('case ') || trimmed.startsWith('default:')) {
                currentExtraIndent = 0;
                extraIndent = 1;
            }

            // Apply indentation (using 4 spaces as per Go standards often used in editors)
            let currentLine = '    '.repeat(Math.max(0, indentLevel + currentExtraIndent)) + trimmed;

            // Normalize := operator (ensure space around it)
            if (currentLine.includes(':=')) {
                currentLine = currentLine.replace(/\s*:=\s*/g, ' := ');
            }

            // Ensure space before {
            if (currentLine.endsWith('{') && !currentLine.endsWith(' {')) {
                currentLine = currentLine.replace(/\{$/, ' {');
            }

            formattedLines.push(currentLine);

            // Calculate net brace change for NEXT line, excluding leading closing braces
            let netChange = 0;
            let inString = false;
            let inChar = false;
            const remaining = trimmed.substring(leadingClosingCount);

            for (let k = 0; k < remaining.length; k++) {
                const char = remaining[k];
                if (char === '"' && (k === 0 || remaining[k-1] !== '\\')) {
                    inString = !inString;
                    continue;
                }
                if (inString) { continue; }

                if (char === "'" && (k === 0 || remaining[k-1] !== '\\')) {
                    inChar = !inChar;
                    continue;
                }
                if (inChar) { continue; }

                if (char === '/' && remaining[k+1] === '/') { break; }
                if (char === '/' && remaining[k+1] === '*') { break; }

                if (char === '{' || char === '(' || char === '[') {
                    netChange++;
                    extraIndent = 0;
                }
                if (char === '}' || char === ')' || char === ']') {
                    netChange--;
                }
            }

            indentLevel = Math.max(0, indentLevel + netChange);
        }
        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Go: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Go has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Go formatted successfully!');
    }
}

/**
 * Handle C++ formatting and validation
 */
async function handleCPP(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate C++ using custom resilient validator
    validationMessage = validateCPP(text);

    /* eslint-disable */
    try {
        // Format C++ (using js-beautify's JS formatter which handles C-style syntax well)
        formatted = jsbeautify.js(text, {
            indent_size: 4,
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
        vscode.window.showErrorMessage(`Failed to format C++: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`C++ has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('C++ formatted successfully!');
    }
}

/**
 * Custom resilient C++ validator
 */
function validateCPP(text: string): string | undefined {
    const stack: { char: string, line: number, col: number }[] = [];
    let inString = false;
    let inChar = false;
    let inLineComment = false;
    let inBlockComment = false;
    let inRawString = false;
    let rawStringDelimiter = '';

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];

            if (inLineComment) {
                break;
            }
            if (inBlockComment) {
                if (char === '*' && nextChar === '/') {
                    inBlockComment = false;
                    j++;
                }
                continue;
            }

            if (inRawString) {
                // Check for end of raw string: )delimiter"
                if (char === ')') {
                    const potentialDelimiter = line.substring(j + 1, j + 1 + rawStringDelimiter.length);
                    if (potentialDelimiter === rawStringDelimiter && line[j + 1 + rawStringDelimiter.length] === '"') {
                        inRawString = false;
                        j += rawStringDelimiter.length + 1;
                    }
                }
                continue;
            }

            if (inString) {
                if (char === '\\') {
                    j++; // Escape sequence
                } else if (char === '"') {
                    inString = false;
                }
                continue;
            }

            if (inChar) {
                if (char === '\\') {
                    j++;
                } else if (char === "'") {
                    inChar = false;
                }
                continue;
            }

            // Start of comment
            if (char === '/' && nextChar === '/') {
                inLineComment = true;
                j++;
                continue;
            }
            if (char === '/' && nextChar === '*') {
                inBlockComment = true;
                j++;
                continue;
            }

            // Start of raw string R"delimiter(
            if (char === 'R' && nextChar === '"') {
                const openParenIdx = line.indexOf('(', j + 2);
                if (openParenIdx !== -1) {
                    inRawString = true;
                    rawStringDelimiter = line.substring(j + 2, openParenIdx);
                    j = openParenIdx;
                    continue;
                }
            }

            if (char === '"') {
                inString = true;
                continue;
            }

            if (char === "'") {
                inChar = true;
                continue;
            }

            // Braces
            if (char === '{' || char === '(' || char === '[') {
                stack.push({ char, line: i + 1, col: j + 1 });
            } else if (char === '}' || char === ')' || char === ']') {
                if (stack.length === 0) {
                    return `Unexpected closing character '${char}' at line ${i + 1}, col ${j + 1}`;
                }
                const last = stack.pop()!;
                if ((char === '}' && last.char !== '{') ||
                    (char === ')' && last.char !== '(') ||
                    (char === ']' && last.char !== '[')) {
                    return `Mismatched closing character '${char}' at line ${i + 1}, col ${j + 1} (expected closing for '${last.char}' from line ${last.line}, col ${last.col})`;
                }
            }
        }
        inLineComment = false;
    }

    if (inBlockComment) {
        return "Unclosed block comment";
    }
    if (inRawString) {
        return "Unclosed raw string literal";
    }
    if (inString) {
        return "Unclosed string literal";
    }
    if (inChar) {
        return "Unclosed character literal";
    }
    if (stack.length > 0) {
        const last = stack.pop()!;
        return `Unclosed '${last.char}' from line ${last.line}, col ${last.col}`;
    }

    return undefined;
}

/**
 * Custom resilient Rust validator
 */
function validateRust(text: string): string | undefined {
    const stack: { char: string, line: number, col: number }[] = [];
    let inString = false;
    let inChar = false;
    let inLineComment = false;
    let blockCommentLevel = 0;
    let inRawString = false;
    let rawStringHashes = 0;

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];

            if (inLineComment) {
                break;
            }
            if (blockCommentLevel > 0) {
                if (char === '*' && nextChar === '/') {
                    blockCommentLevel--;
                    j++;
                } else if (char === '/' && nextChar === '*') {
                    blockCommentLevel++;
                    j++;
                }
                continue;
            }

            if (inRawString) {
                // Check for end of raw string: " followed by matching number of #
                if (char === '"') {
                    let hashesFound = 0;
                    while (j + 1 + hashesFound < line.length && line[j + 1 + hashesFound] === '#') {
                        hashesFound++;
                    }
                    if (hashesFound >= rawStringHashes) {
                        inRawString = false;
                        j += rawStringHashes;
                    }
                }
                continue;
            }

            if (inString) {
                if (char === '\\') {
                    j++; // Escape sequence
                } else if (char === '"') {
                    inString = false;
                }
                continue;
            }

            if (inChar) {
                if (char === '\\') {
                    j++;
                } else if (char === "'") {
                    inChar = false;
                }
                continue;
            }

            // Start of comment
            if (char === '/' && nextChar === '/') {
                inLineComment = true;
                j++;
                continue;
            }
            if (char === '/' && nextChar === '*') {
                blockCommentLevel++;
                j++;
                continue;
            }

            // Start of raw string r" or r#...# "
            if (char === 'r' && (nextChar === '"' || nextChar === '#')) {
                let hashes = 0;
                let k = j + 1;
                while (k < line.length && line[k] === '#') {
                    hashes++;
                    k++;
                }
                if (k < line.length && line[k] === '"') {
                    inRawString = true;
                    rawStringHashes = hashes;
                    j = k;
                    continue;
                }
            }

            if (char === '"') {
                inString = true;
                continue;
            }

            // Check for char vs lifetime
            if (char === "'") {
                // Lifetime starts with ' followed by id, e.g. 'static, 'a
                // Char literal is 'c' or '\n' etc.
                // Heuristic: if next is identifier start and it's NOT followed by ' soon, it's a lifetime.
                const remaining = line.substring(j + 1);
                const charMatch = remaining.match(/^([^'\\]|\\.)'/);
                if (charMatch) {
                    inChar = true;
                    continue;
                } else {
                    // It's likely a lifetime, ignore it
                    // Skip ' and letters
                    let k = j + 1;
                    while (k < line.length && /[a-zA-Z0-9_]/.test(line[k])) {
                        k++;
                    }
                    j = k - 1;
                    continue;
                }
            }

            // Braces
            if (char === '{' || char === '(' || char === '[') {
                stack.push({ char, line: i + 1, col: j + 1 });
            } else if (char === '}' || char === ')' || char === ']') {
                if (stack.length === 0) {
                    return `Unexpected closing character '${char}' at line ${i + 1}, col ${j + 1}`;
                }
                const last = stack.pop()!;
                if ((char === '}' && last.char !== '{') ||
                    (char === ')' && last.char !== '(') ||
                    (char === ']' && last.char !== '[')) {
                    return `Mismatched closing character '${char}' at line ${i + 1}, col ${j + 1} (expected closing for '${last.char}' from line ${last.line}, col ${last.col})`;
                }
            }
        }
        inLineComment = false;
    }

    if (blockCommentLevel > 0) {
        return "Unclosed block comment";
    }
    if (inRawString) {
        return "Unclosed raw string literal";
    }
    if (inString) {
        return "Unclosed string literal";
    }
    if (inChar) {
        return "Unclosed character literal";
    }
    if (stack.length > 0) {
        const last = stack.pop()!;
        return `Unclosed '${last.char}' from line ${last.line}, col ${last.col}`;
    }

    return undefined;
}

/**
 * Custom resilient Go validator
 */
function validateGo(text: string): string | undefined {
    const stack: { char: string, line: number, col: number }[] = [];
    let inString = false;
    let inRawString = false;
    let inChar = false;
    let inLineComment = false;
    let inBlockComment = false;

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];

            if (inLineComment) {
                break;
            }
            if (inBlockComment) {
                if (char === '*' && nextChar === '/') {
                    inBlockComment = false;
                    j++;
                }
                continue;
            }

            if (inRawString) {
                if (char === '`') {
                    inRawString = false;
                }
                continue;
            }

            if (inString) {
                if (char === '\\') {
                    j++; // Escape sequence
                } else if (char === '"') {
                    inString = false;
                }
                continue;
            }

            if (inChar) {
                if (char === '\\') {
                    j++;
                } else if (char === "'") {
                    inChar = false;
                }
                continue;
            }

            // Start of comment
            if (char === '/' && nextChar === '/') {
                inLineComment = true;
                j++;
                continue;
            }
            if (char === '/' && nextChar === '*') {
                inBlockComment = true;
                j++;
                continue;
            }

            if (char === '`') {
                inRawString = true;
                continue;
            }

            if (char === '"') {
                inString = true;
                continue;
            }

            if (char === "'") {
                inChar = true;
                continue;
            }

            // Braces
            if (char === '{' || char === '(' || char === '[') {
                stack.push({ char, line: i + 1, col: j + 1 });
            } else if (char === '}' || char === ')' || char === ']') {
                if (stack.length === 0) {
                    return `Unexpected closing character '${char}' at line ${i + 1}, col ${j + 1}`;
                }
                const last = stack.pop()!;
                if ((char === '}' && last.char !== '{') ||
                    (char === ')' && last.char !== '(') ||
                    (char === ']' && last.char !== '[')) {
                    return `Mismatched closing character '${char}' at line ${i + 1}, col ${j + 1} (expected closing for '${last.char}' from line ${last.line}, col ${last.col})`;
                }
            }
        }
        inLineComment = false;
    }

    if (inBlockComment) {
        return "Unclosed block comment";
    }
    if (inRawString) {
        return "Unclosed raw string literal";
    }
    if (inString) {
        return "Unclosed string literal";
    }
    if (inChar) {
        return "Unclosed character literal";
    }
    if (stack.length > 0) {
        const last = stack.pop()!;
        return `Unclosed '${last.char}' from line ${last.line}, col ${last.col}`;
    }

    return undefined;
}

/**
 * Handle C# formatting and validation
 */
async function handleCSharp(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate C# using custom resilient validator
    validationMessage = validateCSharp(text);

    /* eslint-disable */
    try {
        // Format C# (using js-beautify's JS formatter which handles C# well)
        formatted = jsbeautify.js(text, {
            indent_size: 4,
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
        vscode.window.showErrorMessage(`Failed to format C#: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`C# has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('C# formatted successfully!');
    }
}

/**
 * Custom resilient C# validator
 */
function validateCSharp(text: string): string | undefined {
    const stack: { char: string, line: number, col: number }[] = [];
    let inString = false;
    let inVerbatimString = false;
    let inChar = false;
    let inLineComment = false;
    let inBlockComment = false;

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];

            if (inLineComment) {
                break;
            }
            if (inBlockComment) {
                if (char === '*' && nextChar === '/') {
                    inBlockComment = false;
                    j++;
                }
                continue;
            }

            if (inString) {
                if (inVerbatimString) {
                    if (char === '"' && nextChar === '"') {
                        j++; // Escaped quote
                    } else if (char === '"') {
                        inString = false;
                        inVerbatimString = false;
                    }
                } else {
                    if (char === '\\') {
                        j++; // Escape sequence
                    } else if (char === '"') {
                        inString = false;
                    }
                }
                continue;
            }

            if (inChar) {
                if (char === '\\') {
                    j++;
                } else if (char === "'") {
                    inChar = false;
                }
                continue;
            }

            // Start of comment
            if (char === '/' && nextChar === '/') {
                inLineComment = true;
                j++;
                continue;
            }
            if (char === '/' && nextChar === '*') {
                inBlockComment = true;
                j++;
                continue;
            }

            // Start of string
            if (char === '@' && nextChar === '"') {
                inString = true;
                inVerbatimString = true;
                j++;
                continue;
            }
            if (char === '$' && nextChar === '"') {
                inString = true;
                j++;
                continue;
            }
            if (char === '"') {
                inString = true;
                continue;
            }

            if (char === "'") {
                inChar = true;
                continue;
            }

            // Braces
            if (char === '{' || char === '(' || char === '[') {
                stack.push({ char, line: i + 1, col: j + 1 });
            } else if (char === '}' || char === ')' || char === ']') {
                if (stack.length === 0) {
                    return `Unexpected closing character '${char}' at line ${i + 1}, col ${j + 1}`;
                }
                const last = stack.pop()!;
                if ((char === '}' && last.char !== '{') ||
                    (char === ')' && last.char !== '(') ||
                    (char === ']' && last.char !== '[')) {
                    return `Mismatched closing character '${char}' at line ${i + 1}, col ${j + 1} (expected closing for '${last.char}' from line ${last.line}, col ${last.col})`;
                }
            }
        }
        inLineComment = false;
    }

    if (inBlockComment) {
        return "Unclosed block comment";
    }
    if (inString) {
        return "Unclosed string literal";
    }
    if (inChar) {
        return "Unclosed character literal";
    }
    if (stack.length > 0) {
        const last = stack.pop()!;
        return `Unclosed '${last.char}' from line ${last.line}, col ${last.col}`;
    }

    return undefined;
}

/**
 * Handle Kotlin formatting and validation
 */
async function handleKotlin(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Kotlin using custom resilient validator
    validationMessage = validateKotlin(text);

    /* eslint-disable */
    try {
        // Format Kotlin (using js-beautify's JS formatter which handles Kotlin well)
        formatted = jsbeautify.js(text, {
            indent_size: 4,
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
        vscode.window.showErrorMessage(`Failed to format Kotlin: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Kotlin has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Kotlin formatted successfully!');
    }
}

/**
 * Handle Java formatting and validation
 */
async function handleJava(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Java using java-ast
    const originalConsoleError = console.error;
    let errorOutput = '';
    console.error = (...args: any[]) => {
        errorOutput += args.join(' ') + '\n';
    };

    try {
        javaAst.parse(text);
    } catch (e: any) {
        if (!errorOutput) {
            errorOutput = e.message;
        }
    } finally {
        console.error = originalConsoleError;
    }

    if (errorOutput) {
        validationMessage = errorOutput.split('\n')[0].trim();
    }

    /* eslint-disable */
    try {
        // Format Java (using js-beautify's JS formatter which handles Java well)
        formatted = jsbeautify.js(text, {
            indent_size: 4,
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
        vscode.window.showErrorMessage(`Failed to format Java: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Java has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Java formatted successfully!');
    }
}

/**
 * Handle Python formatting and validation
 */
async function handlePython(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Python using python-ast
    const originalConsoleError = console.error;
    let errorOutput = '';
    console.error = (...args: any[]) => {
        errorOutput += args.join(' ') + '\n';
    };

    try {
        pythonAst.parse(text);
    } catch (e: any) {
        if (!errorOutput) {
            errorOutput = e.message;
        }
    } finally {
        console.error = originalConsoleError;
    }

    if (errorOutput) {
        validationMessage = errorOutput.split('\n')[0].trim();
    }

    // Resilient formatting logic
    try {
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

            // Heuristic for de-indenting keywords
            const deindentKeywords = ['elif ', 'elif:', 'else:', 'except ', 'except:', 'finally:'];
            const shouldDeindent = deindentKeywords.some(kw => trimmed.startsWith(kw));

            if (shouldDeindent) {
                indentLevel = Math.max(0, indentLevel - 1);
            } else if (!forceNextIndent) {
                // Calculate effective indentation for this line
                // If the user has already de-indented more than we expected, follow them
                const userIndent = line.length - line.trimStart().length;
                const userLevel = Math.floor(userIndent / 4);

                if (userLevel < indentLevel) {
                    indentLevel = userLevel;
                }
            }

            formattedLines.push('    '.repeat(indentLevel) + trimmed);

            // If this line starts a block, the next line should be indented
            if (trimmed.endsWith(':')) {
                indentLevel++;
                forceNextIndent = true;
            } else {
                forceNextIndent = false;
            }
        }
        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Python: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Python has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Python formatted successfully!');
    }
}

/**
 * Handle GraphQL formatting and validation
 */
async function handleGraphQL(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

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
 * Handle CSV formatting and validation
 */
async function handleCSV(editor: vscode.TextEditor, text: string) {
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
 * Detect CSV delimiter
 */
function detectDelimiter(text: string): string {
    const delimiters = [',', ';', '\t', '|'];
    const lines = text.split('\n').filter(l => l.trim() !== '').slice(0, 5);
    if (lines.length === 0) {
        return ',';
    }

    const counts: Record<string, number[]> = {};
    delimiters.forEach(d => counts[d] = []);

    for (const line of lines) {
        delimiters.forEach(d => {
            let count = 0;
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                if (line[i] === '"') {
                    if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (line[i] === d && !inQuotes) {
                    count++;
                }
            }
            counts[d].push(count);
        });
    }

    // Find delimiter with consistent non-zero count
    for (const d of delimiters) {
        const dCounts = counts[d];
        if (dCounts[0] > 0 && dCounts.every(c => c === dCounts[0])) {
            return d;
        }
    }

    // Fallback: most frequent non-zero
    let bestD = ',';
    let maxCount = -1;
    for (const d of delimiters) {
        const sum = counts[d].reduce((a, b) => a + b, 0);
        if (sum > maxCount) {
            maxCount = sum;
            bestD = d;
        }
    }
    return bestD;
}

/**
 * Split CSV line by delimiter respecting quotes
 */
function splitCSVLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                current += '""';
                i++;
            } else {
                inQuotes = !inQuotes;
                current += char;
            }
        } else if (char === delimiter && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

/**
 * Handle ENV formatting and validation
 */
async function handleENV(editor: vscode.TextEditor, text: string) {
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
 * Handle INI formatting and validation
 */
async function handleINI(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate INI using 'ini' package
    try {
        ini.parse(text);
    } catch (e: any) {
        validationMessage = e.message;
    }

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let currentIndent = '';

        for (let line of lines) {
            const trimmed = line.trim();

            // Handle comments and empty lines
            if (trimmed === '' || trimmed.startsWith(';') || trimmed.startsWith('#')) {
                formattedLines.push(trimmed);
                continue;
            }

            // Handle sections [section]
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                // Ensure there is a newline before section if not at the start
                if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                    formattedLines.push('');
                }
                formattedLines.push(trimmed);
                continue;
            }

            // Handle key = value or key : value
            let splitIdx = -1;
            const eqIdx = trimmed.indexOf('=');
            const colIdx = trimmed.indexOf(':');

            if (eqIdx !== -1 && colIdx !== -1) {
                splitIdx = Math.min(eqIdx, colIdx);
            } else {
                splitIdx = eqIdx !== -1 ? eqIdx : colIdx;
            }

            if (splitIdx > 0) {
                const separator = trimmed[splitIdx];
                const key = trimmed.substring(0, splitIdx).trim();
                const valuePart = trimmed.substring(splitIdx + 1).trim();

                // Check for inline comments
                let commentStart = -1;
                for (let i = 0; i < valuePart.length; i++) {
                    const char = valuePart[i];
                    if (char === ';' || char === '#') {
                        // Check if it's not part of a quoted string (simple check)
                        const before = valuePart.substring(0, i);
                        const quoteCount = (before.match(/"/g) || []).length;
                        if (quoteCount % 2 === 0) {
                            commentStart = i;
                            break;
                        }
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
 * Handle TOML formatting and validation
 */
async function handleTOML(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

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
 * Handle YAML formatting and validation
 */
async function handleYAML(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

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
        vscode.window.showInformationMessage('YAML formatted successfully!');
    }
}

/**
 * Handle PHP formatting and validation
 */
async function handlePHP(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate PHP using php-parser
    try {
        const parser = new (phpParser as any)({
            parser: {
                extractDoc: true,
                php7: true
            },
            ast: {
                withPositions: true
            }
        });
        parser.parseCode(text);
    } catch (e: any) {
        if (e.loc) {
            validationMessage = `${e.message} at line ${e.loc.start.line}, col ${e.loc.start.column}`;
        } else {
            validationMessage = e.message;
        }
    }

    /* eslint-disable */
    try {
        // Format PHP (using js-beautify's HTML formatter which handles PHP tags)
        const options: any = {
            indent_size: 2,
            indent_char: ' ',
            max_preserve_newlines: 2,
            preserve_newlines: true,
            indent_scripts: 'normal',
            end_with_newline: false,
            wrap_line_length: 0,
            indent_inner_html: false,
            templating: ['php']
        };
        formatted = jsbeautify.html(text, options);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format PHP: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`PHP has syntax issues but was beautified. First error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('PHP formatted successfully!');
    }
}

/**
 * Handle Svelte formatting and validation
 */
async function handleSvelte(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Svelte
    try {
        svelte.parse(text);
    } catch (e: any) {
        if (e.start) {
            validationMessage = `${e.message} at line ${e.start.line}, col ${e.start.column}`;
        } else {
            validationMessage = e.message;
        }
    }

    /* eslint-disable */
    try {
        // Format Svelte (using js-beautify's HTML formatter)
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
        formatted = jsbeautify.html(text, options);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Svelte: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Svelte has syntax issues but was beautified. First error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Svelte formatted successfully!');
    }
}

/**
 * Handle HTML formatting and validation
 */
async function handleHTML(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate HTML
    const errors = HTMLHint.verify(text);
    if (errors.length > 0) {
        const firstError = errors[0];
        validationMessage = `${firstError.message} at line ${firstError.line}, col ${firstError.col}`;
        if (errors.length > 1) {
            validationMessage += ` (and ${errors.length - 1} more errors)`;
        }
    }

    /* eslint-disable */
    try {
        // Format HTML
        formatted = jsbeautify.html(text, {
            indent_size: 2,
            indent_char: ' ',
            max_preserve_newlines: 2,
            preserve_newlines: true,
            indent_scripts: 'normal',
            end_with_newline: false,
            wrap_line_length: 0,
            indent_inner_html: false
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format HTML: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`HTML has syntax issues but was beautified. First error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('HTML formatted successfully!');
    }
}

/**
 * Handle Vue formatting and validation
 */
async function handleVue(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Vue (using HTMLHint but ignoring doctype-first)
    /* eslint-disable @typescript-eslint/naming-convention */
    const errors = HTMLHint.verify(text, { 'doctype-first': false });
    /* eslint-enable @typescript-eslint/naming-convention */
    if (errors.length > 0) {
        const firstError = errors[0];
        validationMessage = `${firstError.message} at line ${firstError.line}, col ${firstError.col}`;
        if (errors.length > 1) {
            validationMessage += ` (and ${errors.length - 1} more errors)`;
        }
    }

    /* eslint-disable */
    try {
        // Format Vue (using js-beautify's HTML formatter)
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
        formatted = jsbeautify.html(text, options);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Vue: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Vue has syntax issues but was beautified. First error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Vue formatted successfully!');
    }
}

/**
 * Handle TypeScript formatting and validation
 */
async function handleTS(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate TypeScript
    try {
        const sourceFile = ts.createSourceFile('temp.ts', text, ts.ScriptTarget.Latest, true);
        const diagnostics = (sourceFile as any).parseDiagnostics;
        if (diagnostics && diagnostics.length > 0) {
            const firstError = diagnostics[0];
            const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, firstError.start!);
            validationMessage = `${ts.flattenDiagnosticMessageText(firstError.messageText, '\n')} at line ${line + 1}, col ${character + 1}`;
        }
    } catch (e: any) {
        validationMessage = e.message;
    }

    /* eslint-disable */
    try {
        // Format TypeScript (using js-beautify's JS formatter)
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
        vscode.window.showErrorMessage(`Failed to format TypeScript: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`TypeScript has syntax issues but was beautified. Error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('TypeScript formatted successfully!');
    }
}

/**
 * Handle TSX formatting and validation
 */
async function handleTSX(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate TSX
    try {
        const sourceFile = ts.createSourceFile('temp.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        const diagnostics = (sourceFile as any).parseDiagnostics;
        if (diagnostics && diagnostics.length > 0) {
            const firstError = diagnostics[0];
            const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, firstError.start!);
            validationMessage = `${ts.flattenDiagnosticMessageText(firstError.messageText, '\n')} at line ${line + 1}, col ${character + 1}`;
        }
    } catch (e: any) {
        validationMessage = e.message;
    }

    /* eslint-disable */
    try {
        // Format TSX (using js-beautify's JS formatter)
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
        vscode.window.showErrorMessage(`Failed to format TSX: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`TSX has syntax issues but was beautified. Error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('TSX formatted successfully!');
    }
}

/**
 * Handle JSX formatting and validation
 */
async function handleJSX(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate JSX
    try {
        const sourceFile = ts.createSourceFile('temp.jsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
        const diagnostics = (sourceFile as any).parseDiagnostics;
        if (diagnostics && diagnostics.length > 0) {
            const firstError = diagnostics[0];
            const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, firstError.start!);
            validationMessage = `${ts.flattenDiagnosticMessageText(firstError.messageText, '\n')} at line ${line + 1}, col ${character + 1}`;
        }
    } catch (e: any) {
        validationMessage = e.message;
    }

    /* eslint-disable */
    try {
        // Format JSX
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
        vscode.window.showErrorMessage(`Failed to format JSX: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`JSX has syntax issues but was beautified. Error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('JSX formatted successfully!');
    }
}

/**
 * Handle JavaScript formatting and validation
 */
async function handleJS(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate JavaScript
    try {
        acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
    } catch (e: any) {
        validationMessage = `${e.message} at line ${e.loc?.line}, col ${e.loc?.column}`;
    }

    /* eslint-disable */
    try {
        // Format JavaScript
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
        vscode.window.showErrorMessage(`Failed to format JavaScript: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`JavaScript has syntax issues but was beautified. Error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('JavaScript formatted successfully!');
    }
}

/**
 * Handle Dockerfile formatting and validation
 */
async function handleDockerfile(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Dockerfile
    validationMessage = validateDockerfile(text);

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let isMultiline = false;

        const instructions = [
            'FROM', 'RUN', 'COPY', 'ADD', 'WORKDIR', 'EXPOSE', 'ENTRYPOINT',
            'CMD', 'ENV', 'ARG', 'LABEL', 'USER', 'VOLUME', 'STOPSIGNAL',
            'HEALTHCHECK', 'ONBUILD', 'MAINTAINER', 'SHELL'
        ];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '' || trimmed.startsWith('#')) {
                formattedLines.push(trimmed);
                continue;
            }

            let currentLine = trimmed;
            if (!isMultiline) {
                // Check if line starts with an instruction
                const firstWord = trimmed.split(/\s+/)[0].toUpperCase();
                if (instructions.includes(firstWord)) {
                    // Normalize instruction case
                    const rest = trimmed.substring(firstWord.length).trim();
                    currentLine = `${firstWord} ${rest}`;
                }
                formattedLines.push(currentLine);
            } else {
                // Indent multiline continuation
                formattedLines.push('    ' + trimmed);
            }

            // Check if this line ends with a backslash for multiline support
            isMultiline = trimmed.endsWith('\\');
        }
        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Dockerfile: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Dockerfile has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Dockerfile formatted successfully!');
    }
}

/**
 * Validate Dockerfile code for basic issues
 */
function validateDockerfile(text: string): string | undefined {
    const lines = text.split('\n');
    let hasFrom = false;
    let inQuotes = false;
    let quoteChar = '';

    const instructions = [
        'FROM', 'RUN', 'COPY', 'ADD', 'WORKDIR', 'EXPOSE', 'ENTRYPOINT',
        'CMD', 'ENV', 'ARG', 'LABEL', 'USER', 'VOLUME', 'STOPSIGNAL',
        'HEALTHCHECK', 'ONBUILD', 'MAINTAINER', 'SHELL'
    ];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '' || trimmed.startsWith('#')) continue;

        // Check for unclosed quotes
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if ((char === '"' || char === "'") && (j === 0 || line[j - 1] !== '\\')) {
                if (!inQuotes) {
                    inQuotes = true;
                    quoteChar = char;
                } else if (char === quoteChar) {
                    inQuotes = false;
                }
            }
        }

        const firstWord = trimmed.split(/\s+/)[0].toUpperCase();
        if (instructions.includes(firstWord)) {
            if (firstWord === 'FROM') hasFrom = true;

            const rest = trimmed.substring(firstWord.length).trim();
            if (rest === '' && !trimmed.endsWith('\\')) {
                return `Instruction '${firstWord}' has no arguments at line ${i + 1}`;
            }
        }
    }

    if (inQuotes) {
        return "Unclosed string literal";
    }

    if (!hasFrom && text.trim().length > 0) {
        return "Dockerfile should start with a 'FROM' instruction";
    }

    return undefined;
}

/**
 * Main beautify function with auto-detection
 */
export async function beautify(forcedFormat?: 'json' | 'jsonc' | 'xml' | 'html' | 'css' | 'scss' | 'sass' | 'less' | 'javascript' | 'typescript' | 'jsx' | 'tsx' | 'vue' | 'svelte' | 'php' | 'yaml' | 'toml' | 'ini' | 'env' | 'csv' | 'graphql' | 'python' | 'java' | 'kotlin' | 'csharp' | 'cpp' | 'go' | 'rust' | 'ruby' | 'swift' | 'dart' | 'dockerfile' | 'shell' | 'powershell' | 'hcl' | 'makefile' | 'nginx' | 'sql' | 'prisma' | 'mongodb') {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
    }

    const document = editor.document;
    const text = document.getText();

    if (text.trim().length === 0) {
        vscode.window.showWarningMessage('Document is empty');
        return;
    }

    const format = forcedFormat || detectFormat(text, document.languageId);

    if (format === 'json') {
        await handleJSON(editor, text);
    } else if (format === 'jsonc') {
        await handleJSONC(editor, text);
    } else if (format === 'xml') {
        await handleXML(editor, text);
    } else if (format === 'html') {
        await handleHTML(editor, text);
    } else if (format === 'css') {
        await handleCSS(editor, text);
    } else if (format === 'scss') {
        await handleSCSS(editor, text);
    } else if (format === 'sass') {
        await handleSASS(editor, text);
    } else if (format === 'less') {
        await handleLESS(editor, text);
    } else if (format === 'javascript') {
        await handleJS(editor, text);
    } else if (format === 'typescript') {
        await handleTS(editor, text);
    } else if (format === 'jsx') {
        await handleJSX(editor, text);
    } else if (format === 'tsx') {
        await handleTSX(editor, text);
    } else if (format === 'vue') {
        await handleVue(editor, text);
    } else if (format === 'svelte') {
        await handleSvelte(editor, text);
    } else if (format === 'php') {
        await handlePHP(editor, text);
    } else if (format === 'yaml') {
        await handleYAML(editor, text);
    } else if (format === 'toml') {
        await handleTOML(editor, text);
    } else if (format === 'ini') {
        await handleINI(editor, text);
    } else if (format === 'env') {
        await handleENV(editor, text);
    } else if (format === 'csv') {
        await handleCSV(editor, text);
    } else if (format === 'graphql') {
        await handleGraphQL(editor, text);
    } else if (format === 'python') {
        await handlePython(editor, text);
    } else if (format === 'java') {
        await handleJava(editor, text);
    } else if (format === 'kotlin') {
        await handleKotlin(editor, text);
    } else if (format === 'csharp') {
        await handleCSharp(editor, text);
    } else if (format === 'cpp') {
        await handleCPP(editor, text);
    } else if (format === 'go') {
        await handleGo(editor, text);
    } else if (format === 'rust') {
        await handleRust(editor, text);
    } else if (format === 'ruby') {
        await handleRuby(editor, text);
    } else if (format === 'swift') {
        await handleSwift(editor, text);
    } else if (format === 'dart') {
        await handleDart(editor, text);
    } else if (format === 'dockerfile') {
        await handleDockerfile(editor, text);
    } else if (format === 'shell') {
        await handleShell(editor, text);
    } else if (format === 'powershell') {
        await handlePowerShell(editor, text);
    } else if (format === 'hcl') {
        await handleHCL(editor, text);
    } else if (format === 'makefile') {
        await handleMakefile(editor, text);
    } else if (format === 'nginx') {
        await handleNginx(editor, text);
    } else if (format === 'sql') {
        await handleSQL(editor, text);
    } else if (format === 'prisma') {
        await handlePrisma(editor, text);
    } else if (format === 'mongodb') {
        await handleMongoDB(editor, text);
    } else {
        // If unknown, try JSON first then CSS/XML/HTML
        try {
            jsonrepair(text);
            await handleJSON(editor, text);
        } catch (e) {
            const trimmed = text.trim();
            if (trimmed.startsWith('<')) {
                const lowerText = trimmed.toLowerCase();
                if (lowerText.startsWith('<!doctype html') || lowerText.startsWith('<html')) {
                    await handleHTML(editor, text);
                } else {
                    await handleXML(editor, text);
                }
            } else if (trimmed.includes('{') && trimmed.includes('}')) {
                await handleCSS(editor, text);
            } else if (trimmed.startsWith('---') || /^[a-z0-9_-]+:\s/m.test(trimmed)) {
                await handleYAML(editor, text);
            } else if (trimmed.startsWith('[') || /^[a-z0-9_-]+\s*[=:]\s*/m.test(trimmed) || trimmed.startsWith(';') || trimmed.startsWith('#')) {
                // Heuristic for INI vs TOML vs ENV
                if (trimmed.includes(';') || (trimmed.includes(':') && !trimmed.includes('='))) {
                    await handleINI(editor, text);
                } else if (trimmed.startsWith('[') || (trimmed.includes('=') && !/^(export\s+)?[a-z_][a-z0-9_]*\s*=/i.test(trimmed))) {
                    await handleTOML(editor, text);
                } else {
                    await handleENV(editor, text);
                }
            } else if (detectDelimiter(trimmed) !== ',' || trimmed.includes(',')) {
                // Heuristic for CSV
                await handleCSV(editor, text);
            } else {
                vscode.window.showErrorMessage('Could not detect format (JSON, XML, HTML, CSS, YAML, TOML, INI, ENV or CSV). Please ensure your file starts with {, [, < or has key: value pairs');
            }
        }
    }
}

/**
 * Detect format based on language ID or content
 */
export function detectFormat(text: string, languageId: string): 'json' | 'jsonc' | 'xml' | 'html' | 'css' | 'scss' | 'sass' | 'less' | 'javascript' | 'typescript' | 'jsx' | 'tsx' | 'vue' | 'svelte' | 'php' | 'yaml' | 'toml' | 'ini' | 'env' | 'csv' | 'graphql' | 'python' | 'java' | 'kotlin' | 'csharp' | 'cpp' | 'go' | 'rust' | 'ruby' | 'swift' | 'dart' | 'dockerfile' | 'shell' | 'powershell' | 'hcl' | 'makefile' | 'nginx' | 'sql' | 'prisma' | 'mongodb' | 'unknown' {
    const lang = languageId.toLowerCase();
    if (lang === 'json') { return 'json'; }
    if (lang === 'jsonc') { return 'jsonc'; }
    if (lang === 'xml' || lang === 'xsl') { return 'xml'; }
    if (lang === 'html' || lang === 'htm') { return 'html'; }
    if (lang === 'css') { return 'css'; }
    if (lang === 'scss') { return 'scss'; }
    if (lang === 'sass') { return 'sass'; }
    if (lang === 'less') { return 'less'; }
    if (lang === 'javascript') { return 'javascript'; }
    if (lang === 'javascriptreact') { return 'jsx'; }
    if (lang === 'typescript') { return 'typescript'; }
    if (lang === 'typescriptreact') { return 'tsx'; }
    if (lang === 'vue') { return 'vue'; }
    if (lang === 'svelte') { return 'svelte'; }
    if (lang === 'php') { return 'php'; }
    if (lang === 'yaml' || lang === 'yml') { return 'yaml'; }
    if (lang === 'toml') { return 'toml'; }
    if (lang === 'ini') { return 'ini'; }
    if (lang === 'dotenv' || lang === 'env') { return 'env'; }
    if (lang === 'csv') { return 'csv'; }
    if (lang === 'graphql') { return 'graphql'; }
    if (lang === 'python') { return 'python'; }
    if (lang === 'java') { return 'java'; }
    if (lang === 'kotlin' || lang === 'kt' || lang === 'kts') { return 'kotlin'; }
    if (lang === 'csharp') { return 'csharp'; }
    if (lang === 'cpp' || lang === 'c') { return 'cpp'; }
    if (lang === 'rust' || lang === 'rs') { return 'rust'; }
    if (lang === 'go') { return 'go'; }
    if (lang === 'powershell' || lang === 'ps1' || lang === 'psm1') { return 'powershell'; }
    if (lang === 'ruby' || lang === 'rb') { return 'ruby'; }
    if (lang === 'swift') { return 'swift'; }
    if (lang === 'terraform' || lang === 'hcl' || lang === 'terraform-vars') { return 'hcl'; }
    if (lang === 'makefile') { return 'makefile'; }
    if (lang === 'nginx') { return 'nginx'; }
    if (lang === 'sql') { return 'sql'; }
    if (lang === 'prisma') { return 'prisma'; }
    if (lang === 'mongodb') { return 'mongodb'; }
    if (lang === 'dart' || lang === 'dockerfile' || lang === 'shellscript' || lang === 'sh') {
        return lang === 'shellscript' || lang === 'sh' ? 'shell' : lang as any;
    }

    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        // Check if it contains comments, if so it's JSONC
        if (trimmed.includes('//') || trimmed.includes('/*')) {
            return 'jsonc';
        }
        return 'json';
    }

    // PHP heuristic
    if (trimmed.startsWith('<?php') || trimmed.startsWith('<?') || trimmed.includes('<?php')) {
        return 'php';
    }

    // GraphQL heuristic
    if (
        /^\s*(query|mutation|subscription|fragment|schema|type|interface|enum|scalar|union|input|directive|extend)\b/i.test(trimmed) ||
        (/^\s*\{/m.test(trimmed) && trimmed.includes('}') && !trimmed.includes(':') && !trimmed.includes('"'))
    ) {
        return 'graphql';
    }

    if (trimmed.includes('<template') || /<script\s+setup/i.test(trimmed) || /<style\s+scoped/i.test(trimmed)) {
        return 'vue';
    }

    // Svelte heuristic: Svelte blocks or .svelte specific tags
    if (
        /\{#if\s+/i.test(trimmed) ||
        /\{#each\s+/i.test(trimmed) ||
        /\{#await\s+/i.test(trimmed) ||
        (trimmed.includes('<script') && trimmed.includes('</script>') && (trimmed.includes('export let') || trimmed.includes('$:')))
    ) {
        return 'svelte';
    }

    if (trimmed.startsWith('<')) {
        // Simple heuristic: if it looks like XML but isn't explicitly,
        // we'll try XML first then HTML in the main loop if unknown.
        // But if we're here, we can check for common HTML tags.
        const lowerText = trimmed.toLowerCase();
        if (lowerText.startsWith('<!doctype html') || lowerText.startsWith('<html')) {
            return 'html';
        }
        return 'xml';
    }

    // SCSS heuristic
    if (trimmed.includes('{') && (trimmed.includes('$') || trimmed.includes('@mixin') || trimmed.includes('@include'))) {
        return 'scss';
    }

    // Prisma heuristic
    if (
        /^\s*(datasource|generator|model|enum|type)\s+[a-z0-9_-]+\s*\{/im.test(trimmed) ||
        /^\s*(model|enum|type)\s+[A-Z][a-zA-Z0-9]*\s*\{/m.test(trimmed) ||
        /(@id|@unique|@default|@relation|@@id|@@unique|@@index|@@map)\b/.test(trimmed)
    ) {
        return 'prisma';
    }

    // MongoDB Shell heuristic
    if (
        /^\s*(db\.|sh\.|rs\.|use\s+|show\s+(collections|dbs|databases|users|roles))\b/m.test(trimmed) ||
        /\b(ObjectId|ISODate|Timestamp|NumberInt|NumberLong|Decimal128|DBRef)\s*\(/.test(trimmed)
    ) {
        return 'mongodb';
    }

    // SASS heuristic
    if (trimmed.startsWith('$') && !trimmed.includes('{')) {
        return 'sass';
    }

    // YAML heuristic (before CSS/JS to avoid conflicts, but specific enough)
    if (
        trimmed.startsWith('---') ||
        (/^\s*-\s+.+/m.test(trimmed) && !trimmed.includes('{')) ||
        (trimmed.startsWith('#') && !trimmed.includes('{')) ||
        (/^[a-z0-9_-]+:\s+.+/im.test(trimmed) && !trimmed.includes('{'))
    ) {
        return 'yaml';
    }

    // ENV heuristic
    if (
        (trimmed.startsWith('#') && !trimmed.includes('{') && !trimmed.includes('[') && /^[A-Z_]+=/m.test(trimmed)) ||
        /^(export\s+)?[A-Z_][A-Z0-9_]*\s*=\s*/im.test(trimmed)
    ) {
        return 'env';
    }

    // INI heuristic
    if (
        trimmed.startsWith(';') ||
        (/^[a-z0-9_-]+\s*[:]\s*.+/im.test(trimmed) && !trimmed.includes('{'))
    ) {
        return 'ini';
    }

    // CSV heuristic
    const lines = trimmed.split('\n').filter(l => l.trim() !== '');
    if (lines.length > 1) {
        const d = detectDelimiter(trimmed);
        const counts = lines.slice(0, 3).map(l => splitCSVLine(l, d).length);
        if (counts.length > 1 && counts.every(c => c > 1 && c === counts[0])) {
            return 'csv';
        }
    }

    // TOML or INI or ENV (all can use key=value)
    if (
        (trimmed.startsWith('[') && trimmed.includes(']')) ||
        (/^[a-z0-9_-]+\s*=\s*.+/im.test(trimmed) && !trimmed.includes('{'))
    ) {
        // If it has a semicolon, it's likely INI
        if (trimmed.includes(';')) {
            return 'ini';
        }
        // If it has a section, it's likely TOML or INI
        if (trimmed.startsWith('[')) {
            return 'toml';
        }
        // If it matches ENV pattern (UPPER_CASE keys)
        if (/^(export\s+)?[A-Z_][A-Z0-9_]*\s*=\s*/m.test(trimmed)) {
            return 'env';
        }
        return 'toml';
    }

    // LESS heuristic
    if (trimmed.includes('{') && (/@([a-z0-9-_]+)\s*:/i.test(trimmed) || /[.][a-z0-9-_]+\s*\(/i.test(trimmed))) {
        return 'less';
    }

    // CSS heuristic: contains { and } and looks like a rule
    if (trimmed.includes('{') && trimmed.includes('}') && /[a-z0-9-_#.]+\s*\{/i.test(trimmed)) {
        return 'css';
    }

    // TSX heuristic
    if (trimmed.includes('<') && (trimmed.includes('/>') || trimmed.includes('</')) &&
        (/\b(interface|type|public|private|protected|readonly|as|implements)\b/.test(trimmed) ||
            /:\s*(string|number|boolean|any|void|unknown|never|object)\b/.test(trimmed))) {
        return 'tsx';
    }

    // JSX heuristic
    if (trimmed.includes('<') && (trimmed.includes('/>') || trimmed.includes('</')) &&
        /\b(import|export|function|const|let|var|return)\b/.test(trimmed)) {
        return 'jsx';
    }

    // TypeScript heuristic
    if (
        /\b(interface|namespace|type|enum|public|private|protected|readonly|as|implements)\b/.test(trimmed) ||
        /:\s*(string|number|boolean|any|void|unknown|never|object)\b/.test(trimmed) ||
        /<[A-Z][A-Za-z0-9]*(\s*,\s*[A-Z][A-Za-z0-9]*)*>/.test(trimmed)
    ) {
        return 'typescript';
    }

    // Python heuristic
    if (
        /^\s*(def|class|if|for|while|with|try|import|from|async\s+def|async\s+for|async\s+with)\b/m.test(trimmed) ||
        /if __name__ == ['"]__main__['"]:/m.test(trimmed)
    ) {
        return 'python';
    }

    // Java heuristic
    if (
        /\b(public|private|protected)\s+(class|interface|enum|record)\b/.test(trimmed) ||
        /\bimport\s+java\./.test(trimmed) ||
        /\bpublic\s+static\s+void\s+main\b/.test(trimmed) ||
        /^\s*package\s+[a-z0-9_.]+\s*;/m.test(trimmed)
    ) {
        return 'java';
    }

    // Kotlin heuristic
    if (
        /^\s*(fun|val|var|package|import|class|interface|object)\b/m.test(trimmed) ||
        /\b(companion\s+object|when\s*\(|->)\b/.test(trimmed) ||
        /:\s*(String|Int|Long|Double|Float|Boolean|Any|Unit)\b/.test(trimmed)
    ) {
        return 'kotlin';
    }

    // C# heuristic
    if (
        /\b(public|private|protected|internal)\s+(class|interface|enum|struct|record)\b/.test(trimmed) ||
        /\busing\s+[A-Z][A-Za-z0-9.]*\s*;/.test(trimmed) ||
        /\bnamespace\s+[A-Z][A-Za-z0-9.]*(\s*\{|;)/.test(trimmed) ||
        /\bstatic\s+void\s+Main\b/.test(trimmed) ||
        /\bConsole\.(WriteLine|Write)\b/.test(trimmed)
    ) {
        return 'csharp';
    }

    // Rust heuristic
    if (
        /^\s*(fn|mod|pub|use|crate|type|struct|enum|impl|trait|match|unsafe|async|await)\b/m.test(trimmed) ||
        /\b(println!|vec!|panic!|format!|assert!)\b/.test(trimmed) ||
        /\b(match\s+.+\s*\{|=>|->)\b/.test(trimmed) ||
        /#!?\[[a-z_]+\(?.+\)?\]/i.test(trimmed)
    ) {
        return 'rust';
    }

    // Ruby heuristic
    if (
        /^\s*(class|module|def)\s+[A-Z_a-z]/m.test(trimmed) ||
        /\b(require|include|attr_accessor|attr_reader|attr_writer)\b/.test(trimmed) ||
        (/^\s*#/.test(trimmed) && /\b(def|class|end)\b/.test(text)) ||
        (trimmed.includes('do') && trimmed.includes('end'))
    ) {
        return 'ruby';
    }

    // Go heuristic
    if (
        /^\s*package\s+[a-z0-9_]+\b/m.test(trimmed) ||
        /^\s*func\s+\b/m.test(trimmed) ||
        /^\s*import\s+(\(|".+")/m.test(trimmed) ||
        /\bgo\s+func\b/.test(trimmed) ||
        /\bchan\s+[a-z0-9_]+\b/i.test(trimmed) ||
        /\bselect\s*\{/.test(trimmed) ||
        /:=/m.test(trimmed)
    ) {
        return 'go';
    }

    // C++ heuristic
    if (
        /^\s*#include\s*[<"]/m.test(trimmed) ||
        /\b(std::cout|std::endl|std::vector|std::string|std::map|std::set)\b/.test(trimmed) ||
        /\busing\s+namespace\s+std\s*;/.test(trimmed) ||
        /\btemplate\s*<\s*.+\s*>/m.test(trimmed) ||
        /\b(public|private|protected)\s*:\s*/.test(trimmed) ||
        (/\bclass\s+[A-Za-z0-9_]+\s*\{/.test(trimmed) && trimmed.includes('};'))
    ) {
        return 'cpp';
    }

    // Swift heuristic
    if (
        /^\s*(import\s+Swift|import\s+Foundation|import\s+UIKit|import\s+SwiftUI)\b/m.test(trimmed) ||
        /^\s*(protocol|extension|actor|any|associatedtype|async|await)\s+[A-Z_a-z]/m.test(trimmed) ||
        /^\s*(func|let|var|struct|enum|class)\s+[A-Z_a-z]/m.test(trimmed) ||
        /\b(print|debugPrint|fatalError|precondition)\b/.test(trimmed) ||
        /^\s*(@main|@UIApplicationMain|@NSApplicationMain)\b/m.test(trimmed)
    ) {
        return 'swift';
    }

    // Dart heuristic
    if (
        /^\s*import\s+['"](dart:|package:|.*\.dart)/m.test(trimmed) ||
        /\bvoid\s+main\s*\(\)/.test(trimmed) ||
        /@override\b/.test(trimmed) ||
        /^\s*(class|mixin|extension)\s+[A-Z_a-z]/m.test(trimmed) ||
        /\b(final|const|late|var|dynamic)\s+[A-Z_a-z_][A-Za-z0-9_]*\b/.test(trimmed)
    ) {
        return 'dart';
    }

    // Dockerfile heuristic
    if (
        /^\s*(FROM|RUN|COPY|ADD|WORKDIR|EXPOSE|ENTRYPOINT|CMD|ENV|ARG|LABEL|USER|VOLUME|STOPSIGNAL|HEALTHCHECK|ONBUILD|MAINTAINER|SHELL)\b/i.test(trimmed)
    ) {
        return 'dockerfile';
    }

    // Shell heuristic
    if (
        (trimmed.startsWith('#!') && (trimmed.includes('sh') && !trimmed.toLowerCase().includes('pwsh'))) ||
        /^\s*(export|alias|source|unset|readonly|shopt)\b/m.test(trimmed) ||
        /\b(if\s+\[\[|if\s+\[|case\s+\$.+\s+in)\b/.test(trimmed)
    ) {
        return 'shell';
    }

    // PowerShell heuristic
    if (
        (trimmed.startsWith('#!') && trimmed.toLowerCase().includes('powershell')) ||
        /^\s*#[^!]/m.test(trimmed) && (trimmed.includes('Get-') || trimmed.includes('Set-') || trimmed.includes('Write-')) ||
        /^\s*(param|begin|process|end|filter|workflow|parallel)\b/im.test(trimmed) ||
        /^\s*(\$[a-z_][a-z0-9_]*\s*=|\[[a-z0-9.]+\])/im.test(trimmed) ||
        (trimmed.includes('{') && trimmed.includes('}') && /\$[a-z_]/i.test(trimmed)) ||
        trimmed.startsWith('<#') || trimmed.startsWith('@"') || trimmed.startsWith("@'")
    ) {
        return 'powershell';
    }

    // HCL heuristic
    if (
        /^\s*(resource|variable|data|module|locals|output|terraform|provider)\b\s*["']?[a-z0-9_-]*["']?\s*["']?[a-z0-9_-]*["']?\s*\{/i.test(trimmed) ||
        (/^\s*[a-z0-9_-]+\s*\{/i.test(trimmed) && trimmed.includes('}') && trimmed.includes('=') && !trimmed.includes(';') && !trimmed.includes(':'))
    ) {
        return 'hcl';
    }

    // Makefile heuristic
    if (
        /^([a-z0-9_-]+):/im.test(trimmed) ||
        (/^\t[a-z0-9_-]+/im.test(text) && trimmed.includes(':')) ||
        /^[A-Z_]+ = /m.test(trimmed)
    ) {
        return 'makefile';
    }

    // Nginx heuristic
    if (
        /^\s*(http|server|location|upstream|events)\b\s*\{/im.test(trimmed) ||
        /^\s*(listen|proxy_pass|root|index|server_name|include)\s+[^;]+;/im.test(trimmed)
    ) {
        return 'nginx';
    }

    // SQL heuristic
    if (
        /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|GRANT|REVOKE|USE)\b/im.test(trimmed) ||
        (/\bFROM\b/im.test(trimmed) && /\bWHERE\b/im.test(trimmed)) ||
        /\bCREATE\s+TABLE\b/im.test(trimmed)
    ) {
        return 'sql';
    }

    // JavaScript heuristic: common keywords or arrow functions
    if (
        /\b(var|let|const|function|class|import|export|if|for|while|return)\b/.test(trimmed) ||
        /\s*=>\s*/.test(trimmed) ||
        (trimmed.includes('{') && trimmed.includes('}') && trimmed.includes(';'))
    ) {
        return 'javascript';
    }

    return 'unknown';
}

/**
 * Handle JSONC formatting and validation
 */
async function handleJSONC(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate JSONC using jsonc-parser
    const errors: ParseError[] = [];
    parse(text, errors);
    if (errors.length > 0) {
        const error = errors[0];
        const { line, character } = editor.document.positionAt(error.offset);
        validationMessage = `Invalid JSONC at line ${line + 1}, col ${character + 1}`;
    }

    /* eslint-disable */
    try {
        // Format JSONC using js-beautify's JS formatter (preserves comments)
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
        vscode.window.showErrorMessage(`Failed to format JSONC: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`JSONC has syntax issues but was beautified. Error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('JSONC formatted successfully!');
    }
}

/**
 * Handle JSON formatting and repair
 */
async function handleJSON(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let repairMessage: string | undefined;

    try {
        // Try standard JSON parse
        const parsed = JSON.parse(text);
        formatted = JSON.stringify(parsed, null, 2);
    } catch (originalError: any) {
        // If it fails, try to repair
        try {
            const repairedText = jsonrepair(text);
            const parsed = JSON.parse(repairedText);
            formatted = JSON.stringify(parsed, null, 2);
            repairMessage = originalError.message;
        } catch (repairError: any) {
            vscode.window.showErrorMessage(`Failed to format JSON. Original error: ${originalError.message}`);
            return;
        }
    }

    await applyEdit(editor, formatted);

    if (repairMessage) {
        vscode.window.showWarningMessage(`JSON was invalid but repaired. Original error: ${repairMessage}`);
    } else {
        vscode.window.showInformationMessage('JSON formatted successfully!');
    }
}

/**
 * Handle CSS formatting and validation
 */
async function handleCSS(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate CSS
    try {
        const obj = css.parse(text, { silent: true });
        if (obj.stylesheet && obj.stylesheet.parsingErrors && obj.stylesheet.parsingErrors.length > 0) {
            const firstError = obj.stylesheet.parsingErrors[0];
            validationMessage = `${firstError.reason} at line ${firstError.line}, col ${firstError.column}`;
            if (obj.stylesheet.parsingErrors.length > 1) {
                validationMessage += ` (and ${obj.stylesheet.parsingErrors.length - 1} more errors)`;
            }
        }
    } catch (e: any) {
        validationMessage = e.message;
    }

    /* eslint-disable */
    try {
        // Format CSS
        formatted = jsbeautify.css(text, {
            indent_size: 2,
            indent_char: ' ',
            selector_separator_newline: true,
            newline_between_rules: true,
            end_with_newline: false
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format CSS: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`CSS has syntax issues but was beautified. First error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('CSS formatted successfully!');
    }
}

/**
 * Handle SCSS formatting and validation
 */
async function handleSCSS(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate SCSS
    try {
        sass.compileString(text, { syntax: 'scss' });
    } catch (e: any) {
        if (e.span) {
            validationMessage = `${e.message.split('\n')[0]} at line ${e.span.start.line + 1}, col ${e.span.start.column + 1}`;
        } else {
            validationMessage = e.message;
        }
    }

    /* eslint-disable */
    try {
        // Format SCSS (js-beautify's CSS formatter handles SCSS nesting)
        formatted = jsbeautify.css(text, {
            indent_size: 2,
            indent_char: ' ',
            selector_separator_newline: true,
            newline_between_rules: true,
            end_with_newline: false
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format SCSS: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`SCSS has syntax issues but was beautified. First error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('SCSS formatted successfully!');
    }
}

/**
 * Handle LESS formatting and validation
 */
async function handleLESS(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate LESS
    try {
        await less.render(text);
    } catch (e: any) {
        if (e.line) {
            validationMessage = `${e.message} at line ${e.line}, col ${e.column}`;
        } else {
            validationMessage = e.message;
        }
    }

    /* eslint-disable */
    try {
        // Format LESS (js-beautify's CSS formatter handles LESS nesting and variables)
        formatted = jsbeautify.css(text, {
            indent_size: 2,
            indent_char: ' ',
            selector_separator_newline: true,
            newline_between_rules: true,
            end_with_newline: false
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format LESS: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`LESS has syntax issues but was beautified. First error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('LESS formatted successfully!');
    }
}

/**
 * Handle SASS formatting and validation
 */
async function handleSASS(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate SASS
    try {
        sass.compileString(text, { syntax: 'indented' });
    } catch (e: any) {
        if (e.span) {
            validationMessage = `${e.message.split('\n')[0]} at line ${e.span.start.line + 1}, col ${e.span.start.column + 1}`;
        } else {
            validationMessage = e.message;
        }
    }

    try {
        // Format SASS
        formatted = SassFormatter.Format(text, {
            tabSize: 2,
            insertSpaces: true
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format SASS: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`SASS has syntax issues but was beautified. First error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('SASS formatted successfully!');
    }
}

/**
 * Handle XML formatting and validation
 */
async function handleXML(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate XML to find error location
    const result = XMLValidator.validate(text);
    if (result !== true) {
        validationMessage = `${result.err.msg} at line ${result.err.line}, col ${result.err.col}`;
    }

    try {
        // Format XML (xml-formatter is somewhat lenient and will try to fix issues)
        formatted = xmlFormatter(text, {
            indentation: '  ',
            collapseContent: true,
            lineSeparator: '\n'
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format XML: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`XML was invalid but beautified. Error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('XML formatted successfully!');
    }
}

/**
 * Apply the formatted text to the editor
 */
async function applyEdit(editor: vscode.TextEditor, newText: string) {
    const document = editor.document;
    const firstLine = document.lineAt(0);
    const lastLine = document.lineAt(document.lineCount - 1);
    const textRange = new vscode.Range(firstLine.range.start, lastLine.range.end);

    await editor.edit(editBuilder => {
        editBuilder.replace(textRange, newText);
    });
}

/**
 * This method is called when the extension is deactivated
 */
export function deactivate() {}
