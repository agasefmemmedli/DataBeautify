import { GoTokenizer, Token, TokenType } from './go_tokenizer';

export function formatGoDeep(text: string): string {
    const tokenizer = new GoTokenizer(text);
    const tokens = tokenizer.tokenize();

    // 1. Group tokens into lines
    const lines: Token[][] = [];
    let currentLine: Token[] = [];

    for (const token of tokens) {
        if (token.type === TokenType.Newline) {
            if (currentLine.length > 0) {
                lines.push(currentLine);
            } else {
                // Preserve empty lines, but we might want to collapse multiple empty lines?
                // For now, keep them as empty arrays to signify empty lines
                lines.push([]);
            }
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
            // Empty line
            if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== '') {
                outputLines.push('');
            }
            continue;
        }

        // Calculate Indentation
        let lineDedent = 0;
        let nextIndentLevel = indentLevel;

        const first = line[0];

        // Check for dedent triggers
        if ((first.type as any) === TokenType.Punctuation && (first.text === '}' || first.text === ')')) {
            // If the line starts with closing brace, it dedents THIS line and future lines
            lineDedent = 1;
            nextIndentLevel--;
        }
        else if ((first.type as any) === TokenType.Keyword && (first.text === 'case' || first.text === 'default')) {
            // case/default are indented 1 level less than the switch block content
            // Assuming switch block increased indent
            lineDedent = 1;
        }

        // Adjust indent for the current line
        const currentLevel = Math.max(0, indentLevel - lineDedent);
        let formattedLine = indentChar.repeat(currentLevel);

        // Render tokens
        for (let j = 0; j < line.length; j++) {
            const token = line[j];

            // If it's a whitespace token we inserted during alignment/spacing, use it as is
            if (token.type === TokenType.Whitespace) {
                formattedLine += token.text;
            } else {
                formattedLine += token.text;
            }
        }
        outputLines.push(formattedLine);

        // Calculate next indent level based on braces in this line
        // We need to be careful not to double count if we already adjusted nextIndentLevel
        // But the previous logic was simple brace counting.

        // Reset and recount for robustness
        let balance = 0;
        for (const token of line) {
            if ((token.type as any) === TokenType.Punctuation) {
                if (token.text === '{' || token.text === '(') balance++;
                if (token.text === '}' || token.text === ')') balance--;
            }
        }
        indentLevel += balance;
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
                    // func main() vs func (r Receiver)
                    // If 'func' is first token, and followed by '(', it's likely a method receiver OR anonymous func?
                    // func() {} -> anonymous. func (r) Name() -> method.
                    // gofmt: func() {} (anon) - no space. func (r R) Name() (method) - space.
                    // Check if func is at start of line
                    if (prev === line[0]) {
                        // Method receiver: func (s *Struct) ...
                        needSpace = true;
                    } else {
                        // Anonymous function: x := func() ...
                        needSpace = false;
                    }
                }
                else if (prev.text === 'import' && curr.text === '(') needSpace = true;
                else if (curr.type === TokenType.Punctuation && ':;,)'.includes(curr.text)) needSpace = false;
                else if (curr.text === '(' || curr.text === '[') needSpace = true; // if ( ...
                else needSpace = true;
            }
            else if ((curr.type as any) === TokenType.Keyword) {
                if (prev.text === '(' || prev.text === '[') needSpace = false;
                else needSpace = true;
            }

            // 3. Operators
            else if ((curr.type as any) === TokenType.Operator) {
                if ('.(['.includes(curr.text)) needSpace = false;
                else if (curr.text === ':') {
                     // In struct literal: Key: Value (no space before)
                     // In switch case: case 1: (no space before)
                     needSpace = false;
                }
                else if (curr.text === '++' || curr.text === '--') needSpace = false;
                else if (curr.text === '!') needSpace = false;
                else if (curr.text === '*' || curr.text === '&' || curr.text === '<-') {
                    // Unary vs Binary
                    // *Int vs a * b
                    // &Point vs a & b
                    if (isUnaryContext(prev)) needSpace = false;
                    else needSpace = true;
                }
                else if (curr.text === '...') needSpace = false; // variadic
                else needSpace = true; // + - / % etc
            }
            else if ((prev.type as any) === TokenType.Operator) {
                if ('.(['.includes(prev.text)) needSpace = false;
                else if (prev.text === '!' || prev.text === '++' || prev.text === '--') needSpace = false;
                else if (prev.text === '*' || prev.text === '&') {
                    if (isUnaryContextToken(line, j - 2)) needSpace = false;
                    else needSpace = true;
                }
                else if (prev.text === '<-') needSpace = true; // channel receive
                else needSpace = true;
            }

            // 4. Brackets / Braces
            else if (curr.text === '{') {
                if (prev.type === TokenType.Identifier) {
                    // Struct literal? Person{...}
                    // Or Block? if x { ... }
                    if (isSpaceBeforeBlockLine(line)) needSpace = true;
                    else needSpace = false; // Person{
                }
                else if (prev.text === ')') needSpace = true; // func() {
                else if (prev.type === TokenType.Keyword) needSpace = true;
                else if (prev.text === ']') needSpace = false; // []int{
                else needSpace = true;
            }
            else if (curr.text === '}') {
                if (prev.text === '{') needSpace = false; // {}
            }
            else if (prev.text === '}') {
                if (curr.text === 'else') needSpace = true;
                else if (curr.text === ',') needSpace = false;
                else needSpace = true;
            }

            else if (curr.text === '(' || curr.text === '[') {
                if (prev.type === TokenType.Identifier) {
                     // funcCall() or Slice[
                    if (isSpaceBeforeParenLine(line)) needSpace = true; // if (
                    else needSpace = false; // func(
                }
                else if (prev.text === ']') needSpace = false; // [][]int
                else if (prev.type === TokenType.Keyword) {
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
            else if (((prev.type as any) === TokenType.Identifier || (prev.type as any) === TokenType.Number || (prev.type as any) === TokenType.String) &&
                     ((curr.type as any) === TokenType.Identifier || (curr.type as any) === TokenType.Number || (curr.type as any) === TokenType.String)) {
                 needSpace = true;
            }

            // 6. Comments
            if (curr.type === TokenType.Comment) {
                needSpace = true;
            }

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
    if (prev.type === TokenType.Keyword && ['return', 'if', 'for', 'switch', 'case', 'go', 'defer', 'range', 'else', 'var', 'const', 'type'].includes(prev.text)) return true;
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
    // Exclude 'func' (anon func call)
    return ['if', 'for', 'switch', 'select', 'case', 'default', 'else'].includes(first);
}

// --- Alignment Logic ---

function alignBlocks(lines: Token[][]) {
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.length === 0) continue;

        // Check if we are inside a block that needs alignment
        // We look for patterns like:
        // type T struct { ... }
        // const ( ... )
        // var ( ... )
        // import ( ... )

        // Or simple assignments? x := 1; y := 2 (aligned?) gofmt aligns assignments only in var/const blocks or if they are contiguous?
        // gofmt aligns consecutive assignments.

        // Let's stick to the main ones: struct, interface, const/var blocks.

        // If line ends with '{' or '('
        const last = line[line.length - 1];
        if (last.text === '{' || last.text === '(') {
             const isStruct = line.some(t => t.text === 'struct');
             const isInterface = line.some(t => t.text === 'interface');
             const isImport = line.length > 0 && line[0].text === 'import';
             const isVar = line.length > 0 && line[0].text === 'var';
             const isConst = line.length > 0 && line[0].text === 'const';

             if (isStruct || isInterface || isImport || isVar || isConst) {
                 const opener = last.text;
                 const closer = opener === '{' ? '}' : ')';

                 // Find the end of the block
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
                     // Align the region from i+1 to j
                     alignRegion(lines, i + 1, j, isStruct, isInterface, isVar, isConst, isImport);
                     i = j; // Skip processed lines
                 }
             }
        }
    }
}

