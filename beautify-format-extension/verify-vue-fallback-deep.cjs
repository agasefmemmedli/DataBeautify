const fs = require('fs');
const path = require('path');

async function runTests() {
    console.log('Running Vue Deep Formatting (Fallback) Verification...');
    let formatVueDeep;
    try {
        const module = require('./out/formatters/vue_deep_formatter');
        formatVueDeep = module.formatVueDeep;
    } catch (e) {
        console.error('Could not load vue_deep_formatter. Make sure to run "npm run compile" first.');
        console.error(e);
        process.exit(1);
    }

    const testFile = 'test.deep.vue';
    const filePath = path.join(__dirname, testFile);
    if (!fs.existsSync(filePath)) {
        console.error(`File ${testFile} not found at ${filePath}!`);
        process.exit(1);
    }
    const content = fs.readFileSync(filePath, 'utf8');

    console.log(`Formatting ${testFile}...`);
    let formatted = '';
    try {
        formatted = formatVueDeep(content, {
            tabSize: 2,
            insertSpaces: true,
            printWidth: 120,
            sortAttributes: true
        });
    } catch (e) {
        console.error('Formatting failed:', e);
        process.exit(1);
    }

    // verification checks
    // Note: formatVueDeep indents top-level tags inside template? No, formatHTMLDeep handles indentation from level 0.
    // If <template> is at level 0, its children are at level 1.
    // If <script> is at level 0, its content is at level 0 (but indented by logic?)
    // In my implementation:
    // formattedLines.push(getIndent(indentLevel) + line);
    // So script content is indented by current indentLevel.

    // Let's check expected output based on implementation logic.

    const expectedContains = [
        '<template>',
        '  <div v-if="loading" class="container">',
        '    <span class="spinner"></span>',
        '  </div>',
        '  <div v-else class="content">',
        '<script lang="ts" setup>',
        '  import { ref, computed, onMounted } from "vue";',
        '  const props = defineProps < {',
        '<style lang="scss" scoped>',
        '  .container {',
        '    display: flex;'
    ];

    let passed = true;
    for (const expected of expectedContains) {
        if (!formatted.includes(expected)) {
            console.error(`❌ Missing expected output:\n'${expected}'`);
            passed = false;
        }
    }

    if (passed) {
        console.log('✅ Vue Deep Formatting passed.');
    } else {
        console.error('❌ Vue Deep Formatting failed.');
        console.log('--- Output ---');
        console.log(formatted);
        console.log('--------------');
        process.exit(1);
    }
}

runTests();
