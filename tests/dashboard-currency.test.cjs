const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const base = path.join(__dirname, '../src/app/pages/dashboard-home/components');
const currencyModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(base, 'dashboard-currency.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText, { exports: currencyModule.exports });
const { convertDashboardAmount: convert } = currencyModule.exports;

test('convierte USD antes de sumar MXN y respeta el tipo de cambio capturado', () => {
  assert.equal(convert(100, 'USD', 20, 'MXN', 18) + convert(500, 'MXN', 20), 2500);
  assert.equal(convert('100', ' usd ', '20'), 2000);
  assert.equal(convert(-100, 'USD', 20), -2000);
  assert.equal(convert(2000, 'MXN', 20, 'USD'), 100);
  assert.equal(convert(100, 'USD', 20, 'USD'), 100);
});

test('no presupone paridad cuando falta un tipo de cambio válido', () => {
  assert.equal(convert(100, 'USD', null), null);
  assert.equal(convert(100, 'USD', 0, 'MXN', 18), 1800);
  assert.equal(convert(100, 'USD', Infinity), null);
  assert.equal(convert(100, 'EUR', 20), null);
  assert.equal(convert(500, null, null), 500);
});

// Ejecutar los métodos reales de agregación sin iniciar Angular ni llamar a APIs.
const source = ts.createSourceFile('component.ts', fs.readFileSync(path.join(base, 'dash-admon.component.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
const component = source.statements.find(s => ts.isClassDeclaration(s));
const names = ['getIncomeAmount', 'getExpenseAmount', 'buildIngresosChart', 'buildClientList', 'buildTopEntityList', 'buildEgresosChart', 'buildBankBalances'];
const methods = component.members.filter(m => names.includes(m.name?.getText(source))).map(m => m.getText(source));
const context = { convertDashboardAmount: convert, getDashboardBalanceMxn: currencyModule.exports.getDashboardBalanceMxn };
vm.runInNewContext(ts.transpileModule(`class Aggregates { ${methods.join('\n')} }; globalThis.Aggregates = Aggregates;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);

test('barras, tendencia y pastel de clientes usan MXN aunque la lista seleccione USD', () => {
  const c = new context.Aggregates();
  Object.assign(c, { clientExchangeRate: 18, clientCurrency: 'USD', ingresosXaxis: {} });
  const rows = [
    { company: 'Cliente', fechaingreso: '2026-01-15', totalconcepto: 100, moneda: 'USD', tipoCambio: 20 },
    { company: 'Cliente', fechaingreso: '2026-01-15', totalconcepto: 500, moneda: 'MXN', tipoCambio: 20 }
  ];
  c.buildIngresosChart(rows);
  c.buildClientList(rows);
  assert.equal(c.ingresosSeries[0].data[0], 2500);
  assert.equal(c.ingresosSeries[1].data[0], 2500);
  assert.equal(c.ingPieSeries[0], 2500);
  assert.equal(c.clientListTotal, 125);
});

test('egresos, total del período, proveedores y pastel convierten una sola vez', () => {
  const c = new context.Aggregates();
  Object.assign(c, { clientExchangeRate: 18, egresosRange: 1, BAR_PALETTE: ['red'] });
  const dateExpend = new Date().toISOString();
  const rows = [
    { entityName: 'Proveedor', entityType: 'PROVEEDOR', dateExpend, totalFinal: 45, moneda: 'USD', tipoCambio: 20 },
    { entityName: 'Proveedor', entityType: 'PROVEEDOR', dateExpend, totalFinal: 6000, moneda: 'MXN' }
  ];
  c.buildEgresosChart(rows);
  c.buildTopEntityList(rows);
  assert.equal(c.egresosTotal, 6900);
  assert.equal(c.egresosSeries[0].data.reduce((a, b) => a + b, 0), 6900);
  assert.equal(c.topEntityTotal, 6900);
  assert.equal(c.egrPieSeries[0], 6900);
});

test('saldos convierten cada movimiento antes de sumar cuentas y no convierten dos veces', () => {
  const balance = currencyModule.exports.getDashboardBalanceMxn;
  const oxxo = { saldosPorMoneda: [{ saldo: 13090.48, moneda: 'MXN' }] };
  const usa = { saldosPorMoneda: [{ saldo: 3169.07, moneda: 'USD', tipoCambio: 20 }] };
  assert.equal(balance(oxxo, 18), 13090.48);
  assert.equal(balance(usa, 18), 63381.4);
  assert.equal(Number((balance(oxxo, 18) + balance(usa, 18)).toFixed(2)), 76471.88);
  assert.equal(balance({ saldosPorMoneda: [
    { saldo: 100, moneda: 'USD', tipoCambio: 20 },
    { saldo: -40, moneda: 'USD', tipoCambio: 19 },
    { saldo: 500, moneda: 'MXN' }
  ] }, 18), 1740);
});

test('saldos pendientes no se presentan como pesos ni como cero', () => {
  const balance = currencyModule.exports.getDashboardBalanceMxn;
  assert.equal(balance({ saldo: 3169.07 }, 20), null);
  assert.equal(balance({ saldosPorMoneda: [{ saldo: 100, moneda: 'USD' }] }, null), null);
  assert.equal(balance({ saldosPorMoneda: [{ saldo: 100, moneda: 'USD' }] }, 20), 2000);
  assert.equal(balance({ saldosPorMoneda: [] }, null), 0);
});


test('el total de cuentas incluye saldos negativos y se recalcula al llegar la referencia', () => {
  const c = new context.Aggregates();
  c.clientExchangeRate = null;
  c.allCuentasBanco = [
    { saldosPorMoneda: [{ saldo: 100, moneda: 'USD' }] },
    { saldosPorMoneda: [{ saldo: -500, moneda: 'MXN' }] }
  ];
  c.buildBankBalances();
  assert.equal(c.saldoTotal, null);
  c.clientExchangeRate = 20;
  c.buildBankBalances();
  assert.equal(c.cuentasBanco.length, 2);
  assert.equal(c.saldoTotal, 1500);
});
