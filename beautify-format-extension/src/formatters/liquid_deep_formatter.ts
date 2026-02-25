import { LiquidTokenizer, TokenType, Token } from './liquid_tokenizer';
import { formatJSONDeep } from './json_deep_formatter';
import { formatCSSDeep } from './css_deep_formatter';
import { formatJSDeep } from './js_deep_formatter';

interface FormatterOptions {
    tabSize: number;
    insertSpaces: boolean;
    printWidth?: number;
}

interface BlockState {
    tagName: string;
    startLineIndex: number; // Index in 'formatted' string where the tag started
}

export function formatLiquidDeep(input: string, options: FormatterOptions = { tabSize: 2, insertSpaces: true, printWidth: 80 }): string {
    const tokenizer = new LiquidTokenizer(input);
    const tokens = tokenizer.tokenize();
    const tabSize = options.tabSize || 2;
    const insertSpaces = options.insertSpaces !== false;
    const printWidth = options.printWidth || 80;
    const indentString = insertSpaces ? ' '.repeat(tabSize) : '\t';

    let formatted = '';
    let indentLevel = 0;
    const tagStack: BlockState[] = [];

    const getIndent = (level: number) => indentString.repeat(Math.max(0, level));

    // Void elements
    const voidTags = new Set([
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
    ]);

    // Inline elements
    const inlineTags = new Set([
        'a', 'abbr', 'b', 'bdo', 'button', 'cite', 'code', 'del', 'dfn', 'em', 'i', 'img', 'ins', 'kbd', 'label', 'map', 'object', 'q', 'samp', 'select', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'tt', 'var'
    ]);

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === TokenType.Whitespace) continue;

        // Space insertion logic
        const needsSpace = () => {
             if (formatted.length === 0 || formatted.endsWith('\n') || formatted.endsWith(' ')) return false;
             if (i > 0 && tokens[i-1].type === TokenType.Whitespace) return true;
             return false;
        };

        if (token.type === TokenType.TagOpen && token.text.startsWith('<')) {
            // HTML Tag
            const tagName = token.text.substring(1).toLowerCase();
            const isVoid = voidTags.has(tagName);
            const isInline = inlineTags.has(tagName);

            // Collect attributes
            let attributes: Token[] = [];
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
                } else if (t.type !== TokenType.Whitespace) {
                    attributes.push(t);
                }
                j++;
            }

            if (!isInline) {
                 if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
            }

            if (formatted.length > 0 && formatted.endsWith('\n')) {
                formatted += getIndent(indentLevel);
            } else if (needsSpace()) {
                formatted += ' ';
            }

            const startLineIndex = formatted.lastIndexOf('\n');
            formatted += token.text; // <tag

            // Print attributes
            if (attributes.length > 0) {
                let totalLen = token.text.length + (tagEndToken ? tagEndToken.text.length : 1);
                attributes.forEach(a => totalLen += a.text.length + 1);

                const multiline = totalLen > printWidth || attributes.some(a => a.type === TokenType.TagOpen || a.type === TokenType.OutputOpen);

                if (multiline) {
                    for (const attr of attributes) {
                        formatted += '\n' + getIndent(indentLevel + 1);
                        formatted += attr.text;
                        if (attr.type === TokenType.AttributeValue) {
                             formatted = formatted.trimEnd();
                             formatted += '=' + attr.text;
                        }
                    }
                    formatted += '\n' + getIndent(indentLevel);
                } else {
                    for (const attr of attributes) {
                        if (attr.type === TokenType.AttributeValue) {
                            formatted += '=' + attr.text;
                        } else {
                            formatted += ' ' + attr.text;
                        }
                    }
                }
            }

            if (tagEndToken) formatted += tagEndToken.text;

            if (!isVoid && !selfClosing) {
                tagStack.push({ tagName, startLineIndex });
                indentLevel++;
            }

        } else if (token.type === TokenType.TagClose) {
            indentLevel = Math.max(0, indentLevel - 1);
            const tagName = token.text.replace('</', '').replace('>', '').trim().toLowerCase();
            const isInline = inlineTags.has(tagName);

            let sameLine = false;
            // Check stack
            if (tagStack.length > 0) {
                const last = tagStack[tagStack.length - 1];
                if (last.tagName === tagName) {
                     // Check if last newline is before startLineIndex?
                     // If formatted has appended newlines since startLineIndex, then lastIndexOf('\n') > startLineIndex.
                     const lastNewline = formatted.lastIndexOf('\n');
                     if (lastNewline <= last.startLineIndex) {
                         sameLine = true;
                     }
                     tagStack.pop();
                } else {
                    // Mismatch, try to find and pop?
                    // Just pop until found
                    let idx = tagStack.length - 1;
                    while(idx >= 0) {
                        if (tagStack[idx].tagName === tagName) {
                            tagStack.splice(idx, 1); // remove it
                            break;
                        }
                        idx--;
                    }
                }
            }

            if (!isInline && !sameLine) {
                 if (!formatted.endsWith('\n')) formatted += '\n';
                 formatted += getIndent(indentLevel);
            } else if (needsSpace()) {
                 formatted += ' ';
            }

            formatted += token.text;

        } else if (token.type === TokenType.BlockOpen) { // {% if ... %}
            if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
            formatted += getIndent(indentLevel) + token.text;
            indentLevel++;

        } else if (token.type === TokenType.BlockInverse) { // {% else %}
            indentLevel = Math.max(0, indentLevel - 1);
            if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
            formatted += getIndent(indentLevel) + token.text;
            indentLevel++;

        } else if (token.type === TokenType.BlockClose) { // {% endif %}
            indentLevel = Math.max(0, indentLevel - 1);
            if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
            formatted += getIndent(indentLevel) + token.text;

        } else if (token.type === TokenType.TagOpen) { // Generic Liquid {% assign ... %}
             if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
             formatted += getIndent(indentLevel) + token.text;

        } else if (token.type === TokenType.OutputOpen) { // {{ ... }}
             if (formatted.length > 0 && formatted.endsWith('\n')) {
                 formatted += getIndent(indentLevel);
             } else if (needsSpace()) {
                 formatted += ' ';
             }
             const content = token.text.substring(2, token.text.length - 2).trim();
             formatted += `{{ ${content} }}`;

        } else if (token.type === TokenType.RawBlock) {
             if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
             formatted += getIndent(indentLevel);

             const parts = token.text.match(/^({%-?\s*\w+\s*-?%})([\s\S]*?)({%-?\s*end\w+\s*-?%})$/);
             if (parts) {
                 const open = parts[1];
                 const content = parts[2];
                 const close = parts[3];
                 formatted += open + '\n';

                 let innerFormatted = content;
                 if (open.includes('schema')) {
                     try { innerFormatted = formatJSONDeep(content, { tabSize, insertSpaces }); } catch(e) {}
                 } else if (open.includes('style') || open.includes('stylesheet')) {
                      try { innerFormatted = formatCSSDeep(content, { tabSize, insertSpaces }); } catch(e) {}
                 } else if (open.includes('javascript')) {
                      try { innerFormatted = formatJSDeep(content, { tabSize, insertSpaces }); } catch(e) {}
                 }

                 const innerLines = innerFormatted.split('\n');
                 for (const line of innerLines) {
                     if (line.trim().length > 0) {
                         formatted += getIndent(indentLevel + 1) + line + '\n';
                     }
                 }
                 formatted += getIndent(indentLevel) + close;
             } else {
                 formatted += token.text;
             }

        } else if (token.type === TokenType.Comment) {
             if (formatted.length > 0 && !formatted.endsWith('\n')) formatted += '\n';
             formatted += getIndent(indentLevel) + token.text;

        } else if (token.type === TokenType.Text) {
             const trimmed = token.text.trim();
             if (trimmed.length > 0) {
                 if (formatted.length > 0 && formatted.endsWith('\n')) {
                     formatted += getIndent(indentLevel);
                 } else if (needsSpace()) {
                     formatted += ' ';
                 }
                 formatted += trimmed;
             }
        }
    }

    return formatted + '\n';
}
