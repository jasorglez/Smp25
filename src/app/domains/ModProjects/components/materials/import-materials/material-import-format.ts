export const MATERIAL_IMPORT_MAX_ROWS = 5000;
export const MATERIAL_IMPORT_HEADERS = ['Insumo', 'Descripcion', 'Familia', 'Subfamilia', 'Unidad', 'CodigoBarras', 'CostoMN', 'VentaMN', 'StockMin', 'StockMax', 'GramosPorMetro'];
export interface MaterialImportRow {
  excelRow: number; insumo: string; description: string; family: string; subfamily: string; measure: string;
  barcode: string; cost: number; price: number; stockMin: number; stockMax: number; gramsPerMeter: number | null;
}
export interface MaterialImportIssue { row: number; message: string; }
export function normalizeMaterialText(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase();
}
export function parseMaterialImport(matrix: unknown[][]): { rows: MaterialImportRow[]; errors: MaterialImportIssue[] } {
  const errors: MaterialImportIssue[] = [], rows: MaterialImportRow[] = [];
  const header = (matrix[0] || []).map(normalizeMaterialText);
  const expected = MATERIAL_IMPORT_HEADERS.map(normalizeMaterialText);
  header.filter(Boolean).forEach(name => { if (!expected.includes(name)) errors.push({ row: 1, message: `Columna no reconocida: ${name}. Usa los encabezados del formato.` }); });
  const indexes = MATERIAL_IMPORT_HEADERS.map(name => header.indexOf(normalizeMaterialText(name)));
  MATERIAL_IMPORT_HEADERS.slice(0, 5).forEach((name, i) => {
    if (indexes[i] < 0) errors.push({ row: 1, message: `Falta la columna obligatoria ${name}. Descarga la plantilla.` });
  });
  if (new Set(header.filter(Boolean)).size !== header.filter(Boolean).length) errors.push({ row: 1, message: 'Hay encabezados repetidos.' });
  if (errors.length) return { rows, errors };
  const codes = new Set<string>(), descriptions = new Set<string>();
  matrix.slice(1).forEach((cells, index) => {
    if (!cells.some(cell => String(cell ?? '').trim())) return;
    const excelRow = index + 2;
    if (cells.some((cell, column) => !header[column] && String(cell ?? '').trim())) errors.push({ row: excelRow, message: 'Hay datos en una columna sin encabezado.' });
    const text = (column: number) => String(cells[indexes[column]] ?? '').trim();
    const numeric = (column: number, optional = false): number | null => {
      const value = cells[indexes[column]];
      if (value === '' || value === null || value === undefined) return optional ? null : 0;
      const number = typeof value === 'number' ? value : /^\d+(\.\d+)?$/.test(String(value).trim()) ? Number(value) : NaN;
      if (!Number.isFinite(number) || number < 0) errors.push({ row: excelRow, message: `${MATERIAL_IMPORT_HEADERS[column]} debe ser una celda numérica no negativa, sin símbolos ni separadores.` });
      return Number.isFinite(number) ? number : 0;
    };
    const row: MaterialImportRow = { excelRow, insumo: text(0), description: text(1), family: text(2), subfamily: text(3), measure: text(4), barcode: text(5), cost: numeric(6)!, price: numeric(7)!, stockMin: numeric(8)!, stockMax: numeric(9)!, gramsPerMeter: numeric(10, true) };
    if (!row.insumo || row.insumo.length > 35) errors.push({ row: excelRow, message: 'Insumo obligatorio, máximo 35 caracteres.' });
    if (!row.description || row.description.length > 1000) errors.push({ row: excelRow, message: 'Descripción obligatoria, máximo 1000 caracteres.' });
    if (!row.family || !row.subfamily || !row.measure) errors.push({ row: excelRow, message: 'Familia, subfamilia y unidad son obligatorias.' });
    if (row.barcode.length > 50) errors.push({ row: excelRow, message: 'Código de barras: máximo 50 caracteres.' });
    if (row.cost > 99999999999999.99 || row.price > 99999999999999.99 || [row.cost, row.price].some(value => Math.abs(value * 100 - Math.round(value * 100)) > 0.001)) errors.push({ row: excelRow, message: 'Precios: máximo dos decimales y 14 dígitos enteros.' });
    if (!Number.isInteger(row.stockMin) || !Number.isInteger(row.stockMax) || row.stockMax < row.stockMin || row.stockMax > 2147483647) errors.push({ row: excelRow, message: 'Stock: enteros no negativos; máximo mayor o igual al mínimo y no mayor que 2147483647.' });
    if (row.gramsPerMeter !== null && (row.gramsPerMeter <= 0 || row.gramsPerMeter > 99999999999.9999 || Math.abs(row.gramsPerMeter * 10000 - Math.round(row.gramsPerMeter * 10000)) > 0.001)) errors.push({ row: excelRow, message: 'Gramos por metro debe ser positivo y tener máximo cuatro decimales y 11 dígitos enteros.' });
    const code = normalizeMaterialText(row.insumo), description = normalizeMaterialText(row.description);
    if (codes.has(code)) errors.push({ row: excelRow, message: 'Insumo repetido en el archivo.' });
    if (descriptions.has(description)) errors.push({ row: excelRow, message: 'Descripción repetida en el archivo.' });
    codes.add(code); descriptions.add(description); rows.push(row);
  });
  if (!rows.length) errors.push({ row: 0, message: 'La hoja Materiales no contiene materiales.' });
  if (rows.length > MATERIAL_IMPORT_MAX_ROWS) errors.push({ row: 0, message: `Máximo ${MATERIAL_IMPORT_MAX_ROWS} materiales por archivo.` });
  return { rows, errors };
}
