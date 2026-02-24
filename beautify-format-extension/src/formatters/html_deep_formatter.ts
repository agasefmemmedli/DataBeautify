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
    const sortAttributes = options.sortAttributes !== false;

    // Void elements (no closing tag)
    const voidTags = new Set([
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
    ]);

    // Elements that are typically block-level (start on new line)
    const blockTags = new Set([
        'address', 'article', 'aside', 'blockquote', 'body', 'canvas', 'dd', 'div', 'dl', 'dt',
        'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'header', 'hgroup', 'hr', 'li', 'main', 'nav', 'noscript', 'ol', 'output', 'p', 'pre',
        'section', 'table', 'tfoot', 'ul', 'video', 'html', 'head', 'script', 'style', 'tbody', 'thead', 'tr'
    ]);

    // Optional closing tags - encountering one of these while the same tag is open implies closing the previous one
    // Or specific rules like <li> closes <li>, <dt> closes <dt> and <dd>, etc.
    const optionalClose: { [key: string]: string[] } = {
        'li': ['li'],
        'dt': ['dt', 'dd'],
        'dd': ['dt', 'dd'],
        'p': ['p', 'address', 'article', 'aside', 'blockquote', 'div', 'dl', 'fieldset', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'main', 'nav', 'ol', 'pre', 'section', 'table', 'ul'],
        'rt': ['rt', 'rp'],
        'rp': ['rt', 'rp'],
        'optgroup': ['optgroup'],
        'option': ['option', 'optgroup'],
        'thead': ['colgroup', 'caption'], // actually thead doesn't close these, but encountering thead might close others?
        'tbody': ['thead', 'tbody', 'tfoot'],
        'tfoot': ['thead', 'tbody', 'tfoot'],
        'tr': ['tr', 'thead', 'tbody', 'tfoot'], // tr closes tr?
        'td': ['td', 'th'],
        'th': ['td', 'th']
    };

    const tokenizer = new HTMLTokenizer(html);
    const tokens = tokenizer.tokenize();

    let formattedLines: string[] = [];
    let indentLevel = 0;
    let stack: string[] = [];
    let inPre = false; // Inside <pre> or similar where whitespace matters

    const getIndent = (level: number) => indentString.repeat(Math.max(0, level));

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === TokenType.TagOpen) {
            const tagNameOriginal = token.text.substring(1).replace('/', ''); // <tag or </tag (wait TagOpen is just <tag)
            const tagNameLower = tagNameOriginal.toLowerCase();
            const isVoid = voidTags.has(tagNameLower);

            // Check for implicit closing
            // If we open a tag that implicitly closes previous tags
            // e.g. <li> opens, and stack top is <li>, close it.
            if (stack.length > 0) {
                const top = stack[stack.length - 1];
                // Check if opening 'tagNameLower' closes 'top'
                // This logic is complex in full HTML5 spec, simplified here:
                // If tagNameLower is in optionalClose list, and top is in its list of "tags it closes"
                if (optionalClose[tagNameLower] && optionalClose[tagNameLower].includes(top)) {
                    stack.pop();
                    indentLevel = Math.max(0, indentLevel - 1);
                    // Also check recursively? Standard says yes for some.
                    // For simplicity, just pop one level is usually enough for li/p/dd/dt/tr/td
                }
            }

            if (tagNameLower === 'pre') inPre = true;

            // Collect Attributes
            const attributes: { name: string, value?: string, quote?: string }[] = [];
            let j = i + 1;
            let tagEndToken: Token | null = null;
            let selfClosing = false;

            while (j < tokens.length) {
                const t = tokens[j];
                if (t.type === TokenType.TagEnd) {
                    tagEndToken = t;
                    i = j;
                    break;
                } else if (t.type === TokenType.TagSelfClose) {
                    tagEndToken = t;
                    selfClosing = true;
                    i = j;
                    break;
                } else if (t.type === TokenType.AttributeName) {
                    const name = t.text;
                    let value: string | undefined = undefined;
                    let quote: string | undefined = undefined;

                    if (j + 1 < tokens.length && tokens[j + 1].type === TokenType.AttributeValue) {
                        value = tokens[j + 1].text;
                        // Determine quote style if any
                        // Tokenizer returns raw text for value including quotes if they existed?
                        // No, my new tokenizer strips quotes!
                        // "text" property of AttributeValue token does NOT include quotes in my new implementation.
                        // Wait, let me check tokenizer again.
                        // `this.emit(TokenType.AttributeValue)` uses `buffer`.
                        // `case State.ATTRIBUTE_VALUE_DOUBLE_QUOTED`: `buffer += char` (inside loop, excluding quotes).
                        // So value is unquoted.

                        // We should enforce double quotes for consistency
                        quote = '"';
                        j++;
                    }
                    attributes.push({ name, value, quote });
                }
                j++;
            }

            // Sort Attributes
            if (sortAttributes) {
                const priority = ['id', 'class', 'name', 'type', 'src', 'href', 'rel', 'style'];
                attributes.sort((a, b) => {
                    const idxA = priority.indexOf(a.name);
                    const idxB = priority.indexOf(b.name);

                    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                    if (idxA !== -1) return -1;
                    if (idxB !== -1) return 1;

                    return a.name.localeCompare(b.name);
                });
            }

            // Construct Tag String
            let tagStr = `<${tagNameOriginal}`;
            let attrsStr = '';

            for (const attr of attributes) {
                attrsStr += ` ${attr.name}`;
                if (attr.value !== undefined) {
                    const escaped = attr.value.replace(/"/g, '&quot;');
                    attrsStr += `="${escaped}"`;
                }
            }

            const closeStr = (selfClosing || isVoid) ? ' />' : '>';
            const fullTagSingleLine = tagStr + attrsStr + closeStr;
            const currentIndent = getIndent(indentLevel);

            if (currentIndent.length + fullTagSingleLine.length > printWidth && attributes.length > 1) {
                // Multi-line attributes
                formattedLines.push(currentIndent + tagStr);
                for (const attr of attributes) {
                    let attrLine = ` ${attr.name}`;
                    if (attr.value !== undefined) {
                        const escaped = attr.value.replace(/"/g, '&quot;');
                        attrLine += `="${escaped}"`;
                    }
                    formattedLines.push(getIndent(indentLevel + 1) + attrLine.trim());
                }
                formattedLines.push(currentIndent + closeStr.trim()); // > or />
            } else {
                formattedLines.push(currentIndent + fullTagSingleLine);
            }

            // Update State
            if (!selfClosing && !isVoid) {
                stack.push(tagNameLower);
                indentLevel++;
            }

        } else if (token.type === TokenType.TagClose) {
            const tagNameOriginal = token.text.replace('</', '').replace('>', '').trim();
            const tagNameLower = tagNameOriginal.toLowerCase();

            // Consume optional TagEnd >
            let j = i + 1;
            while (j < tokens.length) {
                if (tokens[j].type === TokenType.TagEnd) {
                    i = j;
                    break;
                }
                // Skip whitespace/comments/attributes inside closing tag if any
                if (tokens[j].type !== TokenType.Whitespace && tokens[j].type !== TokenType.Comment && tokens[j].type !== TokenType.AttributeName) {
                     break;
                }
                j++;
            }

            if (tagNameLower === 'pre') inPre = false;

            // Stack Matching
            if (stack.length > 0) {
                const top = stack[stack.length - 1];
                if (top === tagNameLower) {
                    stack.pop();
                    indentLevel = Math.max(0, indentLevel - 1);
                    formattedLines.push(getIndent(indentLevel) + `</${tagNameOriginal}>`);
                } else {
                    // Mismatch
                    // Check if tagName is in stack (intermediate tags unclosed)
                    const index = stack.lastIndexOf(tagNameLower);
                    if (index !== -1) {
                        // Close everything up to index
                        while (stack.length > index + 1) {
                            stack.pop();
                            indentLevel = Math.max(0, indentLevel - 1);
                        }
                        stack.pop(); // Pop the tag itself
                        indentLevel = Math.max(0, indentLevel - 1);
                        formattedLines.push(getIndent(indentLevel) + `</${tagNameOriginal}>`);
                    } else {
                        // Stray closing tag (not in stack). Ignore or print as is?
                        // Print as is, but don't change indent.
                        formattedLines.push(getIndent(indentLevel) + `</${tagNameOriginal}>`);
                    }
                }
            } else {
                // Stack empty, stray closing tag
                formattedLines.push(getIndent(indentLevel) + `</${tagNameOriginal}>`);
            }

        } else if (token.type === TokenType.Text) {
            if (inPre) {
                formattedLines.push(token.text);
            } else {
                const trimmed = token.text.trim();
                if (trimmed.length > 0) {
                    // Indent text content
                    // Handle multi-line text
                    const lines = token.text.split('\n');
                    let first = true;
                    // Filter empty lines if they are just whitespace, unless inPre (handled above)
                    // But for robustness, if text token spans multiple lines, we preserve structure but indent

                    // Actually, HTML text collapses whitespace.
                    // So we can just print trimmed text indented.
                    // But if it was multiple lines, maybe user wanted it that way.
                    // Let's preserve newlines but fix indentation.

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
