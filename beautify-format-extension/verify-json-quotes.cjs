const { formatJSONDeep } = require('./out/formatters/json_deep_formatter');
const fs = require('fs');
const path = require('path');

const testFile = path.join(__dirname, 'test-quotes.json');
const text = fs.readFileSync(testFile, 'utf8');

console.log('--- Original ---');
console.log(text);

let formatted;
try {
    // Default options (isJSONC: false) -> Strict JSON
    formatted = formatJSONDeep(text, { tabSize: 2, insertSpaces: true });
    console.log('\n--- Deep Formatted (Strict) ---');
    console.log(formatted);
} catch (e) {
    console.error('Error formatting JSON:', e);
    process.exit(1);
}

// Assertions

// 1. Single to Double conversion
if (!formatted.includes('"single": "quoted"')) {
    console.error('❌ Single quote conversion failed.');
    process.exit(1);
}

// 2. Trailing comma removal (Strict JSON)
// "trailing": "comma" is the last element (alphabetically), so it should NOT have a comma
if (formatted.includes('"trailing": "comma",')) {
    console.error('❌ Trailing comma removal failed (it is present).');
    process.exit(1);
}

// 3. Inner double quotes escaping
if (!formatted.includes('"mixed": "contains \\"double\\" quotes"')) {
    console.error('❌ Inner double quote escaping failed.');
    process.exit(1);
}

// 4. Unescaping single quotes
if (!formatted.includes('"escaped": "It\'s nice"')) {
    console.error('❌ Single quote unescaping failed.');
    process.exit(1);
}

// 5. Unquoted keys
if (!formatted.includes('"real_unquoted": true')) {
    console.error('❌ Unquoted key quoting failed.');
    process.exit(1);
}

console.log('✅ JSON Quote & Strictness Verification Passed!');
