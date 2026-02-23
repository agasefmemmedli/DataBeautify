"use strict";
const { ShellTokenizer, TokenType } = require('./out/formatters/shell_tokenizer');

const text = 'readonly SCRIPT_NAME="deep-formatter"';
const tokenizer = new ShellTokenizer(text);
const tokens = tokenizer.tokenize();

console.log('Tokens:');
tokens.forEach(t => {
    console.log(`Type: ${t.type}, Text: '${t.text}', Col: ${t.col}`);
});
