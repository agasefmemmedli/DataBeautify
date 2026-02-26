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
    const contextStack: { type: 'block' | 'map' | 'interpolation', indented: boolean }[] = [];

    const getIndent = () => indentString.repeat(Math.max(0, indentLevel));

    let hasLeadingSpace = false;
    let preservedNewline = false;
    let pendingBlankLines = 0;
    let lastToken: SCSSToken | null = null;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === 'space') {
            hasLeadingSpace = true;
            const newlines = (token.value.match(/\n/g) || []).length;
            if (newlines > 0) {
                preservedNewline = true;
                if (newlines > 1) {
                    pendingBlankLines = Math.max(pendingBlankLines, 1); // Cap at 1 blank line usually
                }
            }
            continue;
        }

        // --- Context Closing Logic (Before Token) ---

        if (token.type === 'brace_close') {
             const ctx = contextStack[contextStack.length - 1];
             if (ctx && ctx.type === 'block') {
                 indentLevel = Math.max(0, indentLevel - 1);
                 // Force newline for block close
                 if (!result.endsWith('\n')) {
                     result = result.trimEnd() + '\n';
                 }
                 result += getIndent();
                 hasLeadingSpace = false;
                 preservedNewline = false;
             }
        } else if (token.type === 'paren_close') {
             const ctx = contextStack[contextStack.length - 1];
             if (ctx && ctx.type === 'map') {
                 if (ctx.indented) {
                     indentLevel = Math.max(0, indentLevel - 1);
                     if (!result.endsWith('\n')) {
                         result = result.trimEnd() + '\n';
                     }
                     result += getIndent();
                     hasLeadingSpace = false;
                     preservedNewline = false;
                 }
             }
        }

        // --- Newline Logic (Before Token) ---

        let forceNewline = false;

        if (lastToken) {
            if (lastToken.type === 'semicolon') {
                forceNewline = true;
            } else if (lastToken.type === 'brace_open') {
                forceNewline = true;
            } else if (lastToken.type === 'brace_close') {
                if (token.type !== 'comma' && token.type !== 'semicolon' && token.type !== 'brace_close') {
                    forceNewline = true;
                }
            } else if (lastToken.type === 'comment') {
                 if (lastToken.value.startsWith('//') || lastToken.value.includes('\n')) {
                     forceNewline = true;
                 }
            }
        }

        // Map/List Multiline Logic
        const currentCtx = contextStack.length > 0 ? contextStack[contextStack.length - 1] : null;
        if (preservedNewline && currentCtx && currentCtx.type === 'map') {
            if (!currentCtx.indented) {
                currentCtx.indented = true;
                indentLevel++;
            }
            forceNewline = true;
        }

        // Handle Blank Lines
        // If we have pending blank lines, and we are about to write a newline (or start of line), insert them.
        // Or if we encounter a new token and we had >1 newlines before it.
        if (pendingBlankLines > 0) {
            // Ensure we start on a new line
            if (!result.endsWith('\n')) {
                result = result.trimEnd() + '\n';
            }
            // Add blank line(s)
            result += '\n'; // Just one blank line
            // Add indentation for the next line
            result += getIndent();
            hasLeadingSpace = false;
            forceNewline = false; // We already added newlines
            pendingBlankLines = 0;
        }

        if (forceNewline) {
             if (!result.endsWith('\n')) {
                 result = result.trimEnd() + '\n' + getIndent();
                 hasLeadingSpace = false;
             } else if (!result.endsWith(getIndent()) && !result.endsWith('\n\n' + getIndent())) {
                 // If we have matching indent, good.
                 // But wait, getIndent() returns string.
                 // We want to ensure the last line has correct indentation.
                 // If result ends with \n, append indent.
                 if (result.endsWith('\n')) {
                     result += getIndent();
                 } else {
                     // Should not happen if endsWith \n check passed?
                     // Ah, endsWith('\n') is false if it ends with spaces?
                     // trimEnd() fixed that.
                 }
                 hasLeadingSpace = false;
             }
        }

        // Handle "@else" special case
        if (token.type === 'at_keyword' && (token.value === '@else' || token.value === '@elseif') && lastToken && lastToken.type === 'brace_close') {
             const ending = '\n' + getIndent();
             if (result.endsWith(ending)) {
                  result = result.substring(0, result.length - ending.length);
                  result += ' ';
                  hasLeadingSpace = false;
             }
        }

        // Add space if needed
        if (hasLeadingSpace && !result.endsWith('\n') && !result.endsWith(' ')) {
             result += ' ';
        } else if (!hasLeadingSpace && !result.endsWith('\n') && !result.endsWith(' ')) {
             // Strict spacing
             if (lastToken) {
                 if (lastToken.type === 'colon' && token.type !== 'semicolon' && token.type !== 'comma') {
                      result += ' ';
                 } else if (token.type === 'brace_open') {
                      result += ' ';
                 } else if (token.type === 'operator' || lastToken.type === 'operator') {
                      if (token.value === '-' && (lastToken.type === 'colon' || lastToken.type === 'space' || lastToken.type === 'paren_open' || lastToken.type === 'comma')) {
                          // Unary minus
                      } else {
                          result += ' ';
                      }
                 } else if (lastToken.type === 'comma') {
                      result += ' ';
                 }
             }
        }

        // --- Append Token ---
        result += token.value;

        // --- Context Updates (After Token) ---
        if (token.type === 'brace_open') {
            contextStack.push({ type: 'block', indented: true });
            indentLevel++;
        } else if (token.type === 'interpolation_start') {
            contextStack.push({ type: 'interpolation', indented: false });
        } else if (token.type === 'brace_close') {
            if (contextStack.length > 0 && contextStack[contextStack.length - 1].type === 'interpolation') {
                contextStack.pop();
            } else if (contextStack.length > 0 && contextStack[contextStack.length - 1].type === 'block') {
                 contextStack.pop();
            }
        } else if (token.type === 'paren_open') {
            contextStack.push({ type: 'map', indented: false });
        } else if (token.type === 'paren_close') {
             if (contextStack.length > 0 && contextStack[contextStack.length - 1].type === 'map') {
                 contextStack.pop();
             }
        }

        hasLeadingSpace = false;
        preservedNewline = false;
        // pendingBlankLines = 0; // handled above
        lastToken = token;
    }

    return result.trim() + '\n';
}
