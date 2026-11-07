// Registers Beautify Format as a regular VS Code formatter, so it works with
// Format Document (Shift+Alt+F), Format Selection and Format on Save.
import * as vscode from 'vscode';
import { detectFormat, FORMAT_LABELS, formatFragment, formatText } from './engine';
import { FormatError, FormatResult } from './formatters/result';
import { recordSuccess } from './rating';
import { getSettings, repairedMessage } from './utils';

export const FORMATTER_LANGUAGES = [
    'json', 'jsonc', 'xml', 'xsl', 'sql', 'plsql', 'oraclesql', 'pgsql', 'mysql', 'tsql', 'mssql', 'sqlite',
];

// Last message shown per document: repeated errors (e.g. on every save) go to the status bar instead
const lastMessage = new Map<string, string>();

function notify(document: vscode.TextDocument, message: string, action?: () => void) {
    const key = document.uri.toString();
    if (lastMessage.get(key) === message) {
        vscode.window.setStatusBarMessage(message, 5000);
        return;
    }
    lastMessage.set(key, message);
    if (action) {
        vscode.window.showWarningMessage(message, 'Review Fix').then(choice => { if (choice) action(); });
    } else {
        vscode.window.showWarningMessage(message);
    }
}

function provide(
    context: vscode.ExtensionContext,
    document: vscode.TextDocument,
    options: vscode.FormattingOptions,
    range?: vscode.Range,
): vscode.TextEdit[] {
    const format = detectFormat(document.getText(), document.languageId);
    if (format === 'unknown') return [];
    const label = FORMAT_LABELS[format];
    const target = range ?? new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
    const text = document.getText(target);
    const indent = { tabSize: options.tabSize, insertSpaces: options.insertSpaces };

    let result: FormatResult;
    try {
        result = range
            ? formatFragment(format, text, indent, document.languageId, getSettings(document))
            : formatText(format, text, indent, document.languageId, getSettings(document));
    } catch (e: any) {
        const message = e instanceof FormatError ? e.message : `Unexpected error: ${e?.message ?? e}. The file was not changed.`;
        notify(document, `${label}: ${message}`);
        return [];
    }

    // A guessed fix is never applied silently (e.g. on save): offer the confirmation dialog instead
    if (result.needsConfirmation) {
        notify(document, `${label}: the file has a syntax error (${result.issue}). The fix needs your review, the file was not changed.`,
            range ? undefined : () => vscode.commands.executeCommand('beautify-format.beautify'));
        return [];
    }
    if (result.repaired) {
        notify(document, repairedMessage(label, result));
    }

    lastMessage.delete(document.uri.toString());
    if (result.text === text) return [];
    recordSuccess(context);
    return [vscode.TextEdit.replace(target, result.text)];
}

export function registerFormatter(context: vscode.ExtensionContext) {
    const selector = FORMATTER_LANGUAGES.map(language => ({ language }));

    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(selector, {
            provideDocumentFormattingEdits: (document, options) => provide(context, document, options),
        }),
        vscode.languages.registerDocumentRangeFormattingEditProvider(selector, {
            provideDocumentRangeFormattingEdits: (document, range, options) => {
                // Whole lines only, so indentation can be kept
                const full = new vscode.Range(range.start.line, 0, range.end.line, document.lineAt(range.end.line).text.length);
                return provide(context, document, options, full);
            },
        }),
    );
}
