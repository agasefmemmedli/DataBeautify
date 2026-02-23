import * as vscode from 'vscode';
import { applyEdit } from '../utils';
import { formatDockerfileDeep } from './dockerfile_deep_formatter';
import { formatPropertiesDeep } from './properties_deep_formatter';
import { formatMakefileDeep } from './makefile_deep_formatter';
import { formatNginxDeep } from './nginx_deep_formatter';
import { formatGitConfigDeep } from './gitconfig_deep_formatter';
import { formatEditorConfigDeep } from './editorconfig_deep_formatter';
import { formatLogDeep } from './log_deep_formatter';

/**
 * Handle Dockerfile formatting and validation
 */
export async function handleDockerfile(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Dockerfile
    validationMessage = validateDockerfile(text);

    // Deep formatting logic
    try {
        formatted = formatDockerfileDeep(text);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Dockerfile: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Dockerfile has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Dockerfile formatted successfully!');
    }
}

/**
 * Validate Dockerfile code for basic issues
 */
function validateDockerfile(text: string): string | undefined {
    const lines = text.split('\n');
    let hasFrom = false;
    let hasArg = false;
    let inQuotes = false;
    let quoteChar = '';

    const instructions = new Set([
        'FROM', 'RUN', 'COPY', 'ADD', 'WORKDIR', 'EXPOSE', 'ENTRYPOINT',
        'CMD', 'ENV', 'ARG', 'LABEL', 'USER', 'VOLUME', 'STOPSIGNAL',
        'HEALTHCHECK', 'ONBUILD', 'MAINTAINER', 'SHELL'
    ]);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '' || trimmed.startsWith('#')) continue;

        // Check for unclosed quotes
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if ((char === '"' || char === "'") && (j === 0 || line[j - 1] !== '\\')) {
                if (!inQuotes) {
                    inQuotes = true;
                    quoteChar = char;
                } else if (char === quoteChar) {
                    inQuotes = false;
                }
            }
        }

        const firstWord = trimmed.split(/\s+/)[0].toUpperCase();
        if (instructions.has(firstWord)) {
            if (firstWord === 'FROM') hasFrom = true;
            if (firstWord === 'ARG') hasArg = true;

            const rest = trimmed.substring(firstWord.length).trim();
            if (rest === '' && !trimmed.endsWith('\\')) {
                return `Instruction '${firstWord}' has no arguments at line ${i + 1}`;
            }
        }
    }

    if (inQuotes) {
        return "Unclosed string literal";
    }

    if (!hasFrom && !hasArg && text.trim().length > 0) {
        // Technically ARG can precede FROM, but a Dockerfile must have FROM eventually.
        // If we have ARG but no FROM, it's weird but maybe incomplete.
        // Let's stick to requiring FROM if content exists.
        if (!hasFrom) return "Dockerfile should start with a 'FROM' instruction (ARG is allowed before FROM)";
    }

    return undefined;
}

/**
 * Handle Nginx formatting and validation
 */
export async function handleNginx(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Nginx
    validationMessage = validateNginx(text);

    // Deep Formatting Logic
    try {
        formatted = formatNginxDeep(text);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Nginx: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Nginx configuration has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Nginx configuration formatted successfully!');
    }
}

/**
 * Custom resilient Nginx validator
 */
function validateNginx(text: string): string | undefined {
    let braceLevel = 0;
    let inString = false;
    let quoteChar = '';

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];

            if (inString) {
                if (char === '\\') {
                    j++;
                } else if (char === quoteChar) {
                    inString = false;
                }
                continue;
            }

            if (char === '#') {
                break; // Line comment
            }

            if (char === '"' || char === "'") {
                inString = true;
                quoteChar = char;
                continue;
            }

            if (char === '{') {
                braceLevel++;
            } else if (char === '}') {
                braceLevel--;
                if (braceLevel < 0) {
                    return `Extra closing brace at line ${i + 1}, col ${j + 1}`;
                }
            }
        }
    }

    if (braceLevel > 0) {
        return `Missing ${braceLevel} closing brace(s)`;
    }
    if (inString) {
        return `Unclosed string literal`;
    }

    return undefined;
}

/**
 * Handle Makefile formatting and validation
 */
export async function handleMakefile(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Makefile
    validationMessage = validateMakefile(text);

    // Resilient formatting logic
    try {
        formatted = formatMakefileDeep(text);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Makefile: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Makefile has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Makefile formatted successfully!');
    }
}


/**
 * Custom resilient Makefile validator
 */
