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
    console.log('Running YAML Deep Formatting Verification...');
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

    const testFile = 'test.deep.yaml';
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
            languageId: 'yaml',
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
        await DataConfig.handleYAML(mockEditor, content);

        console.log('Formatted Output:\n---------------------------------------------------');
        console.log(formattedText);
        console.log('---------------------------------------------------');

        // Checks
        if (!formattedText) {
            console.error('❌ Formatting returned empty string.');
            process.exit(1);
        }

        const outputLines = formattedText.split('\n');

        // Verify alignment
        // Check 'config' block alignment
        // host:    localhost
        // port:    8080
        // timeout: 300
        // enabled: true

        // Find line with 'host:'
        const hostIdx = outputLines.findIndex(l => l.includes('host:'));
        if (hostIdx === -1) {
            console.error('❌ Could not find "host:" in output.');
            process.exit(1);
        }

        const hostLine = outputLines[hostIdx];
        const portLine = outputLines[hostIdx + 1];
        const timeoutLine = outputLines[hostIdx + 2];
        const enabledLine = outputLines[hostIdx + 3];

        const getValStart = (line) => {
            const match = line.match(/:\s+/);
            if (!match) return -1;
            return match.index + match[0].length;
        };

        const hostValStart = getValStart(hostLine);
        const portValStart = getValStart(portLine);
        const timeoutValStart = getValStart(timeoutLine);
        const enabledValStart = getValStart(enabledLine);

        // All should be aligned. But wait, `enabled` is longer key? No, `timeout` (7), `enabled` (7), `host` (4).
        // Max key length is 7 ('timeout', 'enabled').
        // So `host` should be padded.

        // host:    localhost
        // 0123456789
        // h(0) o(1) s(2) t(3) :(4) space(5) space(6) space(7) space(8) l(9)
        // val starts at 9?
        // Let's check logic.
        // host:    val
        // timeout: val

        // Actually, we check if the COLUMNS of values are same?
        // Wait, values start AFTER the colon and spaces.
        // We want the VALUE start index to be consistent relative to indentation?
        // Or simply that colon position is NOT aligned (colon is attached to key), but value is aligned.

        // Standard Deep Formatting for YAML often aligns values:
        // key:   value
        // key2:  value

        if (hostValStart === portValStart && portValStart === timeoutValStart && timeoutValStart === enabledValStart) {
            console.log('✅ Config block values are aligned.');
        } else {
            console.error('❌ Config block values are NOT aligned.');
            console.log(`host val start: ${hostValStart}`);
            console.log(`port val start: ${portValStart}`);
            console.log(`timeout val start: ${timeoutValStart}`);
            console.log(`enabled val start: ${enabledValStart}`);
            process.exit(1);
        }

        // Check top level alignment
        // key1:      value1
        // longerKey: value2
        const key1Idx = outputLines.findIndex(l => l.startsWith('key1:'));
        const longerKeyIdx = outputLines.findIndex(l => l.startsWith('longerKey:'));

        if (key1Idx !== -1 && longerKeyIdx !== -1) {
             const key1ValStart = getValStart(outputLines[key1Idx]);
             const longerKeyValStart = getValStart(outputLines[longerKeyIdx]);

             if (key1ValStart === longerKeyValStart) {
                 console.log('✅ Top level values are aligned.');
             } else {
                 console.error('❌ Top level values are NOT aligned.');
                 console.log(`key1 val start: ${key1ValStart}`);
                 console.log(`longerKey val start: ${longerKeyValStart}`);
                 process.exit(1);
             }
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
