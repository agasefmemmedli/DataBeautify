import { formatMarkdownDeep } from './markdown_deep_formatter';

/**
 * Format MDX Deep (Fallback)
 *
 * This strategy masks JSX blocks and Frontmatter, passes the content to the
 * Markdown Deep Formatter, and then unmasks and formats the JSX blocks using js-beautify.
 */
export function formatMDXDeep(text: string): string {
    const masks: string[] = [];
    const maskPrefix = '___MDX_MASK_';

    // 1. Mask Frontmatter
    let maskedText = text.replace(/^---[\s\S]*?---/, (match) => {
        const placeholder = `${maskPrefix}FM_${masks.length}___`;
        masks.push(match);
        return placeholder;
    });

    // 2. Mask JSX Blocks
    // We scan line by line to identify JSX blocks.
    const lines = maskedText.split('\n');
    const processedLines: string[] = [];
    let inJsxBlock = false;
    let jsxBuffer: string[] = [];

    // Helper to detect if a line starts a JSX block
    // Starts with <Tag, not <!--, not <http (autolink)
    // MDX: <Component ...> or <div ...>
    // Also export/import statements should be masked or preserved
    const isJsxStart = (line: string) => {
        const trimmed = line.trim();
        return /^\s*<[a-zA-Z][^>]*>/.test(trimmed) ||
               /^\s*<[a-zA-Z][^>]*$/.test(trimmed) ||
               /^\s*<>/.test(trimmed); // Fragment
    };

    const isImportExport = (line: string) => {
        const trimmed = line.trim();
        return /^(import|export)\s/.test(trimmed);
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // If we are already in a code block, formatMarkdownDeep will handle it.
        // But we need to make sure we don't start JSX detection inside a code block.
        // This is tricky because we are pre-processing.
        // Ideally formatMarkdownDeep should handle the masking, but we want to intercept JSX.
        // Let's rely on a simplified check for code fences to avoid masking inside code blocks.

        // ... (We would need to track code blocks to be safe, but let's assume JSX blocks are top-level for now)

        if (inJsxBlock) {
            jsxBuffer.push(line);
            // Check for end of JSX block
            // Heuristic: If line closes the tag or we have balanced tags?
            // Validating JSX nesting is hard.
            // For now, let's assume if it looks like a markdown header or list item, it breaks the block?
            // No, JSX can contain markdown.
            // Better heuristic: Consume until we see a closing tag that balances?
            // Or just consume until we hit a blank line followed by non-JSX?

            // Let's try a balance counter
            // (Simple version)
            const openTags = (jsxBuffer.join('\n').match(/<[a-zA-Z][a-zA-Z0-9]*(\s[^>]*)?>/g) || []).filter(t => !t.endsWith('/>')).length;
            const closeTags = (jsxBuffer.join('\n').match(/<\/[a-zA-Z][a-zA-Z0-9]*>/g) || []).length;

            if (openTags === closeTags && openTags > 0) {
                // Balanced
                const placeholder = `${maskPrefix}JSX_${masks.length}___`;
                masks.push(jsxBuffer.join('\n'));
                processedLines.push(placeholder);
                inJsxBlock = false;
                jsxBuffer = [];
            } else if (line.trim() === '' && openTags === closeTags) {
                // Empty line and balanced (maybe we missed the balance point or it was self closing lines)
                 const placeholder = `${maskPrefix}JSX_${masks.length}___`;
                masks.push(jsxBuffer.join('\n'));
                processedLines.push(placeholder);
                inJsxBlock = false;
                jsxBuffer = [];
            }
            continue;
        }

        if (isImportExport(line)) {
            const placeholder = `${maskPrefix}IMP_${masks.length}___`;
            masks.push(line);
            processedLines.push(placeholder);
            continue;
        }

        if (isJsxStart(line) && !line.trim().startsWith('```')) {
            inJsxBlock = true;
            jsxBuffer.push(line);

            // Check if single line self-closing or balanced
             const openTags = (line.match(/<[a-zA-Z][a-zA-Z0-9]*(\s[^>]*)?>/g) || []).filter(t => !t.endsWith('/>')).length;
             const closeTags = (line.match(/<\/[a-zA-Z][a-zA-Z0-9]*>/g) || []).length;
             const selfClosing = (line.match(/<[a-zA-Z][^>]*\/>/g) || []).length;

            if (openTags === closeTags && openTags > 0) {
                 const placeholder = `${maskPrefix}JSX_${masks.length}___`;
                masks.push(jsxBuffer.join('\n'));
                processedLines.push(placeholder);
                inJsxBlock = false;
                jsxBuffer = [];
            } else if (openTags === 0 && selfClosing > 0) {
                 const placeholder = `${maskPrefix}JSX_${masks.length}___`;
                masks.push(jsxBuffer.join('\n'));
                processedLines.push(placeholder);
                inJsxBlock = false;
                jsxBuffer = [];
            }
            continue;
        }

        processedLines.push(line);
    }

    // Flush remaining JSX buffer
    if (jsxBuffer.length > 0) {
        const placeholder = `${maskPrefix}JSX_${masks.length}___`;
        masks.push(jsxBuffer.join('\n'));
        processedLines.push(placeholder);
    }

    maskedText = processedLines.join('\n');

    // 3. Format Markdown
    let formattedMarkdown = formatMarkdownDeep(maskedText);

    // 4. Unmask and Format JSX
    const jsBeautify = require('js-beautify');

    // We capture leading whitespace (indentation) applied by the Markdown formatter
    formattedMarkdown = formattedMarkdown.replace(new RegExp(`([ \\t]*)${maskPrefix}(FM|JSX|IMP)_(\\d+)___`, 'g'), (match, indent, type, index) => {
        let content = masks[parseInt(index)];

        if (type === 'FM') {
            return content; // Return Frontmatter as is
        }

        if (type === 'IMP') {
            content = content.trim();
        } else if (type === 'JSX') {
            // Format JSX using js-beautify (html)
            try {
                content = jsBeautify.html(content, {
                    indent_size: 2,
                    indent_char: ' ',
                    max_preserve_newlines: 1,
                    preserve_newlines: true,
                    indent_scripts: 'keep',
                    end_with_newline: false,
                    wrap_line_length: 80
                });
            } catch (e) {
                // Keep original if formatting fails
            }
        }

        // Apply indentation to all lines if nested
        if (indent) {
            return content.split('\n').map((line, i) => {
                // First line already has indentation from the match replacement context if we return just text?
                // Wait, replace substitutes the *entire match* (including indent).
                // So we need to return `indent + line` for the first line?
                // No, if we return `indent + content`, the indent is duplicated for the first line?
                // The regex matches `(indent)PLACEHOLDER`.
                // We return replacement.
                // So we should return `indent + line` for ALL lines.
                return indent + line;
            }).join('\n');
        }

        return content;
    });

    return formattedMarkdown;
}
