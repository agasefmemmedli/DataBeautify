import { detectDelimiter, splitCSVLine } from './utils';

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
