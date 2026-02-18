import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('Extension Test Suite - JavaScript Deep Formatting', () => {
    test('Format test.js with Deep Formatting rules', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            assert.fail('No workspace folder found');
        }

        const filePath = path.join(workspaceFolder.uri.fsPath, 'test.js');
        const brokenContent = `import { someUtility } from './utils';
import React, { useState, useEffect } from 'react';

const MyComponent = ({ prop1, prop2 }) => {
const [state, setState] = useState(null);

useEffect(() => {
    // some effect
    if(true){ console.log("hello"); }
}, []);

    return (
        <div className="container">
<h1>Hello {prop1}</h1>
<ul>
        {['a','b','c'].map((item) => <li key={item}>{item}</li>)}
</ul>
        </div>
    );
};`;
        fs.writeFileSync(filePath, brokenContent);

        const fileUri = vscode.Uri.file(filePath);
        const document = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(document);

        // Wait for extension activation
        // await new Promise(resolve => setTimeout(resolve, 1000));

        // Execute command
        await vscode.commands.executeCommand('beautify-format.beautify');

        // Allow time for edits to apply
        // await new Promise(resolve => setTimeout(resolve, 500));

        const text = document.getText();

        // 1. Check Import Sorting
        const reactIdx = text.indexOf("from 'react'");
        const utilsIdx = text.indexOf("from './utils'");
        assert.ok(reactIdx !== -1, 'React import missing');
        assert.ok(utilsIdx !== -1, 'Utils import missing');
        assert.ok(reactIdx < utilsIdx, 'Imports should be sorted: external (react) before relative (./utils)');

        // 2. Check Indentation and Spacing
        // Expect 2 spaces indentation for function body
        assert.ok(text.includes('  const [state, setState] = useState(null);'), 'Function body should be indented with 2 spaces');

        // 3. Check Deep Formatting (Bracing & Wrapping)
        // if (true) {
        //   console.log("hello");
        // }
        // Note: brace_style: 'collapse,preserve-inline' might keep it on one line if short?
        // But we have 'space_before_conditional: true'.
        assert.ok(text.includes('if (true) {'), 'Should have space before conditional brace');

        // 4. Check JSX Formatting
        // <div className="container">
        //   <h1>...
        assert.ok(text.includes('    <h1>Hello {prop1}</h1>'), 'JSX children should be indented (4 spaces total: 2 for function + 2 for div)');
        assert.ok(text.includes('    <ul>'), 'JSX UL should be indented');
    });
});
