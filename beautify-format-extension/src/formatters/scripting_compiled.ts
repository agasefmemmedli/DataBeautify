import * as vscode from 'vscode';
import { applyEdit } from '../utils';
import { formatPythonDeep } from './python_deep_formatter';
import { formatGoDeep } from './go_deep_formatter';
import { formatRustDeep } from './rust_deep_formatter';
import { formatCppDeep } from './cpp_deep_formatter';
import { formatCDeep } from './c_deep_formatter';
import { formatCSharpDeep } from './csharp_deep_formatter';
import { formatDartDeep } from './dart_deep_formatter';
import { formatSwiftDeep } from './swift_deep_formatter';
import { formatRubyDeep } from './ruby_deep_formatter';
import { formatShellDeep } from './shell_deep_formatter';
import { formatPowerShellDeep } from './powershell_deep_formatter';

/**
 * Handle Python formatting and validation
 */
export async function handlePython(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Lazy load dependencies
    const pythonAst = require('python-ast');

    // Validate Python using python-ast
    const originalConsoleError = console.error;
    let errorOutput = '';
    console.error = (...args: any[]) => {
        errorOutput += args.join(' ') + '\n';
    };

    try {
        pythonAst.parse(text);
    } catch (e: any) {
        if (!errorOutput) {
            errorOutput = e.message;
        }
    } finally {
        console.error = originalConsoleError;
    }

    if (errorOutput) {
        validationMessage = errorOutput.split('\n')[0].trim();
    }

    // Resilient formatting logic
    try {
        formatted = formatPythonDeep(text);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Python: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Python has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Python formatted successfully!');
    }
}

/**
 * Handle Java formatting and validation
 */
