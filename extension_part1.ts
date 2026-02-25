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
import * as prettier from 'prettier';

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
    let formatHTMLCommand = vscode.commands.registerCommand('beautify-format.formatHTML', () => {
        beautify('html');
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
    context.subscriptions.push(formatHTMLCommand);
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

    let formatMarkdownCommand = vscode.commands.registerCommand('beautify-format.formatMarkdown', () => {
        beautify('markdown');
    });
    context.subscriptions.push(formatMarkdownCommand);

    let formatLaTeXCommand = vscode.commands.registerCommand('beautify-format.formatLaTeX', () => {
        beautify('latex');
    });
    context.subscriptions.push(formatLaTeXCommand);

    let formatMDXCommand = vscode.commands.registerCommand('beautify-format.formatMDX', () => {
        beautify('mdx');
    });
    context.subscriptions.push(formatMDXCommand);

    let formatLogCommand = vscode.commands.registerCommand('beautify-format.formatLog', () => {
        beautify('log');
    });
    context.subscriptions.push(formatLogCommand);

    let formatHandlebarsCommand = vscode.commands.registerCommand('beautify-format.formatHandlebars', () => {
        beautify('handlebars');
    });
    context.subscriptions.push(formatHandlebarsCommand);

    let formatTwigCommand = vscode.commands.registerCommand('beautify-format.formatTwig', () => {
        beautify('twig');
    });
    context.subscriptions.push(formatTwigCommand);

    let formatLiquidCommand = vscode.commands.registerCommand('beautify-format.formatLiquid', () => {
        beautify('liquid');
    });
    context.subscriptions.push(formatLiquidCommand);

    let formatSVGCommand = vscode.commands.registerCommand('beautify-format.formatSVG', () => {
        beautify('svg');
    });
    context.subscriptions.push(formatSVGCommand);

    let formatIPYNBCommand = vscode.commands.registerCommand('beautify-format.formatIPYNB', () => {
        beautify('ipynb');
    });
    context.subscriptions.push(formatIPYNBCommand);

    let formatGitConfigCommand = vscode.commands.registerCommand('beautify-format.formatGitConfig', () => {
        beautify('gitconfig');
    });
    context.subscriptions.push(formatGitConfigCommand);

    let formatEditorConfigCommand = vscode.commands.registerCommand('beautify-format.formatEditorConfig', () => {
        beautify('editorconfig');
    });
    context.subscriptions.push(formatEditorConfigCommand);

    let formatAstroCommand = vscode.commands.registerCommand('beautify-format.formatAstro', () => {
        beautify('astro');
    });
    context.subscriptions.push(formatAstroCommand);
}

/**
 * Handle Jupyter Notebook (.ipynb) formatting and validation
 */
async function handleIPYNB(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate IPYNB
    validationMessage = validateIPYNB(text);

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

                    const formattedSource = formatPythonCore(source);

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

/**
 * Handle EditorConfig formatting and validation
 */
async function handleEditorConfig(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate EditorConfig
    validationMessage = validateEditorConfig(text);

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let inSection = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '') {
                // Only push empty line if the previous one wasn't empty
                if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                    formattedLines.push('');
                }
                continue;
            }

            // Comments
            if (trimmed.startsWith('#') || trimmed.startsWith(';')) {
                // Comments are usually aligned with the content
                const indent = inSection ? '  ' : '';
                formattedLines.push(indent + trimmed);
                continue;
            }

            // Sections [section]
            if (trimmed.startsWith('[')) {
                // Ensure empty line before section if not at start
                if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                    formattedLines.push('');
                }
                formattedLines.push(trimmed);
                inSection = true;
                continue;
            }

            // Key-Value pairs: key = value
            const equalIndex = trimmed.indexOf('=');
            if (equalIndex !== -1) {
                const key = trimmed.substring(0, equalIndex).trim();
                const value = trimmed.substring(equalIndex + 1).trim();
                // Indent properties by 2 spaces if inside a section
                const indent = inSection ? '  ' : '';
                formattedLines.push(`${indent}${key} = ${value}`);
                continue;
            }

            // Fallback
            const indent = inSection ? '  ' : '';
            formattedLines.push(indent + trimmed);
        }
        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format EditorConfig: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`EditorConfig has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('EditorConfig formatted successfully!');
    }
}

/**
 * Custom resilient EditorConfig validator
 */
function validateEditorConfig(text: string): string | undefined {
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '' || line.startsWith('#') || line.startsWith(';')) continue;

        // Check for sections
        if (line.startsWith('[')) {
            if (!line.endsWith(']')) {
                // Check if it has a comment at the end
                // [section] # comment
                const commentIdx = Math.min(
                    line.indexOf('#') === -1 ? Infinity : line.indexOf('#'),
                    line.indexOf(';') === -1 ? Infinity : line.indexOf(';')
                );

                if (commentIdx !== Infinity) {
                    const beforeComment = line.substring(0, commentIdx).trim();
                    if (!beforeComment.endsWith(']')) {
                         return `Unclosed section header at line ${i + 1}`;
                    }
                } else {
                    return `Unclosed section header at line ${i + 1}`;
                }
            }
            continue;
        }

        // Check for key = value
        if (line.indexOf('=') === -1) {
             return `Invalid property definition at line ${i + 1} (missing '=')`;
        }
    }
    return undefined;
}

/**
 * Handle MDX formatting and validation
 */
async function handleMDX(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate MDX
    validationMessage = validateMDX(text);

    // Resilient formatting logic
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
async function handleLaTeX(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate LaTeX
    validationMessage = validateLaTeX(text);

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '') {
                formattedLines.push('');
                continue;
            }

            // Indentation adjustment for closing environments at the START of the line
            let currentLineIndent = indentLevel;
            if (trimmed.startsWith('\\end{')) {
                currentLineIndent = Math.max(0, indentLevel - 1);
            }

            // Apply indentation (standard 4 spaces for LaTeX in many editors)
            formattedLines.push('    '.repeat(Math.max(0, currentLineIndent)) + trimmed);

            // Calculate indent for NEXT line
            let lineWithoutComment = trimmed;
            const commentIdx = trimmed.indexOf('%');
            if (commentIdx !== -1) {
                // Simple check for escaped %
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

            const beginMatches = lineWithoutComment.match(/\\begin\{[^}]+\}/g) || [];
            const endMatches = lineWithoutComment.match(/\\end\{[^}]+\}/g) || [];
            const netChange = beginMatches.length - endMatches.length;

            indentLevel = Math.max(0, indentLevel + netChange);
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
 * Handle Markdown formatting and validation
 */
async function handleMarkdown(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Markdown
    validationMessage = validateMarkdown(text);

    // Resilient formatting logic
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
                // Ensure blank line after code block if it just ended
                if (!inCodeBlock && i < lines.length - 1 && lines[i + 1].trim() !== '') {
                    // We'll handle this in the next iteration or by peeking,
                    // but for simplicity, let's just push a blank line if next is not blank.
                    // Actually, let's just push it now.
                }
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
