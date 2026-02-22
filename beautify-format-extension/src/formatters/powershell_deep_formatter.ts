import { tokenize, Token } from './powershell_tokenizer';

export function formatPowerShellDeep(text: string): string {
    const tokens = tokenize(text);
    if (tokens.length === 0) return '';

    let formatted = '';
    let indentLevel = 0;
    const indentString = '    ';

    let lastToken: Token | null = null;
    let lastLastToken: Token | null = null;
    let i = 0;

    // Configurable rules
    const rules = {
        keywordCase: 'lower',
        indentSize: 4,
        otbs: true
    };

    while (i < tokens.length) {
        const token = tokens[i];

        // Whitespace Handling
        if (token.type === 'Whitespace') {
            const newlines = token.value.match(/\n/g);
            if (newlines) {
                const count = Math.min(newlines.length, 2);
                let existingNewlines = 0;
                let j = formatted.length - 1;
                while (j >= 0 && formatted[j] === '\n') {
                    existingNewlines++;
                    j--;
                }
                const needed = count - existingNewlines;
                if (needed > 0) {
                    formatted += '\n'.repeat(needed);
                }
            }
            i++;
            continue;
        }

        // Determine Value and Apply Case Normalization
        let value = token.value;

        if (token.type === 'Keyword') {
            if (rules.keywordCase === 'lower') {
                value = value.toLowerCase();
            }
        } else if (token.type === 'Identifier') {
            // PascalCase for Cmdlets (Verb-Noun)
            if (/^[a-z]+-[a-z]+$/i.test(value)) {
                value = value.replace(/\b\w/g, l => l.toUpperCase()).replace(/-\w/g, l => l.toUpperCase());
            }
        } else if (token.type === 'Variable') {
            if (['$true', '$false', '$null', '$host', '$home', '$pshome', '$error'].includes(value.toLowerCase())) {
                value = value.toLowerCase();
            }
        }

        // Logic to determine if we need a space before this token
        let needsSpace = false;

        if (lastToken) {
            const isStartOfLine = formatted.endsWith('\n') || formatted === '';

            if (!isStartOfLine) {
                 if (!formatted.endsWith(' ')) {
                     // 1. Generic "Word" Separation
                     const isPunctuation = (t: Token) => t.type === 'Punctuation';
                     // Treat Operator as Word generally, but exceptions handled later
                     if (!isPunctuation(lastToken) && !isPunctuation(token)) {
                         needsSpace = true;
                     }

                     // 2. Specific Rules (Overrides or Additions)

                     // Comma/Semi
                     if (lastToken.value === ',' || lastToken.value === ';') needsSpace = true;

                     // Braces
                     if (value === '{') needsSpace = true;
                     if (lastToken.value === '}' && value !== ',' && value !== ';') needsSpace = true;

                     // Pipe
                     if (value === '|' || lastToken.value === '|') needsSpace = true;

                     // Parentheses/Brackets - Inner logic
                     // `( word` -> No space.
                     if (['(', '['].includes(lastToken.value)) needsSpace = false;
                     // `word )` -> No space.
                     if ([')', ']'].includes(value)) needsSpace = false;

                     // Keyword + ( -> Space
                     if (lastToken.type === 'Keyword' && value === '(') needsSpace = true;

                     // ) + { -> Space
                     if (lastToken.value === ')' && value === '{') needsSpace = true;

                     // 3. Exceptions (Force No Space)

                     // Dot / Static / Range
                     if (['.', '::', '..'].includes(value)) needsSpace = false;
                     if (['.', '::', '..'].includes(lastToken.value)) needsSpace = false;

                     // Unary Operators
                     // ! (Not)
                     if (lastToken.value === '!') needsSpace = false;

                     // +/- Unary check
                     if (['+', '-'].includes(lastToken.value)) {
                         // Check if lastToken was Unary
                         // If lastLastToken was Operator, Punctuation (openers), Keyword -> Unary
                         // If lastLastToken was Identifier, Variable, String, Number, Punctuation (closers) -> Binary

                         let isUnary = true; // Default to unary if start of file
                         if (lastLastToken) {
                             const llt = lastLastToken;
                             if (['Identifier', 'Variable', 'String'].includes(llt.type)) isUnary = false;
                             else if (llt.type === 'Punctuation' && [')', ']', '}'].includes(llt.value)) isUnary = false;
                             // Else (Operator, Keyword, (, [, {, ,, ;) -> Unary
                         }

                         if (isUnary) needsSpace = false;
                     }

                     // ++ / --
                     if (['++', '--'].includes(value) || ['++', '--'].includes(lastToken.value)) needsSpace = false;

                     // Type Cast: ] $var -> No space
                     if (lastToken.value === ']' && token.type === 'Variable') needsSpace = false;
                 }
            }
        }

        // Apply Indentation and Spacing
        const isStartOfLine = formatted.endsWith('\n') || formatted === '';

        if (token.value === '}') {
            indentLevel = Math.max(0, indentLevel - 1);
        }

        if (isStartOfLine) {
            formatted += indentString.repeat(indentLevel);
        } else if (needsSpace) {
            formatted += ' ';
        }

        formatted += value;

        if (value === '{') {
            indentLevel++;
        }

        if (value === '|') {
            formatted += '\n';
        }

        lastLastToken = lastToken;
        lastToken = token;
        i++;
    }

    return formatted.trim() + '\n';
}
