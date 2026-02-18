import * as vscode from 'vscode';
import { applyEdit, loadESM } from '../utils';

/**
 * Handle XML formatting and validation
 */
export async function handleXML(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Lazy load dependencies
    const { XMLValidator } = require('fast-xml-parser');
    const xmlFormatter = require('xml-formatter');

    // Validate XML to find error location
    const result = XMLValidator.validate(text);
    if (result !== true) {
        validationMessage = `${result.err.msg} at line ${result.err.line}, col ${result.err.col}`;
    }

    try {
        // Get indentation options from editor
        const tabSize = editor.options.tabSize;
        const insertSpaces = editor.options.insertSpaces;
        const indentation = insertSpaces ? ' '.repeat(Number(tabSize) || 2) : '\t';

        // Format XML (xml-formatter is somewhat lenient and will try to fix issues)
        formatted = xmlFormatter(text, {
            indentation,
            collapseContent: true,
            lineSeparator: '\n',
            whiteSpaceAtEndOfSelfclosingTag: true,
            forceSelfClosingEmptyTag: true
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
 * Handle SVG formatting and validation
 */
export async function handleSVG(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Lazy load dependencies
    const { XMLValidator } = require('fast-xml-parser');
    const xmlFormatter = require('xml-formatter');

    // Validate SVG (as XML)
    const result = XMLValidator.validate(text);
    if (result !== true) {
        validationMessage = `${result.err.msg} at line ${result.err.line}, col ${result.err.col}`;
    }

    try {
        // Format SVG using xml-formatter
        formatted = xmlFormatter(text, {
            indentation: '  ',
            collapseContent: true,
            lineSeparator: '\n',
            whiteSpaceAtEndOfSelfclosingTag: true
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format SVG: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`SVG has syntax issues but was beautified. Error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('SVG formatted successfully!');
    }
}

/**
 * Handle HTML formatting and validation
 */
export async function handleHTML(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Lazy load dependencies
    const { HTMLHint } = require('htmlhint');
    const jsbeautify = require('js-beautify');

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
            max_preserve_newlines: 1, // Stricter vertical spacing
            preserve_newlines: true,
            indent_scripts: 'normal', // Indent script content
            end_with_newline: true, // Ensure file ends with newline (standard)
            wrap_line_length: 120, // Enforce line length
            indent_inner_html: true, // Indent <head> and <body> content
            extra_liners: ['head', 'body', '/html', 'html', 'doctype'], // Ensure structural tags are on new lines
            unformatted: ['a', 'span', 'img', 'code', 'pre', 'sub', 'sup', 'em', 'strong', 'b', 'i', 'u', 'strike', 'big', 'small', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'], // Inline elements
            wrap_attributes: 'force-aligned', // Wrap attributes if line is too long
            wrap_attributes_indent_size: 2
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
 * Handle CSS formatting and validation
 */
export async function handleCSS(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Lazy load dependencies
    const css = require('css');
    const jsbeautify = require('js-beautify');

    // Validate CSS
    let ast: any;
    try {
        ast = css.parse(text, { silent: true });
        if (ast.stylesheet && ast.stylesheet.parsingErrors && ast.stylesheet.parsingErrors.length > 0) {
            const firstError = ast.stylesheet.parsingErrors[0];
            validationMessage = `${firstError.reason} at line ${firstError.line}, col ${firstError.column}`;
            if (ast.stylesheet.parsingErrors.length > 1) {
                validationMessage += ` (and ${ast.stylesheet.parsingErrors.length - 1} more errors)`;
            }
        }
    } catch (e: any) {
        validationMessage = e.message;
    }

    let cssTextToFormat = text;

    // If no errors, normalize with css.stringify to add semicolons and fix structure
    if (!validationMessage && ast && (!ast.stylesheet.parsingErrors || ast.stylesheet.parsingErrors.length === 0)) {
        try {
            const stringified = css.stringify(ast, { compress: false });
            if (stringified) {
                cssTextToFormat = stringified;
            }
        } catch (e) {
            // If stringify fails, fallback to original text
            console.error('CSS stringify failed:', e);
        }
    }

    /* eslint-disable */
    try {
        // Format CSS
        formatted = jsbeautify.css(cssTextToFormat, {
            indent_size: 2,
            indent_char: ' ',
            selector_separator_newline: true,
            newline_between_rules: true,
            end_with_newline: true,
            preserve_newlines: true,
            max_preserve_newlines: 1,
            space_around_combinator: true,
            space_around_selector_separator: true
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
export async function handleSCSS(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Lazy load dependencies
    const sass = require('sass');
    const jsbeautify = require('js-beautify');

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
            end_with_newline: true,
            preserve_newlines: true,
            max_preserve_newlines: 1,
            space_around_combinator: true,
            space_around_selector_separator: true
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
 * Handle SASS formatting and validation
 */
export async function handleSASS(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Lazy load dependencies
    const sass = require('sass');
    const { SassFormatter } = require('sass-formatter');

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
            insertSpaces: true,
            setPropertySpace: true,
            deleteEmptyRows: false,
            lineEnding: 'LF'
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
 * Handle LESS formatting and validation
 */
export async function handleLESS(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Lazy load dependencies
    const less = require('less');
    const jsbeautify = require('js-beautify');

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
            end_with_newline: true,
            preserve_newlines: true,
            max_preserve_newlines: 1,
            space_around_combinator: true,
            space_around_selector_separator: true
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
 * Handle Vue formatting and validation
 */
export async function handleVue(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Get editor options
    const tabSize = editor.options.tabSize as number;
    const insertSpaces = editor.options.insertSpaces as boolean;

    // Lazy load dependencies
    const { HTMLHint } = require('htmlhint');
    const jsbeautify = require('js-beautify');
    let prettier: any;
    try {
        prettier = await loadESM('prettier');
    } catch (e) {
        console.warn('Prettier failed to load:', e);
    }

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

    try {
        if (!prettier) {
            throw new Error('Prettier module not available');
        }

        // Format Vue with Prettier (Deep Formatting)
        // Use prettier.format (preferred) or prettier.default.format (fallback/legacy)
        const format = prettier.format || (prettier.default && prettier.default.format);
        if (!format) {
            throw new Error('Prettier format function not found');
        }

        formatted = await format(text, {
            parser: 'vue',
            tabWidth: tabSize,
            useTabs: !insertSpaces,
            printWidth: 120,
            singleQuote: false, // Vue standard is usually double quotes in template
            htmlWhitespaceSensitivity: 'ignore', // To fix indentation
            vueIndentScriptAndStyle: false, // Standard Vue style guide: script and style tags content not indented relative to tag
            endOfLine: 'lf',
            bracketSameLine: false
        });
    } catch (prettierError: any) {
         // Fallback to js-beautify
        try {
            // Format Vue (using js-beautify's HTML formatter)
            const options: any = {
                indent_size: tabSize,
                indent_char: insertSpaces ? ' ' : '\t',
                max_preserve_newlines: 2,
                preserve_newlines: true,
                indent_scripts: 'normal',
                end_with_newline: false,
                wrap_line_length: 0,
                indent_inner_html: false,
                js: {
                    indent_size: tabSize,
                    indent_char: insertSpaces ? ' ' : '\t',
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
                    indent_size: tabSize,
                    indent_char: insertSpaces ? ' ' : '\t',
                    selector_separator_newline: true,
                    newline_between_rules: true,
                    end_with_newline: false
                }
            };
            formatted = jsbeautify.html(text, options);
             if (!validationMessage) {
                 validationMessage = `Prettier failed, using fallback. ${prettierError.message.split('\n')[0]}`;
            }
        } catch (beautifyError: any) {
            vscode.window.showErrorMessage(`Failed to format Vue: ${beautifyError.message}`);
            return;
        }
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Vue has syntax issues but was beautified. Error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Vue formatted successfully!');
    }
}

/**
 * Handle Svelte formatting and validation
 */
export async function handleSvelte(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Get editor options
    const tabSize = editor.options.tabSize as number;
    const insertSpaces = editor.options.insertSpaces as boolean;

    // Lazy load dependencies
    const svelte = require('svelte/compiler');
    const jsbeautify = require('js-beautify');

    // Lazy load Prettier and plugin
    let prettier: any;
    let sveltePlugin: any;
    try {
        prettier = await loadESM('prettier');
        sveltePlugin = await loadESM('prettier-plugin-svelte');
    } catch (e) {
        console.warn('Prettier or Svelte plugin failed to load:', e);
    }

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

    try {
        if (!prettier || !sveltePlugin) {
            throw new Error('Prettier or Svelte plugin not available');
        }

        const format = prettier.format || (prettier.default && prettier.default.format);
        if (!format) {
            throw new Error('Prettier format function not found');
        }

        // Deep Formatting with Prettier
        formatted = await format(text, {
            parser: 'svelte',
            plugins: [sveltePlugin],
            tabWidth: tabSize,
            useTabs: !insertSpaces,
            printWidth: 120,
            singleQuote: false,
            bracketSameLine: false,
            svelteSortOrder: 'options-scripts-markup-styles',
            svelteStrictMode: false,
            svelteAllowShorthand: true,
            svelteIndentScriptAndStyle: true
        });

    } catch (prettierError: any) {
        /* eslint-disable */
        try {
            // Fallback to js-beautify's HTML formatter
            const options: any = {
                indent_size: tabSize,
                indent_char: insertSpaces ? ' ' : '\t',
                max_preserve_newlines: 2,
                preserve_newlines: true,
                indent_scripts: 'normal',
                end_with_newline: false,
                wrap_line_length: 0,
                indent_inner_html: false,
                js: {
                    indent_size: tabSize,
                    indent_char: insertSpaces ? ' ' : '\t',
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
                    indent_size: tabSize,
                    indent_char: insertSpaces ? ' ' : '\t',
                    selector_separator_newline: true,
                    newline_between_rules: true,
                    end_with_newline: false
                }
            };
            formatted = jsbeautify.html(text, options);
            if (!validationMessage) {
                validationMessage = `Prettier failed, using fallback. ${prettierError.message.split('\n')[0]}`;
            }
        } catch (beautifyError: any) {
            vscode.window.showErrorMessage(`Failed to format Svelte: ${beautifyError.message}`);
            return;
        }
        /* eslint-enable */
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Svelte has syntax issues but was beautified. Message: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Svelte formatted successfully!');
    }
}

/**
 * Handle PHP formatting and validation
 */
export async function handlePHP(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Get editor options
    const tabSize = editor.options.tabSize as number;
    const insertSpaces = editor.options.insertSpaces as boolean;

    // Lazy load dependencies
    const phpParser = require('php-parser');
    const jsbeautify = require('js-beautify');

    // Lazy load Prettier and plugin
    let prettier: any;
    let phpPlugin: any;
    try {
        prettier = await loadESM('prettier');
        phpPlugin = await loadESM('@prettier/plugin-php');
    } catch (e) {
        console.warn('Prettier or PHP plugin failed to load:', e);
    }

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

    try {
        if (!prettier || !phpPlugin) {
            throw new Error('Prettier or PHP plugin not available');
        }

        const format = prettier.format || (prettier.default && prettier.default.format);
        if (!format) {
            throw new Error('Prettier format function not found');
        }

        // Deep Formatting with Prettier (PSR-12 compliant)
        formatted = await format(text, {
            parser: 'php',
            plugins: [phpPlugin],
            tabWidth: tabSize || 4,
            useTabs: !insertSpaces,
            printWidth: 120,
            singleQuote: false,
            bracketSameLine: false
        });

    } catch (prettierError: any) {
        /* eslint-disable */
        try {
            // Fallback to js-beautify's HTML formatter
            const options: any = {
                indent_size: tabSize,
                indent_char: insertSpaces ? ' ' : '\t',
                max_preserve_newlines: 2,
                preserve_newlines: true,
                indent_scripts: 'normal',
                end_with_newline: false,
                wrap_line_length: 0,
                indent_inner_html: false,
                templating: ['php']
            };
            formatted = jsbeautify.html(text, options);
            if (!validationMessage) {
                validationMessage = `Prettier failed, using fallback. ${prettierError.message.split('\n')[0]}`;
            }
        } catch (beautifyError: any) {
            vscode.window.showErrorMessage(`Failed to format PHP: ${beautifyError.message}`);
            return;
        }
        /* eslint-enable */
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`PHP has syntax issues but was beautified. Message: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('PHP formatted successfully!');
    }
}
