export interface DockerToken {
    type: 'INSTRUCTION' | 'COMMENT' | 'EMPTY';
    raw: string; // The full raw text including continuations
    keyword?: string; // e.g. FROM, RUN
    args?: string[]; // Arguments
    lines: number[]; // Line numbers (0-based) covered by this token
}

export function tokenizeDockerfile(text: string): DockerToken[] {
    const tokens: DockerToken[] = [];
    const lines = text.split(/\r?\n/);

    let buffer: string[] = [];
    let startLine = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (buffer.length === 0) {
            startLine = i;
        }

        if (trimmed === '') {
            if (buffer.length > 0) {
                // If previous line ended with \, and we hit empty line.
                // Technically breaks continuation.
                const fullRaw = buffer.join('\n');
                const keywordMatch = fullRaw.trim().match(/^([a-zA-Z]+)\s/);
                let keyword = '';
                if (keywordMatch) {
                    keyword = keywordMatch[1].toUpperCase();
                } else {
                    keyword = fullRaw.trim().split(/\s/)[0].toUpperCase();
                }
                tokens.push({
                    type: 'INSTRUCTION',
                    raw: fullRaw,
                    keyword: keyword,
                    lines: Array.from({ length: buffer.length }, (_, k) => startLine + k)
                });
                buffer = [];
            }
            tokens.push({ type: 'EMPTY', raw: line, lines: [i] });
            continue;
        }

        if (trimmed.startsWith('#')) {
            // Check for continuation
            let continued = false;
            if (buffer.length > 0) {
                const lastLine = buffer[buffer.length - 1];
                // Check if last line ends with \ (ignoring trailing whitespace)
                if (lastLine.trimEnd().endsWith('\\')) {
                    continued = true;
                }
            }

            if (continued) {
                // Comment inside continuation. Treat as part of instruction to preserve context/indentation
                buffer.push(line);
                continue;
            }

            if (buffer.length > 0) {
                // Flush previous instruction
                const fullRaw = buffer.join('\n');
                const keywordMatch = fullRaw.trim().match(/^([a-zA-Z]+)\s/);
                let keyword = '';
                if (keywordMatch) {
                    keyword = keywordMatch[1].toUpperCase();
                } else {
                    keyword = fullRaw.trim().split(/\s/)[0].toUpperCase();
                }
                tokens.push({
                    type: 'INSTRUCTION',
                    raw: fullRaw,
                    keyword: keyword,
                    lines: Array.from({ length: buffer.length }, (_, k) => startLine + k)
                });
                buffer = [];
            }
            // Standalone Comment
            tokens.push({ type: 'COMMENT', raw: line, lines: [i] });
            continue;
        }

        // Instruction or continuation
        buffer.push(line);

        // Check if line continues
        let effectiveLine = line;
        // Check for continuation
        if (!effectiveLine.trimEnd().endsWith('\\')) {
            // End of instruction
            const fullRaw = buffer.join('\n');
            const keywordMatch = fullRaw.trim().match(/^([a-zA-Z]+)\s/);
            let keyword = '';

            if (keywordMatch) {
                keyword = keywordMatch[1].toUpperCase();
            } else {
                keyword = fullRaw.trim().split(/\s/)[0].toUpperCase();
            }

            tokens.push({
                type: 'INSTRUCTION',
                raw: fullRaw,
                keyword: keyword,
                lines: Array.from({ length: buffer.length }, (_, k) => startLine + k)
            });
            buffer = [];
        }
    }

    // Flush buffer if any
    if (buffer.length > 0) {
         const fullRaw = buffer.join('\n');
         const keywordMatch = fullRaw.trim().match(/^([a-zA-Z]+)\s/);
         let keyword = '';
         if (keywordMatch) {
             keyword = keywordMatch[1].toUpperCase();
         } else {
             keyword = fullRaw.trim().split(/\s/)[0].toUpperCase();
         }
         tokens.push({
             type: 'INSTRUCTION',
             raw: fullRaw,
             keyword: keyword,
             lines: Array.from({ length: buffer.length }, (_, k) => startLine + k)
         });
    }

    return tokens;
}
