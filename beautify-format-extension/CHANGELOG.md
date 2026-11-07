# Changelog

## 1.1.0

- Beautify Format is now a regular VS Code formatter: **Format Document** (Shift+Alt+F), **Format Selection** and **Format on Save** work for JSON, JSONC, XML, SQL and PL/SQL. A fix that needs review is never applied on save.
- Works in the browser (vscode.dev, github.dev) and in Restricted Mode.
- PL/SQL: spaces around `:=`, comparison operators, `=>` and `||`, and after commas.
- New before/after picture on the Marketplace page.
- After many successful formats, the extension asks once whether you want to rate it.

## 1.0.1

- Fixed the version and installs badges on the Marketplace page (the old badge service was retired).

## 1.0.0

Formatting is now safe: your data is never changed silently. SQL and PL/SQL are supported.

- **SQL and PL/SQL:** new `Beautify SQL` command, 20 SQL dialects, PL/SQL blocks (procedures, functions, packages, triggers, anonymous blocks) indented, SQL*Plus commands kept on their own lines. Only whitespace (and keyword case, if enabled) can change; every result is checked token by token. New settings `beautifyFormat.sql.dialect` and `beautifyFormat.sql.keywordCase`, and a `PL/SQL` language mode for `.pls`, `.pks`, `.pkb` and similar files.
- Every result is checked before it is written. A valid file keeps exactly the same data; if a change is detected, the file is left untouched.
- Fixes that only touch punctuation (commas, quotes) are applied with a warning. Any other fix (brackets, missing colons, `NaN`, broken XML) asks first and offers a **Preview** diff.
- XML: backslashes in attribute values (`C:\temp\`) are kept, `xml:space="preserve"` content is kept as is, attribute order is kept by default (new setting `beautifyFormat.xml.sortAttributes`).
- JSON: unquoted keys in any alphabet, comments in `.json` files are kept, end-of-line comments stay on their line.
- The description now lists only the supported formats: JSON, JSONC, XML, SQL and PL/SQL (other languages were removed earlier).
- Much smaller package and support for every VS Code version from 1.74.
