/**
 * Deep Formatter for EditorConfig
 *
 * Features:
 * - Alphabetical sorting of properties (root always at top)
 * - Vertical alignment of values
 * - 4-space indentation for properties
 * - Robust comment preservation (block and inline)
 * - Section spacing
 */

export function formatEditorConfigDeep(text: string): string {
    const lines = text.split('\n');

    interface Property {
        key: string;
        value: string;
        comments: string[]; // Comments appearing before this property
        inlineComment?: string;
    }

    interface Section {
        header: string | null; // null for implicit root (properties at top)
        properties: Property[];
        comments: string[]; // Comments appearing before this section header
        inlineComment?: string;
    }

    const sections: Section[] = [];
    // Initialize with implicit root section
    let currentSection: Section = { header: null, properties: [], comments: [] };
    let currentComments: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Parse line character by character to handle quotes in comments
        let content = line;
        let inlineComment = '';
        let inQuote = false;
        let quoteChar = '';
        let commentIdx = -1;

        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            // const prev = j > 0 ? line[j-1] : '';

            if (inQuote) {
                if (char === '\\') {
                     j++; // Escape next char
                } else if (char === quoteChar) {
                    inQuote = false;
                }
            } else {
                if (char === '"' || char === "'") {
                    inQuote = true;
                    quoteChar = char;
                } else if (char === '#' || char === ';') {
                    commentIdx = j;
                    break;
                }
            }
        }

        if (commentIdx !== -1) {
            content = line.substring(0, commentIdx);
            inlineComment = line.substring(commentIdx).trim(); // Normalize inline comment spacing
        }

        const trimmed = content.trim();

        // If line is empty (or was just a comment)
        if (trimmed === '') {
            if (inlineComment) {
                currentComments.push(inlineComment);
            }
            // Ignore blank lines; we enforce our own spacing
            continue;
        }

        // Section Header: [section]
        if (trimmed.startsWith('[')) {
            // Push previous section if it has content or comments
            // For implicit root, only push if it has properties or comments
            if (currentSection.header !== null || currentSection.properties.length > 0 || currentSection.comments.length > 0) {
                 sections.push(currentSection);
            } else if (currentSection.header === null && currentComments.length > 0) {
                 // Special case: comments at start of file belonging to implicit root but no properties yet?
                 // Usually these belong to the file header.
                 // We push the implicit root.
                 currentSection.comments = currentComments; // These comments belong to the root section start
                 currentComments = []; // Consumed
                 sections.push(currentSection);
            }

            // Start new section
            currentSection = {
                header: trimmed,
                properties: [],
                comments: currentComments,
                inlineComment: inlineComment
            };
            currentComments = [];
            continue;
        }

        // Property: key = value
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex !== -1) {
            const key = trimmed.substring(0, eqIndex).trim();
            const value = trimmed.substring(eqIndex + 1).trim();

            currentSection.properties.push({
                key,
                value,
                comments: currentComments,
                inlineComment: inlineComment
            });
            currentComments = [];
            continue;
        }

        // Unknown non-empty line
        // Treat as comment to preserve data integrity
        currentComments.push(line.trim());
    }

    // Push last section
    // If it's implicit root and empty, skip it UNLESS we have pending comments (trailing comments)
    if (currentSection.header !== null || currentSection.properties.length > 0 || currentSection.comments.length > 0) {
        sections.push(currentSection);
    } else if (currentSection.header === null && currentComments.length > 0) {
        // Trailing comments at end of file, treat as belonging to a dummy final section or append later?
        // Let's attach them to the last pushed section if possible, or create a dummy section.
        if (sections.length > 0) {
             // Append to last section's properties comments? No.
             // Append to last section's comments? No, those are *before* header.
             // We'll handle trailing comments separately.
        }
    }

    // Reconstruct
    const formattedLines: string[] = [];

    // Helper to add lines
    const addLine = (l: string) => formattedLines.push(l);

    sections.forEach((section, index) => {
        // Skip empty implicit root if it wasn't pushed (already handled by logic above, but double check)
        const isImplicitRoot = section.header === null;
        if (isImplicitRoot && section.properties.length === 0 && section.comments.length === 0) return;

        // Add spacing between sections
        // But not before the very first line of output
        if (formattedLines.length > 0) {
            addLine('');
        }

        // Section Comments
        section.comments.forEach(c => addLine(c));

        // Section Header
        if (section.header) {
            let headerLine = section.header;
            if (section.inlineComment) {
                headerLine += ` ${section.inlineComment}`;
            }
            addLine(headerLine);
        }

        // Properties
        if (section.properties.length > 0) {
            // Sort: root first, then alphabetical
            const sortedProps = [...section.properties].sort((a, b) => {
                if (a.key === 'root' && b.key !== 'root') return -1;
                if (b.key === 'root' && a.key !== 'root') return 1;
                return a.key.localeCompare(b.key);
            });

            // Calculate Max Key Length for Alignment
            let maxKeyLen = 0;
            sortedProps.forEach(p => {
                if (p.key.length > maxKeyLen) maxKeyLen = p.key.length;
            });

            const indent = isImplicitRoot ? '' : '    '; // 4 spaces indentation

            sortedProps.forEach(p => {
                // Property Comments
                p.comments.forEach(c => addLine(`${indent}${c}`));

                // Property Line
                const padding = ' '.repeat(maxKeyLen - p.key.length);
                let line = `${indent}${p.key}${padding} = ${p.value}`;

                if (p.inlineComment) {
                    line += ` ${p.inlineComment}`;
                }

                addLine(line);
            });
        }
    });

    // Trailing comments (if any were left in currentComments after loop)
    if (currentComments.length > 0) {
        if (formattedLines.length > 0) addLine('');
        currentComments.forEach(c => addLine(c));
    }

    // Ensure single final newline
    if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
        // formattedLines.push(''); // Standard practice to end with newline?
        // Join handles newlines between lines.
        // If we want EOL, we assume the caller handles it or we return string.
        // Usually editors handle final newline.
    }

    return formattedLines.join('\n');
}
