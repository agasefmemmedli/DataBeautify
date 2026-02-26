import { tokenizeSass, SassLine } from './sass_tokenizer';

const STANDARD_PROPERTIES = new Set([
    'display', 'position', 'top', 'right', 'bottom', 'left', 'float', 'clear',
    'z-index', 'width', 'min-width', 'max-width', 'height', 'min-height', 'max-height',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
    'border-radius', 'background', 'background-color', 'background-image',
    'color', 'font', 'font-family', 'font-size', 'font-weight', 'line-height',
    'text-align', 'text-decoration', 'text-transform', 'white-space', 'overflow',
    'opacity', 'cursor', 'list-style', 'transform', 'transition', 'animation',
    'flex', 'flex-direction', 'flex-wrap', 'align-items', 'justify-content',
    'grid', 'gap', 'box-shadow', 'outline', 'visibility', 'content', 'pointer-events',
    'user-select', 'backface-visibility', 'perspective', 'filter', 'mix-blend-mode',
    'object-fit', 'object-position', 'resize', 'table-layout', 'empty-cells',
    'caption-side', 'border-collapse', 'border-spacing', 'box-sizing', 'quotes',
    'counter-reset', 'counter-increment', 'page-break-before', 'page-break-after',
    'page-break-inside', 'orphans', 'widows', 'font-style', 'font-variant',
    'text-indent', 'letter-spacing', 'word-spacing', 'vertical-align', 'clip',
    'clip-path', 'mask', 'mask-type', 'mask-image', 'mask-position', 'mask-size',
    'mask-repeat', 'mask-origin', 'mask-clip', 'mask-composite', 'mask-mode',
    'grid-template-columns', 'grid-template-rows', 'grid-template-areas',
    'grid-template', 'grid-auto-columns', 'grid-auto-rows', 'grid-auto-flow',
    'grid-column-start', 'grid-column-end', 'grid-row-start', 'grid-row-end',
    'grid-column', 'grid-row', 'grid-area', 'justify-items', 'justify-self',
    'align-content', 'align-self', 'place-content', 'place-items', 'place-self',
    'flex-flow', 'flex-grow', 'flex-shrink', 'flex-basis', 'order',
    'animation-name', 'animation-duration', 'animation-timing-function',
    'animation-delay', 'animation-iteration-count', 'animation-direction',
    'animation-fill-mode', 'animation-play-state', 'transition-property',
    'transition-duration', 'transition-timing-function', 'transition-delay',
    'transform-origin', 'transform-style', 'transform-box',
    'background-attachment', 'background-clip', 'background-origin',
    'background-position', 'background-repeat', 'background-size',
    'border-image', 'border-image-source', 'border-image-slice',
    'border-image-width', 'border-image-outset', 'border-image-repeat',
    'outline-color', 'outline-style', 'outline-width', 'outline-offset',
    'overflow-x', 'overflow-y', 'overflow-wrap', 'word-wrap', 'word-break',
    'text-overflow', 'text-shadow', 'text-justify', 'text-orientation',
    'writing-mode', 'direction', 'unicode-bidi', 'will-change', 'all',
    'appearance', 'aspect-ratio', 'backdrop-filter', 'caret-color',
    'column-count', 'column-fill', 'column-gap', 'column-rule',
    'column-rule-color', 'column-rule-style', 'column-rule-width',
    'column-span', 'column-width', 'columns', 'contain', 'content-visibility',
    'font-display', 'font-kerning', 'font-optical-sizing', 'font-stretch',
    'font-synthesis', 'font-variant-caps', 'font-variant-east-asian',
    'font-variant-ligatures', 'font-variant-numeric', 'font-variant-position',
    'hyphens', 'image-orientation', 'image-rendering', 'isolation',
    'line-break', 'list-style-image', 'list-style-position', 'list-style-type',
    'margin-block', 'margin-block-end', 'margin-block-start', 'margin-inline',
    'margin-inline-end', 'margin-inline-start', 'max-block-size',
    'max-inline-size', 'min-block-size', 'min-inline-size', 'overscroll-behavior',
    'overscroll-behavior-block', 'overscroll-behavior-inline', 'overscroll-behavior-x',
    'overscroll-behavior-y', 'padding-block', 'padding-block-end',
    'padding-block-start', 'padding-inline', 'padding-inline-end',
    'padding-inline-start', 'paint-order', 'place-content', 'place-items',
    'place-self', 'print-color-adjust', 'rotate', 'row-gap', 'ruby-align',
    'ruby-position', 'scale', 'scroll-behavior', 'scroll-margin',
    'scroll-margin-block', 'scroll-margin-block-end', 'scroll-margin-block-start',
    'scroll-margin-bottom', 'scroll-margin-inline', 'scroll-margin-inline-end',
    'scroll-margin-inline-start', 'scroll-margin-left', 'scroll-margin-right',
    'scroll-margin-top', 'scroll-padding', 'scroll-padding-block',
    'scroll-padding-block-end', 'scroll-padding-block-start', 'scroll-padding-bottom',
    'scroll-padding-inline', 'scroll-padding-inline-end', 'scroll-padding-inline-start',
    'scroll-padding-left', 'scroll-padding-right', 'scroll-padding-top',
    'scroll-snap-align', 'scroll-snap-stop', 'scroll-snap-type', 'scrollbar-color',
    'scrollbar-gutter', 'scrollbar-width', 'shape-image-threshold', 'shape-margin',
    'shape-outside', 'tab-size', 'text-combine-upright', 'text-emphasis',
    'text-emphasis-color', 'text-emphasis-position', 'text-emphasis-style',
    'text-underline-offset', 'text-underline-position', 'touch-action',
    'translate', 'user-zoom'
]);

