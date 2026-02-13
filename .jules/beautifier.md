# 💎 Beautifier Log

## HTML Support Implementation

### Auto-Detection Heuristics
- **Language ID**: Prioritizes VS Code `languageId` (`html`, `htm`).
- **Content Heuristics**: When `languageId` is unknown but content starts with `<`, we search for specific HTML tags:
  - `<!doctype html>`
  - `<html>`
  - `<body>`
  - `<div>`
- **XML Fallback**: If it starts with `<` but doesn't match the above, it defaults to XML. This helps distinguish between the two formats even when both start with `<`.

### Fault-Tolerance and Recovery
- **Validation**: `HTMLHint` is used to identify syntax errors.
- **Resilience**: Even if `HTMLHint` finds errors, the extension proceeds to format using `js-beautify`. `js-beautify` is highly lenient and can structure even malformed HTML.
- **Error Reporting**: To maintain a clean UI, only the first 3 errors from `HTMLHint` are reported to the user.

### Configuration
- **js-beautify options**: A strict set of options is used to ensure consistency:
  - `indent_size: 2`
  - `indent_char: ' '`
  - `max_preserve_newlines: 2`
  - `preserve_newlines: true`
  - `indent_scripts: 'normal'`
  - `end_with_newline: true`
  - `wrap_line_length: 120`
  - `indent_inner_html: true`
  - `indent_empty_lines: false`
