
import { JavaTokenizer, Token, TokenType } from './java_tokenizer';

function sortImports(text: string): string {
    const lines = text.split('\n');
    const importLines: string[] = [];
    const otherLines: string[] = [];
    let processingImports = false;

    // This simple logic assumes imports are grouped together or we group them
    // But imports might be interspersed with comments.
    // robust way: extract all lines starting with `import ` (ignoring comments/strings? No, imports are top level).
    // But we need to preserve location?
    // Usually imports are at the top after package.

    // Scan for import blocks
    // We'll extract all import statements, sort them, and place them where the first import was?
    // Or just group them all after package?

    // Let's stick to: Find the first import. Collect all imports. Remove them from original positions. Insert sorted list at first import position.

    const imports: string[] = [];
    let firstImportIndex = -1;

    const newLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith('import ') && trimmed.endsWith(';')) {
            if (firstImportIndex === -1) firstImportIndex = newLines.length;
            imports.push(line);
        } else {
            newLines.push(line);
        }
    }

    if (imports.length === 0) return text;

    imports.sort((a, b) => {
        // Sort by package name length? No, alphabetical.
        // Google style: ASCII sort.
        return a.trim().localeCompare(b.trim());
    });

    // Insert back
    // Use a blank line before and after imports?
    // Check if newLines[firstImportIndex-1] is package?

    if (firstImportIndex !== -1) {
        newLines.splice(firstImportIndex, 0, ...imports);
    } else {
        // No imports found? logic error
        return text;
    }

    return newLines.join('\n');
}

export function formatJavaDeep(text: string): string {
    // 1. Sort Imports
    text = sortImports(text);

    const tokenizer = new JavaTokenizer(text);
    const tokens = tokenizer.tokenize();

    if (tokens.length === 0) return '';

    const INDENT_SIZE = 4;
    const INDENT_STRING = ' '.repeat(INDENT_SIZE);

    // Filter meaningful tokens
    const meaningfulTokens = tokens.filter(t => t.type !== TokenType.Whitespace && t.type !== TokenType.Newline);

    let outputLines: string[] = [];
    let currentLine = '';
    let indentLevel = 0;

    // State
    let parenDepth = 0; // (...)
    let braceDepth = 0; // {...}
    let angleDepth = 0; // <...> (Generics)
    let switchDepth = 0;
    let inCaseLabel = false; // true between 'case' and ':'
    let caseIndentLevel = 0; // The base indent level of the current switch block

    // Helper to get indent
    const getIndent = (level: number) => INDENT_STRING.repeat(Math.max(0, level));

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
            // Apply indentation logic
            // Check if we are inside a case block (indented)
            // But if we are starting a new 'case' label, we should output at caseIndentLevel

            let effectiveIndent = indentLevel;

            const trimmedStr = str.trim();
            if (trimmedStr.startsWith('case ') || trimmedStr.startsWith('default:') || trimmedStr === 'default') {
                // Dedent for case label relative to content
                // If indentLevel includes the case-content indent (which is +1 from switch),
                // then case label should be -1.
                // We'll manage indentLevel such that it represents *content* level.
                // So case label is at indentLevel - 1.
                // UNLESS we are at the start of switch where indentLevel is just switch body level.
                // Let's refine the model:
                // Switch brace `{` -> indentLevel++. (This is switch body level).
                // Case label should be at this level?
                // Standard: switch body level + 1? No.
                // switch (x) {
                //     case 1:  <-- this is at switch indent + 1
                //         stmt; <-- this is at switch indent + 2?
                // }
                // OR
                // switch (x) {
                //     case 1: <-- indent + 1
                //     stmt;   <-- indent + 1 (aligned)
                // }
                // Reviewer said: "Statements within a case must be indented relative to the case label."
                // So Case + 1.

                // If I am printing 'case', I want it at `switch indent + 1`.
                // Statements should be at `switch indent + 2`.

                // Current logic:
                // `{` -> indentLevel++.
                // So if we are in switch, indentLevel is `switch indent + 1`.
                // This is correct for `case`.
                // But statements need +1.

                // So logic:
                // When we see `case` or `default`:
                // If we were indented for previous case content, dedent first?
                // How to know?
                // We can maintain `caseContentIndented` flag per switch nesting? Too complex.

                // Simpler:
                // `case` token: Ensure indentLevel is `switchBase + 1`.
                // `:` token (end of case label): indentLevel++.
                // `}` token (end of switch): indentLevel = `switchBase`. (Handled by brace logic).
                // `case` token (next case): Deduct 1 from indentLevel (to go back to label level).

                // But we don't know `switchBase` easily without stack.
                // But we know `case` always starts a label.
                // So if we are inside a case content (indented), we dedent.
                // How to detect?
                // If we hit `case`, we deduce we finished previous case block?

                // Let's rely on `indent adjustment` during token loop.
            }

            currentLine = getIndent(effectiveIndent) + str;
        } else {
            currentLine += str;
        }
    };

    for (let i = 0; i < meaningfulTokens.length; i++) {
        const token = meaningfulTokens[i];
        const next = i + 1 < meaningfulTokens.length ? meaningfulTokens[i+1] : null;
        const prev = i > 0 ? meaningfulTokens[i-1] : null;

        // --- PRE-TOKEN INDENT ADJUSTMENTS ---

        if (token.text === '}') {
            // Closing brace dedents
            indentLevel = Math.max(0, indentLevel - 1);

            // If we were inside a switch case (indented), we need to dedent EXTRA?
            // switch (x) {
            //     case 1:
            //         stmt;
            // } <-- this brace closes switch.
            // If we incremented for `stmt`, we are at `switch + 2`.
            // `}` reduces to `switch + 1`.
            // But we want `switch`.
            // So if `}` closes a switch, we need to dedent extra?
            // Or `case` indent logic handles it?

            // Problem: We don't track if `}` closes switch or if or method.
            // We need a stack of `BlockContext`.
        }
        else if (token.text === 'case' || token.text === 'default') {
            // New case label.
            // If we are already in a case block (indent increased by `:`), we dedent.
            // How do we know?
            // We can look at indentation? No.
            // We can check `inCaseLabel`. No.
            // Check if `prev` was `:`? No, statements happened.

            // Heuristic: If we are in a switch, `case` should align with other `case`s.
            // We can treat `case` as "dedent if needed".
            // But doing it robustly requires knowing if we indented.
            // Let's try to track `switchIndentStack`.
        }
    }

    // ... (Restarting logic construction to use stack)

    return formatJavaDeepInternal(meaningfulTokens, INDENT_STRING, getIndent);
}

