import { TwigTokenizer, Token, TokenType } from './twig_tokenizer';

interface FormatterOptions {
    tabSize?: number;
    insertSpaces?: boolean;
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
        if (inPreserveWhitespace && token.type !== TokenType.TagClose && token.type !== TokenType.RawBlock) {
             // For RawBlock (verbatim), we handle it separately
             // But if we are in <pre>, we should preserve token text?
             // The tokenizer doesn't return Whitespace tokens by default (it skips them in loop unless readText captures them?).
             // Wait, `readText` captures newlines/spaces if they are not skipped?
             // My tokenizer `tokenize` loop does NOT skip whitespace explicitly except inside `readHTMLTagOpen`.
             // But `readText` consumes until it hits a tag start. So it captures whitespace.
             // So `TokenType.Text` contains the whitespace.
             // My tokenizer does not emit `TokenType.Whitespace` explicitly.
             // So the check `if (token.type === TokenType.Whitespace)` is redundant but harmless.
        }

        switch (token.type) {
            case TokenType.TagOpen:
                // <div or {% include
                // Distinguish between HTML TagOpen and Twig TagOpen?
                // The tokenizer uses TokenType.TagOpen for both generic Twig tags and HTML tags.
                // But my tokenizer `readHTMLTagOpen` returns `TagOpen` with `<div`.
                // `readTwigTag` returns `TagOpen` with `{% include ... %}`.

                if (token.text.startsWith('<')) {
                    // HTML Tag
                    const tagName = token.text.substring(1).toLowerCase();

                    if (inlineTags.has(tagName)) {
                        if (inlineLevel === 0) {
                             if (formatted.length > 0 && !formatted.endsWith('\n') && !formatted.endsWith(' ')) {
                                 formatted += ' ';
                             } else if (formatted.endsWith('\n')) {
                                 formatted += getIndent();
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
                } else {
                    // Twig Tag (standalone like include, extends)
                    if (inlineLevel > 0) {
                        formatted += ' ' + token.text;
                    } else {
                        if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
                        formatted += getIndent() + token.text;
                    }
                }
                break;

            case TokenType.AttributeName:
                formatted += ' ' + token.text;
                break;

            case TokenType.AttributeValue:
                formatted += '=' + token.text;
                break;

            case TokenType.TagEnd:
                // >
                formatted += token.text;
                if (!voidTags.has(currentTagName) && !inlineTags.has(currentTagName) && !token.text.startsWith('%}')) {
                    // Only indent if it was an HTML tag end >
                    // And not void/inline.
                    indentLevel++;
                }

                if (preserveWhitespaceTags.has(currentTagName)) {
                    inPreserveWhitespace = true;
                }

                currentTagName = '';
                break;

            case TokenType.TagSelfClose:
                formatted += token.text; // />
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
                        if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
                        formatted += getIndent() + token.text;
                    }
                }
                break;

            case TokenType.BlockOpen:
                // {% block ... %}
                if (inlineLevel > 0) {
                    formatted += ' ' + token.text;
                } else {
                    if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
                    formatted += getIndent() + token.text;
                    indentLevel++;
                }
                break;

            case TokenType.BlockClose:
                // {% endblock %}
                if (inlineLevel > 0) {
                    formatted += ' ' + token.text;
                } else {
                    indentLevel = Math.max(0, indentLevel - 1);
                    if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
                    formatted += getIndent() + token.text;
                }
                break;

            case TokenType.BlockInverse:
                // {% else %}
                if (inlineLevel > 0) {
                    formatted += ' ' + token.text;
                } else {
                    indentLevel = Math.max(0, indentLevel - 1);
                    if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
                    formatted += getIndent() + token.text;
                    indentLevel++;
                }
                break;

            case TokenType.OutputOpen:
                // {{
                if (inlineLevel > 0) {
                    formatted += token.text; // Start immediately? Or add space?
                    // Usually {{ ... }} has spaces inside.
                    // But before {{ ?
                    // If previous was text, it depends.
                    // Let's assume text token handles trailing spaces.
                } else {
                    if (formatted.length > 0 && !formatted.endsWith('\n')) {
                         // Check if we should wrap? For now, append inline or new line?
                         // If we are in block context, usually we want {{ }} on new line if it's substantial?
                         // But simple vars {{ page.title }} are often inline.
                         // Let's look at next tokens.
                         // But deep formatter usually enforces structure.
                         // Let's stick to: if we are in block context (inlineLevel == 0), prefer new line.
                         formatted += '\n' + getIndent() + token.text;
                    } else {
                         formatted += getIndent() + token.text;
                    }
                }
                break; // Wait, OutputOpen is just `{{`. We need to handle content inside?
                // The tokenizer returns `OutputOpen` with full text `{{ ... }}` in my implementation?
                // Let's check `readTwigOutput` in tokenizer.
                // It returns `TokenType.OutputOpen` with the FULL text `{{ ... }}`.
                // So this case handles the whole output block.
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
                     // Inside inline tag: collapse whitespace
                     const collapsed = token.text.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ');
                     formatted += collapsed;
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
