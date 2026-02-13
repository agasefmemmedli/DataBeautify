# 💎 Beautifier's Log

## HTML Support Implementation

- **Auto-Detection Strategy**: Implemented priority-based detection.
  1. VS Code `languageId` (`html`/`htm`).
  2. Case-insensitive content heuristics searching for `<!doctype html>`, `<html>`, `<div>`, or `<body>` tags. This allows detection even in files with incorrect or missing extensions.
- **Fault-Tolerance**:
  - Used `htmlhint` to collect validation errors.
  - To prevent notification spam, only the first 3 errors are reported to the user.
  - `js-beautify` is used to attempt formatting regardless of validation errors, ensuring a "readable output first" philosophy.
- **Strict Configuration**:
  - `js-beautify` options are strictly defined to match TypeScript definitions and project standards.
  - ESLint's `naming-convention` rule is temporarily disabled for the configuration object to support required snake_case properties.
