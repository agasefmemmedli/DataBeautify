const { formatSvelteDeep } = require('./out/formatters/svelte_deep_formatter');
const fs = require('fs');
const assert = require('assert');

// Test Case
const input = `
<script>
  let count = 0;
    function increment() {
      count += 1;
    }
</script>

<style>
  p {
    color: purple;
      font-family: 'Comic Sans MS';
  }
</style>

{#if count > 10}
    <p>{count} is greater than 10</p>
{:else}
      <p>{count} is less than or equal to 10</p>
{/if}

<button on:click={increment}>
    Clicks: {count}
</button>
`;

try {
    console.log('Testing Svelte Deep Formatter...');
    const formatted = formatSvelteDeep(input, { tabSize: 2, insertSpaces: true });

    console.log('Formatted Output:\n', formatted);

    // Basic assertions
    if (!formatted.includes('<script>')) throw new Error('Missing <script> tag');
    if (!formatted.includes('let count = 0;')) throw new Error('Missing script content');
    if (!formatted.includes('color: purple;')) throw new Error('Missing style content');
    if (!formatted.includes('{#if count > 10}')) throw new Error('Missing #if block');

    // Indentation checks
    // Script content should be indented (level 1 = 2 spaces)
    const scriptContentLines = formatted.split('\n').filter(l => l.trim().startsWith('let count'));
    if (scriptContentLines.length > 0 && !scriptContentLines[0].startsWith('  let')) {
         console.warn('Warning: Script content might not be indented correctly.');
    }

    console.log('✅ Svelte Deep Formatter Verification Passed!');
} catch (e) {
    console.error('❌ Svelte Deep Formatter Verification Failed:', e);
    process.exit(1);
}
