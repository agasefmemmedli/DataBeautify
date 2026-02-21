import { JSONTokenizer, Token, TokenType } from './json_tokenizer';

export interface JSONFormatOptions {
    tabSize?: number;
    insertSpaces?: boolean;
    isJSONC?: boolean;
}

export function formatJSONDeep(text: string, options?: JSONFormatOptions): string {
    const tokenizer = new JSONTokenizer(text);
    const tokens = tokenizer.tokenize();

    if (tokens.length === 0) return '';

    // Configuration
    const tabSize = options?.tabSize || 2;
    const insertSpaces = options?.insertSpaces !== false;
    const isJSONC = options?.isJSONC || false;
    const indentString = insertSpaces ? ' '.repeat(tabSize) : '\t';

    const meaningfulTokens = tokens.filter(t => t.type !== TokenType.Whitespace);

    let outputLines: string[] = [];
    let currentLine = '';
    let indentLevel = 0;

    const pushLine = () => {
        if (currentLine.trim() !== '') {
            outputLines.push(currentLine);
        }
        currentLine = '';
    };

    const append = (str: string) => {
        if (currentLine === '') {
            currentLine = indentString.repeat(indentLevel) + str;
        } else {
            currentLine += str;
        }
    };

    // State for Fault Tolerance
    const stack: ('OBJECT' | 'ARRAY')[] = [];

    for (let i = 0; i < meaningfulTokens.length; i++) {
        const token = meaningfulTokens[i];
        const next = i + 1 < meaningfulTokens.length ? meaningfulTokens[i+1] : null;
        const prev = i > 0 ? meaningfulTokens[i-1] : null;

        // --- Pre-Processing / Fault Tolerance Checks ---

        // 1. Missing Comma: Value followed by Value/Key
        // Value tokens: String, Number, Boolean, Null, BraceClose, BracketClose
        const isValue = (t: Token) => [TokenType.String, TokenType.Number, TokenType.Boolean, TokenType.Null, TokenType.BraceClose, TokenType.BracketClose].includes(t.type);
        const isStartOfValue = (t: Token) => [TokenType.String, TokenType.Number, TokenType.Boolean, TokenType.Null, TokenType.BraceOpen, TokenType.BracketOpen].includes(t.type);

        if (prev && isValue(prev) && isStartOfValue(token)) {
            // Detected missing comma: "a": 1 "b": 2
            append(',');
            pushLine();
        }

        // 2. Trailing Comma: Comma followed by Close
        if (token.type === TokenType.Comma && next && (next.type === TokenType.BraceClose || next.type === TokenType.BracketClose)) {
            if (!isJSONC) {
                // Skip this comma for Strict JSON
                continue;
            }
        }

        // --- Indentation Logic (Pre-Append) ---
        if (token.type === TokenType.BraceClose || token.type === TokenType.BracketClose) {
            indentLevel = Math.max(0, indentLevel - 1);
            if (currentLine.trim() !== '') pushLine();
        }

        // --- Spacing Logic ---
        let spaceBefore = false;

        if (currentLine !== '') {
            if (token.type === TokenType.Colon) {
                spaceBefore = false; // "key": value
            } else if (prev && prev.type === TokenType.Colon) {
                spaceBefore = true; // "key": value
            } else if (token.type === TokenType.Comma) {
                spaceBefore = false; // "value",
            } else if (token.type === TokenType.Comment) {
                 spaceBefore = true;
            } else if (token.type === TokenType.BraceOpen || token.type === TokenType.BracketOpen) {
                 if (prev && prev.type === TokenType.Colon) spaceBefore = true;
                 else if (prev && (prev.type === TokenType.BraceOpen || prev.type === TokenType.BracketOpen)) spaceBefore = false;
                 else spaceBefore = true; // space before { if not start
            }
        }

        if (spaceBefore && currentLine !== '') append(' ');

        // --- Append Token ---
        // Quote keys if missing (simple heuristic)
        if (token.type === TokenType.Unknown && /^[a-zA-Z_$][a-zA-Z0-9_$\-]*$/.test(token.text)) {
            // Treat as unquoted string key/value
             append(`"${token.text}"`);
        } else {
            append(token.text);
        }

        // --- Post-Append Logic / State Update ---
        if (token.type === TokenType.BraceOpen) {
            stack.push('OBJECT');
            // Check for empty object
            if (next && next.type === TokenType.BraceClose) {
                // Empty object {}, don't push line
            } else {
                indentLevel++;
                pushLine();
            }
        } else if (token.type === TokenType.BracketOpen) {
            stack.push('ARRAY');
            // Check for empty array
            if (next && next.type === TokenType.BracketClose) {
                // Empty array [], don't push line
            } else {
                indentLevel++;
                pushLine();
            }
        } else if (token.type === TokenType.BraceClose || token.type === TokenType.BracketClose) {
            stack.pop();
            // Ensure newline after block close if followed by something other than comma/close
            if (next && next.type !== TokenType.Comma && next.type !== TokenType.BraceClose && next.type !== TokenType.BracketClose) {
                 pushLine();
            }
        } else if (token.type === TokenType.Comma) {
            pushLine();
        } else if (token.type === TokenType.Comment) {
            pushLine();
        } else if (token.type === TokenType.Colon) {
            // No newline
        } else {
            // Values
            if (next && (next.type === TokenType.BraceClose || next.type === TokenType.BracketClose)) {
                pushLine();
            }
        }
    }

    if (currentLine.trim() !== '') pushLine();

    return outputLines.join('\n');
}
