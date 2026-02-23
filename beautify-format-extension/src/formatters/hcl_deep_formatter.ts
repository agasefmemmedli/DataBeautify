import { HCLTokenizer, Token, TokenType } from './hcl_tokenizer';

export function formatHCLDeep(text: string): string {
    const tokenizer = new HCLTokenizer(text);
    const tokens = tokenizer.tokenize();

    // 1. Group tokens into lines
    const lines: Token[][] = [];
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
        if (first.type === TokenType.Punctuation && (first.text === '}' || first.text === ']')) {
            dedent = 1;
        }

        // Handle heredoc content (preserve as is, no indent)
        // Note: Tokenizer outputs heredoc block as one token?
        // My tokenizer implemented `readHeredoc` which returns the whole block as one token including newlines?
        // Wait, `tokenize` splits by char. `readHeredoc` returns a string.
        // But `tokenize` pushes it as ONE token.
        // If it contains newlines, my grouping logic above `token.type === TokenType.Newline` handles explicit newlines.
        // BUT `readHeredoc` consumes text including newlines.
        // So the token.text contains newlines.
        // This means `lines` array logic might put a huge heredoc in one line if I'm not careful.
        // However, `Token` definition assumes it fits in the stream.
        // If a token contains `\n`, it will be rendered as such.
        // But `formatHCLDeep` logic iterates `lines` and applies indentation.
        // A heredoc token should probably be printed with its internal structure.
        // AND indentation should be handled carefully.
        // Terraform heredocs: `<<-EOF` strips indentation, `<<EOF` does not?
        // Actually, `terraform fmt` usually indent the `<<` line, but the content?
        // Let's assume the Token text preserves the content format.

        const level = Math.max(0, indentLevel - dedent);

        // Construct line text
        let lineText = '';
        for (let j = 0; j < line.length; j++) {
            const token = line[j];

            // Special handling for heredoc token: it might contain newlines
            if (token.type === TokenType.Heredoc) {
                // If it's a heredoc, it includes the delimiters.
                // We should just append it.
                // BUT, if we want to indent the start line, we do that via `indent`.
                // The internal lines of heredoc?
                // `readHeredoc` captured everything.
                lineText += token.text;
            } else {
                lineText += token.text;
            }

            if (j < line.length - 1) {
                const next = line[j+1];
                if (shouldSpace(token, next)) {
                    lineText += ' ';
                }
            }
        }

        formattedLines.push({ indent: level, tokens: line, text: lineText });

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
        if (line.text === '') {
            if (groupStart !== -1) {
                alignGroup(formattedLines, groupStart, i);
                groupStart = -1;
            }
            continue;
        }

        const isAssignment = isTopLevelAssignment(line.tokens);
        // Also ensure we don't align across different indent levels
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
        // If line is just a heredoc (multiline), we might need care?
        // But heredoc token usually starts with `<<EOF`.
        // The indentation applies to the `<<` line.
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

    // Find max LHS length
    let maxLhs = 0;
    const entries: { lhs: string, rhs: string, index: number }[] = [];

    for (let i = start; i < end; i++) {
        const line = lines[i];
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

            maxLhs = Math.max(maxLhs, lhs.length);
            entries.push({ lhs, rhs, index: i });
        }
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
