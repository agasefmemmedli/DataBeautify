
import { JavaTokenizer, Token, TokenType } from './java_tokenizer';

function sortImports(text: string): string {
    const lines = text.split('\n');
    const imports: string[] = [];
    const newLines: string[] = [];
    let firstImportIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith('import ') && trimmed.endsWith(';')) {
            if (firstImportIndex === -1) firstImportIndex = newLines.length;
            imports.push(line);
        } else {
            newLines.push(line);
        }
    }

    if (imports.length === 0) return text;

    imports.sort((a, b) => a.trim().localeCompare(b.trim()));

    if (firstImportIndex !== -1) {
        newLines.splice(firstImportIndex, 0, ...imports);
    } else {
        return text;
    }

    return newLines.join('\n');
}

export function formatJavaDeep(text: string): string {
    // 1. Sort Imports
    text = sortImports(text);

    const tokenizer = new JavaTokenizer(text);
    const tokens = tokenizer.tokenize();

    if (tokens.length === 0) return '';

    const INDENT_SIZE = 4;
    const INDENT_STRING = ' '.repeat(INDENT_SIZE);

    // Filter meaningful tokens
    const meaningfulTokens = tokens.filter(t => t.type !== TokenType.Whitespace && t.type !== TokenType.Newline);

    // Helper to get indent
    const getIndent = (level: number) => INDENT_STRING.repeat(Math.max(0, level));

    return formatJavaDeepInternal(meaningfulTokens, INDENT_STRING, getIndent);
}

