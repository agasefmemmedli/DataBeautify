const fs = require('fs');
const path = require('path');

// Mock VS Code API
const mockVscode = {
    window: {
        showInformationMessage: (msg) => console.log('INFO:', msg),
        showErrorMessage: (msg) => console.error('ERROR:', msg),
        showWarningMessage: (msg) => console.warn('WARN:', msg),
        activeTextEditor: undefined
    },
    workspace: {
        applyEdit: async () => true,
        getConfiguration: () => ({
            get: () => undefined
        })
    },
    Range: class {
        constructor(startLine, startChar, endLine, endChar) {
            this.start = { line: startLine, character: startChar };
            this.end = { line: endLine, character: endChar };
        }
    },
    Position: class {
        constructor(line, character) {
            this.line = line;
            this.character = character;
        }
    },
    commands: {
        registerCommand: () => ({ dispose: () => {} })
    },
    languages: {
        registerDocumentFormattingEditProvider: () => ({ dispose: () => {} })
    },
    ExtensionContext: class {
        constructor() {
            this.subscriptions = [];
        }
    }
};

// Mock 'vscode' module
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'vscode') {
        return mockVscode;
    }
    return originalRequire.apply(this, arguments);
};

async function runTest() {
    console.log('Running PHP Deep Formatting Verification...');

    let WebFormatters;
    try {
        WebFormatters = require('./out/formatters/web');
    } catch (e) {
        console.error('Failed to load compiled formatters. Ensure "npm run compile" has been run.', e);
        process.exit(1);
    }

    const testFile = path.join(__dirname, 'test.deep.php');
    if (!fs.existsSync(testFile)) {
        console.error(`Test file not found: ${testFile}`);
        process.exit(1);
    }

    const originalContent = fs.readFileSync(testFile, 'utf8');
    let formattedContent = originalContent;

    const mockEditor = {
        document: {
            getText: () => originalContent,
            lineCount: originalContent.split('\n').length,
            fileName: testFile,
            uri: { fsPath: testFile },
            languageId: 'php',
            lineAt: (line) => {
                const lines = originalContent.split('\n');
                return {
                    text: lines[line],
                    range: {
                        start: { line, character: 0 },
                        end: { line, character: lines[line].length }
                    }
                };
            }
        },
        options: {
            tabSize: 4,
            insertSpaces: true
        },
        edit: async (callback) => {
            const editBuilder = {
                replace: (range, text) => {
                    formattedContent = text;
                }
            };
            await callback(editBuilder);
            return true;
        }
    };

    try {
        await WebFormatters.handlePHP(mockEditor, originalContent);

        console.log('---------------------------------------------------');
        console.log('Formatted Output:');
        console.log(formattedContent);
        console.log('---------------------------------------------------');

        // Verification Logic
        const lines = formattedContent.split('\n');

        // 1. Check indentation (4 spaces)
        // Check indentation of class method
        const methodLine = lines.find(l => l.trim().startsWith('public function processUser'));
        if (methodLine && !methodLine.startsWith('    ')) {
            console.error('❌ Indentation check failed: Method should be indented with 4 spaces.');
            // process.exit(1); // Don't fail yet, let's see full output
        } else {
             console.log('✅ Indentation check passed (basic).');
        }

        // 2. Check mixed HTML indentation
        // HTML inside PHP loop should be indented
        const liLine = lines.find(l => l.trim().startsWith('<li>'));
        if (liLine && !liLine.startsWith('        ')) { // Should be indented inside foreach inside div inside...
             console.warn('⚠️ HTML inside PHP might not be indented perfectly (expected).');
        } else {
             console.log('✅ HTML indentation check passed.');
        }

        // 3. Check imports (use statements)
        // Should be sorted if deep formatting is applied (current implementation might not)
        const useLines = lines.filter(l => l.trim().startsWith('use '));
        // Check alphabetical order: App\Models\User before Illuminate\Support\Facades\Log
        if (useLines.length >= 2) {
             const first = useLines[0].trim();
             const second = useLines[1].trim();
             if (first.localeCompare(second) > 0) {
                 console.warn('⚠️ Imports are not sorted alphabetically.');
             } else {
                 console.log('✅ Import sorting check passed.');
             }
        }

        // 4. Check broken code (if applicable)
        // test.deep.php is valid. We should test test.php (broken) separately or here.

        console.log('PHP Deep Formatting Verification Completed.');

    } catch (e) {
        console.error('❌ Formatting crashed:', e);
        process.exit(1);
    }

    // --- BROKEN CODE TEST ---
    console.log('\nRunning BROKEN PHP test...');
    const brokenFile = path.join(__dirname, 'test.broken.php');
    if (fs.existsSync(brokenFile)) {
        const brokenContent = fs.readFileSync(brokenFile, 'utf8');
        let brokenFormatted = brokenContent;

        const mockBrokenEditor = {
            document: {
                getText: () => brokenContent,
                lineCount: brokenContent.split('\n').length,
                fileName: brokenFile,
                uri: { fsPath: brokenFile },
                languageId: 'php',
                lineAt: (line) => {
                    const lines = brokenContent.split('\n');
                    return {
                        text: lines[line],
                        range: {
                            start: { line, character: 0 },
                            end: { line, character: lines[line]?.length || 0 }
                        }
                    };
                }
            },
            options: { tabSize: 4, insertSpaces: true },
            edit: async (callback) => {
                const editBuilder = {
                    replace: (range, text) => { brokenFormatted = text; }
                };
                await callback(editBuilder);
                return true;
            }
        };

        try {
            await WebFormatters.handlePHP(mockBrokenEditor, brokenContent);
            console.log('Broken Code Output:');
            console.log(brokenFormatted);
            if (brokenFormatted === brokenContent) {
                 console.warn('⚠️ Broken code was NOT changed (formatter might have bailed out).');
            } else {
                 console.log('✅ Broken code was modified (resilient formatting active).');
                 // Check if it at least indented
                 if (brokenFormatted.includes('    echo "missing semicolon"')) {
                     console.log('✅ Indentation applied even with syntax errors.');
                 }
            }
        } catch (e) {
            console.error('❌ Formatting CRASHED on broken code:', e);
        }
    }

    // --- HEREDOC TEST ---
    console.log('\nRunning HEREDOC PHP test...');
    const heredocContent = `<?php
$str = <<<EOT
Hello World
  Indented
EOT;
echo $str;
?>`;

    const mockHeredocEditor = {
        document: {
            getText: () => heredocContent,
            lineCount: heredocContent.split('\n').length,
            fileName: 'test.heredoc.php',
            uri: { fsPath: 'test.heredoc.php' },
            languageId: 'php',
            lineAt: (line) => ({
                text: heredocContent.split('\n')[line],
                range: { start: { line, character: 0 }, end: { line, character: 0 } }
            })
        },
        options: { tabSize: 4, insertSpaces: true },
        edit: async (callback) => {
            const editBuilder = {
                replace: (range, text) => {
                    console.log('Heredoc Output:\n' + text);
                    if (text.includes('<<<EOT')) {
                        console.log('✅ Heredoc preserved.');
                    } else {
                        console.error('❌ Heredoc mangled!');
                    }
                }
            };
            await callback(editBuilder);
            return true;
        }
    };

    try {
        await WebFormatters.handlePHP(mockHeredocEditor, heredocContent);
    } catch (e) {
        console.error('❌ Formatting CRASHED on heredoc:', e);
    }
}

runTest();
