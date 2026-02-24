"use strict";
const fs = require('fs');
const path = require('path');

async function runTest() {
    const { formatMarkdownDeep } = require('./out/formatters/markdown_deep_formatter');
    const testFile = 'test.code_corruption.md';
    console.log(`Testing Code Corruption for ${testFile}...`);
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

        if (formattedText.includes('`val = a * b * c`')) {
             console.log('✅ Code block content preserved.');
        } else {
             console.log('❌ Code block content corrupted!');
             console.log('Expected: `val = a * b * c`');
        }

        if (formattedText.includes('`a | b`')) {
            console.log('✅ Pipe inside code block preserved in table.');
        } else {
            console.log('❌ Pipe inside code block caused bad split!');
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
