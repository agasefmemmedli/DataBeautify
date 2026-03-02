import { NginxTokenizer, TokenType, Token } from './nginx_tokenizer';

interface ExtendedToken extends Token {
    precededByWhitespace: boolean;
}

export function formatNginxDeep(text: string): string {
    const tokenizer = new NginxTokenizer(text);
    const rawTokens = tokenizer.tokenize();

    // Pre-process tokens to track whitespace adjacency
    const tokens: ExtendedToken[] = [];

    for (let i = 0; i < rawTokens.length; i++) {
        const t = rawTokens[i];
        if (t.type === TokenType.Whitespace) continue;

        const prev = i > 0 ? rawTokens[i-1] : null;
        // Check if previous token was whitespace
        const precededByWhitespace = prev ? prev.type === TokenType.Whitespace : false;

        tokens.push({ ...t, precededByWhitespace });
    }

    let formattedLines: string[] = [];
    let currentLine = '';
    let indentLevel = 0;
    const INDENT_SIZE = 4;
    const indentString = ' '.repeat(INDENT_SIZE);

    const pushLine = (forceEmpty: boolean = false) => {
        if (currentLine.trim() !== '') {
            formattedLines.push(currentLine);
            currentLine = '';
        } else if (forceEmpty) {
             if (formattedLines.length > 0 && formattedLines[formattedLines.length-1] !== '') {
                 formattedLines.push('');
             }
        }
    };

    const getIndent = (level: number) => {
        return indentString.repeat(Math.max(0, level));
    };

    const append = (str: string, indentOffset: number = 0) => {
        if (currentLine === '') {
            currentLine = getIndent(indentLevel + indentOffset) + str;
        } else {
            currentLine += str;
        }
    };

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const nextToken = i + 1 < tokens.length ? tokens[i + 1] : null;
        const prevToken = i > 0 ? tokens[i - 1] : null;

        // Dedent on '}'
        if (token.type === TokenType.Punctuation && token.text === '}') {
            indentLevel = Math.max(0, indentLevel - 1);
            pushLine();
        }

        // Handle blank lines from source
        if (i > 0 && prevToken) {
             const newlines = token.line - prevToken.endLine;
             if (newlines > 1) {
                 pushLine(true); // Force empty line
             } else if (newlines === 1 && currentLine !== '') {
                 // Wrap line if not already pushed (unlikely for Nginx usually unless multi-line directive)
                 pushLine();
             }
        }

        // Spacing Logic
        let spaceBefore = false;

        if (currentLine !== '') {
            const lastChar = currentLine[currentLine.length - 1];

            if (token.type === TokenType.Punctuation && token.text === ';') {
                spaceBefore = false;
            } else if (token.type === TokenType.Punctuation && token.text === '{') {
                spaceBefore = true;
            } else if (token.type === TokenType.LuaBlock) {
                 spaceBefore = true;
            } else {
                 // Words, Variables, Strings
                 if (token.precededByWhitespace && lastChar !== ' ') {
                     spaceBefore = true;
                 }
            }
        }

        if (spaceBefore && currentLine !== '' && !currentLine.endsWith(' ')) {
             append(' ');
        }

        append(token.text);

        // Indent on '{'
        if (token.type === TokenType.Punctuation && token.text === '{') {
            indentLevel++;
            pushLine();
        }
        else if (token.type === TokenType.Punctuation && token.text === ';') {
            // If next token is comment on same line, append space
            if (nextToken && nextToken.type === TokenType.Comment && nextToken.line === token.endLine) {
                 append(' ');
            } else {
                pushLine();
            }
        }
        else if (token.type === TokenType.LuaBlock) {
             pushLine();
        }
        else if (token.type === TokenType.Comment) {
             pushLine();
        }
    }

    if (currentLine.trim() !== '') pushLine();

    // Alignment Post-Processing
    return alignDirectives(formattedLines.join('\n'));
}

