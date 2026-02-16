# ✂️ Shrink: Architectural Insights

## Extension Size Diagnosis
- **Initial Size:** 44.16 MB (uncompressed), 10.56 MB (compressed).
- **Weight Leaders:**
  - `@azure`: 45M (Dev dependency included in node_modules)
  - `@vscode`: 34M (Dev dependency included in node_modules)
  - `typescript`: 23M (Runtime dependency, but also used as build tool)

## Bundling Strategy
- **Tool:** esbuild
- **Decision:** Moving from raw `node_modules` to a single-file bundle in `dist/extension.js`.
- **Reasoning:** VS Code extension performance improves significantly with bundled code due to reduced file I/O during activation.

## esbuild Configuration
- **Entry point:** `src/extension.ts`
- **Bundle:** `true`
- **Minify:** `true`
- **Platform:** `node`
- **Target:** `node16`
- **External:** `['vscode']`
- **Outcome:** Successfully bundled 30+ formatters into a single 9.42 MB file.

## Optimization Notes
- **Lazy Loading:** All formatters are currently in a single large `extension.ts`. esbuild's tree-shaking helped, but the biggest gain came from excluding `node_modules` entirely from the final package using `.vscodeignore`.
- **Externalizing:** `vscode` is marked as external since it is provided by the VS Code host environment.
- **Import Fixes:** Had to change `php-parser` and `less` imports from `import * as pkg` to `import pkg` to correctly handle their default exports when bundled and run in a Node environment.

## Final Results
- **Final Size:** ~9.5 MB (uncompressed), **2.43 MB** (compressed).
- **Weight Loss:** -34.66 MB (uncompressed), -8.13 MB (compressed).
- **Functional Check:** All 30 formats verified using custom verification script `src/verify-formatters.ts` with VS Code API mocks.
