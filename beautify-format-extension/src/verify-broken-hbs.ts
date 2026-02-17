
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

import { beautify, detectFormat } from './extension';

async function runTests() {
    const file = 'test-broken.hbs';
    console.log(`\nTesting ${file}...`);
    const filePath = path.join('.', file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // Mock editor
    let formattedText = '';
    const mockEditor = {
        document: {
            getText: () => content,
            lineCount: lines.length,
            lineAt: (line: number) => ({
                range: {
                    start: { line, character: 0 },
                    end: { line, character: lines[line]?.length || 0 }
                }
            }),
            languageId: 'handlebars',
            positionAt: (offset: number) => ({ line: 0, character: offset }),
            uri: { fsPath: filePath }
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

    try {
        const detected = detectFormat(content, mockEditor.document.languageId);
        console.log(`Detected format: ${detected}`);

        await beautify();

        if (formattedText && formattedText !== content) {
            console.log(`✅ ${file} beautified successfully.`);
            console.log('Formatted Content:\n' + formattedText);
        } else {
            console.log(`⚠️ ${file} produced no changes.`);
        }
    } catch (err) {
        console.error(`❌ Error testing ${file}:`, err);
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
