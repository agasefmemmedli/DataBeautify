import * as vscode from 'vscode';
import { applyEdit } from '../utils';
import { formatJSONDeep } from './json_deep_formatter';

// Helper to load Prettier and Sort Imports Plugin
async function loadPrettier() {
    try {
        const dynamicImport = new Function('specifier', 'return import(specifier)');
        const prettier = await dynamicImport('prettier');
        // Handle namespace objects (Prettier v3 has named exports and a default export)
        // If we get a namespace, prefer .default if it has .format, otherwise fallback
        const prettierInstance = prettier.default || prettier;

        let pluginInstance = null;
        try {
            const sortImportsPlugin = await dynamicImport('@trivago/prettier-plugin-sort-imports');
            pluginInstance = sortImportsPlugin.default || sortImportsPlugin;
        } catch (e) {
            console.warn('Sort imports plugin not found:', e);
        }

        return { prettier: prettierInstance, plugin: pluginInstance };
    } catch (e) {
        console.warn('Prettier failed to load:', e);
        return { prettier: null, plugin: null };
    }
}

/**
 * Handle JavaScript formatting and validation
 */
export async function handleJS(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Get editor options
    const tabSize = editor.options.tabSize as number;
    const insertSpaces = editor.options.insertSpaces as boolean;

    // Lazy load dependencies
    const ts = require('typescript');
    const jsbeautify = require('js-beautify');

    const { prettier, plugin } = await loadPrettier();

    // Validate JavaScript (supports JSX)
    try {
        const sourceFile = ts.createSourceFile('temp.js', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
        const diagnostics = (sourceFile as any).parseDiagnostics;
        if (diagnostics && diagnostics.length > 0) {
            const firstError = diagnostics[0];
            const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, firstError.start!);
            validationMessage = `${ts.flattenDiagnosticMessageText(firstError.messageText, '\n')} at line ${line + 1}, col ${character + 1}`;
        }
    } catch (e: any) {
        validationMessage = e.message;
    }

    try {
        if (!prettier || !prettier.format) throw new Error('Prettier not loaded');

        const plugins = plugin ? [plugin] : [];

        // Format JavaScript with Prettier
        formatted = await prettier.format(text, {
            parser: 'babel',
            plugins: plugins,
            importOrder: ['<THIRD_PARTY_MODULES>', '^[./]'],
            importOrderSeparation: true,
            importOrderSortSpecifiers: true,
            importOrderParserPlugins: ['typescript', 'classProperties', 'decorators-legacy', 'jsx'],
            tabWidth: tabSize,
            useTabs: !insertSpaces,
            semi: true,
            singleQuote: true,
            quoteProps: 'as-needed',
            jsxSingleQuote: false,
            trailingComma: 'es5',
            bracketSpacing: true,
            arrowParens: 'always',
            printWidth: 120,
            endOfLine: 'lf',
            embeddedLanguageFormatting: 'auto'
        });
    } catch (prettierError: any) {
        // Fallback to js-beautify
        try {
            formatted = jsbeautify.js(text, {
                indent_size: tabSize,
                indent_char: insertSpaces ? ' ' : '\t',
                indent_with_tabs: !insertSpaces,
                max_preserve_newlines: 2,
                preserve_newlines: true,
                keep_array_indentation: false,
                break_chained_methods: false,
                brace_style: 'collapse,preserve-inline',
                space_before_conditional: true,
                unescape_strings: false,
                jslint_happy: false,
                end_with_newline: true,
                wrap_line_length: 120,
                comma_first: false,
                e4x: true,
                indent_empty_lines: false,
                space_after_anon_function: true,
                indent_inner_html: true,
                space_in_empty_paren: false,
                space_in_paren: false,
                selector_separator_newline: true
            });
            if (!validationMessage) {
                 validationMessage = `Prettier failed, using fallback. ${prettierError.message.split('\n')[0]}`;
            }
        } catch (beautifyError: any) {
            vscode.window.showErrorMessage(`Failed to format JavaScript: ${beautifyError.message}`);
            return;
        }
    }

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

    // Get editor options
    const tabSize = editor.options.tabSize as number;
    const insertSpaces = editor.options.insertSpaces as boolean;

    // Lazy load dependencies
    const ts = require('typescript');
    const jsbeautify = require('js-beautify');

    const { prettier, plugin } = await loadPrettier();

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

    try {
        if (!prettier || !prettier.format) throw new Error('Prettier not loaded');

        const plugins = plugin ? [plugin] : [];

        // Format TypeScript with Prettier
        formatted = await prettier.format(text, {
            parser: 'typescript',
            plugins: plugins,
            importOrder: ['<THIRD_PARTY_MODULES>', '^[./]'],
            importOrderSeparation: true,
            importOrderSortSpecifiers: true,
            importOrderParserPlugins: ['typescript', 'classProperties', 'decorators-legacy', 'jsx'],
            tabWidth: tabSize,
            useTabs: !insertSpaces,
            semi: true,
            singleQuote: true,
            quoteProps: 'as-needed',
            jsxSingleQuote: false,
            trailingComma: 'es5',
            bracketSpacing: true,
            arrowParens: 'always',
            printWidth: 120,
            endOfLine: 'lf',
            embeddedLanguageFormatting: 'auto'
        });
    } catch (prettierError: any) {
        // Fallback to js-beautify
        try {
             formatted = jsbeautify.js(text, {
                indent_size: tabSize,
                indent_char: insertSpaces ? ' ' : '\t',
                indent_with_tabs: !insertSpaces,
                max_preserve_newlines: 2,
                preserve_newlines: true,
                keep_array_indentation: false,
                break_chained_methods: false,
                brace_style: 'collapse,preserve-inline',
                space_before_conditional: true,
                unescape_strings: false,
                jslint_happy: false,
                end_with_newline: true,
                wrap_line_length: 120,
                comma_first: false,
                e4x: true,
                indent_empty_lines: false,
                space_after_anon_function: true,
                indent_inner_html: true,
                space_in_empty_paren: false,
                space_in_paren: false,
                selector_separator_newline: true
            });
            if (!validationMessage) {
                 validationMessage = `Prettier failed, using fallback. ${prettierError.message.split('\n')[0]}`;
            }
        } catch (beautifyError: any) {
            vscode.window.showErrorMessage(`Failed to format TypeScript: ${beautifyError.message}`);
            return;
        }
    }

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

    // Get editor options
    const tabSize = editor.options.tabSize as number;
    const insertSpaces = editor.options.insertSpaces as boolean;

    // Lazy load dependencies
    const ts = require('typescript');
    const jsbeautify = require('js-beautify');

    const { prettier, plugin } = await loadPrettier();

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

    try {
        if (!prettier || !prettier.format) throw new Error('Prettier not loaded');

        const plugins = plugin ? [plugin] : [];

        // Format TSX with Prettier
        formatted = await prettier.format(text, {
            parser: 'typescript',
            plugins: plugins,
            importOrder: ['<THIRD_PARTY_MODULES>', '^[./]'],
            importOrderSeparation: true,
            importOrderSortSpecifiers: true,
            importOrderParserPlugins: ['typescript', 'classProperties', 'decorators-legacy', 'jsx'],
            tabWidth: tabSize,
            useTabs: !insertSpaces,
            semi: true,
            singleQuote: true,
            quoteProps: 'as-needed',
            jsxSingleQuote: false,
            trailingComma: 'es5',
            bracketSpacing: true,
            bracketSameLine: false,
            arrowParens: 'always',
            printWidth: 120,
            endOfLine: 'lf',
            embeddedLanguageFormatting: 'auto'
        });
    } catch (prettierError: any) {
         // Fallback to js-beautify
        try {
             formatted = jsbeautify.js(text, {
                indent_size: tabSize,
                indent_char: insertSpaces ? ' ' : '\t',
                indent_with_tabs: !insertSpaces,
                max_preserve_newlines: 2,
                preserve_newlines: true,
                keep_array_indentation: false,
                break_chained_methods: false,
                brace_style: 'collapse,preserve-inline',
                space_before_conditional: true,
                unescape_strings: false,
                jslint_happy: false,
                end_with_newline: true,
                wrap_line_length: 120,
                comma_first: false,
                e4x: true,
                indent_empty_lines: false,
                space_after_anon_function: true,
                indent_inner_html: true
            });
            if (!validationMessage) {
                 validationMessage = `Prettier failed, using fallback. ${prettierError.message.split('\n')[0]}`;
            }
        } catch (beautifyError: any) {
            vscode.window.showErrorMessage(`Failed to format TSX: ${beautifyError.message}`);
            return;
        }
    }

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

    // Get editor options
    const tabSize = editor.options.tabSize as number;
    const insertSpaces = editor.options.insertSpaces as boolean;

    // Lazy load dependencies
    const ts = require('typescript');
    const jsbeautify = require('js-beautify');

    const { prettier, plugin } = await loadPrettier();

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

    try {
        if (!prettier || !prettier.format) throw new Error('Prettier not loaded');

        const plugins = plugin ? [plugin] : [];

        // Format JSX with Prettier
        formatted = await prettier.format(text, {
            parser: 'babel',
            plugins: plugins,
            importOrder: ['<THIRD_PARTY_MODULES>', '^[./]'],
            importOrderSeparation: true,
            importOrderSortSpecifiers: true,
            importOrderParserPlugins: ['typescript', 'classProperties', 'decorators-legacy', 'jsx'],
            tabWidth: tabSize,
            useTabs: !insertSpaces,
            semi: true,
            singleQuote: true,
            trailingComma: 'es5',
            bracketSpacing: true,
            arrowParens: 'always',
            printWidth: 120,
            endOfLine: 'lf',
            jsxSingleQuote: false,
            bracketSameLine: false
        });
    } catch (prettierError: any) {
         // Fallback to js-beautify
        try {
             formatted = jsbeautify.js(text, {
                indent_size: tabSize,
                indent_char: insertSpaces ? ' ' : '\t',
                indent_with_tabs: !insertSpaces,
                max_preserve_newlines: 2,
                preserve_newlines: true,
                keep_array_indentation: false,
                break_chained_methods: false,
                brace_style: 'collapse,preserve-inline',
                space_before_conditional: true,
                unescape_strings: false,
                jslint_happy: false,
                end_with_newline: true,
                wrap_line_length: 120,
                comma_first: false,
                e4x: true,
                indent_empty_lines: false,
                space_after_anon_function: true,
                indent_inner_html: true
            });
            if (!validationMessage) {
                 validationMessage = `Prettier failed, using fallback. ${prettierError.message.split('\n')[0]}`;
            }
        } catch (beautifyError: any) {
            vscode.window.showErrorMessage(`Failed to format JSX: ${beautifyError.message}`);
            return;
        }
    }

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

    const { prettier } = await loadPrettier();

    // Validate JSONC using jsonc-parser
    const errors: typeof ParseError[] = [];
    parse(text, errors);
    if (errors.length > 0) {
        const error = errors[0];
        const { line, character } = editor.document.positionAt(error.offset);
        validationMessage = `Invalid JSONC at line ${line + 1}, col ${character + 1}`;
    }

    // Try Prettier First (Standard)
    try {
        if (!prettier || !prettier.format) throw new Error('Prettier not loaded');

        // Format JSONC
        formatted = await prettier.format(text, {
            parser: 'json',
            tabWidth: tabSize,
            useTabs: !insertSpaces,
            printWidth: 120,
            endOfLine: 'lf'
        });

        await applyEdit(editor, formatted);
        vscode.window.showInformationMessage('JSONC formatted successfully!');
        return;
    } catch (prettierError: any) {
        // Fallback to Deep Formatting (Fault Tolerant)
        try {
            formatted = formatJSONDeep(text, { tabSize, insertSpaces, isJSONC: true });
            await applyEdit(editor, formatted);

            if (validationMessage) {
                vscode.window.showWarningMessage(`JSONC has syntax issues but was beautified. Error: ${validationMessage}`);
            } else {
                vscode.window.showInformationMessage('JSONC formatted successfully (resilient mode)!');
            }
            return;
        } catch (deepError: any) {
            // Fallback to js-beautify
            try {
                 formatted = jsbeautify.js(text, {
                    indent_size: tabSize,
                    indent_char: insertSpaces ? ' ' : '\t',
                    indent_with_tabs: !insertSpaces,
                    max_preserve_newlines: 2,
                    preserve_newlines: true,
                    keep_array_indentation: false,
                    break_chained_methods: false,
                    brace_style: 'collapse,preserve-inline',
                    space_before_conditional: true,
                    unescape_strings: false,
                    jslint_happy: false,
                    end_with_newline: true,
                    wrap_line_length: 120,
                    comma_first: false,
                    e4x: true,
                    indent_empty_lines: false
                });
                 if (!validationMessage) {
                     validationMessage = `Prettier failed, using fallback. ${prettierError.message.split('\n')[0]}`;
                }
            } catch (beautifyError: any) {
                vscode.window.showErrorMessage(`Failed to format JSONC: ${beautifyError.message}`);
                return;
            }
        }
    }

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

    const { prettier } = await loadPrettier();

    // Try standard JSON parse for validation
    try {
        JSON.parse(text);
    } catch (originalError: any) {
        repairMessage = originalError.message;
    }

    // Try Prettier (Standard) First
    try {
        // Try standard JSON parse
        JSON.parse(text);

        if (!prettier || !prettier.format) throw new Error('Prettier not loaded');

        // If successful, format with prettier
        formatted = await prettier.format(text, {
            parser: 'json',
            tabWidth: tabSize,
            useTabs: !insertSpaces,
            printWidth: 120,
            endOfLine: 'lf'
        });

        await applyEdit(editor, formatted);
        vscode.window.showInformationMessage('JSON formatted successfully!');
        return;
    } catch (originalError: any) {
        // If Prettier/Parse fails, try Deep Formatting (Fault Tolerant)
        try {
            // We use isJSONC: false to try to enforce strictness, but formatJSONDeep is resilient
            formatted = formatJSONDeep(text, { tabSize, insertSpaces, isJSONC: false });
            await applyEdit(editor, formatted);

            vscode.window.showWarningMessage(`JSON was invalid but beautified. Original error: ${originalError.message}`);
            return;
        } catch (deepError: any) {
            // If Deep fails, try jsonrepair (Aggressive Fix)
            try {
                const repairedText = jsonrepair(text);
                // Verify repair worked by parsing
                const parsed = JSON.parse(repairedText);
                // Format the repaired JSON
                const minified = JSON.stringify(parsed);

                if (prettier && prettier.format) {
                    formatted = await prettier.format(minified, {
                        parser: 'json',
                        tabWidth: tabSize,
                        useTabs: !insertSpaces,
                        printWidth: 120,
                        endOfLine: 'lf'
                    });
                } else {
                    throw new Error('Prettier not loaded for repair');
                }

                await applyEdit(editor, formatted);
                vscode.window.showWarningMessage(`JSON was invalid but repaired (comments may be lost). Original error: ${originalError.message}`);
                return;
            } catch (repairError: any) {
                // Fallback to js-beautify
             try {
                formatted = jsbeautify.js(text, {
                    indent_size: tabSize,
                    indent_char: insertSpaces ? ' ' : '\t',
                    indent_with_tabs: !insertSpaces,
                    preserve_newlines: false,
                    brace_style: 'collapse',
                    wrap_line_length: 120
                });
                repairMessage = `Prettier failed, using fallback. ${repairMessage || repairError.message}`;
             } catch (beautifyError: any) {
                vscode.window.showErrorMessage(`Failed to format JSON: ${beautifyError.message}`);
                return;
             }
        }
    }

    await applyEdit(editor, formatted);

    if (repairMessage) {
        vscode.window.showWarningMessage(`JSON was invalid but repaired. Original error: ${repairMessage}`);
    } else {
        vscode.window.showInformationMessage('JSON formatted successfully!');
    }
}
