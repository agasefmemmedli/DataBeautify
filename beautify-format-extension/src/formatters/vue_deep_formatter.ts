import { HTMLTokenizer, TokenType, Token } from './html_tokenizer';
import { formatJSDeep } from './js_deep_formatter';
import { formatCSSDeep } from './css_deep_formatter';
import { formatSCSSDeep } from './scss_deep_formatter';
import { formatLessDeep } from './less_deep_formatter';
import { formatSassDeep } from './sass_deep_formatter';

interface VueFormattingOptions {
    tabSize?: number;
    insertSpaces?: boolean;
    sortAttributes?: boolean;
    printWidth?: number;
}

export function formatVueDeep(vue: string, options: VueFormattingOptions = {}): string {
    const tabSize = options.tabSize || 2;
    const insertSpaces = options.insertSpaces !== false;
    const indentString = insertSpaces ? ' '.repeat(tabSize) : '\t';
    const printWidth = options.printWidth || 120;
    const sortAttributes = options.sortAttributes !== false; // Default true

    // Void elements (no closing tag)
    const voidTags = new Set([
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
    ]);

    const tokenizer = new HTMLTokenizer(vue);
    const tokens = tokenizer.tokenize();

    let formattedLines: string[] = [];
    let indentLevel = 0;
    let inPre = false; // Preserve whitespace inside <pre>

    // Helper to get current indent string
    const getIndent = (level: number) => indentString.repeat(Math.max(0, level));

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === TokenType.TagOpen) {
            // Buffer attributes until TagEnd or TagSelfClose
            const tagNameOriginal = token.text.substring(1); // Remove <
            const tagNameLower = tagNameOriginal.toLowerCase();
            const isVoid = voidTags.has(tagNameLower);

            if (tagNameLower === 'pre') inPre = true;

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
                    // Check if next token is value
                    if (j + 1 < tokens.length && tokens[j + 1].type === TokenType.AttributeValue) {
                        value = tokens[j + 1].text;
                        j++; // Skip value token
                    }
                    attributes.push({ name, value });
                }
                j++;
            }

            // Determine language for script/style
            let lang = 'html';
            if (tagNameLower === 'script') {
                const langAttr = attributes.find(a => a.name === 'lang');
                if (langAttr && langAttr.value) {
                    lang = langAttr.value.replace(/['"]/g, '');
                } else {
                    lang = 'js';
                }
            } else if (tagNameLower === 'style') {
                const langAttr = attributes.find(a => a.name === 'lang');
                if (langAttr && langAttr.value) {
                    lang = langAttr.value.replace(/['"]/g, '');
                } else {
                    lang = 'css';
                }
            }

            // Sort Attributes (except for script/style where order might matter less but usually safe)
            if (sortAttributes) {
                const priority = ['v-if', 'v-for', 'v-model', 'v-bind', 'v-on', 'ref', 'key', 'id', 'name', 'class', 'style', 'src', 'href', 'type', 'lang', 'scoped'];
                attributes.sort((a, b) => {
                    // Check priority list
                    const getPriority = (name: string) => {
                        if (name.startsWith('v-')) return 0; // Directives first
                        if (name.startsWith(':')) return 1; // Bindings
                        if (name.startsWith('@')) return 2; // Events
                        const idx = priority.indexOf(name);
                        return idx !== -1 ? idx + 3 : 99;
                    };

                    const pA = getPriority(a.name);
                    const pB = getPriority(b.name);

                    if (pA !== pB) return pA - pB;
                    return a.name.localeCompare(b.name);
                });
            }

            // Format Open Tag
            const selfClosing = tagEndToken?.type === TokenType.TagSelfClose || isVoid;
            const closingStr = (tagEndToken?.type === TokenType.TagSelfClose || isVoid) ? ' />' : '>';

            let tagLine = `<${tagNameOriginal}`;

            // Attribute Formatting
            // Try single line first
            let singleLineAttrs = '';
            for (const attr of attributes) {
                singleLineAttrs += ` ${attr.name}`;
                if (attr.value !== undefined) {
                    // Ensure quotes if needed
                    if (!/^["']/.test(attr.value)) {
                         attr.value = `"${attr.value}"`;
                    }
                    singleLineAttrs += `=${attr.value}`;
                }
            }

            const currentIndent = getIndent(indentLevel);
            const totalLen = (currentIndent + tagLine + singleLineAttrs + closingStr).length;

            if (attributes.length > 0 && totalLen > printWidth) {
                // Multi-line mode
                formattedLines.push(currentIndent + tagLine);
                for (const attr of attributes) {
                    let attrStr = ` ${attr.name}`;
                    if (attr.value !== undefined) {
                        attrStr += `=${attr.value}`;
                    }
                    formattedLines.push(getIndent(indentLevel + 1) + attrStr.trim());
                }
                formattedLines.push(currentIndent + closingStr);
            } else {
                // Single line mode
                formattedLines.push(currentIndent + tagLine + singleLineAttrs + closingStr);
            }

            if (!selfClosing) {
                indentLevel++;
            }

            // Optimization: Keep empty or short elements on one line
            // Check if we can keep closing tag on same line
            if (tagEndToken && tagEndToken.type === TokenType.TagEnd && !selfClosing && !inPre && tagNameLower !== 'script' && tagNameLower !== 'style') {
                let nextIdx = j + 1;
                // Empty element <tag></tag>
                if (nextIdx < tokens.length && tokens[nextIdx].type === TokenType.TagClose) {
                    const closeToken = tokens[nextIdx];
                    const closeTagName = closeToken.text.substring(2, closeToken.text.length - 1).toLowerCase();
                    if (closeTagName === tagNameLower) {
                        const lastLineIdx = formattedLines.length - 1;
                        if (lastLineIdx >= 0) {
                            formattedLines[lastLineIdx] += closeToken.text;
                        }
                        indentLevel--; // Revert indent
                        i = nextIdx; // Advance loop
                        continue;
                    }
                }
                // Simple text content <tag>text</tag>
                if (nextIdx < tokens.length && tokens[nextIdx].type === TokenType.Text) {
                    const textToken = tokens[nextIdx];
                    if (nextIdx + 1 < tokens.length && tokens[nextIdx + 1].type === TokenType.TagClose) {
                        const closeToken = tokens[nextIdx + 1];
                        const closeTagName = closeToken.text.substring(2, closeToken.text.length - 1).toLowerCase();
                        if (closeTagName === tagNameLower) {
                            const textContent = textToken.text.trim();
                            const lastLine = formattedLines[formattedLines.length - 1] || '';
                            const projectedLen = lastLine.length + textContent.length + closeToken.text.length;

                            if (projectedLen <= printWidth && !textContent.includes('\n')) {
                                formattedLines[formattedLines.length - 1] += textContent + closeToken.text;
                                indentLevel--; // Revert indent
                                i = nextIdx + 1; // Advance loop
                                continue;
                            }
                        }
                    }
                }
            }

            // Handle Content for Script/Style specifically if it follows immediately
            if ((tagNameLower === 'script' || tagNameLower === 'style') && !selfClosing) {
                // The next token should be Text, then TagClose
                if (i + 1 < tokens.length && tokens[i + 1].type === TokenType.Text) {
                    const contentToken = tokens[i + 1];
                    let formattedContent = contentToken.text;

                    // Format based on lang
                    try {
                        if (tagNameLower === 'script') {
                            // JS/TS
                            formattedContent = formatJSDeep(contentToken.text, { tabSize, insertSpaces, printWidth });
                        } else if (tagNameLower === 'style') {
                            // CSS/SCSS/LESS/SASS
                            if (lang === 'scss') {
                                formattedContent = formatSCSSDeep(contentToken.text, { tabSize, insertSpaces });
                            } else if (lang === 'less') {
                                formattedContent = formatLessDeep(contentToken.text, { tabSize, insertSpaces });
                            } else if (lang === 'sass') {
                                formattedContent = formatSassDeep(contentToken.text);
                            } else {
                                formattedContent = formatCSSDeep(contentToken.text, { tabSize, insertSpaces });
                            }
                        }
                    } catch (e) {
                        // Fallback to original text if formatter fails
                        console.warn(`Failed to format ${tagNameLower} block:`, e);
                    }

                    // Indent the formatted content
                    const lines = formattedContent.split('\n');
                    for (const line of lines) {
                        if (line.trim().length > 0) {
                            formattedLines.push(getIndent(indentLevel) + line);
                        } else if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                            formattedLines.push('');
                        }
                    }

                    i++; // Skip Text token
                }
            }

        } else if (token.type === TokenType.TagClose) {
            const tagNameLower = token.text.substring(2, token.text.length - 1).toLowerCase(); // </tag>
            if (tagNameLower === 'pre') inPre = false;

            // Dedent
            indentLevel = Math.max(0, indentLevel - 1);
            formattedLines.push(getIndent(indentLevel) + token.text);

        } else if (token.type === TokenType.Text) {
            if (inPre) {
                formattedLines.push(token.text);
            } else {
                const trimmed = token.text.trim();
                if (trimmed.length > 0) {
                    // Indent text content
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
            formattedLines.push(getIndent(indentLevel) + token.text);
        }
    }

    return formattedLines.join('\n');
}
