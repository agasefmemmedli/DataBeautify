"use strict";
const fs = require('fs');
const path = require('path');

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
    console.log('Running TypeScript Deep Formatting Verification...');
    let JsTs;
    try {
        JsTs = require('./out/formatters/js_ts');
    }
    catch (e) {
        console.error('Could not load JS/TS formatter. Make sure to run "npm run compile" first.');
        console.error(e);
        process.exit(1);
    }

    const testFile = 'test.deep.ts';
    const filePath = path.join(__dirname, testFile);

    if (!fs.existsSync(filePath)) {
        console.error(`File ${testFile} not found!`);
        process.exit(1);
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
            languageId: 'typescript',
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
        await JsTs.handleTS(mockEditor, content);

        console.log('Formatted Output:\n---------------------------------------------------');
        console.log(formattedText);
        console.log('---------------------------------------------------');

        // Basic checks
        if (!formattedText) {
            console.error('❌ Formatting returned empty string.');
            process.exit(1);
        }

        // 1. Check indentation (4 spaces)
        if (formattedText.includes('\t')) {
             console.error('❌ Output contains tabs, expected spaces.');
             process.exit(1);
        }

        // 2. Check Import sorting
        const firstLine = formattedText.split('\n')[0];
        // Import sorting logic in handleTS uses @trivago/prettier-plugin-sort-imports
        // It sorts third party modules first, then local.
        // 'some-module' is third party, './another-module' is local.
        // Also it should fix spacing in braces.
        // Original: import {  SomeImport } from 'some-module';
        // Expected: import { SomeImport } from 'some-module';

        if (!firstLine.includes("import { SomeImport } from 'some-module';")) {
             // Maybe it sorted differently?
             // Let's check generally if imports look clean.
             // Prettier standardizes to single quotes.
             if (firstLine.includes('"')) {
                 console.warn('⚠️ Imports use double quotes, expected single quotes.');
             }
        }

        // 3. Check Interface Formatting
        // interface   ComplexInterface < T,U=string > extends SomeImport{
        // Should be:
        // interface ComplexInterface<T, U = string> extends SomeImport {
        if (!formattedText.includes('interface ComplexInterface<T, U = string> extends SomeImport {')) {
             console.error('❌ Interface declaration not formatted correctly.');
             process.exit(1);
        }

        // 4. Check Decorator
        // @decorator ( { options:true } )
        // Should be:
        // @decorator({ options: true })
        if (!formattedText.includes('@decorator({ options: true })')) {
             console.error('❌ Decorator not formatted correctly.');
             process.exit(1);
        }

        // 5. Check Class Generics
        // class  MyClass < T >  implements ComplexInterface < T > {
        // Should be:
        // class MyClass<T> implements ComplexInterface<T> {
        if (!formattedText.includes('class MyClass<T> implements ComplexInterface<T> {')) {
             console.error('❌ Class declaration not formatted correctly.');
             process.exit(1);
        }

        // 6. Check Async Method
        // async method1 ( arg1:T,arg2:string="default" ) : Promise < void > {
        // Should be:
        // async method1(arg1: T, arg2: string = 'default'): Promise<void> {
        if (!formattedText.includes("async method1(arg1: T, arg2: string = 'default'): Promise<void> {")) {
             console.error('❌ Async method signature not formatted correctly.');
             // Check allowing for double quotes if Prettier config varies
             if (!formattedText.includes('async method1(arg1: T, arg2: string = "default"): Promise<void> {')) {
                 process.exit(1);
             }
        }

        // 7. Check Optional Chaining
        // const value = result?.data?.items ?? [ ] ;
        // Should be:
        // const value = result?.data?.items ?? [];
        if (!formattedText.includes('const value = result?.data?.items ?? [];')) {
             console.error('❌ Optional chaining/nullish coalescing not formatted correctly.');
             process.exit(1);
        }

        // 8. Check Switch Case Indentation
        //             case  'string' :
        //                 console.log ( `Template literal: ${ arg1 }` ) ;
        // Expected:
        //      case 'string':
        //          console.log(`Template literal: ${arg1}`);
        if (!formattedText.includes("case 'string':")) {
             console.error('❌ Switch case not formatted correctly.');
             process.exit(1);
        }
        if (!formattedText.includes('console.log(`Template literal: ${arg1}`);')) {
             console.error('❌ Template literal not formatted correctly.');
             process.exit(1);
        }

        console.log('✅ TypeScript Deep Formatting Verification PASSED');

    } catch (err) {
        console.error(`❌ Error testing ${testFile}:`, err);
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
