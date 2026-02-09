import * as vscode from 'vscode';
import xmlFormatter from 'xml-formatter';

/**
 * This method is called when the extension is activated
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Beautify Format extension is now active!');

    // Register JSON formatter command
    let formatJSONCommand = vscode.commands.registerCommand('beautify-format.formatJSON', () => {
        formatJSON();
    });

    // Register XML formatter command
    let formatXMLCommand = vscode.commands.registerCommand('beautify-format.formatXML', () => {
        formatXML();
    });

    context.subscriptions.push(formatJSONCommand);
    context.subscriptions.push(formatXMLCommand);
}

/**
 * Format JSON in the active editor
 */
function formatJSON() {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
    }

    const document = editor.document;
    const text = document.getText();

    try {
        // Parse and stringify JSON with indentation
        const parsed = JSON.parse(text);
        const formatted = JSON.stringify(parsed, null, 2);

        // Replace the entire document with formatted JSON
        editor.edit(editBuilder => {
            const firstLine = document.lineAt(0);
            const lastLine = document.lineAt(document.lineCount - 1);
            const textRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
            editBuilder.replace(textRange, formatted);
        });

        vscode.window.showInformationMessage('JSON formatted successfully!');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to format JSON: ${error}`);
    }
}

/**
 * Format XML in the active editor
 */
function formatXML() {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
    }

    const document = editor.document;
    const text = document.getText();

    try {
        // Format XML with proper indentation
        const formatted = xmlFormatter(text, {
            indentation: '  ',
            collapseContent: true,
            lineSeparator: '\n'
        });

        // Replace the entire document with formatted XML
        editor.edit(editBuilder => {
            const firstLine = document.lineAt(0);
            const lastLine = document.lineAt(document.lineCount - 1);
            const textRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
            editBuilder.replace(textRange, formatted);
        });

        vscode.window.showInformationMessage('XML formatted successfully!');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to format XML: ${error}`);
    }
}

/**
 * This method is called when the extension is deactivated
 */
export function deactivate() {}
