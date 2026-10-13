const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const file = 'src/app/domains/ModAdmon/components/egresos-palacio/egresos-palacio.component.ts';
const source = fs.readFileSync(file, 'utf8');
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
let method, itemsColumn;
function visit(node) {
  if (ts.isMethodDeclaration(node) && node.name?.getText(ast) === 'updateExpenditureCountItems') method = node.getText(ast);
  if (ts.isObjectLiteralExpression(node)) {
    const props = new Map(node.properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText(ast), p.initializer]));
    if (props.get('headerName')?.getText(ast) === "'Items'") itemsColumn = node.getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(method && itemsColumn);
const code = ts.transpileModule(`class Subject { ${method} }; globalThis.Subject = Subject; globalThis.column = (${itemsColumn});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const scope = { ButtonCellRendererExpenditureComponent: class {} };
vm.runInNewContext(code, scope);
assert.equal(scope.column.field, 'countItems', 'Column identity must match the refresh target');
const subject = new scope.Subject();
subject.incomes = [{ id: 7, countItems: 0 }, { id: 8, countItems: 9 }];
subject.selectedIncomes = { id: '7', countItems: 0 };
const calls = [];
const nodes = subject.incomes.map(data => ({ data }));
subject.gridApi = { forEachNode: fn => nodes.forEach(fn), refreshCells: arg => calls.push(arg) };
subject.administrationService = { updateRowsIncorExp: () => { throw Error('Loading or drafting items must not write cached counts to the server'); } };
subject.updateExpenditureCountItems(7, 3);
assert.equal(subject.incomes[0].countItems, 3);
assert.equal(subject.incomes[1].countItems, 9);
assert.equal(subject.selectedIncomes.countItems, 3);
assert.equal(calls[0].columns[0], scope.column.field);
assert.equal(scope.column.valueGetter({ data: subject.incomes[0] }), 3);
subject.updateExpenditureCountItems(7, 0);
assert.equal(scope.column.valueGetter({ data: subject.incomes[0] }), 0);
subject.gridApi = undefined;
subject.updateExpenditureCountItems(7, 2);
assert.equal(subject.incomes[0].countItems, 2, 'Count stays correct before the grid is ready');
console.log('Egresos: item counter, selected row, correct column refresh and no background writes verified.');
