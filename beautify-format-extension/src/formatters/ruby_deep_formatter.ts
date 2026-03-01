
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
             newlines = 0;
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
    const blockStack: string[] = [];

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
            if (prev.text === 'do') return true; // while ... do ... (loop)
            if (prev.text === '(' || prev.text === '[') return true;
            // Otherwise, likely a modifier: x = 1 if true
            return false;
        }
        return false;
    };

    let prevIsUnary = false;

    // Block parameter state
    let inBlockParams = false;

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
            if (blockKeywords.has(token.text)) {
                 if (token.text === 'do') {
                     // `do` stays on same line usually
                 } else {
                     // Check if it's start of line already
                     if (token.precedingNewlines === 0 && prev) {
                         // private def foo -> no newline
                         // x = if -> no newline
                         if (!conditionalKeywords.has(token.text) && prev.text !== 'private' && prev.text !== 'protected' && prev.text !== 'public') {
                             // Force newline?
                             // Module/Class usually start on new line.
                             if (['module', 'class', 'def'].includes(token.text)) {
                                 // Unless after ;
                                 if (prev.text !== ';') forceNewline = true;
                             }
                         }
                     }
                 }
            }
        }

        // Method Chaining Alignment: if dot is on new line
        if (token.text === '.' || token.text === '&.') {
             if (token.precedingNewlines > 0) {
                 forceNewline = true;
             }
        }

        // Handle Heredoc Body/End - preserve exact structure
        if (token.type === TokenType.HeredocBody || token.type === TokenType.HeredocEnd) {
             // forceNewline determined by precedingNewlines (which comes from tokenizer whitespace preservation)
        }

        // Output Construction
        if (forceNewline || (currentLine.length === 0 && output.length > 0)) {
             if (output.length > 0) {
                 output = output.trimEnd(); // Remove trailing spaces on previous line
                 output += '\n';
                 if (blankLine) output += '\n';
             }

             // Indentation for this line
             let currentIndent = indentLevel;

             // Method chaining indentation
             if (token.text === '.' || token.text === '&.') {
                 currentIndent++; // Indent 1 level deep for chained calls on new line
             }

             // Handle Heredoc Indentation
             if (token.type === TokenType.HeredocBody || token.type === TokenType.HeredocEnd) {
                  currentIndent = 0;
             }

             output += INDENT_STRING.repeat(currentIndent);
             currentLine = INDENT_STRING.repeat(currentIndent);
        } else {
             // Space Logic
             let spaceBefore = false;
             if (token.precedingSpaces > 0) spaceBefore = true;

             // --- Rule Refinements ---
             if (prev) {
                 // No space before punctuation
                 if (token.text === ',' || token.text === ';' || token.text === '.') spaceBefore = false;
                 if (token.text === '::') spaceBefore = false;
                 if (prev.text === '::') spaceBefore = false;
                 if (prev.text === '.') spaceBefore = false;

                 // Operators
                 if (token.type === TokenType.Operator) {
                      // Calculate isUnary for current token
                      if (['+', '-', '*', '&', '!', '~'].includes(token.text)) {
                           if (prev.type === TokenType.Operator || prev.type === TokenType.Keyword || prev.type === TokenType.Punctuation || prev.text === '=') {
                               if (!['end', ')', ']', '}', '\'', '"'].includes(prev.text)) {
                                    isUnary = true;
                               }
                           }
                           // Special case for blocks: &block
                           if (token.text === '&' && (prev.text === ',' || prev.text === '(')) isUnary = true;
                      }

                      // Binary operators: space around
                      if (['+', '-', '*', '/', '%', '=', '==', '!=', '>', '<', '>=', '<=', '&&', '||', '+=', '-=', '=>', '<<', '>>'].includes(token.text)) {
                          if (!isUnary) spaceBefore = true;
                      }

                      // Pipe | for blocks
                      if (token.text === '|') {
                          // Check if it's block param start or end
                          // If prev is { or do, it's start.
                          // If we are inBlockParams, it's end.
                          if (prev.text === '{' || prev.text === 'do') {
                              inBlockParams = true;
                              spaceBefore = true; // space before start pipe: { |x|
                          } else if (inBlockParams) {
                              inBlockParams = false;
                              spaceBefore = false; // no space before end pipe: |x|
                          } else {
                              // bitwise OR
                              spaceBefore = true;
                          }
                      }
                 }

                 if (prev.type === TokenType.Operator) {
                      // Space after operator?
                      spaceBefore = true;

                      // Exception: unary
                      if (prevIsUnary) spaceBefore = false;

                      // Other exceptions
                      if (['.', '::', '..', '...', '&.'].includes(prev.text)) spaceBefore = false;

                      // Pipe |
                      if (prev.text === '|') {
                          if (inBlockParams) {
                              // Just started params: |x| -> no space after first pipe
                              spaceBefore = false;
                          } else {
                              // Closed params: |x| ... -> space after
                              spaceBefore = true;
                          }
                      }
                 }

                 // Block Param handling (Comma inside pipes)
                 if (inBlockParams && token.text === ',') {
                     spaceBefore = false;
                 }
                 if (inBlockParams && prev.text === ',') {
                     spaceBefore = true;
                 }

                 // Brackets/Parens
                 if (token.text === '(' || token.text === '[') {
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

                 // Hash rocket or key: spacing
                 if (prev.text === ':') {
                     spaceBefore = true;
                 }
                 // Fix for key: value (Identifier 'key:' followed by 'value')
                 if (prev.type === TokenType.Identifier && prev.text.endsWith(':')) {
                     spaceBefore = true;
                 }

                 if (token.type === TokenType.Symbol) {
                     // :foo
                     // Space before unless inside parens/brackets
                     if (prev.text === '(' || prev.text === '[' || prev.text === '{') spaceBefore = false;
                     // key: :value -> space before :value
                     if (prev.text === ':') spaceBefore = true;
                     // => :value
                     if (prev.text === '=>') spaceBefore = true;
                     // key: :value (where key: is identifier)
                     if (prev.type === TokenType.Identifier && prev.text.endsWith(':')) spaceBefore = true;
                 }
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
                // Check for double indentation (while ... do)
                if (token.text === 'do' && blockStack.length > 0) {
                     const top = blockStack[blockStack.length - 1];
                     if (['while', 'until', 'for'].includes(top)) {
                         // Don't indent, don't push
                     } else {
                         indentLevel++;
                         blockStack.push(token.text);
                     }
                } else {
                    indentLevel++;
                    blockStack.push(token.text);
                }
            } else if (intermediateKeywords.has(token.text)) {
                // We dedented before printing, now indent for the body
                indentLevel++;
            } else if (endKeywords.has(token.text)) {
                blockStack.pop();
            }
        } else if (token.text === '{' || token.text === '[' || token.text === '(') {
            indentLevel++;
            blockStack.push(token.text);
        } else if (token.text === '}' || token.text === ']' || token.text === ')') {
            blockStack.pop();
        }

        prevIsUnary = isUnary;
    }

    // --- Post-Processing: Vertical Alignment for consecutive assignments ---
    output = alignRubyAssignments(output);

    return output + (output.endsWith('\n') ? '' : '\n');
}

