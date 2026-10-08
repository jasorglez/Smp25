export function convertDashboardAmount(
  amount: unknown,
  sourceCurrency: unknown,
  capturedRate: unknown,
  targetCurrency: 'MXN' | 'USD' = 'MXN',
  referenceRate: number | null = null
): number | null {
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  const source = String(sourceCurrency || 'MXN').trim().toUpperCase();
  if (source === targetCurrency || (source === 'MN' && targetCurrency === 'MXN')) return value;
  if (!['USD', 'MXN', 'MN'].includes(source)) return null;
  const captured = Number(capturedRate);
  const rate = Number.isFinite(captured) && captured > 0 ? captured : referenceRate;
  if (!Number.isFinite(rate) || rate === null || rate <= 0) return null;
  return source === 'USD' ? value * rate : value / rate;
}

export function getDashboardBalanceMxn(account: any, referenceRate: number | null): number | null {
  // El saldo antiguo ya mezcla monedas; no se puede convertir como un solo importe.
  if (!Array.isArray(account.saldosPorMoneda)) return null;
  let total = 0;
  for (const balance of account.saldosPorMoneda) {
    const converted = convertDashboardAmount(balance.saldo, balance.moneda, balance.tipoCambio, 'MXN', referenceRate);
    if (converted === null) return null;
    total += converted;
  }
  return total;
}