function formatJavaDeepInternal(tokens: Token[], INDENT_STRING: string, getIndent: (l:number)=>string): string {
    let outputLines: string[] = [];
    let currentLine = '';
    let indentLevel = 0;

    // Stack to track block types: 'BLOCK', 'SWITCH', 'CASE_CONTENT'
    // 'SWITCH' pushed on `{` after `switch`.
    // 'CASE_CONTENT' pushed after `:` in a switch case.
    const blockStack: ('BLOCK' | 'SWITCH' | 'CASE_CONTENT' | 'ARRAY_INIT')[] = [];

    let parenDepth = 0;
    let angleDepth = 0;
    let inCaseLabel = false; // true if we are between `case` and `:`

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
        const prev2 = i > 1 ? tokens[i-2] : null;

        // --- Indent / Stack Management (Pre-Token) ---

        if (token.text === '}') {
            // Closing a block.
            // If top of stack is 'CASE_CONTENT', pop and dedent first.
            if (blockStack.length > 0 && blockStack[blockStack.length - 1] === 'CASE_CONTENT') {
                blockStack.pop();
                indentLevel--;
            }
            // Now handle the block closure
            if (blockStack.length > 0) {
                blockStack.pop(); // Pop 'SWITCH' or 'BLOCK' or 'ARRAY_INIT'
                indentLevel--;
            }
            if (currentLine.trim() !== '') pushLine();
        }
        else if (token.text === 'case' || token.text === 'default') {
             // Start of case label.
             // If we are in CASE_CONTENT, pop it and dedent.
             if (blockStack.length > 0 && blockStack[blockStack.length - 1] === 'CASE_CONTENT') {
                 blockStack.pop();
                 indentLevel--;
             }
             inCaseLabel = true;

             // Ensure we are on a new line
             if (currentLine.trim() !== '') pushLine();
        }

        // --- Blank Line Logic ---
        if (prev && token.line > prev.line + 1) {
            if (currentLine.trim() !== '') pushLine();
            if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== '') {
                outputLines.push('');
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
                else if (['.', '::', ',', ';'].includes(token.text)) spaceBefore = false;
                else if (token.text === '...') spaceBefore = true; // "String ... args" or "String... args"? Standard "String... args" or "String ...args"? Google: "String... args". Space before ... if type? No, usually attached to type. But space after.
                // Let's assume space before ... if prev is identifier (Type).

                else if (token.text === ':') {
                     if (inCaseLabel) spaceBefore = false;
                     else spaceBefore = true; // Ternary / For loop
                }
                else if (token.text === '<') {
                     // Generic detection
                     if (prev && (prev.type === TokenType.Identifier)) {
                         if (/^[A-Z]/.test(prev.text)) spaceBefore = false;
                         else spaceBefore = true;
                     } else {
                         spaceBefore = true;
                     }
                     if (!spaceBefore) angleDepth++;
                }
                else if (token.text === '>' || token.text === '>>' || token.text === '>>>') {
                     // Check if closing generic
                     // If we are in angleDepth > 0, treat as generic closer
                     if (angleDepth > 0) {
                         spaceBefore = false;
                         // Reduce angleDepth based on token length
                         angleDepth -= token.text.length;
                         if (angleDepth < 0) angleDepth = 0;
                     } else {
                         spaceBefore = true;
                     }
                }
                else {
                    // Binary/Unary
                    // ++ / --
                    if (['++', '--'].includes(token.text)) {
                         // Postfix: i++ -> no space before. Prefix: ++i -> no space after?
                         // Logic: If prev is Identifier/Literal/)/] -> Postfix -> No space before.
                         // If prev is Operator/Keyword/(/[ -> Prefix -> No space before? Actually space before?
                         // "a + ++b". + and ++. Space between them.

                         // If prev is Identifier/Literal/)/], it's postfix. No space before.
                         if (prev && (prev.type === TokenType.Identifier || prev.type === TokenType.Number || prev.text === ')' || prev.text === ']')) {
                             spaceBefore = false;
                         } else {
                             // Prefix.
                             // If prev was operator, we want space. "a + ++b" -> space before ++.
                             spaceBefore = true;
                         }
                    }
                    else if (['!', '~'].includes(token.text)) {
                         // Unary !
                         // Space before if prev is not (
                         if (prev && prev.text === '(') spaceBefore = false;
                         else spaceBefore = true;
                    }
                    else {
                        // Binary (+, -, *, /, =, etc.)
                        spaceBefore = true;
                    }
                }
            }

            if (token.type === TokenType.Punctuation) {
                 if (token.text === '(') {
                     if (prev && ['if', 'for', 'while', 'switch', 'catch', 'synchronized', 'try'].includes(prev.text)) spaceBefore = true;
                     else spaceBefore = false;
                 }
                 else if (token.text === '{') spaceBefore = true;
                 else if (['}', ')', ']'].includes(token.text)) spaceBefore = false;
                 else if (token.text === '[') spaceBefore = false;
            }

            if (prev) {
                if (prev.type === TokenType.Operator) {
                    if (['.', '::', '@'].includes(prev.text)) spaceBefore = false;
                    else if (prev.text === '<' && angleDepth > 0) spaceBefore = false;
                    else if (['++', '--'].includes(prev.text)) {
                        // handled below
                    }
                    else spaceBefore = true; // Default space after operator
                }

                if (prev.text === '(' || prev.text === '[') spaceBefore = false;
                if (prev.text === '::' || prev.text === '.') spaceBefore = false;
                if (prev.text === '@') spaceBefore = false;
                if (prev.text === '<' && angleDepth > 0) spaceBefore = false;

                // Prefix ++/-- handling for space AFTER
                // If prev was ++ or --, we need to check if it was prefix or postfix.
                // If postfix (i++), we want space after (i++ + 2).
                // If prefix (++i), we want NO space after (++i).
                if (prev.text === '++' || prev.text === '--') {
                     // Was prev prefix or postfix?
                     // Check prev2.
                     // If prev2 was identifier, prev was likely postfix. i ++.
                     // If prev2 was operator, prev was likely prefix. + ++ i.
                     let wasPostfix = false;
                     if (prev2 && (prev2.type === TokenType.Identifier || prev2.type === TokenType.Number || prev2.text === ')' || prev2.text === ']')) {
                         wasPostfix = true;
                     }

                     if (wasPostfix) spaceBefore = true; // i++ + 2
                     else spaceBefore = false; // ++i
                }
            }
        }

        if (spaceBefore && currentLine !== '' && !currentLine.endsWith(' ')) {
             append(' ');
        } else if (!spaceBefore && currentLine.endsWith(' ')) {
             currentLine = currentLine.trimEnd();
        }

        // --- Append Token ---
        // Handle >> as generic closer split if needed?
        // Tokenizer gives '>>'. We append '>>'.
        // If it's generic closer, we just want it appended.
        append(token.text);

        // --- Post-Token Logic ---

        if (token.text === '{') {
            indentLevel++;

            let isSwitch = false;
            if (prev && prev.text === ')') {
                 // Check if `switch (...) {`
                 // Need to trace back before `)` to find `switch`.
                 // Simplifying: check if line contains `switch`? No.
                 // We can check if `switch` token was seen recently?
                 // Let's look at `prev2`.
                 // ... switch ( ... ) {
                 // That's far back.
                 // We can rely on `token` iteration context if we tracked it.
            }
            // Better: When we see `switch`, set flag `expectingSwitchBrace`.

            // Re-evaluating:
            // Just scan back in `tokens` array? It's cheap enough.
            let k = i - 1;
            while (k >= 0 && (tokens[k].type === TokenType.Whitespace || tokens[k].type === TokenType.Newline || tokens[k].text === ')')) {
                k--;
            }
            // Skip parens block...

            // Easier: maintain `lastKeyword`.

            // Let's try to detect if it's switch.
            // Scan backwards balancing parens.
            let balance = 0;
            let p = i - 1;
            let foundSwitch = false;
            let foundArrayInit = false;

            while (p >= 0) {
                const t = tokens[p];
                if (t.text === ')' ) balance++;
                else if (t.text === '(') {
                    balance--;
                    if (balance < 0) {
                        // Found start of condition. Check token before.
                        let q = p - 1;
                        if (q >= 0 && tokens[q].text === 'switch') foundSwitch = true;
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
                    if (balance === 0) break; // Stop at block boundaries
                }
                p--;
            }

            if (foundSwitch) {
                blockStack.push('SWITCH');
            } else if (foundArrayInit) {
                 blockStack.push('ARRAY_INIT');
            } else {
                blockStack.push('BLOCK');
            }

            if (!foundArrayInit) pushLine();
        }
        else if (token.text === '}') {
             if (next && ['catch', 'finally', 'else', 'while'].includes(next.text)) {
                 append(' ');
             } else if (next && (next.text === ';' || next.text === ')' || next.text === ',' || next.text === '.')) {
                 // No newline
             } else {
                 pushLine();
             }
        }
        else if (token.text === ':') {
             if (inCaseLabel) {
                 inCaseLabel = false;
                 // Start case content
                 blockStack.push('CASE_CONTENT');
                 indentLevel++;
                 pushLine();
             }
        }
        else if (token.text === ';') {
             if (parenDepth === 0) pushLine();
             else append(' ');
        }
        else if (token.type === TokenType.Preprocessor) { // Annotation
             if (next && ['public', 'private', 'protected', 'class', 'interface', 'enum', 'record', 'void', 'static', 'final'].includes(next.text)) {
                 pushLine();
             } else if (next && next.type === TokenType.Identifier && parenDepth === 0) {
                 pushLine(); // Field annotation
             } else {
                 append(' ');
             }
        }
        else if (token.text === ',') {
             append(' ');
        }
        else if (token.type === TokenType.Comment) {
             pushLine();
        }

        if (token.text === '(') parenDepth++;
        else if (token.text === ')') parenDepth = Math.max(0, parenDepth - 1);
    }

    if (currentLine.trim() !== '') pushLine();

    return outputLines.join('\n');
}
