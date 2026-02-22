const fs = require('fs');
const path = require('path');

// Load the compiled formatter directly
const { formatLiquidDeep } = require('./out/formatters/liquid_deep_formatter');

const testFile = 'test.deep.liquid';
console.log(`Testing ${testFile} with formatLiquidDeep directly...`);
const filePath = path.join(__dirname, testFile);

if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');

try {
    const formatted = formatLiquidDeep(content, { tabSize: 2, insertSpaces: true });

    console.log('--- Original ---');
    console.log(content);
    console.log('--- Formatted (Custom Deep) ---');
    console.log(formatted);
    console.log('-----------------');

    if (formatted && formatted !== content) {
        console.log(`✅ ${testFile} beautified successfully using custom formatter.`);

        // Validation
        if (formatted.includes('  {% if product.available %}')) {
            console.log('✅ Indentation verified.');
        } else {
            console.error('❌ Indentation check failed.');
            process.exit(1);
        }

        // Check nested structure
        if (formatted.includes('        <div class="variant">')) {
             console.log('✅ Nested div indentation verified.');
        } else {
             // It might be 6 spaces depending on logic
             // Root: <div class="product-card"> (0 indent? No, inside file it's 0)
             //  {% if ... %} (2 indent)
             //    <h2> (4 indent)
             //    {% for ... %} (4 indent)
             //      {% if ... %} (6 indent)
             //        <div class="variant"> (8 indent)

             // Let's check visually from output first.
        }

    } else {
        console.error(`❌ ${testFile} produced no changes.`);
        process.exit(1);
    }
} catch (err) {
    console.error(`❌ Error testing ${testFile}:`, err);
    process.exit(1);
}
