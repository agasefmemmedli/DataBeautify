
import { CppTokenizer, Token, TokenType } from './cpp_tokenizer';

function sortIncludes(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];
    let includeBlock: string[] = [];

    const flushIncludes = () => {
        if (includeBlock.length === 0) return;
        const systemIncludes: string[] = [];
        const userIncludes: string[] = [];

        for (const inc of includeBlock) {
            if (inc.trim().match(/^#include\s*<.*>/)) systemIncludes.push(inc);
            else userIncludes.push(inc);
        }

        systemIncludes.sort();
        userIncludes.sort();

        result.push(...systemIncludes);
        result.push(...userIncludes);
        includeBlock = [];
    };

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#include')) {
            includeBlock.push(line);
        } else {
            flushIncludes();
            result.push(line);
        }
    }
    flushIncludes();
    return result.join('\n');
}

function alignBlocks(text: string): string {
    const lines = text.split('\n');
    const KEYWORDS = new Set([
        'alignas', 'alignof', 'and', 'and_eq', 'asm', 'auto', 'bitand', 'bitor', 'bool', 'break',
        'case', 'catch', 'char', 'char8_t', 'char16_t', 'char32_t', 'class', 'compl', 'concept', 'const',
        'consteval', 'constexpr', 'constinit', 'const_cast', 'continue', 'co_await', 'co_return', 'co_yield',
        'decltype', 'default', 'delete', 'do', 'double', 'dynamic_cast', 'else', 'enum', 'explicit',
        'export', 'extern', 'false', 'float', 'for', 'friend', 'goto', 'if', 'import', 'inline', 'int', 'long',
        'module', 'mutable', 'namespace', 'new', 'noexcept', 'not', 'not_eq', 'nullptr', 'operator', 'or', 'or_eq',
        'private', 'protected', 'public', 'register', 'reinterpret_cast', 'requires', 'return', 'short',
        'signed', 'sizeof', 'static', 'static_assert', 'static_cast', 'struct', 'switch', 'template',
        'this', 'thread_local', 'throw', 'true', 'try', 'typedef', 'typeid', 'typename', 'union',
        'unsigned', 'using', 'virtual', 'void', 'volatile', 'wchar_t', 'while', 'xor', 'xor_eq'
    ]);

    const CONTROL_FLOW = new Set([
        'return', 'throw', 'goto', 'case', 'break', 'continue', 'co_return', 'co_yield', 'co_await',
        'default', 'else', 'do', 'try', 'catch', 'finally'
    ]);

    let block: { lineIdx: number, type: string, name: string, rest: string, indent: string, isDecl: boolean, lhs: string, operator: string }[] = [];

    const processBlock = () => {
        if (block.length === 0) return;

        let subGroups: typeof block[] = [];
        let currentGroup: typeof block = [];
        let lastDecl = block[0].isDecl;

        for (const item of block) {
            if (item.isDecl !== lastDecl) {
                subGroups.push(currentGroup);
                currentGroup = [];
                lastDecl = item.isDecl;
            }
            currentGroup.push(item);
        }
        if (currentGroup.length > 0) subGroups.push(currentGroup);

        for (const group of subGroups) {
            if (group.length <= 1) continue;

            if (group[0].isDecl) {
                let maxTypeLen = 0;
                for (const item of group) {
                    if (item.type.length > maxTypeLen) maxTypeLen = item.type.length;
                }

                let maxNameLen = 0;
                let hasAssignment = false;
                for (const item of group) {
                    if (item.rest) hasAssignment = true;
                    if (item.name.length > maxNameLen) maxNameLen = item.name.length;
                }

                for (const item of group) {
                    const spaces = ' '.repeat(maxTypeLen - item.type.length + 1);
                    let newLine = `${item.indent}${item.type}${spaces}${item.name}`;

                    if (hasAssignment) {
                        const nameSpaces = ' '.repeat(maxNameLen - item.name.length);
                        if (item.rest) {
                            newLine += `${nameSpaces} ${item.rest}`;
                        } else {
                            newLine += ';';
                        }
                    } else {
                         if (item.rest) {
                             if (item.rest.startsWith(';')) newLine += item.rest;
                             else newLine += ` ${item.rest}`;
                         }
                         else newLine += ';';
                    }
                    lines[item.lineIdx] = newLine;
                }
            } else {
                let maxLhsLen = 0;
                for (const item of group) {
                    if (item.lhs.length > maxLhsLen) maxLhsLen = item.lhs.length;
                }

                for (const item of group) {
                    const spaces = ' '.repeat(maxLhsLen - item.lhs.length);
                    lines[item.lineIdx] = `${item.indent}${item.lhs}${spaces} ${item.rest}`;
                }
            }
        }
        block = [];
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
            processBlock();
            continue;
        }

        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';

        let maskedLine = line;
        maskedLine = maskedLine.replace(/"(?:[^"\\]|\\.)*"/g, match => ' '.repeat(match.length));
        maskedLine = maskedLine.replace(/'(?:[^'\\]|\\.)*'/g, match => ' '.repeat(match.length));
        maskedLine = maskedLine.replace(/\/\*[\s\S]*?\*\//g, match => ' '.repeat(match.length));

        const commentIdx = maskedLine.indexOf('//');
        let comment = '';
        let cleanLine = trimmed;
        let maskedCleanLine = maskedLine.trim();

        if (commentIdx !== -1) {
             comment = line.substring(commentIdx);
             cleanLine = line.substring(0, commentIdx).trim();
             maskedCleanLine = maskedLine.substring(0, commentIdx).trim();
        } else {
             cleanLine = trimmed;
             maskedCleanLine = maskedLine.trim();
        }

        if (!cleanLine.endsWith(';')) {
            processBlock();
            continue;
        }

        cleanLine = cleanLine.substring(0, cleanLine.length - 1).trim();
        maskedCleanLine = maskedCleanLine.substring(0, maskedCleanLine.length - 1).trim();

        const eqIdx = maskedCleanLine.indexOf('=');
        let preEq = cleanLine;
        let postEq = '';

        if (eqIdx !== -1) {
            preEq = cleanLine.substring(0, eqIdx).trim();
            postEq = cleanLine.substring(eqIdx).trim();
        }

        const lastSpace = preEq.lastIndexOf(' ');
        if (lastSpace !== -1) {
            const typeCandidate = preEq.substring(0, lastSpace).trim();
            const nameCandidate = preEq.substring(lastSpace + 1).trim();

            if (/^[a-zA-Z_]\w*$/.test(nameCandidate) && !KEYWORDS.has(nameCandidate)) {
                const typeWords = typeCandidate.split(/\s+/);
                const lastTypeWord = typeWords[typeWords.length - 1];

                if (!CONTROL_FLOW.has(lastTypeWord) && !CONTROL_FLOW.has(typeCandidate)) {
                    block.push({
                        lineIdx: i,
                        type: typeCandidate,
                        name: nameCandidate,
                        rest: postEq ? postEq + ';' + (comment ? ' ' + comment : '') : ';' + (comment ? ' ' + comment : ''),
                        indent: indent,
                        isDecl: true,
                        lhs: '',
                        operator: ''
                    });
                    continue;
                }
            }
        }

        if (eqIdx !== -1) {
            const lhs = preEq;
            block.push({
                lineIdx: i,
                type: '',
                name: '',
                rest: postEq + ';' + (comment ? ' ' + comment : ''),
                indent: indent,
                isDecl: false,
                lhs: lhs,
                operator: '='
            });
            continue;
        }

        processBlock();
    }
    processBlock();
    return lines.join('\n');
}

