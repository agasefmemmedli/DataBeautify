
export enum TokenType {
    OpenTag, // <?php, <?=
    CloseTag, // ?>
    Whitespace,
    Comment, // //, #, /* */
    String, // "...", '...', Heredoc
    Keyword,
    Variable, // $var
    Operator, // =, ->, ::, =>, etc.
    Punctuation, // ; ,
    BraceOpen, // { [ (
    BraceClose, // } ] )
    Identifier, // ClassName, funcName
    Number,
    InlineHTML,
    Unknown
}

export interface Token {
    type: TokenType;
    text: string;
    line: number;
    col: number;
}

export class PHPTokenizer {
    private code: string;
    private pos: number = 0;
    private line: number = 1;
    private col: number = 1;
    private inPHP: boolean = false;

    private static readonly KEYWORDS = new Set([
        '__halt_compiler', 'abstract', 'and', 'array', 'as', 'break', 'callable', 'case', 'catch',
        'class', 'clone', 'const', 'continue', 'declare', 'default', 'die', 'do', 'echo', 'else',
        'elseif', 'empty', 'enddeclare', 'endfor', 'endforeach', 'endif', 'endswitch', 'endwhile',
        'eval', 'exit', 'extends', 'final', 'finally', 'fn', 'for', 'foreach', 'function', 'global',
        'goto', 'if', 'implements', 'include', 'include_once', 'instanceof', 'insteadof', 'interface',
        'isset', 'list', 'match', 'namespace', 'new', 'or', 'print', 'private', 'protected', 'public',
        'readonly', 'require', 'require_once', 'return', 'static', 'switch', 'throw', 'trait', 'try',
        'unset', 'use', 'var', 'while', 'xor', 'yield', 'from', 'true', 'false', 'null'
    ]);

    private static readonly OPERATORS = new Set([
        '+', '-', '*', '/', '%', '**', '=', '&', '|', '^', '~', '!',
        '<', '>', '<=', '>=', '==', '!=', '===', '!==', '<=>',
        '<<', '>>', '+=', '-=', '*=', '/=', '%=', '**=', '&=', '|=', '^=', '<<=', '>>=',
        '.', '.=', '->', '=>', '::', '??', '??=', '?:', '...'
    ]);

    constructor(code: string) {
        this.code = code;
    }

