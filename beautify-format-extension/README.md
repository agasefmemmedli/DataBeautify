# Beautify Format

A Visual Studio Code extension that beautifully formats JSON, JSONC, XML, HTML, CSS, SCSS, SASS, LESS, JavaScript, TypeScript, JSX, TSX, Vue, Svelte, PHP, YAML, TOML, INI, ENV, CSV, GraphQL, Python, Java, Kotlin, C#, C++, Go, Rust, Ruby, Swift, Dart, Dockerfile, Shell Script, PowerShell, Terraform/HCL, Makefile, Nginx and SQL files.

## Features

- 🎨 Format JSON files with proper indentation
- 🎨 Format JSONC files with comments preserved
- 🎨 Format XML files with proper indentation
- 🎨 Format HTML files with proper indentation
- 🎨 Format CSS files with proper indentation
- 🎨 Format SCSS files with proper indentation
- 🎨 Format SASS files with proper indentation
- 🎨 Format LESS files with proper indentation
- 🎨 Format JavaScript files with proper indentation
- 🎨 Format TypeScript files with proper indentation
- 🎨 Format JSX files with proper indentation
- 🎨 Format TSX files with proper indentation
- 🎨 Format Vue files with proper indentation
- 🎨 Format Svelte files with proper indentation
- 🎨 Format PHP files with proper indentation
- 🎨 Format YAML files with proper indentation
- 🎨 Format TOML files with proper indentation
- 🎨 Format INI files with proper indentation
- 🎨 Format ENV files with proper indentation
- 🎨 Format CSV files with column alignment
- 🎨 Format GraphQL files with proper indentation
- 🎨 Format Python files with proper indentation
- 🎨 Format Java files with proper indentation
- 🎨 Format Kotlin files with proper indentation
- 🎨 Format C# files with proper indentation
- 🎨 Format C++ files with proper indentation
- 🎨 Format Go files with proper indentation
- 🎨 Format Rust files with proper indentation
- 🎨 Format Ruby files with proper indentation
- 🎨 Format Swift files with proper indentation
- 🎨 Format Dart files with proper indentation
- 🎨 Format Dockerfile files with proper indentation
- 🎨 Format Shell Script files with proper indentation
- 🎨 Format PowerShell files with proper indentation
- 🎨 Format Terraform/HCL files with proper indentation
- 🎨 Format Makefile files with proper indentation
- 🎨 Format Nginx files with proper indentation
- 🎨 Format SQL files with proper indentation and keyword normalization
- 🔍 Automatic format detection (JSON, JSONC, XML, HTML, CSS, SCSS, SASS, LESS, JavaScript, TypeScript, JSX, TSX, Vue, Svelte, PHP, YAML, TOML, INI, ENV, CSV, GraphQL, Python, Java, Kotlin, C#, C++, Go, Rust, Ruby, Swift, Dart, Dockerfile, Shell Script, PowerShell, Terraform/HCL, Makefile, Nginx or SQL)
- 🛠️ Smart repair: Fixes minor errors in supported formats while beautifying
- 📍 Error reporting: Highlights the line with syntax errors if found
- ⌨️ Keyboard shortcuts for quick formatting
- 📝 Context menu commands in the editor

## Usage

### Formatting Supported Languages

1. Open a JSON, JSONC, XML, HTML, CSS, SCSS, SASS, LESS, JavaScript, TypeScript, JSX, TSX, Vue, Svelte, PHP, YAML, TOML, INI, ENV, CSV, GraphQL, Python, Java, Kotlin, C#, C++, Go, Rust, Ruby, Swift, Dart, Dockerfile, Shell Script, PowerShell, Terraform/HCL, Makefile, Nginx or SQL file
2. Use one of the following methods:
   - Press `Ctrl+Alt+B` (Windows/Linux) or `Cmd+Alt+B` (Mac)
   - Open the Command Palette (`Ctrl+Shift+P`) and select "Beautify Format"
   - Right-click in the editor and select "Beautify Format"

The extension will automatically detect the format and beautify it. If the file has syntax errors, it will attempt to beautify the rest and notify you of the error location.

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
