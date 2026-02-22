const fs = require('fs');
const path = require('path');

// Mock VS Code
const mockVscode = {
    window: {
        activeTextEditor: undefined,
        showInformationMessage: (msg) => console.log('INFO:', msg),
        showErrorMessage: (msg) => console.error('ERROR:', msg),
        showWarningMessage: (msg) => console.warn('WARN:', msg),
    },
    Range: class { constructor(start, end) { this.start = start; this.end = end; } },
    Position: class { constructor(line, character) { this.line = line; this.character = character; } },
    commands: { registerCommand: () => ({ dispose: () => { } }) },
    workspace: { applyEdit: async () => true, getConfiguration: () => ({ get: (key, def) => def }) },
    WorkspaceEdit: class { replace(uri, range, newText) {} }
};

const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'vscode') return mockVscode;
    return originalRequire.apply(this, arguments);
};

async function runTests() {
    console.log('Running SASS Deep Formatting Verification...');
    let Web;
    try {
        // We require the compiled output
        Web = require('./out/formatters/web');
    } catch (e) {
        console.error('Could not load web formatter. Make sure to run "npm run compile" first.');
        console.error(e);
        process.exit(1);
    }

    const testFile = 'test.deep.sass';
    const filePath = path.join(__dirname, testFile);

    if (!fs.existsSync(filePath)) {
        console.error(`File ${testFile} not found!`);
        process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let formattedText = '';

    const mockEditor = {
        options: { tabSize: 2, insertSpaces: true },
        document: {
            getText: () => content,
            lineCount: lines.length,
            languageId: 'sass',
            uri: { fsPath: filePath },
            lineAt: (line) => ({
                range: {
                    start: { line, character: 0 },
                    end: { line, character: lines[line]?.length || 0 }
                },
                text: lines[line] || ''
            })
        },
        edit: async (callback) => {
            const eb = { replace: (range, text) => { formattedText = text; } };
            await callback(eb);
            return true;
        }
    };
    mockVscode.window.activeTextEditor = mockEditor;

    try {
        await Web.handleSASS(mockEditor, content);

        console.log('--- Formatted Output ---');
        console.log(formattedText);
        console.log('------------------------');

        if (!formattedText) {
            console.error('❌ Formatted text is empty!');
            process.exit(1);
        }

        // Verification Logic
        // 1. Check indentation (2 spaces)
        if (!formattedText.includes('  ul') || !formattedText.includes('    margin: 0')) {
            console.error('❌ Indentation check failed. Expected 2-space indentation hierarchy.');
            process.exit(1);
        }

        // 3. Check faulty indentation fix
        if (!formattedText.includes('    display: inline-block')) {
             console.error('❌ Faulty indentation fix failed. Expected "    display: inline-block".');
             process.exit(1);
        }

        // 4. Check logic block indentation
        if (!formattedText.includes('  body') || !formattedText.includes('    background-color: #fff')) {
             console.error('❌ Logic block indentation fix failed.');
             process.exit(1);
        }

        console.log('✅ SASS Deep Formatting Verified!');

    } catch (err) {
        console.error('❌ Error during formatting:', err);
        process.exit(1);
    }
}

runTests();
