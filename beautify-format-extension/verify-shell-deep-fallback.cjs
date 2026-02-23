"use strict";
const fs = require('fs');
const path = require('path');

async function runTest() {
    // Load the compiled deep formatter directly
    const { formatShellDeep } = require('./out/formatters/shell_deep_formatter');
    const testFile = 'test.deep.sh';
    console.log(`Testing ${testFile} using formatShellDeep (Bypassing Prettier)...`);
    const filePath = path.join(__dirname, testFile);

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf8');

    try {
        const formattedText = formatShellDeep(content);
        console.log('--- Original ---');
        console.log(content);
        console.log('--- Deep Formatted ---');
        console.log(formattedText);
        console.log('-----------------');

        if (formattedText && formattedText !== content) {
            console.log(`✅ ${testFile} deep formatted successfully.`);
        } else if (formattedText === content) {
            console.log(`ℹ️ ${testFile} already formatted or no changes applied.`);
        } else {
            console.log(`⚠️ ${testFile} produced no changes.`);
        }
    } catch (err) {
        console.error(`❌ Error testing ${testFile}:`, err);
        process.exit(1);
    }
}

runTest().catch(err => {
    console.error(err);
    process.exit(1);
});
