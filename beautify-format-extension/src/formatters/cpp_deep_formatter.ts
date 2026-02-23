
import { CppTokenizer, Token, TokenType } from './cpp_tokenizer';

function sortIncludes(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];
    let includeBlock: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#include')) {
            includeBlock.push(line);
        } else {
            if (includeBlock.length > 0) {
                includeBlock.sort();
                result.push(...includeBlock);
                includeBlock = [];
            }
            result.push(line);
        }
    }
    if (includeBlock.length > 0) {
        includeBlock.sort();
        result.push(...includeBlock);
    }
    return result.join('\n');
}

export function formatCppDeep(text: string): string {
    text = sortIncludes(text);
    const tokenizer = new CppTokenizer(text);
    const tokens = tokenizer.tokenize();

    if (tokens.length === 0) return '';

    const INDENT_SIZE = 4;
    const INDENT_STRING = ' '.repeat(INDENT_SIZE);

    const meaningfulTokens = tokens.filter(t => t.type !== TokenType.Whitespace && t.type !== TokenType.Newline);

    let outputLines: string[] = [];
    let currentLine = '';
    let indentLevel = 0;

    let parenDepth = 0;
    let braceDepth = 0;
    let templateDepth = 0;
    let inCase = false;
    let ternaryDepth = 0;

    // Stack to track brace types (NAMESPACE or BLOCK)
    let braceStack: ('NAMESPACE' | 'BLOCK')[] = [];

    const getIndent = (level: number) => {
        return INDENT_STRING.repeat(Math.max(0, level));
    };

    const pushLine = () => {
        if (currentLine.trim() !== '') {
            outputLines.push(currentLine);
        } else if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== '') {
            outputLines.push('');
        }
        currentLine = '';
    };

    const append = (str: string, indentOffset: number = 0) => {
        if (currentLine === '') {
            currentLine = getIndent(indentLevel + indentOffset) + str;
        } else {
            currentLine += str;
        }
    };

    const isType = (t: Token) => {
        if (t.type === TokenType.Keyword) {
            return ['int', 'char', 'bool', 'void', 'float', 'double', 'long', 'short', 'unsigned', 'signed', 'auto', 'const', 'typename', 'class', 'struct', 'enum', 'union', 'virtual', 'explicit', 'friend', 'constexpr', 'volatile'].includes(t.text);
        }
        if (t.type === TokenType.Identifier) {
            return /^[A-Z]/.test(t.text) || t.text.endsWith('_t') || ['string', 'vector', 'map', 'set', 'list', 'deque', 'queue', 'stack', 'pair', 'tuple', 'unique_ptr', 'shared_ptr', 'weak_ptr', 'size_t', 'uint8_t', 'int32_t', 'int64_t', 'uint32_t', 'uint64_t'].includes(t.text);
        }
        return false;
    };

    for (let i = 0; i < meaningfulTokens.length; i++) {
        const token = meaningfulTokens[i];
        const next = i + 1 < meaningfulTokens.length ? meaningfulTokens[i+1] : null;
        const prev = i > 0 ? meaningfulTokens[i-1] : null;
        const prev2 = i > 1 ? meaningfulTokens[i-2] : null;

        // Indent Adjustments
        if (token.text === '}') {
            const type = braceStack.length > 0 ? braceStack[braceStack.length - 1] : 'BLOCK'; // Peek
            // We pop later, but we need to know type for indent calc
            if (type === 'BLOCK') {
                indentLevel = Math.max(0, indentLevel - 1);
            }
            braceDepth = Math.max(0, braceDepth - 1);

            if (currentLine.trim() !== '') pushLine();
        }

        if (token.text === 'public' || token.text === 'private' || token.text === 'protected') {
            if (next && next.text === ':') {
                if (currentLine.trim() !== '') pushLine();
            }
        }

        if (token.text === 'case' || token.text === 'default') {
             inCase = true;
             ternaryDepth = 0;
             if (currentLine.trim() !== '') pushLine();
        }

        if (token.type === TokenType.Preprocessor) {
             if (currentLine.trim() !== '') pushLine();
        }

        // Spacing Logic
        let spaceBefore = false;
        let wasCaseColon = false;

        if (currentLine !== '') {
            const lastChar = currentLine[currentLine.length - 1];

            if (/\w/.test(lastChar) && /\w/.test(token.text[0])) {
                spaceBefore = true;
            }

            if (token.type === TokenType.Operator) {
                if (token.text === '*' || token.text === '&') {
                    if (prev && (isType(prev) || prev.text === '>')) {
                        spaceBefore = false;
                    } else if (prev && (prev.type === TokenType.Operator || prev.type === TokenType.Punctuation)) {
                        if (prev.text === ')' || prev.text === ']') spaceBefore = true;
                        else spaceBefore = false;
                    } else {
                        spaceBefore = true;
                    }
                }
                else if (token.text === '<') {
                    if (prev && (prev.text === 'template' || prev.text === 'cast' || prev.text.endsWith('_cast') || isType(prev))) {
                        spaceBefore = false;
                        templateDepth++;
                    } else {
                        spaceBefore = true;
                    }
                }
                else if (token.text === '>') {
                    if (templateDepth > 0) {
                        spaceBefore = false;
                        templateDepth--;
                        if (prev && prev.text === '>') spaceBefore = false;
                    } else {
                        spaceBefore = true;
                    }
                    templateDepth = Math.max(0, templateDepth);
                }
                else if (token.text === '>>') {
                    if (templateDepth > 0) {
                        spaceBefore = false;
                        templateDepth = Math.max(0, templateDepth - 2);
                    } else {
                        spaceBefore = true;
                    }
                }
                else if (['->', '.', '::', '++', '--'].includes(token.text)) {
                    spaceBefore = false;
                }
                else if (token.text === ':') {
                     if (inCase && ternaryDepth === 0) {
                         spaceBefore = false;
                         inCase = false;
                         wasCaseColon = true;
                     }
                     else if (prev && (['public', 'private', 'protected'].includes(prev.text))) spaceBefore = false;
                     else if (prev && prev.text === ')') spaceBefore = true; // Constructor init list
                     else spaceBefore = true;
                }
                else if (token.text === '?') {
                    spaceBefore = true;
                    if (inCase) ternaryDepth++;
                }
                else {
                    spaceBefore = true;
                    if (['!', '~'].includes(token.text)) {
                         spaceBefore = false;
                         if (prev && (prev.type === TokenType.Identifier || prev.type === TokenType.Number || prev.text === ')' || prev.text === ']')) {
                             spaceBefore = true;
                         }
                    }
                }
            }

            if (token.type === TokenType.Punctuation) {
                if (token.text === '(') {
                    if (prev && (['if', 'for', 'while', 'switch', 'catch', 'template'].includes(prev.text))) {
                        spaceBefore = true;
                    } else {
                        spaceBefore = false;
                    }
                }
                else if (token.text === '{') {
                    spaceBefore = true;
                }
                else if (token.text === ')' || token.text === ']' || token.text === ';' || token.text === ',') {
                    spaceBefore = false;
                }
            }

            if (token.type === TokenType.Attribute) {
                spaceBefore = true;
            }

            if (prev) {
                if (prev.type === TokenType.Operator) {
                    if (['::', '.', '->', '!', '~'].includes(prev.text)) {
                        spaceBefore = false;
                    }
                    else if (prev.text === '*' || prev.text === '&') {
                        let isBinary = false;
                        if (prev2) {
                            if (prev2.type === TokenType.Number || (prev2.type === TokenType.Identifier && !isType(prev2)) || prev2.text === ')' || prev2.text === ']') {
                                isBinary = true;
                            }
                        }
                        if (isBinary) {
                            spaceBefore = true;
                        } else {
                            if (prev2 && (isType(prev2) || prev2.text === '>')) {
                                spaceBefore = true;
                            } else {
                                spaceBefore = false;
                            }
                        }
                    }
                    else if (prev.text === '++' || prev.text === '--') {
                        spaceBefore = false;
                    }
                    else if (prev.text === '<') {
                        if (templateDepth > 0) spaceBefore = false;
                        else spaceBefore = true;
                    }
                    else {
                        spaceBefore = true;
                    }
                }
                else if (prev.type === TokenType.Punctuation) {
                    if (prev.text === ',' || prev.text === ';') spaceBefore = true;
                    if (prev.text === ')' && token.text !== ';') spaceBefore = true;
                    if (prev.text === '}') spaceBefore = true;
                }
                else if (prev.type === TokenType.Keyword) {
                    if (['return', 'throw', 'case', 'goto', 'new', 'delete', 'using', 'namespace'].includes(prev.text)) {
                        spaceBefore = true;
                    }
                }
                else if (prev.type === TokenType.Comment) {
                    spaceBefore = true;
                }
                else if (prev.type === TokenType.Attribute) {
                    spaceBefore = true;
                }
            }
        }

        if (token.text === '<' && prev && prev.text === 'template') spaceBefore = false;

        let indentOffset = 0;
        if (token.text === 'public' || token.text === 'private' || token.text === 'protected') indentOffset = -1;
        // case/default indent offset removed (so it indents)

        if (token.type === TokenType.Preprocessor) {
            currentLine = token.text;
            pushLine();
            continue;
        }

        if (spaceBefore && currentLine !== '' && !currentLine.endsWith(' ')) {
             append(' ');
        } else if (!spaceBefore && currentLine.endsWith(' ')) {
             currentLine = currentLine.trimEnd();
        }

        append(token.text, indentOffset);

        // Line Breaks and Brace Logic
        if (token.type === TokenType.Comment) {
            pushLine();
        }
        else if (token.text === '{') {
            // Check for namespace
            let isNamespace = false;
            let k = i - 1;
            // Scan backwards to find context
            while (k >= 0) {
                const t = meaningfulTokens[k];
                // Skip comments
                if (t.type === TokenType.Comment || t.type === TokenType.Preprocessor) {
                    k--;
                    continue;
                }

                if (t.text === 'namespace') {
                    // check if 'using' precedes it
                    let m = k - 1;
                    while (m >= 0) {
                        if (meaningfulTokens[m].type === TokenType.Comment || meaningfulTokens[m].type === TokenType.Whitespace || meaningfulTokens[m].type === TokenType.Newline) {
                            m--;
                            continue;
                        }
                        break;
                    }
                    if (m >= 0 && meaningfulTokens[m].text === 'using') {
                         isNamespace = false;
                    } else {
                         isNamespace = true;
                    }
                    break;
                }
                if (t.type === TokenType.Identifier || t.text === '::' || t.text === 'inline') {
                    k--;
                    continue;
                }
                // Stop at other tokens
                break;
            }

            if (isNamespace) {
                braceStack.push('NAMESPACE');
            } else {
                braceStack.push('BLOCK');
                indentLevel++;
            }
            braceDepth++;

            if (next && next.text === '}') {
            } else {
                pushLine();
            }
        }
        else if (token.text === '}') {
             const type = braceStack.pop();
             // Indent level was already decremented at start of loop if BLOCK
             // Just push line
             if (next && next.text === ';') {
             } else {
                 pushLine();
             }
        }
        else if (token.text === ';') {
            if (parenDepth === 0) {
                 pushLine();
            }
        }
        else if (token.text === ':') {
             if (wasCaseColon) {
                 pushLine();
             }
             else if (prev && ['public', 'private', 'protected'].includes(prev.text)) {
                 pushLine();
             }
        }
        else if (token.text === '>') {
             if (templateDepth === 0 && next && (next.text === 'class' || next.text === 'struct' || next.text === 'using' || isType(next))) {
                 if (currentLine.trim().startsWith('template')) {
                     pushLine();
                 }
             }
        }

        if (token.text === ':' && ternaryDepth > 0) ternaryDepth--;
        if (token.text === '(') parenDepth++;
        else if (token.text === ')') parenDepth = Math.max(0, parenDepth - 1);
    }

    if (currentLine.trim() !== '') pushLine();

    return outputLines.join('\n');
}
