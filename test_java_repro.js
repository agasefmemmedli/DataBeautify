
const fs = require('fs');
const path = require('path');
const { formatJavaDeep } = require('./beautify-format-extension/out/formatters/java_deep_formatter');

const inputFile = 'reproduce_java.java';
const text = fs.readFileSync(inputFile, 'utf8');

try {
    const formatted = formatJavaDeep(text);
    console.log(formatted);
} catch (e) {
    console.error(e);
}
