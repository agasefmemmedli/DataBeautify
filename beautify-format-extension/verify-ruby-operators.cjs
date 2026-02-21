
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
    const testFile = 'test.ruby_operators.rb';
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
    if (formattedText.includes('=== "abc"')) console.log('✅ === preserved');
    else console.error('❌ === failed');

    if (formattedText.includes('**= 2')) console.log('✅ **= preserved');
    else console.error('❌ **= failed');

    if (formattedText.includes('||= 1')) console.log('✅ ||= preserved');
    else console.error('❌ ||= failed');

    if (formattedText.includes('1...10')) console.log('✅ ... preserved');
    else console.error('❌ ... failed');

    if (formattedText.includes('$global_var')) console.log('✅ $global_var preserved');
    else console.error('❌ $global_var failed');

    if (formattedText.includes('0xFF')) console.log('✅ 0xFF preserved');
    else console.error('❌ 0xFF failed');
}

runTest();
