import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Extension Test Suite - JSON', () => {
    test('Format test.json using beautify-format.beautify', async () => {
        // Open the file
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            assert.fail('No workspace folder found');
        }

        const fileUri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, 'test.json'));
        const document = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(document);

        // Wait a bit for activation (sometimes needed in test environment)
        // await new Promise(resolve => setTimeout(resolve, 1000));

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
