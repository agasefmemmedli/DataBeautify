const fs = require('fs');
const path = require('path');

async function run() {
    try {
        const { formatSQLFallback } = require('./out/formatters/sql_deep_formatter');
        const content = fs.readFileSync('test-broken.sql', 'utf8');

        console.log('--- Original Content ---');
        console.log(content);
        console.log('------------------------');

        const formatted = formatSQLFallback(content);

        console.log('--- Formatted Output (Fallback) ---');
        console.log(formatted);
        console.log('------------------------');

        // Assertions
        if (!formatted.includes('SELECT')) {
            console.error('❌ Failed to uppercase SELECT');
            process.exit(1);
        }
        if (!formatted.includes('FROM')) {
            console.error('❌ Failed to uppercase FROM');
            process.exit(1);
        }
        // Check if indentation is present (4 spaces)
        if (!formatted.includes('    ')) {
            console.warn('⚠️ No indentation found? (Might be flat structure)');
        }

        console.log('✅ Verification passed.');

    } catch (e) {
        console.error('❌ Verification failed:', e);
        process.exit(1);
    }
}

run();
