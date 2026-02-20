"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));

// Minimal VS Code Mock
const mockVscode = {
    window: {
        activeTextEditor: undefined,
        showInformationMessage: (msg) => console.log('INFO:', msg),
        showErrorMessage: (msg) => console.log('ERROR:', msg),
        showWarningMessage: (msg) => console.log('WARN:', msg),
    },
    Range: class {
        constructor(start, end) {
            this.start = start;
            this.end = end;
        }
    },
    Position: class {
        constructor(line, character) {
            this.line = line;
            this.character = character;
        }
    },
    commands: {
        registerCommand: () => ({ dispose: () => { } }),
    },
    workspace: {
        applyEdit: async () => true,
        getConfiguration: () => ({
            get: (key, defaultValue) => defaultValue
        })
    },
    WorkspaceEdit: class {
        replace(uri, range, newText) {
             // Basic mock
        }
    }
};

// Injection to handle 'import * as vscode from "vscode"'
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'vscode') {
        return mockVscode;
    }
    return originalRequire.apply(this, arguments);
};

async function runTest() {
    // Load extension after mock
    // Using compiled output
    let beautify;
    try {
        const ext = require('./out/extension');
        beautify = ext.beautify;
    } catch (e) {
        console.error("Could not load extension. Make sure to run 'npm run compile' first.");
        console.error(e);
        process.exit(1);
    }

    const testFile = 'test.deep.editorconfig';
    console.log(`Testing ${testFile}...`);
    const filePath = path.join(__dirname, testFile);

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf8');

    // Mock editor
    let formattedText = '';
    const mockEditor = {
        options: {
            tabSize: 4,
            insertSpaces: true
        },
        document: {
            getText: () => content,
            lineCount: content.split('\n').length,
            languageId: 'properties', // EditorConfig usually maps to properties or ini in VS Code
            uri: { fsPath: filePath },
            lineAt: (line) => {
                const lines = content.split('\n');
                const text = lines[line] || '';
                return {
                    text: text,
                    range: {
                        start: new mockVscode.Position(line, 0),
                        end: new mockVscode.Position(line, text.length)
                    },
                    rangeIncludingLineBreak: {
                         start: new mockVscode.Position(line, 0),
                         end: new mockVscode.Position(line + 1, 0)
                    },
                    lineNumber: line,
                    isEmptyOrWhitespace: text.trim().length === 0
                };
            }
        },
        edit: async (callback) => {
            const eb = {
                replace: (range, text) => {
                    formattedText = text;
                }
            };
            callback(eb);
            return true;
        }
    };

    mockVscode.window.activeTextEditor = mockEditor;

    try {
        // We need to simulate the filename check in extension.ts or force the languageId
        // The extension uses 'editorconfig' or checks filename?
        // Let's check extension.ts logic if needed, but usually beautify() takes languageId if passed?
        // The export is `beautify(languageId)`.

        // EditorConfig doesn't have a standard language ID in default vscode always, but let's try 'properties' or 'editorconfig'
        // In misc.ts it is handleEditorConfig.
        // We need to see how `extension.ts` maps it.

        // But for this test, we can just call it with 'properties' if the mapping is there, or 'editorconfig' if added.
        // Let's assume 'properties' for now or check extension.ts

        await beautify('editorconfig');

        // If 'properties' doesn't trigger handleEditorConfig, we might need to fix extension.ts or use the correct ID.
        // Let's check formattedText.

        console.log('--- Original ---');
        console.log(content);
        console.log('--- Formatted ---');
        console.log(formattedText);
        console.log('-----------------');

        if (formattedText && formattedText !== content) {
            console.log(`✅ ${testFile} beautified successfully.`);

            // Verification logic
            const lines = formattedText.split('\n');

            // Check if root = true is at the top (after comments)
            const rootIndex = lines.findIndex(l => l.trim() === 'root = true');
            if (rootIndex === -1) {
                console.error("❌ 'root = true' not found.");
                process.exit(1);
            }

            // Check if sections are separated by blank lines
            // Check if properties are indented
            const indentStyleLine = lines.find(l => l.includes('indent_style'));
            if (indentStyleLine && !indentStyleLine.startsWith('    ')) {
                 console.error("❌ Properties not indented with 4 spaces.");
                 process.exit(1);
            }

            // Check alignment
            // indent_style = space
            // indent_size  = 2
            // "indent_size" is shorter than "indent_style", so it should be padded if aligned.
            // Wait, "indent_style" (12 chars), "indent_size" (11 chars).
            // So indent_size should have 1 extra space before = if aligned.

            const indentSizeLine = lines.find(l => l.trim().startsWith('indent_size'));
            if (indentSizeLine && !indentSizeLine.includes('indent_size  =')) {
                 console.warn("⚠️ Properties might not be aligned (optional but desired).");
            }

            // Check sorting?
            // "charset" comes before "indent_style" alphabetically.
            // In original: charset is first.
            // "end_of_line" comes before "indent_size".
            // Original: indent_size then end_of_line.
            // Formatted should have end_of_line first.

            const endOfLineIndex = lines.findIndex(l => l.includes('end_of_line'));
            const indentSizeIndex = lines.findIndex(l => l.includes('indent_size'));

            if (endOfLineIndex > -1 && indentSizeIndex > -1 && endOfLineIndex > indentSizeIndex) {
                 console.error("❌ Properties not sorted alphabetically.");
                 process.exit(1);
            }

        } else if (formattedText === content) {
            console.log(`ℹ️ ${testFile} already formatted or no changes applied.`);
             // Fail if we expected changes
             process.exit(1);
        } else {
            console.log(`⚠️ ${testFile} produced no changes.`);
            process.exit(1);
        }
    } catch (err) {
        console.error(`❌ Error testing ${testFile}:`, err);
        process.exit(1);
    }
}

runTest().catch(err => {
    console.error(err);
    process.exit(1);
});
