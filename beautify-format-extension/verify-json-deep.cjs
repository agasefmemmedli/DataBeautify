const { formatJSONDeep } = require('./out/formatters/json_deep_formatter');
const fs = require('fs');
const path = require('path');

const testFile = path.join(__dirname, 'test.deep.json');
const text = fs.readFileSync(testFile, 'utf8');

console.log('--- Original ---');
console.log(text);

let formatted;
try {
    formatted = formatJSONDeep(text, { tabSize: 2, insertSpaces: true, isJSONC: true });
    console.log('\n--- Deep Formatted (JSONC) ---');
    console.log(formatted);
} catch (e) {
    console.error('Error formatting JSON:', e);
    process.exit(1);
}

// Assertions
// Note: formatJSONDeep adds comma if missing.
// Original: "key1": "value1"\n "key2"
// Formatted: "key1": "value1",\n  "key2"

if (!formatted.includes('"key1": "value1",')) {
    console.error('❌ Missing comma check failed.');
    process.exit(1);
}

if (!formatted.includes('"key2": 123,')) {
    console.error('❌ Indentation/Structure check failed.');
    process.exit(1);
}

if (!formatted.includes('"unquoted": true')) {
    console.error('❌ Unquoted key quoting failed.');
    process.exit(1);
}

if (!formatted.includes('// Comment')) {
    console.error('❌ Comment preservation check failed.');
    process.exit(1);
}

// Check trailing comma preservation
if (!formatted.includes('"trailing": "comma",')) {
    console.error('❌ Trailing comma check failed (expected preservation in JSONC).');
    process.exit(1);
}

if (!formatted.includes('"kebab-case": "value"')) {
    console.error('❌ Kebab-case key quoting check failed.');
    process.exit(1);
}

console.log('✅ JSON Deep Formatting Verification Passed!');