export async function handleJava(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Lazy load dependencies
    const javaAst = require('java-ast');

    // Validate Java using java-ast
    const originalConsoleError = console.error;
    let errorOutput = '';
    console.error = (...args: any[]) => {
        errorOutput += args.join(' ') + '\n';
    };

    try {
        javaAst.parse(text);
    } catch (e: any) {
        if (!errorOutput) {
            errorOutput = e.message;
        }
    } finally {
        console.error = originalConsoleError;
    }

    if (errorOutput) {
        validationMessage = errorOutput.split('\n')[0].trim();
    }

    // Try Deep Formatting with Prettier (Standard Style)
    try {
        const prettier = await import('prettier');
        const pluginJavaPath = require.resolve('prettier-plugin-java');

        formatted = await prettier.format(text, {
            parser: "java",
            plugins: [pluginJavaPath],
            tabWidth: 4,
            printWidth: 100,
            useTabs: false,
            trailingComma: "none",
        });
    } catch (prettierError: any) {
        console.warn('Prettier Java formatting failed, falling back to js-beautify', prettierError);

        const jsbeautify = require('js-beautify');
        /* eslint-disable */
        try {
            // Format Java (using js-beautify's JS formatter which handles Java well)
            formatted = jsbeautify.js(text, {
                indent_size: 4,
                indent_char: ' ',
                max_preserve_newlines: 2,
                preserve_newlines: true,
                keep_array_indentation: false,
                break_chained_methods: false,
                brace_style: 'collapse',
                space_before_conditional: true,
                unescape_strings: false,
                jslint_happy: false,
                end_with_newline: false,
                wrap_line_length: 0,
                comma_first: false,
                e4x: true,
                indent_empty_lines: false
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to format Java: ${error.message}`);
            return;
        }
        /* eslint-enable */

        if (!validationMessage) {
             validationMessage = "Deep formatting failed (likely syntax error). Applied basic formatting.";
        }
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Java has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Java formatted successfully!');
    }
}

/**
 * Handle Ruby formatting and validation
 */
export async function handleRuby(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Ruby using custom resilient validator
    validationMessage = validateRuby(text);

    // Try Deep Formatting with Prettier (Standard Style)
    try {
        const prettier = await import('prettier');
        // Use require.resolve to avoid ERR_VM_MODULE_LINK_FAILURE with dynamic import in CommonJS
        const pluginRubyPath = require.resolve('@prettier/plugin-ruby');

        formatted = await prettier.format(text, {
            parser: "ruby",
            plugins: [pluginRubyPath],
            tabWidth: 2,
            printWidth: 100,
            useTabs: false,
            trailingComma: "none",
            rubyArrayLiteral: true,
        });
    } catch (prettierError: any) {
        console.warn('Prettier Ruby formatting failed, falling back to custom formatter', prettierError);

        // Custom resilient formatter logic (Deep Formatting)
        try {
            formatted = formatRubyDeep(text);
        } catch (error: any) {
             vscode.window.showErrorMessage(`Failed to format Ruby: ${error.message}`);
             return;
        }

        if (!validationMessage) {
             validationMessage = "Deep formatting (Prettier) failed. Applied resilient deep formatting.";
        }
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Ruby has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Ruby formatted successfully!');
    }
}


/**
 * Custom resilient Ruby validator
 */
function validateRuby(text: string): string | undefined {
    const stack: { word: string, line: number }[] = [];
    const lines = text.split('\n');

    const openers = ['class', 'module', 'def', 'begin', 'case', 'if', 'unless', 'while', 'until', 'for'];
    const intermediates = ['elsif', 'else', 'when', 'rescue', 'ensure'];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let trimmed = line.trim();

        // Remove comments
        const commentIdx = trimmed.indexOf('#');
        if (commentIdx !== -1) {
            trimmed = trimmed.substring(0, commentIdx).trim();
        }

        if (trimmed === '') {
            continue;
        }

        // Split by semicolon for multiple statements on one line
        const statements = trimmed.split(';');
        for (const stmt of statements) {
            const tokens = stmt.trim().split(/\s+/);
            if (tokens.length === 0 || tokens[0] === '') {
                continue;
            }

            // Check if the statement starts with an opener
            const firstToken = tokens[0].replace(/[^a-z]/g, ''); // Simple cleanup

            if (openers.includes(firstToken)) {
                stack.push({ word: firstToken, line: i + 1 });
            } else if (firstToken === 'end') {
                if (stack.length === 0) {
                    return `Unexpected 'end' at line ${i + 1}`;
                }
                stack.pop();
            } else if (intermediates.includes(firstToken)) {
                if (stack.length === 0) {
                    return `Unexpected intermediate keyword '${firstToken}' at line ${i + 1}`;
                }
            }

            // Check for 'do' at end of statement
            if (stmt.trim().endsWith('do') || /\bdo\s*\|.*\|\s*$/.test(stmt.trim())) {
                stack.push({ word: 'do', line: i + 1 });
            }
        }
    }

    if (stack.length > 0) {
        const last = stack.pop()!;
        return `Unclosed '${last.word}' from line ${last.line}`;
    }

    return undefined;
}

/**
 * Handle C formatting and validation
 */
export async function handleC(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate C using custom resilient validator
    validationMessage = validateC(text);

    try {
        // Deep Formatting
        formatted = formatCDeep(text);
    } catch (error: any) {
        console.warn(`Deep C formatting failed: ${error.message}. Falling back to js-beautify.`);

        // Lazy load dependencies
        const jsbeautify = require('js-beautify');

        /* eslint-disable */
        try {
            // --- PRE-PROCESSING ---
            const masks: string[] = [];
            const maskPrefix = '___C_MASK_';

            // 1. Mask strings, chars and comments to protect them from formatting changes
            // Strings: "..."
            // Chars: '...'
            // Comments: //... or /*...*/
            // Preprocessor: #... (we mask these to avoid indentation mess up)
            let maskedText = text.replace(/("(?:\\.|[^\\"])*")|('(?:\\.|[^\\'])*')|(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|(^\s*#[^\n]*)/gm, (match) => {
                const placeholder = `${maskPrefix}${masks.length}___`;
                masks.push(match);
                return placeholder;
            });

            // 2. Normalize C Syntax
            // --- CORE FORMATTING ---
            let beautified = jsbeautify.js(maskedText, {
                indent_size: 4,
                indent_char: ' ',
                max_preserve_newlines: 2,
                preserve_newlines: true,
                keep_array_indentation: true, // Important for array initializers
                break_chained_methods: false,
                brace_style: 'collapse',
                space_before_conditional: true,
                unescape_strings: false,
                jslint_happy: false,
                end_with_newline: true,
                wrap_line_length: 0,
                comma_first: false,
                e4x: true,
                indent_empty_lines: false
            });

            // --- POST-PROCESSING ---

            // Fix struct typedef: } \n Item; -> } Item;
            beautified = beautified.replace(/\}\s+(\w+);/g, '} $1;');

            // Fix Arrow Operator: item - > id -> item->id
            beautified = beautified.replace(/\s*-\s*>\s*/g, '->');

            // Fix Address-of: & var -> &var (unary context)
            beautified = beautified.replace(/([=\(\[\{,!:?return])\s*&\s+([\w_]+)/g, (match: string, p1: string, p2: string) => {
                if (p1 === '(' || p1 === '[' || p1 === '{' || p1 === '!') return `${p1}&${p2}`;
                return `${p1} &${p2}`;
            });

            // Fix Dereference: * p -> *p (unary context)
            beautified = beautified.replace(/([=\(\[\{,!:?return])\s*\*\s+([\w_]+)/g, (match: string, p1: string, p2: string) => {
                if (p1 === '(' || p1 === '[' || p1 === '{' || p1 === '!') return `${p1}*${p2}`;
                return `${p1} *${p2}`;
            });

            // Fix Dereference at start of line/statement: * p = 10;
            beautified = beautified.replace(/(^|[\n\};])\s*\*\s+([\w_]+)/g, (match: string) => {
                return match.replace(/\*\s+/, '*');
            });

            // 1. Fix Pointer/Reference Alignment: int * p -> int *p
            // Common C style is `int *p`.
            // js-beautify might produce `int * p`.
            // Heuristic: Type * Variable.
            const types = 'void|int|char|bool|float|double|long|short|unsigned|signed|size_t|auto|const|struct|union|enum';

            // This regex tries to fix "Type * var"
            // Since js-beautify puts space around binary operators, it might treat * as binary multiplication if context is ambiguous.
            // But for declarations "int * p", it will likely be "int * p".
            // We want "int *p".
            beautified = beautified.replace(new RegExp(`\\b(${types})\\s*\\*+\\s+(\\w+)`, 'g'), (match: string, type: string, varName: string) => {
                // Check if it's actually multiplication? No, because we matched a Type keyword.
                return match.replace(/\s*\*\s*/g, ' *');
            });

            // Handle struct pointers: struct Item * item -> struct Item *item
            beautified = beautified.replace(/\b(struct|union|enum)\s+(\w+)\s*\*\s+(\w+)/g, '$1 $2 *$3');

            // 2. Restore Masks
            formatted = beautified.replace(new RegExp(`${maskPrefix}(\\d+)___`, 'g'), (_: string, index: string) => {
                return masks[parseInt(index)];
            });

        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to format C: ${error.message}`);
            return;
        }
        /* eslint-enable */

        if (!validationMessage) {
             validationMessage = "Deep formatting failed. Applied resilient fallback.";
        }
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`C has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('C formatted successfully!');
    }
}

/**
 * Custom resilient C validator
 */
function validateC(text: string): string | undefined {
    const stack: { char: string, line: number, col: number }[] = [];
    let inString = false;
    let inChar = false;
    let inLineComment = false;
    let inBlockComment = false;

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];

            if (inLineComment) {
                break;
            }
            if (inBlockComment) {
                if (char === '*' && nextChar === '/') {
                    inBlockComment = false;
                    j++;
                }
                continue;
            }

            if (inString) {
                if (char === '\\') {
                    j++; // Escape sequence
                } else if (char === '"') {
                    inString = false;
                }
                continue;
            }

            if (inChar) {
                if (char === '\\') {
                    j++;
                } else if (char === "'") {
                    inChar = false;
                }
                continue;
            }

            // Start of comment
            if (char === '/' && nextChar === '/') {
                inLineComment = true;
                j++;
                continue;
            }
            if (char === '/' && nextChar === '*') {
                inBlockComment = true;
                j++;
                continue;
            }

            if (char === '"') {
                inString = true;
                continue;
            }

            if (char === "'") {
                inChar = true;
                continue;
            }

            // Braces
            if (char === '{' || char === '(' || char === '[') {
                stack.push({ char, line: i + 1, col: j + 1 });
            } else if (char === '}' || char === ')' || char === ']') {
                if (stack.length === 0) {
                    return `Unexpected closing character '${char}' at line ${i + 1}, col ${j + 1}`;
                }
                const last = stack.pop()!;
                if ((char === '}' && last.char !== '{') ||
                    (char === ')' && last.char !== '(') ||
                    (char === ']' && last.char !== '[')) {
                    return `Mismatched closing character '${char}' at line ${i + 1}, col ${j + 1} (expected closing for '${last.char}' from line ${last.line}, col ${last.col})`;
                }
            }
        }
        inLineComment = false;
    }

    if (inBlockComment) {
        return "Unclosed block comment";
    }
    if (inString) {
        return "Unclosed string literal";
    }
    if (inChar) {
        return "Unclosed character literal";
    }
    if (stack.length > 0) {
        const last = stack.pop()!;
        return `Unclosed '${last.char}' from line ${last.line}, col ${last.col}`;
    }

    return undefined;
}

/**
 * Handle Shell Script formatting and validation
 */
export async function handleShell(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Shell using custom resilient validator
    validationMessage = validateShell(text);

    // Try Deep Formatting with Prettier (Standard Style)
    try {
        const prettier = await import('prettier');
        const pluginShMod = await import('prettier-plugin-sh');
        const pluginSh = pluginShMod.default || pluginShMod;

        formatted = await prettier.format(text, {
            parser: "sh",
            plugins: [pluginSh],
            tabWidth: 2,
            printWidth: 100,
            useTabs: false,
            keepComments: true,
            filepath: 'script.sh',
        });
    } catch (prettierError: any) {
        console.warn('Prettier Shell formatting failed, falling back to custom formatter', prettierError);

        // Resilient fallback logic
        try {
            formatted = formatShellDeep(text);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to format Shell: ${error.message}`);
            return;
        }

        if (!validationMessage) {
             validationMessage = "Deep formatting (Prettier) failed. Applied deep formatting.";
        }
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Shell Script has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Shell Script formatted successfully!');
    }
}

