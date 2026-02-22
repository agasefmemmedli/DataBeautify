"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");

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
    },
    WorkspaceEdit: class {
        replace(uri, range, newText) {
             // Basic mock
        }
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

async function runTest() {
    // Load extension after mock
    // Using compiled output
    const { beautify } = require('./out/extension');
    const testFile = 'test.deep.makefile';
    console.log(`Testing ${testFile}...`);
    const filePath = path.join(__dirname, testFile);

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf8');

    // Mock editor
    let formattedText = '';
    const mockEditor = {
        options: {
            tabSize: 4,
            insertSpaces: true
        },
        document: {
            getText: () => content,
            lineCount: content.split('\n').length,
            languageId: 'makefile',
            uri: { fsPath: filePath },
            lineAt: (line) => {
                const lines = content.split('\n');
                const text = lines[line] || '';
                return {
                    text: text,
                    range: {
                        start: new mockVscode.Position(line, 0),
                        end: new mockVscode.Position(line, text.length)
                    },
                    rangeIncludingLineBreak: {
                         start: new mockVscode.Position(line, 0),
                         end: new mockVscode.Position(line + 1, 0)
                    },
                    lineNumber: line,
                    isEmptyOrWhitespace: text.trim().length === 0
                };
            }
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
        await beautify('makefile');
        console.log('--- Original ---');
        console.log(content);
        console.log('--- Formatted ---');
        console.log(formattedText);
        console.log('-----------------');

        if (formattedText && formattedText !== content) {
            const lines = formattedText.split('\n');

            // 1. Check Recipe Indentation (Tab)
            // find 'all:' target, next line should start with TAB
            const allTargetIndex = lines.findIndex(l => l.trim().startsWith('all:'));
            if (allTargetIndex !== -1 && lines[allTargetIndex + 1]) {
                const recipeLine = lines[allTargetIndex + 1];
                if (!recipeLine.startsWith('\t')) {
                    console.error('❌ Recipe indentation failed. Expected TAB.');
                    console.error(`Got: "${recipeLine}"`);
                    process.exit(1);
                } else {
                    console.log('✅ Recipe indentation correct (TAB).');
                }
            }

            // 2. Check Directive Indentation
            // ifeq should be 0 indent? No, ifeq inside?
            // "ifeq" in our test is top level?
            // Test file:
            // ifeq ($(DEBUG), 1)
            // CFLAGS += -g -DDEBUG

            // Our formatter:
            // ifeq ... (level 0)
            //   CFLAGS ... (level 1 = 2 spaces)
            // else (level 0)
            //   CFLAGS ... (level 1)
            // endif (level 0)

            const ifeqIndex = lines.findIndex(l => l.trim().startsWith('ifeq'));
            if (ifeqIndex !== -1) {
                const cflagsLine = lines[ifeqIndex + 1];
                if (cflagsLine.startsWith('  CFLAGS')) {
                    console.log('✅ Directive indentation correct (2 spaces).');
                } else {
                    console.error('❌ Directive indentation failed. Expected 2 spaces.');
                    console.error(`Got: "${cflagsLine}"`);
                    process.exit(1);
                }
            }

            // 3. Check Alignment
            // CC = gcc
            // CFLAGS = ...
            // SOURCES = ...
            // 'SOURCES' is length 7. 'CC' is 2.
            // Alignment should be based on SOURCES (plus space?).
            // SOURCES = ...
            // CC      = ...
            // Let's check if '=' aligns.

            const ccLine = lines.find(l => l.trim().startsWith('CC'));
            const cflagsLine = lines.find(l => l.trim().startsWith('CFLAGS'));
            const sourcesLine = lines.find(l => l.trim().startsWith('SOURCES'));

            if (ccLine && cflagsLine && sourcesLine) {
                const ccEq = ccLine.indexOf('=');
                const cflagsEq = cflagsLine.indexOf('=');
                const sourcesEq = sourcesLine.indexOf('=');

                if (ccEq === cflagsEq && cflagsEq === sourcesEq) {
                    console.log('✅ Assignment alignment correct.');
                } else {
                    console.error('❌ Assignment alignment failed.');
                    console.log(`CC eq at ${ccEq}`);
                    console.log(`CFLAGS eq at ${cflagsEq}`);
                    console.log(`SOURCES eq at ${sourcesEq}`);
                    process.exit(1);
                }
            }

            console.log(`✅ ${testFile} beautified successfully.`);
        } else if (formattedText === content) {
            // Check if content was already good?
            // The original content in test.deep.makefile seems to have NO indentation for ifeq body.
            // So if no changes, it failed.
            console.error(`❌ ${testFile} produced no changes (expected deep formatting).`);
            process.exit(1);
        } else {
            console.log(`⚠️ ${testFile} produced no changes.`);
        }
    } catch (err) {
        console.error(`❌ Error testing ${testFile}:`, err);
        process.exit(1);
    }
}

runTest().catch(err => {
    console.error(err);
    process.exit(1);
});
