
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

    const pushLine = () => {
        // Determine line type
        let isDecorator = false;
        let isDef = false;
        let isClass = false;
        let isAsync = false;
        let isImport = false;

        if (currentLineTokens.length > 0) {
            const first = currentLineTokens[0];
            if (first.type === TokenType.Operator && first.text === '@') isDecorator = true;
            if (first.type === TokenType.Keyword) {
                if (first.text === 'class') isClass = true;
                if (first.text === 'def') isDef = true;
                if (first.text === 'async') isAsync = true;
                if (first.text === 'import' || first.text === 'from') isImport = true;
            }
            if (currentLineTokens.length > 1 && isAsync && currentLineTokens[1].text === 'def') {
                isDef = true;
            }
        }

        lines.push({
            tokens: currentLineTokens,
            originalIndent: seenNonWhitespace ? currentIndent : 0,
            hasComment: currentLineTokens.some(t => t.type === TokenType.Comment),
            isEmpty: !seenNonWhitespace && currentLineTokens.length === 0,
            isDecorator,
            isDef,
            isClass,
            isAsync,
            isImport
        });
        currentLineTokens = [];
        currentIndent = 0;
        seenNonWhitespace = false;
    };

    for (const token of allTokens) {
        if (token.type === TokenType.Newline) {
            pushLine();
        } else if (token.type === TokenType.Whitespace) {
             if (!seenNonWhitespace) {
                 // Calculate indent size (tabs = 4 spaces)
                 currentIndent = token.text.replace(/\t/g, '    ').length;
             }
        } else {
            currentLineTokens.push(token);
            seenNonWhitespace = true;
        }
    }
    if (seenNonWhitespace || currentLineTokens.length > 0) {
        pushLine();
    }

    // 2. Process Lines & Indentation
    const indentStack = [0];
    const outputLines: string[] = [];

    // State tracking across lines
    let parenLevel = 0;
    let bracketLevel = 0;
    let braceLevel = 0;

    let blankLinesCount = 0;
    let previousLineWasDecorator = false;
    let previousLineWasImport = false;

    // Indentation tracking for resilience
    let previousOriginalIndent = 0;
    let previousLineEndedWithColon = false;

    // Helper to calculate indentation change
    const getIndentationChange = (tokens: Token[]) => {
        let endsWithColon = false;
        if (tokens.length > 0) {
            const last = tokens[tokens.length - 1];
            if (last.type === TokenType.Punctuation && last.text === ':') {
                endsWithColon = true;
            }
            // Check for comment at end of line
            if (last.type === TokenType.Comment && tokens.length > 1) {
                const secondLast = tokens[tokens.length - 2];
                if (secondLast.type === TokenType.Punctuation && secondLast.text === ':') {
                    endsWithColon = true;
                }
            }
        }
        return { endsWithColon };
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.isEmpty) {
            blankLinesCount++;
            continue;
        }

        // Determine correct indentation level
        let indentLevel = indentStack[indentStack.length - 1];

        const isInMultiLineExpr = parenLevel > 0 || bracketLevel > 0 || braceLevel > 0;

        const firstToken = line.tokens[0];
        const isClosingDelimiter = firstToken && firstToken.type === TokenType.Punctuation && ')]}'.includes(firstToken.text);

        const isDedentKeyword = firstToken && firstToken.type === TokenType.Keyword && ['else', 'elif', 'except', 'finally'].includes(firstToken.text);

        if (!isInMultiLineExpr || isClosingDelimiter) {
            // Adaptive Dedent Logic
            const isIndentationIncrease = previousLineEndedWithColon && line.originalIndent > previousOriginalIndent;

            if (line.originalIndent < indentLevel && !isIndentationIncrease) {
                 // Try to find matching level in stack
                 while (indentStack.length > 1) {
                     const parentIndent = indentStack[indentStack.length - 2];
                     if (line.originalIndent <= parentIndent) {
                         indentStack.pop();
                         indentLevel = indentStack[indentStack.length - 1];
                     } else {
                         break;
                     }
                     if (line.originalIndent >= indentLevel) break;
                 }
            }

            if (isDedentKeyword && indentStack.length > 1) {
                 // Could force dedent here if needed
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

        if (indentLevel === 0 && (line.isClass || (line.isDef && !previousLineWasDecorator))) {
            requiredBlankLines = 2;
        }
        else if (indentLevel > 0 && (line.isClass || (line.isDef && !previousLineWasDecorator))) {
             requiredBlankLines = 1;
        }

        if (previousLineWasDecorator) {
            requiredBlankLines = 0;
        }

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
        const indentString = ' '.repeat(indentLevel + extraIndent);
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
                // Unary check logic (simplified from previous)
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
                     needSpace = true;
                }
            }
            // 5. Identifiers/Numbers/Strings
            else if (token.type === TokenType.Identifier || token.type === TokenType.Number || token.type === TokenType.String) {
                if (nextToken.type === TokenType.Punctuation && '([{:,.]'.includes(nextToken.text)) { // Added .
                    needSpace = false;
                } else if (nextToken.type === TokenType.Operator) {
                     if (nextToken.text === '.') needSpace = false;
                     else if (nextToken.text === '(' || nextToken.text === '[') needSpace = false;
                     else if (nextToken.text === '=') {
                         if (parenLevel > 0) needSpace = false;
                         else needSpace = true;
                     }
                     else needSpace = true;
                } else if (nextToken.type === TokenType.Punctuation && ')]}'.includes(nextToken.text)) { // Added ] }
                    needSpace = false;
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

            // Update nesting levels with includes() for safety
            if (token.text.includes('(')) parenLevel++;
            if (token.text.includes('[')) bracketLevel++;
            if (token.text.includes('{')) braceLevel++;
            if (token.text.includes(')')) parenLevel--;
            if (token.text.includes(']')) bracketLevel--;
            if (token.text.includes('}')) braceLevel--;
        }

        outputLines.push(formattedLine);

        // Update Indentation Stack for NEXT line
        const change = getIndentationChange(line.tokens);
        if (change.endsWithColon) {
            indentStack.push(indentStack[indentStack.length - 1] + 4);
        }

        previousOriginalIndent = line.originalIndent;
        previousLineEndedWithColon = change.endsWithColon;
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
            finalLines.push(...importBuffer);
            importBuffer = [];
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        const isImport = trimmed.startsWith('import ') || trimmed.startsWith('from ');
        const isIndented = line.startsWith(' ');

        if (isImport && !isIndented) {
            importBuffer.push(line);
        } else {
            flushBuffer();
            finalLines.push(line);
        }
    }
    flushBuffer();

    return finalLines;
}
