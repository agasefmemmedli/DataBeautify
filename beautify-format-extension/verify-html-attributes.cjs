"use strict";
// Minimal VS Code Mock
const mockVscode = {
    window: {
        activeTextEditor: undefined,
        showInformationMessage: (msg) => console.log('INFO:', msg),
        showErrorMessage: (msg) => console.log('ERROR:', msg),
        showWarningMessage: (msg) => console.log('WARN:', msg),
    },
    Range: class {},
    Position: class {},
    commands: { registerCommand: () => ({ dispose: () => { } }) },
    workspace: { applyEdit: async () => true }
};

// Injection
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'vscode') return mockVscode;
    return originalRequire.apply(this, arguments);
};

async function runTests() {
    console.log('Running HTML Attribute Escaping Verification...');
    let formatHTMLDeep;
    try {
        const deepModule = require('./out/formatters/html_deep_formatter');
        formatHTMLDeep = deepModule.formatHTMLDeep;
    } catch (e) {
        console.error('Could not load formatter.', e);
        process.exit(1);
    }

    const input = `<div data-json='{"id": 1}'></div>\n<a href="foo&bar"></a>\n<span class="foo 'bar'"></span>`;
    const expected = `<div data-json="{&quot;id&quot;: 1}"></div>\n<a href="foo&bar"></a>\n<span class="foo 'bar'"></span>`;

    const output = formatHTMLDeep(input, { tabSize: 2, insertSpaces: true });

    // The output might differ in whitespace due to formatting rules (newlines, indent)
    // formatHTMLDeep splits tags onto new lines?
    // <div ...></div> -> indent 0.
    // <a ...></a> -> indent 0.
    // <span ...></span> -> indent 0.

    // Let's check if the attributes are correctly escaped.

    console.log('Output:\n' + output);

    if (output.includes('data-json="{&quot;id&quot;: 1}"')) {
        console.log('✅ Double quotes in attributes escaped correctly.');
    } else {
        console.error('❌ Double quotes escaping failed.');
        process.exit(1);
    }

    if (output.includes('href="foo&bar"')) {
        console.log('✅ Other attributes preserved.');
    } else {
        console.error('❌ href attribute broken.');
        process.exit(1);
    }

    if (output.includes('class="foo \'bar\'"')) {
        console.log('✅ Single quotes inside double quotes preserved.');
    } else {
        console.error('❌ Single quotes handling broken.');
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
