import { XMLTokenizer, TokenType, Token } from './xml_tokenizer';

interface XMLFormattingOptions {
    tabSize?: number;
    insertSpaces?: boolean;
    sortAttributes?: boolean;
    printWidth?: number;
    spaceBeforeSelfClose?: boolean;
}

export function formatXMLDeep(xml: string, options: XMLFormattingOptions = {}): string {
    const tabSize = options.tabSize || 2;
    const insertSpaces = options.insertSpaces !== false;
    const indentString = insertSpaces ? ' '.repeat(tabSize) : '\t';
    const printWidth = options.printWidth || 80;
    const sortAttributes = options.sortAttributes !== false;
    const spaceBeforeSelfClose = options.spaceBeforeSelfClose !== false;

    const tokenizer = new XMLTokenizer(xml);
    const tokens = tokenizer.tokenize();

    let formattedLines: string[] = [];
    let indentLevel = 0;

    const getIndent = (level: number) => indentString.repeat(Math.max(0, level));

    const normalizeAttributeValue = (val: string): string => {
        let content = val;
        // Strip outer quotes if present
        if ((content.startsWith('"') && content.endsWith('"')) || (content.startsWith("'") && content.endsWith("'"))) {
            content = content.substring(1, content.length - 1);
        }

        // Unescape &quot; to " temporarily if we want to re-escape properly?
        // Actually, if input is `attr="escaped \"value\""`, the tokenizer returns `"escaped \"value\""`.
        // We strip quotes: `escaped \"value\"`.
        // We need to handle the escaped quotes inside.
        // Replace `\"` with `"` then `"` with `&quot;`.
        content = content.replace(/\\"/g, '"').replace(/\\'/g, "'");

        // Escape " to &quot;
        content = content.replace(/"/g, '&quot;');

        return `"${content}"`;
    };

    // Helper to format a range of tokens inline
    const tryFormatInline = (startIdx: number, endIdx: number): string | null => {
        let buffer = '';
        for (let k = startIdx; k < endIdx; k++) {
            const t = tokens[k];
            if (t.type === TokenType.TagOpen) {
                // Check if this tag is also inline?
                // This function is recursive implicitly if we call formatXMLDeep? No, let's keep it simple.
                // Just reconstruct the tag and its attributes inline.
                const tagName = t.text.substring(1);

                // Collect attributes
                let attrStr = '';
                let m = k + 1;
                while (m < endIdx) {
                    const at = tokens[m];
                    if (at.type === TokenType.TagEnd || at.type === TokenType.TagSelfClose) {
                        break;
                    }
                    if (at.type === TokenType.AttributeName) {
                        attrStr += ` ${at.text}`;
                        if (m + 1 < endIdx && tokens[m+1].type === TokenType.AttributeValue) {
                            attrStr += `=${normalizeAttributeValue(tokens[m+1].text)}`;
                            m++;
                        } else {
                            // Boolean: normalize to name="name"
                            attrStr += `="${at.text}"`;
                        }
                    }
                    m++;
                }

                const selfClosing = tokens[m].type === TokenType.TagSelfClose;
                const closing = selfClosing ? (spaceBeforeSelfClose ? ' />' : '/>') : '>';
                buffer += `<${tagName}${attrStr}${closing}`;
                k = m;
            } else if (t.type === TokenType.TagClose) {
                buffer += t.text;
            } else if (t.type === TokenType.Text) {
                // Check if text has multiple lines. If it does, we shouldn't format it inline.
                if (t.text.includes('\n')) {
                    // Check if the lines are purely whitespace
                    if (t.text.trim() !== '') {
                        return null;
                    } else {
                        // Empty lines of whitespace, can be collapsed
                        buffer += t.text.replace(/\s+/g, ' ');
                    }
                } else {
                    buffer += t.text.replace(/\s+/g, ' ');
                }
            } else if (t.type === TokenType.Comment || t.type === TokenType.CDATA) {
                buffer += t.text;
            }
        }

        // Check if buffer contains newlines (from CDATA or comments maybe?)
        if (buffer.includes('\n')) return null;
        return buffer;
    };

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === TokenType.Whitespace) continue; // Ignore top-level whitespace logic, we handle text explicitly

        if (token.type === TokenType.TagOpen) {
            const tagName = token.text.substring(1);
            const attributes: { name: string, value: string }[] = [];

            let j = i + 1;
            let tagEndToken: Token | null = null;

            while (j < tokens.length) {
                const t = tokens[j];
                if (t.type === TokenType.TagEnd || t.type === TokenType.TagSelfClose) {
                    tagEndToken = t;
                    break;
                } else if (t.type === TokenType.AttributeName) {
                    const name = t.text;
                    let value = `"${name}"`; // Default for boolean
                    if (j + 1 < tokens.length && tokens[j+1].type === TokenType.AttributeValue) {
                        value = normalizeAttributeValue(tokens[j+1].text);
                        j++;
                    }
                    attributes.push({ name, value });
                }
                j++;
            }

            // Sort Attributes
            if (sortAttributes) {
                const priority = ['id', 'class', 'name', 'src', 'href', 'type'];
                attributes.sort((a, b) => {
                    const idxA = priority.indexOf(a.name);
                    const idxB = priority.indexOf(b.name);
                    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                    if (idxA !== -1) return -1;
                    if (idxB !== -1) return 1;
                    return a.name.localeCompare(b.name);
                });
            }

            const selfClosing = tagEndToken?.type === TokenType.TagSelfClose;

            // Construct tag start
            const tagStart = `<${tagName}`;

            // Construct attributes string (single line attempt)
            let attrStrSingle = '';
            for (const attr of attributes) {
                attrStrSingle += ` ${attr.name}=${attr.value}`;
            }

            const closingSingle = selfClosing ? (spaceBeforeSelfClose ? ' />' : '/>') : '>';

            // Check for Mixed Content / Inline Capability
            let isInline = false;
            let inlineContent = '';
            let closingTagIndex = -1;

            if (!selfClosing) {
                // Find matching closing tag
                let depth = 0;
                let k = j + 1;
                while (k < tokens.length) {
                    const t = tokens[k];
                    if (t.type === TokenType.TagOpen) depth++;
                    else if (t.type === TokenType.TagSelfClose) { /* no depth change */ }
                    else if (t.type === TokenType.TagClose) {
                        if (depth === 0) {
                            // Check name match
                             const closeName = t.text.replace(/^<\//, '').replace(/>$/, '').trim();
                             if (closeName === tagName) {
                                 closingTagIndex = k;
                                 break;
                             }
                        }
                        depth--;
                    }
                    k++;
                }

                if (closingTagIndex !== -1) {
                    // Try formatting content inline
                    // Check if content is short and simple
                    const potentialInline = tryFormatInline(j + 1, closingTagIndex);
                    if (potentialInline !== null) {
                        const totalLen = (getIndent(indentLevel) + tagStart + attrStrSingle + closingSingle + potentialInline + tokens[closingTagIndex].text).length;
                        if (totalLen <= printWidth) {
                            isInline = true;
                            inlineContent = potentialInline;
                        }
                    }
                }
            }

            // Decide on Attribute Wrapping
            const singleLineTagLen = (getIndent(indentLevel) + tagStart + attrStrSingle + closingSingle).length;
            const wrapAttributes = attributes.length > 0 && singleLineTagLen > printWidth;

            if (wrapAttributes) {
                // Multi-line attributes
                formattedLines.push(`${getIndent(indentLevel)}${tagStart}`);
                for (const attr of attributes) {
                    formattedLines.push(`${getIndent(indentLevel + 1)}${attr.name}=${attr.value}`);
                }

                if (selfClosing) {
                    formattedLines.push(`${getIndent(indentLevel)}/>`);
                } else {
                    formattedLines.push(`${getIndent(indentLevel)}>`);
                }
            } else {
                // Single-line attributes
                if (isInline) {
                    formattedLines.push(`${getIndent(indentLevel)}${tagStart}${attrStrSingle}${closingSingle}${inlineContent}${tokens[closingTagIndex].text}`);
                    i = closingTagIndex; // Skip processed tokens
                    continue;
                } else {
                    formattedLines.push(`${getIndent(indentLevel)}${tagStart}${attrStrSingle}${closingSingle}`);
                }
            }

            if (!selfClosing && !isInline) {
                indentLevel++;
            }

            i = j; // Advance main loop to end of tag open

        } else if (token.type === TokenType.TagClose) {
            indentLevel = Math.max(0, indentLevel - 1);
            formattedLines.push(`${getIndent(indentLevel)}${token.text}`);
        } else if (token.type === TokenType.Text) {
            const lines = token.text.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed) {
                    formattedLines.push(`${getIndent(indentLevel)}${trimmed}`);
                }
            }
        } else if (token.type === TokenType.Comment || token.type === TokenType.CDATA || token.type === TokenType.Doctype || token.type === TokenType.PI) {
            formattedLines.push(`${getIndent(indentLevel)}${token.text}`);
        }
    }

    return formattedLines.join('\n');
}
