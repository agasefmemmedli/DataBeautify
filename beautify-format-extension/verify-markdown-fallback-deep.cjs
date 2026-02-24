"use strict";
const fs = require('fs');
const path = require('path');

async function runTest() {
    // Import the compiled deep formatter directly
    const { formatMarkdownDeep } = require('./out/formatters/markdown_deep_formatter');
    const testFile = 'test.deep.md';
    console.log(`Testing Fallback for ${testFile}...`);
    const filePath = path.join(__dirname, testFile);

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf8');

    try {
        const formattedText = formatMarkdownDeep(content);
        console.log('--- Original ---');
        console.log(content);
        console.log('--- Fallback Formatted ---');
        console.log(formattedText);
        console.log('--------------------------');

        if (formattedText && formattedText !== content) {
            console.log(`✅ ${testFile} fallback beautified successfully.`);
        } else {
            console.log(`⚠️ ${testFile} produced no changes.`);
        }
    } catch (err) {
        console.error(`❌ Error testing fallback for ${testFile}:`, err);
        process.exit(1);
    }
}

runTest().catch(err => {
    console.error(err);
    process.exit(1);
});
