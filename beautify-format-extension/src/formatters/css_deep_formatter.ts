import { Token, TokenType, tokenize } from './css_tokenizer';

interface CSSFormatterOptions {
    tabSize: number;
    insertSpaces: boolean;
}

// AST Nodes
interface Rule {
    type: 'Rule';
    selector: string;
    children: Node[];
}

interface AtRule {
    type: 'AtRule';
    name: string; // e.g., @media
    params: string; // e.g., screen and (min-width: 900px)
    children?: Node[]; // Block content
}

interface Property {
    type: 'Property';
    name: string;
    value: string;
}

interface Comment {
    type: 'Comment';
    value: string;
}

type Node = Rule | AtRule | Property | Comment;

export function formatCSSDeep(text: string, options: CSSFormatterOptions = { tabSize: 2, insertSpaces: true }): string {
    const tokens = tokenize(text);
    const nodes = parse(tokens);
    const sortedNodes = sortNodes(nodes);
    return print(sortedNodes, options).trim() + '\n';
}

function parse(tokens: Token[]): Node[] {
    const nodes: Node[] = [];
    let i = 0;
    while (i < tokens.length) {
        const t = tokens[i];
        if (t.type === TokenType.Whitespace) {
            i++;
            continue;
        }
        if (t.type === TokenType.Comment) {
            nodes.push({ type: 'Comment', value: t.value });
            i++;
            continue;
        }
        if (t.type === TokenType.AtKeyword) {
            const res = parseAtRule(tokens, i);
            nodes.push(res.node);
            i = res.nextIndex;
            continue;
        }
        if (t.type === TokenType.BraceClose) {
            i++;
            continue;
        }

        const res = parseRule(tokens, i);
        nodes.push(res.node);
        i = res.nextIndex;
    }
    return nodes;
}

function parseBlock(tokens: Token[], startIndex: number): { children: Node[], nextIndex: number } {
    const children: Node[] = [];
    let i = startIndex;

    // Expect {
    if (i < tokens.length && tokens[i].type === TokenType.BraceOpen) {
        i++;
    } else {
        return { children, nextIndex: i };
    }

    while (i < tokens.length) {
        const t = tokens[i];

        if (t.type === TokenType.Whitespace) {
            i++;
            continue;
        }

        if (t.type === TokenType.BraceClose) {
            i++;
            return { children, nextIndex: i };
        }

        if (t.type === TokenType.Comment) {
            children.push({ type: 'Comment', value: t.value });
            i++;
            continue;
        }

        if (t.type === TokenType.AtKeyword) {
            const res = parseAtRule(tokens, i);
            children.push(res.node);
            i = res.nextIndex;
            continue;
        }

        const isRule = scanIsRule(tokens, i);
        if (isRule) {
            const res = parseRule(tokens, i);
            children.push(res.node);
            i = res.nextIndex;
        } else {
            const res = parseProperty(tokens, i);
            children.push(res.node);
            i = res.nextIndex;
        }
    }

    return { children, nextIndex: i };
}

function scanIsRule(tokens: Token[], startIndex: number): boolean {
    let i = startIndex;
    while (i < tokens.length) {
        const t = tokens[i];
        if (t.type === TokenType.BraceOpen) return true;
        if (t.type === TokenType.BraceClose) return false;
        if (t.type === TokenType.Semicolon) return false;
        i++;
    }
    return false;
}

function parseAtRule(tokens: Token[], startIndex: number): { node: AtRule, nextIndex: number } {
    let i = startIndex;
    const name = tokens[i].value;
    i++;

    let paramsTokens: Token[] = [];
    while (i < tokens.length) {
        const t = tokens[i];
        if (t.type === TokenType.BraceOpen || t.type === TokenType.Semicolon || t.type === TokenType.BraceClose) {
            break;
        }
        paramsTokens.push(t);
        i++;
    }

    const params = reconstruct(paramsTokens).trim();

    if (i < tokens.length && tokens[i].type === TokenType.BraceOpen) {
        const blockRes = parseBlock(tokens, i);
        return {
            node: { type: 'AtRule', name, params, children: blockRes.children },
            nextIndex: blockRes.nextIndex
        };
    } else {
        if (i < tokens.length && tokens[i].type === TokenType.Semicolon) {
            i++;
        }
        return {
            node: { type: 'AtRule', name, params },
            nextIndex: i
        };
    }
}

