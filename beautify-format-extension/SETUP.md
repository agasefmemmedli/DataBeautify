# Beautify Format Installation and Usage Guide

## Installing Dependencies

1. Ensure you have Node.js installed (version 16 or higher)
2. Open a terminal in the project folder
3. Run the following command:
```bash
npm install
```

## Compiling the Project

After installing dependencies, compile the TypeScript code:

```bash
npm run compile
```

Or for automatic recompilation on changes:

```bash
npm run watch
```

## Running the Extension for Testing

1. Open the project folder in Visual Studio Code
2. Press `F5` or select "Run > Start Debugging"
3. A new VS Code window (Extension Development Host) will open with the extension active
4. Create a test JSON or XML file
5. Try using the formatting commands

## Test File Examples

### JSON Example (create test.json):
```json
{"name":"John","age":30,"city":"New York","hobbies":["reading","gaming","coding"],"address":{"street":"Main St","number":123}}
```

### XML Example (create test.xml):
```xml
<root><person><name>John</name><age>30</age><city>New York</city></person><hobbies><hobby>reading</hobby><hobby>gaming</hobby></hobbies></root>
```

## Creating a .vsix Package for Installation

To create an installation package:

1. Install vsce globally:
```bash
npm install -g @vscode/vsce
```

2. Create the package:
```bash
vsce package
```

3. Install the created .vsix file:
   - In VS Code: Extensions > ... > Install from VSIX
   - Or from the command line: `code --install-extension beautify-format-0.0.1.vsix`

## Project Structure

```
beautify-format-extension/
├── .vscode/              # VS Code settings for development
│   ├── launch.json       # Debug configuration
│   └── tasks.json        # Build tasks
├── src/                  # Source code
│   └── extension.ts      # Main extension file
├── out/                  # Compiled files (generated automatically)
├── package.json          # Extension manifest
├── tsconfig.json         # TypeScript configuration
├── .eslintrc.js          # ESLint configuration
├── .gitignore           # Ignored files
├── .vscodeignore        # Files excluded from the package
└── README.md            # Documentation
```

## Extension Features

✅ JSON file formatting
✅ XML file formatting
✅ Auto-detection of format
✅ Smart repair of broken JSON/XML
✅ Error reporting with line numbers
✅ Keyboard shortcuts (Ctrl+Alt+B)
✅ Command Palette integration
✅ Context menu integration
✅ Success/Error notifications

## Future Development

Possible improvements:
- Add settings for indentation size
- Support for other formats (HTML, CSS, YAML)
- Formatting of selected fragments
- Auto-format on save
- Customizable formatting styles
