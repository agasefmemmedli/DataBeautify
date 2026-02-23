
import { SwiftTokenizer, Token, TokenType } from './swift_tokenizer';

enum ContextType {
    Block,       // { ... }
    Paren,       // ( ... )
    Array,       // [ ... ]
    Switch,      // switch ... { ... }
    Generic,     // < ... >
}

interface Context {
    type: ContextType;
    startLine: number;
    indent: number;
    isSwitch?: boolean;
}

export function formatSwiftDeep(text: string): string {
    const tokenizer = new SwiftTokenizer(text);
    const tokens = tokenizer.tokenize();

    if (tokens.length === 0) return '';

    const outputLines: string[] = [];
    let currentLine = '';
    let indentLevel = 0;

    const TAB = '    ';

    const contextStack: Context[] = [];
    const currentContext = () => contextStack.length > 0 ? contextStack[contextStack.length - 1] : null;

    let importBuffer: string[] = [];

    const flushImports = () => {
        if (importBuffer.length > 0) {
            importBuffer.sort();
            outputLines.push(...importBuffer);
            importBuffer = [];
        }
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
        } else {
            flushImports();
            if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== '') {
                outputLines.push('');
            }
        }
        currentLine = '';
    };

    const append = (str: string) => {
        if (currentLine === '') {
            currentLine = TAB.repeat(indentLevel);
        }
        currentLine += str;
    };

    let processedTokens: Token[] = [];
    for (const t of tokens) {
        if (t.type !== TokenType.Whitespace) {
            processedTokens.push(t);
        }
    }

    for (let i = 0; i < processedTokens.length; i++) {
        const token = processedTokens[i];
        const nextToken = i + 1 < processedTokens.length ? processedTokens[i + 1] : null;
        const prevToken = i > 0 ? processedTokens[i - 1] : null;

        if (token.type === TokenType.Newline) {
            pushLine();
            continue;
        }

        // --- Context Management ---

        if (token.text === '{') {
            let isSwitch = false;
            let k = i - 1;
            while (k >= 0) {
                if (processedTokens[k].type === TokenType.Newline) break;
                if (processedTokens[k].type === TokenType.Keyword && processedTokens[k].text === 'switch') {
                    isSwitch = true;
                    break;
                }
                k--;
            }

            contextStack.push({
                type: ContextType.Block,
                startLine: outputLines.length,
                indent: indentLevel,
                isSwitch: isSwitch
            });

            if (currentLine.trim().length > 0) append(' ');
            append('{');
            indentLevel++;
            continue;
        }

        if (token.text === '}') {
            const ctx = currentContext();
            if (ctx && ctx.type === ContextType.Block) {
                contextStack.pop();
                // Restore indent to context base indent
                indentLevel = ctx.indent;
            } else {
                indentLevel = Math.max(0, indentLevel - 1);
            }

            if (currentLine.trim().length > 0) {
                pushLine();
            }
            append('}');

            if (nextToken && ['else', 'catch'].includes(nextToken.text)) {
                append(' ');
            } else if (nextToken && [')', ']', ',', '.', ';'].includes(nextToken.text)) {
                // no newline
            } else {
                // newline
            }
            continue;
        }

        if (token.text === '(' || token.text === '[') {
            contextStack.push({
                type: token.text === '(' ? ContextType.Paren : ContextType.Array,
                startLine: outputLines.length,
                indent: indentLevel
            });
            append(token.text);
            continue;
        }

        if (token.text === ')' || token.text === ']') {
            const ctx = currentContext();
            if (ctx && (ctx.type === ContextType.Paren || ctx.type === ContextType.Array)) {
                contextStack.pop();
            }
            append(token.text);
            continue;
        }

        // Generics < >
        if (token.text === '<') {
            let isGeneric = false;
            // Strict Heuristic: Only if prev is Capitalized Identifier (Type) or Definition Keyword
            if (prevToken) {
                if (prevToken.type === TokenType.Identifier) {
                    const firstChar = prevToken.text[0];
                    if (firstChar >= 'A' && firstChar <= 'Z') {
                        isGeneric = true;
                    } else {
                        // Check if definition (func foo<T>)
                        let prevPrevIndex = i - 2;
                        while (prevPrevIndex >= 0 && processedTokens[prevPrevIndex].type === TokenType.Newline) prevPrevIndex--;
                        const prevPrev = prevPrevIndex >= 0 ? processedTokens[prevPrevIndex] : null;
                        if (prevPrev && ['func', 'init', 'subscript', 'typealias', 'associatedtype'].includes(prevPrev.text)) {
                            isGeneric = true;
                        }
                    }
                } else if (['Array', 'Dictionary', 'Set', 'Optional'].includes(prevToken.text)) { // Just in case Tokenizer types differ
                    isGeneric = true;
                }
            }

            if (isGeneric) {
                contextStack.push({
                    type: ContextType.Generic,
                    startLine: outputLines.length,
                    indent: indentLevel
                });
                append('<');
                continue;
            }
        }

        if (token.text === '>' || token.text === '>>') {
            const ctx = currentContext();
            if (ctx && ctx.type === ContextType.Generic) {
                if (token.text === '>') {
                    contextStack.pop();
                    append('>');
                    continue;
                } else if (token.text === '>>') {
                    contextStack.pop();
                    const ctx2 = currentContext();
                    if (ctx2 && ctx2.type === ContextType.Generic) {
                        contextStack.pop();
                    }
                    append('>>');
                    continue;
                }
            }
        }

        if (token.type === TokenType.Keyword && (token.text === 'case' || token.text === 'default')) {
            const ctx = currentContext();
            if (ctx && ctx.type === ContextType.Block && ctx.isSwitch) {
                // Indent case at base + 1
                indentLevel = ctx.indent + 1;

                if (currentLine.trim().length > 0) pushLine();
                append(token.text);
                continue;
            }
        }

        if (token.text === ':') {
            append(':');
            const ctx = currentContext();
            if (ctx && ctx.type === ContextType.Block && ctx.isSwitch) {
                if (/^\s*(case|default)\b/.test(currentLine)) {
                    indentLevel++;
                }
            }
            append(' ');
            continue;
        }

        if (token.text === ',') {
            append(',');
            append(' ');
            continue;
        }

        if (token.type === TokenType.Comment) {
            if (currentLine.trim().length > 0) append(' ');
            append(token.text);
            continue;
        }

        // --- Spacing Logic ---
        let spaceBefore = false;

        if (prevToken) {
            const prevIsKeyword = prevToken.type === TokenType.Keyword;
            const prevIsIdentifier = prevToken.type === TokenType.Identifier;
            const prevIsNumber = prevToken.type === TokenType.Number;
            const prevIsString = prevToken.type === TokenType.String;
            const prevIsOperator = prevToken.type === TokenType.Operator;
            // Punctuation: ( ) [ ] { } , : ; @ #
            const prevIsPunctuation = prevToken.type === TokenType.Punctuation;
            const prevIsAttribute = prevToken.type === TokenType.Attribute;

            const currIsKeyword = token.type === TokenType.Keyword;
            const currIsIdentifier = token.type === TokenType.Identifier;
            const currIsNumber = token.type === TokenType.Number;
            const currIsString = token.type === TokenType.String;
            const currIsOperator = token.type === TokenType.Operator;
            const currIsPunctuation = token.type === TokenType.Punctuation;
            const currIsAttribute = token.type === TokenType.Attribute;

            // 1. Words/Literals spacing
            if ((prevIsKeyword || prevIsIdentifier || prevIsNumber || prevIsString || prevIsAttribute) &&
                (currIsKeyword || currIsIdentifier || currIsNumber || currIsString || currIsAttribute)) {
                spaceBefore = true;
            }

            // 2. Operators
            if (currIsOperator) {
                if (['.', '?', '!'].includes(token.text)) {
                    spaceBefore = false;
                } else if (token.text === '->') {
                    spaceBefore = true;
                } else {
                    // Binary vs Unary
                    if (prevIsOperator) spaceBefore = false;
                    else if (['(', '[', '{', ',', ':', '='].includes(prevToken.text)) spaceBefore = false;
                    else if (prevIsKeyword && !['return', 'case', 'throw', 'if', 'guard', 'while', 'for', 'in', 'as', 'is', 'try'].includes(prevToken.text)) spaceBefore = false;
                    else spaceBefore = true;
                }
            }

            if (prevIsOperator) {
                if (['.', '?', '!'].includes(prevToken.text)) {
                    spaceBefore = false;
                } else if (prevToken.text === '->') {
                    spaceBefore = true;
                } else {
                    // Check if prev was unary
                    let prevPrevIndex = i - 2;
                    while (prevPrevIndex >= 0 && processedTokens[prevPrevIndex].type === TokenType.Newline) prevPrevIndex--;
                    const prevPrev = prevPrevIndex >= 0 ? processedTokens[prevPrevIndex] : null;

                    let prevWasUnary = false;
                    if (prevPrev) {
                        if (prevPrev.type === TokenType.Operator || ['(', '[', '{', ',', ':', '='].includes(prevPrev.text)) {
                            prevWasUnary = true;
                        }
                    } else {
                        prevWasUnary = true;
                    }

                    if (prevWasUnary) spaceBefore = false;
                    else spaceBefore = true;
                }
            }

            // 3. Punctuation
            if (token.text === '{') spaceBefore = true;

            if (['}', ')', ']'].includes(prevToken.text)) {
                if (currIsIdentifier || currIsKeyword || currIsOperator || currIsNumber || currIsString) {
                    spaceBefore = true;
                    // Exceptions
                    if (prevToken.text === ']' && token.text === '[') spaceBefore = false; // arr[0][1]
                    if (prevToken.text === ']' && (token.text === '.' || token.text === '?' || token.text === '!')) spaceBefore = false;
                }
            }

            if (token.text === '[') {
                if (prevIsIdentifier) spaceBefore = false;
                else if ([']', ')'].includes(prevToken.text)) spaceBefore = false;
                else spaceBefore = true;
            }

            // Overrides

            // case .active
            if (prevToken.text === 'case' && token.text === '.') spaceBefore = true;

            // guard !
            if (token.text === '!' && ['guard', 'if', 'while', 'return'].includes(prevToken.text)) spaceBefore = true;

            // Generics
            const ctx = currentContext();
            if (ctx && ctx.type === ContextType.Generic) {
                if (prevToken.text === '<') spaceBefore = false;
                if (token.text === '>') spaceBefore = false;
                if (token.text === '>>') spaceBefore = false;
            }

            // Attributes
            if (currIsAttribute && currentLine.trim().length > 0) pushLine();
        }

        if (spaceBefore && currentLine.length > 0 && !currentLine.endsWith(' ')) {
            append(' ');
        }

        append(token.text);

        if (token.text === '->') append(' ');
    }

    pushLine();
    flushImports();

    return outputLines.join('\n');
}
