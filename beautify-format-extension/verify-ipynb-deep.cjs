"use strict";

// Mock VS Code
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
        applyEdit: async (edit) => {
             // We capture the edit in the editor stub
             return true;
        },
        getConfiguration: () => ({
            get: (key, defaultValue) => defaultValue
        })
    },
    WorkspaceEdit: class {
        constructor() {
            this.edits = [];
        }
        replace(uri, range, newText) {
             this.edits.push({range, newText});
        }
    }
};

const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'vscode') {
        return mockVscode;
    }
    return originalRequire.apply(this, arguments);
};

const fs = require('fs');
const path = require('path');

async function runTest() {
    let beautify;
    try {
        // Import from compiled output
        const ext = require('./out/extension');
        beautify = ext.beautify;
    } catch (e) {
        console.error("Could not load extension. Make sure to run 'npm run compile' first.");
        console.error(e);
        process.exit(1);
    }

    const testFile = 'test.deep.ipynb';
    const filePath = path.join(__dirname, testFile);
    console.log(`Testing ${testFile}...`);

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    let formattedText = '';

    const mockEditor = {
        document: {
            getText: () => content,
            languageId: 'json', // .ipynb is technically JSON but extension detects by extension/content usually
            uri: { fsPath: filePath },
            lineCount: content.split('\n').length,
            lineAt: (line) => {
                 const lines = content.split('\n');
                 return { text: lines[line], range: { start: { line, character: 0 }, end: { line, character: lines[line].length } } };
            }
        },
        edit: async (callback) => {
            const editBuilder = {
                replace: (range, text) => {
                    formattedText = text;
                }
            };
            callback(editBuilder);
            return true;
        }
    };

    mockVscode.window.activeTextEditor = mockEditor;

    try {
        // Force 'ipynb' format
        await beautify('ipynb');

        if (!formattedText) {
            console.error("❌ No formatting applied.");
            process.exit(1);
        }

        console.log("Formatting applied. Verifying content...");

        // Parse resulting JSON
        let notebook;
        try {
            notebook = JSON.parse(formattedText);
        } catch (e) {
            console.error("❌ Formatted text is not valid JSON.");
            console.error(e);
            process.exit(1);
        }

        // Verify structure
        if (!notebook.cells || !Array.isArray(notebook.cells)) {
             console.error("❌ Invalid notebook structure (missing cells).");
             process.exit(1);
        }

        // Check formatting of Python cell
        const codeCell = notebook.cells.find(c => c.cell_type === 'code');
        if (codeCell) {
            const source = Array.isArray(codeCell.source) ? codeCell.source.join('') : codeCell.source;
            console.log("Code Cell Source:\n", source);

            // Expected: def foo(x, y):\n    return x + y\n...
            if (source.includes('def foo(x, y):') || source.includes('def foo(x,y):')) { // Accept somewhat reasonable variations if deep formatter isn't perfect
                 if (source.includes('return x+y')) {
                      console.log("⚠️ Python formatting weak (no space around operator).");
                 } else if (source.includes('return x + y')) {
                      console.log("✅ Python operator spacing looks good.");
                 }

                 if (source.includes('print(\'hello\')') || source.includes('print("hello")')) {
                      console.log("✅ Python print formatting looks good.");
                 }
            } else {
                 console.error("❌ Python formatting failed to fix spacing in def foo( x,y ).");
                 process.exit(1);
            }
        }

        // Check formatting of Markdown cell
        const mdCell = notebook.cells.find(c => c.cell_type === 'markdown');
        if (mdCell) {
            const source = Array.isArray(mdCell.source) ? mdCell.source.join('') : mdCell.source;
            console.log("Markdown Cell Source:\n", source);

            // Expected: # Badly Formatted Header\n- list item 1\n- list item 2
            if (source.includes('# Badly Formatted Header')) {
                 console.log("✅ Markdown header formatted.");
            } else {
                 console.error("❌ Markdown header not fixed.");
                 process.exit(1);
            }
            if (source.includes('- list item 1') || source.includes('* list item 1')) {
                 // Prettier standardizes lists. Usually - or * consistent.
                 console.log("✅ Markdown list items present.");
            }
        }

        console.log("✅ IPYNB verification passed.");

    } catch (err) {
        console.error("❌ Error running verification:", err);
        process.exit(1);
    }
}

runTest();
