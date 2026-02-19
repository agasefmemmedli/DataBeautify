import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Extension Test Suite - TOML', () => {
    test('Format test.toml using beautify-format.beautify', async () => {
        // Open the file
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            assert.fail('No workspace folder found');
        }

        const fileUri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, 'test.toml'));
        const document = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(document);

        // Execute command
        try {
            await vscode.commands.executeCommand('beautify-format.beautify');
            // If we get here, the command exists and ran without throwing
            assert.ok(true);
        } catch (error: any) {
            assert.fail(`Command failed: ${error.message}`);
        }
    });

    test('Deep Format test.complex.toml', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            assert.fail('No workspace folder found');
        }

        const fileUri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, 'test.complex.toml'));
        const document = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(document);

        // Wait for potential extension activation
        // await new Promise(resolve => setTimeout(resolve, 500));

        // Get original text
        const originalText = document.getText();

        // Execute command
        await vscode.commands.executeCommand('beautify-format.beautify');

        // Allow time for edits to apply
        await new Promise(resolve => setTimeout(resolve, 1500));

        const newText = document.getText();

        // Assert that text has changed (formatted)
        // If the file was already perfect, this might fail, but test.complex.toml was written with arbitrary formatting.
        assert.notStrictEqual(newText, originalText, 'Document should be formatted');

        // Check for specific deep formatting traits
        assert.ok(newText.includes('[package]'), 'Should contain [package] table');

        // Check if inline tables have correct spacing (bracketSpacing: true)
        // Original: struct = { x = 1, y = { z = 2, w = [3, 4] } }
        // Prettier usually adds spaces: { x = 1, ... }
        assert.ok(newText.includes('{ x = 1'), 'Should have spacing in inline tables');
    });
});
