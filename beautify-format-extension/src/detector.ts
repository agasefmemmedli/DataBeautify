import { detectDelimiter, splitCSVLine } from './utils';

/**
 * Detect format based on language ID or content
 */
export function detectFormat(text: string, languageId: string): 'json' | 'jsonc' | 'xml' | 'unknown' {
    const lang = languageId.toLowerCase();
    if (lang === 'json') { return 'json'; }
    if (lang === 'jsonc') { return 'jsonc'; }
    if (lang === 'xml' || lang === 'xsl') { return 'xml'; }

    const trimmed = text.trim();

    if (trimmed.startsWith('{') || (trimmed.startsWith('[') && !/^\s*\[[a-zA-Z0-9._-]+\]/.test(trimmed))) {
        // Check if it contains comments, if so it's JSONC
        if (trimmed.includes('//') || trimmed.includes('/*')) {
            return 'jsonc';
        }
        return 'json';
    }

    if (trimmed.startsWith('<')) {
        return 'xml';
    }

    return 'unknown';
}
