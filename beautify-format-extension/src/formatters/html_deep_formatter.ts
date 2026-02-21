import { HTMLTokenizer, TokenType, Token } from './html_tokenizer';

interface HTMLFormattingOptions {
    tabSize?: number;
    insertSpaces?: boolean;
    sortAttributes?: boolean;
    printWidth?: number;
    wrapAttributes?: 'auto' | 'force' | 'force-aligned' | 'force-expand-multiline' | 'aligned-multiple' | 'preserve' | 'preserve-aligned';
}

export function formatHTMLDeep(html: string, options: HTMLFormattingOptions = {}): string {
    const tabSize = options.tabSize || 2;
    const insertSpaces = options.insertSpaces !== false;
    const indentString = insertSpaces ? ' '.repeat(tabSize) : '\t';
    const printWidth = options.printWidth || 120;
    const sortAttributes = options.sortAttributes !== false; // Default true

    // Void elements (no closing tag)
    const voidTags = new Set([
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
    ]);

    // Block-level elements that usually start on a new line (for readability)
    const blockTags = new Set([
        'address', 'article', 'aside', 'blockquote', 'body', 'canvas', 'dd', 'div', 'dl', 'dt',
        'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'header', 'hgroup', 'hr', 'li', 'main', 'nav', 'noscript', 'ol', 'output', 'p', 'pre',
        'section', 'table', 'tfoot', 'ul', 'video', 'html', 'head', 'script', 'style'
    ]);

    const tokenizer = new HTMLTokenizer(html);
    const tokens = tokenizer.tokenize();

    let formattedLines: string[] = [];
    let indentLevel = 0;
    let inPre = false; // Preserve whitespace inside <pre>

    // Helper to get current indent string
    const getIndent = (level: number) => indentString.repeat(Math.max(0, level));

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === TokenType.TagOpen) {
            // Buffer attributes until TagEnd or TagSelfClose
            const tagNameOriginal = token.text.substring(1); // Remove <
            const tagNameLower = tagNameOriginal.toLowerCase();
            const isVoid = voidTags.has(tagNameLower);
            const isBlock = blockTags.has(tagNameLower);

            if (tagNameLower === 'pre') inPre = true;

            const attributes: { name: string, value?: string }[] = [];
            let j = i + 1;
            let tagEndToken: Token | null = null;

            while (j < tokens.length) {
                const t = tokens[j];
                if (t.type === TokenType.TagEnd || t.type === TokenType.TagSelfClose) {
                    tagEndToken = t;
                    i = j; // Advance main loop
                    break;
                } else if (t.type === TokenType.AttributeName) {
                    const name = t.text;
                    let value: string | undefined = undefined;
                    // Check if next token is value
                    if (j + 1 < tokens.length && tokens[j + 1].type === TokenType.AttributeValue) {
                        value = tokens[j + 1].text;
                        j++; // Skip value token
                    }
                    attributes.push({ name, value });
                }
                j++;
            }

            // Sort Attributes
            if (sortAttributes) {
                const priority = ['id', 'name', 'class', 'style', 'src', 'href', 'type', 'rel'];
                attributes.sort((a, b) => {
                    const idxA = priority.indexOf(a.name);
                    const idxB = priority.indexOf(b.name);

                    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                    if (idxA !== -1) return -1;
                    if (idxB !== -1) return 1;

                    return a.name.localeCompare(b.name);
                });
            }

            // Format Open Tag
            const selfClosing = tagEndToken?.type === TokenType.TagSelfClose || isVoid;
            // Enforce self-closing style ' />' for void tags for strictness/consistency
            const closingStr = (tagEndToken?.type === TokenType.TagSelfClose || isVoid) ? ' />' : '>';

            let tagLine = `<${tagNameOriginal}`;

            // Attribute Formatting
            // Try single line first
            let singleLineAttrs = '';
            for (const attr of attributes) {
                singleLineAttrs += ` ${attr.name}`;
                if (attr.value !== undefined) {
                    // Enforce quotes for standard compliance if missing
                    if (!/^["']/.test(attr.value)) {
                         attr.value = `"${attr.value}"`;
                    }
                    singleLineAttrs += `=${attr.value}`;
                }
            }

            const currentIndent = getIndent(indentLevel);
            const totalLen = (currentIndent + tagLine + singleLineAttrs + closingStr).length;

            if (attributes.length > 0 && totalLen > printWidth) {
                // Multi-line mode
                formattedLines.push(currentIndent + tagLine);
                for (const attr of attributes) {
                    let attrStr = ` ${attr.name}`;
                    if (attr.value !== undefined) {
                        attrStr += `=${attr.value}`;
                    }
                    formattedLines.push(getIndent(indentLevel + 1) + attrStr.trim());
                }
                formattedLines.push(currentIndent + closingStr);
            } else {
                // Single line mode
                formattedLines.push(currentIndent + tagLine + singleLineAttrs + closingStr);
            }

            if (!selfClosing) {
                indentLevel++;
            }

        } else if (token.type === TokenType.TagClose) {
            const tagNameLower = token.text.substring(2, token.text.length - 1).toLowerCase(); // </tag>
             if (tagNameLower === 'pre') inPre = false;

            // Dedent
            indentLevel = Math.max(0, indentLevel - 1);
            formattedLines.push(getIndent(indentLevel) + token.text);
        } else if (token.type === TokenType.Text) {
            if (inPre) {
                formattedLines.push(token.text);
            } else {
                const trimmed = token.text.trim();
                if (trimmed.length > 0) {
                    // Indent text content
                    // Split by newline to indent multi-line text blocks
                    const lines = token.text.split('\n');
                    let first = true;
                    for (const line of lines) {
                        const lineTrimmed = line.trim();
                        if (lineTrimmed.length > 0) {
                             formattedLines.push(getIndent(indentLevel) + lineTrimmed);
                        }
                    }
                }
            }
        } else if (token.type === TokenType.Comment || token.type === TokenType.CDATA || token.type === TokenType.Doctype || token.type === TokenType.PI) {
            formattedLines.push(getIndent(indentLevel) + token.text);
        }
    }

    return formattedLines.join('\n');
}
