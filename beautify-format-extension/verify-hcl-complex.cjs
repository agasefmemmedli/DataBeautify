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

async function runTest() {
    let beautify;
    try {
        const ext = require('./out/extension');
        beautify = ext.beautify;
    } catch (e) {
        console.error("Could not load extension. Make sure to run 'npm run compile' first.");
        console.error(e);
        process.exit(1);
    }

    const testFile = 'test.complex.tf';
    console.log(`Testing ${testFile}...`);
    const filePath = path.join(__dirname, testFile);

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    let formattedText = '';

    const mockEditor = {
        options: { tabSize: 2, insertSpaces: true },
        document: {
            getText: () => content,
            lineCount: content.split('\n').length,
            languageId: 'hcl',
            uri: { fsPath: filePath },
            lineAt: (line) => {
                const lines = content.split('\n');
                const text = lines[line] || '';
                return {
                    text: text,
                    range: { start: new mockVscode.Position(line, 0), end: new mockVscode.Position(line, text.length) },
                    rangeIncludingLineBreak: { start: new mockVscode.Position(line, 0), end: new mockVscode.Position(line + 1, 0) },
                    lineNumber: line,
                    isEmptyOrWhitespace: text.trim().length === 0
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
        await beautify('hcl');
        console.log('--- Original ---');
        console.log(content);
        console.log('--- Formatted ---');
        console.log(formattedText);
        console.log('-----------------');

        if (formattedText && formattedText !== content) {
            console.log(`✅ ${testFile} beautified successfully.`);

            // Checks for complex HCL
            const lines = formattedText.split('\n');

            // 1. Verify alignment of = in locals block
            const projectLine = lines.find(l => l.trim().startsWith('Project') && l.includes('='));
            const ownerLine = lines.find(l => l.trim().startsWith('Owner') && l.includes('='));
            if (projectLine && ownerLine) {
                const projEq = projectLine.indexOf('=');
                const ownerEq = ownerLine.indexOf('=');
                if (projEq !== ownerEq) {
                    console.warn(`⚠️ Warning: Locals block alignment mismatch: Project=${projEq}, Owner=${ownerEq}`);
                } else {
                    console.log("✅ Locals block aligned.");
                }
            }

            // 2. Verify heredoc preservation
            if (!formattedText.includes('<<-EOF')) {
                console.error("❌ Indented Heredoc marker modified incorrectly.");
            }
            if (!formattedText.includes('echo "This is a complex heredoc with indentation"')) {
                console.error("❌ Heredoc content corrupted.");
            }

            // 3. Verify comments
            if (!formattedText.includes('# Conditional alignment?')) {
                console.error("❌ Inline comment missing or corrupted.");
            }

        } else if (formattedText === content) {
            console.log(`ℹ️ ${testFile} already formatted or no changes applied.`);
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
