
import { DartTokenizer, Token, TokenType } from './dart_tokenizer';

export function formatDartDeep(text: string): string {
    const tokenizer = new DartTokenizer(text);
    const tokens = tokenizer.tokenize();

    if (tokens.length === 0) return '';

    const INDENT_SIZE = 2;
    const INDENT_STRING = ' '.repeat(INDENT_SIZE);

    // 1. Pre-process tokens
    interface EnhancedToken extends Token {
        precedingNewlines: number;
        precedingSpaces: number;
    }

    const enhancedTokens: EnhancedToken[] = [];
    let newlines = 0;
    let spaces = 0;

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
             enhancedTokens.push({ ...token, precedingNewlines: newlines, precedingSpaces: spaces });
             newlines = 0;
             spaces = 0;
        } else {
            enhancedTokens.push({ ...token, precedingNewlines: newlines, precedingSpaces: spaces });
            newlines = 0;
            spaces = 0;
        }
    }

    // 2. Formatting Loop
    let output = '';
    let indentLevel = 0;
    let currentLine = '';

    // State
    let inParen = 0;
    let inBracket = 0;
    let inBrace = 0;
    let inSwitch = false;
    let inGenerics = 0;
    let justClosedGeneric = false;

    // Helper to get indent string
    const getIndent = (level: number) => INDENT_STRING.repeat(Math.max(0, level));

    const isType = (t: Token) => {
        // Simple heuristic: Capitalized or built-in types
        return /^[A-Z]/.test(t.text) || ['int', 'double', 'num', 'bool', 'dynamic', 'void', 'var', 'String', 'List', 'Map', 'Set', 'Future', 'Stream'].includes(t.text);
    };

    for (let i = 0; i < enhancedTokens.length; i++) {
        const token = enhancedTokens[i];
        const next = i + 1 < enhancedTokens.length ? enhancedTokens[i+1] : null;
        const prev = i > 0 ? enhancedTokens[i-1] : null;

        // --- Indentation Adjustments (Before processing token) ---
        if (['}', ']', ')'].includes(token.text)) {
            indentLevel = Math.max(0, indentLevel - 1);
        }

        // --- Newline Logic ---
        let forceNewline = false;
        let blankLine = false;

        // Preserve user blank lines (max 1)
        if (token.precedingNewlines > 1) {
            forceNewline = true;
            blankLine = true;
        } else if (token.precedingNewlines === 1) {
            forceNewline = true;
        }

        // Deep Formatting Rules for Newlines
        if (token.text === '}') {
            forceNewline = true;
        }
        if (prev && prev.text === '{') {
            forceNewline = true;
        }
        if (prev && prev.text === ';') {
            if (inParen === 0) forceNewline = true;
            else forceNewline = false; // for loop
        }
        if (prev && (prev.text === '}' || prev.type === TokenType.Comment)) {
            forceNewline = true;
            if (prev.text === '}' && (token.text === 'else' || token.text === 'catch' || token.text === 'on' || token.text === ',' || token.text === ';')) {
                 forceNewline = false;
            }
        }

        // Annotations
        if (token.type === TokenType.Decorator) {
             if (prev && prev.text !== '(' && prev.text !== ',') {
                 forceNewline = true;
             }
        }
        if (prev && prev.type === TokenType.Decorator && token.type === TokenType.Keyword) {
            if (inParen === 0) forceNewline = true;
        }

        // Cascades
        if (token.text === '..' || token.text === '?..') {
            forceNewline = true;
        }

        // Constructor Initializers :
        if (token.text === ':' && inParen === 0 && inBrace === 1 && !inSwitch) {
            if (prev && prev.text === ')') {
                 forceNewline = true;
            }
        }

        // Append to output
        if (forceNewline || (currentLine.length === 0 && output.length > 0)) {
            if (output.length > 0) {
                 output += '\n';
                 if (blankLine) output += '\n';
            }

            // Calc indent
            let currentIndent = indentLevel;

            // Adjust indent for Cascades
            if (token.text === '..' || token.text === '?..') {
                currentIndent += 2;
            }
            // Adjust for constructor initializer
            if (token.text === ':') {
                 if (prev && prev.text === ')') {
                      currentIndent += 2; // Indent initializer list
                 }
            }
            // Adjust for wrapped arguments/parameters
            if ((inParen > 0 || inBracket > 0) && forceNewline) {
                 if (prev && !['(', '[', '{'].includes(prev.text)) {
                      currentIndent += 1; // 2 spaces
                 }
            }

            output += getIndent(currentIndent);
            currentLine = getIndent(currentIndent);
        } else {
            // Space handling
            let spaceBefore = false;

            if (token.precedingSpaces > 0 && token.precedingNewlines === 0) {
                 spaceBefore = true;
            }

            // Enforce spacing rules
            if (prev) {
                if (prev.type === TokenType.Keyword) {
                     if (!['(', '.', '?.', '::', '[', ')', ']', ';', ',', '!', '?'].includes(token.text)) {
                          spaceBefore = true;
                     }
                     if (['this', 'super'].includes(prev.text) && token.text === '.') spaceBefore = false;
                }

                if (token.type === TokenType.Operator) {
                     if (['.', '?.', '++', '--', '(', '[', '::'].includes(token.text)) {
                          spaceBefore = false;
                     } else if (token.text === '!') {
                          spaceBefore = false;
                     } else if (token.text === '...') {
                          spaceBefore = false; // ...list
                     } else if (token.text === ':') {
                          spaceBefore = false;
                          if (inSwitch && (prev.type === TokenType.Number || prev.type === TokenType.Identifier || prev.text === 'default')) {
                               spaceBefore = false;
                          }
                          // Heuristic for map vs ternary vs named arg
                          if (prev.type === TokenType.Identifier && inParen > 0) {
                               spaceBefore = false;
                          } else {
                               if (inBrace > 0 && prev.type === TokenType.Identifier) {
                                   spaceBefore = false;
                               } else {
                                   spaceBefore = true;
                               }
                          }
                     } else if (token.text === '<') {
                          // Type<T> -> No space
                          if (inGenerics > 0 || isType(prev)) {
                               spaceBefore = false;
                          } else if (prev.type === TokenType.Identifier && next && isType(next)) {
                               spaceBefore = false; // method<Type>
                          } else {
                               spaceBefore = true; // x < 0
                          }
                     } else if (token.text === '>') {
                          if (inGenerics > 0) {
                               spaceBefore = false; // T>
                          } else {
                               spaceBefore = true; // x > 0
                          }
                     } else if (token.text === '>>' || token.text === '>>>') {
                          if (inGenerics > 0) {
                               spaceBefore = false;
                          } else {
                               spaceBefore = true;
                          }
                     } else {
                          spaceBefore = true;
                     }
                }

                if (prev.text === ',') spaceBefore = true;
                if (prev.text === ';') spaceBefore = true;
                if (prev.text === ':') spaceBefore = true;

                if (prev.type === TokenType.Operator) {
                     if (['!', '++', '--', '~'].includes(prev.text)) spaceBefore = false;
                     else if (['.', '?.', '..', '?..', '...'].includes(prev.text)) spaceBefore = false;
                     else if (['(', '['].includes(prev.text)) spaceBefore = false;
                     else if (['<'].includes(prev.text)) {
                          if (isType(token)) spaceBefore = false; // <T
                          else spaceBefore = true; // < 3
                     }
                     else if (prev.text === '>') {
                          // T>> or T> >
                          if (token.text === '>') spaceBefore = false; // Join >>
                          else spaceBefore = true;
                     }
                     else spaceBefore = true;
                }

                if (token.text === '{') spaceBefore = true;
                if (token.text === '?' && isType(prev)) spaceBefore = false; // String?
            }

            // Exceptions
            if (token.text === ',' || token.text === ';') spaceBefore = false;
            if (token.text === '.' || token.text === '?.') spaceBefore = false;
            if (token.text === ')' || token.text === ']') spaceBefore = false;
            if (token.text === '(') {
                 if (prev && (prev.type === TokenType.Identifier || prev.type === TokenType.Keyword)) {
                     if (['if', 'for', 'while', 'switch', 'catch'].includes(prev.text)) spaceBefore = true;
                     else spaceBefore = false;
                 }
                 else if (prev && prev.text === '>') {
                      // T>() likely method call with generic or cast?
                      if (justClosedGeneric) spaceBefore = false; // foo<T>()
                      else spaceBefore = true; // comparison x > (1)
                 }
            }
            if (token.text === '[' && prev && prev.type === TokenType.Identifier) spaceBefore = false;
            if (prev && prev.text === '(' && token.text === '{') spaceBefore = false; // ({

            if (spaceBefore && currentLine.length > 0 && !currentLine.endsWith(' ')) {
                output += ' ';
                currentLine += ' ';
            }
        }

        output += token.text;
        currentLine += token.text;

        // --- Indentation Adjustments (After processing token) ---
        if (['{', '[', '('].includes(token.text)) {
            indentLevel++;
            if (token.text === '{') {
                 inBrace++;
                 if (prev && prev.text === ')') {
                      let j = i - 1;
                      while(j >= 0 && enhancedTokens[j].type !== TokenType.Keyword) j--;
                      if (j >= 0 && enhancedTokens[j].text === 'switch') {
                           inSwitch = true;
                      }
                 }
            }
            if (token.text === '(') inParen++;
            if (token.text === '[') inBracket++;
        } else if (['}', ']', ')'].includes(token.text)) {
             if (token.text === '}') {
                 inBrace--;
                 if (inSwitch) inSwitch = false;
             }
             if (token.text === ')') inParen--;
             if (token.text === ']') inBracket--;
        }

        // Generics tracking
        justClosedGeneric = false;
        if (token.text === '<') {
             if (prev && (isType(prev) || (prev.type === TokenType.Identifier && next && isType(next)))) {
                  inGenerics++;
             }
        } else if (token.text === '>') {
             if (inGenerics > 0) { inGenerics--; justClosedGeneric = true; }
        } else if (token.text === '>>') {
             if (inGenerics > 0) { inGenerics -= 2; justClosedGeneric = true; }
        } else if (token.text === '>>>') {
             if (inGenerics > 0) { inGenerics -= 3; justClosedGeneric = true; }
        }
    }

    return sortDartImports(output + (output.endsWith('\n') ? '' : '\n'));
}

