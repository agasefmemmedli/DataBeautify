"use strict";
// Minimal verification for safe Dockerfile formatting
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
    Position: class { constructor(line, char) { this.line = line; this.character = char; } },
    commands: { registerCommand: () => ({ dispose: () => { } }) },
    workspace: { applyEdit: async () => true, getConfiguration: () => ({ get: (k, d) => d }) },
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
        console.error("Could not load extension.", e);
        process.exit(1);
    }

    const testFile = 'test.safe.dockerfile';
    console.log(`Testing ${testFile}...`);
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
                return {
                    text,
                    range: { start: new mockVscode.Position(line, 0), end: new mockVscode.Position(line, text.length) },
                    rangeIncludingLineBreak: { start: new mockVscode.Position(line, 0), end: new mockVscode.Position(line + 1, 0) },
                    lineNumber: line,
                    isEmptyOrWhitespace: text.trim().length === 0
                };
            }
        },
        edit: async (callback) => {
            const eb = { replace: (range, text) => { formattedText = text; } };
            callback(eb);
            return true;
        }
    };

    mockVscode.window.activeTextEditor = mockEditor;

    try {
        await beautify('dockerfile');
        console.log('--- Formatted ---');
        console.log(formattedText);

        // Verification
        if (!formattedText) {
            console.error("❌ No formatted output.");
            process.exit(1);
        }

        // 1. Check strict no-sort logic
        // Original order: python3, make, g++
        // If sorted: g++, make, python3
        // We expect NO sorting because of &&
        const pyIdx = formattedText.indexOf('python3');
        const makeIdx = formattedText.indexOf('make');
        const gppIdx = formattedText.indexOf('g++');

        if (pyIdx === -1 || makeIdx === -1 || gppIdx === -1) {
             console.error("❌ Content missing.");
             process.exit(1);
        }

        if (pyIdx < makeIdx && makeIdx < gppIdx) {
            console.log("✅ Sorting safely disabled (python3 < make < g++ preserved).");
        } else {
            console.error("❌ Unsafe sorting occurred!");
            process.exit(1);
        }

        // 2. Check JSON
        if (formattedText.includes('CMD ["npm","start"]')) {
            console.log("✅ JSON formatted correctly.");
        } else {
            console.error("❌ JSON formatting failed.");
            process.exit(1);
        }

        // 3. Check Comments
        // RUN echo "hello" then # comment then RUN echo "world"
        const helloIdx = formattedText.indexOf('echo "hello"');
        const commentIdx = formattedText.indexOf('# This is a comment');
        const worldIdx = formattedText.indexOf('echo "world"');

        if (helloIdx < commentIdx && commentIdx < worldIdx) {
            console.log("✅ Comments preserved in order.");
        } else {
            console.error("❌ Comment reordering detected!");
            process.exit(1);
        }

        console.log("✅ All safe verifications passed.");

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

runTest();
