import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Extension Test Suite - JSX', () => {
    test('Format test.jsx using beautify-format.beautify', async () => {
        // Open the file
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            assert.fail('No workspace folder found');
        }

        const fileUri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, 'test.jsx'));
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

    test('Format test.complex.jsx with Deep Formatting', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            assert.fail('No workspace folder found');
        }

        const fileUri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, 'test.complex.jsx'));
        const document = await vscode.workspace.openTextDocument(fileUri);
        const editor = await vscode.window.showTextDocument(document);

        // Execute command
        await vscode.commands.executeCommand('beautify-format.beautify');

        const text = document.getText();

        // Check for specific deep formatting rules

        // 1. Double quotes for attributes (jsxSingleQuote: false)
        assert.ok(text.includes('className="complex-container"'), 'Should use double quotes for attributes');

        // 2. Bracket spacing (bracketSpacing: true)
        assert.ok(text.includes('import React, { useState } from'), 'Should have spaces in import braces');

        // 3. Arrow parens (arrowParens: 'always')
        assert.ok(text.includes('(item) =>'), 'Should have parens around single arrow function argument');

        // 4. Prop alignment (multi-line if needed, but here simple checks)
        // We check if it didn't break the structure
        assert.ok(text.includes('<ul className="item-list">'), 'Should keep structure intact');

        // 5. Ensure no syntax errors introduced
        assert.ok(!text.includes('error'), 'Should not have error text');
    });
});
