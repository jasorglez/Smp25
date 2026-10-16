/** Redondeo monetario usado por los renglones y por cada paso de la cascada. */
export function apuMoney(value: number): number {
  const amount = Number(value) || 0;
  return Math.sign(amount) * Math.round(Math.abs(amount) * 100 + 1e-8) / 100;
}

export interface ApuFactorStep {
  name: string;
  percentage: number;
  amount: number;
  subtotal: number;
}

export function apuFactorSteps(directCost: number, factors: any[]): ApuFactorStep[] {
  let subtotal = apuMoney(directCost);
  return (factors ?? []).map((factor) => {
    const percentage = Number(factor.percentage) || 0;
    const amount = apuMoney(subtotal * percentage / 100);
    subtotal = apuMoney(subtotal + amount);
    return { name: String(factor.name ?? ''), percentage, amount, subtotal };
  });
}

export function apuUnitPrice(directCost: number, factors: any[]): number {
  const steps = apuFactorSteps(directCost, factors);
  return steps.length ? steps[steps.length - 1].subtotal : apuMoney(directCost);
}