/**
 * Custom resilient Shell validator
 */
function validateShell(text: string): string | undefined {
    const stack: { word: string, line: number }[] = [];
    const lines = text.split('\n');
    let inString = false;
    let stringChar = '';
    let inHeredoc = false;
    let heredocDelimiter = '';

    const openers = ['if', 'for', 'while', 'until', 'case'];
    const closers: { [key: string]: string } = {
        'if': 'fi',
        'for': 'done',
        'while': 'done',
        'until': 'done',
        'case': 'esac'
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let trimmed = line.trim();

        if (inHeredoc) {
            if (trimmed === heredocDelimiter) {
                inHeredoc = false;
            }
            continue;
        }

        const heredocMatch = line.match(/<<-?\s*["']?([A-Z0-9_]+)["']?/i);
        if (heredocMatch) {
            inHeredoc = true;
            heredocDelimiter = heredocMatch[1];
        }

        // Simple string tracking
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if ((char === '"' || char === "'") && (j === 0 || line[j - 1] !== '\\')) {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar) {
                    inString = false;
                }
            }
        }

        if (inString) continue;

        // Remove comments
        const commentIdx = trimmed.indexOf('#');
        if (commentIdx !== -1) {
            trimmed = trimmed.substring(0, commentIdx).trim();
        }

        if (trimmed === '') continue;

        const tokens = trimmed.split(/\s+|;/);
        for (const token of tokens) {
            if (openers.includes(token)) {
                stack.push({ word: token, line: i + 1 });
            } else if (Object.values(closers).includes(token)) {
                if (stack.length === 0) {
                    return `Unexpected '${token}' at line ${i + 1}`;
                }
                const last = stack.pop()!;
                if (closers[last.word] !== token) {
                    return `Mismatched '${token}' at line ${i + 1} (expected closure for '${last.word}' from line ${last.line})`;
                }
            } else if (token === '{' || token === '(') {
                stack.push({ word: token, line: i + 1 });
            } else if (token === '}' || token === ')') {
                if (stack.length === 0) {
                    // Ignore lone ')' as it might be a case pattern
                    if (token === '}') return `Unexpected '}' at line ${i + 1}`;
                    continue;
                }
                const last = stack.pop()!;
                if ((token === '}' && last.word !== '{') || (token === ')' && last.word !== '(')) {
                    // Again, if it's ')' it might be a case pattern, so be careful
                    if (token === '}') return `Mismatched '}' at line ${i + 1}`;
                    // If it was '(', then it's a mismatch. But if last was something else, maybe ignore?
                    // Let's keep it simple.
                }
            }
        }
    }

    if (inString) return "Unclosed string literal";
    if (inHeredoc) return "Unclosed heredoc";
    if (stack.length > 0) {
        const last = stack.pop()!;
        return `Unclosed '${last.word}' from line ${last.line}`;
    }

    return undefined;
}

/**
 * Handle PowerShell formatting and validation
 */
export async function handlePowerShell(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate PowerShell using custom resilient validator
    validationMessage = validatePowerShell(text);

    // Try Deep Formatting with Prettier (Standard Style)
    try {
        const prettier = await import('prettier');
        const pluginPowerShellMod = await import('prettier-plugin-powershell');
        const pluginPowerShell = pluginPowerShellMod.default || pluginPowerShellMod;

        formatted = await prettier.format(text, {
            parser: "powershell",
            plugins: [pluginPowerShell],
            tabWidth: 4,
            printWidth: 100,
            useTabs: false,
            trailingComma: "none",
        });
    } catch (prettierError: any) {
        console.warn('Prettier PowerShell formatting failed, falling back to custom formatter', prettierError);

        // Resilient fallback logic
        try {
            formatted = formatPowerShellDeep(text);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to format PowerShell: ${error.message}`);
            return;
        }

        if (!validationMessage) {
             validationMessage = "Deep formatting (Prettier) failed. Applied deep formatting.";
        }
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`PowerShell has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('PowerShell formatted successfully!');
    }
}

/**
 * Custom resilient PowerShell validator
 */
function validatePowerShell(text: string): string | undefined {
    const stack: { char: string, line: number, col: number }[] = [];
    let stateStack: ('STRING' | 'LITERAL_STRING' | 'HERE_STRING' | 'LITERAL_HERE_STRING' | 'NORMAL')[] = ['NORMAL'];
    let blockCommentLevel = 0;

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const currentState = stateStack[stateStack.length - 1];

        if (currentState === 'HERE_STRING') {
            if (trimmed === '"@') stateStack.pop();
            continue;
        }
        if (currentState === 'LITERAL_HERE_STRING') {
            if (trimmed === "'@") stateStack.pop();
            continue;
        }

        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];
            const currentStateInner = stateStack[stateStack.length - 1];

            if (blockCommentLevel > 0) {
                if (char === '#' && nextChar === '>') {
                    blockCommentLevel--;
                    j++;
                } else if (char === '<' && nextChar === '#') {
                    blockCommentLevel++;
                    j++;
                }
                continue;
            }

            if (currentStateInner === 'STRING') {
                if (char === '`') { // PowerShell escape
                    j++;
                } else if (char === '"') {
                    stateStack.pop();
                }
                continue;
            }

            if (currentStateInner === 'LITERAL_STRING') {
                if (char === "'") {
                    stateStack.pop();
                }
                continue;
            }

            // NORMAL state
            if (char === '#' && (j === 0 || /\s/.test(line[j - 1]))) {
                // Line comment
                break;
            }

            if (char === '<' && nextChar === '#') {
                blockCommentLevel++;
                j++;
                continue;
            }

            // Check for Here-Strings (must be at the end of the line)
            if (j === line.length - 2) {
                if (line.endsWith('@"')) {
                    stateStack.push('HERE_STRING');
                    j = line.length;
                    continue;
                }
                if (line.endsWith("@'")) {
                    stateStack.push('LITERAL_HERE_STRING');
                    j = line.length;
                    continue;
                }
            }

            if (char === '"') {
                if (nextChar === '"') {
                    j++; // Escaped quote ""
                } else {
                    stateStack.push('STRING');
                }
                continue;
            }
            if (char === "'") {
                if (nextChar === "'") {
                    j++; // Escaped quote ''
                } else {
                    stateStack.push('LITERAL_STRING');
                }
                continue;
            }

            if (char === '{' || char === '(' || char === '[') {
                stack.push({ char, line: i + 1, col: j + 1 });
            } else if (char === '}' || char === ')' || char === ']') {
                if (stack.length === 0) {
                    return `Unexpected closing character '${char}' at line ${i + 1}, col ${j + 1}`;
                }
                const last = stack.pop()!;
                if ((char === '}' && last.char !== '{') ||
                    (char === ')' && last.char !== '(') ||
                    (char === ']' && last.char !== '[')) {
                    return `Mismatched closing character '${char}' at line ${i + 1}, col ${j + 1} (expected closure for '${last.char}' from line ${last.line}, col ${last.col})`;
                }
            }
        }
    }

    if (blockCommentLevel > 0) return "Unclosed block comment";
    const lastState = stateStack.pop();
    if (lastState === 'HERE_STRING' || lastState === 'LITERAL_HERE_STRING') return "Unclosed here-string";
    if (lastState === 'STRING' || lastState === 'LITERAL_STRING') return "Unclosed string literal";

    if (stack.length > 0) {
        const last = stack.pop()!;
        return `Unclosed '${last.char}' from line ${last.line}, col ${last.col}`;
    }

    return undefined;
}

