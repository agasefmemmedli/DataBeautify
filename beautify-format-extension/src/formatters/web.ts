import * as vscode from 'vscode';
import { applyEdit } from '../utils';
import { formatXMLDeep } from './xml_deep_formatter';

/**
 * Handle XML formatting and validation
 */
export async function handleXML(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Lazy load dependencies
    const { XMLValidator } = require('fast-xml-parser');
    const xmlFormatter = require('xml-formatter');

    // Validate XML to find error location
    const result = XMLValidator.validate(text);
    if (result !== true) {
        validationMessage = `${result.err.msg} at line ${result.err.line}, col ${result.err.col}`;
    }

    try {
        // Get indentation options from editor
        const tabSize = editor.options.tabSize;
        const insertSpaces = editor.options.insertSpaces;

        // Try Deep Formatting first
        formatted = formatXMLDeep(text, {
            tabSize: Number(tabSize) || 2,
            insertSpaces: insertSpaces as boolean,
            sortAttributes: true,
            spaceBeforeSelfClose: true
        });

        // Apply formatting
        await applyEdit(editor, formatted);
    } catch (e: any) {
        console.warn('XML Deep Formatting failed, falling back to xml-formatter:', e);
        try {
            // Get indentation string
            const tabSize = editor.options.tabSize;
            const insertSpaces = editor.options.insertSpaces;
            const indent = insertSpaces ? ' '.repeat(tabSize as number) : '\t';

            formatted = xmlFormatter(text, {
                indentation: indent,
                collapseContent: true,
                lineSeparator: '\n'
            });
            await applyEdit(editor, formatted);
        } catch (fallbackError: any) {
             vscode.window.showErrorMessage('XML Formatting Failed: ' + fallbackError.message + (validationMessage ? ` [Validation: ${validationMessage}]` : ''));
        }
    }
}
