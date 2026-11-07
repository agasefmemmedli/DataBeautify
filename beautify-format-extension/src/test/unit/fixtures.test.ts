import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { parse as jsoncParse } from 'jsonc-parser';
import { XMLValidator } from 'fast-xml-parser';
import { extractComments, formatJSON, formatJSONC } from '../../formatters/json_core';
import { formatXML, sameXML } from '../../formatters/xml_core';
import { FormatError, FormatResult } from '../../formatters/result';

// Runs every file in test/fixtures through the formatter and checks the safety rules:
// valid files keep their data, results are valid, and formatting twice changes nothing.
const fixturesDir = path.resolve(__dirname, '../../../test/fixtures');
const opts = { tabSize: 2, insertSpaces: true };

function run(file: string, text: string): FormatResult | FormatError {
    const ext = path.extname(file);
    try {
        if (ext === '.json') return formatJSON(text, opts);
        if (ext === '.jsonc') return formatJSONC(text, opts);
        return formatXML(text, { ...opts, sortAttributes: false });
    } catch (e) {
        assert.ok(e instanceof FormatError, `${file}: unexpected error ${e}`);
        return e;
    }
}

function isValid(file: string, text: string): boolean {
    const ext = path.extname(file);
    if (ext === '.json') {
        try { JSON.parse(text); return true; } catch { return false; }
    }
    if (ext === '.jsonc') {
        const errors: any[] = [];
        jsoncParse(text, errors, { allowTrailingComma: true });
        return errors.length === 0;
    }
    return XMLValidator.validate(text) === true;
}

function sameData(file: string, a: string, b: string): boolean {
    if (path.extname(file) === '.json') return JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(b));
    if (path.extname(file) === '.jsonc') {
        const value = (t: string) => JSON.stringify(jsoncParse(t, [], { allowTrailingComma: true }));
        return value(a) === value(b) && JSON.stringify(extractComments(a)) === JSON.stringify(extractComments(b));
    }
    return sameXML(a, b);
}

describe('fixtures', () => {
    const files = fs.readdirSync(fixturesDir).sort();

    it('has fixtures', () => {
        assert.ok(files.length > 0);
    });

    for (const file of files) {
        it(file, () => {
            const input = fs.readFileSync(path.join(fixturesDir, file), 'utf8').replace(/\r\n/g, '\n');
            const result = run(file, input);
            if (result instanceof FormatError) {
                assert.ok(!isValid(file, input), `${file}: a valid file was refused: ${result.message}`);
                return;
            }

            assert.ok(isValid(file, result.text), `${file}: output is not valid`);
            if (isValid(file, input)) {
                assert.strictEqual(result.repaired, false);
                assert.ok(sameData(file, input, result.text), `${file}: formatting changed the data`);
            }

            const again = run(file, result.text);
            assert.ok(!(again instanceof FormatError), `${file}: formatted output could not be formatted again`);
            assert.strictEqual(again.text, result.text, `${file}: formatting is not stable`);
        });
    }
});
