import {
  Component, Input, Output, EventEmitter, inject, OnInit, OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule }        from '@angular/common';
import { FormsModule }         from '@angular/forms';
import * as XLSX               from 'xlsx';
import { lastValueFrom }       from 'rxjs';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { CatalogsService }     from 'app/services/catalogs.service';
import { ConventionsService }  from 'app/services/conventions.service';

// ── Tipos locales ─────────────────────────────────────────────────────────────
interface TaskDraft {
  wbs:          string;
  level:        number;
  description:  string;
  unit:         string;
  quantity:     number | null;
  costMX:       number | null;
  startDate:    string;
  endDate:      string;
  duration:     number | null;
  predecessors: string;
  successors:   string;
  resources:    string;
  criticalRoute: string;    // Si | No
  isMilestone:  boolean;
  errors:       string[];
  warnings:     string[];
}

interface ColMatch { field: string; column: string; }

// ── Campos PMO con sinónimos ──────────────────────────────────────────────────
const PMO_FIELDS: { key: keyof TaskDraft; label: string; required: boolean; synonyms: string[] }[] = [
  { key: 'wbs',          label: 'WBS / Partida',      required: true,  synonyms: ['wbs','edt','partida','id partida','codigo','task id','activity id','outline number'] },
  { key: 'description',  label: 'Descripción',         required: true,  synonyms: ['descripcion','descripción','task name','nombre','actividad','name','concepto'] },
  { key: 'unit',         label: 'Unidad',              required: false, synonyms: ['unidad','unit','measure','medida','u.m.'] },
  { key: 'quantity',     label: 'Cantidad',            required: false, synonyms: ['cantidad','qty','volumen','quantity','vol'] },
  { key: 'costMX',       label: 'Precio Unitario MXN', required: false, synonyms: ['precio unitario','costo unitario','pu','unit price','unit cost','costo','cost','precio'] },
  { key: 'startDate',    label: 'Fecha Inicio',        required: true,  synonyms: ['fecha inicio','inicio','start','start date','fecha_inicio','comienzo'] },
  { key: 'endDate',      label: 'Fecha Término',       required: true,  synonyms: ['fecha termino','fecha término','termino','finish','end','end date','fin'] },
  { key: 'duration',     label: 'Duración (días)',     required: false, synonyms: ['duracion','duración','duration','dias','days','dur'] },
  { key: 'predecessors', label: 'Predecesoras',        required: false, synonyms: ['predecesoras','predecesor','predecessor','predecessors','pred'] },
  { key: 'successors',   label: 'Sucesoras',           required: false, synonyms: ['sucesoras','sucesor','successor','successors','suc'] },
  { key: 'resources',    label: 'Recursos',            required: false, synonyms: ['recursos','resources','resource names','recurso'] },
  { key: 'criticalRoute',label: 'Ruta Crítica',        required: false, synonyms: ['ruta critica','ruta crítica','critica','critical','criticroute'] },
];

@Component({
  selector: 'app-pmo-import',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pmo-import.component.html',
})
export class PmoImportComponent implements OnInit, OnChanges {
  @Input()  idProject!:   number;
  @Input()  idCompany!:   number;
  @Input()  idContrato!:  number;    // ID del contrato del proyecto (para cargar convenios)
  @Input()  projectName = '';
  @Input()  typeWP       = 'PROYECTO';
  @Output() closed       = new EventEmitter<void>();
  @Output() imported     = new EventEmitter<number>();

  private _wpService   = inject(WorkprogramsService);
  private _catService  = inject(CatalogsService);
  private _convService = inject(ConventionsService);

  // ── Convenios ────────────────────────────────────────────────────────────
  conventions:       any[]  = [];
  selectedConvention: any   = null;
  isLoadingConv      = false;

  // ── Estado general ───────────────────────────────────────────────────────
  step: 'upload' | 'map' | 'preview' | 'saving' | 'done' = 'upload';
  importMode: 'replace' | 'merge' = 'replace';
  isDragging   = false;
  isAnalyzing  = false;
  isSaving     = false;
  errorMsg     = '';

