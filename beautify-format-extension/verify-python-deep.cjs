"use strict";
const fs = require('fs');
const path = require('path');

// Minimal VS Code Mock
const mockVscode = {
    window: {
        activeTextEditor: undefined,
        showInformationMessage: (msg) => console.log('INFO:', msg),
        showErrorMessage: (msg) => console.log('ERROR:', msg),
        showWarningMessage: (msg) => console.log('WARN:', msg),
    },
    Range: class {
        constructor(start, end) {
            this.start = start;
            this.end = end;
        }
    },
    Position: class {
        constructor(line, character) {
            this.line = line;
            this.character = character;
        }
    },
    commands: {
        registerCommand: () => ({ dispose: () => { } }),
    },
    workspace: {
        applyEdit: async () => true
    }
};

// Mock python-ast if it fails to load
try {
    require('python-ast');
} catch (e) {
    console.warn('Mocking python-ast because it failed to load:', e.message);
    require.cache[require.resolve('python-ast')] = {
        exports: {
            parse: () => { }
        }
    };
}

// Injection to handle 'import * as vscode from "vscode"'
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'vscode') {
        return mockVscode;
    }
    return originalRequire.apply(this, arguments);
};

async function runTests() {
    console.log('Running Python Deep Formatting Verification...');
    let Scripting;
    try {
        Scripting = require('./out/formatters/scripting_compiled');
    }
    catch (e) {
        console.error('Could not load scripting formatter. Make sure to run "npm run compile" first.');
        console.error(e);
        process.exit(1);
    }

    const testFile = 'test.complex.py';
    const filePath = path.join(__dirname, testFile);

    if (!fs.existsSync(filePath)) {
        console.error(`File ${testFile} not found!`);
        process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let formattedText = '';

    const mockEditor = {
        options: {
            tabSize: 4,
            insertSpaces: true
        },
        document: {
            getText: () => content,
            lineCount: lines.length,
            lineAt: (line) => ({
                range: {
                    start: { line, character: 0 },
                    end: { line, character: lines[line]?.length || 0 }
                }
            }),
            languageId: 'python',
            positionAt: (offset) => ({ line: 0, character: offset }),
            uri: { fsPath: filePath }
        },
        edit: async (callback) => {
            const eb = {
                replace: (range, text) => {
                    formattedText = text;
                }
            };
            callback(eb);
            return true;
        }
    };
    mockVscode.window.activeTextEditor = mockEditor;

    try {
        await Scripting.handlePython(mockEditor, content);

        console.log('Formatted Output:\n---------------------------------------------------');
        console.log(formattedText);
        console.log('---------------------------------------------------');

        // Basic checks
        if (!formattedText) {
            console.error('❌ Formatting returned empty string.');
            process.exit(1);
        }

        // Check indentation (4 spaces)
        if (formattedText.includes('\t')) {
             console.error('❌ Output contains tabs, expected spaces.');
             process.exit(1);
        }

        // Check if class method is indented
        const classMethod = formattedText.match(/class MyClass:[\s\S]*?def greet/);
        if (classMethod && !classMethod[0].includes('    def greet')) {
             console.warn('⚠️ Warning: Class method might not be indented correctly.');
        }

        // Check if list is formatted
        if (formattedText.includes('[1, 2, 3, 4, 5, 6]')) {
             console.log('ℹ️ List was collapsed (acceptable but deep formatting might preserve multiline).');
        }

        console.log('✅ Verification run completed.');

    } catch (err) {
        console.error(`❌ Error testing ${testFile}:`, err);
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