interface BlockContext {
    indent: number;
    type: SassLine['type'] | 'root';
    isNamespace: boolean;
}

export function formatSassDeep(text: string): string {
    const lines = tokenizeSass(text);
    const formattedLines: string[] = [];

    // Stack tracks the indentation levels and types of blocks
    const stack: BlockContext[] = [{ indent: 0, type: 'root', isNamespace: false }];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.type === 'empty') {
            formattedLines.push('');
            continue;
        }

        // Special handling for comments: they shouldn't affect the stack structure
        if (line.type === 'comment') {
            // Determine print indent relative to current stack top
            let printLevel = Math.max(0, stack.length - 1);

            // If the comment is indented deeper than the current context, we indent it one level deeper
            // to align with potential future content or nested block
            if (stack.length > 0 && line.indent > stack[stack.length - 1].indent) {
                printLevel++;
            }

            const indentStr = '  '.repeat(printLevel);
            formattedLines.push(indentStr + line.content);
            continue; // Skip stack logic for comments
        }

        const prevLine = getEffectivePrevLine(lines, i);

        if (!prevLine) {
            // Reset stack if first line
            stack.length = 1; // Keep root
        } else {
            const parentContext = stack[stack.length - 1];

            // Check if we should nest
            let shouldNest = false;

            // Logic: Nest if source indent increased OR force nesting for Rule -> Property
            let forceNest = false;

            // Fault Tolerance: If Parent is a Rule/Mixin (Mandatory Block) and Child is Property,
            // we assume it belongs to the block even if indentation is messed up.
            if (prevLine.isBlockStarter && !prevLine.isOptionalBlockStarter && line.type === 'property') {
                forceNest = true;
            }

            if (forceNest || line.indent > prevLine.indent) {
                // Potential nesting
                if (prevLine.isBlockStarter) {
                    if (prevLine.type === 'property') {
                        // Parent is Property (Namespace candidate)
                        if (prevLine.isNamespace) {
                            shouldNest = true; // font: \n family: ... -> OK
                        } else {
                            // Parent is standard property (e.g. margin: 10px)
                            // Allow nesting ONLY if child is NOT a standard property (sibling)
                            if (line.type === 'property') {
                                // Check if child is likely a sibling (Standard Property or Vendor Prefix)
                                const propName = line.content.split(':')[0].trim();
                                const isVendor = propName.startsWith('-');
                                const isStandard = STANDARD_PROPERTIES.has(propName);

                                if (isVendor || isStandard) {
                                    shouldNest = false; // Treat as sibling (dedent)
                                } else {
                                    shouldNest = true; // Treat as nested namespace prop (e.g. weight inside font)
                                }
                            } else {
                                // Rule inside property?
                                // Only allow if parent is Namespace (no value) or custom property?
                                // Standard properties don't contain rules.
                                const propName = prevLine.content.split(':')[0].trim();
                                const cleanPropName = propName.replace(/^-[a-zA-Z]+-/, '');
                                if (STANDARD_PROPERTIES.has(cleanPropName) || STANDARD_PROPERTIES.has(propName)) {
                                    shouldNest = false;
                                } else {
                                    shouldNest = true;
                                }
                            }
                        }
                    } else {
                        // Parent is Rule/Directive/Mixin -> Allow nesting
                        shouldNest = true;
                    }
                }
            }

            if (shouldNest) {
                stack.push({
                    indent: line.indent,
                    type: line.type,
                    isNamespace: line.isNamespace
                });
            } else {
                // Dedent logic
                // If indent decreased, we pop.
                // If indent same, we stay.
                // If indent increased but we refused nesting (e.g. Sibling Prop), we stay (align with parent).

                if (line.indent < prevLine.indent) {
                    // Dedent: Pop until we find a level <= current line indent
                    // But we must respect the stack structure.
                    // If line.indent is 2 (level 1), we pop until stack level is 1.

                    // Simple heuristic: map indent to level? No, inconsistent source.
                    // Stack-based heuristic: Pop until stack top indent <= line.indent
                    // But stack indents are from source!

                    while (stack.length > 1 && stack[stack.length - 1].indent > line.indent) {
                        stack.pop();
                    }
                } else if (line.indent > prevLine.indent) {
                    // Increased indent but we refused nesting -> Force align with current level
                    // No push, no pop.
                }
            }
        }

        // Apply formatting
        const currentLevel = Math.max(0, stack.length - 1);
        const indentStr = '  '.repeat(currentLevel);

        let formattedContent = line.content;

        if (line.type === 'property' || line.type === 'variable') {
            formattedContent = fixPropertyFormat(formattedContent);
        }

        formattedLines.push(indentStr + formattedContent);
    }

    return formattedLines.join('\n');
}

