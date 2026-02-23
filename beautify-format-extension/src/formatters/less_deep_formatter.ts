import { tokenizeLESS, LESSToken } from './less_tokenizer';

interface FormatterOptions {
    tabSize: number;
    insertSpaces: boolean;
}

export function formatLessDeep(text: string, options: FormatterOptions = { tabSize: 2, insertSpaces: true }): string {
    // Sort imports first (safe line-based sorting)
    text = sortLessImports(text);

    const tokens = tokenizeLESS(text);
    let result = '';
    let indentLevel = 0;
    const indentString = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';

    // Context tracking
    const contextStack: ('block' | 'map' | 'interpolation')[] = [];

    const getIndent = () => indentString.repeat(Math.max(0, indentLevel));

    let hasLeadingSpace = false;
    let lastToken: LESSToken | null = null;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === 'space') {
            hasLeadingSpace = true;
            continue;
        }

        // --- Newline Logic (Before Token) ---

        if (token.type === 'brace_close') {
             const ctx = contextStack[contextStack.length - 1];
             if (ctx === 'block') {
                 indentLevel = Math.max(0, indentLevel - 1);
                 // Force newline for block close
                 if (!result.endsWith('\n')) {
                     result = result.trimEnd() + '\n';
                 }
                 result += getIndent();
                 // Reset leading space since we just indented
                 hasLeadingSpace = false;
             }
        }

        // --- Spacing Logic (Before Token) ---

        // Add newline if previous was semicolon or block close/open
        // BUT skip if we just handled brace_close above which adds newline
        if (lastToken) {
            const endsWithNewline = /\n\s*$/.test(result);
            if (lastToken.type === 'semicolon') {
                if (!endsWithNewline) {
                     result += '\n' + getIndent();
                     hasLeadingSpace = false;
                }
            } else if (lastToken.type === 'brace_open') {
                if (!endsWithNewline) {
                     result += '\n' + getIndent();
                     hasLeadingSpace = false;
                }
            } else if (lastToken.type === 'brace_close') {
                 // If previous was }, we usually want newline unless followed by comma/semicolon
                 if (token.type !== 'comma' && token.type !== 'semicolon' && token.type !== 'brace_close') {
                      if (!endsWithNewline) {
                           result += '\n' + getIndent();
                           hasLeadingSpace = false;
                      }
                 } else {
                      hasLeadingSpace = true;
                 }
            } else if (lastToken.type === 'comment') {
                 if (lastToken.value.startsWith('//') || lastToken.value.includes('\n')) {
                      if (!endsWithNewline) {
                           result += '\n' + getIndent();
                           hasLeadingSpace = false;
                      }
                 } else {
                      hasLeadingSpace = true;
                 }
            }
        }

        // Handle "Else" special case (LESS doesn't standardly have @else but plugins might, or when guards)
        // LESS uses `when` guards, but structure is slightly different.
        // Keep this logic just in case it encounters similar constructs or future LESS versions.
        if (token.type === 'at_keyword' && (token.value === '@else' || token.value === '@elseif') && lastToken && lastToken.type === 'brace_close') {
             if (result.endsWith('\n' + getIndent())) {
                  result = result.substring(0, result.length - (1 + getIndent().length));
                  result += ' ';
                  hasLeadingSpace = false;
             }
        }

        // Add indentation if we are at start of line
        if (result.endsWith('\n')) {
            result += getIndent();
            hasLeadingSpace = false;
        }

        // Add space if needed
        if (hasLeadingSpace) {
             if (!result.endsWith('\n') && !result.endsWith(' ')) {
                 result += ' ';
             }
        } else {
            // Strict spacing rules enforcement
            if (lastToken) {
                // Space after colon (property: value)
                if (lastToken.type === 'colon' && token.type !== 'semicolon' && token.type !== 'comma') {
                    // Check context using lookahead
                    let isSelector = false;
                    for (let k = i; k < tokens.length; k++) {
                        const t = tokens[k];
                        if (t.type === 'brace_open') { isSelector = true; break; }
                        if (t.type === 'semicolon' || t.type === 'brace_close') { break; }
                    }

                    if (!isSelector) {
                        result += ' ';
                    }
                }
                // Space before brace open
                else if (token.type === 'brace_open') {
                     if (!result.endsWith(' ')) result += ' ';
                }
                // Space around operators
                else if (token.type === 'operator' || lastToken.type === 'operator') {
                     // Check for &: ... (pseudo-selector)
                     if (lastToken.type === 'operator' && lastToken.value === '&' && token.type === 'colon') {
                         // No space for &:hover
                     } else {
                         // Check for unary minus (e.g. -1px, -$var)
                         const isUnary = token.type === 'operator' && token.value === '-' &&
                                         (lastToken.type === 'colon' || lastToken.type === 'space' || lastToken.type === 'brace_open' || lastToken.type === 'comma' || lastToken.type === 'operator' || lastToken.type === 'paren_open');

                         if (!isUnary) {
                             if (!result.endsWith(' ')) result += ' ';
                         }
                     }
                }
                // Space after comma
                else if (lastToken.type === 'comma') {
                     if (!result.endsWith(' ')) result += ' ';
                }
            }
        }

        // --- Append Token ---
        result += token.value;

        // --- Context & Indent Updates (After Token) ---

        if (token.type === 'brace_open') {
            contextStack.push('block');
            indentLevel++;
        } else if (token.type === 'interpolation_start') {
            contextStack.push('interpolation');
        } else if (token.type === 'brace_close') {
            const ctx = contextStack.pop();
        } else if (token.type === 'paren_open') {
            contextStack.push('map'); // or args
        } else if (token.type === 'paren_close') {
             const ctx = contextStack[contextStack.length - 1];
             if (ctx === 'map') {
                 contextStack.pop();
             }
        }

        hasLeadingSpace = false;
        lastToken = token;
    }

    return result.trim() + '\n';
}

function sortLessImports(text: string): string {
    const lines = text.split('\n');
    const groups: { start: number, lines: string[] }[] = [];
    let currentGroup: { start: number, lines: string[] } | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.startsWith('@import')) {
            if (!currentGroup) {
                currentGroup = { start: i, lines: [] };
            }
            currentGroup.lines.push(line);
        } else if (trimmed === '') {
            // Allow empty lines within a group of imports
            if (currentGroup) {
                currentGroup.lines.push(line);
            }
        } else {
            // Comments or other rules break the group (to avoid sorting comments wrongly)
            if (currentGroup) {
                groups.push(currentGroup);
                currentGroup = null;
            }
        }
    }
    if (currentGroup) {
        groups.push(currentGroup);
    }

    // Sort valid groups
    for (const group of groups) {
        const importLines = group.lines.filter(l => l.trim().startsWith('@import'));
        const emptyLines = group.lines.filter(l => l.trim() === '');

        if (importLines.length > 1) {
            importLines.sort((a, b) => a.trim().localeCompare(b.trim()));

            // Rewrite lines in the original text
            let lineIdx = group.start;
            for (const imp of importLines) {
                lines[lineIdx++] = imp;
            }
            // Append any empty lines that were in the group at the end
            for (const empty of emptyLines) {
                lines[lineIdx++] = empty;
            }
        }
    }

    return lines.join('\n');
}
