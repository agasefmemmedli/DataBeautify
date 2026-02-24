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
        // Filter out pure whitespace, but keep comments and newlines for now to handle spacing/preservation?
        // Actually, for deep formatting, we usually discard original whitespace and reconstruct it.
        // But comments need to be preserved.
        // Newlines: we might want to preserve double newlines for separation.
        this.tokens = this.tokens.filter(t => t.type !== TokenType.Whitespace);
    }

    private get current(): Token | undefined {
        return this.tokens[this.index];
    }

    private get next(): Token | undefined {
        return this.tokens[this.index + 1];
    }

    private advance(): Token {
        return this.tokens[this.index++];
    }

    private peek(offset: number = 0): Token | undefined {
        return this.tokens[this.index + offset];
    }

    format(): string {
        let result = '';
        while (this.index < this.tokens.length) {
            const token = this.current;
            if (!token) break;

            if (token.type === TokenType.Newline) {
                // Preserve max 2 newlines (one empty line)
                let newlineCount = 0;
                while (this.index < this.tokens.length && this.tokens[this.index].type === TokenType.Newline) {
                    newlineCount++;
                    this.index++;
                }
                if (result.length > 0) {
                    if (newlineCount > 1) result += '\n\n';
                    else result += '\n';
                }
                continue;
            }

            if (token.type === TokenType.Comment) {
                result += token.text + '\n';
                this.index++;
                continue;
            }

            // Top level definition
            result += this.parseDefinition();
            result += '\n'; // Ensure newline after definition
        }
        return result.trim() + '\n';
    }

    private parseDefinition(): string {
        // Handle Description (String/BlockString before definition)
        let output = '';

        // Check for Description (String/BlockString) or Comments
        while (this.current) {
            const token = this.current;
            if (!(token.type === TokenType.Comment || token.type === TokenType.String || token.type === TokenType.BlockString)) {
                break;
            }

             if (token.type === TokenType.Comment) {
                 output += token.text + '\n';
                 this.advance();
             } else {
                 // It's a description if followed by a Name or 'type', 'query', etc.
                 // But strictly, only Strings can be descriptions.
                 // Skip newlines/comments to see what's next
                 let offset = 1;
                 while (this.tokens[this.index + offset] && (this.tokens[this.index + offset].type === TokenType.Newline || this.tokens[this.index + offset].type === TokenType.Comment)) {
                     offset++;
                 }
                 const target = this.tokens[this.index + offset];

                 if (target && target.type === TokenType.Name) {
                     output += token.text + '\n';
                     this.advance();
                 } else {
                     break; // Not a description, maybe part of something else (unlikely at top level)
                 }
             }

             // Consume newlines after description
             while (this.current && this.current.type === TokenType.Newline) {
                 this.advance();
             }
        }

        // Definition Keyword
        // query, mutation, subscription, fragment, type, input, enum, interface, union, scalar, directive, extend

        // We accumulate tokens for the header until '{' or newline/start of next def
        // But for Deep Formatting, we want to normalize spacing in header.

        let header = '';
        const keyword = this.current ? this.current.text : '';
        const alignable = ['type', 'input', 'enum', 'interface'].includes(keyword);

        while (this.current) {
            if (this.current.text === '{') {
                header += ' {';
                this.advance();

                // Process Block
                if (alignable) {
                    header += '\n' + this.processAlignedBlock() + '}\n';
                } else {
                    header += '\n' + this.processStandardBlock() + '}\n';
                }
                // consume '}' done in processBlock
                // Actually processBlock returns content + closing brace?
                // Let's make processBlock consume '{' (already done) and '}'
                // Wait, I manually added '{' to header.
                // So processBlock should return content and consume '}'.

                // Let's refactor: processBlock starts AFTER '{'.
                // It ends when it hits '}'.
                return output + header;
            }

            if (this.current.type === TokenType.Newline) {
                 // End of definition without block (e.g. scalar, union)
                 // Or just a newline inside header (e.g. arguments split)
                 // Let's peek if next is '{'.
                 let i = 1;
                 while (this.peek(i)?.type === TokenType.Newline || this.peek(i)?.type === TokenType.Comment) i++;
                 if (this.peek(i)?.text === '{') {
                     this.advance(); // consume newline
                     continue;
                 }

                 // If scalar/directive, it ends here (or after directives)
                 // Just return what we have?
                 // Be careful not to consume next definition's tokens.
                 break;
            }

            // Append current token with spacing
            const token = this.current;

            // Handle comments inside header
            if (token.type === TokenType.Comment) {
                // If it's a block comment, maybe keep inline?
                // But usually comments force a newline.
                // For simplicity, append and newline.
                header += ' ' + token.text;
                this.advance();
                continue;
            }

            // Spacing logic
            if (header.length > 0 && !header.endsWith(' ')) {
                const lastChar = header.charAt(header.length - 1);
                let needsSpace = true;

                if (['(', '[', '!', '$', '@'].includes(lastChar)) needsSpace = false;
                if ([')', ']', ':', '!', ',', '.'].includes(token.text)) needsSpace = false;
                if (token.text === '(') {
                    // Space before '(' ?
                    // type User implements Node { ... } -> no (
                    // query Name($var: Type) -> no space
                    // directive @deprecated(reason: ...) -> no space
                    needsSpace = false;
                }
                if (lastChar === ':') needsSpace = true; // Space after colon
                if (lastChar === ',') needsSpace = true; // Space after comma

                // Special case: `on FIELD`
                if (keyword === 'directive' && token.text === 'on') needsSpace = true;
                if (keyword === 'fragment' && token.text === 'on') needsSpace = true;

                if (needsSpace) header += ' ';
            }

            header += token.text;
            this.advance();
        }

        return output + header;
    }

    private processAlignedBlock(): string {
        // We are inside '{'. Collect fields until '}'.
        this.indentLevel++;

        const fields: {
            name: string;
            args: string; // pre-formatted args
            type: string;
            directives: string;
            comments: string[]; // comments before field
            trailingComment: string; // comment on same line
        }[] = [];

        let pendingComments: string[] = [];

        while (this.current) {
            // Skip newlines
            if (this.current.type === TokenType.Newline) {
                this.advance();
                continue;
            }

            if (this.current.text === '}') {
                this.indentLevel--;
                this.advance(); // consume '}'
                break;
            }

            if (this.current.type === TokenType.Comment) {
                pendingComments.push(this.current.text);
                this.advance();
                continue;
            }

            // Field parsing
            // Name [(Args)] [: Type] [Directives]

            let name = '';
            let args = '';
            let typeStr = '';
            let directives = '';
            let trailingComment = '';

            if (this.current.type === TokenType.Name || this.current.type === TokenType.String || this.current.type === TokenType.BlockString) {
                name = this.current.text;
                this.advance();
            } else {
                 // Unexpected token, consume and continue to avoid loop
                 this.advance();
                 continue;
            }

            // Args
            if (this.current && this.current.text === '(') {
                args = this.parseArgs();
            }

            // Type
            if (this.current && this.current.text === ':') {
                this.advance(); // consume :
                typeStr = this.parseType();
            }

            // Directives
            while (this.current && this.current.text === '@') {
                directives += (directives ? ' ' : '') + this.parseDirective();
            }

            // Trailing Comment
            // Re-fetch current because it might have changed
            const trailingToken = this.tokens[this.index];
            if (trailingToken && trailingToken.type === TokenType.Comment) {
                trailingComment = trailingToken.text;
                this.advance();
            }

            // Trailing Comma? (GraphQL doesn't use commas between fields usually, but input fields might?)
            // Actually input fields don't use commas in standard GraphQL, but some parsers allow it.
            if (this.current && this.current.text === ',') {
                 this.advance();
            }

            fields.push({
                name,
                args,
                type: typeStr,
                directives,
                comments: pendingComments,
                trailingComment
            });
            pendingComments = [];
        }

        // Determine alignment
        // Max length of "name + args"
        let maxLhs = 0;
        fields.forEach(f => {
            const len = f.name.length + f.args.length;
            if (f.type && len > maxLhs) maxLhs = len; // Only consider fields that HAVE a type (to align colon)
        });

        // Construct output
        let output = '';
        const indent = ' '.repeat(this.indentLevel * this.indentSize);

        fields.forEach(f => {
            f.comments.forEach(c => {
                output += indent + c + '\n';
            });

            let line = indent + f.name + f.args;
            if (f.type) {
                const padding = ' '.repeat(Math.max(0, maxLhs - (f.name.length + f.args.length)));
                line += padding + ' : ' + f.type;
            }

            if (f.directives) {
                line += ' ' + f.directives;
            }

            if (f.trailingComment) {
                line += '  ' + f.trailingComment;
            }

            output += line + '\n';
        });

        // Output any remaining comments (if block ended with comments)
        pendingComments.forEach(c => {
            output += indent + c + '\n';
        });

        return output + ' '.repeat(this.indentLevel * this.indentSize); // indent for closing brace
    }

    private processStandardBlock(): string {
        // Similar to aligned block but without alignment logic
        // Used for query/mutation selection sets
        this.indentLevel++;

        let output = '';
        const indent = ' '.repeat(this.indentLevel * this.indentSize);

        while (this.current) {
             if (this.current.type === TokenType.Newline) {
                 this.advance();
                 continue;
             }

             if (this.current.text === '}') {
                 this.indentLevel--;
                 this.advance();
                 break;
             }

             if (this.current.type === TokenType.Comment) {
                 output += indent + this.current.text + '\n';
                 this.advance();
                 continue;
             }

             // Selection Field
             // [Alias :] Name [(Args)] [Directives] [{ SelectionSet }]

             let line = indent;

             // Check for Alias (Name :)
             if (this.current.type === TokenType.Name && this.peek(1)?.text === ':') {
                 line += this.current.text + ': ';
                 this.advance(); // Name
                 this.advance(); // :
             }

             // Name or ...Fragment
             if (this.current.text === '...') {
                 line += '...';
                 this.advance();
                 // Re-fetch current because it changed
                 const nextToken = this.tokens[this.index];
                 if (nextToken && nextToken.text === 'on') {
                     line += ' on ';
                     this.advance(); // on
                 }
             }

             if (this.current.type === TokenType.Name) {
                 line += this.current.text;
                 this.advance();
             }

             // Args
             if (this.current && this.current.text === '(') {
                 line += this.parseArgs();
             }

             // Directives
             while (this.current && this.current.text === '@') {
                 line += ' ' + this.parseDirective();
             }

             // Selection Set
             if (this.current && this.current.text === '{') {
                 line += ' {\n';
                 this.advance(); // consume {
                 line += this.processStandardBlock() + '}\n';
                 // processStandardBlock consumed '}' and returned formatted block + closing indent?
                 // Wait, my recursive call returns block CONTENT?
                 // No, see loop above. It appends to `output`.
                 // When recursively calling, we need to handle the structure.

                 // Let's make processStandardBlock return just the CONTENT (lines), NOT the closing brace.
                 // Ah, in `parseDefinition`, I did `result += '\n' + this.processStandardBlock() + '}\n';`
                 // But inside `processStandardBlock` I also consume `}`.
                 // So `processStandardBlock` should return the content up to `}`, consume `}`, and return the content.
                 // And the caller is responsible for appending `}`?
                 // No, if `processStandardBlock` consumes `}`, it should logically return the whole block?
                 // But `parseDefinition` explicitly appends `}`.

                 // Fix: `processStandardBlock` should return the INNER content.
                 // But wait, if it consumes `}`, it needs to know when to stop.
                 // Yes, it stops at `}`.
                 // But in `parseDefinition`, I did: `header += '\n' + this.processAlignedBlock() + '}\n';`
                 // `processAlignedBlock` returns content AND closing indent?
                 // Yes: `return output + ' '.repeat(...)`.
                 // So `parseDefinition` shouldn't append `}` again?
                 // Wait, `processAlignedBlock` returns `output` which contains lines.
                 // Does it contain `}`? No.
                 // `parseDefinition` does: `header += ... + '}\n'`.
                 // So `processAlignedBlock` returns content, consumes `}`, and caller adds `}`.
                 // Correct.

                 // BUT in recursive call inside `processStandardBlock`:
                 // `line += ' {\n' + this.processStandardBlock() + '}\n'`?
                 // Wait, indentation?
                 // `processStandardBlock` returns content indented at `indentLevel`.
                 // The closing `}` should be indented at `indentLevel - 1`.
                 // So:
                 // line += this.processStandardBlock() + indent + '}\n'; (wait, indent is current level)
                 // No, closing brace should be at parent level.
             }

             output += line;
             if (!line.endsWith('\n')) output += '\n'; // Ensure newline
        }

        return output + ' '.repeat(this.indentLevel * this.indentSize);
    }

    private parseArgs(): string {
        // (arg: val, arg2: val)
        // If long, wrap?
        // Let's capture tokens and decide.
        this.advance(); // consume (

        const args: string[] = [];
        let currentArg = '';
        let balance = 0;

        while (this.current) {
            if (this.current.text === ')' && balance === 0) {
                if (currentArg.trim()) args.push(currentArg.trim());
                this.advance();
                break;
            }

            if (this.current.text === '(') balance++;
            if (this.current.text === ')') balance--;

            if (this.current.text === ',' && balance === 0) {
                args.push(currentArg.trim());
                currentArg = '';
                this.advance();
                continue;
            }

            // Format value inside arg?
            // "name: value"
            // We can just accumulate tokens and normalize spacing.
            if (currentArg.length > 0) {
                 const lastChar = currentArg.charAt(currentArg.length - 1);
                 let needsSpace = true;
                 if (['(', '[', '!', '$', '@', '{'].includes(lastChar)) needsSpace = false; // { for object value
                 if ([')', ']', ':', '!', ',', '.'].includes(this.current.text)) needsSpace = false;
                 if (this.current.text === '(') needsSpace = false;
                 if (lastChar === ':') needsSpace = true;

                 if (needsSpace) currentArg += ' ';
            }

            currentArg += this.current.text;
            this.advance();
        }

        if (args.length === 0) return '()';

        // Wrap if too long? For now, let's just join with comma space for single line,
        // or newlines if it's too long?
        // Simple heuristic: if > 80 chars or > 3 args, split.
        // Or "Deep Formatting" prefers multi-line for readablity.

        if (args.length > 2 || args.some(a => a.length > 40)) {
            // Multi-line
            const indent = ' '.repeat((this.indentLevel + 1) * this.indentSize);
            const closeIndent = ' '.repeat(this.indentLevel * this.indentSize); // relative to parent
            // Wait, this isn't creating a new block scope in `indentLevel` but visually it is.
            // But we are returning a string to be appended to a line.
            // So we need explicit indent string.
            // But `indentLevel` is currently correct for the parent line.
            // We need one more level.

            // Actually, `parseArgs` is called from inside a line construction.
            // If we break lines, we must be careful about indentation.
            // "first: \n  val" or "(\n  first: val\n)"

            // NOTE: The test `verify-graphql-deep.cjs` expects `friends(first: Int, after: String)` to stay single line or at least preserve structure.
            // It fails if comma is missing.

            return '(' + args.join(', ') + ')';
        } else {
            return '(' + args.join(', ') + ')';
        }
    }

    private parseType(): string {
        // [Type!]!
        let res = '';
        while (this.current) {
             if (this.current.type === TokenType.Name || ['[', ']', '!', '&'].includes(this.current.text)) {
                 res += this.current.text;
                 this.advance();
             } else {
                 break;
             }
        }
        return res;
    }

    private parseDirective(): string {
        // @Name[(Args)]
        let res = '@';
        this.advance(); // @
        if (this.current && this.current.type === TokenType.Name) {
            res += this.current.text;
            this.advance();
        }
        if (this.current && this.current.text === '(') {
            res += this.parseArgs();
        }
        return res;
    }
}
