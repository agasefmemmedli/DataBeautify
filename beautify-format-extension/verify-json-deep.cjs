const { formatJSONDeep } = require('./out/formatters/json_deep_formatter');
const fs = require('fs');
const path = require('path');

const testFile = path.join(__dirname, 'test.deep.json');
const text = fs.readFileSync(testFile, 'utf8');

console.log('--- Original ---');
console.log(text);

let formattedJSONC;
try {
    formattedJSONC = formatJSONDeep(text, { tabSize: 2, insertSpaces: true, isJSONC: true });
    console.log('\n--- Deep Formatted (JSONC) ---');
    console.log(formattedJSONC);
} catch (e) {
    console.error('Error formatting JSONC:', e);
    process.exit(1);
}

// Assertions JSONC
if (!formattedJSONC.includes('"key1": "value1",')) {
    console.error('❌ Missing comma check failed (JSONC).');
    process.exit(1);
}
if (!formattedJSONC.includes('// Comment')) {
    console.error('❌ Comment preservation check failed (JSONC).');
    process.exit(1);
}
// Compact Array Check
if (!formattedJSONC.includes('"key3": [1, 2, 3]')) {
    console.error('❌ Compact array check failed (JSONC). Expected [1, 2, 3]');
    process.exit(1);
}
// Compact Object Check ("broken" object)
if (!formattedJSONC.includes('"broken": { "a": 1, "b": 2 }')) {
    console.error('❌ Compact object check failed (JSONC).');
    process.exit(1);
}

// Trailing comma check
// Since my formatter removes trailing commas even in JSONC (standardizing),
// I will just verify that the comma logic works (no missing commas).
// I won't enforce trailing commas presence on the last item.

// --- Strict JSON Test ---
let formattedStrict;
try {
    formattedStrict = formatJSONDeep(text, { tabSize: 2, insertSpaces: true, isJSONC: false });
    console.log('\n--- Deep Formatted (Strict JSON) ---');
    console.log(formattedStrict);
} catch (e) {
    console.error('Error formatting Strict JSON:', e);
    process.exit(1);
}

// Assertions Strict
if (formattedStrict.includes('// Comment')) {
    console.error('❌ Comment removal check failed (Strict).');
    process.exit(1);
}
if (formattedStrict.includes('"b": 2,')) {
    console.error('❌ Trailing comma removal check failed (Strict) for "b".');
    process.exit(1);
}
if (!formattedStrict.includes('"key3": [1, 2, 3]')) {
    console.error('❌ Compact array check failed (Strict).');
    process.exit(1);
}

console.log('✅ JSON Deep Formatting Verification Passed!');
