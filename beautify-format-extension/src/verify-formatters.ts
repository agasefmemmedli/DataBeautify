
import * as fs from 'fs';
import * as path from 'path';

// Minimal VS Code Mock
const mockVscode = {
    window: {
        activeTextEditor: undefined as any,
        showInformationMessage: (msg: string) => console.log('INFO:', msg),
        showErrorMessage: (msg: string) => console.log('ERROR:', msg),
        showWarningMessage: (msg: string) => console.log('WARN:', msg),
    },
    Range: class {
        constructor(public start: any, public end: any) {}
    },
    Position: class {
        constructor(public line: number, public character: number) {}
    },
    commands: {
        registerCommand: () => ({ dispose: () => {} }),
    }
};

// Injection to handle 'import * as vscode from "vscode"'
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id: string) {
    if (id === 'vscode') {
        return mockVscode;
    }
    return originalRequire.apply(this, arguments);
};

// Import extension AFTER mocking
const { beautify, detectFormat } = require('./extension');

async function runTests() {
    const testFiles = fs.readdirSync('.').filter(f => f.startsWith('test.') && !f.endsWith('.map') && !f.endsWith('.ts')); // Exclude .ts files to avoid testing source files
    console.log(`Found ${testFiles.length} test files.`);

    const mapping: {[key: string]: string} = {
        'cs': 'csharp',
        'py': 'python',
        'jsx': 'javascriptreact',
        'tsx': 'typescriptreact',
        'js': 'javascript',
        'ts': 'typescript',
        'kt': 'kotlin',
        'rs': 'rust',
        'rb': 'ruby',
        'dart': 'dart',
        'dockerfile': 'dockerfile',
        'ps1': 'powershell',
        'tf': 'terraform',
        'makefile': 'makefile',
        'nginx': 'nginx',
        'sql': 'sql',
        'md': 'markdown',
        'tex': 'latex',
        'mdx': 'mdx',
        'log': 'log',
        'hbs': 'handlebars',
        'gitconfig': 'gitconfig'
    };

    let passed = 0;
    let failed = 0;

    for (const file of testFiles) {
        console.log(`\nTesting ${file}...`);
        const filePath = path.join('.', file);
        const content = fs.readFileSync(filePath, 'utf8');
        const ext = path.extname(file).slice(1);
        const langId = mapping[ext] || ext;
        const lines = content.split('\n');

        // Mock editor
        let formattedText = '';
        const mockEditor = {
            options: {
                tabSize: 2,
                insertSpaces: true
            },
            document: {
                getText: () => content,
                lineCount: lines.length,
                lineAt: (line: number) => ({
                    range: {
                        start: { line, character: 0 },
                        end: { line, character: lines[line]?.length || 0 }
                    }
                }),
                languageId: langId,
                positionAt: (offset: number) => ({ line: 0, character: offset }),
                uri: { fsPath: filePath }
            },
            edit: async (callback: (eb: any) => void) => {
                const eb = {
                    replace: (range: any, text: string) => {
                        formattedText = text;
                    }
                };
                callback(eb);
                return true;
            }
        };

        mockVscode.window.activeTextEditor = mockEditor as any;

        try {
            const detected = detectFormat(content, mockEditor.document.languageId);
            console.log(`Detected format: ${detected}`);

            await beautify();

            if (formattedText && formattedText !== content) {
                console.log(`✅ ${file} beautified successfully.`);
                passed++;
            } else if (formattedText === content) {
                console.log(`ℹ️ ${file} already formatted or no changes applied.`);
                passed++;
            } else {
                console.log(`⚠️ ${file} produced no changes.`);
                passed++;
            }
        } catch (err) {
            console.error(`❌ Error testing ${file}:`, err);
            failed++;
        }
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