function formatJavaDeepInternal(tokens: Token[], INDENT_STRING: string, getIndent: (l:number)=>string): string {
    let outputLines: string[] = [];
    let currentLine = '';
    let indentLevel = 0;

    // Stack to track block types
    const blockStack: ('BLOCK' | 'SWITCH' | 'CASE_CONTENT' | 'ARRAY_INIT' | 'LAMBDA_BLOCK' | 'SWITCH_RULE')[] = [];

    let parenDepth = 0;
    let angleDepth = 0;
    let inCaseLabel = false; // true if we are between `case` and `:` or `->`

    const pushLine = () => {
        if (currentLine.trim() !== '') {
            outputLines.push(currentLine);
        } else if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== '') {
            outputLines.push('');
        }
        currentLine = '';
    };

    const append = (str: string) => {
        if (currentLine === '') {
            currentLine = getIndent(indentLevel) + str;
        } else {
            currentLine += str;
        }
    };

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const next = i + 1 < tokens.length ? tokens[i+1] : null;
        const prev = i > 0 ? tokens[i-1] : null;
        const prev2 = i > 1 ? tokens[i-2] : null;

        const prevEndLine = prev ? prev.line + (prev.text.match(/\n/g) || []).length : 0;

        // --- Indent / Stack Management (Pre-Token) ---

        if (token.text === '}') {
            // Closing a block.
            if (blockStack.length > 0 && (blockStack[blockStack.length - 1] === 'CASE_CONTENT' || blockStack[blockStack.length - 1] === 'SWITCH_RULE')) {
                blockStack.pop();
                indentLevel--;
            }
            if (blockStack.length > 0) {
                blockStack.pop();
                indentLevel--;
            }
            if (currentLine.trim() !== '') pushLine();
        }
        else if (token.text === 'case' || token.text === 'default') {
             if (blockStack.length > 0 && (blockStack[blockStack.length - 1] === 'CASE_CONTENT' || blockStack[blockStack.length - 1] === 'SWITCH_RULE')) {
                 blockStack.pop();
                 indentLevel--;
             }
             inCaseLabel = true;
             if (currentLine.trim() !== '') pushLine();
        }

        // --- Blank Line Logic ---
        // Insert blank line if source had > 1 empty lines between tokens
        // token.line is start line. prevEndLine is end line of prev.
        // If token.line > prevEndLine + 1, there was at least one blank line.
        if (prev && token.line > prevEndLine + 1) {
            if (currentLine.trim() !== '') pushLine();
            if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== '') {
                outputLines.push('');
            }
        }

        // --- Newline Preservation for Method Chains ---
        // If '.' is on a new line in source, force newline in output
        if (token.text === '.' && prev && token.line > prevEndLine) {
             if (currentLine.trim() !== '') pushLine();
        }

        // --- Spacing Logic ---
        let spaceBefore = false;

        if (currentLine !== '') {
            const lastChar = currentLine[currentLine.length - 1];
            if (/\w/.test(lastChar) && /\w/.test(token.text[0])) {
                spaceBefore = true;
            }

            if (token.type === TokenType.Operator) {
                if (token.text === '->') spaceBefore = true;
                else if (['.', '::', ',', ';'].includes(token.text)) spaceBefore = false;
                else if (token.text === '...') spaceBefore = true;
                else if (token.text === ':') {
                     if (inCaseLabel) spaceBefore = false;
                     else spaceBefore = true; // Ternary / For loop
                }
                else if (token.text === '<') {
                     // Generic detection
                     if (prev && (prev.type === TokenType.Identifier)) {
                         if (/^[A-Z]/.test(prev.text)) spaceBefore = false;
                         else spaceBefore = true;
                     } else {
                         spaceBefore = true;
                     }
                     if (!spaceBefore) angleDepth++;
                }
                else if (token.text === '>' || token.text === '>>' || token.text === '>>>') {
                     // Check if closing generic
                     if (angleDepth > 0) {
                         spaceBefore = false;
                         angleDepth -= token.text.length;
                         if (angleDepth < 0) angleDepth = 0;
                     } else {
                         spaceBefore = true;
                     }
                }
                else {
                    // Binary/Unary
                    if (['++', '--'].includes(token.text)) {
                         if (prev && (prev.type === TokenType.Identifier || prev.type === TokenType.Number || prev.text === ')' || prev.text === ']')) {
                             spaceBefore = false;
                         } else {
                             spaceBefore = true;
                         }
                    }
                    else if (['!', '~'].includes(token.text)) {
                         if (prev && prev.text === '(') spaceBefore = false;
                         else spaceBefore = true;
                    }
                    else {
                        spaceBefore = true;
                    }
                }
            }

            if (token.type === TokenType.Punctuation) {
                 if (token.text === '(') {
                     if (prev && ['if', 'for', 'while', 'switch', 'catch', 'synchronized', 'try'].includes(prev.text)) spaceBefore = true;
                     else spaceBefore = false;
                 }
                 else if (token.text === '{') spaceBefore = true;
                 else if (['}', ')', ']'].includes(token.text)) spaceBefore = false;
                 else if (token.text === '[') spaceBefore = false;
            }

            if (prev) {
                if (prev.type === TokenType.Operator) {
                    if (['.', '::', '@'].includes(prev.text)) spaceBefore = false;
                    else if (prev.text === '<' && angleDepth > 0) spaceBefore = false;
                    else if (['++', '--'].includes(prev.text)) {
                        // handled below
                    }
                    else spaceBefore = true;
                }

                if (prev.text === '(' || prev.text === '[') spaceBefore = false;
                if (prev.text === '::' || prev.text === '.') spaceBefore = false;
                if (prev.text === '@') spaceBefore = false;
                if (prev.text === '<' && angleDepth > 0) spaceBefore = false;
            }
        }

        if (spaceBefore && currentLine !== '' && !currentLine.endsWith(' ')) {
             append(' ');
        } else if (!spaceBefore && currentLine.endsWith(' ')) {
             currentLine = currentLine.trimEnd();
        }

        // --- Append Token ---
        append(token.text);

        // --- Post-Token Logic ---

        if (token.text === '{') {
            indentLevel++;
            let foundSwitch = false;
            let foundArrayInit = false;
            let foundLambda = false;

            let balance = 0;
            let p = i - 1;
            while (p >= 0) {
                const t = tokens[p];
                if (t.text === ')' ) balance++;
                else if (t.text === '(') {
                    balance--;
                    if (balance < 0) {
                        let q = p - 1;
                        if (q >= 0 && tokens[q].text === 'switch') foundSwitch = true;
                        break;
                    }
                }
                else if (t.text === ']' || t.text === '=') {
                    if (balance === 0) {
                        foundArrayInit = true;
                        break;
                    }
                }
                else if (t.text === ';' || t.text === '{' || t.text === '}') {
                    if (balance === 0) break;
                }
                else if (t.text === '->') {
                     foundLambda = true;
                     break;
                }
                p--;
            }

            if (foundSwitch) {
                blockStack.push('SWITCH');
            } else if (foundArrayInit) {
                 blockStack.push('ARRAY_INIT');
            } else if (foundLambda) {
                 blockStack.push('LAMBDA_BLOCK');
            } else {
                blockStack.push('BLOCK');
            }

            if (!foundArrayInit) pushLine();
        }
        else if (token.text === '}') {
             if (next && ['catch', 'finally', 'else', 'while'].includes(next.text)) {
                 append(' ');
             } else if (next && (next.text === ';' || next.text === ')' || next.text === ',' || next.text === '.')) {
                 // No newline
             } else {
                 pushLine();
             }
        }
        else if (token.text === ':') {
             if (inCaseLabel) {
                 inCaseLabel = false;
                 blockStack.push('CASE_CONTENT');
                 indentLevel++;
                 pushLine();
             }
        }
        else if (token.text === '->') {
            if (inCaseLabel) {
                inCaseLabel = false;
                if (next && next.text !== '{') {
                     blockStack.push('SWITCH_RULE');
                     indentLevel++;
                }
            }
        }
        else if (token.text === ';') {
             if (blockStack.length > 0 && blockStack[blockStack.length - 1] === 'SWITCH_RULE') {
                 blockStack.pop();
                 indentLevel--;
             }

             if (parenDepth === 0) pushLine();
             else append(' ');
        }
        else if (token.type === TokenType.Preprocessor) {
             if (next && ['public', 'private', 'protected', 'class', 'interface', 'enum', 'record', 'void', 'static', 'final'].includes(next.text)) {
                 pushLine();
             } else if (next && next.type === TokenType.Identifier && parenDepth === 0) {
                 pushLine();
             } else {
                 append(' ');
             }
        }
        else if (token.text === ',') {
             append(' ');
        }
        else if (token.type === TokenType.Comment) {
             pushLine();
        }

        if (token.text === '(') parenDepth++;
        else if (token.text === ')') parenDepth = Math.max(0, parenDepth - 1);
    }

    if (currentLine.trim() !== '') pushLine();

    return outputLines.join('\n');
}
