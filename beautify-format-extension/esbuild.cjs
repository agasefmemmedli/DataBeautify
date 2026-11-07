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
            // CommonJS works in every VS Code version allowed by "engines" (1.74+)
            format: 'cjs',
            // jsonc-parser's UMD build uses dynamic require(), so prefer ESM entry points
            mainFields: ['module', 'main'],
        });
        console.log('Build complete');
    } catch (e) {
        console.error('Build failed', e);
        process.exit(1);
    }
}

build();
