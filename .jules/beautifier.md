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

## PHP Support (v0.5.0)

### Validation & Fault-Tolerance
- **Decision:** Integrated `php-parser` for validation. It provides a detailed AST and accurate error locations (line/column) for PHP syntax errors.
- **Recovery:** Reused `js-beautify.html` for formatting with the `templating: ['php']` option. This allows the tool to handle PHP tags and mixed HTML/PHP content resiliently, providing a structured output even when the PHP code contains minor syntax errors (like missing semicolons).
- **Error Reporting:** Syntax errors from `php-parser` are caught and reported as VS Code warning messages, surfacing the first identified issue while still completing the beautification process.

### Auto-Detection
- **Heuristic:** Combined `languageId` check ('php') with content-based heuristics. Looked for the presence of PHP tags (`<?php` or `<?`) at the start of the file or within the content. This ensures reliable identification of PHP files, even those without the standard extension.

## JSONC Support (v0.6.0)

### Validation & Fault-Tolerance
- **Decision:** Selected the `jsonc-parser` package for validation. It provides detailed error information, including offsets that are converted to line/column positions using VS Code's `positionAt` method.
- **Recovery:** Used `js-beautify.js` for formatting. Unlike standard `JSON.stringify`, `js-beautify`'s JS formatter preserves comments and handles the JSONC structure resiliently, fulfilling the "readability is king" philosophy.
- **Error Reporting:** Syntax errors from `jsonc-parser` are caught and reported as VS Code warning messages, surfacing the first identified issue while still completing the beautification process.

### Auto-Detection
- **Heuristic:** Combined `languageId` check ('jsonc') with content-based heuristics. If a file starts with `{` or `[` but contains comment markers (`//` or `/*`), it is automatically identified as JSONC rather than standard JSON. This ensures that comments are preserved even if the user hasn't explicitly set the language mode to JSONC.

## YAML Support (v0.7.0)

### Validation & Fault-Tolerance
- **Decision:** Selected the `yaml` package for its modern API and robust parsing capabilities.
- **Recovery:** Discovered that `yaml.parseDocument(text)` produces a document object even when syntax errors are present. While `doc.toString()` normally throws if errors exist, clearing the `doc.errors` array allows the stringification to proceed. This results in a "best-effort" formatted output that preserves as much structure and as many comments as possible, perfectly aligning with the "readability is king" philosophy.
- **Error Reporting:** Syntax errors captured during `parseDocument` are reported as VS Code warning messages. The first identified error is surfaced to the user, ensuring they are aware of issues while still receiving a beautified version of their code.

### Auto-Detection
- **Heuristic:** Combined `languageId` check ('yaml', 'yml') with content-based heuristics. Looked for common YAML markers such as document start (`---`), list items (`- `), comments (`#`), and key-value pairs (`key: value`). This ensures reliable detection even for files without a standard extension.

## TOML Support (v0.8.0)

### Validation & Fault-Tolerance
- **Decision:** Selected `smol-toml` for validation due to its lightweight nature and accurate error reporting (line/column).
- **Recovery:** Implemented a custom resilient line-by-line formatter. This approach was chosen over library-based stringification to ensure that comments are preserved, as many common TOML libraries lose comments during the parse/stringify cycle.
- **Resilient Formatting:** The custom formatter handles key-value pairs (including quoted keys containing equals signs), table headers, and comments. It implements state tracking for multiline strings (`"""` and `'''`) to avoid data corruption, and applies proper indentation for elements nested under tables. It normalizes spacing around the `=` operator while preserving semantic whitespace in multiline contexts, fulfilling the "readability is king" philosophy even for partially broken files.
- **Error Reporting:** Syntax errors from `smol-toml.parse` are caught and reported as VS Code warnings, surfacing the first identified issue while still attempting to format the rest of the file.

### Auto-Detection
- **Heuristic:** Combined `languageId` check ('toml') with content-based heuristics. Looked for table headers (e.g., `[table]`) or `key = value` patterns, while explicitly excluding text containing curly braces to avoid false positives with CSS or other brace-based languages. This ensures high confidence in identifying TOML files.

## INI Support (v0.9.0)

### Validation & Fault-Tolerance
- **Decision:** Utilized the 'ini' package for basic validation. Since INI is a very lenient format, the package helps identify core structural issues, although it rarely throws errors.
- **Recovery:** Implemented a custom resilient line-by-line formatter. Similar to the TOML approach, this ensures that comments (both ';' and '#') are preserved and that the document structure is maintained even if some lines are malformed.
- **Resilient Formatting:** The formatter handles sections, key-value pairs (supporting both '=' and ':' separators), and inline comments. It ensures consistent spacing around separators and adds a newline before new sections to improve readability. It also includes a basic quote-awareness check for inline comments to prevent misidentifying semicolons inside quoted strings, fulfilling the "readability is king" philosophy.
- **Error Reporting:** Any errors from 'ini.parse' are caught and reported as VS Code warnings, although the primary focus is on providing a structured output regardless of input quality.

