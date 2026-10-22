import { ColumnState, GridApi } from 'ag-grid-community';

type SavedColumnWidth = Pick<ColumnState, 'colId' | 'width' | 'flex'>;

function storageKey(scope: string, email: string): string {
  const user = (email || 'usuario').trim().toLocaleLowerCase();
  return `smp:grid-widths:${user}:${scope}`;
}

export function restoreGridColumnWidths(api: GridApi, scope: string, email: string): void {
  try {
    const saved = localStorage.getItem(storageKey(scope, email));
    if (!saved) return;
    const state = JSON.parse(saved) as SavedColumnWidth[];
    if (Array.isArray(state) && state.length) {
      api.applyColumnState({ state, applyOrder: false });
    }
  } catch { /* preferencias locales no disponibles o inválidas */ }
}

export function saveGridColumnWidths(api: GridApi, scope: string, email: string, event: any): void {
  if (event?.finished === false) return;
  try {
    const state = api.getColumnState()
      .filter(column => Number.isFinite(column.width))
      .map(column => ({ colId: column.colId, width: column.width, flex: column.flex ?? null }));
    localStorage.setItem(storageKey(scope, email), JSON.stringify(state));
  } catch { /* preferencias locales no disponibles */ }
}
