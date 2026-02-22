
import { RustTokenizer, Token, TokenType } from './rust_tokenizer';

interface Line {
    tokens: Token[];
    isEmpty: boolean;
}

export function formatRustDeep(text: string): string {
    const tokenizer = new RustTokenizer(text);
    const allTokens = tokenizer.tokenize();

    const tokens: Token[] = [];
    for (const token of allTokens) {
        if (token.type !== TokenType.Whitespace && token.type !== TokenType.Newline) {
            tokens.push(token);
        }
    }

    if (tokens.length === 0) return '';

    const outputLines: string[] = [];
    let currentLine = '';
    let indentLevel = 0;

    // Context
    let inGenerics = 0;
    let inClosureParams = false;
    let inWhereClause = false;

    const delimiterStack: string[] = []; // Track { [ (

    const TAB = '    '; // 4 spaces

    const append = (text: string) => {
        if (currentLine === '') {
            currentLine = TAB.repeat(indentLevel);
        }
        currentLine += text;
    };

    const pushLine = () => {
        if (currentLine.trim().length > 0) {
            outputLines.push(currentLine);
        }
        currentLine = '';
    };

    const forceNewline = () => {
        if (currentLine.trim().length > 0) pushLine();
    };

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const prev = i > 0 ? tokens[i-1] : null;
        const next = i + 1 < tokens.length ? tokens[i+1] : null;
        const prevPrev = i > 1 ? tokens[i-2] : null;

        // --- 1. Indentation & Newlines (Pre) ---

        if (token.type === TokenType.Attribute) {
            forceNewline();
            append(token.text);
            forceNewline();
            continue;
        }

        if (token.text === '}') {
            indentLevel = Math.max(0, indentLevel - 1);
            forceNewline();

            if (inWhereClause) {
                inWhereClause = false;
                indentLevel = Math.max(0, indentLevel - 1);
            }
        }

        // Where Clause Start
        if (token.text === 'where' && token.type === TokenType.Keyword) {
            forceNewline();
            if (!inWhereClause) {
                inWhereClause = true;
                indentLevel++;
            }
        }

        // End of where clause
        if (inWhereClause && (token.text === '{' || token.text === ';')) {
            inWhereClause = false;
            indentLevel = Math.max(0, indentLevel - 1);
        }

        // Method Chaining: .method()
        if (token.text === '.' && prev && (prev.text === ')' || prev.text === '}' || prev.type === TokenType.String)) {
             forceNewline();
        }

        // --- 2. Spacing Logic ---
        let spaceBefore = false;

        if (prev) {
            // Identifier & Macro
            if (token.type === TokenType.Identifier || token.type === TokenType.Macro) {
                if (prev.type === TokenType.Keyword || prev.type === TokenType.Identifier ||
                    prev.type === TokenType.Number || prev.type === TokenType.String ||
                    prev.type === TokenType.Char || prev.type === TokenType.Lifetime ||
                    (prev.type === TokenType.Operator && !['.', '::', '!', '?', '&', '*'].includes(prev.text))
                   ) {
                    spaceBefore = true;
                }
                else if (prev.text === '}' || prev.text === ')' || prev.text === ']' || prev.text === ',' || prev.text === ';') spaceBefore = true;
                else if (prev.text === '->' || prev.text === '=>') spaceBefore = true;

                if (prev.text === '<' && inGenerics > 0) spaceBefore = false;

                if (inClosureParams) spaceBefore = false;
            }
            // Number
            else if (token.type === TokenType.Number) {
                if (prev.type === TokenType.Operator && !['.', '::', '..', '..='].includes(prev.text)) {
                     if (prev.text === '-') {
                         const isUnary = prevPrev && (prevPrev.type === TokenType.Operator || ['(', '[', '{', ',', ':', ';', 'return', 'else', '='].includes(prevPrev.text));
                         spaceBefore = !isUnary;
                     } else {
                         spaceBefore = true;
                     }
                }
                else if (prev.type === TokenType.Keyword || prev.text === ',' || prev.text === ';') spaceBefore = true;
            }
            // String / Char
            else if (token.type === TokenType.String || token.type === TokenType.Char) {
                if (prev.type === TokenType.Keyword || prev.text === ',' || prev.text === ';' || prev.text === ':') spaceBefore = true;
                else if (prev.type === TokenType.Operator && !['(', '[', '{', '.', '::'].includes(prev.text)) spaceBefore = true;
            }
            // Keyword
            else if (token.type === TokenType.Keyword) {
                spaceBefore = true;
                if (prev.text === '::') spaceBefore = false;
                if (prev.text === '.') spaceBefore = false;
                if (prev.text === '(' && inClosureParams) spaceBefore = false;
            }
            // Lifetime
            else if (token.type === TokenType.Lifetime) {
                if (prev.text === '&') spaceBefore = false;
                else if (prev.text === ',') spaceBefore = true;
                else spaceBefore = true;

                if (prev.text === '<' && inGenerics > 0) spaceBefore = false;
            }
            // Openers
            else if (token.text === '{') {
                if (prev.text === '::') spaceBefore = false;
                else spaceBefore = true;
            }
            else if (token.text === '(') {
                if (prev.type === TokenType.Identifier || prev.type === TokenType.Macro) {
                    if (['if', 'while', 'for', 'match', 'switch', 'catch'].includes(prev.text)) spaceBefore = true;
                    else spaceBefore = false;
                } else if (prev.type === TokenType.Keyword) {
                    spaceBefore = true;
                } else if (prev.text === '<') {
                    spaceBefore = false;
                } else if (prev.text === '(' || prev.text === '[') {
                    spaceBefore = false;
                } else {
                    spaceBefore = true;
                }
            }
            else if (token.text === '[') {
                if (prev.type === TokenType.Identifier) spaceBefore = false;
                else if (prev.text === '!' && prevPrev && prevPrev.type === TokenType.Identifier) spaceBefore = false;
                else if (prev.text === '(' || prev.text === '[') spaceBefore = false;
                else spaceBefore = true;
            }
            // Generics
            else if (token.text === '<') {
                let isGeneric = false;
                if (prev.text === '::' || prev.text === 'impl') isGeneric = true;
                else if (prev.type === TokenType.Identifier) {
                    if (prevPrev && ['fn', 'struct', 'enum', 'trait', 'type', 'impl'].includes(prevPrev.text)) {
                        isGeneric = true;
                    } else if (/^[A-Z]/.test(prev.text)) {
                        isGeneric = true;
                    }
                }

                if (isGeneric) {
                    spaceBefore = false;
                    inGenerics++;
                } else {
                    spaceBefore = true;
                }
            }
            else if (token.text === '>') {
                if (inGenerics > 0) {
                    spaceBefore = false;
                    inGenerics--;
                } else {
                    spaceBefore = true;
                }
            }
            // Punctuation
            else if (token.text === ',' || token.text === ';' || token.text === '.') {
                spaceBefore = false;
                if (token.text === '.' && prev.text === '.') spaceBefore = false;

                if (token.text === ',' && inClosureParams) spaceBefore = false;
            }
            else if (token.text === ':') {
                spaceBefore = false;
                if (inClosureParams) spaceBefore = false;
            }
            else if (token.text === '::') {
                spaceBefore = false;
            }
            // Operators
            else if (token.type === TokenType.Operator) {
                if (token.text === '|') {
                    if (!inClosureParams) {
                        if (['(', '[', '{', ',', 'return', ':', '=', 'in', 'move'].includes(prev.text) || prev.type === TokenType.Operator) {
                            inClosureParams = true;
                            spaceBefore = true;
                            if (prev.text === '(' || prev.text === '[') spaceBefore = false;
                        } else {
                             spaceBefore = true;
                        }
                    } else {
                        inClosureParams = false;
                        spaceBefore = false;
                    }
                }
                else if (['&', '*', '!', '?'].includes(token.text)) {
                     if (['(', '[', '{', '!', '&', '*', '?', '::', '.', '|'].includes(prev.text)) {
                         spaceBefore = false;
                     } else {
                         spaceBefore = true;
                     }

                     if (token.text === '!' && (prev.type === TokenType.Identifier || prev.type === TokenType.Macro)) {
                         spaceBefore = false;
                     }
                }
                else if (token.text === '..' || token.text === '..=') {
                    if (prev.type === TokenType.Identifier || prev.type === TokenType.Number || [')', ']', '}'].includes(prev.text)) {
                        spaceBefore = false;
                    } else {
                        spaceBefore = true;
                    }
                }
                else if (token.text === '->' || token.text === '=>') spaceBefore = true;
                else {
                    spaceBefore = true;
                }
            }

            // Overrides based on Previous
            if (prev.text === '(' || prev.text === '[' || prev.text === '{' || prev.text === '::') spaceBefore = false;
            if (prev.text === '.') spaceBefore = false;
            if (prev.text === '&' || prev.text === '!') spaceBefore = false;
            if (prev.type === TokenType.Macro) spaceBefore = false;
            if (prev.text === '..' || prev.text === '..=') spaceBefore = false;

            if (prev.text === 'macro_rules!') spaceBefore = true;

            // Inside closure params overrides
            if (inClosureParams) {
                 if (prev.text === '|') spaceBefore = false;
                 if (prev.text === ',' || prev.text === ':') spaceBefore = true;
            }
        }

        // --- 3. Append ---
        if (spaceBefore && currentLine.trim().length > 0) {
            append(' ');
        }
        append(token.text);

        // --- 4. Post-Processing (Stack & Newlines) ---

        if (token.text === '{' || token.text === '[' || token.text === '(') {
            delimiterStack.push(token.text);
        }
        else if (token.text === '}' || token.text === ']' || token.text === ')') {
            if (delimiterStack.length > 0) delimiterStack.pop();
        }

        if (token.text === '{') {
            indentLevel++;
            forceNewline();
        }
        else if (token.text === '}') {
            if (next && (next.text === ';' || next.text === ',')) {
                // Keep
            } else if (next && next.text === 'else') {
                append(' ');
            } else {
                forceNewline();
            }
        }
        else if (token.text === ';') {
            forceNewline();
        }
        else if (token.text === ',') {
            const currentBlock = delimiterStack.length > 0 ? delimiterStack[delimiterStack.length - 1] : '';

            if (inGenerics === 0 && currentBlock === '{' && !inClosureParams) {
                forceNewline();
            }
        }
        else if (token.type === TokenType.Comment) {
            forceNewline();
        }
    }

    forceNewline();

    return outputLines.join('\n');
}
