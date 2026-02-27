
import { SwiftTokenizer, Token, TokenType } from './swift_tokenizer';

enum ContextType {
    Block,       // { ... }
    Paren,       // ( ... )
    Array,       // [ ... ]
    Switch,      // switch ... { ... }
    Case,        // case ...:
    Generic,     // < ... >
    Control,     // if, guard, while
}

interface Context {
    type: ContextType;
    startLine: number;
    indent: number;
    isSwitch?: boolean;
}

class TokenStream {
    private tokens: Token[];
    private pos: number = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    peek(offset: number = 0): Token | null {
        if (this.pos + offset < this.tokens.length) {
            return this.tokens[this.pos + offset];
        }
        return null;
    }

    current(): Token | null {
        return this.peek(0);
    }

    advance(): Token | null {
        if (this.pos < this.tokens.length) {
            return this.tokens[this.pos++];
        }
        return null;
    }
}

export function formatSwiftDeep(text: string): string {
    const tokenizer = new SwiftTokenizer(text);
    const rawTokens = tokenizer.tokenize();
    // Filter whitespace but keep newlines
    const tokens = rawTokens.filter(t => t.type !== TokenType.Whitespace);

    if (tokens.length === 0) return '';

    const stream = new TokenStream(tokens);
    const outputLines: string[] = [];
    let currentLine = '';
    let indentLevel = 0;
    const TAB = '    ';

    const contextStack: Context[] = [];
    const currentContext = () => contextStack.length > 0 ? contextStack[contextStack.length - 1] : null;

    let newlinePending = 0; // 0=none, 1=newline, 2=blank line
    let spacePending = false;

    // Import Sorting
    let importBuffer: string[] = [];
    const flushImports = () => {
        if (importBuffer.length > 0) {
            importBuffer.sort();
            outputLines.push(...importBuffer);
            importBuffer = [];
        }
    };

    const pushLine = () => {
        const trimmed = currentLine.trimEnd();
        if (trimmed.length > 0) {
            if (trimmed.startsWith('import ') && indentLevel === 0) {
                importBuffer.push(trimmed);
            } else {
                flushImports();
                outputLines.push(trimmed);
            }
        }
        currentLine = '';
        spacePending = false;
    };

    const getIndentString = (level: number) => TAB.repeat(Math.max(0, level));

    let lastToken: Token | null = null;
    let penultimateToken: Token | null = null; // For deeper lookbehind

    while (stream.current()) {
        const token = stream.current()!;
        const nextToken = stream.peek(1);

        // --- Newline Handling ---
        if (token.type === TokenType.Newline) {
            const count = (token.text.match(/\n/g) || []).length;
            if (count > 1) {
                newlinePending = 2;
            } else if (newlinePending === 1) {
                newlinePending = 2;
            } else if (newlinePending === 0) {
                newlinePending = 1;
            }
            stream.advance();
            continue;
        }

        if (newlinePending > 0) {
            pushLine();
            if (newlinePending > 1 && outputLines.length > 0 && outputLines[outputLines.length - 1] !== '') {
                outputLines.push('');
            }
            newlinePending = 0;

            // Calculate Indent for New Line
            let lineIndent = indentLevel;

            // Adjust indent for closing tokens at start of line
            if (token.text === '}') {
                const ctx = currentContext();
                if (ctx && (ctx.type === ContextType.Block || ctx.type === ContextType.Switch)) {
                    lineIndent = ctx.indent;
                } else {
                     lineIndent = Math.max(0, indentLevel - 1);
                }
            } else if (token.text === ']' || token.text === ')') {
                const ctx = currentContext();
                if (ctx && (ctx.type === ContextType.Array || ctx.type === ContextType.Paren)) {
                    lineIndent = ctx.indent;
                } else {
                    lineIndent = Math.max(0, indentLevel - 1);
                }
            } else if (token.text === 'case' || token.text === 'default') {
                const ctx = currentContext();
                if (ctx && ctx.type === ContextType.Switch) {
                    lineIndent = ctx.indent;
                }
            } else {
                // Check if we are inside a Control statement (guard/if conditions)
                const ctx = currentContext();
                if (ctx && ctx.type === ContextType.Control) {
                    lineIndent = ctx.indent + 1;
                }
            }

            currentLine = getIndentString(lineIndent);
        }

        // --- Context Management ---

        // Control Flow Start
        if (['if', 'guard', 'while'].includes(token.text)) {
            contextStack.push({
                type: ContextType.Control,
                startLine: outputLines.length,
                indent: indentLevel
            });
        }

        // Control Flow End (else or {)
        if (token.text === 'else') {
             const ctx = currentContext();
             if (ctx && ctx.type === ContextType.Control) {
                 contextStack.pop();
             }
        }

        if (token.text === '{') {
            // If previous was Control context, pop it (end of conditions)
            const ctx = currentContext();
            if (ctx && ctx.type === ContextType.Control) {
                contextStack.pop();
            }

            let isSwitch = false;
            // Check if last non-newline token was 'switch'
            if (lastToken && lastToken.text === 'switch') isSwitch = true;
            // Or if line starts with switch
            if (currentLine.trim().startsWith('switch')) isSwitch = true;

            contextStack.push({
                type: isSwitch ? ContextType.Switch : ContextType.Block,
                startLine: outputLines.length,
                indent: indentLevel,
                isSwitch: isSwitch
            });

            if (currentLine.length > 0 && !currentLine.endsWith(' ')) currentLine += ' ';
            currentLine += '{';
            spacePending = false;
            indentLevel++;

            stream.advance();
            penultimateToken = lastToken;
            lastToken = token;
            continue;
        }

        if (token.text === '}') {
            const ctx = contextStack.pop();
            if (ctx) {
                indentLevel = ctx.indent;
            } else {
                indentLevel = Math.max(0, indentLevel - 1);
            }

            if (spacePending && currentLine.length > 0 && !currentLine.endsWith(' ')) currentLine += ' ';
            currentLine += '}';

            spacePending = true; // Default space after }
            if (nextToken && [')', ']', ',', ';', '.'].includes(nextToken.text)) {
                spacePending = false;
            }

            stream.advance();
            penultimateToken = lastToken;
            lastToken = token;
            continue;
        }

        if (token.text === '(' || token.text === '[') {
            const isParen = token.text === '(';
            contextStack.push({
                type: isParen ? ContextType.Paren : ContextType.Array,
                startLine: outputLines.length,
                indent: indentLevel
            });

            if (spacePending) {
                if (lastToken && lastToken.type === TokenType.Identifier) {
                     if (['if', 'while', 'for', 'switch', 'guard', 'catch'].includes(lastToken.text)) {
                         // Space
                     } else {
                         spacePending = false;
                     }
                } else if (lastToken && ['init', 'subscript'].includes(lastToken.text)) {
                    spacePending = false;
                } else if (lastToken && (lastToken.text === ']' || lastToken.text === ')')) {
                     spacePending = false;
                }
            }

            if (spacePending && currentLine.length > 0 && !currentLine.endsWith(' ')) currentLine += ' ';
            currentLine += token.text;
            spacePending = false;

            stream.advance();
            penultimateToken = lastToken;
            lastToken = token;
            continue;
        }

        if (token.text === ')' || token.text === ']') {
            const ctx = contextStack.pop();

            currentLine += token.text;
            spacePending = false;

            if (nextToken && nextToken.text === '{') spacePending = true;
            if (nextToken && nextToken.text === '->') spacePending = true;

            stream.advance();
            penultimateToken = lastToken;
            lastToken = token;
            continue;
        }

        // --- Keywords & Identifiers ---

        if (token.text === 'case' || token.text === 'default') {
             if (spacePending && currentLine.length > 0 && !currentLine.endsWith(' ')) currentLine += ' ';
             currentLine += token.text;
             spacePending = true; // space required (case pattern)
             stream.advance();
             penultimateToken = lastToken;
             lastToken = token;
             continue;
        }

        if (token.text === ':') {
             currentLine += ':';
             spacePending = true;

             // Indentation adjustment for case body
             const ctx = currentContext();
             if (ctx && ctx.type === ContextType.Switch) {
                 if (/^\s*(case|default)\b/.test(currentLine)) {
                     indentLevel = ctx.indent + 1;
                 }
             }

             stream.advance();
             penultimateToken = lastToken;
             lastToken = token;
             continue;
        }

        if (token.text === ',') {
            currentLine += ',';
            spacePending = true;
            stream.advance();
            penultimateToken = lastToken;
            lastToken = token;
            continue;
        }

        if (token.text === ';') {
            currentLine += ';';
            spacePending = true;
            newlinePending = 1;
            stream.advance();
            penultimateToken = lastToken;
            lastToken = token;
            continue;
        }

        // --- Generics ---
        if (token.text === '<') {
             let isGeneric = false;
             if (lastToken) {
                 if (['Array', 'Dictionary', 'Set', 'Optional', 'Result'].includes(lastToken.text)) isGeneric = true;
                 else if (lastToken.type === TokenType.Identifier) {
                     // Heuristic: Capitalized -> Type -> Generic
                     if (/^[A-Z]/.test(lastToken.text)) isGeneric = true;

                     // Exception: `func foo<T>`
                     // Check penultimate token
                     if (penultimateToken && ['func', 'init', 'subscript', 'typealias'].includes(penultimateToken.text)) {
                         isGeneric = true;
                     }
                 }
             }

             if (isGeneric) {
                 contextStack.push({ type: ContextType.Generic, startLine: 0, indent: 0 });
                 currentLine += '<';
                 spacePending = false;
             } else {
                 // Operator <
                 if (currentLine.length > 0 && !currentLine.endsWith(' ')) currentLine += ' ';
                 currentLine += '<';
                 spacePending = true;
             }
             stream.advance();
             penultimateToken = lastToken;
             lastToken = token;
             continue;
        }

        if (token.text === '>' || token.text === '>>') {
             const ctx = currentContext();
             if (ctx && ctx.type === ContextType.Generic) {
                 if (token.text === '>>') {
                     contextStack.pop();
                     const ctx2 = currentContext();
                     if (ctx2 && ctx2.type === ContextType.Generic) {
                         contextStack.pop();
                     }
                     currentLine += '>>';
                 } else {
                     contextStack.pop();
                     currentLine += '>';
                 }
                 spacePending = true;
                 if (nextToken && nextToken.text === '(') spacePending = false;
             } else {
                 // Operator >
                 if (currentLine.length > 0 && !currentLine.endsWith(' ')) currentLine += ' ';
                 currentLine += token.text;
                 spacePending = true;
             }
             stream.advance();
             penultimateToken = lastToken;
             lastToken = token;
             continue;
        }

        // --- Operators ---
        if (token.type === TokenType.Operator) {
            let isBinary = true;
            if (['!', '?'].includes(token.text)) isBinary = false;

            if (lastToken) {
                 if (['(', '[', '{', ',', ':', '=', 'return', 'case', 'if', 'while', 'guard'].includes(lastToken.text)) isBinary = false;
                 if (lastToken.type === TokenType.Operator && !['>', '<'].includes(lastToken.text)) isBinary = false;
            } else {
                isBinary = false;
            }

            if (token.text === '->') isBinary = true;

            if (isBinary) {
                if (currentLine.length > 0 && !currentLine.endsWith(' ')) currentLine += ' ';
                currentLine += token.text;
                spacePending = true;
            } else {
                if (['?', '!'].includes(token.text)) {
                     // Exclude keywords except `try`
                     const isKeyword = lastToken && lastToken.type === TokenType.Keyword;
                     const allowedKeyword = lastToken && ['try', 'self'].includes(lastToken.text);

                     if (lastToken && (lastToken.type === TokenType.Identifier || (isKeyword && allowedKeyword) || [')', ']', '}', '"'].includes(lastToken.text))) {
                        // Postfix
                        currentLine += token.text;
                        spacePending = true;
                        if (nextToken && (nextToken.text === '.' || nextToken.text === ')' || nextToken.text === ',' || nextToken.text === '(')) spacePending = false;
                     } else {
                        // Prefix (e.g. !isEmpty)
                        if (spacePending && currentLine.length > 0 && !currentLine.endsWith(' ')) currentLine += ' ';
                        currentLine += token.text;
                        spacePending = false;
                     }
                } else {
                    if (spacePending && currentLine.length > 0 && !currentLine.endsWith(' ')) currentLine += ' ';
                    currentLine += token.text;
                    spacePending = false;
                }
            }

            stream.advance();
            penultimateToken = lastToken;
            lastToken = token;
            continue;
        }

        // --- Default Token Handling ---

        if (token.text === '.') {
             if (spacePending) {
                 // Suppress space if previous token was identifier or closing paren/bracket/brace/string/init
                 let suppressSpace = false;
                 if (lastToken) {
                     if (lastToken.type === TokenType.Identifier) suppressSpace = true;
                     if ([')', ']', '}', '"', "'", '?'].includes(lastToken.text)) suppressSpace = true;
                     if (['super', 'self', 'Self', 'init'].includes(lastToken.text)) suppressSpace = true;
                 }

                 if (!suppressSpace && currentLine.length > 0 && !currentLine.endsWith(' ')) {
                     currentLine += ' ';
                 }
             }

             currentLine += '.';
             spacePending = false;
             stream.advance();
             penultimateToken = lastToken;
             lastToken = token;
             continue;
        }

        if (token.type === TokenType.Comment) {
             if (spacePending && currentLine.length > 0 && !currentLine.endsWith(' ')) currentLine += ' ';
             currentLine += token.text;
             spacePending = true;
             stream.advance();
             penultimateToken = lastToken;
             lastToken = token;
             continue;
        }

        if (spacePending && currentLine.length > 0 && !currentLine.endsWith(' ')) currentLine += ' ';
        currentLine += token.text;

        spacePending = true;
        if (token.text === '.') spacePending = false;

        stream.advance();
        penultimateToken = lastToken;
        lastToken = token;
    }

    pushLine();
    flushImports(); // Ensure imports are flushed if file ends without newline
    return outputLines.join('\n');
}
