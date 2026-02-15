import * as vscode from 'vscode';
import xmlFormatter from 'xml-formatter';
import { jsonrepair } from 'jsonrepair';
import { XMLValidator } from 'fast-xml-parser';
import * as jsbeautify from 'js-beautify';
import { HTMLHint } from 'htmlhint';
import * as css from 'css';
import * as sass from 'sass';
import { SassFormatter } from 'sass-formatter';
import * as less from 'less';
import * as acorn from 'acorn';
import * as ts from 'typescript';
import * as svelte from 'svelte/compiler';
import * as phpParser from 'php-parser';
import { parse, ParseError } from 'jsonc-parser';
import * as YAML from 'yaml';
import * as smolToml from 'smol-toml';
import * as ini from 'ini';

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
 * Main beautify function with auto-detection
 */
async function beautify(forcedFormat?: 'json' | 'jsonc' | 'xml' | 'html' | 'css' | 'scss' | 'sass' | 'less' | 'javascript' | 'typescript' | 'jsx' | 'tsx' | 'vue' | 'svelte' | 'php' | 'yaml' | 'toml' | 'ini') {
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
            } else if (trimmed.startsWith('[') || /^[a-z0-9_-]+\s*[=:]\s*/m.test(trimmed) || trimmed.startsWith(';')) {
                // Heuristic for INI vs TOML
                if (trimmed.includes(';') || trimmed.includes(':')) {
                    await handleINI(editor, text);
                } else {
                    await handleTOML(editor, text);
                }
            } else {
                vscode.window.showErrorMessage('Could not detect format (JSON, XML, HTML, CSS, YAML, TOML or INI). Please ensure your file starts with {, [, < or has key: value pairs');
            }
        }
    }
}

/**
 * Detect format based on language ID or content
 */
function detectFormat(text: string, languageId: string): 'json' | 'jsonc' | 'xml' | 'html' | 'css' | 'scss' | 'sass' | 'less' | 'javascript' | 'typescript' | 'jsx' | 'tsx' | 'vue' | 'svelte' | 'php' | 'yaml' | 'toml' | 'ini' | 'unknown' {
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

    // INI heuristic
    if (
        trimmed.startsWith(';') ||
        (/^[a-z0-9_-]+\s*[:]\s*.+/im.test(trimmed) && !trimmed.includes('{'))
    ) {
        return 'ini';
    }

    // TOML or INI (both use [section] and key=value)
    if (
        (trimmed.startsWith('[') && trimmed.includes(']')) ||
        (/^[a-z0-9_-]+\s*=\s*.+/im.test(trimmed) && !trimmed.includes('{'))
    ) {
        // If it has a semicolon, it's likely INI
        if (trimmed.includes(';')) {
            return 'ini';
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
