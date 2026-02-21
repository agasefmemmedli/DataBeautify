const fs = require('fs');
const path = require('path');
const { formatAstroDeep } = require('./out/formatters/astro_deep_formatter');

const testFile = 'test.deep.astro';
const filePath = path.join(__dirname, testFile);
const content = fs.readFileSync(filePath, 'utf8');

try {
    const formatted = formatAstroDeep(content);
    console.log('--- Original ---');
    console.log(content);
    console.log('--- Formatted (Deep Fallback) ---');
    console.log(formatted);
    console.log('-----------------');

    if (formatted && formatted.trim() !== content.trim()) {
        console.log(`✅ ${testFile} deep-formatted successfully.`);
    } else {
        console.error(`❌ ${testFile} failed to format or no changes.`);
        process.exit(1);
    }
} catch (e) {
    console.error('Error:', e);
    process.exit(1);
}
