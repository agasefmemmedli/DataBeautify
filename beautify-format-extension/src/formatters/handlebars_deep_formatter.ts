// ... (previous content imports and interfaces) ...
import { HandlebarsTokenizer, Token, TokenType } from './handlebars_tokenizer';

interface FormatterOptions {
    tabSize: number;
    insertSpaces: boolean;
    printWidth?: number;
}

type NodeType = 'Program' | 'Element' | 'Block' | 'Mustache' | 'Text' | 'Comment' | 'Attribute';

interface BaseNode {
    type: NodeType;
    start?: number;
    end?: number;
}

interface Program extends BaseNode {
    type: 'Program';
    children: Node[];
}

interface Element extends BaseNode {
    type: 'Element';
    tagName: string;
    attributes: Attribute[];
    children: Node[];
    selfClosing: boolean;
}

interface Attribute extends BaseNode {
    type: 'Attribute';
    name: string;
    value: string | null;
    quote: '"' | "'" | null;
}

interface Block extends BaseNode {
    type: 'Block';
    name: string; // "if foo"
    children: Node[];
    inverse?: Node[]; // Content of {{else}}
}

interface Mustache extends BaseNode {
    type: 'Mustache';
    content: string; // Content inside braces
    kind: 'escaped' | 'unescaped' | 'partial' | 'comment'; // {{ }}, {{{ }}}, {{> }}, {{! }}
}

interface Text extends BaseNode {
    type: 'Text';
    value: string;
}

interface Comment extends BaseNode {
    type: 'Comment';
    value: string; // HTML comment <!-- ... -->
}

type Node = Program | Element | Attribute | Block | Mustache | Text | Comment;

class HandlebarsParser {
    // ... (same as before) ...
    private tokens: Token[];
    private pos: number = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    public parse(): Program {
        const program: Program = {
            type: 'Program',
            children: []
        };

        while (this.pos < this.tokens.length) {
            const node = this.parseNode();
            if (node) {
                program.children.push(node);
            } else {
                this.pos++;
            }
        }

        return program;
    }

    private parseNode(): Node | null {
        if (this.pos >= this.tokens.length) return null;
        const token = this.tokens[this.pos];

        switch (token.type) {
            case TokenType.Text:
                this.pos++;
                return { type: 'Text', value: token.text };

            case TokenType.Comment:
                this.pos++;
                return { type: 'Comment', value: token.text };

            case TokenType.MustacheComment:
                this.pos++;
                // Strip {{!-- and --}} or {{! and }}
                let commentContent = token.text;
                if (commentContent.startsWith('{{!--')) {
                    commentContent = commentContent.substring(5, commentContent.length - 4).trim();
                } else {
                    commentContent = commentContent.substring(3, commentContent.length - 2).trim();
                }
                return { type: 'Mustache', content: commentContent, kind: 'comment' };

            case TokenType.MustacheExpression:
                this.pos++;
                let kind: 'escaped' | 'unescaped' | 'partial' | 'comment' = 'escaped';
                let mustacheContent = token.text;
                if (mustacheContent.startsWith('{{{')) {
                    kind = 'unescaped';
                    mustacheContent = mustacheContent.substring(3, mustacheContent.length - 3).trim();
                } else if (mustacheContent.startsWith('{{>')) {
                    kind = 'partial';
                    mustacheContent = mustacheContent.substring(3, mustacheContent.length - 2).trim();
                } else {
                    mustacheContent = mustacheContent.substring(2, mustacheContent.length - 2).trim();
                }
                return { type: 'Mustache', content: mustacheContent, kind };

            case TokenType.BlockOpen:
                return this.parseBlock();

            case TokenType.TagOpen:
                return this.parseElement();

            case TokenType.BlockInverse:
                 this.pos++;
                 return { type: 'Text', value: token.text };

            case TokenType.BlockClose:
                 this.pos++;
                 return { type: 'Text', value: token.text };

            default:
                this.pos++;
                return { type: 'Text', value: token.text };
        }
    }