function validateMakefile(text: string): string | undefined {
    const lines = text.split('\n');
    let hasTarget = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith(';')) continue;

        if (line.startsWith(' ')) {
            // We relax this check because continuations start with space
            // Only check if it looks like a recipe start (no colon, no assignment)
            if (!trimmed.includes(':') && !trimmed.includes('=')) {
                // Might be continuation?
                if (i > 0 && lines[i-1].trim().endsWith('\\')) continue;

                // Also check if we are inside define/endef which allows anything
                // But that requires state tracking.
                // Let's assume if it doesn't look like target or assignment, and has spaces, it MIGHT be a recipe error.
                // But standard makefile allows spaces for directives/comments indentation (which we support now).
                // So strictly enforcing TAB for recipes is good, but complaining about ANY space start line is bad if it's not a recipe.

                // If the previous line was a target, then this line expects a TAB.
                // But we don't track previous line here easily.

                // Let's keep the original check but be aware it might flag indented conditionals as errors?
                // "Line X starts with spaces..."
                // If I indent `ifeq`, it starts with spaces.
                // So I MUST update validateMakefile to allow indented directives.

                const directives = /^(ifeq|ifneq|ifdef|ifndef|else|endif|define|endef|include|-include|sinclude|vpath|export|unexport|override|undefine)\b/;
                if (directives.test(trimmed)) {
                    continue; // Allowed to be indented
                }

                return `Line ${i + 1} starts with spaces. Makefile recipes must start with a TAB character.`;
            }
        }

        if (trimmed.includes(':')) {
            if (line.startsWith('\t')) {
                // This might be okay if it's a command that happens to have a colon,
                // but usually targets shouldn't be indented.
            } else {
                hasTarget = true;
            }
        }

        if (line.startsWith('\t') && !hasTarget) {
            return `Recipe at line ${i + 1} defined before any target.`;
        }
    }

    if (!hasTarget && text.trim().length > 0) {
        // A Makefile without targets might be just variables, which is technically okay but often a sign of incompleteness if intended as a script.
        // But let's be lenient.
    }

    return undefined;
}

/**
 * Handle Terraform/HCL formatting and validation
 */
