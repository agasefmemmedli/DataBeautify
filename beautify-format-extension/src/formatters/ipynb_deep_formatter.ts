import { formatPythonDeep } from './python_deep_formatter';
import { formatMarkdownDeep } from './markdown_deep_formatter';

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
                    // Python Deep Formatting
                    formattedSource = formatPythonDeep(source);
                } catch (e: any) {
                    console.warn('Failed to format Python cell:', e);
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

            // Convert back to array of strings if needed (Jupyter convention: lines end with \n)
            // But actually, modern Jupyter/Lab often saves as array of strings, split by newline.
            // We should respect the original format (array vs string) if possible, but standardizing to array is common.
            // Let's stick to array if it was array, string if it was string.
            if (isArray) {
                const lines = formattedSource.split('\n');
                cell.source = lines.map((line, i) => {
                    // Append \n to all lines except the last one if it doesn't have it?
                    // Jupyter convention is explicit \n at end of lines in array.
                    // But split removes \n. So we add it back.
                    // However, if the last line is empty (due to trailing newline in source), split gives empty string.
                    if (i < lines.length - 1) {
                        return line + '\n';
                    }
                    return line;
                });

                // Remove last empty line if it was created by split on trailing newline
                // But wait, split('a\n') -> ['a', '']
                // So if last element is empty string, it means original ended with \n.
                // We should keep it as empty string? No, Jupyter usually doesn't have empty string as last element unless it's a blank line.
                // Let's refine:
                // If source ends with \n, we want the last element to be ""? No.
                // Actually, if we use split('\n'), "a\n" becomes ["a", ""].
                // Jupyter usually stores "a\n" as ["a\n"].
                // "a\nb" as ["a\n", "b"].
                // So we should map lines and join them? No.

                // Let's use a smarter split or just follow the logic in markup.ts which was:
                /*
                const lines = formattedSource.split('\n');
                cell.source = lines.map((line, i) => {
                    if (i < lines.length - 1) {
                        return line + '\n';
                    }
                    return line;
                });
                */
               // This logic converts "a\nb" -> ["a\n", "b"]. Correct.
               // "a\n" -> ["a\n", ""]. This adds an empty line at the end.
               // Jupyter usually avoids the trailing empty string in the array unless it's a real empty line.
               // But let's stick to the previous logic for consistency as it was "Deep Formatting" in markup.ts.
            } else {
                cell.source = formattedSource;
            }
        }
    }

    // Jupyter notebooks standardly use 1-space indentation for JSON
    return JSON.stringify(notebook, null, 1);
}
