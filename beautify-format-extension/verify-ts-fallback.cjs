
const fs = require('fs');
const path = require('path');

async function runTests() {
    console.log('Running JS Deep Formatter (Fallback) Verification...');
    let formatJSDeep;
    try {
        const module = require('./out/formatters/js_deep_formatter');
        formatJSDeep = module.formatJSDeep;
    }
    catch (e) {
        console.error('Could not load js_deep_formatter. Make sure to run "npm run compile" first.');
        console.error(e);
        process.exit(1);
    }

    const testFile = 'test.deep.ts';
    const filePath = path.join(__dirname, testFile);
    if (!fs.existsSync(filePath)) {
        console.error(`File ${testFile} not found!`);
        process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf8');

    try {
        const formattedText = formatJSDeep(content, {
            tabSize: 4,
            insertSpaces: true
        });

        console.log('Formatted Output (Fallback):\n---------------------------------------------------');
        console.log(formattedText);
        console.log('---------------------------------------------------');

        if (!formattedText) {
            console.error('❌ Formatting returned empty string.');
            process.exit(1);
        }

        // Basic checks for Fallback logic
        // 1. Indentation
        if (formattedText.includes('\t')) {
             console.error('❌ Output contains tabs, expected spaces.');
             process.exit(1);
        }

        // 2. Switch Case Indentation check (critical for deep formatter)
        if (!formattedText.includes("case 'string':")) {
             console.error('❌ Switch case not formatted correctly.');
             process.exit(1);
        }

        // 3. Interface checks
        if (!formattedText.includes('interface ComplexInterface')) {
             console.error('❌ Interface not found.');
             process.exit(1);
        }

        console.log('✅ JS Deep Formatter (Fallback) Verification PASSED');

    } catch (err) {
        console.error(`❌ Error testing fallback formatter:`, err);
        process.exit(1);
    }
}

runTests();
