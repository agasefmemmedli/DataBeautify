import { TOMLTokenizer, Token, TokenType } from './toml_tokenizer';

interface TOMLLine {
    type: 'KeyValuePair' | 'TableHeader' | 'ArrayTableHeader' | 'Comment' | 'Empty';
    key?: string;
    value?: string;
    raw?: string;
    comment?: string;
}

export function formatTOMLDeep(text: string): string {
    const tokenizer = new TOMLTokenizer(text);
    const tokens = tokenizer.tokenize();

    // 1. Group tokens into Logical Lines
    // A logical line ends at Newline, UNLESS we are inside [ ] or { } or """/'''
    const logicalLines: Token[][] = [];
    let currentLine: Token[] = [];
    let bracketLevel = 0;
    let braceLevel = 0;

    for (const t of tokens) {
        if (t.type === TokenType.Newline) {
            if (bracketLevel === 0 && braceLevel === 0) {
                // End of logical line
                if (currentLine.length > 0) {
                    logicalLines.push(currentLine);
                    currentLine = [];
                } else {
                    // Preserve empty lines if they are relevant?
                    // But tokenizer emits Newline tokens. If we skip them here, we lose empty lines.
                    // Let's push a special empty line token?
                    // Or just push empty array?
                    logicalLines.push([]);
                }
            } else {
                // Inside structure, ignore newline (or treat as whitespace/formatting hint?)
                // For Deep Formatting, we usually ignore original layout and reformat.
                // So skipping Newline tokens inside structure is fine, as long as we separate items.
                // But we need to ensure we don't merge `1` and `2` into `12`.
                // Tokenizer separates them.
            }
        } else if (t.type === TokenType.Comment) {
             // Comments usually end a line.
             // If we are inside structure: `[ 1, # comment \n 2 ]`
             // The comment should be attached to something.
             // For simplicity, let's treat comments as separate tokens in the stream.
             // But if we are inside structure, a comment ends the physical line but not logical structure.
             // We can keep comment in the stream.
             currentLine.push(t);
        } else {
            if (t.value === '[') bracketLevel++;
            else if (t.value === ']') bracketLevel--;
            else if (t.value === '{') braceLevel++;
            else if (t.value === '}') braceLevel--;

            currentLine.push(t);
        }
    }
    if (currentLine.length > 0) logicalLines.push(currentLine);

    // 2. Parse Logical Lines
    const lines: TOMLLine[] = [];

    for (const lineTokens of logicalLines) {
        if (lineTokens.length === 0) {
            lines.push({ type: 'Empty' });
            continue;
        }

        const meaningful = lineTokens.filter(t => t.type !== TokenType.Whitespace);
        // Find comment (it might be at the end or the whole line)
        // If whole line is comment, handled separately?
        // Actually, if we have `key = val # comment`, meaningful includes key, =, val, #, comment.
        // We should separate comment.

        let comment: string | undefined;
        let mainTokens = meaningful;

        // Check if last meaningful token is comment
        if (meaningful.length > 0 && meaningful[meaningful.length - 1].type === TokenType.Comment) {
            comment = meaningful[meaningful.length - 1].value;
            mainTokens = meaningful.slice(0, meaningful.length - 1);
        }

        if (mainTokens.length === 0) {
            if (comment) {
                lines.push({ type: 'Comment', raw: comment });
            } else {
                lines.push({ type: 'Empty' });
            }
            continue;
        }

        // Table Header
        if (mainTokens[0].value === '[' && mainTokens[mainTokens.length - 1].value === ']') {
            if (mainTokens.length >= 4 && mainTokens[1].value === '[' && mainTokens[mainTokens.length - 2].value === ']') {
                const keyTokens = mainTokens.slice(2, mainTokens.length - 2);
                lines.push({ type: 'ArrayTableHeader', key: reconstructKey(keyTokens), comment });
            } else {
                const keyTokens = mainTokens.slice(1, mainTokens.length - 1);
                lines.push({ type: 'TableHeader', key: reconstructKey(keyTokens), comment });
            }
            continue;
        }

        // Key = Value
        // Find assignment in the FULL lineTokens to preserve whitespace in value
        let assignIndex = -1;
        let bLevel = 0;
        let brLevel = 0;

        for (let i = 0; i < lineTokens.length; i++) {
            const t = lineTokens[i];
            if (t.type === TokenType.Whitespace || t.type === TokenType.Comment) continue;

            if (t.value === '[') bLevel++;
            else if (t.value === ']') bLevel--;
            else if (t.value === '{') brLevel++;
            else if (t.value === '}') brLevel--;
            else if (t.value === '=' && bLevel === 0 && brLevel === 0) {
                assignIndex = i;
                break;
            }
        }

        if (assignIndex > 0) {
            // Key is everything before =, minus leading/trailing whitespace
            const keyTokens = lineTokens.slice(0, assignIndex).filter(t => t.type !== TokenType.Whitespace && t.type !== TokenType.Comment);

            // Value is everything after =, minus comment.
            // We want to preserve internal whitespace in value (e.g. for dates "date time"),
            // but trim leading/trailing whitespace around the value itself.
            let valueTokens = lineTokens.slice(assignIndex + 1);

            // Remove comment from value tokens if present at end
            if (valueTokens.length > 0 && valueTokens[valueTokens.length - 1].type === TokenType.Comment) {
                valueTokens.pop();
            }

            // Trim leading/trailing whitespace tokens from valueTokens
            // (We handle this inside formatValue or here?)
            // formatValue joins tokens. If we leave whitespace tokens, they are joined.
            // " =  val " -> valueTokens = ["  ", "val", " "]
            // We want "val".
            // " = 2020-01-01 10:00 " -> valueTokens = [" ", "2020...", " ", "10:00", " "]
            // We want "2020... 10:00".

            // Trim start
            while(valueTokens.length > 0 && valueTokens[0].type === TokenType.Whitespace) valueTokens.shift();
            // Trim end
            while(valueTokens.length > 0 && valueTokens[valueTokens.length - 1].type === TokenType.Whitespace) valueTokens.pop();

            lines.push({
                type: 'KeyValuePair',
                key: reconstructKey(keyTokens),
                value: formatValue(valueTokens),
                comment
            });
            continue;
        }

        // Fallback
        const raw = lineTokens.map(t => t.value).join('');
        lines.push({ type: 'Comment', raw: raw.trim() });
    }

    // 3. Format and Align
    const formattedLines: string[] = [];
    let sectionBuffer: TOMLLine[] = [];

    const flushSection = () => {
        if (sectionBuffer.length === 0) return;

        let maxKeyLen = 0;
        sectionBuffer.forEach(l => {
            if (l.type === 'KeyValuePair' && l.key) {
                maxKeyLen = Math.max(maxKeyLen, l.key.length);
            }
        });

        sectionBuffer.forEach(l => {
            if (l.type === 'TableHeader') {
                if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                    formattedLines.push('');
                }
                formattedLines.push(`[${l.key}]` + (l.comment ? ` ${l.comment}` : ''));
            } else if (l.type === 'ArrayTableHeader') {
                if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                    formattedLines.push('');
                }
                formattedLines.push(`[[${l.key}]]` + (l.comment ? ` ${l.comment}` : ''));
            } else if (l.type === 'KeyValuePair') {
                const padding = ' '.repeat(maxKeyLen - l.key!.length);
                formattedLines.push(`${l.key}${padding} = ${l.value}` + (l.comment ? ` ${l.comment}` : ''));
            } else if (l.type === 'Comment') {
                formattedLines.push(l.raw!);
            } else if (l.type === 'Empty') {
                if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                    formattedLines.push('');
                }
            }
        });
        sectionBuffer = [];
    };

    for (const line of lines) {
        if (line.type === 'TableHeader' || line.type === 'ArrayTableHeader') {
            flushSection();
            sectionBuffer.push(line);
            flushSection();
        } else if (line.type === 'Empty') {
             flushSection();
             sectionBuffer.push(line);
             flushSection();
        } else {
            sectionBuffer.push(line);
        }
    }
    flushSection();

    return formattedLines.join('\n') + '\n';
}

