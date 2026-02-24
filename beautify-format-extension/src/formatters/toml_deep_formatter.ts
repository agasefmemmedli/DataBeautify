import { TOMLTokenizer, Token, TokenType } from './toml_tokenizer';

interface TOMLNode {
    type: 'Comment' | 'TableHeader' | 'ArrayTableHeader' | 'KeyValuePair' | 'Empty';
    key?: string;
    value?: string;
    comment?: string; // Trailing comment
    raw?: string; // For standalone comment
}

export function formatTOMLDeep(text: string): string {
    const tokenizer = new TOMLTokenizer(text);
    const tokens = tokenizer.tokenize();
    const nodes = parse(tokens);

    return printNodes(nodes);
}

function parse(tokens: Token[]): TOMLNode[] {
    const nodes: TOMLNode[] = [];
    let i = 0;

    while (i < tokens.length) {
        const t = tokens[i];

        // Handle Newlines / Empty lines
        if (t.type === TokenType.Newline) {
            // Check if we have multiple newlines which imply an empty line
            // If the previous node was not Empty, and we see 2+ newlines?
            // Actually, we can just push an Empty node if we see a blank line (2 newlines).
            // But we might want to consolidate.
            let nlCount = 0;
            while (i < tokens.length && tokens[i].type === TokenType.Newline) {
                nlCount++;
                i++;
            }
            if (nlCount > 1) {
                nodes.push({ type: 'Empty' });
            }
            continue;
        }

        if (t.type === TokenType.Whitespace) {
            i++;
            continue;
        }

        // Comment (Standalone)
        if (t.type === TokenType.Comment) {
            nodes.push({ type: 'Comment', raw: t.value });
            i++;
            continue;
        }

        // Table Header [ ... ]
        if (t.value === '[') {
            const startIdx = i;
            let isArrayTable = false;
            i++; // consume [
            if (i < tokens.length && tokens[i].value === '[') {
                isArrayTable = true;
                i++;
            }

            const keyTokens: Token[] = [];
            while (i < tokens.length) {
                if (tokens[i].value === ']') {
                    if (isArrayTable) {
                        if (i + 1 < tokens.length && tokens[i+1].value === ']') {
                            break;
                        }
                    } else {
                        break;
                    }
                }
                if (tokens[i].type === TokenType.Newline) break; // Error protection
                keyTokens.push(tokens[i]);
                i++;
            }

            // Consume closing brackets
            if (isArrayTable) {
                if (i < tokens.length && tokens[i].value === ']') i++;
                if (i < tokens.length && tokens[i].value === ']') i++;
            } else {
                if (i < tokens.length && tokens[i].value === ']') i++;
            }

            // Check for trailing comment
            let comment: string | undefined;
            // Skip whitespace on same line
            while (i < tokens.length && tokens[i].type === TokenType.Whitespace) i++;
            if (i < tokens.length && tokens[i].type === TokenType.Comment) {
                comment = tokens[i].value;
                i++;
            }

            nodes.push({
                type: isArrayTable ? 'ArrayTableHeader' : 'TableHeader',
                key: formatKey(keyTokens),
                comment
            });
            continue;
        }

        // Key-Value Pair
        // We expect Key = Value
        // Scan ahead for =
        let eqIdx = -1;
        let scanI = i;
        while (scanI < tokens.length && tokens[scanI].type !== TokenType.Newline) {
            if (tokens[scanI].value === '=') {
                eqIdx = scanI;
                break;
            }
            // If we hit [ or ], it might be start of array in value, or new section?
            // But we are looking for =, which must be at top level of line.
            // If we are scanning a key, we shouldn't see [ unless quoted key?
            // Quoted key `"[foo]"` is valid.
            // So we must be careful.
            // But `key = ...`.
            scanI++;
        }

        if (eqIdx > -1) {
            const keyTokens = tokens.slice(i, eqIdx).filter(tok => tok.type !== TokenType.Whitespace);
            i = eqIdx + 1; // skip =

            // Parse Value
            const valRes = parseValue(tokens, i);
            i = valRes.endIndex;

            // Check trailing comment
            let comment: string | undefined;
            while (i < tokens.length && tokens[i].type === TokenType.Whitespace) i++;
            if (i < tokens.length && tokens[i].type === TokenType.Comment) {
                comment = tokens[i].value;
                i++;
            }

            nodes.push({
                type: 'KeyValuePair',
                key: formatKey(keyTokens),
                value: valRes.value,
                comment
            });
        } else {
            // Unknown or garbage, consume until newline
            let raw = '';
            while (i < tokens.length && tokens[i].type !== TokenType.Newline) {
                raw += tokens[i].value;
                i++;
            }
            if (raw.trim()) {
                nodes.push({ type: 'Comment', raw: '# ' + raw });
            }
        }
    }

    return nodes;
}

