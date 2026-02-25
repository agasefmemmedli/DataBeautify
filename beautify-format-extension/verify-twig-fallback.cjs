const { formatTwigDeep } = require('./out/formatters/twig_deep_formatter');

const testCases = [
    {
        name: "Basic Block and Output",
        input: `{% block content %}
    <h1>{{ page.title|upper }}</h1>
{% endblock %}`,
        expectedContains: ["{{ page.title|upper }}", "{% block content %}"]
    },
    {
        name: "For Loop with HTML",
        input: `{% for article in articles %}
<article><h2>{{ article.title }}</h2></article>
{% endfor %}`,
        expectedContains: ["{% for article in articles %}", "<h2>", "{{ article.title }}", "</h2>", "</article>", "{% endfor %}"]
    },
    {
        name: "Macro Definition",
        input: `{% macro input(name, value, type="text", size=20) %}
<input type="{{ type }}" name="{{ name }}" value="{{ value|e }}" size="{{ size }}" />
{% endmacro %}`,
        expectedContains: ["{% macro input(name, value, type=\"text\", size=20) %}", "{{ value|e }}"]
    },
    {
        name: "Complex Expression",
        input: `{{ foo ? 'yes' : 'no' }}`,
        expectedContains: ["{{ foo ? 'yes' : 'no' }}"]
    }
];

let failed = false;

console.log("Running Twig Deep Formatter Fallback Tests...");

testCases.forEach((test, index) => {
    console.log(`\nTest ${index + 1}: ${test.name}`);
    try {
        const output = formatTwigDeep(test.input);
        console.log("--- Output ---");
        console.log(output);

        let passed = true;
        test.expectedContains.forEach(str => {
            if (!output.includes(str)) {
                console.error(`❌ Missing expected string: "${str}"`);
                passed = false;
            }
        });

        if (passed) {
            console.log("✅ Passed");
        } else {
            failed = true;
        }
    } catch (e) {
        console.error(`❌ Error: ${e.message}`);
        failed = true;
    }
});

if (failed) {
    console.error("\n❌ Some tests failed.");
    process.exit(1);
} else {
    console.log("\n✅ All tests passed.");
}
