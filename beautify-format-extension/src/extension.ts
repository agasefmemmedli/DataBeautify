import * as vscode from 'vscode';
import { detectFormat, FORMAT_LABELS, formatText } from './engine';
import { registerFormatter } from './provider';
import { recordSuccess } from './rating';
import { getIndentOptions, getSettings, runFormatter } from './utils';

type SupportedFormat = 'json' | 'jsonc' | 'xml' | 'sql';

export function activate(context: vscode.ExtensionContext) {
    const register = (cmd: string, format?: SupportedFormat) => {
        context.subscriptions.push(vscode.commands.registerCommand(cmd, () => beautify(context, format)));
    };

    register('beautify-format.beautify');
    register('beautify-format.formatJSON', 'json');
    register('beautify-format.formatJSONC', 'jsonc');
    register('beautify-format.formatXML', 'xml');
    register('beautify-format.formatSQL', 'sql');

    registerFormatter(context);
}

export async function beautify(context: vscode.ExtensionContext, forcedFormat?: SupportedFormat) {
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
    if (format === 'unknown') {
        vscode.window.showErrorMessage('Beautify Format supports JSON, JSONC, XML, SQL and PL/SQL. Could not detect any of them in this file.');
        return;
    }

    const formatted = await runFormatter(editor, FORMAT_LABELS[format], () =>
        formatText(format, text, getIndentOptions(editor), editor.document.languageId, getSettings(editor.document)));
    if (formatted) recordSuccess(context);
}

export { detectFormat };

export function deactivate() {}