function reconstructKey(tokens: Token[]): string {
    return tokens.map(t => t.value).join('');
}

function formatValue(tokens: Token[]): string {
    if (tokens.length === 0) return '';

    // Check for Array or Inline Table
    if (tokens[0].value === '[') {
        return formatArray(tokens);
    }
    if (tokens[0].value === '{') {
        return formatInlineTable(tokens);
    }

    return tokens.map(t => t.value).join('');
}

function formatArray(tokens: Token[]): string {
    const items: Token[][] = [];
    let currentItem: Token[] = [];
    let bracketLevel = 0;
    let braceLevel = 0;

    const content = tokens.slice(1, tokens.length - 1);

    for (const t of content) {
        if (t.value === '[') bracketLevel++;
        else if (t.value === ']') bracketLevel--;
        else if (t.value === '{') braceLevel++;
        else if (t.value === '}') braceLevel--;

        if (t.value === ',' && bracketLevel === 0 && braceLevel === 0) {
            items.push(currentItem);
            currentItem = [];
        } else {
            currentItem.push(t);
        }
    }
    if (currentItem.length > 0) items.push(currentItem);

    // Check complexity
    // If any item is complex or total length is high
    const formattedItems = items.map(itemTokens => {
        // Trim whitespace from item tokens
        let tokens = [...itemTokens];
        while(tokens.length > 0 && tokens[0].type === TokenType.Whitespace) tokens.shift();
        while(tokens.length > 0 && tokens[tokens.length - 1].type === TokenType.Whitespace) tokens.pop();
        return formatValue(tokens);
    });
    const totalLength = formattedItems.reduce((sum, s) => sum + s.length, 0);
    const isMultiline = formattedItems.length > 4 || totalLength > 60 || formattedItems.some(s => s.includes('\n'));

    if (isMultiline) {
        // Indent items
        // If item itself is multiline (nested array), we need to indent it further?
        // formatValue returns string. We can just indent the string.
        const indent = '  ';
        const joined = formattedItems.map(s => {
            // Indent all lines of s
            return s.split('\n').map((l, i) => i === 0 ? l : indent + l).join('\n');
        }).join(',\n' + indent);

        return `[\n${indent}${joined}\n]`;
    } else {
        return `[ ${formattedItems.join(', ')} ]`;
    }
}

