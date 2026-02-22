"use strict";
const fs = require('fs');
const path = require('path');

// Minimal VS Code Mock
const mockVscode = {
    window: {
        activeTextEditor: undefined,
        showInformationMessage: (msg) => console.log('INFO:', msg),
        showErrorMessage: (msg) => console.error('ERROR:', msg),
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
        replace(uri, range, newText) { }
    }
};

// Injection to handle imports
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'vscode') {
        return mockVscode;
    }
    if (id === 'prettier') {
        throw new Error("Simulated Prettier missing for fallback test");
    }
    return originalRequire.apply(this, arguments);
};

async function runTest() {
    // Load extension after mock
    let beautify;
    try {
        const ext = require('./out/extension');
        beautify = ext.beautify;
    } catch (e) {
        console.error("Could not load extension.", e);
        process.exit(1);
    }

    const testFile = 'test.complex.mdx';
    console.log(`Testing ${testFile} with Prettier disabled...`);
    const filePath = path.join(__dirname, testFile);

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf8');

    // Mock editor
    let formattedText = '';
    const mockEditor = {
        options: { tabSize: 2, insertSpaces: true },
        document: {
            getText: () => content,
            lineCount: content.split('\n').length,
            languageId: 'mdx',
            uri: { fsPath: filePath },
            lineAt: (line) => {
                const lines = content.split('\n');
                return {
                    text: lines[line] || '',
                    range: { start: {}, end: {} } // Simplified
                };
            }
        },
        edit: async (callback) => {
            const eb = {
                replace: (range, text) => { formattedText = text; }
            };
            callback(eb);
            return true;
        }
    };

    mockVscode.window.activeTextEditor = mockEditor;

    try {
        // Run formatting
        await beautify('mdx');

        console.log('--- Original ---');
        console.log(content);
        console.log('--- Formatted (Fallback) ---');
        console.log(formattedText);
        console.log('-----------------');

        if (formattedText && formattedText !== content) {
            console.log(`✅ ${testFile} beautified successfully (fallback used).`);

            // Verification of Fallback Logic
            // Check if nested JSX is indented
            if (formattedText.includes('  <Button')) {
                console.log("✅ JSX Indentation applied.");
            } else {
                console.error("❌ JSX Indentation missing.");
                process.exit(1);
            }

            // Check table alignment (flexible check for expanded columns)
            if (/\| :---/.test(formattedText) && /\| Left\s+\|/.test(formattedText)) {
                console.log("✅ Table aligned.");
            } else {
                console.error("❌ Table not aligned.");
                process.exit(1);
            }

        } else {
            console.error(`❌ ${testFile} produced no changes or failed.`);
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
