const { formatKotlinDeep } = require('./out/formatters/kotlin_deep_formatter');
const fs = require('fs');
const path = require('path');

function runTest(file) {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }

    const text = fs.readFileSync(filePath, 'utf8');
    console.log(`Testing ${file} with Deep Formatter (Bypassing Prettier)...`);

    try {
        const formatted = formatKotlinDeep(text);
        console.log('--- Original ---');
        console.log(text.substring(0, 500) + '...');
        console.log('\n--- Formatted ---');
        console.log(formatted);
        console.log('\n-----------------');
        console.log(`✅ ${file} beautified successfully.`);
    } catch (e) {
        console.error(`❌ Failed to beautify ${file}:`, e);
        process.exit(1);
    }
}

runTest('test.deep.kt');
