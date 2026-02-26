
export interface SassLine {
    indent: number;
    content: string;
    type: 'empty' | 'comment' | 'property' | 'rule' | 'directive' | 'variable';
    raw: string;
    isBlockStarter: boolean;
    isOptionalBlockStarter: boolean;
    isNamespace: boolean;
}

export function tokenizeSass(text: string): SassLine[] {
    const lines = text.split('\n');
    const result: SassLine[] = [];

    // Common pseudo-classes that might confuse the property detector
    const PSEUDO_CLASSES = new Set([
        'hover', 'active', 'focus', 'visited', 'link', 'before', 'after',
        'first-child', 'last-child', 'nth-child', 'not', 'root', 'empty',
        'target', 'checked', 'disabled', 'enabled', 'first-of-type',
        'last-of-type', 'only-child', 'only-of-type', 'required', 'valid',
        'invalid', 'in-range', 'out-of-range', 'read-only', 'read-write'
    ]);

    for (const line of lines) {
        if (line.trim() === '') {
            result.push({ indent: 0, content: '', type: 'empty', raw: line, isBlockStarter: false, isOptionalBlockStarter: false, isNamespace: false });
            continue;
        }

        // Calculate indentation (tab = 2 spaces, space = 1 space)
        let indent = 0;
        let contentStart = 0;
        for (let j = 0; j < line.length; j++) {
            if (line[j] === ' ') {
                indent++;
            } else if (line[j] === '\t') {
                indent += 2;
            } else {
                contentStart = j;
                break;
            }
        }

        const trimmed = line.trim();

        let type: SassLine['type'] = 'rule'; // Default to rule (selector)
        let isBlockStarter = true; // Rules start blocks
        let isOptionalBlockStarter = false;
        let isNamespace = false;

        // Comments
        if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
            type = 'comment';
            isBlockStarter = false;
        }
        // Directives (@...)
        else if (trimmed.startsWith('@')) {
            type = 'directive';
            // Directives that definitely start blocks
            if (/^@(mixin|function|if|else|for|each|while|media|supports|keyframes|scope|layer|container|font-face)/.test(trimmed)) {
                isBlockStarter = true;
            }
            // @include can be single line or block
            else if (/^@include/.test(trimmed)) {
                isBlockStarter = true;
                isOptionalBlockStarter = true;
            }
            // Directives that usually don't start blocks
            else if (/^@(extend|import|use|forward|warn|error|debug|return|at-root|charset)/.test(trimmed)) {
                isBlockStarter = false;
            }
            // Unknown directives - assume block starter but optional
            else {
                isBlockStarter = true;
                isOptionalBlockStarter = true;
            }
        }
        // Variables ($...)
        else if (trimmed.startsWith('$')) {
            type = 'variable';
            isBlockStarter = false;
            // Map definition: $map: ( ... )
            // If it ends with open paren or colon with no value (rare for vars)
            if (trimmed.endsWith('(') || (trimmed.includes(':') && !trimmed.includes(';') && trimmed.trim().endsWith(':'))) {
                 isBlockStarter = true;
            }
        }
        // Properties vs Rules
        else {
            // Check for property pattern: identifier: value
            // Allow interpolation #{} in property names
            const propMatch = trimmed.match(/^([a-zA-Z0-9_-]+|#\{.+\})\s*:(.*)/);

            if (propMatch) {
                const propName = propMatch[1];
                const propValue = propMatch[2].trim();

                if (propValue === '') {
                    // Ends with colon: "font:" or "a:"
                    // If it looks like a tag with pseudo, it's a rule.
                    // If it looks like a property, it's a namespace.
                    // Heuristic: Tags are usually short, properties can be anything.
                    // But standard SASS style: "font:" (namespace) is common. "a:" (selector) is rare (usually "a {").
                    // We assume Namespace Property.
                    type = 'property';
                    isBlockStarter = true;
                    isNamespace = true;
                } else {
                    // Has value. "color: red" or "a:hover"

                    // Check if value looks like a pseudo-class
                    // Strip colons from start of value (::before -> before)
                    const cleanValue = propValue.replace(/^:+/, '');
                    const firstWord = cleanValue.split(/[(\s,]/)[0]; // "hover"

                    if (PSEUDO_CLASSES.has(firstWord)) {
                        // Likely a selector (a:hover)
                        type = 'rule';
                        isBlockStarter = true;
                    } else {
                        // Likely a property
                        type = 'property';

                        // Properties CAN start blocks (nested properties)
                        // But we treat them as "Optional" - only if indented next line
                        isBlockStarter = true;
                        isOptionalBlockStarter = true;
                    }
                }
            } else {
                // No colon pattern -> Rule (Selector)
                // e.g. "div", ".class", "&.active"
                type = 'rule';
                isBlockStarter = true;
            }
        }

        result.push({ indent, content: trimmed, type, raw: line, isBlockStarter, isOptionalBlockStarter, isNamespace });
    }

    return result;
}
