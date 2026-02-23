import { GoTokenizer, Token, TokenType } from './go_tokenizer';

export function formatGoDeep(text: string): string {
    const tokenizer = new GoTokenizer(text);
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

    // 2. Sort Imports
    sortImports(lines);

    // 3. Apply Standard Spacing
    applySpacing(lines);

    // 4. Align Blocks
    alignBlocks(lines);

    // 5. Render
    const outputLines: string[] = [];
    let indentLevel = 0;
    const indentChar = '\t';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.length === 0) {
            if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== '') {
                outputLines.push('');
            }
            continue;
        }

        // Calculate Indentation
        let lineDedent = 0;

        let firstContentIdx = 0;
        while (firstContentIdx < line.length && line[firstContentIdx].type === TokenType.Whitespace) {
            firstContentIdx++;
        }
        const first = line[firstContentIdx];

        if (first) {
            if (first.type === TokenType.Punctuation && (first.text === '}' || first.text === ')')) {
                lineDedent = 1;
            }
            if (first.type === TokenType.Keyword && (first.text === 'case' || first.text === 'default')) {
                lineDedent = 1;
            }
        }

        const level = Math.max(0, indentLevel - lineDedent);
        let formattedLine = indentChar.repeat(level);

        for (const token of line) {
            formattedLine += token.text;
        }
        outputLines.push(formattedLine);

        // Update Indent
        for (const token of line) {
            if (token.type === TokenType.Punctuation) {
                if (token.text === '{' || token.text === '(') indentLevel++;
                if (token.text === '}' || token.text === ')') indentLevel--;
            }
        }
        if (indentLevel < 0) indentLevel = 0;
    }

    return outputLines.join('\n');
}

// --- Spacing Logic ---

function applySpacing(lines: Token[][]) {
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.length < 2) continue;

        const newLine: Token[] = [line[0]];

        for (let j = 1; j < line.length; j++) {
            const prev = line[j - 1];
            const curr = line[j];

            let needSpace = false;

            // 1. Comma, Semicolon
            if (curr.text === ',' || curr.text === ';') {
                needSpace = false;
            } else if (prev.text === ',' || prev.text === ';') {
                needSpace = true;
            }

            // 2. Keywords
            else if ((prev.type as any) === TokenType.Keyword) {
                if (prev.text === 'func' && curr.text === '(') {
                    // Space for method receivers (func at start of line), no space for anonymous functions
                    if (prev === line[0]) needSpace = true;
                    else needSpace = false;
                }
                else if (prev.text === 'import' && curr.text === '(') needSpace = true;
                else if (curr.type === TokenType.Punctuation && ':;,)'.includes(curr.text)) needSpace = false;
                else if (curr.text === '(' || curr.text === '[') needSpace = true;
                else needSpace = true;
            }
            else if ((curr.type as any) === TokenType.Keyword) {
                if (prev.text === '(' || prev.text === '[') needSpace = false;
                else needSpace = true;
            }

            // 3. Operators
            else if ((curr.type as any) === TokenType.Operator) {
                if ('.(['.includes(curr.text)) needSpace = false;
                else if (curr.text === ':') needSpace = false;
                else if (curr.text === '++' || curr.text === '--') needSpace = false;
                else if (curr.text === '!') needSpace = false;
                else if (curr.text === '*' || curr.text === '&' || curr.text === '<-') {
                    if (isUnaryContext(prev)) needSpace = false;
                    else needSpace = true;
                }
                else needSpace = true;
            }
            else if ((prev.type as any) === TokenType.Operator) {
                if ('.(['.includes(prev.text)) needSpace = false;
                else if (prev.text === '!' || prev.text === '++' || prev.text === '--') needSpace = false;
                else if (prev.text === '*' || prev.text === '&') {
                    if (isUnaryContextToken(line, j - 2)) needSpace = false;
                    else needSpace = true;
                }
                else if (prev.text === '<-') needSpace = false;
                else needSpace = true;
            }

            // 4. Brackets / Braces
            else if (curr.text === '{') {
                if ((prev.type as any) === TokenType.Identifier) {
                    if (isSpaceBeforeBlockLine(line)) needSpace = true;
                    else needSpace = false; // Person{
                }
                else if (prev.text === ')') needSpace = true;
                else if ((prev.type as any) === TokenType.Keyword) needSpace = true;
                else if (prev.text === ']') needSpace = false;
                else needSpace = true;
            }
            else if (curr.text === '}') {
                if (prev.text === '{') needSpace = false;
            }
            else if (prev.text === '}') {
                if (curr.text === 'else') needSpace = true;
                else if (curr.text === ',') needSpace = false;
                else needSpace = true;
            }

            else if (curr.text === '(' || curr.text === '[') {
                if ((prev.type as any) === TokenType.Identifier) {
                    if (isSpaceBeforeParenLine(line)) needSpace = true; // if (
                    else needSpace = false; // func(
                }
                else if (prev.text === ']') needSpace = false;
                else if ((prev.type as any) === TokenType.Keyword) {
                    if (['func', 'return', 'if', 'for', 'switch'].includes(prev.text)) needSpace = true;
                    else needSpace = true;
                }
                else needSpace = false;
            }
            else if (prev.text === ')' || prev.text === ']') {
                if (curr.text === '.' || curr.text === '(' || curr.text === '[') needSpace = false;
                else needSpace = true;
            }

            // 5. Identifiers / Literals
            else if ((prev.type as any) === TokenType.Identifier || (prev.type as any) === TokenType.Number || (prev.type as any) === TokenType.String) {
                 if ((curr.type as any) === TokenType.Identifier || (curr.type as any) === TokenType.Number || (curr.type as any) === TokenType.String) {
                     needSpace = true;
                 }
            }

            // Comment
            if (curr.type === TokenType.Comment) needSpace = true;

            // Apply
            if (needSpace) {
                newLine.push({ type: TokenType.Whitespace, text: ' ', line: 0, col: 0 });
            }
            newLine.push(curr);
        }
        lines[i] = newLine;
    }
}

