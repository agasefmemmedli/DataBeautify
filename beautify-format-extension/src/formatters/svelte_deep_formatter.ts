import { SvelteTokenizer, TokenType, Token } from './svelte_tokenizer';
import { formatJSDeep } from './js_deep_formatter';
import { formatCSSDeep } from './css_deep_formatter';

// --- AST Interfaces ---

export type SvelteNode =
    | SvelteRoot
    | SvelteElement
    | SvelteText
    | SvelteMustache
    | SvelteBlock
    | SvelteBlockBranch
    | SvelteComment
    | SvelteDoctype
    | SvelteDebug
    | SvelteConst
    | SvelteHtml;

export interface SvelteBaseNode {
    type: string;
}

export interface SvelteRoot extends SvelteBaseNode {
    type: 'Root';
    children: SvelteNode[];
}

export interface SvelteElement extends SvelteBaseNode {
    type: 'Element';
    tagName: string;
    attributes: SvelteAttribute[];
    children: SvelteNode[];
    isSelfClosing: boolean;
    isVoid: boolean;
}

export interface SvelteAttribute {
    name: string;
    value?: string; // string or expression
}

export interface SvelteText extends SvelteBaseNode {
    type: 'Text';
    content: string;
}

export interface SvelteMustache extends SvelteBaseNode {
    type: 'Mustache';
    content: string; // The expression inside { ... }
}

export interface SvelteBlock extends SvelteBaseNode {
    type: 'Block';
    name: string; // if, each, await, key
    expression: string; // The condition or expression
    children: SvelteNode[];
    branches: SvelteBlockBranch[]; // else, else if, then, catch
}

export interface SvelteBlockBranch extends SvelteBaseNode {
    type: 'Branch';
    branchType: string; // else, else if, then, catch
    expression?: string; // condition for else if
    children: SvelteNode[];
}

export interface SvelteComment extends SvelteBaseNode {
    type: 'Comment';
    content: string;
}

export interface SvelteDoctype extends SvelteBaseNode {
    type: 'Doctype';
    content: string;
}

export interface SvelteDebug extends SvelteBaseNode {
    type: 'Debug';
    content: string;
}

export interface SvelteConst extends SvelteBaseNode {
    type: 'Const';
    content: string;
}

export interface SvelteHtml extends SvelteBaseNode {
    type: 'Html';
    content: string; // The expression inside {@html ...}
}

// --- Formatting Options ---

export interface SvelteFormattingOptions {
    tabSize?: number;
    insertSpaces?: boolean;
    printWidth?: number;
}

// --- Main Function ---

export function formatSvelteDeep(text: string, options: SvelteFormattingOptions = {}): string {
    const tabSize = options.tabSize || 2;
    const insertSpaces = options.insertSpaces !== false;

    const tokenizer = new SvelteTokenizer(text);
    const tokens = tokenizer.tokenize();

    const parser = new SvelteParser(tokens);
    const ast = parser.parse();

    const printer = new SveltePrinter(ast, { tabSize, insertSpaces, printWidth: options.printWidth });
    return printer.print();
}

