
const fs = require('fs');
const path = require('path');
// Use the compiled output instead of the source file
const { formatJavaDeep } = require('./out/formatters/java_deep_formatter');

const testFile = path.resolve(__dirname, 'test/test.deep.java');
try {
    const input = fs.readFileSync(testFile, 'utf-8');
    console.log("--- Input ---");
    console.log(input);
    console.log("--- Output ---");
    const output = formatJavaDeep(input);
    console.log(output);
} catch (err) {
    console.error("Error:", err);
}
