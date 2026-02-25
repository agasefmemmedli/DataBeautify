import { tokenize, TokenType, Token } from './prisma_tokenizer';

interface Block {
    kind: 'model' | 'enum' | 'datasource' | 'generator' | 'type';
    name: string;
    items: BlockItem[];
    comments: string[]; // Comments before the block
}

type BlockItem = Field | ConfigAssignment | EnumValue | BlockAttribute | CommentItem | EmptyLine;

interface Field {
    kind: 'field';
    name: string;
    type: string;
    attributes: string[];
    comment?: string; // Inline comment
}

interface ConfigAssignment {
    kind: 'assignment';
    key: string;
    value: string;
    comment?: string;
}

interface EnumValue {
    kind: 'enumValue';
    name: string;
    attributes: string[];
    comment?: string;
}

interface BlockAttribute {
    kind: 'blockAttribute';
    value: string; // e.g. @@map("users")
    comment?: string;
}

interface CommentItem {
    kind: 'comment';
    text: string;
}

interface EmptyLine {
    kind: 'empty';
}

export function formatPrismaDeep(text: string): string {
    const tokens = tokenize(text);
    const blocks: (Block | CommentItem | EmptyLine)[] = parsePrisma(tokens);
    return printPrisma(blocks);
}

function parsePrisma(tokens: Token[]): (Block | CommentItem | EmptyLine)[] {
    const nodes: (Block | CommentItem | EmptyLine)[] = [];
    let i = 0;

    while (i < tokens.length) {
        const token = tokens[i];

        if (token.type === TokenType.Whitespace) {
            const newlines = (token.value.match(/\n/g) || []).length;
            if (newlines > 1) {
                if (nodes.length > 0 && nodes[nodes.length - 1].kind !== 'empty') {
                    nodes.push({ kind: 'empty' });
                }
            }
            i++;
            continue;
        }

        if (token.type === TokenType.Comment) {
            nodes.push({ kind: 'comment', text: token.value.trim() });
            i++;
            continue;
        }

        if (token.type === TokenType.Keyword) {
            // Block start
            const kindStr = token.value;
            let kind: Block['kind'] = 'model';
            if (['model', 'enum', 'datasource', 'generator', 'type'].includes(kindStr)) {
                kind = kindStr as any;
                i++;

                // Skip whitespace
                while (i < tokens.length && tokens[i].type === TokenType.Whitespace) i++;

                let name = '';
                if (i < tokens.length && tokens[i].type === TokenType.Identifier) {
                    name = tokens[i].value;
                    i++;
                }

                // Skip whitespace
                while (i < tokens.length && tokens[i].type === TokenType.Whitespace) i++;

                if (i < tokens.length && tokens[i].type === TokenType.BraceOpen) {
                    i++; // Skip {
                    const blockItems = parseBlockContent(tokens, i, kind);
                    nodes.push({
                        kind,
                        name,
                        items: blockItems.items,
                        comments: []
                    });
                    i = blockItems.endIndex;
                } else {
                    i++;
                }
            } else {
                i++;
            }
            continue;
        }

        i++;
    }
    return nodes;
}

