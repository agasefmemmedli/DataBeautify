import { tokenizeSass, SassLine } from './sass_tokenizer';

export function formatSassDeep(text: string): string {
    const lines = tokenizeSass(text);
    const formattedLines: string[] = [];

    // Stack stores the *source* indentations of the active blocks.
    // Level 0 is implicit (root).
    // Stack: [0] (Root indent, usually 0).
    const indentStack: number[] = [0];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.type === 'empty') {
            formattedLines.push('');
            continue;
        }

        const prevLine = getEffectivePrevLine(lines, i);

        // Determine Indentation Change
        if (!prevLine) {
            // First line. Reset stack.
            indentStack.length = 0;
            indentStack.push(0); // Root is 0
        } else {
            // Logic:
            // 1. Check if we should Nest (Child).
            // 2. Check if we should Dedent (Parent/Sibling).

            let shouldNest = false;

            if (prevLine.isBlockStarter) {
                // Check if we should force nest (Rule -> Property)
                // Optional starters like @include only nest if explicitly indented
                const forceNest = !prevLine.isOptionalBlockStarter && line.type === 'property';

                if (forceNest) {
                    shouldNest = true;
                }
                else if (line.indent > prevLine.indent) {
                    shouldNest = true;
                }
                // Comments inside blocks
                else if (line.type === 'comment' && line.indent > prevLine.indent) {
                    shouldNest = true;
                }
            } else {
                // Property -> Property: Sibling (No Nest)
                // Property -> Rule: Sibling or Dedent.

                // Exception: Namespaced properties (font: \n family: ...)
                // If indent increased, treat as nest ONLY if line is property.
                if (line.indent > prevLine.indent && line.type === 'property') {
                    shouldNest = true;
                }
            }

            if (shouldNest) {
                indentStack.push(line.indent);
            } else {
                // Dedent or Stay.

                // Check if line.indent exists in stack (Exact Match Priority)
                const matchIndex = indentStack.lastIndexOf(line.indent);

                if (matchIndex !== -1) {
                     // Pop until matchIndex is top
                    while (indentStack.length > matchIndex + 1) {
                        indentStack.pop();
                    }
                } else {
                    // Standard Dedent Logic (Pop until <=)
                    while (indentStack.length > 1 && indentStack[indentStack.length - 1] > line.indent) {
                        indentStack.pop();
                    }
                }
            }
        }

        // Calculate indent string (2 spaces per stack level - 1 for root)
        const currentLevel = Math.max(0, indentStack.length - 1);
        const indentStr = '  '.repeat(currentLevel);
        formattedLines.push(indentStr + line.content);
    }

    return formattedLines.join('\n');
}

function getEffectivePrevLine(lines: SassLine[], index: number): SassLine | null {
    for (let i = index - 1; i >= 0; i--) {
        if (lines[i].type !== 'empty' && lines[i].type !== 'comment') {
            return lines[i];
        }
    }
    return null;
}
