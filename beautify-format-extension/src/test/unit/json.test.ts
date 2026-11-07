import * as assert from 'assert';
import { formatJSON, formatJSONC } from '../../formatters/json_core';
import { FormatError } from '../../formatters/result';
import { detectFormat } from '../../detector';

const opts = { tabSize: 2, insertSpaces: true };

describe('JSON', () => {
    it('keeps short structures on one line', () => {
        const r = formatJSON('{"a":1,"b":[1,2,3],"c":{"d":"http://x.com"}}', opts);
        assert.strictEqual(r.text, '{ "a": 1, "b": [1, 2, 3], "c": { "d": "http://x.com" } }');
        assert.strictEqual(r.repaired, false);
    });

    it('expands long structures', () => {
        const input = '{"items":[{"id":1,"name":"aaaaaaaaaaaaaaaaaaaa"},{"id":2,"name":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}]}';
        assert.strictEqual(formatJSON(input, opts).text, [
            '{',
            '  "items": [',
            '    { "id": 1, "name": "aaaaaaaaaaaaaaaaaaaa" },',
            '    { "id": 2, "name": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }',
            '  ]',
            '}',
        ].join('\n'));
    });

    it('uses tabs when insertSpaces is false', () => {
        const input = '{"a":"' + 'x'.repeat(80) + '"}';
        assert.strictEqual(formatJSON(input, { tabSize: 4, insertSpaces: false }).text, `{\n\t"a": "${'x'.repeat(80)}"\n}`);
    });

    it('does not lose precision of big numbers', () => {
        assert.strictEqual(formatJSON('{"id":12345678901234567890}', opts).text, '{ "id": 12345678901234567890 }');
    });

    it('keeps comments in a .json file instead of deleting them', () => {
        const r = formatJSON('{\n  // note\n  "a": 1, /* x */ "b": 2,\n}', opts);
        assert.strictEqual(r.text, '{\n  // note\n  "a": 1,\n  /* x */\n  "b": 2\n}');
        assert.strictEqual(r.repaired, false);
    });

    describe('broken input', () => {
        it('fixes a missing colon and reports it', () => {
            const r = formatJSON('{"key" "value"}', opts);
            assert.strictEqual(r.text, '{ "key": "value" }');
            assert.strictEqual(r.repaired, true);
            assert.match(r.issue!, /line 1, column 8/);
        });

        it('quotes non-Latin unquoted keys correctly', () => {
            const r = formatJSON('{ключ: 1}', opts);
            assert.strictEqual(r.text, '{ "ключ": 1 }');
            assert.strictEqual(r.repaired, true);
        });

        it('closes unclosed brackets, but asks first', () => {
            const r = formatJSON('{"a": [1, 2', opts);
            assert.strictEqual(r.text, '{ "a": [1, 2] }');
            assert.strictEqual(r.needsConfirmation, true);
        });

        it('converts single-quoted strings', () => {
            assert.strictEqual(formatJSON(String.raw`{'a':'it\'s'}`, opts).text, `{ "a": "it's" }`);
        });

        it('always produces valid JSON when it reports success', () => {
            for (const input of ['{"key" "value"}', '{ключ: 1}', '[1-2, 3]', '{"a":1}{"b":2}', '{a:1,,b:2}']) {
                try {
                    const r = formatJSON(input, opts);
                    assert.doesNotThrow(() => JSON.parse(r.text), `invalid output for ${input}: ${r.text}`);
                    assert.strictEqual(r.repaired, true);
                } catch (e) {
                    assert.ok(e instanceof FormatError, `unexpected error for ${input}: ${e}`);
                }
            }
        });
    });
});