function parseBlockContent(tokens: Token[], startIndex: number, blockType: Block['kind']): { items: BlockItem[], endIndex: number } {
    const items: BlockItem[] = [];
    let i = startIndex;

    while (i < tokens.length) {
        const token = tokens[i];

        if (token.type === TokenType.BraceClose) {
            i++;
            return { items, endIndex: i };
        }

        if (token.type === TokenType.Whitespace) {
            const newlines = (token.value.match(/\n/g) || []).length;
            if (newlines > 1) {
                if (items.length > 0 && items[items.length - 1].kind !== 'empty') {
                    items.push({ kind: 'empty' });
                }
            }
            i++;
            continue;
        }

        if (token.type === TokenType.Comment) {
            items.push({ kind: 'comment', text: token.value.trim() });
            i++;
            continue;
        }

        if (token.type === TokenType.BlockAttribute) {
            // @@index...
            const attr = parseAttribute(tokens, i);
            items.push({ kind: 'blockAttribute', value: attr.value });
            i = attr.endIndex;
            continue;
        }

        if (token.type === TokenType.Identifier || token.type === TokenType.Keyword) {
            // Field, EnumValue, or Assignment
            const name = token.value;
            // i is currently at Identifier.
            i++;

            // Peek next significant token
            let tempI = i;
            while (tempI < tokens.length && tokens[tempI].type === TokenType.Whitespace) tempI++;

            if (tempI < tokens.length && tokens[tempI].type === TokenType.Equals) {
                // Assignment: key = value
                i = tempI + 1; // Skip =
                // Consume Value
                const val = parseValue(tokens, i);
                items.push({ kind: 'assignment', key: name, value: val.value });
                i = val.endIndex;
            } else {
                // Field or EnumValue
                if (blockType === 'enum') {
                    // Enum Value
                    const attrs: string[] = [];
                    // Skip whitespace
                     while (i < tokens.length) {
                        if (tokens[i].type === TokenType.Whitespace) {
                             if (tokens[i].value.includes('\n')) break; // End of line
                             i++;
                             continue;
                        }
                        if (tokens[i].type === TokenType.Attribute) {
                            const attr = parseAttribute(tokens, i);
                            attrs.push(attr.value);
                            i = attr.endIndex;
                            continue;
                        }
                         if (tokens[i].type === TokenType.Comment) {
                             break;
                         }
                        break;
                    }
                    items.push({ kind: 'enumValue', name, attributes: attrs });
                } else {
                    // Model Field: Name Type Attributes
                    let typeStr = '';
                    while (i < tokens.length) {
                         if (tokens[i].type === TokenType.Whitespace) {
                             i++; continue;
                         }
                         if (tokens[i].type === TokenType.Identifier || tokens[i].type === TokenType.Keyword) {
                             typeStr += tokens[i].value;
                             i++;
                             // Check for modifiers
                             while (i < tokens.length) {
                                 const t = tokens[i];
                                 if (t.type === TokenType.QuestionMark) { typeStr += '?'; i++; }
                                 else if (t.type === TokenType.BracketOpen && tokens[i+1]?.type === TokenType.BracketClose) { typeStr += '[]'; i+=2; }
                                 else if (t.type === TokenType.ParenOpen) {
                                      // Unsupported("...")
                                      const paren = parseBalanced(tokens, i, TokenType.ParenOpen, TokenType.ParenClose);
                                      typeStr += paren.value;
                                      i = paren.endIndex;
                                 }
                                 else { break; }
                             }
                             break;
                         }
                         break;
                    }

                    // Attributes
                    const attrs: string[] = [];
                    while (i < tokens.length) {
                        if (tokens[i].type === TokenType.Whitespace) {
                            if (tokens[i].value.includes('\n')) break;
                            i++; continue;
                        }
                        if (tokens[i].type === TokenType.Attribute) {
                             const attr = parseAttribute(tokens, i);
                             attrs.push(attr.value);
                             i = attr.endIndex;
                             continue;
                        }
                        if (tokens[i].type === TokenType.Comment) break;
                        break;
                    }

                    items.push({ kind: 'field', name, type: typeStr, attributes: attrs });
                }
            }
            continue;
        }

        // Handle unknown?
        i++;
    }
    return { items, endIndex: i };
}

function parseAttribute(tokens: Token[], startIndex: number): { value: string, endIndex: number } {
    let i = startIndex;
    let val = tokens[i].value; // @ or @@
    i++;

    // Skip whitespace before (
    let tempI = i;
    while(tempI < tokens.length && tokens[tempI].type === TokenType.Whitespace && !tokens[tempI].value.includes('\n')) {
        tempI++;
    }

    if (tempI < tokens.length && tokens[tempI].type === TokenType.ParenOpen) {
        // We found '('. Do NOT include the whitespace in val (Prisma standard)
        i = tempI;
        const args = parseBalanced(tokens, i, TokenType.ParenOpen, TokenType.ParenClose);
        val += args.value;
        i = args.endIndex;
    }

    return { value: val, endIndex: i };
}

function parseBalanced(tokens: Token[], startIndex: number, openType: TokenType, closeType: TokenType): { value: string, endIndex: number } {
    let i = startIndex;
    let val = tokens[i].value;
    i++;
    let depth = 1;

    while (i < tokens.length && depth > 0) {
        const t = tokens[i];
        if (t.type === openType) depth++;
        if (t.type === closeType) depth--;

        val += t.value;
        i++;
    }
    return { value: val, endIndex: i };
}