export class SvelteParser {
    private tokens: Token[];
    private pos: number = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    public parse(): SvelteRoot {
        const root: SvelteRoot = { type: 'Root', children: [] };
        const stack: (SvelteElement | SvelteRoot | SvelteBlock | SvelteBlockBranch)[] = [root];

        while (this.pos < this.tokens.length) {
            const token = this.tokens[this.pos];
            const parent = stack[stack.length - 1];

            if (token.type === TokenType.LogicBlockStart) {
                const content = token.text.substring(2, token.text.length - 1).trim(); // remove {# and }
                const firstSpace = content.indexOf(' ');
                const name = firstSpace === -1 ? content : content.substring(0, firstSpace);
                const expression = firstSpace === -1 ? '' : content.substring(firstSpace + 1).trim();

                const block: SvelteBlock = {
                    type: 'Block',
                    name,
                    expression,
                    children: [],
                    branches: []
                };

                // Add to parent
                if (parent.type === 'Block') {
                    parent.children.push(block);
                } else if (parent.type === 'Branch') {
                    parent.children.push(block);
                } else if (parent.type === 'Element' || parent.type === 'Root') {
                    parent.children.push(block);
                }

                stack.push(block);
                this.advance();

            } else if (token.type === TokenType.LogicBlockMiddle) {
                // {:else}, {:else if ...}
                let top = stack[stack.length - 1];

                // If currently inside a branch or element, we need to find the parent Block
                while (stack.length > 1) {
                    const current = stack[stack.length - 1];
                    if (current.type === 'Block') {
                        break;
                    }
                    if (current.type === 'Branch') {
                        stack.pop(); // Close previous branch
                        break;
                    }
                    // If element, pop it (auto-close)
                    stack.pop();
                }

                top = stack[stack.length - 1];

                if (top.type === 'Block') {
                    const block = top as SvelteBlock;

                    const content = token.text.substring(2, token.text.length - 1).trim(); // remove {: and }
                    const firstSpace = content.indexOf(' ');
                    const type = firstSpace === -1 ? content : content.substring(0, firstSpace);
                    const expression = firstSpace === -1 ? '' : content.substring(firstSpace + 1).trim();

                    const branch: SvelteBlockBranch = {
                        type: 'Branch',
                        branchType: type,
                        expression,
                        children: []
                    };
                    block.branches.push(branch);
                    stack.push(branch);
                }
                this.advance();

            } else if (token.type === TokenType.LogicBlockEnd) {
                // {/if}
                // Close everything until we find the Block
                while (stack.length > 1) {
                    const current = stack.pop();
                    if (current && current.type === 'Block') {
                        break;
                    }
                }
                this.advance();

            } else if (token.type === TokenType.TagOpen) {
                const tagName = token.text.substring(1).trim();
                const element: SvelteElement = {
                    type: 'Element',
                    tagName: tagName,
                    attributes: [],
                    children: [],
                    isSelfClosing: false,
                    isVoid: false
                };

                this.advance();
                while (this.pos < this.tokens.length) {
                    const attrToken = this.tokens[this.pos];
                    if (attrToken.type === TokenType.TagEnd) {
                        this.advance();
                        break;
                    } else if (attrToken.type === TokenType.TagSelfClose) {
                        element.isSelfClosing = true;
                        this.advance();
                        break;
                    } else if (attrToken.type === TokenType.AttributeName) {
                        const name = attrToken.text;
                        let value: string | undefined;
                        this.advance();
                        if (this.pos < this.tokens.length && this.tokens[this.pos].type === TokenType.AttributeValue) {
                            value = this.tokens[this.pos].text;
                            this.advance();
                        }
                        element.attributes.push({ name, value });
                    } else {
                        this.advance();
                    }
                }

                // Add to parent
                const currentParent = stack[stack.length - 1];
                 if (currentParent.type === 'Block') {
                    currentParent.children.push(element);
                } else if (currentParent.type === 'Branch') {
                    currentParent.children.push(element);
                } else if (currentParent.type === 'Element' || currentParent.type === 'Root') {
                    currentParent.children.push(element);
                }

                const voidTags = new Set([
                    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
                    'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
                ]);
                if (voidTags.has(tagName.toLowerCase())) {
                    element.isVoid = true;
                }

                if (!element.isSelfClosing && !element.isVoid) {
                    stack.push(element);
                }

            } else if (token.type === TokenType.TagClose) {
                let tagName = token.text.substring(2, token.text.length - 1).trim();
                tagName = tagName.split(/\s+/)[0];

                // Pop elements until match
                for (let i = stack.length - 1; i > 0; i--) {
                    const el = stack[i];
                    if (el.type === 'Element' && el.tagName === tagName) {
                        while (stack.length > i) {
                            stack.pop();
                        }
                        break;
                    }
                }
                this.advance();

            } else if (token.type === TokenType.TagSelfClose) {
                this.advance();
            } else if (token.type === TokenType.TagEnd) {
                this.advance();
            } else if (token.type === TokenType.Text) {
                const node: SvelteText = { type: 'Text', content: token.text };
                this.addToParent(stack, node);
                this.advance();
            } else if (token.type === TokenType.Expression) {
                const node: SvelteMustache = { type: 'Mustache', content: token.text };
                this.addToParent(stack, node);
                this.advance();
            } else if (token.type === TokenType.LogicBlockTag) {
                const content = token.text.substring(2, token.text.length - 1).trim();
                if (content.startsWith('html')) {
                     const node: SvelteHtml = { type: 'Html', content: content.substring(4).trim() };
                     this.addToParent(stack, node);
                } else if (content.startsWith('debug')) {
                     const node: SvelteDebug = { type: 'Debug', content: content.substring(5).trim() };
                     this.addToParent(stack, node);
                } else if (content.startsWith('const')) {
                     const node: SvelteConst = { type: 'Const', content: content.substring(5).trim() };
                     this.addToParent(stack, node);
                }
                this.advance();
            } else if (token.type === TokenType.Comment) {
                const node: SvelteComment = { type: 'Comment', content: token.text };
                this.addToParent(stack, node);
                this.advance();
            } else if (token.type === TokenType.Doctype) {
                const node: SvelteDoctype = { type: 'Doctype', content: token.text };
                this.addToParent(stack, node);
                this.advance();
            } else {
                this.advance();
            }
        }

        return root;
    }

