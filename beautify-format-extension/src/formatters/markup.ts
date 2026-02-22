import * as vscode from 'vscode';
import { applyEdit } from '../utils';
import { formatPythonDeep } from './python_deep_formatter';
import { formatMarkdownDeep } from './markdown_deep_formatter';
import { formatMDXDeep } from './mdx_deep_formatter';
import { formatAstroDeep } from './astro_deep_formatter';
import { formatLaTeXDeep } from './latex_deep_formatter';
import { formatHandlebarsDeep } from './handlebars_deep_formatter';
import { formatTwigDeep } from './twig_deep_formatter';
import { formatLiquidDeep } from './liquid_deep_formatter';

/**
 * Handle Markdown formatting and validation
 */
export async function handleMarkdown(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Markdown
    validationMessage = validateMarkdown(text);

    // Try Deep Formatting with Prettier (Standard Style)
    try {
        const prettier = await import('prettier');

        formatted = await prettier.format(text, {
            parser: "markdown",
            tabWidth: 2,
            useTabs: false,
            proseWrap: "preserve", // Don't enforce line wrapping unless user wants it (safer default)
            printWidth: 80,
        });
    } catch (prettierError: any) {
        console.warn('Prettier Markdown formatting failed, falling back to custom formatter', prettierError);

        // Resilient formatting logic (Deep Formatting Fallback)
        try {
            formatted = formatMarkdownDeep(text);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to format Markdown: ${error.message}`);
            return;
        }

        if (!validationMessage) {
            validationMessage = "Deep formatting (Prettier) failed. Applied resilient deep formatting.";
        }
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Markdown has potential issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Markdown formatted successfully!');
    }
}

/**
 * Custom resilient Markdown validator
 */
function validateMarkdown(text: string): string | undefined {
    let inCodeBlock = false;
    let codeBlockLine = 0;
    let inTable = false;
    let tableStartLine = 0;
    let tableColumnCount = 0;
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.startsWith('```')) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                codeBlockLine = i + 1;
            } else {
                inCodeBlock = false;
            }
            continue;
        }

        if (inCodeBlock) continue;

        if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
            const cells = trimmed.split('|').slice(1, -1);
            if (!inTable) {
                inTable = true;
                tableStartLine = i + 1;
                tableColumnCount = cells.length;
            } else {
                if (cells.length !== tableColumnCount) {
                    // Only report if it's not the separator line which might have different splitting if not careful
                    // but usually it should have the same number of pipes.
                    // Actually, let's be lenient on separators but strict on data rows.
                    const isSeparator = cells.every(cell => /^\s*:?-+:?\s*$/.test(cell));
                    if (!isSeparator) {
                        return `Inconsistent column count in table at line ${i + 1} (expected ${tableColumnCount}, got ${cells.length})`;
                    }
                }
            }
        } else {
            inTable = false;
        }
    }

    if (inCodeBlock) {
        return `Unclosed code block starting at line ${codeBlockLine}`;
    }

    return undefined;
}

/**
 * Handle MDX formatting and validation
 */
export async function handleMDX(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate MDX
    validationMessage = validateMDX(text);

    // Try Deep Formatting with Prettier (Standard Style)
    try {
        const prettier = await import('prettier');

        formatted = await prettier.format(text, {
            parser: "mdx",
            tabWidth: 2,
            useTabs: false,
            proseWrap: "preserve",
            printWidth: 80,
            singleQuote: false,
            jsxSingleQuote: false,
            bracketSpacing: true
        });
    } catch (prettierError: any) {
        console.warn('Prettier MDX formatting failed, falling back to custom formatter', prettierError);

        // Resilient formatting logic (Deep Formatting Fallback)
        try {
            formatted = formatMDXDeep(text);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to format MDX: ${error.message}`);
            return;
        }

        if (!validationMessage) {
            validationMessage = "Deep formatting (Prettier) failed. Applied resilient formatting.";
        }
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`MDX has potential issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('MDX formatted successfully!');
    }
}

/**
 * Custom resilient MDX validator
 */
function validateMDX(text: string): string | undefined {
    let inCodeBlock = false;
    let codeBlockLine = 0;
    const jsxStack: { tag: string, line: number }[] = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.startsWith('```')) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                codeBlockLine = i + 1;
            } else {
                inCodeBlock = false;
            }
            continue;
        }

        if (inCodeBlock) continue;

        // Basic JSX tag tracking
        const tagMatches = line.matchAll(/<(\/)?([a-zA-Z][a-zA-Z0-9]*)[^>]*(\/)?>/g);
        for (const match of tagMatches) {
            const isClosing = match[1] === '/';
            const tagName = match[2];
            const isSelfClosing = match[3] === '/';

            if (isSelfClosing) continue;

            if (isClosing) {
                if (jsxStack.length === 0) {
                    return `Unexpected closing tag </${tagName}> at line ${i + 1}`;
                }
                const last = jsxStack.pop()!;
                if (last.tag !== tagName) {
                    return `Mismatched closing tag </${tagName}> at line ${i + 1} (expected </${last.tag}> from line ${last.line})`;
                }
            } else {
                jsxStack.push({ tag: tagName, line: i + 1 });
            }
        }
    }

    if (inCodeBlock) {
        return `Unclosed code block starting at line ${codeBlockLine}`;
    }

    if (jsxStack.length > 0) {
        const last = jsxStack.pop()!;
        return `Unclosed JSX tag <${last.tag}> starting at line ${last.line}`;
    }

    return undefined;
}

