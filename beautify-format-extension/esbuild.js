const esbuild = require('esbuild');

async function build() {
    try {
        await esbuild.build({
            entryPoints: ['./src/extension.ts'],
            bundle: true,
            minify: true,
            platform: 'node',
            target: 'node16',
            outfile: 'dist/extension.js',
            external: ['vscode'],
            sourcemap: true,
            format: 'cjs',
            mainFields: ['module', 'main'], // Prefer ESM to avoid UMD issues
        });
        console.log('Build complete');
    } catch (e) {
        console.error('Build failed', e);
        process.exit(1);
    }
}

build();