    private addToParent(stack: any[], node: SvelteNode) {
        const parent = stack[stack.length - 1];
        if (parent.children) {
            parent.children.push(node);
        }
    }

    private advance() {
        this.pos++;
    }
}

export class SveltePrinter {
    private ast: SvelteRoot;
    private options: Required<SvelteFormattingOptions>;

    constructor(ast: SvelteRoot, options: any) {
        this.ast = ast;
        this.options = {
            tabSize: options.tabSize || 2,
            insertSpaces: options.insertSpaces !== false,
            printWidth: options.printWidth || 80
        };
    }

    public print(): string {
        return this.printNode(this.ast, 0);
    }

    private printNode(node: SvelteNode, level: number): string {
        const indent = ' '.repeat(level * this.options.tabSize);

        switch (node.type) {
            case 'Root':
                return node.children.map(c => this.printNode(c, level)).join('');

            case 'Text':
                if (!node.content.trim()) return '';
                if (node.content.includes('\n')) {
                    const lines = node.content.split('\n');
                    const cleanLines = lines
                        .map(l => l.trim())
                        .filter(l => l.length > 0)
                        .map(l => indent + l);
                    if (cleanLines.length === 0) return '';
                    return cleanLines.join('\n') + '\n';
                }
                return indent + node.content.trim() + '\n';

            case 'Mustache':
                return indent + node.content + '\n';

            case 'Comment':
                return indent + node.content + '\n';

            case 'Doctype':
                return indent + node.content + '\n';

            case 'Debug':
                return indent + `{@debug ${node.content}}\n`;

            case 'Html':
                return indent + `{@html ${node.content}}\n`;

            case 'Const':
                return indent + `{@const ${node.content}}\n`;

            case 'Element':
                return this.printElement(node as SvelteElement, level);

            case 'Block':
                return this.printBlock(node as SvelteBlock, level);

            default:
                return '';
        }
    }

