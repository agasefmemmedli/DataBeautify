export function formatTwigDeep(text: string): string {
    const lines = text.split('\n');
    const formattedLines: string[] = [];
    let indentLevel = 0;

    // Void tags that don't need closing (self-closing or empty)
    const voidTags = new Set([
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
    ]);

    // Twig block tags that increase indentation
    const blockTags = new Set([
        'block', 'if', 'for', 'macro', 'embed', 'apply', 'sandbox',
        'autoescape', 'verbatim', 'with', 'filter', 'trans', 'spaceless',
        'autoescape'
    ]);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '') {
            formattedLines.push('');
            continue;
        }

        // --- Analysis Phase ---
        // Calculate indentation for THIS line (tempIndent)
        // and change for NEXT line (netChange).

        let tempIndent = indentLevel;
        let lineNetChange = 0;

        // Dedent Check (at start of line)
        // We look for closing tokens at the very beginning
        const isClosingBlock = /^{%-?\s*end(if|for|block|macro|embed|apply|sandbox|autoescape|verbatim|set|with|filter|trans|spaceless)\b/.test(trimmed);
        const isMiddleBlock = /^{%-?\s*(else|elseif)\b/.test(trimmed);
        const isClosingHtml = /^<\/[a-zA-Z0-9]+/.test(trimmed);
        const isClosingBrace = /^[}\])]/.test(trimmed); // } ] )

        if (isClosingBlock || isMiddleBlock || isClosingHtml || isClosingBrace) {
            tempIndent = Math.max(0, indentLevel - 1);
        }

        formattedLines.push('  '.repeat(tempIndent) + trimmed);

        // --- Net Change Calculation (State Machine) ---
        let j = 0;
        const len = line.length;

        while (j < len) {
            const char = line[j];
            const next = line[j + 1];

            // 1. Comments
            if (char === '{' && next === '#') {
                // Twig Comment: {# ... #}
                j += 2;
                while (j < len) {
                    if (line[j] === '#' && line[j + 1] === '}') {
                        j += 1; // consume #
                        break;
                    }
                    j++;
                }
                j++; // consume }
                continue;
            }
            if (char === '<' && next === '!' && line.substr(j, 4) === '<!--') {
                // HTML Comment: <!-- ... -->
                j += 4;
                while (j < len && !line.startsWith('-->', j)) {
                    j++;
                }
                j += 2; // consume --
                continue;
            }

            // 2. Strings
            if (char === '"' || char === "'") {
                const quote = char;
                j++;
                while (j < len) {
                    if (line[j] === '\\') {
                        j += 2; // skip escaped char
                        continue;
                    }
                    if (line[j] === quote) {
                        break;
                    }
                    j++;
                }
                j++; // consume closing quote
                continue;
            }

            // 3. Twig Tags
            if (char === '{' && next === '%') {
                // Found {%
                const match = line.substring(j).match(/^{%-?\s*([a-zA-Z0-9_]+)/);
                if (match) {
                    const tagName = match[1];
                    if (tagName.startsWith('end')) {
                        lineNetChange--;
                    } else if (tagName === 'else' || tagName === 'elseif') {
                        // else/elseif: dedent current, indent content -> net 0 change relative to block start?
                        // If we are inside `if`, indent is +1.
                        // `else` line dedents (handled by isMiddleBlock).
                        // Content after `else` should be indented +1.
                        // So net change is 0 (relative to current level which is +1).
                        // Wait, if indentLevel is 1.
                        // `{% else %}` line prints at 0.
                        // Next line prints at 1.
                        // So net change for THIS line is 0.
                        // Correct.
                    } else if (blockTags.has(tagName) || tagName === 'set') {
                        // Check for `set` block vs inline
                        const tagContentMatch = line.substring(j).match(/^{%-?\s*set\s+([^%]+)%}/);
                        if (tagName === 'set' && tagContentMatch) {
                            if (tagContentMatch[1].includes('=')) {
                                // Inline assignment: {% set x = 1 %} -> No change
                            } else {
                                // Block assignment: {% set x %} ... {% endset %} -> +1
                                lineNetChange++;
                            }
                        } else if (tagName !== 'set') {
                            lineNetChange++;
                        }
                    }
                }
                // Skip to end of tag %}
                j += 2;
                while (j < len) {
                    if (line[j] === '%' && line[j + 1] === '}') {
                        j += 1;
                        break;
                    }
                    j++;
                }
                j++;
                continue;
            }

            // 4. HTML Tags
            if (char === '<' && /[a-zA-Z/]/.test(next)) {
                const isClosing = (next === '/');
                const start = j + (isClosing ? 2 : 1);

                // Read tag name
                let k = start;
                while (k < len && /[a-zA-Z0-9:-]/.test(line[k])) {
                    k++;
                }
                const tagName = line.substring(start, k).toLowerCase();

                // Scan to end of tag to check for self-closing />
                let m = k;
                let isSelfClosing = false;
                let inTagString: string | null = null;

                while (m < len) {
                    if (inTagString) {
                        if (line[m] === '\\') { m += 2; continue; }
                        if (line[m] === inTagString) inTagString = null;
                        m++;
                        continue;
                    }
                    if (line[m] === '"' || line[m] === "'") {
                        inTagString = line[m];
                        m++;
                        continue;
                    }
                    if (line[m] === '>') {
                        if (line[m - 1] === '/') isSelfClosing = true;
                        break;
                    }
                    m++;
                }

                if (!voidTags.has(tagName) && !isSelfClosing) {
                    if (isClosing) {
                        lineNetChange--;
                    } else {
                        lineNetChange++;
                    }
                }
                j = m + 1; // Move past >
                continue;
            }

            // 5. Braces (for objects/arrays/functions)
            // Ignore {{ (print tags)
            if (char === '{' && next === '{') {
                j += 2;
                while (j < len) {
                    if (line[j] === '}' && line[j + 1] === '}') {
                        j += 1;
                        break;
                    }
                    j++;
                }
                j++;
                continue;
            }

            if (char === '{' || char === '[' || char === '(') {
                lineNetChange++;
            } else if (char === '}' || char === ']' || char === ')') {
                lineNetChange--;
            }

            j++;
        }

        indentLevel = Math.max(0, indentLevel + lineNetChange);
    }

    return formattedLines.join('\n');
}
