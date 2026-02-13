# 💎 Beautifier Log: HTML Support Implementation

## Architectural Insights

### Auto-Detection Strategy
The `detectFormat` function was enhanced to distinguish between XML and HTML. Since both use `<` as a starting character, the following heuristics were applied:
- **Language ID Priority**: If VS Code identifies the file as `html` or `htm`, it's treated as HTML.
- **Content-Based Heuristics**: If the language ID is unknown, the content is checked for common HTML markers:
    - `<!DOCTYPE html>`
    - `<html>`
    - `<div>`
    - `<body>`
- **Fallback**: If no HTML markers are found but it starts with `<`, it defaults to XML.

### Fault-Tolerant Formatting
To adhere to the "Readability is King" philosophy, the HTML formatting logic was designed to be resilient:
- **Validation**: `htmlhint` is used to identify syntax errors.
- **Recovery**: Unlike JSON which might require repair before parsing, `js-beautify` is inherently lenient with malformed HTML. It can format most messy snippets even with missing tags or malformed attributes.
- **Reporting**: Identified errors are collected and reported to the user via a warning message, but the beautification process is not halted. This ensures the user gets a better-structured file while being aware of underlying issues.

### External Libraries
- **js-beautify**: Chosen for its wide adoption and extreme tolerance for malformed input.
- **htmlhint**: Chosen for its robust rule set and clear error reporting (line/column).
