/**
 * Format Prisma schema with Deep Formatting rules
 * - Vertical alignment of fields, types, and attributes
 * - Consistent indentation
 * - Grouping of blocks
 */
export function formatPrismaDeep(text: string): string {
    const lines = text.split(/\r?\n/);
    const formattedLines: string[] = [];

    let blockBuffer: string[] = [];
    let inBlock = false;
    let blockStartLine = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '') {
            if (inBlock) {
                // Preserve empty lines inside block (max 1)
                if (blockBuffer.length > 0 && blockBuffer[blockBuffer.length - 1].trim() !== '') {
                    blockBuffer.push('');
                }
            } else {
                // Preserve empty lines outside block (max 1)
                if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                    formattedLines.push('');
                }
            }
            continue;
        }

        // Comment handling (full line)
        if (trimmed.startsWith('//') || trimmed.startsWith('///')) {
            if (inBlock) {
                blockBuffer.push(line);
            } else {
                formattedLines.push(line);
            }
            continue;
        }

        // Block Start
        if (trimmed.endsWith('{') && !inBlock) {
            inBlock = true;
            blockStartLine = trimmed; // Normalize start line indentation to 0 for top level
            continue;
        }

        // Block End
        if (trimmed === '}' && inBlock) {
            inBlock = false;
            // Process block
            const formattedBlock = formatPrismaBlock(blockStartLine, blockBuffer);
            formattedLines.push(...formattedBlock);
            blockBuffer = [];
            continue;
        }

        if (inBlock) {
            blockBuffer.push(line);
        } else {
            formattedLines.push(line);
        }
    }

    // Handle unclosed block (fault tolerance)
    if (inBlock) {
        formattedLines.push(blockStartLine);
        formattedLines.push(...blockBuffer);
    }

    return formattedLines.join('\n');
}

function formatPrismaBlock(startLine: string, contentLines: string[]): string[] {
    const result: string[] = [];
    result.push(startLine);

    const trimmedStart = startLine.trim();
    const isModelOrType = trimmedStart.startsWith('model') || trimmedStart.startsWith('type');
    const isEnum = trimmedStart.startsWith('enum');
    const isConfig = trimmedStart.startsWith('datasource') || trimmedStart.startsWith('generator');

    if (isModelOrType) {
        result.push(...formatModelBlock(contentLines));
    } else if (isConfig) {
        result.push(...formatConfigBlock(contentLines));
    } else if (isEnum) {
        result.push(...formatEnumBlock(contentLines));
    } else {
        result.push(...contentLines.map(l => '  ' + l.trim()));
    }

    result.push('}');
    return result;
}

function formatModelBlock(lines: string[]): string[] {
    interface Field {
        raw: string;
        name: string;
        type: string;
        attributes: string;
        comment: string;
        isComment: boolean;
        isEmpty: boolean;
        isBlockAttribute: boolean;
    }

    const fields: Field[] = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed === '') return { raw: '', name: '', type: '', attributes: '', comment: '', isComment: false, isEmpty: true, isBlockAttribute: false };
        if (trimmed.startsWith('//') || trimmed.startsWith('///')) return { raw: trimmed, name: '', type: '', attributes: '', comment: '', isComment: true, isEmpty: false, isBlockAttribute: false };

        // Handle block attributes @@index(...)
        if (trimmed.startsWith('@@')) {
             // Extract comment if any
             let comment = '';
             let content = trimmed;
             // Naive comment extraction: last // not inside string
             // But attributes can contain strings "..."
             // Let's tokenizing properly later. For now, simple split if // exists
             const commentIdx = trimmed.lastIndexOf('//');
             if (commentIdx !== -1) {
                 // Check if inside quote? Too complex for regex split.
                 // Assume comment is at end
                 comment = trimmed.substring(commentIdx);
                 content = trimmed.substring(0, commentIdx).trim();
             }
             return {
                 raw: line,
                 name: content,
                 type: '',
                 attributes: '',
                 comment,
                 isComment: false,
                 isEmpty: false,
                 isBlockAttribute: true
             };
        }

        // Tokenize Field: name type [attributes] [// comment]
        const tokens = tokenizePrismaField(trimmed);

        return {
            raw: line,
            name: tokens.name,
            type: tokens.type,
            attributes: tokens.attributes,
            comment: tokens.comment,
            isComment: false,
            isEmpty: false,
            isBlockAttribute: false
        };
    });

    // Calculate Max Widths
    let maxName = 0;
    let maxType = 0;

    fields.forEach(f => {
        if (!f.isComment && !f.isEmpty && !f.isBlockAttribute) {
            if (f.name.length > maxName) maxName = f.name.length;
            if (f.type.length > maxType) maxType = f.type.length;
        }
    });

    // Format
    return fields.map(f => {
        if (f.isEmpty) return '';
        if (f.isComment) return '  ' + f.raw.trim();
        if (f.isBlockAttribute) {
            let line = '  ' + f.name;
            if (f.comment) line += ' ' + f.comment;
            return line;
        }

        const namePad = f.name.padEnd(maxName);
        const typePad = f.type.padEnd(maxType);

        let line = `  ${namePad} ${typePad}`;
        if (f.attributes) {
            line += ` ${f.attributes}`;
        }
        if (f.comment) {
            // Align comments? Maybe too much. Just append.
            line += `  ${f.comment}`;
        }
        return line.trimEnd();
    });
}

