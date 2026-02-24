import { XMLTokenizer, TokenType, Token } from './xml_tokenizer';

interface XMLFormattingOptions {
    tabSize?: number;
    insertSpaces?: boolean;
    sortAttributes?: boolean;
    printWidth?: number;
    preserveWhitespace?: boolean;
    spaceBeforeSelfClose?: boolean;
}

export function formatXMLDeep(xml: string, options: XMLFormattingOptions = {}): string {
    const tabSize = options.tabSize || 2;
    const insertSpaces = options.insertSpaces !== false;
    const indentString = insertSpaces ? ' '.repeat(tabSize) : '\t';
    const printWidth = options.printWidth || 120;
    const sortAttributes = options.sortAttributes !== false; // Default true
    const spaceBeforeSelfClose = options.spaceBeforeSelfClose !== false; // Default true

    const tokenizer = new XMLTokenizer(xml);
    const tokens = tokenizer.tokenize();

    let formattedLines: string[] = [];
    let indentLevel = 0;

    // Helper to get current indent string
    const getIndent = (level: number) => indentString.repeat(Math.max(0, level));

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === TokenType.TagOpen) {
            // Buffer attributes until TagEnd or TagSelfClose
            const tagName = token.text.substring(1); // Remove <
            const attributes: { name: string, value?: string }[] = [];

            let j = i + 1;
            let tagEndToken: Token | null = null;

            while (j < tokens.length) {
                const t = tokens[j];
                if (t.type === TokenType.TagEnd || t.type === TokenType.TagSelfClose) {
                    tagEndToken = t;
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
                const priority = ['id', 'name', 'class', 'style', 'xmlns', 'version', 'encoding'];
                attributes.sort((a, b) => {
                    const idxA = priority.indexOf(a.name);
                    const idxB = priority.indexOf(b.name);

                    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                    if (idxA !== -1) return -1;
                    if (idxB !== -1) return 1;

                    // xmlns special handling: xmlns:abc should come after xmlns
                    if (a.name.startsWith('xmlns') && b.name.startsWith('xmlns')) {
                        return a.name.localeCompare(b.name);
                    }

                    return a.name.localeCompare(b.name);
                });
            }

            const selfClosing = tagEndToken?.type === TokenType.TagSelfClose;
            // Add space before /> if requested (for single line)
            const closingStrSingleLine = selfClosing ? (spaceBeforeSelfClose ? ' />' : '/>') : '>';
            // For multi-line, closing tag is on new line, aligned. usually just /> or >
            const closingStrMultiLine = selfClosing ? '/>' : '>';

            let tagLine = `<${tagName}`;

            // Try single line attributes first
            let singleLineAttrs = '';
            for (const attr of attributes) {
                singleLineAttrs += ` ${attr.name}`;
                if (attr.value !== undefined) {
                    singleLineAttrs += `=${attr.value}`;
                }
            }

            const totalLen = (getIndent(indentLevel) + tagLine + singleLineAttrs + closingStrSingleLine).length;
            const hasAttributes = attributes.length > 0;
            const forceMultiLineAttrs = hasAttributes && totalLen > printWidth;

            // Check for inline content (Text only)
            let isInline = false;
            let inlineContent = '';
            let consumedTextToken = false;
            let nextTokenIndex = j + 1;

            if (!selfClosing && !forceMultiLineAttrs) {
                if (nextTokenIndex < tokens.length) {
                    const nextToken = tokens[nextTokenIndex];
                    if (nextToken.type === TokenType.Text) {
                         // Check if followed by closing tag
                         if (nextTokenIndex + 1 < tokens.length) {
                             const closingToken = tokens[nextTokenIndex + 1];
                             if (closingToken.type === TokenType.TagClose) {
                                 const closingName = closingToken.text.replace(/^<\//, '').replace(/>$/, '').trim();
                                 if (closingName === tagName) {
                                     const textContent = nextToken.text.trim();
                                     if (!textContent.includes('\n')) {
                                         const inlineLen = (getIndent(indentLevel) + tagLine + singleLineAttrs + closingStrSingleLine + textContent + closingToken.text).length;
                                         if (inlineLen <= printWidth) {
                                             isInline = true;
                                             inlineContent = textContent;
                                             consumedTextToken = true;
                                         }
                                     }
                                 }
                             }
                         }
                    } else if (nextToken.type === TokenType.TagClose) {
                        // Empty content <tag></tag>
                        const closingName = nextToken.text.replace(/^<\//, '').replace(/>$/, '').trim();
                        if (closingName === tagName) {
                             const inlineLen = (getIndent(indentLevel) + tagLine + singleLineAttrs + closingStrSingleLine + nextToken.text).length;
                             if (inlineLen <= printWidth) {
                                 isInline = true;
                                 inlineContent = '';
                                 consumedTextToken = false;
                             }
                        }
                    }
                }
            }

            if (forceMultiLineAttrs) {
                // Multi-line attributes mode
                formattedLines.push(getIndent(indentLevel) + tagLine);
                for (const attr of attributes) {
                    let attrStr = ` ${attr.name}`;
                    if (attr.value !== undefined) {
                        attrStr += `=${attr.value}`;
                    }
                    formattedLines.push(getIndent(indentLevel + 1) + attrStr.trim());
                }
                formattedLines.push(getIndent(indentLevel) + closingStrMultiLine);
            } else {
                // Single line attributes mode
                if (isInline) {
                    const closingTagIndex = nextTokenIndex + (consumedTextToken ? 1 : 0);
                    const closingTag = tokens[closingTagIndex].text;
                    formattedLines.push(getIndent(indentLevel) + tagLine + singleLineAttrs + closingStrSingleLine + inlineContent + closingTag);

                    i = closingTagIndex;
                    continue;
                } else {
                     formattedLines.push(getIndent(indentLevel) + tagLine + singleLineAttrs + closingStrSingleLine);
                }
            }

            // Advance i to end of attributes loop
            i = j;

            if (!selfClosing && !isInline) {
                indentLevel++;
            }

        } else if (token.type === TokenType.TagClose) {
            // Dedent
            indentLevel = Math.max(0, indentLevel - 1);
            formattedLines.push(getIndent(indentLevel) + token.text);
        } else if (token.type === TokenType.Text) {
            const trimmed = token.text.trim();
            if (trimmed.length > 0) {
                formattedLines.push(getIndent(indentLevel) + trimmed);
            }
        } else if (token.type === TokenType.Comment || token.type === TokenType.CDATA || token.type === TokenType.Doctype || token.type === TokenType.PI) {
            formattedLines.push(getIndent(indentLevel) + token.text);
        }
    }

    return formattedLines.join('\n');
}
