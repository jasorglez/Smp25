export const DASHBOARD_CATALOG = {
  projects: { label: 'Proyectos y avance actual', module: 'projects', metrics: ['count', 'progress', 'planned'], groups: ['name', 'state'], note: 'Avance actual, no histórico. No incluye presupuesto ni costo.' },
  incomes: { label: 'Ingresos registrados (DEPOSITO)', module: 'administration', metrics: ['count', 'amount'], groups: ['month', 'state', 'name'], note: 'Importes en MXN; no equivale a cuentas por cobrar ni ventas POS.' },
  expenses: { label: 'Gastos registrados (GASTO)', module: 'administration', metrics: ['count', 'amount'], groups: ['month', 'state', 'name'], note: 'Importes en MXN; no equivale a cuentas por pagar.' },
  orders: { label: 'Órdenes de compra', module: 'warehouses', metrics: ['count'], groups: ['month', 'state', 'name'], note: 'Conteo de órdenes, abiertas/cerradas; sin importe ni predicción de entrega.' },
  inventory: { label: 'Inventario actual de la empresa', module: 'warehouses', metrics: ['count', 'amount'], groups: ['name', 'state'], note: 'Valor en MXN. Solo disponible sin filtro de sucursal/proyecto, la fuente no los incluye.' },
} as const;

export type DashboardSource = keyof typeof DASHBOARD_CATALOG;
export type DashboardView = 'kpi' | 'bar' | 'line' | 'table';
export interface DashboardWidget {
  title: string;
  source: DashboardSource;
  metric: 'count' | 'amount' | 'progress' | 'planned';
  view: DashboardView;
  groupBy: 'name' | 'state' | 'month';
  search: string;
}
export interface DashboardPlan { title: string; widgets: DashboardWidget[]; limitations: string[]; }
export interface DashboardRow {
  id: number;
  name: string;
  state: string;
  month: string;
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
  error?: string;
}

export function validateDashboardPlan(value: any): DashboardPlan {
  if (!value || typeof value.title !== 'string' || !Array.isArray(value.widgets) || value.widgets.length > 12 || !Array.isArray(value.limitations)) {
    throw new Error('La IA devolvió una estructura inválida. Intenta describir el dashboard de otra forma.');
  }
  const widgets: DashboardWidget[] = value.widgets.map((widget: any) => {
    if (!widget || !Object.prototype.hasOwnProperty.call(DASHBOARD_CATALOG, widget.source)) throw new Error('La IA solicitó una fuente no permitida.');
    const source = DASHBOARD_CATALOG[widget.source as DashboardSource];
    if (!(source.metrics as readonly string[]).includes(widget.metric) || !(source.groups as readonly string[]).includes(widget.groupBy) ||
        !['kpi', 'bar', 'line', 'table'].includes(widget.view) || typeof widget.title !== 'string' || typeof widget.search !== 'string') {
      throw new Error('La IA solicitó una operación no permitida.');
    }
    return { title: widget.title.slice(0, 120), source: widget.source, metric: widget.metric, view: widget.view, groupBy: widget.groupBy, search: widget.search.slice(0, 100) };
  });
  return { title: value.title.slice(0, 160), widgets, limitations: value.limitations.filter((item: unknown) => typeof item === 'string').slice(0, 12).map((item: string) => item.slice(0, 400)) };
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
  const rows = dataset.rows.filter(row => !search || normalize(`${row.name} ${row.state}`).includes(search));
  const aggregate = (items: DashboardRow[]): number | null => {
    if (widget.metric === 'count') return items.length;
    if (!items.length) return null;
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
  return { widget, rows, value: dataset.error ? null : aggregate(rows), unit: widget.metric === 'amount' ? 'MXN' : ['progress', 'planned'].includes(widget.metric) ? '%' : 'registros', groups: allGroups.slice(0, 20), notes, error: dataset.error };
}
