# Beautifier Log

## HTML Support Implementation
Implemented HTML formatting and validation as the next priority format from the roadmap.

### Auto-Detection Heuristics
- Prioritizes VS Code `languageId` (`html` or `htm`).
- Content-based heuristics:
    - Case-insensitive search for `<!doctype html>`, `<html>`, `<body>`, or `<div>`.
    - If a file starts with `<` but doesn't match these heuristics, it defaults to XML.

### Fault-Tolerance & Error Reporting
- **Validator**: Used `htmlhint` to identify syntax errors.
- **Formatter**: Used `js-beautify` which is resilient to many syntax errors.
- **Logic**: Even if `htmlhint` finds errors (missing tags, unclosed attributes, etc.), the extension still attempts to beautify the code using `js-beautify`.
- **Reporting**: Identified errors are reported to the user via `vscode.window.showWarningMessage`, limited to the first 3 errors to maintain readability.

### Recovery from Syntax Errors
- `js-beautify` naturally handles many malformed HTML structures by attempting to balance tags or correctly indenting what it can.
- The extension ensures that formatting failures (exceptions) are caught and reported without crashing the extension.
