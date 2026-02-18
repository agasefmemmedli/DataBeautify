import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Extension Test Suite - Svelte', () => {
    test('Format test.complex.svelte using beautify-format.beautify', async () => {
        // Open the file
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            assert.fail('No workspace folder found');
        }

        const fileUri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, 'test.complex.svelte'));
        const document = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(document);

        // Get original text
        const originalText = document.getText();

        // Wait a bit for activation (sometimes needed in test environment)
        // await new Promise(resolve => setTimeout(resolve, 1000));

        // Execute command
        try {
            await vscode.commands.executeCommand('beautify-format.beautify');

            // Wait for formatting to apply (if needed, but await executeCommand should handle it if it returns a promise)
            // However, the command implementation calls applyEdit which is async, so we might need a small delay or loop if executeCommand doesn't await the handler.
            // But extension usually awaits the handler.

            const newText = document.getText();
            assert.notStrictEqual(originalText, newText, 'File should be formatted (content changed)');

            // Verify basic formatting rules (e.g. indentation)
            // Prettier Svelte plugin indents script and style content if 'svelteIndentScriptAndStyle: true' is set.
            // We set it to true in the implementation.

            // Check for indented script content
            assert.ok(newText.includes('  export let name'), 'Script content should be indented');

            // Check for indented style content
            assert.ok(newText.includes('  h1 {'), 'Style content should be indented');

        } catch (error: any) {
            assert.fail(`Command failed: ${error.message}`);
        }
    });
});
