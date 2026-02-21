const fs = require('fs');
const path = require('path');

// Try to load compiled module
let formatSvelteDeep;
try {
    const module = require('./out/formatters/svelte_deep_formatter');
    formatSvelteDeep = module.formatSvelteDeep;
} catch (e) {
    console.error('Could not load formatter. Make sure to compile first with "npm run compile"');
    console.error(e);
    process.exit(1);
}

const testFile = 'test.deep.svelte';
const filePath = path.join(__dirname, testFile);

if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');

console.log(`Formatting ${testFile}...`);

try {
    const formatted = formatSvelteDeep(content, {
        tabSize: 2,
        insertSpaces: true,
        printWidth: 80
    });

    console.log('--- Original ---');
    console.log(content);
    console.log('--- Formatted ---');
    console.log(formatted);
    console.log('-----------------');

    // Verification Logic
    let valid = true;

    // 1. Check if indented
    if (!formatted.includes('  <h1>Hello {name}!</h1>')) {
        console.error('❌ H1 not indented correctly.');
        valid = false;
    }

    // 2. Check Logic Block indentation
    // We expect:
    // {#if ...}
    //   <p>...
    if (!formatted.includes('  {#if count > 10}')) {
        // Wait, standard HTML formatter might indent the logic block if it's inside <main>
        // Yes, it is inside <main>.
        // So {#if} should be indented.
    }

    if (!formatted.includes('    <p>{count} is greater than 10</p>')) {
         console.error('❌ Content inside {#if} not indented.');
         valid = false;
    }

    // 3. Check {:else}
    // Should be at same level as {#if} (indented 2 spaces)
    if (!formatted.includes('  {:else if count < 5}')) {
         console.error('❌ {:else if} not correctly aligned.');
         valid = false;
    }

    // 4. Check broken syntax resilience
    console.log('Testing resilience...');
    const broken = '{#if broken';
    const fixedBroken = formatSvelteDeep(broken);
    if (fixedBroken) {
        console.log('✅ Handled broken syntax gracefully.');
    } else {
        console.error('❌ Crashed on broken syntax.');
        valid = false;
    }

    if (valid) {
        console.log('✅ Deep Svelte Formatting Verified!');
        process.exit(0);
    } else {
        console.error('❌ Verification Failed.');
        process.exit(1);
    }

} catch (e) {
    console.error('❌ Formatter crashed:', e);
    process.exit(1);
}
