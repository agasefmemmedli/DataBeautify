import { MakefileTokenizer, Token, TokenType } from './makefile_tokenizer';

enum LineType {
    Empty,
    Comment,
    Directive,
    Assignment,
    Target,
    Recipe,
    Other
}

interface LineInfo {
    tokens: Token[];
    type: LineType;
    indentLevel: number; // For directives (spaces)
    isRecipe: boolean; // Needs TAB
    alignmentPadding?: number; // For assignments
    operatorIndex?: number; // Index of assignment operator token
}

export function formatMakefileDeep(text: string): string {
    const tokenizer = new MakefileTokenizer(text);
    const tokens = tokenizer.tokenize();

    // 1. Group tokens into physical lines
    const lines: Token[][] = [];
    let currentLine: Token[] = [];

    for (const token of tokens) {
        if (token.type === TokenType.Newline) {
            lines.push(currentLine);
            currentLine = [];
        } else {
            currentLine.push(token);
        }
    }
    if (currentLine.length > 0) {
        lines.push(currentLine);
    }

    // 2. Analyze Lines
    const analyzedLines: LineInfo[] = [];
    let previousType = LineType.Empty;

    for (const lineTokens of lines) {
        const contentTokens = lineTokens.filter(t => t.type !== TokenType.Whitespace && t.type !== TokenType.Tab);

        if (contentTokens.length === 0) {
            analyzedLines.push({ tokens: lineTokens, type: LineType.Empty, indentLevel: 0, isRecipe: false });
            previousType = LineType.Empty; // Reset context on blank line
            continue;
        }

        const first = contentTokens[0];

        // Check for Recipe
        const startsWithTab = lineTokens.length > 0 && lineTokens[0].type === TokenType.Tab;

        let isRecipeCandidate = false;
        if (previousType === LineType.Target && first.type !== TokenType.Directive && first.type !== TokenType.Assignment) {
            isRecipeCandidate = true;
        }

        if (startsWithTab || isRecipeCandidate) {
            // Recipe
            if (first.type === TokenType.Comment) {
                 analyzedLines.push({ tokens: lineTokens, type: LineType.Recipe, indentLevel: 0, isRecipe: true });
                 previousType = LineType.Recipe;
                 continue;
            }

            analyzedLines.push({ tokens: lineTokens, type: LineType.Recipe, indentLevel: 0, isRecipe: true });
            previousType = LineType.Recipe;
            continue;
        }

        if (first.type === TokenType.Comment) {
            analyzedLines.push({ tokens: lineTokens, type: LineType.Comment, indentLevel: 0, isRecipe: false });
            continue;
        }

        if (first.type === TokenType.Directive) {
            analyzedLines.push({ tokens: lineTokens, type: LineType.Directive, indentLevel: 0, isRecipe: false });
            previousType = LineType.Directive;
            continue;
        }

        // Assignment?
        let opIndex = -1;
        for (let i = 0; i < contentTokens.length; i++) {
            if (contentTokens[i].type === TokenType.Assignment) {
                opIndex = i;
                break;
            }
        }
        if (opIndex !== -1) {
             let colonIndex = -1;
             for (let i = 0; i < opIndex; i++) {
                 if (contentTokens[i].type === TokenType.Operator && (contentTokens[i].text === ':' || contentTokens[i].text === '::')) {
                     colonIndex = i;
                     break;
                 }
             }

             if (colonIndex !== -1) {
                 analyzedLines.push({ tokens: lineTokens, type: LineType.Target, indentLevel: 0, isRecipe: false });
                 previousType = LineType.Target;
                 continue;
             }

             analyzedLines.push({
                 tokens: lineTokens,
                 type: LineType.Assignment,
                 indentLevel: 0,
                 isRecipe: false,
                 operatorIndex: opIndex
             });
             previousType = LineType.Assignment;
             continue;
        }

        // Target?
        let hasColon = false;
        for (const t of contentTokens) {
            if (t.type === TokenType.Operator && (t.text === ':' || t.text === '::')) {
                hasColon = true;
                break;
            }
        }
        if (hasColon) {
            analyzedLines.push({ tokens: lineTokens, type: LineType.Target, indentLevel: 0, isRecipe: false });
            previousType = LineType.Target;
            continue;
        }

        analyzedLines.push({ tokens: lineTokens, type: LineType.Other, indentLevel: 0, isRecipe: false });
        previousType = LineType.Other;
    }

    // 3. Calculate Indentation (Directives)
    let currentIndent = 0;
    for (let i = 0; i < analyzedLines.length; i++) {
        const line = analyzedLines[i];

        if (line.type === LineType.Directive) {
            const contentTokens = line.tokens.filter(t => t.type !== TokenType.Whitespace && t.type !== TokenType.Tab);
            const dir = contentTokens[0].text;

            if (['endif', 'endef', 'else'].includes(dir)) {
                currentIndent = Math.max(0, currentIndent - 1);
            }

            line.indentLevel = currentIndent;

            if (['define', 'ifeq', 'ifneq', 'ifdef', 'ifndef', 'else'].includes(dir)) {
                currentIndent++;
            }
        } else if (line.type !== LineType.Recipe) {
             line.indentLevel = currentIndent;
        }
    }

    // 4. Calculate Alignment (Assignments)
    let assignmentBlock: LineInfo[] = [];

    function flushAlignment() {
        if (assignmentBlock.length <= 1) {
            assignmentBlock = [];
            return;
        }

        let maxKeyWidth = 0;

        for (const line of assignmentBlock) {
             const contentTokens = line.tokens.filter(t => t.type !== TokenType.Whitespace && t.type !== TokenType.Tab);
             let opIdx = -1;
             for(let k=0; k<contentTokens.length; k++) {
                 if (contentTokens[k].type === TokenType.Assignment) {
                     opIdx = k;
                     break;
                 }
             }
             if (opIdx === -1) continue;

             let width = 0;
             const keyPart = contentTokens.slice(0, opIdx);
             if (keyPart.length > 0) {
                 width = keyPart.reduce((sum, t) => sum + t.text.length, 0) + (keyPart.length - 1);
             }

             if (width > maxKeyWidth) maxKeyWidth = width;
        }

        for (const line of assignmentBlock) {
             const contentTokens = line.tokens.filter(t => t.type !== TokenType.Whitespace && t.type !== TokenType.Tab);
             let opIdx = -1;
             for(let k=0; k<contentTokens.length; k++) {
                 if (contentTokens[k].type === TokenType.Assignment) {
                     opIdx = k;
                     break;
                 }
             }
             if (opIdx === -1) continue;

             let width = 0;
             const keyPart = contentTokens.slice(0, opIdx);
             if (keyPart.length > 0) {
                 width = keyPart.reduce((sum, t) => sum + t.text.length, 0) + (keyPart.length - 1);
             }

             line.alignmentPadding = maxKeyWidth - width;
        }

        assignmentBlock = [];
    }

    for (let i = 0; i < analyzedLines.length; i++) {
        const line = analyzedLines[i];

        if (line.type === LineType.Empty || line.type === LineType.Comment) {
            flushAlignment();
            continue;
        }

        if (line.type === LineType.Assignment) {
            if (assignmentBlock.length > 0 && assignmentBlock[0].indentLevel !== line.indentLevel) {
                flushAlignment();
            }
            assignmentBlock.push(line);
        } else {
            flushAlignment();
        }
    }
    flushAlignment();

    // 5. Render
    const formattedLines: string[] = [];
    let inContinuation = false;

    for (let i = 0; i < analyzedLines.length; i++) {
        const line = analyzedLines[i];

        if (line.type === LineType.Empty) {
            if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                formattedLines.push('');
            }
            inContinuation = false; // Continuation breaks on empty line usually
            continue;
        }

        let formattedLine = '';

        if (line.isRecipe) {
            formattedLine += '\t';
            // If previous line was continuation of recipe, we should handle it?
            // But tokenizer splits continuations.
            // If it's a recipe continuation, does it start with Tab?
            // "Use a backslash to split a long line... The backslash/newline sequence is then replaced by a space."
            // "You must NOT begin the next line with a tab." (Wait, really?)
            // "If you want the next line to be processed as part of the recipe, it must NOT start with a tab... wait no."
            // Actually, for recipes, the backslash makes the shell see one line.
            // Make passes it to shell.
            // If I start next line with Tab, Make strips the Tab before passing to shell?
            // Yes, "If the first character of the line is a tab, it is removed."
            // so `\ <newline> <tab>` -> shell sees ` `
            // So for recipes, continuation lines SHOULD start with Tab if they are to be part of the recipe command stream?
            // No, if they are continuation of the *same logical line*, Tab is stripping.
            // If I don't put Tab, Make might think it's not a recipe?
            // But if previous ended with `\`, Make joins them.
            // So indentation for visual purpose.
            // Let's stick to adding `\t` if it's detected as Recipe.
        } else {
            // Check continuation
            if (inContinuation) {
                // Indent extra
                formattedLine += '  '.repeat(line.indentLevel + 2); // 4 extra spaces
            } else {
                formattedLine += '  '.repeat(line.indentLevel);
            }
        }

        const contentTokens = line.tokens.filter(t => t.type !== TokenType.Whitespace && t.type !== TokenType.Tab);

        // Check if ends with continuation
        let endsWithContinuation = false;
        if (contentTokens.length > 0 && contentTokens[contentTokens.length - 1].type === TokenType.Continuation) {
            endsWithContinuation = true;
        }

        if (line.type === LineType.Assignment && line.alignmentPadding !== undefined) {
             let opIndex = 0;
             for (let j = 0; j < contentTokens.length; j++) {
                 if (contentTokens[j].type === TokenType.Assignment) {
                     opIndex = j;
                     break;
                 }
             }

             const keyPart = contentTokens.slice(0, opIndex);
             const opPart = contentTokens[opIndex];
             const valPart = contentTokens.slice(opIndex + 1);

             formattedLine += keyPart.map(t => t.text).join(' ');
             formattedLine += ' '.repeat(line.alignmentPadding + 1);
             formattedLine += opPart.text;
             if (valPart.length > 0) {
                 formattedLine += ' ' + renderTokens(valPart);
             }
        } else {
            formattedLine += renderTokens(contentTokens);
        }

        formattedLines.push(formattedLine);
        inContinuation = endsWithContinuation;
    }

    return formattedLines.join('\n') + '\n';
}

function renderTokens(tokens: Token[]): string {
    let result = '';
    for (let j = 0; j < tokens.length; j++) {
        const t = tokens[j];
        const prev = j > 0 ? tokens[j-1] : null;

        if (j > 0) {
            let needSpace = true;

            // Comma
            if (t.text === ',') needSpace = false;
            if (prev?.text === ',') needSpace = true;

            // Colon in targets
            if (t.type === TokenType.Operator && (t.text === ':' || t.text === '::')) {
                 needSpace = false;
            }

            // Parentheses/Braces
            if (t.text === ')' || t.text === '}') needSpace = false;
            if (prev?.text === '(' || prev?.text === '{') needSpace = false;

            // Continuation
            if (t.type === TokenType.Continuation) needSpace = true;

            // Path separator /
            if (t.text.startsWith('/')) needSpace = false;
            // Also if prev was /?
            if (prev?.text.endsWith('/')) needSpace = false;

            if (needSpace) result += ' ';
        }

        result += t.text;
    }
    return result;
}