### Auto-Detection
- **Heuristic:** Combined 'languageId' check ('ini') with content-based heuristics. Explicitly looked for ';' comments or key-value pairs using ':' to identify INI. For ambiguous cases (using '=' and '[section]'), it checks for the presence of ';' to distinguish from TOML. This ensures high confidence in auto-detecting INI files while avoiding false positives with other formats.

## ENV Support (v0.10.0)

### Validation & Fault-Tolerance
- **Decision:** Implemented a custom resilient line-by-line formatter to handle ENV files. This approach ensures maximum flexibility in preserving comments and handling variations in the format.
- **Resilient Formatting:** The formatter identifies `KEY=VALUE` and `export KEY=VALUE` patterns using a case-insensitive regex. It normalizes the spacing around the `=` operator (e.g., `KEY = VALUE`) for improved readability, matching the "Beautifier" style established for INI and TOML.
- **Error Reporting:** Lines that do not match the expected assignment pattern (and are not comments or empty) are flagged as potential syntax issues. The first such issue encountered is reported to the user as a VS Code warning, while the tool continues to format the rest of the file.

### Auto-Detection
- **Heuristic:** Combined `languageId` check ('dotenv', 'env') with content-based heuristics. It looks for common ENV patterns like lines starting with `#` followed by uppercase assignments, or the presence of `export KEY=VALUE`. It also includes logic to distinguish ENV from INI and TOML by checking for the absence of section headers `[...]` or semicolons `;` when uppercase keys are present.

## CSV Support (v0.11.0)