    private parseBlock(): Block {
        const startToken = this.tokens[this.pos];
        this.pos++; // Consume BlockOpen

        const block: Block = {
            type: 'Block',
            name: startToken.text,
            children: []
        };

        const content = startToken.text.replace(/^\{\{\#?/, '').replace(/\}\}\}?$/, '').trim();
        block.name = content;

        this.fillBlock(block);
        return block;
    }

    private fillBlock(block: Block) {
        while (this.pos < this.tokens.length) {
            const token = this.tokens[this.pos];
            if (token.type === TokenType.BlockClose) {
                const closeContent = token.text.replace(/^\{\{\//, '').replace(/\}\}\}?$/, '').trim();
                const openName = block.name.split(' ')[0];
                const closeName = closeContent.split(' ')[0];
                if (openName === closeName || closeContent === '') {
                    this.pos++;
                    return;
                }
                return;
            }
            if (token.type === TokenType.BlockInverse) {
                this.pos++;
                block.inverse = [];
                const elseContent = token.text.replace(/^\{\{else/, '').replace(/\}\}\}?$/, '').trim();
                if (elseContent.startsWith('if')) {
                     const chainedBlock: Block = {
                         type: 'Block',
                         name: elseContent,
                         children: []
                     };
                     this.fillBlock(chainedBlock);
                     block.inverse.push(chainedBlock);
                     return;
                }

                while (this.pos < this.tokens.length) {
                    const invToken = this.tokens[this.pos];
                    if (invToken.type === TokenType.BlockClose) {
                         const closeContent = invToken.text.replace(/^\{\{\//, '').replace(/\}\}\}?$/, '').trim();
                         const openName = block.name.split(' ')[0];
                         const closeName = closeContent.split(' ')[0];
                         if (openName === closeName || closeContent === '') {
                             this.pos++;
                             return;
                         }
                         return;
                    } else if (invToken.type === TokenType.BlockInverse) {
                         const nextElseContent = invToken.text.replace(/^\{\{else/, '').replace(/\}\}\}?$/, '').trim();
                         if (nextElseContent.startsWith('if')) {
                             this.pos++;
                             const chainedBlock: Block = {
                                 type: 'Block',
                                 name: nextElseContent,
                                 children: []
                             };
                             this.fillBlock(chainedBlock);
                             block.inverse.push(chainedBlock);
                             return;
                         }
                         this.pos++;
                         block.inverse.push({ type: 'Text', value: invToken.text });
                    } else {
                        const node = this.parseNode();
                        if (node) block.inverse.push(node);
                    }
                }
                return;
            }
            const node = this.parseNode();
            if (node) block.children.push(node);
        }
    }

    private parseElement(): Element {
        const startToken = this.tokens[this.pos];
        this.pos++;

        const tagName = startToken.text.substring(1).trim();
        const element: Element = {
            type: 'Element',
            tagName: tagName,
            attributes: [],
            children: [],
            selfClosing: false
        };

        while (this.pos < this.tokens.length) {
            const token = this.tokens[this.pos];

            if (token.type === TokenType.TagEnd) {
                this.pos++;
                break;
            } else if (token.type === TokenType.TagSelfClose) {
                this.pos++;
                element.selfClosing = true;
                return element;
            } else if (token.type === TokenType.AttributeName) {
                this.pos++;
                const attrName = token.text;
                let attrValue: string | null = null;
                let quote: '"' | "'" | null = null;

                if (this.pos < this.tokens.length && this.tokens[this.pos].type === TokenType.AttributeValue) {
                    const valToken = this.tokens[this.pos];
                    this.pos++;
                    const raw = valToken.text;
                    if (raw.startsWith('"') && raw.endsWith('"')) {
                        quote = '"';
                        attrValue = raw.substring(1, raw.length - 1);
                    } else if (raw.startsWith("'") && raw.endsWith("'")) {
                        quote = "'";
                        attrValue = raw.substring(1, raw.length - 1);
                    } else {
                        attrValue = raw;
                    }
                }
                element.attributes.push({ type: 'Attribute', name: attrName, value: attrValue, quote });
            } else if (token.type === TokenType.MustacheExpression) {
                this.pos++;
                element.attributes.push({ type: 'Attribute', name: token.text, value: null, quote: null });
            } else if (token.type === TokenType.Whitespace) {
                this.pos++;
            } else {
                this.pos++;
            }
        }

        const voidTags = new Set([
            'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
            'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
        ]);
        if (voidTags.has(tagName.toLowerCase())) {
            element.selfClosing = true;
            return element;
        }

        while (this.pos < this.tokens.length) {
            const token = this.tokens[this.pos];
            if (token.type === TokenType.TagClose) {
                const closeTagName = token.text.substring(2, token.text.length - 1).trim();
                if (closeTagName.toLowerCase() === tagName.toLowerCase()) {
                    this.pos++;
                    return element;
                } else {
                    return element;
                }
            }

            const node = this.parseNode();
            if (node) element.children.push(node);
        }
        return element;
    }
}

class HandlebarsPrinter {
    private options: FormatterOptions;
    private indentString: string;
    private inlineTags = new Set([
        'a', 'abbr', 'b', 'bdo', 'button', 'cite', 'code', 'del', 'dfn', 'em', 'i', 'img', 'ins', 'kbd', 'label', 'map', 'object', 'q', 'samp', 'select', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'tt', 'var'
    ]);
    private preserveWhitespaceTags = new Set(['pre', 'textarea', 'script', 'style']);

    constructor(options: FormatterOptions) {
        this.options = options;
        this.indentString = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
    }

    public print(node: Node, indentLevel: number = 0): string {
        const indent = this.indentString.repeat(indentLevel);

        switch (node.type) {
            case 'Program':
                return this.printChildren((node as Program).children, indentLevel);

            case 'Element':
                const el = node as Element;
                const tagName = el.tagName;
                let attrs = '';
                if (el.attributes.length > 0) {
                     attrs = el.attributes.map(a => {
                         if (a.name.startsWith('{{')) return ' ' + a.name;
                         if (a.value === null) return ' ' + a.name;
                         const quote = a.quote || '"';
                         return ` ${a.name}=${quote}${a.value}${quote}`;
                     }).join('');
                }

                const openTag = `<${tagName}${attrs}${el.selfClosing ? ' />' : '>'}`;
                if (el.selfClosing) {
                    return indent + openTag;
                }

                if (this.preserveWhitespaceTags.has(tagName.toLowerCase())) {
                    return indent + openTag + el.children.map(c => this.printPreserved(c)).join('') + `</${tagName}>`;
                }

                const isInline = this.inlineTags.has(tagName.toLowerCase());

                if (isInline) {
                    const content = this.printChildrenInline(el.children);
                    if (content.includes('\n')) {
                         return indent + openTag + content + `</${tagName}>`;
                    }
                    return indent + openTag + content + `</${tagName}>`;
                }

                if (el.children.length === 0) {
                     return indent + openTag + `</${tagName}>`;
                }

                // Enhanced Logic: Try inline first for any block element
                // Calculate inline content
                const inlineContent = this.printChildrenInline(el.children);
                const combinedLength = indent.length + openTag.length + inlineContent.length + 2 + tagName.length + 1;

                // Check fit and no newlines (unless from whitespace preservation logic which collapses to space)
                // If nested blocks exist and print multiline, inlineContent has newlines.
                if (combinedLength <= (this.options.printWidth || 80) && !inlineContent.includes('\n')) {
                     return indent + openTag + inlineContent + `</${tagName}>`;
                }

                const childrenStr = this.printChildren(el.children, indentLevel + 1);
                return indent + openTag + '\n' + childrenStr + '\n' + indent + `</${tagName}>`;

            case 'Block':
                return this.printBlockInternal(node as Block, indentLevel, false);

            case 'Mustache':
                const m = node as Mustache;
                if (m.kind === 'unescaped') return indent + `{{{${m.content}}}}`;
                if (m.kind === 'partial') return indent + `{{>${m.content}}}`;
                if (m.kind === 'comment') return indent + `{{!${m.content}}}`;
                return indent + `{{${m.content}}}`;

            case 'Text':
                const val = (node as Text).value.trim();
                if (!val) return '';
                const lines = val.split(/\r?\n/);
                return lines.map((line) => {
                    const trimmed = line.trim();
                    if (!trimmed) return '';
                    return indent + trimmed;
                }).join('\n');

            case 'Comment':
                return indent + (node as Comment).value;

            default:
                return '';
        }
    }

    private printBlockInternal(block: Block, indentLevel: number, isChained: boolean): string {
        const indent = this.indentString.repeat(indentLevel);
        let header = '';
        if (isChained) {
            header = indent + `{{else ${block.name}}}`;
        } else {
            header = indent + `{{#${block.name}}}`;
        }

        const children = this.printChildren(block.children, indentLevel + 1);

        if (block.inverse && block.inverse.length > 0) {
            if (block.inverse.length === 1 && block.inverse[0].type === 'Block') {
                const chained = block.inverse[0] as Block;
                const inverseStr = this.printBlockInternal(chained, indentLevel, true);
                return header + '\n' + children + '\n' + inverseStr;
            } else {
                const inverseContent = this.printChildren(block.inverse, indentLevel + 1);
                const close = indent + `{{/${block.name.split(' ')[0]}}}`;
                return header + '\n' + children + '\n' + indent + '{{else}}\n' + inverseContent + '\n' + close;
            }
        } else {
            const close = indent + `{{/${block.name.split(' ')[0]}}}`;
            return header + '\n' + children + '\n' + close;
        }
    }

    private printChildren(nodes: Node[], indentLevel: number): string {
        return nodes.map(n => this.print(n, indentLevel)).filter(s => s.length > 0).join('\n');
    }

    private printChildrenInline(nodes: Node[]): string {
        return nodes.map(n => {
            if (n.type === 'Text') return (n as Text).value.replace(/\s+/g, ' ');
            return this.print(n, 0).trim();
        }).join('');
    }

    private printPreserved(node: Node): string {
        if (node.type === 'Text') return (node as Text).value;
        return this.print(node, 0);
    }
}

export function formatHandlebarsDeep(input: string, options: FormatterOptions = { tabSize: 2, insertSpaces: true, printWidth: 80 }): string {
    const tokenizer = new HandlebarsTokenizer(input);
    const tokens = tokenizer.tokenize().filter(t => t.type !== TokenType.Whitespace);

    const parser = new HandlebarsParser(tokens);
    const ast = parser.parse();

    const printer = new HandlebarsPrinter(options);
    return printer.print(ast).trim() + '\n';
}
