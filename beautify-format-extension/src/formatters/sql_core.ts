import { format as sqlFormat, SqlLanguage } from 'sql-formatter';
import { formatPlsqlCode, KeywordCase } from './plsql_formatter';
import { joinCreateOrReplace, lexOptionsFor, lexSQL, restoreTightParens, tokenSignature } from './sql_lexer';
import { FormatError, FormatResult, IndentOptions } from './result';

export const SQL_DIALECTS = [
    'sql', 'plsql', 'postgresql', 'mysql', 'mariadb', 'transactsql', 'sqlite', 'bigquery', 'snowflake',
    'redshift', 'db2', 'db2i', 'hive', 'spark', 'trino', 'n1ql', 'singlestoredb', 'tidb', 'duckdb', 'clickhouse',
] as const;

export interface SQLOptions extends IndentOptions {
    // 'auto' or one of SQL_DIALECTS
    dialect: string;
    keywordCase: KeywordCase;
}

// VS Code language ids of popular SQL extensions
const LANGUAGE_DIALECTS: Record<string, string> = {
    plsql: 'plsql', oraclesql: 'plsql', 'oracle-sql': 'plsql', oracle: 'plsql',
    pgsql: 'postgresql', postgres: 'postgresql', postgresql: 'postgresql',
    mysql: 'mysql', mariadb: 'mariadb', tsql: 'transactsql', mssql: 'transactsql',
    sqlite: 'sqlite', snowflake: 'snowflake', bigquery: 'bigquery', redshift: 'redshift',
};

// Dialects tried in order when the dialect is 'auto' and the code is not PL/SQL
const AUTO_DIALECTS = ['sql', 'postgresql', 'mysql', 'transactsql', 'plsql'];

export function resolveDialect(setting: string, languageId: string, text: string): string {
    if (setting && setting !== 'auto') return setting;
    const fromLanguage = LANGUAGE_DIALECTS[languageId.toLowerCase()];
    if (fromLanguage) return fromLanguage;
    return looksLikePlsql(text) ? 'plsql' : 'auto';
}