    private printElement(node: SvelteElement, level: number): string {
        const indent = ' '.repeat(level * this.options.tabSize);
        let output = `${indent}<${node.tagName}`;

        if (node.attributes.length > 0) {
            const attrStrings = node.attributes.map(a => {
                 if (a.value === undefined) return a.name;
                 if (a.value.startsWith('{')) return `${a.name}=${a.value}`;
                 if (a.value.includes('"')) return `${a.name}='${a.value}'`;
                 return `${a.name}="${a.value}"`;
            });

            const totalLen = attrStrings.reduce((sum, s) => sum + s.length + 1, 0);
            if (totalLen + output.length > this.options.printWidth || node.attributes.length > 3) {
                output += '\n';
                attrStrings.forEach(s => {
                    output += `${indent}${' '.repeat(this.options.tabSize)}${s}\n`;
                });
                output += indent;
            } else {
                output += ' ' + attrStrings.join(' ');
            }
        }

        if (node.isSelfClosing) {
            return output + ' />\n';
        }

        output += '>';

        if (node.isVoid) {
            return output + '\n';
        }

        if (node.tagName === 'script' || node.tagName === 'style') {
            const content = node.children.map(c => c.type === 'Text' ? (c as SvelteText).content : '').join('');
            if (content.trim()) {
                let fmt = content;
                const opts = {
                    tabSize: this.options.tabSize,
                    insertSpaces: this.options.insertSpaces,
                    printWidth: this.options.printWidth
                };
                try {
                    if (node.tagName === 'script') {
                         fmt = formatJSDeep(content, opts);
                    } else {
                         fmt = formatCSSDeep(content, opts);
                    }
                } catch(e) {
                    // Fallback to original content if deep formatting fails (though formatters usually return something)
                    console.error(`Error formatting ${node.tagName} content:`, e);
                }

                // Re-indent content
                // formatJSDeep/CSSDeep return unindented (base level 0) string usually
                // But formatCSSDeep might return indented relative to root?
                // Let's assume they return 0-level indentation. We need to add `level + 1` indentation.

                const lines = fmt.split('\n');
                const contentIndent = ' '.repeat((level + 1) * this.options.tabSize);
                const indentedContent = lines.map(line => {
                    if (line.trim() === '') return '';
                    return contentIndent + line;
                }).join('\n');

                output += '\n' + indentedContent.trimEnd() + '\n' + indent + `</${node.tagName}>\n`;
            } else {
                output += `</${node.tagName}>\n`;
            }
            return output;
        }

        if (node.children.length === 0) {
            return output + `</${node.tagName}>\n`;
        }

        // Inline check
        const inlineCandidates = ['Text', 'Mustache', 'Html', 'Debug', 'Const', 'Comment'];
        const isInlineCandidates = node.children.every(c => inlineCandidates.includes(c.type));

        if (isInlineCandidates && node.children.length > 0) {
            const hasNewlines = node.children.some(c => c.type === 'Text' && (c as SvelteText).content.includes('\n'));

            if (!hasNewlines) {
                 const inlineContent = node.children.map(c => {
                      if (c.type === 'Text') return (c as SvelteText).content;
                      if (c.type === 'Mustache') return (c as SvelteMustache).content;
                      if (c.type === 'Html') return `{@html ${(c as SvelteHtml).content}}`;
                      if (c.type === 'Debug') return `{@debug ${(c as SvelteDebug).content}}`;
                      if (c.type === 'Const') return `{@const ${(c as SvelteConst).content}}`;
                      if (c.type === 'Comment') return (c as SvelteComment).content;
                      return '';
                 }).join('');

                 if (output.length + inlineContent.length + node.tagName.length + 3 < this.options.printWidth) {
                      return `${output}${inlineContent}</${node.tagName}>\n`;
                 }
            }
        }

        output += '\n';
        node.children.forEach(child => {
            output += this.printNode(child, level + 1);
        });
        output += `${indent}</${node.tagName}>\n`;

        return output;
    }

    private printBlock(node: SvelteBlock, level: number): string {
        const indent = ' '.repeat(level * this.options.tabSize);
        let output = `${indent}{#${node.name}${node.expression ? ' ' + node.expression : ''}}`;

        if (node.children.length > 0) {
            output += '\n';
            node.children.forEach(child => {
                output += this.printNode(child, level + 1);
            });
        }

        if (node.branches.length > 0) {
            if (node.children.length === 0) output += '\n';
            node.branches.forEach(branch => {
                output += this.printBranch(branch, level);
            });
        } else if (node.children.length === 0) {
            output += '\n';
        }

        output += `${indent}{/${node.name}}\n`;
        return output;
    }

    private printBranch(node: SvelteBlockBranch, level: number): string {
        const indent = ' '.repeat(level * this.options.tabSize);
        let output = `${indent}{:${node.branchType}${node.expression ? ' ' + node.expression : ''}}`;

        if (node.children.length > 0) {
            output += '\n';
            node.children.forEach(child => {
                output += this.printNode(child, level + 1);
            });
        } else {
            output += '\n';
        }
        return output;
    }
}
