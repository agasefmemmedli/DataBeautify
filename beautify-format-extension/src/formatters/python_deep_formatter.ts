
import { PythonTokenizer, Token, TokenType } from './python_tokenizer';

interface Line {
    tokens: Token[];
    indentToken: Token | null;
    originalIndent: number;
}

export function formatPythonDeep(text: string): string {
    const tokenizer = new PythonTokenizer(text);
    const allTokens = tokenizer.tokenize();

    // Group tokens by line
    const lines: Line[] = [];
    let currentLineTokens: Token[] = [];
    let currentIndentToken: Token | null = null;
    let seenNonWhitespace = false;

    for (const token of allTokens) {
        if (token.type === TokenType.Newline) {
            if (seenNonWhitespace || currentIndentToken) {
                let originalIndent = 0;
                if (currentIndentToken) {
                    originalIndent = currentIndentToken.text.length;
                    if (currentIndentToken.text.includes('\t')) {
                        originalIndent = currentIndentToken.text.replace(/\t/g, '    ').length;
                    }
                }

                lines.push({
                    tokens: currentLineTokens,
                    indentToken: currentIndentToken,
                    originalIndent
                });
            } else {
                lines.push({ tokens: [], indentToken: null, originalIndent: 0 });
            }

            currentLineTokens = [];
            currentIndentToken = null;
            seenNonWhitespace = false;
        } else if (token.type === TokenType.Whitespace) {
             if (!seenNonWhitespace && !currentIndentToken) {
                 currentIndentToken = token;
             }
        } else if (token.type === TokenType.Comment) {
             currentLineTokens.push(token);
             seenNonWhitespace = true;
        } else {
            currentLineTokens.push(token);
            seenNonWhitespace = true;
        }
    }

    if (seenNonWhitespace || currentIndentToken) {
        let originalIndent = 0;
        if (currentIndentToken) {
            originalIndent = currentIndentToken.text.length;
            if (currentIndentToken.text.includes('\t')) {
                originalIndent = currentIndentToken.text.replace(/\t/g, '    ').length;
            }
        }
        lines.push({
            tokens: currentLineTokens,
            indentToken: currentIndentToken,
            originalIndent
        });
    }

    const indentStack = [0];
    const outputLines: string[] = [];

    let blankLinesCount = 0;
    let previousLineWasDecorator = false;

    // Nesting levels persisting across lines
    let parenLevel = 0;
    let bracketLevel = 0;
    let braceLevel = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.tokens.length === 0 && !line.indentToken) {
            blankLinesCount++;
            continue;
        }

        let currentIndent = line.originalIndent;

        const prevLine = i > 0 ? lines[i-1] : null;
        let lastContentLine = prevLine;
        let k = i - 1;
        while (lastContentLine && lastContentLine.tokens.length === 0) {
            k--;
            lastContentLine = k >= 0 ? lines[k] : null;
        }

        const prevLineLastToken = lastContentLine && lastContentLine.tokens.length > 0 ? lastContentLine.tokens[lastContentLine.tokens.length - 1] : null;
        const shouldIndentColon = prevLineLastToken && prevLineLastToken.text === ':' && prevLineLastToken.type === TokenType.Punctuation;

        // Force indent if colon or inside brackets
        const nestingLevel = parenLevel + bracketLevel + braceLevel;
        const shouldIndent = shouldIndentColon || nestingLevel > 0;

        // Check if current line starts with closing delimiter (dedent)
        const firstToken = line.tokens[0];
        const startsWithClosing = firstToken && firstToken.type === TokenType.Punctuation && ')]}'.includes(firstToken.text);

        // If we are inside brackets but this line closes them, we might not want to force indent relative to prev line
        // Actually, if we are at level 1, and this line closes, it effectively reduces level for NEXT line.
        // But for THIS line, the closing bracket is usually indented to match opening line.
        // My stack logic handles dedent if user dedented.
        // If user didn't dedent `]`, we might keep it indented?
        // Let's rely on user indent for `]` mostly, but enforce indent for content.

        if (shouldIndent && lastContentLine && !startsWithClosing) {
             // If user indentation is <= previous, we assume they missed indent
             if (currentIndent <= lastContentLine.originalIndent) {
                 currentIndent = lastContentLine.originalIndent + 4;
             }
        }

        // Adjust stack based on input indentation
        if (currentIndent > indentStack[indentStack.length - 1]) {
            indentStack.push(currentIndent);
        } else if (currentIndent < indentStack[indentStack.length - 1]) {
            while (indentStack.length > 1 && currentIndent < indentStack[indentStack.length - 1]) {
                indentStack.pop();
            }
        }

        const level = indentStack.length - 1;
        const indentString = '    '.repeat(level);

        const isTopLevel = level === 0;
        const isDef = firstToken && firstToken.type === TokenType.Keyword && (firstToken.text === 'def' || firstToken.text === 'async');
        const isClass = firstToken && firstToken.type === TokenType.Keyword && firstToken.text === 'class';
        const isDecorator = firstToken && firstToken.type === TokenType.Operator && firstToken.text === '@';

        const isMethod = level > 0 && isDef;

        let requiredBlankLines = 0;
        if (isTopLevel && (isDef || isClass)) {
            requiredBlankLines = 2;
        } else if (isMethod) {
            requiredBlankLines = 1;
        }

        if (isDecorator) {
             if (isTopLevel) requiredBlankLines = 2;
             else if (level > 0) requiredBlankLines = 1;
        }

        if (previousLineWasDecorator) {
            requiredBlankLines = 0;
        }

        if (outputLines.length > 0) {
            const linesToPrint = Math.min(Math.max(requiredBlankLines, blankLinesCount), 2);
            for (let k = 0; k < linesToPrint; k++) {
                outputLines.push('');
            }
        }
        blankLinesCount = 0;
        previousLineWasDecorator = isDecorator || false;

        let formattedLine = indentString;

        for (let j = 0; j < line.tokens.length; j++) {
            const token = line.tokens[j];
            const nextToken = line.tokens[j + 1];
            const prevToken = line.tokens[j - 1];

            if (token.text === '(') parenLevel++;
            if (token.text === '[') bracketLevel++;
            if (token.text === '{') braceLevel++;

            formattedLine += token.text;

            if (token.text === ')') parenLevel--;
            if (token.text === ']') bracketLevel--;
            if (token.text === '}') braceLevel--;

            if (!nextToken) continue;

            let needSpace = false;

            // 1. Operators
            if (token.type === TokenType.Operator) {
                const isUnary = prevToken && (
                    prevToken.type === TokenType.Operator ||
                    prevToken.type === TokenType.Keyword ||
                    (prevToken.type === TokenType.Punctuation && !')]'.includes(prevToken.text))
                );

                if (isUnary) {
                    needSpace = false;
                } else {
                    if (token.text === '=' && parenLevel > 0) {
                        needSpace = false;
                    } else if (token.text === '@') {
                        if (j === 0) needSpace = false;
                        else needSpace = true;
                    } else {
                        needSpace = true;
                    }
                }
            }

            // 2. Punctuation
            else if (token.type === TokenType.Punctuation) {
                if (token.text === ',') {
                    needSpace = true;
                } else if (token.text === ':') {
                    if (bracketLevel > 0) {
                        needSpace = false;
                    } else {
                        needSpace = true;
                    }
                }
            }

            // 3. Keywords
            else if (token.type === TokenType.Keyword) {
                if (nextToken.type === TokenType.Punctuation && ':;,)]}'.includes(nextToken.text)) {
                    needSpace = false;
                } else {
                    needSpace = true;
                }
            }

            // 4. Identifier / Number / String
            else if (token.type === TokenType.Identifier || token.type === TokenType.Number || token.type === TokenType.String) {
                if (nextToken.type === TokenType.Operator) {
                    needSpace = true;

                    if (nextToken.text === ':' && bracketLevel > 0) needSpace = false;
                    if (nextToken.text === '=' && parenLevel > 0) needSpace = false;
                }
                else if (nextToken.type === TokenType.Identifier || nextToken.type === TokenType.Keyword || nextToken.type === TokenType.Number) {
                    needSpace = true;
                }
            }

            // Comment
            if (nextToken.type === TokenType.Comment) {
                formattedLine += '  ';
                continue;
            }

            if (needSpace) {
                formattedLine += ' ';
            }
        }

        outputLines.push(formattedLine);
    }

    if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== '') {
        outputLines.push('');
    }

    return outputLines.join('\n');
}