function parseValue(tokens: Token[], startIndex: number): { value: string, endIndex: number } {
    let val = '';
    let i = startIndex;

    // Skip initial whitespace
    while (i < tokens.length && tokens[i].type === TokenType.Whitespace) {
        if (tokens[i].value.includes('\n')) return { value: '', endIndex: i };
        i++;
    }

    while (i < tokens.length) {
        const t = tokens[i];

        if (t.type === TokenType.Whitespace && t.value.includes('\n')) break;
        if (t.type === TokenType.Comment) break;

        if (t.type === TokenType.BracketOpen) {
             const balanced = parseBalanced(tokens, i, TokenType.BracketOpen, TokenType.BracketClose);
             val += balanced.value;
             i = balanced.endIndex;
             continue;
        }

        if (t.type === TokenType.ParenOpen) {
             const balanced = parseBalanced(tokens, i, TokenType.ParenOpen, TokenType.ParenClose);
             val += balanced.value;
             i = balanced.endIndex;
             continue;
        }

        val += t.value;
        i++;
    }

    return { value: val.trim(), endIndex: i };
}


function printPrisma(nodes: (Block | CommentItem | EmptyLine)[]): string {
    const lines: string[] = [];

    nodes.forEach(node => {
        if (node.kind === 'empty') {
            lines.push('');
        } else if (node.kind === 'comment') {
            lines.push(node.text);
        } else {
            // Block
            const items = node.items;

            // Analyze columns
            let maxName = 0;
            let maxType = 0;
            let maxKey = 0;

            items.forEach(item => {
                if (item.kind === 'field') {
                    if (item.name.length > maxName) maxName = item.name.length;
                    if (item.type.length > maxType) maxType = item.type.length;
                } else if (item.kind === 'assignment') {
                    if (item.key.length > maxKey) maxKey = item.key.length;
                } else if (item.kind === 'enumValue') {
                    if (item.name.length > maxName) maxName = item.name.length;
                }
            });

            lines.push(`${node.kind} ${node.name} {`);

            items.forEach(item => {
                if (item.kind === 'empty') {
                    lines.push('');
                } else if (item.kind === 'comment') {
                    lines.push(`  ${item.text}`);
                } else if (item.kind === 'blockAttribute') {
                    lines.push(`  ${item.value}`);
                } else if (item.kind === 'field') {
                    const namePad = item.name.padEnd(maxName);
                    let line = `  ${namePad}`;

                    if (maxType > 0 || item.type) {
                        const typePad = item.type.padEnd(maxType);
                        line += ` ${typePad}`;
                    }

                    if (item.attributes.length > 0) {
                        line += ` ${item.attributes.join(' ')}`;
                    }
                    if (item.comment) {
                        line += `  ${item.comment}`;
                    }
                    lines.push(line.trimEnd());
                } else if (item.kind === 'assignment') {
                    const keyPad = item.key.padEnd(maxKey);
                    let line = `  ${keyPad} = ${item.value}`;
                    if (item.comment) line += `  ${item.comment}`;
                    lines.push(line);
                } else if (item.kind === 'enumValue') {
                    // Enum alignment: Name [Attributes] [Comment]
                    let line = `  ${item.name.padEnd(maxName)}`;
                    if (item.attributes.length > 0) {
                        line += ` ${item.attributes.join(' ')}`;
                    }
                    if (item.comment) line += `  ${item.comment}`;
                    lines.push(line.trimEnd());
                }
            });

            lines.push('}');
        }
    });

    return lines.join('\n');
}

export function validatePrisma(text: string): string | undefined {
    let braceLevel = 0;
    const tokens = tokenize(text);

    for (const token of tokens) {
        if (token.type === TokenType.BraceOpen) braceLevel++;
        if (token.type === TokenType.BraceClose) braceLevel--;
    }

    if (braceLevel !== 0) {
        return braceLevel > 0 ? `Missing ${braceLevel} closing brace(s)` : `Extra closing brace(s)`;
    }
    return undefined;
}
