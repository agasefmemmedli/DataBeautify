const fs = require('fs');
const path = require('path');

// Mock VS Code
const vscode = {
    window: {
        activeTextEditor: undefined,
        showInformationMessage: (msg) => console.log('INFO:', msg),
        showErrorMessage: (msg) => console.error('ERROR:', msg),
        showWarningMessage: (msg) => console.warn('WARN:', msg),
    },
    Range: class {},
    Position: class {},
};

// Mock the module
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
    if (id === 'vscode') return vscode;
    return originalRequire.apply(this, arguments);
};

const { beautify, detectFormat } = require('./out/extension');

async function test(filename) {
    console.log('--- ' + filename + ' ---');
    const fullPath = path.join(__dirname, filename);
    const content = fs.readFileSync(fullPath, 'utf8');
    let formattedText = '';
    const mockEditor = {
        document: {
            getText: () => content,
            lineCount: content.split('\n').length,
            lineAt: (line) => ({ range: { start: { line, character: 0 }, end: { line, character: 100 } } }),
            languageId: 'log',
            positionAt: (offset) => ({ line: 0, character: offset }),
        },
        edit: async (callback) => {
            const eb = {
                replace: (range, text) => { formattedText = text; }
            };
            callback(eb);
            return true;
        }
    };
    vscode.window.activeTextEditor = mockEditor;
    await beautify('log');
    console.log(formattedText);
}

test('test.log').then(() => test('test-broken.log'));
