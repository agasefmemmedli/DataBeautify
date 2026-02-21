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
        applyEdit: async () => true
    }
};

// Injection to handle 'import * as vscode from "vscode"'
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'vscode') {
        return mockVscode;
    }
    return originalRequire.apply(this, arguments);
};

async function runTests() {
    console.log('Running SCSS Deep Formatting Verification...');
    let Web;
    try {
        Web = require('./out/formatters/web');
    }
    catch (e) {
        console.error('Could not load web formatter. Make sure to run "npm run compile" first.');
        console.error(e);
        process.exit(1);
    }

    const testCases = [
        {
            file: 'test.deep.scss',
            // Expected Prettier output (assuming standard config)
            expected: `// Variables
$font-stack: Helvetica, sans-serif;
$primary-color: #333;

// Mixin
@mixin theme($theme: DarkGray) {
  background: $theme;
  box-shadow: 0 0 1px rgba($theme, 0.25);
  color: #fff;
}

// Nesting & Extend
.message {
  border: 1px solid #ccc;
  padding: 10px;
  color: $primary-color;

  .header {
    font-weight: bold;
    font-family: $font-stack;
  }

  .body {
    font-size: 14px;
    a {
      text-decoration: none;
      &:hover {
        text-decoration: underline;
      }
    }
  }

  &.success {
    @include theme(Green);
    border-color: Green;
  }

  &.error {
    @include theme(Red);
    border-color: Red;
  }
}

// Math
.container {
  width: 100% - 20px;
  padding: 10px + 5px;
}
`
        }
    ];

    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
        console.log(`\nTesting ${testCase.file}...`);
        const filePath = path.join('.', testCase.file);

        if (!fs.existsSync(filePath)) {
            console.error(`File ${testCase.file} not found!`);
            failed++;
            continue;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        // Mock Editor
        let formattedText = '';
        const mockEditor = {
            options: {
                tabSize: 2,
                insertSpaces: true
            },
            document: {
                getText: () => content,
                lineCount: lines.length,
                lineAt: (line) => ({
                    range: {
                        start: { line, character: 0 },
                        end: { line, character: lines[line]?.length || 0 }
                    }
                }),
                languageId: 'scss',
                positionAt: (offset) => ({ line: 0, character: offset }),
                uri: { fsPath: filePath }
            },
            edit: async (callback) => {
                const eb = {
                    replace: (range, text) => {
                        formattedText = text;
                    }
                };
                await callback(eb);
                return true;
            }
        };

        mockVscode.window.activeTextEditor = mockEditor;

        try {
            await Web.handleSCSS(mockEditor, content);

            if (testCase.expected) {
                // Normalize newlines
                const actual = formattedText.replace(/\r\n/g, '\n').trim();
                const expected = testCase.expected.replace(/\r\n/g, '\n').trim();

                if (actual === expected) {
                    console.log(`✅ ${testCase.file} passed.`);
                    passed++;
                } else {
                    console.error(`❌ ${testCase.file} failed.`);
                    console.error('--- Expected ---');
                    console.error(expected);
                    console.error('--- Actual ---');
                    console.error(actual);
                    failed++;
                }
            }
        } catch (err) {
            console.error(`❌ Error testing ${testCase.file}:`, err);
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
