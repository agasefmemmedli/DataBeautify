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

// Mock SassFormatter to throw error
const mockSassFormatter = {
    SassFormatter: {
        Format: () => { throw new Error('Forced failure to test Deep Formatter'); }
    }
};

const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'vscode') return mockVscode;
    if (id === 'sass-formatter') return mockSassFormatter;
    return originalRequire.apply(this, arguments);
};

async function runTests() {
    console.log('Running SASS Deep Formatting (Forced Fallback) Verification...');
    let Web;
    try {
        Web = require('./out/formatters/web');
    } catch (e) {
        console.error('Could not load web formatter. Make sure to run "npm run compile" first.');
        console.error(e);
        process.exit(1);
    }

    // Test Content
    const content = `// Variable definition
$font-stack: Helvetica, sans-serif
$primary-color: #333333

// Mixin with multiple lines and params
@mixin border-radius($radius)
  -webkit-border-radius: $radius
     -moz-border-radius: $radius
  -ms-border-radius: $radius
      border-radius: $radius

// Nested rules with messed up indentation
nav
  ul
    margin: 0px
    padding: 0
    list-style: none

  li
 display: inline-block

  a
    display: block
    padding: 6px 12px
    text-decoration: none

// Unquoted Data URI test
.logo
  background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=)
  height: 10px

// Comment Indentation Drift Test
.rule
  // Indented comment
  color: red
  background: blue

// Logic block
@if $primary-color == #333
     body
    background-color: #fff
    color: $primary-color
`;

    const lines = content.split('\n');
    let formattedText = '';

    const mockEditor = {
        options: { tabSize: 2, insertSpaces: true },
        document: {
            getText: () => content,
            lineCount: lines.length,
            languageId: 'sass',
            uri: { fsPath: 'test.sass' },
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

        // Verification Logic

        // 1. Check indentation hierarchy
        if (!formattedText.includes('  ul') || !formattedText.includes('    margin: 0')) {
            throw new Error('Indentation check failed. Expected 2-space indentation hierarchy.');
        }

        // 2. Check faulty indentation fix
        if (!formattedText.includes('    display: inline-block')) {
             throw new Error('Faulty indentation fix failed. Expected "    display: inline-block".');
        }

        // 3. Check Data URI preservation (no extra spaces)
        if (formattedText.includes('data:image/png;base64, iVBOR')) {
             throw new Error('Data URI corruption detected! Spaces added after commas in url().');
        }
        if (!formattedText.includes('url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=)')) {
             throw new Error('Data URI failed to verify correctly.');
        }

        // 4. Check Comment Indentation Drift
        // .rule
        //   // Indented comment
        //   color: red
        // Expected: color: red indented at 2 spaces (inside .rule).
        // If drift occurred, it might be 4 spaces or aligned weirdly.
        if (!formattedText.includes('  // Indented comment')) {
             throw new Error('Comment indentation failed.');
        }
        if (!formattedText.includes('\n  color: red')) {
            // It should be strictly indented 2 spaces
            // Check via regex to ensure only 2 spaces
            if (formattedText.match(/(\n|^)    color: red/)) {
                 throw new Error('Indentation drift detected! "color: red" is indented 4 spaces, expected 2.');
            }
            if (!formattedText.match(/(\n|^)  color: red/)) {
                 throw new Error('"color: red" missing or wrong indent.');
            }
        }

        // 5. Check Hex Shrinking
        if (!formattedText.includes('$primary-color: #333')) {
            throw new Error('Hex shrinking failed. Expected #333.');
        }

        // 6. Check Zero Unit Removal
        if (!formattedText.includes('margin: 0')) {
            throw new Error('Zero unit removal failed. Expected "margin: 0".');
        }

        console.log('✅ SASS Deep Formatting (Fallback) Verified Successfully!');

    } catch (err) {
        console.error('❌ Verification Failed:', err.message);
        process.exit(1);
    }
}

runTests();
