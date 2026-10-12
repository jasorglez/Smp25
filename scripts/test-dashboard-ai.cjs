const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

const file = path.resolve(__dirname, '../src/app/services/dashboard-ai.model.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const loaded = new Module(file, module);
loaded._compile(compiled.outputText, file);
const { validateDashboardPlan, numericValue, dateRange, inDashboardPeriod, aggregateDashboard, validateDashboardPeriod, purchaseSubtotal, filterPurchaseOrders } = loaded.exports;
const widget = { title: 'Gastos', source: 'expenses', metric: 'amount', view: 'bar', groupBy: 'month', search: '' };
const plan = { title: 'Finanzas', widgets: [widget], limitations: [] };
assert.equal(validateDashboardPlan(plan).widgets.length, 1);
for (const source of ['__proto__', 'constructor', 'https://example.com', 'sql']) {
  assert.throws(() => validateDashboardPlan({ ...plan, widgets: [{ ...widget, source }] }));
}
assert.throws(() => validateDashboardPlan({ ...plan, widgets: [{ ...widget, metric: 'progress' }] }));
assert.throws(() => validateDashboardPlan({ ...plan, widgets: [{ ...widget, groupBy: '__proto__' }] }));
assert.throws(() => validateDashboardPlan({ ...plan, widgets: Array(13).fill(widget) }));
assert.equal(numericValue(null), null);
assert.equal(numericValue(''), null);
assert.equal(numericValue(false), null);
assert.equal(numericValue('0'), 0);
assert.equal(numericValue('Infinity'), null);
assert.deepEqual(dateRange('previous-month', new Date(2026, 0, 15)), { from: '2025-12-01', to: '2025-12-31' });
assert.deepEqual(dateRange('quarter', new Date(2026, 10, 15)), { from: '2026-10-01', to: '2026-12-31' });
assert.equal(inDashboardPeriod('2026-10-31T23:59:59', { from: '2026-10-01', to: '2026-10-31' }), true);
assert.equal(inDashboardPeriod(null, { from: '2026-10-01', to: '2026-10-31' }), false);
const rows = [
  { id: 1, name: 'Almacén', state: 'Abierta', month: '2026-02', amount: 100 },
  { id: 2, name: 'Obra', state: 'Cerrada', month: '2026-01', amount: -20 },
];
let result = aggregateDashboard(widget, { rows, notes: [] });
assert.equal(result.value, 80);
assert.deepEqual(result.groups.map(group => group.name), ['2026-01', '2026-02']);
assert.equal(aggregateDashboard({ ...widget, search: 'almacen' }, { rows, notes: [] }).value, 100);
result = aggregateDashboard(widget, { rows: [...rows, { ...rows[0], id: 3, amount: null }], notes: [] });
assert.equal(result.value, null, 'A missing exchange rate must not produce an incomplete total');
assert.ok(result.notes.length);
assert.equal(aggregateDashboard({ ...widget, metric: 'count' }, { rows: [], notes: [], error: 'Forbidden' }).value, null, 'Failed source is not zero records');
assert.equal(aggregateDashboard({ ...widget, metric: 'count' }, { rows: [], notes: [] }).value, 0);
assert.equal(aggregateDashboard(widget, { rows: [], notes: [] }).value, null);
console.log('Dashboard AI: validation, periods, filtering and aggregation checks passed.');

assert.deepEqual(validateDashboardPeriod({ from: '2026-01-01', to: '2026-12-31' }), { from: '2026-01-01', to: '2026-12-31' });
assert.throws(() => validateDashboardPeriod({ from: '2026-02-30', to: '2026-12-31' }));
assert.throws(() => validateDashboardPeriod({ from: '2026-12-31', to: '2026-01-01' }));
assert.equal(purchaseSubtotal([{ quantity: 2, price: 50 }, { quantity: 3, price: 20 }, { quantity: 1, price: 900, active: false }]), 160);
assert.equal(purchaseSubtotal([{ quantity: 2, price: null }]), null);
assert.equal(purchaseSubtotal([{ quantity: 0.5, price: 0.25, total: 0.13 }]), 0.13);
assert.equal(purchaseSubtotal([]), null);
const orderWidget = { ...widget, source: 'orders', groupBy: 'month' };
const purchases = [{ ...rows[0], currency: 'MXN', provider: 'Proveedor A' }, { ...rows[1], amount: 20, currency: 'USD', provider: 'Proveedor B' }];
result = aggregateDashboard(orderWidget, { rows: purchases, notes: [] });
assert.equal(result.value, null, 'Never sum MXN and USD');
assert.deepEqual(result.currencyTotals, [{ name: 'MXN', value: 100 }, { name: 'USD', value: 20 }]);
assert.equal(result.currencySeries.length, 2);
assert.equal(aggregateDashboard({ ...orderWidget, search: 'Proveedor B' }, { rows: purchases, notes: [] }).value, 20);
assert.equal(aggregateDashboard(orderWidget, { rows: [{ ...purchases[0], currency: 'Sin moneda' }], notes: [] }).value, null);
const purchaseContext = { company: 55, branch: 2, project: 8, user: 1, from: '2026-01-01', to: '2026-12-31' };
const order = { id: 1, idRoot: 55, type: 'OC', typeReference: 'project', idReference: 8, dateCreate: '2026-01-01' };
assert.equal(filterPurchaseOrders([order, { ...order, idRoot: 66 }, { ...order, idReference: 9 }, { ...order, dateCreate: '2025-12-31' }], purchaseContext).length, 1);
assert.equal(filterPurchaseOrders([{ ...order, typeReference: 'branch', idReference: 2 }], purchaseContext).length, 0, 'Do not attribute branch-only purchases to a project');
assert.equal(filterPurchaseOrders([{ ...order, idBranchExecution: 2 }], { ...purchaseContext, project: 0 }).length, 1);
assert.equal(validateDashboardPlan({ ...plan, widgets: [orderWidget], period: { from: '2026-01-01', to: '2026-12-31' } }).period.from, '2026-01-01');
console.log('Purchases: annual range, tenant/context filters, subtotals and currency separation checks passed.');

const { filterFinancialRecords } = loaded.exports;
const financeContext = { company: 10, branch: 2, project: 8, user: 1, from: '2026-01-01', to: '2026-12-31' };
const income = { id: 1, idBusinnes: 10, idBranch: 2, idProject: 8, idAccount: 1, type: 'DEPOSITO', active: true, date: '2026-01-01' };
const records = [income, { ...income, id: 2, idProject: 9, idAccount: 2 }, { ...income, id: 3, idBranch: 3 }, { ...income, id: 4, idBusinnes: 11 }, { ...income, id: 5, date: '2027-01-01' }, { ...income, id: 6, active: false }, { ...income, id: 7, type: 'GASTO' }];
assert.deepEqual(filterFinancialRecords(records, 'incomes', financeContext, 'branch').map(r => r.id), [1, 2]);
assert.deepEqual(filterFinancialRecords(records, 'incomes', financeContext).map(r => r.id), [1]);
assert.equal(validateDashboardPlan({ ...plan, financialScope: 'branch' }).financialScope, 'branch');
assert.throws(() => validateDashboardPlan({ ...plan, financialScope: 'other-company' }));
console.log('All accounts: selected company, branch, dates and active income documents verified.');

assert.deepEqual(filterFinancialRecords(records, 'incomes', financeContext, 'company').map(r => r.id), [1, 2, 3]);
assert.equal(validateDashboardPlan({ ...plan, financialScope: 'company' }).financialScope, 'company');
const fiveYears = { ...financeContext, from: '2022-01-01', to: '2026-12-31' };
assert.deepEqual(filterFinancialRecords([
  { ...income, id: 10, date: '2022-01-01', idProject: 99, idBranch: 99 },
  { ...income, id: 11, date: '2021-12-31' },
  { ...income, id: 12, date: '2026-12-31', idBusinnes: 11 }
], 'incomes', fiveYears, 'company').map(r => r.id), [10]);
console.log('Company-wide financial scope includes all branches/projects, never another company.');
