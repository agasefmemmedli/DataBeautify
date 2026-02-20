import * as vscode from 'vscode';
import { applyEdit } from '../utils';
import { formatPythonDeep } from './python_deep_formatter';
import { formatGoDeep } from './go_deep_formatter';
import { formatRustDeep } from './rust_deep_formatter';

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

        // Custom resilient formatter logic (improved)
        try {
            formatted = formatRubyCustom(text);
        } catch (error: any) {
             vscode.window.showErrorMessage(`Failed to format Ruby: ${error.message}`);
             return;
        }

        if (!validationMessage) {
             validationMessage = "Deep formatting (Prettier) failed. Applied basic formatting.";
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
 * Custom resilient Ruby formatter
 */
function formatRubyCustom(text: string): string {
    const lines = text.split('\n');
    const formattedLines: string[] = [];
    let indentLevel = 0;

    // Keywords that start a block
    const blockOpeners = /^(class|module|def|begin|case|if|unless|while|until|for)\b/;
    // Keywords that end a block
    const blockClosers = /^end\b/;
    // Keywords that are middle of a block
    const blockIntermediates = /^(elsif|else|when|rescue|ensure)\b/;
    // 'do' at the end of a line (common for blocks)
    const doAtEnd = /\bdo\b(\s*\|.*\|)?\s*$/;

    // Heredoc tracking
    let inHeredoc = false;
    let heredocDelimiter = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (inHeredoc) {
            formattedLines.push(line); // Preserve indentation inside heredoc
            if (trimmed === heredocDelimiter) {
                inHeredoc = false;
            }
            continue;
        }

        // Check for heredoc start
        const heredocMatch = line.match(/<<[-~]?\s*(["']?)([A-Z0-9_]+)\1/i);
        if (heredocMatch) {
            inHeredoc = true;
            heredocDelimiter = heredocMatch[2];
        }

        if (trimmed === '') {
            formattedLines.push('');
            continue;
        }

        // Adjust indent for the current line if it's a closer or intermediate
        let currentIndent = indentLevel;
        if (blockClosers.test(trimmed) || blockIntermediates.test(trimmed)) {
            currentIndent = Math.max(0, indentLevel - 1);
        }

        // Handle closing braces/brackets at start of line
        if (trimmed.startsWith('}') || trimmed.startsWith(']') || trimmed.startsWith(')')) {
             currentIndent = Math.max(0, currentIndent - 1);
        }

        // Apply indentation (Ruby uses 2 spaces)
        formattedLines.push('  '.repeat(currentIndent) + trimmed);

        // Calculate indentation for the NEXT line
        let nextIndent = indentLevel;

        // Block openers
        if (blockOpeners.test(trimmed) || doAtEnd.test(trimmed) || blockIntermediates.test(trimmed)) {
            nextIndent = currentIndent + 1;
        } else if (blockClosers.test(trimmed)) {
            nextIndent = Math.max(0, indentLevel - 1);
        }

        // Braces/Brackets
        const openBraces = (trimmed.match(/[\{\[\(]/g) || []).length;
        const closeBraces = (trimmed.match(/[\}\]\)]/g) || []).length;
        nextIndent += (openBraces - closeBraces);

        // Ensure non-negative indentation
        indentLevel = Math.max(0, nextIndent);
    }
    return formattedLines.join('\n');
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

    // Lazy load dependencies
    const jsbeautify = require('js-beautify');

    // Validate C using custom resilient validator
    validationMessage = validateC(text);

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
            formatted = formatShellCustom(text);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to format Shell: ${error.message}`);
            return;
        }

        if (!validationMessage) {
             validationMessage = "Deep formatting (Prettier) failed. Applied basic formatting.";
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
 * Custom resilient Shell formatter (Fallback)
 */
function formatShellCustom(text: string): string {
    const lines = text.split('\n');
    const formattedLines: string[] = [];
    let indentLevel = 0;
    let inHeredoc = false;
    let heredocDelimiter = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '' && !inHeredoc) {
            formattedLines.push('');
            continue;
        }

        // Handle Heredoc
        if (inHeredoc) {
            formattedLines.push(line);
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

        // Indentation adjustment
        const closers = /^(fi|done|esac|\}|\]|\]\])\b|^(\)\s*$)/;
        const intermediates = /^(then|do|else|elif|;;)\b/;

        let currentIndent = indentLevel;
        if (closers.test(trimmed) || intermediates.test(trimmed)) {
            currentIndent = Math.max(0, indentLevel - 1);
        }

        // Apply indentation
        formattedLines.push('  '.repeat(currentIndent) + trimmed);

        // Calculate indent for NEXT line
        const openers = /^(if|for|while|until|case)\b|(\{|\(|\[|\[\[)$/;
        const isOpener = openers.test(trimmed);
        const isCloser = closers.test(trimmed);

        // Special check for 'then' or 'do' at end of line
        const endsWithOpener = /[; \t](then|do)$/.test(trimmed);

        if (isOpener || endsWithOpener || intermediates.test(trimmed)) {
            indentLevel = currentIndent + 1;
        } else if (isCloser) {
            indentLevel = Math.max(0, currentIndent);
        } else if (trimmed.endsWith(')')) {
            // Potential case pattern
            indentLevel = currentIndent + 1;
        }
    }
    return formattedLines.join('\n');
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
            formatted = formatPowerShellCustom(text);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to format PowerShell: ${error.message}`);
            return;
        }

        if (!validationMessage) {
             validationMessage = "Deep formatting (Prettier) failed. Applied basic formatting.";
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
 * Custom resilient PowerShell formatter (Fallback)
 */
function formatPowerShellCustom(text: string): string {
    const lines = text.split('\n');
    const formattedLines: string[] = [];
    let indentLevel = 0;
    let inHereString = false;
    let hereStringMarker = '';
    let blockCommentLevel = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '' && !inHereString && blockCommentLevel === 0) {
            formattedLines.push('');
            continue;
        }

        // Handle Here-Strings and Block Comments
        if (inHereString) {
            formattedLines.push(line);
            if (trimmed === hereStringMarker) {
                inHereString = false;
            }
            continue;
        }

        if (blockCommentLevel > 0) {
            formattedLines.push(line);
            // Check for end of block comment
            let pos = 0;
            while ((pos = line.indexOf('#>', pos)) !== -1) {
                blockCommentLevel--;
                pos += 2;
                if (blockCommentLevel === 0) break;
            }
            continue;
        }

        // Check for start of Here-String (must be at the end of the line)
        if (trimmed.endsWith('@"') || trimmed.endsWith("@'")) {
            inHereString = true;
            hereStringMarker = trimmed.endsWith('@"') ? '"@' : "'@";
            formattedLines.push('    '.repeat(indentLevel) + trimmed);
            continue;
        }

        // Check for start of Block Comment
        if (trimmed.startsWith('<#')) {
            blockCommentLevel++;
            formattedLines.push('    '.repeat(indentLevel) + trimmed);
            // Check if it ends on the same line
            let pos = 2;
            while ((pos = line.indexOf('#>', pos)) !== -1) {
                blockCommentLevel--;
                pos += 2;
                if (blockCommentLevel === 0) break;
            }
            continue;
        }

        // Indentation adjustment for closing characters at the START of the line
        let leadingClosingCount = 0;
        let j = 0;
        while (j < trimmed.length && (trimmed[j] === '}' || trimmed[j] === ')' || trimmed[j] === ']')) {
            leadingClosingCount++;
            j++;
        }

        if (leadingClosingCount > 0) {
            indentLevel = Math.max(0, indentLevel - leadingClosingCount);
        }

        // Apply indentation
        formattedLines.push('    '.repeat(Math.max(0, indentLevel)) + trimmed);

        // Calculate net brace change for NEXT line
        let netChange = 0;
        let inString = false;
        let stringChar = '';

        for (let k = leadingClosingCount; k < trimmed.length; k++) {
            const char = trimmed[k];
            const nextChar = trimmed[k+1];

            if (inString) {
                if (char === '`') { // PowerShell escape character
                    k++;
                } else if (char === stringChar) {
                    if (nextChar === stringChar) {
                        k++; // Escaped quote "" or ''
                    } else {
                        inString = false;
                    }
                }
                continue;
            }

            if (char === '"' || char === "'") {
                inString = true;
                stringChar = char;
                continue;
            }

            if (char === '#') break; // Line comment

            if (char === '<' && nextChar === '#') {
                blockCommentLevel++;
                k++;
                continue;
            }

            if (char === '{' || char === '(' || char === '[') {
                netChange++;
            } else if (char === '}' || char === ')' || char === ']') {
                netChange--;
            }
        }

        indentLevel = Math.max(0, indentLevel + netChange);
    }
    return formattedLines.join('\n');
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

    // Lazy load dependencies
    const jsbeautify = require('js-beautify');

    // Validate Dart using custom resilient validator
    validationMessage = validateDart(text);

    /* eslint-disable */
    try {
        // --- PRE-PROCESSING ---
        const masks: string[] = [];
        const maskPrefix = '___DART_MASK_';

        // 1. Mask strings and comments
        // Multiline strings: '''...''' or """..."""
        // Raw strings: r'...' or r"..."
        // Normal strings: '...' or "..."
        // Comments: //... or /*...*/
        let maskedText = text.replace(/("""[\s\S]*?""")|('''[\s\S]*?''')|(r"(?:\\.|[^"])*")|(r'(?:\\.|[^'])*')|("(?:\\.|[^\\"])*")|('(?:\\.|[^\\'])*')|(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)/g, (match) => {
            const placeholder = `${maskPrefix}${masks.length}___`;
            masks.push(match);
            return placeholder;
        });

        // 2. Normalize Dart Syntax
        // Null-aware cascades: ?..method() -> \n.___NULL_AWARE_CASCADE___method()
        maskedText = maskedText.replace(/\?\.\./g, '\n.___NULL_AWARE_CASCADE___');

        // Cascades: ..method() -> \n.___CASCADE___method() to force newline and leverage js-beautify indentation
        // Fix: Use negative lookahead AND capture group check (simulating lookbehind) to avoid matching spread operator '...'
        // matches anything not a dot (or start of line), followed by .., followed by not a dot.
        maskedText = maskedText.replace(/(^|[^.])\.\.(?!\.)/g, '$1\n.___CASCADE___');
        maskedText = maskedText.replace(/\?\./g, '___SAFE_CALL___');
        maskedText = maskedText.replace(/\?\?/g, '___NULL_COALESCING___');
        maskedText = maskedText.replace(/\?\?=/g, '___NULL_COALESCING_ASSIGN___');
        maskedText = maskedText.replace(/=>/g, '___ARROW___');

        // Named constructors: Class.name(...) -> Class___NAMED_CTOR___name(...)
        // To prevent js-beautify from treating it as property access with space
        maskedText = maskedText.replace(/([A-Z][a-zA-Z0-9_]*)\.([a-zA-Z0-9_]+)/g, '$1___NAMED_CTOR___$2');

        // Annotations: @foo -> ___ANNOTATION___foo
        // Mask @ to avoid space insertion
        maskedText = maskedText.replace(/@([a-zA-Z0-9_]+)/g, '___ANNOTATION___$1');

        // --- CORE FORMATTING ---
        let beautified = jsbeautify.js(maskedText, {
            indent_size: 2,
            indent_char: ' ',
            max_preserve_newlines: 2,
            preserve_newlines: true,
            keep_array_indentation: false,
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

        // Restore Operators
        // Cascades: Remove the dot we added and just keep the indentation js-beautify provided
        beautified = beautified.replace(/\.___NULL_AWARE_CASCADE___/g, '?..');
        beautified = beautified.replace(/\.___CASCADE___/g, '..');
        beautified = beautified.replace(/\s*___SAFE_CALL___\s*/g, '?.');
        beautified = beautified.replace(/\s*___NULL_COALESCING___\s*/g, ' ?? ');
        beautified = beautified.replace(/\s*___NULL_COALESCING_ASSIGN___\s*/g, ' ??= ');
        beautified = beautified.replace(/\s*___ARROW___\s*/g, ' => ');
        beautified = beautified.replace(/___NAMED_CTOR___/g, '.');
        beautified = beautified.replace(/___ANNOTATION___/g, '@');

        // Fix Generics: List < T > -> List<T>
        // Use a loop to handle nested generics (e.g. Future<List<Map<String, T>>>)
        // Regex expanded to support deeper nesting (3 levels explicitly) to catch Future<List<Map<...>>>
        for(let k=0; k<5; k++) {
             beautified = beautified.replace(/\b([a-zA-Z0-9_]+)\s*<\s+((?:[^<>\n]|(?:[a-zA-Z0-9_]+\s*<\s*(?:[^<>\n]|(?:[a-zA-Z0-9_]+\s*<\s*[^<>\n]+\s*>))+\s*>))+?)\s*>/g, (match: string, id: string, content: string) => {
                 // Avoid comparison operators
                 if (/[{}=;]/.test(content) || /&&|\|\||==|!=|<=|>=/.test(content)) return match;
                 return `${id}<${content.trim()}>`;
             });
        }

        // Fix Cascades: Collapse double newlines (caused by our pre-processing adding \n)
        beautified = beautified.replace(/\n\s*\n(\s*\.\.)/g, '\n$1');

        // Fix Nullable Types: String ? -> String?
        beautified = beautified.replace(/([a-zA-Z0-9_>\]\)])\s+\?(?![?:])/g, '$1?');

        // Fix required keyword spacing
        beautified = beautified.replace(/required([^\s])/g, 'required $1');

        // Fix space after generic > and before (
        // Only if > is not preceded by space (to distinguish from comparison operator a > (b))
        beautified = beautified.replace(/([^\s])>\s+\(/g, '$1>(');

        // Fix Constructor Initialization List: ): ... -> ) : ...
        // Ensure : is on new line if line is long, or just ensure space
        beautified = beautified.replace(/\)\s*:\s*([a-zA-Z0-9_]+)\s*=/g, ') : $1 =');

        // Fix: Ensure @Annotation is followed by newline if it's on a class/method decl
        // We look for @Annotation followed by space and then a keyword
        beautified = beautified.replace(/(@[a-zA-Z0-9_]+(?:\([^)]*\))?)\s+(class|void|Future|int|String|bool|double|var|final|const|dynamic|List|Map|Set)/g, '$1\n$2');

        // Restore Masks
        formatted = beautified.replace(new RegExp(`${maskPrefix}(\\d+)___`, 'g'), (_: string, index: string) => {
            return masks[parseInt(index)];
        });

        // 3. Import Sorting (Dart Style Guide)
        formatted = sortDartImports(formatted);

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Dart: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Dart has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Dart formatted successfully!');
    }
}

