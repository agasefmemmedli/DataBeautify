
/**
 * Deep Formatting for Log Files
 * - Vertically aligns timestamps and log levels
 * - Detects and pretty-prints embedded JSON
 * - Detects and pretty-prints embedded XML
 * - Standardizes indentation for stack traces and continuation lines
 */

export function formatLogDeep(text: string): string {
    // Lazy load xml-formatter
    let xmlFormatter: any;
    try {
        xmlFormatter = require('xml-formatter');
    } catch (e) {
        // Ignore if not available
    }

    const lines = text.split('\n');

    // Data structure to hold parsed lines
    interface LogLine {
        type: 'entry' | 'continuation';
        raw: string;
        timestamp?: string;
        level?: string;
        message?: string;
    }

    const parsedLines: LogLine[] = [];

    // 1. Parsing Pass
    // Robust timestamp regex:
    // - ISO8601: 2023-10-27T10:00:00.000Z or 2023-10-27 10:00:00
    // - Common: Oct 27 10:00:00
    // - Time only: 10:00:00
    // - Surrounded by brackets []
    // - Flexible separators
    const timestampRegex = /^(\[?(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?|\d{2}:\d{2}:\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\]?)\s*/;

    // Log Level Regex
    const logLevelRegex = /^\s*(INFO|DEBUG|WARN|WARNING|ERROR|FATAL|TRACE|CRITICAL|NOTICE|ALERT|EMERG|FINE|FINER|FINEST|VERBOSE)\b/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '') {
            parsedLines.push({ type: 'entry', raw: '', message: '' });
            continue;
        }

        const tsMatch = trimmed.match(timestampRegex);
        if (tsMatch) {
            // Potential new entry
            const timestamp = tsMatch[1];
            let rest = trimmed.substring(tsMatch[0].length);

            // Check for Level
            let level = '';
            const levelMatch = rest.match(logLevelRegex);
            if (levelMatch) {
                level = levelMatch[1];
                rest = rest.substring(levelMatch[0].length).trim();
            } else {
                rest = rest.trim();
            }

            parsedLines.push({
                type: 'entry',
                raw: line,
                timestamp: timestamp,
                level: level,
                message: rest
            });
        } else {
            // Continuation line (Stack trace, JSON dump continuation, etc.)
            const isIndented = /^\s/.test(line);
            const isStackTrace = /^\s*(at\s+|Caused by:|\.\.\.)/.test(line);

            const lastLine = parsedLines.length > 0 ? parsedLines[parsedLines.length - 1] : null;

            // If strictly indented or clearly a stack trace, it's a continuation.
            // If previous line was a robust entry (has timestamp) OR a continuation of one, assume this is continuation.
            // Otherwise, treat as new entry (raw text).
            const isContinuation = isIndented || isStackTrace || (lastLine && (
                (lastLine.type === 'entry' && !!lastLine.timestamp) ||
                lastLine.type === 'continuation'
            ));

            if (isContinuation) {
                 parsedLines.push({
                    type: 'continuation',
                    raw: line,
                    message: trimmed
                });
            } else {
                // Treat as entry without timestamp/level
                parsedLines.push({
                    type: 'entry',
                    raw: line,
                    timestamp: '',
                    level: '',
                    message: trimmed
                });
            }
        }
    }

    // 2. Alignment Calculation
    let maxTsWidth = 0;
    let maxLevelWidth = 0;

    parsedLines.forEach(l => {
        if (l.type === 'entry') {
            if (l.timestamp && l.timestamp.length > maxTsWidth) maxTsWidth = l.timestamp.length;
            if (l.level && l.level.length > maxLevelWidth) maxLevelWidth = l.level.length;
        }
    });

    // 3. Formatting & JSON/XML Processing
    const formattedLines: string[] = [];

    // Calculate standard indent for continuations
    // We want continuations to align with the message start of the previous entry if possible.
    // Base indent = timestamp width + 1 + level width + 1
    const baseIndentLen = (maxTsWidth > 0 ? maxTsWidth + 1 : 0) + (maxLevelWidth > 0 ? maxLevelWidth + 1 : 0);
    const indentString = ' '.repeat(Math.max(4, baseIndentLen));

    for (let i = 0; i < parsedLines.length; i++) {
        const l = parsedLines[i];

        if (l.type === 'entry') {
            if (!l.timestamp && !l.level && !l.message) {
                formattedLines.push('');
                continue;
            }

            let lineStr = '';

            // Timestamp
            if (l.timestamp) {
                lineStr += l.timestamp.padEnd(maxTsWidth);
            } else if (maxTsWidth > 0) {
                lineStr += ' '.repeat(maxTsWidth);
            }

            // Separator
            if (maxTsWidth > 0) lineStr += ' ';

            // Level
            if (l.level) {
                const normalizedLevel = l.level.toUpperCase();
                lineStr += normalizedLevel.padEnd(maxLevelWidth);
            } else if (maxLevelWidth > 0) {
                 lineStr += ' '.repeat(maxLevelWidth);
            }

            // Separator
            if (maxLevelWidth > 0) lineStr += ' ';

            // Message & Structured Content
            let message = l.message || '';
            const fullPrefix = lineStr;

            let structuredCandidate = '';
            let prefixBeforeStructured = '';
            let isStructured = false;

            const trimmedMessage = message.trim();

            // JSON Detection
            if (trimmedMessage.endsWith('}') || trimmedMessage.endsWith(']')) {
                const possibleStarts = [];
                for (let k = 0; k < message.length; k++) {
                    if (message[k] === '{' || message[k] === '[') {
                        possibleStarts.push(k);
                    }
                }

                for (const startIdx of possibleStarts) {
                    const candidate = message.substring(startIdx);
                    if ((candidate.startsWith('{') && candidate.trim().endsWith('}')) ||
                        (candidate.startsWith('[') && candidate.trim().endsWith(']'))) {
                        try {
                            const parsed = JSON.parse(candidate);
                            structuredCandidate = JSON.stringify(parsed, null, 2);
                            prefixBeforeStructured = message.substring(0, startIdx);
                            isStructured = true;
                            break;
                        } catch (e) {
                            // Continue trying other start positions
                        }
                    }
                }
            }

            // XML Detection (if not JSON)
            if (!isStructured && trimmedMessage.endsWith('>')) {
                const possibleStarts = [];
                for (let k = 0; k < message.length; k++) {
                    if (message[k] === '<') {
                        possibleStarts.push(k);
                    }
                }

                for (const startIdx of possibleStarts) {
                    const candidate = message.substring(startIdx);
                    // Check for end tag or self-closing
                    if (candidate.startsWith('<') && (candidate.trim().endsWith('>') || candidate.trim().endsWith('/>'))) {
                        try {
                            if (xmlFormatter) {
                                const formattedXML = xmlFormatter(candidate, {
                                    indentation: '  ',
                                    collapseContent: true,
                                    lineSeparator: '\n',
                                    whiteSpaceAtEndOfSelfclosingTag: true
                                });
                                structuredCandidate = formattedXML;
                                prefixBeforeStructured = message.substring(0, startIdx);
                                isStructured = true;
                                break;
                            }
                        } catch (e) {
                            // Continue
                        }
                    }
                }
            }

            if (isStructured) {
                const lines = structuredCandidate.split('\n');

                // First line: Log Prefix + Message Prefix + JSON/XML start
                formattedLines.push((fullPrefix + prefixBeforeStructured + lines[0]).trimEnd());

                // Subsequent lines: Indent to align with start
                const alignmentPadding = ' '.repeat(fullPrefix.length + prefixBeforeStructured.length);

                for (let j = 1; j < lines.length; j++) {
                     formattedLines.push(alignmentPadding + lines[j]);
                }
                continue;
            }

            formattedLines.push((fullPrefix + message).trimEnd());

        } else {
            // Continuation
            const trimmedContent = l.message || '';
            formattedLines.push(indentString + trimmedContent);
        }
    }

    return formattedLines.join('\n');
}
