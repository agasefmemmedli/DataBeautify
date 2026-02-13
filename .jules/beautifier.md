# Beautifier's Log 💎

## HTML Support Implementation

### Auto-detection
HTML auto-detection was implemented with a focus on both VS Code `languageId` and content heuristics.
The heuristics search for `<!doctype html>`, `<html>`, `<div>`, or `<body>` tags.
This is necessary because some HTML snippets might not have the correct extension or `languageId` set.
Content-based detection is performed case-insensitively to ensure robustness.

### Fault-Tolerance and Error Reporting
For HTML, we use `htmlhint` for validation and `js-beautify` for formatting.
The extension follows a fault-tolerant approach: even if `htmlhint` finds errors, we still attempt to beautify the code using `js-beautify`.
To keep notification messages readable and avoid overwhelming the user, only the first three errors found by `htmlhint` are reported.

### Syntax Error Recovery
In the case of "unknown" formats, the extension attempts `jsonrepair` first. If that fails and the content starts with `<`, it checks for HTML tags. This allows for successful formatting of HTML even when the format is not explicitly set, provided it contains standard HTML structural elements.

### ESLint Compliance
Enforced the `curly` rule across all new and existing conditional blocks in `extension.ts` to ensure consistency with the project's coding standards.
