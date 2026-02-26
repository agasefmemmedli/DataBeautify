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
    let beautify;
    try {
        const ext = require('./out/extension');
        beautify = ext.beautify;
    } catch (e) {
        console.error("Could not load extension. Make sure to run 'npm run compile' first.");
        console.error(e);
        process.exit(1);
    }

    const testFile = 'test/test.deep.ps1';
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
            languageId: 'powershell',
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
        await beautify('powershell');
        console.log('--- Original ---');
        console.log(content);
        console.log('--- Formatted ---');
        console.log(formattedText);
        console.log('-----------------');

        const textToCheck = formattedText || content;

        if (textToCheck) {
            console.log(`✅ ${testFile} processed.`);

            // Verification logic
            const lines = textToCheck.split('\n');

            // 1. Check Brace Style (OTBS)
            if (!/function Get-DeepTest \{/.test(textToCheck)) {
                console.error("❌ OTBS violation: function brace not on same line or misformatted.");
                process.exit(1);
            }
            if (!/if \(\$Name -eq 'Test'\) \{/.test(textToCheck)) {
                console.error("❌ OTBS violation: if brace not on same line or misformatted.");
                process.exit(1);
            }

            // 2. Check Indentation
            const paramLine = lines.find(l => l.trim().startsWith('[string]') && l.includes('$Name'));
            if (!paramLine) {
                 console.error("❌ Indentation violation: '[string]$Name' line not found.");
                 process.exit(1);
            }
            if (!paramLine.startsWith('        ')) { // 8 spaces (function + param block)
                console.error(`❌ Indentation violation: '[string]$Name' should be indented with 8 spaces. Found: '${paramLine}'`);
                process.exit(1);
            }

            // 3. Check Else Style
            if (!/\s+\} else \{/.test(textToCheck)) {
                 console.error("❌ OTBS violation: '} else {' pattern not found.");
                 process.exit(1);
            }

            // 4. Check Case Normalization
            if (textToCheck.includes('Function ')) {
                console.error("❌ Keyword casing violation: 'Function' should be 'function'.");
                process.exit(1);
            }
            if (textToCheck.includes('Foreach ')) {
                console.error("❌ Keyword casing violation: 'Foreach' should be 'foreach'.");
                process.exit(1);
            }

            // 5. Check Here-String
            if (!textToCheck.includes('$hereString = @"')) {
                console.error("❌ Here-String broken.");
                process.exit(1);
            }

            // 6. Check Pipeline Indentation
            const whereObjectLine = lines.find(l => l.trim().startsWith('Where-Object'));
            if (!whereObjectLine) {
                console.error("❌ Pipeline violation: 'Where-Object' line not found.");
                process.exit(1);
            }
            // Indentation logic:
            // function (0) -> foreach (4) -> Get-Process (8)
            // Where-Object (12)
            if (!whereObjectLine.startsWith('            ')) { // 12 spaces
                console.error(`❌ Pipeline indentation violation: 'Where-Object' should be indented with 12 spaces. Found: '${whereObjectLine}'`);
                process.exit(1);
            } else {
                console.log("✅ Pipeline indentation verified (12 spaces).");
            }

        } else {
            console.log(`⚠️ ${testFile} produced no output.`);
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
