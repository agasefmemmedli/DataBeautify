# Beautifier's Log 💎

## HTML Support Implementation

### Architectural Insights

- **Auto-Detection Strategy**:
  - Priority is given to VS Code `languageId` (html, htm).
  - Content heuristics search for `<!DOCTYPE html>`, `<html>`, `<body>`, or `<div>` tags at the beginning of the file to distinguish from generic XML.
  - Added specific check for HTML-like tags even when a file starts with `<` but isn't explicitly identified as XML.

### Fault-Tolerant Parsing & Recovery

- **Fault-Tolerance**: Used `js-beautify` for HTML formatting. It is highly resilient to unclosed tags, missing brackets, or mismatched elements, attempting to re-indent and align the structure as best as possible.
- **Error Reporting**: Integrated `htmlhint` to perform validation before formatting. If errors are found, they are collected and reported to the user via a warning message, but the beautification process continues regardless, ensuring "Readability is King".

### Implementation Details

- **Formatter**: `js-beautify` with standard web settings (indent_size: 2, indent_inner_html: true).
- **Validator**: `htmlhint`'s `verify` method.
- **Command Registration**: Added `beautify-format.formatHTML` for direct access, and integrated it into the unified `beautify` command.
