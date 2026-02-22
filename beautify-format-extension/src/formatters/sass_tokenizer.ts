
export interface SassLine {
    indent: number;
    content: string;
    type: 'empty' | 'comment' | 'property' | 'rule' | 'directive' | 'unknown';
    raw: string;
    isBlockStarter: boolean;
    isOptionalBlockStarter: boolean;
}

const COMMON_PROPERTIES = new Set([
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
    'user-select', 'backface-visibility', 'perspective', 'filter', 'mix-blend-mode'
]);

export function tokenizeSass(text: string): SassLine[] {
    const lines = text.split('\n');
    const result: SassLine[] = [];

    for (const line of lines) {
        if (line.trim() === '') {
            result.push({ indent: 0, content: '', type: 'empty', raw: line, isBlockStarter: false, isOptionalBlockStarter: false });
            continue;
        }

        const indentMatch = line.match(/^(\s*)/);
        const indentStr = indentMatch ? indentMatch[1] : '';
        const indent = indentStr.replace(/\t/g, '  ').length;
        const trimmed = line.trim();

        let type: SassLine['type'] = 'unknown';
        let isBlockStarter = false;
        let isOptionalBlockStarter = false;

        if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
            type = 'comment';
        } else if (trimmed.startsWith('@')) {
            type = 'directive';
            if (/^@(mixin|function|if|else|for|each|while|media|supports|keyframes|scope|layer|container)/.test(trimmed)) {
                isBlockStarter = true;
            } else if (/^@include/.test(trimmed)) {
                isOptionalBlockStarter = true;
                isBlockStarter = true;
            }
        } else if (trimmed.startsWith('$')) {
            type = 'property';
        } else if (trimmed.includes(':')) {
            const colonIndex = trimmed.indexOf(':');
            const beforeColon = trimmed.substring(0, colonIndex).trim();
            const afterColon = trimmed.substring(colonIndex + 1);

            if (afterColon.trim().length === 0) {
                 // Ends with colon -> Namespace property or Selector
                 isBlockStarter = true;
                 if (/^[a-z-]+$/.test(beforeColon) && !/^[.#&]/.test(beforeColon)) {
                     type = 'property';
                 } else {
                     type = 'rule';
                 }
            } else if (afterColon.startsWith(' ')) {
                type = 'property';
            } else {
                // No space after colon.
                if (COMMON_PROPERTIES.has(beforeColon)) {
                    type = 'property';
                } else {
                    type = 'rule';
                    isBlockStarter = true;
                }
            }
        } else {
            type = 'rule';
            isBlockStarter = true;
        }

        result.push({ indent, content: trimmed, type, raw: line, isBlockStarter, isOptionalBlockStarter });
    }

    return result;
}