function isUnaryContext(prev: Token): boolean {
    if (prev.type === TokenType.Operator) return true;
    if (prev.type === TokenType.Keyword && ['return', 'if', 'for', 'switch', 'case', 'go', 'defer', 'range'].includes(prev.text)) return true;
    if (prev.type === TokenType.Punctuation && '(:,{['.includes(prev.text)) return true;
    return false;
}

function isUnaryContextToken(line: Token[], idx: number): boolean {
    if (idx < 0) return true;
    return isUnaryContext(line[idx]);
}

function isSpaceBeforeBlockLine(line: Token[]): boolean {
    if (line.length === 0) return false;
    const first = line[0].text;
    return ['if', 'for', 'switch', 'select', 'case', 'default', 'else', 'func'].includes(first);
}

function isSpaceBeforeParenLine(line: Token[]): boolean {
    if (line.length === 0) return false;
    const first = line[0].text;
    // Exclude 'func'
    return ['if', 'for', 'switch', 'select', 'case', 'default', 'else'].includes(first);
}

// --- Alignment Logic ---

function alignBlocks(lines: Token[][]) {
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        const relevant = line.filter(t => t.type !== TokenType.Whitespace && t.type !== TokenType.Comment);
        if (relevant.length === 0) continue;
        const last = relevant[relevant.length - 1];

        if (last.text === '{' || last.text === '(') {
            let isStruct = false;
            let isInterface = false;
            let isVarConst = false;
            let isLiteral = false;
            let isImport = false;

            if (last.text === '{') {
                if (relevant.some(t => t.text === 'struct')) isStruct = true;
                else if (relevant.some(t => t.text === 'interface')) isInterface = true;
                else {
                    if (relevant.length >= 2) {
                        const prev = relevant[relevant.length - 2];
                        if (prev.type === TokenType.Identifier || prev.text === ']') isLiteral = true;
                    }
                }
            } else if (last.text === '(') {
                if (relevant.length >= 1) {
                    const first = relevant[0].text;
                    if (['const', 'var', 'type'].includes(first)) isVarConst = true;
                    else if (first === 'import') isImport = true;
                }
            }

            if (isStruct || isInterface || isVarConst || isLiteral || isImport) {
                const opener = last.text;
                const closer = opener === '{' ? '}' : ')';

                let j = i + 1;
                let balance = 1;
                while (j < lines.length) {
                    const l = lines[j];
                    for (const t of l) {
                        if (t.text === opener) balance++;
                        if (t.text === closer) balance--;
                    }
                    if (balance === 0) break;
                    j++;
                }

                if (j < lines.length) {
                    alignRegion(lines, i + 1, j, isStruct, isInterface, isVarConst, isLiteral, isImport);
                    i = j;
                }
            }
        }
    }
}

