
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
    let inInitializerList = false;

    // Switch State Tracking
    // Stack stores the indent level of the 'switch' keyword
    const switchStack: { indent: number, inCase: boolean, isExpression: boolean }[] = [];

    // Block State Tracking (True = Structural/Expanded, False = Inline)
    const blockStack: boolean[] = [];

    let inGenerics = 0;
    let justClosedGeneric = false;

    // Helper to get indent string
    const getIndent = (level: number) => INDENT_STRING.repeat(Math.max(0, level));

    const isType = (t: Token) => {
        // Simple heuristic: Capitalized or built-in types
        return /^[A-Z]/.test(t.text) || ['int', 'double', 'num', 'bool', 'dynamic', 'void', 'var', 'String', 'List', 'Map', 'Set', 'Future', 'Stream', 'final', 'const', 'late'].includes(t.text);
    };

    for (let i = 0; i < enhancedTokens.length; i++) {
        const token = enhancedTokens[i];
        const next = i + 1 < enhancedTokens.length ? enhancedTokens[i+1] : null;
        const prev = i > 0 ? enhancedTokens[i-1] : null;

        // --- Indentation Adjustments (Before processing token) ---
        // Dedent closing brackets immediately
        if (['}', ']', ')'].includes(token.text)) {
            // Special handling for switch closing brace
            // Wait to pop until after we process the token, but check logic here if needed
            indentLevel = Math.max(0, indentLevel - 1);

             // Pop switch stack AFTER decrementing indentLevel and matching
            if (token.text === '}') {
                if (switchStack.length > 0) {
                     const currentSwitch = switchStack[switchStack.length-1];
                     if (indentLevel === currentSwitch.indent) {
                         switchStack.pop();
                     }
                }
            }
        }

        // Handle Switch Case/Default Dedent (Before processing)
        if (switchStack.length > 0) {
            const currentSwitch = switchStack[switchStack.length - 1];

            if (!currentSwitch.isExpression) {
                // Statement Switch: If we encounter 'case' or 'default', we should be at switchIndent + 1
                if (token.text === 'case' || token.text === 'default') {
                    // Ensure we are indented correctly relative to switch
                    // We manually force indentLevel for case labels
                    indentLevel = currentSwitch.indent + 1;
                    currentSwitch.inCase = false; // We are at label, not body
                }
            } else {
                 // Expression Switch: 'case' keyword not used (usually). It uses patterns.
                 // e.g. 0 => 'zero',
                 // We don't have 'case' keyword.
            }
        }

        // Block Stack Logic (Push/Pop)
        if (token.text === '{') {
            // Determine if this block is structural
            const isStructuralBlock = (p: EnhancedToken | null) => {
                if (!p) return false;
                // Structural: ) { (e.g. if, for, while, switch, function)
                if (p.text === ')') return true;
                // Structural keywords
                if (['else', 'try', 'do', 'finally'].includes(p.text)) return true;
                // Structural identifiers (class A, mixin M, extension E, enum E, get foo, set foo)
                if (p.type === TokenType.Identifier || p.text === 'get' || p.text === 'set') {
                    return true;
                }
                // Switch expression: switch (x) { ... }
                // if p is switch, it IS structural/block
                if (p.text === 'switch') return true;

                // Map literal? var x = { ... }
                // Set literal? var x = { ... }
                // If previous was = or : or , or ( or [ or return, likely literal -> inline
                if (['=', ':', ',', '(', '[', 'return', '=>'].includes(p.text)) return false;

                return false; // Default to inline for unknown
            };

            // Check for map literal explicitly
            let isMap = false;
            if (prev && ['=', ':', 'return', '=>', '(', '[', ','].includes(prev.text)) isMap = true;
            if (prev && prev.type === TokenType.Identifier && next && next.text === ':') isMap = true; // named param map?

            // If indentation level is deep, we might want to expand even if it's a map
            // But standard Dart style expands maps if they are multi-line.
            // We rely on token.precedingNewlines to detect user intent for maps?
            // Or force expand if long?
            // For now, let's track if it's structural (Control Flow / Class) vs Literal.
            const structural = isStructuralBlock(prev);
            blockStack.push(structural);
        }

        let blockJustPoppedStructural = false;
        if (token.text === '}') {
            if (blockStack.length > 0) {
                blockJustPoppedStructural = blockStack.pop()!;
            }
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
            if (prev && prev.text === '{') {
                forceNewline = false; // Collapse empty blocks
            } else {
                // If the block was structural, force newline.
                // If it was inline (map/set), respect user newline (already set) OR force if multi-line content?
                // For deep formatting, we usually enforce newlines for structural blocks.
                if (blockJustPoppedStructural) {
                    forceNewline = true;
                }
            }
        }
        if (prev && prev.text === '{') {
            if (token.text !== '}') {
                const isStructural = blockStack.length > 0 ? blockStack[blockStack.length - 1] : true;
                if (isStructural) {
                    forceNewline = true;
                } else {
                    // For literals, if user had newline, keep it.
                    // If items inside are complex, maybe force?
                }
            }
        }
        if (prev && prev.text === ';') {
            if (inParen === 0) forceNewline = true;
            else forceNewline = false; // for loop
        }
        if (prev && (prev.text === '}' || prev.type === TokenType.Comment)) {
            forceNewline = true;
            // Don't force newline if followed by these
            if (prev.text === '}' && (token.text === 'else' || token.text === 'catch' || token.text === 'on' || token.text === ',' || token.text === ';' || token.text === ')')) {
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
        if (prev && prev.type === TokenType.Decorator && token.type === TokenType.Identifier) { // @override void
             if (inParen === 0) forceNewline = true;
        }

        // Cascades
        if (token.text === '..' || token.text === '?..') {
            forceNewline = true;
        }

        // Switch Case/Default
        if (switchStack.length > 0) {
            const currentSwitch = switchStack[switchStack.length - 1];
            if (!currentSwitch.isExpression) {
                if (token.text === 'case' || token.text === 'default') {
                    forceNewline = true;
                }
                if (prev && prev.text === ':') {
                     // If previous token was colon and we are in a switch (and it was a case label colon)
                     // We need to check if we just finished a case label.
                     if (!currentSwitch.inCase) {
                          forceNewline = true;
                          currentSwitch.inCase = true; // Enter body
                     }
                }
            } else {
                 // Switch Expression
                 // Comma separates cases
                 if (prev && prev.text === ',') {
                      forceNewline = true;
                 }
            }
        }

        // Initializer List Logic (commas force newline AFTER comma)
        if (inInitializerList && prev && prev.text === ',') {
            forceNewline = true;
        }

        // Constructor Initializers :
        // Note: This simple heuristic (inBrace >= 1) might incorrectly identify ternary operators in field initializers if they end with ')'
        if (token.text === ':' && inParen === 0 && inBrace >= 1 && switchStack.length === 0) {
            if (prev && prev.text === ')') {
                 // Likely constructor initializer list start
                 forceNewline = true;
                 inInitializerList = true; // Enter Initializer List
            }
        }

        // End Initializer List
        if (inInitializerList && (token.text === '{' || token.text === ';')) {
            inInitializerList = false;
        }

        // Class Member Spacing
        if (inBrace === 1 && indentLevel === 1) {
             if ((token.type === TokenType.Keyword || isType(token) || token.type === TokenType.Decorator) &&
                 prev && (prev.text === ';' || prev.text === '}') &&
                 !['else', 'catch', 'on'].includes(token.text)) {

                  if (prev.text === '}') {
                       blankLine = true;
                       forceNewline = true;
                  }

                  if (token.type === TokenType.Decorator && prev.text === ';') {
                      blankLine = true;
                      forceNewline = true;
                  }
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

            if (inInitializerList) {
                // Initializer list is indented +2 relative to constructor (which is at indentLevel)
                // Wait, if indentLevel is 1 (inside class), constructor is at 1.
                // Initializer list should be at 1 + 2 = 3.
                // But previously I saw it wasn't indented enough.
                // Let's force +2.
                currentIndent = indentLevel + 2;
            }

            // Switch Case Body Indentation
            if (switchStack.length > 0) {
                const currentSwitch = switchStack[switchStack.length - 1];
                if (!currentSwitch.isExpression) {
                    if (currentSwitch.inCase && token.text !== 'case' && token.text !== 'default' && token.text !== '}') {
                        // We are in case body, add extra indent
                        currentIndent = currentSwitch.indent + 2;
                    }
                }
            }

            // Adjust indent for Cascades
            // Cascade should align with the receiver? Or just indent + 1 level?
            // Standard Dart style:
            // var list = [1, 2, 3]
            //   ..add(4)
            //   ..add(5);
            // Indent is +2 spaces relative to 'var'.
            // If 'var' is at level 1, cascade is at level 1 + 2?
            // No, cascade is at level 1 + 1 (2 spaces indent).
            if (token.text === '..' || token.text === '?..') {
                currentIndent += 1;
            }

            // Adjust for constructor initializer colon
            if (token.text === ':') {
                 if (prev && prev.text === ')') {
                      currentIndent = indentLevel + 2; // Indent initializer list start
                 }
            }

            // Adjust for wrapped arguments/parameters
            if ((inParen > 0 || inBracket > 0) && forceNewline) {
                 // Check if we are inside a parameter list that wraps
                 // Simple heuristic: if previous was comma or opening paren
                 if (prev && (prev.text === ',' || prev.text === '(' || prev.text === '[')) {
                      // Don't double indent if indentLevel already increased
                 } else {
                     // Continuation indent
                     if (!['}', ']'].includes(token.text)) { // Don't indent closing on new line
                        // No additional indentation needed here for block format
                     }
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
                     if (!['(', '.', '?.', '::', '[', ')', ']', ';', ',', '!', '?', ':'].includes(token.text)) {
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

                          if (switchStack.length > 0) {
                               const currentSwitch = switchStack[switchStack.length - 1];
                               // If potentially a case label colon
                               if (!currentSwitch.isExpression && !currentSwitch.inCase) {
                                   spaceBefore = false;
                               }
                          }

                          if (prev.text === ')') {
                              spaceBefore = true;
                          }

                          if (prev.type === TokenType.Identifier && (inParen > 0 || inBrace > 0)) {
                              spaceBefore = false;
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
                     } else if (token.text === '=>') {
                          spaceBefore = true;
                     } else {
                          spaceBefore = true;
                     }
                }

                if (prev.text === ',') spaceBefore = true;
                if (prev.text === ';') spaceBefore = true;

                if (prev.text === ':') {
                    spaceBefore = true;
                }

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
            if (token.text === '}' && prev && prev.text === '{') spaceBefore = false; // {} -> no space
            if (token.text === '(') {
                 if (prev && (prev.type === TokenType.Identifier || prev.type === TokenType.Keyword)) {
                     if (['if', 'for', 'while', 'switch', 'catch', 'var'].includes(prev.text)) spaceBefore = true;
                     else spaceBefore = false;
                 }
                 else if (prev && prev.text === '>') {
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
                 // Check for switch
                 // Robust lookback logic
                 let j = i - 1;
                 while(j >= 0 && enhancedTokens[j].type === TokenType.Comment) j--; // Skip comments

                 if (j >= 0 && enhancedTokens[j].text === ')') {
                      // skip parens of switch(x)
                      let parenCount = 1;
                      j--;
                      while (j >= 0 && parenCount > 0) {
                          if (enhancedTokens[j].text === ')') parenCount++;
                          else if (enhancedTokens[j].text === '(') parenCount--;
                          j--;
                      }

                      // Skip comments between ( and switch
                      while (j >= 0 && enhancedTokens[j].type === TokenType.Comment) j--;

                      // Check if it's a Switch Statement or Switch Expression
                      // Statement: switch (x) { ... }
                      // Expression: var x = switch (y) { ... };
                      if (j >= 0 && enhancedTokens[j].text === 'switch') {
                           // Determine if expression by checking what's before 'switch'
                           let k = j - 1;
                           while (k >= 0 && enhancedTokens[k].type === TokenType.Comment) k--;

                           const isExpression = k >= 0 && (enhancedTokens[k].text === '=' || enhancedTokens[k].text === ':' || enhancedTokens[k].text === 'return' || enhancedTokens[k].text === '=>' || enhancedTokens[k].text === '(');

                           switchStack.push({ indent: indentLevel - 1, inCase: false, isExpression });
                      }
                 }
            }
            if (token.text === '(') inParen++;
            if (token.text === '[') inBracket++;
        } else if (['}', ']', ')'].includes(token.text)) {
             if (token.text === '}') {
                 inBrace--;
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
        } else if (firstImportIndex !== -1) {
            // Stop if we hit a non-blank, non-comment line that is not an import/library
            // But allow blank lines and comments if they look like part of the block?
            // Actually, safest is to stop at ANY non-import/non-library line.
            // But usually there are blank lines in between.
            if (line === '') {
                // blank line, continue
            } else if (line.startsWith('library ')) {
                // library directive, often before imports
                // If it was BEFORE imports, we haven't set firstImportIndex yet.
                // If it is AFTER imports? Valid Dart? Yes.
                // But usually library is first.
                break;
            } else if (line.startsWith('//') || line.startsWith('/*')) {
                // Comments.
                // If we encounter a comment, is it part of the import block?
                // If it's a section header "class Foo", it breaks.
                // If it's "// Imports for JSON", it might be part.
                // Heuristic: If comment is followed by import, it is part.
                // But we don't know yet.
                // Safe bet: Sort ONLY if the block is pure imports/exports + blanks.
                // If we see a comment, we terminate the block to be safe.
                // Wait, my previous failure was because `// Annotations` was treated as part of the block?
                // `// Annotations` came AFTER `import ... bar`.
                // So I should STOP at `// Annotations`.
                break;
            } else {
                // Code or other directive
                break;
            }
        }
    }

    if (importLines.length === 0) return text;

    // Check if we captured valid range
    // Since we break on comment, we don't need to check hasComments unless we want to avoid sorting *interleaved* comments?
    // We didn't capture comments in importLines.
    // So we just replace lines[firstImportIndex...lastImportIndex] with sorted.
    // BUT, lastImportIndex might not have been updated for the blank lines at the end.
    // lastImportIndex tracks the last actual import line.

    // We should include blank lines *between* imports in the range we replace?
    // Actually, `sortDartImports` rewrites the whole block with new blank lines.
    // So we should replace from `firstImportIndex` to `lastImportIndex` (inclusive of the last import).
    // Any blank lines *after* `lastImportIndex` are preserved as is (outside the splice).
    // Any blank lines *between* first and last are absorbed.

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
        sortedBlock.push('');
    }
    if (packageImports.length > 0) {
        sortedBlock.push(...packageImports);
        sortedBlock.push('');
    }
    if (relativeImports.length > 0) {
        sortedBlock.push(...relativeImports);
        sortedBlock.push('');
    }
    if (exports.length > 0) {
        sortedBlock.push(...exports);
    }

    // Remove trailing empty line in sorted block if present
    if (sortedBlock.length > 0 && sortedBlock[sortedBlock.length - 1] === '') {
        sortedBlock.pop();
    }

    lines.splice(firstImportIndex, lastImportIndex - firstImportIndex + 1, ...sortedBlock);

    return lines.join('\n');
}