### Validation & Fault-Tolerance
- **Decision:** Implemented a custom resilient line-by-line formatter for CSV files. This avoids external dependencies while providing maximum flexibility in handling various delimiters and quoting styles.
- **Resilient Formatting:** The formatter automatically detects the most consistent delimiter (comma, semicolon, tab, or pipe) by analyzing the first few lines. It uses a state-machine-inspired parser to correctly identify cell boundaries while respecting double quotes and escaped quotes (\"\").
- **Column Alignment:** To improve readability, the tool calculates the maximum width of each column and pads values accordingly, ensuring a neat tabular view. The last column is not padded to prevent trailing whitespace.
- **Error Reporting:** The tool identifies and reports unclosed quotes and inconsistent column counts across rows as VS Code warnings, while still attempting to align and format the data.

### Auto-Detection
- **Heuristic:** Combined `languageId` check ('csv') with content-based heuristics. It detects the delimiter and checks if the first few rows have a consistent number of columns (> 1). This ensures high confidence in identifying CSV files even without the correct extension, while avoiding false positives on plain text or other formats.

## GraphQL Support (v0.12.0)

### Validation & Fault-Tolerance
- **Decision:** Integrated the official `graphql` package for validation. Its `parse` function provides accurate syntax error reporting with line and column information.
- **Recovery:** Implemented a custom resilient brace-based line-by-line formatter. This approach ensures that even if the GraphQL query is partially broken (e.g., missing closing braces), the tool can still provide a structured output.
- **Resilient Formatting:** The formatter tracks indentation levels by counting opening (`{`, `(`, `[`) and closing (`}`, `)`, `]`) braces. It specifically handles leading closing braces to adjust indentation for the current line and calculates the net change for subsequent lines. It also includes basic state tracking for strings (`"`) and multiline blocks (`"""`) to prevent misidentifying braces within literals, fulfilling the "readability is king" philosophy.
- **Error Reporting:** Syntax errors from `graphql.parse` are caught and reported as VS Code warning messages, surfacing the first identified issue while still completing the beautification process.

### Auto-Detection
- **Heuristic:** Combined `languageId` check ('graphql') with content-based heuristics. It looks for common GraphQL keywords (`query`, `mutation`, `subscription`, `type`, etc.) or simple query patterns starting with `{` that lack JSON-specific markers like colons followed by quotes. This ensures reliable identification of GraphQL files even without the correct extension.

## Python Support (v0.13.0)

### Validation & Fault-Tolerance
- **Decision:** Selected `python-ast` for validation as it supports modern Python 3 syntax. Discovered that the `parse` method prints syntax errors to the console instead of throwing exceptions.
- **Error Reporting:** Implemented a console-capturing hack (overriding `console.error`) to catch and report the first identified syntax error from `python-ast` as a VS Code warning. This ensures the user is notified of the issue without halting the beautification process.
- **Resilient Formatting:** Developed a custom line-by-line formatter that normalizes indentation to 4 spaces. It implements colon-awareness to force indentation on following lines, and keyword-awareness to handle de-indentation for `elif`, `else`, `except`, and `finally`. It also tracks user-driven de-indentation to correctly identify the end of blocks in messy code, fulfilling the "readability is king" philosophy even for partially broken snippets.

### Auto-Detection
- **Heuristic:** Combined `languageId` check ('python') with content-based heuristics. Looked for common Python keywords (`def`, `class`, `import`, etc.) and the standard `if __name__ == "__main__":` entry point pattern. This ensures high confidence in identifying Python files even without the correct extension.

## Java Support (v0.14.0)

### Validation & Fault-Tolerance
- **Decision:** Selected `java-ast` for validation. Similar to `python-ast`, it provides accurate syntax error reporting but prints to `console.error` instead of throwing exceptions.
- **Error Reporting:** Captured `console.error` output during parsing to report the first identified syntax error as a VS Code warning.
- **Recovery:** Used `js-beautify.js` for formatting with an `indent_size` of 4. Since Java's brace-based structure is similar to JavaScript, the JS formatter provides excellent resilience and high-quality output even for partially broken code, fulfilling the "readability is king" philosophy.

### Auto-Detection
- **Heuristic:** Combined `languageId` check ('java') with content-based heuristics. Looked for Java-specific patterns such as access modifiers followed by class/interface/enum keywords, `import java.` statements, the standard `main` method signature, and `package` declarations. This ensures reliable identification of Java source files.

## C# Support (v0.15.0)

### Validation & Fault-Tolerance
- **Decision:** Implemented a custom resilient character-by-character validator for C#. This approach was chosen because a lightweight, standalone C# AST parser for JavaScript was not readily available.
- **Resilient Validation:** The validator tracks balanced braces (`{}`), parentheses (`()`), and brackets (`[]`). It is state-aware, correctly handling single-line comments (`//`), multi-line comments (`/* */`), standard strings (`"`), verbatim strings (`@"`), and interpolated strings (`$"` and `$$"""`). This allows it to identify and report the first structural syntax error while remaining fault-tolerant.
- **Recovery:** Used `js-beautify.js` for formatting with a 4-space indentation standard. Given C#'s similarity to Java and JavaScript, the JS formatter provides a high-quality, resilient beautification even for code with syntax issues, adhering to the "readability is king" philosophy.

### Auto-Detection
- **Heuristic:** Combined `languageId` check ('csharp') with content-based heuristics. Looked for C#-specific markers: common namespaces (`using System;`), namespace declarations, access modifiers followed by C# keywords (`struct`, `record`), the `static void Main` entry point, and common class library calls (`Console.WriteLine`). This ensures high confidence in identifying C# files even without the `.cs` extension.

## C++ Support (v0.16.0)

### Validation & Fault-Tolerance
- **Decision:** Implemented a custom resilient validator for C++. This handles comments, strings, and character literals to accurately track brace balancing.
- **Recovery:** Used `js-beautify.js` for formatting with a 4-space indentation standard. Similar to Java and C#, the JS formatter provides a high-quality, resilient beautification for C-style syntax even with errors.
- **Special Case:** Added support for C++ raw strings `R"delimiter( ... )delimiter"` in the validator to prevent misidentifying braces inside raw literals.

### Auto-Detection
- **Heuristic:** Combined `languageId` check ('cpp', 'c') with content-based heuristics. Looked for C++ specific markers: `#include` directives, standard library usage (`std::cout`, `std::vector`, etc.), `using namespace std;`, templates, access modifiers (`public:`, etc.), and class definitions ending with `};`. This provides high confidence while distinguishing C++ from other brace-based languages.

## Go Support (v0.17.0)

### Validation & Fault-Tolerance
- **Decision:** Implemented a custom resilient character-by-character validator for Go. This tracks balanced braces (`{}`), parentheses (`()`), and brackets (`[]`), while being state-aware for line comments (`//`), block comments (`/* */`), double-quoted strings (`\"`), and backtick raw strings (` ` `).
- **Recovery:** Developed a custom resilient line-by-line formatter. This approach ensures that even with syntax errors, the tool can provide a structured output.
- **Resilient Formatting:** The formatter tracks `indentLevel` based on braces and other opening/closing characters. It implements `extraIndent` logic for `case` and `default` labels to correctly indent subsequent code within `switch` and `select` blocks. It also normalizes spacing around the `:=` operator and ensures a space before opening braces, fulfilling the \"readability is king\" philosophy.
- **Error Reporting:** Syntax errors identified by the validator (e.g., mismatched braces or unclosed strings) are reported as VS Code warning messages, surfacing the first identified issue while still attempting to format the rest of the file.

### Auto-Detection
- **Heuristic:** Combined `languageId` check ('go') with content-based heuristics. Looked for Go-specific markers: `package` and `func` keywords at the start of lines, `import` blocks, `go func` goroutines, channel operations (`chan`), `select` blocks, and the `:=` assignment operator. This ensures high confidence in identifying Go files even without the correct extension.

## Rust Support (v0.18.0)

### Validation & Fault-Tolerance
- **Decision:** Implemented a custom resilient character-by-character validator for Rust. This tracks balanced braces (`{}`), parentheses (`()`), and brackets (`[]`), while being state-aware for line comments (`//`), block comments (`/* */`), double-quoted strings (`\"`), and character literals (`'`).
- **Recovery:** Developed a custom resilient line-by-line formatter. This approach ensures that even with syntax errors, the tool can provide a structured output.
- **Special Case - Lifetimes vs Chars:** The validator and formatter include heuristic logic to distinguish between character literals (e.g., `'a'`) and Rust lifetimes (e.g., `'static`, `'a`) by checking for a closing single quote.
- **Special Case - Raw Strings:** Added support for Rust raw strings `r\"...\"`, `r#\"...\"#`, etc., ensuring that delimiters are correctly matched and no formatting is applied inside raw literals.
- **Resilient Formatting:** The formatter tracks `indentLevel` based on braces and other opening/closing characters. It normalizes spacing around the `=>` and `->` operators, fulfilling the \"readability is king\" philosophy.
- **Error Reporting:** Syntax errors identified by the validator (e.g., mismatched braces or unclosed strings) are reported as VS Code warning messages, surfacing the first identified issue while still attempting to format the rest of the file.

### Auto-Detection
- **Heuristic:** Combined `languageId` check ('rust', 'rs') with content-based heuristics. Looked for Rust-specific markers: keywords (`fn`, `mod`, `pub`, `impl`, `trait`), macros (`println!`, `vec!`), `match` blocks with `=>` arms, and attribute patterns like `#[derive(...)]`. This ensures high confidence in identifying Rust files even without the correct extension.

## Ruby Support (v0.19.0)

### Validation & Fault-Tolerance
- **Decision:** Implemented a custom resilient structural validator for Ruby. Given Ruby's dynamic nature and lack of a lightweight, standalone JS-based AST parser that handles syntax errors gracefully, a keyword-based block tracker was chosen.
- **Resilient Validation:** The validator tracks the balance of block-opening keywords (`class`, `module`, `def`, `begin`, `do`, `case`, `if`, `unless`, `while`, `until`, `for`) and the `end` keyword. It uses a heuristic to distinguish between `if/unless/while/until` as block openers vs. modifiers by checking if they appear at the start of a trimmed line.
- **Recovery:** Developed a custom resilient line-by-line formatter. It maintains an `indentLevel` (using 2 spaces as per Ruby standards) by adjusting for block openers, closers (`end`), and intermediates (`elsif`, `else`, `when`, `rescue`, `ensure`). Intermediates are out-dented for the current line and re-indented for the subsequent content, ensuring a structured output even for partially broken snippets.
- **Error Reporting:** Structural issues like unclosed blocks or unexpected `end` keywords are reported as VS Code warnings, fulfilling the requirement to surface errors while still attempting to format the rest of the file.

### Auto-Detection
- **Heuristic:** Combined `languageId` check ('ruby', 'rb') with content-based heuristics. Looked for Ruby-specific markers: keywords at the start of lines (`class`, `module`, `def`), common library calls (`require`, `include`), attribute macros (`attr_accessor`, etc.), and the presence of `do...end` blocks. It also identifies Ruby by the combination of `#` comments and specific keywords, ensuring reliable detection even without a standard extension.

## Swift Support (v0.20.0)

### Validation & Fault-Tolerance
- **Decision:** Implemented a custom resilient structural validator for Swift. This handles nested block comments and string interpolation, which are key features of the language.
- **Resilient Validation:** The validator tracks balanced braces ({}), parentheses (()), and brackets ([]). It is state-aware, correctly handling single-line comments (//), multi-line nested comments (/* /* */ */), standard strings (""), and multiline strings (""" """).
- **Special Case - Interpolation:** Added support for Swift's string interpolation \(...). The validator and formatter use a state stack and track brace depth to correctly identify when the code returns from interpolation (NORMAL state) back to the STRING state.
- **Recovery:** Developed a custom resilient line-by-line formatter (standardizing 4-space indentation). It tracks indentLevel based on braces and other opening/closing characters while being aware of the current state (comment/string/normal) to ensure "readability is king" even for partially broken snippets.
- **Error Reporting:** Structural issues like mismatched braces or unclosed strings are reported as VS Code warnings, surfacing the first identified issue while still attempting to format the rest of the file.

### Auto-Detection
- **Heuristic:** Combined languageId check ('swift') with content-based heuristics. Looked for Swift-specific markers: common import statements (Foundation, UIKit, SwiftUI), keywords followed by identifiers (protocol, extension, actor, func, let, var), and attribute patterns like @main. This ensures high confidence in identifying Swift files even without the correct extension.
