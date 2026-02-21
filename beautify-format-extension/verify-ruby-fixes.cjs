
const fs = require('fs');
const path = require('path');

// Mock VS Code
const mockVscode = {
    window: {
        activeTextEditor: undefined,
        showInformationMessage: (msg) => console.log('INFO:', msg),
        showErrorMessage: (msg) => console.log('ERROR:', msg),
        showWarningMessage: (msg) => console.log('WARN:', msg),
    },
    Range: class { constructor(start, end) { this.start = start; this.end = end; } },
    Position: class { constructor(line, character) { this.line = line; this.character = character; } },
    commands: { registerCommand: () => ({ dispose: () => { } }) },
    workspace: { applyEdit: async () => true },
    WorkspaceEdit: class { replace(uri, range, newText) {} }
};

const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'vscode') return mockVscode;
    return originalRequire.apply(this, arguments);
};

async function runTest() {
    const { beautify } = require('./out/extension');
    const testFile = 'test.ruby_fixes.rb';
    console.log(`Testing ${testFile}...`);
    const filePath = path.join(__dirname, testFile);
    const content = fs.readFileSync(filePath, 'utf8');

    let formattedText = '';
    const mockEditor = {
        options: { tabSize: 2, insertSpaces: true },
        document: {
            getText: () => content,
            lineCount: content.split('\n').length,
            languageId: 'ruby',
            uri: { fsPath: filePath },
            lineAt: (line) => {
                const text = content.split('\n')[line] || '';
                return { text, range: {}, rangeIncludingLineBreak: {}, lineNumber: line, isEmptyOrWhitespace: text.trim().length === 0 };
            }
        },
        edit: async (callback) => {
            callback({ replace: (range, text) => { formattedText = text; } });
            return true;
        }
    };
    mockVscode.window.activeTextEditor = mockEditor;

    await beautify('ruby');
    console.log('--- Formatted ---');
    console.log(formattedText);

    // Checks
    if (formattedText.includes('x = -1')) console.log('✅ x = -1 preserved');
    else console.error('❌ x = -1 failed');

    if (formattedText.includes('return if x < 0')) console.log('✅ return if preserved');
    else console.error('❌ return if failed');

    // Check indentation of puts
    const lines = formattedText.split('\n');
    const putsLine = lines.find(l => l.trim().startsWith('puts "Should not be indented"'));
    if (putsLine && putsLine.startsWith('  puts')) console.log('✅ Indentation correct after guard clause');
    else console.error(`❌ Indentation wrong: "${putsLine}"`);

    // Check comments spacing
    if (formattedText.includes('a = 1 # Comment 1\n  b = 2')) console.log('✅ Comment vertical spacing correct');
    else console.error('❌ Comment vertical spacing failed');
}

runTest();
