import { HCLTokenizer, Token, TokenType } from './hcl_tokenizer';

export function formatHCLDeep(text: string): string {
    const tokenizer = new HCLTokenizer(text);
    const tokens = tokenizer.tokenize();

    // 1. Group tokens into lines
    let lines: Token[][] = [];
    let currentLine: Token[] = [];

    for (const token of tokens) {
        if (token.type === TokenType.Newline) {
            lines.push(currentLine);
            currentLine = [];
        } else if (token.type === TokenType.Whitespace) {
            // Ignore existing whitespace
        } else {
            currentLine.push(token);
        }
    }
    if (currentLine.length > 0) {
        lines.push(currentLine);
    }

    // 1.5. Merge lines ending with { or starting with {
    // If a line starts with `{` and previous line is not empty/comment/brace, merge.
    const mergedLines: Token[][] = [];
    if (lines.length > 0) {
        mergedLines.push(lines[0]);
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const prevLine = mergedLines[mergedLines.length - 1];

            // Check if line starts with {
            if (line.length > 0 && line[0].text === '{') {
                // Check if previous line is eligible for merge
                // Not eligible if it ends with { (already open block) or if it's a comment
                if (prevLine.length > 0) {
                    const lastToken = prevLine[prevLine.length - 1];
                    if (lastToken.text !== '{' && lastToken.type !== TokenType.Comment) {
                        // Merge!
                        prevLine.push(...line);
                        continue;
                    }
                }
            }
            mergedLines.push(line);
        }
        lines = mergedLines;
    }

    // 2. Format Line Content & Indentation
    const formattedLines: { indent: number, tokens: Token[], text: string }[] = [];
    let indentLevel = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.length === 0) {
            formattedLines.push({ indent: 0, tokens: [], text: '' });
            continue;
        }

        // Deduce if dedent needed
        let dedent = 0;
        const first = line[0];
        if (first.type === TokenType.Punctuation && (first.text === '}' || first.text === ']' || first.text === ')')) {
            dedent = 1;
        }

        const level = Math.max(0, indentLevel - dedent);

        // Check for Heredoc token
        const heredocIdx = line.findIndex(t => t.type === TokenType.Heredoc);

        if (heredocIdx !== -1) {
            // Process line up to heredoc
            let preHeredocText = '';
            for(let j=0; j<heredocIdx; j++) {
                const t = line[j];
                preHeredocText += t.text;
                if (j < heredocIdx - 1 && shouldSpace(t, line[j+1])) preHeredocText += ' ';
                else if (j === heredocIdx - 1 && shouldSpace(t, line[heredocIdx])) preHeredocText += ' ';
            }

            const heredocToken = line[heredocIdx];
            // Split heredoc text
            // Detect type: << or <<-
            const isIndented = heredocToken.text.startsWith('<<-');
            const linesInHeredoc = heredocToken.text.split('\n');

            // Construct the first line
            let firstLineText = preHeredocText + linesInHeredoc[0];

            // Create modified tokens for the first line (truncate heredoc token)
            const modifiedLineTokens = [...line];
            modifiedLineTokens[heredocIdx] = {
                ...heredocToken,
                text: linesInHeredoc[0]
            };

            formattedLines.push({ indent: level, tokens: modifiedLineTokens, text: firstLineText });

            // Handle subsequent lines of heredoc
            for (let k = 1; k < linesInHeredoc.length; k++) {
                let content = linesInHeredoc[k];
                // Indentation logic
                const isLast = k === linesInHeredoc.length - 1;

                if (isIndented) {
                    content = content.trimStart();
                    let contentIndent = level + 1;
                    if (isLast) contentIndent = level; // closing delimiter aligned with block

                    formattedLines.push({ indent: contentIndent, tokens: [], text: content });
                } else {
                    // <<: preserve content exactly. Indent should be 0.
                    formattedLines.push({ indent: 0, tokens: [], text: content });
                }
            }
        } else {
            // Standard line processing
            let lineText = '';
            for (let j = 0; j < line.length; j++) {
                const token = line[j];
                lineText += token.text;

                if (j < line.length - 1) {
                    const next = line[j+1];
                    if (shouldSpace(token, next)) {
                        lineText += ' ';
                    }
                }
            }
            formattedLines.push({ indent: level, tokens: line, text: lineText });
        }

        // Update Indent
        for (const t of line) {
            if (t.text === '{' || t.text === '[' || t.text === '(') indentLevel++;
            if (t.text === '}' || t.text === ']' || t.text === ')') indentLevel--;
        }
    }

    // 3. Alignment Logic
    // Scan for consecutive assignment lines in the same block/indentation
    let groupStart = -1;
    for (let i = 0; i < formattedLines.length; i++) {
        const line = formattedLines[i];

        // Skip heredoc content lines (empty tokens array) or empty text
        if (line.tokens.length === 0 && line.text !== '') {
            if (groupStart !== -1) {
                alignGroup(formattedLines, groupStart, i);
                groupStart = -1;
            }
            continue;
        }

        if (line.text === '') {
            if (groupStart !== -1) {
                alignGroup(formattedLines, groupStart, i);
                groupStart = -1;
            }
            continue;
        }

        // Check for comment-only line
        const isComment = line.tokens.length > 0 && line.tokens[0].type === TokenType.Comment;
        if (isComment) {
            continue;
        }

        const isAssignment = isTopLevelAssignment(line.tokens);

        if (isAssignment) {
            if (groupStart === -1) {
                groupStart = i;
            } else {
                if (formattedLines[i].indent !== formattedLines[groupStart].indent) {
                    alignGroup(formattedLines, groupStart, i);
                    groupStart = i;
                }
            }
        } else {
            if (groupStart !== -1) {
                alignGroup(formattedLines, groupStart, i);
                groupStart = -1;
            }
        }
    }
    if (groupStart !== -1) {
        alignGroup(formattedLines, groupStart, formattedLines.length);
    }

    // 4. Final Render
    return formattedLines.map(l => {
        if (l.text === '') return '';
        return '  '.repeat(l.indent) + l.text;
    }).join('\n');
}

