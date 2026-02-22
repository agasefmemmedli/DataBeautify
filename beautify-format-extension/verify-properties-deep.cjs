const fs = require('fs');
const path = require('path');
const { formatPropertiesDeep } = require('./out/formatters/properties_deep_formatter.js');

const testFile = path.join(__dirname, 'test.deep.properties');
const content = fs.readFileSync(testFile, 'utf8');

console.log('Original Content Length:', content.length);

const formatted = formatPropertiesDeep(content);

console.log('Formatted Content:\n', formatted);

// Assertions

// 1. Check Alignment
// "key1" length 4. "long.key.name" length 13. "short" length 5.
// Max key length should be 13.
// "multiline.key" length 13.
// "escaped.key" length 11.
// "indented.key" length 12.
// "no.value.key" length 12.

// We expect `key1` to be padded.
// 13 - 4 = 9 spaces.
if (!formatted.includes('key1          = value1')) {
     console.error('❌ Alignment check failed for key1.');
     process.exit(1);
}

// 2. Check value preservation
if (!formatted.includes('value with spaces')) {
     console.error('❌ Value preservation check failed.');
     process.exit(1);
}

// 3. Check comment preservation
if (!formatted.includes('# This is a comment')) {
     console.error('❌ Comment preservation check failed.');
     process.exit(1);
}

// 4. Check separator normalization (all should use =)
if (formatted.includes('short:value2')) {
     console.error('❌ Separator normalization check failed (found :)');
     process.exit(1);
}
if (!formatted.includes('short         = value2')) {
     console.error('❌ Separator normalization check failed (missing =)');
     process.exit(1);
}

// 5. Check multiline preservation
// My logic adds 4 spaces indentation to continuations.
if (!formatted.includes('    line2')) {
     console.error('❌ Multiline indentation check failed.');
     process.exit(1);
}

console.log('✅ Properties Deep Formatting Verification Passed!');
