import { format, FormattingOptions } from 'jsonc-parser';

/**
 * Deep Formatter for JSON and JSONC
 * Uses jsonc-parser for robust, comment-preserving formatting.
 */
export function formatJSONDeep(text: string, options: { tabSize?: number, insertSpaces?: boolean } = {}): string {
    const tabSize = options.tabSize || 2;
    const insertSpaces = options.insertSpaces !== false;

    const formatOptions: FormattingOptions = {
        tabSize,
        insertSpaces,
        eol: '\n'
    };

    // Calculate edits using jsonc-parser
    // format(documentText: string, range: Range | undefined, options: FormattingOptions): TextEdit[]
    // Passing undefined for range formats the entire document.
    const edits = format(text, undefined, formatOptions);

    // Apply edits from bottom to top to preserve offsets
    const sortedEdits = edits.sort((a, b) => b.offset - a.offset);

    let formatted = text;
    for (const edit of sortedEdits) {
        formatted = formatted.substring(0, edit.offset) + edit.content + formatted.substring(edit.offset + edit.length);
    }

    return formatted;
}
