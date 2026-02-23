
export function formatINIDeep(text: string): string {
    const lines = text.split('\n');
    const formattedLines: string[] = [];

    let sectionBuffer: { type: string, raw: string, key?: string, value?: string, comment?: string }[] = [];

    const processBuffer = () => {
        if (sectionBuffer.length === 0) return;

        // Calculate max key length in this buffer
        let maxKeyLen = 0;
        sectionBuffer.forEach(item => {
            if (item.type === 'property' && item.key) {
                if (item.key.length > maxKeyLen) maxKeyLen = item.key.length;
            }
        });

        // Output buffer
        sectionBuffer.forEach(item => {
            if (item.type === 'property' && item.key) {
                const padding = ' '.repeat(maxKeyLen - item.key.length);
                let line = `${item.key}${padding} = ${item.value}`;
                if (item.comment) {
                    line += ` ${item.comment}`;
                }
                formattedLines.push(line);
            } else {
                formattedLines.push(item.raw);
            }
        });
        sectionBuffer = [];
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '') {
            // Empty line acts as separator for visual grouping?
            // Or just preserve?
            // If we want alignment across the whole section including empty lines, buffer it.
            // But typically empty line resets alignment context in many formatters?
            // Let's stick to: Alignment is per Section. Empty lines don't break alignment within section.
            sectionBuffer.push({ type: 'empty', raw: '' });
            continue;
        }

        // Section Header
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            processBuffer(); // Flush previous section
            // Ensure blank line before section if not start
            if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                formattedLines.push('');
            }
            formattedLines.push(trimmed);
            continue;
        }

        // Comment
        if (trimmed.startsWith(';') || trimmed.startsWith('#')) {
            sectionBuffer.push({ type: 'comment', raw: trimmed });
            continue;
        }

        // Property
        // Handle key = value
        let splitIdx = -1;
        const eqIdx = trimmed.indexOf('=');
        const colIdx = trimmed.indexOf(':');

        if (eqIdx !== -1 && colIdx !== -1) {
            splitIdx = Math.min(eqIdx, colIdx);
        } else {
            splitIdx = eqIdx !== -1 ? eqIdx : colIdx;
        }

        if (splitIdx > 0) {
            const key = trimmed.substring(0, splitIdx).trim();
            const valuePart = trimmed.substring(splitIdx + 1).trim();

            // Check for inline comments
            let commentStart = -1;
            let inString = false;
            let quoteChar = '';

            for (let j = 0; j < valuePart.length; j++) {
                const char = valuePart[j];
                if ((char === '"' || char === "'") && (j === 0 || valuePart[j - 1] !== '\\')) {
                    if (!inString) {
                        inString = true;
                        quoteChar = char;
                    } else if (quoteChar === char) {
                        inString = false;
                    }
                } else if ((char === ';' || char === '#') && !inString) {
                    commentStart = j;
                    break;
                }
            }

            if (commentStart !== -1) {
                const value = valuePart.substring(0, commentStart).trim();
                const comment = valuePart.substring(commentStart).trim();
                sectionBuffer.push({ type: 'property', raw: line, key, value, comment });
            } else {
                sectionBuffer.push({ type: 'property', raw: line, key, value: valuePart });
            }
        } else {
            // Unknown
            sectionBuffer.push({ type: 'unknown', raw: trimmed });
        }
    }

    processBuffer(); // Flush remaining

    // Remove trailing empty lines
    while (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] === '') {
        formattedLines.pop();
    }

    return formattedLines.join('\n');
}
