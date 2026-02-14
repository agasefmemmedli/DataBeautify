# Beautifier's Log 💎

## HTML Implementation (v0.0.2)

### Auto-Detection
- **Language ID:** Prioritizes `html` and `htm`.
- **Heuristics:** Case-insensitive check for `<!doctype html>`, `<html>`, `<div>`, or `<body>`. This helps distinguish HTML from XML when the file extension is missing or generic.
- **Fallback:** If initial detection fails but the content starts with `<`, it checks for these heuristics again before defaulting to XML.

### Fault-Tolerance
- **Validation:** Uses `htmlhint` to collect errors.
- **Resilience:** The beautifier attempts to format the code even if syntax errors are present. `js-beautify` is generally capable of handling minor malformations.
- **Error Reporting:** To avoid overwhelming the user, only the first three errors are reported in the warning notification.

### Linting
- Ensured compliance with the `curly` ESLint rule by adding braces to all conditional blocks in the new and updated functions.
