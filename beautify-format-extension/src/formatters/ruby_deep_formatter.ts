
import { RubyTokenizer, Token, TokenType } from './ruby_tokenizer';

export function formatRubyDeep(text: string): string {
    const tokenizer = new RubyTokenizer(text);
    const tokens = tokenizer.tokenize();

    if (tokens.length === 0) return '';

    const INDENT_SIZE = 2;
    const INDENT_STRING = ' '.repeat(INDENT_SIZE);

    // 1. Pre-process tokens (Attach newlines/spaces info)
    interface EnhancedToken extends Token {
        precedingNewlines: number;
        precedingSpaces: number;
        index: number;
    }

    const enhancedTokens: EnhancedToken[] = [];
    let newlines = 0;
    let spaces = 0;
    let tokenIndex = 0;

    for (const token of tokens) {
        if (token.type === TokenType.Whitespace) {
            const lines = (token.text.match(/\n/g) || []).length;
            newlines += lines;
            if (lines > 0) {
                const lastNewLineIndex = token.text.lastIndexOf('\n');
                spaces = token.text.length - lastNewLineIndex - 1;
            } else {
                spaces += token.text.length;
            }
        } else if (token.type === TokenType.Comment) {
             enhancedTokens.push({ ...token, precedingNewlines: newlines, precedingSpaces: spaces, index: tokenIndex++ });
             newlines = 0; // Let subsequent whitespace handle newlines
             spaces = 0;
        } else {
            enhancedTokens.push({ ...token, precedingNewlines: newlines, precedingSpaces: spaces, index: tokenIndex++ });
            newlines = 0;
            spaces = 0;
        }
    }

    // 2. Formatting Loop
    let output = '';
    let indentLevel = 0;
    let currentLine = '';

    const blockKeywords = new Set(['module', 'class', 'def', 'do', 'begin', 'case', 'for']);
    const conditionalKeywords = new Set(['if', 'unless', 'while', 'until']);
    const intermediateKeywords = new Set(['else', 'elsif', 'when', 'rescue', 'ensure']);
    const endKeywords = new Set(['end']);

    // Helper to check if keyword is a block opener or modifier
    const isBlockOpener = (token: EnhancedToken, prev: EnhancedToken | null): boolean => {
        if (blockKeywords.has(token.text)) return true;
        if (conditionalKeywords.has(token.text)) {
            // Check previous token to decide if it's a modifier
            if (!prev) return true; // Start of file
            if (token.precedingNewlines > 0) return true; // Start of line
            if (prev.text === ';') return true;
            if (prev.text === 'then') return true; // if ... then if ...
            if (prev.text === 'else' || prev.text === 'elsif') return true;
            if (prev.text === '=') return true; // x = if ...
            if (prev.text === 'return') return false; // return if ... (modifier)
            if (prev.text === 'do') return true;
            if (prev.text === '(' || prev.text === '[') return true;
            // Otherwise, likely a modifier: x = 1 if true
            return false;
        }
        return false;
    };

    let prevIsUnary = false;

    for (let i = 0; i < enhancedTokens.length; i++) {
        const token = enhancedTokens[i];
        const next = i + 1 < enhancedTokens.length ? enhancedTokens[i+1] : null;
        const prev = i > 0 ? enhancedTokens[i-1] : null;
        let isUnary = false;

        // --- Dedent Logic (Before processing) ---
        if (token.type === TokenType.Keyword) {
            if (endKeywords.has(token.text)) {
                indentLevel = Math.max(0, indentLevel - 1);
            } else if (intermediateKeywords.has(token.text)) {
                // Dedent for the keyword itself (align with block start)
                indentLevel = Math.max(0, indentLevel - 1);
            }
        } else if (token.text === '}' || token.text === ']' || token.text === ')') {
            indentLevel = Math.max(0, indentLevel - 1);
        }

        // --- Newline Logic ---
        let forceNewline = false;
        let blankLine = false;

        if (token.precedingNewlines > 1) {
            forceNewline = true;
            blankLine = true;
        } else if (token.precedingNewlines === 1) {
            forceNewline = true;
        }

        // Force newlines for block closers/intermediates
        if (token.type === TokenType.Keyword) {
            if (endKeywords.has(token.text) || intermediateKeywords.has(token.text)) {
                forceNewline = true;
            }
            // `def` etc usually start new line
            if (blockKeywords.has(token.text) && prev && prev.text !== ';') {
                 // Unless it's `do` (inline block)
                 if (token.text !== 'do') {
                     // Check if it's start of line already
                     if (token.precedingNewlines === 0 && prev) {
                         // e.g. private def foo
                         // Allow modifiers?
                         // For deep formatting, maybe force newline?
                         // No, `private class` or `private def` is valid on one line?
                         // Usually `private` is on its own line.
                         // But `x = if ...` -> `if` is not on new line.
                         if (!conditionalKeywords.has(token.text)) {
                             // forceNewline = true; // Risk of breaking valid inline constructs
                         }
                     }
                 }
            }
        }

        // Handle Heredoc Body/End - preserve exact structure if possible
        if (token.type === TokenType.HeredocBody || token.type === TokenType.HeredocEnd) {
             // forceNewline determined by precedingNewlines
        }

        // Output Construction
        if (forceNewline || (currentLine.length === 0 && output.length > 0)) {
             if (output.length > 0) {
                 output += '\n';
                 if (blankLine) output += '\n';
             }

             // Indentation for this line
             let currentIndent = indentLevel;

             // Handle Heredoc Indentation
             if (token.type === TokenType.HeredocBody || token.type === TokenType.HeredocEnd) {
                  currentIndent = 0; // Don't indent heredoc content/delimiter (user controlled or handled by token content)
                  // Unless it's `<<-` or `<<~`?
                  // Custom formatter preserved it. Tokenizer returns raw content.
                  // So 0 indent is correct to preserve original.
             }

             output += INDENT_STRING.repeat(currentIndent);
             currentLine = INDENT_STRING.repeat(currentIndent);
        } else {
             // Space Logic
             let spaceBefore = false;
             if (token.precedingSpaces > 0) spaceBefore = true;

             // Rules
             if (prev) {
                 if (token.text === ',') spaceBefore = false;
                 if (token.text === ';') spaceBefore = false;
                 if (token.text === '.') spaceBefore = false;
                 if (token.text === '::') spaceBefore = false;
                 if (prev.text === '::') spaceBefore = false;
                 if (prev.text === '.') spaceBefore = false;

                 // Operators
                 if (token.type === TokenType.Operator) {
                      // Calculate isUnary for current token (to start)
                      if (['+', '-', '*', '&', '!', '~'].includes(token.text)) {
                           if (prev.type === TokenType.Operator || prev.type === TokenType.Keyword || prev.type === TokenType.Punctuation) {
                               if (!['end', ')', ']', '}', '\'', '"'].includes(prev.text)) {
                                    isUnary = true;
                               }
                           }
                      }

                      // Unary operators? !, ~, +, -
                      // Heuristic: space around binary operators.
                      if (['+', '-', '*', '/', '%', '=', '==', '!=', '>', '<', '>=', '<=', '&&', '||', '+=', '-=', '=>'].includes(token.text)) {
                          if (!isUnary) spaceBefore = true;
                      }
                 }

                 if (prev.type === TokenType.Operator) {
                      // Space after operator?
                      // x = 1
                      spaceBefore = true;

                      // Exception: unary
                      if (prevIsUnary) spaceBefore = false;

                      // Other exceptions
                      if (['.', '::', '..', '...', '&'].includes(prev.text)) spaceBefore = false;
                 }

                 // Brackets/Parens
                 if (token.text === '(' || token.text === '[') {
                      // Space before ( ?
                      // if (expr) -> yes
                      // func(expr) -> no
                      if (prev.type === TokenType.Keyword) {
                          if (['if', 'unless', 'while', 'until', 'case', 'switch', 'for'].includes(prev.text)) spaceBefore = true;
                          else spaceBefore = false; // super()
                      } else if (prev.type === TokenType.Identifier) {
                          spaceBefore = false; // method()
                      }
                 }
                 if (prev.text === '(' || prev.text === '[') spaceBefore = false;
                 if (token.text === ')' || token.text === ']') spaceBefore = false;
                 if (token.text === '{') spaceBefore = true;
                 if (prev.text === '{') spaceBefore = true; // { |x| ...
                 if (token.text === '}') spaceBefore = true;
             }

             if (spaceBefore && currentLine.length > 0 && !currentLine.endsWith(' ')) {
                 output += ' ';
                 currentLine += ' ';
             }
        }

        output += token.text;
        currentLine += token.text;

        // --- Indent Logic (After processing) ---
        if (token.type === TokenType.Keyword) {
            if (isBlockOpener(token, prev)) {
                indentLevel++;
            } else if (intermediateKeywords.has(token.text)) {
                // We dedented before printing, now indent for the body
                indentLevel++;
            }
        } else if (token.text === '{' || token.text === '[' || token.text === '(') {
            indentLevel++;
        }

        prevIsUnary = isUnary;
    }

    return output + (output.endsWith('\n') ? '' : '\n');
}
