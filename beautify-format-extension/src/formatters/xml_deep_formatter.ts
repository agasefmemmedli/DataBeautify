import { XMLTokenizer, TokenType, Token } from './xml_tokenizer';

interface XMLFormattingOptions {
    tabSize?: number;
    insertSpaces?: boolean;
    sortAttributes?: boolean;
    printWidth?: number;
    preserveWhitespace?: boolean;
    spaceBeforeSelfClose?: boolean;
    formattingMode?: 'block' | 'inline';
}

export function formatXMLDeep(xml: string, options: XMLFormattingOptions = {}): string {
    const tabSize = options.tabSize || 2;
    const insertSpaces = options.insertSpaces !== false;
    const indentString = insertSpaces ? ' '.repeat(tabSize) : '\t';
    const printWidth = options.printWidth || 120;
    const sortAttributes = options.sortAttributes !== false; // Default true
    const spaceBeforeSelfClose = options.spaceBeforeSelfClose !== false; // Default true
    const formattingMode = options.formattingMode || 'block';

    const tokenizer = new XMLTokenizer(xml);
    const tokens = tokenizer.tokenize();

    let formattedLines: string[] = [];
    let inlineBuffer = '';
    let indentLevel = 0;

    // Helper to get current indent string
    const getIndent = (level: number) => {
        if (formattingMode === 'inline') return '';
        return indentString.repeat(Math.max(0, level));
    };

    const emit = (text: string, level: number) => {
        if (formattingMode === 'inline') {
            inlineBuffer += text;
        } else {
            formattedLines.push(getIndent(level) + text);
        }
    };

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
                    singleLineAttrs += `=${normalizeAttributeValue(attr.value)}`;
                }
            }

            const totalLen = (getIndent(indentLevel) + tagLine + singleLineAttrs + closingStrSingleLine).length;
            const hasAttributes = attributes.length > 0;
            const forceMultiLineAttrs = hasAttributes && totalLen > printWidth;

            // Check for inline content (Recursive mixed content check)
            let isInline = false;
            let inlineContent = '';
            let nextTokenIndex = j + 1;
            let closingTagIndex = -1;

            if (!selfClosing && !forceMultiLineAttrs) {
                // Scan for closing tag
                let tempIdx = nextTokenIndex;
                let depth = 0;

                while (tempIdx < tokens.length) {
                    const t = tokens[tempIdx];
                    if (t.type === TokenType.TagOpen) {
                        depth++;
                    } else if (t.type === TokenType.TagSelfClose) {
                        depth--;
                    } else if (t.type === TokenType.TagClose) {
                        if (depth === 0) {
                            // Check name
                            const closingName = t.text.replace(/^<\//, '').replace(/>$/, '').trim();
                            if (closingName === tagName) {
                                closingTagIndex = tempIdx;
                            }
                            break;
                        }
                        depth--;
                    }
                    tempIdx++;
                }

                if (closingTagIndex !== -1) {
                    // Extract inner tokens
                    const innerTokens = tokens.slice(nextTokenIndex, closingTagIndex);

                    // Heuristic limit to avoid performance issues on huge blocks
                    if (innerTokens.length < 50) {
                        // Reconstruct XML (raw) with proper spacing
                        let innerXML = '';
                        for (let k = 0; k < innerTokens.length; k++) {
                            const t = innerTokens[k];
                            // Add space before AttributeName
                            if (t.type === TokenType.AttributeName) {
                                innerXML += ' ';
                            }

                            innerXML += t.text;

                            // Add = between Name and Value if implied
                            if (t.type === TokenType.AttributeName) {
                                if (k + 1 < innerTokens.length && innerTokens[k + 1].type === TokenType.AttributeValue) {
                                    innerXML += '=';
                                }
                            }
                        }

                        // Try formatting inline with infinite width to see if it fits structurally
                        const formattedInner = formatXMLDeep(innerXML, {
                            ...options,
                            printWidth: 10000,
                            tabSize: options.tabSize,
                            insertSpaces: options.insertSpaces,
                            formattingMode: 'inline'
                        });

                        // If the formatted content has no newlines, it's a candidate for inline
                        if (!formattedInner.includes('\n')) {
                            // Check total length against REAL printWidth
                            const totalLen = (getIndent(indentLevel) + tagLine + singleLineAttrs + closingStrSingleLine + formattedInner + tokens[closingTagIndex].text).length;

                            if (totalLen <= printWidth) {
                                isInline = true;
                                inlineContent = formattedInner;
                            }
                        }
                    }
                }
            }

            if (forceMultiLineAttrs) {
                // Multi-line attributes mode
                emit(tagLine, indentLevel);
                for (const attr of attributes) {
                    let attrStr = ` ${attr.name}`;
                    if (attr.value !== undefined) {
                        attrStr += `=${normalizeAttributeValue(attr.value)}`;
                    }
                    emit(attrStr.trim(), indentLevel + 1);
                }
                emit(closingStrMultiLine, indentLevel);
            } else {
                // Single line attributes mode
                if (isInline) {
                    const closingTag = tokens[closingTagIndex].text;
                    emit(tagLine + singleLineAttrs + closingStrSingleLine + inlineContent + closingTag, indentLevel);

                    i = closingTagIndex;
                    continue;
                } else {
                     emit(tagLine + singleLineAttrs + closingStrSingleLine, indentLevel);
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
            emit(token.text, indentLevel);
        } else if (token.type === TokenType.Text) {
            if (formattingMode === 'inline') {
                const normalized = token.text.replace(/\s+/g, ' ');
                emit(normalized, indentLevel);
            } else {
                const trimmed = token.text.trim();
                if (trimmed.length > 0) {
                    emit(trimmed, indentLevel);
                }
            }
        } else if (token.type === TokenType.Comment || token.type === TokenType.CDATA || token.type === TokenType.Doctype || token.type === TokenType.PI) {
            emit(token.text, indentLevel);
        }
    }

    if (formattingMode === 'inline') {
        return inlineBuffer;
    }
    return formattedLines.join('\n');
}

function normalizeAttributeValue(value: string): string {
    if (!value) return '""';

    let content = value;
    // Check if quoted and strip quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        content = value.substring(1, value.length - 1);
    }

    // Escape double quotes inside content to &quot;
    // Note: If content already has escaped quotes or entities, we preserve them but ensure " is escaped
    const escaped = content.replace(/"/g, '&quot;');
    return `"${escaped}"`;
}
