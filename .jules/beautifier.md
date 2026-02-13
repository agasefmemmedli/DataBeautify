# Beautifier Log 💎

## HTML Implementation Insights

### Auto-Detection
The `detectFormat` function was enhanced to support HTML. It prioritizes the VS Code `languageId` (`html`, `htm`). For files with an unknown language ID, it uses case-insensitive content heuristics. It checks if the trimmed text starts with `<` and then looks for `<!doctype html>`, `<html>`, `<div>`, or `<body>`. This ensures high confidence levels in detection to avoid false positives with XML.

### Fault-Tolerance
The `handleHTML` function implements a resilient approach. It uses `htmlhint` to validate the document but does not halt if errors are found. Instead, it collects the first 3 error messages and displays them as a warning notification while still proceeding with the `js-beautify` formatting. This allows users to see a cleaned-up version of their code even if it has syntax issues.

### Formatting Options
To comply with official TypeScript type definitions for `js-beautify`, a strict set of options was used:
- `indent_size`: 2
- `indent_char`: ' '
- `max_preserve_newlines`: 2
- `preserve_newlines`: true
- `indent_scripts`: 'normal'
- `end_with_newline`: true
- `wrap_line_length`: 120
- `indent_inner_html`: true
- `indent_empty_lines`: false

### ESLint Compliance
The project enforces the `curly` rule. All conditional blocks in the new implementation include curly braces. The `@typescript-eslint/naming-convention` rule was temporarily disabled using comments for the `js-beautify` configuration object to allow the required snake_case property names.
