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
    console.log('Running INI Deep Formatting Verification...');
    let DataConfig;
    try {
        // We load the compiled JS
        DataConfig = require('./out/formatters/data_config');
    }
    catch (e) {
        console.error('Could not load data_config formatter. Make sure to run "npm run compile" first.');
        console.error(e);
        process.exit(1);
    }

    const testFile = 'test.deep.ini';
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
            tabSize: 2,
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
            languageId: 'ini',
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
        await DataConfig.handleINI(mockEditor, content);

        console.log('Formatted Output:\n---------------------------------------------------');
        console.log(formattedText);
        console.log('---------------------------------------------------');

        // Checks
        if (!formattedText) {
            console.error('❌ Formatting returned empty string.');
            process.exit(1);
        }

        // Check alignment
        // We expect = to be aligned in each section
        const outputLines = formattedText.split('\n');

        // Helper to get = index
        const getEqIndex = (line) => line.indexOf('=');

        // Section [database]
        // host=...
        // port=...
        // user = ...
        // password= ...
        // Expected alignment:
        // host     = localhost
        // port     = 5432
        // user     = admin
        // password = secret # comment

        // Let's check if 'host' and 'password' equals are aligned
        const dbSection = outputLines.filter(l => l.trim() !== '' && !l.startsWith('[') && !l.startsWith(';'));
        // This simple filter merges both sections, but they should be processed separately in alignment logic.
        // But if we look at the formatted output, we can verify visually or by regex.

        // Find line with 'host'
        const hostLine = outputLines.find(l => l.includes('host'));
        const passLine = outputLines.find(l => l.includes('password'));

        if (hostLine && passLine) {
            const hostEq = hostLine.indexOf('=');
            const passEq = passLine.indexOf('=');

            if (hostEq !== passEq) {
                console.error(`❌ Vertical alignment failed. 'host' = at ${hostEq}, 'password' = at ${passEq}`);
                // Allow some tolerance if the logic is complex, but for Deep Formatting we want strictness.
                process.exit(1);
            } else {
                console.log('✅ Vertical alignment verified.');
            }
        } else {
             console.error('❌ Could not find host or password lines.');
             process.exit(1);
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
