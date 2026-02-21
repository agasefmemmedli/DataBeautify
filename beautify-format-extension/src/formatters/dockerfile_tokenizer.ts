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
                // Should not happen if logic is correct, empty lines break continuations?
                // Actually, empty lines inside a continuation are valid in Docker but weird.
                // But usually empty line means end of previous instruction if not escaped.
                // If previous line ended with \, and this is empty... strictly speaking it's part of the command (as a newline literal).
                // But most formatters treat empty line as a break.
                // Let's assume standard behavior: empty line is empty token.
            }
            tokens.push({ type: 'EMPTY', raw: line, lines: [i] });
            continue;
        }

        if (trimmed.startsWith('#')) {
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
            // Comment
            // Comments cannot be continued with \ (strictly speaking).
            // But some parsers might allow it. Standard Dockerfile: # is comment.
            tokens.push({ type: 'COMMENT', raw: line, lines: [i] });
            continue;
        }

        // Instruction or continuation
        buffer.push(line);

        // Check if line continues
        // A line continues if it ends with \
        // Note: comments can handle \? No.
        // Strip trailing whitespace to find \
        // But be careful about comments at end of line? Docker doesn't support inline comments in instructions usually, except with specific parsers.
        // Standard Dockerfile: no inline comments in instruction arguments.

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
                // Maybe just a single word instruction like 'USER root' or just 'ARG' (invalid but possible partial)
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
