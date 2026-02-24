import { AstroTokenizer, TokenType, Token } from './astro_tokenizer';

// --- AST Interfaces ---

export type AstroNode =
    | AstroRoot
    | AstroElement
    | AstroText
    | AstroExpression
    | AstroFrontmatter
    | AstroComment
    | AstroDoctype
    | AstroCDATA
    | AstroPI;

export interface AstroBaseNode {
    type: string;
}

export interface AstroRoot extends AstroBaseNode {
    type: 'Root';
    children: AstroNode[];
}

export interface AstroElement extends AstroBaseNode {
    type: 'Element';
    tagName: string;
    attributes: AstroAttribute[];
    children: AstroNode[];
    isSelfClosing: boolean;
    isVoid: boolean;
}

export interface AstroAttribute {
    name: string;
    value?: string; // string for "val" or '{expr}'
}

export interface AstroText extends AstroBaseNode {
    type: 'Text';
    content: string;
}

export interface AstroExpression extends AstroBaseNode {
    type: 'Expression';
    content: string; // The full { ... } text
}

export interface AstroFrontmatter extends AstroBaseNode {
    type: 'Frontmatter';
    content: string; // The content inside --- ... ---
    raw: string; // The full token text including ---
}

export interface AstroComment extends AstroBaseNode {
    type: 'Comment';
    content: string;
}

export interface AstroDoctype extends AstroBaseNode {
    type: 'Doctype';
    content: string;
}

export interface AstroCDATA extends AstroBaseNode {
    type: 'CDATA';
    content: string;
}

export interface AstroPI extends AstroBaseNode {
    type: 'PI';
    content: string;
}

// --- Formatting Options ---

interface AstroFormattingOptions {
    tabSize?: number;
    insertSpaces?: boolean;
    printWidth?: number;
}

// --- Main Function Stub ---

export function formatAstroDeep(text: string, options: AstroFormattingOptions = {}): string {
    const tabSize = options.tabSize || 2;
    const insertSpaces = options.insertSpaces !== false;

    const tokenizer = new AstroTokenizer(text);
    const tokens = tokenizer.tokenize();

    const parser = new AstroParser(tokens);
    const ast = parser.parse();

    const printer = new AstroPrinter(ast, { tabSize, insertSpaces, printWidth: options.printWidth });
    return printer.print();
}

class AstroParser {
    private tokens: Token[];
    private pos: number = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    public parse(): AstroRoot {
        const root: AstroRoot = { type: 'Root', children: [] };
        const stack: (AstroElement | AstroRoot)[] = [root];

        while (this.pos < this.tokens.length) {
            const token = this.tokens[this.pos];
            const parent = stack[stack.length - 1];

            if (token.type === TokenType.Frontmatter) {
                const node: AstroFrontmatter = {
                    type: 'Frontmatter',
                    content: token.text.substring(3, token.text.length - 3).trim(),
                    raw: token.text
                };
                parent.children.push(node);
                this.advance();
            } else if (token.type === TokenType.TagOpen) {
                const tagName = token.text.substring(1).trim();
                const element: AstroElement = {
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

                parent.children.push(element);

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

                let found = false;
                for (let i = stack.length - 1; i > 0; i--) {
                    const el = stack[i] as AstroElement;
                    if (el.tagName === tagName) {
                        while (stack.length > i) {
                            stack.pop();
                        }
                        found = true;
                        break;
                    }
                }
                this.advance();

            } else if (token.type === TokenType.TagSelfClose) {
                this.advance();
            } else if (token.type === TokenType.TagEnd) {
                this.advance();
            } else if (token.type === TokenType.Text) {
                const node: AstroText = { type: 'Text', content: token.text };
                parent.children.push(node);
                this.advance();
            } else if (token.type === TokenType.Expression) {
                const node: AstroExpression = { type: 'Expression', content: token.text };
                parent.children.push(node);
                this.advance();
            } else if (token.type === TokenType.Comment) {
                const node: AstroComment = { type: 'Comment', content: token.text };
                parent.children.push(node);
                this.advance();
            } else if (token.type === TokenType.Doctype) {
                const node: AstroDoctype = { type: 'Doctype', content: token.text };
                parent.children.push(node);
                this.advance();
            } else if (token.type === TokenType.CDATA) {
                const node: AstroCDATA = { type: 'CDATA', content: token.text };
                parent.children.push(node);
                this.advance();
            } else if (token.type === TokenType.PI) {
                const node: AstroPI = { type: 'PI', content: token.text };
                parent.children.push(node);
                this.advance();
            } else {
                this.advance();
            }
        }

        return root;
    }

    private advance() {
        this.pos++;
    }
}

class AstroPrinter {
    private ast: AstroRoot;
    private options: Required<AstroFormattingOptions>;
    private jsbeautify: any;

