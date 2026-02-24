"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatPHPDeep = formatPHPDeep;
const php_tokenizer_1 = require("./php_tokenizer");
function formatPHPDeep(code, options = {}) {
    const tabSize = options.tabSize || 4;
    const insertSpaces = options.insertSpaces !== false;
    const indentString = insertSpaces ? ' '.repeat(tabSize) : '\t';
    const tokenizer = new php_tokenizer_1.PHPTokenizer(code);
    const tokens = tokenizer.tokenize().filter(t => t.type !== php_tokenizer_1.TokenType.Whitespace);
    const formattedLines = [];
    let currentLineTokens = [];
    let indentLevel = 0;
    const peekNextCode = (index) => {
        for (let j = index + 1; j < tokens.length; j++) {
            if (tokens[j].type !== php_tokenizer_1.TokenType.Comment) {
                return tokens[j];
            }
        }
        return null;
    };
    let importBuffer = [];
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const prev = i > 0 ? tokens[i - 1] : null;
        // Handle Imports
        if (token.type === php_tokenizer_1.TokenType.Keyword && token.text === 'use' && (!prev || prev.text !== ')')) {
            let stmtTokens = [token];
            let j = i + 1;
            let hasSemicolon = false;
            while (j < tokens.length) {
                const t = tokens[j];
                stmtTokens.push(t);
                if (t.type === php_tokenizer_1.TokenType.Punctuation && t.text === ';') {
                    hasSemicolon = true;
                    break;
                }
                j++;
            }
            if (hasSemicolon) {
                if (currentLineTokens.length > 0) {
                    flushLine(formattedLines, currentLineTokens, indentLevel, indentString);
                    currentLineTokens = [];
                }
                const stmtStr = stmtTokens.map(t => t.text).join(' ')
                    .replace(/\s*\\\s*/g, '\\')
                    .replace(/\s*;\s*$/, ';')
                    .replace(/^use\s+/, 'use ');
                importBuffer.push(stmtStr);
                i = j;
                const nextT = peekNextCode(j);
                if (!nextT || nextT.text !== 'use' || (nextT.text === 'use' && tokens[j].text === ')')) {
                    if (options.sortImports !== false) {
                        importBuffer.sort();
                    }
                    importBuffer.forEach(s => formattedLines.push(getIndent(indentLevel, indentString) + s));
                    importBuffer = [];
                }
                continue;
            }
        }
        // Handle Inline HTML
        if (token.type === php_tokenizer_1.TokenType.InlineHTML) {
            if (currentLineTokens.length > 0) {
                flushLine(formattedLines, currentLineTokens, indentLevel, indentString);
                currentLineTokens = [];
            }
            formattedLines.push(token.text);
            continue;
        }
        // Brace/Block Logic - Dedent BEFORE processing
        if (token.text === '}') {
            indentLevel = Math.max(0, indentLevel - 1);
            if (currentLineTokens.length > 0) {
                flushLine(formattedLines, currentLineTokens, indentLevel + 1, indentString);
                currentLineTokens = [];
            }
        }
        if (['endif', 'endforeach', 'endwhile', 'endswitch', 'endfor'].includes(token.text)) {
            indentLevel = Math.max(0, indentLevel - 1);
            if (currentLineTokens.length > 0) {
                flushLine(formattedLines, currentLineTokens, indentLevel + 1, indentString);
                currentLineTokens = [];
            }
        }
        // Check for start of statement keywords (Flush BEFORE)
        if (token.type === php_tokenizer_1.TokenType.Keyword && currentLineTokens.length > 0) {
            const startKeywords = ['if', 'while', 'do', 'for', 'foreach', 'switch', 'try', 'return', 'echo', 'print', 'class', 'interface', 'trait', 'namespace', 'use'];
            if (startKeywords.includes(token.text)) {
                // Check exceptions
                const last = currentLineTokens[currentLineTokens.length - 1];
                let safeToFlush = true;
                if (token.text === 'if' && last.text === 'else')
                    safeToFlush = false;
                if (token.text === 'while' && last.text === '}')
                    safeToFlush = false; // do { } while
                if (safeToFlush) {
                    flushLine(formattedLines, currentLineTokens, indentLevel, indentString);
                    currentLineTokens = [];
                }
            }
            else if (token.text === 'function') {
                const last = currentLineTokens[currentLineTokens.length - 1];
                const modifiers = ['public', 'private', 'protected', 'static', 'abstract', 'final', 'function'];
                if (!modifiers.includes(last.text) && last.text !== '=') {
                    flushLine(formattedLines, currentLineTokens, indentLevel, indentString);
                    currentLineTokens = [];
                }
            }
            else if (['public', 'private', 'protected'].includes(token.text)) {
                flushLine(formattedLines, currentLineTokens, indentLevel, indentString);
                currentLineTokens = [];
            }
        }
        currentLineTokens.push(token);
        // Check if we should flush line
        let shouldFlush = false;
        if (token.type === php_tokenizer_1.TokenType.Comment) {
            if (token.text.startsWith('//') || token.text.startsWith('#')) {
                shouldFlush = true;
            }
            else if (token.text.includes('\n')) {
                // Multiline block comment ends the line?
                // Usually yes for clean formatting
                shouldFlush = true;
            }
        }
        else if (token.text === '{') {
            shouldFlush = true;
            indentLevel++;
        }
        else if (token.text === '}') {
            const next = peekNextCode(i);
            if (next && ['else', 'elseif', 'catch', 'finally'].includes(next.text)) {
                shouldFlush = false;
            }
            else {
                shouldFlush = true;
            }
        }
        else if (token.text === ';') {
            let parenBalance = 0;
            for (const t of currentLineTokens) {
                if (t.text === '(')
                    parenBalance++;
                if (t.text === ')')
                    parenBalance--;
            }
            if (parenBalance === 0) {
                shouldFlush = true;
            }
        }
        else if (token.type === php_tokenizer_1.TokenType.OpenTag) {
            shouldFlush = true;
        }
        else if (token.type === php_tokenizer_1.TokenType.CloseTag) {
            shouldFlush = true;
        }
        else if (token.text === ':' && prev && ['case', 'default'].includes(prev.text)) {
            shouldFlush = true;
            indentLevel++;
        }
        // Check for trailing comments to avoid premature flush
        if (shouldFlush) {
            const nextToken = i + 1 < tokens.length ? tokens[i + 1] : null;
            if (nextToken && nextToken.type === php_tokenizer_1.TokenType.Comment && nextToken.line === token.line) {
                shouldFlush = false;
            }
        }
        if (shouldFlush) {
            let flushLevel = indentLevel;
            if (token.text === '{')
                flushLevel--;
            if (token.text === ':' && prev && ['case', 'default'].includes(prev.text))
                flushLevel--;
            flushLine(formattedLines, currentLineTokens, flushLevel, indentString);
            currentLineTokens = [];
        }
    }
    if (currentLineTokens.length > 0) {
        flushLine(formattedLines, currentLineTokens, indentLevel, indentString);
    }
    return formattedLines.join('\n');
}
function flushLine(lines, tokens, level, indentString) {
    if (tokens.length === 0)
        return;
    // Dedent case/default labels
    if (tokens[0].text === 'case' || tokens[0].text === 'default') {
        level = Math.max(0, level - 1);
    }
    let line = '';
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        const prev = i > 0 ? tokens[i - 1] : null;
        if (prev) {
            // Ensure space before comment if it's on the same line
            if (t.type === php_tokenizer_1.TokenType.Comment) {
                line += ' ';
            }
            else if (needsSpace(prev, t)) {
                line += ' ';
            }
        }
        line += t.text;
    }
    lines.push(getIndent(level, indentString) + line);
}
function getIndent(level, indentString) {
    return indentString.repeat(Math.max(0, level));
}
function needsSpace(prev, curr) {
    if (curr.type === php_tokenizer_1.TokenType.Comment)
        return true;
    if (curr.text === ';')
        return false;
    if (curr.text === ',')
        return false;
    if (curr.text === ':')
        return false;
    if (curr.text === ')')
        return false;
    if (curr.text === ']')
        return false;
    if (prev.text === '(' || prev.text === '[')
        return false;
    if (prev.text === '->' || prev.text === '::')
        return false;
    if (curr.text === '->' || curr.text === '::')
        return false;
    if (prev.text === '!' || prev.text === '...')
        return false;
    if (prev.type === php_tokenizer_1.TokenType.Operator || curr.type === php_tokenizer_1.TokenType.Operator) {
        if (['++', '--'].includes(prev.text) || ['++', '--'].includes(curr.text))
            return false;
        return true;
    }
    if (prev.type === php_tokenizer_1.TokenType.Keyword) {
        if (['fn', 'function', 'super', 'this'].includes(prev.text) && curr.text === '(')
            return false;
        return true;
    }
    if (curr.type === php_tokenizer_1.TokenType.Keyword) {
        if (curr.text === 'else' || curr.text === 'elseif' || curr.text === 'catch' || curr.text === 'finally')
            return true;
        return true; // Default space before keyword
    }
    if (prev.text === ',')
        return true;
    if (prev.text === ')' && curr.text === '{')
        return true;
    if (prev.text === '}' && ['else', 'elseif', 'catch', 'finally'].includes(curr.text))
        return true;
    if (prev.type === php_tokenizer_1.TokenType.OpenTag)
        return true;
    return false;
}
