// Formats every JSON / JSONC / XML / SVG file found in the given folders and checks the safety rules:
// valid files keep their data and are stable, broken copies never crash or produce invalid output.
// Usage: npm run compile && node scripts/corpus-check.cjs [folder...]   (default: node_modules)
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

function walk(dir, out) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (/\.(json|jsonc|code-snippets|xml|svg|manifest)$/i.test(e.name)) {
            try { if (fs.statSync(p).size < 300000) out.push(p); } catch { /* unreadable */ }
        }
    }
    return out;
}

const dirs = process.argv.slice(2);
const files = (dirs.length ? dirs : [path.join(root, 'node_modules')]).flatMap(d => walk(d, []));
const { formatJSON, formatJSONC, extractComments } = require(root + '/out/formatters/json_core.js');
const { formatXML, sameXML } = require(root + '/out/formatters/xml_core.js');
const { FormatError } = require(root + '/out/formatters/result.js');
const { parse: jsoncParse } = require('jsonc-parser');
const { XMLValidator } = require('fast-xml-parser');

const opts = { tabSize: 2, insertSpaces: true };

const jsoncErrs = t => { const e = []; jsoncParse(t, e, { allowTrailingComma: true }); return e.length; };
const strictOk = t => { try { JSON.parse(t); return true; } catch { return false; } };
const xmlOk = t => XMLValidator.validate(t) === true;
const jsoncSame = (a, b) => JSON.stringify(jsoncParse(a, [], { allowTrailingComma: true })) === JSON.stringify(jsoncParse(b, [], { allowTrailingComma: true }))
    && JSON.stringify(extractComments(a)) === JSON.stringify(extractComments(b));

const kinds = {
    json: { fmt: t => formatJSON(t, opts), valid: strictOk, same: (a, b) => JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(b)) },
    jsonc: { fmt: t => formatJSONC(t, opts), valid: t => jsoncErrs(t) === 0, same: jsoncSame },
    jsonInJsonFile: { fmt: t => formatJSON(t, opts), valid: t => jsoncErrs(t) === 0, same: jsoncSame },
    xml: { fmt: t => formatXML(t, { ...opts, sortAttributes: false }), valid: xmlOk, same: sameXML },
};

const stats = {};
const problems = [];
let seed = 12345;
const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };

function check(kind, file, text, mutated) {
    const k = kinds[kind];
    const s = stats[kind + (mutated ? ' (broken)' : '')] ??= { files: 0, ok: 0, refused: 0, repaired: 0, confirm: 0, slowest: 0 };
    s.files++;
    const t0 = Date.now();
    let r;
    try {
        r = k.fmt(text);
    } catch (e) {
        if (e instanceof FormatError) {
            s.refused++;
            if (!mutated) problems.push(`[${kind}] valid file refused: ${file}: ${e.message}`);
            return;
        }
        problems.push(`[${kind}] CRASH ${mutated ? '(broken) ' : ''}${file}: ${e.stack.split('\n').slice(0, 2).join(' ')}`);
        return;
    }
    const ms = Date.now() - t0;
    if (ms > s.slowest) { s.slowest = ms; s.slowestFile = file; }
    if (!k.valid(r.text)) { problems.push(`[${kind}] INVALID OUTPUT ${mutated ? '(broken) ' : ''}${file}`); return; }
    if (r.repaired) s.repaired++;
    if (r.needsConfirmation) s.confirm++;
    if (!mutated) {
        if (r.repaired) problems.push(`[${kind}] valid file marked repaired: ${file}`);
        if (!k.same(text, r.text)) { problems.push(`[${kind}] DATA CHANGED: ${file}`); return; }
    }
    let again;
    try { again = k.fmt(r.text).text; } catch (e) { problems.push(`[${kind}] second run failed ${file}: ${e.message}`); return; }
    if (again !== r.text) { problems.push(`[${kind}] NOT STABLE ${mutated ? '(broken) ' : ''}${file}`); return; }
    s.ok++;
}

function mutate(text, kind) {
    const chars = kind === 'xml' ? '<>/"=\' ' : '{}[],:"\' ';
    let t = text;
    for (let i = 0; i < 1 + rnd(3); i++) {
        const p = rnd(t.length);
        t = rnd(2) ? t.slice(0, p) + t.slice(p + 1) : t.slice(0, p) + chars[rnd(chars.length)] + t.slice(p);
    }
    return t;
}

for (const file of files) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    if (text.includes('\u0000') || text.length > 300000) continue; // UTF-16 or huge
    text = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
    if (!text.trim()) continue;

    let kind;
    if (/\.(json|jsonc|code-snippets)$/i.test(file)) {
        if (strictOk(text)) kind = 'json';
        else if (jsoncErrs(text) === 0) kind = 'jsonc';
        else continue; // not JSON at all (templates etc.)
    } else {
        if (!xmlOk(text)) continue;
        kind = 'xml';
    }

    check(kind, file, text, false);
    if (kind === 'jsonc') check('jsonInJsonFile', file, text, false);
    if (rnd(4) === 0) {
        const broken = mutate(text, kind);
        if (kind === 'xml' ? !xmlOk(broken) : jsoncErrs(broken) > 0) check(kind, file, broken, true);
    }
}

console.log(JSON.stringify(stats, null, 1));
console.log(`\n${problems.length} problems`);
const byType = {};
for (const p of problems) { const key = p.replace(/:.*$/, '').replace(/ C:.*| \/.*/, ''); (byType[key] ??= []).push(p); }
for (const [k, v] of Object.entries(byType)) { console.log(`\n== ${k}: ${v.length}`); v.slice(0, 4).forEach(x => console.log('  ' + x.slice(0, 300))); }
process.exitCode = problems.length ? 1 : 0;
