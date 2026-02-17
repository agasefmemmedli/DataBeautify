import * as vscode from 'vscode';

/**
 * Apply the formatted text to the editor
 */
export async function applyEdit(editor: vscode.TextEditor, newText: string) {
    const document = editor.document;
    const firstLine = document.lineAt(0);
    const lastLine = document.lineAt(document.lineCount - 1);
    const textRange = new vscode.Range(firstLine.range.start, lastLine.range.end);

    await editor.edit(editBuilder => {
        editBuilder.replace(textRange, newText);
    });
}

/**
 * Detect CSV delimiter
 */
export function detectDelimiter(text: string): string {
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
export function splitCSVLine(line: string, delimiter: string): string[] {
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
