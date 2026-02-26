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
    console.log('Running SCSS Map Deep Formatting Verification...');
    let Web;
    try {
        Web = require('./out/formatters/web');
    }
    catch (e) {
        console.error('Could not load web formatter. Make sure to run "npm run compile" first.');
        console.error(e);
        process.exit(1);
    }

    // Force failure of Prettier to test Deep Formatter fallback
    // We can't easily force Prettier failure here without mocking require('prettier')
    // But we can rely on the fact that Prettier might not be installed in the CI env or we can
    // patch require to throw for prettier?
    // Actually, let's just assume we want to test the deep formatter logic directly if possible,
    // or rely on handleSCSS to call it.
    // If Prettier is present, it will format nicely too.
    // The goal is to verify that formatting is GOOD, regardless of which engine did it.
    // But since I'm modifying the deep formatter, I want to ensure it works when Prettier fails.
    // However, I can't easily modify the require cache to fail prettier without complex mocking.
    // Let's just check the output. If Prettier is used, it should be good.
    // If I want to test my custom logic specifically, I should import formatSCSSDeep directly?
    // But formatSCSSDeep is not exported from 'web.ts'.
    // It is exported from 'scss_deep_formatter.ts'.
    // Let's try to require that directly.

    let formatSCSSDeep;
    try {
        formatSCSSDeep = require('./out/formatters/scss_deep_formatter').formatSCSSDeep;
    } catch (e) {
        console.error('Could not load formatSCSSDeep directly.');
    }

    const testCases = [
        {
            file: 'test.map.scss',
            expected: `// Multiline Map Test
$breakpoints: (
  small: 320px,
  medium: 768px,
  large: 1024px
);

// Map Merge
$new-breakpoints: map-merge($breakpoints, (
  xlarge: 1200px
));

// Map Get
.container {
  @media (min-width: map-get($breakpoints, medium)) {
    width: 80%;
  }
}

// Complex Map
$theme-colors: (
  "primary": (
    "base": #3b5998,
    "light": lighten(#3b5998, 15%),
    "dark": darken(#3b5998, 15%)
  ),
  "secondary": (
    "base": #8b9dc3,
    "light": lighten(#8b9dc3, 15%),
    "dark": darken(#8b9dc3, 15%)
  )
);
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

        // Test using the direct deep formatter if available
        if (formatSCSSDeep) {
             console.log('Using formatSCSSDeep directly...');
             try {
                 const formatted = formatSCSSDeep(content);
                 const actual = formatted.replace(/\r\n/g, '\n').trim();
                 const expected = testCase.expected.replace(/\r\n/g, '\n').trim();

                 if (actual === expected) {
                     console.log(`✅ ${testCase.file} passed (Direct Deep).`);
                     passed++;
                 } else {
                     console.error(`❌ ${testCase.file} failed (Direct Deep).`);
                     console.error('--- Expected ---');
                     console.error(expected);
                     console.error('--- Actual ---');
                     console.error(actual);
                     failed++;
                 }
             } catch (err) {
                 console.error(`❌ Error testing ${testCase.file} (Direct Deep):`, err);
                 failed++;
             }
        } else {
            console.warn('Skipping direct deep formatter test (module not found).');
        }
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