function alignRegion(lines: Token[][], start: number, end: number, isStruct: boolean, isInterface: boolean, isVar: boolean, isConst: boolean, isImport: boolean) {
    interface Row {
        lineIdx: number;
        cols: Token[][];
    }
    const rows: Row[] = [];

    // 1. Identify Columns for each line
    for (let k = start; k < end; k++) {
        const line = lines[k];
        if (line.length === 0) continue; // Skip empty lines

        // Skip comments (lines starting with comment)
        if ((line[0].type as any) === TokenType.Comment) {
             // We can't align comments easily unless they are trailing.
             // For now, treat full-line comments as breaks in alignment?
             // gofmt preserves alignment across comments.
             // So we should just add them as a row with empty cols?
             // No, better to just skip them in width calculation but print them as is.
             // But we need to preserve them in `lines`.
             continue;
        }

        const cols: Token[][] = [];

        // Filter out whitespace we added previously (applySpacing) to get semantic tokens
        // But wait, applySpacing added spaces for separation.
        // We should split by semantic components.

        const meaningfulTokens = line.filter(t => (t.type as any) !== TokenType.Whitespace);

        if (isImport) {
             // Alias Path Comment
             // Alias is optional
             // "path"
             // alias "path"
             // . "path"

             let pathIdx = -1;
             for(let m=0; m<meaningfulTokens.length; m++) {
                 if ((meaningfulTokens[m].type as any) === TokenType.String) {
                     pathIdx = m;
                     break;
                 }
             }

             if (pathIdx !== -1) {
                 if (pathIdx > 0) {
                     cols.push(meaningfulTokens.slice(0, pathIdx)); // Alias
                 } else {
                     cols.push([]); // Empty alias
                 }
                 cols.push([meaningfulTokens[pathIdx]]); // Path
                 if (pathIdx + 1 < meaningfulTokens.length) {
                     cols.push(meaningfulTokens.slice(pathIdx + 1)); // Trailing comment
                 }
             }
        }
        else if (isStruct) {
            // Name Type Tag Comment
            // Name is Identifier. Type can be complex. Tag is String (raw).
            // Embedded field: Type Tag Comment (no Name)

            // Heuristic: Last string is Tag?
            let tagIdx = -1;
            const last = meaningfulTokens[meaningfulTokens.length - 1];
            if ((last.type as any) === TokenType.String && last.text.startsWith('`')) {
                tagIdx = meaningfulTokens.length - 1;
            } else if (meaningfulTokens.length >= 2 && (meaningfulTokens[meaningfulTokens.length-1].type as any) === TokenType.Comment) {
                // Check if prev is tag
                const prev = meaningfulTokens[meaningfulTokens.length - 2];
                if ((prev.type as any) === TokenType.String && prev.text.startsWith('`')) {
                    tagIdx = meaningfulTokens.length - 2;
                }
            }

            let nameTokens: Token[] = [];
            let typeTokens: Token[] = [];
            let tagTokens: Token[] = [];
            let commentTokens: Token[] = [];

            let remainder = meaningfulTokens;

            // Extract Comment
            if (remainder.length > 0 && (remainder[remainder.length-1].type as any) === TokenType.Comment) {
                commentTokens = [remainder[remainder.length-1]];
                remainder = remainder.slice(0, remainder.length-1);
            }

            // Extract Tag
            if (tagIdx !== -1) {
                // If comment exists, tag is last of remainder
                tagTokens = [remainder[remainder.length-1]];
                remainder = remainder.slice(0, remainder.length-1);
            }

            // Remainder is Name Type OR Type (Embedded)
            if (remainder.length > 0) {
                 // Check if it's embedded (Star? Identifier?)
                 // If first is identifier, and there are more tokens, likely Name Type.
                 // Unless it is just "Identifier" (Embedded).

                 // Standard Field: Name Type
                 // Embedded: Type
                 // Embedded *Type

                 if (remainder.length === 1) {
                     // Embedded
                     typeTokens = remainder;
                 } else if (remainder[0].text === '*') {
                     // Embedded pointer
                     typeTokens = remainder;
                 } else {
                     // Likely Name Type
                     // But could be "pkg.Type" (Embedded)
                     // If 2nd token is '.', it's embedded pkg.Type
                     if (remainder.length >= 2 && remainder[1].text === '.') {
                         typeTokens = remainder;
                     } else {
                         nameTokens = [remainder[0]];
                         typeTokens = remainder.slice(1);
                     }
                 }
            }

            cols.push(nameTokens);
            cols.push(typeTokens);
            cols.push(tagTokens);
            cols.push(commentTokens);
        }
        else if (isInterface) {
             // Name(Args) Ret Comment
             // Or Interface (Embedded)

             // Find Argument List (...)
             // If first token is Identifier and followed by '(', it's a method.
             let openParenIdx = -1;
             for(let m=0; m<meaningfulTokens.length; m++) {
                 if (meaningfulTokens[m].text === '(') {
                     openParenIdx = m;
                     break;
                 }
             }

             if (openParenIdx !== -1 && openParenIdx > 0 && meaningfulTokens[0].type === TokenType.Identifier) {
                 // Method: Name (Args) Ret
                 const name = [meaningfulTokens[0]];

                 // Find end of args
                 let closeParenIdx = -1;
                 let balance = 0;
                 for(let m=openParenIdx; m<meaningfulTokens.length; m++) {
                     if (meaningfulTokens[m].text === '(') balance++;
                     if (meaningfulTokens[m].text === ')') {
                         balance--;
                         if (balance === 0) {
                             closeParenIdx = m;
                             break;
                         }
                     }
                 }

                 const args = meaningfulTokens.slice(1, closeParenIdx + 1); // include parens
                 const ret = meaningfulTokens.slice(closeParenIdx + 1);

                 // Combine Name and Args for the first column?
                 // gofmt: Name(Args)   Ret
                 // So Col 1: Name(Args), Col 2: Ret
                 cols.push([...name, ...args]);
                 cols.push(ret);
             } else {
                 // Embedded interface
                 cols.push(meaningfulTokens);
             }
        }
        else if (isVar || isConst) {
            // Name Type = Value Comment
            // Name = Value
            // Name Type

            // Find '='
            let eqIdx = -1;
            for(let m=0; m<meaningfulTokens.length; m++) {
                if (meaningfulTokens[m].text === '=') {
                    eqIdx = m;
                    break;
                }
            }

            if (eqIdx !== -1) {
                // Has value
                // Before = is Name [Type]
                const left = meaningfulTokens.slice(0, eqIdx);
                const right = meaningfulTokens.slice(eqIdx); // = Value...

                // Try to split Name and Type in left
                // Name is usually one identifier (comma separated?)
                // var x, y int = ...
                // This is hard to parse perfectly without AST.
                // Simple heuristic: First token is Name(s). If more, Type.

                // But typically in var blocks:
                // x int = 1
                // y     = 2

                // If there is a type, it should be aligned.
                // How to detect type?
                // If left has > 1 token (excluding commas), maybe Type?
                // For deep formatting, let's just split Left and Right (= ...)
                // And maybe align Type if we can guess it.

                // Let's assume Name Type = Value layout for max 3 columns.
                // If no type, Col 2 is empty.

                if (left.length > 1) {
                     // Check if only identifiers and commas
                     const onlyNames = left.every(t => t.type === TokenType.Identifier || t.text === ',');
                     if (onlyNames) {
                         cols.push(left); // Name
                         cols.push([]); // Type
                     } else {
                         // Likely Name Type
                         // Assume last part is type?
                         // var x, y int
                         // var x int
                         // Split at last type-like sequence?
                         // Too risky. Let's just create 2 columns: "Left" and "Right".
                         // gofmt aligns the '='.
                         cols.push(left);
                         cols.push(right);
                     }
                } else {
                    cols.push(left); // Name
                    cols.push([]); // Type
                    cols.push(right);
                }
            } else {
                // No value. Name Type.
                // var x int
                if (meaningfulTokens.length > 1) {
                    cols.push([meaningfulTokens[0]]);
                    cols.push(meaningfulTokens.slice(1));
                } else {
                    cols.push(meaningfulTokens);
                }
            }
        }

        rows.push({ lineIdx: k, cols });
    }

    // 2. Calculate Widths
    const numCols = rows.reduce((max, r) => Math.max(max, r.cols.length), 0);
    const widths = new Array(numCols).fill(0);

    rows.forEach(r => {
        r.cols.forEach((col, i) => {
            if (col.length > 0) {
                const len = col.reduce((sum, t) => sum + t.text.length, 0) + (col.length - 1); // approx length + spaces
                // Actually we should reconstruct the string to be accurate about spacing we added
                // Or just use the spacing we are about to add.
                // Let's just sum text lengths and add 1 space per token gap
                // But wait, applySpacing already added whitespace tokens?
                // No, we filtered them out.
                // We will re-join them with spaces.
                if (len > widths[i]) widths[i] = len;
            }
        });
    });

    // 3. Reconstruct Lines
    rows.forEach(r => {
        if (r.cols.length === 0) return; // Empty or comment-only line handled implicitly

        let newLine: Token[] = [];

        // Add existing indentation? No, formatGoDeep main loop handles main indentation.
        // We just constructing content.

        r.cols.forEach((col, i) => {
            // Add content
            col.forEach((t, idx) => {
                if (idx > 0) newLine.push({ type: TokenType.Whitespace, text: ' ', line: 0, col: 0 });
                newLine.push(t);
            });

            // Add padding if not last column
            if (i < r.cols.length - 1) {
                const currentLen = col.reduce((sum, t) => sum + t.text.length, 0) + Math.max(0, col.length - 1);
                const pad = widths[i] - currentLen;

                // Add padding spaces
                // Plus one extra space for column separation (unless empty column?)
                // If column is empty, width is 0, pad is 0.

                if (col.length > 0 || (col.length === 0 && widths[i] > 0)) {
                    // If we have content, or if the column exists in other rows

                    if (pad > 0) {
                        newLine.push({ type: TokenType.Whitespace, text: ' '.repeat(pad), line: 0, col: 0 });
                    }
                    // Separator
                    newLine.push({ type: TokenType.Whitespace, text: '\t', line: 0, col: 0 });
                    // Wait, gofmt uses tabs for indentation, but SPACES for alignment!
                    // ' \t' ??
                    // No, struct fields are aligned with spaces usually?
                    // "Name    string" -> spaces.
                    // So separator should be spaces.
                    // Ideally we tab-align? No, gofmt uses tabs for indent, spaces for alignment.
                }
            }
        });

        // Replace line in `lines`
        // We need to preserve the trailing comment if it wasn't part of cols (it shouldn't happen with our logic)
        lines[r.lineIdx] = newLine;
    });

    // Fix separator to be spaces
    // The loop above added '\t' as placeholder. Replace with ' ' or proper amount of spaces.
    // Actually, let's just use ' '.
    rows.forEach(r => {
        const line = lines[r.lineIdx];
        for(const t of line) {
            if (t.text === '\t') t.text = ' ';
            // Wait, standard separation is usually at least one space?
            // "Name    string" -> 4 spaces gap?
            // Gofmt aligns to tab stops?
            // "gofmt uses tabs for indentation and blanks for alignment."
            // So just use spaces for padding.
        }
    });
}

