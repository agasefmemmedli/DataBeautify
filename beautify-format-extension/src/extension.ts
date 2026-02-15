import * as vscode from 'vscode';
import xmlFormatter from 'xml-formatter';
import { jsonrepair } from 'jsonrepair';
import { XMLValidator } from 'fast-xml-parser';
import * as jsbeautify from 'js-beautify';
import { HTMLHint } from 'htmlhint';
import * as css from 'css';
import * as sass from 'sass';
import { SassFormatter } from 'sass-formatter';
import * as less from 'less';
import * as acorn from 'acorn';
import * as ts from 'typescript';

/**
 * This method is called when the extension is activated
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Beautify Format extension is now active!');

    // Register unified beautify command
    let beautifyCommand = vscode.commands.registerCommand('beautify-format.beautify', () => {
        beautify();
    });

    context.subscriptions.push(beautifyCommand);

    // Keep old commands for backward compatibility but map them to the new logic
    let formatJSONCommand = vscode.commands.registerCommand('beautify-format.formatJSON', () => {
        beautify('json');
    });
    let formatXMLCommand = vscode.commands.registerCommand('beautify-format.formatXML', () => {
        beautify('xml');
    });
    let formatCSSCommand = vscode.commands.registerCommand('beautify-format.formatCSS', () => {
        beautify('css');
    });

    let formatSCSSCommand = vscode.commands.registerCommand('beautify-format.formatSCSS', () => {
        beautify('scss');
    });
    let formatSASSCommand = vscode.commands.registerCommand('beautify-format.formatSASS', () => {
        beautify('sass');
    });
    let formatLESSCommand = vscode.commands.registerCommand('beautify-format.formatLESS', () => {
        beautify('less');
    });
    let formatJSCommand = vscode.commands.registerCommand('beautify-format.formatJS', () => {
        beautify('javascript');
    });
    let formatTSCommand = vscode.commands.registerCommand('beautify-format.formatTS', () => {
        beautify('typescript');
    });
    let formatJSXCommand = vscode.commands.registerCommand('beautify-format.formatJSX', () => {
        beautify('jsx');
    });
    let formatTSXCommand = vscode.commands.registerCommand('beautify-format.formatTSX', () => {
        beautify('tsx');
    });
    let formatVueCommand = vscode.commands.registerCommand('beautify-format.formatVue', () => {
        beautify('vue');
    });

    context.subscriptions.push(formatJSONCommand);
    context.subscriptions.push(formatXMLCommand);
    context.subscriptions.push(formatCSSCommand);
    context.subscriptions.push(formatSCSSCommand);
    context.subscriptions.push(formatSASSCommand);
    context.subscriptions.push(formatLESSCommand);
    context.subscriptions.push(formatJSCommand);
    context.subscriptions.push(formatTSCommand);
    context.subscriptions.push(formatJSXCommand);
    context.subscriptions.push(formatTSXCommand);
    context.subscriptions.push(formatVueCommand);
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
 * Main beautify function with auto-detection
 */
async function beautify(forcedFormat?: 'json' | 'xml' | 'html' | 'css' | 'scss' | 'sass' | 'less' | 'javascript' | 'typescript' | 'jsx' | 'tsx' | 'vue') {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
    }

    const document = editor.document;
    const text = document.getText();

    if (text.trim().length === 0) {
        vscode.window.showWarningMessage('Document is empty');
        return;
    }

    const format = forcedFormat || detectFormat(text, document.languageId);

    if (format === 'json') {
        await handleJSON(editor, text);
    } else if (format === 'xml') {
        await handleXML(editor, text);
    } else if (format === 'html') {
        await handleHTML(editor, text);
    } else if (format === 'css') {
        await handleCSS(editor, text);
    } else if (format === 'scss') {
        await handleSCSS(editor, text);
    } else if (format === 'sass') {
        await handleSASS(editor, text);
    } else if (format === 'less') {
        await handleLESS(editor, text);
    } else if (format === 'javascript') {
        await handleJS(editor, text);
    } else if (format === 'typescript') {
        await handleTS(editor, text);
    } else if (format === 'jsx') {
        await handleJSX(editor, text);
    } else if (format === 'tsx') {
        await handleTSX(editor, text);
    } else if (format === 'vue') {
        await handleVue(editor, text);
    } else {
        // If unknown, try JSON first then CSS/XML/HTML
        try {
            jsonrepair(text);
            await handleJSON(editor, text);
        } catch (e) {
            const trimmed = text.trim();
            if (trimmed.startsWith('<')) {
                const lowerText = trimmed.toLowerCase();
                if (lowerText.startsWith('<!doctype html') || lowerText.startsWith('<html')) {
                    await handleHTML(editor, text);
                } else {
                    await handleXML(editor, text);
                }
            } else if (trimmed.includes('{') && trimmed.includes('}')) {
                await handleCSS(editor, text);
            } else {
                vscode.window.showErrorMessage('Could not detect format (JSON, XML, HTML or CSS). Please ensure your file starts with {, [ or <');
            }
        }
    }
}

