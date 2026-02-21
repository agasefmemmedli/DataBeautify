import { jsonrepair } from 'jsonrepair';
import { tokenizeDockerfile, DockerToken } from './dockerfile_tokenizer';

export function formatDockerfileDeep(text: string): string {
    const tokens = tokenizeDockerfile(text);
    const lines: string[] = [];

    const indent = '    ';
    let lastWasEmpty = false;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === 'EMPTY') {
            if (!lastWasEmpty && lines.length > 0) {
                lines.push('');
                lastWasEmpty = true;
            }
            continue;
        }
        lastWasEmpty = false;

        if (token.type === 'COMMENT') {
            lines.push(token.raw.trim());
            continue;
        }

        if (token.type === 'INSTRUCTION') {
            let formattedInstruction = '';
            const keyword = token.keyword || '';
            const rawArgs = token.raw.substring(keyword.length).trim();

            if (keyword === 'FROM' && lines.length > 0 && lines[lines.length - 1] !== '') {
                lines.push('');
            }

            // JSON Array Handling
            if (['CMD', 'ENTRYPOINT', 'SHELL', 'RUN', 'VOLUME'].includes(keyword) && rawArgs.startsWith('[')) {
                try {
                    // Handle multiline JSON array arguments (remove \ and newlines inside array?)
                    // Docker shell treats \ as line continuation before parsing JSON exec form.
                    let jsonStr = rawArgs.replace(/\\\r?\n/g, '');

                    // Use jsonrepair for robust parsing (handles single quotes, trailing commas, etc.)
                    const repaired = jsonrepair(jsonStr);
                    const parsed = JSON.parse(repaired);

                    if (Array.isArray(parsed)) {
                        formattedInstruction = `${keyword} ${JSON.stringify(parsed)}`;
                    }
                } catch (e) {
                    // Fallback to generic formatting if JSON parse fails
                }
            }

            if (!formattedInstruction) {
                 // Generic formatting with sorting and alignment
                 const rawLines = token.raw.split(/\r?\n/);
                 const newInstructionLines: string[] = [];

                 let firstLine = rawLines[0].trim();
                 const firstWord = firstLine.split(/\s/)[0];
                 if (firstWord.toUpperCase() === keyword) {
                     firstLine = keyword + firstLine.substring(firstWord.length);
                 }
                 newInstructionLines.push(firstLine);

                 for (let j = 1; j < rawLines.length; j++) {
                     newInstructionLines.push(`${indent}${rawLines[j].trim()}`);
                 }

                 // Align Backslashes First (to have clean lines for sorting)
                 let maxLen = 0;
                 for (const l of newInstructionLines) {
                     if (l.endsWith('\\')) maxLen = Math.max(maxLen, l.length);
                 }

                 const alignedLines = newInstructionLines.map((l, idx) => {
                     if (idx === newInstructionLines.length - 1) return l;
                     if (l.endsWith('\\')) {
                         const content = l.substring(0, l.length - 1).trimEnd();
                         const padding = ' '.repeat(Math.max(1, maxLen - content.length));
                         return `${content}${padding}\\`;
                     }
                     return l;
                 });

                 // Sorting Logic
                 let processed = false;
                 if (keyword === 'RUN' && rawLines.length > 1) {
                      // Safety check: Don't sort if shell operators are present to avoid breaking chains
                      const hasOperators = rawLines.some(l => /(&&|\|\||;|\||>)/.test(l));

                      if (!hasOperators && /apt-get\s+install|apk\s+add|pip\s+install/i.test(firstLine)) {
                           // Extract packages from lines 1..N
                           // Assumption: First line is command (e.g. RUN apt-get install -y \), rest are packages.
                           const packages: string[] = [];
                           const header = alignedLines[0];

                           // Check if header ends with \
                           if (header.endsWith('\\')) {
                                for (let k = 1; k < alignedLines.length; k++) {
                                    packages.push(alignedLines[k].replace(/\\$/, '').trim());
                                }

                                packages.sort((a, b) => {
                                    if (a.startsWith('-') && !b.startsWith('-')) return -1;
                                    if (!a.startsWith('-') && b.startsWith('-')) return 1;
                                    return a.localeCompare(b);
                                });

                                // Reconstruct block with sorting
                                // Recalculate max length for this sorted block
                                let blockMaxLen = header.replace(/\\$/, '').trim().length;
                                packages.forEach(p => {
                                    blockMaxLen = Math.max(blockMaxLen, p.length + indent.length);
                                });

                                const finalBlock: string[] = [];
                                // Header
                                const headerClean = header.replace(/\\$/, '').trim();
                                const headerPad = ' '.repeat(Math.max(1, blockMaxLen - headerClean.length));
                                finalBlock.push(`${headerClean}${headerPad}\\`);

                                for (let k = 0; k < packages.length; k++) {
                                    const p = packages[k];
                                    if (k === packages.length - 1) {
                                        // Last one
                                        finalBlock.push(`${indent}${p}`);
                                    } else {
                                        const pad = ' '.repeat(Math.max(1, blockMaxLen - (p.length + indent.length)));
                                        finalBlock.push(`${indent}${p}${pad}\\`);
                                    }
                                }
                                formattedInstruction = finalBlock.join('\n');
                                processed = true;
                           }
                      }
                 }

                 if (!processed) {
                     formattedInstruction = alignedLines.join('\n');
                 }
            }

            lines.push(formattedInstruction);
        }
    }
    return lines.join('\n');
}
