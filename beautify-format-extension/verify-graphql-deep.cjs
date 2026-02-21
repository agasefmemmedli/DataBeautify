const { formatGraphQLDeep } = require('./out/formatters/graphql_deep_formatter');
const fs = require('fs');
const path = require('path');

const testFile = path.join(__dirname, 'test.deep.graphql');
const text = fs.readFileSync(testFile, 'utf8');

console.log('--- Original ---');
console.log(text);

let formatted;
try {
    formatted = formatGraphQLDeep(text);
    console.log('\n--- Deep Formatted (GraphQL) ---');
    console.log(formatted);
} catch (e) {
    console.error('Error formatting GraphQL:', e);
    process.exit(1);
}

// Assertions

// Check indentation
if (!formatted.match(/^\s{2}id/m)) {
    console.error('❌ Indentation check failed (expected 2 spaces for "id").');
    process.exit(1);
}

// Check vertical alignment
// We expect colon alignment in 'type User' or 'type Profile'
// Profile has firstName, lastName, avatarUrl, settings.
// max length is 'firstName' (9).
// 'settings' is 8. 'avatarUrl' is 9.
// So all should align at same column.
// firstName : String
// settings  : Settings (1 space padding)
if (!formatted.match(/firstName\s+: String/)) {
    console.error('❌ Vertical alignment check failed for firstName.');
    process.exit(1);
}
if (!formatted.match(/settings\s+: Settings/)) {
    console.error('❌ Vertical alignment check failed for settings.');
    process.exit(1);
}

// Check comma preservation in args
if (!formatted.includes('friends(first: Int, after: String)')) {
    console.error('❌ Argument comma preservation check failed.');
    // Note: output might be "friends(first: Int, after: String)" or "friends(first: Int, after: String)"
    // My formatter adds space after comma.
    // Original: "friends(first: Int, after: String)"
    // Formatted: "friends(first: Int, after: String)"
    // If original had comma, it is preserved.
    // If original didn't, it is not added (unless I add logic to add it).
    // The test file has "friends(first: Int, after: String)".
    process.exit(1);
}

// Check separate lines for scalar/directive
if (!formatted.includes('scalar Date')) {
    console.error('❌ Scalar check failed.');
    process.exit(1);
}
// Ensure scalar is on its own line (surrounded by newlines or EOF)
// Regex: /\nscalar Date\s*$/ or similar
if (!formatted.match(/\nscalar Date/)) {
    console.error('❌ Scalar newline check failed.');
    process.exit(1);
}

console.log('✅ GraphQL Deep Formatting Verification Passed!');
