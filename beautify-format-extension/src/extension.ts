import * as vscode from 'vscode';
import { detectFormat } from './detector';
import { detectDelimiter } from './utils';

// Import formatters
import * as Web from './formatters/web';
import * as JsTs from './formatters/js_ts';

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

    const register = (cmd: string, format: string) => {
        context.subscriptions.push(vscode.commands.registerCommand(cmd, () => beautify(format as any)));
    };

    // Web
    register('beautify-format.formatXML', 'xml');

    // JS/TS
    register('beautify-format.formatJSON', 'json');
    register('beautify-format.formatJSONC', 'jsonc');
}

export async function beautify(forcedFormat?: 'json' | 'jsonc' | 'xml') {
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

    // Web
    if (format === 'xml') await Web.handleXML(editor, text);

    // JS/TS
    else if (format === 'json') await JsTs.handleJSON(editor, text);
    else if (format === 'jsonc') await JsTs.handleJSONC(editor, text);

    else {
        // If unknown, try JSON first then XML
        try {
            const { jsonrepair } = require('jsonrepair');
            jsonrepair(text);
            await JsTs.handleJSON(editor, text);
        } catch (e) {
            const trimmed = text.trim();
            if (trimmed.startsWith('<')) {
                await Web.handleXML(editor, text);
            } else {
                vscode.window.showErrorMessage('Could not detect format (JSON, XML). Please ensure your file starts with {, [, <');
            }
        }
    }
}

// Re-export detectFormat for compatibility
export { detectFormat };

/**
 * This method is called when the extension is deactivated
 */
export function deactivate() {}
