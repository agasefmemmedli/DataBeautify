
import { PythonTokenizer, Token, TokenType } from './python_tokenizer';

interface Line {
    tokens: Token[];
    originalIndent: number;
    hasComment: boolean;
    isEmpty: boolean;
}

export function formatPythonDeep(text: string): string {
    const tokenizer = new PythonTokenizer(text);
    const allTokens = tokenizer.tokenize();

    // 1. Group tokens by line
    const lines: Line[] = [];
    let currentLineTokens: Token[] = [];
    let currentIndent = 0;
    let seenNonWhitespace = false;

    // Helper to finalize a line
    const pushLine = () => {
        lines.push({
            tokens: currentLineTokens,
            originalIndent: seenNonWhitespace ? currentIndent : 0,
            hasComment: currentLineTokens.some(t => t.type === TokenType.Comment),
            isEmpty: !seenNonWhitespace && currentLineTokens.length === 0
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

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.isEmpty && line.tokens.length === 0) {
            blankLinesCount++;
            continue;
        }

        // Determine correct indentation level
        let indentLevel = indentStack[indentStack.length - 1];

        const firstToken = line.tokens[0];
        const isClosingDelimiter = firstToken && firstToken.type === TokenType.Punctuation && ')]}'.includes(firstToken.text);
        const isInMultiLineExpr = parenLevel > 0 || bracketLevel > 0 || braceLevel > 0;

        if (!isInMultiLineExpr || isClosingDelimiter) {
            // Dedent logic with fault tolerance
            // We only pop if the user's indent is <= the parent level
            while (indentStack.length > 1) {
                const parentIndent = indentStack[indentStack.length - 2];
                if (line.originalIndent <= parentIndent) {
                    indentStack.pop();
                } else {
                    break;
                }
            }
            indentLevel = indentStack[indentStack.length - 1];
        }

        let extraIndent = 0;
        if (isInMultiLineExpr && !isClosingDelimiter) {
             extraIndent = 4;
        }

        const indentString = ' '.repeat(indentLevel + extraIndent);

        // Vertical Spacing Rules
        const isDef = firstToken && firstToken.type === TokenType.Keyword && (firstToken.text === 'def' || firstToken.text === 'async');
        const isClass = firstToken && firstToken.type === TokenType.Keyword && firstToken.text === 'class';
        const isAsync = firstToken && firstToken.type === TokenType.Keyword && firstToken.text === 'async';
        const isDecorator = firstToken && firstToken.type === TokenType.Operator && firstToken.text === '@';
        const isImport = firstToken && firstToken.type === TokenType.Keyword && (firstToken.text === 'import' || firstToken.text === 'from');

        let effectiveIsDef = isDef;
        if (isAsync && line.tokens.length > 1 && line.tokens[1].text === 'def') {
            effectiveIsDef = true;
        }

        const isTopLevel = indentLevel === 0;

        let requiredBlankLines = 0;
        if (isTopLevel && (effectiveIsDef || isClass)) {
            requiredBlankLines = 2;
        } else if (effectiveIsDef || isClass) {
            requiredBlankLines = 1;
        }

        if (previousLineWasDecorator) requiredBlankLines = 0;
        if (i === 0) requiredBlankLines = 0;

        // Apply blank lines
        if (outputLines.length > 0) {
            let finalBlankLines = 0;
            if (requiredBlankLines > 0) {
                finalBlankLines = Math.max(requiredBlankLines, (blankLinesCount > 0 ? blankLinesCount : 0));
                finalBlankLines = Math.min(finalBlankLines, 2);
            } else {
                 finalBlankLines = Math.min(blankLinesCount, 2);
            }

            for (let k = 0; k < finalBlankLines; k++) {
                outputLines.push('');
            }
        }

        blankLinesCount = 0;
        previousLineWasDecorator = isDecorator;
        previousLineWasImport = isImport;

        // Construct Line
        let formattedLine = indentString;

        for (let j = 0; j < line.tokens.length; j++) {
            const token = line.tokens[j];
            const nextToken = line.tokens[j + 1];
            const prevToken = line.tokens[j - 1];

            // Update nesting levels
            if (token.text === '(') parenLevel++;
            if (token.text === '[') bracketLevel++;
            if (token.text === '{') braceLevel++;
            if (token.text === ')') parenLevel--;
            if (token.text === ']') bracketLevel--;
            if (token.text === '}') braceLevel--;

            // Append token text
            formattedLine += token.text;

            if (!nextToken) continue;

            let needSpace = false;

            // Spacing Rules
            if (token.type === TokenType.Operator) {
                if (token.text === '@' && j === 0) {
                    needSpace = false;
                }
                else if ((token.text === '+' || token.text === '-' || token.text === '~' || token.text === '*' || token.text === '**') &&
                         (!prevToken || prevToken.type === TokenType.Operator || (prevToken.type === TokenType.Keyword && ['return', 'yield', 'if', 'else', 'and', 'or', 'not', 'is', 'in', 'lambda'].includes(prevToken.text)) || (prevToken.type === TokenType.Punctuation && '([{:,'.includes(prevToken.text)))) {
                    needSpace = false; // Unary
                }
                else {
                    if (token.text === '=') {
                        // Kwargs check
                        if (parenLevel > 0) needSpace = false;
                        else needSpace = true;
                    } else if (token.text === '.') {
                        needSpace = false;
                    } else {
                        needSpace = true;
                    }
                }
            }
            else if (token.type === TokenType.Punctuation) {
                if (token.text === ',') {
                    needSpace = true;
                } else if (token.text === ':') {
                     if (bracketLevel > 0) needSpace = false; // Slice
                     else needSpace = true;
                } else if (token.text === ';') {
                    needSpace = true;
                } else if ('([{'.includes(token.text)) {
                    needSpace = false;
                } else if (')]}'.includes(token.text)) {
                    needSpace = true;
                    if (nextToken.type === TokenType.Punctuation && ',.:)]};'.includes(nextToken.text)) {
                        needSpace = false;
                    }
                } else if (token.text === '.') {
                    needSpace = false;
                }
            }
            else if (token.type === TokenType.Keyword) {
                if (nextToken.type === TokenType.Punctuation && ':)]},'.includes(nextToken.text)) {
                     needSpace = false;
                } else if (nextToken.type === TokenType.Operator) {
                     // e.g. 'and' -> 'and not' (Operator? No, not is Keyword).
                     // 'if' -> 'if (' (Punctuation).
                     // 'return' -> 'return -1' (Operator). Space needed.
                     needSpace = true;
                } else {
                     needSpace = true;
                }
            }
            else if (token.type === TokenType.Identifier || token.type === TokenType.Number || token.type === TokenType.String) {
                if (nextToken.type === TokenType.Identifier || nextToken.type === TokenType.Keyword || nextToken.type === TokenType.Number) {
                     needSpace = true;
                } else if (nextToken.type === TokenType.Punctuation && '([{'.includes(nextToken.text)) {
                     needSpace = false;
                } else if (nextToken.type === TokenType.Operator) {
                     // Check for kwargs '=' or '.'
                     if (nextToken.text === '=' && parenLevel > 0) needSpace = false;
                     else if (nextToken.text === '.') needSpace = false;
                     else needSpace = true;
                }
            }

            if (nextToken.type === TokenType.Comment) {
                formattedLine += '  ';
                // Reset needSpace because we handled it
                needSpace = false;
            }

            if (needSpace) {
                formattedLine += ' ';
            }
        }

        outputLines.push(formattedLine);

        // Check if we need to increase indent for NEXT line
        const lastToken = line.tokens[line.tokens.length - 1];
        if (lastToken && lastToken.type === TokenType.Punctuation && lastToken.text === ':') {
             indentStack.push(indentStack[indentStack.length - 1] + 4);
        }
    }

    if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== '') {
        outputLines.push('');
    }

    return postProcessImports(outputLines).join('\n');
}