/**
 * Handle Dart formatting and validation
 */
export async function handleDart(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Dart using custom resilient validator
    validationMessage = validateDart(text);

    // Deep Formatting
    try {
        formatted = formatDartDeep(text);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Dart: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Dart has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Dart formatted successfully!');
    }
}

/**
 * Validate Dart code for basic structural errors
 */
function validateDart(text: string): string | undefined {
    const braceStack: { char: string, line: number, col: number, isInterpolation?: boolean }[] = [];
    let stateStack: ('STRING' | 'MULTILINE_STRING' | 'NORMAL')[] = ['NORMAL'];
    let stringChar = ''; // ' or "
    let isRaw = false;
    let blockCommentLevel = 0;

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];
            const nextNextChar = line[j + 2];
            const currentState = stateStack[stateStack.length - 1];

            if (blockCommentLevel > 0) {
                if (char === '*' && nextChar === '/') {
                    blockCommentLevel--;
                    j++;
                } else if (char === '/' && nextChar === '*') {
                    blockCommentLevel++;
                    j++;
                }
                continue;
            }

            if (currentState === 'MULTILINE_STRING') {
                if (char === stringChar && nextChar === stringChar && nextNextChar === stringChar) {
                    stateStack.pop();
                    j += 2;
                    isRaw = false;
                }
                continue;
            }

            if (currentState === 'STRING') {
                if (char === '\\' && !isRaw) {
                    j++; // Escape sequence
                } else if (char === '$' && !isRaw) {
                    if (nextChar === '{') {
                        braceStack.push({ char: '{', line: i, col: j + 1, isInterpolation: true });
                        stateStack.push('NORMAL');
                        j++;
                    }
                } else if (char === stringChar) {
                    stateStack.pop();
                    isRaw = false;
                }
                continue;
            }

            // NORMAL state
            if (char === '/' && nextChar === '/') {
                // Line comment
                break;
            }
            if (char === '/' && nextChar === '*') {
                blockCommentLevel++;
                j++;
                continue;
            }

            // Strings
            let currentIsRaw = false;
            let checkIdx = j;
            if (char === 'r' && (nextChar === "'" || nextChar === '"')) {
                currentIsRaw = true;
                checkIdx = j + 1;
            }

            const checkChar = line[checkIdx];
            const checkNextChar = line[checkIdx + 1];
            const checkNextNextChar = line[checkIdx + 2];

            if (checkChar === "'" || checkChar === '"') {
                stringChar = checkChar;
                isRaw = currentIsRaw;
                if (checkNextChar === stringChar && checkNextNextChar === stringChar) {
                    stateStack.push('MULTILINE_STRING');
                    j = checkIdx + 2;
                } else {
                    stateStack.push('STRING');
                    j = checkIdx;
                }
                continue;
            }

            if (char === '{' || char === '(' || char === '[') {
                braceStack.push({ char, line: i, col: j });
            } else if (char === '}' || char === ')' || char === ']') {
                if (braceStack.length === 0) {
                    return `Unexpected closing character '${char}' at line ${i + 1}, col ${j + 1}`;
                }
                const last = braceStack.pop()!;
                if ((char === '}' && last.char !== '{') ||
                    (char === ')' && last.char !== '(') ||
                    (char === ']' && last.char !== '[')) {
                    return `Mismatched closing character '${char}' at line ${i + 1}, col ${j + 1} (expected closure for '${last.char}' from line ${last.line + 1}, col ${last.col + 1})`;
                }
                if (char === '}' && last.isInterpolation) {
                    stateStack.pop(); // Return from NORMAL (inside interpolation) to STRING
                }
            }
        }
    }

    if (blockCommentLevel > 0) {
        return "Unclosed block comment";
    }
    const lastState = stateStack.pop();
    if (lastState === 'MULTILINE_STRING') {
        return "Unclosed multiline string";
    }
    if (lastState === 'STRING') {
        return "Unclosed string literal";
    }

    if (braceStack.length > 0) {
        const last = braceStack.pop()!;
        return `Unclosed '${last.char}' from line ${last.line + 1}, col ${last.col + 1}`;
    }

    return undefined;
}

/**
 * Handle Go formatting and validation
 */
export async function handleGo(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Go using custom resilient validator
    validationMessage = validateGo(text);

    // Resilient formatting logic
    try {
        formatted = formatGoDeep(text);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Go: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Go has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Go formatted successfully!');
    }
}

/**
 * Custom resilient Go validator
 */
function validateGo(text: string): string | undefined {
    const stack: { char: string, line: number, col: number }[] = [];
    let inString = false;
    let inRawString = false;
    let inChar = false;
    let inLineComment = false;
    let inBlockComment = false;

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];

            if (inLineComment) {
                break;
            }
            if (inBlockComment) {
                if (char === '*' && nextChar === '/') {
                    inBlockComment = false;
                    j++;
                }
                continue;
            }

            if (inRawString) {
                if (char === '`') {
                    inRawString = false;
                }
                continue;
            }

            if (inString) {
                if (char === '\\') {
                    j++; // Escape sequence
                } else if (char === '"') {
                    inString = false;
                }
                continue;
            }

            if (inChar) {
                if (char === '\\') {
                    j++;
                } else if (char === "'") {
                    inChar = false;
                }
                continue;
            }

            // Start of comment
            if (char === '/' && nextChar === '/') {
                inLineComment = true;
                j++;
                continue;
            }
            if (char === '/' && nextChar === '*') {
                inBlockComment = true;
                j++;
                continue;
            }

            if (char === '`') {
                inRawString = true;
                continue;
            }

            if (char === '"') {
                inString = true;
                continue;
            }

            if (char === "'") {
                inChar = true;
                continue;
            }

            // Braces
            if (char === '{' || char === '(' || char === '[') {
                stack.push({ char, line: i + 1, col: j + 1 });
            } else if (char === '}' || char === ')' || char === ']') {
                if (stack.length === 0) {
                    return `Unexpected closing character '${char}' at line ${i + 1}, col ${j + 1}`;
                }
                const last = stack.pop()!;
                if ((char === '}' && last.char !== '{') ||
                    (char === ')' && last.char !== '(') ||
                    (char === ']' && last.char !== '[')) {
                    return `Mismatched closing character '${char}' at line ${i + 1}, col ${j + 1} (expected closing for '${last.char}' from line ${last.line}, col ${last.col})`;
                }
            }
        }
        inLineComment = false;
    }

    if (inBlockComment) {
        return "Unclosed block comment";
    }
    if (inRawString) {
        return "Unclosed raw string literal";
    }
    if (inString) {
        return "Unclosed string literal";
    }
    if (inChar) {
        return "Unclosed character literal";
    }
    if (stack.length > 0) {
        const last = stack.pop()!;
        return `Unclosed '${last.char}' from line ${last.line}, col ${last.col}`;
    }

    return undefined;
}

