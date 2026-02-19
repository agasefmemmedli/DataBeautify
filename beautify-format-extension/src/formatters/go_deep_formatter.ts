import { GoTokenizer, Token, TokenType } from './go_tokenizer';

export function formatGoDeep(text: string): string {
    const tokenizer = new GoTokenizer(text);
    const tokens = tokenizer.tokenize();

    // Group tokens into lines, preserving comments and logic
    const lines: Token[][] = [];
    let currentLine: Token[] = [];

    for (const token of tokens) {
        if (token.type === TokenType.Newline) {
            if (currentLine.length > 0) {
                lines.push(currentLine);
            } else {
                 lines.push([]);
            }
            currentLine = [];
        } else if (token.type === TokenType.Whitespace) {
            // Ignore horizontal whitespace
        } else {
            currentLine.push(token);
        }
    }
    if (currentLine.length > 0) {
        lines.push(currentLine);
    }

    // Import Sorting (Basic)
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check for "import (" or "import (" comment
        // Simplify: first token import, last token (
        if (line.length > 0 && line[0].text === 'import') {
            let hasOpenParen = false;
            for (const t of line) { if (t.text === '(') hasOpenParen = true; }

            if (hasOpenParen) {
                // Find closing parenthesis line
                let j = i + 1;
                while (j < lines.length) {
                    const l = lines[j];
                    if (l.length > 0 && l[0].text === ')') break;
                    j++;
                }

                if (j < lines.length) {
                    // Sort lines inside [i+1, j)
                    // We sort groups separated by empty lines independently?
                    // gofmt sorts within groups.
                    // For simplicity, let's just sort the whole block if no empty lines, or preserve groups.

                    let groupStart = i + 1;
                    for (let k = i + 1; k <= j; k++) { // iterate to j (exclusive of sort, but check for empty)
                        if (k === j || lines[k].length === 0) {
                            if (k > groupStart) {
                                // Sort [groupStart, k)
                                const group = lines.slice(groupStart, k);
                                group.sort((a, b) => {
                                    const textA = a.map(t => t.text).join('');
                                    const textB = b.map(t => t.text).join('');
                                    return textA.localeCompare(textB);
                                });
                                // Replace in lines
                                for (let m = 0; m < group.length; m++) {
                                    lines[groupStart + m] = group[m];
                                }
                            }
                            groupStart = k + 1;
                        }
                    }
                }
            }
        }
    }

    const outputLines: string[] = [];
    let indentLevel = 0;
    let extraIndent = 0;
    const indentChar = '\t';

    for (let i = 0; i < lines.length; i++) {
        const lineTokens = lines[i];

        if (lineTokens.length === 0) {
            if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== '') {
                outputLines.push('');
            }
            continue;
        }

        const first = lineTokens[0];

        let lineDedent = 0;
        let startsWithClosing = false;

        if (first.type === TokenType.Punctuation && (first.text === '}' || first.text === ')')) {
            startsWithClosing = true;
            lineDedent = 1;
        }

        const isCaseOrDefault = first.type === TokenType.Keyword && (first.text === 'case' || first.text === 'default');

        if (isCaseOrDefault) {
             extraIndent = 0;
        }

        if (startsWithClosing) {
             extraIndent = 0;
        }

        let printLevel = indentLevel;
        if (startsWithClosing) {
            printLevel = Math.max(0, indentLevel - 1);
        }

        if (!isCaseOrDefault && !startsWithClosing) {
            printLevel += extraIndent;
        }

        let formattedLine = indentChar.repeat(printLevel);

        for (let j = 0; j < lineTokens.length; j++) {
            const token = lineTokens[j];
            const nextToken = lineTokens[j + 1];
            const prevToken = lineTokens[j - 1];

            formattedLine += token.text;

            if (!nextToken) continue;

            let needSpace = false;

            if (token.type === TokenType.Operator) {
                const isUnary = !prevToken ||
                    (prevToken.type === TokenType.Operator) ||
                    (prevToken.type === TokenType.Keyword && !['return', 'break', 'continue', 'fallthrough'].includes(prevToken.text)) ||
                    (prevToken.type === TokenType.Punctuation && !')]'.includes(prevToken.text));

                if (isUnary) {
                    if (token.text === '<-') needSpace = false;
                    else needSpace = false;
                } else {
                    if (token.text === '.') needSpace = false;
                    else if (token.text === '(') needSpace = false;
                    else needSpace = true;
                }
            }
            else if (token.type === TokenType.Punctuation) {
                if (token.text === ',') needSpace = true;
                else if (token.text === ':') needSpace = true;
                else if (token.text === ';') needSpace = true;
                else if (token.text === ')') {
                    if (nextToken.text === '{') needSpace = true;
                    else if (nextToken.type === TokenType.Identifier) needSpace = true;
                    else if (nextToken.type === TokenType.Operator && !'.(['.includes(nextToken.text)) needSpace = true;
                    else needSpace = false;
                } else if (token.text === ']') {
                    if (nextToken.type === TokenType.Operator && !'.(['.includes(nextToken.text)) needSpace = true;
                    else needSpace = false;
                } else if (token.text === '}') {
                    if (nextToken.text === 'else') needSpace = true;
                }
            }
            else if (token.type === TokenType.Keyword) {
                if (nextToken.type === TokenType.Punctuation && '(:;,)'.includes(nextToken.text)) needSpace = false;
                else if (nextToken.text === ':') needSpace = false;
                else needSpace = true;
            }
            else {
                if (nextToken.type === TokenType.Operator) {
                     if ('.(['.includes(nextToken.text)) needSpace = false;
                     else if (nextToken.text === ':') needSpace = false;
                     else needSpace = true;
                } else if (nextToken.type === TokenType.Punctuation) {
                    if ('.,:;)'.includes(nextToken.text)) needSpace = false;
                    else if (nextToken.text === '{') needSpace = true;
                    else if (nextToken.text === '[') needSpace = false;
                    else if (nextToken.text === '(') needSpace = false;
                } else if (nextToken.type === TokenType.Keyword) {
                    needSpace = true;
                } else {
                    needSpace = true;
                }
            }

            if (token.text === '(' || token.text === '[') needSpace = false;

            if (token.text === 'func' && nextToken.text === '(') needSpace = false;
            if (token.text === 'if' || token.text === 'for' || token.text === 'switch') needSpace = true;

            if (nextToken.type === TokenType.Comment) {
                formattedLine += '  ';
                continue;
            }

            if (nextToken.text === ';' || nextToken.text === ',') needSpace = false;

            if (needSpace) {
                formattedLine += ' ';
            }
        }

        outputLines.push(formattedLine);

        for (const token of lineTokens) {
            if (token.type === TokenType.Punctuation) {
                if (token.text === '{') indentLevel++;
                if (token.text === '}') indentLevel--;
                if (token.text === '(') indentLevel++;
                if (token.text === ')') indentLevel--;
            }
        }

        if (isCaseOrDefault) {
            extraIndent = 1;
        }

        if (indentLevel < 0) indentLevel = 0;
    }

    return outputLines.join('\n');
}