function alignRegion(lines: Token[][], start: number, end: number, isStruct: boolean, isInterface: boolean, isVarConst: boolean, isLiteral: boolean, isImport: boolean) {
    interface Row {
        lineIdx: number;
        cols: Token[][];
    }
    const rows: Row[] = [];

    for (let k = start; k < end; k++) {
        const line = lines[k];
        const contentTokens = line.filter(t => t.type !== TokenType.Whitespace && t.type !== TokenType.Comment);
        if (contentTokens.length === 0) continue;

        const cols: Token[][] = [];

        if (isImport) {
            if (contentTokens.length >= 2) {
                cols.push([contentTokens[0]]); // Alias
                cols.push(contentTokens.slice(1)); // Path
            } else if (contentTokens.length === 1) {
                cols.push([]); // Empty alias
                cols.push(contentTokens); // Path
            }
        }
        else if (isStruct) {
            let tagToken: Token | null = null;
            if (contentTokens.length > 0) {
                const lastT = contentTokens[contentTokens.length - 1];
                if (lastT.type === TokenType.String && lastT.text.startsWith('`')) {
                    tagToken = lastT;
                    contentTokens.pop();
                }
            }
            if (contentTokens.length === 0 && tagToken) {
                cols.push([]); cols.push([]);
            } else if (contentTokens[0].text === '*' || contentTokens.length === 1) {
                cols.push(contentTokens);
                cols.push([]);
            } else {
                cols.push([contentTokens[0]]);
                cols.push(contentTokens.slice(1));
            }
            if (tagToken) cols.push([tagToken]);
        }
        else if (isInterface) {
            // Find )
            // Name(Args) ... Return
            // Identifier ... )
            let parenEndIdx = -1;
            let balance = 0;
            for(let m=0; m<contentTokens.length; m++) {
                if (contentTokens[m].text === '(') balance++;
                if (contentTokens[m].text === ')') {
                    balance--;
                    if (balance === 0) {
                        parenEndIdx = m;
                        break;
                    }
                }
            }

            if (parenEndIdx !== -1) {
                cols.push(contentTokens.slice(0, parenEndIdx + 1)); // Name(Args)
                cols.push(contentTokens.slice(parenEndIdx + 1)); // Return
            } else {
                // Fallback (Embedded interface?)
                cols.push(contentTokens);
            }
        }
        else if (isLiteral) {
            const colonIdx = contentTokens.findIndex(t => t.text === ':');
            if (colonIdx !== -1) {
                cols.push(contentTokens.slice(0, colonIdx + 1));
                cols.push(contentTokens.slice(colonIdx + 1));
            } else {
                cols.push(contentTokens);
            }
        }
        else if (isVarConst) {
            if (contentTokens.length >= 1) {
                cols.push([contentTokens[0]]);
                cols.push(contentTokens.slice(1));
            }
        }
        // Prune empty trailing columns
        while (cols.length > 0 && cols[cols.length - 1].length === 0) {
            cols.pop();
        }

        rows.push({ lineIdx: k, cols });
    }

    rows.forEach(row => {
        const line = lines[row.lineIdx];
        const newCols: Token[][] = [];
        let lastIdx = 0;

        row.cols.forEach(colTokens => {
            if (colTokens.length === 0) {
                newCols.push([]);
                return;
            }
            const firstT = colTokens[0];
            let start = -1;
            for (let m = lastIdx; m < line.length; m++) {
                if (line[m] === firstT) {
                    start = m;
                    break;
                }
            }
            if (start === -1) { newCols.push([]); return; }

            const lastT = colTokens[colTokens.length - 1];
            let end = -1;
            for (let m = start; m < line.length; m++) {
                if (line[m] === lastT) {
                    end = m + 1;
                    break;
                }
            }

            newCols.push(line.slice(start, end));
            lastIdx = end;
        });
        row.cols = newCols;
    });

    const numCols = rows.reduce((max, r) => Math.max(max, r.cols.length), 0);
    const widths = new Array(numCols).fill(0);

    rows.forEach(r => {
        r.cols.forEach((col, i) => {
            const w = col.reduce((sum, t) => sum + t.text.length, 0);
            if (w > widths[i]) widths[i] = w;
        });
    });

    rows.forEach(r => {
        const line = lines[r.lineIdx];
        let newLine: Token[] = [];

        if (r.cols.length > 0) {
            let firstNonEmptyIdx = -1;
            for(let c=0; c<r.cols.length; c++) {
                if (r.cols[c].length > 0) {
                    firstNonEmptyIdx = c;
                    break;
                }
            }
            if (firstNonEmptyIdx !== -1) {
                const firstT = r.cols[firstNonEmptyIdx][0];
                const idx = line.indexOf(firstT);
                newLine.push(...line.slice(0, idx));
            } else {
                newLine = line;
            }
        }

        r.cols.forEach((col, i) => {
            newLine.push(...col);

            if (i < r.cols.length - 1) {
                const w = col.reduce((sum, t) => sum + t.text.length, 0);
                const pad = widths[i] - w;

                if (pad > 0) {
                    newLine.push({ type: TokenType.Whitespace, text: ' '.repeat(pad), line: 0, col: 0 });
                }

                // Separator space (only if column width > 0, meaning column exists in block)
                if (widths[i] > 0) {
                    newLine.push({ type: TokenType.Whitespace, text: ' ', line: 0, col: 0 });
                }
            }
        });

        const lastCol = r.cols[r.cols.length - 1];
        if (lastCol.length > 0) {
            const lastT = lastCol[lastCol.length - 1];
            const idx = line.indexOf(lastT);
            if (idx !== -1 && idx < line.length - 1) {
                newLine.push(...line.slice(idx + 1));
            }
        }

        lines[r.lineIdx] = newLine;
    });
}