/**
 * Handle Rust formatting and validation
 */
export async function handleRust(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Rust using custom resilient validator
    validationMessage = validateRust(text);

    // Deep Formatting logic
    try {
        formatted = formatRustDeep(text);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Rust: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Rust has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Rust formatted successfully!');
    }
}

/**
 * Custom resilient Rust validator
 */
function validateRust(text: string): string | undefined {
    const stack: { char: string, line: number, col: number }[] = [];
    let inString = false;
    let inChar = false;
    let inLineComment = false;
    let blockCommentLevel = 0;
    let inRawString = false;
    let rawStringHashes = 0;

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];

            if (inLineComment) {
                break;
            }
            if (blockCommentLevel > 0) {
                if (char === '*' && nextChar === '/') {
                    blockCommentLevel--;
                    j++;
                } else if (char === '/' && nextChar === '*') {
                    blockCommentLevel++;
                    j++;
                }
                continue;
            }

            if (inRawString) {
                // Check for end of raw string: " followed by matching number of #
                if (char === '"') {
                    let hashesFound = 0;
                    while (j + 1 + hashesFound < line.length && line[j + 1 + hashesFound] === '#') {
                        hashesFound++;
                    }
                    if (hashesFound >= rawStringHashes) {
                        inRawString = false;
                        j += rawStringHashes;
                    }
                }
                continue;
            }

            if (inString) {
                if (char === '\\') {
                    j++; // Escape sequence
                } else if (char === '"') {
                    inString = false;
                }
                continue;
            }

            if (inChar) {
                if (char === '\\') {
                    j++;
                } else if (char === "'") {
                    inChar = false;
                }
                continue;
            }

            // Start of comment
            if (char === '/' && nextChar === '/') {
                inLineComment = true;
                j++;
                continue;
            }
            if (char === '/' && nextChar === '*') {
                blockCommentLevel++;
                j++;
                continue;
            }

            // Start of raw string r" or r#...# "
            if (char === 'r' && (nextChar === '"' || nextChar === '#')) {
                let hashes = 0;
                let k = j + 1;
                while (k < line.length && line[k] === '#') {
                    hashes++;
                    k++;
                }
                if (k < line.length && line[k] === '"') {
                    inRawString = true;
                    rawStringHashes = hashes;
                    j = k;
                    continue;
                }
            }

            if (char === '"') {
                inString = true;
                continue;
            }

            // Check for char vs lifetime
            if (char === "'") {
                // Lifetime starts with ' followed by id, e.g. 'static, 'a
                // Char literal is 'c' or '\n' etc.
                // Heuristic: if next is identifier start and it's NOT followed by ' soon, it's a lifetime.
                const remaining = line.substring(j + 1);
                const charMatch = remaining.match(/^([^'\\]|\\.)'/);
                if (charMatch) {
                    inChar = true;
                    continue;
                } else {
                    // It's likely a lifetime, ignore it
                    // Skip ' and letters
                    let k = j + 1;
                    while (k < line.length && /[a-zA-Z0-9_]/.test(line[k])) {
                        k++;
                    }
                    j = k - 1;
                    continue;
                }
            }

            // Braces
            if (char === '{' || char === '(' || char === '[') {
                stack.push({ char, line: i + 1, col: j + 1 });
            } else if (char === '}' || char === ')' || char === ']') {
                if (stack.length === 0) {
                    return `Unexpected closing character '${char}' at line ${i + 1}, col ${j + 1}`;
                }
                const last = stack.pop()!;
                if ((char === '}' && last.char !== '{') ||
                    (char === ')' && last.char !== '(') ||
                    (char === ']' && last.char !== '[')) {
                    return `Mismatched closing character '${char}' at line ${i + 1}, col ${j + 1} (expected closing for '${last.char}' from line ${last.line}, col ${last.col})`;
                }
            }
        }
        inLineComment = false;
    }

    if (blockCommentLevel > 0) {
        return "Unclosed block comment";
    }
    if (inRawString) {
        return "Unclosed raw string literal";
    }
    if (inString) {
        return "Unclosed string literal";
    }
    if (inChar) {
        return "Unclosed character literal";
    }
    if (stack.length > 0) {
        const last = stack.pop()!;
        return `Unclosed '${last.char}' from line ${last.line}, col ${last.col}`;
    }

    return undefined;
}

/**
 * Handle C++ formatting and validation
 */
