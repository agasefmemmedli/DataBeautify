import { ShellTokenizer, Token, TokenType } from './shell_tokenizer';

export function formatShellDeep(text: string): string {
    const tokenizer = new ShellTokenizer(text);
    const tokens = tokenizer.tokenize();
    const formattedLines: string[] = [];

    let indentLevel = 0;
    let inHeredoc = false;
    let heredocDelimiter = '';
    let heredocOp = '';

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
            const lineContent = lineTokens.map(t => t.text).join('');
            const trimmed = lineContent.trim();

            if (trimmed === heredocDelimiter) {
                inHeredoc = false;
                if (heredocOp === '<<-') {
                     formattedLines.push('\t'.repeat(indentLevel) + trimmed);
                } else {
                    formattedLines.push(trimmed);
                }
            } else {
                formattedLines.push(lineContent);
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
            if (t.text === '<<' || t.text === '<<-') {
                if (j + 1 < interestingTokens.length) {
                    heredocOp = t.text;
                    heredocDelimiter = interestingTokens[j + 1].text;
                    heredocDelimiter = heredocDelimiter.replace(/^['"]|['"]$/g, '');
                    inHeredoc = true;
                }
            }
        }

        const first = interestingTokens[0];
        const last = interestingTokens[interestingTokens.length - 1];

        // Dedent check
        const dedentKeywords = new Set(['fi', 'done', 'esac', '}', ']', ']]', ')']);

        if (dedentKeywords.has(first.text) || first.text === 'else' || first.text === 'elif' || first.text === ';;') {
            if (indentLevel > 0) indentLevel--;
        }

        // Reconstruct line
        let lineStr = '  '.repeat(indentLevel);

        for (let j = 0; j < interestingTokens.length; j++) {
            const t = interestingTokens[j];

            if (j > 0) {
                const prev = interestingTokens[j-1];
                let space = ' ';

                // No space after expansion start
                if (prev.text === '$' || prev.text === '${' || prev.text === '$(' || prev.text === '$((') space = '';

                // No space inside empty parens ()
                if (t.text === ')' && prev.text === '(') space = '';

                // Handling (
                if (t.text === '(' && (prev.type === TokenType.Identifier || prev.type === TokenType.Keyword)) {
                    if (prev.text === 'function') space = ' ';
                    else if (['if', 'for', 'while', 'case'].includes(prev.text)) space = ' ';
                    else space = ''; // cmd(arg) or func()
                }

                if (t.text === ';') space = '';
                if (t.text === ';;') space = '';

                if ([';', ';;'].includes(prev.text)) space = ' ';

                // Tight closing for expansions
                if (t.text === '}') {
                    // Check if line has ${
                    if (interestingTokens.some(tok => tok.text === '${')) space = '';
                }
                if (t.text === '))') {
                    if (interestingTokens.some(tok => tok.text === '$((' || tok.text === '((')) space = '';
                }

                lineStr += space;
            }
            lineStr += t.text;
        }

        formattedLines.push(lineStr);

        // Indent check for next line
        if (['then', 'do', '{', '(', 'case'].includes(last.text)) {
             indentLevel++;
        }
        else if (last.text === 'in' && interestingTokens.some(t => t.text === 'case')) {
            indentLevel++;
        }
        else if (first.text === 'function' || interestingTokens.some(t => t.text === '()')) {
             if (last.text === '{') {
                 indentLevel++;
             }
        }
        else if (interestingTokens.some(t => t.text === '[[') && !interestingTokens.some(t => t.text === ']]')) {
            indentLevel++;
        }

        if (first.text === 'else' || first.text === 'elif') {
            indentLevel++;
        }

        // Case pattern detection:
        // Indent on ')' if it's likely a case pattern
        // Heuristics:
        // 1. Not preceded by '(' (so not '()')
        // 2. Line does not contain '=' (so not 'arr=(...)')
        // 3. Not starting with keywords that use ')' like 'case', 'if', 'for'
        const hasAssignment = interestingTokens.some(t => t.text === '=');
        const isEmptyParens = last.text === ')' && interestingTokens.length > 1 && interestingTokens[interestingTokens.length - 2].text === '(';

        if (last.text === ')' && !isEmptyParens && !hasAssignment && !['case', 'if', 'for', 'while'].includes(first.text)) {
             indentLevel++;
        }

        if (indentLevel < 0) indentLevel = 0;
    }

    return formattedLines.join('\n');
}
