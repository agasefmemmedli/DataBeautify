import { JSONTokenizer, Token, TokenType } from './json_tokenizer';

export interface JSONFormatOptions {
    tabSize?: number;
    insertSpaces?: boolean;
    isJSONC?: boolean;
    // Add trailing commas in expanded objects/arrays (defaults to isJSONC)
    trailingCommas?: boolean;
}

// inlineComment: a comment at the end of the line where the value ends, e.g. `"a": 1, // note`
type ASTNode =
    | { type: 'Object', properties: Property[], comments?: string[], trailingComments?: string[], inlineComment?: string }
    | { type: 'Array', items: ASTNode[], comments?: string[], trailingComments?: string[], inlineComment?: string }
    | { type: 'Literal', value: string, tokenType: TokenType, comments?: string[], inlineComment?: string };

interface Property {
    key: string;
    value: ASTNode;
    comments?: string[];
}

export function formatJSONDeep(text: string, options?: JSONFormatOptions): string {
    const tokenizer = new JSONTokenizer(text);
    const rawTokens = tokenizer.tokenize();

    if (rawTokens.length === 0) return '';

    const tabSize = options?.tabSize || 2;
    const insertSpaces = options?.insertSpaces !== false;
    const isJSONC = options?.isJSONC || false;
    const trailingCommas = options?.trailingCommas ?? isJSONC;
    const indentString = insertSpaces ? ' '.repeat(tabSize) : '\t';

    // Phase 1: Sanitize / Repair Stream
    const tokens: Token[] = [];
    const meaningfulTokens = rawTokens.filter(t => t.type !== TokenType.Whitespace);

    for (let i = 0; i < meaningfulTokens.length; i++) {
        const token = meaningfulTokens[i];
        const next = i + 1 < meaningfulTokens.length ? meaningfulTokens[i+1] : null;

        // Strict Mode: Skip comments
        if (!isJSONC && token.type === TokenType.Comment) {
            continue;
        }

        // Missing Comma Injection
        const isValue = (t: Token) => [TokenType.String, TokenType.Number, TokenType.Boolean, TokenType.Null, TokenType.BraceClose, TokenType.BracketClose].includes(t.type);
        const isStartOfValue = (t: Token) => [TokenType.String, TokenType.Number, TokenType.Boolean, TokenType.Null, TokenType.BraceOpen, TokenType.BracketOpen].includes(t.type);

        if (tokens.length > 0) {
            const last = tokens[tokens.length - 1];
            // If last was a value, and current is start of value (and not a comment), insert comma
            if (isValue(last) && isStartOfValue(token) && token.type !== TokenType.Comment) {
                tokens.push({ type: TokenType.Comma, text: ',', line: last.line, col: last.col + 1 });
            }
        }

        // Trailing Comma Removal (Strict Mode)
        if (!isJSONC && token.type === TokenType.Comma && next && (next.type === TokenType.BraceClose || next.type === TokenType.BracketClose)) {
            continue;
        }

        // String Normalization
        let processedToken = { ...token };
        if (token.type === TokenType.String) {
             const content = token.text;
            if (content.startsWith("'") && content.endsWith("'")) {
                const inner = content.substring(1, content.length - 1);
                // Unescape existing single quotes and escape double quotes
                const processed = inner.replace(/\\'/g, "'").replace(/"/g, '\\"');
                processedToken.text = `"${processed}"`;
            }
        } else if (token.type === TokenType.Unknown && /^[\p{L}_$][\p{L}\p{N}_$\-]*$/u.test(token.text)) {
             // Unquoted key
             processedToken.type = TokenType.String;
             processedToken.text = `"${token.text}"`;
        }

        tokens.push(processedToken);
    }

    // Phase 2: Build AST (Simple Recursive Descent)
    let current = 0;

    const endLine = (t: Token) => t.line + (t.text.match(/\n/g)?.length ?? 0);

    // Attach comments that follow a value (after an optional comma) on the same line
    // and end that line. A comment followed by more code on its line belongs to that code.
    function attachInlineComment(node: ASTNode) {
        if (current === 0) return;
        const valueLine = endLine(tokens[current - 1]);
        let k = current;
        if (k < tokens.length && tokens[k].type === TokenType.Comma) k++;
        const parts: string[] = [];
        while (k < tokens.length && tokens[k].type === TokenType.Comment && tokens[k].line === valueLine) {
            const next = tokens[k + 1];
            if (next && next.type !== TokenType.Comment && next.line === endLine(tokens[k])) break;
            parts.push(tokens[k].text);
            k++;
        }
        if (parts.length > 0) {
            node.inlineComment = parts.join(' ');
            current = k;
        }
    }

    function parseValue(): ASTNode | null {
        if (current >= tokens.length) return null;

        // Collect comments before value
        const comments: string[] = [];
        while (current < tokens.length && tokens[current].type === TokenType.Comment) {
            comments.push(tokens[current].text);
            current++;
        }
        if (current >= tokens.length) return null;

        const t = tokens[current];

        if (t.type === TokenType.BraceOpen) {
            current++;
            const properties: Property[] = [];
            let trailingComments: string[] = [];
            while (current < tokens.length && tokens[current].type !== TokenType.BraceClose) {
                if (tokens[current].type === TokenType.Comma) {
                    current++;
                    continue;
                }

                // Parse Property
                // Key Comments
                let keyComments: string[] = [];
                while (current < tokens.length && tokens[current].type === TokenType.Comment) {
                     keyComments.push(tokens[current].text);
                     current++;
                }
                if (current >= tokens.length) break;

                if (tokens[current].type === TokenType.BraceClose) {
                    trailingComments = keyComments;
                    break;
                }

                const keyToken = tokens[current];
                let key = keyToken.text;
                if (keyToken.type !== TokenType.String) {
                     key = `"${keyToken.text}"`;
                }
                current++;

                // Expect Colon
                if (current < tokens.length && tokens[current].type === TokenType.Colon) {
                    current++;
                }

                // Value
                const value = parseValue();
                if (value) {
                    attachInlineComment(value);
                    properties.push({ key, value, comments: keyComments }); // attach comments to property
                } else {
                     break;
                }
            }
            if (current < tokens.length && tokens[current].type === TokenType.BraceClose) {
                current++;
            }

            return { type: 'Object', properties, comments, trailingComments };
        } else if (t.type === TokenType.BracketOpen) {
            current++;
            const items: ASTNode[] = [];
            let trailingComments: string[] = [];
            while (current < tokens.length && tokens[current].type !== TokenType.BracketClose) {
                if (tokens[current].type === TokenType.Comma) {
                    current++;
                    continue;
                }

                // Check for trailing comments
                let tempCurrent = current;
                let potentialComments: string[] = [];
                while (tempCurrent < tokens.length && tokens[tempCurrent].type === TokenType.Comment) {
                    potentialComments.push(tokens[tempCurrent].text);
                    tempCurrent++;
                }

                if (tempCurrent < tokens.length && tokens[tempCurrent].type === TokenType.BracketClose) {
                    // These are trailing comments
                    current = tempCurrent;
                    trailingComments = potentialComments;
                    break;
                }

                const val = parseValue();
                if (val) {
                    attachInlineComment(val);
                    items.push(val);
                } else {
                    if (tokens[current].type === TokenType.BracketClose) break;
                    current++;
                }
            }
            if (current < tokens.length && tokens[current].type === TokenType.BracketClose) {
                current++;
            }
            return { type: 'Array', items, comments, trailingComments };
        } else if (t.type === TokenType.BraceClose || t.type === TokenType.BracketClose) {
            return null;
        } else {
            // Literal
            current++;
            return { type: 'Literal', value: t.text, tokenType: t.type, comments };
        }
    }

    const roots: ASTNode[] = [];
    const endComments: string[] = [];
    while (current < tokens.length) {
        // Skip trailing commas at root level
        if (tokens[current].type === TokenType.Comma) {
            current++;
            continue;
        }
        // Comments at the end of the file have no value to attach to
        if (tokens.slice(current).every(t => t.type === TokenType.Comment)) {
            endComments.push(...tokens.slice(current).map(t => t.text));
            break;
        }
        const root = parseValue();
        if (root) {
            attachInlineComment(root);
            roots.push(root);
        } else {
            current++;
        }
    }

    // Phase 3: Print
    function measure(node: ASTNode): number {
        if (node.comments && node.comments.length > 0) return 9999; // Force expansion if comments exist
        if ((node.type === 'Object' || node.type === 'Array') && node.trailingComments && node.trailingComments.length > 0) return 9999;

        if (node.type === 'Literal') return node.value.length;
        if (node.type === 'Array') {
            let len = 2; // []
            for (let i = 0; i < node.items.length; i++) {
                len += measure(node.items[i]);
                if (i < node.items.length - 1) len += 2;
            }
            return len;
        }
        if (node.type === 'Object') {
            let len = 2; // {}
            for (let i = 0; i < node.properties.length; i++) {
                if (node.properties[i].comments && node.properties[i].comments!.length > 0) return 9999;
                len += node.properties[i].key.length + 2; // key:
                len += measure(node.properties[i].value);
                if (i < node.properties.length - 1) len += 2;
            }
            return len;
        }
        return 0;
    }

    function isComplex(node: ASTNode): boolean {
        if (node.comments && node.comments.length > 0) return true;
        if ((node.type === 'Object' || node.type === 'Array') && node.trailingComments && node.trailingComments.length > 0) return true;

        if (node.type === 'Literal') return false;
        if (node.type === 'Array') {
            return node.items.some(i => isComplex(i) || !!i.inlineComment);
        }
        if (node.type === 'Object') {
             return node.properties.some(p => isComplex(p.value) || !!p.value.inlineComment || (p.comments && p.comments.length > 0));
        }
        return false;
    }

    function print(node: ASTNode, indent: number): string {
        const space = indentString.repeat(indent);

        let commentStr = '';
        if (node.comments) {
            for (const c of node.comments) {
                commentStr += `${space}${c}\n`;
            }
        }

        if (node.type === 'Literal') {
            return commentStr + space + node.value;
        }

        const len = measure(node);
        const shouldCompact = len < 80 && !isComplex(node);

        if (shouldCompact) {
            if (node.type === 'Array') {
                const items = node.items.map(item => print(item, 0).trim()).join(', ');
                return commentStr + space + `[${items}]`;
            } else if (node.type === 'Object') {
                const props = node.properties.map(p => `${p.key}: ${print(p.value, 0).trim()}`).join(', ');
                return commentStr + space + `{ ${props} }`;
            }
        }

        // Expanded
        if (node.type === 'Array') {
            if (node.items.length === 0 && (!node.trailingComments || node.trailingComments.length === 0)) return commentStr + space + '[]';

            const itemLines = node.items.map((item, idx) =>
                withSeparator(print(item, indent + 1), idx === node.items.length - 1, item.inlineComment));
            let content = itemLines.join('\n');

            if (node.trailingComments && node.trailingComments.length > 0) {
                const trailingStr = node.trailingComments.map(c => indentString.repeat(indent + 1) + c).join('\n');
                if (content.length > 0) content += '\n';
                content += trailingStr;
            }

            return commentStr + space + '[\n' + content + '\n' + space + ']';
        } else if (node.type === 'Object') {
            if (node.properties.length === 0 && (!node.trailingComments || node.trailingComments.length === 0)) return commentStr + space + '{}';

            const propLines = node.properties.map((p, idx) =>
                withSeparator(printProperty(p, indent), idx === node.properties.length - 1, p.value.inlineComment));
            let content = propLines.join('\n');

            if (node.trailingComments && node.trailingComments.length > 0) {
                const trailingStr = node.trailingComments.map(c => indentString.repeat(indent + 1) + c).join('\n');
                if (content.length > 0) content += '\n';
                content += trailingStr;
            }

            return commentStr + space + '{\n' + content + '\n' + space + '}';
        }

        return '';
    }

    // Comma (unless it is the last entry without trailing commas), then the inline comment
    function withSeparator(line: string, isLast: boolean, inlineComment?: string): string {
        let out = line;
        if (!isLast || trailingCommas) out += ',';
        if (inlineComment) out += ' ' + inlineComment;
        return out;
    }

    function printProperty(p: Property, indent: number): string {
        let pComment = '';
        if (p.comments) {
            for (const c of p.comments) {
                pComment += indentString.repeat(indent + 1) + c + '\n';
            }
        }

        const valStr = print(p.value, indent + 1);
        // If value has comments attached to it (not property), force newline
        if (p.value.comments && p.value.comments.length > 0) {
            return pComment + indentString.repeat(indent + 1) + `${p.key}:\n${valStr}`;
        }
        return pComment + indentString.repeat(indent + 1) + `${p.key}: ${valStr.trimStart()}`;
    }

    const lines = roots.map(r => print(r, 0) + (r.inlineComment ? ' ' + r.inlineComment : ''));
    return [...lines, ...endComments].join('\n');
}
