# Beautifier 💎 Log

## CSS Support (v0.0.3)

### Validation & Fault-Tolerance
- **Decision:** Selected the `css` package for validation due to its lightweight nature and ability to report parsing errors with line/column information even in `silent` mode.
- **Recovery:** Used `js-beautify.css` for formatting. It is inherently resilient to most common CSS syntax errors (like missing braces), allowing the tool to provide a structured output even for broken snippets.
- **Error Reporting:** Errors from `css.parse` are captured and reported as VS Code warning messages, surfacing the first identified issue while still completing the beautification process.

### Auto-Detection
- **Heuristic:** Implemented a regex-based heuristic `/[a-z0-9-_#.]+\s*\{/i` combined with a check for both `{` and `}` to identify CSS snippets in files without a `.css` extension or explicit `languageId`. This provides high confidence while avoiding false positives on other curly-brace languages (like JSON which starts with `{`).

## SCSS & SASS Support (v0.0.4)

### Validation & Fault-Tolerance
- **Decision:** Selected the `sass` package for validation. It provides accurate syntax error reporting (including line/column) for both SCSS and indented SASS.
- **Formatting SCSS:** Reused `js-beautify.css` for SCSS. It handles nested selectors and variables correctly, matching the existing CSS formatting style.
- **Formatting SASS:** Integrated `sass-formatter` for indented SASS. It specifically addresses the indentation-based structure where general CSS formatters fail.
- **Error Reporting:** Syntax errors from `sass.compileString` are caught. The first line of the error message along with line/column information is reported as a warning, ensuring the user is notified of issues while the tool still attempts to produce a formatted output.