export function formatCppDeep(text: string): string {
    text = sortIncludes(text);
    const tokenizer = new CppTokenizer(text);
    const tokens = tokenizer.tokenize();

    if (tokens.length === 0) return '';

    const INDENT_SIZE = 2; // Google Style: 2 spaces
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
    let inInitializerList = false;

    // Stack to track brace types
    let braceStack: ('NAMESPACE' | 'BLOCK' | 'CLASS' | 'CASE' | 'LAMBDA')[] = [];

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

    const append = (str: string, indentOffset: number = 0, extraSpaces: number = 0) => {
        if (currentLine === '') {
            let indentStr = getIndent(indentLevel + indentOffset);
            if (extraSpaces > 0) indentStr += ' '.repeat(extraSpaces);
            currentLine = indentStr + str;
        } else {
            currentLine += str;
        }
    };

    const isType = (t: Token) => {
        if (t.type === TokenType.Keyword) {
            return ['int', 'char', 'bool', 'void', 'float', 'double', 'long', 'short', 'unsigned', 'signed', 'auto', 'const', 'typename', 'class', 'struct', 'enum', 'union', 'virtual', 'explicit', 'friend', 'constexpr', 'volatile', 'decltype', 'static'].includes(t.text);
        }
        if (t.type === TokenType.Identifier) {
            return /^[A-Z]/.test(t.text) || t.text.endsWith('_t') || ['string', 'vector', 'map', 'set', 'list', 'deque', 'queue', 'stack', 'pair', 'tuple', 'unique_ptr', 'shared_ptr', 'weak_ptr', 'size_t', 'uint8_t', 'int32_t', 'int64_t', 'uint32_t', 'uint64_t', 'u16', 'u32', 'u64', 'i16', 'i32', 'i64'].includes(t.text);
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
            // Check if we are in a CASE block that needs closing
            if (braceStack.length > 0 && braceStack[braceStack.length - 1] === 'CASE') {
                braceStack.pop();
                indentLevel = Math.max(0, indentLevel - 1);
            }

            const type = braceStack.length > 0 ? braceStack[braceStack.length - 1] : 'BLOCK'; // Peek
            if (type === 'BLOCK' || type === 'CLASS') {
                indentLevel = Math.max(0, indentLevel - 1);
            } else if (type === 'NAMESPACE') {
                // Namespace indentation (Google Style: 0 indent)
                // We do NOT dedent if we didn't indent.
            } else if (type === 'LAMBDA') {
                indentLevel = Math.max(0, indentLevel - 1);
            }

            braceStack.pop();
            braceDepth = Math.max(0, braceDepth - 1);

            // Special handling for lambdas inside expressions: don't break line
            // Only push line if it's not inline lambda end
            // Heuristic: if next token is ) or , or ; then maybe inline?
            // But if it's a big block lambda, we usually want new line.
            // Google style: closing brace of lambda on new line if body is multi-line.
            if (currentLine.trim() !== '') pushLine();
        }

        if (token.text === 'public' || token.text === 'private' || token.text === 'protected') {
            if (next && next.text === ':') {
                if (currentLine.trim() !== '') pushLine();
            }
        }

        if (token.text === 'case' || token.text === 'default') {
             if (braceStack.length > 0 && braceStack[braceStack.length - 1] === 'CASE') {
                 braceStack.pop();
                 indentLevel = Math.max(0, indentLevel - 1);
             }
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
                        spaceBefore = false; // Type*
                    } else if (prev && (prev.type === TokenType.Operator || prev.type === TokenType.Punctuation)) {
                        if (prev.text === ')' || prev.text === ']') spaceBefore = true;
                        else spaceBefore = false;
                    } else {
                        spaceBefore = true;
                    }
                }
                else if (token.text === '<') {
                    if (prev && prev.text === 'template') {
                        spaceBefore = true; // template <typename T>
                        templateDepth++;
                    } else if (prev && (prev.text === 'cast' || prev.text.endsWith('_cast') || isType(prev))) {
                        spaceBefore = false; // vector<T> or static_cast<T>
                        templateDepth++;
                    } else {
                        spaceBefore = true;
                    }
                }
                else if (token.text === '>') {
                    if (templateDepth > 0) {
                        spaceBefore = false;
                        templateDepth--;
                        if (prev && prev.text === '>') spaceBefore = false; // >>
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

                         // Check if next token is brace
                         let nextIsBrace = false;
                         if (next && next.text === '{') nextIsBrace = true;

                         if (!nextIsBrace) {
                             braceStack.push('CASE');
                             indentLevel++;
                         }

                         inCase = false;
                         wasCaseColon = true;
                     }
                     else if (prev && (['public', 'private', 'protected'].includes(prev.text))) spaceBefore = false;
                     else if (prev && prev.text === ')') {
                         spaceBefore = true; // Constructor init list
                         inInitializerList = true;
                     }
                     else spaceBefore = true;
                }
                else if (token.text === '?') {
                    spaceBefore = true;
                    if (inCase) ternaryDepth++;
                }
                else if (token.text === '=') {
                    if (prev && prev.text === '[') spaceBefore = false; // Lambda capture [=]
                    else spaceBefore = true;
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
                    if (prev && prev.text === '::') spaceBefore = false; // Namespace::
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
                                spaceBefore = true; // Type* var -> space before var
                            } else {
                                spaceBefore = false; // *ptr
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
                    if (prev.text === ')' && token.text !== ';' && token.text !== ',') spaceBefore = true;
                    if (prev.text === '}' && token.text !== ';') spaceBefore = true;
                }
                else if (prev.type === TokenType.Keyword) {
                    if (['return', 'throw', 'case', 'goto', 'new', 'delete', 'using', 'namespace', 'template'].includes(prev.text)) {
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

        if (token.text === ']' && prev && prev.text === '=') spaceBefore = false; // [=]

        let indentOffset = 0;
        let extraSpaces = 0;

        if (token.text === 'public' || token.text === 'private' || token.text === 'protected') {
            // Google Style: public: indented 1 space relative to class.
            // If class is at indent 0, inside is 1 (2 spaces). public: should be 1 space.
            // So indentOffset = -1 (parent level), extraSpaces = 1.
            indentOffset = -1;
            extraSpaces = 1;
        }

        if (inInitializerList) {
             if (token.text === ':') {
                 if (currentLine.trim() !== '') pushLine();
                 // Continuation indent (4 spaces) relative to function (which is indentLevel)
                 // But wait, indentLevel was incremented at function {.
                 // No, usually constructor() : ... {
                 // The : comes before {.
                 // So indentLevel is class level (e.g. 1).
                 // Constructor decl is at level 1 (2 spaces).
                 // Init list should be +4 spaces = 6 spaces.
                 // So indentOffset = 2 (2 * 2 = 4 spaces extra).
                 indentOffset = 2;
                 extraSpaces = 0;
             } else if (token.text === ',') {
                 // handled
             } else {
                 if (currentLine === '') {
                     indentOffset = 2;
                 }
             }
        }

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

        append(token.text, indentOffset, extraSpaces);

        if (token.type === TokenType.Comment) {
            pushLine();
        }
        else if (token.text === '{') {
            let isNamespace = false;
            let isClass = false;
            let isLambda = false;

            let k = i - 1;
            while (k >= 0) {
                const t = meaningfulTokens[k];
                if (t.type === TokenType.Comment || t.type === TokenType.Preprocessor) {
                    k--;
                    continue;
                }
                if (t.text === 'namespace') {
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
                if (t.text === 'class' || t.text === 'struct' || t.text === 'enum' || t.text === 'union') {
                    isClass = true;
                    break;
                }
                if (t.text === ')' || t.text === ']') {
                    // Check for lambda: [](...) {
                    if (t.text === ')') {
                        // find matching (
                        let balance = 1;
                        let m = k - 1;
                        while (m >= 0 && balance > 0) {
                            if (meaningfulTokens[m].text === ')') balance++;
                            else if (meaningfulTokens[m].text === '(') balance--;
                            m--;
                        }
                        // m is now before (
                        if (m >= 0 && meaningfulTokens[m].text === ']') {
                             isLambda = true;
                        }
                    } else if (t.text === ']') {
                         isLambda = true;
                    }
                    break;
                }
                if (t.text === '=') break;
                if (t.text === ';') break;
                k--;
            }

            if (inInitializerList) {
                inInitializerList = false;
            }

            if (isNamespace) {
                braceStack.push('NAMESPACE');
                // Google Style: Namespaces do not indent
                // So indentLevel stays same.
            } else if (isClass) {
                braceStack.push('CLASS');
                indentLevel++;
            } else if (isLambda) {
                braceStack.push('LAMBDA');
                indentLevel++;
            } else {
                braceStack.push('BLOCK');
                indentLevel++;
            }
            braceDepth++;

            if (next && next.text === '}') {
                // Empty block
            } else {
                pushLine();
            }
        }
        else if (token.text === '}') {
             // Logic handled in Indent Adjustments section at start of loop
             if (next && next.text === ';') {
                 // };
             } else if (next && next.text === ',') {
                 // },
             } else {
                 pushLine();
             }
        }
        else if (token.text === ';') {
            if (parenDepth === 0) {
                 pushLine();
            }
        }
        else if (token.text === ',') {
            if (inInitializerList && parenDepth === 0) {
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

    const formatted = outputLines.join('\n');
    return alignBlocks(formatted);
}