export async function handleCPP(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate C++ using custom resilient validator
    validationMessage = validateCPP(text);

    try {
        // Deep Formatting
        formatted = formatCppDeep(text);
    } catch (error: any) {
        console.warn(`Deep C++ formatting failed: ${error.message}. Falling back to js-beautify.`);

        // Fallback to js-beautify (Original Implementation Logic)
        const jsbeautify = require('js-beautify');
        /* eslint-disable */
        try {
            // --- PRE-PROCESSING ---
            const masks: string[] = [];
            const maskPrefix = '___CPP_MASK_';

            let maskedText = text.replace(/("(?:\\.|[^\\"])*")|('(?:\\.|[^\\'])*')|(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|(^\s*#[^\n]*)/gm, (match) => {
                const placeholder = `${maskPrefix}${masks.length}___`;
                masks.push(match);
                return placeholder;
            });

            maskedText = maskedText.replace(/\b(public|private|protected)\s*:\s*/g, '$1:\n');
            maskedText = maskedText.replace(/\s*::\s*/g, '::');
            maskedText = maskedText.replace(/\]\s*\(/g, '] (');
            maskedText = maskedText.replace(/(template\s*<.*?>)\s+(class|struct)/g, '$1 $2');

            let beautified = jsbeautify.js(maskedText, {
                indent_size: 4,
                indent_char: ' ',
                max_preserve_newlines: 2,
                preserve_newlines: true,
                keep_array_indentation: true,
                break_chained_methods: false,
                brace_style: 'collapse',
                space_before_conditional: true,
                unescape_strings: false,
                jslint_happy: false,
                end_with_newline: true,
                wrap_line_length: 0,
                comma_first: false,
                e4x: true,
                indent_empty_lines: false
            });

            // --- POST-PROCESSING ---
            beautified = beautified.replace(/^(\s*)(public|private|protected)\s*:\s*([^\s])/gm, '$1$2:\n$1    $3');
            beautified = beautified.replace(/\s*::\s*/g, '::');
            beautified = beautified.replace(/&\s*&/g, '&&');
            beautified = beautified.replace(/\*\s*\*/g, '**');

            const lines = beautified.split('\n');
            const finalLines: string[] = [];
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                const trimmed = line.trim();
                if (/^(public|private|protected)\s*:/.test(trimmed)) {
                    line = line.replace(/^    /, '');
                }
                finalLines.push(line);
            }
            beautified = finalLines.join('\n');

            for (let k = 0; k < 3; k++) {
                beautified = beautified.replace(/\b([\w:]+)\s*<\s+([^>]+?)\s+>(?=\s*[>(\w:,\*&;\[])/g, (match: string, id: string, content: string) => {
                    return `${id}<${content.trim()}>`;
                });
            }

            const types = 'void|int|char|bool|float|double|long|short|unsigned|signed|size_t|auto|string|vector|map|set|list|pair|const|class|struct|typename';
            beautified = beautified.replace(new RegExp(`\\b(${types})\\s*(\\*+|&+)\\s*(\\w+)`, 'g'), '$1$2 $3');
            beautified = beautified.replace(/\b([A-Z]\w*)\s*(\*+|&+)\s*(\w+)/g, '$1$2 $3');
            beautified = beautified.replace(new RegExp(`\\b([A-Z]\\w*|${types})\\s*(\\*+|&+)\\s*(?=\\s*[),>])`, 'g'), '$1$2');
            beautified = beautified.replace(/([=\(\[\{,!:?&\|\^\+\-\*\/%])\s*(\*|&)\s+([\w_]+)/g, '$1 $2$3');

            formatted = beautified.replace(new RegExp(`${maskPrefix}(\\d+)___`, 'g'), (_: string, index: string) => {
                return masks[parseInt(index)];
            });

        } catch (beautifyError: any) {
            vscode.window.showErrorMessage(`Failed to format C++: ${beautifyError.message}`);
            return;
        }
        /* eslint-enable */

        if (!validationMessage) {
             validationMessage = "Deep formatting failed. Applied resilient fallback.";
        }
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`C++ has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('C++ formatted successfully!');
    }
}

/**
 * Custom resilient C++ validator
 */
function validateCPP(text: string): string | undefined {
    const stack: { char: string, line: number, col: number }[] = [];
    let inString = false;
    let inChar = false;
    let inLineComment = false;
    let inBlockComment = false;
    let inRawString = false;
    let rawStringDelimiter = '';

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];

            if (inLineComment) {
                break;
            }
            if (inBlockComment) {
                if (char === '*' && nextChar === '/') {
                    inBlockComment = false;
                    j++;
                }
                continue;
            }

            if (inRawString) {
                // Check for end of raw string: )delimiter"
                if (char === ')') {
                    const potentialDelimiter = line.substring(j + 1, j + 1 + rawStringDelimiter.length);
                    if (potentialDelimiter === rawStringDelimiter && line[j + 1 + rawStringDelimiter.length] === '"') {
                        inRawString = false;
                        j += rawStringDelimiter.length + 1;
                    }
                }
                continue;
            }

            if (inString) {
                if (char === '\\') {
                    j++; // Escape sequence
                } else if (char === '"') {
                    inString = false;
                }
                continue;
            }

            if (inChar) {
                if (char === '\\') {
                    j++;
                } else if (char === "'") {
                    inChar = false;
                }
                continue;
            }

            // Start of comment
            if (char === '/' && nextChar === '/') {
                inLineComment = true;
                j++;
                continue;
            }
            if (char === '/' && nextChar === '*') {
                inBlockComment = true;
                j++;
                continue;
            }

            // Start of raw string R"delimiter(
            if (char === 'R' && nextChar === '"') {
                const openParenIdx = line.indexOf('(', j + 2);
                if (openParenIdx !== -1) {
                    inRawString = true;
                    rawStringDelimiter = line.substring(j + 2, openParenIdx);
                    j = openParenIdx;
                    continue;
                }
            }

            if (char === '"') {
                inString = true;
                continue;
            }

            if (char === "'") {
                inChar = true;
                continue;
            }

            // Braces
            if (char === '{' || char === '(' || char === '[') {
                stack.push({ char, line: i + 1, col: j + 1 });
            } else if (char === '}' || char === ')' || char === ']') {
                if (stack.length === 0) {
                    return `Unexpected closing character '${char}' at line ${i + 1}, col ${j + 1}`;
                }
                const last = stack.pop()!;
                if ((char === '}' && last.char !== '{') ||
                    (char === ')' && last.char !== '(') ||
                    (char === ']' && last.char !== '[')) {
                    return `Mismatched closing character '${char}' at line ${i + 1}, col ${j + 1} (expected closing for '${last.char}' from line ${last.line}, col ${last.col})`;
                }
            }
        }
        inLineComment = false;
    }

    if (inBlockComment) {
        return "Unclosed block comment";
    }
    if (inRawString) {
        return "Unclosed raw string literal";
    }
    if (inString) {
        return "Unclosed string literal";
    }
    if (inChar) {
        return "Unclosed character literal";
    }
    if (stack.length > 0) {
        const last = stack.pop()!;
        return `Unclosed '${last.char}' from line ${last.line}, col ${last.col}`;
    }

    return undefined;
}

/**
 * Handle C# formatting and validation
 */
export async function handleCSharp(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate C# using custom resilient validator
    validationMessage = validateCSharp(text);

    // Deep Formatting logic
    try {
        formatted = formatCSharpDeep(text);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format C#: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`C# has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('C# formatted successfully!');
    }
}

/**
 * Custom resilient C# validator
 */
function validateCSharp(text: string): string | undefined {
    const stack: { char: string, line: number, col: number }[] = [];
    let inString = false;
    let inVerbatimString = false;
    let inChar = false;
    let inLineComment = false;
    let inBlockComment = false;

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];

            if (inLineComment) {
                break;
            }
            if (inBlockComment) {
                if (char === '*' && nextChar === '/') {
                    inBlockComment = false;
                    j++;
                }
                continue;
            }

            if (inString) {
                if (inVerbatimString) {
                    if (char === '"' && nextChar === '"') {
                        j++; // Escaped quote
                    } else if (char === '"') {
                        inString = false;
                        inVerbatimString = false;
                    }
                } else {
                    if (char === '\\') {
                        j++; // Escape sequence
                    } else if (char === '"') {
                        inString = false;
                    }
                }
                continue;
            }

            if (inChar) {
                if (char === '\\') {
                    j++;
                } else if (char === "'") {
                    inChar = false;
                }
                continue;
            }

            // Start of comment
            if (char === '/' && nextChar === '/') {
                inLineComment = true;
                j++;
                continue;
            }
            if (char === '/' && nextChar === '*') {
                inBlockComment = true;
                j++;
                continue;
            }

            // Start of string
            if (char === '@' && nextChar === '"') {
                inString = true;
                inVerbatimString = true;
                j++;
                continue;
            }
            if (char === '$' && nextChar === '"') {
                inString = true;
                j++;
                continue;
            }
            if (char === '"') {
                inString = true;
                continue;
            }

            if (char === "'") {
                inChar = true;
                continue;
            }

            // Braces
            if (char === '{' || char === '(' || char === '[') {
                stack.push({ char, line: i + 1, col: j + 1 });
            } else if (char === '}' || char === ')' || char === ']') {
                if (stack.length === 0) {
                    return `Unexpected closing character '${char}' at line ${i + 1}, col ${j + 1}`;
                }
                const last = stack.pop()!;
                if ((char === '}' && last.char !== '{') ||
                    (char === ')' && last.char !== '(') ||
                    (char === ']' && last.char !== '[')) {
                    return `Mismatched closing character '${char}' at line ${i + 1}, col ${j + 1} (expected closing for '${last.char}' from line ${last.line}, col ${last.col})`;
                }
            }
        }
        inLineComment = false;
    }

    if (inBlockComment) {
        return "Unclosed block comment";
    }
    if (inString) {
        return "Unclosed string literal";
    }
    if (inChar) {
        return "Unclosed character literal";
    }
    if (stack.length > 0) {
        const last = stack.pop()!;
        return `Unclosed '${last.char}' from line ${last.line}, col ${last.col}`;
    }

    return undefined;
}