function parseValue(tokens: Token[], startIndex: number): { value: string, endIndex: number } {
    let i = startIndex;
    while (i < tokens.length && tokens[i].type === TokenType.Whitespace) i++;

    if (i >= tokens.length) return { value: '', endIndex: i };

    const t = tokens[i];

    if (t.value === '[') {
        return parseArray(tokens, i);
    }
    if (t.value === '{') {
        return parseInlineTable(tokens, i);
    }

    // Simple Value
    // We consume just one token usually (String, Number, Boolean, Date)
    // But verify it's not a separator or something weird
    if (t.type === TokenType.String || t.type === TokenType.Number || t.type === TokenType.Boolean || t.type === TokenType.Date || t.type === TokenType.Identifier) {
        return { value: t.value, endIndex: i + 1 };
    }

    // Unknown or symbol?
    return { value: t.value, endIndex: i + 1 };
}

function parseArray(tokens: Token[], startIndex: number): { value: string, endIndex: number } {
    let i = startIndex;
    const startLine = tokens[i].line;
    i++; // consume [

    const items: string[] = [];
    let isMultiline = false;
    let comments: string[] = []; // Store comments inside array

    while (i < tokens.length) {
        // Skip whitespace and newlines
        while (i < tokens.length && (tokens[i].type === TokenType.Whitespace || tokens[i].type === TokenType.Newline)) {
            if (tokens[i].type === TokenType.Newline) isMultiline = true;
            i++;
        }

        if (i >= tokens.length) break;
        if (tokens[i].value === ']') {
            i++;
            break;
        }

        // Comment inside array?
        if (tokens[i].type === TokenType.Comment) {
            comments.push(tokens[i].value);
            isMultiline = true;
            i++;
            continue;
        }

        // Value
        const valRes = parseValue(tokens, i);
        items.push(valRes.value);
        i = valRes.endIndex;

        // Skip whitespace
        while (i < tokens.length && tokens[i].type === TokenType.Whitespace) i++;

        // Comment after value?
        if (i < tokens.length && tokens[i].type === TokenType.Comment) {
            // Append comment to last item?
            items[items.length - 1] += ' ' + tokens[i].value;
            isMultiline = true;
            i++;
        }

        // Newline?
        while (i < tokens.length && tokens[i].type === TokenType.Newline) {
            isMultiline = true;
            i++;
        }

        // Comma
        if (i < tokens.length && tokens[i].value === ',') {
            i++;
            // Comment after comma?
             while (i < tokens.length && tokens[i].type === TokenType.Whitespace) i++;
             if (i < tokens.length && tokens[i].type === TokenType.Comment) {
                 // Attach to this line/item
                 if (items.length > 0) items[items.length - 1] += ' ' + tokens[i].value;
                 else comments.push(tokens[i].value); // comment before first item but after comma? rare.
                 isMultiline = true;
                 i++;
             }
        }
    }

    // Force multiline if it was multiline or complex
    // Or if total length is big
    const totalLen = items.reduce((s, it) => s + it.length, 0);
    if (totalLen > 60 || comments.length > 0) isMultiline = true;

    if (isMultiline) {
        const indent = '  ';
        let res = '[\n';
        // If we have standalone comments (at start), print them
        comments.forEach(c => res += indent + c + '\n');

        items.forEach((item, idx) => {
            const lines = item.split('\n');
            const indentedItem = lines.map((l, i) => i === 0 ? l : indent + l).join('\n');
            res += indent + indentedItem;
            if (idx < items.length - 1) res += ',';
            // If item already has comment at end, it's included in item string
            res += '\n';
        });
        // Check if trailing comma is desired? Standard TOML allows it.
        // If multiline, trailing comma is good practice.
        if (items.length > 0 && !items[items.length-1].trim().endsWith(',')) {
             // We added comma in loop except last.
             // Add trailing comma for last item
             // Remove newline, add comma, add newline
             res = res.substring(0, res.length - 1) + ',\n';
        }
        res += ']';
        return { value: res, endIndex: i };
    } else {
        return { value: `[ ${items.join(', ')} ]`, endIndex: i };
    }
}

