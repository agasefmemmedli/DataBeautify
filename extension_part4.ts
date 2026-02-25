    }
}

/**
 * Custom resilient Twig validator
 */
function validateTwig(text: string): string | undefined {
    const stack: { tag: string, line: number, type: 'twig' | 'html' }[] = [];
    const lines = text.split('\n');

    const voidTags = [
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
    ];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Remove comments
        const lineNoComments = line.replace(/{#[\s\S]*?#}/g, '').replace(/<!--[\s\S]*?-->/g, '');

        // Regex for tags
        const regex = /({%\s*(block|if|for|macro|embed|apply|sandbox|autoescape|verbatim|set|with|filter|trans)\b)|({%\s*end(block|if|for|macro|embed|apply|sandbox|autoescape|verbatim|set|with|filter|trans)\b)|(<\/?([a-zA-Z0-9]+)[^>]*>)/g;
        let match;

        while ((match = regex.exec(lineNoComments)) !== null) {
            if (match[1]) { // Twig Open
                const tagName = match[2];
                // 'set' can be self-closing (assignment) or block
                if (tagName === 'set' && lineNoComments.includes('=')) {
                    continue;
                }
                stack.push({ tag: tagName, line: i + 1, type: 'twig' });
            } else if (match[3]) { // Twig Close
                const tagName = match[4];
                if (stack.length === 0) {
                    return `Unexpected closing block {% end${tagName} %} at line ${i + 1}`;
                }
                const last = stack.pop()!;
                if (last.type !== 'twig' || last.tag !== tagName) {
                    return `Mismatched closing block {% end${tagName} %} at line ${i + 1} (expected {% end${last.tag} %} for ${last.tag} from line ${last.line})`;
                }
            } else if (match[5]) { // HTML Tag
                const fullTag = match[5];
                const tagName = match[6].toLowerCase();
                const isClosing = fullTag.startsWith('</');
                const isSelfClosing = fullTag.endsWith('/>');

                if (isSelfClosing || voidTags.includes(tagName)) {
                    continue;
                }

                if (isClosing) {
                    if (stack.length === 0) {
                        return `Unexpected closing tag </${tagName}> at line ${i + 1}`;
                    }
                    const last = stack.pop()!;
                    // If we find a Twig block, it means invalid nesting
                    if (last.type === 'twig') {
                         return `Mismatched closing tag </${tagName}> at line ${i + 1} (expected {% end${last.tag} %} from line ${last.line})`;
                    }
                    if (last.tag !== tagName) {
                        return `Mismatched closing tag </${tagName}> at line ${i + 1} (expected </${last.tag}> from line ${last.line})`;
                    }
                } else {
                    stack.push({ tag: tagName, line: i + 1, type: 'html' });
                }
            }
        }
    }

    if (stack.length > 0) {
        const last = stack.pop()!;
        if (last.type === 'twig') {
            return `Unclosed block {% ${last.tag} %} starting at line ${last.line}`;
        } else {
            return `Unclosed tag <${last.tag}> starting at line ${last.line}`;
        }
    }

    return undefined;
}

/**
 * Handle Log file formatting and validation
 */
async function handleLog(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Log
    validationMessage = validateLog(text);

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];

        // Common timestamp patterns
        const timestampRegex = /^\[?(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}|\d{2}:\d{2}:\d{2}|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\]?/;
        const logLevelRegex = /\b(INFO|DEBUG|WARN|WARNING|ERROR|FATAL|TRACE|CRITICAL)\b/i;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '') {
                formattedLines.push('');
                continue;
            }

            const tsMatch = line.match(timestampRegex);
            if (tsMatch) {
                // It's a new log entry
                let processedLine = line;

                // Align log level if present
                const levelMatch = processedLine.match(logLevelRegex);
                if (levelMatch) {
                    const level = levelMatch[1].toUpperCase();
                    const paddedLevel = `[${level.padEnd(7)}]`;
                    processedLine = processedLine.replace(levelMatch[0], paddedLevel);
                }

                formattedLines.push(processedLine.trimEnd());
            } else {
                // It's a continuation line (e.g., stack trace)
                // Indent by 4 spaces if it's not already indented or doesn't look like a log start
                if (!line.startsWith('    ') && !line.startsWith('\t')) {
                    formattedLines.push('    ' + trimmed);
                } else {
                    formattedLines.push(line.trimEnd());
                }
            }
        }
        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Log: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Log file has potential issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Log file formatted successfully!');
    }
}

/**
 * Custom resilient Log validator
 */
function validateLog(text: string): string | undefined {
    const lines = text.split('\n');
    const timestampRegex = /\[?(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}|\d{2}:\d{2}:\d{2}|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\]?/;

    for (let i = 0; i < Math.min(lines.length, 10); i++) {
        const line = lines[i].trim();
        if (line === '') continue;

        if (timestampRegex.test(line)) {
            return undefined; // Found at least one valid log line
        }
    }

    return 'No recognized timestamp patterns found in the first few lines.';
}

