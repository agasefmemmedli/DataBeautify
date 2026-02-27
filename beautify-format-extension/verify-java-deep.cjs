
const fs = require('fs');
const path = require('path');
const { formatJavaDeep } = require('./src/formatters/java_deep_formatter');

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
