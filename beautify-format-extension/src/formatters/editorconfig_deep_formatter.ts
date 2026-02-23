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
        comments: string[];
        inlineComment?: string;
    }

    interface Section {
        header: string | null;
        properties: Property[];
        comments: string[];
        inlineComment?: string;
    }

    const sections: Section[] = [];
    let currentSection: Section = { header: null, properties: [], comments: [] };
    let currentComments: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for comments
        // We need to be careful not to split inside quotes, though EditorConfig values rarely have quotes except strictly needed.
        // Assuming standard EditorConfig syntax where # or ; starts a comment unless escaped?
        // EditorConfig spec says: "Comments: ; or #"
        // It doesn't strictly specify quoting rules for values containing # or ; but usually values don't contain them.

        let content = line;
        let inlineComment = '';

        // Find comment start
        let commentIdx = -1;
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '#' || char === ';') {
                commentIdx = j;
                break;
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
            } else if (line.trim() === '') {
                 // Preserve empty lines as empty strings in comments?
                 // Or just ignore extra vertical whitespace and enforce our own?
                 // Let's enforce our own spacing between sections, so we ignore blank lines here
                 // UNLESS they are inside a block of comments?
                 // Simplest is to ignore blank lines and rely on reconstruction.
            }
            continue;
        }

        // Section Header
        if (trimmed.startsWith('[')) {
            // Push previous section
            sections.push(currentSection);

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

        // Property
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

        // Unknown line (fallback)
        // Treat as comment to preserve it
        currentComments.push(line.trim());
    }

    // Push last section
    sections.push(currentSection);

    // Reconstruct
    const formattedLines: string[] = [];

    sections.forEach((section, index) => {
        // If it's the root section (header is null) and empty, skip it UNLESS it has comments
        // Usually index 0 is the implicit root section.
        const isImplicitRoot = section.header === null;

        if (isImplicitRoot && section.properties.length === 0 && section.comments.length === 0) {
            return;
        }

        // Add spacing between sections (but not before the very first content)
        if (formattedLines.length > 0) {
            formattedLines.push('');
        }

        // Section Comments
        section.comments.forEach(c => formattedLines.push(c));

        // Section Header
        if (section.header) {
            let headerLine = section.header;
            if (section.inlineComment) {
                headerLine += ` ${section.inlineComment}`;
            }
            formattedLines.push(headerLine);
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

            const indent = isImplicitRoot ? '' : '    ';

            sortedProps.forEach(p => {
                // Property Comments
                p.comments.forEach(c => formattedLines.push(`${indent}${c}`));

                // Property Line
                const padding = ' '.repeat(maxKeyLen - p.key.length);
                let line = `${indent}${p.key}${padding} = ${p.value}`;

                if (p.inlineComment) {
                    line += ` ${p.inlineComment}`;
                }

                formattedLines.push(line);
            });
        }
    });

    // Trailing comments (if any were left in currentComments after loop)
    if (currentComments.length > 0) {
        if (formattedLines.length > 0) formattedLines.push('');
        currentComments.forEach(c => formattedLines.push(c));
    }

    return formattedLines.join('\n');
}
