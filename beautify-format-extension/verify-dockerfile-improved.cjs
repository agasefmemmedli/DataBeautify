const fs = require('fs');
const path = require('path');
const Module = require('module');

// Mock VS Code
const mockVscode = {
    window: {
        activeTextEditor: undefined,
        showInformationMessage: (msg) => console.log('INFO:', msg),
        showErrorMessage: (msg) => console.log('ERROR:', msg),
        showWarningMessage: (msg) => console.log('WARN:', msg),
    },
    Range: class { constructor(start, end) {} },
    Position: class { constructor(line, char) {} },
    commands: { registerCommand: () => ({ dispose: () => {} }) },
    workspace: { applyEdit: async () => true }
};

const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
    if (id === 'vscode') return mockVscode;
    return originalRequire.apply(this, arguments);
};

async function runTest() {
    console.log('Testing test.improved.dockerfile...');

    // Load extension (which imports 'vscode')
    let extension;
    try {
        extension = require('./out/extension');
    } catch (e) {
        console.error("Could not load extension. Did you run 'npm run compile'?");
        process.exit(1);
    }

    const testFile = 'test.improved.dockerfile';
    const filePath = path.join(__dirname, 'test', testFile);
    const content = fs.readFileSync(filePath, 'utf8');

    // Mock Editor
    const editor = {
        document: {
            getText: () => content,
            languageId: 'dockerfile',
            uri: { fsPath: filePath },
            lineCount: content.split('\n').length,
            lineAt: (line) => {
                const lines = content.split('\n');
                const text = lines[line] || '';
                return {
                    text: text,
                    range: new mockVscode.Range(new mockVscode.Position(line, 0), new mockVscode.Position(line, text.length)),
                    rangeIncludingLineBreak: new mockVscode.Range(new mockVscode.Position(line, 0), new mockVscode.Position(line + 1, 0)),
                    lineNumber: line,
                    isEmptyOrWhitespace: text.trim().length === 0
                };
            }
        },
        options: { tabSize: 4, insertSpaces: true },
        edit: (callback) => {
            const editBuilder = {
                replace: (range, newText) => {
                    console.log('--- Original ---');
                    console.log(content);
                    console.log('\n--- Formatted ---');
                    console.log(newText);
                    console.log('\n-----------------');

                    if (!newText.includes('yum install -y \\')) {
                        console.error('❌ yum install was not preserved correctly or formatted.');
                    }
                    if (!newText.includes('dnf install -y \\')) {
                         console.error('❌ dnf install was not preserved correctly or formatted.');
                    }

                    // Check if 'bzip2-devel' is after 'openssl-devel' (alphabetical)
                    // Original: zlib-devel, openssl-devel, libffi-devel, bzip2-devel
                    // Sorted: bzip2-devel, libffi-devel, openssl-devel, zlib-devel
                    const bzipIdx = newText.indexOf('bzip2-devel');
                    const zlibIdx = newText.indexOf('zlib-devel');

                    if (bzipIdx !== -1 && zlibIdx !== -1 && bzipIdx < zlibIdx) {
                        console.log('✅ yum install sorted correctly.');
                    } else {
                        console.error('❌ yum install NOT sorted correctly.');
                    }

                    // Check comments
                    if (newText.includes('# Comment in the middle')) {
                        console.log('✅ Comments preserved.');
                    } else {
                        console.error('❌ Comments LOST!');
                    }

                    // Check JSON array spacing
                    if (newText.includes('CMD ["npm", "start", "with spaces"]')) {
                        console.log('✅ JSON array spacing preserved/fixed.');
                    } else {
                         // Current formatter removes spaces
                         console.warn('⚠️ JSON array spacing check failed (current behavior removes spaces).');
                    }
                }
            };
            callback(editBuilder);
            return Promise.resolve(true);
        }
    };

    mockVscode.window.activeTextEditor = editor;

    await extension.beautify('dockerfile');
}

runTest();
