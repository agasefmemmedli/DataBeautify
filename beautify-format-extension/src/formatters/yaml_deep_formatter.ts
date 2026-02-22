import * as YAML from 'yaml';

/**
 * Deep formatting for YAML
 * - Robust parsing using 'yaml' package
 * - Vertical alignment of keys
 * - 2-space indentation
 */
export function formatYAMLDeep(text: string): string {
    // 1. Parse and Standardize
    // We let parsing errors propagate so the caller can handle fallback or error reporting.
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
        lineWidth: 120,
        nullStr: '~', // Explicit nulls
        defaultKeyType: 'PLAIN',
        defaultStringType: 'PLAIN'
    });

    // 2. Vertical Alignment
    return alignYAML(standard);
}

function alignYAML(text: string): string {
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
