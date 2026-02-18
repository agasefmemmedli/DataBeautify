import * as vscode from 'vscode';
import { applyEdit } from '../utils';

/**
 * Handle JavaScript formatting and validation
 */
export async function handleJS(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Lazy load dependencies
    const acorn = require('acorn');
    const jsbeautify = require('js-beautify');

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
 * Handle TypeScript formatting and validation
 */
export async function handleTS(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Lazy load dependencies
    const ts = require('typescript');
    const jsbeautify = require('js-beautify');

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
export async function handleTSX(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Lazy load dependencies
    const ts = require('typescript');
    const jsbeautify = require('js-beautify');

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
export async function handleJSX(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Lazy load dependencies
    const ts = require('typescript');
    const jsbeautify = require('js-beautify');

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
 * Handle JSONC formatting and validation
 */
export async function handleJSONC(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Get editor options
    const tabSize = editor.options.tabSize as number;
    const insertSpaces = editor.options.insertSpaces as boolean;

    // Lazy load dependencies
    const { parse, ParseError } = require('jsonc-parser');
    const jsbeautify = require('js-beautify');

    // Validate JSONC using jsonc-parser
    const errors: typeof ParseError[] = [];
    parse(text, errors);
    if (errors.length > 0) {
        const error = errors[0];
        const { line, character } = editor.document.positionAt(error.offset);
        validationMessage = `Invalid JSONC at line ${line + 1}, col ${character + 1}`;
    }

    /* eslint-disable */
    try {
        // Format JSONC using js-beautify's JS formatter (preserves comments)
        formatted = jsbeautify.js(text, {
            indent_size: tabSize,
            indent_char: insertSpaces ? ' ' : '\t',
            indent_with_tabs: !insertSpaces,
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
        vscode.window.showErrorMessage(`Failed to format JSONC: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`JSONC has syntax issues but was beautified. Error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('JSONC formatted successfully!');
    }
}

/**
 * Handle JSON formatting and repair
 */
export async function handleJSON(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let repairMessage: string | undefined;

    // Get editor options
    const tabSize = editor.options.tabSize as number;
    const insertSpaces = editor.options.insertSpaces as boolean;

    // Lazy load dependencies
    const { jsonrepair } = require('jsonrepair');
    const jsbeautify = require('js-beautify');

    try {
        // Try standard JSON parse
        JSON.parse(text);
        // If successful, use js-beautify for deep formatting (indentation, style)
        formatted = jsbeautify.js(text, {
            indent_size: tabSize,
            indent_char: insertSpaces ? ' ' : '\t',
            indent_with_tabs: !insertSpaces,
            max_preserve_newlines: 2,
            preserve_newlines: false, // Strict JSON usually collapses whitespace unless string
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
    } catch (originalError: any) {
        // If it fails, try to repair
        try {
            const repairedText = jsonrepair(text);
            // Verify repair worked by parsing
            const parsed = JSON.parse(repairedText);
            // Format the repaired JSON
            const minified = JSON.stringify(parsed);
            formatted = jsbeautify.js(minified, {
                indent_size: tabSize,
                indent_char: insertSpaces ? ' ' : '\t',
                indent_with_tabs: !insertSpaces,
                preserve_newlines: false,
                brace_style: 'collapse',
                wrap_line_length: 0
            });
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
