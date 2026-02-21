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

    // Buffer for alignment group
    let group: { line: string, indent: string, key: string, value: string }[] = [];

    const flushGroup = () => {
        if (group.length === 0) return;

        // Check if group has size > 1 (otherwise no need to align)
        if (group.length === 1) {
            result.push(group[0].line);
            group = [];
            return;
        }

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
            // Rebuild line: indent + key + ":" + padding + " " + value
            result.push(`${item.indent}${item.key}:${padding} ${item.value}`);
        }
        group = [];
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip empty lines (flush group)
        if (trimmed === '') {
            flushGroup();
            result.push(line);
            continue;
        }

        // Skip comments (flush group)
        if (trimmed.startsWith('#')) {
            flushGroup();
            result.push(line);
            continue;
        }

        // Check for list item '-' (flush group)
        if (trimmed.startsWith('-')) {
            flushGroup();
            result.push(line);
            continue;
        }

        // Identify Key and Value split
        const indent = line.substring(0, line.indexOf(trimmed));
        let keyEndIndex = -1; // Index of ':' relative to trimmed string

        if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
            const quoteChar = trimmed[0];
            let j = 1;
            while (j < trimmed.length) {
                if (trimmed[j] === '\\') j++;
                else if (trimmed[j] === quoteChar) break;
                j++;
            }
            if (j < trimmed.length && trimmed[j + 1] === ':') {
                keyEndIndex = j + 1;
            }
        } else {
            // Simple key
            // Use indexOf(':') but ensure it's not inside a flow structure or comment?
            // Standard stringify usually keeps it simple.
            keyEndIndex = trimmed.indexOf(':');
        }

        // If no colon or it's at end (nested map start or complex key without value on same line)
        if (keyEndIndex === -1 || keyEndIndex === trimmed.length - 1) {
            flushGroup();
            result.push(line);
            continue;
        }

        // Check for space after colon (YAML requires it)
        if (trimmed[keyEndIndex + 1] !== ' ') {
            // Maybe it's compact? "key:val" is not valid YAML usually, but check.
            // Standard stringify puts space.
            flushGroup();
            result.push(line);
            continue;
        }

        const keyPart = trimmed.substring(0, keyEndIndex);
        const valPart = trimmed.substring(keyEndIndex + 2); // Skip ": "

        // Check indentation compatibility
        if (group.length > 0 && group[0].indent !== indent) {
            flushGroup();
        }

        group.push({
            line,
            indent,
            key: keyPart,
            value: valPart
        });
    }

    flushGroup();

    return result.join('\n');
}
