import * as vscode from 'vscode';
import { getIndentOptions, runFormatter } from '../utils';
import { formatJSON, formatJSONC } from './json_core';

export async function handleJSON(editor: vscode.TextEditor, text: string) {
    await runFormatter(editor, 'Beautify JSON', () => formatJSON(text, getIndentOptions(editor)));
}

export async function handleJSONC(editor: vscode.TextEditor, text: string) {
    await runFormatter(editor, 'Beautify JSONC', () => formatJSONC(text, getIndentOptions(editor)));
}
