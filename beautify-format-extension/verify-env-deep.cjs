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

// Injection
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'vscode') {
        return mockVscode;
    }
    return originalRequire.apply(this, arguments);
};

async function runTests() {
    console.log('Running ENV Deep Formatting Verification...');
    let DataConfig;
    try {
        DataConfig = require('./out/formatters/data_config');
    }
    catch (e) {
        console.error('Could not load data_config formatter. Make sure to run "npm run compile" first.');
        console.error(e);
        process.exit(1);
    }

    const testFile = 'test.deep.env';
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
            languageId: 'env',
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
        await DataConfig.handleENV(mockEditor, content);

        console.log('Formatted Output:\n---------------------------------------------------');
        console.log(formattedText);
        console.log('---------------------------------------------------');

        if (!formattedText) {
            console.error('❌ Formatting returned empty string.');
            process.exit(1);
        }

        const outputLines = formattedText.split('\n');

        // Find "=" positions
        let eqPositions = [];
        outputLines.forEach((line, idx) => {
            if (line.includes('=') && !line.trim().startsWith('#')) {
                eqPositions.push({ line: idx, pos: line.indexOf('=') });
            }
        });

        if (eqPositions.length === 0) {
            console.error('❌ No assignments found in output.');
            process.exit(1);
        }

        const firstPos = eqPositions[0].pos;
        const allAligned = eqPositions.every(p => p.pos === firstPos);

        if (allAligned) {
            console.log(`✅ All ${eqPositions.length} assignments aligned at column ${firstPos}.`);
        } else {
            console.error('❌ Assignments are NOT aligned.');
            eqPositions.forEach(p => console.log(`Line ${p.line + 1}: = at ${p.pos}`));
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
