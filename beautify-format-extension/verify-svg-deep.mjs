import * as prettier from 'prettier';
import jsbeautify from 'js-beautify';
import xmlFormatter from 'xml-formatter';
import fs from 'fs';

async function formatSVGDeep(text) {
    try {
        console.log("Attempting Prettier...");
        return await prettier.format(text, {
            parser: 'html',
            tabWidth: 2,
            printWidth: 80,
            htmlWhitespaceSensitivity: 'ignore'
        });
    } catch (prettierError) {
        console.log("Prettier failed, falling back to manual deep formatting:", prettierError.message);
        try {
            let processedText = text;

            processedText = processedText.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, content) => {
                try {
                    const formattedCSS = jsbeautify.css(content, { indent_size: 2 });
                    return match.replace(content, '\n' + formattedCSS + '\n');
                } catch (e) {
                    return match;
                }
            });

            processedText = processedText.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (match, content) => {
                try {
                    const formattedJS = jsbeautify.js(content, { indent_size: 2 });
                    return match.replace(content, '\n' + formattedJS + '\n');
                } catch (e) {
                    return match;
                }
            });

            return xmlFormatter(processedText, {
                indentation: '  ',
                collapseContent: false,
                lineSeparator: '\n',
                whiteSpaceAtEndOfSelfclosingTag: true
            });
        } catch (error) {
            throw error;
        }
    }
}

async function run() {
    const text = fs.readFileSync('test-deep.svg', 'utf8');
    console.log("Original:");
    console.log(text);

    const formatted = await formatSVGDeep(text);
    console.log("\nFormatted:");
    console.log(formatted);

    // Verify output
    if (!formatted.includes('  .icon {')) {
        // Prettier might format differently, e.g. <style>.icon { ... }</style> if it fits on one line?
        // But with printWidth 80, it should expand.
        // Let's check generally.
        console.warn("Warning: CSS might not be indented as expected.");
    }

    if (formatted.includes('console.log("world");}')) {
         console.warn("Warning: JS might not be formatted (found unspaced brace).");
    }

    // Force fallback test
    console.log("\nTesting Fallback (with broken syntax for Prettier)...");
    const brokenText = '<svg><style>.a{color:red</style></svg>'; // Missing semicolon/brace in CSS might break Prettier parsing of HTML? No, HTML parser is lenient.
    // Broken XML tag
    const reallyBroken = '<svg><style>.a{color:red}</style>'; // This is valid.
    // Prettier HTML parser handles invalid HTML usually.
    // Let's try something that xml-formatter handles but prettier might choke on if we forced a syntax error?
    // Actually, Prettier is strict. If I have a random `<` that is unclosed?
    const invalidSyntax = '<svg><path d="M10 10" <InvalidAttribute> </svg>';

    try {
        const fallbackFormatted = await formatSVGDeep(invalidSyntax);
        console.log("\nFallback Formatted:");
        console.log(fallbackFormatted);
    } catch (e) {
        console.log("Fallback also failed (expected for invalid XML syntax):", e.message);
    }
}

run().catch(err => console.error(err));
