export interface IndentOptions {
    tabSize: number;
    insertSpaces: boolean;
}

export interface FormatResult {
    text: string;
    // The input had syntax errors and the output is an auto-fixed version
    repaired: boolean;
    // Description of the first syntax error in the input (when repaired)
    issue?: string;
    // Comments had to be dropped to produce a valid result
    commentsRemoved?: boolean;
    // The fix is a guess that may change values: ask the user before applying
    needsConfirmation?: boolean;
}

// Thrown when the document cannot be formatted safely. The document must be left unchanged.
export class FormatError extends Error {}

export function indentString(opts: IndentOptions): string {
    return opts.insertSpaces ? ' '.repeat(opts.tabSize) : '\t';
}

export function lineColumn(text: string, offset: number): string {
    const before = text.slice(0, offset).split('\n');
    return `line ${before.length}, column ${before[before.length - 1].length + 1}`;
}
