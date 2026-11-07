import { extractComments } from './formatters/json_core';

export type Format = 'json' | 'jsonc' | 'xml' | 'unknown';

/**
 * Detect format based on language ID or content
 */
export function detectFormat(text: string, languageId: string): Format {
    const lang = languageId.toLowerCase();
    if (lang === 'json') { return 'json'; }
    if (lang === 'jsonc') { return 'jsonc'; }
    if (lang === 'xml' || lang === 'xsl') { return 'xml'; }

    const trimmed = text.trim();

    // "[section]" at the start is an INI file, not a JSON array
    if (trimmed.startsWith('{') || (trimmed.startsWith('[') && !/^\s*\[[a-zA-Z0-9._-]+\]/.test(trimmed))) {
        // Real comments (not "//" inside a string such as a URL) mean JSONC
        return extractComments(trimmed).length > 0 ? 'jsonc' : 'json';
    }

    if (trimmed.startsWith('<')) {
        return 'xml';
    }

    return 'unknown';
}
