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
        const dedentKeywords = new Set(['fi', 'done', 'esac', '}', 'elif', 'else', ']', ']]', ')']);
        let tempDedent = false;

        if (dedentKeywords.has(first.text)) {
            if (first.text === 'elif' || first.text === 'else') {
                 if (indentLevel > 0) indentLevel--;
            } else if (first.text === 'fi' || first.text === 'done' || first.text === 'esac' || first.text === '}' || (first.text === ')' && lineTokens.length === 1)) {
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

        let printIndent = indentLevel;
        if (tempDedent) printIndent = Math.max(0, printIndent - 1);

        let lineStr = INDENT_STR.repeat(printIndent);

        // --- Spacing Logic ---
        for (let j = 0; j < interestingTokens.length; j++) {
            const t = interestingTokens[j];
            const prev = j > 0 ? interestingTokens[j-1] : null;
            const next = j < interestingTokens.length - 1 ? interestingTokens[j+1] : null;

            if (j > 0 && prev) {
                let space = ' ';
                const currentContext = contextStack.length > 0 ? contextStack[contextStack.length - 1] : null;
                const isArithmetic = currentContext === 'arithmetic';
                const isTest = currentContext === 'test';

                const isAdjacent = (t.col === prev.col + prev.text.length);

                // Preserve original adjacency for specific operators if they were adjacent
                // to prevent bugs like `- a` instead of `-a`, `/ dev / null`, `>& 2`
                if (isAdjacent && (t.type === TokenType.Operator || prev.type === TokenType.Operator)) {
                     // We want to keep adjacent things together if they form unary operators, paths, etc.
                     // But we must be careful not to glue words together if they shouldn't be.
                     // Actually, if they are adjacent in the original source, and one is an operator
                     // like `-`, `/`, `&`, etc., it's usually intentional (e.g., `-z`, `/dev/null`).
                     // Let's refine this to avoid spaces around `/`, `-`, `~`, `!`, `&`, `|` if they were adjacent
                     // except for pipes `|` and background `&` which usually have spaces.
                     if (t.text === '/' || prev.text === '/') space = '';
                     if (t.text === '-' && isTest) space = ''; // `-z "$arg"`
                     if (prev.text === '-' && isTest) space = '';
                     if (t.text === '&' || prev.text === '&') {
                         if (['>', '<', '2>', '1>'].includes(prev.text) || ['>', '<'].includes(t.text)) space = '';
                     }
                     if (t.type === TokenType.Number && ['>&', '<&'].includes(prev.text)) space = '';
                }

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
                     if (t.type === TokenType.Number && isAdjacent) {
                         space = ''; // `>&2`
                     } else {
                         space = ' ';
                     }
                }

                // 2b. Paths and hyphens (fallback if adjacent check didn't catch it)
                else if (t.text === '/' || prev.text === '/') {
                    if (isAdjacent) space = '';
                }
                else if (t.text === '-' || prev.text === '-') {
                    if (isAdjacent) space = '';
                }
                else if (prev.text === '[' || prev.text === '[[') space = ' ';
                else if (t.text === ']' || t.text === ']]') space = ' ';

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
        } else if (last.text === '(' && first.text !== '(') {
            if (first.text !== 'function') {
                 indentLevel++;
            }
        } else if (last.text === '(' && first.text === '(' && lineTokens.length === 1) {
            indentLevel++; // Open subshell on its own line
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
             if (!interestingTokens.some(t => t.text === ';;')) {
                 if (first.type === TokenType.String || first.type === TokenType.Identifier || first.text === '*' || first.text === '(' || first.text === ')') {
                     indentLevel++;
                 }
             }
        }

        // Dedent after single-line case patterns or at the end of case blocks
        if (last.text === ';;' && first.text !== ';;') {
            if (indentLevel > 0) indentLevel--;
        }
    }

    return formattedLines.join('\n');
}
