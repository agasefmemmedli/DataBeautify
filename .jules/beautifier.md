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