function parseInlineTable(tokens: Token[], startIndex: number): { value: string, endIndex: number } {
    let i = startIndex;
    i++; // consume {

    const items: string[] = [];

    while (i < tokens.length) {
        while (i < tokens.length && (tokens[i].type === TokenType.Whitespace || tokens[i].type === TokenType.Newline)) i++;

        if (i >= tokens.length) break;
        if (tokens[i].value === '}') {
            i++;
            break;
        }

        // Key
        const keyStart = i;
        while (i < tokens.length && tokens[i].value !== '=' && tokens[i].value !== '}') i++;

        if (tokens[i].value === '=') {
            const keyTokens = tokens.slice(keyStart, i).filter(t => t.type !== TokenType.Whitespace && t.type !== TokenType.Newline);
            const key = formatKey(keyTokens);
            i++; // skip =

            const valRes = parseValue(tokens, i);
            items.push(`${key} = ${valRes.value}`);
            i = valRes.endIndex;

            while (i < tokens.length && (tokens[i].type === TokenType.Whitespace || tokens[i].type === TokenType.Newline)) i++;
            if (i < tokens.length && tokens[i].value === ',') i++;
        } else {
            break; // error
        }
    }

    return { value: `{ ${items.join(', ')} }`, endIndex: i };
}

function formatKey(tokens: Token[]): string {
    return tokens.map(t => t.value).join('');
}

function printNodes(nodes: TOMLNode[]): string {
    const lines: string[] = [];
    let kvBuffer: TOMLNode[] = [];

    const flushBuffer = () => {
        if (kvBuffer.length === 0) return;

        // Calculate alignment
        let maxKeyLen = 0;
        kvBuffer.forEach(n => {
            if (n.key) maxKeyLen = Math.max(maxKeyLen, n.key.length);
        });

        kvBuffer.forEach(n => {
            const padding = ' '.repeat(maxKeyLen - n.key!.length);
            lines.push(`${n.key}${padding} = ${n.value}` + (n.comment ? ` ${n.comment}` : ''));
        });
        kvBuffer = [];
    };

    nodes.forEach(node => {
        if (node.type === 'KeyValuePair') {
            kvBuffer.push(node);
        } else {
            flushBuffer();
            if (node.type === 'TableHeader') {
                if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('');
                lines.push(`[${node.key}]` + (node.comment ? ` ${node.comment}` : ''));
            } else if (node.type === 'ArrayTableHeader') {
                if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('');
                lines.push(`[[${node.key}]]` + (node.comment ? ` ${node.comment}` : ''));
            } else if (node.type === 'Comment') {
                lines.push(node.raw!);
            } else if (node.type === 'Empty') {
                if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('');
            }
        }
    });
    flushBuffer();

    // Ensure single newline at end
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    return lines.join('\n') + '\n';
}
