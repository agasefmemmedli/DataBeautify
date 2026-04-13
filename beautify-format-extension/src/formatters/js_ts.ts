import * as vscode from 'vscode';
import { applyEdit } from '../utils';
import { formatJSONDeep } from './json_deep_formatter';

/**
 * Handle JSON formatting and validation
 */
export async function handleJSON(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Fast check for syntax error to place cursor
    try {
        JSON.parse(text);
    } catch (e: any) {
        // e.g., "Unexpected token } in JSON at position 24"
        const match = /position (\d+)/.exec(e.message);
        if (match) {
            const pos = parseInt(match[1]);
            const lines = text.slice(0, pos).split('\n');
            const line = lines.length;
            const col = lines[lines.length - 1].length + 1;
            validationMessage = `${e.message} (Line ${line}, Col ${col})`;
        } else {
            validationMessage = e.message;
        }
    }

    try {
        // Get indentation options from editor
        const tabSize = editor.options.tabSize;
        const insertSpaces = editor.options.insertSpaces;

        // Try Deep Formatting
        formatted = formatJSONDeep(text, {
            tabSize: Number(tabSize) || 2,
            insertSpaces: insertSpaces as boolean,
            isJSONC: false
        });

        // Apply formatting
        await applyEdit(editor, formatted);
    } catch (e: any) {
        // Deep formatting failed, attempt auto-fix with jsonrepair
        console.warn('JSON Deep Formatting failed:', e);
        try {
            const { jsonrepair } = require('jsonrepair');
            const repaired = jsonrepair(text);

            // Re-run deep formatter on repaired text to ensure style
            const tabSize = editor.options.tabSize;
            const insertSpaces = editor.options.insertSpaces;
            formatted = formatJSONDeep(repaired, {
                tabSize: Number(tabSize) || 2,
                insertSpaces: insertSpaces as boolean,
                isJSONC: false
            });

            await applyEdit(editor, formatted);
        } catch (repairError) {
             vscode.window.showErrorMessage('JSON Formatting Failed: ' + e.message + (validationMessage ? ` [Syntax Error: ${validationMessage}]` : ''));
        }
    }
}

/**
 * Handle JSONC (JSON with Comments) formatting
 */
export async function handleJSONC(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    try {
        // Get indentation options from editor
        const tabSize = editor.options.tabSize;
        const insertSpaces = editor.options.insertSpaces;

        // Try Deep Formatting
        formatted = formatJSONDeep(text, {
            tabSize: Number(tabSize) || 2,
            insertSpaces: insertSpaces as boolean,
            isJSONC: true
        });

        // Apply formatting
        await applyEdit(editor, formatted);
    } catch (e: any) {
        console.warn('JSONC Deep Formatting failed:', e);
        vscode.window.showErrorMessage('JSONC Formatting Failed: ' + e.message);
    }
}
