import { Token, TokenType, tokenize } from './css_tokenizer';

interface CSSFormatterOptions {
    tabSize: number;
    insertSpaces: boolean;
}

export function formatCSSDeep(text: string, options: CSSFormatterOptions = { tabSize: 2, insertSpaces: true }): string {
    const tokens = tokenize(text);
    const indentString = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';

    let formatted = '';
    let indentLevel = 0;

    let buffer: Token[] = [];
    let parenLevel = 0;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === TokenType.ParenthesisOpen) parenLevel++;
        if (token.type === TokenType.ParenthesisClose && parenLevel > 0) parenLevel--;

        if (token.type === TokenType.BraceOpen) {
            // Start of Block
            const selectorStr = formatSelector(buffer);

            if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
            if (formatted.trim().endsWith('}')) formatted += '\n';

            formatted += getIndent(indentLevel, indentString) + selectorStr;
            if (selectorStr.length > 0) formatted += ' ';
            formatted += '{\n';

            indentLevel++;
            buffer = [];
        } else if (token.type === TokenType.BraceClose) {
            // End of Block
            if (buffer.length > 0) {
                 const propStr = formatProperty(buffer);
                 if (propStr.trim().length > 0) {
                     formatted += getIndent(indentLevel, indentString) + propStr + '\n';
                 }
            }
            buffer = [];

            if (indentLevel > 0) indentLevel--;
            formatted += getIndent(indentLevel, indentString) + '}\n';
        } else if (token.type === TokenType.Semicolon && parenLevel === 0) {
            // End of Property
            buffer.push(token);
            const propStr = formatProperty(buffer);
            if (propStr.trim().length > 0) {
                formatted += getIndent(indentLevel, indentString) + propStr + '\n';
            }
            buffer = [];
        } else if (token.type === TokenType.Comment) {
             if (buffer.every(t => t.type === TokenType.Whitespace)) {
                 // Standalone comment line (or buffer only has whitespace)
                 buffer = []; // Clear whitespace
                 formatted += getIndent(indentLevel, indentString) + token.value + '\n';
             } else {
                 buffer.push(token);
             }
        } else {
            buffer.push(token);
        }
    }

    if (buffer.length > 0) {
        // Flush remaining
        const str = formatProperty(buffer);
        if (str.trim().length > 0) {
            formatted += getIndent(indentLevel, indentString) + str + '\n';
        }
    }

    return formatted;
}

function getIndent(level: number, indentString: string): string {
    return indentString.repeat(Math.max(0, level));
}

function formatSelector(tokens: Token[]): string {
    let result = '';
    let hasSpace = false;

    // Trim leading/trailing whitespace tokens from buffer logic
    // But buffer might contain them.

    let meaningfulTokens = tokens.filter(t => t.type !== TokenType.Whitespace);
    if (meaningfulTokens.length === 0) return '';

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === TokenType.Whitespace) {
            hasSpace = true;
            continue;
        }

        // Decide if we output space before this token
        if (result.length > 0) {
            const prevTokenIndex = i - 1;
            // Find actual previous non-whitespace token
            let prevToken = tokens[prevTokenIndex];
            let k = prevTokenIndex;
            while (k >= 0 && prevToken.type === TokenType.Whitespace) {
                k--;
                prevToken = tokens[k];
            }

            if (prevToken) {
                 if (shouldAddSpaceSelector(prevToken, token, hasSpace)) {
                     result += ' ';
                 }
            }
        }

        result += token.value;
        hasSpace = false;
    }
    return result.trim();
}

function formatProperty(tokens: Token[]): string {
    let result = '';
    let hasSpace = false;
    let firstColonFound = false;
    let parenLevel = 0;

    let meaningfulTokens = tokens.filter(t => t.type !== TokenType.Whitespace);
    if (meaningfulTokens.length === 0) return '';

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === TokenType.Whitespace) {
            hasSpace = true;
            continue;
        }

        if (token.type === TokenType.ParenthesisOpen) parenLevel++;
        if (token.type === TokenType.ParenthesisClose && parenLevel > 0) parenLevel--;

        // Decide spacing
        if (result.length > 0) {
             const prevTokenIndex = i - 1;
             let prevToken = tokens[prevTokenIndex];
             let k = prevTokenIndex;
             while (k >= 0 && prevToken.type === TokenType.Whitespace) {
                 k--;
                 prevToken = tokens[k];
             }

             if (prevToken) {
                 if (shouldAddSpaceProperty(prevToken, token, hasSpace, firstColonFound)) {
                     result += ' ';
                 }
             }
        }

        result += token.value;
        hasSpace = false;

        if (token.type === TokenType.Colon && !firstColonFound && parenLevel === 0) {
            firstColonFound = true;
        }
    }
    return result.trim();
}

function shouldAddSpaceSelector(prev: Token, curr: Token, wasSpace: boolean): boolean {
    // Comma always needs space after
    if (prev.type === TokenType.Comma) return true;

    // Dot/Hash
    if (curr.type === TokenType.Dot || curr.type === TokenType.Hash) {
        // Space before . or # implies descendant if wasSpace is true
        // div .class vs div.class
        return wasSpace;
    }
    if (prev.type === TokenType.Dot || prev.type === TokenType.Hash) {
        // .class or #id -> No space even if wasSpace is true (fix bad formatting)
        return false;
    }

    // Colon (Pseudo)
    if (curr.type === TokenType.Colon) return false; // a:hover
    if (prev.type === TokenType.Colon) return false; // :hover

    // Operators (> + ~)
    if (isOperator(prev) || isOperator(curr)) {
        return true; // Force space around operators
    }

    // Words
    if (wasSpace) return true; // Keep semantic space

    return false;
}

function shouldAddSpaceProperty(prev: Token, curr: Token, wasSpace: boolean, firstColonFound: boolean): boolean {
    if (prev.type === TokenType.Comma) return true;

    // Colon
    if (prev.type === TokenType.Colon && !firstColonFound) return true; // prop: val (Space after first colon)

    // No space around other colons usually (url, progid)
    if (prev.type === TokenType.Colon) return false;
    if (curr.type === TokenType.Colon) return false;

    // !important
    if (curr.type === TokenType.Operator && curr.value === '!') return true; // space before !
    if (prev.type === TokenType.Operator && prev.value === '!') return false; // !important

    // / separator
    if (curr.type === TokenType.Operator && curr.value === '/') return false;
    if (prev.type === TokenType.Operator && prev.value === '/') return false;

    // Default operators
    if (isOperator(prev) || isOperator(curr)) return true;

    return wasSpace;
}

function isOperator(token: Token): boolean {
    return token.type === TokenType.Operator && token.value !== '!' && token.value !== '/';
}
