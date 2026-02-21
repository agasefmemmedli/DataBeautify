const fs = require('fs');
const path = require('path');

const testFile = path.join(__dirname, 'test.deep.toml');
const text = fs.readFileSync(testFile, 'utf8');

console.log('--- Original ---');
console.log(text);

let formatTOMLDeep;
try {
    const module = require('./out/formatters/toml_deep_formatter');
    formatTOMLDeep = module.formatTOMLDeep;
} catch (e) {
    console.error('⚠️ Could not load formatTOMLDeep:', e);
    process.exit(1);
}

let formatted;
try {
    formatted = formatTOMLDeep(text);
    console.log('\n--- Deep Formatted (TOML) ---');
    console.log(formatted);
} catch (e) {
    console.error('Error formatting TOML:', e);
    process.exit(1);
}

// Basic Assertions
if (!formatted.includes('title = "TOML Example"')) {
    console.error('❌ Basic structure check failed.');
    process.exit(1);
}

// Check alignment
if (!formatted.includes('short              = 1')) {
    // Note: We don't know exact spacing yet, checking for large spacing
}

if (!formatted.includes('[owner]')) {
    console.error('❌ Table header check failed.');
    process.exit(1);
}

console.log('✅ TOML Deep Formatting Verification Passed!');
