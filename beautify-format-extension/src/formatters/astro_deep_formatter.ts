import { AstroTokenizer, TokenType, Token } from './astro_tokenizer';

interface AstroFormattingOptions {
    tabSize?: number;
    insertSpaces?: boolean;
    printWidth?: number;
}

export function formatAstroDeep(text: string, options: AstroFormattingOptions = {}): string {
    const tabSize = options.tabSize || 2;
    const insertSpaces = options.insertSpaces !== false;

    // 1. Tokenize & Separate Frontmatter
    const tokenizer = new AstroTokenizer(text);
    const tokens = tokenizer.tokenize();

    let frontmatterRaw = '';
    let frontmatterFormatted = '';
    let templateTokens: Token[] = tokens;

    if (tokens.length > 0 && tokens[0].type === TokenType.Frontmatter) {
        frontmatterRaw = tokens[0].text;
        const content = frontmatterRaw.substring(3, frontmatterRaw.length - 3).trim(); // remove ---

        try {
            const jsbeautify = require('js-beautify');
            const jsContent = jsbeautify.js(content, {
                indent_size: tabSize,
                indent_char: insertSpaces ? ' ' : '\t',
                preserve_newlines: true,
                max_preserve_newlines: 2
            });
            frontmatterFormatted = `---\n${jsContent}\n---`;
        } catch (e) {
            frontmatterFormatted = frontmatterRaw;
        }

        templateTokens = tokens.slice(1);
    }

    // 2. Masking
    const placeholders: Map<string, string> = new Map();
    let maskCounter = 0;

    const createPlaceholder = (original: string, type: 'EXPR' | 'ATTR' | 'VAL') => {
        const key = `__ASTRO_${type}_${maskCounter++}__`;
        placeholders.set(key, original);
        return key;
    };

    let maskedText = '';

    for (let i = 0; i < templateTokens.length; i++) {
        const token = templateTokens[i];

        if (token.type === TokenType.Expression) {
            maskedText += createPlaceholder(token.text, 'EXPR');
        } else if (token.type === TokenType.AttributeName) {
            maskedText += ' '; // Ensure space before attribute
            // Check if it's spread
            if (token.text.startsWith('{')) {
                maskedText += createPlaceholder(token.text, 'ATTR');
            } else {
                maskedText += token.text;
            }
        } else if (token.type === TokenType.AttributeValue) {
            maskedText += '='; // Restore =
            // Check if expression
            if (token.text.startsWith('{')) {
                // It's {expr}. We wrap in quotes for HTML parser compatibility during formatting.
                const key = createPlaceholder(token.text, 'VAL');
                maskedText += `"${key}"`;
            } else {
                maskedText += token.text;
            }
        } else {
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
            indent_scripts: 'normal',
            wrap_line_length: options.printWidth || 120,
            wrap_attributes: 'auto',
            indent_inner_html: true,
            end_with_newline: false
        });
    } catch (e) {
        console.warn('js-beautify failed:', e);
        formattedTemplate = maskedText;
    }

    // 4. Unmask
    placeholders.forEach((value, key) => {
        if (key.includes('_VAL_')) {
            // Replace "KEY" or 'KEY' with VALUE
            const regex = new RegExp(`["']${key}["']`, 'g');
            formattedTemplate = formattedTemplate.replace(regex, value);
            // Fallback for bare key
            formattedTemplate = formattedTemplate.replace(key, value);
        } else {
            formattedTemplate = formattedTemplate.replace(key, value);
        }
    });

    // Combine
    if (frontmatterFormatted) {
        // Ensure separation
        return `${frontmatterFormatted}\n\n${formattedTemplate.trim()}`;
    }
    return formattedTemplate;
}