function postProcessImports(lines: string[]): string[] {
    const finalLines: string[] = [];
    let importBuffer: string[] = [];
    let currentIndent = -1;

    const flushBuffer = () => {
        if (importBuffer.length > 0) {
            // Sort imports
            // Logic:
            // 1. Separate 'import ...' and 'from ...'?
            // PEP8: Standard, 3rd party, Local. Hard to distinguish.
            // Simple alphabetical sort is better than random.
            // However, we should keep relative order of groups if separated by blank lines.
            // Here we only group contiguous lines.
            // So just sort the buffer.

            importBuffer.sort((a, b) => {
                // Remove indentation for comparison
                const textA = a.trim();
                const textB = b.trim();
                // 'import' vs 'from'?
                // Some prefer 'import' first. Some mixed.
                // Let's just standard lexicographical sort.
                return textA.localeCompare(textB);
            });

            finalLines.push(...importBuffer);
            importBuffer = [];
        }
    };

    for (const line of lines) {
        const trimmed = line.trim();
        const indent = line.search(/\S|$/); // First non-whitespace index

        const isImport = trimmed.startsWith('import ') || trimmed.startsWith('from ');

        if (isImport) {
            if (currentIndent === -1) {
                currentIndent = indent;
            }

            if (indent === currentIndent) {
                importBuffer.push(line);
            } else {
                // Indentation changed - flush previous block
                flushBuffer();
                currentIndent = indent;
                importBuffer.push(line);
            }
        } else {
            // Not an import line (could be blank, or code, or comment)
            // If blank line, it breaks the block? Yes.
            // If comment? Comments usually belong to the import.
            // If we sort, we might detach comments.
            // Safe approach: If we encounter a comment, we STOP sorting the current block?
            // Or we treat comment as part of the block?
            // If we sort lines including comments, comments will move.
            // If a block has comments, maybe skip sorting it to avoid breaking context?

            // Heuristic: If we see a comment line (starts with #), flush buffer.
            // If we see blank line, flush buffer.
            // If we see code, flush buffer.

            // Check if line is comment
            const isComment = trimmed.startsWith('#');
            // Check if line is blank
            const isBlank = trimmed === '';

            // Wait, if imports have inline comments `import x # comment`, that is fine (part of line).
            // But full line comments `\n# section\nimport x` -> The comment breaks the block.

            flushBuffer();
            currentIndent = -1;
            finalLines.push(line);
        }
    }
    flushBuffer();

    return finalLines;
}
