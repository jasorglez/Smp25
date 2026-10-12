export const DASHBOARD_CATALOG = {
  projects: { label: 'Proyectos y avance actual', module: 'projects', metrics: ['count', 'progress', 'planned'], groups: ['name', 'state'], note: 'Avance actual, no histórico. No incluye presupuesto ni costo.' },
  incomes: { label: 'Ingresos registrados (DEPOSITO)', module: 'administration', metrics: ['count', 'amount'], groups: ['month', 'state', 'name'], note: 'Importes en MXN; no equivale a cuentas por cobrar ni ventas POS.' },
  expenses: { label: 'Gastos registrados (GASTO)', module: 'administration', metrics: ['count', 'amount'], groups: ['month', 'state', 'name'], note: 'Importes en MXN; no equivale a cuentas por pagar.' },
  orders: { label: 'Compras (órdenes de compra)', module: 'warehouses', metrics: ['count', 'amount'], groups: ['month', 'state', 'name', 'provider', 'currency'], note: 'Importe = subtotal de partidas activas (cantidad × precio), antes de descuentos, impuestos y retenciones. Totales separados por moneda; no representa compras pagadas.' },
  inventory: { label: 'Inventario actual de la empresa', module: 'warehouses', metrics: ['count', 'amount'], groups: ['name', 'state'], note: 'Valor en MXN. Solo disponible sin filtro de sucursal/proyecto, la fuente no los incluye.' },
} as const;

export type DashboardSource = keyof typeof DASHBOARD_CATALOG;
export type DashboardView = 'kpi' | 'bar' | 'line' | 'table';
export interface DashboardWidget {
  title: string;
  source: DashboardSource;
  metric: 'count' | 'amount' | 'progress' | 'planned';
  view: DashboardView;
  groupBy: 'name' | 'state' | 'month' | 'provider' | 'currency';
  search: string;
}
export interface DashboardPeriod { from: string; to: string; }
export interface DashboardPlan { title: string; widgets: DashboardWidget[]; limitations: string[]; period?: DashboardPeriod | null; financialScope?: 'selected' | 'branch' | 'company'; }
export interface DashboardRow {
  id: number;
  name: string;
  state: string;
  month: string;
  date?: string;
  provider?: string;
  currency?: string;
  amount?: number | null;
  progress?: number | null;
  planned?: number | null;
}
export interface DashboardDataset { rows: DashboardRow[]; notes: string[]; error?: string; }
export interface DashboardContext { company: number; branch: number; project: number; user: number; from: string; to: string; }
export interface DashboardResult {
  widget: DashboardWidget;
  value: number | null;
  unit: string;
  rows: DashboardRow[];
  groups: { name: string; value: number | null }[];
  notes: string[];
  currencyTotals: { name: string; value: number | null }[];
  currencySeries: { name: string; data: (number | null)[] }[];
  error?: string;
}

export function validateDashboardPlan(value: any): DashboardPlan {
  if (!value || typeof value.title !== 'string' || !Array.isArray(value.widgets) || value.widgets.length > 12 || !Array.isArray(value.limitations)) {
    throw new Error('La IA devolvió una estructura inválida. Intenta describir el dashboard de otra forma.');
  }
  if (value.financialScope != null && !['selected', 'branch', 'company'].includes(value.financialScope)) throw new Error('El alcance financiero no es válido.');
  const widgets: DashboardWidget[] = value.widgets.map((widget: any) => {
    if (!widget || !Object.prototype.hasOwnProperty.call(DASHBOARD_CATALOG, widget.source)) throw new Error('La IA solicitó una fuente no permitida.');
    const source = DASHBOARD_CATALOG[widget.source as DashboardSource];
    if (!(source.metrics as readonly string[]).includes(widget.metric) || !(source.groups as readonly string[]).includes(widget.groupBy) ||
        !['kpi', 'bar', 'line', 'table'].includes(widget.view) || typeof widget.title !== 'string' || typeof widget.search !== 'string') {
      throw new Error('La IA solicitó una operación no permitida.');
    }
    return { title: widget.title.slice(0, 120), source: widget.source, metric: widget.metric, view: widget.view, groupBy: widget.groupBy, search: widget.search.slice(0, 100) };
  });
  return { title: value.title.slice(0, 160), widgets, financialScope: value.financialScope || 'selected', period: value.period == null ? null : validateDashboardPeriod(value.period), limitations: value.limitations.filter((item: unknown) => typeof item === 'string').slice(0, 12).map((item: string) => item.slice(0, 400)) };
}

export function validateDashboardPeriod(value: any): DashboardPeriod {
  const validDate = (text: unknown) => typeof text === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(text) && Number.isFinite(Date.parse(text)) && new Date(text).toISOString().slice(0, 10) === text;
  if (!value || !validDate(value.from) || !validDate(value.to) || value.from > value.to) throw new Error('El periodo solicitado no es válido.');
  return { from: value.from, to: value.to };
}

export function filterFinancialRecords(data: any[], source: 'incomes' | 'expenses', context: DashboardContext, scope: DashboardPlan['financialScope'] = 'selected'): any[] {
  const type = source === 'incomes' ? 'DEPOSITO' : 'GASTO';
  return data.filter(row => Number(row.idBusinnes) === context.company && row.type === type && row.active !== false && row.active !== 0 &&
    (scope === 'company' || scope === 'branch' || !context.project || Number(row.idProject) === context.project) &&
    (scope === 'company' || !context.branch || Number(row.idBranch) === context.branch) && inDashboardPeriod(row.date, context));
}

