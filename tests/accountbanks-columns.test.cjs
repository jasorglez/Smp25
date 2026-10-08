const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const file = path.join(__dirname, '../src/app/domains/ModAdmon/components/accountbanks/accountbanks.component.ts');
const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
const component = source.statements.find(ts.isClassDeclaration);
const names = ['colMaster', 'refreshMasterBankColumn', 'onMasterGridReady'];
const methods = component.members.filter(m => names.includes(m.name?.getText(source))).map(m => m.getText(source));
const context = {};
vm.runInNewContext(ts.transpileModule(`class Accounts { ${methods.join('\n')} }; globalThis.Accounts = Accounts;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 }
}).outputText, context);

// El catálogo de bancos puede responder antes o después de inicializar AG Grid.
for (const banksArriveFirst of [true, false]) {
  test(`conserva todas las columnas al iniciar y refrescar; bancos primero: ${banksArriveFirst}`, () => {
    const c = new context.Accounts();
    c._colMaster = [];
    const originalFields = ['idBanco', 'numberAccount', 'nameAccount', 'interbancaria', 'folioCheque',
      'folioSinCheque', 'gasto', 'depositoPagado', 'saldo', 'maskin', 'consecin', 'maskex', 'consecex'];
    let visibleColumns;
    const api = {
      setGridOption: (key, value) => { if (key === 'columnDefs') visibleColumns = value; },
      refreshCells: () => {}
    };
    if (banksArriveFirst) c.refreshMasterBankColumn();
    c.onMasterGridReady({ api });
    for (let i = 0; i < 3; i++) {
      c.banks = [{ id: 1, name: 'Banco' }];
      c.refreshMasterBankColumn();
      const fields = Array.from(visibleColumns, col => col.field);
      assert.deepEqual(fields.filter(field => field !== 'isInactive'), originalFields);
      assert.equal(fields.filter(field => field === 'isInactive').length, 1);
      assert.equal(visibleColumns.find(col => col.field === 'idBanco').valueFormatter({ value: 1 }), 'Banco');
    }
  });
}
