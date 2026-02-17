import * as vscode from 'vscode';
import { detectFormat } from './detector';
import { detectDelimiter } from './utils';

// Import formatters
import * as Web from './formatters/web';
import * as JsTs from './formatters/js_ts';
import * as DataConfig from './formatters/data_config';
import * as Scripting from './formatters/scripting_compiled';
import * as Misc from './formatters/misc';
import * as Markup from './formatters/markup';

/**
 * This method is called when the extension is activated
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Beautify Format extension is now active!');

    // Register unified beautify command
    let beautifyCommand = vscode.commands.registerCommand('beautify-format.beautify', () => {
        beautify();
    });

    context.subscriptions.push(beautifyCommand);

    const register = (cmd: string, format: string) => {
        context.subscriptions.push(vscode.commands.registerCommand(cmd, () => beautify(format as any)));
    };

    // Web
    register('beautify-format.formatXML', 'xml');
    register('beautify-format.formatSVG', 'svg');
    register('beautify-format.formatHTML', 'html');
    register('beautify-format.formatCSS', 'css');
    register('beautify-format.formatSCSS', 'scss');
    register('beautify-format.formatSASS', 'sass');
    register('beautify-format.formatLESS', 'less');
    register('beautify-format.formatVue', 'vue');
    register('beautify-format.formatSvelte', 'svelte');
    register('beautify-format.formatPHP', 'php');

    // JS/TS
    register('beautify-format.formatJS', 'javascript');
    register('beautify-format.formatTS', 'typescript');
    register('beautify-format.formatJSX', 'jsx');
    register('beautify-format.formatTSX', 'tsx');
    register('beautify-format.formatJSON', 'json');
    register('beautify-format.formatJSONC', 'jsonc');

    // Data/Config
    register('beautify-format.formatYAML', 'yaml');
    register('beautify-format.formatTOML', 'toml');
    register('beautify-format.formatINI', 'ini');
    register('beautify-format.formatENV', 'env');
    register('beautify-format.formatCSV', 'csv');
    register('beautify-format.formatSQL', 'sql');
    register('beautify-format.formatGraphQL', 'graphql');
    register('beautify-format.formatPrisma', 'prisma');
    register('beautify-format.formatMongoDB', 'mongodb');

    // Scripting/Compiled
    register('beautify-format.formatPython', 'python');
    register('beautify-format.formatRuby', 'ruby');
    register('beautify-format.formatShell', 'shell');
    register('beautify-format.formatPowerShell', 'powershell');
    register('beautify-format.formatDart', 'dart');
    register('beautify-format.formatGo', 'go');
    register('beautify-format.formatRust', 'rust');
    register('beautify-format.formatCPP', 'cpp');
    register('beautify-format.formatCSharp', 'csharp');
    register('beautify-format.formatJava', 'java');
    register('beautify-format.formatKotlin', 'kotlin');
    register('beautify-format.formatSwift', 'swift');

    // Misc
    register('beautify-format.formatDockerfile', 'dockerfile');
    register('beautify-format.formatNginx', 'nginx');
    register('beautify-format.formatMakefile', 'makefile');
    register('beautify-format.formatHCL', 'hcl');
    register('beautify-format.formatGitConfig', 'gitconfig');
    register('beautify-format.formatEditorConfig', 'editorconfig');
    register('beautify-format.formatLog', 'log');

    // Markup
    register('beautify-format.formatMarkdown', 'markdown');
    register('beautify-format.formatMDX', 'mdx');
    register('beautify-format.formatLaTeX', 'latex');
    register('beautify-format.formatAstro', 'astro');
    register('beautify-format.formatHandlebars', 'handlebars');
    register('beautify-format.formatTwig', 'twig');
    register('beautify-format.formatLiquid', 'liquid');
    register('beautify-format.formatIPYNB', 'ipynb');
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

    // Web
    if (format === 'xml') await Web.handleXML(editor, text);
    else if (format === 'svg') await Web.handleSVG(editor, text);
    else if (format === 'html') await Web.handleHTML(editor, text);
    else if (format === 'css') await Web.handleCSS(editor, text);
    else if (format === 'scss') await Web.handleSCSS(editor, text);
    else if (format === 'sass') await Web.handleSASS(editor, text);
    else if (format === 'less') await Web.handleLESS(editor, text);
    else if (format === 'vue') await Web.handleVue(editor, text);
    else if (format === 'svelte') await Web.handleSvelte(editor, text);
    else if (format === 'php') await Web.handlePHP(editor, text);

    // JS/TS
    else if (format === 'javascript') await JsTs.handleJS(editor, text);
    else if (format === 'typescript') await JsTs.handleTS(editor, text);
    else if (format === 'jsx') await JsTs.handleJSX(editor, text);
    else if (format === 'tsx') await JsTs.handleTSX(editor, text);
    else if (format === 'json') await JsTs.handleJSON(editor, text);
    else if (format === 'jsonc') await JsTs.handleJSONC(editor, text);

    // Data/Config
    else if (format === 'yaml') await DataConfig.handleYAML(editor, text);
    else if (format === 'toml') await DataConfig.handleTOML(editor, text);
    else if (format === 'ini') await DataConfig.handleINI(editor, text);
    else if (format === 'env') await DataConfig.handleENV(editor, text);
    else if (format === 'csv') await DataConfig.handleCSV(editor, text);
    else if (format === 'sql') await DataConfig.handleSQL(editor, text);
    else if (format === 'graphql') await DataConfig.handleGraphQL(editor, text);
    else if (format === 'prisma') await DataConfig.handlePrisma(editor, text);
    else if (format === 'mongodb') await DataConfig.handleMongoDB(editor, text);

    // Scripting/Compiled
    else if (format === 'python') await Scripting.handlePython(editor, text);
    else if (format === 'ruby') await Scripting.handleRuby(editor, text);
    else if (format === 'shell') await Scripting.handleShell(editor, text);
    else if (format === 'powershell') await Scripting.handlePowerShell(editor, text);
    else if (format === 'dart') await Scripting.handleDart(editor, text);
    else if (format === 'go') await Scripting.handleGo(editor, text);
    else if (format === 'rust') await Scripting.handleRust(editor, text);
    else if (format === 'cpp') await Scripting.handleCPP(editor, text);
    else if (format === 'csharp') await Scripting.handleCSharp(editor, text);
    else if (format === 'java') await Scripting.handleJava(editor, text);
    else if (format === 'kotlin') await Scripting.handleKotlin(editor, text);
    else if (format === 'swift') await Scripting.handleSwift(editor, text);

    // Misc
    else if (format === 'dockerfile') await Misc.handleDockerfile(editor, text);
    else if (format === 'nginx') await Misc.handleNginx(editor, text);
    else if (format === 'makefile') await Misc.handleMakefile(editor, text);
    else if (format === 'hcl') await Misc.handleHCL(editor, text);
    else if (format === 'gitconfig') await Misc.handleGitConfig(editor, text);
    else if (format === 'editorconfig') await Misc.handleEditorConfig(editor, text);
    else if (format === 'log') await Misc.handleLog(editor, text);

    // Markup
    else if (format === 'markdown') await Markup.handleMarkdown(editor, text);
    else if (format === 'mdx') await Markup.handleMDX(editor, text);
    else if (format === 'latex') await Markup.handleLaTeX(editor, text);
    else if (format === 'astro') await Markup.handleAstro(editor, text);
    else if (format === 'handlebars') await Markup.handleHandlebars(editor, text);
    else if (format === 'twig') await Markup.handleTwig(editor, text);
    else if (format === 'liquid') await Markup.handleLiquid(editor, text);
    else if (format === 'ipynb') await Markup.handleIPYNB(editor, text);

    else {
        // If unknown, try JSON first then CSS/XML/HTML
        try {
            const { jsonrepair } = require('jsonrepair');
            jsonrepair(text);
            await JsTs.handleJSON(editor, text);
        } catch (e) {
            const trimmed = text.trim();
            if (trimmed.startsWith('<')) {
                const lowerText = trimmed.toLowerCase();
                if (lowerText.startsWith('<!doctype html') || lowerText.startsWith('<html')) {
                    await Web.handleHTML(editor, text);
                } else {
                    await Web.handleXML(editor, text);
                }
            } else if (trimmed.includes('{') && trimmed.includes('}')) {
                await Web.handleCSS(editor, text);
            } else if (trimmed.startsWith('---') || /^[a-z0-9_-]+:\s/m.test(trimmed)) {
                await DataConfig.handleYAML(editor, text);
            } else if (trimmed.startsWith('[') || /^[a-z0-9_-]+\s*[=:]\s*/m.test(trimmed) || trimmed.startsWith(';') || trimmed.startsWith('#')) {
                // Heuristic for INI vs TOML vs ENV
                if (trimmed.includes(';') || (trimmed.includes(':') && !trimmed.includes('='))) {
                    await DataConfig.handleINI(editor, text);
                } else if (trimmed.startsWith('[') || (trimmed.includes('=') && !/^(export\s+)?[a-z_][a-z0-9_]*\s*=/i.test(trimmed))) {
                    await DataConfig.handleTOML(editor, text);
                } else {
                    await DataConfig.handleENV(editor, text);
                }
            } else if (detectDelimiter(trimmed) !== ',' || trimmed.includes(',')) {
                // Heuristic for CSV
                await DataConfig.handleCSV(editor, text);
            } else {
                vscode.window.showErrorMessage('Could not detect format (JSON, XML, HTML, CSS, YAML, TOML, INI, ENV or CSV). Please ensure your file starts with {, [, < or has key: value pairs');
            }
        }
    }
}

// Re-export detectFormat for compatibility
export { detectFormat };

/**
 * This method is called when the extension is deactivated
 */
export function deactivate() {}
