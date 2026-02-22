const fs = require('fs');
const path = require('path');

async function runTest() {
    try {
        // Try to require the compiled formatter directly
        // Adjust path as needed based on where this script is located (root of extension)
        const formatterPath = path.join(__dirname, 'out/formatters/cpp_deep_formatter.js');

        if (!fs.existsSync(formatterPath)) {
            console.error(`Compiled formatter not found at ${formatterPath}. Please run 'npm run compile' first.`);
            process.exit(1);
        }

        const { formatCppDeep } = require(formatterPath);

        const testFile = 'test.deep.cpp';
        const filePath = path.join(__dirname, testFile);

        if (!fs.existsSync(filePath)) {
            console.error(`Test file not found: ${filePath}`);
            process.exit(1);
        }

        const content = fs.readFileSync(filePath, 'utf8');
        console.log(`Testing ${testFile} with formatCppDeep...`);

        const formatted = formatCppDeep(content);

        console.log('--- Original ---');
        console.log(content);
        console.log('--- Formatted ---');
        console.log(formatted);
        console.log('-----------------');

        if (formatted && formatted.trim() !== content.trim()) {
            console.log(`✅ ${testFile} changed.`);
        } else {
            console.log(`⚠️ ${testFile} produced no changes or was already formatted.`);
        }

    } catch (err) {
        console.error('Error running test:', err);
        process.exit(1);
    }
}

runTest();
