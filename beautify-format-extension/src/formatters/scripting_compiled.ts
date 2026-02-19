import * as vscode from 'vscode';
import { applyEdit, loadESM } from '../utils';
import { formatPythonDeep } from './python_deep_formatter';

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
        const prettier = await loadESM('prettier');
        const pluginJavaMod = await loadESM('prettier-plugin-java');
        const pluginJava = pluginJavaMod.default || pluginJavaMod;

        formatted = await prettier.format(text, {
            parser: "java",
            plugins: [pluginJava],
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

    // Resilient formatting logic
    try {
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

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '') {
                formattedLines.push('');
                continue;
            }

            // Adjust indent for the current line if it's a closer or intermediate
            let currentIndent = indentLevel;
            if (blockClosers.test(trimmed) || blockIntermediates.test(trimmed)) {
                currentIndent = Math.max(0, indentLevel - 1);
            }

            // Apply indentation (Ruby uses 2 spaces)
            formattedLines.push('  '.repeat(currentIndent) + trimmed);

            // Calculate indentation for the NEXT line
            let nextIndent = indentLevel;

            // If line starts with an opener or ends with 'do', increment indent
            // We check if it starts with an opener to avoid modifier if/unless
            if (blockOpeners.test(trimmed) || doAtEnd.test(trimmed) || blockIntermediates.test(trimmed)) {
                nextIndent = currentIndent + 1;
            } else if (blockClosers.test(trimmed)) {
                nextIndent = Math.max(0, indentLevel - 1);
            }

            indentLevel = nextIndent;
        }
        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Ruby: ${error.message}`);
        return;
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
 * Handle Shell Script formatting and validation
 */
export async function handleShell(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Shell using custom resilient validator
    validationMessage = validateShell(text);

    // Resilient formatting logic
    try {
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
        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Shell: ${error.message}`);
        return;
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

    // Resilient formatting logic
    try {
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
        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format PowerShell: ${error.message}`);
        return;
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

    // Lazy load dependencies
    const jsbeautify = require('js-beautify');

    // Validate Dart using custom resilient validator
    validationMessage = validateDart(text);

    /* eslint-disable */
    try {
        // Format Dart (using js-beautify's JS formatter which handles Dart well)
        formatted = jsbeautify.js(text, {
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
            end_with_newline: false,
            wrap_line_length: 0,
            comma_first: false,
            e4x: true,
            indent_empty_lines: false
        });
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
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;
        let extraIndent = 0;
        let inRawString = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '' && !inRawString) {
                formattedLines.push('');
                continue;
            }

            // Handle backtick raw strings
            if (inRawString) {
                formattedLines.push(line);
                if (trimmed.includes('`')) {
                    const matches = (trimmed.match(/`/g) || []).length;
                    if (matches % 2 !== 0) {
                        inRawString = false;
                    }
                }
                continue;
            }

            if (trimmed.includes('`')) {
                const matches = (trimmed.match(/`/g) || []).length;
                if (matches % 2 !== 0) {
                    inRawString = true;
                }
            }

            // Indentation adjustment for closing braces at the START of the line
            let leadingClosingCount = 0;
            let j = 0;
            while (j < trimmed.length && (trimmed[j] === '}' || trimmed[j] === ')' || trimmed[j] === ']')) {
                leadingClosingCount++;
                j++;
            }

            if (leadingClosingCount > 0) {
                indentLevel = Math.max(0, indentLevel - leadingClosingCount);
                extraIndent = 0;
            }

            // Handle case and default labels
            let currentExtraIndent = extraIndent;
            if (trimmed.startsWith('case ') || trimmed.startsWith('default:')) {
                currentExtraIndent = 0;
                extraIndent = 1;
            }

            // Apply indentation (using 4 spaces as per Go standards often used in editors)
            let currentLine = '    '.repeat(Math.max(0, indentLevel + currentExtraIndent)) + trimmed;

            // Normalize := operator (ensure space around it)
            if (currentLine.includes(':=')) {
                currentLine = currentLine.replace(/\s*:=\s*/g, ' := ');
            }

            // Ensure space before {
            if (currentLine.endsWith('{') && !currentLine.endsWith(' {')) {
                currentLine = currentLine.replace(/\{$/, ' {');
            }

            formattedLines.push(currentLine);

            // Calculate net brace change for NEXT line, excluding leading closing braces
            let netChange = 0;
            let inString = false;
            let inChar = false;
            const remaining = trimmed.substring(leadingClosingCount);

            for (let k = 0; k < remaining.length; k++) {
                const char = remaining[k];
                if (char === '"' && (k === 0 || remaining[k-1] !== '\\')) {
                    inString = !inString;
                    continue;
                }
                if (inString) { continue; }

                if (char === "'" && (k === 0 || remaining[k-1] !== '\\')) {
                    inChar = !inChar;
                    continue;
                }
                if (inChar) { continue; }

                if (char === '/' && remaining[k+1] === '/') { break; }
                if (char === '/' && remaining[k+1] === '*') { break; }

                if (char === '{' || char === '(' || char === '[') {
                    netChange++;
                    extraIndent = 0;
                }
                if (char === '}' || char === ')' || char === ']') {
                    netChange--;
                }
            }

            indentLevel = Math.max(0, indentLevel + netChange);
        }
        formatted = formattedLines.join('\n');
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

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;
        let inRawString = false;
        let rawStringHashes = 0;
        let inString = false;
        let inChar = false;
        let blockCommentLevel = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '' && !inRawString && blockCommentLevel === 0) {
                formattedLines.push('');
                continue;
            }

            // Handle Rust raw strings r"..." or r#..."#
            if (inRawString) {
                formattedLines.push(line);
                const endMatch = line.match(new RegExp('"' + '#'.repeat(rawStringHashes)));
                if (endMatch) {
                    inRawString = false;
                }
                continue;
            }

            // Indentation adjustment for closing braces at the START of the line
            let leadingClosingCount = 0;
            if (blockCommentLevel === 0 && !inString && !inChar) {
                let j = 0;
                while (j < trimmed.length && (trimmed[j] === '}' || trimmed[j] === ')' || trimmed[j] === ']')) {
                    leadingClosingCount++;
                    j++;
                }
            }

            if (leadingClosingCount > 0) {
                indentLevel = Math.max(0, indentLevel - leadingClosingCount);
            }

            // Apply indentation
            let currentLine = (blockCommentLevel > 0 || inString || inChar) ? line : '    '.repeat(Math.max(0, indentLevel)) + trimmed;

            // Normalize => and -> operators (only if not in string/comment/rawstring)
            if (blockCommentLevel === 0 && !inString && !inChar && !inRawString) {
                // This is still a bit naive but better than global replace on the whole line if we were tracking state within the line.
                // To be truly robust we should do this character by character.
            }

            formattedLines.push(currentLine);

            // Calculate net brace change for NEXT line and track state
            let netChange = 0;
            const startIdx = (blockCommentLevel > 0 || inString || inChar) ? 0 : leadingClosingCount;
            const textToProcess = (blockCommentLevel > 0 || inString || inChar) ? line : trimmed.substring(leadingClosingCount);

            for (let k = 0; k < textToProcess.length; k++) {
                const char = textToProcess[k];
                const nextChar = textToProcess[k + 1];

                if (inRawString) {
                    const remaining = textToProcess.substring(k);
                    const endMatch = remaining.match(new RegExp('^"' + '#'.repeat(rawStringHashes)));
                    if (endMatch) {
                        inRawString = false;
                        k += endMatch[0].length - 1;
                    }
                    continue;
                }

                if (blockCommentLevel > 0) {
                    if (char === '*' && nextChar === '/') {
                        blockCommentLevel--;
                        k++;
                    } else if (char === '/' && nextChar === '*') {
                        blockCommentLevel++;
                        k++;
                    }
                    continue;
                }

                if (inString) {
                    if (char === '\\') {
                        k++;
                    } else if (char === '"') {
                        inString = false;
                    }
                    continue;
                }

                if (inChar) {
                    if (char === '\\') {
                        k++;
                    } else if (char === "'") {
                        inChar = false;
                    }
                    continue;
                }

                // Start of comment
                if (char === '/' && nextChar === '/') {
                    break; // Line comment, rest of line is ignored
                }
                if (char === '/' && nextChar === '*') {
                    blockCommentLevel++;
                    k++;
                    continue;
                }

                // Start of raw string
                if (char === 'r' && (nextChar === '"' || nextChar === '#')) {
                    let hashes = 0;
                    let m = k + 1;
                    while (m < textToProcess.length && textToProcess[m] === '#') {
                        hashes++;
                        m++;
                    }
                    if (m < textToProcess.length && textToProcess[m] === '"') {
                        inRawString = true;
                        rawStringHashes = hashes;
                        k = m;
                        continue;
                    }
                }

                if (char === '"') {
                    inString = true;
                    continue;
                }

                if (char === "'") {
                    const remaining = textToProcess.substring(k + 1);
                    if (/^([^'\\]|\\.)'/.test(remaining)) {
                        inChar = true;
                    }
                    continue;
                }

                if (char === '{' || char === '(' || char === '[') {
                    netChange++;
                }
                if (char === '}' || char === ')' || char === ']') {
                    netChange--;
                }
            }

            indentLevel = Math.max(0, indentLevel + netChange);
        }
        formatted = formattedLines.join('\n');

        // Post-process to normalize operators outside of strings/comments
        // (A bit complex to do perfectly without a full parser, but let's keep it simple for now as per "resilient" goal)
        // Actually, the previous version was simpler. Let's stick to a slightly better version.
        formatted = formatted.split('\n').map(l => {
            // Only normalize if the line doesn't seem to be a multiline string/comment middle
            if (l.trim().startsWith('*') || l.trim().startsWith('"')) {
                return l;
            }
            return l.replace(/([^ ])=>/g, '$1 =>').replace(/=>([^ ])/g, '=> $1')
                    .replace(/([^ ])->/g, '$1 ->').replace(/->([^ ])/g, '-> $1');
        }).join('\n');

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
        // Format C++ (using js-beautify's JS formatter which handles C-style syntax well)
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
        // Format C# (using js-beautify's JS formatter which handles C# well)
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

    // Lazy load dependencies
    const jsbeautify = require('js-beautify');

    // Validate Kotlin using custom resilient validator
    validationMessage = validateKotlin(text);

    /* eslint-disable */
    try {
        // Format Kotlin (using js-beautify's JS formatter which handles Kotlin well)
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
        vscode.window.showErrorMessage(`Failed to format Kotlin: ${error.message}`);
        return;
    }
    /* eslint-enable */

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

    // Validate Swift using custom resilient validator
    validationMessage = validateSwift(text);

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;
        let stateStack: ('STRING' | 'MULTILINE_STRING' | 'NORMAL')[] = ['NORMAL'];
        let blockCommentLevel = 0;
        // Tracking interpolation braces to return to STRING state
        const interpBraceStack: number[] = [];
        let currentTotalBraceDepth = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '' && stateStack[stateStack.length - 1] === 'NORMAL' && blockCommentLevel === 0) {
                formattedLines.push('');
                continue;
            }

            // Indentation adjustment for closing braces at the START of the line
            let leadingClosingCount = 0;
            if (blockCommentLevel === 0 && stateStack[stateStack.length - 1] === 'NORMAL') {
                let j = 0;
                while (j < trimmed.length && (trimmed[j] === '}' || trimmed[j] === ')' || trimmed[j] === ']')) {
                    leadingClosingCount++;
                    j++;
                }
            }

            if (leadingClosingCount > 0) {
                indentLevel = Math.max(0, indentLevel - leadingClosingCount);
            }

            // Apply indentation (Swift uses 4 spaces)
            let currentLine = (blockCommentLevel > 0 || stateStack[stateStack.length - 1] !== 'NORMAL')
                ? line
                : '    '.repeat(Math.max(0, indentLevel)) + trimmed;

            formattedLines.push(currentLine);

            // Calculate net brace change for NEXT line and track state
            let netChange = 0;
            const textToProcess = (blockCommentLevel > 0 || stateStack[stateStack.length - 1] !== 'NORMAL')
                ? line
                : trimmed.substring(leadingClosingCount);

            for (let k = 0; k < textToProcess.length; k++) {
                const char = textToProcess[k];
                const nextChar = textToProcess[k + 1];
                const nextNextChar = textToProcess[k + 2];
                const currentState = stateStack[stateStack.length - 1];

                if (blockCommentLevel > 0) {
                    if (char === '*' && nextChar === '/') {
                        blockCommentLevel--;
                        k++;
                    } else if (char === '/' && nextChar === '*') {
                        blockCommentLevel++;
                        k++;
                    }
                    continue;
                }

                if (currentState === 'MULTILINE_STRING') {
                    if (char === '"' && nextChar === '"' && nextNextChar === '"') {
                        stateStack.pop();
                        k += 2;
                    }
                    continue;
                }

                if (currentState === 'STRING') {
                    if (char === '\\') {
                        if (nextChar === '(') {
                            stateStack.push('NORMAL');
                            interpBraceStack.push(currentTotalBraceDepth - leadingClosingCount + netChange);
                            netChange++;
                            k++;
                        } else {
                            k++; // Escape sequence
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
                    k++;
                    continue;
                }
                if (char === '"' && nextChar === '"' && nextNextChar === '"') {
                    stateStack.push('MULTILINE_STRING');
                    k += 2;
                    continue;
                }
                if (char === '"') {
                    stateStack.push('STRING');
                    continue;
                }

                if (char === '{' || char === '(' || char === '[') {
                    netChange++;
                } else if (char === '}' || char === ')' || char === ']') {
                    if (char === ')' && interpBraceStack.length > 0 && (currentTotalBraceDepth - leadingClosingCount + netChange - 1) === interpBraceStack[interpBraceStack.length - 1]) {
                        interpBraceStack.pop();
                        stateStack.pop();
                    }
                    netChange--;
                }
            }

            currentTotalBraceDepth += (netChange - leadingClosingCount);
            indentLevel = Math.max(0, indentLevel + netChange);
        }
        formatted = formattedLines.join('\n');
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
