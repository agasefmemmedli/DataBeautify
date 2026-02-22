const fs = require('fs');
const path = require('path');

async function runTests() {
    console.log('Running Twig Deep Formatter (Fallback) Verification...');
    let formatTwigDeep;
    try {
        const module = require('./out/formatters/twig_deep_formatter');
        formatTwigDeep = module.formatTwigDeep;
    }
    catch (e) {
        console.error('Could not load twig_deep_formatter. Make sure to run "npm run compile" first.');
        console.error(e);
        process.exit(1);
    }

    const testFile = 'test.deep.twig';
    const filePath = path.join(__dirname, testFile);
    if (!fs.existsSync(filePath)) {
        console.error(`File ${testFile} not found!`);
        process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf8');

    try {
        const formattedText = formatTwigDeep(content, {
            tabSize: 2,
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
        // 1. Indentation (2 spaces)
        if (formattedText.includes('\t')) {
             console.error('❌ Output contains tabs, expected spaces.');
             process.exit(1);
        }

        // 2. Block Indentation
        // Check if {% block content %} indent increases
        const lines = formattedText.split('\n');
        const blockIndex = lines.findIndex(l => l.trim().startsWith('{% block content %}'));
        if (blockIndex === -1) {
             console.error('❌ {% block content %} not found.');
             process.exit(1);
        }

        // Next line should be indented more than block start
        const blockIndent = lines[blockIndex].search(/\S/);
        let nextLineIndex = blockIndex + 1;
        while(nextLineIndex < lines.length && lines[nextLineIndex].trim() === '') nextLineIndex++;

        if (nextLineIndex < lines.length) {
            const nextLineIndent = lines[nextLineIndex].search(/\S/);

            if (nextLineIndent <= blockIndent) {
                console.error(`❌ Indentation failed inside block. Block: ${blockIndent}, Content: ${nextLineIndent}`);
                process.exit(1);
            }
        }

        console.log('✅ Twig Deep Formatter (Fallback) Verification PASSED');

    } catch (err) {
        console.error(`❌ Error testing fallback formatter:`, err);
        process.exit(1);
    }
}

runTests();
