import { tokenize, Token } from './powershell_tokenizer';

class TokenStream {
    private tokens: Token[];
    private position: number;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
        this.position = 0;
    }

    public peek(offset: number = 0): Token | null {
        if (this.position + offset >= this.tokens.length) return null;
        return this.tokens[this.position + offset];
    }

    public next(): Token | null {
        if (this.position >= this.tokens.length) return null;
        return this.tokens[this.position++];
    }

    public hasMore(): boolean {
        return this.position < this.tokens.length;
    }
}

export function formatPowerShellDeep(text: string): string {
    const tokens = tokenize(text);
    if (tokens.length === 0) return '';

    const stream = new TokenStream(tokens);
    let formatted = '';
    let indentLevel = 0;
    const indentString = '    '; // 4 spaces standard
    let lastToken: Token | null = null;
    let newlinePending = 0; // 0: none, 1: strict newline, 2: blank line
    let spacePending = false;
    let lastTokenIsUnary = false;
    let inPipeline = false;

    // Track context
    const stack: string[] = [];

    function getIndent(): string {
        return indentString.repeat(Math.max(0, indentLevel + (inPipeline ? 1 : 0)));
    }

    function append(str: string) {
        if (newlinePending > 0) {
            if (formatted.length > 0) {
                formatted = formatted.trimEnd();
                formatted += '\n'.repeat(newlinePending);
            }
            formatted += getIndent();
            newlinePending = 0;
            spacePending = false;
        } else if (spacePending && formatted.length > 0 && !formatted.endsWith(' ') && !formatted.endsWith('\n')) {
            formatted += ' ';
            spacePending = false;
        }
        formatted += str;
    }

    const isWord = (t: Token) => ['Identifier', 'Keyword', 'Variable', 'String', 'Unknown'].includes(t.type);

    while (stream.hasMore()) {
        const token = stream.next()!;

        // 1. Handle Whitespace/Comments
        if (token.type === 'Whitespace') {
            const newlines = (token.value.match(/\n/g) || []).length;
            if (newlines > 0) {
                 if (newlinePending === 0) {
                     newlinePending = newlines > 1 ? 2 : 1;
                 } else if (newlines > 1) {
                     newlinePending = 2;
                 }

                 // Check for statement termination to reset pipeline
                 if (lastToken) {
                     const isOperator = lastToken.type === 'Operator' ||
                                        ['|', ',', '.', '::', '(', '[', '{', '='].includes(lastToken.value);
                     if (!isOperator) {
                         inPipeline = false;
                     }
                 }
            } else {
                spacePending = true;
            }
            continue;
        }

        if (token.type === 'Comment') {
            if (!newlinePending && formatted.length > 0 && !formatted.endsWith('\n')) {
                spacePending = true;
            }
            append(token.value);
            // Comments usually force newline after, unless block comment?
            if (token.value.startsWith('#') && !token.value.startsWith('<#')) {
                newlinePending = 1;
            } else if (token.value.startsWith('<#')) {
                if (token.value.includes('\n')) newlinePending = 1;
                else spacePending = true;
            }
            lastToken = token;
            lastTokenIsUnary = false;
            continue;
        }

        // 2. Prepare Value (Case Normalization)
        let value = token.value;
        if (token.type === 'Keyword') {
            value = value.toLowerCase();
        } else if (token.type === 'Identifier') {
             // Cmdlet PascalCase (Verb-Noun)
             if (/^[a-z]+-[a-z]+$/i.test(value)) {
                 value = value.replace(/\b\w/g, c => c.toUpperCase()).replace(/-\w/g, c => c.toUpperCase());
             }
        }

        // 3. Logic: Before Append (Dedents)

        // Dedent on Closing
        if (value === '}' || value === ')' || value === ']') {
            if (stack.length > 0) {
                 const ctx = stack[stack.length - 1];
                 if ((value === '}' && (ctx === 'Block' || ctx === 'Hash')) ||
                     (value === ')' && (ctx === 'Paren' || ctx === 'Array')) ||
                     (value === ']' && ctx === 'Index')) {
                     stack.pop();
                     indentLevel = Math.max(0, indentLevel - 1);
                 }
            }

            if (value === '}') {
                 // Empty block check
                 if (lastToken && lastToken.value === '{') {
                     newlinePending = 0;
                     spacePending = false;
                 } else {
                     // Don't newline if pipe follows
                     const next = stream.peek();
                     if (next && next.value === '|') {
                         newlinePending = 0;
                         spacePending = true;
                     } else if (!newlinePending) {
                         newlinePending = 1;
                     }
                 }
                 // Reset pipeline on block end (usually ends statement)
                 inPipeline = false;
            }
        }

        // 4. Determine Spacing

        // Helper to determine if current token is unary
        const isUnary = (curr: Token, prev: Token | null) => {
            if (curr.type !== 'Operator') return false;
            const val = curr.value.toLowerCase();
            if (!['-', '+', '!', 'not', '-not', '-bnot'].includes(val)) return false;

            // Check context
            if (!prev) return true; // Start of file
            const type = prev.type;
            const pVal = prev.value;

            if (['Operator', 'Keyword', 'Punctuation'].includes(type)) {
                // Check specific punctuation closures that imply binary
                if (type === 'Punctuation' && [')', ']', '}'].includes(pVal)) return false;
                return true;
            }
            return false;
        };

        const currentIsUnary = isUnary(token, lastToken);

        // Calculate addSpace
        let addSpace: boolean = spacePending;

        if (lastToken) {
            // Word + Word -> Space
            if (isWord(lastToken) && isWord(token)) addSpace = true;

            // Keyword + ( -> Space
            if (lastToken.type === 'Keyword' && value === '(') addSpace = true;

            // ) + { -> Space
            if (lastToken.value === ')' && value === '{') addSpace = true;
        }

        // Operator Spacing
        if (token.type === 'Operator') {
             if (['.', '::', '..'].includes(value)) {
                 addSpace = false;
                 if (formatted.endsWith(' ')) formatted = formatted.slice(0, -1);
             } else {
                 // Space before operator (both unary and binary usually)
                 // Exception: ( -unary
                 if (lastToken && (lastToken.value === '(' || lastToken.value === '[' || lastToken.value === '{')) {
                     addSpace = false;
                 } else {
                     addSpace = true;
                 }
             }
        }

        // Previous Operator Spacing (Space After)
        if (lastToken && lastToken.type === 'Operator') {
             if (['.', '::', '..'].includes(lastToken.value)) {
                 addSpace = false;
             } else {
                 // If last was Unary -> NO space after (unless named operator like -not)
                 if (lastTokenIsUnary) {
                     if (/^-[a-z]/i.test(lastToken.value)) {
                         addSpace = true;
                     } else {
                         addSpace = false;
                     }
                 } else {
                     // Binary -> Space after
                     addSpace = true;
                 }
             }
        }

        // Punctuation Spacing
        if (value === ',' || value === ';') {
             addSpace = false;
             if (formatted.endsWith(' ')) formatted = formatted.slice(0, -1);
        }

        // Update spacePending
        spacePending = addSpace;

        // OTBS: } else {
        if (['else', 'elseif', 'catch', 'finally', 'process', 'begin', 'end'].includes(value) && token.type === 'Keyword') {
            if (lastToken && lastToken.value === '}') {
                 newlinePending = 0;
                 spacePending = true;
            } else {
                 if (!newlinePending) newlinePending = 1;
            }
        }

        // 5. Append
        append(value);

        // 6. Logic: After Append (Indents, Newlines)

        // Indent on Opening
        if (value === '{') {
            stack.push('Block');
            indentLevel++;
            newlinePending = 1;
            if (lastToken && lastToken.value === '@') {
                stack.pop();
                stack.push('Hash');
            }
        } else if (value === '(') {
            stack.push('Paren');
            indentLevel++;
            if (lastToken && lastToken.value === '@') {
                stack.pop();
                stack.push('Array');
            }
        } else if (value === '[') {
             stack.push('Index');
             indentLevel++;
        }

        // Newline after specific tokens
        if (value === ';') {
            newlinePending = 1;
            inPipeline = false;
        } else if (value === '|') {
            newlinePending = 1;
            inPipeline = true;
        } else if (value === ',') {
            spacePending = true;
        }

        lastToken = token;
        lastTokenIsUnary = currentIsUnary;
    }

    return alignAssignments(formatted + '\n');
}

