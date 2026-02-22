import { LiquidTokenizer, Token, TokenType } from './liquid_tokenizer';

interface FormatterOptions {
    tabSize: number;
    insertSpaces: boolean;
}

export function formatLiquidDeep(input: string, options: FormatterOptions = { tabSize: 2, insertSpaces: true }): string {
    const tokenizer = new LiquidTokenizer(input);
    const tokens = tokenizer.tokenize();
    const indentString = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';

    let formatted = '';
    let indentLevel = 0;

    const getIndent = () => indentString.repeat(Math.max(0, indentLevel));

    // Void elements
    const voidTags = new Set([
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
    ]);

    // Inline elements (HTML)
    const inlineTags = new Set([
        'a', 'abbr', 'b', 'bdo', 'button', 'cite', 'code', 'del', 'dfn', 'em', 'i', 'img', 'ins', 'kbd', 'label', 'map', 'object', 'q', 'samp', 'select', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'tt', 'var'
    ]);

    let currentTagName = '';
    let inlineLevel = 0;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === TokenType.Whitespace) continue;

        switch (token.type) {
            case TokenType.TagOpen: // HTML Tag Open OR Generic Liquid Tag
                if (token.text.startsWith('{%')) {
                    // Generic Liquid Tag (e.g. {% assign ... %})
                    if (inlineLevel > 0) {
                        formatted += ' ' + token.text;
                    } else {
                        if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
                        formatted += getIndent() + token.text;
                    }
                } else {
                    // HTML Tag Open <div
                    const tagName = token.text.substring(1).toLowerCase();

                    if (inlineTags.has(tagName)) {
                        if (inlineLevel === 0) {
                            if (formatted.endsWith('\n')) {
                                formatted += getIndent();
                            } else if (formatted.length > 0 && !formatted.endsWith(' ')) {
                                formatted += ' ';
                            }
                        }
                        inlineLevel++;
                        formatted += token.text;
                    } else {
                        // Block tag
                        if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
                        formatted += getIndent() + token.text;
                    }
                    currentTagName = tagName;
                }
                break;

            case TokenType.AttributeName:
                formatted += ' ' + token.text;
                break;

            case TokenType.AttributeValue:
                formatted += '=' + token.text;
                break;

            case TokenType.TagEnd: // HTML >
                formatted += token.text;
                if (!voidTags.has(currentTagName) && !inlineTags.has(currentTagName)) {
                    indentLevel++;
                }
                currentTagName = '';
                break;

            case TokenType.TagSelfClose: // HTML />
                formatted += token.text;
                if (inlineTags.has(currentTagName)) {
                    inlineLevel = Math.max(0, inlineLevel - 1);
                }
                currentTagName = '';
                break;

            case TokenType.TagClose: // HTML </div>
                const closeTagName = token.text.substring(2, token.text.length - 1).toLowerCase();

                if (inlineTags.has(closeTagName)) {
                    inlineLevel = Math.max(0, inlineLevel - 1);
                    formatted += token.text;
                } else {
                    indentLevel = Math.max(0, indentLevel - 1);
                    if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
                    formatted += getIndent() + token.text;
                }
                break;

            case TokenType.BlockOpen: // {% if ... %}
                // Liquid Block Open
                if (inlineLevel > 0) {
                     formatted += ' ' + token.text;
                } else {
                     if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
                     formatted += getIndent() + token.text;
                     indentLevel++;
                }
                break;

            case TokenType.BlockClose: // {% endif %}
                if (inlineLevel > 0) {
                     formatted += ' ' + token.text;
                } else {
                     indentLevel = Math.max(0, indentLevel - 1);
                     if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
                     formatted += getIndent() + token.text;
                }
                break;

            case TokenType.BlockInverse: // {% else %}
                if (inlineLevel > 0) {
                     formatted += ' ' + token.text;
                } else {
                     indentLevel = Math.max(0, indentLevel - 1);
                     if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
                     formatted += getIndent() + token.text;
                     indentLevel++;
                }
                break;

            case TokenType.RawBlock: // {% schema %} ... {% endschema %}
                // Ideally format content inside, but for now preserve block indentation
                if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
                formatted += getIndent() + token.text;
                break;

            case TokenType.Comment:
                if (inlineLevel > 0) {
                    formatted += ' ' + token.text;
                } else {
                    if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
                    formatted += getIndent() + token.text;
                }
                break;

            case TokenType.OutputOpen: // {{ ... }}
            case TokenType.OutputClose: // Not used but in enum
                if (inlineLevel > 0) {
                    formatted += ' ' + token.text;
                } else {
                    if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
                    formatted += getIndent() + token.text;
                }
                break;

            case TokenType.Text:
                if (inlineLevel > 0) {
                     // Collapse whitespace
                     const collapsed = token.text.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ');
                     formatted += collapsed;
                } else {
                     const lines = token.text.split('\n');
                     for (let j = 0; j < lines.length; j++) {
                         const line = lines[j].trim();
                         if (line.length > 0) {
                             if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
                             formatted += getIndent() + line;
                         }
                     }
                }
                break;

            default:
                formatted += token.text;
        }
    }

    return formatted + '\n';
}
