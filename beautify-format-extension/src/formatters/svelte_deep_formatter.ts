import { SvelteTokenizer, TokenType, Token } from './svelte_tokenizer';

interface SvelteFormattingOptions {
    tabSize?: number;
    insertSpaces?: boolean;
    printWidth?: number;
}

export function formatSvelteDeep(text: string, options: SvelteFormattingOptions = {}): string {
    const tabSize = options.tabSize || 2;
    const insertSpaces = options.insertSpaces !== false;
    const printWidth = options.printWidth || 120;

    // 1. Tokenize
    const tokenizer = new SvelteTokenizer(text);
    const tokens = tokenizer.tokenize();

    // 2. Masking
    const placeholders: Map<string, string> = new Map();
    const closingTagsMap: Map<string, string> = new Map();
    let maskCounter = 0;

    const createPlaceholder = (original: string, prefix: string = 'SVELTE') => {
        const key = `__${prefix}_${maskCounter++}__`;
        placeholders.set(key, original);
        return key;
    };

    let maskedText = '';
    const blockStack: string[] = [];

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        switch (token.type) {
            case TokenType.LogicBlockStart: {
                // {#if ...} -> <svelte-block-N>
                const tagName = `svelte-block-${maskCounter}`;
                const key = createPlaceholder(token.text, 'BLOCK_START');

                maskedText += `<${tagName} data-svelte-id="${key}">`;
                blockStack.push(tagName);
                maskCounter++;
                break;
            }
            case TokenType.LogicBlockMiddle: {
                // {:else ...}
                const key = createPlaceholder(token.text, 'BLOCK_MIDDLE');
                let closeTag = '';
                if (blockStack.length > 0) {
                    const currentTag = blockStack.pop();
                    closeTag = `</${currentTag}>`;
                    // The closing tag of the previous block should be removed (replaced with empty string)
                    // because the new block (LogicBlockMiddle) effectively continues the logic at the same level
                    // but structurally we closed the previous <div> and opened a new one.
                    closingTagsMap.set(closeTag, '');
                }

                const tagName = `svelte-block-${maskCounter}`;
                maskedText += `${closeTag}<${tagName} data-svelte-id="${key}">`;
                blockStack.push(tagName);
                maskCounter++;
                break;
            }
            case TokenType.LogicBlockEnd: {
                // {/if}
                if (blockStack.length > 0) {
                    const currentTag = blockStack.pop();
                    const closeTag = `</${currentTag}>`;
                    maskedText += closeTag;
                    closingTagsMap.set(closeTag, token.text);
                } else {
                     maskedText += token.text;
                }
                break;
            }
            case TokenType.LogicBlockTag: {
                // {@html ...} -> Self closing
                const key = createPlaceholder(token.text, 'BLOCK_TAG');
                maskedText += `<svelte-tag-${maskCounter} data-svelte-id="${key}" />`;
                maskCounter++;
                break;
            }
            case TokenType.Expression: {
                // {expr}
                const key = createPlaceholder(token.text, 'EXPR');
                maskedText += key;
                break;
            }
            case TokenType.AttributeName: {
                if (token.text.startsWith('{')) {
                    const key = createPlaceholder(token.text, 'SPREAD');
                    maskedText += ` data-svelte-spread="${key}"`;
                } else {
                    maskedText += ' ' + token.text;
                }
                break;
            }
            case TokenType.AttributeValue: {
                maskedText += '=';
                let val = token.text;
                let quote = '';

                if (val.startsWith('"')) { quote = '"'; val = val.slice(1, -1); }
                else if (val.startsWith("'")) { quote = "'"; val = val.slice(1, -1); }

                if (val.startsWith('{') && val.endsWith('}')) {
                     const key = createPlaceholder(val, 'ATTR_VAL');
                     maskedText += `"${key}"`;
                } else {
                     val = val.replace(/\{[^{}]+\}/g, (match) => {
                         return createPlaceholder(match, 'ATTR_EXPR');
                     });

                     if (quote) {
                         maskedText += `${quote}${val}${quote}`;
                     } else {
                         maskedText += `"${val}"`;
                     }
                }
                break;
            }
            default:
                maskedText += token.text;
        }
    }

    // 3. Format with js-beautify
    let formattedTemplate = maskedText;
    try {
        const jsbeautify = require('js-beautify');
        formattedTemplate = jsbeautify.html(maskedText, {
            indent_size: tabSize,
            indent_char: insertSpaces ? ' ' : '\t',
            max_preserve_newlines: 1,
            preserve_newlines: true,
            indent_scripts: 'keep',
            wrap_line_length: printWidth,
            wrap_attributes: 'auto',
            indent_inner_html: true,
            end_with_newline: false
        });
    } catch (e) {
        console.warn('js-beautify failed:', e);
        formattedTemplate = maskedText;
    }

    // 4. Unmask

    // Replace Logic Block Start/Middle Tags
    formattedTemplate = formattedTemplate.replace(/<svelte-block-\d+\s+data-svelte-id="(__[^"]+__)"\s*>/g, (match, key) => {
        return placeholders.get(key) || match;
    });

    // Replace Logic Block End Tags (using closingTagsMap)
    closingTagsMap.forEach((value, tag) => {
        const regex = new RegExp(tag, 'g');
        formattedTemplate = formattedTemplate.replace(regex, value);
    });

    // Replace Logic Block Tags (self closing)
    formattedTemplate = formattedTemplate.replace(/<svelte-tag-\d+\s+data-svelte-id="(__[^"]+__)"\s*\/>/g, (match, key) => {
        return placeholders.get(key) || match;
    });

    // Replace Spreads
    formattedTemplate = formattedTemplate.replace(/\s?data-svelte-spread="(__[^"]+__)"/g, (match, key) => {
        const val = placeholders.get(key);
        return val ? ' ' + val : match;
    });

    // Replace standard placeholders (matching any __PREFIX_NUMBER__ pattern)
    formattedTemplate = formattedTemplate.replace(/__\w+_\d+__/g, (match) => {
        return placeholders.get(match) || match;
    });

    // Remove quotes around simple expressions if desired, or keep them.
    // Svelte parser accepts both. Standardizing on `={expr}` is common.
    formattedTemplate = formattedTemplate.replace(/="(\{([^}]+)\})"/g, '=$1');

    return formattedTemplate;
}