export async function beautify(forcedFormat?: 'json' | 'jsonc' | 'xml' | 'svg' | 'html' | 'css' | 'scss' | 'sass' | 'less' | 'javascript' | 'typescript' | 'jsx' | 'tsx' | 'vue' | 'svelte' | 'php' | 'yaml' | 'toml' | 'ini' | 'env' | 'csv' | 'graphql' | 'python' | 'java' | 'kotlin' | 'csharp' | 'cpp' | 'go' | 'rust' | 'ruby' | 'swift' | 'dart' | 'dockerfile' | 'shell' | 'powershell' | 'hcl' | 'makefile' | 'nginx' | 'sql' | 'prisma' | 'mongodb' | 'markdown' | 'latex' | 'mdx' | 'log' | 'handlebars' | 'twig' | 'liquid' | 'ipynb' | 'gitconfig' | 'editorconfig' | 'astro') {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
    }

    const document = editor.document;
    const text = document.getText();

    if (text.trim().length === 0) {
        vscode.window.showWarningMessage('Document is empty');
        return;
    }

    const format = forcedFormat || detectFormat(text, document.languageId);

    if (format === 'json') {
        await handleJSON(editor, text);
    } else if (format === 'jsonc') {
        await handleJSONC(editor, text);
    } else if (format === 'xml') {
        await handleXML(editor, text);
    } else if (format === 'svg') {
        await handleSVG(editor, text);
    } else if (format === 'html') {
        await handleHTML(editor, text);
    } else if (format === 'css') {
        await handleCSS(editor, text);
    } else if (format === 'scss') {
        await handleSCSS(editor, text);
    } else if (format === 'sass') {
        await handleSASS(editor, text);
    } else if (format === 'less') {
        await handleLESS(editor, text);
    } else if (format === 'javascript') {
        await handleJS(editor, text);
    } else if (format === 'typescript') {
        await handleTS(editor, text);
    } else if (format === 'jsx') {
        await handleJSX(editor, text);
    } else if (format === 'tsx') {
        await handleTSX(editor, text);
    } else if (format === 'vue') {
        await handleVue(editor, text);
    } else if (format === 'svelte') {
        await handleSvelte(editor, text);
    } else if (format === 'php') {
        await handlePHP(editor, text);
    } else if (format === 'yaml') {
        await handleYAML(editor, text);
    } else if (format === 'toml') {
        await handleTOML(editor, text);
    } else if (format === 'ini') {
        await handleINI(editor, text);
    } else if (format === 'env') {
        await handleENV(editor, text);
    } else if (format === 'csv') {
        await handleCSV(editor, text);
    } else if (format === 'graphql') {
        await handleGraphQL(editor, text);
    } else if (format === 'python') {
        await handlePython(editor, text);
    } else if (format === 'java') {
        await handleJava(editor, text);
    } else if (format === 'kotlin') {
        await handleKotlin(editor, text);
    } else if (format === 'csharp') {
        await handleCSharp(editor, text);
    } else if (format === 'cpp') {
        await handleCPP(editor, text);
    } else if (format === 'go') {
        await handleGo(editor, text);
    } else if (format === 'rust') {
        await handleRust(editor, text);
    } else if (format === 'ruby') {
        await handleRuby(editor, text);
    } else if (format === 'swift') {
        await handleSwift(editor, text);
    } else if (format === 'dart') {
        await handleDart(editor, text);
    } else if (format === 'dockerfile') {
        await handleDockerfile(editor, text);
    } else if (format === 'shell') {
        await handleShell(editor, text);
    } else if (format === 'powershell') {
        await handlePowerShell(editor, text);
    } else if (format === 'hcl') {
        await handleHCL(editor, text);
    } else if (format === 'makefile') {
        await handleMakefile(editor, text);
    } else if (format === 'nginx') {
        await handleNginx(editor, text);
    } else if (format === 'sql') {
        await handleSQL(editor, text);
    } else if (format === 'prisma') {
        await handlePrisma(editor, text);
    } else if (format === 'mongodb') {
        await handleMongoDB(editor, text);
    } else if (format === 'markdown') {
        await handleMarkdown(editor, text);
    } else if (format === 'latex') {
        await handleLaTeX(editor, text);
    } else if (format === 'mdx') {
        await handleMDX(editor, text);
    } else if (format === 'log') {
        await handleLog(editor, text);
    } else if (format === 'handlebars') {
        await handleHandlebars(editor, text);
    } else if (format === 'twig') {
        await handleTwig(editor, text);
    } else if (format === 'liquid') {
        await handleLiquid(editor, text);
    } else if (format === 'ipynb') {
        await handleIPYNB(editor, text);
    } else if (format === 'gitconfig') {
        await handleGitConfig(editor, text);
    } else if (format === 'editorconfig') {
        await handleEditorConfig(editor, text);
    } else if (format === 'astro') {
        await handleAstro(editor, text);
    } else {
        // If unknown, try JSON first then CSS/XML/HTML
        try {
            jsonrepair(text);
            await handleJSON(editor, text);
        } catch (e) {
            const trimmed = text.trim();
            if (trimmed.startsWith('<')) {
                const lowerText = trimmed.toLowerCase();
                if (lowerText.startsWith('<!doctype html') || lowerText.startsWith('<html')) {
                    await handleHTML(editor, text);
                } else {
                    await handleXML(editor, text);
                }
            } else if (trimmed.includes('{') && trimmed.includes('}')) {
                await handleCSS(editor, text);
            } else if (trimmed.startsWith('---') || /^[a-z0-9_-]+:\s/m.test(trimmed)) {
                await handleYAML(editor, text);
            } else if (trimmed.startsWith('[') || /^[a-z0-9_-]+\s*[=:]\s*/m.test(trimmed) || trimmed.startsWith(';') || trimmed.startsWith('#')) {
                // Heuristic for INI vs TOML vs ENV
                if (trimmed.includes(';') || (trimmed.includes(':') && !trimmed.includes('='))) {
                    await handleINI(editor, text);
                } else if (trimmed.startsWith('[') || (trimmed.includes('=') && !/^(export\s+)?[a-z_][a-z0-9_]*\s*=/i.test(trimmed))) {
                    await handleTOML(editor, text);
                } else {
                    await handleENV(editor, text);
                }
            } else if (detectDelimiter(trimmed) !== ',' || trimmed.includes(',')) {
                // Heuristic for CSV
                await handleCSV(editor, text);
            } else {
                vscode.window.showErrorMessage('Could not detect format (JSON, XML, HTML, CSS, YAML, TOML, INI, ENV or CSV). Please ensure your file starts with {, [, < or has key: value pairs');
            }
        }
    }
}

/**
 * Detect format based on language ID or content
 */
