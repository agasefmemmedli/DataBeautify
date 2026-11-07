import * as vscode from 'vscode';
import { getIndentOptions, runFormatter } from '../utils';
import { KeywordCase } from './plsql_formatter';
import { formatSQL, resolveDialect } from './sql_core';

export async function handleSQL(editor: vscode.TextEditor, text: string) {
    const config = vscode.workspace.getConfiguration('beautifyFormat', editor.document.uri);
    const dialect = resolveDialect(config.get<string>('sql.dialect', 'auto'), editor.document.languageId, text);
    const keywordCase = config.get<KeywordCase>('sql.keywordCase', 'preserve');
    await runFormatter(editor, 'Beautify SQL', () => formatSQL(text, { ...getIndentOptions(editor), dialect, keywordCase }));
}