export async function handleHCL(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate HCL using custom resilient validator
    validationMessage = validateHCL(text);

    // Resilient Deep Formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;
        let inMultilineComment = false;
        let inHeredoc = false;
        let heredocDelimiter = '';
        let stateStack: ('STRING' | 'NORMAL')[] = ['NORMAL'];

        // Structure to hold lines for alignment
        let blockBuffer: { lineIndex: number, text: string, indent: number }[] = [];

        function flushBlockBuffer() {
            if (blockBuffer.length === 0) return;

            // Group by indentation level
            // This is crucial: we align only lines with the same indentation level
            // But we must process them in order.
            // If the indentation level changes, we break the alignment group.

            let currentGroup: { lineIndex: number, text: string, indent: number }[] = [];
            let currentIndent = -1;

            // Helper to process a group
            const processGroup = (group: typeof currentGroup) => {
                if (group.length === 0) return;

                // Find max key length for alignment
                let maxKeyLen = 0;
                const parsedGroup = group.map(item => {
                    const trimmed = item.text.trim();
                    if (trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
                        return { ...item, key: null, value: trimmed, isAssignment: false };
                    }

                    // Regex for assignment: key = value
                    // Handles quoted keys: "key" = val
                    // Handles unquoted keys: key = val
                    const assignmentMatch = trimmed.match(/^((?:"[^"]+")|(?:[a-zA-Z0-9_-]+))\s*=([\s\S]*)$/);

                    if (assignmentMatch) {
                        const key = assignmentMatch[1];
                        return { ...item, key: key, value: assignmentMatch[2].trim(), isAssignment: true };
                    }

                    return { ...item, key: null, value: trimmed, isAssignment: false };
                });

                // Calculate max key length
                for (const p of parsedGroup) {
                    if (p.isAssignment && p.key) {
                        if (p.key.length > maxKeyLen) {
                            maxKeyLen = p.key.length;
                        }
                    }
                }

                // Format lines
                for (const p of parsedGroup) {
                    const indentStr = '  '.repeat(p.indent);
                    if (p.isAssignment && p.key) {
                        const padding = ' '.repeat(maxKeyLen - p.key.length);
                        formattedLines.push(`${indentStr}${p.key}${padding} = ${p.value}`);
                    } else {
                        formattedLines.push(`${indentStr}${p.value}`);
                    }
                }
            };

            for (const item of blockBuffer) {
                if (currentIndent === -1) {
                    currentIndent = item.indent;
                }

                if (item.indent !== currentIndent) {
                    processGroup(currentGroup);
                    currentGroup = [];
                    currentIndent = item.indent;
                }
                currentGroup.push(item);
            }
            processGroup(currentGroup);
            blockBuffer = [];
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // If inside a multiline string (from previous lines), preserve indentation
            if (stateStack[stateStack.length - 1] === 'STRING') {
                if (blockBuffer.length > 0) {
                     blockBuffer[blockBuffer.length - 1].text += '\n' + line;
                } else {
                     formattedLines.push(line);
                }

                // Check for end of string
                // Need to parse character by character to handle escapes
                for (let k = 0; k < line.length; k++) {
                    const char = line[k];
                    if (char === '\\') {
                        k++;
                    } else if (char === '"') {
                        stateStack.pop();
                        // If stack empty (unlikely with just STRING/NORMAL, usually base is NORMAL), revert to NORMAL
                        if (stateStack.length === 0) stateStack.push('NORMAL');
                    }
                }
                continue;
            }

            if (inHeredoc) {
                flushBlockBuffer(); // Ensure previous assignment is written
                formattedLines.push(line);
                if (trimmed === heredocDelimiter) {
                    inHeredoc = false;
                }
                continue;
            }

            if (inMultilineComment) {
                flushBlockBuffer();
                formattedLines.push(line);
                if (trimmed.includes('*/')) {
                    inMultilineComment = false;
                }
                continue;
            }

            if (trimmed === '') {
                flushBlockBuffer();
                formattedLines.push('');
                continue;
            }

            // Check for multiline comment start
            if (trimmed.startsWith('/*')) {
                flushBlockBuffer();
                formattedLines.push(line); // Preserve as is
                if (!trimmed.includes('*/')) {
                    inMultilineComment = true;
                }
                continue;
            }

            // Check for heredoc start in this line
            // Only if not a comment
            if (!trimmed.startsWith('#') && !trimmed.startsWith('//')) {
                const heredocMatch = trimmed.match(/<<-?\s*([A-Z0-9_]+)/i);
                if (heredocMatch) {
                    inHeredoc = true;
                    heredocDelimiter = heredocMatch[1];
                }
            }

            // Calculate indentation changes
            // Scan line for braces, taking care of strings
            let netChange = 0;

            // Pre-calculate indent for this line (closing braces de-indent immediately)
            let leadingClosingCount = 0;
            if (!trimmed.startsWith('#') && !trimmed.startsWith('//')) {
                let j = 0;
                while (j < trimmed.length && (trimmed[j] === '}' || trimmed[j] === ']' || trimmed[j] === ')')) {
                    leadingClosingCount++;
                    j++;
                }
            }

            const currentIndent = Math.max(0, indentLevel - leadingClosingCount);

            // Buffer the line for alignment processing

            let isBlockStart = false;
            // Check if line ends with { (ignoring comments)
            let codePart = trimmed;
            const commentIdx = Math.min(
                codePart.indexOf('#') === -1 ? Infinity : codePart.indexOf('#'),
                codePart.indexOf('//') === -1 ? Infinity : codePart.indexOf('//')
            );
            if (commentIdx !== Infinity) {
                codePart = codePart.substring(0, commentIdx).trim();
            }

            if (codePart.endsWith('{')) {
                isBlockStart = true;
            }

            if (leadingClosingCount > 0) {
                 flushBlockBuffer();
                 formattedLines.push('  '.repeat(currentIndent) + trimmed);
            } else if (isBlockStart) {
                 // Check if it's an assignment block (e.g. tags = {)
                 const assignmentBlockMatch = trimmed.match(/^((?:"[^"]+")|(?:[a-zA-Z0-9_-]+))\s*=\s*\{$/);
                 if (assignmentBlockMatch) {
                     // It is an assignment, so buffer it to align with others
                     blockBuffer.push({ lineIndex: i, text: trimmed, indent: currentIndent });
                 } else {
                     // Standard block header, flush and print
                     flushBlockBuffer();
                     // Normalize brace spacing
                     let lineToPrint = trimmed;
                     if (lineToPrint.endsWith('{')) {
                         const braceIdx = lineToPrint.lastIndexOf('{');
                         if (braceIdx > 0) {
                             const charBefore = lineToPrint[braceIdx - 1];
                             if (charBefore === '(' || charBefore === '[') {
                                 // Ensure NO space before { if preceded by ( or [
                                 lineToPrint = lineToPrint.replace(/\s*\{\s*$/, '{');
                             } else {
                                 // Ensure ONE space before { otherwise
                                 lineToPrint = lineToPrint.replace(/\s*\{\s*$/, ' {');
                             }
                         }
                     }
                     formattedLines.push('  '.repeat(currentIndent) + lineToPrint);
                 }
            } else {
                 // It's likely an assignment or comment or function call
                 blockBuffer.push({ lineIndex: i, text: trimmed, indent: currentIndent });
            }

            // Update indentLevel for NEXT line
            for (let k = 0; k < trimmed.length; k++) {
                const char = trimmed[k];
                const nextChar = trimmed[k + 1];
                const currentState = stateStack[stateStack.length - 1];

                if (currentState === 'STRING') {
                    if (char === '\\') {
                        k++;
                    } else if (char === '"') {
                        stateStack.pop();
                    }
                    continue;
                }

                if (char === '#' || (char === '/' && nextChar === '/')) {
                    break;
                }
                if (char === '/' && nextChar === '*') {
                    break;
                }

                if (char === '"') {
                    stateStack.push('STRING');
                    continue;
                }

                if (char === '{' || char === '[' || char === '(') {
                    netChange++;
                } else if (char === '}' || char === ']' || char === ')') {
                    netChange--;
                }
            }
            indentLevel = Math.max(0, indentLevel + netChange);
        }

        flushBlockBuffer(); // Final flush

        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Terraform/HCL: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Terraform/HCL has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Terraform/HCL formatted successfully!');
    }
}

/**
 * Custom resilient HCL validator
 */
function validateHCL(text: string): string | undefined {
    const stack: { char: string, line: number, col: number }[] = [];
    let stateStack: ('STRING' | 'NORMAL')[] = ['NORMAL'];
    let inMultilineComment = false;
    let inHeredoc = false;
    let heredocDelimiter = '';
    const interpStack: number[] = [];

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (inHeredoc) {
            if (trimmed === heredocDelimiter) {
                inHeredoc = false;
            }
            continue;
        }

        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];
            const currentState = stateStack[stateStack.length - 1];

            if (inMultilineComment) {
                if (char === '*' && nextChar === '/') {
                    inMultilineComment = false;
                    j++;
                }
                continue;
            }

            if (currentState === 'STRING') {
                if (char === '\\') {
                    j++;
                } else if (char === '$' && nextChar === '{') {
                    stateStack.push('NORMAL');
                    interpStack.push(stack.length);
                    stack.push({ char: '{', line: i + 1, col: j + 2 });
                    j++;
                } else if (char === '"') {
                    stateStack.pop();
                }
                continue;
            }

            if (char === '#' || (char === '/' && nextChar === '/')) {
                break; // Line comment
            }

            if (char === '/' && nextChar === '*') {
                inMultilineComment = true;
                j++;
                continue;
            }

            if (char === '<' && nextChar === '<') {
                const remaining = line.substring(j);
                const heredocMatch = remaining.match(/^<<-?\s*([A-Z0-9_]+)/i);
                if (heredocMatch) {
                    inHeredoc = true;
                    heredocDelimiter = heredocMatch[1];
                    j = line.length;
                    continue;
                }
            }

            if (char === '"') {
                stateStack.push('STRING');
                continue;
            }

            if (char === '{' || char === '[' || char === '(') {
                stack.push({ char, line: i + 1, col: j + 1 });
            } else if (char === '}' || char === ')' || char === ']') {
                if (stack.length === 0) {
                    return `Unexpected closing character '${char}' at line ${i + 1}, col ${j + 1}`;
                }
                const last = stack.pop()!;
                if ((char === '}' && last.char !== '{') ||
                    (char === ']' && last.char !== '[') ||
                    (char === ')' && last.char !== '(')) {
                    return `Mismatched closing character '${char}' at line ${i + 1}, col ${j + 1} (expected closure for '${last.char}' from line ${last.line}, col ${last.col})`;
                }
                if (char === '}' && interpStack.length > 0 && stack.length === interpStack[interpStack.length - 1]) {
                    interpStack.pop();
                    stateStack.pop();
                }
            }
        }
    }

    if (inMultilineComment) return "Unclosed multiline comment";
    if (inHeredoc) return "Unclosed heredoc";
    if (stateStack.pop() === 'STRING') return "Unclosed string literal";
    if (stack.length > 0) {
        const last = stack.pop()!;
        return `Unclosed '${last.char}' from line ${last.line}, col ${last.col}`;
    }

    return undefined;
}

/**
 * Handle Git Config formatting and validation
 */
export async function handleGitConfig(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Git Config
    validationMessage = validateGitConfig(text);

    // Resilient Deep Formatting logic
    try {
        formatted = formatGitConfigDeep(text);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Git Config: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Git Config has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Git Config formatted successfully!');
    }
}

/**
 * Custom resilient Git Config validator
 */
function validateGitConfig(text: string): string | undefined {
    const lines = text.split(/\r?\n/);
    let inSection = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '' || line.startsWith('#') || line.startsWith(';')) continue;

        if (line.startsWith('[')) {
            if (!line.endsWith(']')) {
                // Check for inline comments
                const commentIdx = Math.min(
                    line.indexOf('#') === -1 ? Infinity : line.indexOf('#'),
                    line.indexOf(';') === -1 ? Infinity : line.indexOf(';')
                );

                if (commentIdx !== Infinity) {
                    const beforeComment = line.substring(0, commentIdx).trim();
                    if (!beforeComment.endsWith(']')) {
                         return `Unclosed section header at line ${i + 1}`;
                    }
                } else {
                    return `Unclosed section header at line ${i + 1}`;
                }
            }
            inSection = true;
            continue;
        }

        let quoteCount = 0;
        let escape = false;
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (escape) {
                escape = false;
                continue;
            }
            if (char === '\\') {
                escape = true;
                continue;
            }
            if (char === '"') {
                quoteCount++;
            }
        }

        if (quoteCount % 2 !== 0) {
            // Unclosed quote, unless it's multiline?
            // If multiline ends with \, valid?
            if (!line.endsWith('\\')) {
                 return `Unclosed quote at line ${i + 1}`;
            }
        }
    }
    return undefined;
}

