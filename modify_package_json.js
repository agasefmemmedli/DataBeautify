const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('beautify-format-extension/package.json', 'utf8'));

// Filter activationEvents
const allowedLangs = ['onLanguage:json', 'onLanguage:jsonc', 'onLanguage:xml'];
const allowedCommands = ['onCommand:beautify-format.beautify', 'onCommand:beautify-format.formatJSON', 'onCommand:beautify-format.formatJSONC', 'onCommand:beautify-format.formatXML'];

pkg.activationEvents = pkg.activationEvents.filter(event =>
    allowedLangs.includes(event) || allowedCommands.includes(event)
);

// Filter commands
const allowedCommandNames = ['beautify-format.beautify', 'beautify-format.formatJSON', 'beautify-format.formatJSONC', 'beautify-format.formatXML'];

pkg.contributes.commands = pkg.contributes.commands.filter(cmd =>
    !cmd.command || allowedCommandNames.includes(cmd.command)
);
// Some commands don't have "command" key? Actually all commands in package.json contribute should have "command" key.
pkg.contributes.commands = pkg.contributes.commands.filter(cmd =>
    allowedCommandNames.includes(cmd.command)
);


// Filter context menu
if (pkg.contributes.menus && pkg.contributes.menus['editor/context']) {
    const contextMenu = pkg.contributes.menus['editor/context'][0];
    if (contextMenu && contextMenu.command === 'beautify-format.beautify') {
        contextMenu.when = "editorLangId == json || editorLangId == jsonc || editorLangId == xml";
    }
}

fs.writeFileSync('beautify-format-extension/package.json', JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log('package.json updated');
