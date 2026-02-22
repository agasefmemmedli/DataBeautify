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

    // 1. Check for tab indentation
    const nameLine = lines.find(l => l.trim().startsWith('name'));
    if (!nameLine || !nameLine.startsWith('\t')) {
        console.error("❌ 'name' property not indented with tab.");
        process.exit(1);
    }

    // 2. Check spacing around = (allowing for alignment)
    if (!nameLine.match(/name\s+=\s+"John Doe"/)) {
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
    const multilineIndex = lines.findIndex(l => l.trim().startsWith('multiline'));
    if (multilineIndex === -1) {
        console.error("❌ 'multiline' property not found.");
        process.exit(1);
    }

    // 6. Check comments
    if (!lines.find(l => l.trim().startsWith('# This is a comment'))) {
        console.error("❌ Comment '# This is a comment' lost.");
        process.exit(1);
    }

    // 7. Check empty value
    if (!lines.find(l => l.trim().match(/^empty_val\s*=\s*$/))) { // empty value MUST have =
        console.error("❌ 'empty_val' property not formatted correctly (expected 'key =').");
        process.exit(1);
    }

    // 8. Check boolean key
    if (!lines.find(l => l.trim() === 'bool_key')) {
        console.error("❌ 'bool_key' property not formatted correctly (expected 'key' without =).");
        process.exit(1);
    }

    // 9. Check key = \n key2 parsing
    if (!lines.find(l => l.trim().match(/^newline_split\s*=\s*$/))) {
         console.error("❌ 'newline_split' property not correctly identified as empty value.");
         process.exit(1);
    }
    if (!lines.find(l => l.trim().startsWith('next_line'))) {
         console.error("❌ 'next_line' property lost or corrupted.");
         process.exit(1);
    }

    console.log('✅ Git Config verification passed!');
}

runTest();
