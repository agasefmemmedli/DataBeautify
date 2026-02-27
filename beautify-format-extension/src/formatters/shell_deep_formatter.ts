import { ShellTokenizer, Token, TokenType } from './shell_tokenizer';

export function formatShellDeep(text: string): string {
    const tokenizer = new ShellTokenizer(text);
    const tokens = tokenizer.tokenize();
    const formattedLines: string[] = [];

    let indentLevel = 0;
    let inHeredoc = false;
    let heredocDelimiter = '';
    let heredocOp = '';

    const contextStack: string[] = [];

    let currentLineTokens: Token[] = [];

    // Indent size: 2 spaces (Google Style)
    const INDENT_STR = '  ';

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === TokenType.Newline) {
            processLine(currentLineTokens, token.text.startsWith('\\'));
            currentLineTokens = [];
        } else {
            currentLineTokens.push(token);
        }
    }
    if (currentLineTokens.length > 0) {
        processLine(currentLineTokens, false);
    }

    function processLine(lineTokens: Token[], isContinuation: boolean) {
        // Handle Heredoc Body
        if (inHeredoc) {
            const fullLine = lineTokens.map(t => t.text).join('');
            const trimmed = fullLine.trim();

            if (trimmed === heredocDelimiter) {
                inHeredoc = false;
                if (heredocOp === '<<-') {
                     // Standard says <<- strips leading tabs. We keep it as is or use spaces if indentLevel > 0?
                     // Let's use 2 spaces per indentLevel but user might expect tabs.
                     // However, modern editors expand tabs.
                     // For stability, we just output trimmed delimiter if it matches.
                     // But we should probably indent it visually?
                     // Let's output it aligned with current indent level using spaces,
                     // but <<- requires tabs to strip.
                     // If we output spaces, the script breaks if it relies on stripping.
                     // Safe bet: Output raw if it was indented with tabs in source? We lost that info.
                     // Best effort: Output without indentation for delimiter to ensure it closes.
                     formattedLines.push(trimmed);
                } else {
                    formattedLines.push(trimmed);
                }
            } else {
                formattedLines.push(fullLine);
            }
            return;
        }

        const interestingTokens = lineTokens.filter(t => t.type !== TokenType.Whitespace);

        // Empty line or Comment-only line
        if (interestingTokens.length === 0) {
            if (lineTokens.some(t => t.type === TokenType.Comment)) {
                 const comment = lineTokens.find(t => t.type === TokenType.Comment);
                 if (comment) {
                     formattedLines.push(INDENT_STR.repeat(indentLevel) + comment.text.trim());
                 }
            } else {
                if (!isContinuation) formattedLines.push('');
            }
            return;
        }

        // Check for Heredoc Start
        for (let j = 0; j < interestingTokens.length; j++) {
            const t = interestingTokens[j];
            if (t.type === TokenType.HeredocStart) {
                heredocOp = t.text;
                if (j + 1 < interestingTokens.length) {
                    heredocDelimiter = interestingTokens[j + 1].text;
                    heredocDelimiter = heredocDelimiter.replace(/^['"]|['"]$/g, '');
                    inHeredoc = true;
                }
            }
        }

        const first = interestingTokens[0];
        const last = interestingTokens[interestingTokens.length - 1];

        // --- Dedent Logic ---
        const dedentKeywords = new Set(['fi', 'done', 'esac', '}', 'elif', 'else', ']', ']]']);
        let tempDedent = false;

        if (dedentKeywords.has(first.text)) {
            if (first.text === 'elif' || first.text === 'else') {
                 tempDedent = true;
            } else if (first.text === 'fi' || first.text === 'done' || first.text === 'esac' || first.text === '}') {
                if (indentLevel > 0) indentLevel--;
                if (first.text === 'esac') {
                    if (contextStack.length > 0 && contextStack[contextStack.length-1] === 'case') {
                        contextStack.pop();
                    }
                }
            } else if (first.text === ']' || first.text === ']]') {
                // Only dedent if this line starts with closing bracket
                // Check if we pushed indent for open bracket previously
                // We handle `[[` indent below.
                // If `[[` was on previous line, we indented.
                if (indentLevel > 0) indentLevel--;
            }
        }

        // Case Pattern Dedent: `;;`
        if (first.text === ';;') {
             if (indentLevel > 0) indentLevel--;
        }

        // Case Pattern Logic (Complex)
        // If line ends with `)` and context is case, it might be a pattern.
        // We want patterns at `case_indent + 1`.
        // `case ... in` puts us at `case_indent + 1`.
        // So patterns are naturally at `indentLevel`.
        // But body needs +1.
        // If we just finished a body with `;;`, we dedented. So we are back at `indentLevel`.
        // So pattern starts at `indentLevel`.

        let printIndent = indentLevel;
        if (tempDedent) printIndent = Math.max(0, printIndent - 1);

        let lineStr = INDENT_STR.repeat(printIndent);

        // --- Spacing Logic ---
        for (let j = 0; j < interestingTokens.length; j++) {
            const t = interestingTokens[j];
            const prev = j > 0 ? interestingTokens[j-1] : null;

            if (j > 0 && prev) {
                let space = ' ';
                const currentContext = contextStack.length > 0 ? contextStack[contextStack.length - 1] : null;
                const isArithmetic = currentContext === 'arithmetic';
                const isTest = currentContext === 'test';

                const isAdjacent = (t.col === prev.col + prev.text.length);

                // 1. Assignments
                if (t.text === '=' || prev.text === '=') {
                    if (isTest || isArithmetic) {
                        space = ' ';
                    } else {
                        if (t.type === TokenType.Assignment || prev.type === TokenType.Assignment) {
                            space = '';
                        } else {
                            if (t.type === TokenType.Operator && t.text === '=') space = ' ';
                            if (prev.type === TokenType.Operator && prev.text === '=') space = ' ';
                        }
                    }
                }

                // 2. Redirection
                else if (['>', '>>', '<', '<<', '<<-', '&>', '>&'].includes(t.text)) {
                     if (prev.type === TokenType.Number && /^[0-9]+$/.test(prev.text)) {
                          if (isAdjacent) space = '';
                          else space = ' ';
                     } else {
                         space = ' ';
                     }
                } else if (['>', '>>', '<', '<<', '<<-', '&>', '>&'].includes(prev.text)) {
                     space = ' ';
                }

                // 3. Pipes and Logic
                else if (['|', '||', '&&', ';'].includes(t.text)) {
                    if (t.text === ';') space = '';
                    else space = ' ';
                }
                else if (['|', '||', '&&', ';'].includes(prev.text)) {
                    space = ' ';
                }

                // 4. Parentheses / Brackets
                else if (t.text === '(') {
                    if (prev.type === TokenType.Identifier || prev.type === TokenType.Keyword) {
                         if (['if', 'for', 'while', 'case', 'elif'].includes(prev.text)) space = ' ';
                         else space = ''; // func()
                    } else {
                        space = ' ';
                    }
                }

                else if (t.text === ')') {
                     if (prev.text === '(') space = '';
                     else space = ''; // cmd) or (cmd) -> Google says (command) so no space?
                     // But verify-shell-deep output showed `( 1 + 1 )` in arithmetic?
                     // Wait, `test.deep.sh` has `$((1 + 1))`.
                     // The tokens are `$((`, `1`, `+`, `1`, `))`.
                     // `1` after `$((` -> space=' '.
                     // `+` after `1` -> space=' '.
                     // `1` after `+` -> space=' '.
                     // `))` after `1`.
                     // `))` is not `)`.
                }

                else if (prev.text === '(') {
                     space = '';
                }

                // 5. Case patterns `pattern)`
                else if (t.text === ')') {
                    if (prev.text === '|') space = '';
                    else space = '';
                }

                // 6. Semicolon
                else if (t.text === ';;') space = '';

                // 7. Comma (for arithmetic or brace expansion)
                else if (t.text === ',') space = '';
                else if (prev.text === ',') space = ' ';

                // 8. Variable Expansion
                else if (t.type === TokenType.Variable && prev.text === '{') space = ''; // ${VAR} handled by tokenizer as one token? No.
                // Tokenizer produces `${` as operator if matched, or `$VAR` as variable.
                // If `${`, next is Identifier `VAR`.
                // `Token: ${` -> `Token: VAR` -> `Token: }`.

                else if (prev.text === '${') space = '';
                else if (t.text === '}') {
                    if (prev.type === TokenType.Identifier || prev.type === TokenType.Variable) {
                         // Check if we are in `${...}` context?
                         // Hard to track without full parser.
                         // But `}` usually closes `${` or `{`.
                         // If `${` was seen recently on this line?
                         if (interestingTokens.some(tok => tok.text === '${')) {
                              space = '';
                         } else {
                              space = ' '; // `{ command; }` -> space before }
                         }
                    }
                }

                // Override: if adjacent in source was strict?
                // For now rely on logic.

                lineStr += space;
            }

            // Track Context
            if (t.text === '((' || t.text === '$(((' || t.text === '$((') {
                contextStack.push('arithmetic');
            } else if (t.text === '[[' || t.text === '[') {
                contextStack.push('test');
            } else if (t.text === 'case') {
                contextStack.push('case');
            }

            lineStr += t.text;

            if (t.text === '))' && contextStack.length > 0 && contextStack[contextStack.length - 1] === 'arithmetic') {
                contextStack.pop();
            } else if ((t.text === ']]' || t.text === ']') && contextStack.length > 0 && contextStack[contextStack.length - 1] === 'test') {
                contextStack.pop();
            } else if (t.text === 'esac' && contextStack.length > 0 && contextStack[contextStack.length - 1] === 'case') {
                contextStack.pop();
            }
        }

        // Add line continuation if present
        if (isContinuation) {
             // Ensure space before backslash
             if (!lineStr.endsWith(' ')) lineStr += ' ';
             lineStr += '\\';
        }

        formattedLines.push(lineStr);

        // --- Indent Logic (Post-Print) ---
        const openKeywords = new Set(['then', 'do', '{', 'else', 'elif']);

        if (last.text === 'then' || last.text === 'do' || last.text === '{') {
            indentLevel++;
        } else if (last.text === '(') {
            indentLevel++;
        } else if (last.text === 'else' || last.text === 'elif') {
             indentLevel++;
        }

        // Case: `case ... in` -> Indent
        if (first.text === 'case' && last.text === 'in') {
            indentLevel++;
            contextStack.push('case');
        }

        // `[[` at end of line (multiline condition)
        if (last.text === '[[') {
            indentLevel++;
        }

        // Case Patterns: `pattern)`
        if (last.text === ')' && contextStack.length > 0 && contextStack[contextStack.length-1] === 'case') {
             // Check if it's a subshell inside case?
             // `(cmd)` on one line.
             // If line starts with `(`, it might be `(pat)` or `(cmd)`.
             // But valid pattern is `pat)` or `(pat)`.
             // If line contains `;;`, it's a one-liner case, don't indent.
             if (!interestingTokens.some(t => t.text === ';;')) {
                 // Check if it looks like a command?
                 // Heuristic: if it ends with `)`, it's likely a pattern start in `case` block.
                 indentLevel++;
             }
        }
    }

    return formattedLines.join('\n');
}
