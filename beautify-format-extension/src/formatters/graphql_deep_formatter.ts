import { GraphQLTokenizer, Token, TokenType } from './graphql_tokenizer';

export function formatGraphQLDeep(text: string): string {
    const formatter = new GraphQLFormatter(text);
    return formatter.format();
}

class GraphQLFormatter {
    private tokens: Token[];
    private index: number = 0;
    private indentLevel: number = 0;
    private indentSize: number = 2;

    constructor(text: string) {
        const tokenizer = new GraphQLTokenizer(text);
        this.tokens = tokenizer.tokenize();
    }

    format(): string {
        // First pass: remove pure whitespace tokens (keep newlines/comments)
        this.tokens = this.tokens.filter(t => t.type !== TokenType.Whitespace);

        let result = '';

        while (this.index < this.tokens.length) {
            const token = this.tokens[this.index];

            // Handle Newlines at top level
            if (token.type === TokenType.Newline) {
                // If result is not empty and doesn't end with 2 newlines, ensure spacing
                if (result.length > 0 && !result.endsWith('\n\n')) {
                     if (!result.endsWith('\n')) result += '\n';
                     result += '\n';
                }
                this.index++;
                // Skip subsequent newlines to collapse
                while (this.index < this.tokens.length && this.tokens[this.index].type === TokenType.Newline) {
                    this.index++;
                }
                continue;
            }

            if (token.type === TokenType.Comment) {
                result += token.text + '\n';
                this.index++;
                continue;
            }

            // A definition starts here (e.g. type, query, fragment, directive, scalar, union)

            // Look ahead to capture header
            const headerTokens: Token[] = [];
            let isAlignable = false;

            // Peek keywords to decide alignment
            if (token.text === 'type' || token.text === 'input' || token.text === 'enum' || token.text === 'interface') {
                isAlignable = true;
            }

            // Read until `{` or Newline (if no block)
            let definitionHeader = '';
            let balance = 0;

            while (this.index < this.tokens.length) {
                const t = this.tokens[this.index];

                if (t.text === '{' && balance === 0) {
                    // Block start
                    break;
                }

                if (t.type === TokenType.Newline) {
                    if (balance === 0) {
                        // End of definition header
                        this.index++; // consume newline
                        break;
                    } else {
                        // Inside parens, newline is whitespace
                        this.index++;
                        continue;
                    }
                }

                if (t.text === '(' || t.text === '[') balance++;
                if (t.text === ')' || t.text === ']') balance--;

                // Spacing Logic
                if (definitionHeader.length > 0) {
                     const lastChar = definitionHeader.charAt(definitionHeader.length - 1);
                     // Add space unless:
                     // Previous was (, [, @, !, $, or current is ), ], :, !, ,, .
                     // Wait, comma needs space after, not before.

                     let needsSpace = true;
                     if (lastChar === '(' || lastChar === '[' || lastChar === '@' || lastChar === '!' || lastChar === '$') needsSpace = false;
                     if (t.text === ')' || t.text === ']' || t.text === ':' || t.text === '!' || t.text === ',' || t.text === '.') needsSpace = false;
                     if (lastChar === ' ') needsSpace = false;

                     if (needsSpace) definitionHeader += ' ';
                }

                definitionHeader += t.text;
                if (t.text === ',') definitionHeader += ' '; // Space after comma

                headerTokens.push(t);
                this.index++;
            }

            result += definitionHeader;

            // If we stopped at `{`, process block
            if (this.index < this.tokens.length && this.tokens[this.index].text === '{') {
                result += ' {\n';
                this.index++; // consume {
                this.indentLevel++;

                if (isAlignable) {
                    result += this.processAlignedBlock();
                } else {
                    result += this.processStandardBlock();
                }

                this.indentLevel--;
                result += '}\n';
                this.index++; // consume }
            } else {
                result += '\n';
            }
        }

        return result.trim() + '\n';
    }

    private getIndent(): string {
        return ' '.repeat(this.indentLevel * this.indentSize);
    }

    private processAlignedBlock(): string {
        // Collect all fields: Name [(Args)] : Type [Directives]

        const fields: {
            name: string;
            args: string;
            type: string;
            directives: string;
            comments: string[];
        }[] = [];

        let currentComments: string[] = [];
        let currentName = '';
        let currentArgs = '';
        let currentType = '';
        let currentDirectives = '';

        // Loop until }
        while (this.index < this.tokens.length) {
            const token = this.tokens[this.index];
            if (token.text === '}') break;

            if (token.type === TokenType.Comment) {
                currentComments.push(token.text);
                this.index++;
                continue;
            }
            if (token.type === TokenType.Newline) {
                this.index++;
                continue;
            }
            if (token.text === ',') {
                // Comma between fields? Ignore
                this.index++;
                continue;
            }

            // Parse Field Name
            if (currentName === '') {
                // Name
                currentName = token.text;
                this.index++;

                // Optional Args
                if (this.index < this.tokens.length && this.tokens[this.index].text === '(') {
                    currentArgs = this.parseArgs();
                }

                // Colon?
                if (this.index < this.tokens.length && this.tokens[this.index].text === ':') {
                    this.index++; // consume :
                    // Parse Type
                    currentType = this.parseType();
                }

                // Directives?
                while (this.index < this.tokens.length && this.tokens[this.index].text === '@') {
                    currentDirectives += (currentDirectives ? ' ' : '') + this.parseDirective();
                }

                // Field done. Push to list.
                fields.push({
                    name: currentName,
                    args: currentArgs,
                    type: currentType,
                    directives: currentDirectives,
                    comments: currentComments
                });
                currentName = '';
                currentArgs = '';
                currentType = '';
                currentDirectives = '';
                currentComments = [];
                continue;
            }

            this.index++;
        }

        // Calculate max name length
        let maxNameLen = 0;
        fields.forEach(f => {
            const len = f.name.length + f.args.length;
            if (len > maxNameLen) maxNameLen = len;
        });

        // Print fields
        let blockOutput = '';
        fields.forEach(f => {
            f.comments.forEach(c => {
                blockOutput += this.getIndent() + c + '\n';
            });

            let line = this.getIndent() + f.name + f.args;
            if (f.type) {
                const padding = ' '.repeat(Math.max(0, maxNameLen - (f.name.length + f.args.length)));
                line += padding + ' : ' + f.type;
            }
            if (f.directives) {
                line += ' ' + f.directives;
            }
            blockOutput += line + '\n';
        });

        currentComments.forEach(c => {
            blockOutput += this.getIndent() + c + '\n';
        });

        return blockOutput;
    }

