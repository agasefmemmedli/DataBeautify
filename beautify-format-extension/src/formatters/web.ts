import * as vscode from 'vscode';
import { getIndentOptions, runFormatter } from '../utils';
import { formatXML } from './xml_core';

export async function handleXML(editor: vscode.TextEditor, text: string) {
    const config = vscode.workspace.getConfiguration('beautifyFormat', editor.document.uri);
    const sortAttributes = config.get<boolean>('xml.sortAttributes', false);
    await runFormatter(editor, 'Beautify XML', () => formatXML(text, { ...getIndentOptions(editor), sortAttributes }));
}
