
import { detectDelimiter } from '../utils';

/**
 * Format CSV Deep (Aligned Columns)
 */
/**
 * Validate CSV for consistency
 */
export function validateCSV(text: string): string | undefined {
    const delimiter = detectDelimiter(text);
    const rows = parseCSV(text, delimiter);

    const meaningfulRows = rows.filter(r => r.length > 0 && (r.length > 1 || r[0].trim() !== ''));
    if (meaningfulRows.length > 0) {
        const headerCount = meaningfulRows[0].length;
        for (let i = 0; i < meaningfulRows.length; i++) {
            if (meaningfulRows[i].length !== headerCount) {
                return `Inconsistent column count (expected ${headerCount}, got ${meaningfulRows[i].length}) at row ${i + 1}`;
            }
        }
    }
    return undefined;
}

export function formatCSVDeep(text: string): string {
    const delimiter = detectDelimiter(text);
    const rows = parseCSV(text, delimiter);

    // Calculate max width per column
    const colWidths: number[] = [];
    rows.forEach(row => {
        row.forEach((cell, i) => {
            // We format cells first to know their true width
            const formattedCell = formatCell(cell, delimiter);
            colWidths[i] = Math.max(colWidths[i] || 0, formattedCell.length);
        });
    });

    // Reconstruct CSV
    const formattedLines = rows.map(row => {
        // Skip empty rows if they are just empty strings (unless it's a 1-column CSV with empty value)
        if (row.length === 0 || (row.length === 1 && row[0] === '')) {
            return '';
        }

        return row.map((cell, i) => {
            const formattedCell = formatCell(cell, delimiter);
            // Don't pad the last column to avoid trailing whitespace
            if (i === row.length - 1) {
                return formattedCell;
            }
            return formattedCell.padEnd(colWidths[i]);
        }).join(` ${delimiter} `); // Add spaces around delimiter for readability
    });

    // Remove trailing empty lines
    while (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] === '') {
        formattedLines.pop();
    }

    return formattedLines.join('\n');
}

/**
 * Format a single cell (quote if necessary)
 */
function formatCell(cell: string, delimiter: string): string {
    // Quote if contains delimiter, quote, or newline
    if (cell.includes(delimiter) || cell.includes('"') || cell.includes('\n') || cell.includes('\r')) {
        return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
}

/**
 * Robust CSV Parser (RFC 4180 compliant)
 */
function parseCSV(text: string, delimiter: string): string[][] {
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
                    // Escaped quote: "" -> "
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
                // Carriage return only (Mac Classic style)
                currentRow.push(currentField);
                rows.push(currentRow);
                currentRow = [];
                currentField = '';
            } else {
                currentField += char;
            }
        }
    }

    // Push last field/row if any content exists
    if (currentRow.length > 0 || currentField.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
    }

    return rows;
}