function tokenizePrismaField(line: string): { name: string, type: string, attributes: string, comment: string } {
    let name = '';
    let type = '';
    let attributes = '';
    let comment = '';

    let currentToken = '';
    let tokens: string[] = [];
    let inString = false;
    let parenLevel = 0;

    // 1. Separate Comment
    let code = line;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '\\') {
            i++; // Skip escaped char
            continue;
        }
        if (char === '"') inString = !inString;
        if (!inString && char === '/' && line[i+1] === '/') {
            comment = line.substring(i);
            code = line.substring(0, i).trim();
            break;
        }
    }
    if (comment === '') code = line.trim(); // No comment found

    // 2. Tokenize Code
    inString = false;
    parenLevel = 0;
    currentToken = '';

    for (let i = 0; i < code.length; i++) {
        const char = code[i];

        if (inString) {
            if (char === '\\') {
                currentToken += char;
                if (i + 1 < code.length) {
                    currentToken += code[i+1];
                    i++;
                }
                continue;
            }
            if (char === '"') {
                inString = false;
                currentToken += char;
                continue;
            }
            currentToken += char;
            continue;
        }

        if (char === '"') {
            inString = true;
            currentToken += char;
            continue;
        }

        if (char === '(') parenLevel++;
        if (char === ')') parenLevel--;

        if (char === ' ' && parenLevel === 0) {
            if (currentToken.length > 0) {
                tokens.push(currentToken);
                currentToken = '';
            }
        } else {
            currentToken += char;
        }
    }
    if (currentToken.length > 0) tokens.push(currentToken);

    if (tokens.length > 0) name = tokens[0];
    if (tokens.length > 1) type = tokens[1];
    if (tokens.length > 2) attributes = tokens.slice(2).join(' ');

    return { name, type, attributes, comment };
}

function formatConfigBlock(lines: string[]): string[] {
    interface ConfigProp {
        raw: string;
        key: string;
        value: string;
        comment: string;
        isComment: boolean;
        isEmpty: boolean;
    }

    const props: ConfigProp[] = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed === '') return { raw: '', key: '', value: '', comment: '', isComment: false, isEmpty: true };
        if (trimmed.startsWith('//') || trimmed.startsWith('///')) return { raw: trimmed, key: '', value: '', comment: '', isComment: true, isEmpty: false };

        // Parse key = value
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) {
            // Maybe just a key? or invalid
            return { raw: trimmed, key: trimmed, value: '', comment: '', isComment: false, isEmpty: false };
        }

        const key = trimmed.substring(0, eqIdx).trim();
        let rest = trimmed.substring(eqIdx + 1).trim();

        // Extract comment from value
        let comment = '';
        let inString = false;
        for (let i = 0; i < rest.length; i++) {
            const char = rest[i];
            if (char === '"') inString = !inString;
            if (!inString && char === '/' && rest[i+1] === '/') {
                comment = rest.substring(i);
                rest = rest.substring(0, i).trim();
                break;
            }
        }

        return {
            raw: line,
            key,
            value: rest,
            comment,
            isComment: false,
            isEmpty: false
        };
    });

    let maxKey = 0;
    props.forEach(p => {
        if (!p.isComment && !p.isEmpty && p.key) {
            if (p.key.length > maxKey) maxKey = p.key.length;
        }
    });

    return props.map(p => {
        if (p.isEmpty) return '';
        if (p.isComment) return '  ' + p.raw;

        const keyPad = p.key.padEnd(maxKey);
        let line = `  ${keyPad} = ${p.value}`;
        if (p.comment) line += `  ${p.comment}`;
        return line;
    });
}

function formatEnumBlock(lines: string[]): string[] {
    return lines.map(line => {
        const trimmed = line.trim();
        if (trimmed === '') return '';
        if (trimmed.startsWith('//') || trimmed.startsWith('///')) return '  ' + trimmed;
        return '  ' + trimmed;
    });
}

export function validatePrisma(text: string): string | undefined {
    let braceLevel = 0;
    let inString = false;
    let inBlockComment = false;

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];

            if (inBlockComment) {
                if (char === '*' && nextChar === '/') {
                    inBlockComment = false;
                    j++;
                }
                continue;
            }

            if (inString) {
                if (char === '\\') {
                    j++;
                } else if (char === '"') {
                    inString = false;
                }
                continue;
            }

            if (char === '/' && nextChar === '/') {
                break; // Line comment
            }

            if (char === '/' && nextChar === '*') {
                inBlockComment = true;
                j++;
                continue;
            }

            if (char === '"') {
                inString = true;
                continue;
            }

            if (char === '{') {
                braceLevel++;
            } else if (char === '}') {
                braceLevel--;
                if (braceLevel < 0) {
                    return `Extra closing brace at line ${i + 1}, col ${j + 1}`;
                }
            }
        }
    }

    if (braceLevel > 0) {
        return `Missing ${braceLevel} closing brace(s)`;
    }
    if (inString) {
        return `Unclosed string literal`;
    }
    if (inBlockComment) {
        return `Unclosed block comment`;
    }

    return undefined;
}
