import { jsonrepair } from 'jsonrepair';
import { tokenizeDockerfile, DockerToken } from './dockerfile_tokenizer';

export function formatDockerfileDeep(text: string): string {
    const tokens = tokenizeDockerfile(text);
    const lines: string[] = [];

    const indent = '    ';
    let lastWasEmpty = false;

    const standardInstructions = new Set([
        'FROM', 'RUN', 'CMD', 'LABEL', 'EXPOSE', 'ENV', 'ADD', 'COPY',
        'ENTRYPOINT', 'VOLUME', 'USER', 'WORKDIR', 'ARG', 'ONBUILD',
        'STOPSIGNAL', 'HEALTHCHECK', 'SHELL', 'MAINTAINER'
    ]);

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

            // Determine keyword
            const firstWordMatch = token.raw.trim().match(/^([a-zA-Z]+)/);
            let keyword = firstWordMatch ? firstWordMatch[1].toUpperCase() : '';

            if (!standardInstructions.has(keyword)) {
                if (standardInstructions.has(token.keyword || '')) {
                    keyword = token.keyword!;
                } else {
                    keyword = (token.keyword || '').toUpperCase();
                }
            }

            const rawArgs = token.raw.replace(/^[a-zA-Z]+\s*/, '').trim();

            if (keyword === 'FROM' && lines.length > 0 && lines[lines.length - 1] !== '') {
                lines.push('');
            }

            // JSON Array Handling
            if (['CMD', 'ENTRYPOINT', 'SHELL', 'RUN', 'VOLUME'].includes(keyword) && rawArgs.startsWith('[')) {
                try {
                    let jsonStr = rawArgs.replace(/\\\r?\n/g, '');
                    const repaired = jsonrepair(jsonStr);
                    const parsed = JSON.parse(repaired);

                    if (Array.isArray(parsed)) {
                        const spaced = JSON.stringify(parsed).replace(/,(?=[^ ])/g, ', ');
                        formattedInstruction = `${keyword} ${spaced}`;
                    }
                } catch (e) {
                    // Fallback
                }
            }

            if (!formattedInstruction) {
                 const rawLines = token.raw.split(/\r?\n/);
                 const newInstructionLines: string[] = [];

                 let firstLine = rawLines[0].trim();
                 // Uppercase instruction
                 const firstWord = firstLine.split(/\s/)[0];
                 if (standardInstructions.has(firstWord.toUpperCase())) {
                     firstLine = firstWord.toUpperCase() + firstLine.substring(firstWord.length);
                 }
                 newInstructionLines.push(firstLine);

                 for (let j = 1; j < rawLines.length; j++) {
                     newInstructionLines.push(`${indent}${rawLines[j].trim()}`);
                 }

                 // Sorting Logic
                 let processed = false;
                 if (keyword === 'RUN' && rawLines.length > 1) {
                      // Check for shell operators in SUBSEQUENT lines (the list)
                      // We allow operators in the first line (e.g. apt-get update && apt-get install)
                      // But if subsequent lines have && or |, it might be complex logic we shouldn't reorder.
                      const listLines = rawLines.slice(1);
                      const hasOperatorsInList = listLines.some(l => !l.trim().startsWith('#') && /(&&|\|\||;|\||>)/.test(l.replace(/\\$/, ''))); // Strip trailing backslash before check

                      if (!hasOperatorsInList && /apt-get\s+install|apk\s+add|pip\s+install|yum\s+install|dnf\s+install/i.test(firstLine)) {
                           const items: { text: string, comment?: string, sortKey: string }[] = [];
                           const header = newInstructionLines[0]; // First line (RUN ...)
                           let pendingComment: string | null = null;

                           for (let k = 1; k < newInstructionLines.length; k++) {
                               const line = newInstructionLines[k];
                               const trimmed = line.trim();

                               if (trimmed.startsWith('#')) {
                                   if (pendingComment) pendingComment += '\n' + trimmed;
                                   else pendingComment = trimmed;
                                   continue;
                               }

                               // It's a package
                               const pkg = trimmed.replace(/\\$/, '').trim();
                               if (pkg) {
                                   items.push({
                                       text: pkg,
                                       comment: pendingComment || undefined,
                                       sortKey: pkg.startsWith('-') ? '   ' + pkg : pkg // Sort flags first (space < any char)
                                   });
                                   pendingComment = null;
                               }
                           }

                           // Sort items
                           items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

                           // Reconstruct
                           const headerClean = header.replace(/\\$/, '').trim();
                           const finalBlock: string[] = [];

                           // Calculate max len for alignment
                           let maxLen = headerClean.length;
                           items.forEach(item => {
                               maxLen = Math.max(maxLen, item.text.length + indent.length);
                           });

                           // Header
                           const headerPad = ' '.repeat(Math.max(1, maxLen - headerClean.length));
                           finalBlock.push(`${headerClean}${headerPad}\\`);

                           items.forEach((item, index) => {
                               // Add comment if any (indented)
                               if (item.comment) {
                                   const commentLines = item.comment.split('\n');
                                   commentLines.forEach(c => finalBlock.push(`${indent}${c}`));
                               }

                               const isLast = index === items.length - 1;
                               const text = item.text;

                               if (isLast) {
                                   finalBlock.push(`${indent}${text}`);
                               } else {
                                   const pad = ' '.repeat(Math.max(1, maxLen - (text.length + indent.length)));
                                   finalBlock.push(`${indent}${text}${pad}\\`);
                               }
                           });

                           formattedInstruction = finalBlock.join('\n');
                           processed = true;
                      }
                 }

                 if (!processed) {
                     // Align Backslashes
                     let maxLen = 0;
                     for (const l of newInstructionLines) {
                         if (l.trim().startsWith('#')) continue; // Don't align based on comments
                         if (l.endsWith('\\')) maxLen = Math.max(maxLen, l.length);
                     }

                     const alignedLines = newInstructionLines.map((l, idx) => {
                         if (idx === newInstructionLines.length - 1) return l;
                         if (l.trim().startsWith('#')) return l; // Don't add \ to comments

                         if (l.endsWith('\\')) {
                             const content = l.substring(0, l.length - 1).trimEnd();
                             const padding = ' '.repeat(Math.max(1, maxLen - content.length));
                             return `${content}${padding}\\`;
                         }
                         return l;
                     });
                     formattedInstruction = alignedLines.join('\n');
                 }
            }

            lines.push(formattedInstruction);
        }
    }
    return lines.join('\n');
}
