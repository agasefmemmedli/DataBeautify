const fs = require('fs');
const path = require('path');
const { formatHCLDeep } = require('./out/formatters/hcl_deep_formatter');

function runTest(file) {
    console.log(`Testing ${file}...`);
    const inputPath = path.join(__dirname, file);
    if (!fs.existsSync(inputPath)) {
        console.error(`File not found: ${inputPath}`);
        return;
    }
    const input = fs.readFileSync(inputPath, 'utf8');

    try {
        const formatted = formatHCLDeep(input);

        console.log('--- Original ---');
        console.log(input);
        console.log('\n--- Formatted ---');
        console.log(formatted);
        console.log('-----------------');

        // Verify alignment
        if (formatted.includes('short         =')) {
            console.log('✅ Alignment verified.');
        } else {
            console.error('❌ Alignment failed.');
        }

        // Verify Heredoc indentation
        if (formatted.includes('  indented = <<-EOF')) {
            console.log('✅ Heredoc start indentation verified.');
        } else {
            console.error('❌ Heredoc start indentation failed.');
        }

        // Verify Heredoc content (assumed 4 spaces if inside resource)
        // Actually formatted has indent 2 for resource body, so indent 4 for heredoc content?
        // Or indent 2 if it's just raw?
        // Let's check visually first.

        // Verify Brace placement
        if (formatted.includes('resource "test" "braces" {')) {
            console.log('✅ Brace placement verified.');
        } else {
            console.error('❌ Brace placement failed.');
        }
    } catch (e) {
        console.error('Formatting failed:', e);
    }
}

runTest('test.hcl.improvements.deep.tf');
