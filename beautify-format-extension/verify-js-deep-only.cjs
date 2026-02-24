const fs = require('fs');
const path = require('path');

async function runTests() {
    console.log('Running JS Deep Formatting Verification (verify-js-deep-only.cjs)...');
    let jsDeepFormatter;
    try {
        jsDeepFormatter = require('./out/formatters/js_deep_formatter');
    } catch (e) {
        console.error('Could not load JS deep formatter. Make sure to run "npm run compile" first.');
        console.error(e);
        process.exit(1);
    }

    const { formatJSDeep } = jsDeepFormatter;

    // Test case: Template literal with unformatted interpolation
    const input = 'const x = `Value: ${  a+b  }`;';
    // Expected output should have formatted interpolation
    const expected = 'const x = `Value: ${a + b}`;';

    try {
        const formatted = formatJSDeep(input, {
            tabSize: 4,
            insertSpaces: true,
            printWidth: 120
        });

        console.log('Input:    ', input);
        console.log('Formatted:', formatted.trim());
        console.log('Expected: ', expected);

        if (formatted.trim() === expected) {
            console.log('✅ JS Deep Formatting (Template Interpolation) PASSED');
        } else {
            console.error('❌ JS Deep Formatting (Template Interpolation) FAILED');
            console.error('Actual:   ', formatted.trim());
            console.error('Expected: ', expected);
            // We want to see it fail initially
             process.exit(1);
        }

    } catch (err) {
        console.error('❌ Error testing JS Deep Formatting:', err);
        process.exit(1);
    }
}

runTests();
