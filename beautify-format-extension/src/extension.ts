import * as vscode from 'vscode';
import { detectFormat } from './detector';
import * as Web from './formatters/web';
import * as JsTs from './formatters/js_ts';

type SupportedFormat = 'json' | 'jsonc' | 'xml';

export function activate(context: vscode.ExtensionContext) {
    const register = (cmd: string, format?: SupportedFormat) => {
        context.subscriptions.push(vscode.commands.registerCommand(cmd, () => beautify(format)));
    };

    register('beautify-format.beautify');
    register('beautify-format.formatJSON', 'json');
    register('beautify-format.formatJSONC', 'jsonc');
    register('beautify-format.formatXML', 'xml');
}

export async function beautify(forcedFormat?: SupportedFormat) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
    }

    const text = editor.document.getText();
    if (text.trim().length === 0) {
        vscode.window.showWarningMessage('Document is empty');
        return;
    }

    const format = forcedFormat || detectFormat(text, editor.document.languageId);

    if (format === 'xml') {
        await Web.handleXML(editor, text);
    } else if (format === 'json') {
        await JsTs.handleJSON(editor, text);
    } else if (format === 'jsonc') {
        await JsTs.handleJSONC(editor, text);
    } else {
        vscode.window.showErrorMessage('Beautify Format supports JSON, JSONC and XML. Could not detect any of them in this file.');
    }
}

export { detectFormat };

export function deactivate() {}