/**
 * Handle EditorConfig formatting and validation
 */
export async function handleEditorConfig(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate EditorConfig
    validationMessage = validateEditorConfig(text);

    // Deep Formatting logic
    try {
        formatted = formatEditorConfigDeep(text);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format EditorConfig: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`EditorConfig has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('EditorConfig formatted successfully!');
    }
}

/**
 * Custom resilient EditorConfig validator
 */
function validateEditorConfig(text: string): string | undefined {
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '' || line.startsWith('#') || line.startsWith(';')) continue;

        // Check for sections
        if (line.startsWith('[')) {
            if (!line.endsWith(']')) {
                const commentIdx = Math.min(
                    line.indexOf('#') === -1 ? Infinity : line.indexOf('#'),
                    line.indexOf(';') === -1 ? Infinity : line.indexOf(';')
                );

                if (commentIdx !== Infinity) {
                    const beforeComment = line.substring(0, commentIdx).trim();
                    if (!beforeComment.endsWith(']')) {
                         return `Unclosed section header at line ${i + 1}`;
                    }
                } else {
                    return `Unclosed section header at line ${i + 1}`;
                }
            }
            continue;
        }

        // Check for key = value
        if (line.indexOf('=') === -1) {
             return `Invalid property definition at line ${i + 1} (missing '=')`;
        }
    }
    return undefined;
}

/**
 * Handle Log file formatting and validation
 */
export async function handleLog(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Log
    validationMessage = validateLog(text);

    // Resilient Deep Formatting logic
    try {
        formatted = formatLogDeep(text);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Log: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Log file has potential issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Log file formatted successfully!');
    }
}

/**
 * Custom resilient Log validator
 */
function validateLog(text: string): string | undefined {
    const lines = text.split('\n');
    // Enhanced regex for validation
    const timestampRegex = /(\[?(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}|\d{2}:\d{2}:\d{2}|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\]?)/;

    for (let i = 0; i < Math.min(lines.length, 20); i++) {
        const line = lines[i].trim();
        if (line === '') continue;

        if (timestampRegex.test(line)) {
            return undefined; // Found at least one valid log line
        }
    }

    return 'No recognized timestamp patterns found in the first few lines.';
}

/**
 * Handle Properties formatting and validation
 */
export async function handleProperties(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Properties
    validationMessage = validateProperties(text);

    // Deep Formatting logic
    try {
        formatted = formatPropertiesDeep(text);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Properties: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Properties file has potential issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Properties file formatted successfully!');
    }
}

/**
 * Custom resilient Properties validator
 */
function validateProperties(text: string): string | undefined {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('!')) {
            continue;
        }

        // No strict validation for properties as almost anything is valid key
    }
    return undefined;
}