/**
 * Sort Dart imports according to Effective Dart style
 * 1. dart: imports
 * 2. package: imports
 * 3. relative imports
 * 4. exports
 */
function sortDartImports(text: string): string {
    const lines = text.split('\n');
    const importLines: { line: string, type: number, index: number }[] = [];
    let firstImportIndex = -1;
    let lastImportIndex = -1;

    // Identify import/export lines and their range
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('import ') || line.startsWith('export ')) {
            if (firstImportIndex === -1) firstImportIndex = i;
            lastImportIndex = i;

            let type = 2; // relative by default
            if (line.startsWith('export ')) type = 3;
            else if (line.includes("'dart:") || line.includes('"dart:')) type = 0;
            else if (line.includes("'package:") || line.includes('"package:')) type = 1;

            importLines.push({ line: lines[i], type, index: i });
        } else if (line === '' || line.startsWith('//') || line.startsWith('/*') || line.startsWith('library ')) {
            // Allow comments/blanks/library directive within or before imports,
            // but if we see code (class/void/etc), stop.
            // For simplicity, we only sort a contiguous block of imports (ignoring comments mixed in for now or treating them as separators)
            // Actually, sorting mixed comments is hard.
            // We will only sort if we have a clean block or just extract imports.
            // Let's stick to simple logic: Extract all imports, sort them, and put them back at the location of the first import?
            // But they might be separated by logic.
            // Safer: Only sort if they are in a contiguous block (separated by newlines/comments is ok).
            if (firstImportIndex !== -1 && !line.startsWith('//') && line !== '' && !line.startsWith('library ')) {
                 // Found code after imports
                 break;
            }
        } else if (firstImportIndex !== -1) {
             // Found code
             break;
        }
    }

    if (importLines.length === 0) return text;

    // Sort imports
    importLines.sort((a, b) => {
        if (a.type !== b.type) return a.type - b.type;
        return a.line.localeCompare(b.line);
    });

    // Reconstruct the text
    // We only replace the lines that were imports.
    // Issue: If we gathered imports from scattered places, putting them together might break things.
    // But we stopped at first code.
    // However, we might have comments/newlines in between that we want to preserve?
    // Standard sorting usually groups them.

    // Strategy: Replace the entire range from firstImportIndex to lastImportIndex with sorted imports + proper spacing?
    // No, that deletes comments.
    // Safer Strategy: Just replace the import lines in order.
    // But we want to reorder them.
    // If we have:
    // import A
    // // comment
    // import B
    // And we swap A and B. The comment stays?
    // "import B // comment import A".
    // Code comments usually belong to the import below or above.

    // Let's keep it simple and safe: Only sort if the block is purely imports (and maybe blank lines).
    // If there are comments, we skip sorting to avoid detaching comments.

    let hasComments = false;
    for(let i = firstImportIndex; i <= lastImportIndex; i++) {
        const line = lines[i].trim();
        if (line.startsWith('//') || line.startsWith('/*')) {
            hasComments = true;
            break;
        }
    }

    if (hasComments) {
        // Fallback: simple sort of just the import lines in place?
        // No, might still be weird.
        return text;
    }

    // Now we can safely rewrite the block
    // We will collect all non-empty lines in the range, which should be just imports and exports.
    // Wait, blank lines?
    // We can filter out blank lines and re-insert groups with blank lines.

    // Grouping
    const dartImports = importLines.filter(x => x.type === 0).map(x => x.line);
    const packageImports = importLines.filter(x => x.type === 1).map(x => x.line);
    const relativeImports = importLines.filter(x => x.type === 2).map(x => x.line);
    const exports = importLines.filter(x => x.type === 3).map(x => x.line);

    const sortedBlock: string[] = [];
    if (dartImports.length > 0) {
        sortedBlock.push(...dartImports);
        if (packageImports.length > 0 || relativeImports.length > 0 || exports.length > 0) sortedBlock.push('');
    }
    if (packageImports.length > 0) {
        sortedBlock.push(...packageImports);
        if (relativeImports.length > 0 || exports.length > 0) sortedBlock.push('');
    }
    if (relativeImports.length > 0) {
        sortedBlock.push(...relativeImports);
        if (exports.length > 0) sortedBlock.push('');
    }
    if (exports.length > 0) {
        sortedBlock.push(...exports);
    }

    // Replace the range in 'lines'
    // But we need to handle the case where we skipped lines in between?
    // We checked for comments.
    // What about other stuff?
    // We iterated `importLines` which has indices.
    // But we want to overwrite the range `firstImportIndex` to `lastImportIndex`?
    // But if there were blank lines in between, we want to respect the new grouping.

    // So:
    // 1. Remove all lines from firstImportIndex to lastImportIndex.
    // 2. Insert sortedBlock at firstImportIndex.

    lines.splice(firstImportIndex, lastImportIndex - firstImportIndex + 1, ...sortedBlock);

    return lines.join('\n');
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

    // Lazy load dependencies
    const jsbeautify = require('js-beautify');

    // Validate C++ using custom resilient validator
    validationMessage = validateCPP(text);

    /* eslint-disable */
    try {
        // --- PRE-PROCESSING ---
        const masks: string[] = [];
        const maskPrefix = '___CPP_MASK_';

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

        // 2. Normalize C++ Syntax
        // Access modifiers: public:, private:, protected:
        // Ensure they are on their own line.
        maskedText = maskedText.replace(/\b(public|private|protected)\s*:\s*/g, '$1:\n');

        // Scope resolution spacing cleanup
        maskedText = maskedText.replace(/\s*::\s*/g, '::');

        // Lambda syntax: [] (...) -> ... {
        // Ensure space between `] (`.
        maskedText = maskedText.replace(/\]\s*\(/g, '] (');

        // Template and Class on same line to prevent weird indentation
        maskedText = maskedText.replace(/(template\s*<.*?>)\s+(class|struct)/g, '$1 $2');

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

        // 0. Ensure access modifiers are on new line if js-beautify collapsed them
        beautified = beautified.replace(/^(\s*)(public|private|protected)\s*:\s*([^\s])/gm, '$1$2:\n$1    $3');

        // 1. Fix Scope Resolution and Double References/Pointers (Before templates to avoid breaking std::vector match)
        beautified = beautified.replace(/\s*::\s*/g, '::');
        beautified = beautified.replace(/&\s*&/g, '&&');
        beautified = beautified.replace(/\*\s*\*/g, '**');

        // 2. Indentation Fixes
        const lines = beautified.split('\n');
        const finalLines: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            const trimmed = line.trim();

            // Fix Access Modifiers Indentation
            // Dedent public/private/protected by one level (4 spaces) relative to where js-beautify put them
            if (/^(public|private|protected)\s*:/.test(trimmed)) {
                line = line.replace(/^    /, '');
            }

            finalLines.push(line);
        }
        beautified = finalLines.join('\n');

        // 3. Fix Template Spacing: vector < int > -> vector<int>
        // Use callback to trim internal spaces
        for (let k = 0; k < 3; k++) {
            beautified = beautified.replace(/\b([\w:]+)\s*<\s+([^>]+?)\s+>(?=\s*[>(\w:,\*&;\[])/g, (match: string, id: string, content: string) => {
                return `${id}<${content.trim()}>`;
            });
        }

        // 4. Fix Pointer/Reference Alignment: int * p -> int* p
        // Heuristic: Type * Variable.
        const types = 'void|int|char|bool|float|double|long|short|unsigned|signed|size_t|auto|string|vector|map|set|list|pair|const|class|struct|typename';
        beautified = beautified.replace(new RegExp(`\\b(${types})\\s*(\\*+|&+)\\s*(\\w+)`, 'g'), '$1$2 $3');

        // Handle PascalCase types (Class pointers)
        beautified = beautified.replace(/\b([A-Z]\w*)\s*(\*+|&+)\s*(\w+)/g, '$1$2 $3');

        // Handle Abstract Declarators: void(T &) -> void(T&)
        // Matches Type & [),>]
        beautified = beautified.replace(new RegExp(`\\b([A-Z]\\w*|${types})\\s*(\\*+|&+)\\s*(?=\\s*[),>])`, 'g'), '$1$2');

        // Handle Context-based pointers (assignment, return, etc)
        beautified = beautified.replace(/([=\(\[\{,!:?&\|\^\+\-\*\/%])\s*(\*|&)\s+([\w_]+)/g, '$1 $2$3');

        // 4. Restore Masks
        formatted = beautified.replace(new RegExp(`${maskPrefix}(\\d+)___`, 'g'), (_: string, index: string) => {
            return masks[parseInt(index)];
        });

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format C++: ${error.message}`);
        return;
    }
    /* eslint-enable */

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

    // Lazy load dependencies
    const jsbeautify = require('js-beautify');

    // Validate C# using custom resilient validator
    validationMessage = validateCSharp(text);

    /* eslint-disable */
    try {
        // --- PRE-PROCESSING ---
        // 1. Mask strings and comments to prevent interfering with them
        const masks: string[] = [];
        const maskPrefix = '___CS_MASK_';

        // Regex to capture strings (verbatim @"" and normal "") and comments
        // Note: This simple regex might struggle with complex nested structures but serves as a resilient first pass
        let maskedText = text.replace(/(@"(?:[^"]|"")*"|"(?:\\.|[^\\"])*")|(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)/g, (match) => {
            const placeholder = `${maskPrefix}${masks.length}___`;
            masks.push(match);
            return placeholder;
        });

        // 2. Normalize C# specific syntax before beautifying

        // Ensure space around lambda arrow '=>'
        maskedText = maskedText.replace(/([^\s])=>/g, '$1 =>');
        maskedText = maskedText.replace(/=>([^\s])/g, '=> $1');

        // Ensure attributes are on their own lines (basic heuristic)
        // This looks for [Attribute] followed by public/private/protected/internal/class/void/struct/enum/interface/return type
        maskedText = maskedText.replace(/(\[[^\]\n]+\])\s*(public|private|protected|internal|static|class|void|struct|enum|interface|async|override|virtual|abstract|sealed|readonly|const|event|delegate)/g, '$1\n$2');

        // Protect auto-properties from being expanded
        const propMasks: string[] = [];
        const propMaskPrefix = '___CS_PROP_';
        maskedText = maskedText.replace(/\{\s*get;\s*(?:private\s+|protected\s+|internal\s+)?(?:set|init);\s*\}/g, (match) => {
             const placeholder = `${propMaskPrefix}${propMasks.length}___`;
             propMasks.push(match.replace(/\s+/g, ' ')); // Normalize to single line
             return placeholder;
        });

        // --- CORE FORMATTING ---
        // Format C# (using js-beautify's JS formatter which handles C# well)
        let beautified = jsbeautify.js(maskedText, {
            indent_size: 4,
            indent_char: ' ',
            max_preserve_newlines: 2,
            preserve_newlines: true,
            keep_array_indentation: true,
            break_chained_methods: false,
            brace_style: 'expand', // Allman style is standard for C#
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

        // 1. Fix Generic Type spacing: List < string > -> List<string>
        // Strategy: Only fix generics in safe contexts to avoid breaking comparison operators (e.g. if (a < b))

        // Context 1: Keywords that precede types (new List<T>, public class<T>, etc.)
        beautified = beautified.replace(/\b(new|public|private|protected|internal|class|struct|interface|record|void|return|delegate|event)\s+([a-zA-Z0-9_]+)\s+<\s+/g, '$1 $2<');

        // Context 2: Known generic collection types (List<T>, Dictionary<K,V>, etc.)
        beautified = beautified.replace(/\b(List|Dictionary|IEnumerable|ICollection|HashSet|Queue|Stack|LinkedList|SortedList|ObservableCollection|Task|Func|Action|Tuple|ValueTuple|Lazy|Nullable)\s+<\s+/g, '$1<');

        // Context 3: PascalCase identifiers followed by <...> and then ( (Method call) or Identifier (Variable decl)
        // Matches: Method<T>(), Type<T> var
        // This regex looks for PascalCase ID, <, content without operators, >, then ( or ID.
        // Note: We use \s*< because Context 1/2 might have already removed the space before <
        beautified = beautified.replace(/\b([A-Z][a-zA-Z0-9_]*)\s*<\s+([a-zA-Z0-9_,\s\[\]\?]+?)\s+>\s*([\(a-zA-Z0-9_])/g, (match: string, id: string, content: string, suffix: string) => {
             const separator = suffix === '(' ? '' : ' ';
             return `${id}<${content.trim()}>${separator}${suffix}`;
        });

        // Cleanup spaces inside known generics (if partially fixed)
        // This targets < T > -> <T> only if we have already attached the < to the identifier
        beautified = beautified.replace(/([a-zA-Z0-9_]+)< ([^>]+?) >/g, '$1<$2>');
        beautified = beautified.replace(/([a-zA-Z0-9_]+)< ([^>]+?)(?=>)/g, '$1<$2'); // < T>
        beautified = beautified.replace(/([a-zA-Z0-9_]+)<([^>]+?) >/g, '$1<$2>'); // <T >

        // 2. Fix Nullable types: int ? -> int?
        beautified = beautified.replace(/\b(int|string|bool|double|float|decimal|long|short|byte|char|object|uint|ulong|ushort|sbyte)\s+\?/g, '$1?');

        // 3. Restore auto-properties
        beautified = beautified.replace(new RegExp(`${propMaskPrefix}(\\d+)___`, 'g'), (_: string, index: string) => {
            return propMasks[parseInt(index)];
        });

        // 4. Ensure space after control flow keywords if missing (foreach, etc)
        beautified = beautified.replace(/\b(foreach|catch|using|lock)\s*\(/g, '$1 (');

        // 5. Fix switch expression indentation (naive fix)
        // If 'switch' is on a new line but follows a variable, bring it up?
        // Or at least ensure the block inside is indented.
        // js-beautify handles switch statement well, but switch expression 'var x = y switch { ... }' might be split.
        // We will try to rejoin 'variable \n switch'
        beautified = beautified.replace(/([a-zA-Z0-9_\]\)])\n\s*switch\s*$/gm, '$1 switch');

        // 6. LINQ indentation fix
        // If 'from' is indented, ensure subsequent clauses are indented +1 level or aligned.
        // This is hard to do perfectly with regex, but we can try to fix the worst cases where they are flat.
        // We will assume 4 space indent.
        const lines = beautified.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (trimmed.startsWith('where ') || trimmed.startsWith('orderby ') || trimmed.startsWith('select ') || trimmed.startsWith('group ') || trimmed.startsWith('join ')) {
                // Check if previous line was a 'from' or another LINQ clause
                if (i > 0) {
                    const prevLine = lines[i-1];
                    const prevIndent = prevLine.match(/^\s*/)?.[0] || '';
                    if (prevLine.trim().startsWith('from ') || prevLine.trim().startsWith('var query = from ')) {
                        // Indent relative to previous line
                        lines[i] = prevIndent + '    ' + trimmed;
                    } else if (prevLine.trim().startsWith('where ') || prevLine.trim().startsWith('orderby ')) {
                        // Maintain indentation
                        lines[i] = prevIndent + trimmed;
                    }
                }
            }
        }
        beautified = lines.join('\n');

        // 7. Restore strings and comments
        formatted = beautified.replace(new RegExp(`${maskPrefix}(\\d+)___`, 'g'), (_: string, index: string) => {
            return masks[parseInt(index)];
        });

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format C#: ${error.message}`);
        return;
    }
    /* eslint-enable */

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

/**
 * Handle Kotlin formatting and validation
 */
export async function handleKotlin(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Kotlin using custom resilient validator
    validationMessage = validateKotlin(text);

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

    /* eslint-disable */
    try {
        // --- PRE-PROCESSING ---
        const masks: string[] = [];
        const maskPrefix = '___SWIFT_MASK_';

        // 1. Mask strings and comments
        let maskedText = text.replace(/("""[\s\S]*?""")|("(?:\\.|[^\\"])*")|(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)/g, (match) => {
            const placeholder = `${maskPrefix}${masks.length}___`;
            masks.push(match);
            return placeholder;
        });

        // 2. Normalize Swift Syntax for js-beautify

        // Mask Operators to protect them from splitting
        maskedText = maskedText.replace(/->/g, '___ARROW___');
        maskedText = maskedText.replace(/\.\.\./g, '___RANGE_CLOSED___');
        maskedText = maskedText.replace(/\.\.<|…/g, '___RANGE_HALF___');
        maskedText = maskedText.replace(/\?\?/g, '___NIL_COALESCING___');

        // Attributes: @available(...) -> @available(...) \n
        // Ensure attributes are separated from the next word if it's a keyword
        maskedText = maskedText.replace(/(@[a-zA-Z0-9_]+(?:\([^)]*\))?)\s*(func|class|struct|enum|protocol|extension|var|let|init)/g, '$1\n$2');

        // --- CORE FORMATTING ---
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

        // Restore Operators (remove extra spaces added by js-beautify around "identifiers")
        beautified = beautified.replace(/\s*___ARROW___\s*/g, ' -> ');
        beautified = beautified.replace(/\s*___RANGE_CLOSED___\s*/g, '...');
        beautified = beautified.replace(/\s*___RANGE_HALF___\s*/g, '..<');
        beautified = beautified.replace(/\s*___NIL_COALESCING___\s*/g, ' ?? ');

        // Fix Generics: Array < String > -> Array<String>
        // Supports one level of nesting: Dictionary < String, Array < Int > > -> Dictionary<String, Array<Int>>
        for (let k = 0; k < 2; k++) {
             beautified = beautified.replace(/\b([a-zA-Z0-9_]+)\s*<\s+((?:[^<>\n]|(?:[a-zA-Z0-9_]+\s*<\s*[^<>\n]+\s*>))+?)\s+>/g, (match: string, id: string, content: string) => {
                 // Avoid comparison operators
                 if (/[{}=;]/.test(content) || /&&|\|\||==|!=|<=|>=/.test(content)) return match;
                 return `${id}<${content.trim()}>`;
             });
        }

        // Fix Optionals: Type ? -> Type?
        beautified = beautified.replace(/([a-zA-Z0-9_>\]\)])\s+([?!])(?=[,\)\]\}\s=\.])/g, '$1$2');

        // Fix Argument Labels: label : Type -> label: Type
        beautified = beautified.replace(/([^\s?])\s+:\s+/g, '$1: ');

        // Fix space after keyword 'guard', 'if', 'switch' if missing
        beautified = beautified.replace(/\b(guard|if|switch|while|for)\(/g, '$1 (');

        // Fix guard/if let splitting
        beautified = beautified.replace(/\b(guard|if)\s*\n\s*let\b/g, '$1 let');
        // Pull 'else' up to same line
        beautified = beautified.replace(/\n\s*else/g, ' else');

        // Fix try/await splitting
        beautified = beautified.replace(/=\s*\n\s*try\b/g, '= try');
        beautified = beautified.replace(/try\s*\n\s*await\b/g, 'try await');

        // Fix [weak self] in spacing
        beautified = beautified.replace(/{\s*\[\s*weak\s+self\s*\]\s*in/g, '{ [weak self] in');

        // 7. Restore Masks
        formatted = beautified.replace(new RegExp(`${maskPrefix}(\\d+)___`, 'g'), (_: string, index: string) => {
            return masks[parseInt(index)];
        });

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Swift: ${error.message}`);
        return;
    }
    /* eslint-enable */

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