    tokenize(): Token[] {
        const tokens: Token[] = [];
        this.pos = 0;
        this.line = 1;
        this.col = 1;
        this.inPHP = false; // Start in HTML mode usually, unless file starts with <?php

        while (this.pos < this.code.length) {
            if (!this.inPHP) {
                // HTML Mode
                // Look for <?php or <?=
                const openTagIndex = this.code.indexOf('<?', this.pos);

                if (openTagIndex === -1) {
                    // Rest is HTML
                    const text = this.code.substring(this.pos);
                    if (text.length > 0) {
                        tokens.push(this.createToken(TokenType.InlineHTML, text));
                        this.advance(text.length);
                    }
                    break;
                }

                // Push HTML content before tag
                if (openTagIndex > this.pos) {
                    const text = this.code.substring(this.pos, openTagIndex);
                    tokens.push(this.createToken(TokenType.InlineHTML, text));
                    this.advance(text.length);
                }

                // Check specific tags
                const remaining = this.code.substring(this.pos);
                let tagMatch = '';
                if (remaining.startsWith('<?php')) {
                    tagMatch = '<?php';
                } else if (remaining.startsWith('<?=')) {
                    tagMatch = '<?=';
                } else if (remaining.startsWith('<?')) {
                    // Short open tag <? might be disabled, but let's assume enabled or xml
                    // If followed by space or newline, likely PHP short tag
                    // Ideally we should check config, but for beautifier let's treat <? as PHP start if valid
                    // But beware of <?xml
                    if (remaining.startsWith('<?xml')) {
                        // XML declaration, treat as HTML
                        tokens.push(this.createToken(TokenType.InlineHTML, '<?xml'));
                        this.advance(5);
                        continue;
                    }
                    tagMatch = '<?';
                }

                if (tagMatch) {
                    tokens.push(this.createToken(TokenType.OpenTag, tagMatch));
                    this.advance(tagMatch.length);
                    this.inPHP = true;
                } else {
                    // Should not happen given indexOf found <?
                    // Just advance one char as HTML
                    tokens.push(this.createToken(TokenType.InlineHTML, '<'));
                    this.advance(1);
                }

            } else {
                // PHP Mode
                const char = this.code[this.pos];
                const remaining = this.code.substring(this.pos);

                // Check Close Tag ?>
                if (remaining.startsWith('?>')) {
                    tokens.push(this.createToken(TokenType.CloseTag, '?>'));
                    this.advance(2);
                    this.inPHP = false;
                    continue;
                }

                // Whitespace
                if (/\s/.test(char)) {
                    this.consumeWhitespace(tokens);
                    continue;
                }

                // Comments
                if (remaining.startsWith('//') || remaining.startsWith('#')) {
                    this.consumeLineComment(tokens);
                    continue;
                }
                if (remaining.startsWith('/*')) {
                    this.consumeBlockComment(tokens);
                    continue;
                }

                // Variable
                if (char === '$') {
                    const match = remaining.match(/^\$[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*/);
                    if (match) {
                        tokens.push(this.createToken(TokenType.Variable, match[0]));
                        this.advance(match[0].length);
                        continue;
                    }
                }

                // Number
                if (/\d/.test(char) || (char === '.' && /\d/.test(this.code[this.pos+1]))) {
                    // Check if it's strictly a number or part of something else
                    // PHP numbers: 123, 1.23, .23, 0x12, 0b10, 1.2e3
                    const numMatch = this.matchNumber(remaining);
                    if (numMatch) {
                        tokens.push(this.createToken(TokenType.Number, numMatch));
                        this.advance(numMatch.length);
                        continue;
                    }
                }

                // String
                if (char === '"' || char === "'" || char === '`') {
                    const str = this.consumeString(char);
                    if (str) {
                        tokens.push(this.createToken(TokenType.String, str));
                        this.advance(str.length);
                        continue;
                    }
                }

                // Heredoc / Nowdoc
                if (remaining.startsWith('<<<')) {
                    const after = remaining.substring(3);
                    const idMatch = after.match(/^\s*([a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*|'[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*'|"[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*")/);
                    if (idMatch) {
                        const label = idMatch[1]; // Label without quotes logic needs to be inside consumeHeredoc or here
                        // Pass the full start length to helper
                        const startLen = 3 + idMatch[0].length;
                        const str = this.consumeHeredoc(label, startLen);
                        tokens.push(this.createToken(TokenType.String, str));
                        this.advance(str.length);
                        continue;
                    }
                }

                // Operator
                const op = this.matchOperator(remaining);
                if (op) {
                    tokens.push(this.createToken(TokenType.Operator, op));
                    this.advance(op.length);
                    continue;
                }

                // Punctuation
                if (char === ';') {
                    tokens.push(this.createToken(TokenType.Punctuation, ';'));
                    this.advance(1);
                    continue;
                }
                if (char === ',') {
                    tokens.push(this.createToken(TokenType.Punctuation, ','));
                    this.advance(1);
                    continue;
                }

                // Braces
                if (char === '{' || char === '[' || char === '(') {
                    tokens.push(this.createToken(TokenType.BraceOpen, char));
                    this.advance(1);
                    continue;
                }
                if (char === '}' || char === ']' || char === ')') {
                    tokens.push(this.createToken(TokenType.BraceClose, char));
                    this.advance(1);
                    continue;
                }

                // Identifier / Keyword
                const idMatch = remaining.match(/^[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*/);
                if (idMatch) {
                    const text = idMatch[0];
                    const type = PHPTokenizer.KEYWORDS.has(text.toLowerCase()) ? TokenType.Keyword : TokenType.Identifier;
                    tokens.push(this.createToken(type, text));
                    this.advance(text.length);
                    continue;
                }

                // Backslash for namespaces (e.g. \App\Models)
                if (char === '\\') {
                     // Usually part of identifier in PHP but tokenized separately or as part of qualified name
                     // Let's treat as Punctuation/Operator or extend Identifier regex
                     // Simplest: Operator or Unknown, let Formatter handle spacing
                     tokens.push(this.createToken(TokenType.Operator, '\\'));
                     this.advance(1);
                     continue;
                }

                // Unknown
                tokens.push(this.createToken(TokenType.Unknown, char));
                this.advance(1);
            }
        }

        return tokens;
    }

    private createToken(type: TokenType, text: string): Token {
        return { type, text, line: this.line, col: this.col };
    }

    private advance(length: number) {
        for (let i = 0; i < length; i++) {
            const char = this.code[this.pos + i];
            if (char === '\n') {
                this.line++;
                this.col = 1;
            } else {
                this.col++;
            }
        }
        this.pos += length;
    }

    private consumeWhitespace(tokens: Token[]) {
        const remaining = this.code.substring(this.pos);
        const match = remaining.match(/^\s+/);
        if (match) {
            tokens.push(this.createToken(TokenType.Whitespace, match[0]));
            this.advance(match[0].length);
        }
    }

    private consumeLineComment(tokens: Token[]) {
        const remaining = this.code.substring(this.pos);
        // Match until newline or ?>
        let endIdx = remaining.indexOf('\n');
        const closeTagIdx = remaining.indexOf('?>');

        if (closeTagIdx !== -1 && (endIdx === -1 || closeTagIdx < endIdx)) {
            // Comment ends at close tag (which is NOT part of comment)
            const text = remaining.substring(0, closeTagIdx);
            tokens.push(this.createToken(TokenType.Comment, text));
            this.advance(text.length);
            return;
        }

        if (endIdx === -1) endIdx = remaining.length; // EOF
        const text = remaining.substring(0, endIdx);
        // Include newline in comment or separate? Standard is usually separate
        // But here we matched until \n. Tokenizer usually consumes \n as whitespace or separate token.
        // Let's consume just content.
        tokens.push(this.createToken(TokenType.Comment, text));
        this.advance(text.length);
    }

    private consumeBlockComment(tokens: Token[]) {
        const remaining = this.code.substring(this.pos);
        const endIdx = remaining.indexOf('*/');
        if (endIdx !== -1) {
            const text = remaining.substring(0, endIdx + 2);
            tokens.push(this.createToken(TokenType.Comment, text));
            this.advance(text.length);
        } else {
            // Unclosed, consume rest
            tokens.push(this.createToken(TokenType.Comment, remaining));
            this.advance(remaining.length);
        }
    }

    private consumeString(quote: string): string | null {
        // Simple string handling
        let i = 1;
        while (this.pos + i < this.code.length) {
            const char = this.code[this.pos + i];
            if (char === '\\') {
                i += 2; // Skip escaped char
                continue;
            }
            if (char === quote) {
                return this.code.substring(this.pos, this.pos + i + 1);
            }
            i++;
        }
        return this.code.substring(this.pos); // Unclosed
    }

    private consumeHeredoc(label: string, startLen: number): string {
        const rawLabel = label.replace(/['"]/g, '');
        let current = this.code.substring(this.pos + startLen);

        // Find end identifier
        // Needs to match \n\s*LABEL;?
        const endRegex = new RegExp(`\\n\\s*${rawLabel};?`);
        const match = current.match(endRegex);

        if (match && match.index !== undefined) {
             return this.code.substring(this.pos, this.pos + startLen + match.index + match[0].length);
        }

        return this.code.substring(this.pos); // Unclosed
    }

    private matchNumber(text: string): string | null {
        // Hex
        const hex = text.match(/^0x[0-9a-fA-F]+/);
        if (hex) return hex[0];
        // Binary
        const bin = text.match(/^0b[01]+/);
        if (bin) return bin[0];
        // Float/Int (supports .5, 1., 1.5, 1e10)
        const match = text.match(/^(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/);
        if (match) return match[0];
        return null;
    }

    private matchOperator(text: string): string | null {
        // Sort operators by length desc
        // We can optimize by checking common prefixes
        // But iterating is safer for correctness first
        // Need to be careful with 'and', 'or', 'xor' which are keywords but also operators
        // They are in KEYWORDS set, so Identifier check handles them as Keywords.
        // OPERATORS set should only contain symbols.

        // Check 3 chars
        if (text.length >= 3) {
            const sub = text.substring(0, 3);
            if (PHPTokenizer.OPERATORS.has(sub)) return sub;
        }
        // Check 2 chars
        if (text.length >= 2) {
            const sub = text.substring(0, 2);
            if (PHPTokenizer.OPERATORS.has(sub)) return sub;
        }
        // Check 1 char
        const sub = text.substring(0, 1);
        if (PHPTokenizer.OPERATORS.has(sub)) return sub;

        return null;
    }
}
