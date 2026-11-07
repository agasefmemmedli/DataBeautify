# Changelog

## 1.0.0

Formatting is now safe: your data is never changed silently. SQL and PL/SQL are supported.

- **SQL and PL/SQL:** new `Beautify SQL` command, 20 SQL dialects, PL/SQL blocks (procedures, functions, packages, triggers, anonymous blocks) indented, SQL*Plus commands kept on their own lines. Only whitespace (and keyword case, if enabled) can change; every result is checked token by token. New settings `beautifyFormat.sql.dialect` and `beautifyFormat.sql.keywordCase`, and a `PL/SQL` language mode for `.pls`, `.pks`, `.pkb` and similar files.
- Every result is checked before it is written. A valid file keeps exactly the same data; if a change is detected, the file is left untouched.
- Fixes that only touch punctuation (commas, quotes) are applied with a warning. Any other fix (brackets, missing colons, `NaN`, broken XML) asks first and offers a **Preview** diff.
- XML: backslashes in attribute values (`C:\temp\`) are kept, `xml:space="preserve"` content is kept as is, attribute order is kept by default (new setting `beautifyFormat.xml.sortAttributes`).
- JSON: unquoted keys in any alphabet, comments in `.json` files are kept, end-of-line comments stay on their line.
- The description now lists only the supported formats: JSON, JSONC, XML, SQL and PL/SQL (other languages were removed earlier).
- Much smaller package and support for every VS Code version from 1.74.
