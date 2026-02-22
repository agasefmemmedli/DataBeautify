export function formatENVDeep(text: string): string {
    const lines = text.split('\n');
    const parsedLines: {
        raw: string;
        prefix: string;
        key: string;
        value: string;
        comment: string;
        isAssignment: boolean;
    }[] = [];

    // 1. Parse
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === '' || trimmed.startsWith('#')) {
            parsedLines.push({ raw: line, prefix: '', key: '', value: '', comment: '', isAssignment: false });
            continue;
        }

        const eqIndex = line.indexOf('=');
        if (eqIndex === -1) {
            // Not an assignment (maybe just 'export KEY' without value? or garbage)
            parsedLines.push({ raw: line, prefix: '', key: '', value: '', comment: '', isAssignment: false });
            continue;
        }

        const leftPart = line.substring(0, eqIndex);
        const rightPart = line.substring(eqIndex + 1);

        // Parse left part: prefix + key
        let prefix = '';
        let key = leftPart.trim();

        if (key.startsWith('export ')) {
            prefix = 'export ';
            key = key.substring(7).trim();
        }

        // Parse right part: value + comment
        let value = '';
        let comment = '';

        const trimmedRight = rightPart.trim();

        if (trimmedRight.startsWith('"') || trimmedRight.startsWith("'")) {
            const quoteChar = trimmedRight[0];
            // Find closing quote
            let closeQuoteIndex = -1;
            for (let i = 1; i < trimmedRight.length; i++) {
                if (trimmedRight[i] === quoteChar && trimmedRight[i-1] !== '\\') {
                    closeQuoteIndex = i;
                    break;
                }
            }

            if (closeQuoteIndex !== -1) {
                value = trimmedRight.substring(0, closeQuoteIndex + 1);
                const afterValue = trimmedRight.substring(closeQuoteIndex + 1).trim();
                if (afterValue.startsWith('#')) {
                    comment = afterValue;
                }
            } else {
                // Unclosed quote? Treat whole thing as value
                value = trimmedRight;
            }
        } else {
            // Unquoted
            const commentIndex = trimmedRight.indexOf('#');
            if (commentIndex !== -1) {
                value = trimmedRight.substring(0, commentIndex).trim();
                comment = trimmedRight.substring(commentIndex).trim();
            } else {
                value = trimmedRight;
            }
        }

        parsedLines.push({ raw: line, prefix, key, value, comment, isAssignment: true });
    }

    // 2. Calculate Alignment
    let maxKeyLength = 0;
    for (const item of parsedLines) {
        if (item.isAssignment) {
            const len = item.prefix.length + item.key.length;
            if (len > maxKeyLength) {
                maxKeyLength = len;
            }
        }
    }

    // 3. Reconstruct
    const formattedLines: string[] = [];
    for (const item of parsedLines) {
        if (!item.isAssignment) {
            formattedLines.push(item.raw.trim());
            continue;
        }

        const fullKey = item.prefix + item.key;
        const padding = ' '.repeat(maxKeyLength - fullKey.length);

        let line = `${fullKey}${padding} = ${item.value}`;
        if (item.comment) {
            line += ` ${item.comment}`;
        }
        formattedLines.push(line);
    }

    return formattedLines.join('\n');
}
