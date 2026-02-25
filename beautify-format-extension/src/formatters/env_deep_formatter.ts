export function formatENVDeep(text: string): string {
    interface EnvLine {
        type: 'empty' | 'comment' | 'assignment';
        prefix?: string;
        key?: string;
        value?: string;
        comment?: string;
        quoteChar?: string;
    }

    const lines: EnvLine[] = [];

    let i = 0;
    const n = text.length;

    while (i < n) {
        let char = text[i];

        // Skip leading whitespace (indentation)
        if (char === ' ' || char === '\t') {
            i++;
            continue;
        }

        // Empty line
        if (char === '\n' || char === '\r') {
            lines.push({ type: 'empty' });
            if (char === '\r' && i + 1 < n && text[i+1] === '\n') i++;
            i++;
            continue;
        }

        // Comment line
        if (char === '#') {
            let comment = '';
            i++; // skip #
            while (i < n && text[i] !== '\n' && text[i] !== '\r') {
                comment += text[i];
                i++;
            }
            lines.push({ type: 'comment', comment: comment.trim() });

            // Consume newline
            if (i < n && (text[i] === '\n' || text[i] === '\r')) {
                if (text[i] === '\r' && i + 1 < n && text[i+1] === '\n') i++;
                i++;
            }
            continue;
        }

        // Assignment or Key
        // Read Key
        let keyBuffer = '';
        while (i < n && text[i] !== '=' && text[i] !== '\n' && text[i] !== '\r' && text[i] !== '#') {
            keyBuffer += text[i];
            i++;
        }

        let key = keyBuffer.trim();
        let prefix = '';
        if (key.startsWith('export ')) {
            prefix = 'export ';
            key = key.substring(7).trim();
        }

        // Check if we hit end of line or file or comment start
        if (i >= n || text[i] === '\n' || text[i] === '\r') {
            // Key only
            if (key) lines.push({ type: 'assignment', prefix, key, value: '', quoteChar: '' });

            // Consume newline
            if (i < n && (text[i] === '\n' || text[i] === '\r')) {
                 if (text[i] === '\r' && i + 1 < n && text[i+1] === '\n') i++;
                 i++;
            }
            continue;
        }

        if (text[i] === '#') {
             // Key followed by comment (no =)
             let comment = '';
             i++; // skip #
             while (i < n && text[i] !== '\n' && text[i] !== '\r') {
                 comment += text[i];
                 i++;
             }
             lines.push({ type: 'assignment', prefix, key, value: '', quoteChar: '', comment: comment.trim() });

             // Consume newline
             if (i < n && (text[i] === '\n' || text[i] === '\r')) {
                 if (text[i] === '\r' && i + 1 < n && text[i+1] === '\n') i++;
                 i++;
             }
             continue;
        }

        if (text[i] === '=') {
            i++; // skip =
            // Read Value
            // skip whitespace after =
            while (i < n && (text[i] === ' ' || text[i] === '\t')) i++;

            let value = '';
            let quoteChar = '';
            let comment = '';

            if (i < n) {
                if (text[i] === '"' || text[i] === "'") {
                    quoteChar = text[i];
                    i++; // skip open quote

                    let isEscaped = false;
                    while (i < n) {
                        if (isEscaped) {
                            value += text[i];
                            isEscaped = false;
                        } else {
                            if (text[i] === '\\') {
                                value += text[i]; // keep escape
                                isEscaped = true;
                            } else if (text[i] === quoteChar) {
                                i++; // skip close quote
                                break;
                            } else {
                                value += text[i];
                            }
                        }
                        i++;
                    }

                    // Check for trailing comment after quote
                    // We must skip whitespace first
                    while (i < n && (text[i] === ' ' || text[i] === '\t')) i++;

                    if (i < n && text[i] === '#') {
                        i++; // skip #
                        while (i < n && text[i] !== '\n' && text[i] !== '\r') {
                            comment += text[i];
                            i++;
                        }
                    }
                } else {
                    // Unquoted value
                    while (i < n && text[i] !== '\n' && text[i] !== '\r') {
                        if (text[i] === '#') {
                            // Comment start
                             i++; // skip #
                             while (i < n && text[i] !== '\n' && text[i] !== '\r') {
                                 comment += text[i];
                                 i++;
                             }
                             break;
                        }
                        value += text[i];
                        i++;
                    }
                    value = value.trim();
                }
            }

            lines.push({ type: 'assignment', prefix, key, value, quoteChar, comment: comment.trim() });

            // Consume newline
            if (i < n && (text[i] === '\n' || text[i] === '\r')) {
                 if (text[i] === '\r' && i + 1 < n && text[i+1] === '\n') i++;
                 i++;
            }
        }
    }

    // Calculate Max Key Length (Global)
    let maxKeyLen = 0;
    lines.forEach(line => {
        if (line.type === 'assignment' && line.key) {
            const len = (line.prefix || '').length + line.key.length;
            if (len > maxKeyLen) maxKeyLen = len;
        }
    });

    // Reconstruct
    const result: string[] = [];
    lines.forEach(line => {
        if (line.type === 'empty') {
            result.push('');
        } else if (line.type === 'comment') {
            result.push(`# ${line.comment}`);
        } else if (line.type === 'assignment') {
            if (!line.key) return; // Should not happen

            const fullKey = (line.prefix || '') + line.key;
            const padding = ' '.repeat(Math.max(0, maxKeyLen - fullKey.length));

            let valuePart = line.value || '';
            if (line.quoteChar) {
                valuePart = `${line.quoteChar}${valuePart}${line.quoteChar}`;
            }

            let output = `${fullKey}${padding} = ${valuePart}`;
            if (line.comment) {
                output += ` # ${line.comment}`;
            }
            result.push(output);
        }
    });

    return result.join('\n');
}