/**
 * Handle LaTeX formatting and validation
 */
export async function handleLaTeX(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate LaTeX
    validationMessage = validateLaTeX(text);

    // Resilient Deep Formatting logic
    try {
        formatted = formatLaTeXDeep(text);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format LaTeX: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`LaTeX has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('LaTeX formatted successfully!');
    }
}

/**
 * Custom resilient LaTeX validator
 */
function validateLaTeX(text: string): string | undefined {
    const stack: { env: string, line: number, col: number }[] = [];
    const braceStack: { line: number, col: number }[] = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];

            if (char === '%') {
                break; // Comment starts
            }

            if (char === '\\') {
                // Check if it's a structural command
                const remaining = line.substring(j);
                if (remaining.startsWith('\\begin{')) {
                    const endIdx = line.indexOf('}', j + 7);
                    if (endIdx !== -1) {
                        const envName = line.substring(j + 7, endIdx);
                        stack.push({ env: envName, line: i + 1, col: j + 1 });
                        j = endIdx;
                        continue;
                    }
                } else if (remaining.startsWith('\\end{')) {
                    const endIdx = line.indexOf('}', j + 5);
                    if (endIdx !== -1) {
                        const envName = line.substring(j + 5, endIdx);
                        if (stack.length === 0) {
                            return `Unexpected \\end{${envName}} at line ${i + 1}, col ${j + 1}`;
                        }
                        const last = stack.pop()!;
                        if (last.env !== envName) {
                            return `Mismatched \\end{${envName}} at line ${i + 1}, col ${j + 1} (expected closure for \\begin{${last.env}} from line ${last.line})`;
                        }
                        j = endIdx;
                        continue;
                    }
                }
                // Otherwise it's just a command or escaped char, skip next char
                j++;
                continue;
            }

            // Braces
            if (char === '{') {
                braceStack.push({ line: i + 1, col: j + 1 });
            } else if (char === '}') {
                if (braceStack.length > 0) {
                    braceStack.pop();
                }
            }
        }
    }

    if (stack.length > 0) {
        const last = stack.pop()!;
        return `Unclosed environment \\begin{${last.env}} starting at line ${last.line}`;
    }

    if (braceStack.length > 0) {
        const last = braceStack.pop()!;
        return `Unclosed brace '{' starting at line ${last.line}`;
    }

    return undefined;
}

/**
 * Handle Astro formatting and validation
 */
export async function handleAstro(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Astro
    validationMessage = validateAstro(text);

    // Deep Formatting with Prettier (Standard Style)
    try {
        const prettier = await import('prettier');
        const astroPlugin = require.resolve('prettier-plugin-astro');

        formatted = await prettier.format(text, {
            parser: 'astro',
            plugins: [astroPlugin],
            tabWidth: 2,
            useTabs: false,
            printWidth: 80,
            singleQuote: false,
            bracketSameLine: false
        });
    } catch (prettierError: any) {
        console.warn('Prettier Astro formatting failed, falling back to custom formatter', prettierError);

        // Resilient formatting logic (Fallback)
        try {
            // Use Custom Deep Formatter (Resilient + Alignment)
            formatted = formatAstroDeep(text, {
                tabSize: 2,
                insertSpaces: true
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to format Astro: ${error.message}`);
            return;
        }

        if (!validationMessage) {
            validationMessage = "Deep formatting (Prettier) failed. Applied resilient formatting.";
        }
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
 * Handle Handlebars formatting and validation
 */
