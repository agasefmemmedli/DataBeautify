# Changelog

## 1.0.0

Formatting is now safe: your data is never changed silently.

- Every result is checked before it is written. A valid file keeps exactly the same data; if a change is detected, the file is left untouched.
- Fixes that only touch punctuation (commas, quotes) are applied with a warning. Any other fix (brackets, missing colons, `NaN`, broken XML) asks first and offers a **Preview** diff.
- XML: backslashes in attribute values (`C:\temp\`) are kept, `xml:space="preserve"` content is kept as is, attribute order is kept by default (new setting `beautifyFormat.xml.sortAttributes`).
- JSON: unquoted keys in any alphabet, comments in `.json` files are kept, end-of-line comments stay on their line.
- The description now lists only the supported formats: JSON, JSONC and XML.
- Much smaller package and support for every VS Code version from 1.74.
