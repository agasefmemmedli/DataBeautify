// Picks the formatter for a document. No VS Code APIs here, so it can be unit tested.
import { Format, detectFormat } from './detector';
import { formatJSON, formatJSONC } from './formatters/json_core';
import { KeywordCase } from './formatters/plsql_formatter';
import { FormatError, FormatResult, IndentOptions } from './formatters/result';
import { formatSQL, resolveDialect } from './formatters/sql_core';
import { formatXML } from './formatters/xml_core';

export interface Settings {
    sortAttributes: boolean;
    sqlDialect: string;
    sqlKeywordCase: KeywordCase;
}

export const DEFAULT_SETTINGS: Settings = { sortAttributes: false, sqlDialect: 'auto', sqlKeywordCase: 'preserve' };

export const FORMAT_LABELS: Record<Exclude<Format, 'unknown'>, string> = {
    json: 'Beautify JSON',
    jsonc: 'Beautify JSONC',
    xml: 'Beautify XML',
    sql: 'Beautify SQL',
};

export function formatText(
    format: Format,
    text: string,
    indent: IndentOptions,
    languageId: string,
    settings: Settings = DEFAULT_SETTINGS,
): FormatResult {
    switch (format) {
        case 'json': return formatJSON(text, indent);
        case 'jsonc': return formatJSONC(text, indent);
        case 'xml': return formatXML(text, { ...indent, sortAttributes: settings.sortAttributes });
        case 'sql': {
            const dialect = resolveDialect(settings.sqlDialect, languageId, text);
            return formatSQL(text, { ...indent, dialect, keywordCase: settings.sqlKeywordCase });
        }
        default:
            throw new FormatError('Beautify Format supports JSON, JSONC, XML, SQL and PL/SQL. Could not detect any of them in this file.');
    }
}

/**
 * Format part of a document (a selection). The selection is expanded to whole lines by the
 * caller; its common indentation is removed before formatting and added back afterwards.
 */
export function formatFragment(
    format: Format,
    fragment: string,
    indent: IndentOptions,
    languageId: string,
    settings: Settings = DEFAULT_SETTINGS,
): FormatResult {
    const lines = fragment.split('\n');
    const base = commonIndent(lines);
    const stripped = lines.map(l => l.slice(base.length)).join('\n');
    const trailingNewline = stripped.endsWith('\n');
    const result = formatText(format, stripped.trimEnd(), indent, languageId, settings);
    const reindented = result.text.split('\n').map(l => (l ? base + l : l)).join('\n');
    return { ...result, text: reindented + (trailingNewline ? '\n' : '') };
}

function commonIndent(lines: string[]): string {
    let common: string | undefined;
    for (const line of lines) {
        if (!line.trim()) continue;
        const ws = /^[ \t]*/.exec(line)![0];
        if (common === undefined || ws.length < common.length) common = ws;
    }
    return common ?? '';
}

export { detectFormat };
