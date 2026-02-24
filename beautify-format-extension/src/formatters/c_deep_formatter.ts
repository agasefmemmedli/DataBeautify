
import { CTokenizer, Token, TokenType } from './c_tokenizer';

interface BraceContext {
    type: string; // 'block', 'switch', 'struct', 'enum', 'array', 'initializer'
    caseIndented: boolean; // For switch: whether we have indented for a case label
    isInline: boolean; // If true, we are in an inline block (no newlines)
}

export function formatCDeep(text: string): string {
    const tokenizer = new CTokenizer(text);
    const tokens = tokenizer.tokenize();

    if (tokens.length === 0) return '';

    // Configuration (could be options later)
    const INDENT_SIZE = 4;
    const INDENT_STRING = ' '.repeat(INDENT_SIZE);
    const PRINT_WIDTH = 120; // Used for inline heuristic

    let outputLines: string[] = [];
    let currentLine = '';
    let indentLevel = 0;

    // State
    let parenDepth = 0;
    let braceStack: BraceContext[] = [];
    let newlineCount = 0;
    let justBrokeLine = false;

    // Helper to get current indent string
    const getIndent = (offset: number = 0) => {
        return INDENT_STRING.repeat(Math.max(0, indentLevel + offset));
    };

    // Helper to push line
    const pushLine = (force: boolean = false) => {
        if (currentLine.trim() !== '') {
            outputLines.push(currentLine);
            currentLine = '';
            newlineCount = 0;
        } else if (force) {
             if (newlineCount < 1) {
                 outputLines.push('');
                 newlineCount++;
             }
        }
    };

    // Helper to append text
    const append = (str: string) => {
        justBrokeLine = false;
        newlineCount = 0;

        if (currentLine === '') {
            let offset = 0;
            const trimmedStr = str.trim();

            if (trimmedStr.startsWith('#')) {
                currentLine = str;
                return;
            }

            currentLine = getIndent(offset) + str;
        } else {
            currentLine += str;
        }
    };

    const isTypeLike = (t: Token) => {
         if (t.type === TokenType.Keyword) {
             return ['int', 'char', 'bool', 'void', 'float', 'double', 'long', 'short', 'unsigned', 'signed', 'auto', 'const', 'struct', 'union', 'enum', 'size_t', 'ssize_t', 'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t', 'uintptr_t', 'intptr_t', 'ptrdiff_t', 'wchar_t', 'intptr_t', 'uintptr_t', 'char16_t', 'char32_t', 'restrict', '__restrict', '__restrict__'].includes(t.text);
         }
         if (t.type === TokenType.Identifier) {
             return /_t$/.test(t.text) || /^[A-Z]/.test(t.text);
         }
         return false;
    };

    // Helper to check if a block can be inline
    const canBeInline = (startIndex: number): boolean => {
        let length = 0;
        let index = startIndex + 1;
        let depth = 1;

        while (index < tokens.length) {
            const t = tokens[index];
            if (t.type === TokenType.Newline || t.type === TokenType.Comment) return false; // No newlines/comments in inline

            length += t.text.length;
            if (length > 60) return false; // Too long (heuristic)

            if (t.text === '{') depth++;
            else if (t.text === '}') {
                depth--;
                if (depth === 0) return true;
            }
            index++;
        }
        return false;
    };

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        // Peek
        const next = i + 1 < tokens.length ? tokens[i+1] : null;
        let k = i - 1;
        while (k >= 0 && (tokens[k].type === TokenType.Whitespace || tokens[k].type === TokenType.Newline)) {
            k--;
        }
        let effectivePrev = (k >= 0) ? tokens[k] : null;

        if (token.type === TokenType.Whitespace) continue;

        // Handling Newlines
        if (token.type === TokenType.Newline) {
            // Check if we are in an inline block
            const currentContext = braceStack.length > 0 ? braceStack[braceStack.length - 1] : null;
            if (currentContext && currentContext.isInline) {
                // If we are forcing inline, we ignore source newlines?
                // Or maybe we treat them as spaces?
                // Ideally, deep formatting reconstructs lines.
                // But preserving user intent for newlines is sometimes good.
                // However, "Deep Formatting" usually enforces style.
                // Let's replace newline with space if inline.
                if (currentLine !== '' && !currentLine.endsWith(' ')) currentLine += ' ';
                continue;
            }

            if (currentLine.trim() !== '') {
                pushLine();
            } else {
                if (!justBrokeLine && newlineCount < 1) {
                     outputLines.push('');
                     newlineCount++;
                }
                justBrokeLine = false;
            }
            continue;
        }

        // Handle Closing Brace Indentation
        if (token.text === '}') {
            if (braceStack.length > 0) {
                const ctx = braceStack[braceStack.length - 1];
                if (ctx.type === 'switch' && ctx.caseIndented) {
                    indentLevel = Math.max(0, indentLevel - 1);
                    ctx.caseIndented = false;
                }
                if (!ctx.isInline) {
                     indentLevel = Math.max(0, indentLevel - 1);
                     if (currentLine.trim() !== '') pushLine(); // Force new line for closing brace if not inline
                }
            } else {
                 indentLevel = Math.max(0, indentLevel - 1);
            }
        }

        // Handle Case/Default Indentation (Dedent before checking logic)
        if ((token.text === 'case' || token.text === 'default') && braceStack.length > 0) {
            const ctx = braceStack[braceStack.length - 1];
            if (ctx.type === 'switch') {
                if (ctx.caseIndented) {
                    indentLevel = Math.max(0, indentLevel - 1);
                    ctx.caseIndented = false;
                }
                if (currentLine.trim() !== '') pushLine();
            }
        }

        // Spacing Logic
        let spaceBefore = false;

        if (currentLine !== '') {
            const lastChar = currentLine[currentLine.length - 1];
            const prevWord = /\w$/.test(lastChar);
            const currWord = /^\w/.test(token.text);

            if (prevWord && currWord) spaceBefore = true;

            // Context-aware spacing
            if (effectivePrev) {
                 if (effectivePrev.type === TokenType.Operator) {
                     const op = effectivePrev.text;
                     if (['.', '->', '!', '~', '++', '--', '(', '['].includes(op)) {
                         spaceBefore = false;
                     } else if (op === '*' || op === '&') {
                         // Pointer/Address logic vs Multiplication/BitwiseAnd
                         // Heuristic: If prev is Type, or prev is Operator, it's likely unary/pointer
                         let m = k - 1;
                         while (m >= 0 && (tokens[m].type === TokenType.Whitespace || tokens[m].type === TokenType.Newline)) m--;
                         let prevPrevTok = (m >= 0) ? tokens[m] : null;

                         if (prevPrevTok && (isTypeLike(prevPrevTok) || prevPrevTok.type === TokenType.Operator || ['(', '[', '{', ',', 'case', 'return', '='].includes(prevPrevTok.text))) {
                              // Unary/Pointer context: e.g. int *p, or *p, or &x
                              // Style: int *p (Space before *, no space after)
                              // But wait, "int *p" -> "int" is Type. So effectivePrev is "*".
                              // If current is "p". effectivePrev is "*".
                              // We are deciding space before "p".
                              // If effectivePrev was "*", spaceBefore depends on *'s context.

                              // Let's handle this when processing "*".
                              // Here we process token "p". effectivePrev is "*".
                              // If effectivePrev was pointer-*, we usually want NO space before p.
                              // How do we know?
                              // Re-evaluate * context:
                              if (prevPrevTok && (isTypeLike(prevPrevTok) || prevPrevTok.type === TokenType.Operator || ['(', '[', '{', ',', 'case', 'return', '='].includes(prevPrevTok.text))) {
                                  // Likely pointer/unary
                                  // Special case: "int * const p" -> space before const? Yes.
                                  if (token.type === TokenType.Keyword && ['const', 'restrict', 'volatile', '__restrict', '__restrict__'].includes(token.text)) {
                                      spaceBefore = true;
                                  } else {
                                      spaceBefore = false; // int *p
                                  }
                              } else {
                                  spaceBefore = true; // Binary mult: x * y
                              }
                         } else {
                              spaceBefore = true; // Binary mult
                         }
                     } else {
                         spaceBefore = true; // Binary ops
                     }
                 } else if (effectivePrev.type === TokenType.Punctuation) {
                     if ([';', ',', '}'].includes(effectivePrev.text)) spaceBefore = true;
                     if (effectivePrev.text === ')') {
                         // ) { -> space
                         // ) var -> space
                         // ) -> -> no space
                         // ) . -> no space
                         spaceBefore = true;
                     }
                     if (effectivePrev.text === '(' || effectivePrev.text === '[') spaceBefore = false;
                     // Special: { .x
                     if (effectivePrev.text === '{') {
                         spaceBefore = true; // Padding inside braces
                         // If empty {} -> no space? Handled by } logic checking {
                     }
                 } else if (effectivePrev.type === TokenType.Keyword) {
                     if (['if', 'for', 'while', 'switch', 'return', 'case', 'goto', 'else'].includes(effectivePrev.text)) {
                         spaceBefore = true;
                     } else if (['sizeof', 'alignof'].includes(effectivePrev.text)) {
                         spaceBefore = false; // sizeof(x)
                     }
                 }
            }

            if (token.type === TokenType.Operator) {
                const text = token.text;
                if (['.', '->', ')', ']', ';', ',', '++', '--'].includes(text)) spaceBefore = false;
                else if (text === '<' || text === '>') {
                     if (currentLine.trim().startsWith('#include')) spaceBefore = (text === '<');
                     else spaceBefore = true;
                }
                else if (text === '*' || text === '&') {
                    // Check if Unary/Pointer
                    if (effectivePrev && (
                        isTypeLike(effectivePrev) ||
                        (effectivePrev.type === TokenType.Operator && ['!', '~', '++', '--', '*', '&', '(', '[', '{', '=', ',', ';'].includes(effectivePrev.text)) ||
                        ['(', '[', '{', ',', 'return', 'case', '='].includes(effectivePrev.text)
                    )) {
                        // Pointer or Unary
                        spaceBefore = true; // int *p (Space before *)
                        // Except if prev is ( or [ or { or * (ptr to ptr)
                        if (effectivePrev.text === '(' || effectivePrev.text === '[' || effectivePrev.text === '{') spaceBefore = false; // (*p)
                        if (effectivePrev.text === '*') spaceBefore = false; // int **p
                    } else {
                        spaceBefore = true; // Binary
                    }
                }
                else if (['=', '+=', '-=', '*=', '/=', '%=', '==', '!=', '<=', '>=', '&&', '||', '+', '-', '/', '%', '^', '|', '&', '?', ':', '<<', '>>', '<<=', '>>=', '&=', '|=', '^='].includes(text)) {
                     spaceBefore = true;
                     if (text === ':' && (braceStack.length > 0 && braceStack[braceStack.length-1].type === 'switch')) {
                         spaceBefore = false; // case 1:
                     }
                }
                else if (['!', '~'].includes(text)) {
                    spaceBefore = true;
                    if (['(', '[', '{', '!', '~'].includes(lastChar)) spaceBefore = false;
                }

                // Designated Initializer: .x = 1
                if (text === '.') {
                    if (effectivePrev && (effectivePrev.text === '{' || effectivePrev.text === ',')) {
                        spaceBefore = true; // { .x, .y
                    } else {
                        spaceBefore = false; // struct.member
                    }
                }
            }

            if (token.text === ';') spaceBefore = false;
            if (token.text === ',') spaceBefore = false;
            if (token.text === ')') spaceBefore = false;
            if (token.text === ']') spaceBefore = false;
            if (token.text === '(') {
                 if (currentLine.trim().match(/\b(if|for|while|switch|return)$/)) spaceBefore = true;
                 else if (effectivePrev && effectivePrev.type === TokenType.Operator && !['.', '->', '!', '~', '++', '--'].includes(effectivePrev.text)) spaceBefore = true;
                 else spaceBefore = false; // function()
            }
            if (token.text === '[') {
                 if (currentLine.trim().match(/\b\w+$/)) spaceBefore = false; // arr[i]
                 else spaceBefore = true; // [10] = ... (Designated initializer start?) No, usually x = [10]... wait C doesn't allow x = [10]. int a[] = {[0]=1};
                 // designated initializer: [0] = 1. Preceded by { or ,
                 if (effectivePrev && (effectivePrev.text === '{' || effectivePrev.text === ',')) spaceBefore = true;
            }
            if (token.text === ':') {
                 // Bitfields? int x : 1; -> space before
                 // Switch case? case 1: -> no space before
                 // Label? label: -> no space before
                 // Ternary? ? a : b -> space before
                 // We can check braceStack or look for ?
                 if (currentLine.trim().startsWith('case ') || currentLine.trim() === 'default') spaceBefore = false;
            }
            if (token.text === '{') spaceBefore = true;
        }

        if (spaceBefore && currentLine !== '' && !currentLine.endsWith(' ')) append(' ');
        append(token.text);

        // --- Post-Append Logic ---

        if (token.text === '{') {
            // Determine context
            let context = 'block';
            let isInline = false;

            if (canBeInline(i)) {
                isInline = true;
                context = 'initializer'; // Treat inline as initializer usually
            } else {
                // Check context by scanning backward (handling newlines/Allman style)
                let k = i - 1;
                while (k >= 0 && (tokens[k].type === TokenType.Whitespace || tokens[k].type === TokenType.Newline)) {
                    k--;
                }
                const effectivePrev = (k >= 0) ? tokens[k] : null;

                if (effectivePrev) {
                    if (effectivePrev.text === '=') context = 'initializer';
                    else if (effectivePrev.text === '[]') context = 'initializer';
                    else if (effectivePrev.text === 'struct') context = 'struct';
                    else if (effectivePrev.text === 'enum') context = 'enum';
                    else if (effectivePrev.text === 'switch') context = 'switch';
                    else if (effectivePrev.text === ')') {
                         // Backtrack to find matching (
                         let m = k;
                         let pDepth = 0;
                         while (m >= 0) {
                             if (tokens[m].text === ')') pDepth++;
                             else if (tokens[m].text === '(') {
                                 pDepth--;
                                 if (pDepth === 0) {
                                     // Found matching (. Look before it.
                                     let n = m - 1;
                                     while (n >= 0 && (tokens[n].type === TokenType.Whitespace || tokens[n].type === TokenType.Newline)) n--;
                                     if (n >= 0) {
                                         if (tokens[n].text === 'switch') context = 'switch';
                                         else if (tokens[n].text === 'enum') context = 'enum'; // typedef enum (...)
                                         else if (tokens[n].text === 'struct') context = 'struct';
                                     }
                                     break;
                                 }
                             }
                             m--;
                         }
                    }
                }
            }

            braceStack.push({ type: context, caseIndented: false, isInline });

            if (!isInline) {
                indentLevel++;
                pushLine();
                justBrokeLine = true;
            }
        }
        else if (token.text === '}') {
            const ctx = braceStack.pop(); // Pop handled brace

            // Check next token
            let k = i + 1;
            while (k < tokens.length && (tokens[k].type === TokenType.Whitespace)) k++; // Skip space, not newline
            const effectiveNext = (k < tokens.length) ? tokens[k] : null;

            if (ctx && ctx.isInline) {
                // Do nothing special, we are inline
                if (effectiveNext && (effectiveNext.text === ';' || effectiveNext.text === ',')) {
                    // It will be appended next loop
                } else {
                    if (effectiveNext && effectiveNext.text === 'else') {
                         append(' ');
                    } else if (effectiveNext && effectiveNext.type !== TokenType.Punctuation) {
                        pushLine();
                        justBrokeLine = true;
                    }
                }
            } else {
                if (effectiveNext && (effectiveNext.text === ';' || effectiveNext.text === ',')) {
                    // Stay on same line for ; or ,
                } else if (effectiveNext && effectiveNext.type === TokenType.Identifier) {
                    append(' '); // typedef struct { ... } Name;
                } else if (effectiveNext && effectiveNext.text === 'else') {
                    append(' ');
                } else {
                    pushLine();
                    justBrokeLine = true;
                }
            }
        }
        else if (token.text === ';') {
            if (parenDepth === 0) {
                // If we are in an inline block, we generally do NOT break line?
                // But ; usually ends a statement.
                // In for loop (parenDepth > 0) we don't break.
                // In inline struct initializer? e.g. { .x = 1; .y = 2; } ? No, use comma.
                // If inline function? { return 1; }
                const currentCtx = braceStack.length > 0 ? braceStack[braceStack.length-1] : null;
                if (currentCtx && currentCtx.isInline) {
                    append(' '); // Space after ;
                } else {
                    pushLine();
                    justBrokeLine = true;
                }
            }
        }
        else if (token.text === ':') {
            if (braceStack.length > 0) {
                const ctx = braceStack[braceStack.length-1];
                if (ctx.type === 'switch') {
                    if (currentLine.trim().startsWith('case ') || currentLine.trim() === 'default:') {
                        pushLine();
                        justBrokeLine = true;
                        if (!ctx.caseIndented) {
                            indentLevel++;
                            ctx.caseIndented = true;
                        }
                    }
                }
            }
        }
        else if (token.text === ',') {
            if (parenDepth === 0) {
                 const currentCtx = braceStack.length > 0 ? braceStack[braceStack.length-1] : null;
                 if (currentCtx && currentCtx.isInline) {
                     append(' ');
                 } else {
                     // In initializer list (not inline), comma breaks line?
                     // e.g. enum { A, B, C } -> if not inline, yes.
                     if (currentCtx && (currentCtx.type === 'enum' || currentCtx.type === 'initializer' || currentCtx.type === 'array' || currentCtx.type === 'struct')) {
                         pushLine();
                         justBrokeLine = true;
                     }
                 }
            }
        }

        if (token.text === '(') parenDepth++;
        else if (token.text === ')') parenDepth = Math.max(0, parenDepth - 1);
    }

    if (currentLine.trim() !== '') pushLine();

    return outputLines.join('\n');
}