function isTopLevelAssignment(tokens: Token[]): boolean {
    let depth = 0;
    for (const t of tokens) {
        if ('{[('.includes(t.text)) depth++;
        else if ('}])'.includes(t.text)) depth--;
        else if (depth === 0 && t.text === '=') return true;
    }
    return false;
}

function alignGroup(lines: { indent: number, tokens: Token[], text: string }[], start: number, end: number) {
    if (end - start < 2) return;

    // Filter valid assignment lines in range
    const entries: { lhs: string, rhs: string, index: number }[] = [];

    for (let i = start; i < end; i++) {
        const line = lines[i];
        if (line.tokens.length === 0) continue; // Skip heredoc content/empty

        // Skip comments in alignment calculation
        if (line.tokens[0].type === TokenType.Comment) continue;

        // Split at first top-level =
        let eqIdx = -1;
        let depth = 0;
        for (let j = 0; j < line.tokens.length; j++) {
            const t = line.tokens[j];
            if ('{[('.includes(t.text)) depth++;
            else if ('}])'.includes(t.text)) depth--;
            else if (depth === 0 && t.text === '=') {
                eqIdx = j;
                break;
            }
        }

        if (eqIdx !== -1) {
            const lhsTokens = line.tokens.slice(0, eqIdx);
            const rhsTokens = line.tokens.slice(eqIdx + 1);

            const lhs = joinTokens(lhsTokens);
            const rhs = joinTokens(rhsTokens);

            entries.push({ lhs, rhs, index: i });
        }
    }

    if (entries.length < 2) return; // Need at least 2 to align

    // Find max LHS length
    let maxLhs = 0;
    for (const entry of entries) {
        if (entry.lhs.length > maxLhs) maxLhs = entry.lhs.length;
    }

    // Apply
    for (const entry of entries) {
        const padding = ' '.repeat(maxLhs - entry.lhs.length);
        lines[entry.index].text = `${entry.lhs}${padding} = ${entry.rhs}`;
    }
}

function joinTokens(tokens: Token[]): string {
    let s = '';
    for (let i = 0; i < tokens.length; i++) {
        s += tokens[i].text;
        if (i < tokens.length - 1) {
            if (shouldSpace(tokens[i], tokens[i+1])) {
                s += ' ';
            }
        }
    }
    return s;
}

function shouldSpace(prev: Token, curr: Token): boolean {
    // No space inside brackets/parens/accessors
    if (prev.text === '.' || curr.text === '.') return false;
    if (prev.text === '[' || curr.text === ']') return false;
    if (prev.text === '(' || curr.text === ')') return false;

    // Function calls: func( -> no space
    if (prev.type === TokenType.Identifier && curr.text === '(') return false;

    // Array access: arr[ -> no space
    if (prev.type === TokenType.Identifier && curr.text === '[') return false;
    if (prev.text === ']' && curr.text === '[') return false; // arr[0][1]

    // Comma always space after
    if (prev.text === ',') return true;
    if (curr.text === ',') return false;

    return true;
}
