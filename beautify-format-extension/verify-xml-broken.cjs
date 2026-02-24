const fs = require('fs');
const path = require('path');

try {
    const { formatXMLDeep } = require('./out/formatters/xml_deep_formatter');

    const input = fs.readFileSync(path.join(__dirname, 'test-broken.xml'), 'utf8');
    console.log('--- Original ---');
    console.log(input);

    const formatted = formatXMLDeep(input);
    console.log('\n--- Formatted ---');
    console.log(formatted);

    // Verifications
    if (!formatted.includes('id="123"')) {
        throw new Error('Unquoted attribute id=123 not normalized to id="123"');
    }
    if (!formatted.includes('class="main"')) {
        throw new Error('Unquoted attribute class=main not normalized to class="main"');
    }
    if (!formatted.includes('type="test"')) {
        throw new Error("Single quoted attribute type='test' not normalized to type=\"test\"");
    }

    // Check indentation
    if (!formatted.includes('  <unquoted')) {
         throw new Error('Indentation incorrect for <unquoted>');
    }

    console.log('\n✅ XML Broken Verification Passed!');
} catch (error) {
    console.error('\n❌ XML Broken Verification Failed:', error.message);
    process.exit(1);
}
