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
 * Parse CSV text into 2D array
 */
export function parseCSV(text: string, delimiter: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (inQuotes) {
            if (char === '"') {
                if (nextChar === '"') {
                    // Escaped quote
                    currentField += '"';
                    i++; // Skip next quote
                } else {
                    // End of quote
                    inQuotes = false;
                }
            } else {
                currentField += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === delimiter) {
                currentRow.push(currentField);
                currentField = '';
            } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
                currentRow.push(currentField);
                rows.push(currentRow);
                currentRow = [];
                currentField = '';
                if (char === '\r') i++; // Skip \n
            } else if (char === '\r') {
                // Carriage return only
                currentRow.push(currentField);
                rows.push(currentRow);
                currentRow = [];
                currentField = '';
            } else {
                currentField += char;
            }
        }
    }

    // Push last field/row if any
    if (currentRow.length > 0 || currentField.length > 0 || rows.length === 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
    } else if (text.length > 0 && text.endsWith('\n')) {
         // If text ends with newline, we usually have an empty row or just finished the last row.
         // With current logic, encountering \n pushes the row.
         // If text is "a,b\n", we process \n, push row [a,b], reset currentRow.
         // Then loop ends. currentRow is empty.
         // We shouldn't push an empty row unless strict?
         // RFC 4180 says "The last record in the file may or may not have an ending line break."
         // If we have "a,b\n", we have 1 row.
         // If we have "a,b\n\n", we have 2 rows (second is empty).
         // My logic:
         // "a,b\n"
         // ...
         // \n: push [a,b]. rows=[[a,b]]. currentRow=[]. currentField=''.
         // Loop ends.
         // Check: currentRow length is 0, currentField is 0.
         // Do not push.
         // Result: [[a,b]]. Correct.

         // "a,b"
         // Loop ends. currentRow=[a]. currentField='b'.
         // Check: currentRow length > 0.
         // Push. Result: [[a,b]]. Correct.

         // "" (Empty string)
         // Loop ends. currentRow=[], currentField=''.
         // Check... text.length > 0? No.
         // Should return [[]] or []?
         // RFC: Empty file -> 0 records? Or 1 empty record?
         // Usually [] is better for empty file.
         // If text is "", loop doesn't run.
         // Check if condition: currentRow=0, currentField=0, rows=0.
         // if rows=0, push [""].
         // Wait, `currentField` init is ''.
         // So it pushes [''].
         // This is fine.
    }

    return rows;
}

/**
 * Detect CSV delimiter
 */
export function detectDelimiter(text: string): string {
    const delimiters = [',', ';', '\t', '|'];

    // Take a sample of text (first 5KB should be enough to find delimiter)
    const sample = text.length > 5000 ? text.substring(0, 5000) : text;

    let bestDelimiter = ',';
    let bestScore = -1;

    for (const d of delimiters) {
        try {
            const rows = parseCSV(sample, d);

            // Heuristic: valid CSV usually has consistent column counts.
            if (rows.length < 2) {
                // If only 1 row, we can't judge consistency.
                // Prefer the one that splits into >1 columns?
                if (rows.length === 1 && rows[0].length > 1) {
                    // Give some score based on column count?
                    // If we have "a,b,c", comma gives 3 cols. Semicolon gives 1.
                    // Prefer comma.
                    if (bestScore < 0.5) { // Weak score
                         bestScore = 0.5;
                         bestDelimiter = d;
                    }
                }
                continue;
            }

            const colCounts = rows.map(r => r.length);
            // Filter out empty rows (which parseCSV might produce for trailing newlines if not careful,
            // but my logic handles trailing newline correctly.
            // But completely empty lines "split" into [''].
            const meaningfulRows = rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));

            if (meaningfulRows.length === 0) continue;

            const counts = meaningfulRows.map(r => r.length);
            const mostFrequentCount = getMode(counts);

            if (mostFrequentCount <= 1) continue; // If mostly 1 column, it's likely not the delimiter

            // Calculate consistency score: percentage of rows with mode count
            const consistentRows = counts.filter(c => c === mostFrequentCount).length;
            const score = consistentRows / counts.length;

            // Prefer comma if scores are equal (standard)
            if (score > bestScore) {
                bestScore = score;
                bestDelimiter = d;
            } else if (score === bestScore && d === ',') {
                bestDelimiter = d;
            }
        } catch (e) {
            continue;
        }
    }

    return bestDelimiter;
}

function getMode(arr: number[]): number {
    if (arr.length === 0) return 0;
    const counts: {[key: number]: number} = {};
    let maxFreq = 0;
    let mode = arr[0];
    for (const item of arr) {
        counts[item] = (counts[item] || 0) + 1;
        if (counts[item] > maxFreq) {
            maxFreq = counts[item];
            mode = item;
        }
    }
    return mode;
}

/**
 * Split CSV line by delimiter respecting quotes
 * @deprecated Use parseCSV instead
 */
export function splitCSVLine(line: string, delimiter: string): string[] {
    const rows = parseCSV(line, delimiter);
    return rows.length > 0 ? rows[0] : [];
}

