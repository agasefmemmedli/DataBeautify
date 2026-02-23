import { tokenizeSCSS, SCSSToken } from './scss_tokenizer';

interface FormatterOptions {
    tabSize: number;
    insertSpaces: boolean;
}

export function formatSCSSDeep(text: string, options: FormatterOptions = { tabSize: 2, insertSpaces: true }): string {
    const tokens = tokenizeSCSS(text);
    let result = '';
    let indentLevel = 0;
    const indentString = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';

    // Context tracking
    const contextStack: ('block' | 'map' | 'interpolation')[] = [];

    const getIndent = () => indentString.repeat(Math.max(0, indentLevel));

    let hasLeadingSpace = false;
    let lastToken: SCSSToken | null = null;

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

        // Handle "Else" special case
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
                     // Check for &: ...
                     if (lastToken.type === 'operator' && lastToken.value === '&' && token.type === 'colon') {
                         // No space for &:hover
                     } else {
                         const isUnary = token.type === 'operator' && token.value === '-' &&
                                         (lastToken.type === 'colon' || lastToken.type === 'space' || lastToken.type === 'brace_open' || lastToken.type === 'comma' || lastToken.type === 'operator');

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
            contextStack.push('map');
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
