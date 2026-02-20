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
        applyEdit: async () => true
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
    try {
        await import('prettier');
        await import('prettier-plugin-astro');
        console.log('Prettier and Astro plugin loaded successfully in test environment.');
    } catch (e) {
        console.error('Failed to load Prettier or Astro plugin:', e);
    }

    // Load extension after mock
    // Using compiled output
    const { beautify } = require('./out/extension');
    const testFile = 'test.deep.astro';
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
            tabSize: 2,
            insertSpaces: true
        },
        document: {
            getText: () => content,
            lineCount: content.split('\n').length,
            languageId: 'astro',
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
        await beautify('astro');
        console.log('--- Original ---');
        console.log(content);
        console.log('--- Formatted ---');
        console.log(formattedText);
        console.log('-----------------');

        if (formattedText && formattedText !== content) {
            console.log(`✅ ${testFile} beautified successfully.`);
        } else if (formattedText === content) {
            console.log(`ℹ️ ${testFile} already formatted or no changes applied.`);
            // Since we are upgrading to Deep Formatting, ideally it should produce some changes or at least validate correctly.
        } else {
            console.log(`⚠️ ${testFile} produced no changes.`);
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