function sortKotlinImports(text: string): string {
    const lines = text.split('\n');
    const importLines: string[] = [];
    const otherLines: string[] = [];

    for (const line of lines) {
        if (line.trim().startsWith('import ')) {
            importLines.push(line);
        } else {
            otherLines.push(line);
        }
    }

    if (importLines.length === 0) return text;

    importLines.sort((a, b) => a.trim().localeCompare(b.trim()));

    let insertIdx = 0;
    for (let i = 0; i < otherLines.length; i++) {
        if (otherLines[i].trim().startsWith('package ')) {
            insertIdx = i + 1;
            break;
        }
    }

    const head = otherLines.slice(0, insertIdx);
    const tail = otherLines.slice(insertIdx);

    while (tail.length > 0 && tail[0].trim() === '') {
        tail.shift();
    }
    while (head.length > 0 && head[head.length - 1].trim() === '') {
        head.pop();
    }

    const result = [
        ...head,
        '',
        ...importLines,
        '',
        ...tail
    ];

    return result.join('\n').replace(/^\n+/, '');
}

/**
 * Handle Kotlin formatting and validation
 */
export async function handleKotlin(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Kotlin using custom resilient validator
    validationMessage = validateKotlin(text);

    // Deep Formatting: Sort Imports
    text = sortKotlinImports(text);

    // Try Deep Formatting with Prettier (Kotlin Plugin)
    try {
        const prettier = await import('prettier');
        const pluginKotlinMod = await import('prettier-plugin-kotlin');
        const pluginKotlin = pluginKotlinMod.default || pluginKotlinMod;

        formatted = await prettier.format(text, {
            parser: "kotlin",
            plugins: [pluginKotlin],
            tabWidth: 4,
            printWidth: 100,
            useTabs: false,
            trailingComma: "none",
            singleQuote: false,
        });
    } catch (prettierError: any) {
        console.warn('Prettier Kotlin formatting failed, falling back to js-beautify', prettierError);

        const jsbeautify = require('js-beautify');
        /* eslint-disable */
        try {
            // --- PRE-PROCESSING ---
            const masks: string[] = [];
            const maskPrefix = '___KT_MASK_';

            // 1. Mask strings, chars, comments and annotations
            // Strings: """...""" (multiline), "..."
            // Chars: '...'
            // Comments: //... or /*...*/
            // Annotations: @Identifier or @Identifier(...) - simplified to just @Identifier to avoid complexity
            let maskedText = text.replace(/("""[\s\S]*?""")|("(?:\\.|[^\\"])*")|('(?:\\.|[^\\'])*')|(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|(@[a-zA-Z0-9_]+(?:\([^)]*\))?)/g, (match) => {
                const placeholder = `${maskPrefix}${masks.length}___`;
                masks.push(match);
                return placeholder;
            });

            // 2. Normalize Kotlin Syntax for js-beautify
            maskedText = maskedText.replace(/->/g, '___ARROW___');
            maskedText = maskedText.replace(/\.\./g, '___RANGE___');
            maskedText = maskedText.replace(/\?\./g, '___SAFE_CALL___');
            maskedText = maskedText.replace(/\!\!/g, '___NOT_NULL___');
            maskedText = maskedText.replace(/\?:/g, '___ELVIS___');
            maskedText = maskedText.replace(/\bdata\s+class\b/g, 'data_class');
            maskedText = maskedText.replace(/\bcompanion\s+object\b/g, 'companion_object');
            maskedText = maskedText.replace(/\bas\?/g, '___AS_SAFE___');

            // --- CORE FORMATTING ---
            let beautified = jsbeautify.js(maskedText, {
                indent_size: 4,
                indent_char: ' ',
                max_preserve_newlines: 2,
                preserve_newlines: true,
                keep_array_indentation: false,
                break_chained_methods: false,
                brace_style: 'collapse',
                space_before_conditional: true,
                unescape_strings: false,
                jslint_happy: false,
                end_with_newline: false, // Kotlin doesn't strictly require trailing newline
                wrap_line_length: 0,
                comma_first: false,
                e4x: true,
                indent_empty_lines: false
            });

            // --- POST-PROCESSING ---

            // Restore keywords
            beautified = beautified.replace(/\bdata_class\b/g, 'data class');
            beautified = beautified.replace(/\bcompanion_object\b/g, 'companion object');

            // Restore Operators
            beautified = beautified.replace(/\s*___ARROW___\s*/g, ' -> ');
            beautified = beautified.replace(/\s*___RANGE___\s*/g, '..');
            beautified = beautified.replace(/\s*___SAFE_CALL___\s*/g, '?.');
            beautified = beautified.replace(/\s*___NOT_NULL___\s*/g, '!!');
            beautified = beautified.replace(/\s*___ELVIS___\s*/g, ' ?: ');
            beautified = beautified.replace(/___AS_SAFE___/g, 'as?');

            // Fix Generics: List < String > -> List<String>
            // Simple loop for nested generics
            for (let k = 0; k < 2; k++) {
                beautified = beautified.replace(/\b([a-zA-Z0-9_]+)\s*<\s+([^>]+?)\s+>(?=\s*[>(\w:,\*&;\[\{=\.])?/g, (match: string, id: string, content: string) => {
                     if (/[{}=;]/.test(content) || /&&|\|\||==|!=|<=|>=/.test(content)) return match;
                     return `${id}<${content.trim()}>`;
                });
            }

            // Fix Nullable Types: String ? -> String?
            beautified = beautified.replace(/([a-zA-Z0-9_>])\s+\?(?![?:])/g, '$1?');

            // Fix Colon Spacing: var x : Int -> var x: Int
            beautified = beautified.replace(/([^\s])\s+:\s+/g, '$1: ');

            // Fix Lambda Braces: foo { -> foo {
            beautified = beautified.replace(/([a-zA-Z0-9_>])\s*\{/g, '$1 {');

            // Restore Masks
            formatted = beautified.replace(new RegExp(`${maskPrefix}(\\d+)___`, 'g'), (_: string, index: string) => {
                return masks[parseInt(index)];
            });

        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to format Kotlin: ${error.message}`);
            return;
        }
        /* eslint-enable */

        if (!validationMessage) {
             validationMessage = "Deep formatting (Prettier) failed. Applied basic formatting.";
        }
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Kotlin has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Kotlin formatted successfully!');
    }
}

/**
 * Validate Kotlin code for basic structural errors
 */
function validateKotlin(text: string): string | undefined {
    const braceStack: { char: string, line: number, col: number }[] = [];
    let stateStack: ('STRING' | 'MULTILINE_STRING' | 'NORMAL')[] = ['NORMAL'];
    let blockCommentLevel = 0;

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];
            const nextNextChar = line[j + 2];
            const currentState = stateStack[stateStack.length - 1];

            if (blockCommentLevel > 0) {
                if (char === '*' && nextChar === '/') {
                    blockCommentLevel--;
                    j++;
                } else if (char === '/' && nextChar === '*') {
                    blockCommentLevel++;
                    j++;
                }
                continue;
            }

            if (currentState === 'MULTILINE_STRING') {
                if (char === '"' && nextChar === '"' && nextNextChar === '"') {
                    stateStack.pop();
                    j += 2;
                }
                continue;
            }

            if (currentState === 'STRING') {
                if (char === '\\') {
                    j++; // Escape sequence
                } else if (char === '"') {
                    stateStack.pop();
                }
                continue;
            }

            // NORMAL state
            if (char === '/' && nextChar === '/') {
                // Line comment
                break;
            }
            if (char === '/' && nextChar === '*') {
                blockCommentLevel++;
                j++;
                continue;
            }
            if (char === '"' && nextChar === '"' && nextNextChar === '"') {
                stateStack.push('MULTILINE_STRING');
                j += 2;
                continue;
            }
            if (char === '"') {
                stateStack.push('STRING');
                continue;
            }

            if (char === '{' || char === '(' || char === '[') {
                braceStack.push({ char, line: i, col: j });
            } else if (char === '}' || char === ')' || char === ']') {
                if (braceStack.length === 0) {
                    return `Unexpected closing character '${char}' at line ${i + 1}, col ${j + 1}`;
                }
                const last = braceStack.pop()!;
                if ((char === '}' && last.char !== '{') ||
                    (char === ')' && last.char !== '(') ||
                    (char === ']' && last.char !== '[')) {
                    return `Mismatched closing character '${char}' at line ${i + 1}, col ${j + 1} (expected closure for '${last.char}' from line ${last.line + 1}, col ${last.col + 1})`;
                }
            }
        }
    }

    if (blockCommentLevel > 0) {
        return "Unclosed block comment";
    }
    const lastState = stateStack.pop();
    if (lastState === 'MULTILINE_STRING') {
        return "Unclosed multiline string";
    }
    if (lastState === 'STRING') {
        return "Unclosed string literal";
    }

    if (braceStack.length > 0) {
        const last = braceStack.pop()!;
        return `Unclosed '${last.char}' from line ${last.line + 1}, col ${last.col + 1}`;
    }

    return undefined;
}

/**
 * Handle Swift formatting and validation
 */
export async function handleSwift(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Lazy load dependencies
    const jsbeautify = require('js-beautify');

    // Validate Swift using custom resilient validator
    validationMessage = validateSwift(text);

    // Deep Formatting logic
    try {
        formatted = formatSwiftDeep(text);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Swift: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Swift has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Swift formatted successfully!');
    }
}

/**
 * Validate Swift code for basic structural errors
 */
function validateSwift(text: string): string | undefined {
    const braceStack: { char: string, line: number, col: number, isInterpolation?: boolean }[] = [];
    let stateStack: ('STRING' | 'MULTILINE_STRING' | 'NORMAL')[] = ['NORMAL'];
    let blockCommentLevel = 0;

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];
            const nextNextChar = line[j + 2];
            const currentState = stateStack[stateStack.length - 1];

            if (blockCommentLevel > 0) {
                if (char === '*' && nextChar === '/') {
                    blockCommentLevel--;
                    j++;
                } else if (char === '/' && nextChar === '*') {
                    blockCommentLevel++;
                    j++;
                }
                continue;
            }

            if (currentState === 'MULTILINE_STRING') {
                if (char === '"' && nextChar === '"' && nextNextChar === '"') {
                    stateStack.pop();
                    j += 2;
                }
                continue;
            }

            if (currentState === 'STRING') {
                if (char === '\\') {
                    if (nextChar === '(') {
                        braceStack.push({ char: '(', line: i, col: j + 1, isInterpolation: true });
                        stateStack.push('NORMAL');
                        j++;
                    } else {
                        j++; // Escape sequence
                    }
                } else if (char === '"') {
                    stateStack.pop();
                }
                continue;
            }

            // NORMAL state
            if (char === '/' && nextChar === '/') {
                // Line comment
                break;
            }
            if (char === '/' && nextChar === '*') {
                blockCommentLevel++;
                j++;
                continue;
            }
            if (char === '"' && nextChar === '"' && nextNextChar === '"') {
                stateStack.push('MULTILINE_STRING');
                j += 2;
                continue;
            }
            if (char === '"') {
                stateStack.push('STRING');
                continue;
            }

            if (char === '{' || char === '(' || char === '[') {
                braceStack.push({ char, line: i, col: j });
            } else if (char === '}' || char === ')' || char === ']') {
                if (braceStack.length === 0) {
                    return `Unexpected closing character '${char}' at line ${i + 1}, col ${j + 1}`;
                }
                const last = braceStack.pop()!;
                if ((char === '}' && last.char !== '{') ||
                    (char === ')' && last.char !== '(') ||
                    (char === ']' && last.char !== '[')) {
                    return `Mismatched closing character '${char}' at line ${i + 1}, col ${j + 1} (expected closure for '${last.char}' from line ${last.line + 1}, col ${last.col + 1})`;
                }
                if (char === ')' && last.isInterpolation) {
                    stateStack.pop(); // Return from NORMAL (inside interpolation) to STRING
                }
            }
        }
    }

    if (blockCommentLevel > 0) {
        return "Unclosed block comment";
    }
    const lastState = stateStack.pop();
    if (lastState === 'MULTILINE_STRING') {
        return "Unclosed multiline string";
    }
    if (lastState === 'STRING') {
        return "Unclosed string literal";
    }

    if (braceStack.length > 0) {
        const last = braceStack.pop()!;
        return `Unclosed '${last.char}' from line ${last.line + 1}, col ${last.col + 1}`;
    }

    return undefined;
}