/**
 * Detect format based on language ID or content
 */
function detectFormat(text: string, languageId: string): 'json' | 'xml' | 'html' | 'css' | 'scss' | 'sass' | 'less' | 'javascript' | 'typescript' | 'jsx' | 'tsx' | 'vue' | 'unknown' {
    const lang = languageId.toLowerCase();
    if (lang === 'json' || lang === 'jsonc') { return 'json'; }
    if (lang === 'xml' || lang === 'xsl') { return 'xml'; }
    if (lang === 'html' || lang === 'htm') { return 'html'; }
    if (lang === 'css') { return 'css'; }
    if (lang === 'scss') { return 'scss'; }
    if (lang === 'sass') { return 'sass'; }
    if (lang === 'less') { return 'less'; }
    if (lang === 'javascript') { return 'javascript'; }
    if (lang === 'javascriptreact') { return 'jsx'; }
    if (lang === 'typescript') { return 'typescript'; }
    if (lang === 'typescriptreact') { return 'tsx'; }
    if (lang === 'vue') { return 'vue'; }

    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) { return 'json'; }
    if (trimmed.includes('<template') || /<script\s+setup/i.test(trimmed) || /<style\s+scoped/i.test(trimmed)) {
        return 'vue';
    }

    if (trimmed.startsWith('<')) {
        // Simple heuristic: if it looks like XML but isn't explicitly,
        // we'll try XML first then HTML in the main loop if unknown.
        // But if we're here, we can check for common HTML tags.
        const lowerText = trimmed.toLowerCase();
        if (lowerText.startsWith('<!doctype html') || lowerText.startsWith('<html')) {
            return 'html';
        }
        return 'xml';
    }

    // SCSS heuristic
    if (trimmed.includes('{') && (trimmed.includes('$') || trimmed.includes('@mixin') || trimmed.includes('@include'))) {
        return 'scss';
    }

    // SASS heuristic
    if (trimmed.startsWith('$') && !trimmed.includes('{')) {
        return 'sass';
    }

    // LESS heuristic
    if (trimmed.includes('{') && (/@([a-z0-9-_]+)\s*:/i.test(trimmed) || /[.][a-z0-9-_]+\s*\(/i.test(trimmed))) {
        return 'less';
    }

    // CSS heuristic: contains { and } and looks like a rule
    if (trimmed.includes('{') && trimmed.includes('}') && /[a-z0-9-_#.]+\s*\{/i.test(trimmed)) {
        return 'css';
    }

    // TSX heuristic
    if (trimmed.includes('<') && (trimmed.includes('/>') || trimmed.includes('</')) &&
        (/\b(interface|type|public|private|protected|readonly|as|implements)\b/.test(trimmed) ||
            /:\s*(string|number|boolean|any|void|unknown|never|object)\b/.test(trimmed))) {
        return 'tsx';
    }

    // JSX heuristic
    if (trimmed.includes('<') && (trimmed.includes('/>') || trimmed.includes('</')) &&
        /\b(import|export|function|const|let|var|return)\b/.test(trimmed)) {
        return 'jsx';
    }

    // TypeScript heuristic
    if (
        /\b(interface|namespace|type|enum|public|private|protected|readonly|as|implements)\b/.test(trimmed) ||
        /:\s*(string|number|boolean|any|void|unknown|never|object)\b/.test(trimmed) ||
        /<[A-Z][A-Za-z0-9]*(\s*,\s*[A-Z][A-Za-z0-9]*)*>/.test(trimmed)
    ) {
        return 'typescript';
    }

    // JavaScript heuristic: common keywords or arrow functions
    if (
        /\b(var|let|const|function|class|import|export|if|for|while|return)\b/.test(trimmed) ||
        /\s*=>\s*/.test(trimmed) ||
        (trimmed.includes('{') && trimmed.includes('}') && trimmed.includes(';'))
    ) {
        return 'javascript';
    }

    return 'unknown';
}

/**
 * Handle JSON formatting and repair
 */
async function handleJSON(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let repairMessage: string | undefined;

    try {
        // Try standard JSON parse
        const parsed = JSON.parse(text);
        formatted = JSON.stringify(parsed, null, 2);
    } catch (originalError: any) {
        // If it fails, try to repair
        try {
            const repairedText = jsonrepair(text);
            const parsed = JSON.parse(repairedText);
            formatted = JSON.stringify(parsed, null, 2);
            repairMessage = originalError.message;
        } catch (repairError: any) {
            vscode.window.showErrorMessage(`Failed to format JSON. Original error: ${originalError.message}`);
            return;
        }
    }

    await applyEdit(editor, formatted);

    if (repairMessage) {
        vscode.window.showWarningMessage(`JSON was invalid but repaired. Original error: ${repairMessage}`);
    } else {
        vscode.window.showInformationMessage('JSON formatted successfully!');
    }
}

/**
 * Handle CSS formatting and validation
 */
async function handleCSS(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate CSS
    try {
        const obj = css.parse(text, { silent: true });
        if (obj.stylesheet && obj.stylesheet.parsingErrors && obj.stylesheet.parsingErrors.length > 0) {
            const firstError = obj.stylesheet.parsingErrors[0];
            validationMessage = `${firstError.reason} at line ${firstError.line}, col ${firstError.column}`;
            if (obj.stylesheet.parsingErrors.length > 1) {
                validationMessage += ` (and ${obj.stylesheet.parsingErrors.length - 1} more errors)`;
            }
        }
    } catch (e: any) {
        validationMessage = e.message;
    }

    /* eslint-disable */
    try {
        // Format CSS
        formatted = jsbeautify.css(text, {
            indent_size: 2,
            indent_char: ' ',
            selector_separator_newline: true,
            newline_between_rules: true,
            end_with_newline: false
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format CSS: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`CSS has syntax issues but was beautified. First error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('CSS formatted successfully!');
    }
}

/**
 * Handle SCSS formatting and validation
 */
async function handleSCSS(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate SCSS
    try {
        sass.compileString(text, { syntax: 'scss' });
    } catch (e: any) {
        if (e.span) {
            validationMessage = `${e.message.split('\n')[0]} at line ${e.span.start.line + 1}, col ${e.span.start.column + 1}`;
        } else {
            validationMessage = e.message;
        }
    }

    /* eslint-disable */
    try {
        // Format SCSS (js-beautify's CSS formatter handles SCSS nesting)
        formatted = jsbeautify.css(text, {
            indent_size: 2,
            indent_char: ' ',
            selector_separator_newline: true,
            newline_between_rules: true,
            end_with_newline: false
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format SCSS: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`SCSS has syntax issues but was beautified. First error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('SCSS formatted successfully!');
    }
}

/**
 * Handle LESS formatting and validation
 */
async function handleLESS(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate LESS
    try {
        await less.render(text);
    } catch (e: any) {
        if (e.line) {
            validationMessage = `${e.message} at line ${e.line}, col ${e.column}`;
        } else {
            validationMessage = e.message;
        }
    }

    /* eslint-disable */
    try {
        // Format LESS (js-beautify's CSS formatter handles LESS nesting and variables)
        formatted = jsbeautify.css(text, {
            indent_size: 2,
            indent_char: ' ',
            selector_separator_newline: true,
            newline_between_rules: true,
            end_with_newline: false
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format LESS: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`LESS has syntax issues but was beautified. First error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('LESS formatted successfully!');
    }
}

/**
 * Handle SASS formatting and validation
 */
async function handleSASS(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate SASS
    try {
        sass.compileString(text, { syntax: 'indented' });
    } catch (e: any) {
        if (e.span) {
            validationMessage = `${e.message.split('\n')[0]} at line ${e.span.start.line + 1}, col ${e.span.start.column + 1}`;
        } else {
            validationMessage = e.message;
        }
    }

    try {
        // Format SASS
        formatted = SassFormatter.Format(text, {
            tabSize: 2,
            insertSpaces: true
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format SASS: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`SASS has syntax issues but was beautified. First error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('SASS formatted successfully!');
    }
}

/**
 * Handle XML formatting and validation
 */
async function handleXML(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate XML to find error location
    const result = XMLValidator.validate(text);
    if (result !== true) {
        validationMessage = `${result.err.msg} at line ${result.err.line}, col ${result.err.col}`;
    }

    try {
        // Format XML (xml-formatter is somewhat lenient and will try to fix issues)
        formatted = xmlFormatter(text, {
            indentation: '  ',
            collapseContent: true,
            lineSeparator: '\n'
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format XML: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`XML was invalid but beautified. Error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('XML formatted successfully!');
    }
}

/**
 * Apply the formatted text to the editor
 */
async function applyEdit(editor: vscode.TextEditor, newText: string) {
    const document = editor.document;
    const firstLine = document.lineAt(0);
    const lastLine = document.lineAt(document.lineCount - 1);
    const textRange = new vscode.Range(firstLine.range.start, lastLine.range.end);

    await editor.edit(editBuilder => {
        editBuilder.replace(textRange, newText);
    });
}

/**
 * This method is called when the extension is deactivated
 */
export function deactivate() {}
