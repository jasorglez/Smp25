const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const file = path.resolve(__dirname, '../src/app/services/workspace-drafts.service.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
});
const loaded = new Module(file, module);
loaded.require = name => name === '@angular/core' ? { Injectable: () => target => target } : require(name);
loaded._compile(compiled.outputText, file);
const { changedOnServer, businessRow } = loaded.exports;
const server = { id: 1, date: '2026-10-13T00:00:00', idExpend: 12, description: 'Egreso de prueba', total: 500, countItems: 2, modifiedAt: '2026-10-13T10:00:00' };
const original = { ...server, date: new Date(server.date), objetoGastoCodigo: '21101', detailType: null, detailData: [], visible: true };
const draft = { ...original, total: 600, __modified: true, modifiedAt: '2026-10-13T11:00:00' };
assert.equal(changedOnServer(original, server, draft), false, 'Display-only expense code must not block saving a local edit');
assert.equal(changedOnServer(JSON.parse(JSON.stringify(original)), server, draft), false, 'Previously persisted drafts must also recover');
assert.equal(changedOnServer({ ...original, objetoGastoCodigo: '' }, server), false);
assert.equal(changedOnServer(original, { ...server, total: 700 }, draft), true, 'Concurrent amount changes remain protected');
assert.equal(changedOnServer(original, { ...server, idExpend: 13 }, draft), true, 'The actual expense classification remains protected');
assert.equal(changedOnServer(original, { ...server, modifiedAt: '2026-10-13T12:00:00' }, draft), true);
assert.equal(changedOnServer(original, { ...server, countItems: 3 }, draft), false);
assert.equal(changedOnServer(original, null, draft), true);
assert.equal(changedOnServer(null, server, draft), true);
assert.equal('objetoGastoCodigo' in businessRow(original), false);
console.log('Workspace drafts: 10 conflict detection regression checks passed.');
