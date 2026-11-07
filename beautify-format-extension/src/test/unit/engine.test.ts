import * as assert from 'assert';
import { formatFragment, formatText } from '../../engine';
import { FormatError } from '../../formatters/result';

const indent = { tabSize: 2, insertSpaces: true };

describe('engine', () => {
    it('dispatches by format', () => {
        assert.strictEqual(formatText('json', '{"a":1}', indent, 'json').text, '{ "a": 1 }');
        assert.strictEqual(formatText('xml', '<a><b>x</b></a>', indent, 'xml').text, '<a><b>x</b></a>');
        assert.strictEqual(formatText('sql', 'select a from t;', indent, 'sql').text, 'select\n  a\nfrom\n  t;');
    });

    it('rejects unknown formats', () => {
        assert.throws(() => formatText('unknown', 'hello', indent, 'plaintext'), FormatError);
    });

    it('passes settings through', () => {
        const settings = { sortAttributes: true, sqlDialect: 'auto', sqlKeywordCase: 'upper' as const };
        assert.strictEqual(formatText('xml', '<r z="1" id="2"/>', indent, 'xml', settings).text, '<r id="2" z="1" />');
        assert.strictEqual(formatText('sql', 'select a from t;', indent, 'sql', settings).text, 'SELECT\n  a\nFROM\n  t;');
    });
});

describe('formatting a selection', () => {
    it('keeps the indentation of the selected lines', () => {
        const fragment = '    begin\n    x := 1; end;';
        assert.strictEqual(formatFragment('sql', fragment, indent, 'plsql').text, '    begin\n      x := 1;\n    end;');
    });

    it('formats a nested JSON value in place', () => {
        assert.strictEqual(formatFragment('json', '  {"b":[1,2]}', indent, 'json').text, '  { "b": [1, 2] }');
    });

    it('keeps a trailing newline', () => {
        assert.strictEqual(formatFragment('sql', 'select 1;\n', indent, 'sql').text, 'select\n  1;\n');
    });
});
