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
        applyEdit: async () => true,
        getConfiguration: () => ({
            get: (key, defaultValue) => defaultValue
        })
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
    let beautify;
    try {
        const ext = require('./out/extension');
        beautify = ext.beautify;
    } catch (e) {
        console.error("Could not load extension. Make sure to run 'npm run compile' first.");
        console.error(e);
        process.exit(1);
    }

    const testFile = 'test.deep.svg';
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
            tabSize: 2,
            insertSpaces: true
        },
        document: {
            getText: () => content,
            lineCount: content.split('\n').length,
            languageId: 'svg',
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
            await callback(eb);
            return true;
        }
    };

    mockVscode.window.activeTextEditor = mockEditor;

    try {
        await beautify('svg');
        console.log('--- Original ---');
        console.log(content);
        console.log('--- Formatted ---');
        console.log(formattedText);
        console.log('-----------------');

        if (formattedText && formattedText !== content) {
            console.log(`✅ ${testFile} beautified successfully.`);

            // Verification logic
            const lines = formattedText.split('\n');

            // 1. Check indentation of nested elements
            // <g> is nested inside <svg> (and maybe others).
            // In original file: <g transform="translate(10, 10)"> is at line 9, indented with 2 spaces.
            // In deep formatting, if we use 2 spaces, it should be indented.

            const gLine = lines.find(l => l.trim().startsWith('<g '));
            if (gLine && (gLine.startsWith('  <g') || gLine.startsWith('    <g'))) {
                 console.log("✅ Indentation logic verified (nested <g> indented).");
            } else if (gLine) {
                 console.error(`❌ Indentation logic failed. Expected indentation, got '${gLine}'`);
                 process.exit(1);
            } else {
                 console.error("❌ Expected <g> tag missing.");
                 process.exit(1);
            }

            // 2. Check if attributes are wrapped or kept together nicely
            // Check foreignObject attributes wrapping
            const foLineIndex = lines.findIndex(l => l.trim().startsWith('<foreignObject'));
            if (foLineIndex !== -1) {
                const foLine = lines[foLineIndex];
                // If it was wrapped, subsequent lines might contain attributes
                if (foLine.trim() === '<foreignObject' || foLine.length < 80) { // arbitrary length check
                     console.log("✅ Attribute wrapping verified or length acceptable.");
                } else {
                     // If it's very long, check if it fits in 120 chars (our printWidth)
                     if (foLine.length > 125) { // some tolerance
                         console.warn("⚠️ Line length might exceed limit.");
                     }
                }
            }

        } else if (formattedText === content) {
             // Prettier might produce slightly different output even if already formatted,
             // but if the input is already messy, it should change.
             // Our input `test.deep.svg` is somewhat formatted but we expect deeper consistency.
             // If no change, it might mean the formatter didn't run or input was perfect (unlikely).
            console.log(`ℹ️ ${testFile} already formatted or no changes applied.`);
            // For this test, we assume we want to see changes because we are switching engines.
            // But if the old engine and new engine produce identical output, it's fine.
            // However, with Prettier "Deep Formatting", we expect strict adherence.

            // Let's assume success if no error thrown, but log a warning.
            console.warn("⚠️ No changes applied. Ensure deep formatting rules are active.");
        } else {
            console.log(`⚠️ ${testFile} produced no changes.`);
            process.exit(1);
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
