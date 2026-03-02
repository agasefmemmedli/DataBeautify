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

    // Test Case 3: Deep formatting of multiple arguments (proxy_set_header)
    console.log('\n--- Test Case 3: Multiple Arguments Alignment ---');
    const proxyContent = `
server {
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    set $my_var 1;
}
`;
    formatted = formatNginxDeep(proxyContent);
    // console.log(formatted);

    // Host has length 4, X-Real-IP has length 9, X-Forwarded-For has length 15. maxArg1Len = 15.
    // proxy_set_header has length 16, set has length 3. maxDirectiveLen = 16.

    // proxy_set_header Host (15 - 4 = 11 spaces)
    if (!formatted.includes('    proxy_set_header Host            $host;')) {
         console.error('FAILED: Multiple arguments not aligned correctly (Host)');
         console.log(formatted);
         process.exit(1);
    }

    // proxy_set_header X-Real-IP (15 - 9 = 6 spaces)
    if (!formatted.includes('    proxy_set_header X-Real-IP       $remote_addr;')) {
         console.error('FAILED: Multiple arguments not aligned correctly (X-Real-IP)');
         console.log(formatted);
         process.exit(1);
    }

    // proxy_set_header X-Forwarded-For (15 - 15 = 0 spaces)
    if (!formatted.includes('    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;')) {
         console.error('FAILED: Multiple arguments not aligned correctly (X-Forwarded-For)');
         console.log(formatted);
         process.exit(1);
    }

    // set (16 - 3 = 13 spaces directive padding), $my_var (15 - 7 = 8 spaces arg1 padding)
    if (!formatted.includes('    set              $my_var         1;')) {
         console.error('FAILED: Multiple arguments not aligned correctly (set)');
         console.log(formatted);
         process.exit(1);
    }

    console.log('PASSED: Nginx Deep Formatting verified.');

} catch (e) {
    console.error('Error running verification:', e);
    console.log('Make sure to run `npm run compile` first.');
    process.exit(1);
}
