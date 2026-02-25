import { TwigTokenizer, Token, TokenType } from './twig_tokenizer';

interface FormatterOptions {
    tabSize?: number;
    insertSpaces?: boolean;
}

function formatTwigExpression(text: string): string {
    const startMatch = text.match(/^\{\{-?/);
    const endMatch = text.match(/-?\}\}$/);
    if (!startMatch || !endMatch) return text;

    const startDelim = startMatch[0];
    const endDelim = endMatch[0];
    let content = text.substring(startDelim.length, text.length - endDelim.length).trim();

    // Normalize whitespace
    content = content.replace(/\s+/g, ' ');

    // Add spaces around pipe | if not in string
    let newContent = '';
    let inQuote = false;
    let quoteChar = '';
    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (inQuote) {
            newContent += char;
            if (char === quoteChar) {
                inQuote = false;
            }
        } else {
            if (char === '"' || char === "'") {
                inQuote = true;
                quoteChar = char;
                newContent += char;
            } else if (char === '|') {
                newContent += '|';
            } else {
                newContent += char;
            }
        }
    }
    // Clean up double spaces
    content = newContent.replace(/\s+/g, ' ').replace(/\s\|\s/g, '|');

    return `${startDelim} ${content} ${endDelim}`;
}

function formatTwigTag(text: string): string {
    const startMatch = text.match(/^\{%-?/);
    const endMatch = text.match(/-?%\}$/);
    if (!startMatch || !endMatch) return text;

    const startDelim = startMatch[0];
    const endDelim = endMatch[0];
    let content = text.substring(startDelim.length, text.length - endDelim.length).trim();

    // Normalize whitespace
    content = content.replace(/\s+/g, ' ');

    return `${startDelim} ${content} ${endDelim}`;
}

