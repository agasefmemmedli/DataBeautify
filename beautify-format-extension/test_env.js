const fs = require('fs');

const mockVscode = {
    window: { activeTextEditor: { document: { uri: { fsPath: 'test.dockerfile' } } } }
};
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'vscode') return mockVscode;
    return originalRequire.apply(this, arguments);
};

async function test() {
    const text = fs.readFileSync(__dirname + '/test-env.dockerfile', 'utf8');
    const { formatDockerfileDeep } = require('./out/formatters/dockerfile_deep_formatter');
    console.log(formatDockerfileDeep(text));
}
test();