function getEffectivePrevLine(lines: SassLine[], index: number): SassLine | null {
    for (let i = index - 1; i >= 0; i--) {
        if (lines[i].type !== 'empty' && lines[i].type !== 'comment') {
            return lines[i];
        }
    }
    return null;
}

function fixPropertyFormat(content: string): string {
    // Split key and value
    const parts = content.split(':');
    if (parts.length < 2) return content; // Not property?

    // Simple heuristic for split: find first colon that is not in quotes.
    let colonIndex = -1;
    let inQuote = false;
    let quoteChar = '';

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (inQuote) {
            if (char === quoteChar && content[i-1] !== '\\') {
                inQuote = false;
            }
        } else {
            if (char === '"' || char === "'") {
                inQuote = true;
                quoteChar = char;
            } else if (char === ':') {
                colonIndex = i;
                break;
            }
        }
    }

    if (colonIndex === -1) return content;

    const propName = content.substring(0, colonIndex).trim();
    const propValue = content.substring(colonIndex + 1).trim();

    if (propValue === '') return `${propName}:`; // Namespace property

    // Format Value
    const formattedValue = formatValue(propValue);

    return `${propName}: ${formattedValue}`;
}

function formatValue(value: string): string {
    let formatted = value;

    // 1. Shrink Hex: #aabbcc -> #abc
    formatted = formatted.replace(/#([0-9a-fA-F])\1([0-9a-fA-F])\2([0-9a-fA-F])\3\b/g, '#$1$2$3');

    // 2. Remove Zero Units: 0px -> 0
    formatted = formatted.replace(/(^|[\s(,])0(px|em|rem|%|vw|vh|pt|pc|in|cm|mm)\b/g, '$10');

    // 3. Space after comma: rgba(0,0,0) -> rgba(0, 0, 0)
    let result = '';
    let inQuote = false;
    let quoteChar = '';
    let inUrl = false;

    for (let i = 0; i < formatted.length; i++) {
        const char = formatted[i];
        if (inQuote) {
            if (char === quoteChar && formatted[i-1] !== '\\') {
                inQuote = false;
            }
            result += char;
        } else {
            if (char === '"' || char === "'") {
                inQuote = true;
                quoteChar = char;
                result += char;
            } else if (char === '(' && i >= 3 && formatted.substring(i-3, i) === 'url') {
                inUrl = true;
                result += char;
            } else if (char === ')' && inUrl) {
                inUrl = false;
                result += char;
            } else if (char === ',' && !inUrl) {
                result += ', ';
            } else {
                result += char;
            }
        }
    }

    // Cleanup double spaces created by replace
    result = result.replace(/\s+/g, ' ');
    // Fix ", " -> ", " might become ",  " if space existed
    result = result.replace(/, \s+/g, ', ');

    return result.trim();
}
