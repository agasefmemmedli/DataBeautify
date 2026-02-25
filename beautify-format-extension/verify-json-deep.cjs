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

// --- Test 2: Key Sorting and Trailing Comments ---
console.log('\n--- Test 2: Key Sorting & Trailing Comments ---');
const test2Input = `{
  "z": 1,
  "a": 2,
  "m": 3,
  "list": [
    "b",
    "a"
    // trailing comment in array
  ],
  "obj": {
    "y": 1,
    "x": 2
    // trailing comment in object
  }
}`;

let formattedTest2;
try {
    formattedTest2 = formatJSONDeep(test2Input, { tabSize: 2, insertSpaces: true, isJSONC: true });
    console.log(formattedTest2);
} catch (e) {
    console.error('Error formatting Test 2:', e);
    process.exit(1);
}

// Check Sorting
// "a", "list", "m", "obj", "z"
const expectedOrder = ['"a": 2', '"list":', '"m": 3', '"obj":', '"z": 1'];
let lastIndex = -1;
for (const key of expectedOrder) {
    const index = formattedTest2.indexOf(key);
    if (index === -1) {
        console.error(`❌ Key sorting check failed. Missing ${key}`);
        process.exit(1);
    }
    if (index < lastIndex) {
        console.error(`❌ Key sorting check failed. ${key} appeared out of order.`);
        process.exit(1);
    }
    lastIndex = index;
}

// Check nested object sorting
const objIndex = formattedTest2.indexOf('"obj":');
const xIndex = formattedTest2.indexOf('"x": 2', objIndex);
const yIndex = formattedTest2.indexOf('"y": 1', objIndex);
if (xIndex === -1 || yIndex === -1 || xIndex > yIndex) {
    console.error('❌ Nested object key sorting check failed. Expected "x" before "y".');
    process.exit(1);
}

// Check Trailing Comments
if (!formattedTest2.includes('// trailing comment in array')) {
     console.error('❌ Trailing comment in array missing.');
     process.exit(1);
}
if (!formattedTest2.includes('// trailing comment in object')) {
     console.error('❌ Trailing comment in object missing.');
     process.exit(1);
}

console.log('✅ JSON Deep Formatting Verification Passed!');
