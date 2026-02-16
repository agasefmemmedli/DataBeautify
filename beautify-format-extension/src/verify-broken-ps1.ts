
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

// Injection
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id: string) {
    if (id === 'vscode') return mockVscode;
    return originalRequire.apply(this, arguments);
};

import { beautify } from './extension';

async function verifyBroken() {
    const file = 'test-broken.ps1';
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

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
            languageId: 'powershell',
            positionAt: (offset: number) => ({ line: 0, character: offset }),
            uri: { fsPath: path.resolve(file) }
        },
        edit: async (callback: (eb: any) => void) => {
            const eb = { replace: (range: any, text: string) => { formattedText = text; } };
            callback(eb);
            return true;
        }
    };

    mockVscode.window.activeTextEditor = mockEditor as any;

    console.log(`Testing ${file}...`);
    await beautify();
    console.log('--- Formatted Output ---');
    console.log(formattedText);
    console.log('------------------------');
}

verifyBroken().catch(console.error);