export function detectFormat(text: string, languageId: string): 'json' | 'jsonc' | 'xml' | 'svg' | 'html' | 'css' | 'scss' | 'sass' | 'less' | 'javascript' | 'typescript' | 'jsx' | 'tsx' | 'vue' | 'svelte' | 'php' | 'yaml' | 'toml' | 'ini' | 'env' | 'csv' | 'graphql' | 'python' | 'java' | 'kotlin' | 'csharp' | 'cpp' | 'go' | 'rust' | 'ruby' | 'swift' | 'dart' | 'dockerfile' | 'shell' | 'powershell' | 'hcl' | 'makefile' | 'nginx' | 'sql' | 'prisma' | 'mongodb' | 'markdown' | 'latex' | 'mdx' | 'log' | 'handlebars' | 'twig' | 'liquid' | 'ipynb' | 'gitconfig' | 'editorconfig' | 'astro' | 'unknown' {
    const lang = languageId.toLowerCase();
    if (lang === 'astro') { return 'astro'; }
    if (lang === 'ipynb' || lang === 'jupyter') { return 'ipynb'; }
    if (lang === 'editorconfig') { return 'editorconfig'; }
    if (lang === 'gitconfig' || lang === 'git-config') { return 'gitconfig'; }
    if (lang === 'json') { return 'json'; }
    if (lang === 'jsonc') { return 'jsonc'; }
    if (lang === 'xml' || lang === 'xsl') { return 'xml'; }
    if (lang === 'svg') { return 'svg'; }
    if (lang === 'html' || lang === 'htm') { return 'html'; }
    if (lang === 'css') { return 'css'; }
    if (lang === 'scss') { return 'scss'; }
    if (lang === 'sass') { return 'sass'; }
    if (lang === 'less') { return 'less'; }
    if (lang === 'javascript') { return 'javascript'; }
    if (lang === 'javascriptreact') { return 'jsx'; }
    if (lang === 'typescript') { return 'typescript'; }
    if (lang === 'typescriptreact') { return 'tsx'; }
    if (lang === 'vue') { return 'vue'; }
    if (lang === 'svelte') { return 'svelte'; }
    if (lang === 'php') { return 'php'; }
    if (lang === 'yaml' || lang === 'yml') { return 'yaml'; }
    if (lang === 'toml') { return 'toml'; }
    if (lang === 'ini') { return 'ini'; }
    if (lang === 'dotenv' || lang === 'env') { return 'env'; }
    if (lang === 'csv') { return 'csv'; }
    if (lang === 'graphql') { return 'graphql'; }
    if (lang === 'python') { return 'python'; }
    if (lang === 'java') { return 'java'; }
    if (lang === 'kotlin' || lang === 'kt' || lang === 'kts') { return 'kotlin'; }
    if (lang === 'csharp') { return 'csharp'; }
    if (lang === 'cpp' || lang === 'c') { return 'cpp'; }
    if (lang === 'rust' || lang === 'rs') { return 'rust'; }
    if (lang === 'go') { return 'go'; }
    if (lang === 'powershell' || lang === 'ps1' || lang === 'psm1') { return 'powershell'; }
    if (lang === 'ruby' || lang === 'rb') { return 'ruby'; }
    if (lang === 'swift') { return 'swift'; }
    if (lang === 'terraform' || lang === 'hcl' || lang === 'terraform-vars') { return 'hcl'; }
    if (lang === 'makefile') { return 'makefile'; }
    if (lang === 'nginx') { return 'nginx'; }
    if (lang === 'sql') { return 'sql'; }
    if (lang === 'prisma') { return 'prisma'; }
    if (lang === 'mongodb') { return 'mongodb'; }
    if (lang === 'markdown') { return 'markdown'; }
    if (lang === 'mdx') { return 'mdx'; }
    if (lang === 'log') { return 'log'; }
    if (lang === 'handlebars' || lang === 'hbs' || lang === 'mustache') { return 'handlebars'; }
    if (lang === 'twig') { return 'twig'; }
    if (lang === 'liquid') { return 'liquid'; }
    if (lang === 'latex' || lang === 'tex') { return 'latex'; }
    if (lang === 'dart' || lang === 'dockerfile' || lang === 'shellscript' || lang === 'sh') {
        return lang === 'shellscript' || lang === 'sh' ? 'shell' : lang as any;
    }

    const trimmed = text.trim();

    // Git Config heuristic
    if (
        /^\s*\[(core|remote|branch|user|alias|include|diff|merge|pull|push|init|credential)\]/.test(trimmed) ||
        /^\s*\[(remote|branch|submodule)\s+".+"\]/.test(trimmed) ||
        /^\s*repositoryformatversion\s*=\s*\d+/.test(trimmed)
    ) {
        return 'gitconfig';
    }

    // EditorConfig heuristic
    if (
        /^\s*root\s*=\s*true/.test(trimmed) ||
        /^\s*\[\s*(\*|\*\.[a-z0-9]+)\s*\]/.test(trimmed)
    ) {
        return 'editorconfig';
    }

    // Astro heuristic
    if (trimmed.startsWith('---') && (trimmed.includes('<html') || trimmed.includes('<style') || trimmed.includes('<script') || /<\s*[A-Z][a-zA-Z0-9]*/.test(trimmed))) {
        return 'astro';
    }

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        // IPYNB heuristic
        if (trimmed.includes('"cells"') && trimmed.includes('"nbformat"')) {
            return 'ipynb';
        }
        // Check if it contains comments, if so it's JSONC
        if (trimmed.includes('//') || trimmed.includes('/*')) {
            return 'jsonc';
        }
        return 'json';
    }

    // SVG heuristic
    if (trimmed.startsWith('<svg') || trimmed.includes('xmlns="http://www.w3.org/2000/svg"')) {
        return 'svg';
    }

    // Handlebars heuristic
    if (trimmed.includes('{{') && trimmed.includes('}}') && (trimmed.includes('{{#') || trimmed.includes('{{/') || trimmed.includes('{{>'))) {
        return 'handlebars';
    }

    // Twig heuristic
    if (trimmed.includes('{%') && trimmed.includes('%}') && (trimmed.includes('{% block') || trimmed.includes('{% if') || trimmed.includes('{% for') || trimmed.includes('{% extends'))) {
        return 'twig';
    }

    // Liquid heuristic
    if (trimmed.includes('{%') && trimmed.includes('%}') && (trimmed.includes('{% assign') || trimmed.includes('{% capture') || trimmed.includes('{% render') || trimmed.includes('{% include') || trimmed.includes('| date:') || trimmed.includes('| strip_html'))) {
        return 'liquid';
    }

    // PHP heuristic
    if (trimmed.startsWith('<?php') || trimmed.startsWith('<?') || trimmed.includes('<?php')) {
        return 'php';
    }

    // GraphQL heuristic
    if (
        /^\s*(query|mutation|subscription|fragment|schema|type|interface|enum|scalar|union|input|directive|extend)\b/i.test(trimmed) ||
        (/^\s*\{/m.test(trimmed) && trimmed.includes('}') && !trimmed.includes(':') && !trimmed.includes('"'))
    ) {
        return 'graphql';
    }

    if (trimmed.includes('<template') || /<script\s+setup/i.test(trimmed) || /<style\s+scoped/i.test(trimmed)) {
        return 'vue';
    }

    // Svelte heuristic: Svelte blocks or .svelte specific tags
    if (
        /\{#if\s+/i.test(trimmed) ||
        /\{#each\s+/i.test(trimmed) ||
        /\{#await\s+/i.test(trimmed) ||
        (trimmed.includes('<script') && trimmed.includes('</script>') && (trimmed.includes('export let') || trimmed.includes('$:')))
    ) {
        return 'svelte';
    }

    if (trimmed.startsWith('<')) {
        // Simple heuristic: if it looks like XML but isn't explicitly,
        // we'll try XML first then HTML in the main loop if unknown.
        // But if we're here, we can check for common HTML tags.
        const lowerText = trimmed.toLowerCase();
        if (lowerText.startsWith('<!doctype html') || lowerText.startsWith('<html')) {
            return 'html';
        }
        return 'xml';
    }

    // SCSS heuristic
    if (trimmed.includes('{') && (trimmed.includes('$') || trimmed.includes('@mixin') || trimmed.includes('@include'))) {
        return 'scss';
    }

    // Prisma heuristic
    if (
        /^\s*(datasource|generator|model|enum|type)\s+[a-z0-9_-]+\s*\{/im.test(trimmed) ||
        /^\s*(model|enum|type)\s+[A-Z][a-zA-Z0-9]*\s*\{/m.test(trimmed) ||
        /(@id|@unique|@default|@relation|@@id|@@unique|@@index|@@map)\b/.test(trimmed)
    ) {
        return 'prisma';
    }

    // MongoDB Shell heuristic
    if (
        /^\s*(db\.|sh\.|rs\.|use\s+|show\s+(collections|dbs|databases|users|roles))\b/m.test(trimmed) ||
        /\b(ObjectId|ISODate|Timestamp|NumberInt|NumberLong|Decimal128|DBRef)\s*\(/.test(trimmed)
    ) {
        return 'mongodb';
    }

    // SASS heuristic
    if (trimmed.startsWith('$') && !trimmed.includes('{')) {
        return 'sass';
    }

    // YAML heuristic (before CSS/JS to avoid conflicts, but specific enough)
    if (
        trimmed.startsWith('---') ||
        (/^\s*-\s+.+/m.test(trimmed) && !trimmed.includes('{')) ||
        (trimmed.startsWith('#') && !trimmed.includes('{')) ||
        (/^[a-z0-9_-]+:\s+.+/im.test(trimmed) && !trimmed.includes('{'))
    ) {
        return 'yaml';
    }

    // ENV heuristic
    if (
        (trimmed.startsWith('#') && !trimmed.includes('{') && !trimmed.includes('[') && /^[A-Z_]+=/m.test(trimmed)) ||
        /^(export\s+)?[A-Z_][A-Z0-9_]*\s*=\s*/im.test(trimmed)
    ) {
        return 'env';
    }

    // INI heuristic
    if (
        trimmed.startsWith(';') ||
        (/^[a-z0-9_-]+\s*[:]\s*.+/im.test(trimmed) && !trimmed.includes('{'))
    ) {
        return 'ini';
    }

    // CSV heuristic
    const lines = trimmed.split('\n').filter(l => l.trim() !== '');
    if (lines.length > 1) {
        const d = detectDelimiter(trimmed);
        const counts = lines.slice(0, 3).map(l => splitCSVLine(l, d).length);
        if (counts.length > 1 && counts.every(c => c > 1 && c === counts[0])) {
            return 'csv';
        }
    }

    // TOML or INI or ENV (all can use key=value)
    if (
        (trimmed.startsWith('[') && trimmed.includes(']')) ||
        (/^[a-z0-9_-]+\s*=\s*.+/im.test(trimmed) && !trimmed.includes('{'))
    ) {
        // If it has a semicolon, it's likely INI
        if (trimmed.includes(';')) {
            return 'ini';
        }
        // If it has a section, it's likely TOML or INI
        if (trimmed.startsWith('[')) {
            return 'toml';
        }
        // If it matches ENV pattern (UPPER_CASE keys)
        if (/^(export\s+)?[A-Z_][A-Z0-9_]*\s*=\s*/m.test(trimmed)) {
            return 'env';
        }
        return 'toml';
    }

    // LESS heuristic
    if (trimmed.includes('{') && (/@([a-z0-9-_]+)\s*:/i.test(trimmed) || /[.][a-z0-9-_]+\s*\(/i.test(trimmed))) {
        return 'less';
    }

    // CSS heuristic: contains { and } and looks like a rule
    if (trimmed.includes('{') && trimmed.includes('}') && /[a-z0-9-_#.]+\s*\{/i.test(trimmed)) {
        return 'css';
    }

    // TSX heuristic
    if (trimmed.includes('<') && (trimmed.includes('/>') || trimmed.includes('</')) &&
        (/\b(interface|type|public|private|protected|readonly|as|implements)\b/.test(trimmed) ||
            /:\s*(string|number|boolean|any|void|unknown|never|object)\b/.test(trimmed))) {
        return 'tsx';
    }

    // JSX heuristic
    if (trimmed.includes('<') && (trimmed.includes('/>') || trimmed.includes('</')) &&
        /\b(import|export|function|const|let|var|return)\b/.test(trimmed)) {
        return 'jsx';
    }

    // TypeScript heuristic
    if (
        /\b(interface|namespace|type|enum|public|private|protected|readonly|as|implements)\b/.test(trimmed) ||
        /:\s*(string|number|boolean|any|void|unknown|never|object)\b/.test(trimmed) ||
        /<[A-Z][A-Za-z0-9]*(\s*,\s*[A-Z][A-Za-z0-9]*)*>/.test(trimmed)
    ) {
        return 'typescript';
    }

    // Python heuristic
    if (
        /^\s*(def|class|if|for|while|with|try|import|from|async\s+def|async\s+for|async\s+with)\b/m.test(trimmed) ||
        /if __name__ == ['"]__main__['"]:/m.test(trimmed)
    ) {
        return 'python';
    }

    // Java heuristic
    if (
        /\b(public|private|protected)\s+(class|interface|enum|record)\b/.test(trimmed) ||
        /\bimport\s+java\./.test(trimmed) ||
        /\bpublic\s+static\s+void\s+main\b/.test(trimmed) ||
        /^\s*package\s+[a-z0-9_.]+\s*;/m.test(trimmed)
    ) {
        return 'java';
    }

    // Kotlin heuristic
    if (
        /^\s*(fun|val|var|package|import|class|interface|object)\b/m.test(trimmed) ||
        /\b(companion\s+object|when\s*\(|->)\b/.test(trimmed) ||
        /:\s*(String|Int|Long|Double|Float|Boolean|Any|Unit)\b/.test(trimmed)
    ) {
        return 'kotlin';
    }

    // C# heuristic
    if (
        /\b(public|private|protected|internal)\s+(class|interface|enum|struct|record)\b/.test(trimmed) ||
        /\busing\s+[A-Z][A-Za-z0-9.]*\s*;/.test(trimmed) ||
        /\bnamespace\s+[A-Z][A-Za-z0-9.]*(\s*\{|;)/.test(trimmed) ||
        /\bstatic\s+void\s+Main\b/.test(trimmed) ||
        /\bConsole\.(WriteLine|Write)\b/.test(trimmed)
    ) {
        return 'csharp';
    }

    // Rust heuristic
    if (
        /^\s*(fn|mod|pub|use|crate|type|struct|enum|impl|trait|match|unsafe|async|await)\b/m.test(trimmed) ||
        /\b(println!|vec!|panic!|format!|assert!)\b/.test(trimmed) ||
        /\b(match\s+.+\s*\{|=>|->)\b/.test(trimmed) ||
        /#!?\[[a-z_]+\(?.+\)?\]/i.test(trimmed)
    ) {
        return 'rust';
    }

    // Ruby heuristic
    if (
        /^\s*(class|module|def)\s+[A-Z_a-z]/m.test(trimmed) ||
        /\b(require|include|attr_accessor|attr_reader|attr_writer)\b/.test(trimmed) ||
        (/^\s*#/.test(trimmed) && /\b(def|class|end)\b/.test(text)) ||
        (trimmed.includes('do') && trimmed.includes('end'))
    ) {
        return 'ruby';
    }

    // Go heuristic
    if (
        /^\s*package\s+[a-z0-9_]+\b/m.test(trimmed) ||
        /^\s*func\s+\b/m.test(trimmed) ||
        /^\s*import\s+(\(|".+")/m.test(trimmed) ||
        /\bgo\s+func\b/.test(trimmed) ||
        /\bchan\s+[a-z0-9_]+\b/i.test(trimmed) ||
        /\bselect\s*\{/.test(trimmed) ||
        /:=/m.test(trimmed)
    ) {
        return 'go';
    }

    // C++ heuristic
    if (
        /^\s*#include\s*[<"]/m.test(trimmed) ||
        /\b(std::cout|std::endl|std::vector|std::string|std::map|std::set)\b/.test(trimmed) ||
        /\busing\s+namespace\s+std\s*;/.test(trimmed) ||
        /\btemplate\s*<\s*.+\s*>/m.test(trimmed) ||
        /\b(public|private|protected)\s*:\s*/.test(trimmed) ||
        (/\bclass\s+[A-Za-z0-9_]+\s*\{/.test(trimmed) && trimmed.includes('};'))
    ) {
        return 'cpp';
    }

    // Swift heuristic
    if (
        /^\s*(import\s+Swift|import\s+Foundation|import\s+UIKit|import\s+SwiftUI)\b/m.test(trimmed) ||
        /^\s*(protocol|extension|actor|any|associatedtype|async|await)\s+[A-Z_a-z]/m.test(trimmed) ||
        /^\s*(func|let|var|struct|enum|class)\s+[A-Z_a-z]/m.test(trimmed) ||
        /\b(print|debugPrint|fatalError|precondition)\b/.test(trimmed) ||
        /^\s*(@main|@UIApplicationMain|@NSApplicationMain)\b/m.test(trimmed)
    ) {
        return 'swift';
    }

    // Dart heuristic
    if (
        /^\s*import\s+['"](dart:|package:|.*\.dart)/m.test(trimmed) ||
        /\bvoid\s+main\s*\(\)/.test(trimmed) ||
        /@override\b/.test(trimmed) ||
        /^\s*(class|mixin|extension)\s+[A-Z_a-z]/m.test(trimmed) ||
        /\b(final|const|late|var|dynamic)\s+[A-Z_a-z_][A-Za-z0-9_]*\b/.test(trimmed)
    ) {
        return 'dart';
    }

    // Dockerfile heuristic
    if (
        /^\s*(FROM|RUN|COPY|ADD|WORKDIR|EXPOSE|ENTRYPOINT|CMD|ENV|ARG|LABEL|USER|VOLUME|STOPSIGNAL|HEALTHCHECK|ONBUILD|MAINTAINER|SHELL)\b/i.test(trimmed)
    ) {
        return 'dockerfile';
    }

    // Shell heuristic
    if (
        (trimmed.startsWith('#!') && (trimmed.includes('sh') && !trimmed.toLowerCase().includes('pwsh'))) ||
        /^\s*(export|alias|source|unset|readonly|shopt)\b/m.test(trimmed) ||
        /\b(if\s+\[\[|if\s+\[|case\s+\$.+\s+in)\b/.test(trimmed)
    ) {
        return 'shell';
    }

    // PowerShell heuristic
    if (
        (trimmed.startsWith('#!') && trimmed.toLowerCase().includes('powershell')) ||
        /^\s*#[^!]/m.test(trimmed) && (trimmed.includes('Get-') || trimmed.includes('Set-') || trimmed.includes('Write-')) ||
        /^\s*(param|begin|process|end|filter|workflow|parallel)\b/im.test(trimmed) ||
        /^\s*(\$[a-z_][a-z0-9_]*\s*=|\[[a-z0-9.]+\])/im.test(trimmed) ||
        (trimmed.includes('{') && trimmed.includes('}') && /\$[a-z_]/i.test(trimmed)) ||
        trimmed.startsWith('<#') || trimmed.startsWith('@"') || trimmed.startsWith("@'")
    ) {
        return 'powershell';
    }

    // HCL heuristic
    if (
        /^\s*(resource|variable|data|module|locals|output|terraform|provider)\b\s*["']?[a-z0-9_-]*["']?\s*["']?[a-z0-9_-]*["']?\s*\{/i.test(trimmed) ||
        (/^\s*[a-z0-9_-]+\s*\{/i.test(trimmed) && trimmed.includes('}') && trimmed.includes('=') && !trimmed.includes(';') && !trimmed.includes(':'))
    ) {
        return 'hcl';
    }

    // Makefile heuristic
    if (
        /^([a-z0-9_-]+):/im.test(trimmed) ||
        (/^\t[a-z0-9_-]+/im.test(text) && trimmed.includes(':')) ||
        /^[A-Z_]+ = /m.test(trimmed)
    ) {
        return 'makefile';
    }

    // Markdown heuristic
    if (
        /^\s*#\s+.+/m.test(trimmed) ||
        /^\s*```[a-z]*\s*$/m.test(trimmed) ||
        /^\s*\|.*\|.*\|/m.test(trimmed) ||
        /^\s*[-*+]\s+.+/m.test(trimmed) ||
        /\[.+\]\(.+\)/.test(trimmed)
    ) {
        return 'markdown';
    }

    // Nginx heuristic
    if (
        /^\s*(http|server|location|upstream|events)\b\s*\{/im.test(trimmed) ||
        /^\s*(listen|proxy_pass|root|index|server_name|include)\s+[^;]+;/im.test(trimmed)
    ) {
        return 'nginx';
    }

    // SQL heuristic
    if (
        /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|GRANT|REVOKE|USE)\b/im.test(trimmed) ||
        (/\bFROM\b/im.test(trimmed) && /\bWHERE\b/im.test(trimmed)) ||
        /\bCREATE\s+TABLE\b/im.test(trimmed)
    ) {
        return 'sql';
    }

    // LaTeX heuristic
    if (
        /^\s*\\documentclass\b/m.test(trimmed) ||
        /^\s*\\begin\{document\}/m.test(trimmed) ||
        /^\s*\\section\{/m.test(trimmed) ||
        /^\s*\\usepackage\{/m.test(trimmed) ||
        /\\begin\{[^}]+\}/.test(trimmed)
    ) {
        return 'latex';
    }

    // MDX heuristic
    if (
        (trimmed.startsWith('import ') || trimmed.includes('export const ')) &&
        (/#\s+.+/.test(trimmed) || /<[A-Z][a-zA-Z0-9]*/.test(trimmed))
    ) {
        return 'mdx';
    }

    // Log heuristic
    if (
        /^\[?(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}|\d{2}:\d{2}:\d{2}|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\]?/i.test(trimmed) ||
        /\b(INFO|DEBUG|WARN|WARNING|ERROR|FATAL|TRACE|CRITICAL)\b/i.test(trimmed)
    ) {
        return 'log';
    }

    // JavaScript heuristic: common keywords or arrow functions
    if (
        /\b(var|let|const|function|class|import|export|if|for|while|return)\b/.test(trimmed) ||
        /\s*=>\s*/.test(trimmed) ||
        (trimmed.includes('{') && trimmed.includes('}') && trimmed.includes(';'))
    ) {
        return 'javascript';
    }

    return 'unknown';
}

/**
 * Handle JSONC formatting and validation
 */
async function handleJSONC(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate JSONC using jsonc-parser
    const errors: ParseError[] = [];
    parse(text, errors);
    if (errors.length > 0) {
        const error = errors[0];
        const { line, character } = editor.document.positionAt(error.offset);
        validationMessage = `Invalid JSONC at line ${line + 1}, col ${character + 1}`;
    }

    /* eslint-disable */
    try {
        // Format JSONC using js-beautify's JS formatter (preserves comments)
        formatted = jsbeautify.js(text, {
            indent_size: 2,
            indent_char: ' ',
            max_preserve_newlines: 2,
            preserve_newlines: true,
            keep_array_indentation: false,
            break_chained_methods: false,
            brace_style: 'collapse',
            space_before_conditional: true,
            unescape_strings: false,
            jslint_happy: false,
            end_with_newline: false,
            wrap_line_length: 0,
            comma_first: false,
            e4x: true,
            indent_empty_lines: false
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format JSONC: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`JSONC has syntax issues but was beautified. Error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('JSONC formatted successfully!');
    }
}

/**
 * Handle JSON formatting and repair
 */
async function handleJSON(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let repairMessage: string | undefined;

    try {
        // Try standard JSON parse
        const parsed = JSON.parse(text);
        formatted = JSON.stringify(parsed, null, 2);
    } catch (originalError: any) {
        // If it fails, try to repair
        try {
            const repairedText = jsonrepair(text);
            const parsed = JSON.parse(repairedText);
            formatted = JSON.stringify(parsed, null, 2);
            repairMessage = originalError.message;
        } catch (repairError: any) {
            vscode.window.showErrorMessage(`Failed to format JSON. Original error: ${originalError.message}`);
            return;
        }
    }

    await applyEdit(editor, formatted);

    if (repairMessage) {
        vscode.window.showWarningMessage(`JSON was invalid but repaired. Original error: ${repairMessage}`);
    } else {
        vscode.window.showInformationMessage('JSON formatted successfully!');
    }
}

/**
 * Handle CSS formatting and validation
 */
async function handleCSS(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate CSS
    try {
        const obj = css.parse(text, { silent: true });
        if (obj.stylesheet && obj.stylesheet.parsingErrors && obj.stylesheet.parsingErrors.length > 0) {
            const firstError = obj.stylesheet.parsingErrors[0];
            validationMessage = `${firstError.reason} at line ${firstError.line}, col ${firstError.column}`;
            if (obj.stylesheet.parsingErrors.length > 1) {
                validationMessage += ` (and ${obj.stylesheet.parsingErrors.length - 1} more errors)`;
            }
        }
    } catch (e: any) {
        validationMessage = e.message;
    }

    /* eslint-disable */
    try {
        // Format CSS
        formatted = jsbeautify.css(text, {
            indent_size: 2,
            indent_char: ' ',
            selector_separator_newline: true,
            newline_between_rules: true,
            end_with_newline: false
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format CSS: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`CSS has syntax issues but was beautified. First error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('CSS formatted successfully!');
    }
}

/**
 * Handle SCSS formatting and validation
 */
async function handleSCSS(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate SCSS
    try {
        sass.compileString(text, { syntax: 'scss' });
    } catch (e: any) {
        if (e.span) {
            validationMessage = `${e.message.split('\n')[0]} at line ${e.span.start.line + 1}, col ${e.span.start.column + 1}`;
        } else {
            validationMessage = e.message;
        }
    }

    /* eslint-disable */
    try {
        // Format SCSS (js-beautify's CSS formatter handles SCSS nesting)
        formatted = jsbeautify.css(text, {
            indent_size: 2,
            indent_char: ' ',
            selector_separator_newline: true,
            newline_between_rules: true,
            end_with_newline: false
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format SCSS: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`SCSS has syntax issues but was beautified. First error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('SCSS formatted successfully!');
    }
}

/**
 * Handle LESS formatting and validation
 */
async function handleLESS(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate LESS
    try {
        await less.render(text);
    } catch (e: any) {
        if (e.line) {
            validationMessage = `${e.message} at line ${e.line}, col ${e.column}`;
        } else {
            validationMessage = e.message;
        }
    }

    /* eslint-disable */
    try {
        // Format LESS (js-beautify's CSS formatter handles LESS nesting and variables)
        formatted = jsbeautify.css(text, {
            indent_size: 2,
            indent_char: ' ',
            selector_separator_newline: true,
            newline_between_rules: true,
            end_with_newline: false
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format LESS: ${error.message}`);
        return;
    }
    /* eslint-enable */

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`LESS has syntax issues but was beautified. First error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('LESS formatted successfully!');
    }
}

/**
 * Handle SASS formatting and validation
 */
async function handleSASS(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate SASS
    try {
        sass.compileString(text, { syntax: 'indented' });
    } catch (e: any) {
        if (e.span) {
            validationMessage = `${e.message.split('\n')[0]} at line ${e.span.start.line + 1}, col ${e.span.start.column + 1}`;
        } else {
            validationMessage = e.message;
        }
    }

    try {
        // Format SASS
        formatted = SassFormatter.Format(text, {
            tabSize: 2,
            insertSpaces: true
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format SASS: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`SASS has syntax issues but was beautified. First error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('SASS formatted successfully!');
    }
}

/**
 * Handle XML formatting and validation
 */
async function handleXML(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate XML to find error location
    const result = XMLValidator.validate(text);
    if (result !== true) {
        validationMessage = `${result.err.msg} at line ${result.err.line}, col ${result.err.col}`;
    }

    try {
        // Format XML (xml-formatter is somewhat lenient and will try to fix issues)
        formatted = xmlFormatter(text, {
            indentation: '  ',
            collapseContent: true,
            lineSeparator: '\n'
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format XML: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`XML was invalid but beautified. Error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('XML formatted successfully!');
    }
}

/**
 * Handle SVG formatting and validation
 */
async function handleSVG(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate SVG (as XML)
    const result = XMLValidator.validate(text);
    if (result !== true) {
        validationMessage = `${result.err.msg} at line ${result.err.line}, col ${result.err.col}`;
    }

    try {
        // Try Prettier first (Industry Standard)
        formatted = await prettier.format(text, {
            parser: 'html',
            tabWidth: 2,
            printWidth: 80,
            htmlWhitespaceSensitivity: 'ignore'
        });
    } catch (prettierError) {
        // Fallback to resilient formatting if Prettier fails
        try {
            // Manual Deep Formatting
            let processedText = text;

            // Format <style> blocks
            processedText = processedText.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, content) => {
                try {
                    const formattedCSS = jsbeautify.css(content, { indent_size: 2 });
                    return match.replace(content, '\n' + formattedCSS + '\n');
                } catch (e) {
                    return match;
                }
            });

            // Format <script> blocks
            processedText = processedText.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (match, content) => {
                try {
                    const formattedJS = jsbeautify.js(content, { indent_size: 2 });
                    return match.replace(content, '\n' + formattedJS + '\n');
                } catch (e) {
                    return match;
                }
            });

            // Format XML structure
            // Use collapseContent: false to prevent collapsing our formatted blocks back into one line
            formatted = xmlFormatter(processedText, {
                indentation: '  ',
                collapseContent: false,
                lineSeparator: '\n',
                whiteSpaceAtEndOfSelfclosingTag: true
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to format SVG: ${error.message}`);
            return;
        }
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`SVG has syntax issues but was beautified. Error: ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('SVG formatted successfully!');
    }
}

/**
 * Apply the formatted text to the editor
 */
async function applyEdit(editor: vscode.TextEditor, newText: string) {
    const document = editor.document;
    const firstLine = document.lineAt(0);
    const lastLine = document.lineAt(document.lineCount - 1);
    const textRange = new vscode.Range(firstLine.range.start, lastLine.range.end);

    await editor.edit(editBuilder => {
        editBuilder.replace(textRange, newText);
    });
}

/**
 * Handle Liquid formatting and validation
 */
async function handleLiquid(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Liquid
    validationMessage = validateLiquid(text);

    // Resilient formatting logic
    try {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        let indentLevel = 0;

        // Void tags that don't need closing
        const voidTags = [
            'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
            'link', 'meta', 'param', 'source', 'track', 'wbr'
        ];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '') {
                formattedLines.push('');
                continue;
            }

            // Check for dedentation triggers at the start of the line
            let currentIndent = indentLevel;

            // Closing Liquid block: {% endif %}, {% endfor %}, etc.
            if (/^{%\s*end(if|unless|case|for|tablerow|capture|form|paginate|comment|schema|style|javascript|stylesheet)\b/.test(trimmed)) {
                currentIndent = Math.max(0, indentLevel - 1);
            }
            // Middle Liquid block: {% else %}, {% elsif %}, {% when %}
            else if (/^{%\s*(else|elsif|when)\b/.test(trimmed)) {
                currentIndent = Math.max(0, indentLevel - 1);
            }
            // Closing HTML tag: </div>
            else if (/^<\/[a-zA-Z0-9]+/.test(trimmed)) {
                currentIndent = Math.max(0, indentLevel - 1);
            }

            // Apply indentation
            formattedLines.push('  '.repeat(currentIndent) + trimmed);

            // Calculate indentation for the NEXT line
            let netChange = 0;

            // Remove comments for analysis
            const lineNoComments = line.replace(/{% comment %}[\s\S]*?{% endcomment %}/g, '').replace(/<!--[\s\S]*?-->/g, '');

            // Check for Liquid block openers/closers
            // {% if ... %}, {% for ... %}, etc.
            // Be careful with 'assign', 'increment', 'decrement', 'cycle', 'include', 'render', 'layout', 'section' (self-closing or inline)
            // Block tags: if, unless, case, for, tablerow, capture, form, paginate, comment, raw, schema, style, javascript, stylesheet
            const liquidTagRegex = /{%-?\s*([a-zA-Z0-9_]+)([^%]*?)-?%}/g;
            let liquidMatch;
            let liquidOpeners = 0;
            let liquidClosers = 0;

            while ((liquidMatch = liquidTagRegex.exec(lineNoComments)) !== null) {
                const tagName = liquidMatch[1];

                if (/^end/.test(tagName)) {
                    liquidClosers++;
                } else if (/^(if|unless|case|for|tablerow|capture|form|paginate|comment|schema|style|javascript|stylesheet)$/.test(tagName)) {
                    liquidOpeners++;
                }
            }

            // Check for HTML tag openers
            let htmlOpeners = 0;
            let htmlClosers = 0;

            const tagRegex = /<\/?([a-zA-Z0-9]+)[^>]*>/g;
            let match;
            while ((match = tagRegex.exec(lineNoComments)) !== null) {
                const fullTag = match[0];
                const tagName = match[1].toLowerCase();
                const isClosing = fullTag.startsWith('</');
                const isSelfClosing = fullTag.endsWith('/>');

                if (isClosing) {
                    htmlClosers++;
                } else if (!isSelfClosing && !voidTags.includes(tagName)) {
                    htmlOpeners++;
                }
            }

            netChange = (liquidOpeners - liquidClosers) + (htmlOpeners - htmlClosers);
            indentLevel = Math.max(0, indentLevel + netChange);
        }

        formatted = formattedLines.join('\n');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Liquid: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Liquid has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Liquid formatted successfully!');
    }
}

/**
 * Custom resilient Liquid validator
 */
function validateLiquid(text: string): string | undefined {
    const stack: { tag: string, line: number, type: 'liquid' | 'html' }[] = [];
    const lines = text.split('\n');

    const voidTags = [
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
    ];

    // Block tags that need closing
    const blockTags = [
        'if', 'unless', 'case', 'for', 'tablerow', 'capture', 'form',
        'paginate', 'comment', 'schema', 'style', 'javascript', 'stylesheet'
    ];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Remove comments (simple heuristic)
        const lineNoComments = line.replace(/<!--[\s\S]*?-->/g, '');

        // Regex for tags
        // ({%\s*(block_tag)\b)|({%\s*end(block_tag)\b)|(<\/?([a-zA-Z0-9]+)[^>]*>)
        const regex = /({%-?\s*([a-zA-Z0-9_]+)[^%]*?-?%})|(<\/?([a-zA-Z0-9]+)[^>]*>)/g;
        let match;

        while ((match = regex.exec(lineNoComments)) !== null) {
            if (match[1]) { // Liquid Tag
                const tagName = match[2];

                if (tagName.startsWith('end')) {
                    const baseName = tagName.substring(3);
                    if (stack.length === 0) {
                        return `Unexpected closing block {% ${tagName} %} at line ${i + 1}`;
                    }
                    const last = stack.pop()!;
                    if (last.type !== 'liquid' || last.tag !== baseName) {
                        return `Mismatched closing block {% ${tagName} %} at line ${i + 1} (expected {% end${last.tag} %} for ${last.tag} from line ${last.line})`;
                    }
                } else if (blockTags.includes(tagName)) {
                    stack.push({ tag: tagName, line: i + 1, type: 'liquid' });
                }
            } else if (match[3]) { // HTML Tag
                const fullTag = match[3];
                const tagName = match[4].toLowerCase();
                const isClosing = fullTag.startsWith('</');
                const isSelfClosing = fullTag.endsWith('/>');

                if (isSelfClosing || voidTags.includes(tagName)) {
                    continue;
                }

                if (isClosing) {
                    if (stack.length === 0) {
                        return `Unexpected closing tag </${tagName}> at line ${i + 1}`;
                    }
                    const last = stack.pop()!;
                    // If we find a Liquid block, it means invalid nesting
                    if (last.type === 'liquid') {
                         return `Mismatched closing tag </${tagName}> at line ${i + 1} (expected {% end${last.tag} %} from line ${last.line})`;
                    }
                    if (last.tag !== tagName) {
                        return `Mismatched closing tag </${tagName}> at line ${i + 1} (expected </${last.tag}> from line ${last.line})`;
                    }
                } else {
                    stack.push({ tag: tagName, line: i + 1, type: 'html' });
                }
            }
        }
    }

    if (stack.length > 0) {
        const last = stack.pop()!;
        if (last.type === 'liquid') {
            return `Unclosed block {% ${last.tag} %} starting at line ${last.line}`;
        } else {
            return `Unclosed tag <${last.tag}> starting at line ${last.line}`;
        }
    }

    return undefined;
}

/**
 * Handle Astro formatting and validation
 */
async function handleAstro(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Astro
    validationMessage = validateAstro(text);

    // Resilient formatting logic
    try {
        // Astro structure:
        // ---
        // frontmatter (TS/JS)
        // ---
        // template (HTML/JSX-like)

        const frontmatterRegex = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/m;
        const match = text.match(frontmatterRegex);

        let frontmatter = '';
        let template = text;
        let frontmatterRaw = '';

        if (match) {
            frontmatterRaw = match[0];
            const content = match[1];
            // Format frontmatter as TypeScript
            // Use js-beautify.js
            /* eslint-disable */
            const formattedContent = jsbeautify.js(content, {
                indent_size: 2,
                indent_char: ' ',
                max_preserve_newlines: 2,
                preserve_newlines: true,
                keep_array_indentation: false,
                break_chained_methods: false,
                brace_style: 'collapse',
                space_before_conditional: true,
                unescape_strings: false,
                jslint_happy: false,
                end_with_newline: false,
                wrap_line_length: 0,
                comma_first: false,
                e4x: true,
                indent_empty_lines: false
            });
            /* eslint-enable */
            frontmatter = `---\n${formattedContent}\n---`;
            template = text.substring(frontmatterRaw.length).trim();
        }

        // Format template as HTML (with some JSX awareness)
        // We use js-beautify.html, similar to Svelte/Vue
        /* eslint-disable */
        const options: any = {
            indent_size: 2,
            indent_char: ' ',
            max_preserve_newlines: 2,
            preserve_newlines: true,
            indent_scripts: 'normal',
            end_with_newline: false,
            wrap_line_length: 0,
            indent_inner_html: false,
            js: {
                indent_size: 2,
                indent_char: ' ',
                max_preserve_newlines: 2,
                preserve_newlines: true,
                keep_array_indentation: false,
                break_chained_methods: false,
                brace_style: 'collapse',
                space_before_conditional: true,
                unescape_strings: false,
                jslint_happy: false,
                end_with_newline: false,
                wrap_line_length: 0,
                comma_first: false,
                e4x: true,
                indent_empty_lines: false
            },
            css: {
                indent_size: 2,
                indent_char: ' ',
                selector_separator_newline: true,
                newline_between_rules: true,
                end_with_newline: false
            }
        };
        const formattedTemplate = jsbeautify.html(template, options);
        /* eslint-enable */

        if (frontmatter) {
            formatted = `${frontmatter}\n\n${formattedTemplate}`;
        } else {
            formatted = formattedTemplate;
        }

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Astro: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Astro has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Astro formatted successfully!');
    }
}

/**
 * Custom resilient Astro validator
 */
function validateAstro(text: string): string | undefined {
    // Check for frontmatter
    const trimmed = text.trim();
    if (trimmed.startsWith('---')) {
        const parts = text.split('---');
        // Valid frontmatter should result in at least 3 parts (empty pre, content, post)
        // Or if it's the only thing, 2 parts?
        // text: "---\nfoo\n---" -> ["", "\nfoo\n", ""]
        if (parts.length < 3) {
            return "Unclosed frontmatter (missing closing '---')";
        }
    }

    // Basic HTML validation for template
    const lines = text.split('\n');
    let inFrontmatter = false;
    if (trimmed.startsWith('---')) {
        inFrontmatter = true;
    }

    const stack: { tag: string, line: number }[] = [];
    const voidTags = [
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
    ];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (inFrontmatter) {
            if (line.trim() === '---' && i > 0) {
                inFrontmatter = false;
            }
            continue;
        }

        // Simple tag matching
        // <Tag>, </Tag>, <Tag />, <Component />
        const regex = /<\/?([a-zA-Z0-9.\-_]+)[^>]*>/g;
        let match;
        while ((match = regex.exec(line)) !== null) {
            const fullTag = match[0];
            const tagName = match[1];
            const isClosing = fullTag.startsWith('</');
            const isSelfClosing = fullTag.endsWith('/>');

            if (isSelfClosing || voidTags.includes(tagName.toLowerCase())) {
                continue;
            }

            if (isClosing) {
                if (stack.length === 0) {
                    return `Unexpected closing tag </${tagName}> at line ${i + 1}`;
                }
                const last = stack.pop()!;
                if (last.tag !== tagName) {
                     return `Mismatched closing tag </${tagName}> at line ${i + 1} (expected </${last.tag}> from line ${last.line})`;
                }
            } else {
                stack.push({ tag: tagName, line: i + 1 });
            }
        }
    }

    if (stack.length > 0) {
        const last = stack.pop()!;
        return `Unclosed tag <${last.tag}> starting at line ${last.line}`;
    }

    return undefined;
}

/**
 * This method is called when the extension is deactivated
 */
export function deactivate() {}