### Auto-Detection
- **SCSS Heuristic:** Look for curly braces { combined with common preprocessor markers like $, @mixin, or @include.
- **SASS Heuristic:** Identify files starting with $ that lack curly braces {, typical of indented SASS syntax.

## LESS Support (v0.0.7)

### Validation & Fault-Tolerance
- **Decision:** Used the `less` package for validation via `less.render`. This provides accurate syntax error reporting with line and column information.
- **Recovery:** Reused `js-beautify.css` for formatting. It is highly resilient to LESS-specific syntax and nested structures, allowing the tool to produce a readable output even when the input contains syntax errors.
- **Error Reporting:** Syntax errors from `less.render` are caught, and the first error (with line/column) is reported as a warning, maintaining the "fault-tolerant" philosophy.

### Auto-Detection
- **Heuristic:** Look for curly braces { combined with LESS-specific markers: variables (e.g., @variable:) or mixin definitions/calls (e.g., .mixin-name(). This distinguishes LESS from standard CSS and SCSS.

## JavaScript Support (v0.0.9)

### Validation & Fault-Tolerance
- **Decision:** Selected the `acorn` package for validation. It is lightweight, fast, and provides detailed error locations (line/column).
- **Recovery:** Used `js-beautify.js` for formatting. It is highly resilient and will attempt to format code even if it contains syntax errors, fulfilling the "readability is king" philosophy.
- **Error Reporting:** Syntax errors from `acorn.parse` are caught, and the error message with line/column information is reported as a warning, allowing the user to fix the issue while still seeing a beautified version of the code.

### Auto-Detection
- **Heuristic:** Combined `languageId` check ('javascript', 'javascriptreact') with content-based heuristics. Looked for common JS keywords (`var`, `let`, `const`, `function`, `class`, `import`, etc.) and arrow function markers (`=>`). Added a fallback check for the presence of curly braces `{}` and semicolons `;` to catch simple JS snippets.

## TypeScript Support (v0.1.0)

### Validation & Fault-Tolerance
- **Decision:** Selected the `typescript` package for validation. Used `ts.createSourceFile` to obtain `parseDiagnostics`, which provides detailed syntax error information (message, line, column).
- **Recovery:** Reused `js-beautify.js` for formatting. Since TypeScript is a superset of JavaScript, `js-beautify`'s JS formatter handles most TypeScript syntax gracefully and is highly resilient to syntax errors, allowing the tool to produce a readable output even when the input is broken.
- **Error Reporting:** Syntax errors from `parseDiagnostics` are reported as VS Code warning messages. The first identified error with line/column information is surfaced to the user, fulfilling the fault-tolerant requirement.

### Auto-Detection
- **Heuristic:** Combined `languageId` check ('typescript', 'typescriptreact') with content-based heuristics. Looked for TypeScript-specific keywords (`interface`, `namespace`, `type`, `enum`, `public`, `private`, `protected`, `readonly`, `as`, `implements`) and type annotations (e.g., `: string`, `: number`).

## JSX & TSX Support (v0.2.0)

### Validation & Fault-Tolerance
- **Decision:** Utilized the `typescript` package for validating both JSX and TSX. By specifying `ts.ScriptKind.JSX` and `ts.ScriptKind.TSX` in `ts.createSourceFile`, we obtain accurate syntax error diagnostics including line and column information.
- **Recovery:** Used `js-beautify.js` for formatting with the `e4x: true` option enabled. This ensures that JSX elements are handled correctly while maintaining the resilience of the JavaScript formatter, which can still produce readable output even with minor syntax errors.
- **Error Reporting:** Syntax errors from TypeScript diagnostics are reported as VS Code warning messages, showing the first identified error's message and location.

### Auto-Detection
- **Heuristic for JSX:** Combines the presence of JSX tags (`<` and `/>` or `</`) with common JavaScript keywords (`import`, `export`, `function`, `const`, etc.) to distinguish JSX from plain JavaScript or XML.
- **Heuristic for TSX:** Similar to JSX, but also checks for TypeScript-specific markers like interfaces, type annotations, or generic syntax to distinguish it from plain JSX.
- **Language ID:** Added explicit mapping for `javascriptreact` to `jsx` and `typescriptreact` to `tsx`.

## Vue Support (v0.3.0)

### Validation & Fault-Tolerance
- **Decision:** Used `htmlhint` for validation. Since Vue SFCs are structured similarly to HTML, `htmlhint` provides a good baseline for template validation.
- **Customization:** Disabled the `doctype-first` rule for Vue files, as they typically do not start with a doctype declaration.
- **Recovery:** Utilized `js-beautify.html` for formatting. It natively supports Vue files and is highly resilient to syntax errors.
- **Enhanced Formatting:** Configured `js-beautify.html` with specific nested options for `js` and `css` to ensure that `<script>` and `<style>` blocks are formatted consistently with the rest of the extension's standards.

### Auto-Detection
- **Heuristic:** Looked for the `vue` language ID or content-based markers: the presence of `<template` tags, or specific Vue attributes like `script setup` and `style scoped`. This distinguishes Vue SFCs from standard HTML or other template languages.

## Svelte Support (v0.4.0)

### Validation & Fault-Tolerance
- **Decision:** Selected the `svelte/compiler` (v5) package for validation. The `parse` function provides accurate syntax error reporting with line and column information for Svelte-specific blocks.
- **Recovery:** Utilized `js-beautify.html` for formatting. While it doesn't natively indent Svelte logic blocks (e.g., `{#if}`), it handles the overall HTML structure, `<script>`, and `<style>` blocks with high resilience, fulfilling the "readability is king" philosophy.
- **Error Reporting:** Errors from `svelte.parse` are caught and reported as VS Code warning messages, surfacing the first identified issue (e.g., unclosed blocks) while still completing the beautification process.

### Auto-Detection
- **Heuristic:** Combined `languageId` check ('svelte') with content-based heuristics. Looked for Svelte-specific block syntax (`{#if`, `{#each`, `{#await`) and script-level markers like `export let` or the reactive declaration `$:`. This ensures high confidence in identifying Svelte SFCs even without the correct file extension.