export function purchaseSubtotal(items: any[]): number | null {
  const active = items.filter(item => item.active !== false && item.active !== 0);
  if (!active.length) return null;
  const amounts = active.map(item => {
    const captured = numericValue(item.total);
    if (captured !== null) return captured;
    const quantity = numericValue(item.quantity), price = numericValue(item.price);
    if (quantity === null || price === null) return null;
    const value = quantity * price;
    return Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100;
  });
  return amounts.some(value => value === null) ? null : amounts.reduce((sum, value) => sum + value!, 0);
}

export function filterPurchaseOrders(records: any[], context: DashboardContext): any[] {
  return records.filter(row => Number(row.idRoot) === context.company && row.type === 'OC' && row.active !== false &&
    (!context.project || (row.typeReference === 'project' && Number(row.idReference) === context.project)) &&
    (!context.branch || context.project || (row.typeReference === 'branch' && Number(row.idReference) === context.branch) || Number(row.idBranchExecution) === context.branch) &&
    inDashboardPeriod(row.dateCreate, context));
}

export function numericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function dateRange(period: string, today = new Date()): { from: string; to: string } {
  const year = today.getFullYear(), month = today.getMonth();
  let from = new Date(year, month, 1), to = new Date(year, month + 1, 0);
  if (period === 'previous-month') { from = new Date(year, month - 1, 1); to = new Date(year, month, 0); }
  if (period === 'quarter') { from = new Date(year, Math.floor(month / 3) * 3, 1); to = new Date(year, Math.floor(month / 3) * 3 + 3, 0); }
  if (period === 'year') { from = new Date(year, 0, 1); to = new Date(year, 11, 31); }
  const format = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { from: format(from), to: format(to) };
}

export function inDashboardPeriod(value: unknown, context: Pick<DashboardContext, 'from' | 'to'>): boolean {
  const date = String(value ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= context.from && date <= context.to;
}

export function aggregateDashboard(widget: DashboardWidget, dataset: DashboardDataset): DashboardResult {
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const search = normalize(widget.search.trim());
  const rows = dataset.rows.filter(row => !search || normalize(`${row.name} ${row.state} ${row.provider || ''} ${row.currency || ''}`).includes(search));
  const aggregate = (items: DashboardRow[]): number | null => {
    if (widget.metric === 'count') return items.length;
    if (!items.length) return null;
    if (widget.source === 'orders' && widget.metric === 'amount' && (items.some(row => !row.currency || row.currency === 'Sin moneda') || new Set(items.map(row => row.currency)).size > 1)) return null;
    const values = items.map(row => numericValue(row[widget.metric]));
    // Nunca presentar un subtotal de registros válidos como un total completo.
    if (values.some(value => value === null)) return null;
    const sum = (values as number[]).reduce((total, value) => total + value, 0);
    return widget.metric === 'amount' ? sum : sum / values.length;
  };
  const grouped = new Map<string, DashboardRow[]>();
  rows.forEach(row => { const key = row[widget.groupBy] || 'Sin dato'; grouped.set(key, [...(grouped.get(key) || []), row]); });
  const allGroups = [...grouped].map(([name, items]) => ({ name, value: aggregate(items) }));
  allGroups.sort((a, b) => widget.groupBy === 'month' ? a.name.localeCompare(b.name) : (b.value ?? -Infinity) - (a.value ?? -Infinity));
  const notes = [...dataset.notes];
  if (widget.metric !== 'count' && rows.some(row => numericValue(row[widget.metric]) === null)) notes.push('Hay registros sin un valor válido; no se muestra un total incompleto.');
  if (allGroups.length > 20) notes.push(`La gráfica muestra 20 de ${allGroups.length} grupos. El indicador incluye todos los registros filtrados.`);
  const currencyTotals: DashboardResult['currencyTotals'] = [];
  const currencySeries: DashboardResult['currencySeries'] = [];
  if (widget.source === 'orders' && widget.metric === 'amount') {
    const currencies = [...new Set(rows.map(row => row.currency || 'Sin moneda'))].sort();
    for (const currency of currencies) {
      currencyTotals.push({ name: currency, value: aggregate(rows.filter(row => (row.currency || 'Sin moneda') === currency)) });
      currencySeries.push({ name: currency, data: allGroups.slice(0, 20).map(group => {
        const items = rows.filter(row => (row.currency || 'Sin moneda') === currency && (row[widget.groupBy] || 'Sin dato') === group.name);
        return items.length ? aggregate(items) : null;
      }) });
    }
    notes.push('Se muestran subtotales por moneda original; no se convierten ni suman monedas distintas.');
  }
  return { widget, rows, currencyTotals, currencySeries, value: dataset.error ? null : aggregate(rows), unit: widget.metric === 'amount' ? (widget.source === 'orders' ? 'moneda original' : 'MXN') : ['progress', 'planned'].includes(widget.metric) ? '%' : 'registros', groups: allGroups.slice(0, 20), notes, error: dataset.error };
}