export function looksLikePlsql(text: string): boolean {
    const otherDialect = /@\w|\$\$|\bLANGUAGE\s+plpgsql\b|^\s*GO\s*$|\bNVARCHAR\b|\bTOP\s+\d/im;
    if (otherDialect.test(text)) return false;
    const strong = /%(ROW)?TYPE\b|\bDBMS_\w+|\bPACKAGE\s+BODY\b|\bVARCHAR2\b|\bFROM\s+DUAL\b|^\s*\/\s*$|\bELSIF\b|\bEXCEPTION\s+WHEN\b|\bSYSDATE\b|\bNVL\s*\(/im;
    if (strong.test(text)) return true;
    return /\bBEGIN\b[\s\S]*\bEND\s*;/i.test(text) && /:=/.test(text);
}

/**
 * Format SQL. Only whitespace and (if asked) keyword case may change: the result is
 * compared token by token with the input and rejected otherwise.
 */
export function formatSQL(text: string, opts: SQLOptions): FormatResult {
    const dialects = opts.dialect === 'auto' ? AUTO_DIALECTS : [opts.dialect];
    let firstError: string | undefined;

    for (const dialect of dialects) {
        let out: string;
        try {
            out = dialect === 'plsql' ? formatPlsqlScript(text, opts) : formatWithLibrary(text, dialect, opts);
        } catch (e: any) {
            firstError ??= e?.message ?? String(e);
            continue;
        }
        if (sameTokens(text, out, dialect, opts.keywordCase !== 'preserve')) {
            return { text: out, repaired: false };
        }
        firstError ??= 'formatting would change the code';
    }
    const reason = (firstError ?? 'unknown error').split('\n')[0];
    throw new FormatError(`Could not format this SQL (${reason}). The file was not changed.`);
}

function formatWithLibrary(text: string, dialect: string, opts: SQLOptions): string {
    const out = sqlFormat(text, {
        language: dialect as SqlLanguage,
        tabWidth: opts.tabSize,
        useTabs: !opts.insertSpaces,
        keywordCase: opts.keywordCase,
    });
    // Whitespace-only touch-ups; the result is verified by the caller
    return joinCreateOrReplace(restoreTightParens(text, out, lexOptionsFor(dialect)));
}

export function sameTokens(a: string, b: string, dialect: string, ignoreWordCase: boolean): boolean {
    const lex = lexOptionsFor(dialect);
    const x = tokenSignature(a, lex, ignoreWordCase);
    const y = tokenSignature(b, lex, ignoreWordCase);
    return x.length === y.length && x.every((v, i) => v === y[i]);
}

// SQL*Plus commands are line based and must stay on their own line exactly as written
const SQLPLUS_COMMAND = /^\s*(\/\s*$|@|(SET|SHOW|PROMPT|SPOOL|WHENEVER|DEFINE|UNDEFINE|COLUMN|COL|EXEC|EXECUTE|CONNECT|CONN|REM|REMARK|TTITLE|BTITLE|BREAK|COMPUTE|VARIABLE|VAR|PAUSE|ACCEPT|CLEAR|EXIT|QUIT|START|DISCONNECT|PRINT|HOST|DESCRIBE|DESC)\b)/i;
// SQL statements that start with the same words as SQL*Plus commands
const SQL_STARTING_LIKE_COMMAND = /^\s*SET\s+(TRANSACTION|ROLE|CONSTRAINTS?)\b/i;

// Starts a PL/SQL block. Like SQL*Plus, everything up to a "/" line then belongs to the block
// (so EXIT; or EXECUTE IMMEDIATE inside it are code, not commands).
const PLSQL_BLOCK_START = /^\s*(DECLARE|BEGIN|CREATE\s+(OR\s+REPLACE\s+)?((NON)?EDITIONABLE\s+)?(PROCEDURE|FUNCTION|PACKAGE|TRIGGER|TYPE)\b)/i;

/**
 * Split a script into code and SQL*Plus command lines. A line is a command only between
 * statements (start of file, after ";" or "/"), outside PL/SQL blocks, strings and comments.
 */
function formatPlsqlScript(text: string, opts: SQLOptions): string {
    const tokens = lexSQL(text, lexOptionsFor('plsql'));
    const insideToken = (offset: number) => tokens.some(t => t.start < offset && offset < t.end);

    const parts: string[] = [];
    let code = '';
    let inBlock = false;
    let offset = 0;

    // Keep one blank line where the source had blank lines between parts
    const flush = () => {
        const leadingBlank = /^[ \t]*\n/.test(code);
        if (leadingBlank && parts.length && parts[parts.length - 1] !== '') parts.push('');
        if (code.trim()) {
            parts.push(formatPlsqlCode(code, opts));
            if (/\n[ \t]*\n\s*$/.test(code)) parts.push('');
        }
        code = '';
    };

    for (const line of text.split('\n')) {
        const lineStart = offset;
        offset += line.length + 1;

        if (insideToken(lineStart)) {
            code += line + '\n';
            continue;
        }
        if (inBlock) {
            if (/^\s*\/\s*$/.test(line)) {
                flush();
                parts.push(line.trim());
                inBlock = false;
            } else {
                code += line + '\n';
            }
            continue;
        }

        const before = code.replace(/--[^\n]*$/gm, '').trim();
        const atBoundary = before === '' || before.endsWith(';');
        if (atBoundary && SQLPLUS_COMMAND.test(line) && !SQL_STARTING_LIKE_COMMAND.test(line)) {
            flush();
            parts.push(line.trimEnd());
            continue;
        }
        if (atBoundary && PLSQL_BLOCK_START.test(line)) {
            inBlock = true;
        }
        code += line + '\n';
    }
    flush();
    while (parts.length && parts[parts.length - 1] === '') parts.pop();
    return parts.join('\n');
}
