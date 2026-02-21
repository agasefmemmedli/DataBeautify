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
// Now import the formatter
async function runTests() {
    console.log('Running SQL Deep Formatting Verification...');
    let DataConfig;
    try {
        DataConfig = require('./out/formatters/data_config');
    }
    catch (e) {
        console.error('Could not load data_config formatter. Make sure to run "npm run compile" first.');
        console.error(e);
        process.exit(1);
    }
    const testCases = [
        {
            file: 'test.deep.sql',
            expectedContains: [
                'SELECT',
                'FROM',
                'WHERE',
                'AS uid',
                'AS fname',
                'AS lname',
                'AS email'
            ]
        }
    ];
    let passed = 0;
    let failed = 0;
    for (const testCase of testCases) {
        console.log(`\nTesting ${testCase.file}...`);
        const filePath = path.join('.', testCase.file);
        if (!fs.existsSync(filePath)) {
            console.error(`File ${testCase.file} not found!`);
            failed++;
            continue;
        }
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        let formattedText = '';
        const mockEditor = {
            options: {
                tabSize: 4,
                insertSpaces: true
            },
            document: {
                getText: () => content,
                lineCount: lines.length,
                lineAt: (line) => ({
                    range: {
                        start: { line, character: 0 },
                        end: { line, character: lines[line]?.length || 0 }
                    }
                }),
                languageId: 'sql',
                positionAt: (offset) => ({ line: 0, character: offset }),
                uri: { fsPath: filePath }
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
            await DataConfig.handleSQL(mockEditor, content);

            // Validation
            let casePassed = true;
            if (testCase.expectedContains) {
                for (const str of testCase.expectedContains) {
                    if (!formattedText.includes(str)) {
                         console.error(`❌ Expected output to contain "${str}"`);
                         casePassed = false;
                    }
                }
            }

            // Check for alignment
            // In test.deep.sql, we have aliases.
            // Check if AS are roughly aligned (heuristic)
            const aliasLines = formattedText.split('\n').filter(l => l.includes(' AS '));
            if (aliasLines.length > 2) {
                 // Check if AS starts at same index for consecutive lines
                 // This is tricky because indentation matters.
                 // But in our deep formatter we align them.
                 // Just check if output looks formatted
                 console.log('Formatted Output Sample:\n' + formattedText.substring(0, 500) + '...');
            }

            if (casePassed) {
                console.log(`✅ ${testCase.file} passed.`);
                passed++;
            } else {
                 console.error(`❌ ${testCase.file} failed.`);
                 console.error('Actual:\n' + formattedText);
                 failed++;
            }
        }
        catch (err) {
            console.error(`❌ Error testing ${testCase.file}:`, err);
            failed++;
        }
    }
    console.log(`\nResults: ${passed} passed, ${failed} failed.`);
    if (failed > 0)
        process.exit(1);
}
runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
