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
    console.log('Running Vue Deep Formatting Verification...');
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
            file: 'test.deep.vue',
            // Expected output formatted by Prettier (approximate check, or check for key features)
            expectedContains: [
                '<template>',
                '  <div class="container" v-if="loading">',
                '    <span class="spinner"></span>',
                '  </div>',
                '  <div v-else class="content">',
                '    <header>',
                '      <h1>{{ title }}</h1>',
                '      <nav>',
                '        <ul>',
                '          <li v-for="item in items" :key="item.id">',
                '            <a :href="item.link">{{ item.text }}</a>',
                '          </li>',
                '        </ul>',
                '      </nav>',
                '    </header>',
                '<script setup lang="ts">',
                'import { ref, computed, onMounted } from "vue";', // Prettier normalizes to double quotes
                'const props = defineProps<{',
                '  initialTitle: string;', // Semicolon insertion
                '}>();',
                '<style scoped lang="scss">',
                '.container {',
                '  display: flex;',
                '  justify-content: center;'
            ]
        }
    ];

    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
        console.log(`\nTesting ${testCase.file}...`);
        const filePath = path.join('.', testCase.file);
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
                tabSize: 2,
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
                languageId: 'vue',
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
            await Web.handleVue(mockEditor, content);

            if (!formattedText) {
                 console.error(`❌ ${testCase.file} failed: No formatted text returned.`);
                 failed++;
                 continue;
            }

            let allChecksPassed = true;
            if (testCase.expectedContains) {
                for (const expectedStr of testCase.expectedContains) {
                    if (!formattedText.includes(expectedStr)) {
                        console.error(`❌ ${testCase.file} failed.`);
                        console.error(`Expected to contain: '${expectedStr}'`);
                        allChecksPassed = false;
                    }
                }
            }

            if (allChecksPassed) {
                 console.log(`✅ ${testCase.file} passed.`);
                 passed++;
            } else {
                 console.error('Actual Output:\n' + formattedText);
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
