# 💎 Beautifier's Log

## HTML Support Implementation

### Auto-detection
- Prioritizes VS Code `languageId` (html/htm).
- Implements case-insensitive content heuristics for `<!doctype html>`, `<html>`, `<body>`, and `<div>`.
- High confidence levels are maintained by checking for standard HTML opening tags when the format is otherwise unknown.

### Fault-Tolerance & Error Reporting
- Utilizes `htmlhint` for non-halting validation.
- Collects and reports up to the first 3 syntax errors found, ensuring the user is informed without being overwhelmed.
- Uses `js-beautify` for resilient formatting; even with missing brackets or typos, the tool attempts to provide a structured output.
- Wrapped in a try-catch block to prevent the entire extension from crashing on extremely malformed snippets.

### Architectural Insights
- The `js-beautify` configuration uses a strict set of options to comply with TypeScript definitions while maintaining the "Beautifier" philosophy of readability.
- `/* eslint-disable */` is used for the configuration object to allow required snake_case properties (`indent_size`, `max_preserve_newlines`, etc.).
