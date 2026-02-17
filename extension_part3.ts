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
async function handleKotlin(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

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
 * Handle Java formatting and validation
 */
async function handleJava(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

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

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Java has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Java formatted successfully!');
    }
}

/**
 * Core Python formatting logic
 */
function formatPythonCore(text: string): string {
    const lines = text.split('\n');
    const formattedLines: string[] = [];
    let indentLevel = 0;
    let forceNextIndent = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '') {
            formattedLines.push('');
            continue;
        }

        // Heuristic for de-indenting keywords
        const deindentKeywords = ['elif ', 'elif:', 'else:', 'except ', 'except:', 'finally:'];
        const shouldDeindent = deindentKeywords.some(kw => trimmed.startsWith(kw));

        if (shouldDeindent) {
            indentLevel = Math.max(0, indentLevel - 1);
        } else if (!forceNextIndent) {
            // Calculate effective indentation for this line
            // If the user has already de-indented more than we expected, follow them
            const userIndent = line.length - line.trimStart().length;
            const userLevel = Math.floor(userIndent / 4);

            if (userLevel < indentLevel) {
                indentLevel = userLevel;
            }
        }

        formattedLines.push('    '.repeat(indentLevel) + trimmed);

        // If this line starts a block, the next line should be indented
        if (trimmed.endsWith(':')) {
            indentLevel++;
            forceNextIndent = true;
        } else {
            forceNextIndent = false;
        }
    }
    return formattedLines.join('\n');
}

/**
 * Handle Python formatting and validation
 */
