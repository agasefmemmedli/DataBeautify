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

    const testFile = 'test.deep.hbs';
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
            languageId: 'handlebars',
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
        await beautify('handlebars');
        console.log('--- Original ---');
        console.log(content);
        console.log('--- Formatted ---');
        console.log(formattedText);
        console.log('-----------------');

        if (formattedText && formattedText !== content) {
            console.log(`✅ ${testFile} beautified successfully.`);

            // Verification logic
            const lines = formattedText.split('\n');

            const divLine = lines.find(l => l.includes('<div class="container'));
            const h1Line = lines.find(l => l.trim().startsWith('<h1>'));
            // Hello might be on same line or next line depending on implementation details of Text/Block
            // With latest implementation: block tag h1 -> newline -> indent -> text "Hello {{name}}" -> newline -> /h1
            let helloLine = lines.find(l => l.trim().startsWith('Hello'));
            let helloIndent = -1;

            if (!helloLine && h1Line && h1Line.includes('Hello')) {
                // Inline case
                helloLine = h1Line;
                helloIndent = h1Line.indexOf('Hello');
            } else if (helloLine) {
                helloIndent = helloLine.indexOf('H');
            }

            if (divLine && h1Line && helloLine) {
                 const divIndent = divLine.indexOf('<');
                 const h1Indent = h1Line.indexOf('<');

                 console.log(`Div Indent: ${divIndent}`);
                 console.log(`H1 Indent: ${h1Indent}`);
                 console.log(`Hello Indent: ${helloIndent}`);

                 if (h1Indent > divIndent && helloIndent > h1Indent) {
                     console.log("✅ Indentation logic verified (nested content indented).");
                 } else {
                     console.error("❌ Indentation logic failed.");
                     process.exit(1);
                 }

                 // Check inline block in attribute
                 if (divLine.includes('{{#if active}}active{{/if}}')) {
                     console.log("✅ Inline block in attribute verified.");
                 } else {
                     console.error("❌ Inline block in attribute failed.");
                     process.exit(1);
                 }

                 // Check script preservation
                 const scriptContentLine = lines.find(l => l.includes('const data = {'));
                 if (scriptContentLine) {
                     console.log("✅ Script content found.");
                     // Check if it looks preserved (contains indentation or at least not totally flattened to start of line if it was indented)
                     // Original was indented with 4 spaces.
                     if (scriptContentLine.startsWith('    const')) {
                          console.log("✅ Script whitespace preserved.");
                     } else {
                          console.log("⚠️ Script whitespace changed (might be acceptable for deep formatter).");
                          // We accept change if it's clean.
                     }
                 } else {
                     console.error("❌ Script content missing or mangled.");
                     process.exit(1);
                 }

            } else {
                console.error("❌ Expected content missing.");
                process.exit(1);
            }

        } else if (formattedText === content) {
            console.log(`ℹ️ ${testFile} already formatted or no changes applied.`);
            console.error("❌ Formatting expected but not applied.");
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
