import { XMLParser, XMLValidator } from 'fast-xml-parser';
import xmlFormatter from 'xml-formatter';
import { formatXMLDeep } from './xml_deep_formatter';
import { FormatError, FormatResult, IndentOptions, indentString } from './result';

export interface XMLOptions extends IndentOptions {
    sortAttributes: boolean;
}

/**
 * Format XML.
 *
 * - Valid XML: the result must have the same elements, attributes and text
 *   (ignoring indentation whitespace), otherwise the next formatter is tried.
 * - Broken XML: the result is used only if it is valid XML; otherwise FormatError.
 */
export function formatXML(text: string, opts: XMLOptions): FormatResult {
    const validation = XMLValidator.validate(text);
    const valid = validation === true;
    const issue = valid ? undefined : `${validation.err.msg} (line ${validation.err.line}, column ${validation.err.col})`;

    const attempts = [
        () => formatXMLDeep(text, {
            tabSize: opts.tabSize,
            insertSpaces: opts.insertSpaces,
            sortAttributes: opts.sortAttributes,
            spaceBeforeSelfClose: true,
        }),
        () => xmlFormatter(text, {
            indentation: indentString(opts),
            collapseContent: true,
            lineSeparator: '\n',
        }),
    ];

    for (const attempt of attempts) {
        try {
            const out = attempt();
            if (valid && sameXML(text, out)) {
                return { text: out, repaired: false };
            }
            if (!valid && XMLValidator.validate(out) === true) {
                // The fix is valid XML now: format it once more so the style matches
                // what a second run would produce
                const restyled = formatXML(out, opts).text;
                // Fixing broken XML means guessing where tags end: always ask first
                return { text: restyled, repaired: true, issue, needsConfirmation: true };
            }
        } catch {
            // try the next formatter
        }
    }

    if (valid) {
        throw new FormatError('Formatting would change the document content, so the file was not changed.');
    }
    throw new FormatError(`Invalid XML: ${issue}. The file was not changed.`);
}

const parser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    allowBooleanAttributes: true,
    parseTagValue: false,
    parseAttributeValue: false,
    // Decode entities so that 'say "hi"' and "say &quot;hi&quot;" compare equal
    processEntities: true,
    trimValues: true,
    commentPropName: '#comment',
    cdataPropName: '#cdata',
});

// Compare documents ignoring layout whitespace and attribute order
export function sameXML(a: string, b: string): boolean {
    try {
        return JSON.stringify(canonical(parser.parse(a))) === JSON.stringify(canonical(parser.parse(b)));
    } catch {
        return false;
    }
}

function canonical(node: unknown): unknown {
    if (Array.isArray(node)) {
        return node.map(canonical);
    }
    if (node && typeof node === 'object') {
        const obj = node as Record<string, unknown>;
        const sorted: Record<string, unknown> = {};
        for (const key of Object.keys(obj).sort()) {
            sorted[key] = canonical(obj[key]);
        }
        return sorted;
    }
    if (typeof node === 'string') {
        return node.replace(/\s+/g, ' ').trim();
    }
    return node;
}
