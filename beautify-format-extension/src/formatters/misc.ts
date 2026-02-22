import * as vscode from 'vscode';
import { applyEdit } from '../utils';
import { formatDockerfileDeep } from './dockerfile_deep_formatter';
import { formatPropertiesDeep } from './properties_deep_formatter';

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
        const lines = text.split('\n');
        let tokens: string[] = [];

        // Robust Tokenizer
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            // Preserve full-line comments immediately
            if (line.startsWith('#')) {
                // If we have previous tokens and the last one wasn't a structural delimiter or comment,
                // we might need to handle it carefully.
                // But generally, full line comments are standalone tokens.
                tokens.push(line);
                continue;
            }

            let currentToken = '';
            let inString = false;
            let quoteChar = '';

            for (let i = 0; i < line.length; i++) {
                const char = line[i];

                if (inString) {
                    currentToken += char;
                    if (char === '\\') {
                        i++;
                        if (i < line.length) currentToken += line[i];
                    } else if (char === quoteChar) {
                        inString = false;
                    }
                    continue;
                }

                if (char === '#') {
                    if (currentToken.trim()) tokens.push(currentToken.trim());
                    currentToken = '';
                    // Rest of line is a comment token
                    tokens.push(line.substring(i).trim());
                    break;
                }

                if (char === '{' || char === '}' || char === ';') {
                    if (currentToken.trim()) tokens.push(currentToken.trim());
                    tokens.push(char);
                    currentToken = '';
                } else if (/\s/.test(char)) {
                    if (currentToken.trim()) {
                        tokens.push(currentToken.trim());
                        currentToken = '';
                    }
                } else if (char === '"' || char === "'") {
                    if (currentToken.trim()) {
                        tokens.push(currentToken.trim());
                        currentToken = '';
                    }
                    inString = true;
                    quoteChar = char;
                    currentToken += char;
                } else {
                    currentToken += char;
                }
            }
            if (currentToken.trim()) tokens.push(currentToken.trim());
        }

        // Reconstruction
        const formattedLines: string[] = [];
        let indentLevel = 0;
        let currentLine = '';

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            if (token === '}') {
                if (currentLine.trim()) formattedLines.push('    '.repeat(indentLevel) + currentLine.trim());
                currentLine = '';
                indentLevel = Math.max(0, indentLevel - 1);
                formattedLines.push('    '.repeat(indentLevel) + '}');
                continue;
            }

            if (token === '{') {
                currentLine = currentLine.trim() + ' {';
                formattedLines.push('    '.repeat(indentLevel) + currentLine);
                currentLine = '';
                indentLevel++;
                continue;
            }

            if (token === ';') {
                currentLine = currentLine.trim() + ';';
                formattedLines.push('    '.repeat(indentLevel) + currentLine);
                currentLine = '';
                continue;
            }

            if (token.startsWith('#')) {
                if (currentLine.trim()) {
                    // Inline comment
                    formattedLines.push('    '.repeat(indentLevel) + currentLine.trim() + ' ' + token);
                    currentLine = '';
                } else {
                    // Standalone comment
                    formattedLines.push('    '.repeat(indentLevel) + token);
                }
                continue;
            }

            // Directive or Argument
            if (currentLine === '') {
                // Start of new line
                // Insert blank lines before major blocks if they are not the first thing in a block
                const majorDirectives = ['http', 'server', 'events', 'location', 'upstream', 'types', 'map', 'geo'];
                if (majorDirectives.includes(token)) {
                    if (formattedLines.length > 0 && !formattedLines[formattedLines.length - 1].trim().endsWith('{')) {
                        // Avoid double empty lines
                        if (formattedLines[formattedLines.length - 1] !== '') {
                             formattedLines.push('');
                        }
                    }
                }
                currentLine = token;
            } else {
                currentLine += ' ' + token;
            }
        }

        if (currentLine.trim()) {
            formattedLines.push('    '.repeat(indentLevel) + currentLine.trim());
        }

        formatted = formattedLines.join('\n');

        // Final polish: remove triple newlines if any slipped through
        formatted = formatted.replace(/\n\n\n+/g, '\n\n');

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
 * Helper: Format Makefile Logic (Deep Formatting)
 */
