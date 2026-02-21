const fs = require('fs');
const path = require('path');
const { formatXMLDeep } = require('./out/formatters/xml_deep_formatter.js');

const testFile = path.join(__dirname, 'test.deep.xml');
const content = fs.readFileSync(testFile, 'utf8');

console.log('Original Content Length:', content.length);

const formatted = formatXMLDeep(content, {
    tabSize: 2,
    insertSpaces: true,
    sortAttributes: true,
    printWidth: 80 // Force wrapping for test
});

console.log('Formatted Content:\n', formatted);

// Assertions
// 1. Check indentation (2 spaces)
if (!formatted.includes('  <element')) {
    console.error('❌ Indentation check failed: Expected 2 spaces indent.');
    process.exit(1);
}

// 2. Check attribute sorting: id first
if (!formatted.includes('id="main" class="container"')) {
    if (formatted.indexOf('id="main"') > formatted.indexOf('class="container"')) {
         console.error('❌ Attribute sorting check failed: id should come before class.');
         process.exit(1);
    }
}

// 3. Check wrapping
if (!formatted.includes('\n    longAttribute1=')) {
     console.error('❌ Attribute wrapping check failed: long attributes should be on new lines.');
     process.exit(1);
}

// 4. Check CDATA preservation
if (!formatted.includes('<![CDATA[Some <b>bold</b> text inside CDATA]]>')) {
     console.error('❌ CDATA preservation check failed.');
     process.exit(1);
}

// 5. Check comment preservation
if (!formatted.includes('<!-- This is a comment -->')) {
     console.error('❌ Comment preservation check failed.');
     process.exit(1);
}

// 6. Check Doctype preservation
if (!formatted.includes('<!DOCTYPE html>')) {
     console.error('❌ Doctype preservation check failed. Output missing <!DOCTYPE html>.');
     process.exit(1);
}

// 7. Check Unicode Tag preservation
if (!formatted.includes('<café')) {
     console.error('❌ Unicode tag check failed. Output missing <café>.');
     process.exit(1);
}

console.log('✅ XML Deep Formatting Verification Passed!');
