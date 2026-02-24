import { PHPTokenizer, TokenType, Token } from './php_tokenizer';

interface FormattingOptions {
    tabSize?: number;
    insertSpaces?: boolean;
    sortImports?: boolean;
}

export function formatPHPDeep(code: string, options: FormattingOptions = {}): string {
    const tabSize = options.tabSize || 4;
    const insertSpaces = options.insertSpaces !== false;
    const indentString = insertSpaces ? ' '.repeat(tabSize) : '\t';

    const tokenizer = new PHPTokenizer(code);
    const tokens = tokenizer.tokenize().filter(t => t.type !== TokenType.Whitespace);

    const formattedLines: string[] = [];
    let currentLineTokens: Token[] = [];
    let indentLevel = 0;
    let parenDepth = 0;
    let lineStartParenDepth = 0;

    // Track brace context to enforce PSR-12
    let pendingBraceContext: 'class' | 'function' | 'control' | null = null;

    const peekNextCode = (index: number): Token | null => {
        for (let j = index + 1; j < tokens.length; j++) {
            if (tokens[j].type !== TokenType.Comment && tokens[j].type !== TokenType.Whitespace) {
                return tokens[j];
            }
        }
        return null;
    };

    let importBuffer: string[] = [];

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const prev = i > 0 ? tokens[i - 1] : null;

        // Determine context for upcoming brace
        if (token.type === TokenType.Keyword) {
            if (['class', 'interface', 'trait'].includes(token.text)) {
                pendingBraceContext = 'class';
            } else if (token.text === 'function') {
                pendingBraceContext = 'function';
            } else if (['if', 'else', 'elseif', 'while', 'do', 'for', 'foreach', 'switch', 'try', 'catch', 'finally'].includes(token.text)) {
                pendingBraceContext = 'control';
            }
        }

        // Handle Imports
        if (token.type === TokenType.Keyword && token.text === 'use' && (!prev || prev.text !== ')')) {
            let stmtTokens = [token];
            let j = i + 1;
            let hasSemicolon = false;
            while (j < tokens.length) {
                const t = tokens[j];
                stmtTokens.push(t);
                if (t.type === TokenType.Punctuation && t.text === ';') {
                    hasSemicolon = true;
                    break;
                }
                j++;
            }

            if (hasSemicolon) {
                if (currentLineTokens.length > 0) {
                    flushLine(formattedLines, currentLineTokens, indentLevel, indentString, lineStartParenDepth);
                    currentLineTokens = [];
                }

                const stmtStr = stmtTokens.map(t => t.text).join(' ')
                    .replace(/\s*\\\s*/g, '\\') // Remove spaces around backslash in imports
                    .replace(/\s*;\s*$/, ';')
                    .replace(/^use\s+/, 'use ');

                importBuffer.push(stmtStr);
                i = j;

                const nextT = peekNextCode(j);
                if (!nextT || nextT.text !== 'use' || (nextT.text === 'use' && tokens[j].text === ')')) {
                    if (options.sortImports !== false) {
                        importBuffer.sort();
                    }
                    importBuffer.forEach(s => formattedLines.push(getIndent(indentLevel, indentString) + s));
                    importBuffer = [];
                }
                continue;
            }
        }

        // Handle Inline HTML
        if (token.type === TokenType.InlineHTML) {
            if (currentLineTokens.length > 0) {
                flushLine(formattedLines, currentLineTokens, indentLevel, indentString, lineStartParenDepth);
                currentLineTokens = [];
            }
            formattedLines.push(token.text);
            continue;
        }

        // Brace/Block Logic - Dedent BEFORE processing
        if (token.text === '}') {
            indentLevel = Math.max(0, indentLevel - 1);
            if (currentLineTokens.length > 0) {
                flushLine(formattedLines, currentLineTokens, indentLevel + 1, indentString, lineStartParenDepth);
                currentLineTokens = [];
            }
        }
        if (['endif', 'endforeach', 'endwhile', 'endswitch', 'endfor'].includes(token.text)) {
            indentLevel = Math.max(0, indentLevel - 1);
             if (currentLineTokens.length > 0) {
                flushLine(formattedLines, currentLineTokens, indentLevel + 1, indentString, lineStartParenDepth);
                currentLineTokens = [];
            }
        }

        // Check for start of statement keywords (Flush BEFORE)
        if (token.type === TokenType.Keyword && currentLineTokens.length > 0) {
            const startKeywords = ['if', 'while', 'do', 'for', 'foreach', 'switch', 'try', 'return', 'echo', 'print', 'class', 'interface', 'trait', 'namespace', 'use'];
             if (startKeywords.includes(token.text)) {
                // Check exceptions
                const last = currentLineTokens[currentLineTokens.length - 1];
                let safeToFlush = true;

                if (token.text === 'if' && last.text === 'else') safeToFlush = false;
                if (token.text === 'while' && last.text === '}') safeToFlush = false; // do { } while

                if (safeToFlush) {
                    flushLine(formattedLines, currentLineTokens, indentLevel, indentString, lineStartParenDepth);
                    currentLineTokens = [];
                }
            } else if (token.text === 'function') {
                const last = currentLineTokens[currentLineTokens.length - 1];
                const modifiers = ['public', 'private', 'protected', 'static', 'abstract', 'final', 'function'];
                if (!modifiers.includes(last.text) && last.text !== '=') {
                    flushLine(formattedLines, currentLineTokens, indentLevel, indentString, lineStartParenDepth);
                    currentLineTokens = [];
                }
            } else if (['public', 'private', 'protected'].includes(token.text)) {
                 flushLine(formattedLines, currentLineTokens, indentLevel, indentString, lineStartParenDepth);
                 currentLineTokens = [];
            }
        }

        // Special handling for Opening Brace
        if (token.text === '{') {
            if (pendingBraceContext === 'class' || pendingBraceContext === 'function') {
                // PSR-12: Brace on next line for class/function
                if (currentLineTokens.length > 0) {
                    flushLine(formattedLines, currentLineTokens, indentLevel, indentString, lineStartParenDepth);
                    currentLineTokens = [];
                }
                formattedLines.push(getIndent(indentLevel, indentString) + '{');
                indentLevel++;
                pendingBraceContext = null;
                continue;
            } else {
                // Control structures or others: Same line
                currentLineTokens.push(token);
                indentLevel++;

                // Flush line immediately
                let flushLevel = indentLevel - 1; // Flush at parent level (the line containing {)
                flushLine(formattedLines, currentLineTokens, flushLevel, indentString, lineStartParenDepth);
                currentLineTokens = [];
                pendingBraceContext = null;
                continue;
            }
        }

        if (currentLineTokens.length === 0) {
            lineStartParenDepth = parenDepth;
        }
        currentLineTokens.push(token);
        if (token.text === '(') parenDepth++;
        if (token.text === ')') parenDepth--;

        // Check if we should flush line
        let shouldFlush = false;

        if (token.type === TokenType.Comment) {
            if (token.text.startsWith('//') || token.text.startsWith('#')) {
                shouldFlush = true;
            } else if (token.text.includes('\n')) {
                 shouldFlush = true;
            }
        } else if (token.text === '}') {
            const next = peekNextCode(i);
            if (next && ['else', 'elseif', 'catch', 'finally'].includes(next.text)) {
                shouldFlush = false;
            } else {
                shouldFlush = true;
            }
        } else if (token.text === ';') {
            let parenBalance = 0;
            for (const t of currentLineTokens) {
                if (t.text === '(') parenBalance++;
                if (t.text === ')') parenBalance--;
            }
            if (parenBalance === 0) {
                shouldFlush = true;
            }
        } else if (token.type === TokenType.OpenTag) {
            shouldFlush = true;
        } else if (token.type === TokenType.CloseTag) {
            shouldFlush = true;
        } else if (token.text === ':' && prev && ['case', 'default'].includes(prev.text)) {
             shouldFlush = true;
             indentLevel++;
        }

        // Check for trailing comments to avoid premature flush
        if (shouldFlush) {
            const nextToken = i + 1 < tokens.length ? tokens[i + 1] : null;
            if (nextToken && nextToken.type === TokenType.Comment && nextToken.line === token.line) {
                shouldFlush = false;
            }
        }

        if (shouldFlush) {
            let flushLevel = indentLevel;
            if (token.text === ':' && prev && ['case', 'default'].includes(prev.text)) flushLevel--;

            flushLine(formattedLines, currentLineTokens, flushLevel, indentString, lineStartParenDepth);
            currentLineTokens = [];
        }
    }

    if (currentLineTokens.length > 0) {
        flushLine(formattedLines, currentLineTokens, indentLevel, indentString, lineStartParenDepth);
    }

    return formattedLines.join('\n');
}