function formatMakefileDeep(text: string): string {
    const lines = text.split('\n');
    const formattedLines: string[] = [];

    // State
    let indentLevel = 0;
    let blockBuffer: { text: string, indent: number }[] = []; // For aligning assignments
    let inRecipe = false;
    let lastLineWasEmpty = false;

    // Helper to flush assignment buffer
    function flushBuffer() {
        if (blockBuffer.length === 0) return;

        // Find max key length
        let maxKeyLen = 0;
        const parsed = blockBuffer.map(item => {
            const trimmed = item.text.trim();
            // Regex for assignment: key op value
            // Ignore comments for key calculation if they are full line comments
            if (trimmed.startsWith('#')) return { item, isAssignment: false, key: '', op: '', val: '' };

            // We need to match key op value from the FIRST line of item.text (if continuations exist)
            const firstLine = item.text.split('\n')[0];
            const match = firstLine.trim().match(/^([a-zA-Z0-9._-]+)\s*(\?=|:=|::=|\+=|!=|=)\s*(.*)$/);
            if (match) {
                return { item, isAssignment: true, key: match[1], op: match[2], val: match[3] };
            }
            return { item, isAssignment: false, key: '', op: '', val: '' };
        });

        parsed.forEach(p => {
            if (p.isAssignment && p.key.length > maxKeyLen) {
                maxKeyLen = p.key.length;
            }
        });

        // Output lines
        parsed.forEach(p => {
            const indentStr = '  '.repeat(p.item.indent);
            if (p.isAssignment) {
                const padding = ' '.repeat(maxKeyLen - p.key.length);

                // Reconstruct assignment with alignment
                const parts = p.item.text.split('\n');
                const firstLine = parts[0];
                const rest = parts.slice(1);

                const match = firstLine.trim().match(/^([a-zA-Z0-9._-]+)\s*(\?=|:=|::=|\+=|!=|=)\s*(.*)$/);
                if (match) {
                    const val = match[3].trim();
                    let result = `${indentStr}${p.key}${padding} ${p.op} ${val}`;
                    if (rest.length > 0) {
                        result += '\n' + rest.join('\n');
                    }
                    formattedLines.push(result);
                } else {
                    formattedLines.push(p.item.text);
                }
            } else {
                formattedLines.push(`${indentStr}${p.item.text.trim()}`);
            }
        });

        blockBuffer = [];
    }

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let trimmed = line.trim();

        // Handle empty lines
        if (trimmed === '') {
            flushBuffer();
            if (!lastLineWasEmpty && formattedLines.length > 0) {
                formattedLines.push('');
                lastLineWasEmpty = true;
            }
            inRecipe = false;
            continue;
        }
        lastLineWasEmpty = false;

        // Handle Comments
        if (trimmed.startsWith('#')) {
            flushBuffer();
            // Align comment with current indentation
            formattedLines.push('  '.repeat(indentLevel) + trimmed);
            continue;
        }

        // Handle Recipes (must start with tab)
        if (line.startsWith('\t')) {
            flushBuffer();
            formattedLines.push('\t' + trimmed);
            inRecipe = true;
            continue;
        }

        // Handle Directives
        const directiveMatch = trimmed.match(/^(ifeq|ifneq|ifdef|ifndef|else|endif|define|endef|include|-include|sinclude|vpath|export|unexport|override|undefine)\b/);

        if (directiveMatch) {
            flushBuffer();
            const directive = directiveMatch[1];

            if (directive === 'else') {
                const currentIndent = Math.max(0, indentLevel - 1);
                formattedLines.push('  '.repeat(currentIndent) + trimmed);
            } else if (directive === 'endif' || directive === 'endef') {
                indentLevel = Math.max(0, indentLevel - 1);
                formattedLines.push('  '.repeat(indentLevel) + trimmed);
            } else {
                formattedLines.push('  '.repeat(indentLevel) + trimmed);
                if (directive.startsWith('if') || directive === 'define') {
                    indentLevel++;
                }
            }
            inRecipe = false;
            continue;
        }

        // Handle Targets (target: ...)
        if (trimmed.includes(':') && !trimmed.includes('=')) {
            flushBuffer();

            // Ensure empty line before target if not first line AND previous line was NOT a comment
            if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                const lastLine = formattedLines[formattedLines.length - 1];
                if (!lastLine.trim().startsWith('#')) {
                    formattedLines.push('');
                }
            }

            formattedLines.push('  '.repeat(indentLevel) + trimmed);
            inRecipe = true;
            continue;
        }

        // Handle Assignments (buffer for alignment)
        const assignmentMatch = trimmed.match(/^([a-zA-Z0-9._-]+)\s*(\?=|:=|::=|\+=|!=|=)\s*(.*)$/);
        if (assignmentMatch) {
            // Buffer it
            let currentText = line;

            // Check for line continuation
            if (trimmed.endsWith('\\')) {
                let j = i + 1;
                while (j < lines.length) {
                    const nextLine = lines[j];
                    const nextTrimmed = nextLine.trim();
                    // Indent continuation relative to variable (usually 4 spaces)
                    currentText += '\n' + (indentLevel > 0 ? '  '.repeat(indentLevel + 2) : '    ') + nextTrimmed;
                    i++;
                    if (!nextTrimmed.endsWith('\\')) {
                        break;
                    }
                    j++;
                }
            }

            blockBuffer.push({ text: currentText, indent: indentLevel });
            inRecipe = false;
            continue;
        }

        // Fallback (Recipe without tab? Continuation?)
        if (inRecipe) {
            flushBuffer();
            formattedLines.push('\t' + trimmed);
            continue;
        }

        flushBuffer();
        formattedLines.push('  '.repeat(indentLevel) + trimmed);
    }

    flushBuffer();
    return formattedLines.join('\n');
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
                     if (!lineToPrint.endsWith(' {')) {
                         lineToPrint = lineToPrint.replace(/\s*\{\s*$/, ' {');
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
        const lines = text.split(/\r?\n/);
        const formattedLines: string[] = [];
        let isContinuation = false;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();

            if (line === '') {
                if (!isContinuation) {
                    // Only add blank line if the previous line is not blank
                    if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                        formattedLines.push('');
                    }
                } else {
                    // Empty line inside continuation might break standard, but we preserve strictness
                    formattedLines.push('');
                }
                continue;
            }

            // Handle comments
            if (line.startsWith('#') || line.startsWith(';')) {
                if (isContinuation) {
                    // Indent comment inside continuation
                    formattedLines.push('\t\t' + line);
                } else {
                    // Standard comment
                    formattedLines.push(line);
                }
                continue;
            }

            // Handle sections [section]
            if (line.startsWith('[')) {
                // Ensure blank line before section if not at the start
                if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                    formattedLines.push('');
                }
                formattedLines.push(line);
                isContinuation = false;
                continue;
            }

            // Handle continuation line
            if (isContinuation) {
                formattedLines.push('\t\t' + line);
                isContinuation = line.endsWith('\\');
                continue;
            }

            // Handle key = value
            const eqIndex = line.indexOf('=');
            if (eqIndex !== -1) {
                const key = line.substring(0, eqIndex).trim();
                const val = line.substring(eqIndex + 1).trim();
                formattedLines.push(`\t${key} = ${val}`);
                isContinuation = val.endsWith('\\');
                continue;
            }

            // Fallback (boolean key or weird line)
            formattedLines.push('\t' + line);
            isContinuation = line.endsWith('\\');
        }

        // Remove trailing empty lines
        while (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] === '') {
            formattedLines.pop();
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
 * Helper: Format EditorConfig Deep
 */
function formatEditorConfigDeep(text: string): string {
    const lines = text.split('\n');

    interface Property {
        key: string;
        value: string;
        comments: string[];
    }

    interface Section {
        header: string | null;
        properties: Property[];
        comments: string[];
    }

    const sections: Section[] = [];
    let currentSection: Section = { header: null, properties: [], comments: [] };
    let currentComments: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '') continue;

        if (trimmed.startsWith('#') || trimmed.startsWith(';')) {
            currentComments.push(trimmed);
            continue;
        }

        if (trimmed.startsWith('[')) {
            // Push current section
            sections.push(currentSection);

            // Start new section
            currentSection = {
                header: trimmed,
                properties: [],
                comments: currentComments
            };
            currentComments = [];
            continue;
        }

        const eqIndex = trimmed.indexOf('=');
        if (eqIndex !== -1) {
            const key = trimmed.substring(0, eqIndex).trim();
            const value = trimmed.substring(eqIndex + 1).trim();

            currentSection.properties.push({
                key,
                value,
                comments: currentComments
            });
            currentComments = [];
            continue;
        }

        // Fallback for weird lines
        currentComments.push(line);
    }

    // Push last section
    sections.push(currentSection);

    // Reconstruct
    const formattedLines: string[] = [];

    sections.forEach((section, index) => {
        // If it's the root section (index 0 usually, or header is null)
        const isRoot = section.header === null;

        // Skip empty root section if it has nothing
        if (isRoot && section.properties.length === 0 && section.comments.length === 0) {
            return;
        }

        // Spacing
        if (formattedLines.length > 0) {
            formattedLines.push('');
        }

        // Section Comments
        section.comments.forEach(c => formattedLines.push(c));

        // Section Header
        if (section.header) {
            formattedLines.push(section.header);
        }

        // Properties
        if (section.properties.length > 0) {
             // Sort
            const sortedProps = [...section.properties].sort((a, b) => {
                if (a.key === 'root' && b.key !== 'root') return -1;
                if (b.key === 'root' && a.key !== 'root') return 1;
                return a.key.localeCompare(b.key);
            });

            // Align
            let maxKeyLen = 0;
            sortedProps.forEach(p => {
                if (p.key.length > maxKeyLen) maxKeyLen = p.key.length;
            });

            const indent = isRoot ? '' : '    ';

            sortedProps.forEach(p => {
                p.comments.forEach(c => formattedLines.push(`${indent}${c}`));
                const padding = ' '.repeat(maxKeyLen - p.key.length);
                formattedLines.push(`${indent}${p.key}${padding} = ${p.value}`);
            });
        }
    });

    // Trailing comments?
    // If `currentComments` has items left, they were at the very end of file.
    if (currentComments.length > 0) {
        if (formattedLines.length > 0) formattedLines.push('');
        currentComments.forEach(c => formattedLines.push(c));
    }

    return formattedLines.join('\n');
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
        const lines = text.split('\n');

        // Data structure to hold parsed lines
        interface LogLine {
            type: 'entry' | 'continuation';
            raw: string;
            timestamp?: string;
            level?: string;
            message?: string;
            indent?: number; // for continuation lines
        }

        const parsedLines: LogLine[] = [];

        // 1. Parsing Pass
        // Robust timestamp regex:
        // - ISO8601: 2023-10-27T10:00:00.000Z or 2023-10-27 10:00:00
        // - Common: Oct 27 10:00:00
        // - Time only: 10:00:00
        // - Surrounded by brackets []
        const timestampRegex = /^(\[?(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?|\d{2}:\d{2}:\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\]?)\s*/;
        const logLevelRegex = /^\s*(INFO|DEBUG|WARN|WARNING|ERROR|FATAL|TRACE|CRITICAL|NOTICE|ALERT|EMERG)\b/i;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '') {
                parsedLines.push({ type: 'entry', raw: '', message: '' });
                continue;
            }

            const tsMatch = trimmed.match(timestampRegex);
            if (tsMatch) {
                // Potential new entry
                const timestamp = tsMatch[1];
                let rest = trimmed.substring(tsMatch[0].length);

                // Check for Level
                let level = '';
                const levelMatch = rest.match(logLevelRegex);
                if (levelMatch) {
                    level = levelMatch[1];
                    rest = rest.substring(levelMatch[0].length).trim();
                }

                parsedLines.push({
                    type: 'entry',
                    raw: line,
                    timestamp: timestamp,
                    level: level,
                    message: rest
                });
            } else {
                // Continuation line (Stack trace, JSON dump continuation, etc.)
                // Determine indentation
                // If the line starts with whitespace, preserve relative indentation?
                // Or force standard indentation?
                // Deep formatting: Standardize indentation to 4 spaces or align with message column.
                // We'll calculate alignment later. For now mark it.
                parsedLines.push({
                    type: 'continuation',
                    raw: line,
                    message: trimmed
                });
            }
        }

        // 2. Alignment Calculation
        let maxTsWidth = 0;
        let maxLevelWidth = 0;

        parsedLines.forEach(l => {
            if (l.type === 'entry') {
                if (l.timestamp && l.timestamp.length > maxTsWidth) maxTsWidth = l.timestamp.length;
                if (l.level && l.level.length > maxLevelWidth) maxLevelWidth = l.level.length;
            }
        });

        // 3. Formatting & JSON Processing
        const formattedLines: string[] = [];
        const indentString = '    '; // Standard indent for continuations

        for (let i = 0; i < parsedLines.length; i++) {
            const l = parsedLines[i];

            if (l.type === 'entry') {
                if (!l.timestamp && !l.level && !l.message) {
                    formattedLines.push('');
                    continue;
                }

                let lineStr = '';

                // Timestamp
                if (l.timestamp) {
                    lineStr += l.timestamp.padEnd(maxTsWidth);
                }

                // Level
                if (l.level) {
                    // Normalize Level: Uppercase and surround with brackets if standard?
                    // Let's just uppercase and pad.
                    // If timestamp exists, add space separator
                    if (l.timestamp) lineStr += ' ';

                    const normalizedLevel = l.level.toUpperCase();
                    // Optional: wrap in brackets if not already?
                    // Many logs use [INFO]. If we want to standardize, we could.
                    // But let's respect the regex extraction which might have stripped brackets if not careful.
                    // The regex `logLevelRegex` matches WORDS. So `[INFO]` would be parsed as `INFO` if we handled brackets in regex.
                    // But we didn't handle brackets in `logLevelRegex` explicitly before the word.
                    // Let's check if the original had brackets.
                    // Actually, let's just output padded level.
                    // To be really "Deep", let's wrap level in [] if it's standard style.
                    // But maybe simple alignment is safer.
                    // Let's just PAD the level.

                    lineStr += `[${normalizedLevel}]`.padEnd(maxLevelWidth + 2); // +2 for brackets
                } else if (maxLevelWidth > 0) {
                     // Empty level column
                     if (l.timestamp) lineStr += ' ';
                     lineStr += ' '.repeat(maxLevelWidth + 2);
                }

                // Message & JSON
                let message = l.message || '';

                // JSON Detection and Formatting
                // Check if message contains potential JSON
                const jsonStartIndex = message.search(/[\{\[]/);
                if (jsonStartIndex !== -1) {
                    const potentialJson = message.substring(jsonStartIndex);
                    // Check if it ends with } or ] (basic heuristic before parsing)
                    if ((potentialJson.startsWith('{') && potentialJson.endsWith('}')) ||
                        (potentialJson.startsWith('[') && potentialJson.endsWith(']'))) {
                        try {
                            const parsed = JSON.parse(potentialJson);
                            // Pretty print JSON
                            const jsonStr = JSON.stringify(parsed, null, 2);
                            const jsonLines = jsonStr.split('\n');

                            const prefix = message.substring(0, jsonStartIndex);
                            // First line: Prefix + JSON start
                            message = prefix + jsonLines[0];

                            // Construct the main line
                            formattedLines.push((lineStr + ' ' + message).trimEnd());

                            // Push the rest of JSON as continuation
                            for (let j = 1; j < jsonLines.length; j++) {
                                 // Align with JSON start?
                                 // Calculate prefix length including alignment
                                 const alignmentPadding = ' '.repeat(lineStr.length + 1 + prefix.length);
                                 formattedLines.push(alignmentPadding + jsonLines[j]);
                            }
                            continue; // Skip standard push
                        } catch (e) {
                            // Not valid JSON, ignore
                        }
                    }
                }

                formattedLines.push((lineStr + ' ' + message).trimEnd());

            } else {
                // Continuation
                // Indent relative to previous line's message start?
                // Or just fixed indentation?
                // Fixed indentation is safer for stack traces.
                formattedLines.push(indentString + l.message);
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
