
import * as fs from 'fs';
import * as path from 'path';

// Minimal VS Code Mock
const mockVscode = {
    window: {
        activeTextEditor: undefined as any,
        showInformationMessage: (msg: string) => console.log('INFO:', msg),
        showErrorMessage: (msg: string) => console.log('ERROR:', msg),
        showWarningMessage: (msg: string) => console.log('WARN:', msg),
    },
    Range: class {
        constructor(public start: any, public end: any) {}
    },
    Position: class {
        constructor(public line: number, public character: number) {}
    },
    commands: {
        registerCommand: () => ({ dispose: () => {} }),
    }
};

// Injection to handle 'import * as vscode from "vscode"'
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id: string) {
    if (id === 'vscode') {
        return mockVscode;
    }
    return originalRequire.apply(this, arguments);
};

// Use require to ensure it runs AFTER the mock injection
const { beautify } = require('./extension');

async function runTest() {
    console.log('Testing JSON Deep Formatting...');

    const initialContent = '{"key":"value","nested":{"inner":"val"},"arr":[1,2,3]}';
    // Expect 4 spaces. js-beautify collapses short arrays, which is fine (Prettier style).
    // Nested object should use 8 spaces.
    const expectedContent4Spaces = '{\n    "key": "value",\n    "nested": {\n        "inner": "val"\n    },\n    "arr": [1, 2, 3]\n}';

    // Test case 1: 4 spaces indentation
    let formattedText = '';
    const mockEditor = {
        options: {
            tabSize: 4,
            insertSpaces: true
        },
        document: {
            getText: () => initialContent,
            lineCount: 1,
            lineAt: (line: number) => ({
                range: {
                    start: { line, character: 0 },
                    end: { line, character: initialContent.length }
                }
            }),
            languageId: 'json',
            positionAt: (offset: number) => ({ line: 0, character: offset }),
            uri: { fsPath: 'test.json' }
        },
        edit: async (callback: (eb: any) => void) => {
            const eb = {
                replace: (range: any, text: string) => {
                    formattedText = text;
                }
            };
            callback(eb);
            return true;
        }
    };

    mockVscode.window.activeTextEditor = mockEditor as any;

    await beautify('json');

    console.log('Formatted Text:\n' + formattedText);

    // Normalize newlines
    const normalizedFormatted = formattedText.replace(/\r\n/g, '\n');
    const normalizedExpected = expectedContent4Spaces.replace(/\r\n/g, '\n');

    if (normalizedFormatted === normalizedExpected) {
        console.log('✅ JSON respected 4 spaces indentation and smart wrapping.');
    } else {
        console.log('❌ JSON did NOT respect expectations.');
        console.log('Expected:\n' + normalizedExpected);
        console.log('Actual:\n' + normalizedFormatted);
        process.exit(1);
    }
}

runTest().catch(err => {
    console.error(err);
    process.exit(1);
});