function flushLine(lines: string[], tokens: Token[], level: number, indentString: string, initialParenDepth: number) {
    if (tokens.length === 0) return;

    // Dedent case/default labels
    if (tokens[0].text === 'case' || tokens[0].text === 'default') {
        level = Math.max(0, level - 1);
    }

    let line = '';
    let currentParenDepth = initialParenDepth;

    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        const prev = i > 0 ? tokens[i - 1] : null;

        if (prev) {
            // Ensure space before comment if it's on the same line
            if (t.type === TokenType.Comment) {
                line += ' ';
            } else if (needsSpace(prev, t, currentParenDepth, tokens)) {
                line += ' ';
            }
        }
        line += t.text;

        if (t.text === '(') currentParenDepth++;
        if (t.text === ')') currentParenDepth--;
    }

    lines.push(getIndent(level, indentString) + line);
}

function getIndent(level: number, indentString: string): string {
    return indentString.repeat(Math.max(0, level));
}

function needsSpace(prev: Token, curr: Token, parenDepth: number, lineTokens: Token[]): boolean {
    if (curr.type === TokenType.Comment) return true;
    if (curr.text === ';') return false;
    if (curr.text === ',') return false;

    if (curr.text === ':') {
        // Ternary operator needs space ($a ? $b : $c)
        // Return type (: void) - No space before : (PSR-12 says no space between ) and :)
        // Named arguments (arg: $val) - No space before :
        // Switch Case (case 1:) - No space before : (PSR-2)

        if (prev.text === ')') return false; // Return type likely

        // Named args (inside parens)
        if (parenDepth > 0) return false;

        // Switch Case (check if line started with case/default)
        if (lineTokens.length > 0 && ['case', 'default'].includes(lineTokens[0].text)) return false;

        // Otherwise assume Ternary
        return true;
    }

    if (curr.text === ')') return false;
    if (curr.text === ']') return false;

    if (prev.text === '(' || prev.text === '[') return false;
    if (prev.text === '->' || prev.text === '::' || prev.text === '?->') return false;
    if (curr.text === '->' || curr.text === '::' || curr.text === '?->') return false;
    if (prev.text === '!' || prev.text === '...') return false;
    if (curr.text === '...') return false; // function(...$args)

    if (prev.text === '\\' || curr.text === '\\') return false; // Namespace separator

    if (prev.type === TokenType.Operator || curr.type === TokenType.Operator) {
         if (['++', '--'].includes(prev.text) || ['++', '--'].includes(curr.text)) return false;
         return true;
    }

    if (prev.type === TokenType.Keyword) {
        if (['fn', 'function', 'super', 'this'].includes(prev.text) && curr.text === '(') return false;
        // PSR-12: method call: $foo->bar().
        // Keyword 'class', 'extends', 'implements' need spaces.
        return true;
    }

    if (curr.type === TokenType.Keyword) {
        if (curr.text === 'else' || curr.text === 'elseif' || curr.text === 'catch' || curr.text === 'finally') return true;
        return true; // Default space before keyword
    }

    if (prev.text === ',') return true;
    if (prev.text === ')' && curr.text === '{') return true; // Control structures: if (...) {
    if (prev.text === '}' && ['else', 'elseif', 'catch', 'finally'].includes(curr.text)) return true;
    if (prev.type === TokenType.OpenTag) return true;

    return false;
}