function sortDartImports(text: string): string {
    const lines = text.split('\n');
    const importLines: { line: string, type: number, index: number }[] = [];
    let firstImportIndex = -1;
    let lastImportIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('import ') || line.startsWith('export ')) {
            if (firstImportIndex === -1) firstImportIndex = i;
            lastImportIndex = i;

            let type = 2; // relative
            if (line.startsWith('export ')) type = 3;
            else if (line.includes("'dart:") || line.includes('"dart:')) type = 0;
            else if (line.includes("'package:") || line.includes('"package:')) type = 1;

            importLines.push({ line: lines[i], type, index: i });
        } else if (line === '' || line.startsWith('//') || line.startsWith('/*') || line.startsWith('library ')) {
            if (firstImportIndex !== -1 && !line.startsWith('//') && line !== '' && !line.startsWith('library ')) {
                 break;
            }
        } else if (firstImportIndex !== -1) {
             break;
        }
    }

    if (importLines.length === 0) return text;

    let hasComments = false;
    for(let i = firstImportIndex; i <= lastImportIndex; i++) {
        const line = lines[i].trim();
        if (line.startsWith('//') || line.startsWith('/*')) {
            hasComments = true;
            break;
        }
    }

    if (hasComments) return text;

    importLines.sort((a, b) => {
        if (a.type !== b.type) return a.type - b.type;
        return a.line.localeCompare(b.line);
    });

    const dartImports = importLines.filter(x => x.type === 0).map(x => x.line);
    const packageImports = importLines.filter(x => x.type === 1).map(x => x.line);
    const relativeImports = importLines.filter(x => x.type === 2).map(x => x.line);
    const exports = importLines.filter(x => x.type === 3).map(x => x.line);

    const sortedBlock: string[] = [];
    if (dartImports.length > 0) {
        sortedBlock.push(...dartImports);
        if (packageImports.length > 0 || relativeImports.length > 0 || exports.length > 0) sortedBlock.push('');
    }
    if (packageImports.length > 0) {
        sortedBlock.push(...packageImports);
        if (relativeImports.length > 0 || exports.length > 0) sortedBlock.push('');
    }
    if (relativeImports.length > 0) {
        sortedBlock.push(...relativeImports);
        if (exports.length > 0) sortedBlock.push('');
    }
    if (exports.length > 0) {
        sortedBlock.push(...exports);
    }

    lines.splice(firstImportIndex, lastImportIndex - firstImportIndex + 1, ...sortedBlock);

    return lines.join('\n');
}
