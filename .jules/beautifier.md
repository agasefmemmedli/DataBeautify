# Beautifier 💎 Architectural Insights

## HTML Support Implementation

### Auto-Detection
- **Strategy**: Prioritizes `languageId` (html/htm), then uses content heuristics.
- **Heuristics**: Searches for `<!doctype html>`, `<html>`, `<div>`, or `<body>` (case-insensitive).
- **Reasoning**: Many HTML snippets don't start with a specific character (unlike JSON's `{` or XML's `<`), so tag-based heuristics are necessary for files without a set language mode.

### Fault-Tolerance & Error Reporting
- **Library**: Used `js-beautify` for formatting and `htmlhint` for validation.
- **Recovery**: `js-beautify` is inherently lenient and can structure even broken HTML.
- **Reporting**: Validation errors are collected using `htmlhint`. To avoid overwhelming the user, only the first 3 errors are reported in the warning message.
- **Outcome**: The extension now successfully formats HTML even with syntax errors, providing immediate visual feedback on structure while surfacing critical issues.
