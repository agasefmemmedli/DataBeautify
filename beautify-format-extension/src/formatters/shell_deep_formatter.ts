import { ShellTokenizer, Token, TokenType } from './shell_tokenizer';

export function formatShellDeep(text: string): string {
    const tokenizer = new ShellTokenizer(text);
    const tokens = tokenizer.tokenize();
    const formattedLines: string[] = [];

    let indentLevel = 0;
    let inHeredoc = false;
    let heredocDelimiter = '';
    let heredocOp = '';

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

            if (j > 0 && prev) {
                let space = ' ';
                const currentContext = contextStack.length > 0 ? contextStack[contextStack.length - 1] : null;
                const isArithmetic = currentContext === 'arithmetic';
                const isTest = currentContext === 'test';

                const isAdjacent = (t.col === prev.col + prev.text.length);

                if (isAdjacent) {
                    space = '';
                } else {
                    space = ' ';
                }

                // 1. Comparison operators in Test context
                if (isTest) {
                    const ops = ['=', '!=', '==', '=~', '<', '>', '-eq', '-ne', '-gt', '-lt', '-ge', '-le', '-z', '-n', '&&', '||'];
                    if (ops.includes(t.text) || ops.includes(prev.text)) {
                        space = ' ';
                    }
                }

                // 2. Arithmetic operators
                if (isArithmetic) {
                    const ops = ['+', '-', '*', '/', '%', '+=', '-=', '*=', '/=', '%=', '==', '!=', '<', '>', '<=', '>=', '=', '&', '|', '^', '<<', '>>', '&&', '||'];
                    if (ops.includes(t.text) || ops.includes(prev.text)) {
                         space = ' ';
                    }
                }

                // 3. Redirection and Pipes
                if (['|', '||', '&&', '&>'].includes(t.text) || ['|', '||', '&&', '&>'].includes(prev.text)) {
                    space = ' ';
                }

                if (['>', '>>', '<', '<<', '<<-'].includes(t.text)) {
                     const isFD = /^\d+$/.test(prev.text);
                     if (isAdjacent && isFD) {
                         space = '';
                     } else {
                         space = ' ';
                     }
                }
                if (['>', '>>', '<', '<<', '<<-'].includes(prev.text)) {
                    space = ' ';
                }

                // 4. Assignments
                if (t.text === '=' && !isTest && !isArithmetic) {
                    space = '';
                }
                if (prev.text === '=' && !isTest && !isArithmetic) {
                    space = '';
                }

                // 5. Keywords
                if (['if', 'for', 'while', 'case', 'function', 'select', 'elif'].includes(prev.text)) {
                    if (['(', '[[', '[', '{'].includes(t.text)) {
                        space = ' ';
                    }
                }

                // 6. Tightness overrides
                if (t.text === ';' || t.text === ';;') space = '';
                if (t.text === ')' && prev.text === '(') space = '';
                if (prev.text === '$(') space = '';
                if (prev.text === '${') space = '';

                if (t.text === '}' && interestingTokens.some(tok => tok.text === '${')) {
                     if (isAdjacent) space = '';
                }

                lineStr += space;
            }

            if (t.text === '((' || t.text === '$(((' || t.text === '$((') {
                contextStack.push('arithmetic');
            } else if (t.text === '[[' || t.text === '[') {
                contextStack.push('test');
            } else if (t.text === 'case') {
                contextStack.push('case');
            }

            lineStr += t.text;

            if (t.text === '))' && contextStack.length > 0 && contextStack[contextStack.length - 1] === 'arithmetic') {
                contextStack.pop();
            } else if ((t.text === ']]' || t.text === ']') && contextStack.length > 0 && contextStack[contextStack.length - 1] === 'test') {
                contextStack.pop();
            } else if (t.text === 'esac' && contextStack.length > 0 && contextStack[contextStack.length - 1] === 'case') {
                contextStack.pop();
            }
        }

        formattedLines.push(lineStr);

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
             if (last.text !== ']]') indentLevel++;
        }

        if (last.text === ')' && contextStack.length > 0 && contextStack[contextStack.length-1] === 'case') {
             // Case pattern must have content before ')', e.g. "pattern)"
             // If line is just ")", it's a closing subshell/function paren.
             if (interestingTokens.length > 1) {
                 const isAssignment = interestingTokens.some(t => t.text === '=');
                 const isSubshellStart = first.text === '(';
                 const isFunction = interestingTokens.some(t => t.text === 'function') ||
                                    (interestingTokens.length >= 2 && interestingTokens[interestingTokens.length-2].text === '(');

                 if (!isAssignment && !isSubshellStart && !isFunction) {
                     indentLevel++;
                 }
             }
        }

        if (last.text === ';;') {
            if (indentLevel > 0) indentLevel--;
        }

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
