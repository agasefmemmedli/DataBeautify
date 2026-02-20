const fs = require('fs');
const path = require('path');
const Module = require('module');

// Mock VS Code API
const vscode = {
    window: {
        showErrorMessage: (msg) => console.error(`[Error] ${msg}`),
        showWarningMessage: (msg) => console.warn(`[Warning] ${msg}`),
        showInformationMessage: (msg) => console.log(`[Info] ${msg}`),
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
    WorkspaceEdit: class {
        constructor() {
            this.edits = [];
        }
        replace(uri, range, newText) {
            this.edits.push({ uri, range, newText });
        }
    },
    workspace: {
        applyEdit: async (edit) => {
            if (edit.edits.length > 0) {
                const newText = edit.edits[0].newText;
                console.log("--- Formatted Output Start ---");
                console.log(newText);
                console.log("--- Formatted Output End ---");
                fs.writeFileSync('verify-latex-deep.log', newText);
                return true;
            }
            return false;
        }
    }
};

// Intercept require('vscode')
const originalRequire = Module.prototype.require;
Module.prototype.require = function(request) {
    if (request === 'vscode') {
        return vscode;
    }
    return originalRequire.apply(this, arguments);
};

// Import handleLaTeX
const { handleLaTeX } = require('./out/formatters/markup.js');

// Prepare Mock Editor
const text = fs.readFileSync('test.deep.tex', 'utf8');
const document = {
    uri: { fsPath: 'test.deep.tex' },
    languageId: 'latex',
    getText: () => text,
    lineCount: text.split('\n').length,
    lineAt: (i) => {
        const lines = text.split('\n');
        const lineText = lines[i];
        return {
            text: lineText,
            range: {
                start: { line: i, character: 0 },
                end: { line: i, character: lineText.length }
            }
        };
    }
};

const editor = {
    document: document,
    edit: async (callback) => {
        const editBuilder = {
            replace: (range, newText) => {
                console.log("--- Formatted Output Start ---");
                console.log(newText);
                console.log("--- Formatted Output End ---");
                fs.writeFileSync('verify-latex-deep.log', newText);
            }
        };
        await callback(editBuilder);
        return true;
    }
};

async function run() {
    try {
        console.log("Running Deep LaTeX Verification...");
        await handleLaTeX(editor, text);
        console.log("Verification finished.");
    } catch (e) {
        console.error("Verification failed:", e);
        process.exit(1);
    }
}

run();
