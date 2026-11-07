import * as vscode from 'vscode';
import { Settings } from './engine';
import { KeywordCase } from './formatters/plsql_formatter';
import { FormatError, FormatResult, IndentOptions } from './formatters/result';

/**
 * Replace the whole document with the formatted text
 */
export async function applyEdit(editor: vscode.TextEditor, newText: string) {
    const document = editor.document;
    const firstLine = document.lineAt(0);
    const lastLine = document.lineAt(document.lineCount - 1);
    const textRange = new vscode.Range(firstLine.range.start, lastLine.range.end);

    await editor.edit(editBuilder => {
        editBuilder.replace(textRange, newText);
    });
}

export function getIndentOptions(editor: vscode.TextEditor): IndentOptions {
    return {
        tabSize: Number(editor.options.tabSize) || 2,
        insertSpaces: editor.options.insertSpaces !== false,
    };
}

export function getSettings(document: vscode.TextDocument): Settings {
    const config = vscode.workspace.getConfiguration('beautifyFormat', document.uri);
    return {
        sortAttributes: config.get<boolean>('xml.sortAttributes', false),
        sqlDialect: config.get<string>('sql.dialect', 'auto'),
        sqlKeywordCase: config.get<KeywordCase>('sql.keywordCase', 'preserve'),
    };
}

/**
 * Ask before applying a fix that may change values. "Preview" opens a diff and applies nothing.
 */
async function confirmFix(editor: vscode.TextEditor, label: string, result: FormatResult): Promise<boolean> {
    const apply = 'Apply Fix';
    const preview = 'Preview';
    const comments = result.commentsRemoved ? ' Comments will be removed.' : '';
    const choice = await vscode.window.showWarningMessage(
        `${label}: the file has a syntax error (${result.issue}).`,
        { modal: true, detail: `The automatic fix is a guess and may change values.${comments} Check it before applying.` },
        apply,
        preview
    );

    if (choice === preview) {
        const fixed = await vscode.workspace.openTextDocument({ content: result.text, language: editor.document.languageId });
        await vscode.commands.executeCommand('vscode.diff', editor.document.uri, fixed.uri, `${label}: original ↔ suggested fix`);
    }
    return choice === apply;
}

export function repairedMessage(label: string, result: FormatResult): string {
    const comments = result.commentsRemoved ? ' Comments were removed because JSON does not allow them.' : '';
    return `${label}: the file had a syntax error (${result.issue}) and was auto-fixed.${comments} Press Ctrl+Z to undo.`;
}

/**
 * Run a formatter and apply its result. Nothing is written if the formatter
 * cannot produce a safe result; auto-fixes are always reported to the user.
 * Returns true when the document was changed.
 */
export async function runFormatter(editor: vscode.TextEditor, label: string, format: () => FormatResult): Promise<boolean> {
    let result: FormatResult;
    try {
        result = format();
    } catch (e: any) {
        const message = e instanceof FormatError ? e.message : `Unexpected error: ${e?.message ?? e}. The file was not changed.`;
        vscode.window.showErrorMessage(`${label}: ${message}`);
        return false;
    }

    if (result.needsConfirmation && !(await confirmFix(editor, label, result))) {
        return false;
    }

    const changed = result.text !== editor.document.getText();
    if (changed) {
        await applyEdit(editor, result.text);
    }

    if (result.repaired && !result.needsConfirmation) {
        vscode.window.showWarningMessage(repairedMessage(label, result));
    }
    return changed;
}
