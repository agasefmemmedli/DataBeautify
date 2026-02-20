const fs = require('fs');
const path = require('path');

// Mock VS Code API
const mockVscode = {
    window: {
        activeTextEditor: undefined,
        showInformationMessage: (msg) => console.log('INFO:', msg),
        showErrorMessage: (msg) => console.error('ERROR:', msg),
        showWarningMessage: (msg) => console.warn('WARN:', msg),
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
    },
    Uri: {
        file: (f) => ({ fsPath: f })
    }
};

// Mock module loading for vscode
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
        // Import from compiled output
        const ext = require('./out/extension');
        beautify = ext.beautify;
    } catch (e) {
        console.error("Could not load extension. Make sure to run 'npm run compile' first.");
        console.error(e);
        process.exit(1);
    }

    const testFile = 'test.deep.gitconfig';
    const filePath = path.join(__dirname, testFile);

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    let formattedText = '';

    const mockEditor = {
        document: {
            getText: () => content,
            languageId: 'gitconfig',
            uri: { fsPath: filePath },
            lineCount: content.split('\n').length,
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
            const editBuilder = {
                replace: (range, text) => {
                    formattedText = text;
                }
            };
            await callback(editBuilder);
            return true;
        }
    };

    mockVscode.window.activeTextEditor = mockEditor;

    console.log(`Testing ${testFile}...`);
    try {
        await beautify('gitconfig');
    } catch (err) {
        console.error('Error during beautification:', err);
        process.exit(1);
    }

    if (!formattedText) {
        console.error('Formatted text is empty. Beautification failed or no changes applied.');
        process.exit(1);
    }

    console.log('--- Original ---');
    console.log(content);
    console.log('--- Formatted ---');
    console.log(formattedText);
    console.log('-----------------');

    // Verification Logic
    const lines = formattedText.split('\n');

    // 1. Check for tab indentation (or 4 spaces if I decide to change it, but keeping tab for now as per current)
    // Wait, deep formatting usually prefers spaces (4) for config files in many standards, but Git Config often uses tabs.
    // Let's check what I will implement. "Standard Style" for git config: `man git-config` says "syntax is fairly flexible".
    // Most examples use tabs. I'll stick to tabs `\t`.

    // Check indentation of keys
    const nameLine = lines.find(l => l.trim().startsWith('name ='));
    if (!nameLine || !nameLine.startsWith('\t')) {
        console.error("❌ 'name' property not indented with tab.");
        process.exit(1);
    }

    // 2. Check spacing around =
    if (!nameLine.includes('name = "John Doe"')) {
        console.error("❌ 'name' property spacing incorrect (expected 'key = value').");
        process.exit(1);
    }

    // 3. Check section headers
    if (!lines.find(l => l.trim() === '[core]')) {
        console.error("❌ '[core]' section header missing or incorrect.");
        process.exit(1);
    }

    // 4. Check subsection headers
    if (!lines.find(l => l.trim() === '[diff "image"]')) {
        console.error("❌ '[diff \"image\"]' subsection header missing or incorrect.");
        process.exit(1);
    }

    // 5. Check multiline preservation
    const multilineIndex = lines.findIndex(l => l.trim().startsWith('multiline ='));
    if (multilineIndex === -1) {
        console.error("❌ 'multiline' property not found.");
        process.exit(1);
    }
    // Check if continuation lines exist and are indented
    // Git config continuation: line ends with \, next line is value continuation.
    // Deep formatting should probably indent continuation lines.

    // 6. Check comments
    if (!lines.find(l => l.trim().startsWith('# This is a comment'))) {
        console.error("❌ Comment '# This is a comment' lost.");
        process.exit(1);
    }

    console.log('✅ Git Config verification passed!');
}

runTest();
