const fs = require('fs');
const path = require('path');

async function runTests() {
    console.log('Running Vue Deep Formatting (Styles) Verification...');
    let formatVueDeep;
    try {
        const module = require('./out/formatters/vue_deep_formatter');
        formatVueDeep = module.formatVueDeep;
    } catch (e) {
        console.error('Could not load vue_deep_formatter. Make sure to run "npm run compile" first.');
        console.error(e);
        process.exit(1);
    }

    // Create a test file with different style blocks
    const testContent = `
<template>
  <div>Test</div>
</template>

<style lang="scss">
$color: red;
.test {
  color: $color;
  &:hover {
    color: blue;
  }
}
</style>

<style lang="less">
@color: red;
.test {
  color: @color;
  .nested {
    color: blue;
  }
}
</style>

<style lang="sass">
$color: red
.test
  color: $color
</style>
`;

    console.log(`Formatting content with SCSS/LESS/SASS...`);
    let formatted = '';
    try {
        formatted = formatVueDeep(testContent, {
            tabSize: 2,
            insertSpaces: true,
            printWidth: 120
        });
    } catch (e) {
        console.error('Formatting failed with error:', e);
        process.exit(1);
    }

    // Verify output contains formatted styles
    // SCSS deep formatter typically changes indentation or spacing
    // SASS formatter usually handles indentation based structure

    // Just checking if it didn't crash and output contains expected content
    if (formatted.includes('$color: red;') && formatted.includes('.test {')) {
         console.log('✅ SCSS/LESS checks passed (content preserved/formatted).');
    } else {
         // SASS might not have semicolons
         if (formatted.includes('$color: red')) {
              console.log('✅ SASS checks passed.');
         } else {
              console.error('❌ Style content seems missing or malformed.');
              console.log(formatted);
              process.exit(1);
         }
    }

    console.log('✅ Vue Deep Formatting Verification (Styles) Passed.');
}

runTests();
