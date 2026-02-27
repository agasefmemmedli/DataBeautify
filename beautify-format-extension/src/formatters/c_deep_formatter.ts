
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

    const INDENT_SIZE = 4;
    const INDENT_STRING = ' '.repeat(INDENT_SIZE);

    let outputLines: string[] = [];
    let currentLine = '';
    let indentLevel = 0;

    // State
    let parenDepth = 0;
    // Track indentation for each parenthesis level
    // Store column index relative to start of line, or absolute?
    // Let's store absolute column index if on same line, or indent string.
    // Actually, simpler: if paren starts on a line, subsequent lines inside it align with start of paren + 1 (or indent + 4 if at end of line).
    // But we build line by line.
    // We need to know: When a newline happens inside parens, what should be the indent of the next line?
    // We can push the desired indent string onto a stack.
    let parenIndentStack: string[] = [];

    let braceStack: BraceContext[] = [];
    let newlineCount = 0;
    let justBrokeLine = false;
    let inPreprocessor = false;

    const getIndent = (offset: number = 0) => {
        return INDENT_STRING.repeat(Math.max(0, indentLevel + offset));
    };

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

    const append = (str: string, offset: number = 0) => {
        justBrokeLine = false;
        newlineCount = 0;

        if (currentLine === '') {
            if (parenDepth > 0 && parenIndentStack.length > 0) {
                // Use the paren indent for this depth
                // However, parenIndentStack might have fewer entries if we just closed some parens on previous line?
                // No, stack should track depth.
                // If parenDepth > stack length, we haven't pushed yet? No, we push on '('.
                // If we are at start of line inside parens, use the last indent.
                const indent = parenIndentStack[parenIndentStack.length - 1];
                currentLine = indent + str;
            } else {
                currentLine = getIndent(offset) + str;
            }
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

    const canBeInline = (startIndex: number): boolean => {
        let length = 0;
        let index = startIndex + 1;
        let depth = 1;

        while (index < tokens.length) {
            const t = tokens[index];
            if (t.type === TokenType.Newline || t.type === TokenType.Comment) return false;

            length += t.text.length;
            if (length > 60) return false;

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
        let k = i - 1;
        while (k >= 0 && (tokens[k].type === TokenType.Whitespace || tokens[k].type === TokenType.Newline)) {
            k--;
        }
        let effectivePrev = (k >= 0) ? tokens[k] : null;

        if (token.type === TokenType.Whitespace) continue;

        if (token.type === TokenType.Newline) {
            if (effectivePrev && effectivePrev.text === '\\') {
                pushLine();
                justBrokeLine = true;
                continue;
            }

            if (inPreprocessor) {
                inPreprocessor = false;
            }

            const currentContext = braceStack.length > 0 ? braceStack[braceStack.length - 1] : null;
            if (currentContext && currentContext.isInline) {
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

        if (token.type === TokenType.Preprocessor) {
            inPreprocessor = true;
        }

        if (token.text === '}') {
            if (braceStack.length > 0) {
                const ctx = braceStack[braceStack.length - 1];
                if (ctx.type === 'switch' && ctx.caseIndented) {
                    indentLevel = Math.max(0, indentLevel - 1);
                    ctx.caseIndented = false;
                }
                if (!ctx.isInline) {
                     indentLevel = Math.max(0, indentLevel - 1);
                     if (currentLine.trim() !== '') pushLine();
                }
            } else {
                 indentLevel = Math.max(0, indentLevel - 1);
            }
        }

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

        if (token.text === '{' && outputLines.length > 0 && currentLine.trim() === '') {
             if (!justBrokeLine && newlineCount === 0) {
                  currentLine = outputLines.pop() as string;
                  if (!currentLine.endsWith(' ')) currentLine += ' ';
             }
        }

        let spaceBefore = false;

        if (currentLine !== '') {
            const lastChar = currentLine[currentLine.length - 1];
            const prevWord = /\w$/.test(lastChar);
            const currWord = /^\w/.test(token.text);

            if (prevWord && currWord) spaceBefore = true;

            if (effectivePrev) {
                 if (effectivePrev.type === TokenType.Operator) {
                     const op = effectivePrev.text;
                     if (['.', '->', '!', '~', '++', '--', '(', '['].includes(op)) {
                         spaceBefore = false;
                     } else if (op === '*' || op === '&') {
                         let m = k - 1;
                         while (m >= 0 && (tokens[m].type === TokenType.Whitespace || tokens[m].type === TokenType.Newline)) m--;
                         let prevPrevTok = (m >= 0) ? tokens[m] : null;

                         let isUnary = false;
                         if (prevPrevTok && (isTypeLike(prevPrevTok) || prevPrevTok.type === TokenType.Operator || ['(', '[', '{', ',', 'case', 'return', '=', 'else', ':'].includes(prevPrevTok.text))) {
                              isUnary = true;
                         } else if (!prevPrevTok) {
                             isUnary = true;
                         }

                         if (isUnary) {
                             spaceBefore = false;
                         } else {
                             spaceBefore = true;
                         }
                     } else {
                         spaceBefore = true;
                     }
                 } else if (effectivePrev.type === TokenType.Punctuation) {
                     if ([';', ',', '}'].includes(effectivePrev.text)) spaceBefore = true;
                     if (effectivePrev.text === ')') {
                         spaceBefore = true;
                     }
                     if (effectivePrev.text === '(' || effectivePrev.text === '[') spaceBefore = false;
                     if (effectivePrev.text === '{') {
                         spaceBefore = true;
                     }
                 } else if (effectivePrev.type === TokenType.Keyword) {
                     if (['if', 'for', 'while', 'switch', 'return', 'case', 'goto', 'else'].includes(effectivePrev.text)) {
                         spaceBefore = true;
                     } else if (['sizeof', 'alignof'].includes(effectivePrev.text)) {
                         spaceBefore = false;
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
                    if (effectivePrev && (
                        isTypeLike(effectivePrev) ||
                        (effectivePrev.type === TokenType.Operator && ['!', '~', '++', '--', '*', '&', '(', '[', '{', '=', ',', ';', ':'].includes(effectivePrev.text)) ||
                        ['(', '[', '{', ',', 'return', 'case', '=', 'else', ':'].includes(effectivePrev.text)
                    )) {
                        spaceBefore = true; // int *p

                        if (effectivePrev.text === '(' || effectivePrev.text === '[' || effectivePrev.text === '{') spaceBefore = false;
                        if (effectivePrev.text === '*') spaceBefore = false;
                    } else {
                        spaceBefore = true;
                    }
                }
                else if (['=', '+=', '-=', '*=', '/=', '%=', '==', '!=', '<=', '>=', '&&', '||', '+', '-', '/', '%', '^', '|', '&', '?', ':', '<<', '>>', '<<=', '>>=', '&=', '|=', '^='].includes(text)) {
                     spaceBefore = true;
                     if (text === ':' && (braceStack.length > 0 && braceStack[braceStack.length-1].type === 'switch')) {
                         spaceBefore = false;
                     }
                }
                else if (['!', '~'].includes(text)) {
                    spaceBefore = true;
                    if (['(', '[', '{', '!', '~'].includes(lastChar)) spaceBefore = false;
                }
                else if (text === '\\') {
                    spaceBefore = true;
                }

                if (text === '.') {
                    if (effectivePrev && (effectivePrev.text === '{' || effectivePrev.text === ',')) {
                        spaceBefore = true;
                    } else {
                        spaceBefore = false;
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
                 else if (effectivePrev && effectivePrev.text === ')') spaceBefore = true;
                 else spaceBefore = false;
            }
            if (token.text === '[') {
                 if (currentLine.trim().match(/\b\w+$/)) spaceBefore = false;
                 else spaceBefore = true;
                 if (effectivePrev && (effectivePrev.text === '{' || effectivePrev.text === ',')) spaceBefore = true;
            }
            if (token.text === ':') {
                 if (currentLine.trim().startsWith('case ') || currentLine.trim() === 'default') spaceBefore = false;
            }
            if (token.text === '{') spaceBefore = true;

            // Restrict Handling
            if (token.text === 'restrict' || token.text === '__restrict' || token.text === '__restrict__') {
                if (effectivePrev && effectivePrev.text === '*') {
                    spaceBefore = true;
                }
            }
        }

        let extraIndent = 0;
        if (inPreprocessor && token.type !== TokenType.Preprocessor) {
             extraIndent = 1;
        }

        if (spaceBefore && currentLine !== '' && !currentLine.endsWith(' ')) append(' ', extraIndent);

        // Before appending, if this is a '(', calculate indent for next lines
        if (token.text === '(') {
            // Indent for contents is current column + 1
            // Or if line is empty (start of line), indent level + 1?
            let newIndent = '';
            if (currentLine.trim() === '') {
                 // Start of line (after indentation)
                 newIndent = getIndent(extraIndent) + INDENT_STRING;
            } else {
                 // Align with (
                 // We need to know current visual length.
                 // Assuming spaceBefore handled correctly, length of currentLine + 1 (for space if any? no, currentLine already includes space)
                 // Wait, we haven't appended '(' yet.
                 // So currentLine length is position of '('.
                 // We want next line to start at position of '(' + 1.
                 newIndent = ' '.repeat(currentLine.length + 1);
            }
            parenIndentStack.push(newIndent);
        }

        append(token.text, extraIndent);

        if (token.text === '{') {
            let context = 'block';
            let isInline = false;

            if (canBeInline(i)) {
                isInline = true;
                context = 'initializer';
            } else {
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
                         let m = k;
                         let pDepth = 0;
                         while (m >= 0) {
                             if (tokens[m].text === ')') pDepth++;
                             else if (tokens[m].text === '(') {
                                 pDepth--;
                                 if (pDepth === 0) {
                                     let n = m - 1;
                                     while (n >= 0 && (tokens[n].type === TokenType.Whitespace || tokens[n].type === TokenType.Newline)) n--;
                                     if (n >= 0) {
                                         if (tokens[n].text === 'switch') context = 'switch';
                                         else if (tokens[n].text === 'enum') context = 'enum';
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
            const ctx = braceStack.pop();
            let k = i + 1;
            while (k < tokens.length && (tokens[k].type === TokenType.Whitespace)) k++;
            const effectiveNext = (k < tokens.length) ? tokens[k] : null;

            if (ctx && ctx.isInline) {
                if (effectiveNext && (effectiveNext.text === ';' || effectiveNext.text === ',')) {
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
                } else if (effectiveNext && effectiveNext.type === TokenType.Identifier) {
                    append(' ');
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
                const currentCtx = braceStack.length > 0 ? braceStack[braceStack.length-1] : null;
                if (currentCtx && currentCtx.isInline) {
                    append(' ');
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
                     if (currentCtx && (currentCtx.type === 'enum' || currentCtx.type === 'initializer' || currentCtx.type === 'array' || currentCtx.type === 'struct')) {
                         pushLine();
                         justBrokeLine = true;
                     }
                 }
            }
        }

        if (token.text === '(') parenDepth++;
        else if (token.text === ')') {
            parenDepth = Math.max(0, parenDepth - 1);
            if (parenIndentStack.length > 0) parenIndentStack.pop();
        }
    }

    if (currentLine.trim() !== '') pushLine();

    // Post-Processing: Include Sorting & Alignment
    processIncludes(outputLines);
    alignDeclarations(outputLines);
    alignMacros(outputLines);

    return outputLines.join('\n');
}

function processIncludes(lines: string[]) {
    let i = 0;
    while (i < lines.length) {
        if (lines[i].trim().startsWith('#include')) {
            let start = i;
            let end = i;
            while (end < lines.length && lines[end].trim().startsWith('#include')) {
                end++;
            }

            const includes = lines.slice(start, end);
            includes.sort((a, b) => {
                const aTrim = a.trim();
                const bTrim = b.trim();
                const aIsStd = aTrim.includes('<');
                const bIsStd = bTrim.includes('<');
                if (aIsStd && !bIsStd) return -1;
                if (!aIsStd && bIsStd) return 1;
                return aTrim.localeCompare(bTrim);
            });

            for (let k = 0; k < includes.length; k++) {
                lines[start + k] = includes[k];
            }

            i = end;
        } else {
            i++;
        }
    }
}

function alignDeclarations(lines: string[]) {
    const declRegex = /^(\s*)((?:[a-zA-Z_]\w*\s+|\*\s*)+)([a-zA-Z_]\w*)(.*);$/;

    let i = 0;
    while (i < lines.length) {
        let blockStart = -1;
        let blockEnd = -1;

        for (let j = i; j < lines.length; j++) {
            const line = lines[j];
            if (line.trim() === '' || line.trim().startsWith('//') || line.trim().startsWith('#')) {
                if (blockStart !== -1) {
                    blockEnd = j;
                    break;
                }
                continue;
            }

            if (line.match(declRegex) && !line.includes('(')) {
                if (blockStart === -1) blockStart = j;
            } else {
                if (blockStart !== -1) {
                    blockEnd = j;
                    break;
                }
            }
        }

        if (blockStart !== -1) {
            if (blockEnd === -1) blockEnd = lines.length;

            const block = lines.slice(blockStart, blockEnd);
            const matches = block.map(l => l.match(declRegex));
            const validIndices = matches.map((m, idx) => m ? idx : -1).filter(idx => idx !== -1);

            if (validIndices.length > 1) {
                let maxTypeLen = 0;
                validIndices.forEach(idx => {
                     const m = matches[idx]!;
                     if (m[2].length > maxTypeLen) maxTypeLen = m[2].length;
                });

                validIndices.forEach(idx => {
                    const m = matches[idx]!;
                    const indent = m[1];
                    const type = m[2];
                    const variable = m[3];
                    const rest = m[4];

                    const paddedType = type + ' '.repeat(maxTypeLen - type.length);
                    lines[blockStart + idx] = `${indent}${paddedType}${variable}${rest};`;
                });
            }

            i = blockEnd;
        } else {
            i++;
        }
    }
}

function alignMacros(lines: string[]) {
    let i = 0;
    while (i < lines.length) {
        if (lines[i].trim().startsWith('#define ')) {
             let start = i;
             let end = i;
             while (end < lines.length && lines[end].trim().startsWith('#define ')) {
                 end++;
             }

             if (end - start > 1) {
                 const block = lines.slice(start, end);
                 let parsed = [];
                 let maxKeyLen = 0;

                 for (const line of block) {
                     const parts = line.trim().split(/\s+/);
                     if (parts.length >= 3) {
                         const defineKw = parts[0];
                         const key = parts[1];
                         // Combine the rest back (value might have spaces)
                         // But macro might be just #define KEY
                         // If parts.length < 3, it's just #define KEY (no value)
                         const value = parts.slice(2).join(' ');
                         if (key.length > maxKeyLen) maxKeyLen = key.length;
                         parsed.push({ defineKw, key, value });
                     } else {
                         parsed.push({ original: line });
                     }
                 }

                 for (let k = 0; k < block.length; k++) {
                     const p = parsed[k];
                     if ('key' in p && p.key) {
                         // #define KEY   VALUE
                         const padding = ' '.repeat(maxKeyLen - p.key.length);
                         lines[start + k] = `${p.defineKw} ${p.key}${padding} ${p.value}`;
                     } else {
                         lines[start + k] = p.original!;
                     }
                 }
             }
             i = end;
        } else {
            i++;
        }
    }
}
