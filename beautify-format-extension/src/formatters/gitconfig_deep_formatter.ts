import { tokenizeGitConfig, Token } from './gitconfig_tokenizer';

interface Element {
    type: 'Section' | 'Entry' | 'Comment' | 'Blank';
    tokens: Token[];
    key?: string;
    value?: string;
    raw?: string;
    hasEquals?: boolean;
}

export function formatGitConfigDeep(text: string): string {
    const tokens = tokenizeGitConfig(text);

    // 1. Parse into structural Elements
    const elements: Element[] = [];
    let currentTokens: Token[] = [];
    let currentType: Element['type'] | null = null;
    let currentKey: string | undefined;
    let currentValue: string | undefined;
    let currentHasEquals = false;

    // Helper to push element
    const pushElement = (type: Element['type'], toks: Token[], key?: string, val?: string, raw?: string, hasEq?: boolean) => {
        elements.push({ type, tokens: toks, key, value: val, raw, hasEquals: hasEq });
    };

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === 'Whitespace') {
            if (token.value.includes('\n')) {
                // End of line -> End of current element usually
                if (currentType) {
                    pushElement(currentType, currentTokens, currentKey, currentValue, currentTokens.map(t => t.value).join(''), currentHasEquals);
                    currentTokens = [];
                    currentType = null;
                    currentKey = undefined;
                    currentValue = undefined;
                    currentHasEquals = false;
                }

                // Handle blank lines
                const newlines = token.value.split('\n').length - 1;
                for (let j = 0; j < newlines - 1; j++) {
                    pushElement('Blank', [token]);
                }
            } else {
                // Inline whitespace
                if (currentType) {
                    currentTokens.push(token);
                }
            }
            continue;
        }

        if (token.type === 'Section') {
            if (currentType) {
                 pushElement(currentType, currentTokens, currentKey, currentValue, currentTokens.map(t => t.value).join(''), currentHasEquals);
                 currentTokens = [];
                 currentHasEquals = false;
            }
            currentType = 'Section';
            currentTokens = [token];
            // Section is usually immediately followed by newline, handled by Whitespace logic above
            continue;
        }

        if (token.type === 'Comment') {
            if (currentType === 'Entry') {
                // Inline comment
                currentTokens.push(token);
            } else {
                if (currentType) {
                    pushElement(currentType, currentTokens, currentKey, currentValue, currentTokens.map(t => t.value).join(''), currentHasEquals);
                    currentTokens = [];
                    currentHasEquals = false;
                }
                currentType = 'Comment';
                currentTokens = [token];
            }
            continue;
        }

        if (token.type === 'Key') {
            if (currentType) {
                 // Should not happen if syntax is correct (Key starts a line)
                 // But maybe previous element wasn't closed?
                 pushElement(currentType, currentTokens, currentKey, currentValue, currentTokens.map(t => t.value).join(''), currentHasEquals);
                 currentTokens = [];
                 currentHasEquals = false;
            }
            currentType = 'Entry';
            currentTokens = [token];
            currentKey = token.value;
            continue;
        }

        if (token.type === 'Operator') {
             if (currentType === 'Entry') {
                 currentTokens.push(token);
                 currentHasEquals = true;
             } else {
                 // Orphan =
                 currentType = 'Entry';
                 currentTokens = [token];
                 currentHasEquals = true;
             }
             continue;
        }

        if (token.type === 'Value') {
            if (currentType === 'Entry') {
                currentTokens.push(token);
                currentValue = token.value;
            } else {
                // Orphan Value
                 currentType = 'Entry';
                 currentTokens = [token];
                 currentValue = token.value;
            }
            continue;
        }
    }
    // Finalize last element
    if (currentType) {
        pushElement(currentType, currentTokens, currentKey, currentValue, currentTokens.map(t => t.value).join(''), currentHasEquals);
    }

    // 2. Format Lines
    const formattedLines: string[] = [];
    let currentSectionEntries: Element[] = [];
    let hasSeenSection = false;

    const processBuffer = (indent: boolean) => {
        if (currentSectionEntries.length === 0) return;

        // Calculate Alignment
        let maxKeyLen = 0;
        currentSectionEntries.forEach(e => {
            if (e.type === 'Entry' && e.key) {
                if (e.key.length > maxKeyLen) maxKeyLen = e.key.length;
            }
        });

        currentSectionEntries.forEach(e => {
            const prefix = indent ? '\t' : '';

            if (e.type === 'Entry') {
                if (e.key) {
                    let line = prefix + e.key;
                    if (e.value !== undefined) {
                        const padding = ' '.repeat(maxKeyLen - e.key.length);

                        // Normalize multiline values
                        let finalValue = e.value;
                        if (finalValue.includes('\n')) {
                            const valueLines = finalValue.split('\n');
                            for (let k = 1; k < valueLines.length; k++) {
                                // Standard indentation for continuation lines: 2 tabs
                                valueLines[k] = '\t\t' + valueLines[k].trimStart();
                            }
                            finalValue = valueLines.join('\n');
                        }

                        line += padding + ' = ' + finalValue;
                    } else if (e.hasEquals) {
                        const padding = ' '.repeat(maxKeyLen - e.key.length);
                        line += padding + ' =';
                    }

                    // Restore inline comments
                    const comments = e.tokens.filter(t => t.type === 'Comment');
                    if (comments.length > 0) {
                        line += ' ' + comments.map(c => c.value).join(' ');
                    }
                    formattedLines.push(line);
                } else if (e.raw) {
                     formattedLines.push(prefix + e.raw);
                }
            } else if (e.type === 'Comment') {
                // For comments, we use the raw value but apply indentation
                // Raw value includes the # or ;
                formattedLines.push(prefix + e.tokens.map(t => t.value).join('').trim());
            } else if (e.type === 'Blank') {
                formattedLines.push('');
            }
        });
        currentSectionEntries = [];
    };

    for (const el of elements) {
        if (el.type === 'Section') {
            processBuffer(hasSeenSection);
            hasSeenSection = true;

            // Ensure blank line before section (if not first line)
            if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                formattedLines.push('');
            }
            // Section header is never indented
            formattedLines.push(el.tokens.map(t => t.value).join('').trim());
        } else {
            currentSectionEntries.push(el);
        }
    }
    processBuffer(hasSeenSection);

    return formattedLines.join('\n') + '\n';
}