describe('JSONC', () => {
    it('keeps comments and adds trailing commas', () => {
        const r = formatJSONC('{\n// c1\n"a":1,"b":[1,2],\n"c":3}', opts);
        assert.strictEqual(r.text, '{\n  // c1\n  "a": 1,\n  "b": [1, 2],\n  "c": 3,\n}');
        assert.strictEqual(r.repaired, false);
    });

    it('falls back to a safe formatter instead of corrupting a comment between key and colon', () => {
        const r = formatJSONC('{"a" /*x*/ : 1}', opts);
        assert.ok(r.text.includes('/*x*/'));
        assert.strictEqual(r.repaired, false);
    });

    it('fixes missing commas and keeps comments', () => {
        const r = formatJSONC('{"a":1 "b":2 // c\n}', opts);
        assert.strictEqual(r.text, '{\n  "a": 1,\n  "b": 2, // c\n}');
        assert.strictEqual(r.repaired, true);
        assert.ok(!r.needsConfirmation);
    });

    it('keeps an end-of-line comment on the line of its value', () => {
        const input = '{\n"a": 1, // about a\n"b": [1, 2], /* about b */\n"c": {"d": 1} // about c\n}';
        assert.strictEqual(formatJSONC(input, opts).text, [
            '{',
            '  "a": 1, // about a',
            '  "b": [1, 2], /* about b */',
            '  "c": { "d": 1 }, // about c',
            '}',
        ].join('\n'));
    });

    it('keeps end-of-line comments in arrays', () => {
        assert.strictEqual(formatJSONC('[\n1, // one\n2 // two\n]', opts).text, '[\n  1, // one\n  2, // two\n]');
    });

    it('attaches a comment followed by code on the same line to that code', () => {
        assert.strictEqual(formatJSONC('{"a": 1, /* about b */ "b": 2}', opts).text, '{\n  "a": 1,\n  /* about b */\n  "b": 2,\n}');
    });

    it('keeps comments at the end of the file', () => {
        assert.strictEqual(formatJSONC('{"a": 1} // root\n// last', opts).text, '{ "a": 1 } // root\n// last');
    });
});

describe('confirmation of guessed fixes', () => {
    it('does not ask for punctuation-only fixes', () => {
        assert.ok(!formatJSON('{"a": 1 "b": [1, 2]}', opts).needsConfirmation);
        assert.ok(!formatJSON('{"a": 1,, "b": 2}', opts).needsConfirmation);
        assert.ok(!formatJSON(String.raw`{'a': 'it\'s'}`, opts).needsConfirmation);
        assert.ok(!formatJSON('{key: 1}', opts).needsConfirmation);
    });

    it('asks when a bare word becomes a string', () => {
        const r = formatJSON('{"a": NaN}', opts);
        assert.strictEqual(r.text, '{ "a": "NaN" }');
        assert.strictEqual(r.needsConfirmation, true);
    });

    it('asks when a bracket has to be added or removed', () => {
        // An extra "{" in the middle: closing it somewhere would silently change nesting
        const r = formatJSON('{"a": 1,\n{ "b": 2,\n"c": 3}', opts);
        assert.strictEqual(r.needsConfirmation, true);
        assert.strictEqual(formatJSON('{"a": 1]', opts).needsConfirmation, true);
    });

    it('asks when an unterminated string swallows the rest of the file', () => {
        assert.strictEqual(formatJSON(`{'\n  "type": "module"\n}`, opts).needsConfirmation, true);
    });

    it('asks when jsonrepair had to guess', () => {
        const r = formatJSON('[1-2, 3]', opts);
        assert.strictEqual(r.needsConfirmation, true);
        const missingColon = formatJSON('{"key" "value"}', opts);
        assert.strictEqual(missingColon.needsConfirmation, true);
    });

    it('never asks for valid input', () => {
        assert.ok(!formatJSON('{"a": 1}', opts).needsConfirmation);
        assert.ok(!formatJSONC('{"a": 1 /* c */}', opts).needsConfirmation);
    });
});

describe('detectFormat', () => {
    it('uses the language id first', () => {
        assert.strictEqual(detectFormat('<a/>', 'json'), 'json');
        assert.strictEqual(detectFormat('{}', 'xml'), 'xml');
    });

    it('does not treat "//" inside a string as a comment', () => {
        assert.strictEqual(detectFormat('{"url": "http://x.com"}', 'plaintext'), 'json');
        assert.strictEqual(detectFormat('{"a": 1 // c\n}', 'plaintext'), 'jsonc');
    });

    it('does not mistake INI sections or plain text for JSON', () => {
        assert.strictEqual(detectFormat('[section]\nkey=value', 'plaintext'), 'unknown');
        assert.strictEqual(detectFormat('hello world', 'plaintext'), 'unknown');
    });
});
