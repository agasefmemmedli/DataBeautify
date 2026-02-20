
import { SwiftTokenizer, Token, TokenType } from './swift_tokenizer';

export function formatSwiftDeep(text: string): string {
    const tokenizer = new SwiftTokenizer(text);
    const allTokens = tokenizer.tokenize();

    // Filter tokens but keep comments and newlines
    const tokens: Token[] = [];
    for (const token of allTokens) {
        if (token.type !== TokenType.Whitespace) {
            tokens.push(token);
        }
    }

    if (tokens.length === 0) return '';

    const outputLines: string[] = [];
    let currentLine = '';
    let indentLevel = 0;

    const delimiterStack: string[] = [];
    const switchStack: { baseIndent: number, blockDepth: number }[] = [];

    const TAB = '    ';

    let importBuffer: string[] = [];
    const flushImports = () => {
        if (importBuffer.length > 0) {
            importBuffer.sort();
            outputLines.push(...importBuffer);
            importBuffer = [];
        }
    };

    const append = (text: string) => {
        if (currentLine === '') {
            currentLine = TAB.repeat(indentLevel);
        }
        currentLine += text;
    };

    const pushLine = () => {
        const trimmed = currentLine.trim();
        if (trimmed.length > 0) {
            if (trimmed.startsWith('import ') && indentLevel === 0) {
                importBuffer.push(currentLine);
            } else {
                flushImports();
                outputLines.push(currentLine);
            }
        }
        currentLine = '';
    };

    const forceNewline = () => {
        if (currentLine.trim().length > 0) pushLine();
    };

    const isAdjacent = (prev: Token, curr: Token) => {
        return prev.line === curr.line && (prev.col + prev.text.length === curr.col);
    };

    let shouldIgnoreNextNewline = false;
    let pendingSwitchStart = false;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === TokenType.Newline) {
            if (shouldIgnoreNextNewline) {
                shouldIgnoreNextNewline = false;
                continue;
            }
            if (currentLine.trim().length > 0) {
                pushLine();
            } else {
                flushImports();
                if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== '') {
                    outputLines.push('');
                }
            }
            continue;
        }
        shouldIgnoreNextNewline = false;

        let prevSigIndex = i - 1;
        while (prevSigIndex >= 0 && tokens[prevSigIndex].type === TokenType.Newline) prevSigIndex--;
        const prevSig = prevSigIndex >= 0 ? tokens[prevSigIndex] : null;

        let nextSigIndex = i + 1;
        while (nextSigIndex < tokens.length && tokens[nextSigIndex].type === TokenType.Newline) nextSigIndex++;
        const nextSig = nextSigIndex < tokens.length ? tokens[nextSigIndex] : null;

        // --- Pre-Processing ---

        // Delimiter Pop & Dedent
        if (token.text === '}' || token.text === ')' || token.text === ']') {
            if (delimiterStack.length > 0) {
                const last = delimiterStack.pop();

                if (token.text === '}') {
                    let switchClosed = false;
                    if (switchStack.length > 0 && last === '{') {
                        const top = switchStack[switchStack.length - 1];
                        if (delimiterStack.length + 1 === top.blockDepth) {
                            indentLevel = top.baseIndent;
                            switchStack.pop();
                            switchClosed = true;
                        }
                    }
                    if (!switchClosed) {
                        indentLevel = Math.max(0, indentLevel - 1);
                    }
                    forceNewline();
                }
            } else {
                if (token.text === '}') {
                    indentLevel = Math.max(0, indentLevel - 1);
                    forceNewline();
                }
            }
        }

        // Switch Keyword
        if (token.type === TokenType.Keyword && token.text === 'switch') {
            pendingSwitchStart = true;
        }

        // Case / Default
        if ((token.text === 'case' || token.text === 'default') && token.type === TokenType.Keyword) {
            if (switchStack.length > 0) {
                const top = switchStack[switchStack.length - 1];
                if (delimiterStack.length === top.blockDepth) {
                    forceNewline();
                    indentLevel = top.baseIndent + 1;
                }
            }
        }

        // Directives
        if (token.type === TokenType.Directive) {
            forceNewline();
            append(token.text);
            forceNewline();
            shouldIgnoreNextNewline = true;
            continue;
        }

        // Attributes
        if (token.type === TokenType.Attribute) {
            if (currentLine.trim().length > 0 && prevSig && prevSig.type !== TokenType.Attribute) {
                 append(' ');
            } else {
                 if (currentLine === '') append(token.text);
                 else append(' ' + token.text);
            }
            if (nextSig && ['func', 'class', 'struct', 'enum', 'protocol', 'extension', 'var', 'let', 'init', 'deinit'].includes(nextSig.text)) {
                forceNewline();
                shouldIgnoreNextNewline = true;
            }
            continue;
        }

        // --- Spacing ---
        let spaceBefore = false;
        if (prevSig) {
            if (prevSig.type === TokenType.Keyword) {
                spaceBefore = true;
                if (['(', '[', '<', '?', ')', ']'].includes(token.text)) {
                    if (prevSig.text === 'is' || prevSig.text === 'as') spaceBefore = true;
                    else spaceBefore = false;
                }

                if (token.text === '!') {
                    if (prevSig.text === 'try' || prevSig.text === 'as') spaceBefore = false;
                    else spaceBefore = true;
                }
                if (token.text === '.') {
                    if (prevSig.text === 'super' || prevSig.text === 'self') spaceBefore = false;
                    else spaceBefore = true;
                }
            }
            else if (prevSig.text === ',') spaceBefore = true;
            else if (prevSig.text === ':') {
                spaceBefore = true;
            }
            else if (prevSig.type === TokenType.Operator) {
                spaceBefore = true;
                if (['!', '-', '+', '~'].includes(prevSig.text)) {
                    let prevPrevSigIndex = prevSigIndex - 1;
                    while (prevPrevSigIndex >= 0 && tokens[prevPrevSigIndex].type === TokenType.Newline) prevPrevSigIndex--;
                    const prevPrevSig = prevPrevSigIndex >= 0 ? tokens[prevPrevSigIndex] : null;

                    if (!prevPrevSig || ['(', '[', '{', ',', ':', ';', 'return', 'case', '=', '==', '!=', '&&', '||', 'guard', 'if', 'while'].includes(prevPrevSig.text) || prevPrevSig.type === TokenType.Operator) {
                        spaceBefore = false;
                    }
                }
                if (prevSig.text === '...' || prevSig.text === '..<') spaceBefore = false;
                if (prevSig.text === '?') {
                    if (token.text === '.') spaceBefore = false;
                }
                if (prevSig.text === '.') spaceBefore = false;

                // Generic start check: if prev was < and adjacent to next token
                if (prevSig.text === '<' && isAdjacent(prevSig, token)) spaceBefore = false;
            }
            else if (prevSig.text === '{' || prevSig.text === '[' || prevSig.text === '(') {
                spaceBefore = false;
            }
            else if (prevSig.type === TokenType.Identifier) {
                spaceBefore = true;
                if (['(', '[', '<', '.', '?', '!', ')', ']', ':'].includes(token.text)) spaceBefore = false;
            }
            else if (prevSig.type === TokenType.String || prevSig.type === TokenType.Number) {
                spaceBefore = true;
                if (['.', ',', ';', ')', ']', ':'].includes(token.text)) spaceBefore = false;
            }
            else if (prevSig.text === '}' || prevSig.text === ')' || prevSig.text === ']') {
                spaceBefore = true;
                if (['.', ',', ';', ')', ']', ':', '?', '!'].includes(token.text)) spaceBefore = false;
                if (token.text === '(' && prevSig.text === '}') spaceBefore = true;
            }
            else if (prevSig.type === TokenType.Attribute) {
                spaceBefore = true;
            }

            if (token.text === ',' || token.text === ';' || token.text === '.' || token.text === ':') spaceBefore = false;
            if (token.type === TokenType.Operator) {
                if (token.text === '...' || token.text === '..<') spaceBefore = false;
                if (token.text === '?' || token.text === '!') {
                    if (prevSig.type === TokenType.Identifier || prevSig.text === ']') spaceBefore = false;
                    if (prevSig.text === 'try' || prevSig.text === 'as') spaceBefore = false;
                }
            }
            if (token.text === '(' || token.text === '[') {
                if (prevSig.type === TokenType.Identifier || prevSig.type === TokenType.Keyword) {
                    spaceBefore = false;
                    if (['if', 'for', 'while', 'switch', 'guard', 'catch', 'is', 'as'].includes(prevSig.text)) spaceBefore = true;
                }
            }
            if (token.text === '<') {
                // Generics vs Operator Adjacency Logic
                if (prevSig.type === TokenType.Identifier) {
                    if (isAdjacent(prevSig, token)) spaceBefore = false; // Array<
                    else spaceBefore = true; // count <
                } else {
                    spaceBefore = true; // 1 <
                }
            }
            if (token.text === '>') {
                if (prevSig.type === TokenType.Identifier) {
                    if (isAdjacent(prevSig, token)) spaceBefore = false; // Int>
                    else spaceBefore = true; // x >
                } else {
                    spaceBefore = true; // 1 >
                }
            }
        }

        if (spaceBefore && currentLine.trim().length > 0 && !currentLine.endsWith(' ')) {
            append(' ');
        }

        // --- Append ---
        append(token.text);

        // --- Post-Processing ---

        // Delimiter Push
        if (token.text === '{' || token.text === '(' || token.text === '[') {
            delimiterStack.push(token.text);

            if (token.text === '{') {
                if (pendingSwitchStart) {
                    switchStack.push({ baseIndent: indentLevel, blockDepth: delimiterStack.length });
                    pendingSwitchStart = false;
                }
                indentLevel++;
                forceNewline();
                shouldIgnoreNextNewline = true;
            }
        }

        if (token.text === '}') {
            if (nextSig && (nextSig.text === 'else' || nextSig.text === 'catch')) {
                append(' ');
            } else if (nextSig && nextSig.text === '.') {
                forceNewline();
                shouldIgnoreNextNewline = true;
            } else {
                forceNewline();
                shouldIgnoreNextNewline = true;
            }
        }
        else if (token.text === ';') {
            forceNewline();
            shouldIgnoreNextNewline = true;
        }
        else if (token.text === ':') {
            if (switchStack.length > 0) {
                const top = switchStack[switchStack.length - 1];
                if (delimiterStack.length === top.blockDepth) {
                    forceNewline();
                    shouldIgnoreNextNewline = true;
                    indentLevel = top.baseIndent + 2;
                }
            }
        }
        else if (token.type === TokenType.Comment) {
            if (token.text.startsWith('//')) {
                forceNewline();
                shouldIgnoreNextNewline = true;
            }
        }
        else if (token.text === 'else') {
            if (nextSig && nextSig.text === '{') {
                append(' ');
            }
        }
    }

    forceNewline();
    flushImports(); // Ensure trailing imports are flushed
    return outputLines.join('\n');
}
