import { HTMLTokenizer, TokenType, Token } from './html_tokenizer';
import { formatJSDeep } from './js_deep_formatter';
import { formatCSSDeep } from './css_deep_formatter';

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
    const printWidth = options.printWidth || 80;
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
        'thead': ['colgroup', 'caption'],
        'tbody': ['thead', 'tbody', 'tfoot'],
        'tfoot': ['thead', 'tbody', 'tfoot'],
        'tr': ['tr', 'thead', 'tbody', 'tfoot'],
        'td': ['td', 'th'],
        'th': ['td', 'th']
    };

    const tokenizer = new HTMLTokenizer(html);
    const tokens = tokenizer.tokenize();

    let formattedLines: string[] = [];
    let indentLevel = 0;
    let stack: string[] = [];
    let inPre = false;

    const getIndent = (level: number) => indentString.repeat(Math.max(0, level));

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === TokenType.TagOpen) {
            const tagNameOriginal = token.text.substring(1).replace('/', '');
            const tagNameLower = tagNameOriginal.toLowerCase();
            const isVoid = voidTags.has(tagNameLower);

            // Check for implicit closing
            if (stack.length > 0) {
                const top = stack[stack.length - 1];
                if (optionalClose[tagNameLower] && optionalClose[tagNameLower].includes(top)) {
                    stack.pop();
                    indentLevel = Math.max(0, indentLevel - 1);
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

                    if (j + 1 < tokens.length && (tokens[j + 1].type === TokenType.AttributeValue)) {
                        value = tokens[j + 1].text;
                        j++;
                    }
                    attributes.push({ name, value });
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

            // Check length to decide on wrapping
            // Calculate length if single line
            let singleLineAttrs = '';
            for (const attr of attributes) {
                singleLineAttrs += ` ${attr.name}`;
                if (attr.value !== undefined) {
                    const escaped = attr.value.replace(/"/g, '&quot;');
                    singleLineAttrs += `="${escaped}"`;
                }
            }
            const closeStr = (selfClosing || isVoid) ? ' />' : '>';
            const fullTagSingleLine = tagStr + singleLineAttrs + closeStr;
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
                formattedLines.push(currentIndent + closeStr.trim());
            } else {
                formattedLines.push(currentIndent + fullTagSingleLine);
            }

            // Update State
            if (!selfClosing && !isVoid) {
                stack.push(tagNameLower);
                indentLevel++;
            }

            // Embedded Content Handling (Script/Style)
            if (tagNameLower === 'script' || tagNameLower === 'style') {
                // Look ahead for content until </script> or </style>
                let content = '';
                let k = i + 1;
                while (k < tokens.length) {
                    const t = tokens[k];
                    if (t.type === TokenType.TagClose || (t.type === TokenType.TagOpen && t.text.startsWith('</'))) {
                        // Check if it closes current tag
                        const closeTagName = t.text.replace('</', '').replace('>', '').trim().toLowerCase();
                        // For TagOpen starting with </, we need to be careful (tokenizer might emit TagOpen for invalid tags)
                        // But TagClose is emitted properly by tokenizer for matching tags?
                        // Wait, my tokenizer emits TagClose token only if it matches? No.
                        // Tokenizer emits TagClose for `</tag`.

                        if (t.type === TokenType.TagClose) {
                             // The text property is `</tag`?
                             // Let's check tokenizer again.
                             // `this.emit(TokenType.TagClose)` -> text is buffer `</tag`.
                             // `this.state = State.BEFORE_ATTRIBUTE_NAME`.
                             // Then it expects `>`.
                             // So TagClose token is just `</tag`.

                             // Wait, tokenizer logic:
                             // `this.emit(TokenType.TagClose)`
                             // `this.currentTag = ...`
                             // So yes, `t.text` is `</script>` (or `</style>`)

                             const closeName = t.text.replace('</', '').toLowerCase();
                             if (closeName === tagNameLower) {
                                 break;
                             }
                        }
                    }

                    if (t.type === TokenType.Text || t.type === TokenType.CDATA) {
                        content += t.text;
                    }
                    // Also accumulate whitespace/comments?
                    if (t.type === TokenType.Whitespace) {
                        content += t.text;
                    }
                    if (t.type === TokenType.Comment) {
                        content += '<!--' + t.text + '-->'; // Reconstruct comment? Tokenizer emits content only?
                        // Tokenizer emits `<!--...-->` or just content?
                        // `this.emit(TokenType.Comment)` buffer includes `<!--` and `-->`?
                        // `case State.COMMENT_END`: `this.buffer += char` (>) -> emit.
                        // So yes, full comment.
                         content += t.text;
                    }

                    k++;
                }

                // Format Content
                if (content.trim().length > 0) {
                    let formattedContent = '';
                    try {
                        if (tagNameLower === 'script') {
                            formattedContent = formatJSDeep(content, {
                                tabSize,
                                insertSpaces,
                                printWidth: printWidth - (indentLevel * (insertSpaces ? tabSize : 4)) // Adjust print width
                            });
                        } else {
                            formattedContent = formatCSSDeep(content, {
                                tabSize,
                                insertSpaces
                            });
                        }
                    } catch (e) {
                        // Fallback to original content if formatting fails
                        formattedContent = content;
                    }

                    // Indent the formatted content
                    const lines = formattedContent.split('\n');
                    for (const line of lines) {
                        if (line.trim().length > 0) {
                            formattedLines.push(getIndent(indentLevel) + line); // Already indented relative to 0?
                            // formatJSDeep returns indented relative to 0. We need to add base indent.
                            // But wait, formatJSDeep indent is 0-based.
                            // So we just prepend currentIndent?
                            // Yes.
                            // But wait, if formatJSDeep output already has indentation, we add MORE?
                            // Yes, relative to script tag.
                        }
                    }
                }

                // Advance main loop to k-1 (since loop increments i)
                i = k - 1;
                // Next token will be TagClose of script/style
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
                        formattedLines.push(getIndent(indentLevel) + `</${tagNameOriginal}>`);
                    }
                }
            } else {
                formattedLines.push(getIndent(indentLevel) + `</${tagNameOriginal}>`);
            }

        } else if (token.type === TokenType.Text) {
            if (inPre) {
                formattedLines.push(token.text);
            } else {
                const trimmed = token.text.trim();
                if (trimmed.length > 0) {
                    // Split by newline to preserve some structure?
                    // Or collapse whitespace?
                    // HTML collapses whitespace.
                    // But we want to preserve text block structure if it was multiline.
                    // Let's split by newline, trim each line, and indent.

                    const lines = token.text.split('\n');
                    for (const line of lines) {
                        const lineTrimmed = line.trim();
                        if (lineTrimmed.length > 0) {
                            formattedLines.push(getIndent(indentLevel) + lineTrimmed);
                        }
                    }
                }
            }
        } else if (token.type === TokenType.Comment || token.type === TokenType.CDATA || token.type === TokenType.Doctype || token.type === TokenType.PI) {
            formattedLines.push(getIndent(indentLevel) + token.text.trim());
        }
    }

    return formattedLines.join('\n') + '\n';
}
