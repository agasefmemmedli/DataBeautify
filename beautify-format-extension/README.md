<div align="center">

  # Beautify Format
  **The Industry Standard for Fault-Tolerant Formatting**

  [![VS Code Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/DataBeautify.beautify-format?style=for-the-badge&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=DataBeautify.beautify-format)
  [![Installs](https://img.shields.io/visual-studio-marketplace/i/DataBeautify.beautify-format?style=for-the-badge&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=DataBeautify.beautify-format)
  [![License](https://img.shields.io/github/license/agasefmemmedli/beautify-format-extension?style=for-the-badge)](https://github.com/agasefmemmedli/beautify-format-extension/blob/main/LICENSE)
</div>

---

## 🚀 Why Beautify Format?

Stop fighting with syntax errors just to format code.

**Beautify Format** is built on a proprietary **Fault Tolerance Engine** that formats code others refuse to touch. Unlike traditional formatters that crash on missing semicolons or unbalanced brackets, this tool intelligently repairs syntax while beautifying, ensuring your workflow never breaks.

## ✨ Key Features

- **🛡️ Fault Tolerance**: Automatically fixes minor syntax errors (missing brackets, semicolons, etc.) during formatting.
- **🧠 Smart Auto-Detection**: Ignores misleading file extensions and detects the true language based on content heuristics.
- **🌍 50+ Supported Languages**: From modern web frameworks to legacy system configs, we handle it all.
- **⚡ Zero Config**: Works instantly with sensible defaults. No `.prettierrc` or complex setup required.

## 📦 Supported Languages

<details>
<summary><strong>🌐 Web Technologies</strong></summary>

| Language | Extensions |
| :--- | :--- |
| **HTML** | `.html`, `.htm` |
| **CSS** | `.css` |
| **SCSS** | `.scss` |
| **SASS** | `.sass` |
| **LESS** | `.less` |
| **SVG** | `.svg` |
| **Vue** | `.vue` |
| **Svelte** | `.svelte` |
| **PHP** | `.php` |
| **Astro** | `.astro` |

</details>

<details>
<summary><strong>📜 Scripting & Compiled</strong></summary>

| Language | Extensions |
| :--- | :--- |
| **JavaScript** | `.js`, `.mjs`, `.cjs` |
| **TypeScript** | `.ts` |
| **JSX / TSX** | `.jsx`, `.tsx` |
| **Python** | `.py` |
| **Ruby** | `.rb` |
| **Go** | `.go` |
| **Rust** | `.rs` |
| **C++ / C** | `.cpp`, `.c`, `.h` |
| **C#** | `.cs` |
| **Java** | `.java` |
| **Kotlin** | `.kt`, `.kts` |
| **Swift** | `.swift` |
| **Dart** | `.dart` |

</details>

<details>
<summary><strong>💾 Data & Configuration</strong></summary>

| Language | Extensions |
| :--- | :--- |
| **JSON / JSONC** | `.json`, `.jsonc` |
| **YAML** | `.yaml`, `.yml` |
| **TOML** | `.toml` |
| **INI** | `.ini` |
| **ENV** | `.env` |
| **CSV** | `.csv` |
| **XML** | `.xml` |
| **SQL** | `.sql` |
| **GraphQL** | `.graphql`, `.gql` |
| **Prisma** | `.prisma` |
| **MongoDB Shell** | `.mongodb`, `.js` |

</details>

<details>
<summary><strong>⚙️ Systems & DevOps</strong></summary>

| Language | Extensions |
| :--- | :--- |
| **Dockerfile** | `Dockerfile`, `.dockerfile` |
| **Shell Script** | `.sh`, `.bash` |
| **PowerShell** | `.ps1`, `.psm1` |
| **Terraform / HCL** | `.tf`, `.hcl` |
| **Makefile** | `Makefile` |
| **Nginx** | `.conf`, `.nginx` |
| **Log Files** | `.log` |
| **Git Config** | `.gitconfig` |
| **EditorConfig** | `.editorconfig` |

</details>

<details>
<summary><strong>📝 Markup & Documentation</strong></summary>

| Language | Extensions |
| :--- | :--- |
| **Markdown** | `.md` |
| **MDX** | `.mdx` |
| **LaTeX** | `.tex`, `.latex` |
| **Handlebars** | `.hbs`, `.handlebars` |
| **Twig** | `.twig` |
| **Liquid** | `.liquid` |
| **Jupyter Notebook** | `.ipynb` |

</details>

## 📥 Installation & Usage

1. **Install** the extension from the VS Code Marketplace.
2. **Open** any supported file.
3. **Format** using one of the following methods:

### ⌨️ Keybindings

| OS | Shortcut |
| :--- | :--- |
| **Windows / Linux** | `Ctrl` + `Alt` + `B` |
| **macOS** | `Cmd` + `Alt` + `B` |

### 🖱️ Command Palette

1. Press `Ctrl` + `Shift` + `P` (or `Cmd` + `Shift` + `P` on macOS).
2. Type `Beautify Format` and select the command.

*(Add a GIF here demonstrating the formatting process)*

## ⚙️ Extension Settings

Beautify Format operates with **Zero Configuration**. It automatically detects indentation, language, and syntax issues without requiring a configuration file.

However, the following behaviors are default:

| Setting | Default | Description |
| :--- | :--- | :--- |
| **Indentation** | `2 spaces` | Standard indentation for most languages (configurable via VS Code settings). |
| **Fault Tolerance** | `High` | Aggressively attempts to fix syntax errors during formatting. |
| **Auto-Detect** | `Enabled` | Uses content heuristics to identify language if extension is wrong. |

> **Note**: To customize specific formatter options (e.g., brace style), use standard VS Code settings for now. Advanced configuration (`beautify.json`) is coming in v1.0.

## 📋 Requirements

- **Visual Studio Code**: v1.74.0 or higher.

## 📄 License

MIT © [DataBeautify](https://github.com/agasefmemmedli)
