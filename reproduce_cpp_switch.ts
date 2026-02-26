
import { formatCppDeep } from './beautify-format-extension/src/formatters/cpp_deep_formatter';

const testCase = `
switch (x) {
case 1:
stmt;
break;
default:
stmt2;
break;
}
`;

console.log('--- Original ---');
console.log(testCase);

try {
    const result = formatCppDeep(testCase);
    console.log('--- Formatted ---');
    console.log(result);

    const expected = `
switch (x) {
  case 1:
    stmt;
    break;
  default:
    stmt2;
    break;
}
`.trim();

    console.log('--- Expected (trimmed) ---');
    console.log(expected);

    if (result.trim() === expected) {
        console.log('PASS');
    } else {
        console.log('FAIL');
        // Check indentation specifically
        const lines = result.split('\n');
        const caseLine = lines.find(l => l.includes('case 1:'));
        const stmtLine = lines.find(l => l.includes('stmt;'));

        if (caseLine && stmtLine) {
            const caseIndent = caseLine.search(/\S/);
            const stmtIndent = stmtLine.search(/\S/);
            console.log(`Case indent: ${caseIndent}, Stmt indent: ${stmtIndent}`);
            if (stmtIndent <= caseIndent) {
                console.log('FAIL: Statement not indented relative to case');
            }
        }
    }
} catch (e) {
    console.error(e);
}
