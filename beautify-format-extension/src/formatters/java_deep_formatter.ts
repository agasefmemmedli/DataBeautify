
import { JavaTokenizer, Token, TokenType } from './java_tokenizer';

function sortImports(text: string): string {
    const lines = text.split('\n');
    const staticImports: string[] = [];
    const regularImports: string[] = [];
    const newLines: string[] = [];
    let firstImportIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith('import ') && trimmed.includes(';')) {
            if (firstImportIndex === -1) firstImportIndex = newLines.length;

            if (trimmed.startsWith('import static ')) {
                staticImports.push(line);
            } else {
                regularImports.push(line);
            }
        } else {
            newLines.push(line);
        }
    }

    if (staticImports.length === 0 && regularImports.length === 0) return text;

    staticImports.sort((a, b) => a.trim().localeCompare(b.trim()));
    regularImports.sort((a, b) => a.trim().localeCompare(b.trim()));

    const combinedImports: string[] = [];
    if (staticImports.length > 0) {
        combinedImports.push(...staticImports);
        if (regularImports.length > 0) combinedImports.push('');
    }
    combinedImports.push(...regularImports);

    if (firstImportIndex !== -1) {
        newLines.splice(firstImportIndex, 0, ...combinedImports);
    } else {
        return text;
    }

    return newLines.join('\n');
}

export function formatJavaDeep(text: string): string {
    text = sortImports(text);
    const tokenizer = new JavaTokenizer(text);
    const tokens = tokenizer.tokenize();
    if (tokens.length === 0) return '';
    const INDENT_SIZE = 4;
    const INDENT_STRING = ' '.repeat(INDENT_SIZE);
    const meaningfulTokens = tokens.filter(t => t.type !== TokenType.Whitespace && t.type !== TokenType.Newline);
    const getIndent = (level: number) => INDENT_STRING.repeat(Math.max(0, level));
    return formatJavaDeepInternal(meaningfulTokens, INDENT_STRING, getIndent);
}

