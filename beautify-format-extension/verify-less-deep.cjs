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
    console.log('Running LESS Deep Formatting Verification...');
    let Web;
    try {
        Web = require('./out/formatters/web');
    }
    catch (e) {
        console.error('Could not load web formatter. Make sure to run "npm run compile" first.');
        console.error(e);
        process.exit(1);
    }

    const testCases = [
        {
            file: 'test.deep.less',
            expected: `// Variables
@primary-color: #4d926f;
@base-color: #333;

// Mixins
.rounded-corners (@radius: 5px) {
  -webkit-border-radius: @radius;
  -moz-border-radius: @radius;
  -ms-border-radius: @radius;
  -o-border-radius: @radius;
  border-radius: @radius;
}

// Nested Rules
#header {
  color: @primary-color;
  .navigation {
    font-size: 12px;
  }
  .logo {
    width: 300px;
    &:hover {
      text-decoration: none;
    }
  }
}

// Operators
@the-border: 1px;
@base-color: #111;
@red: #842210;

#footer {
  color: (@base-color * 3);
  border-color: desaturate(@red, 10%);
}

// Functions
.average(@x, @y) {
  @average: ((@x + @y) / 2);
}

div {
  .average(16px, 50px);
  padding: @average;
}
`
        }
    ];

    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
        console.log(`\nTesting ${testCase.file}...`);
        const filePath = path.join(__dirname, testCase.file);

        if (!fs.existsSync(filePath)) {
            console.error(`File ${testCase.file} not found!`);
            failed++;
            continue;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        let formattedText = '';

        const mockEditor = {
            options: {
                tabSize: 2,
                insertSpaces: true
            },
            document: {
                getText: () => content,
                lineCount: content.split('\n').length,
                lineAt: (line) => ({
                    range: {
                        start: { line, character: 0 },
                        end: { line, character: content.split('\n')[line]?.length || 0 }
                    }
                }),
                languageId: 'less',
                uri: { fsPath: filePath }
            },
            edit: async (callback) => {
                // Mock edit builder
                const editBuilder = {
                    replace: (range, text) => {
                        formattedText = text;
                    }
                };
                await callback(editBuilder);
                return true;
            }
        };

        try {
            await Web.handleLESS(mockEditor, content);

            // Normalize line endings
            formattedText = formattedText.replace(/\r\n/g, '\n');
            const expected = testCase.expected.replace(/\r\n/g, '\n');

            if (formattedText.trim() === expected.trim()) {
                console.log(`✅ ${testCase.file} passed.`);
                passed++;
            } else {
                console.error(`❌ ${testCase.file} failed.`);
                console.error('Expected:\n' + expected);
                console.error('Actual:\n' + formattedText);

                // Show diff
                // const diff = require('diff');
                // const diffResult = diff.diffLines(expected, formattedText);
                // diffResult.forEach(part => {
                //     const color = part.added ? '\x1b[32m' : part.removed ? '\x1b[31m' : '\x1b[0m';
                //     process.stderr.write(color + part.value + '\x1b[0m');
                // });

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
