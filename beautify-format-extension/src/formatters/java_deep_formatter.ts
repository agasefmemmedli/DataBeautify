
import * as jsbeautify from 'js-beautify';

/**
 * Robust Deep Formatter for Java
 * Handles complex nesting, generics, lambdas, streams, and specific Java 14+ syntax.
 */
export function formatJavaDeep(text: string): string {
    // --- PRE-PROCESSING ---
    const masks: string[] = [];
    const maskPrefix = '___JAVA_MASK_';

    // 1. Mask strings, chars, comments and annotations to protect them
    // Order matters: Multiline strings first, then strings, chars, comments
    // Text Blocks: """...""" (Java 15+)
    // Strings: "..."
    // Chars: '...'
    // Comments: //... or /*...*/
    // Annotations: @Identifier or @Identifier(...) - simplified
    let maskedText = text.replace(/("""[\s\S]*?""")|("(?:\\.|[^\\"])*")|('(?:\\.|[^\\'])*')|(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|(@[a-zA-Z0-9_]+(?:\([^)]*\))?)/g, (match) => {
        const placeholder = `${maskPrefix}${masks.length}___`;
        masks.push(match);
        return placeholder;
    });

    // 2. Normalize Java Syntax for js-beautify
    // Lambda Arrow ->
    maskedText = maskedText.replace(/->/g, '___ARROW___');
    // Method Reference ::
    maskedText = maskedText.replace(/::/g, '___METHOD_REF___');
    // Ellipsis ... (varargs)
    maskedText = maskedText.replace(/\.\.\./g, '___ELLIPSIS___');

    // --- CORE FORMATTING ---
    // Use js-beautify as the resilient engine
    let beautified = jsbeautify.js(maskedText, {
        indent_size: 4,
        indent_char: ' ',
        max_preserve_newlines: 2,
        preserve_newlines: true,
        keep_array_indentation: false,
        break_chained_methods: false,
        brace_style: 'collapse',
        space_before_conditional: true,
        unescape_strings: false,
        jslint_happy: false,
        end_with_newline: false,
        wrap_line_length: 0,
        comma_first: false,
        e4x: true,
        indent_empty_lines: false
    });

    // --- POST-PROCESSING ---

    // Restore Operators
    beautified = beautified.replace(/\s*___ARROW___\s*/g, ' -> ');
    beautified = beautified.replace(/\s*___METHOD_REF___\s*/g, '::');
    beautified = beautified.replace(/\s*___ELLIPSIS___\s*/g, '...');

    // Fix Generics: List < String > -> List<String>
    // Iterative approach for nested generics
    for (let k = 0; k < 3; k++) {
        beautified = beautified.replace(/\b([a-zA-Z0-9_]+)\s*<\s+([^>]+?)\s+>(?=\s*[>(\w:,\*&;\[\{=\.])?/g, (match: string, id: string, content: string) => {
             // Heuristic: content shouldn't contain blocks or comparison operators
             if (/[{}=;]/.test(content) || /&&|\|\||==|!=|<=|>=/.test(content)) return match;
             return `${id}<${content.trim()}>`;
        });
    }

    // Fix Diamond Operator: < > -> <>
    beautified = beautified.replace(/<\s+>/g, '<>');

    // Fix Try-with-resources spacing: try ( Stream s = ... ) -> try (Stream s = ...)
    // js-beautify handles 'try' well but might add spaces inside parens if treated as condition
    beautified = beautified.replace(/try\s*\(\s+/g, 'try (');
    beautified = beautified.replace(/\s+\)\s*\{/g, ') {'); // Closing paren of try/if/while

    // Fix synchronized block: synchronized ( obj ) -> synchronized (obj)
    beautified = beautified.replace(/synchronized\s*\(\s+/g, 'synchronized (');

    // Fix Switch Expression arrow case: case VALUE -> ...
    beautified = beautified.replace(/case\s+([a-zA-Z0-9_]+)\s*->/g, 'case $1 ->');

    // Fix Array brackets: String [ ] -> String[]
    beautified = beautified.replace(/\[\s+\]/g, '[]');

    // Restore Masks
    let finalFormatted = beautified.replace(new RegExp(`${maskPrefix}(\\d+)___`, 'g'), (_: string, index: string) => {
        return masks[parseInt(index)];
    });

    return finalFormatted;
}
