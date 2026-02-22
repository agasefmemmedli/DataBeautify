import { HandlebarsTokenizer, Token, TokenType } from './handlebars_tokenizer';

interface FormatterOptions {
    tabSize: number;
    insertSpaces: boolean;
}

export function formatHandlebarsDeep(input: string, options: FormatterOptions = { tabSize: 2, insertSpaces: true }): string {
    const tokenizer = new HandlebarsTokenizer(input);
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

    // Inline elements (removed script, textarea)
    const inlineTags = new Set([
        'a', 'abbr', 'b', 'bdo', 'button', 'cite', 'code', 'del', 'dfn', 'em', 'i', 'img', 'ins', 'kbd', 'label', 'map', 'object', 'q', 'samp', 'select', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'tt', 'var'
    ]);

    // Tags where whitespace must be preserved exactly
    const preserveWhitespaceTags = new Set(['pre', 'textarea', 'script', 'style']);

    let currentTagName = '';
    let inlineLevel = 0;
    let inPreserveWhitespace = false;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === TokenType.Whitespace) continue;

        // If in preserved block (like pre, script), output everything exactly until closing tag
        if (inPreserveWhitespace && token.type !== TokenType.TagClose) {
            formatted += token.text;
            continue;
        }

        switch (token.type) {
            case TokenType.TagOpen:
                // <div
                const tagName = token.text.substring(1).toLowerCase();

                if (inlineTags.has(tagName)) {
                    if (inlineLevel === 0) {
                         // Start of inline sequence
                         if (formatted.endsWith('\n')) {
                             formatted += getIndent();
                         } else if (formatted.length > 0) {
                             formatted += ' ';
                         }
                    }
                    inlineLevel++;
                    formatted += token.text;
                } else {
                    // Block tag
                    formatted += (formatted ? '\n' : '') + getIndent() + token.text;
                }
                currentTagName = tagName;
                break;

            case TokenType.AttributeName:
                formatted += ' ' + token.text;
                break;

            case TokenType.AttributeValue:
                formatted += '=' + token.text;
                break;

            case TokenType.TagEnd:
                formatted += token.text;
                if (!voidTags.has(currentTagName) && !inlineTags.has(currentTagName)) {
                    indentLevel++;
                }

                if (preserveWhitespaceTags.has(currentTagName)) {
                    inPreserveWhitespace = true;
                }

                currentTagName = '';
                break;

            case TokenType.TagSelfClose:
                formatted += token.text;
                if (inlineTags.has(currentTagName)) {
                    inlineLevel = Math.max(0, inlineLevel - 1);
                }
                currentTagName = '';
                break;

            case TokenType.TagClose:
                // </div>
                const closeTagName = token.text.substring(2, token.text.length - 1).toLowerCase();

                if (inlineTags.has(closeTagName)) {
                    inlineLevel = Math.max(0, inlineLevel - 1);
                    formatted += token.text;
                } else {
                    indentLevel = Math.max(0, indentLevel - 1);

                    if (inPreserveWhitespace) {
                        formatted += token.text;
                        inPreserveWhitespace = false;
                    } else {
                        formatted += (formatted ? '\n' : '') + getIndent() + token.text;
                    }
                }
                break;

            case TokenType.BlockOpen:
                // {{#if ...}}
                if (currentTagName || inlineLevel > 0) {
                    formatted += ' ' + token.text;
                } else {
                    formatted += (formatted ? '\n' : '') + getIndent() + token.text;
                    indentLevel++;
                }
                break;

            case TokenType.BlockClose:
                // {{/if}}
                if (currentTagName || inlineLevel > 0) {
                    formatted += ' ' + token.text;
                } else {
                    indentLevel = Math.max(0, indentLevel - 1);
                    formatted += (formatted ? '\n' : '') + getIndent() + token.text;
                }
                break;

            case TokenType.BlockInverse:
                // {{else}}
                if (currentTagName || inlineLevel > 0) {
                    formatted += ' ' + token.text;
                } else {
                    indentLevel = Math.max(0, indentLevel - 1);
                    formatted += (formatted ? '\n' : '') + getIndent() + token.text;
                    indentLevel++;
                }
                break;

            case TokenType.Text:
                if (inlineLevel > 0) {
                     // Inside inline tag: collapse whitespace
                     const collapsed = token.text.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ');
                     formatted += collapsed;
                } else {
                     // Block context text: split and indent
                     const lines = token.text.split('\n');
                     for (const line of lines) {
                         const trimmed = line.trim();
                         if (trimmed.length > 0) {
                             formatted += (formatted ? '\n' : '') + getIndent() + trimmed;
                         }
                     }
                }
                break;

            case TokenType.Comment:
            case TokenType.MustacheComment:
                if (currentTagName || inlineLevel > 0) {
                    formatted += ' ' + token.text;
                } else {
                    formatted += (formatted ? '\n' : '') + getIndent() + token.text;
                }
                break;

            case TokenType.MustacheExpression:
                if (currentTagName || inlineLevel > 0) {
                    formatted += ' ' + token.text;
                } else {
                    formatted += (formatted ? '\n' : '') + getIndent() + token.text;
                }
                break;

            default:
                formatted += token.text;
        }
    }

    return formatted + '\n';
}
