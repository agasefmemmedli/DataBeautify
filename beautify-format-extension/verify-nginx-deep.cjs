const fs = require('fs');
const path = require('path');

try {
    const { formatNginxDeep } = require('./out/formatters/nginx_deep_formatter');

    // Test Case 1: Standard Nginx
    const testFile = path.join(__dirname, 'test/test.nginx');
    const content = fs.readFileSync(testFile, 'utf8');

    console.log('--- Test Case 1: Standard ---');
    let formatted = formatNginxDeep(content);

    // listen (6) vs server_name (11) -> max 11
    // listen: 11 - 6 = 5 padding + 1 separator = 6 spaces.
    if (!formatted.includes('    listen      80;')) {
        console.error('FAILED: Directives not aligned (listen)');
        console.log(formatted);
        process.exit(1);
    }

    // server_name: 11 - 11 = 0 padding + 1 separator = 1 space.
    if (!formatted.includes('    server_name example.com www.example.com;')) {
        console.error('FAILED: Directives not aligned (server_name)');
        console.log(formatted);
        process.exit(1);
    }

    // Test Case 2: Messy/Compacted Nginx
    console.log('\n--- Test Case 2: Messy ---');
    const messyContent = 'server { listen 80; server_name example.com; location / { root /var/www; } }';
    formatted = formatNginxDeep(messyContent);
    // console.log(formatted);

    // Should be expanded
    // listen (6) vs server_name (11) -> max 11 -> 6 spaces for listen
    if (!formatted.includes('server {\n    listen      80;')) {
         console.error('FAILED: Messy code not expanded correctly (server block start)');
         console.log(formatted);
         process.exit(1);
    }

    if (!formatted.includes('    server_name example.com;')) {
         console.error('FAILED: Messy code not expanded correctly (server_name)');
         console.log(formatted);
         process.exit(1);
    }

    if (!formatted.includes('    location / {\n        root /var/www;')) {
         console.error('FAILED: Messy code not expanded correctly (location block)');
         console.log(formatted);
         process.exit(1);
    }

    console.log('PASSED: Nginx Deep Formatting verified.');

} catch (e) {
    console.error('Error running verification:', e);
    console.log('Make sure to run `npm run compile` first.');
    process.exit(1);
}
