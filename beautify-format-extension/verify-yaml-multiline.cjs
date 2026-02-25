"use strict";

const { formatYAMLDeep } = require('./out/formatters/yaml_deep_formatter');
const fs = require('fs');

async function runTests() {
    console.log('Running YAML Multiline Verification...');

    const brokenInput = `
description: |
  This line: looks like a key
  And this one too: value
`;

    // Flow sequence example (though currently not failing, good to check)
    const flowInput = `
key: [ "start
  val: ue", "end" ]
`;

    const expectedMultiline = `description: |
  This line: looks like a key
  And this one too: value
`;
    // Note: Standard YAML formatting might change indentation slightly or quotes, but alignment inside string should be preserved.
    // Specifically, "looks like a key" should NOT be padded if it was interpreted as value.
    // If aligned, it would be "This line:        looks like a key".

    try {
        const output = formatYAMLDeep(brokenInput);
        console.log('Output 1:\n' + output);

        if (output.includes('This line:        looks like a key')) {
            console.error('❌ Failed: Multiline string content was aligned as key-value!');
            process.exit(1);
        }

        if (output.includes('This line: looks like a key')) {
            console.log('✅ Passed: Multiline string content preserved.');
        } else {
            console.error('❌ Failed: Unexpected output format.');
            process.exit(1);
        }

        const output2 = formatYAMLDeep(flowInput);
        console.log('Output 2:\n' + output2);

        if (output2.includes('val:        ue')) {
             console.error('❌ Failed: Flow string content was aligned!');
             process.exit(1);
        }

        console.log('✅ Verification run completed.');

    } catch (e) {
        console.error('❌ Error during verification:', e);
        process.exit(1);
    }
}

runTests();