/**
 * Aligns consecutive variable assignments.
 * Example:
 * a      = 1
 * bbb    = 2
 * cccccc = 3
 */
function alignRubyAssignments(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];

    let groupStart = -1;
    let maxEqualPos = 0;

    const flushGroup = () => {
        if (groupStart === -1) return;
        const groupEnd = result.length - 1;
        if (groupEnd > groupStart) {
            for (let i = groupStart; i <= groupEnd; i++) {
                const line = result[i];
                const match = line.match(/^(\s*[a-zA-Z0-9_@$]+(?:\.[a-zA-Z0-9_@$]+)*\s*)=([^=].*)$/);
                if (match) {
                    const leftPart = match[1].trimEnd();
                    const rightPart = match[2];
                    const padding = ' '.repeat(maxEqualPos - leftPart.length);
                    result[i] = `${leftPart}${padding} =${rightPart}`;
                }
            }
        }
        groupStart = -1;
        maxEqualPos = 0;
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check if line is a simple assignment (single `=`) and not part of a larger expression if possible
        // Regex matches `   var_name = value`
        const match = line.match(/^(\s*[a-zA-Z0-9_@$]+(?:\.[a-zA-Z0-9_@$]+)*\s*)=([^=].*)$/);

        if (match && !line.includes('==') && !line.includes('=>') && !line.includes('!=') && !line.includes('<=') && !line.includes('>=')) {
            const leftPart = match[1].trimEnd();
            if (groupStart === -1) {
                groupStart = result.length;
            }
            if (leftPart.length > maxEqualPos) {
                maxEqualPos = leftPart.length;
            }
            result.push(line);
        } else {
            // Check for comments
            if (line.trim().startsWith('#')) {
                result.push(line);
                continue;
            }
            if (line.trim() === '') {
                flushGroup();
                result.push(line);
                continue;
            }
            flushGroup();
            result.push(line);
        }
    }
    flushGroup();

    return result.join('\n');
}
