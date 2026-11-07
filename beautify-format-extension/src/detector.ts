import { extractComments } from './formatters/json_core';

export type Format = 'json' | 'jsonc' | 'xml' | 'sql' | 'unknown';

// Language ids used by VS Code and popular SQL extensions
const SQL_LANGUAGES = new Set([
    'sql', 'plsql', 'oraclesql', 'oracle-sql', 'oracle', 'pgsql', 'postgres', 'postgresql', 'mysql', 'mariadb',
    'tsql', 'mssql', 'sqlite', 'snowflake', 'bigquery', 'redshift',
]);

const SQL_START = /^(\s*(--[^\n]*|\/\*[\s\S]*?\*\/))*\s*(SELECT|INSERT|UPDATE|DELETE|MERGE|WITH|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|DECLARE|BEGIN|SET\s+SERVEROUTPUT)\b/i;

/**
 * Detect format based on language ID or content
 */
export function detectFormat(text: string, languageId: string): Format {
    const lang = languageId.toLowerCase();
    if (lang === 'json') { return 'json'; }
    if (lang === 'jsonc') { return 'jsonc'; }
    if (lang === 'xml' || lang === 'xsl') { return 'xml'; }
    if (SQL_LANGUAGES.has(lang)) { return 'sql'; }

    const trimmed = text.trim();

    // "[section]" at the start is an INI file, not a JSON array
    if (trimmed.startsWith('{') || (trimmed.startsWith('[') && !/^\s*\[[a-zA-Z0-9._-]+\]/.test(trimmed))) {
        // Real comments (not "//" inside a string such as a URL) mean JSONC
        return extractComments(trimmed).length > 0 ? 'jsonc' : 'json';
    }

    if (trimmed.startsWith('<')) {
        return 'xml';
    }

    if (SQL_START.test(trimmed)) {
        return 'sql';
    }

    return 'unknown';
}
