import { formatPythonDeep } from './python_deep_formatter';
import { formatMarkdownDeep } from './markdown_deep_formatter';
import { formatJSDeep } from './js_deep_formatter';
import { formatHTMLDeep } from './html_deep_formatter';
import { formatSQLDeep } from './sql_deep_formatter';
import { formatCSSDeep } from './css_deep_formatter';
import { formatRubyDeep } from './ruby_deep_formatter';
import { formatPHPDeep } from './php_deep_formatter';
import { formatGoDeep } from './go_deep_formatter';
import { formatRustDeep } from './rust_deep_formatter';
import { formatJavaDeep } from './java_deep_formatter';
import { formatKotlinDeep } from './kotlin_deep_formatter';
import { formatCDeep } from './c_deep_formatter';
import { formatCppDeep } from './cpp_deep_formatter';

// We need to import jsonrepair dynamically or use require if not using ESM
// But since we are in TS file that compiles to JS/CJS, we can use require for external module if needed,
// or import if supported by tsconfig. markup.ts uses require('jsonrepair').
const { jsonrepair } = require('jsonrepair');

export async function formatIPYNBDeep(text: string): Promise<string> {
    let notebook: any;
    try {
        notebook = JSON.parse(text);
    } catch (e) {
        // Fault-tolerance: try to repair JSON if parsing fails
        try {
            const repairedText = jsonrepair(text);
            notebook = JSON.parse(repairedText);
        } catch (repairError: any) {
            throw new Error(`Invalid Jupyter Notebook JSON: ${repairError.message}`);
        }
    }

    if (!notebook.cells || !Array.isArray(notebook.cells)) {
        // Not a standard notebook structure, return as is (maybe formatted as JSON)
        return JSON.stringify(notebook, null, 1);
    }

    // Lazy load Prettier for Markdown
    let prettier: any;
    try {
        prettier = await import('prettier');
    } catch (e) {
        console.warn('Prettier not available for Markdown cells inside Notebook.');
    }

    // Determine Language
    let language = 'python'; // Default
    if (notebook.metadata) {
        if (notebook.metadata.kernelspec && notebook.metadata.kernelspec.language) {
            language = notebook.metadata.kernelspec.language.toLowerCase();
        } else if (notebook.metadata.language_info && notebook.metadata.language_info.name) {
            language = notebook.metadata.language_info.name.toLowerCase();
        }
    }

    for (const cell of notebook.cells) {
        if (cell.source) {
            let source = '';
            let isArray = Array.isArray(cell.source);

            // Normalize source to string
            if (isArray) {
                source = cell.source.join('');
            } else {
                source = cell.source;
            }

            let formattedSource = source;

            if (cell.cell_type === 'code') {
                try {
                    // Dispatch based on language
                    if (language === 'python') {
                        formattedSource = formatPythonDeep(source);
                    } else if (language === 'javascript' || language === 'js' || language === 'node') {
                        formattedSource = formatJSDeep(source, { tabSize: 2, insertSpaces: true });
                    } else if (language === 'typescript' || language === 'ts') {
                        // formatJSDeep handles TS reasonably well for formatting purposes usually
                        formattedSource = formatJSDeep(source, { tabSize: 2, insertSpaces: true });
                    } else if (language === 'html') {
                        formattedSource = formatHTMLDeep(source);
                    } else if (language === 'sql') {
                        formattedSource = await formatSQLDeep(source);
                    } else if (language === 'css') {
                        formattedSource = formatCSSDeep(source);
                    } else if (language === 'ruby') {
                        formattedSource = formatRubyDeep(source);
                    } else if (language === 'php') {
                        formattedSource = formatPHPDeep(source);
                    } else if (language === 'go') {
                        formattedSource = formatGoDeep(source);
                    } else if (language === 'rust') {
                        formattedSource = formatRustDeep(source);
                    } else if (language === 'java') {
                        formattedSource = formatJavaDeep(source);
                    } else if (language === 'kotlin') {
                        formattedSource = formatKotlinDeep(source);
                    } else if (language === 'c') {
                        formattedSource = formatCDeep(source);
                    } else if (language === 'cpp' || language === 'c++') {
                        formattedSource = formatCppDeep(source);
                    } else {
                        // Unknown language: Keep original source (Safety first)
                        // console.log(`Skipping formatting for unknown language: ${language}`);
                    }
                } catch (e: any) {
                    console.warn(`Failed to format ${language} cell:`, e);
                    // Keep original source if formatting fails
                }
            } else if (cell.cell_type === 'markdown') {
                try {
                    if (prettier) {
                        formattedSource = await prettier.format(source, {
                            parser: "markdown",
                            tabWidth: 2,
                            useTabs: false,
                            proseWrap: "preserve",
                            printWidth: 80,
                        });
                    } else {
                        // Fallback to our deep markdown formatter
                        formattedSource = formatMarkdownDeep(source);
                    }
                } catch (e: any) {
                    console.warn('Failed to format Markdown cell with Prettier:', e);
                    // Try fallback if Prettier failed
                    try {
                        formattedSource = formatMarkdownDeep(source);
                    } catch (fallbackError) {
                        console.warn('Failed to format Markdown cell with fallback:', fallbackError);
                    }
                }
            }

            // Convert back to array of strings if needed
            if (isArray) {
                const lines = formattedSource.split('\n');
                cell.source = lines.map((line, i) => {
                    if (i < lines.length - 1) {
                        return line + '\n';
                    }
                    return line;
                });
            } else {
                cell.source = formattedSource;
            }
        }
    }

    // Jupyter notebooks standardly use 1-space indentation for JSON
    return JSON.stringify(notebook, null, 1);
}
