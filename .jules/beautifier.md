## HTML Support implementation

- **Auto-detection**: Prioritizes VS Code `languageId` (html/htm). Fallback content heuristics check for case-insensitive `<!doctype html>`, `<html>`, `<div>`, or `<body>` at the start of the trimmed text.
- **Fault-tolerance**: Uses `js-beautify` for formatting, which is naturally lenient. `htmlhint` is used for validation.
- **Error reporting**: Reports only the first 3 errors found by `htmlhint` to avoid overwhelming the user, while still proceeding with beautification.
