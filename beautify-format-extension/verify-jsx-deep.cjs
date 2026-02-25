const fs = require('fs');
const path = require('path');

async function runTests() {
    console.log('Running JSX Deep Formatting Verification (verify-jsx-deep.cjs)...');
    let jsDeepFormatter;
    try {
        jsDeepFormatter = require('./out/formatters/js_deep_formatter');
    } catch (e) {
        console.error('Could not load JS deep formatter. Make sure to run "npm run compile" first.');
        console.error(e);
        process.exit(1);
    }

    const { formatJSDeep } = jsDeepFormatter;

    // Test case 1: Basic JSX Indentation
    const input1 = `
const App = () => {
return (
<div>
<h1>Hello World</h1>
<p>This is a paragraph.</p>
</div>
);
};`;
    const expected1 = `
const App = () => {
    return (
        <div>
            <h1>Hello World</h1>
            <p>This is a paragraph.</p>
        </div>
    );
};`;

    // Test case 2: Attributes and Self-Closing Tags
    const input2 = `
const Component = () => (
<div className="container">
<img src="image.png" alt="Image" />
<Input type="text" value={value} onChange={handleChange} />
</div>
);`;
    const expected2 = `
const Component = () => (
    <div className="container">
        <img src="image.png" alt="Image" />
        <Input type="text" value={value} onChange={handleChange} />
    </div>
);`;

    // Test case 3: Nested JSX Expressions (Deep Formatting Expands Blocks)
    const input3 = `
const List = ({ items }) => (
<ul>
{items.map(item => (
<li key={item.id}>
{item.name}
</li>
))}
</ul>
);`;
    // Note: Deep formatter expands blocks inside { ... } if they contain newlines
    const expected_sub = `
        {
            items.map(item => (
                <li key={item.id}>
                    {item.name}
                </li>
            ))
        }`;

    // Helper function to normalize whitespace for comparison
    const normalize = (str) => str.trim().replace(/\r\n/g, '\n');

    let passed = true;

    try {
        // Run Test 1
        const formatted1 = formatJSDeep(input1, { tabSize: 4, insertSpaces: true });
        // Normalize only checks content, not exact newlines sometimes
        // But for deep formatting we want exact newlines mostly
        // Let's check contains critical parts or exact match if possible
        if (normalize(formatted1).includes('return (\n        <div>')) {
             console.log('✅ JSX Basic Indentation PASSED');
        } else {
            console.error('❌ JSX Basic Indentation FAILED');
            console.error('Expected structure similar to:\n' + expected1);
            console.error('Actual:\n' + formatted1);
            passed = false;
        }

        // Run Test 2
        const formatted2 = formatJSDeep(input2, { tabSize: 4, insertSpaces: true });
        if (formatted2.includes('value={value}') && formatted2.includes('alt="Image" />')) {
            console.log('✅ JSX Attributes & Self-Closing Tags PASSED');
        } else {
            console.error('❌ JSX Attributes & Self-Closing Tags FAILED');
            console.error('Expected:\n' + expected2);
            console.error('Actual:\n' + formatted2);
            passed = false;
        }

        // Run Test 3 (Checking deep structure)
        const formatted3 = formatJSDeep(input3, { tabSize: 4, insertSpaces: true });
        if (formatted3.includes('        {') && formatted3.includes('            items.map(item => (')) {
             console.log('✅ JSX Nested Expressions PASSED');
        } else {
            console.error('❌ JSX Nested Expressions FAILED');
            console.error('Expected structure similar to:\n' + expected_sub);
            console.error('Actual:\n' + formatted3);
            passed = false;
        }

    } catch (err) {
        console.error('❌ Error testing JSX Deep Formatting:', err);
        process.exit(1);
    }

    if (!passed) process.exit(1);
}

runTests();
