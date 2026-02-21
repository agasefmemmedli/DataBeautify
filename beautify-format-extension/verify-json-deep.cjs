const assert = require('assert');
const path = require('path');

// Mock VS Code
const mockEditor = {
    options: { tabSize: 2, insertSpaces: true },
    document: {
        getText: () => '',
        lineCount: 1,
        lineAt: (line) => ({
            range: { start: { line, character: 0 }, end: { line, character: 100 } },
            text: ''
        }),
        positionAt: (offset) => ({ line: 0, character: offset }),
        uri: { fsPath: 'test.json' },
        fileName: 'test.json'
    },
    edit: async (callback) => {
        const edits = [];
        callback({
            replace: (range, text) => edits.push({ text })
        });
        mockEditor.lastEdits = edits;
        return true;
    }
};

const mockVscode = {
    window: {
        activeTextEditor: mockEditor,
        showInformationMessage: (msg) => console.log('INFO:', msg),
        showErrorMessage: (msg) => console.log('ERROR:', msg),
        showWarningMessage: (msg) => console.log('WARN:', msg)
    },
    Range: class { constructor(s, e) { this.start = s; this.end = e; } },
    Position: class { constructor(l, c) { this.line = l; this.character = c; } },
    workspace: {
        getConfiguration: () => ({ get: () => undefined })
    }
};

// Mock module injection
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
    if (id === 'vscode') return mockVscode;
    return originalRequire.apply(this, arguments);
};

// Check if compiled files exist, otherwise warn
const jsTsPath = './out/formatters/js_ts.js';
const fs = require('fs');
if (!fs.existsSync(path.join(__dirname, jsTsPath))) {
    console.error('ERROR: Compiled files not found. Please run "npm run compile" first.');
    process.exit(1);
}

const { handleJSON, handleJSONC } = require(jsTsPath);

async function runTest() {
    console.log('🧪 Testing JSON Deep Formatting...');

    // Test 1: Standard JSON
    console.log('Test 1: Standard JSON (Prettier or Deep)');
    // Use long input to force multiline wrapping (Prettier printWidth is 120)
    const jsonInput = '{"key":"' + 'a'.repeat(100) + '","b":2}';
    mockEditor.document.getText = () => jsonInput;
    mockEditor.options = { tabSize: 2, insertSpaces: true };

    await handleJSON(mockEditor, jsonInput);

    if (!mockEditor.lastEdits || mockEditor.lastEdits.length === 0) {
         console.error('❌ No edits applied for Standard JSON');
         process.exit(1);
    }
    const result1 = mockEditor.lastEdits[0].text;
    // Expect indentation (Prettier standard is 2 spaces)
    if (result1.includes('\n  "key":') || result1.includes('\n  "b":')) {
        console.log('✅ Standard JSON formatted correctly.');
    } else {
        console.error('❌ Standard JSON failed (indentation?):', result1);
        process.exit(1);
    }

    // Test 2: JSONC (Comments)
    console.log('Test 2: JSONC (Comments preservation)');
    const jsoncInput = '{\n// comment\n"a":1}';
    mockEditor.document.getText = () => jsoncInput;
    mockEditor.document.languageId = 'jsonc';

    await handleJSONC(mockEditor, jsoncInput);

    if (!mockEditor.lastEdits || mockEditor.lastEdits.length === 0) {
         console.error('❌ No edits applied for JSONC');
         process.exit(1);
    }
    const result2 = mockEditor.lastEdits[0].text;
    if (result2.includes('// comment')) {
        console.log('✅ JSONC comments preserved.');
    } else {
        console.error('❌ JSONC comments lost:', result2);
        process.exit(1);
    }

    // Test 3: Invalid JSON (Resilience)
    console.log('Test 3: Invalid JSON (Resilience)');
    // Missing quotes on keys (a:1) is typical
    const invalidInput = '{a:1, b:2}';
    mockEditor.document.getText = () => invalidInput;

    await handleJSON(mockEditor, invalidInput);

    if (!mockEditor.lastEdits || mockEditor.lastEdits.length === 0) {
         console.error('❌ No edits applied for Invalid JSON');
         process.exit(1);
    }
    const result3 = mockEditor.lastEdits[0].text;
    // jsonrepair should fix keys
    if ((result3.includes('"a": 1') || result3.includes('"a":1')) && result3.includes('"b":')) {
        console.log('✅ Invalid JSON repaired/formatted.');
    } else {
        console.error('❌ Invalid JSON failed to repair:', result3);
        process.exit(1);
    }
}

runTest().catch(e => {
    console.error(e);
    process.exit(1);
});
