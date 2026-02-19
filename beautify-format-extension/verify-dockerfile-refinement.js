"use strict";
const fs = require('fs');
const path = require('path');

// Mock VS Code
const mockVscode = {
    window: {
        activeTextEditor: undefined,
        showInformationMessage: (msg) => console.log('INFO:', msg),
        showErrorMessage: (msg) => console.log('ERROR:', msg),
        showWarningMessage: (msg) => console.log('WARN:', msg),
    },
    Range: class { constructor(start, end) { this.start = start; this.end = end; } },
    Position: class { constructor(line, character) { this.line = line; this.character = character; } },
    commands: { registerCommand: () => ({ dispose: () => { } }) },
    workspace: { applyEdit: async () => true, getConfiguration: () => ({ get: (key, defaultValue) => defaultValue }) },
    WorkspaceEdit: class { replace(uri, range, newText) { } }
};
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'vscode') return mockVscode;
    return originalRequire.apply(this, arguments);
};

async function runTest() {
    let beautify;
    try {
        const ext = require('./out/extension');
        beautify = ext.beautify;
    } catch (e) {
        console.error("Could not load extension. Make sure to run 'npm run compile' first.");
        console.error(e);
        process.exit(1);
    }

    const testFile = 'test.deep2.dockerfile';
    const filePath = path.join(__dirname, testFile);
    const content = fs.readFileSync(filePath, 'utf8');

    let formattedText = '';
    const mockEditor = {
        options: { tabSize: 4, insertSpaces: true },
        document: {
            getText: () => content,
            lineCount: content.split('\n').length,
            languageId: 'dockerfile',
            uri: { fsPath: filePath },
            lineAt: (line) => {
                const lines = content.split('\n');
                const text = lines[line] || '';
                return { text: text, range: {}, rangeIncludingLineBreak: {}, lineNumber: line, isEmptyOrWhitespace: text.trim().length === 0 };
            }
        },
        edit: async (callback) => {
            const eb = { replace: (range, text) => { formattedText = text; } };
            callback(eb);
            return true;
        }
    };
    mockVscode.window.activeTextEditor = mockEditor;

    await beautify('dockerfile');

    // Check CMD quote replacement
    const lines = formattedText.split('\n');
    const cmdLine1 = lines.find(l => l.includes('CMD ["npm", "start"]'));
    if (cmdLine1) {
        console.log("✅ CMD quote replacement works: " + cmdLine1);
    } else {
        console.error("❌ CMD quote replacement failed.");
    }

    const cmdLine2 = lines.find(l => l.includes("It's me"));
    if (cmdLine2) {
        if (cmdLine2.includes('CMD ["echo", "It\'s me"]')) {
             console.log("✅ CMD quote replacement (mixed) works safely: " + cmdLine2);
        } else {
             console.error("❌ CMD quote replacement corrupted. Found: " + cmdLine2);
        }
    } else {
        console.error("❌ CMD line not found.");
    }

    // Check for empty line before comment block
    // Look for `# Comment detached`
    const idx = lines.findIndex(l => l.trim().startsWith('# Comment detached'));
    if (idx > 0) {
        const prev = lines[idx-1];
        if (prev.trim() === '') {
             console.log("✅ Empty line inserted before comment block.");
        } else {
             console.error("❌ Empty line missing before comment block. Previous line: '" + prev + "'");
        }
    } else {
        console.error("❌ Comment block not found.");
    }
}

runTest();