export function formatTwigDeep(input: string, options: FormatterOptions = { tabSize: 2, insertSpaces: true }): string {
    const tokenizer = new TwigTokenizer(input);
    const tokens = tokenizer.tokenize();
    const tabSize = options.tabSize || 2;
    const insertSpaces = options.insertSpaces !== false;
    const indentString = insertSpaces ? ' '.repeat(tabSize) : '\t';

    let formatted = '';
    let indentLevel = 0;

    const getIndent = () => indentString.repeat(Math.max(0, indentLevel));

    // Void elements
    const voidTags = new Set([
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
    ]);

    // Inline elements
    const inlineTags = new Set([
        'a', 'abbr', 'b', 'bdo', 'button', 'cite', 'code', 'del', 'dfn', 'em', 'i', 'img', 'ins', 'kbd', 'label', 'map', 'object', 'q', 'samp', 'select', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'tt', 'var', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th', 'label'
    ]);

    // Tags where whitespace must be preserved exactly
    const preserveWhitespaceTags = new Set(['pre', 'textarea', 'script', 'style']);

    let currentTagName = '';
    let inlineLevel = 0;
    let inPreserveWhitespace = false;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === TokenType.Whitespace) continue;

        // If in preserved block
        if (inPreserveWhitespace && token.type !== TokenType.TagClose && token.type !== TokenType.RawBlock) {
             formatted += token.text;
             continue;
        }

        switch (token.type) {
            case TokenType.TagOpen:
                if (token.text.startsWith('<')) {
                    // HTML Tag
                    const match = token.text.match(/^<([a-zA-Z0-9-]+)/);
                    const tagName = match ? match[1].toLowerCase() : '';

                    if (inlineTags.has(tagName)) {
                        if (inlineLevel === 0) {
                             if (formatted.length > 0 && !formatted.endsWith('\n')) {
                                 // Enforce newline + indent if starting a new inline sequence
                                 if (!formatted.endsWith(' ')) formatted += '\n' + getIndent();
                             } else {
                                 formatted += getIndent();
                             }
                        } else {
                             // Nested inline
                             if (!formatted.endsWith(' ') && !formatted.endsWith('\n')) formatted += '';
                        }
                        inlineLevel++;
                        formatted += token.text;
                    } else {
                        // Block tag
                        if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
                        formatted += getIndent() + token.text;
                    }
                    currentTagName = tagName;
                } else {
                    // Twig Tag (standalone like include, extends)
                    if (inlineLevel > 0) {
                         // Inside inline element
                         formatted += ' ' + formatTwigTag(token.text);
                    } else {
                        if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
                        formatted += getIndent() + formatTwigTag(token.text);
                    }
                }
                break;

            case TokenType.AttributeName:
                formatted += ' ' + token.text;
                break;

            case TokenType.AttributeValue:
                // Handle Twig in attribute value logic is in Tokenizer (it concatenates)
                // We try to format any Twig expressions inside the attribute value
                let attrVal = token.text;
                attrVal = attrVal.replace(/\{\{.*?\}\}/g, (match) => {
                    return formatTwigExpression(match);
                });
                formatted += '=' + attrVal;
                break;

            case TokenType.TagEnd:
                // >
                formatted += token.text;
                if (!voidTags.has(currentTagName) && !inlineTags.has(currentTagName) && !token.text.startsWith('%}')) {
                    indentLevel++;
                }

                if (preserveWhitespaceTags.has(currentTagName)) {
                    inPreserveWhitespace = true;
                }
                break;

            case TokenType.TagSelfClose:
                formatted += token.text; // />
                if (inlineTags.has(currentTagName)) {
                    inlineLevel = Math.max(0, inlineLevel - 1);
                }
                break;

            case TokenType.TagClose:
                // </div>
                const closeMatch = token.text.match(/^<\/([a-zA-Z0-9-]+)/);
                const closeTagName = closeMatch ? closeMatch[1].toLowerCase() : '';

                if (inlineTags.has(closeTagName)) {
                    inlineLevel = Math.max(0, inlineLevel - 1);
                    formatted += token.text;
                } else {
                    indentLevel = Math.max(0, indentLevel - 1);

                    if (inPreserveWhitespace) {
                        formatted += token.text;
                        inPreserveWhitespace = false;
                    } else {
                        if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
                        formatted += getIndent() + token.text;
                    }
                }
                break;

            case TokenType.BlockOpen:
                // {% block ... %}
                const formattedBlockOpen = formatTwigTag(token.text);
                if (inlineLevel > 0) {
                    formatted += ' ' + formattedBlockOpen;
                } else {
                    if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
                    formatted += getIndent() + formattedBlockOpen;
                    indentLevel++;
                }
                break;

            case TokenType.BlockClose:
                // {% endblock %}
                const formattedBlockClose = formatTwigTag(token.text);
                if (inlineLevel > 0) {
                    formatted += ' ' + formattedBlockClose;
                } else {
                    indentLevel = Math.max(0, indentLevel - 1);
                    if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
                    formatted += getIndent() + formattedBlockClose;
                }
                break;

            case TokenType.BlockInverse:
                // {% else %}
                const formattedBlockInverse = formatTwigTag(token.text);
                if (inlineLevel > 0) {
                    formatted += ' ' + formattedBlockInverse;
                } else {
                    indentLevel = Math.max(0, indentLevel - 1);
                    if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
                    formatted += getIndent() + formattedBlockInverse;
                    indentLevel++;
                }
                break;

            case TokenType.OutputOpen:
                // {{ ... }}
                const formattedExpr = formatTwigExpression(token.text);
                if (inlineLevel > 0) {
                    formatted += formattedExpr;
                } else {
                    if (formatted.length > 0 && !formatted.endsWith('\n')) {
                         formatted += '\n' + getIndent() + formattedExpr;
                    } else {
                         formatted += getIndent() + formattedExpr;
                    }
                }
                break;

            case TokenType.Comment:
                // {# ... #}
                if (inlineLevel > 0) {
                    formatted += ' ' + token.text;
                } else {
                    if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
                    formatted += getIndent() + token.text;
                }
                break;

            case TokenType.RawBlock:
                // {% verbatim %}...{% endverbatim %}
                if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
                formatted += getIndent() + token.text;
                break;

            case TokenType.Text:
                if (inPreserveWhitespace) {
                    formatted += token.text;
                } else if (inlineLevel > 0) {
                     // Inside inline tag: collapse whitespace to single space
                     const text = token.text.replace(/[\n\r]+/g, ' ');
                     formatted += text.replace(/\s+/g, ' ');
                } else {
                     // Block context text: split and indent
                     const lines = token.text.split('\n');
                     for (const line of lines) {
                         const trimmed = line.trim();
                         if (trimmed.length > 0) {
                             if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
                             formatted += getIndent() + trimmed;
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
