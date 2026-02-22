import { MakefileTokenizer, Token, TokenType } from './makefile_tokenizer';

enum LineType {
    Empty,
    Comment,
    Directive,
    Assignment,
    Target,
    Recipe,
    Other,
    Continuation
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
    const analyzedLines: LineInfo[] = lines.map(lineTokens => {
        // Trim leading whitespace/tabs for analysis
        const contentTokens = lineTokens.filter(t => t.type !== TokenType.Whitespace && t.type !== TokenType.Tab);

        if (contentTokens.length === 0) {
            return { tokens: lineTokens, type: LineType.Empty, indentLevel: 0, isRecipe: false };
        }

        const first = contentTokens[0];

        // Check for Recipe (starts with Tab in original)
        const originalStartedWithTab = lineTokens.length > 0 && lineTokens[0].type === TokenType.Tab;

        if (originalStartedWithTab) {
             return { tokens: lineTokens, type: LineType.Recipe, indentLevel: 0, isRecipe: true };
        }

        if (first.type === TokenType.Comment) {
            return { tokens: lineTokens, type: LineType.Comment, indentLevel: 0, isRecipe: false };
        }

        if (first.type === TokenType.Directive) {
            return { tokens: lineTokens, type: LineType.Directive, indentLevel: 0, isRecipe: false };
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
                 if (contentTokens[i].type === TokenType.Operator && contentTokens[i].text === ':') {
                     colonIndex = i;
                     break;
                 }
             }

             if (colonIndex !== -1) {
                 return { tokens: lineTokens, type: LineType.Other, indentLevel: 0, isRecipe: false };
             }

             return {
                 tokens: lineTokens,
                 type: LineType.Assignment,
                 indentLevel: 0,
                 isRecipe: false,
                 operatorIndex: opIndex
             };
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
            return { tokens: lineTokens, type: LineType.Target, indentLevel: 0, isRecipe: false };
        }

        return { tokens: lineTokens, type: LineType.Other, indentLevel: 0, isRecipe: false };
    });

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
             const keyTokens = [];
             for(const t of contentTokens) {
                 if(t.type === TokenType.Assignment) break;
                 keyTokens.push(t);
             }

             let width = 0;
             if (keyTokens.length > 0) {
                 width = keyTokens.reduce((sum, t) => sum + t.text.length, 0) + (keyTokens.length - 1);
             }

             if (width > maxKeyWidth) maxKeyWidth = width;
        }

        for (const line of assignmentBlock) {
             const contentTokens = line.tokens.filter(t => t.type !== TokenType.Whitespace && t.type !== TokenType.Tab);
             const keyTokens = [];
             for(const t of contentTokens) {
                 if(t.type === TokenType.Assignment) break;
                 keyTokens.push(t);
             }
             let width = 0;
             if (keyTokens.length > 0) {
                 width = keyTokens.reduce((sum, t) => sum + t.text.length, 0) + (keyTokens.length - 1);
             }
             line.alignmentPadding = maxKeyWidth - width;
        }

        assignmentBlock = [];
    }

    for (let i = 0; i < analyzedLines.length; i++) {
        const line = analyzedLines[i];
        if (line.type === LineType.Assignment && line.indentLevel === (analyzedLines[i-1]?.indentLevel ?? 0)) {
            assignmentBlock.push(line);
        } else {
            flushAlignment();
            if (line.type === LineType.Assignment) {
                assignmentBlock.push(line);
            }
        }
    }
    flushAlignment();

    // 5. Render
    const formattedLines: string[] = [];

    for (let i = 0; i < analyzedLines.length; i++) {
        const line = analyzedLines[i];

        if (line.type === LineType.Empty) {
            if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                formattedLines.push('');
            }
            continue;
        }

        let formattedLine = '';

        if (line.isRecipe) {
            formattedLine += '\t';
        } else {
            formattedLine += '  '.repeat(line.indentLevel);
        }

        const contentTokens = line.tokens.filter(t => t.type !== TokenType.Whitespace && t.type !== TokenType.Tab);

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

            // No space after $
            if (prev?.text === '$') needSpace = false;
            // No space inside variable $(...)
            if (prev?.text === '(' && j > 1 && tokens[j-2].text === '$') needSpace = false;

            // Comma
            if (t.text === ',') needSpace = false;

            // Colon in targets: target : dep -> target: dep
            if (t.text === ':' || t.text === '::') {
                if (prev?.type !== TokenType.Assignment) { // Avoid assignment logic interference just in case
                    needSpace = false;
                }
            }

            // Continuation \ gets space before it
            if (t.type === TokenType.Continuation) needSpace = true;

            if (needSpace) result += ' ';
        }

        result += t.text;
    }
    return result;
}
