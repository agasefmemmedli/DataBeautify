const fs = require('fs');
const path = require('path');

async function runTest() {
    try {
        const formatterPath = path.join(__dirname, 'out/formatters/cpp_deep_formatter.js');
        if (!fs.existsSync(formatterPath)) {
            console.error(`Formatter not found at ${formatterPath}`);
            process.exit(1);
        }
        const { formatCppDeep } = require(formatterPath);

        const testFile = 'test.deep.cpp';
        const filePath = path.join(__dirname, testFile);
        if (!fs.existsSync(filePath)) {
            console.error(`Test file not found: ${filePath}`);
            process.exit(1);
        }

        const content = fs.readFileSync(filePath, 'utf8');
        console.log(`Testing ${testFile}...`);
        const formatted = formatCppDeep(content);

        console.log('--- Formatted Output ---');
        console.log(formatted);
        console.log('------------------------');

        const lines = formatted.split('\n');

        // Helper to find line index containing text
        const findLine = (text) => lines.findIndex(l => l.includes(text));

        // Helper to find specific declaration line
        const findDecl = (type, name) => lines.findIndex(l => l.includes(type) && l.includes(name) && l.trim().startsWith(type));

        // Assertions
        const assertIndent = (text, expectedIndent, description) => {
            const index = findLine(text);
            if (index === -1) {
                console.error(`❌ Assertion Failed: Could not find line containing "${text}"`);
                process.exit(1);
            }
            const line = lines[index];
            const actualIndent = line.search(/\S/);
            if (actualIndent !== expectedIndent) {
                console.error(`❌ Assertion Failed: "${text}" expected indent ${expectedIndent}, got ${actualIndent} ("${line}")`);
                process.exit(1);
            }
            console.log(`✅ ${description}: Indent ${actualIndent} matches expected ${expectedIndent}`);
        };

        // 1. Namespace Indentation (0 spaces)
        assertIndent('namespace Outer {', 0, 'Outer Namespace declaration');
        assertIndent('namespace Inner {', 0, 'Inner Namespace declaration (no indent relative to Outer)');

        // 2. Class Indentation (0 spaces relative to namespace, so 0 total)
        assertIndent('class MyClass {', 0, 'Class declaration');

        // 3. Access Modifier Indentation (1 space)
        assertIndent('public:', 1, 'public: access modifier');
        assertIndent('private:', 1, 'private: access modifier');

        // 4. Class Member Indentation (2 spaces)
        assertIndent('MyClass()', 2, 'Constructor declaration (start)');
        assertIndent(': m_val(0),', 6, 'Constructor init list (continuation)');
        assertIndent('m_name("default"),', 6, 'Constructor init list (continuation 2)');
        assertIndent('m_data(10) {', 6, 'Constructor init list (continuation 3)');

        // Changed to int doSomething
        assertIndent('int doSomething() {', 2, 'Method declaration');

        // 5. Function Body Indentation (4 spaces total: 2 for class + 2 for method body)
        assertIndent('if (x > 0) {', 4, 'If statement inside method');
        assertIndent('x++;', 6, 'Inside if block (4 + 2 = 6)');

        // 6. Vertical Alignment Check
        const lineX = lines[lines.findIndex(l => l.includes('int') && l.includes('x') && l.trim().startsWith('int') && !l.includes('vector'))];
        const lineY = lines[lines.findIndex(l => l.includes('double') && l.includes('y'))];
        const lineZ = lines[lines.findIndex(l => l.includes('std::string') && l.includes('z'))];
        const lineP = lines[lines.findIndex(l => l.includes('int*') && l.includes('p') && !l.includes('p2'))];
        const lineP2 = lines[lines.findIndex(l => l.includes('int*') && l.includes('p2'))];
        const lineUrl = lines[lines.findIndex(l => l.includes('std::string') && l.includes('url'))];

        const idxX = lineX.indexOf('x');
        const idxY = lineY.indexOf('y');
        const idxZ = lineZ.indexOf('z');
        const idxP = lineP.indexOf('p');
        const idxP2 = lineP2.indexOf('p2');
        const idxUrl = lineUrl.indexOf('url');

        if (idxX === idxY && idxY === idxZ && idxZ === idxP && idxP === idxP2 && idxP2 === idxUrl) {
             console.log(`✅ Variable declarations aligned at column ${idxX}`);
        } else {
             console.error(`❌ Variable declarations alignment failed: x=${idxX}, y=${idxY}, z=${idxZ}, p=${idxP}, p2=${idxP2}, url=${idxUrl}`);
             process.exit(1);
        }

        // Check string parsing robustness
        if (!lineUrl.includes('"http://example.com"')) {
             console.error(`❌ String parsing failed: URL mangled '${lineUrl}'`);
             process.exit(1);
        }
        console.log(`✅ String parsing verified: ${lineUrl.trim()}`);

        // Check pointer formatting
        if (!lineP.trim().startsWith('int*')) {
             console.error(`❌ Pointer formatting failed for 'p'. Expected start with 'int*', got '${lineP.trim()}'`);
             process.exit(1);
        }
        console.log(`✅ Pointer formatting verified: ${lineP.trim()}`);

        // Check member variable alignment
        const lineMVal = lines[lines.findIndex(l => l.includes('int') && l.includes('m_val') && l.trim().startsWith('int'))];
        const lineMName = lines[lines.findIndex(l => l.includes('std::string') && l.includes('m_name'))];
        const lineMData = lines[lines.findIndex(l => l.includes('std::vector<int>') && l.includes('m_data'))];

        const idxMVal = lineMVal.indexOf('m_val');
        const idxMName = lineMName.indexOf('m_name');
        const idxMData = lineMData.indexOf('m_data');

        if (idxMVal === idxMName && idxMName === idxMData) {
             console.log(`✅ Member variables aligned at column ${idxMVal}`);
        } else {
             console.error(`❌ Member variables alignment failed: m_val=${idxMVal}, m_name=${idxMName}, m_data=${idxMData}`);
             process.exit(1);
        }

        // Check return statement NOT aligned
        const lineRet = lines[findLine('return x;')];
        if (lineRet.includes('return   x;')) {
             console.error(`❌ 'return x;' seems aligned with declarations: '${lineRet}'`);
             process.exit(1);
        }
        if (!/return\s+x;/.test(lineRet)) {
             console.error(`❌ 'return x;' formatting weird: '${lineRet}'`);
             process.exit(1);
        }
        console.log(`✅ 'return' statement verified not aligned: ${lineRet.trim()}`);

        console.log('✅ All Strict Assertions Passed');

    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

runTest();