function sortImports(lines: Token[][]) {
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.length > 0 && line[0].text === 'import') {
            let hasParen = false;
            for (const t of line) if (t.text === '(') hasParen = true;

            if (hasParen) {
                let j = i + 1;
                while (j < lines.length) {
                    const l = lines[j];
                    const content = l.filter(t => t.type !== TokenType.Whitespace && t.type !== TokenType.Comment);
                    if (content.length > 0 && content[0].text === ')') break;
                    j++;
                }

                if (j < lines.length) {
                    const importContent = lines.slice(i + 1, j);
                    const groups: Token[][][] = [];
                    let currentGroup: Token[][] = [];

                    for (const impLine of importContent) {
                        const hasContent = impLine.some(t => t.type !== TokenType.Whitespace && t.type !== TokenType.Comment);
                        if (!hasContent) {
                            if (currentGroup.length > 0) groups.push(currentGroup);
                            currentGroup = [];
                        } else {
                            currentGroup.push(impLine);
                        }
                    }
                    if (currentGroup.length > 0) groups.push(currentGroup);

                    for (const group of groups) {
                        group.sort((a, b) => {
                            const pathA = getImportPath(a);
                            const pathB = getImportPath(b);
                            return pathA.localeCompare(pathB);
                        });
                    }

                    let writeIdx = i + 1;
                    for (let g = 0; g < groups.length; g++) {
                        const group = groups[g];
                        for (const l of group) {
                            lines[writeIdx++] = l;
                        }
                        if (g < groups.length - 1) {
                            lines[writeIdx++] = [];
                        }
                    }
                }
            }
        }
    }
}

function getImportPath(line: Token[]): string {
    for (const t of line) {
        if (t.type === TokenType.String) return t.text;
    }
    return '';
}
