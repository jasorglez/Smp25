/**
 * Equivale al menú de columna «Autosize All Columns» (ajusta al contenido y encabezados).
 */
export function runAutosizeAllColumns(api: unknown): void {
  const gridApi = api as { autoSizeAllColumns?: (skipHeader?: boolean) => void };
  if (gridApi && typeof gridApi.autoSizeAllColumns === 'function') {
    gridApi.autoSizeAllColumns(false);
  }
}
