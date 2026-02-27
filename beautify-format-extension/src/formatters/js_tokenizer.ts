
export type TokenType =
    | 'Whitespace'
    | 'LineComment'
    | 'BlockComment'
    | 'String'
    | 'Template' // Full template string
    | 'TemplateHead' // `...${
    | 'TemplateMiddle' // }...${
    | 'TemplateTail' // }...`
    | 'Regex'
    | 'Keyword'
    | 'Identifier'
    | 'Number'
    | 'Operator'
    | 'Punctuation'
    | 'Decorator'
    | 'JSXTagOpen'
    | 'JSXTagClose'
    | 'JSXTagSelfClose'
    | 'JSXAttributeName'
    | 'JSXAttributeValue'
    | 'JSXText'
    | 'JSXExpressionStart'
    | 'JSXExpressionEnd'
    | 'Unknown';

export interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
}

const KEYWORDS = new Set([
    'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
    'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof',
    'new', 'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while',
    'with', 'yield', 'let', 'static', 'enum', 'implements', 'interface', 'package', 'private',
    'protected', 'public', 'async', 'await', 'from', 'as', 'type', 'declare', 'namespace', 'abstract',
    'get', 'set', 'readonly', 'module', 'require', 'constructor'
]);

export function tokenize(text: string): Token[] {
    const tokens: Token[] = [];
    let line = 1;
    let column = 1;
    let pos = 0;
    const len = text.length;

    // Helper to add token
    const addToken = (type: TokenType, value: string) => {
        tokens.push({ type, value, line, column });
        const lines = value.split('\n');
        if (lines.length > 1) {
            line += lines.length - 1;
            column = lines[lines.length - 1].length + 1;
        } else {
            column += value.length;
        }
        pos += value.length;
    };

    // Stack to track template brace levels
    const templateStack: number[] = [];
    let braceLevel = 0;

    // JSX State
    type Mode = 'Normal' | 'JSXTag' | 'JSXChildren';
    const modeStack: { mode: Mode, braceLevelAtEntry: number }[] = [{ mode: 'Normal', braceLevelAtEntry: 0 }];

    while (pos < len) {
        const char = text[pos];
        const currentMode = modeStack[modeStack.length - 1].mode;

        // --- JSX Children Mode ---
        if (currentMode === 'JSXChildren') {
             if (char === '{') {
                 addToken('JSXExpressionStart', '{');
                 braceLevel++;
                 modeStack.push({ mode: 'Normal', braceLevelAtEntry: braceLevel });
                 continue;
             }
             if (char === '<') {
                 // Check if it's closing tag </
                 if (text[pos+1] === '/') {
                     // Read closing tag
                     let value = '</';
                     let i = pos + 2;
                     while (i < len && /[a-zA-Z0-9_:.-]/.test(text[i])) {
                         value += text[i];
                         i++;
                     }
                     while (i < len && /\s/.test(text[i])) i++; // skip space
                     if (text[i] === '>') {
                         value += '>';
                         i++;
                     }
                     addToken('JSXTagClose', value);
                     modeStack.pop(); // Exit JSXChildren
                     continue;
                 } else {
                     // Start of new tag
                     let value = '<';
                     let i = pos + 1;
                     // Fragment check
                     if (text[i] === '>') {
                         value += '>';
                         i++;
                         addToken('JSXTagOpen', value);
                         modeStack.push({ mode: 'JSXChildren', braceLevelAtEntry: braceLevel });
                         continue;
                     }

                     while (i < len && /[a-zA-Z0-9_:.-]/.test(text[i])) {
                         value += text[i];
                         i++;
                     }
                     addToken('JSXTagOpen', value);
                     modeStack.push({ mode: 'JSXTag', braceLevelAtEntry: braceLevel });
                     continue;
                 }
             }

             // JSX Text
             let value = '';
             let i = pos;
             while (i < len && text[i] !== '<' && text[i] !== '{') {
                 value += text[i];
                 i++;
             }
             if (value.length > 0) {
                 addToken('JSXText', value);
             }
             continue;
        }

        // --- JSX Tag Mode (Attributes) ---
        if (currentMode === 'JSXTag') {
            if (/\s/.test(char)) {
                // consume whitespace
                 let value = char;
                let i = pos + 1;
                while (i < len && /\s/.test(text[i])) {
                    value += text[i];
                    i++;
                }
                addToken('Whitespace', value);
                continue;
            }
            if (char === '/') {
                if (text[pos+1] === '>') {
                    addToken('JSXTagSelfClose', '/>');
                    modeStack.pop(); // Exit JSXTag (and don't enter Children)
                    continue;
                }
            }
            if (char === '>') {
                addToken('Operator', '>');
                modeStack.pop(); // Exit JSXTag
                modeStack.push({ mode: 'JSXChildren', braceLevelAtEntry: braceLevel });
                continue;
            }
            if (char === '{') {
                 addToken('JSXExpressionStart', '{');
                 braceLevel++;
                 modeStack.push({ mode: 'Normal', braceLevelAtEntry: braceLevel });
                 continue;
            }
            if (char === '=') {
                addToken('Operator', '=');
                continue;
            }
            if (char === '"' || char === "'") {
                // Attribute String Value
                 let value = char;
                let i = pos + 1;
                while (i < len) {
                    if (text[i] === '\\') { value += text[i]; if(i+1<len) value += text[i+1]; i+=2; continue; }
                    value += text[i];
                    if (text[i] === char) { i++; break; }
                    i++;
                }
                addToken('JSXAttributeValue', value);
                continue;
            }
            if (/[a-zA-Z_$]/.test(char)) {
                 let value = char;
                let i = pos + 1;
                while (i < len && /[a-zA-Z0-9_$:.-]/.test(text[i])) {
                    value += text[i];
                    i++;
                }
                addToken('JSXAttributeName', value);
                continue;
            }
             // Unknown char in tag mode? consume 1
             addToken('Unknown', char);
             continue;
        }

        // Whitespace
        if (/\s/.test(char)) {
            let value = char;
            let i = pos + 1;
            while (i < len && /\s/.test(text[i])) {
                value += text[i];
                i++;
            }
            addToken('Whitespace', value);
            continue;
        }

        // Comments
        if (char === '/') {
            if (text[pos + 1] === '/') {
                let value = '//';
                let i = pos + 2;
                while (i < len && text[i] !== '\n' && text[i] !== '\r') {
                    value += text[i];
                    i++;
                }
                addToken('LineComment', value);
                continue;
            } else if (text[pos + 1] === '*') {
                let value = '/*';
                let i = pos + 2;
                while (i < len) {
                    if (text[i] === '*' && text[i + 1] === '/') {
                        value += '*/';
                        break;
                    }
                    value += text[i];
                    i++;
                }
                addToken('BlockComment', value);
                continue;
            }
        }

        // Check for template closing brace '}'
        if (char === '}' && templateStack.length > 0 && braceLevel === templateStack[templateStack.length - 1]) {
            let value = '}';
            let i = pos + 1;
            let foundEnd = false;

            while (i < len) {
                if (text[i] === '\\') {
                    value += text[i];
                    if (i + 1 < len) {
                        value += text[i + 1];
                        i += 2;
                        continue;
                    }
                }

                // Check for start of new expression: ${
                if (text[i] === '$' && i + 1 < len && text[i + 1] === '{') {
                    value += '${';
                    addToken('TemplateMiddle', value);
                    foundEnd = true;
                    // We stay in the same stack level as we re-entered expression immediately
                    break;
                }

                // Check for end of template: `
                if (text[i] === '`') {
                    value += '`';
                    templateStack.pop(); // We are done with this template
                    addToken('TemplateTail', value);
                    foundEnd = true;
                    break;
                }

                value += text[i];
                i++;
            }

            if (foundEnd) continue;

            if (i >= len) {
                 templateStack.pop();
                 addToken('TemplateTail', value);
                 continue;
            }
        }

        // Check for JSX Start Heuristic
        if (char === '<') {
             // Heuristic: is this a tag start?
             let lastToken: Token | undefined;
             for (let k = tokens.length - 1; k >= 0; k--) {
                 const t = tokens[k];
                 if (t.type !== 'Whitespace' && t.type !== 'LineComment' && t.type !== 'BlockComment') {
                     lastToken = t;
                     break;
                 }
             }

             const isOperator = lastToken && (
                lastToken.type === 'Identifier' ||
                lastToken.type === 'Number' ||
                lastToken.type === 'String' ||
                lastToken.type === 'Template' ||
                lastToken.type === 'TemplateTail' ||
                lastToken.type === 'Regex' ||
                (lastToken.type === 'Punctuation' && (lastToken.value === ')' || lastToken.value === ']'))
            );

            // Allow keywords to precede JSX
            let isKeywordException = false;
            if (lastToken && lastToken.type === 'Keyword') {
                isKeywordException = true;
            }

            if (!isOperator) {
                // Check lookahead for tag structure
                let i = pos + 1;
                let isTag = false;
                if (text[i] === '/') isTag = true; // </
                else if (text[i] === '>') isTag = true; // <>
                else if (/[a-zA-Z_$]/.test(text[i])) { // <Tag
                     isTag = true;
                }

                if (isTag) {
                    // Enter JSX Tag Mode
                    let value = '<';
                     let i = pos + 1;
                     if (text[i] === '>') {
                         value += '>';
                         i++;
                         addToken('JSXTagOpen', value);
                         modeStack.push({ mode: 'JSXChildren', braceLevelAtEntry: braceLevel });
                         continue;
                     }
                     while (i < len && /[a-zA-Z0-9_:.-]/.test(text[i])) {
                         value += text[i];
                         i++;
                     }
                     addToken('JSXTagOpen', value);
                     modeStack.push({ mode: 'JSXTag', braceLevelAtEntry: braceLevel });
                     continue;
                }
            }
        }

        // Check for } to exit JSX Expression
        if (char === '}') {
             if (modeStack.length > 1) {
                 const entryLevel = modeStack[modeStack.length - 1].braceLevelAtEntry;
                 if (braceLevel === entryLevel) {
                     addToken('JSXExpressionEnd', '}');
                     braceLevel--;
                     modeStack.pop();
                     continue;
                 }
             }
        }

        // Strings
        if (char === "'" || char === '"') {
            let value = char;
            let i = pos + 1;
            while (i < len) {
                if (text[i] === '\\') {
                    value += text[i];
                    if (i + 1 < len) {
                        value += text[i + 1];
                        i += 2;
                        continue;
                    }
                }
                value += text[i];
                if (text[i] === char) {
                    break;
                }
                i++;
            }
            addToken('String', value);
            continue;
        }

        // Template Literals (Start)
        if (char === '`') {
            let value = char;
            let i = pos + 1;
            let foundEnd = false;

            while (i < len) {
                if (text[i] === '\\') {
                    value += text[i];
                    if (i + 1 < len) {
                        value += text[i + 1];
                        i += 2;
                        continue;
                    }
                }

                if (text[i] === '$' && i + 1 < len && text[i + 1] === '{') {
                    value += '${';
                    templateStack.push(braceLevel);
                    addToken('TemplateHead', value);
                    foundEnd = true;
                    break;
                }

                if (text[i] === '`') {
                    value += '`';
                    addToken('Template', value); // Full string, no interpolation
                    foundEnd = true;
                    break;
                }

                value += text[i];
                i++;
            }

            if (foundEnd) continue;

            if (i >= len) {
                addToken('Template', value);
                continue;
            }
        }

        // Regex Literals
        if (char === '/') {
            let lastToken: Token | undefined;
            for (let k = tokens.length - 1; k >= 0; k--) {
                 const t = tokens[k];
                 if (t.type !== 'Whitespace' && t.type !== 'LineComment' && t.type !== 'BlockComment') {
                     lastToken = t;
                     break;
                 }
            }

            const isDivision = lastToken && (
                lastToken.type === 'Identifier' ||
                lastToken.type === 'Number' ||
                lastToken.type === 'String' ||
                lastToken.type === 'Template' ||
                lastToken.type === 'TemplateTail' ||
                (lastToken.type === 'Punctuation' && (lastToken.value === ')' || lastToken.value === ']'))
            );

            if (!isDivision) {
                let value = char;
                let i = pos + 1;
                let inClass = false;
                while (i < len) {
                    if (text[i] === '\\') {
                        value += text[i];
                        if (i + 1 < len) {
                            value += text[i + 1];
                            i += 2;
                            continue;
                        }
                    }
                    if (text[i] === '[') inClass = true;
                    if (text[i] === ']') inClass = false;

                    value += text[i];
                    if (text[i] === '/' && !inClass) {
                        // Check flags
                        i++;
                        while (i < len && /[a-zA-Z]/.test(text[i])) {
                            value += text[i];
                            i++;
                        }
                        break;
                    }
                    i++;
                }
                addToken('Regex', value);
                continue;
            } else {
                addToken('Operator', '/');
                continue;
            }
        }

        // Numbers
        if (/[0-9]/.test(char)) {
            let value = char;
            let i = pos + 1;
            // Hex
            if (char === '0' && (text[i] === 'x' || text[i] === 'X')) {
                value += text[i];
                i++;
                while (i < len && /[0-9a-fA-F]/.test(text[i])) {
                    value += text[i];
                    i++;
                }
            } else {
                while (i < len && /[0-9.]/.test(text[i])) {
                    value += text[i];
                    i++;
                }
            }
            addToken('Number', value);
            continue;
        }

        // Identifiers and Keywords
        if (/[a-zA-Z_$]/.test(char)) {
            let value = char;
            let i = pos + 1;
            while (i < len && /[a-zA-Z0-9_$]/.test(text[i])) {
                value += text[i];
                i++;
            }
            if (KEYWORDS.has(value)) {
                addToken('Keyword', value);
            } else {
                addToken('Identifier', value);
            }
            continue;
        }

        // Decorators
        if (char === '@') {
            addToken('Decorator', '@');
            continue;
        }

        // Operators
        if (/[+\-*/%=&|<>!^~?]/.test(char)) {
            let value = char;
            let i = pos + 1;
            const next = text[i];
            const next2 = text[i+1];

            if (
                (char === '=' && next === '>') ||
                (char === '?' && next === '.') ||
                (char === '?' && next === '?') ||
                (char === '+' && next === '+') ||
                (char === '+' && next === '=') ||
                (char === '-' && next === '-') ||
                (char === '-' && next === '=') ||
                (char === '*' && next === '=') ||
                (char === '/' && next === '=') ||
                (char === '%' && next === '=') ||
                (char === '^' && next === '=') ||
                (char === '&' && next === '&') ||
                (char === '&' && next === '=') ||
                (char === '|' && next === '|') ||
                (char === '|' && next === '=') ||
                (char === '<' && next === '=') ||
                (char === '>' && next === '=') ||
                (char === '=' && next === '=') ||
                (char === '!' && next === '=') ||
                (char === '*' && next === '*') ||
                (char === '<' && next === '<') ||
                (char === '>' && next === '>')
            ) {
                value += next;
                if (text[i+1] === '=') {
                     value += text[i+1];
                }
                 addToken('Operator', value);
                 continue;
            }

             if ((char === '=' || char === '!') && next === '=' && next2 === '=') {
                 value = char + '==';
                 addToken('Operator', value);
                 continue;
             }

            addToken('Operator', char);
            continue;
        }

        // Punctuation
        if (/[(){}\[\],:;.]/.test(char)) {
            if (char === '{') braceLevel++;
            if (char === '}') braceLevel--;
            addToken('Punctuation', char);
            continue;
        }

        // Unknown
        addToken('Unknown', char);
    }

    return tokens;
}
