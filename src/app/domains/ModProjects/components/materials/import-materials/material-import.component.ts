import { Component, EventEmitter, Output, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { catchError, firstValueFrom, forkJoin, of, throwError } from 'rxjs';
import { CatalogsService } from 'app/services/catalogs.service';
import { MaterialsService } from 'app/services/materials.service';
import { RootService } from 'app/services/root.service';
import { SignalsService } from 'app/services/signals.service';
import { MATERIAL_IMPORT_HEADERS, MATERIAL_IMPORT_MAX_ROWS, MaterialImportIssue, MaterialImportRow, parseMaterialImport } from './material-import-format';

@Component({ selector: 'app-material-import', standalone: true, imports: [CommonModule], templateUrl: './material-import.component.html' })
export class MaterialImportComponent {
  @Output() closed = new EventEmitter<void>();
  @Output() imported = new EventEmitter<{ companyId: number; imported: number }>();
  private readonly signals = inject(SignalsService);
  private readonly catalogs = inject(CatalogsService);
  private readonly roots = inject(RootService);
  private readonly materials = inject(MaterialsService);
  readonly maxRows = MATERIAL_IMPORT_MAX_ROWS;
  companyId = 0;
  companyName = '';
  families: any[] = []; subfamilies: any[] = []; measures: any[] = [];
  loading = false; reading = false; busy = false; downloading = false;
  fileName = ''; error = ''; result = '';
  rows: MaterialImportRow[] = []; errors: MaterialImportIssue[] = [];
  private revision = 0;
  private fileRevision = 0;

  constructor() {
    effect(() => {
      const id = Number(this.signals.getRootSelectedBySidebar()() || 0);
      this.companyId = id; this.companyName = ''; this.fileName = ''; this.rows = []; this.errors = [];
      this.families = []; this.subfamilies = []; this.measures = []; this.error = ''; this.result = '';
      this.fileRevision++; this.reading = false;
      const revision = ++this.revision;
      if (id) void this.loadCatalogs(id, revision); else this.loading = false;
    });
  }

  get canImport(): boolean {
    return !!this.companyId && this.companyId === Number(this.signals.getRootSelectedBySidebar()() || 0) &&
      !!this.companyName && !this.loading && !this.reading && !this.busy && !!this.rows.length && !this.errors.length;
  }

  private async loadCatalogs(id: number, revision: number): Promise<void> {
    this.loading = true;
    const allowEmpty = (error: any) => error.status === 404 ? of([]) : throwError(() => error);
    try {
      const data = await firstValueFrom(forkJoin({ company: this.roots.getRootbyId(id),
        families: this.catalogs.getCatalogs(id, 'FAMILY').pipe(catchError(allowEmpty)),
        subfamilies: this.catalogs.getCatalogs(id, 'SUBFAMILY').pipe(catchError(allowEmpty)),
        measures: this.catalogs.getUnits(id).pipe(catchError(allowEmpty)) }));
      if (revision !== this.revision) return;
      const company = data.company as any;
      if (Number(company?.id) !== id || !company?.name) throw new Error('No se pudo identificar la empresa seleccionada.');
      this.companyName = company.name; this.families = data.families; this.subfamilies = data.subfamilies; this.measures = data.measures;
    } catch (error: any) {
      if (revision === this.revision) this.error = error.message || 'No se pudieron cargar los catálogos. Cierra y vuelve a abrir la importación.';
    } finally { if (revision === this.revision) this.loading = false; }
  }

  async download(example: boolean): Promise<void> {
    if (this.loading || !this.companyName || this.downloading) return;
    this.downloading = true; const revision = this.revision;
    try {
      const XLSX = await import('xlsx');
      if (revision !== this.revision) return;
      const subfamily = this.subfamilies.find(sub => this.families.some(family => Number(family.id) === Number(sub.parentId)));
      const family = this.families.find(item => Number(item.id) === Number(subfamily?.parentId));
      const sample = example ? [
        ['MAT-EJ-001', 'Material de ejemplo 1', family?.description || 'FAMILIA EJEMPLO', subfamily?.description || 'SUBFAMILIA EJEMPLO', this.measures[0]?.description || 'PIEZA', '000000000001', 25.5, 35, 0, 100, ''],
        ['MAT-EJ-002', 'Material de ejemplo 2', family?.description || 'FAMILIA EJEMPLO', subfamily?.description || 'SUBFAMILIA EJEMPLO', this.measures[0]?.description || 'PIEZA', '000000000002', 50, 65, 5, 50, '']
      ] : [];
      const workbook = XLSX.utils.book_new();
      const add = (name: string, values: any[][]) => {
        const sheet = XLSX.utils.aoa_to_sheet(values); sheet['!cols'] = values[0]?.map(() => ({ wch: 24 }));
        XLSX.utils.book_append_sheet(workbook, sheet, name);
      };
      add('Materiales', [MATERIAL_IMPORT_HEADERS, ...sample]);
      add('Instrucciones', [['Campo', 'Indicaciones'], ['Empresa', `${this.companyName} (ID: ${this.companyId})`],
        ['Obligatorios', 'Insumo, Descripcion, Familia, Subfamilia y Unidad. No cambies los encabezados ni el nombre de la hoja Materiales.'],
        ['Catálogos', 'Copia nombres de las hojas Familias, Subfamilias y Unidades de esta empresa. No se crean catálogos durante la importación.'],
        ['Insumo y CodigoBarras', 'Usa formato Texto para conservar ceros iniciales. Insumo máximo 35 caracteres; código de barras máximo 50.'],
        ['Descripcion', 'Máximo 1000 caracteres. No se permiten insumos o descripciones repetidos en el archivo o en la empresa.'],
        ['Precios', 'CostoMN y VentaMN son opcionales (0 por defecto). Usa celdas numéricas, máximo dos decimales, sin símbolos.'],
        ['Stock', 'StockMin y StockMax: enteros no negativos, máximo mayor o igual al mínimo. Vacíos equivalen a 0.'],
        ['GramosPorMetro', 'Opcional; si lo usas debe ser positivo, máximo cuatro decimales.'],
        ['Existencias', 'Se importa el catálogo con existencia inicial 0. Las existencias se registran mediante entradas de almacén.'],
        ['Límite', `Hasta ${this.maxRows} materiales y 10 MB por archivo. Pega valores; no fórmulas.`],
        ['Ejemplo', 'Elimina o reemplaza las filas de ejemplo antes de preparar tu archivo. Si no hay catálogos configurados, sustituye los nombres de ejemplo por catálogos reales.']]);
      add('Familias', [['Familia'], ...this.families.map(item => [item.description])]);
      add('Subfamilias', [['Familia', 'Subfamilia'], ...this.subfamilies.map(item => [this.families.find(family => Number(family.id) === Number(item.parentId))?.description || '', item.description])]);
      add('Unidades', [['Unidad'], ...this.measures.map(item => [item.description])]);
      XLSX.writeFile(workbook, `${example ? 'Ejemplo' : 'Formato'}_materiales_empresa_${this.companyId}.xlsx`);
    } catch { this.error = 'No se pudo generar el Excel. Inténtalo nuevamente.'; }
    finally { this.downloading = false; }
  }

  async readFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = '';
    if (!file || this.busy) return;
    this.rows = []; this.errors = []; this.error = ''; this.result = ''; this.fileName = file.name;
    if (!/\.xlsx?$/i.test(file.name) || file.size > 10 * 1024 * 1024) { this.error = 'Selecciona un archivo .xlsx o .xls de hasta 10 MB.'; return; }
    const revision = this.revision, fileRevision = ++this.fileRevision; this.reading = true;
    try {
      const XLSX = await import('xlsx'); const data = await file.arrayBuffer();
      if (revision !== this.revision || fileRevision !== this.fileRevision) return;
      const workbook = XLSX.read(data, { type: 'array', sheetRows: this.maxRows + 2 });
      const sheet = workbook.Sheets['Materiales'];
      if (!sheet) throw new Error('Falta la hoja Materiales. Usa la plantilla descargable.');
      if (XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref'] || 'A1').e.r > this.maxRows) throw new Error(`Máximo ${this.maxRows} filas de materiales. Elimina filas vacías sobrantes o divide el archivo.`);
      if (Object.values(sheet).some((cell: any) => cell?.f)) throw new Error('El archivo contiene fórmulas. Copia y pega los datos como valores antes de importarlo.');
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true, blankrows: true });
      const parsed = parseMaterialImport(matrix);
      this.rows = parsed.rows; this.errors = parsed.errors;
    } catch (error: any) { if (revision === this.revision && fileRevision === this.fileRevision) this.error = error.message || 'No se pudo leer el Excel.'; }
    finally { if (revision === this.revision && fileRevision === this.fileRevision) this.reading = false; }
  }

  async submit(): Promise<void> {
    if (!this.canImport) return;
    const companyId = this.companyId, companyName = this.companyName;
    this.busy = true; this.error = ''; this.result = '';
    try {
      const response = await firstValueFrom(this.materials.importMaterials(companyId, this.rows));
      this.result = `Se importaron ${response.imported} materiales en ${companyName} (ID: ${companyId}).`;
      if (companyId === this.companyId) { this.rows = []; this.fileName = ''; }
      this.imported.emit(response);
    } catch (error: any) {
      this.error = error?.error?.message || 'No se pudo confirmar la importación. Consulta el listado antes de volver a intentar.';
      if (companyId === this.companyId) this.errors = Array.isArray(error?.error?.errors) ? error.error.errors : [];
    } finally { this.busy = false; }
  }
}