function parseRule(tokens: Token[], startIndex: number): { node: Rule, nextIndex: number } {
    let i = startIndex;
    let selectorTokens: Token[] = [];

    while (i < tokens.length) {
        const t = tokens[i];
        if (t.type === TokenType.BraceOpen) break;
        if (t.type === TokenType.BraceClose) break;
        selectorTokens.push(t);
        i++;
    }

    const selector = reconstructSelector(selectorTokens).trim();
    const blockRes = parseBlock(tokens, i);

    return {
        node: { type: 'Rule', selector, children: blockRes.children },
        nextIndex: blockRes.nextIndex
    };
}

function parseProperty(tokens: Token[], startIndex: number): { node: Property, nextIndex: number } {
    let i = startIndex;
    let name = '';

    while (i < tokens.length) {
        const t = tokens[i];
        if (t.type === TokenType.Colon) {
            i++;
            break;
        }
        if (t.type === TokenType.Semicolon || t.type === TokenType.BraceClose || t.type === TokenType.BraceOpen) {
            break;
        }
        if (t.type !== TokenType.Whitespace) {
            name += t.value;
        }
        i++;
    }

    let valTokens: Token[] = [];
    while (i < tokens.length) {
        const t = tokens[i];
        if (t.type === TokenType.Semicolon) {
            i++;
            break;
        }
        if (t.type === TokenType.BraceClose || t.type === TokenType.BraceOpen) {
            break;
        }

        if (isStartOfNewProperty(tokens, i)) {
            break;
        }

        valTokens.push(t);
        i++;
    }

    // Use reconstructValue for hex safety and zero units
    let value = reconstructValue(valTokens).trim();
    value = normalizeValue(value);

    return {
        node: { type: 'Property', name: name.trim(), value },
        nextIndex: i
    };
}

function isStartOfNewProperty(tokens: Token[], currentIndex: number): boolean {
    let i = currentIndex;
    while (i < tokens.length && tokens[i].type === TokenType.Whitespace) {
        i++;
    }

    if (i >= tokens.length) return false;

    const t = tokens[i];
    if (t.type !== TokenType.Word) return false;

    i++;
    while (i < tokens.length && tokens[i].type === TokenType.Whitespace) {
        i++;
    }

    if (i >= tokens.length) return false;

    if (tokens[i].type === TokenType.Colon) {
        return true;
    }

    return false;
}

function sortNodes(nodes: Node[]): Node[] {
    const charsets: Node[] = [];
    const imports: Node[] = [];
    const others: Node[] = [];

    for (const node of nodes) {
        if (node.type === 'AtRule') {
            if (node.name === '@charset') {
                charsets.push(node);
            } else if (node.name === '@import') {
                imports.push(node);
            } else {
                others.push(node);
            }
        } else {
            others.push(node);
        }
    }

    imports.sort((a, b) => {
        const pa = (a as AtRule).params || '';
        const pb = (b as AtRule).params || '';
        return pa.localeCompare(pb);
    });

    return [...charsets, ...imports, ...others];
}

function normalizeValue(value: string): string {
    return value.replace(/(^|[\s(,])0(px|em|rem|in|cm|mm|pt|pc|ex|ch|vw|vh|vmin|vmax)(?=$|[\s,);])/gi, '$10');
}

function reconstruct(tokens: Token[]): string {
    let res = '';
    for (const t of tokens) {
        if (t.type === TokenType.Whitespace) {
            res += ' ';
        } else {
            res += t.value;
        }
    }
    // Collapse spaces in general strings (except String tokens handled by t.value)
    // Actually, if we output ' ' for each whitespace token, we might get multiple spaces.
    // Standard reconstruct for params/selectors: collapse spaces.
    return res.replace(/\s+/g, ' ');
}

