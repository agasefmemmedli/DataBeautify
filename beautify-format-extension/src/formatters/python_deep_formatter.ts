
import { PythonTokenizer, Token, TokenType } from './python_tokenizer';

interface Line {
    tokens: Token[];
    originalIndent: number;
    hasComment: boolean;
    isEmpty: boolean;
    isDecorator: boolean;
    isDef: boolean;
    isClass: boolean;
    isAsync: boolean;
    isImport: boolean;
}

export function formatPythonDeep(text: string): string {
    const tokenizer = new PythonTokenizer(text);
    const allTokens = tokenizer.tokenize();

    // 1. Group tokens by line
    const lines: Line[] = [];
    let currentLineTokens: Token[] = [];
    let currentIndent = 0;
    let seenNonWhitespace = false;

    const processTokensIntoLines = (tokens: Token[], indent: number) => {
        // This function processes a list of tokens (representing a logical line)
        // and splits them if necessary, pushing to 'lines'.

        let remainingTokens = tokens;
        let effectiveIndent = indent;

        while (remainingTokens.length > 0) {
             // 1. Analyze for line type (for the FIRST part)
             let isDecorator = false;
             let isDef = false;
             let isClass = false;
             let isAsync = false;
             let isImport = false;

             if (remainingTokens.length > 0) {
                const first = remainingTokens[0];
                if (first.type === TokenType.Operator && first.text === '@') isDecorator = true;
                if (first.type === TokenType.Keyword) {
                    if (first.text === 'class') isClass = true;
                    if (first.text === 'def') isDef = true;
                    if (first.text === 'async') isAsync = true;
                    if (first.text === 'import' || first.text === 'from') isImport = true;
                }
                if (remainingTokens.length > 1 && isAsync && remainingTokens[1].text === 'def') {
                    isDef = true;
                }
             }

             // 2. Find Split Point
             let splitIndex = -1;
             let nesting = 0;
             let splitType: 'colon' | 'semi' | null = null;

             for (let i = 0; i < remainingTokens.length; i++) {
                const t = remainingTokens[i];
                if (['(', '[', '{'].includes(t.text)) nesting++;
                else if ([')', ']', '}'].includes(t.text)) nesting--;

                const isColon = t.text === ':';
                const isSemi = t.text === ';';

                if ((isColon || isSemi) && nesting === 0) {
                    let isLambda = false;
                    if (isColon) {
                        for(let k=0; k<i; k++) {
                            if (remainingTokens[k].text === 'lambda') isLambda = true;
                        }
                    }

                    if (!isLambda) {
                        // Check content after
                        let hasContentAfter = false;
                        for (let j = i + 1; j < remainingTokens.length; j++) {
                            if (remainingTokens[j].type !== TokenType.Comment && remainingTokens[j].type !== TokenType.Whitespace) {
                                hasContentAfter = true;
                                break;
                            }
                        }

                        if (hasContentAfter) {
                            splitIndex = i;
                            splitType = isColon ? 'colon' : 'semi';
                            break;
                        }
                    }
                }
             }

             if (splitIndex !== -1) {
                 const part1Length = splitType === 'semi' ? splitIndex : splitIndex + 1;
                 const part1 = remainingTokens.slice(0, part1Length);
                 const part2 = remainingTokens.slice(splitIndex + 1);

                 lines.push({
                    tokens: part1,
                    originalIndent: effectiveIndent,
                    hasComment: part1.some(t => t.type === TokenType.Comment),
                    isEmpty: false,
                    isDecorator,
                    isDef,
                    isClass,
                    isAsync,
                    isImport
                 });

                 // Prepare for next iteration
                 remainingTokens = part2;
                 if (splitType === 'colon') {
                     effectiveIndent += 4;
                 }
                 // If semi, indent stays same
             } else {
                 // No split, push remaining and break
                 lines.push({
                    tokens: remainingTokens,
                    originalIndent: effectiveIndent,
                    hasComment: remainingTokens.some(t => t.type === TokenType.Comment),
                    isEmpty: false, // We know tokens > 0
                    isDecorator,
                    isDef,
                    isClass,
                    isAsync,
                    isImport
                 });
                 break;
             }
        }
    };

    const pushLine = () => {
        if (currentLineTokens.length === 0 && !seenNonWhitespace) {
            // Empty line
            lines.push({
                tokens: [],
                originalIndent: 0,
                hasComment: false,
                isEmpty: true,
                isDecorator: false,
                isDef: false,
                isClass: false,
                isAsync: false,
                isImport: false
            });
        } else {
            // Process (and possibly split) the line
            processTokensIntoLines(currentLineTokens, currentIndent);
        }

        currentLineTokens = [];
        currentIndent = 0;
        seenNonWhitespace = false;
    };

    for (const token of allTokens) {
        if (token.type === TokenType.Newline) {
            pushLine();
        } else if (token.type === TokenType.Whitespace) {
             if (!seenNonWhitespace) {
                 currentIndent = token.text.replace(/\t/g, '    ').length;
             }
             // Ignore whitespace in content
        } else {
            currentLineTokens.push(token);
            seenNonWhitespace = true;
        }
    }
    if (seenNonWhitespace || currentLineTokens.length > 0) {
        pushLine();
    }

    // 2. Process Lines & Indentation (Relative Stack Logic)
    // Stack stores objects: { logical: number, original: number }
    const indentStack: { logical: number, original: number }[] = [{ logical: 0, original: 0 }];
    const outputLines: string[] = [];

    // State tracking
    let parenLevel = 0;
    let bracketLevel = 0;
    let braceLevel = 0;

    let blankLinesCount = 0;
    let previousLineWasDecorator = false;
    let previousLineWasImport = false;
    let previousLineEndedWithColon = false;

    // Helper to calculate endsWithColon
    const getEndsWithColon = (tokens: Token[]) => {
        if (tokens.length > 0) {
            const last = tokens[tokens.length - 1];
            if (last.type === TokenType.Punctuation && last.text === ':') return true;
            if (last.type === TokenType.Comment && tokens.length > 1) {
                const secondLast = tokens[tokens.length - 2];
                if (secondLast.type === TokenType.Punctuation && secondLast.text === ':') return true;
            }
        }
        return false;
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.isEmpty) {
            blankLinesCount++;
            continue;
        }

        // --- RELATIVE INDENTATION LOGIC ---
        const top = indentStack[indentStack.length - 1];
        let currentLogicalIndent = top.logical;

        const isInMultiLineExpr = parenLevel > 0 || bracketLevel > 0 || braceLevel > 0;
        const firstToken = line.tokens[0];
        const isClosingDelimiter = firstToken && firstToken.type === TokenType.Punctuation && ')]}'.includes(firstToken.text);
        const isDedentKeyword = firstToken && firstToken.type === TokenType.Keyword && ['else', 'elif', 'except', 'finally'].includes(firstToken.text);

        if (!isInMultiLineExpr || isClosingDelimiter) {
            if (previousLineEndedWithColon) {
                // Expect indent increase
                if (line.originalIndent > top.original) {
                    // Push new level
                    const newLogical = top.logical + 4;
                    indentStack.push({ logical: newLogical, original: line.originalIndent });
                    currentLogicalIndent = newLogical;
                } else {
                    // Expected increase but got same or less?
                    // This implies the block is empty or on same line (which we split)?
                    // If we split, line.originalIndent should be > top.original.
                    // If user wrote `if x: \n pass` (pass at same level), that's invalid python.
                    // But we should try to handle it.
                    // Assume it belongs to current level if strictly greater?
                    // For now, if no increase, we don't push, stay at current level (which is wrong for if: ...).
                    // But maybe we should force indent?
                }
            } else {
                // Expect same or dedent
                if (line.originalIndent > top.original) {
                    // Weird indentation increase without colon?
                    // e.g. multi-line statement continuation without parens?
                    // Or just bad formatting.
                    // We can just increase logical indent to be safe.
                    // indentStack.push({ logical: top.logical + 4, original: line.originalIndent });
                    // currentLogicalIndent = top.logical + 4;
                } else if (line.originalIndent < top.original) {
                    // Dedent
                    // Pop until we find a matching original indent OR something smaller
                    while (indentStack.length > 1) {
                        const parent = indentStack[indentStack.length - 2];
                        if (line.originalIndent <= parent.original) {
                            indentStack.pop();
                            if (line.originalIndent === parent.original) {
                                break; // Found exact match
                            }
                            // If strictly smaller, keep popping?
                        } else {
                            // line.originalIndent > parent.original
                            // But < top.original.
                            // It's an intermediate level.
                            // We should probably pop top and use this new level?
                            // e.g. Top=8 (orig 2). Parent=0 (orig 0). Line=1.
                            // We pop top. Now at Parent.
                            // Should we push 4 (orig 1)?
                            // Yes, implicitly.
                            indentStack.pop();
                            break;
                        }
                    }
                    currentLogicalIndent = indentStack[indentStack.length - 1].logical;

                    // Special check for 'else' etc to align with block start
                    if (isDedentKeyword) {
                         // Ensure we are at same level as the 'if'.
                         // 'if' pushed a level. We popped it (hopefully).
                         // So we should be at 'if's level.
                    }
                } else {
                    // Same original indent -> Same logical indent
                }
            }
        }

        let extraIndent = 0;
        if (isInMultiLineExpr) {
            if (isClosingDelimiter) {
                extraIndent = 0;
            } else {
                extraIndent = 4;
            }
        }

        // --- BLANK LINES LOGIC ---
        let requiredBlankLines = 0;
        // Use currentLogicalIndent for top-level check
        if (currentLogicalIndent === 0) {
            if (line.isClass || (line.isDef && !previousLineWasDecorator)) {
                requiredBlankLines = 2;
            }
        } else {
            if (line.isClass || (line.isDef && !previousLineWasDecorator)) {
                 requiredBlankLines = 1;
            }
        }
        if (previousLineWasDecorator) requiredBlankLines = 0;
        if (outputLines.length === 0) requiredBlankLines = 0;

        let linesToInsert = Math.max(requiredBlankLines, blankLinesCount);
        linesToInsert = Math.min(linesToInsert, 2);

        if (outputLines.length > 0) {
            for (let k = 0; k < linesToInsert; k++) {
                outputLines.push('');
            }
        }

        blankLinesCount = 0;
        previousLineWasDecorator = line.isDecorator;
        previousLineWasImport = line.isImport;

        // --- LINE CONSTRUCTION ---
        const indentString = ' '.repeat(currentLogicalIndent + extraIndent);
        let formattedLine = indentString;

        for (let j = 0; j < line.tokens.length; j++) {
            const token = line.tokens[j];
            const nextToken = line.tokens[j + 1];

            formattedLine += token.text;

            if (!nextToken) continue;

            let needSpace = false;

            // 1. Comma
            if (token.text === ',') {
                needSpace = true;
            }
            // 2. Colon
            else if (token.text === ':') {
                 if (braceLevel > 0) needSpace = true; // Dict
                 else if (bracketLevel > 0) needSpace = false; // Slice
                 else needSpace = true; // Type hint or block start
            }
            // 3. Operators
            else if (token.type === TokenType.Operator) {
                // Unary check logic
                const prevToken = line.tokens[j - 1];
                const isUnaryContext = !prevToken ||
                                       (prevToken.type === TokenType.Operator) ||
                                       (prevToken.type === TokenType.Keyword && ['return', 'yield', 'if', 'else', 'and', 'or', 'not', 'is', 'in', 'lambda', 'await'].includes(prevToken.text)) ||
                                       (prevToken.type === TokenType.Punctuation && '([{:,'.includes(prevToken.text));

                if (['+', '-', '~', '*'].includes(token.text) && isUnaryContext) {
                    needSpace = false; // Unary
                } else if (token.text === '**') {
                     if (isUnaryContext) needSpace = false;
                     else needSpace = true;
                } else if (token.text === '=') {
                    if (parenLevel > 0) needSpace = false;
                    else needSpace = true;
                } else if (token.text === '.') {
                    needSpace = false;
                } else if (token.text === '@') {
                    if (line.isDecorator && j === 0) needSpace = false;
                    else needSpace = true;
                } else if (['->'].includes(token.text)) {
                    needSpace = true;
                } else {
                    needSpace = true;
                }
            }
            // 4. Keywords
            else if (token.type === TokenType.Keyword) {
                if (['None', 'True', 'False', '...'].includes(token.text)) {
                     if (nextToken.type === TokenType.Punctuation && '([{:,'.includes(nextToken.text)) needSpace = false;
                     else needSpace = true;
                } else {
                     if (nextToken.type === TokenType.Punctuation && nextToken.text === ':') {
                         needSpace = false; // else:
                     } else {
                         needSpace = true;
                     }
                }
            }
            // 5. Identifiers/Numbers/Strings
            else if (token.type === TokenType.Identifier || token.type === TokenType.Number || token.type === TokenType.String) {
                if (nextToken.type === TokenType.Punctuation && '([{:,.]'.includes(nextToken.text)) {
                    needSpace = false;
                } else if (nextToken.type === TokenType.Operator) {
                     if (nextToken.text === '.') needSpace = false;
                     else if (nextToken.text === '(' || nextToken.text === '[') needSpace = false;
                     else if (nextToken.text === '=') {
                         if (parenLevel > 0) needSpace = false;
                         else needSpace = true;
                     }
                     else needSpace = true;
                } else if (nextToken.type === TokenType.Punctuation && ')]}'.includes(nextToken.text)) {
                    needSpace = false;
                } else if (nextToken.text === ';') {
                    needSpace = false; // No space before semicolon
                } else {
                    needSpace = true;
                }
            }
            // 6. Punctuation
            else if (token.type === TokenType.Punctuation) {
                if ('([{'.includes(token.text)) {
                    needSpace = false;
                } else if (')]}'.includes(token.text)) {
                    if (nextToken.text === ':') needSpace = false;
                    else if (nextToken.text === ',') needSpace = false;
                    else if (nextToken.text === '.') needSpace = false;
                    else if (nextToken.text === ';') needSpace = false;
                    else if (')]}'.includes(nextToken.text)) needSpace = false;
                    else needSpace = true;
                } else if (token.text === '.') {
                    needSpace = false;
                } else if (token.text === ';') {
                    needSpace = true;
                }
            }

            // Special handling for comment
            if (nextToken.type === TokenType.Comment) {
                formattedLine += '  ';
                needSpace = false;
            }

            if (needSpace) formattedLine += ' ';

            // Update nesting levels
            if (token.type === TokenType.Punctuation || token.type === TokenType.Operator) {
                if (token.text === '(') parenLevel++;
                else if (token.text === '[') bracketLevel++;
                else if (token.text === '{') braceLevel++;
                else if (token.text === ')') parenLevel = Math.max(0, parenLevel - 1);
                else if (token.text === ']') bracketLevel = Math.max(0, bracketLevel - 1);
                else if (token.text === '}') braceLevel = Math.max(0, braceLevel - 1);
            }
        }

        outputLines.push(formattedLine);

        previousLineEndedWithColon = getEndsWithColon(line.tokens);
    }

    if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== '') {
        outputLines.push('');
    }

    return postProcessImports(outputLines).join('\n');
}

function postProcessImports(lines: string[]): string[] {
    const finalLines: string[] = [];
    let importBuffer: string[] = [];

    const flushBuffer = () => {
        if (importBuffer.length > 0) {
            importBuffer.sort();

            const expandedBuffer: string[] = [];
            for(const imp of importBuffer) {
                const trimmed = imp.trim();
                if (trimmed.startsWith('import ') && !trimmed.startsWith('from ')) {
                    const parts = trimmed.substring(7).split(',');
                    if (parts.length > 1) {
                         for(const part of parts) {
                             expandedBuffer.push(`import ${part.trim()}`);
                         }
                    } else {
                        expandedBuffer.push(imp);
                    }
                } else {
                    expandedBuffer.push(imp);
                }
            }

            expandedBuffer.sort();
            finalLines.push(...expandedBuffer);
            importBuffer = [];
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const isImport = (trimmed.startsWith('import ') || trimmed.startsWith('from ')) && !line.startsWith(' ');

        if (isImport) {
            importBuffer.push(line);
        } else {
            flushBuffer();
            finalLines.push(line);
        }
    }
    flushBuffer();

    return finalLines;
}