function formatJavaDeepInternal(tokens: Token[], INDENT_STRING: string, getIndent: (l:number)=>string): string {
    let outputLines: string[] = [];
    let currentLine = '';
    let indentLevel = 0;

    const blockStack: ('BLOCK' | 'SWITCH' | 'SWITCH_EXPR' | 'CASE_CONTENT' | 'ARRAY_INIT' | 'LAMBDA_BLOCK' | 'SWITCH_RULE' | 'RECORD_BODY' | 'ANNOTATION_ARGS' | 'RECORD_ARGS' | 'PAREN_BLOCK')[] = [];

    let parenDepth = 0;
    let angleDepth = 0;
    let inCaseLabel = false;

    const pushLine = () => {
        if (currentLine.trim() !== '') {
            outputLines.push(currentLine);
        } else if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== '') {
            outputLines.push('');
        }
        currentLine = '';
    };

    const append = (str: string) => {
        if (currentLine === '') {
            currentLine = getIndent(indentLevel) + str;
        } else {
            currentLine += str;
        }
    };

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const next = i + 1 < tokens.length ? tokens[i+1] : null;
        const prev = i > 0 ? tokens[i-1] : null;

        // --- Indent / Stack Management (Pre-Token) ---

        if (token.text === '}') {
            if (blockStack.length > 0 && (blockStack[blockStack.length - 1] === 'CASE_CONTENT' || blockStack[blockStack.length - 1] === 'SWITCH_RULE')) {
                blockStack.pop();
                indentLevel--;
            }
            if (blockStack.length > 0 && blockStack[blockStack.length - 1] === 'BLOCK') {
                blockStack.pop();
                indentLevel--;
            } else if (blockStack.length > 0) {
                 blockStack.pop();
                 indentLevel--;
            }
            if (currentLine.trim() !== '') pushLine();
        }
        else if (token.text === 'case' || token.text === 'default') {
             if (blockStack.length > 0 && (blockStack[blockStack.length - 1] === 'CASE_CONTENT' || blockStack[blockStack.length - 1] === 'SWITCH_RULE')) {
                 blockStack.pop();
                 indentLevel--;
             }
             inCaseLabel = true;
             if (currentLine.trim() !== '') pushLine();
        }

        // --- Blank Line Logic ---
        if (prev) {
             const prevEndLine = prev.line + (prev.text.match(/\n/g) || []).length;
             if (token.line > prevEndLine + 1) {
                 if (currentLine.trim() !== '') pushLine();
                 if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== '') {
                     outputLines.push('');
                 }
             }
        }

        // --- Newline Preservation for Method Chains ---
        if (token.text === '.' && prev) {
             const prevEndLine = prev.line + (prev.text.match(/\n/g) || []).length;
             if (token.line > prevEndLine) {
                 if (currentLine.trim() !== '') pushLine();
                 currentLine = getIndent(indentLevel) + INDENT_STRING;
             }
        }

        // --- Spacing Logic ---
        let spaceBefore = false;

        if (currentLine !== '') {
            const lastChar = currentLine[currentLine.length - 1];
            if (/\w/.test(lastChar) && /\w/.test(token.text[0])) {
                spaceBefore = true;
            }

            if (token.type === TokenType.Operator) {
                if (token.text === '->') spaceBefore = true;
                else if (['.', '::', ';'].includes(token.text)) spaceBefore = false;
                else if (token.text === ',') spaceBefore = false;
                else if (token.text === '...') spaceBefore = true;
                else if (token.text === ':') {
                     if (inCaseLabel) spaceBefore = false;
                     else spaceBefore = true;
                }
                else if (token.text === '<') {
                     if (prev && (prev.type === TokenType.Identifier)) {
                         if (/^[A-Z]/.test(prev.text)) spaceBefore = false;
                         else spaceBefore = true;
                     } else {
                         spaceBefore = true;
                     }
                     if (!spaceBefore) angleDepth++;
                }
                else if (token.text === '>' || token.text === '>>' || token.text === '>>>') {
                     if (angleDepth > 0) {
                         spaceBefore = false;
                         angleDepth -= token.text.length;
                         if (angleDepth < 0) angleDepth = 0;
                     } else {
                         spaceBefore = true;
                     }
                }
                else {
                    if (['++', '--'].includes(token.text)) {
                         if (prev && (prev.type === TokenType.Identifier || prev.type === TokenType.Number || prev.text === ')' || prev.text === ']')) {
                             spaceBefore = false;
                         } else {
                             spaceBefore = true;
                         }
                    }
                    else if (['!', '~'].includes(token.text)) {
                         if (prev && prev.text === '(') spaceBefore = false;
                         else spaceBefore = true;
                    }
                    else {
                        spaceBefore = true;
                    }
                }
            }

            if (token.type === TokenType.Punctuation) {
                 if (token.text === '(') {
                     if (prev && ['if', 'for', 'while', 'switch', 'catch', 'synchronized', 'try', 'record'].includes(prev.text)) spaceBefore = true;
                     else spaceBefore = false;
                 }
                 else if (token.text === '{') spaceBefore = true;
                 else if (['}', ')', ']'].includes(token.text)) spaceBefore = false;
                 else if (token.text === '[') spaceBefore = false;
            }

            if (token.type === TokenType.Keyword) {
                if (token.text === 'yield') spaceBefore = true;
                else spaceBefore = true;
            }

            if (prev) {
                if (prev.type === TokenType.Operator) {
                    if (['.', '::', '@'].includes(prev.text)) spaceBefore = false;
                    else if (prev.text === '<' && angleDepth > 0) spaceBefore = false;
                    else if (['++', '--'].includes(prev.text)) {
                    }
                    else spaceBefore = true;
                }

                if (prev.text === '(') spaceBefore = false;
                if (prev.text === '[') spaceBefore = false;

                if (prev.text === ']') {
                    if (token.text === '[' || token.text === '(' || token.text === '.') spaceBefore = false;
                    else spaceBefore = true;
                }

                if (prev.text === '::' || prev.text === '.') spaceBefore = false;
                if (prev.text === '@') spaceBefore = false;
                if (prev.text === '<' && angleDepth > 0) spaceBefore = false;

                if (prev.text === ',') spaceBefore = true;
                if (prev.text === ';') spaceBefore = true;

                if (prev.type === TokenType.Keyword) {
                    if (prev.text === 'yield') spaceBefore = true;
                }
            }
        }

        if (spaceBefore && currentLine.trim() !== '' && !currentLine.endsWith(' ')) {
             append(' ');
        } else if (!spaceBefore && currentLine.endsWith(' ') && currentLine.trim() !== '') {
             currentLine = currentLine.trimEnd();
        }

        // --- Append Token ---
        if (token.type === TokenType.String && token.text.startsWith('"""')) {
             const lines = token.text.split('\n');
             if (lines.length > 1) {
                 append(lines[0]);
                 for(let k=1; k<lines.length; k++) {
                     outputLines.push(currentLine);
                     currentLine = '';
                     currentLine = lines[k];
                 }
             } else {
                 append(token.text);
             }
        } else {
             append(token.text);
        }


        // --- Post-Token Logic ---

        if (token.text === '{') {
            indentLevel++;
            let foundSwitch = false;
            let foundArrayInit = false;
            let foundLambda = false;
            let foundRecord = false;

            let balance = 0;
            let p = i - 1;
            while (p >= 0) {
                const t = tokens[p];
                if (t.text === ')' ) balance++;
                else if (t.text === '(') {
                    balance--;
                    if (balance < 0) {
                        let q = p - 1;
                        if (q >= 0 && tokens[q].text === 'switch') foundSwitch = true;

                        // Detect Record Body: record Name(...) {
                        // The loop is scanning backwards from {
                        // So t is (...)
                        // q is before (
                        // In `record Name(...)`, q is `Name`. q-1 is `record`.
                        if (q >= 1 && tokens[q-1].text === 'record') foundRecord = true;
                         // Handle `public record Name`
                        if (q >= 1 && tokens[q].type === TokenType.Identifier && tokens[q-1].text === 'record') foundRecord = true;

                        break;
                    }
                }
                else if (t.text === ']' || t.text === '=') {
                    if (balance === 0) {
                        foundArrayInit = true;
                        break;
                    }
                }
                else if (t.text === ';' || t.text === '{' || t.text === '}') {
                    if (balance === 0) break;
                }
                else if (t.text === '->') {
                     foundLambda = true;
                     break;
                }
                p--;
            }

            if (foundSwitch) {
                blockStack.push('SWITCH');
            } else if (foundArrayInit) {
                 blockStack.push('ARRAY_INIT');
            } else if (foundLambda) {
                 blockStack.push('LAMBDA_BLOCK');
            } else if (foundRecord) {
                 blockStack.push('RECORD_BODY');
            } else {
                blockStack.push('BLOCK');
            }

            // Standard Java Style (Google/Sun) keeps opening brace on the same line (OTBS)
            // So we do NOT pushLine here.
            // Spacing logic handles the space before {.
        }
        else if (token.text === '}') {
             if (next && ['catch', 'finally', 'else', 'while'].includes(next.text)) {
                 append(' ');
             } else if (next && (next.text === ';' || next.text === ')' || next.text === ',' || next.text === '.')) {
             } else {
                 pushLine();
             }
        }
        else if (token.text === ':') {
             if (inCaseLabel) {
                 inCaseLabel = false;
                 blockStack.push('CASE_CONTENT');
                 indentLevel++;
                 pushLine();
             }
        }
        else if (token.text === '->') {
            if (inCaseLabel) {
                inCaseLabel = false;
                if (next && next.text === '{') {
                     // case ... -> { ... }
                     // Standard practice: if block follows, treat it as normal block logic
                     // But we need to ensure indentation is correct for the block itself?
                     // { will increase indent.
                } else {
                     blockStack.push('SWITCH_RULE');
                     indentLevel++;
                }
            } else if (blockStack.length > 0 && blockStack[blockStack.length-1] === 'SWITCH_EXPR') {
                 // Switch expression without case? (unlikely)
            }
        }
        else if (token.text === ';') {
             if (blockStack.length > 0 && blockStack[blockStack.length - 1] === 'SWITCH_RULE') {
                 blockStack.pop();
                 indentLevel--;
             }
             // For switch expression, if we were in a rule without block, we popped it.
             // But if we are in a switch expression and this ; ends it (e.g. var x = switch(...) { ... }; )
             // The closing } handles the switch block pop.
             // But if we are inside a rule: case -> foo;
             // We just popped SWITCH_RULE. Correct.

             if (parenDepth === 0) pushLine();
             else append(' ');
        }
        else if (token.type === TokenType.Preprocessor) {
             // Annotation
             if (next && next.text === '(') {
                 // Logic handled in '('
             }

             // If followed by another annotation, force newline
             if (next && next.type === TokenType.Preprocessor) {
                 pushLine();
             }
             else if (next && ['public', 'private', 'protected', 'class', 'interface', 'enum', 'record', 'void', 'static', 'final', 'abstract', 'native', 'strictfp', 'synchronized', 'transient', 'volatile'].includes(next.text)) {
                 pushLine();
             }
             // If followed by type (Identifier) on same line, it's likely a type annotation or single line annotation
             else if (next && next.type === TokenType.Identifier && parenDepth === 0) {
                 // If the annotation is on its own line in source, keep it that way?
                 // Standard style: @Override \n public void ...
                 // But @NotNull String s
                 // Heuristic: if next token is on new line, pushLine
                 const nextIsNewLine = next.line > token.line;
                 if (nextIsNewLine) {
                     pushLine();
                 } else {
                     append(' ');
                 }
             } else if (next && next.text !== '(') {
                 // Check if next token is on new line
                 if (next && next.line > token.line) {
                     pushLine();
                 } else {
                     append(' ');
                 }
             }
        }
        else if (token.text === ',') {
             if (blockStack.length > 0 && blockStack[blockStack.length-1] === 'SWITCH_RULE') {
                 // Comma inside a switch rule expression?
                 // e.g. case 1, 2, 3 -> ...
                 // This is handled BEFORE ->.
                 // If we are inside -> expression, comma means tuple or something? Java doesn't have tuples.
                 // Method call args? method(a, b).
                 // SWITCH_RULE is pushed AFTER ->. So we are in the expression.
                 // So we should just append space.
                 append(' ');
             }
             else if (blockStack.length > 0 && (blockStack[blockStack.length-1] === 'ANNOTATION_ARGS' || blockStack[blockStack.length-1] === 'RECORD_ARGS' || blockStack[blockStack.length-1] === 'PAREN_BLOCK')) {
                 pushLine();
             } else {
                 append(' ');
             }
        }
        else if (token.type === TokenType.Comment) {
             pushLine();
        }

        if (token.text === '(') {
            parenDepth++;

            // Check if we need to start a block for Annotation Args or Record Args or General Paren Block
            if (prev) {
                if (prev.type === TokenType.Preprocessor) {
                    let hasNewlines = false;
                    let tempBalance = 0;
                    for(let k=i+1; k<tokens.length; k++) {
                        if (tokens[k].text === '(') tempBalance++;
                        if (tokens[k].text === ')') {
                            if (tempBalance === 0) break;
                            tempBalance--;
                        }
                        if (k>i && tokens[k].line > tokens[k-1].line) {
                            hasNewlines = true;
                            break;
                        }
                    }
                    if (hasNewlines) {
                        blockStack.push('ANNOTATION_ARGS');
                        indentLevel++;
                        pushLine();
                    }
                } else if (prev.type === TokenType.Identifier) {
                    // Check if it's a Record definition
                    // record Name ( ... )
                    if (i >= 2 && tokens[i-2].text === 'record') {
                         let hasNewlines = false;
                        let tempBalance = 0;
                        for(let k=i+1; k<tokens.length; k++) {
                            if (tokens[k].text === '(') tempBalance++;
                            if (tokens[k].text === ')') {
                                if (tempBalance === 0) break;
                                tempBalance--;
                            }
                            if (k>i && tokens[k].line > tokens[k-1].line) {
                                hasNewlines = true;
                                break;
                            }
                        }
                        if (hasNewlines) {
                            blockStack.push('RECORD_ARGS');
                            indentLevel++;
                            pushLine();
                        }
                    } else {
                         // General Parenthesized Block (Method Call, Def, If, etc.)
                         // If content has newlines, indent.
                         let hasNewlines = false;
                        let tempBalance = 0;
                        for(let k=i+1; k<tokens.length; k++) {
                            if (tokens[k].text === '(') tempBalance++;
                            if (tokens[k].text === ')') {
                                if (tempBalance === 0) break;
                                tempBalance--;
                            }
                            if (k>i && tokens[k].line > tokens[k-1].line) {
                                hasNewlines = true;
                                break;
                            }
                        }
                        if (hasNewlines) {
                            blockStack.push('PAREN_BLOCK');
                            indentLevel++;
                            // Don't pushLine immediately for ( ? usually ( \n arg
                            // But usually we want: method(\n    arg
                            // If next token is on new line, pushLine will happen naturally via blank line logic?
                            // No, blank line logic is for >1 newlines.
                            // We need to detect if next token is on next line.
                            // But `pushLine` forces a newline.
                            // If we just indent, subsequent `append` will use `getIndent`.
                            // But we need to ensure the first argument is on a new line?
                            // Standard: method(\n arg
                            // or method(arg1, \n arg2)
                            // If we detected newlines, we should encourage wrapping.
                            // Let's not force pushLine immediately unless next token is effectively on new line.
                            // But if we just indent, and next token is on same line, it won't be indented.
                            // So let's rely on original newlines for the *first* argument.
                            // But for subsequent args (after comma), we force pushLine.
                        }
                    }
                }
            }
        }
        else if (token.text === ')') {
             parenDepth = Math.max(0, parenDepth - 1);

             let popped = false;
             if (blockStack.length > 0) {
                 const top = blockStack[blockStack.length-1];
                 // Check if top matches what we are popping
                 // We don't have explicit tracking of which '(' pushed what, but we can infer
                 // Actually, we should probably check if parenDepth matches what we expect for the top block?
                 // But for now, relying on stack order.
                 if (top === 'ANNOTATION_ARGS' || top === 'RECORD_ARGS' || top === 'PAREN_BLOCK') {
                     // Only pop if this ) closes the block.
                     // Since we increment indentLevel, we should only pop when parenDepth drops below where it started?
                     // But we don't track start depth.
                     // However, we only push one of these PER '('.
                     // So one ')' should pop one.
                     blockStack.pop();
                     indentLevel--;
                     popped = true;

                     if (currentLine.trim() !== '') {
                         if (token.line > prev!.line) {
                             pushLine();
                         }
                     }
                 }
             }

             if (next && ['public', 'private', 'protected', 'class', 'interface', 'enum', 'record', 'void'].includes(next.text)) {
                 pushLine();
             } else if (popped && next && next.type === TokenType.Preprocessor) {
                 // After closing annotation args, if next is another annotation, newline
                 pushLine();
             }
        }
    }

    if (currentLine.trim() !== '') pushLine();

    alignDeclarations(outputLines);

    return outputLines.join('\n');
}

