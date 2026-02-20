const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'beautify-format-extension/src/formatters/markup.ts');
let content = fs.readFileSync(filePath, 'utf8');

const startMarker = "        // Resilient formatting logic (Fallback)";
const endMarker = '        if (!validationMessage) {';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
    console.error("Markers not found");
    process.exit(1);
}

const before = content.substring(0, startIndex);
const block = content.substring(startIndex, endIndex);
const after = content.substring(endIndex);

const lines = block.split('\n');
const newLines = lines.map((line, index) => {
    if (line.trim().length === 0) return line;

    if (index <= 2) return line;

    // Already indented lines from the second patch (catch block)
    if (line.trim().startsWith('} catch')) return line;
    if (line.trim().startsWith('vscode.window')) return line;
    if (line.trim().startsWith('return;')) return line;
    // Closing brace of catch block
    if (line.trim() === '}') {
         // Check indentation. If it's 8 spaces, it's the catch block closing.
         if (line.startsWith('        }')) return line;
    }

    // Indent everything else
    return '    ' + line;
});

const newContent = before + newLines.join('\n') + after;
fs.writeFileSync(filePath, newContent);
console.log("Indentation fixed");