    private processStandardBlock(): string {
        let output = '';
        let lineBuffer = '';
        let pendingIndent = true;

        while (this.index < this.tokens.length) {
            const token = this.tokens[this.index];
            if (token.text === '}') break;

            if (token.type === TokenType.Newline) {
                if (lineBuffer.trim().length > 0) {
                     output += (pendingIndent ? this.getIndent() : '') + lineBuffer + '\n';
                } else if (output.endsWith('\n') && !output.endsWith('{\n')) {
                     // Empty line (but check prevent multiple empty lines)
                     if (!output.endsWith('\n\n')) output += '\n';
                }
                lineBuffer = '';
                pendingIndent = true;
                this.index++;
                continue;
            }

            if (token.type === TokenType.Comment) {
                if (lineBuffer.trim().length > 0) {
                     output += (pendingIndent ? this.getIndent() : '') + lineBuffer + ' ' + token.text + '\n';
                } else {
                     output += this.getIndent() + token.text + '\n';
                }
                lineBuffer = '';
                pendingIndent = true;
                this.index++;
                continue;
            }

            if (token.text === '{') {
                if (lineBuffer.trim().length > 0) {
                    output += (pendingIndent ? this.getIndent() : '') + lineBuffer + ' {\n';
                } else {
                    output += this.getIndent() + '{\n';
                }
                this.index++;
                this.indentLevel++;
                output += this.processStandardBlock();
                this.indentLevel--;
                output += this.getIndent() + '}\n';
                this.index++; // consume }
                lineBuffer = '';
                pendingIndent = true;
                continue;
            }

            // Standard token appending logic
            if (lineBuffer.length > 0) {
                const lastChar = lineBuffer.charAt(lineBuffer.length - 1);
                let needsSpace = true;
                if (lastChar === '(' || lastChar === '[' || lastChar === '@' || lastChar === '!' || lastChar === '$') needsSpace = false;
                if (token.text === ')' || token.text === ']' || token.text === ':' || token.text === '!' || token.text === ',' || token.text === '.') needsSpace = false;
                if (lastChar === ' ') needsSpace = false;

                // Special case: no space before ( in Field(Args)
                // But space before ( in @Directive(Args)? No.
                // Space before ( in Type(Args) (e.g. directive definition)? No.
                if (token.text === '(') needsSpace = false;

                // Space after :
                if (lastChar === ':') needsSpace = true;

                // Space after comma
                if (lastChar === ',') needsSpace = true;

                if (needsSpace) lineBuffer += ' ';
            }

            lineBuffer += token.text;
            this.index++;
        }

        if (lineBuffer.trim().length > 0) {
             output += (pendingIndent ? this.getIndent() : '') + lineBuffer + '\n';
        }
        return output;
    }

    private parseArgs(): string {
        let res = '(';
        this.index++; // consume (
        let balance = 1;
        while (this.index < this.tokens.length) {
            const t = this.tokens[this.index];
            if (t.text === ')') {
                balance--;
                if (balance === 0) {
                    res += ')';
                    this.index++;
                    return res;
                }
            }
            if (t.text === '(') balance++;

            // Formatting Logic inside Args
            // We want space after : and ,
            if (res.length > 0) {
                 const lastChar = res.charAt(res.length - 1);
                 let needsSpace = false;

                 // Space after :
                 if (lastChar === ':') needsSpace = true;
                 // Space after ,
                 if (lastChar === ',') needsSpace = true;

                 // No space before : or ,
                 if (t.text === ':' || t.text === ',') needsSpace = false;

                 // Standard spacing rules for other tokens?
                 // e.g. Name Name -> Name Name (rare in args, usually Name: Value)

                 if (needsSpace && t.text !== ')' && t.text !== ']') res += ' ';
            }

            res += t.text;
            this.index++;
        }
        return res;
    }

    private parseType(): string {
        // [Type!]!
        let res = '';
        while (this.index < this.tokens.length) {
            const t = this.tokens[this.index];
            if (t.type === TokenType.Name || t.text === '[' || t.text === ']' || t.text === '!') {
                res += t.text;
                this.index++;
            } else {
                break;
            }
        }
        return res;
    }

    private parseDirective(): string {
        // @Name(Args)
        let res = '@';
        this.index++; // consume @
        if (this.index < this.tokens.length && this.tokens[this.index].type === TokenType.Name) {
            res += this.tokens[this.index].text;
            this.index++;
        }
        if (this.index < this.tokens.length && this.tokens[this.index].text === '(') {
            res += this.parseArgs();
        }
        return res;
    }
}
