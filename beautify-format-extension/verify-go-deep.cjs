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

async function runTests() {
    console.log('Running Go Deep Formatting Verification...');
    let Scripting;
    try {
        Scripting = require('./out/formatters/scripting_compiled');
    }
    catch (e) {
        console.error('Could not load scripting formatter. Make sure to run "npm run compile" first.');
        console.error(e);
        process.exit(1);
    }

    const testCases = [
        {
            file: 'test.complex.go',
            expected: `package main

import (
	"fmt"
	"os"
	"strings"
)

type Person struct {
	Name    string
	Age     int
	Address string
}

type Greeter interface {
	Greet(name string) string
	SayHello()
}

func main() {
	x := 10
	y := 20
	if x < y {
		fmt.Println("x is less than y")
	} else {
		fmt.Println("x is greater or equal")
	}

	p := Person{
		Name:    "John",
		Age:     30,
		Address: "123 Main St",
	}

	fmt.Printf("Person: %+v\\n", p)
}

func (p Person) Greet(name string) string {
	return fmt.Sprintf("Hello %s, my name is %s", name, p.Name)
}
`
        }
    ];

    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
        console.log(`\nTesting ${testCase.file}...`);
        const filePath = path.join(__dirname, testCase.file); // Use __dirname to locate test file
        if (!fs.existsSync(filePath)) {
            console.error(`File ${testCase.file} not found at ${filePath}!`);
            failed++;
            continue;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        let formattedText = '';

        const mockEditor = {
            options: {
                tabSize: 4,
                insertSpaces: false // Go uses tabs
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
                languageId: 'go',
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
            await Scripting.handleGo(mockEditor, content);

            // Basic normalization (trim end)
            const actual = formattedText.trim();
            const expected = testCase.expected.trim();

            if (actual === expected) {
                console.log(`✅ ${testCase.file} passed.`);
                passed++;
            } else {
                console.error(`❌ ${testCase.file} failed.`);
                console.error('Expected:\n' + expected);
                console.error('Actual:\n' + actual);

                // Diff logic (simple)
                const expectedLines = expected.split('\n');
                const actualLines = actual.split('\n');
                for (let i = 0; i < Math.max(expectedLines.length, actualLines.length); i++) {
                    if (expectedLines[i] !== actualLines[i]) {
                        console.error(`Diff at line ${i + 1}:`);
                        console.error(`Exp: "${expectedLines[i]}"`);
                        console.error(`Act: "${actualLines[i]}"`);
                        break;
                    }
                }
                failed++;
            }
        } catch (err) {
            console.error(`❌ Error testing ${testCase.file}:`, err);
            failed++;
        }
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
