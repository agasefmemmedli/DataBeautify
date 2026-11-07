import * as assert from 'assert';
import { formatXML, sameXML } from '../../formatters/xml_core';
import { FormatError } from '../../formatters/result';

const opts = { tabSize: 2, insertSpaces: true, sortAttributes: false };

describe('XML', () => {
    it('indents nested elements', () => {
        const input = '<root><item id="1">first item with a fairly long text</item><item id="2">second item, also long</item></root>';
        assert.strictEqual(formatXML(input, opts).text, [
            '<root>',
            '  <item id="1">first item with a fairly long text</item>',
            '  <item id="2">second item, also long</item>',
            '</root>',
        ].join('\n'));
    });

    it('keeps backslashes in attribute values (Windows paths)', () => {
        const r = formatXML(String.raw`<cfg><dir path="C:\temp\" mode="rw"/></cfg>`, opts);
        assert.strictEqual(r.text, String.raw`<cfg><dir path="C:\temp\" mode="rw" /></cfg>`);
    });

    it('keeps whitespace inside xml:space="preserve"', () => {
        const input = '<root><text xml:space="preserve">  line one\n    indented</text><b>x</b></root>';
        assert.strictEqual(formatXML(input, opts).text, [
            '<root>',
            '  <text xml:space="preserve">  line one',
            '    indented</text>',
            '  <b>x</b>',
            '</root>',
        ].join('\n'));
    });

    it('keeps attribute order by default', () => {
        assert.strictEqual(formatXML('<r z="1" a="2" id="3"/>', opts).text, '<r z="1" a="2" id="3" />');
    });

    it('sorts attributes when enabled', () => {
        assert.strictEqual(formatXML('<r z="1" a="2" id="3"/>', { ...opts, sortAttributes: true }).text, '<r id="3" a="2" z="1" />');
    });

    it('escapes double quotes from single-quoted values', () => {
        assert.strictEqual(formatXML(`<r a='say "hi"'/>`, opts).text, '<r a="say &quot;hi&quot;" />');
    });

    it('keeps declaration, comments and CDATA', () => {
        const input = '<?xml version="1.0"?>\n<!-- c --><r><![CDATA[ a < b ]]></r>';
        const out = formatXML(input, opts).text;
        assert.ok(out.startsWith('<?xml version="1.0"?>'));
        assert.ok(out.includes('<!-- c -->'));
        assert.ok(out.includes('<![CDATA[ a < b ]]>'));
    });

    it('fixes broken XML only when the result is valid, and reports it', () => {
        const r = formatXML('<a><b></a>', opts);
        assert.strictEqual(r.repaired, true);
        assert.strictEqual(r.needsConfirmation, true);
        assert.match(r.issue!, /closing tag/);
    });

    it('refuses to format XML it cannot fix', () => {
        assert.throws(() => formatXML('<<>>', opts), FormatError);
    });
});

describe('sameXML', () => {
    it('ignores layout whitespace and attribute order', () => {
        assert.ok(sameXML('<a x="1" y="2"><b>t</b></a>', '<a y="2" x="1">\n  <b>t</b>\n</a>'));
    });

    it('detects changed text and attributes', () => {
        assert.ok(!sameXML('<a>x</a>', '<a>y</a>'));
        assert.ok(!sameXML('<a b="1"/>', '<a b="2"/>'));
    });
});