// --- Import Sorting ---

function sortImports(lines: Token[][]) {
    // Find import blocks
    // Single import: import "..."
    // Block import: import ( ... )

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.length > 0 && line[0].text === 'import') {
            const hasParen = line.some(t => t.text === '(');
            if (hasParen) {
                // Found import (
                let j = i + 1;
                while (j < lines.length) {
                    const l = lines[j];
                    if (l.some(t => t.text === ')')) break;
                    j++;
                }

                if (j < lines.length) {
                    // Block content is lines i+1 to j-1
                    const contentLines = lines.slice(i + 1, j);

                    const imports: { lines: Token[][], path: string, isStd: boolean }[] = [];
                    let currentPrefix: Token[][] = [];

                    for (const l of contentLines) {
                        const pathToken = l.find(t => (t.type as any) === TokenType.String);
                        if (pathToken) {
                             // Found import
                             const path = pathToken.text.replace(/^"|"$/g, '');
                             const firstSegment = path.split('/')[0];
                             const isStd = !firstSegment.includes('.');

                             imports.push({
                                 lines: [...currentPrefix, l],
                                 path,
                                 isStd
                             });
                             currentPrefix = [];
                        } else {
                             // Comment or empty line
                             currentPrefix.push(l);
                        }
                    }

                    const trailingLines = currentPrefix;

                    // Sort
                    imports.sort((a, b) => {
                        if (a.isStd && !b.isStd) return -1;
                        if (!a.isStd && b.isStd) return 1;
                        return a.path.localeCompare(b.path);
                    });

                    // Reconstruct block with separation
                    const newBlock: Token[][] = [];
                    let lastWasStd = true; // Assume start with std
                    if (imports.length > 0) lastWasStd = imports[0].isStd;

                    for (let k = 0; k < imports.length; k++) {
                         const imp = imports[k];
                         if (lastWasStd && !imp.isStd) {
                             newBlock.push([]); // Group separator
                         }
                         newBlock.push(...imp.lines); // Includes prefix comments/blanks
                         lastWasStd = imp.isStd;
                    }

                    newBlock.push(...trailingLines);

                    // Replace lines in original array
                    // Removing i+1 ... j-1
                    // Inserting newBlock
                    const deleteCount = j - (i + 1);
                    lines.splice(i + 1, deleteCount, ...newBlock);

                    // Adjust loop index because array length changed
                    // new j is i + 1 + newBlock.length
                    j = i + 1 + newBlock.length;
                    i = j; // Continue after import block
                }
            }
        }
    }
}
