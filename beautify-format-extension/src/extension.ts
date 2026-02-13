import * as vscode from 'vscode';
import xmlFormatter from 'xml-formatter';
import { jsonrepair } from 'jsonrepair';
import { XMLValidator } from 'fast-xml-parser';
import * as jsbeautify from 'js-beautify';
import { HTMLHint } from 'htmlhint';

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
    let formatHTMLCommand = vscode.commands.registerCommand('beautify-format.formatHTML', () => {
        beautify('html');
    });

    context.subscriptions.push(formatJSONCommand);
    context.subscriptions.push(formatXMLCommand);
    context.subscriptions.push(formatHTMLCommand);
}

/**
 * Main beautify function with auto-detection
 */
async function beautify(forcedFormat?: 'json' | 'xml' | 'html') {
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
    } else if (format === 'xml') {
        await handleXML(editor, text);
    } else if (format === 'html') {
        await handleHTML(editor, text);
    } else {
        // If unknown, try JSON first then XML then HTML
        try {
            jsonrepair(text);
            await handleJSON(editor, text);
        } catch (e) {
            const trimmed = text.trim();
            if (trimmed.startsWith('<')) {
                // If it looks like HTML, use handleHTML, otherwise handleXML
                if (trimmed.toLowerCase().startsWith('<!doctype html') ||
                    trimmed.toLowerCase().includes('<html') ||
                    trimmed.toLowerCase().includes('<body') ||
                    trimmed.toLowerCase().includes('<div')) {
                    await handleHTML(editor, text);
                } else {
                    await handleXML(editor, text);
                }
            } else {
                vscode.window.showErrorMessage('Could not detect format (JSON, XML or HTML). Please ensure your file starts with {, < or contains HTML tags');
            }
        }
    }
}

/**
 * Detect format based on language ID or content
 */
function detectFormat(text: string, languageId: string): 'json' | 'xml' | 'html' | 'unknown' {
    const lang = languageId.toLowerCase();
    if (lang === 'json' || lang === 'jsonc') {
        return 'json';
    }
    if (lang === 'xml' || lang === 'xsl') {
        return 'xml';
    }
    if (lang === 'html' || lang === 'htm') {
        return 'html';
    }

    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return 'json';
    }
    if (trimmed.startsWith('<')) {
        const lowerTrimmed = trimmed.toLowerCase();
        if (lowerTrimmed.startsWith('<!doctype html') ||
            lowerTrimmed.includes('<html') ||
            lowerTrimmed.includes('<body') ||
            lowerTrimmed.includes('<div')) {
            return 'html';
        }
        return 'xml';
    }

    return 'unknown';
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
        // Limit to first 3 errors
        validationMessage = errors.slice(0, 3)
            .map(err => `${err.message} at line ${err.line}, col ${err.col}`)
            .join('; ');
    }

    try {
        /* eslint-disable @typescript-eslint/naming-convention */
        const options: jsbeautify.HTMLBeautifyOptions = {
            indent_size: 2,
            indent_char: ' ',
            max_preserve_newlines: 2,
            preserve_newlines: true,
            indent_scripts: 'normal',
            end_with_newline: true,
            wrap_line_length: 120,
            indent_inner_html: true,
            indent_empty_lines: false
        };
        /* eslint-enable @typescript-eslint/naming-convention */
        formatted = jsbeautify.html(text, options);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format HTML: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`HTML has issues but was beautified. Errors: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('HTML formatted successfully!');
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
