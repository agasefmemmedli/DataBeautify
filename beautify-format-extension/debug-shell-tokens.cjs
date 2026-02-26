const { tokenize } = require('./out/formatters/powershell_tokenizer');
const text = `
    foreach ($i in 1..$Count) {
        $result = Get-Process |
            Where-Object { $_.Id -gt 1000 } |
            Select-Object Name, Id
    }
`;
const tokens = tokenize(text);
console.log(JSON.stringify(tokens, null, 2));
