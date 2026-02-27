
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
            const tagNameOriginal = token.text.substring(1); // Remove <
            const tagNameLower = tagNameOriginal.toLowerCase();
            const isVoid = voidTags.has(tagNameLower);

            if (tagNameLower === 'pre') inPre = true;

            const attributes: { name: string, value?: string }[] = [];
            let j = i + 1;
            let tagEndToken: Token | null = null;
            let tagSelfClosing = false;

            // Collect attributes
            while (j < tokens.length) {
                const t = tokens[j];
                if (t.type === TokenType.TagEnd) {
                    tagEndToken = t;
                    i = j; // Update i
                    break;
                } else if (t.type === TokenType.TagSelfClose) {
                    tagEndToken = t;
                    tagSelfClosing = true;
                    i = j; // Update i
                    break;
                } else if (t.type === TokenType.AttributeName) {
                    const name = t.text;
                    let value: string | undefined = undefined;
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

            // Sort Attributes
            if (sortAttributes) {
                const priority = ['v-if', 'v-for', 'v-model', 'v-bind', 'v-on', 'ref', 'key', 'id', 'name', 'class', 'style', 'src', 'href', 'type', 'lang', 'scoped'];
                attributes.sort((a, b) => {
                    const getPriority = (name: string) => {
                        if (name.startsWith('v-')) return 0;
                        if (name.startsWith(':')) return 1;
                        if (name.startsWith('@')) return 2;
                        const idx = priority.indexOf(name);
                        return idx !== -1 ? idx + 3 : 99;
                    };
                    const pA = getPriority(a.name);
                    const pB = getPriority(b.name);
                    if (pA !== pB) return pA - pB;
                    return a.name.localeCompare(b.name);
                });
            }

            // Construct Tag String
            const closingStr = (tagSelfClosing || isVoid) ? ' />' : '>';
            let tagStr = `<${tagNameOriginal}`;

            let attrsStr = '';
            for (const attr of attributes) {
                attrsStr += ` ${attr.name}`;
                if (attr.value !== undefined) {
                    let val = attr.value;
                    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                         val = val.substring(1, val.length - 1);
                    }
                    val = val.replace(/"/g, '&quot;');
                    attrsStr += `="${val}"`;
                }
            }

            const currentIndent = getIndent(indentLevel);

            if ((currentIndent.length + tagStr.length + attrsStr.length + closingStr.length) > printWidth && attributes.length > 0) {
                 formattedLines.push(currentIndent + tagStr);
                 for (const attr of attributes) {
                     let attrLine = ` ${attr.name}`;
                     if (attr.value !== undefined) {
                         let val = attr.value;
                         if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                              val = val.substring(1, val.length - 1);
                         }
                         val = val.replace(/"/g, '&quot;');
                         attrLine += `="${val}"`;
                     }
                     formattedLines.push(getIndent(indentLevel + 1) + attrLine.trim());
                 }
                 formattedLines.push(currentIndent + closingStr);
            } else {
                 formattedLines.push(currentIndent + tagStr + attrsStr + closingStr);
            }

            // Handle Script/Style Content
            if ((tagNameLower === 'script' || tagNameLower === 'style') && !tagSelfClosing) {
                 // Expect next token to be content (Text/CDATA)
                 if (i + 1 < tokens.length && (tokens[i+1].type === TokenType.Text || tokens[i+1].type === TokenType.CDATA)) {
                     const contentToken = tokens[i+1];
                     const contentText = contentToken.text;

                     // Format Content
                     let formattedContent = contentText;
                     try {
                        if (tagNameLower === 'script') {
                             formattedContent = formatJSDeep(contentText, { tabSize, insertSpaces, printWidth });
                        } else {
                             if (lang === 'scss') formattedContent = formatSCSSDeep(contentText, { tabSize, insertSpaces });
                             else if (lang === 'less') formattedContent = formatLessDeep(contentText, { tabSize, insertSpaces });
                             else if (lang === 'sass') formattedContent = formatSassDeep(contentText);
                             else formattedContent = formatCSSDeep(contentText, { tabSize, insertSpaces });
                        }
                     } catch (e) {
                         // Fallback
                     }

                     // Indent and push
                     const lines = formattedContent.split('\n');
                     const contentIndentLevel = indentLevel + 1;

                     for (const line of lines) {
                         const trimmedLine = line.trim();
                         if (trimmedLine.length > 0) {
                             formattedLines.push(getIndent(contentIndentLevel) + trimmedLine);
                         } else {
                             formattedLines.push('');
                         }
                     }

                     i++; // Consume content
                 }
            } else if (!tagSelfClosing && !isVoid) {
                indentLevel++;
            }

            // Optimization for simple elements <span class="spinner"></span>
            if (!tagSelfClosing && !isVoid && !inPre && tagNameLower !== 'script' && tagNameLower !== 'style') {
                // Lookahead for closing tag
                if (i + 1 < tokens.length && tokens[i+1].type === TokenType.TagClose) {
                    const closeToken = tokens[i+1];
                    const closeTagName = closeToken.text.substring(2).toLowerCase();
                    if (closeTagName === tagNameLower) {
                        // Check if we can collapse
                        const lastLineIdx = formattedLines.length - 1;
                        const lastLine = formattedLines[lastLineIdx];
                        const projectedLen = lastLine.length + closeToken.text.length + 1; // +1 for >

                        if (projectedLen <= printWidth) {
                            formattedLines[lastLineIdx] += `</${closeTagName}>`;

                            // Consume TagClose and TagEnd
                            let k = i + 1;
                            // TagClose
                            k++;
                            // TagEnd
                            if (k < tokens.length && tokens[k].type === TokenType.TagEnd) {
                                k++;
                            }

                            i = k - 1; // Advance main loop
                            indentLevel--; // Revert indent (it was incremented above)
                        }
                    }
                }
            }

        } else if (token.type === TokenType.TagClose) {
            const tagNameLower = token.text.substring(2).toLowerCase(); // </tag
            if (tagNameLower === 'pre') inPre = false;

            // Consume optional TagEnd >
            let j = i + 1;
            while (j < tokens.length) {
                if (tokens[j].type === TokenType.TagEnd) {
                    i = j;
                    break;
                }
                j++;
            }

            if (tagNameLower !== 'script' && tagNameLower !== 'style') {
                indentLevel = Math.max(0, indentLevel - 1);
            }

            formattedLines.push(getIndent(indentLevel) + `</${tagNameLower}>`);

        } else if (token.type === TokenType.Text) {
             const trimmed = token.text.trim();
             if (trimmed.length > 0) {
                 if (inPre) {
                     formattedLines.push(token.text);
                 } else {
                     formattedLines.push(getIndent(indentLevel) + trimmed);
                 }
             }
        }
    }

    return formattedLines.join('\n');
}
