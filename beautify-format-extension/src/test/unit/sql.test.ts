import * as assert from 'assert';
import { formatSQL, looksLikePlsql, resolveDialect, sameTokens } from '../../formatters/sql_core';
import { FormatError } from '../../formatters/result';
import { detectFormat } from '../../detector';

const opts = { tabSize: 2, insertSpaces: true, keywordCase: 'preserve' as const };
const plsql = (text: string) => formatSQL(text, { ...opts, dialect: 'plsql' }).text;
const sql = (text: string, dialect = 'auto') => formatSQL(text, { ...opts, dialect }).text;

describe('SQL', () => {
    it('formats a query', () => {
        assert.strictEqual(sql('select a, count(*) as n from t where x = 1 group by a;'), [
            'select',
            '  a,',
            '  count(*) as n',
            'from',
            '  t',
            'where',
            '  x = 1',
            'group by',
            '  a;',
        ].join('\n'));
    });

    it('keeps "name(" without a space for functions sql-formatter does not know', () => {
        assert.ok(sql('select lag(x) over (order by y) from t;').includes('lag(x)'));
    });

    it('keeps strings, quoted names and comments exactly', () => {
        const input = `select "Weird  Name", 'a  b' -- note\nfrom t; /* block\n   comment */`;
        assert.ok(sameTokens(input, sql(input), 'sql', false));
        assert.ok(sql(input).includes(`'a  b' -- note`));
    });

    it('supports PostgreSQL, MySQL and T-SQL syntax in auto mode', () => {
        assert.ok(sql("select x::int, data->>'k' from t where y = $1;").includes('x::int'));
        assert.ok(sql("select `name` from t where s = 'it\\'s';").includes("'it\\'s'"));
        assert.ok(sql('select top 10 [Name], @v from dbo.T;').includes('[Name]'));
    });

    it('changes keyword case only when asked', () => {
        const upper = formatSQL('select a from t;', { ...opts, keywordCase: 'upper', dialect: 'sql' }).text;
        assert.strictEqual(upper, 'SELECT\n  a\nFROM\n  t;');
    });

    it('refuses SQL it cannot parse instead of guessing', () => {
        assert.throws(() => sql("select 'unterminated from t", 'sql'), FormatError);
    });
});

describe('PL/SQL', () => {
    it('indents blocks, IF, LOOP and EXCEPTION', () => {
        const input = 'declare v number := 0; begin if v > 0 then v := 1; elsif v < 0 then v := -1; else null; end if; '
            + 'for i in 1 .. 3 loop v := v + i; end loop; exception when others then raise; end;';
        assert.strictEqual(plsql(input), [
            'declare',
            '  v number := 0;',
            'begin',
            '  if v > 0 then',
            '    v := 1;',
            '  elsif v < 0 then',
            '    v := -1;',
            '  else',
            '    null;',
            '  end if;',
            '  for i in 1 .. 3 loop',
            '    v := v + i;',
            '  end loop;',
            'exception',
            '  when others then',
            '    raise;',
            'end;',
        ].join('\n'));
    });

    it('formats procedures with SQL inside', () => {
        const out = plsql('create or replace procedure p(x number) is n number; begin select count(*) into n from t where id = x; end p;\n/');
        assert.strictEqual(out, [
            'create or replace procedure p(x number) is',
            '  n number;',
            'begin',
            '  select',
            '    count(*) into n',
            '  from',
            '    t',
            '  where',
            '    id = x;',
            'end p;',
            '/',
        ].join('\n'));
    });

    it('puts trigger clauses on their own lines', () => {
        const out = plsql('create trigger trg before insert on t for each row begin :new.id := 1; end;\n/');
        assert.strictEqual(out, 'create trigger trg\n  before insert on t\n  for each row\nbegin\n  :new.id := 1;\nend;\n/');
    });

    it('keeps CASE statements, labels and q-quoted strings', () => {
        const out = plsql("begin <<outer>> case v when 1 then x := q'[it's]'; else null; end case; end;");
        assert.strictEqual(out, [
            'begin',
            '  <<outer>>',
            '  case v',
            '    when 1 then',
            "      x := q'[it's]';",
            '    else',
            '      null;',
            '  end case;',
            'end;',
        ].join('\n'));
    });

    it('breaks long calls into one argument per line', () => {
        const out = plsql("begin dbms_stats.gather_table_stats(ownname => user, tabname => 'ORDERS', estimate_percent => 10, cascade => true); end;");
        assert.strictEqual(out, [
            'begin',
            '  dbms_stats.gather_table_stats(',
            '    ownname => user,',
            "    tabname => 'ORDERS',",
            '    estimate_percent => 10,',
            '    cascade => true',
            '  );',
            'end;',
        ].join('\n'));
    });

    it('keeps SQL*Plus commands on their own lines, but not EXIT inside a block', () => {
        const input = 'set serveroutput on\nbegin loop exit; end loop; end;\n/\nshow errors\nexit';
        assert.strictEqual(plsql(input), [
            'set serveroutput on',
            'begin',
            '  loop',
            '    exit;',
            '  end loop;',
            'end;',
            '/',
            'show errors',
            'exit',
        ].join('\n'));
    });

    it('keeps end-of-line comments on their line', () => {
        assert.strictEqual(plsql('begin\n  x := 1; -- one\n  y := 2;\nend;'), 'begin\n  x := 1; -- one\n  y := 2;\nend;');
    });

    it('does not re-indent lines inside multi-line strings', () => {
        const input = "begin\nv := 'line1\n   line2';\nend;";
        assert.strictEqual(plsql(input), "begin\n  v := 'line1\n   line2';\nend;");
    });
});

describe('SQL dialect detection', () => {
    it('recognizes PL/SQL', () => {
        assert.ok(looksLikePlsql('declare v emp.id%TYPE; begin null; end;'));
        assert.ok(looksLikePlsql('begin dbms_output.put_line(1); end;\n/'));
        assert.ok(!looksLikePlsql('select * from t;'));
        assert.ok(!looksLikePlsql('CREATE PROCEDURE p AS BEGIN DECLARE @x int; SET @x = 1; END'));
    });

    it('uses the language id and the setting', () => {
        assert.strictEqual(resolveDialect('auto', 'plsql', 'select 1;'), 'plsql');
        assert.strictEqual(resolveDialect('auto', 'sql', 'select 1;'), 'auto');
        assert.strictEqual(resolveDialect('mysql', 'plsql', 'select 1;'), 'mysql');
    });

    it('detects SQL files by language id or content', () => {
        assert.strictEqual(detectFormat('anything', 'sql'), 'sql');
        assert.strictEqual(detectFormat('anything', 'plsql'), 'sql');
        assert.strictEqual(detectFormat('-- c\nSELECT 1', 'plaintext'), 'sql');
        assert.strictEqual(detectFormat('selection of words', 'plaintext'), 'unknown');
    });
});
