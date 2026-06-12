/**
 * Composición tipo "cajero" para validar/armar una cantidad requerida a partir de las
 * presentaciones (envases) de un proveedor, en unidad base (kg o L).
 *
 * Reglas:
 *  - Greedy primero (denominación más grande), y si no da exacta → DP (programación dinámica).
 *  - El desglose prefiere envases grandes (menos piezas / mayor volumen).
 *  - Si no hay exacta → la alcanzable más cercana por debajo y por arriba.
 */

export interface Denom {
  base: number;          // tamaño en base (kg o L)
  descripcion: string;   // descripción empaque
  unidad: string;        // abreviatura mostrada
}

export interface BreakdownLine {
  base: number;
  descripcion: string;
  unidad: string;
  count: number;
}

export interface Composition {
  exact: boolean;
  total: number;             // base lograda
  lines: BreakdownLine[];
}

export interface ProviderEval {
  belowMin: boolean;         // target < compra mínima
  minCompra: number;
  exact: Composition | null; // combinación exacta (si existe)
  below: Composition | null; // alcanzable más cercana < target
  above: Composition | null; // alcanzable más cercana > target
}

const SCALE = 1000;          // 3 decimales en base
const CAP = 500_000;         // límite de DP (500 kg/L a 0.001) → fuera de eso, greedy

function gcd(a: number, b: number): number { while (b) { [a, b] = [b, a % b]; } return a; }

/** Greedy (denominación más grande primero). Devuelve líneas y total scaled logrado (≤ target). */
function greedy(target: number, denomsScaled: { v: number; d: Denom }[]): { lines: BreakdownLine[]; total: number } {
  const sorted = [...denomsScaled].filter(x => x.v > 0).sort((a, b) => b.v - a.v);
  const lines: BreakdownLine[] = [];
  let remaining = target;
  for (const { v, d } of sorted) {
    if (v <= 0) continue;
    const count = Math.floor(remaining / v);
    if (count > 0) { lines.push({ base: d.base, descripcion: d.descripcion, unidad: d.unidad, count }); remaining -= count * v; }
  }
  return { lines, total: target - remaining };
}

/** DP de alcanzabilidad [0..max], con reconstrucción que prefiere denominaciones grandes. */
function dpReachable(max: number, denomsScaled: { v: number; d: Denom }[]): { reachable: Uint8Array; parent: Int32Array } {
  const reachable = new Uint8Array(max + 1);
  const parent = new Int32Array(max + 1).fill(-1);
  reachable[0] = 1;
  const sorted = [...denomsScaled].filter(x => x.v > 0).sort((a, b) => b.v - a.v); // grandes primero
  for (let x = 1; x <= max; x++) {
    for (let i = 0; i < sorted.length; i++) {
      const v = sorted[i].v;
      if (v <= x && reachable[x - v]) { reachable[x] = 1; parent[x] = i; break; }
    }
  }
  return { reachable, parent };
}

function rebuild(x: number, parent: Int32Array, sorted: { v: number; d: Denom }[]): Composition {
  const counts = new Map<number, number>();
  let cur = x;
  while (cur > 0 && parent[cur] >= 0) {
    const i = parent[cur];
    counts.set(i, (counts.get(i) ?? 0) + 1);
    cur -= sorted[i].v;
  }
  const lines: BreakdownLine[] = [];
  for (const [i, count] of counts) {
    const d = sorted[i].d;
    lines.push({ base: d.base, descripcion: d.descripcion, unidad: d.unidad, count });
  }
  lines.sort((a, b) => b.base - a.base);
  return { exact: true, total: x / SCALE, lines };
}

/** Evalúa una cantidad (base) contra las presentaciones de un proveedor. */
export function evaluateProvider(targetBase: number, minCompra: number, denoms: Denom[]): ProviderEval {
  const result: ProviderEval = { belowMin: targetBase < minCompra, minCompra, exact: null, below: null, above: null };
  const valid = denoms.filter(d => d.base && d.base > 0);
  if (valid.length === 0 || targetBase <= 0) return result;

  const T = Math.round(targetBase * SCALE);
  const denomsScaled = valid.map(d => ({ v: Math.round(d.base * SCALE), d }));
  const sortedDesc = [...denomsScaled].filter(x => x.v > 0).sort((a, b) => b.v - a.v);

  // 1) Greedy exacto.
  const g = greedy(T, denomsScaled);
  if (g.total === T) {
    result.exact = { exact: true, total: targetBase, lines: g.lines };
    return result;
  }

  // 2) DP (solo si cabe en el CAP). Busca exacta + cercanas por debajo/arriba.
  const maxDenom = Math.max(...denomsScaled.map(x => x.v));
  const upper = Math.min(T + maxDenom, CAP);
  if (T <= CAP) {
    const { reachable, parent } = dpReachable(upper, denomsScaled);
    if (reachable[T]) { result.exact = rebuild(T, parent, sortedDesc); return result; }
    // Cercana por debajo.
    for (let x = T - 1; x >= 1; x--) { if (reachable[x]) { result.below = rebuild(x, parent, sortedDesc); break; } }
    // Cercana por arriba.
    for (let x = T + 1; x <= upper; x++) { if (reachable[x]) { result.above = rebuild(x, parent, sortedDesc); break; } }
    return result;
  }

  // 3) Target grande: greedy aproximado. Exacta si divisible por gcd y greedy llegó; si no, cercanas greedy.
  const gd = denomsScaled.reduce((acc, x) => gcd(acc, x.v), 0);
  if (gd > 0 && T % gd === 0) {
    // Greedy suele resolver sistemas canónicos; si no llegó exacto, lo dejamos como "below".
    result.below = { exact: false, total: g.total / SCALE, lines: g.lines };
    const smallest = sortedDesc[sortedDesc.length - 1].v;
    const aboveTotal = g.total + smallest;
    const aboveLines = [...g.lines];
    const last = sortedDesc[sortedDesc.length - 1].d;
    aboveLines.push({ base: last.base, descripcion: last.descripcion, unidad: last.unidad, count: 1 });
    result.above = { exact: false, total: aboveTotal / SCALE, lines: aboveLines };
  } else {
    result.below = { exact: false, total: g.total / SCALE, lines: g.lines };
  }
  return result;
}