function alignDirectives(text: string): string {
    const lines = text.split('\n');
    let blockStart = -1;
    let blockEnd = -1;

    // Directives to align
    const alignableDirectives = new Set([
        'listen', 'server_name', 'root', 'index', 'try_files', 'error_page',
        'access_log', 'error_log', 'include', 'proxy_pass', 'fastcgi_pass',
        'fastcgi_param', 'proxy_set_header', 'add_header', 'ssl_certificate',
        'ssl_certificate_key', 'ssl_protocols', 'ssl_ciphers', 'gzip',
        'gzip_types', 'location', 'upstream', 'set', 'proxy_buffer_size',
        'proxy_buffers', 'proxy_busy_buffers_size', 'fastcgi_buffer_size',
        'fastcgi_buffers', 'fastcgi_busy_buffers_size', 'client_max_body_size',
        'client_body_buffer_size', 'keepalive_timeout', 'sendfile',
        'tcp_nopush', 'tcp_nodelay', 'worker_processes', 'worker_connections'
    ]);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '' || trimmed.startsWith('#') || trimmed.endsWith('{') || trimmed === '}') {
            if (blockStart !== -1) {
                // Process block
                processAlignmentBlock(lines, blockStart, i);
                blockStart = -1;
            }
            continue;
        }

        // Check if it's an alignable directive
        const parts = trimmed.split(/\s+/);
        if (parts.length > 1 && alignableDirectives.has(parts[0])) {
            if (blockStart === -1) blockStart = i;
        } else {
            if (blockStart !== -1) {
                processAlignmentBlock(lines, blockStart, i);
                blockStart = -1;
            }
        }
    }

    if (blockStart !== -1) {
        processAlignmentBlock(lines, blockStart, lines.length);
    }

    return lines.join('\n');
}

function processAlignmentBlock(lines: string[], start: number, end: number) {
    if (end - start < 2) return; // Need at least 2 lines to align

    // Analyze block to see if indentation is consistent
    const firstIndent = lines[start].match(/^(\s*)/)![1];
    for (let i = start + 1; i < end; i++) {
        const indentMatch = lines[i].match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';
        if (indent !== firstIndent) return; // Don't align if different indentation levels mixed
    }

    // Find max directive length
    let maxDirectiveLen = 0;
    let maxArg1Len = 0;
    const parsedLines: {directive: string, arg1: string, argRemaining: string}[] = [];

    for (let i = start; i < end; i++) {
        const trimmed = lines[i].trim();
        const firstSpace = trimmed.indexOf(' ');
        if (firstSpace === -1) {
             parsedLines.push({ directive: trimmed, arg1: '', argRemaining: '' });
             continue;
        }
        const directive = trimmed.substring(0, firstSpace);
        const argsTrimmed = trimmed.substring(firstSpace + 1).trim();

        let arg1 = '';
        let argRemaining = '';
        const arg1SpaceMatch = argsTrimmed.match(/\s/);

        if (!arg1SpaceMatch) {
             arg1 = argsTrimmed;
        } else {
             const arg1SpaceIdx = arg1SpaceMatch.index!;
             arg1 = argsTrimmed.substring(0, arg1SpaceIdx);
             argRemaining = argsTrimmed.substring(arg1SpaceIdx).trim();
        }

        if (directive.length > maxDirectiveLen) maxDirectiveLen = directive.length;
        if (argRemaining !== '') {
             if (arg1.length > maxArg1Len) maxArg1Len = arg1.length;
        }

        parsedLines.push({ directive, arg1, argRemaining });
    }

    // Apply alignment
    for (let i = 0; i < parsedLines.length; i++) {
        const item = parsedLines[i];
        if (item.arg1 || item.argRemaining) {
            const dirPadding = ' '.repeat(maxDirectiveLen - item.directive.length);

            let finalArgs = '';
            if (item.argRemaining) {
                 const arg1Padding = ' '.repeat(maxArg1Len - item.arg1.length);
                 finalArgs = `${item.arg1}${arg1Padding} ${item.argRemaining}`;
            } else {
                 finalArgs = item.arg1;
            }

            lines[start + i] = `${firstIndent}${item.directive}${dirPadding} ${finalArgs}`;
        }
    }
}