export async function handleHandlebars(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Handlebars
    validationMessage = validateHandlebars(text);

    // Deep Formatting logic (Prettier)
    try {
        const prettier = await import('prettier');

        formatted = await prettier.format(text, {
            parser: 'glimmer',
            tabWidth: 2,
            useTabs: false,
            printWidth: 80,
            singleQuote: false,
            bracketSameLine: false
        });
    } catch (prettierError: any) {
        console.warn('Prettier Handlebars formatting failed, falling back to custom formatter', prettierError);

        // Resilient formatting logic (Fallback)
        try {
            // Use Custom Deep Formatter (Resilient + Alignment)
            formatted = formatHandlebarsDeep(text, {
                tabSize: 2,
                insertSpaces: true
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to format Handlebars: ${error.message}`);
            return;
        }

        if (!validationMessage) {
            validationMessage = "Deep formatting (Prettier) failed. Applied resilient formatting.";
        }
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Handlebars has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Handlebars formatted successfully!');
    }
}

/**
 * Custom resilient Handlebars validator
 */
function validateHandlebars(text: string): string | undefined {
    const stack: { tag: string, line: number, type: 'hbs' | 'html' }[] = [];
    const lines = text.split('\n');

    // Void tags that don't need closing
    const voidTags = [
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
    ];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Remove comments
        const lineNoComments = line.replace(/{{!--[\s\S]*?--}}/g, '').replace(/{{![\s\S]*?}}/g, '').replace(/<!--[\s\S]*?-->/g, '');

        // Find all tags in order
        const regex = /({{#([a-zA-Z0-9_.-]+)[^}]*}})|({{\/([a-zA-Z0-9_.-]+)}})|(<\/?([a-zA-Z0-9]+)[^>]*>)/g;
        let match;

        while ((match = regex.exec(lineNoComments)) !== null) {
            if (match[1]) { // Handlebars Open: {{#name ...}}
                const tagName = match[2];
                stack.push({ tag: tagName, line: i + 1, type: 'hbs' });
            } else if (match[3]) { // Handlebars Close: {{/name}}
                const tagName = match[4];
                if (stack.length === 0) {
                    return `Unexpected closing block {{/${tagName}}} at line ${i + 1}`;
                }
                const last = stack.pop()!;
                if (last.type !== 'hbs' || last.tag !== tagName) {
                    return `Mismatched closing block {{/${tagName}}} at line ${i + 1} (expected {{/${last.tag}}} from line ${last.line})`;
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
                    // Try to match with the last HTML tag, skipping any HBS blocks that might be interleaved
                    // (though valid HBS usually nests strictly)
                    // But for resilience, let's just look at the stack top
                    if (stack.length === 0) {
                        return `Unexpected closing tag </${tagName}> at line ${i + 1}`;
                    }
                    const last = stack.pop()!;
                    // If we find an HBS block, it means we have something like {{#if}} </div> {{/if}} which is invalid nesting
                    if (last.type === 'hbs') {
                         return `Mismatched closing tag </${tagName}> at line ${i + 1} (expected {{/${last.tag}}} from line ${last.line})`;
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
        if (last.type === 'hbs') {
            return `Unclosed block {{#${last.tag}}} starting at line ${last.line}`;
        } else {
            return `Unclosed tag <${last.tag}> starting at line ${last.line}`;
        }
    }

    return undefined;
}

/**
 * Handle Twig formatting and validation
 */
export async function handleTwig(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Twig
    validationMessage = validateTwig(text);

    // Deep Formatting logic (Prettier)
    try {
        const prettier = await import('prettier');
        const twigPluginPath = require.resolve('@sanderjn/prettier-plugin-twig-melody');

        formatted = await prettier.format(text, {
            parser: 'melody',
            plugins: [twigPluginPath],
            tabWidth: 2,
            useTabs: false,
            printWidth: 80,
            singleQuote: false,
            bracketSameLine: false
        });
    } catch (prettierError: any) {
        console.warn('Prettier Twig formatting failed, falling back to custom formatter', prettierError);

        // Resilient formatting logic
        try {
            formatted = formatTwigDeep(text);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to format Twig: ${error.message}`);
            return;
        }

        if (!validationMessage) {
            validationMessage = "Deep formatting (Prettier) failed. Applied resilient formatting.";
        }
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Twig has syntax issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Twig formatted successfully!');
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
 * Handle Liquid formatting and validation
 */
export async function handleLiquid(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate Liquid
    validationMessage = validateLiquid(text);

    // Deep Formatting logic (Prettier)
    try {
        const prettier = await import('prettier');
        const liquidPluginPath = require.resolve('@shopify/prettier-plugin-liquid');

        formatted = await prettier.format(text, {
            parser: 'liquid-html',
            plugins: [liquidPluginPath],
            tabWidth: 2,
            useTabs: false,
            printWidth: 80,
            singleQuote: false,
            bracketSameLine: false
        });
    } catch (prettierError: any) {
        console.warn('Prettier Liquid formatting failed, falling back to custom formatter', prettierError);

        // Resilient formatting logic
        try {
            formatted = formatLiquidDeep(text);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to format Liquid: ${error.message}`);
            return;
        }

        if (!validationMessage) {
            validationMessage = "Deep formatting (Prettier) failed. Applied resilient formatting.";
        }
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
 * Handle Jupyter Notebook (.ipynb) formatting and validation
 */
export async function handleIPYNB(editor: vscode.TextEditor, text: string) {
    let formatted: string;
    let validationMessage: string | undefined;

    // Validate IPYNB
    validationMessage = validateIPYNB(text);

    // Lazy load dependencies
    const { jsonrepair } = require('jsonrepair');

    try {
        let notebook: any;
        try {
            notebook = JSON.parse(text);
        } catch (e) {
            // Fault-tolerance: try to repair JSON if parsing fails
            const repairedText = jsonrepair(text);
            notebook = JSON.parse(repairedText);
        }

        // Deep Formatting for Cells
        if (notebook.cells && Array.isArray(notebook.cells)) {
            // We need Prettier for Markdown cells
            let prettier: any;
            try {
                prettier = await import('prettier');
            } catch (e) {
                console.warn('Prettier not available for Markdown cells inside Notebook.');
            }

            for (const cell of notebook.cells) {
                if (cell.source) {
                    let source = '';
                    let isArray = Array.isArray(cell.source);

                    if (isArray) {
                        source = cell.source.join('');
                    } else {
                        source = cell.source;
                    }

                    let formattedSource = source;

                    if (cell.cell_type === 'code') {
                        try {
                            formattedSource = formatPythonDeep(source);
                        } catch (e: any) {
                            console.warn('Failed to format Python cell:', e);
                        }
                    } else if (cell.cell_type === 'markdown' && prettier) {
                        try {
                            formattedSource = await prettier.format(source, {
                                parser: "markdown",
                                tabWidth: 2,
                                useTabs: false,
                                proseWrap: "preserve",
                                printWidth: 80,
                            });
                        } catch (e: any) {
                            console.warn('Failed to format Markdown cell:', e);
                        }
                    }

                    // Convert back to array of strings if needed (Jupyter convention: lines end with \n)
                    if (isArray) {
                        const lines = formattedSource.split('\n');
                        cell.source = lines.map((line, i) => {
                            if (i < lines.length - 1) {
                                return line + '\n';
                            }
                            return line;
                        });
                    } else {
                        cell.source = formattedSource;
                    }
                }
            }
        }

        // Jupyter notebooks standardly use 1-space indentation for JSON
        formatted = JSON.stringify(notebook, null, 1);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format Jupyter Notebook: ${error.message}`);
        return;
    }

    await applyEdit(editor, formatted);

    if (validationMessage) {
        vscode.window.showWarningMessage(`Jupyter Notebook has potential issues but was beautified. ${validationMessage}`);
    } else {
        vscode.window.showInformationMessage('Jupyter Notebook formatted successfully!');
    }
}

/**
 * Custom resilient Jupyter Notebook validator
 */
function validateIPYNB(text: string): string | undefined {
    try {
        const notebook = JSON.parse(text);
        if (!notebook.cells || !Array.isArray(notebook.cells)) {
            return "Missing 'cells' array in notebook structure.";
        }
        if (notebook.nbformat === undefined) {
            return "Missing 'nbformat' in notebook metadata.";
        }
    } catch (e: any) {
        return `Invalid JSON structure: ${e.message}`;
    }
    return undefined;
}
