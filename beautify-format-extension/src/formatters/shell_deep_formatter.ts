import { ShellTokenizer, Token, TokenType } from './shell_tokenizer';

export function formatShellDeep(text: string): string {
    const tokenizer = new ShellTokenizer(text);
    const tokens = tokenizer.tokenize();
    const formattedLines: string[] = [];

    let indentLevel = 0;
    let inHeredoc = false;
    let heredocDelimiter = '';
    let heredocOp = '';

    // Stack to track context for indentation and spacing rules
    const contextStack: string[] = [];

    let currentLineTokens: Token[] = [];

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === TokenType.Newline) {
            processLine(currentLineTokens);
            currentLineTokens = [];
        } else {
            currentLineTokens.push(token);
        }
    }
    if (currentLineTokens.length > 0) {
        processLine(currentLineTokens);
    }

    function processLine(lineTokens: Token[]) {
        if (inHeredoc) {
            const fullLine = lineTokens.map(t => t.text).join('');
            const trimmed = fullLine.trim();

            if (trimmed === heredocDelimiter) {
                inHeredoc = false;
                if (heredocOp === '<<-') {
                     formattedLines.push('\t'.repeat(indentLevel) + trimmed);
                } else {
                    formattedLines.push(trimmed);
                }
            } else {
                formattedLines.push(fullLine);
            }
            return;
        }

        const interestingTokens = lineTokens.filter(t => t.type !== TokenType.Whitespace);

        if (interestingTokens.length === 0) {
            if (lineTokens.some(t => t.type === TokenType.Comment)) {
                 const comment = lineTokens.find(t => t.type === TokenType.Comment);
                 if (comment) {
                     formattedLines.push('  '.repeat(indentLevel) + comment.text.trim());
                 }
            } else {
                formattedLines.push('');
            }
            return;
        }

        // Check for heredoc start
        for (let j = 0; j < interestingTokens.length; j++) {
            const t = interestingTokens[j];
            if (t.type === TokenType.HeredocStart) {
                heredocOp = t.text;
                if (j + 1 < interestingTokens.length) {
                    heredocDelimiter = interestingTokens[j + 1].text;
                    heredocDelimiter = heredocDelimiter.replace(/^['"]|['"]$/g, '');
                    inHeredoc = true;
                }
            }
        }

        const first = interestingTokens[0];

        // Dedent check BEFORE printing line
        const dedentKeywords = new Set(['fi', 'done', 'esac', '}', 'elif', 'else', ')', ']]', ']']);

        if (dedentKeywords.has(first.text)) {
            if (indentLevel > 0) indentLevel--;
            if (first.text === 'esac') {
                 if (contextStack.length > 0 && contextStack[contextStack.length-1] === 'case') {
                     contextStack.pop();
                 }
            }
        }

        let lineStr = '  '.repeat(indentLevel);

        for (let j = 0; j < interestingTokens.length; j++) {
            const t = interestingTokens[j];
            const prev = j > 0 ? interestingTokens[j-1] : null;
            const next = j + 1 < interestingTokens.length ? interestingTokens[j+1] : null;

            // Context tracking (start)
            if (t.text === '((' || t.text === '$(((' || t.text === '$((') {
                contextStack.push('arithmetic');
            } else if (t.text === '[[' || t.text === '[') {
                contextStack.push('test');
            } else if (t.text === 'case') {
                contextStack.push('case');
            }

            if (j > 0 && prev) {
                let space = ' ';
                const currentContext = contextStack.length > 0 ? contextStack[contextStack.length - 1] : null;
                const isArithmetic = currentContext === 'arithmetic';
                const isTest = currentContext === 'test';

                // Adjacency check
                const isAdjacent = (t.col === prev.col + prev.text.length);

                // Base rule: If adjacent, NO space. If not, Space.
                // This preserves concatenation semantics and flags logic.
                if (isAdjacent) {
                    space = '';
                } else {
                    space = ' ';
                }

                // --- Overrides to Enforce Beautification (Space) ---

                // 1. Comparison operators in Test context [[ ... ]]
                if (isTest) {
                    const ops = ['=', '!=', '==', '=~', '<', '>', '-eq', '-ne', '-gt', '-lt', '-ge', '-le'];
                    if (ops.includes(t.text) || ops.includes(prev.text)) {
                        space = ' ';
                    }
                }

                // 2. Arithmetic operators in Arithmetic context (( ... ))
                if (isArithmetic) {
                    const ops = ['+', '-', '*', '/', '%', '+=', '-=', '*=', '/=', '%=', '==', '!=', '<', '>', '<=', '>=', '=', '&', '|', '^', '<<', '>>'];
                    if (ops.includes(t.text) || ops.includes(prev.text)) {
                        // Exception: Unary operators? Difficult to detect perfectly.
                        // Assuming binary for now to be safe/standard.
                        space = ' ';
                    }
                    // Space around logic operators && || inside ((...))?
                    // Tokenizer treats && as Operator.
                    if (t.text === '&&' || t.text === '||' || prev.text === '&&' || prev.text === '||') space = ' ';
                }

                // 3. Keywords often need space even if adjacent?
                //    `if(` -> `if (`.
                if (['if', 'for', 'while', 'case', 'function', 'select'].includes(prev.text) && t.text === '(') {
                    space = ' ';
                }
                if (['if', 'for', 'while', 'case', 'function', 'select', 'elif'].includes(prev.text) && t.text === '[[') {
                    space = ' ';
                }
                if (prev.text === ']' && t.text === ';') space = ''; // `];` -> `];`. (handled by isAdjacent if strict, but maybe not)
                if (prev.text === ']]' && t.text === ';') space = '';

                // --- Overrides to Enforce No-Space (Tight) ---

                // 4. Semicolons
                if (t.text === ';' || t.text === ';;') space = '';

                // 5. Parens
                if (t.text === ')' && prev.text === '(') space = ''; // ()

                // 6. Command substitution $( ... )
                //    Force no space after $(
                if (prev.text === '$(') space = '';

                // 7. Parameter expansion ${ ... }
                //    Force no space after ${
                if (prev.text === '${') space = '';
                //    Force no space before } if simple var?
                if (t.text === '}' && prev.type === TokenType.Identifier && interestingTokens.some(tok => tok.text === '${')) {
                     // Only if adjacent?
                     // If user typed `${ VAR }`, keep spaces.
                     // But we want "Deep Formatting".
                     // If we are deep formatting, we prefer `${VAR}`.
                     // But safe approach: respect adjacency for insides of ${...}.
                     // The base rule `isAdjacent` handles this!
                     // If `${` and `VAR` adjacent -> no space.
                     // If `VAR` and `}` adjacent -> no space.
                     // If `${` space `VAR` -> space.
                     // This is acceptable preservation.
                }

                lineStr += space;
            }
            lineStr += t.text;

            // Context tracking (end)
            if (t.text === '))' && contextStack.length > 0 && contextStack[contextStack.length - 1] === 'arithmetic') {
                contextStack.pop();
            } else if ((t.text === ']]' || t.text === ']') && contextStack.length > 0 && contextStack[contextStack.length - 1] === 'test') {
                contextStack.pop();
            } else if (t.text === 'esac' && contextStack.length > 0 && contextStack[contextStack.length - 1] === 'case') {
                contextStack.pop();
            }
        }

        formattedLines.push(lineStr);

        // Indent check AFTER printing line
        const last = interestingTokens[interestingTokens.length - 1];

        if (['then', 'do', '{'].includes(last.text)) {
            indentLevel++;
        }
        else if (last.text === '(' && first.text !== 'function') {
             if (first.text === '(') indentLevel++;
        }
        else if (last.text === 'case' || (last.text === 'in' && interestingTokens.some(t => t.text === 'case'))) {
            indentLevel++;
        }
        else if (interestingTokens[0].text === '[[' && !interestingTokens.some(t => t.text === ']]')) {
            indentLevel++;
        }

        // Case pattern indent
        if (last.text === ')' && contextStack.length > 0 && contextStack[contextStack.length-1] === 'case') {
             const isFunc = interestingTokens.length >= 2 && interestingTokens[interestingTokens.length-2].text === '(';
             if (!isFunc) {
                 indentLevel++;
             }
        }

        // 'else', 'elif' indent (body)
        if (first.text === 'else') {
            indentLevel++;
        } else if (first.text === 'elif') {
             if (last.text !== 'then') {
                 indentLevel++;
             }
        }

        if (indentLevel < 0) indentLevel = 0;
    }

    return formattedLines.join('\n');
}