async function handlePython(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

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
        formatted = formatPythonCore(text);
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
 * Handle GraphQL formatting and validation
 */
async function handleGraphQL(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate GraphQL using graphql package
    try {
        graphql.parse(text);
    } catch (e: any) {
        if (e.locations && e.locations.length > 0) {
            validationMessage = `${e.message} at line ${e.locations[0].line}, col ${e.locations[0].column}`;
        } else {
            validationMessage = e.message;
        }
    }

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;
        let inTripleString = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '' && !inTripleString) {
                formattedLines.push('');
                continue;
            }

            // Handle multiline strings (triple quotes)
            if (inTripleString) {
                formattedLines.push(line);
                if (trimmed.includes('"""')) {
                    const matches = (trimmed.match(/"""/g) || []).length;
                    if (matches % 2 !== 0) {
                        inTripleString = false;
                    }
                }
                continue;
            }

            if (trimmed.includes('"""')) {
                const matches = (trimmed.match(/"""/g) || []).length;
                if (matches % 2 !== 0) {
                    inTripleString = true;
                }
            }

            // Count leading closing braces to adjust indentation for CURRENT line
            let leadingClosingCount = 0;
            let j = 0;
            while (j < trimmed.length && (trimmed[j] === '}' || trimmed[j] === ')' || trimmed[j] === ']')) {
                leadingClosingCount++;
                j++;
            }

            indentLevel = Math.max(0, indentLevel - leadingClosingCount);

            formattedLines.push('  '.repeat(indentLevel) + trimmed);

            // Calculate net brace change for NEXT line, excluding leading closing braces
            let netChange = 0;
            let inString = false;
            const remaining = trimmed.substring(leadingClosingCount);

            for (let k = 0; k < remaining.length; k++) {
                const char = remaining[k];
                if (char === '"' && (k === 0 || remaining[k-1] !== '\\')) {
                    inString = !inString;
                    continue;
                }
                if (inString) {
                    continue;
                }
                if (char === '#') {
                    break; // Comment
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
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format GraphQL: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`GraphQL has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('GraphQL formatted successfully!');
    }
}

/**
 * Handle CSV formatting and validation
 */
async function handleCSV(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    try {
        const delimiter = detectDelimiter(text);
        const lines = text.split('\n');
        const rows: string[][] = [];
        let hasUnclosedQuotes = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() === '') {
                rows.push([]);
                continue;
            }

            // Split and check for unclosed quotes
            let inQuotes = false;
            for (let j = 0; j < line.length; j++) {
                if (line[j] === '"') {
                    if (inQuotes && j + 1 < line.length && line[j + 1] === '"') {
                        j++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                }
            }
            if (inQuotes) {
                hasUnclosedQuotes = true;
                if (!validationMessage) {
                    validationMessage = `Unclosed quotes at line ${i + 1}`;
                }
            }

            rows.push(splitCSVLine(line, delimiter));
        }

        // Calculate max widths
        const maxWidths: number[] = [];
        for (const row of rows) {
            for (let i = 0; i < row.length; i++) {
                maxWidths[i] = Math.max(maxWidths[i] || 0, row[i].length);
            }
        }

        // Check for inconsistent column count
        const headerRow = rows.find(r => r.length > 0);
        const headerCount = headerRow ? headerRow.length : 0;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].length > 0 && rows[i].length !== headerCount && !validationMessage) {
                validationMessage = `Inconsistent column count at line ${i + 1} (expected ${headerCount}, got ${rows[i].length})`;
            }
        }

        // Format
        const formattedLines = rows.map(row => {
            if (row.length === 0) {
                return '';
            }
            return row.map((cell, i) => {
                if (i === row.length - 1) {
                    return cell; // Don't pad last column
                }
                return cell.padEnd(maxWidths[i]);
            }).join(` ${delimiter} `);
        });

        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format CSV: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`CSV has issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('CSV formatted successfully!');
    }
}

/**
 * Detect CSV delimiter
 */
function detectDelimiter(text: string): string {
    const delimiters = [',', ';', '\t', '|'];
    const lines = text.split('\n').filter(l => l.trim() !== '').slice(0, 5);
    if (lines.length === 0) {
        return ',';
    }

    const counts: Record<string, number[]> = {};
    delimiters.forEach(d => counts[d] = []);

    for (const line of lines) {
        delimiters.forEach(d => {
            let count = 0;
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                if (line[i] === '"') {
                    if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (line[i] === d && !inQuotes) {
                    count++;
                }
            }
            counts[d].push(count);
        });
    }

    // Find delimiter with consistent non-zero count
    for (const d of delimiters) {
        const dCounts = counts[d];
        if (dCounts[0] > 0 && dCounts.every(c => c === dCounts[0])) {
            return d;
        }
    }

    // Fallback: most frequent non-zero
    let bestD = ',';
    let maxCount = -1;
    for (const d of delimiters) {
        const sum = counts[d].reduce((a, b) => a + b, 0);
        if (sum > maxCount) {
            maxCount = sum;
            bestD = d;
        }
    }
    return bestD;
}

/**
 * Split CSV line by delimiter respecting quotes
 */
function splitCSVLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                current += '""';
                i++;
            } else {
                inQuotes = !inQuotes;
                current += char;
            }
        } else if (char === delimiter && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

/**
 * Handle ENV formatting and validation
 */
async function handleENV(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Handle comments and empty lines
            if (trimmed === '' || trimmed.startsWith('#')) {
                formattedLines.push(trimmed);
                continue;
            }

            // Handle export KEY=VALUE or KEY=VALUE
            // KEY must start with letter or underscore, followed by letters, numbers or underscores
            const exportMatch = trimmed.match(/^(export\s+)?([a-z_][a-z0-9_]*)\s*=\s*(.*)$/i);
            if (exportMatch) {
                const isExport = exportMatch[1] ? 'export ' : '';
                const key = exportMatch[2];
                const value = exportMatch[3];
                formattedLines.push(`${isExport}${key} = ${value}`);
            } else {
                // If it doesn't match the pattern, it's a potential syntax error
                if (!validationMessage) {
                    validationMessage = `Potential issue at line ${i + 1}: "${trimmed}"`;
                }
                formattedLines.push(trimmed);
            }
        }
        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format ENV: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`ENV has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('ENV formatted successfully!');
    }
}

/**
 * Handle INI formatting and validation
 */
async function handleINI(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate INI using 'ini' package
    try {
        ini.parse(text);
    } catch (e: any) {
        validationMessage = e.message;
    }

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let currentIndent = '';

        for (let line of lines) {
            const trimmed = line.trim();

            // Handle comments and empty lines
            if (trimmed === '' || trimmed.startsWith(';') || trimmed.startsWith('#')) {
                formattedLines.push(trimmed);
                continue;
            }

            // Handle sections [section]
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                // Ensure there is a newline before section if not at the start
                if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                    formattedLines.push('');
                }
                formattedLines.push(trimmed);
                continue;
            }

            // Handle key = value or key : value
            let splitIdx = -1;
            const eqIdx = trimmed.indexOf('=');
            const colIdx = trimmed.indexOf(':');

            if (eqIdx !== -1 && colIdx !== -1) {
                splitIdx = Math.min(eqIdx, colIdx);
            } else {
                splitIdx = eqIdx !== -1 ? eqIdx : colIdx;
            }

            if (splitIdx > 0) {
                const separator = trimmed[splitIdx];
                const key = trimmed.substring(0, splitIdx).trim();
                const valuePart = trimmed.substring(splitIdx + 1).trim();

                // Check for inline comments
                let commentStart = -1;
                for (let i = 0; i < valuePart.length; i++) {
                    const char = valuePart[i];
                    if (char === ';' || char === '#') {
                        // Check if it's not part of a quoted string (simple check)
                        const before = valuePart.substring(0, i);
                        const quoteCount = (before.match(/"/g) || []).length;
                        if (quoteCount % 2 === 0) {
                            commentStart = i;
                            break;
                        }
                    }
                }

                if (commentStart !== -1) {
                    const value = valuePart.substring(0, commentStart).trim();
                    const comment = valuePart.substring(commentStart).trim();
                    formattedLines.push(`${key} ${separator} ${value} ${comment}`);
                } else {
                    formattedLines.push(`${key} ${separator} ${valuePart}`);
                }
                continue;
            }

            // Fallback
            formattedLines.push(trimmed);
        }
        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format INI: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`INI has syntax issues but was beautified. Error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('INI formatted successfully!');
    }
}

/**
 * Handle TOML formatting and validation
 */
async function handleTOML(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate TOML using smol-toml
    try {
        smolToml.parse(text);
    } catch (e: any) {
        if (e.line !== undefined) {
            validationMessage = `${e.message} at line ${e.line}, col ${e.column}`;
        } else {
            validationMessage = e.message;
        }
    }

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let inMultilineString = false;
        let multilineStringChar = '';
        let currentIndent = '';

        for (let line of lines) {
            // If we are inside a multiline string, preserve the line exactly
            if (inMultilineString) {
                formattedLines.push(line);
                if (line.includes(multilineStringChar.repeat(3))) {
                    inMultilineString = false;
                }
                continue;
            }

            const trimmed = line.trim();

            // Handle comments and empty lines
            if (trimmed === '' || trimmed.startsWith('#')) {
                const indent = (trimmed === '') ? '' : currentIndent;
                formattedLines.push(indent + trimmed);
                continue;
            }

            // Identify if this line starts a multiline string
            let pendingMultilineToggle = false;
            let pendingMultilineChar = '';
            if (trimmed.includes('"""') || trimmed.includes("'''")) {
                const char = trimmed.includes('"""') ? '"' : "'";
                // Check if the triple quote is not inside a comment
                const commentIdx = trimmed.indexOf('#');
                const tripleIdx = trimmed.indexOf(char.repeat(3));
                if (commentIdx === -1 || tripleIdx < commentIdx) {
                    const matches = trimmed.match(new RegExp(char.repeat(3), 'g'));
                    if (matches && matches.length % 2 !== 0) {
                        pendingMultilineToggle = true;
                        pendingMultilineChar = char;
                    }
                }
            }

            // Handle table headers [table] or [[table]]
            if (trimmed.startsWith('[') && trimmed.endsWith(']') && !trimmed.includes('=')) {
                formattedLines.push(trimmed);
                currentIndent = '  ';
                if (pendingMultilineToggle) {
                    inMultilineString = true;
                    multilineStringChar = pendingMultilineChar;
                }
                continue;
            }

            // Handle key = value
            let eqIndex = -1;
            let inKeyString = false;
            let keyStringChar = '';
            for (let i = 0; i < trimmed.length; i++) {
                const char = trimmed[i];
                if ((char === '"' || char === "'") && (i === 0 || trimmed[i - 1] !== '\\')) {
                    if (!inKeyString) {
                        inKeyString = true;
                        keyStringChar = char;
                    } else if (keyStringChar === char) {
                        inKeyString = false;
                    }
                } else if (char === '=' && !inKeyString) {
                    eqIndex = i;
                    break;
                }
            }

            if (eqIndex > 0) {
                const key = trimmed.substring(0, eqIndex).trim();
                const valuePart = trimmed.substring(eqIndex + 1).trim();

                let commentStart = -1;
                let inValueString = false;
                let valueStringChar = '';

                for (let i = 0; i < valuePart.length; i++) {
                    const char = valuePart[i];
                    if ((char === '"' || char === "'") && (i === 0 || valuePart[i - 1] !== '\\')) {
                        if (!inValueString) {
                            inValueString = true;
                            valueStringChar = char;
                        } else if (valueStringChar === char) {
                            inValueString = false;
                        }
                    } else if (char === '#' && !inValueString) {
                        commentStart = i;
                        break;
                    }
                }

                if (commentStart !== -1) {
                    const value = valuePart.substring(0, commentStart).trim();
                    const comment = valuePart.substring(commentStart);
                    formattedLines.push(`${currentIndent}${key} = ${value} ${comment}`);
                } else {
                    formattedLines.push(`${currentIndent}${key} = ${valuePart}`);
                }
                if (pendingMultilineToggle) {
                    inMultilineString = true;
                    multilineStringChar = pendingMultilineChar;
                }
                continue;
            }

            // Fallback for anything else
            formattedLines.push(currentIndent + trimmed);
            if (pendingMultilineToggle) {
                inMultilineString = true;
                multilineStringChar = pendingMultilineChar;
            }
        }
        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format TOML: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`TOML has syntax issues but was beautified. Error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('TOML formatted successfully!');
    }
}

/**
 * Handle YAML formatting and validation
 */
async function handleYAML(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    try {
        const doc = YAML.parseDocument(text);
        if (doc.errors.length > 0) {
            const firstError = doc.errors[0];
            validationMessage = firstError.message;
            // Fault-tolerance: Clear errors to allow toString() to proceed
            doc.errors = [];
        }

        // Format YAML
        formatted = doc.toString({
            indent: 2,
            indentSeq: true,
            simpleKeys: true
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format YAML: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`YAML has syntax issues but was beautified. First error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('YAML formatted successfully!');
    }
}

/**
 * Handle PHP formatting and validation
 */
async function handlePHP(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate PHP using php-parser
    try {
        const parser = new (phpParser as any)({
            parser: {
                extractDoc: true,
                php7: true
            },
            ast: {
                withPositions: true
            }
        });
        parser.parseCode(text);
    } catch (e: any) {
        if (e.loc) {
            validationMessage = `${e.message} at line ${e.loc.start.line}, col ${e.loc.start.column}`;
        } else {
            validationMessage = e.message;
        }
    }

    /* eslint-disable */
    try {
        // Format PHP (using js-beautify's HTML formatter which handles PHP tags)
        const options: any = {
            indent_size: 2,
            indent_char: ' ',
            max_preserve_newlines: 2,
            preserve_newlines: true,
            indent_scripts: 'normal',
            end_with_newline: false,
            wrap_line_length: 0,
            indent_inner_html: false,
            templating: ['php']
        };
        formatted = jsbeautify.html(text, options);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format PHP: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`PHP has syntax issues but was beautified. First error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('PHP formatted successfully!');
    }
}

/**
 * Handle Svelte formatting and validation
 */
async function handleSvelte(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Svelte
    try {
        svelte.parse(text);
    } catch (e: any) {
        if (e.start) {
            validationMessage = `${e.message} at line ${e.start.line}, col ${e.start.column}`;
        } else {
            validationMessage = e.message;
        }
    }

    /* eslint-disable */
    try {
        // Format Svelte (using js-beautify's HTML formatter)
        const options: any = {
            indent_size: 2,
            indent_char: ' ',
            max_preserve_newlines: 2,
            preserve_newlines: true,
            indent_scripts: 'normal',
            end_with_newline: false,
            wrap_line_length: 0,
            indent_inner_html: false,
            js: {
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
            },
            css: {
                indent_size: 2,
                indent_char: ' ',
                selector_separator_newline: true,
                newline_between_rules: true,
                end_with_newline: false
            }
        };
        formatted = jsbeautify.html(text, options);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Svelte: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Svelte has syntax issues but was beautified. First error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Svelte formatted successfully!');
    }
}

/**
 * Handle HTML formatting and validation
 */
async function handleHTML(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate HTML
    const errors = HTMLHint.verify(text);
    if (errors.length > 0) {
        const firstError = errors[0];
        validationMessage = `${firstError.message} at line ${firstError.line}, col ${firstError.col}`;
        if (errors.length > 1) {
            validationMessage += ` (and ${errors.length - 1} more errors)`;
        }
    }

    /* eslint-disable */
    try {
        // Format HTML
        formatted = jsbeautify.html(text, {
            indent_size: 2,
            indent_char: ' ',
            max_preserve_newlines: 2,
            preserve_newlines: true,
            indent_scripts: 'normal',
            end_with_newline: false,
            wrap_line_length: 0,
            indent_inner_html: false
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format HTML: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`HTML has syntax issues but was beautified. First error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('HTML formatted successfully!');
    }
}

/**
 * Handle Vue formatting and validation
 */
async function handleVue(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Vue (using HTMLHint but ignoring doctype-first)
    /* eslint-disable @typescript-eslint/naming-convention */
    const errors = HTMLHint.verify(text, { 'doctype-first': false });
    /* eslint-enable @typescript-eslint/naming-convention */
    if (errors.length > 0) {
        const firstError = errors[0];
        validationMessage = `${firstError.message} at line ${firstError.line}, col ${firstError.col}`;
        if (errors.length > 1) {
            validationMessage += ` (and ${errors.length - 1} more errors)`;
        }
    }

    /* eslint-disable */
    try {
        // Format Vue (using js-beautify's HTML formatter)
        const options: any = {
            indent_size: 2,
            indent_char: ' ',
            max_preserve_newlines: 2,
            preserve_newlines: true,
            indent_scripts: 'normal',
            end_with_newline: false,
            wrap_line_length: 0,
            indent_inner_html: false,
            js: {
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
            },
            css: {
                indent_size: 2,
                indent_char: ' ',
                selector_separator_newline: true,
                newline_between_rules: true,
                end_with_newline: false
            }
        };
        formatted = jsbeautify.html(text, options);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Vue: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Vue has syntax issues but was beautified. First error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Vue formatted successfully!');
    }
}

/**
 * Handle TypeScript formatting and validation
 */
async function handleTS(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate TypeScript
    try {
        const sourceFile = ts.createSourceFile('temp.ts', text, ts.ScriptTarget.Latest, true);
        const diagnostics = (sourceFile as any).parseDiagnostics;
        if (diagnostics && diagnostics.length > 0) {
            const firstError = diagnostics[0];
            const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, firstError.start!);
            validationMessage = `${ts.flattenDiagnosticMessageText(firstError.messageText, '\n')} at line ${line + 1}, col ${character + 1}`;
        }
    } catch (e: any) {
        validationMessage = e.message;
    }

    /* eslint-disable */
    try {
        // Format TypeScript (using js-beautify's JS formatter)
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
        vscode.window.showErrorMessage(`Failed to format TypeScript: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`TypeScript has syntax issues but was beautified. Error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('TypeScript formatted successfully!');
    }
}

/**
 * Handle TSX formatting and validation
 */
async function handleTSX(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate TSX
    try {
        const sourceFile = ts.createSourceFile('temp.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        const diagnostics = (sourceFile as any).parseDiagnostics;
        if (diagnostics && diagnostics.length > 0) {
            const firstError = diagnostics[0];
            const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, firstError.start!);
            validationMessage = `${ts.flattenDiagnosticMessageText(firstError.messageText, '\n')} at line ${line + 1}, col ${character + 1}`;
        }
    } catch (e: any) {
        validationMessage = e.message;
    }

    /* eslint-disable */
    try {
        // Format TSX (using js-beautify's JS formatter)
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
        vscode.window.showErrorMessage(`Failed to format TSX: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`TSX has syntax issues but was beautified. Error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('TSX formatted successfully!');
    }
}

/**
 * Handle JSX formatting and validation
 */
async function handleJSX(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate JSX
    try {
        const sourceFile = ts.createSourceFile('temp.jsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
        const diagnostics = (sourceFile as any).parseDiagnostics;
        if (diagnostics && diagnostics.length > 0) {
            const firstError = diagnostics[0];
            const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, firstError.start!);
            validationMessage = `${ts.flattenDiagnosticMessageText(firstError.messageText, '\n')} at line ${line + 1}, col ${character + 1}`;
        }
    } catch (e: any) {
        validationMessage = e.message;
    }

    /* eslint-disable */
    try {
        // Format JSX
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
        vscode.window.showErrorMessage(`Failed to format JSX: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`JSX has syntax issues but was beautified. Error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('JSX formatted successfully!');
    }
}

/**
 * Handle JavaScript formatting and validation
 */
async function handleJS(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate JavaScript
    try {
        acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
    } catch (e: any) {
        validationMessage = `${e.message} at line ${e.loc?.line}, col ${e.loc?.column}`;
    }

    /* eslint-disable */
    try {
        // Format JavaScript
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
        vscode.window.showErrorMessage(`Failed to format JavaScript: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`JavaScript has syntax issues but was beautified. Error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('JavaScript formatted successfully!');
    }
}

/**
 * Handle Dockerfile formatting and validation
 */
async function handleDockerfile(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Dockerfile
    validationMessage = validateDockerfile(text);

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let isMultiline = false;

        const instructions = [
            'FROM', 'RUN', 'COPY', 'ADD', 'WORKDIR', 'EXPOSE', 'ENTRYPOINT',
            'CMD', 'ENV', 'ARG', 'LABEL', 'USER', 'VOLUME', 'STOPSIGNAL',
            'HEALTHCHECK', 'ONBUILD', 'MAINTAINER', 'SHELL'
        ];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '' || trimmed.startsWith('#')) {
                formattedLines.push(trimmed);
                continue;
            }

            let currentLine = trimmed;
            if (!isMultiline) {
                // Check if line starts with an instruction
                const firstWord = trimmed.split(/\s+/)[0].toUpperCase();
                if (instructions.includes(firstWord)) {
                    // Normalize instruction case
                    const rest = trimmed.substring(firstWord.length).trim();
                    currentLine = `${firstWord} ${rest}`;
                }
                formattedLines.push(currentLine);
            } else {
                // Indent multiline continuation
                formattedLines.push('    ' + trimmed);
            }

            // Check if this line ends with a backslash for multiline support
            isMultiline = trimmed.endsWith('\\');
        }
        formatted = formattedLines.join('\n');
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
    let inQuotes = false;
    let quoteChar = '';

    const instructions = [
        'FROM', 'RUN', 'COPY', 'ADD', 'WORKDIR', 'EXPOSE', 'ENTRYPOINT',
        'CMD', 'ENV', 'ARG', 'LABEL', 'USER', 'VOLUME', 'STOPSIGNAL',
        'HEALTHCHECK', 'ONBUILD', 'MAINTAINER', 'SHELL'
    ];

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
        if (instructions.includes(firstWord)) {
            if (firstWord === 'FROM') hasFrom = true;

            const rest = trimmed.substring(firstWord.length).trim();
            if (rest === '' && !trimmed.endsWith('\\')) {
                return `Instruction '${firstWord}' has no arguments at line ${i + 1}`;
            }
        }
    }

    if (inQuotes) {
        return "Unclosed string literal";
    }

    if (!hasFrom && text.trim().length > 0) {
        return "Dockerfile should start with a 'FROM' instruction";
    }

    return undefined;
}

/**
 * Main beautify function with auto-detection
 */
/**
 * Handle Git Config formatting and validation
 */
async function handleGitConfig(editor: vscode.TextEditor, text: string) {
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
            // Handle multiline values (ending with \)
            // We need to check if the previous line ended with \ to know if we are in a multiline value?
            // But here we are processing line by line.
            // Wait, if we just trim and indent, we might break multiline values if we indent the continuation lines blindly.
            // Git config continuation lines are usually indented.

            // Let's refine the loop to handle multiline.
            // But first, let's just handle simple key = value indentation.

            // Check if it looks like a property: key = value
            if (/^[a-z0-9-]+\s*=/i.test(line)) {
                formattedLines.push('\t' + line);
            } else {
                // Continuation or unknown?
                // If it's not a comment, not a section, and not a key=value start, it might be a continuation.
                // Or it might be a broken line.
                // We'll indent it to be safe, assuming it belongs to the previous property.
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
                // Check if it has a comment at the end
                // [section] # comment
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

        // Check for key = value
        // But multiline values exist.
        // Simple check: if it has `=`, check quotes.

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
            // Multiline string?
            // If line ends with \, it continues.
            if (!line.endsWith('\\')) {
                 return `Unclosed quote at line ${i + 1}`;
            }
        }
    }
    return undefined;
}

/**
 * Handle Handlebars formatting and validation
 */
async function handleHandlebars(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Handlebars
    validationMessage = validateHandlebars(text);

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;

        // Void tags that don't need closing
        const voidTags = [
            'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
            'link', 'meta', 'param', 'source', 'track', 'wbr'
        ];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '') {
                formattedLines.push('');
                continue;
            }

            // Check for dedentation triggers at the start of the line
            let currentIndent = indentLevel;

            // Closing Handlebars block: {{/if}}, {{/each}}, etc.
            if (/^{{\/[a-zA-Z0-9_.-]+/.test(trimmed)) {
                currentIndent = Math.max(0, indentLevel - 1);
            }
            // Middle Handlebars block: {{else}}, {{^}}
            else if (/^{{\s*(else|\^)/.test(trimmed)) {
                currentIndent = Math.max(0, indentLevel - 1);
            }
            // Closing HTML tag: </div>
            else if (/^<\/[a-zA-Z0-9]+/.test(trimmed)) {
                currentIndent = Math.max(0, indentLevel - 1);
            }

            // Apply indentation
            formattedLines.push('  '.repeat(currentIndent) + trimmed);

            // Calculate indentation for the NEXT line
            let netChange = 0;

            // Remove comments for analysis
            const lineNoComments = line.replace(/{{!--[\s\S]*?--}}/g, '').replace(/{{![\s\S]*?}}/g, '').replace(/<!--[\s\S]*?-->/g, '');

            // Check for Handlebars block openers
            // {{#if ...}}, {{#each ...}}, {{#with ...}}, {{#block ...}}
            // Excluding self-closing or inline usage if any (though standard block helpers are usually multiline)
            const hbsOpeners = (lineNoComments.match(/{{#[a-zA-Z0-9_.-]+[^}]*}}/g) || []).length;
            const hbsClosers = (lineNoComments.match(/{{\/[a-zA-Z0-9_.-]+}}/g) || []).length;

            // Check for HTML tag openers
            // <div ...> but not <img ...> or <div ... />
            let htmlOpeners = 0;
            let htmlClosers = 0;

            // Simple regex for HTML tags - this is resilient/approximate
            const tagRegex = /<\/?([a-zA-Z0-9]+)[^>]*>/g;
            let match;
            while ((match = tagRegex.exec(lineNoComments)) !== null) {
                const fullTag = match[0];
                const tagName = match[1].toLowerCase();
                const isClosing = fullTag.startsWith('</');
                const isSelfClosing = fullTag.endsWith('/>');

                if (isClosing) {
                    htmlClosers++;
                } else if (!isSelfClosing && !voidTags.includes(tagName)) {
                    htmlOpeners++;
                }
            }

            // Middle blocks (else, ^) don't change net indent for next line relative to previous
            // but effectively we dedented current line, so we need to indent back for content
            if (/^{{\s*(else|\^)/.test(trimmed)) {
                // If we had {{else}}, we printed it at indent-1.
                // The next line should be at indent.
                // So if currentIndent was indent-1, next indent is currentIndent + 1 = indent.
                // No net change to the *base* indentLevel from the start of this line's processing perspective?
                // Actually:
                // if (cond)
                //   stuff
                // else
                //   stuff
                // /if
                // Initial: 0.
                // {{#if}}: current=0, next=1.
                // stuff: current=1, next=1.
                // {{else}}: current=0 (dedented), next=1 (indented back).
                // stuff: current=1, next=1.
                // {{/if}}: current=0 (dedented), next=0.

                // So for {{else}}, we want netChange to be 0 relative to the state *before* the dedent logic?
                // No, indentLevel is the state at start of loop.
                // If line is {{else}}, we used indentLevel-1.
                // Next line should be indentLevel.
                // So indentLevel (next) = indentLevel (current).
                // So netChange = 0.
                // BUT, hbsOpeners/Closers might be 0.
            }

            netChange = (hbsOpeners - hbsClosers) + (htmlOpeners - htmlClosers);
            indentLevel = Math.max(0, indentLevel + netChange);
        }

        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Handlebars: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Handlebars has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Handlebars formatted successfully!');
    }
}

/**
 * Custom resilient Handlebars validator
 */
function validateHandlebars(text: string): string | undefined {
    const stack: { tag: string, line: number, type: 'hbs' | 'html' }[] = [];
    const lines = text.split('\n');

    // Void tags that don't need closing
    const voidTags = [
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
    ];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Remove comments
        const lineNoComments = line.replace(/{{!--[\s\S]*?--}}/g, '').replace(/{{![\s\S]*?}}/g, '').replace(/<!--[\s\S]*?-->/g, '');

        // Find all tags in order
        const regex = /({{#([a-zA-Z0-9_.-]+)[^}]*}})|({{\/([a-zA-Z0-9_.-]+)}})|(<\/?([a-zA-Z0-9]+)[^>]*>)/g;
        let match;

        while ((match = regex.exec(lineNoComments)) !== null) {
            if (match[1]) { // Handlebars Open: {{#name ...}}
                const tagName = match[2];
                stack.push({ tag: tagName, line: i + 1, type: 'hbs' });
            } else if (match[3]) { // Handlebars Close: {{/name}}
                const tagName = match[4];
                if (stack.length === 0) {
                    return `Unexpected closing block {{/${tagName}}} at line ${i + 1}`;
                }
                const last = stack.pop()!;
                if (last.type !== 'hbs' || last.tag !== tagName) {
                    return `Mismatched closing block {{/${tagName}}} at line ${i + 1} (expected {{/${last.tag}}} from line ${last.line})`;
                }
            } else if (match[5]) { // HTML Tag
                const fullTag = match[5];
                const tagName = match[6].toLowerCase();
                const isClosing = fullTag.startsWith('</');
                const isSelfClosing = fullTag.endsWith('/>');

                if (isSelfClosing || voidTags.includes(tagName)) {
                    continue;
                }

                if (isClosing) {
                    // Try to match with the last HTML tag, skipping any HBS blocks that might be interleaved
                    // (though valid HBS usually nests strictly)
                    // But for resilience, let's just look at the stack top
                    if (stack.length === 0) {
                        return `Unexpected closing tag </${tagName}> at line ${i + 1}`;
                    }
                    const last = stack.pop()!;
                    // If we find an HBS block, it means we have something like {{#if}} </div> {{/if}} which is invalid nesting
                    if (last.type === 'hbs') {
                         return `Mismatched closing tag </${tagName}> at line ${i + 1} (expected {{/${last.tag}}} from line ${last.line})`;
                    }
                    if (last.tag !== tagName) {
                        return `Mismatched closing tag </${tagName}> at line ${i + 1} (expected </${last.tag}> from line ${last.line})`;
                    }
                } else {
                    stack.push({ tag: tagName, line: i + 1, type: 'html' });
                }
            }
        }
    }

    if (stack.length > 0) {
        const last = stack.pop()!;
        if (last.type === 'hbs') {
            return `Unclosed block {{#${last.tag}}} starting at line ${last.line}`;
        } else {
            return `Unclosed tag <${last.tag}> starting at line ${last.line}`;
        }
    }

    return undefined;
}

/**
 * Handle Twig formatting and validation
 */
async function handleTwig(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Twig
    validationMessage = validateTwig(text);

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;

        // Void tags that don't need closing
        const voidTags = [
            'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
            'link', 'meta', 'param', 'source', 'track', 'wbr'
        ];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '') {
                formattedLines.push('');
                continue;
            }

            // Check for dedentation triggers at the start of the line
            let currentIndent = indentLevel;

            // Closing Twig block: {% endif %}, {% endblock %}, etc.
            if (/^{%\s*end(if|for|block|macro|embed|apply|sandbox|autoescape|verbatim|set|with|filter|trans)\b/.test(trimmed)) {
                currentIndent = Math.max(0, indentLevel - 1);
            }
            // Middle Twig block: {% else %}, {% elseif %}
            else if (/^{%\s*(else|elseif)\b/.test(trimmed)) {
                currentIndent = Math.max(0, indentLevel - 1);
            }
            // Closing HTML tag: </div>
            else if (/^<\/[a-zA-Z0-9]+/.test(trimmed)) {
                currentIndent = Math.max(0, indentLevel - 1);
            }
            // Closing brace } or ]
            else if (trimmed.startsWith('}') || trimmed.startsWith(']')) {
                 currentIndent = Math.max(0, indentLevel - 1);
            }

            // Apply indentation
            formattedLines.push('  '.repeat(currentIndent) + trimmed);

            // Calculate indentation for the NEXT line
            let netChange = 0;

            // Remove comments for analysis
            const lineNoComments = line.replace(/{#[\s\S]*?#}/g, '').replace(/<!--[\s\S]*?-->/g, '');

            // Check for Twig block openers/closers
            const twigTagRegex = /{%-?\s*([a-zA-Z0-9_]+)([^%]*?)-?%}/g;
            let twigMatch;
            let twigOpeners = 0;
            let twigClosers = 0;

            while ((twigMatch = twigTagRegex.exec(lineNoComments)) !== null) {
                const tagName = twigMatch[1];
                const content = twigMatch[2];

                if (/^end/.test(tagName)) {
                    twigClosers++;
                } else if (/^(block|if|for|macro|embed|apply|sandbox|autoescape|verbatim|with|filter|trans)$/.test(tagName)) {
                    twigOpeners++;
                } else if (tagName === 'set') {
                    // Only count as opener if it's a block set (no '=' assignment)
                    if (!content.includes('=')) {
                        twigOpeners++;
                    }
                }
            }

            // Check for HTML tag openers
            let htmlOpeners = 0;
            let htmlClosers = 0;

            const tagRegex = /<\/?([a-zA-Z0-9]+)[^>]*>/g;
            let match;
            while ((match = tagRegex.exec(lineNoComments)) !== null) {
                const fullTag = match[0];
                const tagName = match[1].toLowerCase();
                const isClosing = fullTag.startsWith('</');
                const isSelfClosing = fullTag.endsWith('/>');

                if (isClosing) {
                    htmlClosers++;
                } else if (!isSelfClosing && !voidTags.includes(tagName)) {
                    htmlOpeners++;
                }
            }

            // Check for brace openers/closers (approximate for objects/arrays)
            const braceOpeners = (lineNoComments.match(/\{|\[/g) || []).length;
            const braceClosers = (lineNoComments.match(/\}|\]/g) || []).length;
            // Ignore double braces used for Twig {{ }}
            const variableOpeners = (lineNoComments.match(/{{/g) || []).length;
            const variableClosers = (lineNoComments.match(/}}/g) || []).length;

            // Adjust brace count by removing variable braces
            // Each {{ is 2 {, each }} is 2 }
            const realBraceOpeners = braceOpeners - (variableOpeners * 2);
            const realBraceClosers = braceClosers - (variableClosers * 2);

            // Only count if positive (simple heuristic)
            const netBraceChange = Math.max(0, realBraceOpeners) - Math.max(0, realBraceClosers);

            netChange = (twigOpeners - twigClosers) + (htmlOpeners - htmlClosers) + netBraceChange;

            // Special handling for intermediate tags: they essentially reset indent for themselves but keep it for content
            // Logic handled by dedent at start, so just ensure we don't double count if we consider them openers?
            // No, 'else' is not in the openers regex above. So it's fine.

            indentLevel = Math.max(0, indentLevel + netChange);
        }

        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Twig: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Twig has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Twig formatted successfully!');