function formatInlineTable(tokens: Token[]): string {
    const items: Token[][] = [];
    let currentItem: Token[] = [];
    let bracketLevel = 0;
    let braceLevel = 0;

    const content = tokens.slice(1, tokens.length - 1);

    for (const t of content) {
        if (t.value === '[') bracketLevel++;
        else if (t.value === ']') bracketLevel--;
        else if (t.value === '{') braceLevel++;
        else if (t.value === '}') braceLevel--;

        if (t.value === ',' && bracketLevel === 0 && braceLevel === 0) {
            items.push(currentItem);
            currentItem = [];
        } else {
            currentItem.push(t);
        }
    }
    if (currentItem.length > 0) items.push(currentItem);

    const formattedItems = items.map(itemTokens => {
        let eqIdx = -1;
        for(let i=0; i<itemTokens.length; i++) {
             if(itemTokens[i].value === '=') {
                 eqIdx = i;
                 break;
             }
        }
        if(eqIdx > 0) {
            // Trim Key
            let keyTokens = itemTokens.slice(0, eqIdx);
            while(keyTokens.length > 0 && keyTokens[0].type === TokenType.Whitespace) keyTokens.shift();
            while(keyTokens.length > 0 && keyTokens[keyTokens.length - 1].type === TokenType.Whitespace) keyTokens.pop();
            const key = reconstructKey(keyTokens);

            // Trim Value
            let valTokens = itemTokens.slice(eqIdx+1);
            while(valTokens.length > 0 && valTokens[0].type === TokenType.Whitespace) valTokens.shift();
            while(valTokens.length > 0 && valTokens[valTokens.length - 1].type === TokenType.Whitespace) valTokens.pop();
            const val = formatValue(valTokens);

            return `${key} = ${val}`;
        }
        // Fallback for non-kv items in inline table (invalid but tolerant)
        return itemTokens.map(t => t.value).join('').trim();
    });

    return `{ ${formattedItems.join(', ')} }`;
}
