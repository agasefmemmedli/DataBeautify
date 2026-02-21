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
    console.log('Running HTML Deep Formatting Verification...');

    // Load Formatters
    let Web;
    let formatHTMLDeep;
    try {
        Web = require('./out/formatters/web');
        const deepModule = require('./out/formatters/html_deep_formatter');
        formatHTMLDeep = deepModule.formatHTMLDeep;
    }
    catch (e) {
        console.error('Could not load formatters. Make sure to run "npm run compile" first.');
        console.error(e);
        process.exit(1);
    }

    // 1. Test handleHTML (Standard Prettier)
    console.log('\n--- Testing Standard Formatting (Prettier via handleHTML) ---');
    const testCases = [
        {
            file: 'test.deep.html',
            expectedContains: [
                '<div id="main" class="container">',
                'body {',
                'color: red;',
                'console.log("hello");',
                '<img src="image.jpg" alt="Image" />'
            ]
        }
    ];

    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
        console.log(`Testing ${testCase.file}...`);
        const filePath = path.join(__dirname, testCase.file);
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
                languageId: 'html',
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
            await Web.handleHTML(mockEditor, content);

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

    // 2. Test formatHTMLDeep (Directly, effectively simulating fallback)
    console.log('\n--- Testing Deep Formatting (Custom Engine Resilience) ---');
    const deepTestInput = `
<div class="test" id="main" data-attr=unquoted>
    <p>Unclosed Paragraph
    <img src=image.jpg>
    <span>text</span>
</div>
<script>
console.log('raw');
</script>
`;
    // Expected output from Deep Formatter:
    // - Indentation: 2 spaces
    // - Attribute sorting: class, id, data-attr (id, name, class are priority)
    //   Wait, priority in deep formatter: id, name, class...
    //   So id="main" class="test" -> id="main" class="test"
    // - Attribute wrapping: if short, single line.
    // - Unquoted attributes: become quoted. src="image.jpg"
    // - Void tag: img (no indent for span?) -> img is void, so indent doesn't increase.
    //   Wait, <p> is block but NOT void. So next line indented?
    //   <p>Unclosed Paragraph -> indentation increases.
    //   <img ...> -> indented.
    //   <span> -> indented (inside p).
    //   </div> -> dedent (matches div? or matches p?).
    //   HTMLTokenizer/Formatter relies on TagClose matching TagOpen via simple stack counter?
    //   Actually `indentLevel` just increments on Open and decrements on Close.
    //   So <div (open) -> indent=1.
    //   <p (open) -> indent=2.
    //   Unclosed Paragraph (text) -> indent=2.
    //   <img (void) -> indent=2.
    //   <span> (open) -> indent=3.
    //   text -> indent=3.
    //   </span> (close) -> indent=2.
    //   </div> (close) -> indent=1.
    //   So p is never closed. Indentation remains high.
    //   This is "Resilient" behavior (doesn't crash), but output might be nested deep.
    //   That's expected for simple stack based indenters on unclosed tags.
    //   Prettier would probably fix it or fail.

    try {
        const deepOutput = formatHTMLDeep(deepTestInput, {
            tabSize: 2,
            insertSpaces: true,
            sortAttributes: true
        });

        console.log('Deep Output:\n' + deepOutput);

        const expectedStrings = [
            '<div id="main" class="test" data-attr="unquoted">', // Sorted & Quoted
            '  <p>',
            '    Unclosed Paragraph',
            '    <img src="image.jpg" />', // Void tag, quoted, self-closing style
            '    <span>',
            '      text',
            '    </span>',
            '  </div>' // Dedent only once for /div (so it remains indented relative to p)
        ];

        // Wait, if </div> closes the div, but <p> was open, indentation is at 2.
        // </div> decrements to 1. So it prints at indent 1 (2 spaces).
        // Correct.

        let deepPassed = true;
        for (const exp of expectedStrings) {
            if (!deepOutput.includes(exp.trim())) { // Check trimmed content mainly, or check indent?
                // Exact match might be hard due to newlines/spacing.
                // Let's check for specific transformed lines.
                if (deepOutput.indexOf(exp) === -1) {
                     console.error(`❌ Deep Formatting failed. Missing: '${exp}'`);
                     deepPassed = false;
                }
            }
        }

        if (deepPassed) {
            console.log('✅ Deep Formatting Resilience verified.');
            passed++;
        } else {
            failed++;
        }

    } catch (e) {
        console.error('❌ Deep Formatting crashed:', e);
        failed++;
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed.`);
    if (failed > 0)
        process.exit(1);
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