  // ── Archivos ─────────────────────────────────────────────────────────────
  selectedFile: File | null = null;
  fileType:    'excel' | 'xml' | 'xer' | '' = '';

  // ── Mapeo ────────────────────────────────────────────────────────────────
  detectedHeaders: string[] = [];
  mapping: Record<string, string> = {};   // field.key → column name

  // ── Preview ──────────────────────────────────────────────────────────────
  drafts:      TaskDraft[] = [];
  previewRows: TaskDraft[] = [];
  warnings:    string[]    = [];
  get okCount()   { return this.drafts.filter(d => !d.errors.length).length; }
  get errCount()  { return this.drafts.filter(d =>  d.errors.length).length; }
  get warnCount() { return this.drafts.filter(d => d.warnings.length && !d.errors.length).length; }

  // ── Saving ───────────────────────────────────────────────────────────────
  saveProgress = 0;
  saveStatus   = '';
  savedCount   = 0;
  saveErrors:  string[] = [];

  readonly fields = PMO_FIELDS;

  ngOnInit(): void {
    if (this.idContrato) this.loadConventions();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['idContrato'] && !changes['idContrato'].firstChange) {
      this.loadConventions();
    }
  }

  // ── Cargar convenios del contrato ─────────────────────────────────────────
  async loadConventions(): Promise<void> {
    if (!this.idContrato) return;
    this.isLoadingConv = true;
    try {
      const res: any = await lastValueFrom(
        this._convService.getConventionsByContractOrProject('contract', this.idContrato)
      );
      const raw = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      this.conventions = raw
        .filter((c: any) => c.active !== false)
        .sort((a: any, b: any) => a.id - b.id);

      // Auto-seleccionar el vigente si hay uno
      const vigente = this.conventions.find((c: any) => c.vigente);
      if (vigente) this.selectedConvention = vigente;
      else if (this.conventions.length === 1) this.selectedConvention = this.conventions[0];
    } catch (err) {
      console.error('Error cargando convenios', err);
      this.conventions = [];
    } finally {
      this.isLoadingConv = false;
    }
  }

  /** Etiqueta visible del tipo de convenio */
  convTypeBadge(type: string): { label: string; css: string } {
    const t = (type ?? '').toLowerCase();
    if (t.includes('reprog'))  return { label: 'Reprogramación', css: 'bg-warning text-dark' };
    if (t.includes('adend') || t.includes('addend')) return { label: 'Adenda',         css: 'bg-info text-dark' };
    if (t.includes('amend'))   return { label: 'Enmienda',       css: 'bg-secondary'   };
    return                            { label: 'Programación Original', css: 'bg-primary' };
  }

  // ── Cerrar ────────────────────────────────────────────────────────────────
  close(): void { this.closed.emit(); }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 1: UPLOAD
  // ══════════════════════════════════════════════════════════════════════════

  onDragOver(e: DragEvent): void { e.preventDefault(); this.isDragging = true; }
  onDragLeave(): void { this.isDragging = false; }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) this.loadFile(file);
  }

  onFileSelected(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.loadFile(file);
  }

  private loadFile(file: File): void {
    this.errorMsg = '';
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['xlsx','xls','csv','xml','xer'].includes(ext)) {
      this.errorMsg = 'Formato no soportado. Usa .xlsx .xls .csv .xml (MS Project) .xer (Primavera P6)';
      return;
    }
    this.selectedFile = file;
    this.fileType     = ext === 'xml' ? 'xml' : ext === 'xer' ? 'xer' : 'excel';
  }

  async analyzeFile(): Promise<void> {
    if (!this.selectedFile) return;
    this.isAnalyzing = true;
    this.errorMsg    = '';
    try {
      if (this.fileType === 'xml')   await this.analyzeXML(this.selectedFile);
      else if (this.fileType === 'xer') await this.analyzeXER(this.selectedFile);
      else                           await this.analyzeExcel(this.selectedFile);
    } catch (err: any) {
      this.errorMsg = err?.message ?? 'Error al analizar el archivo';
    } finally {
      this.isAnalyzing = false;
    }
  }

  // ── Analizar Excel / CSV ──────────────────────────────────────────────────
  private async analyzeExcel(file: File): Promise<void> {
    const wb = await this.readWorkbook(file);
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error('El archivo no contiene una hoja válida');
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '', raw: false });
    if (!rows.length) throw new Error('El archivo no contiene filas');

    this.detectedHeaders = Object.keys(rows[0]);
    this.autoMap();
    this.step = 'map';

    // Store raw rows for preview after mapping confirmed
    this._rawExcelRows = rows;
  }

  private _rawExcelRows: Record<string, any>[] = [];

  // ── Analizar XML MS Project ───────────────────────────────────────────────
  private async analyzeXML(file: File): Promise<void> {
    const tasks = await this.parseMSProjectXML(file);
    if (!tasks.length) throw new Error('No se detectaron tareas válidas en el XML');
    this.drafts     = tasks;
    this.previewRows = tasks.slice(0, 20);
    this.warnings   = tasks.filter(t => t.warnings.length).map(t => `${t.wbs}: ${t.warnings.join(', ')}`);
    this.step       = 'preview';
  }

  // ── Analizar XER Primavera ────────────────────────────────────────────────
  private async analyzeXER(file: File): Promise<void> {
    const tasks = await this.parsePrimaveraXER(file);
    if (!tasks.length) throw new Error('No se detectaron tareas válidas en el XER');
    this.drafts     = tasks;
    this.previewRows = tasks.slice(0, 20);
    this.warnings   = tasks.filter(t => t.warnings.length).map(t => `${t.wbs}: ${t.warnings.join(', ')}`);
    this.step       = 'preview';
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 2: MAP  (solo Excel/CSV)
  // ══════════════════════════════════════════════════════════════════════════

  private autoMap(): void {
    const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    this.mapping = {};
    PMO_FIELDS.forEach(f => {
      const match = this.detectedHeaders.find(h =>
        f.synonyms.some(s => normalize(h).includes(normalize(s)))
      );
      if (match) this.mapping[f.key] = match;
    });
  }

  confirmMapping(): void {
    // Verificar campos requeridos
    const missing = PMO_FIELDS.filter(f => f.required && !this.mapping[f.key]);
    if (missing.length) {
      this.errorMsg = `Mapea los campos requeridos: ${missing.map(f => f.label).join(', ')}`;
      return;
    }
    this.errorMsg = '';
    this.buildDraftsFromExcel();
    this.step = 'preview';
  }

  private buildDraftsFromExcel(): void {
    this.drafts     = [];
    this.previewRows = [];
    this.warnings   = [];

    this._rawExcelRows.forEach((row, i) => {
      const get = (key: keyof TaskDraft) => {
        const col = this.mapping[key as string];
        return col ? String(row[col] ?? '').trim() : '';
      };

      const wbs  = get('wbs');
      const desc = get('description');
      const sd   = this.normDate(get('startDate'));
      const ed   = this.normDate(get('endDate'));
      const errors: string[] = [];
      const warns:  string[] = [];

      if (!wbs)  errors.push('Sin WBS');
      if (!desc) errors.push('Sin descripción');
      if (!sd)   errors.push('Fecha inicio inválida');
      if (!ed)   errors.push('Fecha término inválida');
      if (sd && ed && sd > ed) errors.push('Fecha inicio > Fecha término');

      const qty   = this.parseNum(get('quantity'));
      const cost  = this.parseNum(get('costMX'));
      const dur   = this.parseNum(get('duration'));

      if (qty  === null) warns.push('Sin cantidad');
      if (cost === null) warns.push('Sin precio unitario');

      const draft: TaskDraft = {
        wbs,
        level:        this.resolveLevel(wbs),
        description:  desc,
        unit:         get('unit') || '',
        quantity:     qty,
        costMX:       cost,
        startDate:    sd,
        endDate:      ed,
        duration:     dur,
        predecessors: get('predecessors'),
        successors:   get('successors'),
        resources:    get('resources'),
        criticalRoute:get('criticalRoute') ? (get('criticalRoute').toLowerCase().includes('s') ? 'Si' : 'No') : 'No',
        isMilestone:  dur === 0,
        errors, warnings: warns,
      };
      this.drafts.push(draft);
      warns.forEach(w => this.warnings.push(`Fila ${i + 2}: ${w}`));
    });

    this.previewRows = this.drafts.slice(0, 20);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 3: SAVE
  // ══════════════════════════════════════════════════════════════════════════

  async saveToDatabase(): Promise<void> {
    const valid = this.drafts.filter(d => !d.errors.length);
    if (!valid.length) { this.errorMsg = 'No hay tareas válidas para guardar'; return; }

    this.step        = 'saving';
    this.isSaving    = true;
    this.saveProgress = 0;
    this.savedCount  = 0;
    this.saveErrors  = [];

    try {
      // Si replace: borrar SOLO las tareas del mismo convenio (o todas si no hay convenio)
      if (this.importMode === 'replace') {
        const convId = this.selectedConvention?.id ?? null;
        this.saveStatus = convId
          ? `Limpiando versión ${this.selectedConvention?.name ?? ''}...`
          : 'Limpiando programa anterior...';
        try {
          const existing: any[] = await lastValueFrom(
            this._wpService.getWorkPrograms(this.idProject, 'Project')
          );
          const toDelete = convId
            ? (existing ?? []).filter(t => (t.id_convention ?? t.idConvention) === convId)
            : (existing ?? []);
          for (const t of toDelete) {
            await lastValueFrom(this._wpService.deleteWorkProgram(t.id ?? t.idEntry));
          }
        } catch { /* si falla el borrado, continuar igual */ }
      }

      // Ordenar por WBS
      const sorted = [...valid].sort((a, b) => this.compareWbs(a.wbs, b.wbs));

      // Mapa WBS → id guardado (para predecesoras)
      const wbsToId = new Map<string, number>();
      const stackByLevel = new Map<number, number>();

      for (let i = 0; i < sorted.length; i++) {
        const task = sorted[i];
        this.saveStatus   = `Guardando ${i + 1}/${sorted.length}: ${task.description.substring(0, 40)}`;
        this.saveProgress = Math.round(((i + 1) / sorted.length) * 90);

        // Resolver padre
        const parentWbs = this.findParentWbs(task.wbs);
        const parentId  = parentWbs ? (wbsToId.get(parentWbs) ?? 0) : 0;

        // Calcular predecesora como número
        const predId = task.predecessors
          ? (wbsToId.get(task.predecessors.split(/[;,]/)[0].trim()) ?? 0)
          : 0;

        const payload: any = {
          idProject:    this.idProject,
          id_convention: this.selectedConvention?.id ?? null,   // ← convenio de esta importación
          activity:     task.wbs,
          text:         task.description,
          description:  task.description,
          startdate:    task.startDate,
          endate:       task.endDate,
          progress:     0,
          ponderado:    null,
          quantity:     task.quantity  ?? 0,
          costMX:       task.costMX   ?? 0,
          costDLL:      0,
          salePrice:    0,
          criticroute:  task.criticalRoute === 'Si' ? 'Si' : 'No',
          parent:       parentId,
          sortorder:    i,
          predecesor:   predId,
          active:       1,
          type:         this.typeWP,
          typeActivity: task.isMilestone ? 'Milestone' : 'Activity',
          measure:      task.unit || null,
          resources:    task.resources || null,
          phase:        null,
        };

        try {
          const res: any = await lastValueFrom(this._wpService.addWorkProgram(payload));
          const newId = res?.id ?? res?.data?.id ?? null;
          if (newId) {
            wbsToId.set(task.wbs, newId);
            stackByLevel.set(task.level, newId);
          }
          this.savedCount++;
        } catch (err: any) {
          this.saveErrors.push(`${task.wbs} — ${err?.error?.message ?? 'Error al guardar'}`);
        }
      }

      this.saveProgress = 100;
      this.saveStatus   = `Completado: ${this.savedCount} tarea(s) guardadas.`;
      this.step         = 'done';
      this.imported.emit(this.savedCount);

    } catch (err: any) {
      this.errorMsg = err?.message ?? 'Error inesperado';
      this.step     = 'preview';
    } finally {
      this.isSaving = false;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DESCARGAR PLANTILLA EXCEL
  // ══════════════════════════════════════════════════════════════════════════

  downloadTemplate(): void {
    const wb  = XLSX.utils.book_new();

    // Hoja 1: Plantilla con headers y ejemplo
    const headers = [
      'WBS',            // A
      'Descripción',    // B
      'Unidad',         // C
      'Cantidad',       // D
      'Precio Unitario',// E
      'Fecha Inicio',   // F
      'Fecha Término',  // G
      'Duración',       // H
      'Predecesoras',   // I
      'Sucesoras',      // J
      'Recursos',       // K
      'Ruta Crítica',   // L
    ];

    const example1 = ['1',    'Obra de Pavimentación',   '',    null, null,    '2026-03-01','2026-10-31', 245, '',  '',   '',           'No'];
    const example2 = ['1.1',  'Trabajos Preliminares',   'Lote',200,  1500.00, '2026-03-01','2026-04-15',  45, '',  '',   'Topógrafo',  'No'];
    const example3 = ['1.1.1','Nivelación de terreno',   'm2',  500,   85.50,  '2026-03-01','2026-03-20',  19, '',  '1.1.2','Cuadrilla A','Si'];
    const example4 = ['1.1.2','Compactación',            'm3',  300,  120.00,  '2026-03-21','2026-04-15',  25, '1.1.1','','Compactador','Si'];
    const hito     = ['HITO1','Entrega Preliminar',      '',    null, null,    '2026-04-15','2026-04-15',   0, '1.1.2','','',           'Si'];

    const ws = XLSX.utils.aoa_to_sheet([headers, example1, example2, example3, example4, hito]);

    // Ancho de columnas
    ws['!cols'] = [
      { wch: 12 }, { wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 15 },
      { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
      { wch: 18 }, { wch: 14 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'PMO_Template');

    // Hoja 2: Instrucciones
    const instrHeaders = ['Campo','Requerido','Formato','Ejemplo','Notas'];
    const instrRows = [
      ['WBS',             'SÍ',  'Texto / Número','1.1.2','Código de estructura. Punto (.) como separador de niveles.'],
      ['Descripción',     'SÍ',  'Texto',         'Nivelación de terreno','Nombre de la tarea o entregable.'],
      ['Unidad',          'NO',  'Texto',         'm2','Unidad de medida: m2, m3, kg, ton, día, etc.'],
      ['Cantidad',        'NO',  'Número',        '500','Volumen de obra. Puede dejarse vacío (modo cronograma).'],
      ['Precio Unitario', 'NO',  'Número MXN',    '85.50','Costo unitario en MXN. Sin signo $. Sin comas.'],
      ['Fecha Inicio',    'SÍ',  'AAAA-MM-DD',    '2026-03-01','Formato ISO recomendado. También acepta DD/MM/AAAA.'],
      ['Fecha Término',   'SÍ',  'AAAA-MM-DD',    '2026-10-31','Debe ser >= Fecha Inicio.'],
      ['Duración',        'NO',  'Número (días)', '45','Si vacío se calcula desde las fechas. 0 = Hito.'],
      ['Predecesoras',    'NO',  'WBS(s)',         '1.1.1','WBS de tareas predecesoras. Separa con coma si hay varias.'],
      ['Sucesoras',       'NO',  'WBS(s)',         '1.1.3','WBS de tareas sucesoras. Referencia informativa.'],
      ['Recursos',        'NO',  'Texto',         'Cuadrilla A, Topógrafo','Nombres de recursos separados por coma.'],
      ['Ruta Crítica',    'NO',  'Si / No',       'Si','Indica si la tarea es crítica para el plazo del proyecto.'],
    ];

    const wsI = XLSX.utils.aoa_to_sheet([instrHeaders, ...instrRows]);
    wsI['!cols'] = [{wch:16},{wch:11},{wch:16},{wch:22},{wch:60}];
    XLSX.utils.book_append_sheet(wb, wsI, 'Instrucciones');

    // Hoja 3: Compatibilidad con software externo
    const compHeaders = ['Software','Exportar como','Instrucciones'];
    const compRows = [
      ['MS Project (.mpp)','Archivo XML (.xml)','Archivo → Guardar como → XML. Importar directamente en PMO.'],
      ['MS Project (.mpp)','Excel (.xlsx)',     'Archivo → Exportar → Crear paquete de proyecto → Datos de tarea.'],
      ['Primavera P6',     'Archivo XER (.xer)','Archivo → Exportar → Primavera PM → XER. Importar directamente en PMO.'],
      ['Primavera P6',     'Excel (.xlsx)',     'Herramientas → Exportar → Spreadsheet - (XLS).'],
      ['Opus',             'Excel (.xlsx)',     'Módulo Programa de Obra → Exportar → Excel.'],
      ['Excel/CSV genérico','CSV (.csv)',       'Columnas deben tener los encabezados de esta plantilla.'],
    ];

    const wsC = XLSX.utils.aoa_to_sheet([compHeaders, ...compRows]);
    wsC['!cols'] = [{wch:18},{wch:20},{wch:65}];
    XLSX.utils.book_append_sheet(wb, wsC, 'Compatibilidad');

    XLSX.writeFile(wb, `PMO_Plantilla_Importacion_${this.idProject || 'nuevo'}.xlsx`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Parsers XML y XER (versión PMO standalone)
  // ══════════════════════════════════════════════════════════════════════════

  private async parseMSProjectXML(file: File): Promise<TaskDraft[]> {
    const text = await file.text();
    const doc  = new DOMParser().parseFromString(text, 'application/xml');
    const nodes = Array.from(doc.querySelectorAll('Tasks > Task'));
    const tasks: TaskDraft[] = [];

    nodes.forEach((node, i) => {
      const get = (tag: string) => node.querySelector(tag)?.textContent?.trim() ?? '';
      if (get('UID') === '0') return;
      const name = get('Name');
      if (!name) return;

      const wbs   = get('WBS') || get('OutlineNumber') || String(i + 1);
      const level = Number(get('OutlineLevel')) || 1;
      const sd    = this.normDate(get('Start').split('T')[0]);
      const ed    = this.normDate(get('Finish').split('T')[0]);
      const dur   = Number(get('Duration').replace(/[^0-9]/g,'')) || null;

      // Predecesoras desde nodos PredecessorLink
      const predWbs = Array.from(node.querySelectorAll('PredecessorLink > PredecessorUID'))
        .map(n => n.textContent?.trim())
        .filter(Boolean)
        .join(',');

      const errors:   string[] = [];
      const warnings: string[] = [];
      if (!sd) errors.push('Fecha inicio inválida');
      if (!ed) errors.push('Fecha término inválida');

      tasks.push({ wbs, level, description: name, unit: '', quantity: null,
        costMX: null, startDate: sd, endDate: ed, duration: dur,
        predecessors: predWbs, successors: '', resources: '',
        criticalRoute: 'No', isMilestone: dur === 0, errors, warnings });
    });

    return tasks;
  }

  private async parsePrimaveraXER(file: File): Promise<TaskDraft[]> {
    const text    = await file.text();
    const lines   = text.split('\n').map(l => l.trimEnd());
    const tasks:  TaskDraft[] = [];
    let inTask    = false;
    let headers:  string[] = [];

    for (const line of lines) {
      if (line.startsWith('%T\t'))        { inTask = line.substring(3).trim() === 'TASK'; headers = []; continue; }
      if (line.startsWith('%F\t') && inTask) { headers = line.substring(3).split('\t'); continue; }
      if (line.startsWith('%R\t') && inTask && headers.length) {
        const vals = line.substring(3).split('\t');
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = vals[i] || ''; });
        const type = row['task_type'] || '';
        if (type === 'TT_WBS') continue;
        const code  = row['task_code'] || '';
        const name  = row['task_name'] || '';
        const sd    = this.normDate((row['target_start_date'] || row['act_start_date'] || '').split(' ')[0]);
        const ed    = this.normDate((row['target_end_date']   || row['reend_date'] || row['act_end_date'] || '').split(' ')[0]);
        if (!name || !sd || !ed) continue;
        const level = (code.match(/\./g) || []).length + 1;
        const isMile = type === 'TT_Mile';
        tasks.push({ wbs: code, level, description: name, unit: '', quantity: null,
          costMX: null, startDate: sd, endDate: ed, duration: isMile ? 0 : null,
          predecessors: '', successors: '', resources: '',
          criticalRoute: 'No', isMilestone: isMile, errors: [], warnings: [] });
      }
      if (line.startsWith('%E')) inTask = false;
    }
    return tasks;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ══════════════════════════════════════════════════════════════════════════

  private readWorkbook(file: File): Promise<XLSX.WorkBook> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        try { resolve(XLSX.read(new Uint8Array(r.result as ArrayBuffer), { type: 'array' })); }
        catch (e) { reject(e); }
      };
      r.onerror = () => reject(r.error);
      r.readAsArrayBuffer(file);
    });
  }

  private normDate(v: string): string {
    if (!v) return '';
    const s = v.trim();
    // ISO YYYY-MM-DD
    const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (iso) {
      const [,y,m,d] = iso;
      if (this.validDate(+y,+m,+d)) return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    // Excel serial
    const n = Number(v);
    if (isFinite(n) && n > 59) {
      const p = XLSX.SSF.parse_date_code(n);
      if (p?.y) return `${p.y}-${String(p.m).padStart(2,'0')}-${String(p.d).padStart(2,'0')}`;
    }
    // DD/MM/YYYY or MM/DD/YYYY
    const parts = s.replace(/\./g,'/').replace(/-/g,'/').split('/');
    if (parts.length === 3) {
      let [a,b,c] = parts.map(Number);
      if (c < 100) c += 2000;
      const [y,m,d] = a > 12 ? [c,b,a] : b > 12 ? [c,a,b] : [c,a,b];
      if (this.validDate(y,m,d)) return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }
    const fb = new Date(s);
    if (!isNaN(fb.getTime())) return `${fb.getFullYear()}-${String(fb.getMonth()+1).padStart(2,'0')}-${String(fb.getDate()).padStart(2,'0')}`;
    return '';
  }

  private validDate(y:number, m:number, d:number): boolean {
    if (!isFinite(y)||!isFinite(m)||!isFinite(d)) return false;
    if (y<1900||m<1||m>12||d<1||d>31) return false;
    const dt = new Date(y,m-1,d);
    return dt.getFullYear()===y && dt.getMonth()===m-1 && dt.getDate()===d;
  }

  private parseNum(v: string): number | null {
    if (!v) return null;
    const n = Number(v.replace(/[$,\s]/g,''));
    return isFinite(n) ? n : null;
  }

  private resolveLevel(wbs: string): number {
    return wbs.split(/[.\-_/\\]/).filter(Boolean).length || 1;
  }

  private findParentWbs(wbs: string): string | null {
    const parts = wbs.split(/[.\-_/\\]/).filter(Boolean);
    return parts.length <= 1 ? null : parts.slice(0,-1).join('.');
  }

  private compareWbs(a: string, b: string): number {
    const aParts = a.split(/[.\-_/\\]/).filter(Boolean);
    const bParts = b.split(/[.\-_/\\]/).filter(Boolean);
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const ap = aParts[i] ?? ''; const bp = bParts[i] ?? '';
      const an = Number(ap); const bn = Number(bp);
      if (isFinite(an) && isFinite(bn)) { if (an!==bn) return an-bn; }
      else if (ap !== bp) return ap.localeCompare(bp);
    }
    return 0;
  }

  rowStatus(d: TaskDraft): 'ok'|'warn'|'error' {
    return d.errors.length ? 'error' : d.warnings.length ? 'warn' : 'ok';
  }
}
