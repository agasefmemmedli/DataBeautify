const fs = require('fs');

function fixArgs(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/await applyEdit\(editor, formatted, [^)]+\);/g, "await applyEdit(editor, formatted);");
    fs.writeFileSync(filePath, content, 'utf8');
}

fixArgs('beautify-format-extension/src/formatters/js_ts.ts');
fixArgs('beautify-format-extension/src/formatters/web.ts');
