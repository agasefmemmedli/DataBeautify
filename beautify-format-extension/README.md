<div align="center">

  # Beautify Format
  **Safe, fault-tolerant formatting for JSON, JSONC and XML**

  [![VS Code Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/DataBeautify.beautify-format?style=for-the-badge&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=DataBeautify.beautify-format)
  [![Installs](https://img.shields.io/visual-studio-marketplace/i/DataBeautify.beautify-format?style=for-the-badge&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=DataBeautify.beautify-format)
  [![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)
</div>

---

## Why Beautify Format?

Most formatters give up on a file with a syntax error. Beautify Format fixes common mistakes while formatting, and it checks every result before writing it:

- **Your data never changes silently.** For a valid file, the formatted result is compared with the original. If anything other than whitespace would change, the file is left untouched.
- **Fixes are always reported.** A fix that only touches punctuation (a missing or extra comma, a missing colon, quotes around a key or a single-quoted string) is applied with a warning that shows the error location. Every key, value and bracket stays the same. Press `Ctrl+Z` to undo.
- **Guesses need your approval.** Any other fix could change your data: adding or removing a bracket (where it belongs cannot be known for sure), `NaN` becoming `"NaN"`, or broken XML where the end of a tag has to be guessed. You are asked first, and **Preview** opens a diff of the suggested fix without changing the file.
- **No broken output.** If a broken file cannot be turned into a valid one, nothing is written and you see where the error is.

## Supported formats

| Format | Language mode / extensions | What gets fixed |
| :--- | :--- | :--- |
| **JSON** | `json` (`.json`) | missing or extra commas, unquoted keys, single quotes, trailing commas. After confirmation: missing colons, unclosed or extra brackets, bare words such as `NaN`. Comments are kept; if a broken file can only be fixed by dropping them, the warning says so. |
| **JSONC** | `jsonc` (`.jsonc`, `tsconfig.json`, VS Code settings) | missing commas. Comments are always kept, trailing commas are added. |
| **XML** | `xml`, `xsl` (`.xml`, `.svg`, …) | unclosed and mismatched tags (after confirmation) |

For files in other language modes the format is detected from the content: `{` or `[` means JSON, `<` means XML.

### Formatting rules

- Indentation follows the editor settings (`editor.tabSize`, `editor.insertSpaces`).
- Short JSON objects and arrays (under 80 characters) stay on one line.
- XML elements with short text stay on one line; long attribute lists are wrapped.
- XML: content of `xml:space="preserve"` elements is kept exactly as is; backslashes in attribute values are kept.

## Usage

| Action | How |
| :--- | :--- |
| Format the current file | `Ctrl+Alt+B` (`Cmd+Alt+B` on macOS) |
| Command Palette | `Beautify Format`, `Beautify JSON`, `Beautify JSONC`, `Beautify XML` |
| Context menu | right-click in a JSON, JSONC or XML file → **Beautify Format** |

## Settings

| Setting | Default | Description |
| :--- | :--- | :--- |
| `beautifyFormat.xml.sortAttributes` | `false` | Sort XML attributes (`id`, `class`, `name`, `src`, `href`, `type` first, then alphabetically). |

## Requirements

- Visual Studio Code 1.74.0 or newer.

## Development

```bash
npm install
npm test          # compiles and runs the unit tests
npm run bundle    # builds dist/extension.js
npx vsce package  # builds the .vsix
```

## License

MIT © [DataBeautify](https://github.com/agasefmemmedli/DataBeautify)