function alignAssignments(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];
    let groupStart = -1;

    const flushGroup = () => {
        if (groupStart === -1) return;
        const endIndex = result.length;
        if (endIndex - groupStart > 1) { // Only align if there are consecutive lines
            const group = result.slice(groupStart, endIndex);

            // Find the maximum index of '=' in the group
            let maxEqualsIndex = 0;
            for (const line of group) {
                const equalsIndex = line.indexOf(' = ');
                if (equalsIndex > maxEqualsIndex) {
                    maxEqualsIndex = equalsIndex;
                }
            }

            // Align all lines in the group
            for (let i = 0; i < group.length; i++) {
                const line = group[i];
                const equalsIndex = line.indexOf(' = ');
                if (equalsIndex !== -1) {
                    const padding = ' '.repeat(maxEqualsIndex - equalsIndex);
                    result[groupStart + i] = line.slice(0, equalsIndex) + padding + ' = ' + line.slice(equalsIndex + 3);
                }
            }
        }
        groupStart = -1;
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Match standard variable assignment: $var = ... or [type]$var = ...
        // and ignore multi-line structures like hashtables or blocks for simplicity
        if (trimmed.startsWith('$') || trimmed.startsWith('[')) {
            const equalsIndex = line.indexOf(' = ');
            // Ensure there is a '=' and it's not inside a string or comment
            if (equalsIndex !== -1 && !trimmed.startsWith('#')) {
                if (groupStart === -1) {
                    groupStart = i;
                }
            } else {
                flushGroup();
            }
        } else {
            flushGroup();
        }
        result.push(line);
    }
    flushGroup();

    return result.join('\n');
}
