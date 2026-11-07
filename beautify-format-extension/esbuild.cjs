const esbuild = require('esbuild');

const common = {
    entryPoints: ['./src/extension.ts'],
    bundle: true,
    minify: true,
    external: ['vscode'],
    sourcemap: true,
    // CommonJS works in every VS Code version allowed by "engines" (1.74+)
    format: 'cjs',
};

async function build() {
    try {
        // Desktop VS Code
        await esbuild.build({
            ...common,
            platform: 'node',
            target: 'node16',
            outfile: 'dist/extension.js',
            // jsonc-parser's UMD build uses dynamic require(), so prefer ESM entry points
            mainFields: ['module', 'main'],
        });
        // vscode.dev / github.dev (web worker, no Node.js)
        await esbuild.build({
            ...common,
            platform: 'browser',
            target: 'es2020',
            outfile: 'dist/web/extension.js',
            mainFields: ['browser', 'module', 'main'],
            define: { 'process.env.NODE_ENV': '"production"' },
        });
        console.log('Build complete');
    } catch (e) {
        console.error('Build failed', e);
        process.exit(1);
    }
}

build();
