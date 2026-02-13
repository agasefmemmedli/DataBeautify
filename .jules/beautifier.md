# Beautifier Log 💎

## HTML Support Implementation

### Auto-detection
- **Language ID:** Prioritizes `html` and `htm`.
- **Content Heuristics:** Implemented case-insensitive detection for `<!doctype html>`, `<html>`, `<body>`, and `<div>` tags. This ensures that even unsaved files or files with wrong extensions can be correctly identified as HTML.

### Fault-Tolerance & Error Reporting
- **Validator:** Integrated `htmlhint` for HTML validation.
- **Resilience:** The beautifier reports up to 3 syntax errors to the user via VS Code warning messages but continues with formatting using `js-beautify`. This follows the philosophy that "Readability is King" even for malformed code.
- **Dependency:** Added `@types/htmlhint` to devDependencies to ensure type safety during compilation.

### Formatting Engine
- **Tool:** `js-beautify` (HTML submodule).
- **Options:** Applied a strict set of options to comply with TypeScript definitions and project standards (indent_size: 2, wrap_line_length: 120, etc.).
