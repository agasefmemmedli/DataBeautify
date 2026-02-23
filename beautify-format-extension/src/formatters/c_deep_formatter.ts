
import { CTokenizer, Token, TokenType } from './c_tokenizer';

interface BraceContext {
    type: string; // 'block', 'switch', 'struct', 'enum', 'array'
    caseIndented: boolean; // For switch: whether we have indented for a case label
}

export function formatCDeep(text: string): string {
    const tokenizer = new CTokenizer(text);
    const tokens = tokenizer.tokenize();

    if (tokens.length === 0) return '';

    // Configuration
    const INDENT_SIZE = 4;
    const INDENT_STRING = ' '.repeat(INDENT_SIZE);

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
             return ['int', 'char', 'bool', 'void', 'float', 'double', 'long', 'short', 'unsigned', 'signed', 'auto', 'const', 'struct', 'union', 'enum', 'size_t', 'ssize_t', 'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t', 'uintptr_t', 'intptr_t', 'ptrdiff_t', 'wchar_t', 'intptr_t', 'uintptr_t', 'char16_t', 'char32_t', 'restrict', '__restrict'].includes(t.text);
         }
         if (t.type === TokenType.Identifier) {
             return /_t$/.test(t.text) || /^[A-Z]/.test(t.text);
         }
         return false;
    };

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const next = i + 1 < tokens.length ? tokens[i+1] : null;
        const prev = i > 0 ? tokens[i-1] : null;

        if (token.type === TokenType.Whitespace) continue;

        if (token.type === TokenType.Newline) {
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

        if (token.text === '}') {
            if (braceStack.length > 0) {
                const ctx = braceStack[braceStack.length - 1];
                if (ctx.type === 'switch' && ctx.caseIndented) {
                    indentLevel = Math.max(0, indentLevel - 1);
                    ctx.caseIndented = false;
                }
            }
            indentLevel = Math.max(0, indentLevel - 1);
            braceStack.pop();
        }

        // Handle Case/Default Indentation
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

            let k = i - 1;
            while (k >= 0 && (tokens[k].type === TokenType.Whitespace || tokens[k].type === TokenType.Newline)) {
                k--;
            }
            let effectivePrev = (k >= 0) ? tokens[k] : null;

            if (effectivePrev) {
                 if (effectivePrev.type === TokenType.Operator) {
                     const op = effectivePrev.text;
                     if (['.', '->', '!', '~', '++', '--', '(', '['].includes(op)) {
                         spaceBefore = false;
                     } else if (op === '*' || op === '&') {
                         let m = k - 1;
                         while (m >= 0 && (tokens[m].type === TokenType.Whitespace || tokens[m].type === TokenType.Newline)) m--;
                         let prevPrevTok = (m >= 0) ? tokens[m] : null;

                         if (prevPrevTok && (isTypeLike(prevPrevTok) || prevPrevTok.type === TokenType.Operator || ['(', '[', '{', ',', 'case'].includes(prevPrevTok.text))) {
                              spaceBefore = false;
                         } else {
                              spaceBefore = true;
                         }
                     } else {
                         spaceBefore = true;
                     }
                 } else if (effectivePrev.type === TokenType.Punctuation) {
                     if ([';', ',', '}'].includes(effectivePrev.text)) spaceBefore = true;
                     if (effectivePrev.text === ')') spaceBefore = true;
                     if (effectivePrev.text === '(' || effectivePrev.text === '[') spaceBefore = false;
                 } else if (effectivePrev.type === TokenType.Keyword) {
                     if (['if', 'for', 'while', 'switch', 'return', 'case', 'goto'].includes(effectivePrev.text)) {
                         spaceBefore = true;
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
                    if (effectivePrev && isTypeLike(effectivePrev)) {
                        spaceBefore = true;
                    } else if (effectivePrev && (
                        (effectivePrev.type === TokenType.Operator && ['!', '~', '++', '--', '*', '&'].includes(effectivePrev.text)) ||
                        ['(', '[', '{'].includes(effectivePrev.text)
                    )) {
                        spaceBefore = false; // Unary * following opener/unary
                    } else {
                        spaceBefore = true; // Binary * or * following =/return
                    }
                }
                else if (['=', '+=', '-=', '*=', '/=', '%=', '==', '!=', '<=', '>=', '&&', '||', '+', '-', '/', '%', '^', '|', '&', '?', ':', '<<', '>>', '<<=', '>>=', '&=', '|=', '^='].includes(text)) {
                    if (text !== '*' && text !== '&') {
                         spaceBefore = true;
                         if (text === ':' && (currentLine.trim().startsWith('case ') || currentLine.trim() === 'default')) spaceBefore = false;
                    }
                }
                else if (['!', '~'].includes(text)) {
                    spaceBefore = true;
                    if (['(', '[', '{', '!', '~'].includes(lastChar)) spaceBefore = false;
                }
            }

            if (token.type === TokenType.Keyword && token.text === 'sizeof') spaceBefore = true;

            if (token.text === ';') spaceBefore = false;
            if (token.text === ',') spaceBefore = false;
            if (token.text === ')') spaceBefore = false;
            if (token.text === ']') spaceBefore = false;
            if (token.text === '(') {
                 if (currentLine.trim().match(/\b(if|for|while|switch|return)$/)) spaceBefore = true;
                 else if (effectivePrev && effectivePrev.type === TokenType.Operator && !['.', '->', '!', '~', '++', '--'].includes(effectivePrev.text)) spaceBefore = true;
                 else spaceBefore = false;
            }
            if (token.text === '[') {
                 if (currentLine.trim().match(/\b\w+$/)) spaceBefore = false;
            }
            if (token.text === ':') {
                 if (currentLine.trim().startsWith('case ') || currentLine.trim() === 'default') spaceBefore = false;
            }
            if (token.text === '{') spaceBefore = true;
        }

        if (spaceBefore && currentLine !== '' && !currentLine.endsWith(' ')) append(' ');
        append(token.text);

        // --- Post-Append Logic ---

        if (token.text === '{') {
            let context = 'block';
            let k = i - 1;
            while (k >= 0 && (tokens[k].type === TokenType.Whitespace || tokens[k].type === TokenType.Newline)) {
                k--;
            }
            let effectivePrev = (k >= 0) ? tokens[k] : null;

            if (effectivePrev) {
                if (effectivePrev.text === '=') context = 'array';
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
                                 if (n >= 0 && tokens[n].text === 'switch') context = 'switch';
                                 else if (n >= 0 && tokens[n].text === 'enum') context = 'enum';
                                 else if (n >= 0 && tokens[n].text === 'struct') context = 'struct';
                                 break;
                             }
                         }
                         m--;
                     }
                }
            }

            indentLevel++;
            braceStack.push({ type: context, caseIndented: false });
            pushLine();
            justBrokeLine = true;
        }
        else if (token.text === '}') {
            let k = i + 1;
            while (k < tokens.length && (tokens[k].type === TokenType.Whitespace || tokens[k].type === TokenType.Newline)) {
                k++;
            }
            let effectiveNext = (k < tokens.length) ? tokens[k] : null;

            if (effectiveNext && (effectiveNext.text === ';' || effectiveNext.text === ',')) {
                // Stay
            } else if (effectiveNext && effectiveNext.type === TokenType.Identifier) {
                 let m = k + 1;
                 while (m < tokens.length && (tokens[m].type === TokenType.Whitespace || tokens[m].type === TokenType.Newline)) m++;
                 const nextNext = (m < tokens.length) ? tokens[m] : null;
                 if (nextNext && nextNext.text === ';') append(' ');
                 else { pushLine(); justBrokeLine = true; }
            } else {
                if (effectiveNext && effectiveNext.text === 'else') append(' ');
                else { pushLine(); justBrokeLine = true; }
            }
        }
        else if (token.text === ';') {
            if (parenDepth === 0) {
                pushLine();
                justBrokeLine = true;
            }
        }
        else if (token.text === ':') {
            if (braceStack.length > 0 && braceStack[braceStack.length-1].type === 'switch') {
                if (currentLine.trim().startsWith('case ') || currentLine.trim() === 'default:') {
                    pushLine();
                    justBrokeLine = true;
                    if (!braceStack[braceStack.length-1].caseIndented) {
                        indentLevel++;
                        braceStack[braceStack.length-1].caseIndented = true;
                    }
                }
            }
        }
        else if (token.type === TokenType.Preprocessor) {
             // Newline will handle break
        }
        else if (token.text === ',') {
            if (parenDepth === 0) {
                 if (indentLevel > 0) {
                    let k = i + 1;
                    while (k < tokens.length && (tokens[k].type === TokenType.Whitespace)) {
                        k++;
                    }
                    let effectiveNext = (k < tokens.length) ? tokens[k] : null;
                    if (effectiveNext && effectiveNext.type === TokenType.Newline) {
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
