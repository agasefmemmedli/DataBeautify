import * as vscode from 'vscode';
import { applyEdit } from '../utils';

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
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let isMultiline = false;
        let lastWasEmpty = false;

        const instructions = new Set([
            'FROM', 'RUN', 'COPY', 'ADD', 'WORKDIR', 'EXPOSE', 'ENTRYPOINT',
            'CMD', 'ENV', 'ARG', 'LABEL', 'USER', 'VOLUME', 'STOPSIGNAL',
            'HEALTHCHECK', 'ONBUILD', 'MAINTAINER', 'SHELL'
        ]);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '') {
                if (!lastWasEmpty && formattedLines.length > 0) {
                    formattedLines.push('');
                    lastWasEmpty = true;
                }
                continue;
            }
            lastWasEmpty = false;

            if (trimmed.startsWith('#')) {
                formattedLines.push(trimmed);
                continue;
            }

            let currentLine = trimmed;
            if (!isMultiline) {
                // Check if line starts with an instruction
                const parts = trimmed.split(/\s+/);
                const firstWord = parts[0].toUpperCase();

                if (instructions.has(firstWord)) {
                    // Special handling for JSON array arguments in CMD and ENTRYPOINT
                    if ((firstWord === 'CMD' || firstWord === 'ENTRYPOINT') && /^\s*\[/.test(trimmed.substring(firstWord.length))) {
                         // Attempt to fix single quotes to double quotes for valid JSON
                         let args = trimmed.substring(firstWord.length).trim();
                         // Simple heuristic: if it looks like ['a', 'b'], replace ' with "
                         if (args.startsWith('[') && args.endsWith(']')) {
                         // Safer replacement: only replace single quotes if they wrap content WITHOUT quotes or backslashes
                         // e.g. ['a', 'b'] -> ["a", "b"]
                         // but ['a\'b'] -> unchanged
                         args = args.replace(/'([^'"\\]*)'/g, '"$1"');
                         }
                         currentLine = `${firstWord} ${args}`;
                    } else {
                        // Normalize instruction case
                        const rest = trimmed.substring(firstWord.length).trim();
                        currentLine = `${firstWord} ${rest}`;
                    }
                } else {
                    // Not a known instruction, maybe a continuation or unknown directive
                    // Keep as is, or uppercase first word if it looks like an instruction?
                    // Better keep as is to be safe.
                }

                formattedLines.push(currentLine);
            } else {
                // Indent multiline continuation
                formattedLines.push('    ' + trimmed);
            }

            // Check if this line ends with a backslash for multiline support
            isMultiline = trimmed.endsWith('\\');
        }

        // Pass 2: Ensure empty lines before FROM blocks and attach comments
        const finalLines = [...formattedLines];
        for (let i = 0; i < finalLines.length; i++) {
            if (finalLines[i].startsWith('FROM ')) {
                // Determine block start (include preceding attached comments)
                let j = i - 1;
                while (j >= 0) {
                    const line = finalLines[j];
                    if (line.trim().startsWith('#')) {
                        j--;
                    } else if (line.trim() === '') {
                        // Empty line breaks attachment
                        break;
                    } else {
                        // Other instruction breaks attachment
                        break;
                    }
                }
                const blockStart = j + 1;

                // Ensure empty line before blockStart (if not at very beginning)
                if (blockStart > 0) {
                     if (finalLines[blockStart - 1].trim() !== '') {
                         finalLines.splice(blockStart, 0, '');
                         i++; // Adjust index since we inserted a line
                     }
                }
            }
        }

        formatted = finalLines.join('\n');
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

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;
        let stateStack: ('STRING' | 'NORMAL')[] = ['NORMAL'];
        let quoteChar = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '' && stateStack[stateStack.length - 1] === 'NORMAL') {
                formattedLines.push('');
                continue;
            }

            // Indentation adjustment for closing characters at the START of the line
            let currentLineIndent = indentLevel;
            if (stateStack[stateStack.length - 1] === 'NORMAL') {
                let j = 0;
                while (j < trimmed.length) {
                    if (trimmed[j] === '}') {
                        currentLineIndent--;
                    } else if (trimmed[j] === ' ' || trimmed[j] === '\t') {
                        // Skip whitespace between closing braces
                    } else {
                        break;
                    }
                    j++;
                }
            }

            // Apply indentation (standard 4 spaces for Nginx)
            formattedLines.push('    '.repeat(Math.max(0, currentLineIndent)) + trimmed);

            // Calculate net brace change for NEXT line
            let netChange = 0;
            for (let k = 0; k < trimmed.length; k++) {
                const char = trimmed[k];
                const currentState = stateStack[stateStack.length - 1];

                if (currentState === 'STRING') {
                    if (char === '\\') {
                        k++;
                    } else if (char === quoteChar) {
                        stateStack.pop();
                    }
                    continue;
                }

                if (char === '#') {
                    break; // Line comment
                }

                if (char === '"' || char === "'") {
                    stateStack.push('STRING');
                    quoteChar = char;
                    continue;
                }

                if (char === '{') {
                    netChange++;
                } else if (char === '}') {
                    netChange--;
                }
            }

            indentLevel = Math.max(0, indentLevel + netChange);
        }
        formatted = formattedLines.join('\n');
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
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let inRecipe = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            if (trimmedLine === '') {
                formattedLines.push('');
                inRecipe = false;
                continue;
            }

            if (trimmedLine.startsWith('#')) {
                // Keep comments as they are but trim trailing whitespace
                formattedLines.push(line.trimEnd());
                continue;
            }

            // In Makefiles, any line starting with a tab is part of a recipe
            if (line.startsWith('\t')) {
                formattedLines.push('\t' + trimmedLine);
                inRecipe = true;
                continue;
            }

            // Not starting with a tab, so it's a top-level construct

            // Check for assignment: KEY op VALUE
            // ops: =, :=, ::=, +=, ?=, !=
            const assignmentMatch = trimmedLine.match(/^([a-zA-Z0-9._-]+)\s*(\?=|:=|::=|\+=|!=|=)\s*(.*)$/);
            if (assignmentMatch) {
                const [, key, op, value] = assignmentMatch;
                formattedLines.push(`${key} ${op} ${value.trim()}`);
                inRecipe = false;
                continue;
            }

            // Check for target definition: target: dependencies
            if (trimmedLine.includes(':')) {
                const colonIdx = trimmedLine.indexOf(':');
                const targetPart = trimmedLine.substring(0, colonIdx).trim();
                const depsPart = trimmedLine.substring(colonIdx + 1).trim();
                formattedLines.push(`${targetPart}: ${depsPart}`);
                inRecipe = true; // Subsequent indented lines are recipes
                continue;
            }

            // Directives (include, ifeq, etc.) or unknown
            // If it was indented but not with a tab, and we were in a recipe, maybe force it?
            // "Readability is King" - if it looks like a recipe line but missing a tab
            if (inRecipe && (line.startsWith(' ') || /^[a-z0-9]/i.test(trimmedLine))) {
                // This is risky if it's actually another target but without a colon (unlikely)
                // or a directive that the user forgot to unindent.
                // Let's stick to being safe: if it doesn't have a colon and we were in a recipe,
                // and it's not a known directive, assume it's a recipe.
                const directives = /^(include|sinclude|-include|ifdef|ifndef|ifeq|ifneq|else|endif|vpath|export|unexport|override|undefine|define|endef)\b/;
                if (!directives.test(trimmedLine)) {
                    formattedLines.push('\t' + trimmedLine);
                    continue;
                }
            }

            // Default fallback
            formattedLines.push(trimmedLine);
            inRecipe = false;
        }
        formatted = formattedLines.join('\n');
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

        if (trimmed === '' || trimmed.startsWith('#')) continue;

        if (line.startsWith(' ')) {
            // Makefile recipes MUST start with a TAB, not spaces
            return `Line ${i + 1} starts with spaces. Makefile recipes must start with a TAB character.`;
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

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;
        let inMultilineComment = false;
        let inHeredoc = false;
        let heredocDelimiter = '';
        let stateStack: ('STRING' | 'NORMAL')[] = ['NORMAL'];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '' && !inMultilineComment && !inHeredoc && stateStack[stateStack.length - 1] === 'NORMAL') {
                formattedLines.push('');
                continue;
            }

            // Handle Multiline Comments
            if (inMultilineComment) {
                formattedLines.push(line);
                if (trimmed.includes('*/')) {
                    inMultilineComment = false;
                }
                continue;
            }

            // Handle Heredocs
            if (inHeredoc) {
                formattedLines.push(line);
                if (trimmed === heredocDelimiter) {
                    inHeredoc = false;
                }
                continue;
            }

            // Indentation adjustment for closing characters at the START of the line
            let leadingClosingCount = 0;
            if (stateStack[stateStack.length - 1] === 'NORMAL') {
                let j = 0;
                while (j < trimmed.length && (trimmed[j] === '}' || trimmed[j] === ']' || trimmed[j] === ')')) {
                    leadingClosingCount++;
                    j++;
                }
            }

            if (leadingClosingCount > 0) {
                indentLevel = Math.max(0, indentLevel - leadingClosingCount);
            }

            // Apply indentation (HCL uses 2 spaces)
            formattedLines.push('  '.repeat(Math.max(0, indentLevel)) + trimmed);

            // Calculate net brace change for NEXT line
            let netChange = 0;
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
                    break; // Line comment
                }

                if (char === '/' && nextChar === '*') {
                    inMultilineComment = true;
                    k++;
                    continue;
                }

                if (char === '<' && nextChar === '<') {
                    // Potential heredoc
                    const remaining = trimmed.substring(k);
                    const heredocMatch = remaining.match(/^<<-?\s*([A-Z0-9_]+)/i);
                    if (heredocMatch) {
                        inHeredoc = true;
                        heredocDelimiter = heredocMatch[1];
                        break;
                    }
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
            } else if (char === '}' || char === ']' || char === ')') {
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

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();

            if (line === '') {
                formattedLines.push('');
                continue;
            }

            // Comments
            if (line.startsWith('#') || line.startsWith(';')) {
                formattedLines.push(line);
                continue;
            }

            // Sections [section "subsection"]
            if (line.startsWith('[')) {
                formattedLines.push(line);
                continue;
            }

            // Key-Value pairs
            if (/^[a-z0-9-]+\s*=/i.test(line)) {
                formattedLines.push('\t' + line);
            } else {
                formattedLines.push('\t' + line);
            }
        }
        formatted = formattedLines.join('\n');
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
    const lines = text.split('\n');
    let inSection = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '' || line.startsWith('#') || line.startsWith(';')) continue;

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

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let inSection = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '') {
                // Only push empty line if the previous one wasn't empty
                if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                    formattedLines.push('');
                }
                continue;
            }

            // Comments
            if (trimmed.startsWith('#') || trimmed.startsWith(';')) {
                // Comments are usually aligned with the content
                const indent = inSection ? '  ' : '';
                formattedLines.push(indent + trimmed);
                continue;
            }

            // Sections [section]
            if (trimmed.startsWith('[')) {
                // Ensure empty line before section if not at start
                if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                    formattedLines.push('');
                }
                formattedLines.push(trimmed);
                inSection = true;
                continue;
            }

            // Key-Value pairs: key = value
            const equalIndex = trimmed.indexOf('=');
            if (equalIndex !== -1) {
                const key = trimmed.substring(0, equalIndex).trim();
                const value = trimmed.substring(equalIndex + 1).trim();
                // Indent properties by 2 spaces if inside a section
                const indent = inSection ? '  ' : '';
                formattedLines.push(`${indent}${key} = ${value}`);
                continue;
            }

            // Fallback
            const indent = inSection ? '  ' : '';
            formattedLines.push(indent + trimmed);
        }
        formatted = formattedLines.join('\n');
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

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];

        // Common timestamp patterns
        const timestampRegex = /^\[?(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}|\d{2}:\d{2}:\d{2}|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\]?/;
        const logLevelRegex = /\b(INFO|DEBUG|WARN|WARNING|ERROR|FATAL|TRACE|CRITICAL)\b/i;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '') {
                formattedLines.push('');
                continue;
            }

            const tsMatch = line.match(timestampRegex);
            if (tsMatch) {
                // It's a new log entry
                let processedLine = line;

                // Align log level if present
                const levelMatch = processedLine.match(logLevelRegex);
                if (levelMatch) {
                    const level = levelMatch[1].toUpperCase();
                    const paddedLevel = `[${level.padEnd(7)}]`;
                    processedLine = processedLine.replace(levelMatch[0], paddedLevel);
                }

                formattedLines.push(processedLine.trimEnd());
            } else {
                // It's a continuation line (e.g., stack trace)
                // Indent by 4 spaces if it's not already indented or doesn't look like a log start
                if (!line.startsWith('    ') && !line.startsWith('\t')) {
                    formattedLines.push('    ' + trimmed);
                } else {
                    formattedLines.push(line.trimEnd());
                }
            }
        }
        formatted = formattedLines.join('\n');
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
    const timestampRegex = /\[?(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}|\d{2}:\d{2}:\d{2}|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\]?/;

    for (let i = 0; i < Math.min(lines.length, 10); i++) {
        const line = lines[i].trim();
        if (line === '') continue;

        if (timestampRegex.test(line)) {
            return undefined; // Found at least one valid log line
        }
    }

    return 'No recognized timestamp patterns found in the first few lines.';
}
