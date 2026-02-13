# Beautify Format

A Visual Studio Code extension that beautifully formats JSON, XML and HTML files.

## Features

- 🎨 Format JSON files with proper indentation
- 🎨 Format XML files with proper indentation
- 🎨 Format HTML files with proper indentation
- 🔍 Automatic format detection (JSON, XML or HTML)
- 🛠️ Smart repair: Fixes minor errors in JSON/XML while beautifying
- 📍 Error reporting: Highlights the line with syntax errors if found
- ⌨️ Keyboard shortcuts for quick formatting
- 📝 Context menu commands in the editor

## Usage

### Formatting JSON or XML

1. Open a JSON or XML file
2. Use one of the following methods:
   - Press `Ctrl+Alt+B` (Windows/Linux) or `Cmd+Alt+B` (Mac)
   - Open the Command Palette (`Ctrl+Shift+P`) and select "Beautify Format"
   - Right-click in the editor and select "Beautify Format"

The extension will automatically detect the format and beautify it. If the file has syntax errors, it will attempt to fix them (for JSON/XML) or report them (for HTML) and notify you of the error location.

## Keyboard Shortcuts

| Command | Windows/Linux | Mac |
|---------|--------------|-----|
| Beautify Format | `Ctrl+Alt+B` | `Cmd+Alt+B` |

## Requirements

- Visual Studio Code version 1.74.0 or higher

## Development Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Compile the project: `npm run compile`
4. Press `F5` to start the Extension Development Host

## Publication

To publish the extension:

1. Install vsce globally: `npm install -g @vscode/vsce`
2. Create a package: `vsce package`
3. Publish: `vsce publish`

## License

MIT
