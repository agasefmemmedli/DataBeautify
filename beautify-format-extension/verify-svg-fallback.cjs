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

    const testFile = 'test.broken.svg';
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
            console.log(`✅ ${testFile} beautified successfully (Resilient/Fallback Mode).`);

            // Verification logic
            const lines = formattedText.split('\n');

            // Check if indentation is somewhat correct (2 spaces)
            const rectLine = lines.find(l => l.trim().startsWith('<rect'));
            if (rectLine && rectLine.startsWith('    <rect')) {
                 console.log("✅ Indentation logic verified (nested <rect> indented inside <g>).");
            } else if (rectLine) {
                 // Might be 2 spaces if g is not closed properly?
                 // But wait, my test file has <g> then <rect> then <circle> (unclosed).
                 // XMLTokenizer should handle unclosed tags gracefully if implemented correctly (it reads until > or EOF).
                 console.log(`ℹ️ Indentation for rect: '${rectLine}'`);
            }

            // Check if <circle> is still there (even if broken in input)
            if (!formattedText.includes('<circle')) {
                console.error("❌ <circle> tag lost.");
                process.exit(1);
            }

        } else if (formattedText === content) {
            console.warn("⚠️ No changes applied. Input might be too broken or formatter gave up.");
            // If it gave up, fallback failed.
             process.exit(1);
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
