import * as YAML from 'yaml';

/**
 * Deep formatting for YAML
 * - Robust parsing using 'yaml' package
 * - Vertical alignment of keys
 * - 2-space indentation
 * - Context-aware alignment (skips multiline strings)
 */
export function formatYAMLDeep(text: string): string {
    try {
        // 1. Parse and Standardize
        // We let parsing errors propagate so the caller can handle fallback or error reporting.
        // However, if we want fault tolerance, we can try to parse and if it fails, try to repair or just standardize as best as possible.
        // Here we stick to 'yaml' default fault tolerance (parsing document).

        const doc = YAML.parseDocument(text);
        if (doc.errors.length > 0) {
            // Fault tolerance: clear errors to attempt partial formatting
            // This allows us to format even invalid YAML to some extent
            doc.errors = [];
        }

        const standard = doc.toString({
            indent: 2,
            indentSeq: true,
            simpleKeys: true,
            lineWidth: 80, // Prettier standard line width
            nullStr: 'null', // Explicit nulls (Prettier standard)
            defaultKeyType: 'PLAIN',
            defaultStringType: 'PLAIN'
        });

        // 2. Identify Protected Lines (inside multiline scalars)
        // We re-parse the standardized output to find scalar ranges.
        const protectedLines = new Set<number>();
        try {
            const lineCounter = new YAML.LineCounter();
            const stdDoc = YAML.parseDocument(standard, { lineCounter });

            YAML.visit(stdDoc, {
                Scalar(_, node) {
                    if (node.range) {
                        const startIdx = node.range[0];
                        const endIdx = node.range[1];
                        const startPos = lineCounter.linePos(startIdx);
                        const endPos = lineCounter.linePos(endIdx);

                        // YAML LineCounter is 1-based for lines.
                        // We need 0-based for alignYAML.
                        const startLine = startPos.line - 1;
                        const endLine = endPos.line - 1;

                        if (startLine < endLine) {
                            // Multiline scalar
                            // Protect lines strictly between start and end
                            for (let i = startLine + 1; i < endLine; i++) {
                                protectedLines.add(i);
                            }

                            // Protect end line if it has content (col > 1)
                            // endPos.col is 1-based. If > 1, it means there is content on that line.
                            if (endPos.col > 1) {
                                protectedLines.add(endLine);
                            }
                        }
                    }
                }
            });
        } catch (e) {
            // Fallback: if re-parsing fails, we proceed without protection (unsafe alignment)
            // or we could skip alignment entirely. For now, we proceed as legacy behavior.
            console.warn('Deep YAML: Failed to analyze structure for alignment protection.', e);
        }

        // 3. Vertical Alignment with Protection
        return alignYAML(standard, protectedLines);
    } catch (err) {
        // Fault tolerance: return original text if parsing fails completely
        return text;
    }
}

function alignYAML(text: string, protectedLines: Set<number> = new Set()): string {
    const lines = text.split('\n');
    const result: string[] = [];

    // Grouping buffer
    let group: { line: string, prefix: string, key: string, suffix: string, indentCols: number }[] = [];

    const flushGroup = () => {
        if (group.length === 0) return;

        // Calculate max key length
        let maxKeyLen = 0;
        for (const item of group) {
            if (item.key.length > maxKeyLen) {
                maxKeyLen = item.key.length;
            }
        }

        // Reconstruct lines
        for (const item of group) {
            const padding = ' '.repeat(maxKeyLen - item.key.length);
            // Rebuild line: prefix + key + ":" + padding + suffix
            // suffix includes the leading space if it existed.
            // If suffix is empty (no value), we might not want padding?
            // But usually we align for future values.

            result.push(`${item.prefix}${item.key}:${padding}${item.suffix}`);
        }
        group = [];
    };

    // Regex to identify Key-Value pair
    // Captures:
    // 1. Prefix: Indentation + optional '- '
    // 2. Key: The key itself (quoted or unquoted)
    // 3. Suffix: The rest of the line (separator space + value, or empty)
    // Note: Matches 'key: value', 'key:', '- key: value'
    // Non-greedy match for key ensures we stop at the first valid ': ' or ':$'
    const kvRegex = /^(\s*(?:-\s+)?)((?:(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|.+?)):(\s+.*|\s*)$/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check protection
        if (protectedLines.has(i)) {
            flushGroup();
            result.push(line);
            continue;
        }

        // Skip empty lines (flush group)
        if (line.trim() === '') {
            flushGroup();
            result.push(line);
            continue;
        }

        // Check for comment-only line (flush group)
        // Note: Comments attached to lines are handled by kvRegex or fallback
        if (line.trim().startsWith('#')) {
            flushGroup();
            result.push(line);
            continue;
        }

        const match = line.match(kvRegex);
        if (match) {
            const prefix = match[1];
            const key = match[2];
            const suffix = match[3];

            // Determine indentation level for grouping
            // We use the length of the prefix as the "indent column"
            // This handles '- key' and '  key' correctly if they align visually
            const indentCols = prefix.length;

            // Check if we should continue the current group
            if (group.length > 0) {
                const last = group[group.length - 1];
                // Group by strict indentation alignment
                if (last.indentCols !== indentCols) {
                    flushGroup();
                }
            }

            group.push({
                line,
                prefix,
                key,
                suffix,
                indentCols
            });
        } else {
            // Not a KV line (e.g. array item start without key, or multiline string content)
            flushGroup();
            result.push(line);
        }
    }

    flushGroup();
    return result.join('\n');
}