    constructor(ast: AstroRoot, options: any) {
        this.ast = ast;
        this.options = {
            tabSize: options.tabSize || 2,
            insertSpaces: options.insertSpaces !== false,
            printWidth: options.printWidth || 80
        };
        try {
            this.jsbeautify = require('js-beautify');
        } catch(e) {
            console.warn('js-beautify not found');
        }
    }

    public print(): string {
        return this.printNode(this.ast, 0);
    }

    private printNode(node: AstroNode, level: number): string {
        const indent = ' '.repeat(level * this.options.tabSize);

        switch (node.type) {
            case 'Root':
                return node.children.map(c => this.printNode(c, level)).join('');

            case 'Frontmatter':
                let fmtContent = node.content;
                if (this.jsbeautify) {
                    try {
                        fmtContent = this.jsbeautify.js(node.content, {
                            indent_size: this.options.tabSize,
                            indent_char: ' ',
                            preserve_newlines: true
                        });
                    } catch (e) {}
                }
                return `---\n${fmtContent}\n---\n`;

            case 'Text':
                if (/^\s*[\r\n]+\s*$/.test(node.content)) return '';

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

            case 'Comment':
                return `${indent}<!-- ${node.content.replace(/^<!--|-->$/g, '').trim()} -->\n`;

            case 'Expression':
                let js = node.content;
                if (js.startsWith('{') && js.endsWith('}')) {
                    js = js.substring(1, js.length - 1);
                }
                if (this.jsbeautify && js.trim()) {
                    try {
                        const fmt = this.jsbeautify.js(js, {
                            indent_size: this.options.tabSize,
                            indent_level: level
                        });
                        return `${indent}{${fmt.trim()}}\n`;
                    } catch (e) {}
                }
                return `${indent}{${js.trim()}}\n`;

            case 'Element':
                return this.printElement(node as AstroElement, level);

            case 'Doctype':
                return `${indent}${node.content}\n`;

            default:
                return '';
        }
    }

    private printElement(node: AstroElement, level: number): string {
        const indent = ' '.repeat(level * this.options.tabSize);
        let output = `${indent}<${node.tagName}`;

        if (node.attributes.length > 0) {
            const attrStrings = node.attributes.map(a => {
                 if (a.value === undefined) return a.name;
                 return `${a.name}=${a.value}`;
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

        if (node.children.length === 0) {
            return output + `</${node.tagName}>\n`;
        }

        if ((node.tagName === 'script' || node.tagName === 'style') && this.jsbeautify) {
            const content = node.children.map(c => c.type === 'Text' ? (c as AstroText).content : '').join('');
            let fmt = content;
            if (content.trim()) {
                try {
                    const opts = { indent_size: this.options.tabSize, indent_level: level + 1 };
                    if (node.tagName === 'script') fmt = this.jsbeautify.js(content, opts);
                    else fmt = this.jsbeautify.css(content, opts);
                } catch (e) {}
            }
            return `${output}\n${fmt}\n${indent}</${node.tagName}>\n`;
        }

        const isTextOnly = node.children.every(c => c.type === 'Text' || c.type === 'Expression');
        const shortContent = node.children.length === 1 && node.children[0].type === 'Text' && (node.children[0] as AstroText).content.length < 50 && !(node.children[0] as AstroText).content.includes('\n');

        if (shortContent) {
            const textContent = (node.children[0] as AstroText).content.trim();
            return `${output}${textContent}</${node.tagName}>\n`;
        }

        output += '\n';
        node.children.forEach(child => {
            output += this.printNode(child, level + 1);
        });
        output += `${indent}</${node.tagName}>\n`;

        return output;
    }
}
