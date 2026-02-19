import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Extension Test Suite - Properties', () => {
    test('Format test.properties using beautify-format.beautify', async () => {
        // Open the file
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            assert.fail('No workspace folder found');
        }

        const fileUri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, 'test.properties'));
        const document = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(document);

        // Wait for activation
        const ext = vscode.extensions.getExtension('DataBeautify.beautify-format');
        if (ext) {
            await ext.activate();
        }

        // Execute command
        try {
            await vscode.commands.executeCommand('beautify-format.beautify');
            // If we get here, the command exists and ran without throwing
            assert.ok(true);
        } catch (error: any) {
            assert.fail(`Command failed: ${error.message}`);
        }
    });
});