function reconstructValue(tokens: Token[]): string {
    let res = '';
    let inUrl = false;

    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];

        if (t.type === TokenType.Word && t.value.toLowerCase() === 'url') {
             // Look ahead for (
             let k = i + 1;
             while (k < tokens.length && tokens[k].type === TokenType.Whitespace) k++;
             if (k < tokens.length && tokens[k].type === TokenType.ParenthesisOpen) {
                 inUrl = true;
             }
        }
        if (t.type === TokenType.ParenthesisClose) {
            inUrl = false;
        }

        // Hex logic
        if (t.type === TokenType.Hash && !inUrl) {
            // Check if next token is valid hex word
            let k = i + 1;
            // Should be adjacent? Tokenizer splits #ABC into Hash(#) Word(ABC).
            // No whitespace allowed for color hex.
            if (k < tokens.length && tokens[k].type === TokenType.Word) {
                const hex = tokens[k].value;
                if (/^[0-9a-fA-F]{3,8}$/.test(hex)) {
                    res += '#' + hex.toLowerCase();
                    i++; // Skip hex word
                    continue;
                }
            }
        }

        if (t.type === TokenType.Whitespace) {
            res += ' ';
        } else {
            res += t.value;
        }
    }

    // We want to collapse multiple spaces in property values (standard CSS)
    // but PRESERVE spaces inside String tokens (t.value).
    // The loop above produces ' ' for Whitespace tokens.
    // If we have "   " (String token), it is added as "   ".
    // If we have Word Space Space Word, we get Word  Word.
    // We should collapse the spaces outside strings.
    // But `res` is a string now. We don't know where strings are.
    // Simple fix: Tokenizer merged consecutive whitespace into single Whitespace token?
    // css_tokenizer.ts: `while ... /\s/.test ...`. Yes!
    // So one Whitespace token = one or more spaces.
    // If we output ' ', we collapse them!
    // So `res` already has collapsed spaces (one space per whitespace sequence).
    // So we don't need regex replace on `res`.
    // Wait, `reconstruct` uses regex replace. `reconstructValue` doesn't?
    // `reconstruct` collapses blindly.
    // `reconstructValue` should also yield collapsed spaces.
    // Since tokenizer merges whitespace, `t.type === Whitespace` represents a sequence of spaces.
    // Outputting ' ' replaces that sequence with one space.
    // Correct!

    return res.trim();
}


function reconstructSelector(tokens: Token[]): string {
    // Selectors also need whitespace preservation inside strings (attribute selectors).
    // So we should use similar logic to reconstruct, but be careful.
    // `reconstruct` logic:
    // t.type === Whitespace -> ' '
    // t.type === String -> t.value (preserves internal space)
    // Regex replace `/\s+/g, ' '` at the end...
    // THIS BREAKS STRINGS!
    // Because `t.value` ("   ") contains spaces. Regex will collapse them!

    // Fix: Remove the regex replace in `reconstruct` and `reconstructSelector`.
    // Rely on tokenizer merging whitespace tokens + outputting single space.

    let res = '';
    for (const t of tokens) {
        if (t.type === TokenType.Whitespace) {
            res += ' ';
        } else {
            res += t.value;
        }
    }
    return res.trim();
}

function print(nodes: Node[], options: CSSFormatterOptions, level = 0): string {
    const indentChar = options.insertSpaces ? ' ' : '\t';
    const indentSize = options.insertSpaces ? options.tabSize : 1;
    const indent = indentChar.repeat(indentSize * level);

    let output = '';

    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const prev = i > 0 ? nodes[i-1] : null;

        if (prev) {
            const prevBlock = prev.type === 'Rule' || (prev.type === 'AtRule' && !!prev.children);
            const currBlock = node.type === 'Rule' || (node.type === 'AtRule' && !!node.children);

            if (prevBlock || currBlock) {
                output += '\n';
            }
        }

        if (node.type === 'Rule') {
             output += indent + node.selector + ' {\n';
             output += print(node.children, options, level + 1);
             output += indent + '}\n';
        } else if (node.type === 'AtRule') {
             if (node.children) {
                 output += indent + node.name + ' ' + node.params + ' {\n';
                 output += print(node.children, options, level + 1);
                 output += indent + '}\n';
             } else {
                 output += indent + node.name + (node.params ? ' ' + node.params : '') + ';\n';
             }
        } else if (node.type === 'Property') {
             // Hex normalization done in parsing
             output += indent + node.name + ': ' + node.value + ';\n';
        } else if (node.type === 'Comment') {
             output += indent + node.value + '\n';
        }
    }
    return output;
}