function alignDeclarations(lines: string[]) {
    let i = 0;
    while (i < lines.length) {
        let blockStart = -1;
        let blockEnd = -1;

        for (let j = i; j < lines.length; j++) {
            const line = lines[j];
            const trimmed = line.trim();

            if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('@')) {
                if (blockStart !== -1) {
                    blockEnd = j;
                    break;
                }
                continue;
            }

            if (!line.includes(';')) {
                if (blockStart !== -1) {
                    blockEnd = j;
                    break;
                }
                continue;
            }

            if (/^\s*(return|throw|package|import)\b/.test(line)) {
                 if (blockStart !== -1) {
                    blockEnd = j;
                    break;
                }
                continue;
            }

            const eqIndex = line.indexOf('=');
            const semiIndex = line.indexOf(';');

            const endDeclIndex = (eqIndex !== -1 && eqIndex < semiIndex) ? eqIndex : semiIndex;

            const declPart = line.substring(0, endDeclIndex).trimEnd();

            if (declPart.includes('(') || declPart.includes(')') || declPart.includes('"') || declPart.includes("'")) {
                 if (blockStart !== -1) {
                    blockEnd = j;
                    break;
                }
                continue;
            }

            const lastSpaceIndex = declPart.lastIndexOf(' ');
            if (lastSpaceIndex !== -1) {
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
            const parsedItems = [];

            let maxTypeLen = 0;

            for (let k = 0; k < block.length; k++) {
                const line = block[k];
                const trimmed = line.trim();

                if (trimmed === '' || trimmed.startsWith('/') || trimmed.startsWith('*') || trimmed.startsWith('@')) {
                    parsedItems.push(null);
                    continue;
                }

                const indentMatch = line.match(/^(\s*)/);
                const indent = indentMatch ? indentMatch[1] : '';

                const eqIndex = line.indexOf('=');
                const semiIndex = line.indexOf(';');
                if (semiIndex === -1) { parsedItems.push(null); continue; }

                const endDeclIndex = (eqIndex !== -1 && eqIndex < semiIndex) ? eqIndex : semiIndex;

                const declPart = line.substring(0, endDeclIndex).trimEnd();
                const restPart = line.substring(endDeclIndex);

                if (declPart.includes('(') || declPart.includes(')') || declPart.includes('"') || declPart.includes("'")) {
                    parsedItems.push(null);
                    continue;
                }

                const trimmedDecl = declPart.trim();
                const lastSpace = trimmedDecl.lastIndexOf(' ');

                if (lastSpace !== -1) {
                    const typePart = trimmedDecl.substring(0, lastSpace);
                    const namePart = trimmedDecl.substring(lastSpace + 1);

                    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*(\[\])*$/.test(namePart)) {
                        parsedItems.push(null);
                        continue;
                    }

                    if (typePart.length > maxTypeLen) maxTypeLen = typePart.length;

                    parsedItems.push({
                        indent,
                        type: typePart,
                        name: namePart,
                        rest: restPart
                    });
                } else {
                    parsedItems.push(null);
                }
            }

            if (parsedItems.filter(x => x !== null).length > 1) {
                for (let k = 0; k < block.length; k++) {
                    const item = parsedItems[k];
                    if (item) {
                        const padding = ' '.repeat(maxTypeLen - item.type.length);
                        lines[blockStart + k] = `${item.indent}${item.type}${padding} ${item.name}${item.rest}`;
                    }
                }
            }

            i = blockEnd;
        } else {
            i++;
        }
    }
}
