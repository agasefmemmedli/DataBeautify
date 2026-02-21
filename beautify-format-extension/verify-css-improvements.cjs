"use strict";
// Minimal verification script for CSS Improvements
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
    workspace: { applyEdit: async () => true },
    options: { tabSize: 2, insertSpaces: true }
};

// Injection for vscode require
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'vscode') return mockVscode;
    return originalRequire.apply(this, arguments);
};

const Web = require('./out/formatters/web'); // Ensure this points to compiled JS

async function runTests() {
    console.log('Running CSS Improvement Verification...');

    const testCases = [
        {
            name: 'Import Sorting (Broken Syntax)',
            input: `@import 'b.css';
@charset "UTF-8";
@import 'a.css';

body { color: red`,
            expected: `@charset "UTF-8";
@import 'a.css';
@import 'b.css';

body {
  color: red;
}
`
        },
        {
            name: 'Broken Syntax Recovery',
            input: `div { color: red`,
            expected: `div {
  color: red;
}
`
        },
        {
            name: 'Hex Normalization (Broken Syntax)',
            input: `div { color: #FFFFFF; background: #AbCdEf`,
            expected: `div {
  color: #ffffff;
  background: #abcdef;
}
`
        },
        {
            name: 'Zero Unit Removal (Broken Syntax)',
            input: `div { margin: 0px 10px 0em 0%`,
            expected: `div {
  margin: 0 10px 0 0%;
}
`
        },
        {
            name: 'Whitespace Preservation (Broken Syntax)',
            input: `div::before { content: "   "; attr: [class~="foo  bar"]`,
            expected: `div::before {
  content: "   ";
  attr: [class~="foo  bar"];
}
`
        },
        {
            name: 'Hex URL Safety (Broken Syntax)',
            input: `div { background: url(#MyDef) #ABC`,
            expected: `div {
  background: url(#MyDef) #abc;
}
`
        }
    ];

    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
        console.log(`\nTesting: ${testCase.name}`);
        let formattedText = '';

        const lines = testCase.input.split('\n');
        const mockEditor = {
            options: { tabSize: 2, insertSpaces: true },
            document: {
                getText: () => testCase.input,
                lineCount: lines.length,
                lineAt: (line) => ({
                    range: {
                        start: { line, character: 0 },
                        end: { line, character: lines[line]?.length || 0 }
                    }
                }),
                uri: { fsPath: 'test.css' }, // dummy path
                positionAt: (offset) => ({ line: 0, character: offset }) // Minimal mock
            },
            edit: async (callback) => {
                const eb = {
                    replace: (range, text) => { formattedText = text; }
                };
                callback(eb);
                return true;
            }
        };

        try {
            await Web.handleCSS(mockEditor, testCase.input);

            // Normalize newlines for comparison
            const actual = formattedText.trim().replace(/\r\n/g, '\n');
            const expected = testCase.expected.trim().replace(/\r\n/g, '\n');

            if (actual === expected) {
                console.log(`✅ Passed.`);
                passed++;
            } else {
                console.error(`❌ Failed.`);
                console.error('Expected:\n' + expected);
                console.error('Actual:\n' + actual);
                failed++;
            }
        } catch (err) {
            console.error(`❌ Error:`, err);
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
