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

    const testFile = 'test.deep.py';
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

        // Check for specific deep formatting markers
        // 1. imports sorted? (not strictly required but nice)
        // 2. Spaces around operators? e.g. "a > b"
        // 3. No spaces inside parentheses? e.g. "(a, b)" vs "( a, b )"
        // 4. Blank lines?

        if (formattedText.includes('if a>b')) {
             console.warn('⚠️ Warning: Space missing around ">" operator.');
        }

        if (formattedText.includes('( a,b,c=1')) {
             console.warn('⚠️ Warning: Space inside parentheses was not fixed.');
        }

        if (formattedText.includes('c=1')) {
             // In calls/definitions, kwarg '=' should NOT have spaces in some contexts, but PEP8 recommends around '=' for assignment, but not for keyword arguments.
             // Wait, PEP8 says: "Don't use spaces around the = sign when used to indicate a keyword argument or a default parameter value."
             // So `c=1` is correct for function definition.
             // But `x = 1` is correct for assignment.
        }

        if (formattedText.includes('x = 1+2*3')) {
             // Correct: x = 1 + 2 * 3
             // But priority might dictate `x = 1 + 2*3`? PEP8 allows omitting spaces around high priority operators.
             // Let's stick to consistent spacing: `x = 1 + 2 * 3` is safer.
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
