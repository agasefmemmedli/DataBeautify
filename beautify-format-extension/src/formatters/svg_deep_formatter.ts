import { XMLTokenizer, TokenType, Token } from './xml_tokenizer';
import { formatCSSDeep } from './css_deep_formatter';

interface SVGFormattingOptions {
    tabSize?: number;
    insertSpaces?: boolean;
    sortAttributes?: boolean;
    printWidth?: number;
}

export function formatSVGDeep(svg: string, options: SVGFormattingOptions = {}): string {
    const tabSize = options.tabSize || 2;
    const insertSpaces = options.insertSpaces !== false;
    const indentString = insertSpaces ? ' '.repeat(tabSize) : '\t';
    const printWidth = options.printWidth || 120;
    const sortAttributes = options.sortAttributes !== false;

    const tokenizer = new XMLTokenizer(svg);
    const tokens = tokenizer.tokenize();

    let formattedLines: string[] = [];
    let indentLevel = 0;
    let inStyleTag = false;
    let styleTagContent = '';

    // Helper to get current indent string
    const getIndent = (level: number) => indentString.repeat(Math.max(0, level));

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (inStyleTag) {
            if (token.type === TokenType.TagClose && token.text.replace(/[\s\/<>]/g, '').toLowerCase() === 'style') {
                // Format collected CSS content
                if (styleTagContent.trim().length > 0) {
                    try {
                        const formattedCSS = formatCSSDeep(styleTagContent, {
                            tabSize: tabSize,
                            insertSpaces: insertSpaces
                        });
                        // Indent CSS lines
                        const cssLines = formattedCSS.split('\n');
                        for (const line of cssLines) {
                            if (line.trim().length > 0) {
                                formattedLines.push(getIndent(indentLevel) + line);
                            }
                        }
                    } catch (e) {
                        // Fallback: just print as is
                        formattedLines.push(getIndent(indentLevel) + styleTagContent.trim());
                    }
                }
                inStyleTag = false;
                styleTagContent = '';
                // Process closing tag
                indentLevel = Math.max(0, indentLevel - 1);
                formattedLines.push(getIndent(indentLevel) + token.text);
            } else {
                styleTagContent += token.text;
            }
            continue;
        }

        if (token.type === TokenType.TagOpen) {
            const tagName = token.text.substring(1).trim(); // Remove <
            const lowerTagName = tagName.toLowerCase();

            if (lowerTagName === 'style') {
                inStyleTag = true;
            }

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
                    // Check if next token is value (skip whitespace/equals handled by tokenizer usually?
                    // Wait, XMLTokenizer output for AttributeName usually followed by AttributeValue if existing)
                    // Let's look at XMLTokenizer again. It produces AttributeName then AttributeValue.
                    // But in the array they are sequential.

                    if (j + 1 < tokens.length && tokens[j + 1].type === TokenType.AttributeValue) {
                        value = tokens[j + 1].text;
                        j++; // Skip value token
                    }
                    attributes.push({ name, value });
                }
                j++;
            }

            // Deep Format Attributes
            attributes.forEach(attr => {
                if (attr.value) {
                    // Remove quotes for processing
                    let val = attr.value;
                    const quote = val[0];
                    if (quote === '"' || quote === "'") {
                        val = val.substring(1, val.length - 1);
                    }

                    if (attr.name === 'd') {
                        // Normalize Path Data
                        // Command followed by coordinates
                        // Standardize to: "C M 10 10 L 20 20" or "M10,10 L20,20"
                        // Prettier tends to: "M 10 10 L 20 20"
                        // We will add spaces between commands and numbers
                        val = val.replace(/([a-zA-Z])|(\s+)|(-?\d*\.?\d+)/g, (match, cmd, space, num) => {
                             if (cmd) return ` ${cmd} `;
                             if (num) return ` ${num} `;
                             return '';
                        }).trim().replace(/\s+/g, ' ');
                        // Comma handling? SVG allows commas or spaces. We use spaces for cleaner look, or maybe preserve commas?
                        // Let's stick to spaces as it's cleaner.
                    } else if (attr.name === 'style') {
                         // Format inline style
                         // e.g. "fill:red; stroke:black" -> "fill: red; stroke: black"
                         val = val.split(';').map(s => {
                             const parts = s.split(':');
                             if (parts.length === 2) {
                                 return `${parts[0].trim()}: ${parts[1].trim()}`;
                             }
                             return s.trim();
                         }).filter(s => s).join('; ');
                         if (val.length > 0 && !val.endsWith(';')) val += ';'; // Standardize semi-colon
                    } else if (attr.name === 'points') {
                        // Polygon/Polyline points
                        // "10,10 20,20"
                        val = val.trim().replace(/\s+/g, ' ').replace(/,\s*/g, ',');
                    }

                    // Re-quote
                    attr.value = `"${val}"`;
                }
            });

            // Sort Attributes
            if (sortAttributes) {
                const priority = ['id', 'class', 'name', 'xmlns', 'width', 'height', 'viewBox', 'x', 'y', 'd', 'points', 'transform', 'style'];
                attributes.sort((a, b) => {
                    const idxA = priority.indexOf(a.name);
                    const idxB = priority.indexOf(b.name);

                    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                    if (idxA !== -1) return -1;
                    if (idxB !== -1) return 1;

                    // xmlns special handling
                    if (a.name.startsWith('xmlns') && !b.name.startsWith('xmlns')) return -1;
                    if (!a.name.startsWith('xmlns') && b.name.startsWith('xmlns')) return 1;

                    return a.name.localeCompare(b.name);
                });
            }

            // Format Open Tag
            const selfClosing = tagEndToken?.type === TokenType.TagSelfClose;
            const closingStr = selfClosing ? ' />' : '>';

            let tagLine = `<${tagName}`;

            let singleLineAttrs = '';
            for (const attr of attributes) {
                singleLineAttrs += ` ${attr.name}`;
                if (attr.value !== undefined) {
                    singleLineAttrs += `=${attr.value}`;
                }
            }

            const totalLen = (getIndent(indentLevel) + tagLine + singleLineAttrs + closingStr).length;

            if (attributes.length > 1 && totalLen > printWidth) {
                // Multi-line mode
                formattedLines.push(getIndent(indentLevel) + tagLine);
                for (const attr of attributes) {
                    let attrStr = ` ${attr.name}`;
                    if (attr.value !== undefined) {
                        attrStr += `=${attr.value}`;
                    }
                    formattedLines.push(getIndent(indentLevel + 1) + attrStr.trim());
                }
                formattedLines.push(getIndent(indentLevel) + closingStr.trim());
            } else {
                // Single line mode
                formattedLines.push(getIndent(indentLevel) + tagLine + singleLineAttrs + closingStr);
            }

            if (!selfClosing) {
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
            formattedLines.push(getIndent(indentLevel) + token.text.trim());
        }
    }

    return formattedLines.join('\n');
}
