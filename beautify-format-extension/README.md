<div align="center">

  # Beautify Format
  **Safe, fault-tolerant formatting for JSON, JSONC, XML, SQL and PL/SQL**

  [![VS Code Marketplace Version](https://vsmarketplacebadges.dev/version-short/DataBeautify.beautify-format.svg?style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=DataBeautify.beautify-format)
  [![Installs](https://vsmarketplacebadges.dev/installs-short/DataBeautify.beautify-format.svg?style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=DataBeautify.beautify-format)
  [![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)
</div>

---

## Why Beautify Format?

Most formatters give up on a file with a syntax error. Beautify Format fixes common mistakes while formatting, and it checks every result before writing it:

- **Your data never changes silently.** For a valid file, the formatted result is compared with the original. If anything other than whitespace would change, the file is left untouched.
- **Fixes are always reported.** A fix that only touches punctuation (a missing or extra comma, a missing colon, quotes around a key or a single-quoted string) is applied with a warning that shows the error location. Every key, value and bracket stays the same. Press `Ctrl+Z` to undo.
- **Guesses need your approval.** Any other fix could change your data: adding or removing a bracket (where it belongs cannot be known for sure), `NaN` becoming `"NaN"`, or broken XML where the end of a tag has to be guessed. You are asked first, and **Preview** opens a diff of the suggested fix without changing the file.
- **No broken output.** If a broken file cannot be turned into a valid one, nothing is written and you see where the error is.

## Supported formats

| Format | Language mode / extensions | What gets fixed |
| :--- | :--- | :--- |
| **JSON** | `json` (`.json`) | missing or extra commas, unquoted keys, single quotes, trailing commas. After confirmation: missing colons, unclosed or extra brackets, bare words such as `NaN`. Comments are kept; if a broken file can only be fixed by dropping them, the warning says so. |
| **JSONC** | `jsonc` (`.jsonc`, `tsconfig.json`, VS Code settings) | missing commas. Comments are always kept, trailing commas are added. |
| **XML** | `xml`, `xsl` (`.xml`, `.svg`, …) | unclosed and mismatched tags (after confirmation) |
| **SQL** | `sql` and SQL extensions' modes (`pgsql`, `mysql`, `tsql`, …) | nothing: only layout changes. SQL that cannot be parsed is left untouched. |
| **PL/SQL** | `plsql` (`.pls`, `.plsql`, `.pks`, `.pkb`, `.pck`, `.prc`, `.fnc`, `.trg`, `.tps`, `.tpb`), or PL/SQL code in a `.sql` file | nothing: only layout changes |

For files in other language modes the format is detected from the content: `{` or `[` means JSON, `<` means XML, a statement such as `SELECT` or `CREATE` means SQL.

### SQL and PL/SQL

- Every token (keywords, names, strings, numbers, comments) is kept in the same order; only spaces and line breaks change. Keyword case changes only if you ask for it.
- Queries and DML (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `MERGE`, DDL) are laid out by [sql-formatter](https://github.com/sql-formatter-org/sql-formatter); 20 dialects are supported.
- PL/SQL blocks are indented: `CREATE PROCEDURE / FUNCTION / PACKAGE [BODY] / TRIGGER / TYPE BODY`, `DECLARE`, `BEGIN`, `EXCEPTION`, `IF / ELSIF / ELSE`, `LOOP`, `WHILE`, `FOR`, `CASE`, labels. SQL inside blocks (including `CURSOR … IS SELECT`, `FOR r IN (SELECT …) LOOP`, `FORALL`) is formatted too, and long calls get one argument per line.
- SQL*Plus commands (`/`, `SET …`, `SHOW ERRORS`, `PROMPT`, `SPOOL`, `WHENEVER`, `@script`, `EXIT`, …) stay on their own lines exactly as written. Inside a PL/SQL block, `EXIT;` and `EXECUTE IMMEDIATE` are treated as code, as SQL*Plus does.
- Oracle `q'[…]'` strings, `:new`/`:old`, bind variables and `&substitution` variables are kept intact.

### Formatting rules

- Indentation follows the editor settings (`editor.tabSize`, `editor.insertSpaces`).
- Short JSON objects and arrays (under 80 characters) stay on one line.
- XML elements with short text stay on one line; long attribute lists are wrapped.
- XML: content of `xml:space="preserve"` elements is kept exactly as is; backslashes in attribute values are kept.

## Usage

| Action | How |
| :--- | :--- |
| Format the current file | `Ctrl+Alt+B` (`Cmd+Alt+B` on macOS) |
| Command Palette | `Beautify Format`, `Beautify JSON`, `Beautify JSONC`, `Beautify XML`, `Beautify SQL` |
| Context menu | right-click in a JSON, JSONC, XML, SQL or PL/SQL file → **Beautify Format** |

## Settings

| Setting | Default | Description |
| :--- | :--- | :--- |
| `beautifyFormat.xml.sortAttributes` | `false` | Sort XML attributes (`id`, `class`, `name`, `src`, `href`, `type` first, then alphabetically). |
| `beautifyFormat.sql.dialect` | `auto` | SQL dialect (`plsql`, `postgresql`, `mysql`, `transactsql`, `sqlite`, …). `auto` uses the language mode, recognizes PL/SQL, and otherwise tries standard SQL, PostgreSQL, MySQL, T-SQL and PL/SQL. |
| `beautifyFormat.sql.keywordCase` | `preserve` | `preserve`, `upper` or `lower`. |

## Requirements

- Visual Studio Code 1.74.0 or newer.

## Development

```bash
npm install
npm test          # compiles and runs the unit tests
npm run test:corpus -- <folder>   # formats every JSON/XML/SQL file in a folder and checks the safety rules
npm run bundle    # builds dist/extension.js
npx vsce package  # builds the .vsix
```

## License

MIT © [DataBeautify](https://github.com/agasefmemmedli/DataBeautify)
