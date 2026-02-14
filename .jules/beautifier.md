# Beautifier Log 💎

## Initial Architectural Insights

### HTML Implementation Strategy
- **Libraries**: Using `js-beautify` for formatting and `htmlhint` for validation.
- **Auto-detection**: Heuristics will search for `<!doctype html>`, `<html>`, `<div>`, or `<body>` tags (case-insensitive) to distinguish HTML from XML when the language ID is not conclusive.
- **Fault-Tolerance**: `htmlhint` will be used to identify syntax errors. To avoid overwhelming the user, only the first three errors will be reported. Formatting will still be attempted using `js-beautify` even if errors are present.
- **ESLint Compliance**: Snake_case options for `js-beautify` require local disabling of `@typescript-eslint/naming-convention`. The 'curly' rule must be strictly followed for all new logic.
- **Dependencies**: Adding `@types/js-beautify` and `@types/htmlhint` is necessary for TypeScript compilation as the project uses strict typing.
