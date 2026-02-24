/**
 * Deep formatter for Java Properties files
 */
export function formatPropertiesDeep(text: string): string {
    const lines = text.split('\n');
    const formattedLines: string[] = [];

    interface Property {
        key: string;
        value: string;
        noSeparator?: boolean;
    }

    // Buffer to hold properties for alignment
    // We group properties separated by comments or blank lines
    let blockBuffer: Property[] = [];

    const flushBuffer = () => {
        if (blockBuffer.length === 0) return;

        // Calculate max key length
        let maxKeyLen = 0;
        blockBuffer.forEach(item => {
            if (item.key.length > maxKeyLen) maxKeyLen = item.key.length;
        });

        // Output formatted lines
        blockBuffer.forEach(item => {
            const padding = ' '.repeat(maxKeyLen - item.key.length);
            if (item.noSeparator) {
                formattedLines.push(item.key);
            } else {
                // Standard format: key = value
                // Align =
                formattedLines.push(`${item.key}${padding} = ${item.value}`);
            }
        });

        blockBuffer = [];
    };

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let trimmed = line.trim();

        if (trimmed === '') {
            flushBuffer();
            formattedLines.push('');
            continue;
        }

        // Comments
        if (trimmed.startsWith('#') || trimmed.startsWith('!')) {
            flushBuffer();
            formattedLines.push(trimmed);
            continue;
        }

        // Parse Key-Value
        // 1. Find end of key (first unescaped space, =, or :)
        let keyEndIdx = -1;
        let escape = false;
        for (let j = 0; j < trimmed.length; j++) {
            const char = trimmed[j];
            if (escape) {
                escape = false;
                continue;
            }
            if (char === '\\') {
                escape = true;
                continue;
            }
            if (char === '=' || char === ':' || char === ' ') {
                keyEndIdx = j;
                break;
            }
        }

        let key: string;
        let value: string;
        let noSeparator = false;

        if (keyEndIdx !== -1) {
            key = trimmed.substring(0, keyEndIdx).trim();
            let rest = trimmed.substring(keyEndIdx);

            // 2. Consume whitespace
            rest = rest.trimStart();

            // 3. Consume separator (= or :)
            if (rest.startsWith('=') || rest.startsWith(':')) {
                rest = rest.substring(1);
            }

            // 4. Consume whitespace again
            value = rest.trimStart();
        } else {
            key = trimmed;
            value = '';
            noSeparator = true;
        }

        // Handle multiline values
        let currentLineTrimmed = trimmed;
        while (i < lines.length - 1) {
             let backslashCount = 0;
             for (let k = currentLineTrimmed.length - 1; k >= 0; k--) {
                 if (currentLineTrimmed[k] === '\\') backslashCount++;
                 else break;
             }

             if (backslashCount % 2 === 0) break; // Even backslashes -> no continuation

             i++;
             const nextLine = lines[i].trim();
             // Add to value with indent
             value += '\n    ' + nextLine;
             currentLineTrimmed = nextLine;
             // If we have continuation, it definitely has value or continuation of syntax
             noSeparator = false;
        }

        blockBuffer.push({ key, value, noSeparator });
    }

    flushBuffer();

    return formattedLines.join('\n');
}
