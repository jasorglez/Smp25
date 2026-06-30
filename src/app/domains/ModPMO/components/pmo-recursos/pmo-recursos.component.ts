import { Component, inject, OnInit, effect, ElementRef, ViewChild } from '@angular/core';
import * as XLSX from 'xlsx';
import { CommonModule }         from '@angular/common';
import { FormsModule }          from '@angular/forms';
import { AgGridModule }         from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom }        from 'rxjs';
import { ProjectsService }      from 'app/services/projects.service';
import { WorkprogramsService }  from 'app/services/workprograms.service';
import { ConventionsService }   from 'app/services/conventions.service';
import { PosicionesService }    from 'app/services/posiciones.service';
import { EquipmentService }     from 'app/services/equipment.service';
import { MaterialsService }     from 'app/services/materials.service';
import { SignalsService }       from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';

interface RecursoRow {
  id:           number;   // 0 = nuevo, >0 = existe en BD
  idActivity:   number;   // ID de la actividad/tarea del workprogram
  tipo:         string;
  descripcion:  string;
  unidad:       string;
  periodo:      string;
  cantPlan:     number;
  cantReal:     number;
  costoUnitPlan: number;
  costoUnitReal: number;
  costoPlan:    number;   // calculado
  costoReal:    number;   // calculado
  variacion:    number;
  __isNew?:     boolean;
  __modified?:  boolean;
}

interface ImportPreviewRow {
  rowNum:         number;
  wbs:            string;
  actividadLabel: string;
  idActivity:     number | null;
  tipo:           string;
  descripcion:    string;
  unidad:         string;
  periodo:        string;
  cantPlan:       number;
  costoUnitPlan:  number;
  cantReal:       number;
  costoUnitReal:  number;
  costoPlan:      number;
  costoReal:      number;
  status:         'ok' | 'warn';
  msg:            string;
}

@Component({
  selector: 'app-pmo-recursos',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './pmo-recursos.component.html',
})
export class PmoRecursosComponent implements OnInit {
  private trackingService = inject(TrackingService);

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;
  private _projectsService     = inject(ProjectsService);
  private _workprogramsService = inject(WorkprogramsService);
  private _convService         = inject(ConventionsService);
  private _posService          = inject(PosicionesService);
  private _eqService           = inject(EquipmentService);
  private _matService          = inject(MaterialsService);
  private _signalsService      = inject(SignalsService);

  // ── Catálogos para descripcion ────────────────────────────────────────────
  personalCatalog: string[] = [];   // Puestos: Tubero, Soldador...
  equipoCatalog:   string[] = [];   // Equipos del catálogo
  materialCatalog: string[] = [];   // Materiales del catálogo

  idCompany         = 0;
  projects: any[]   = [];

  // ── Convenios ──────────────────────────────────────────────────────────────
  conventions:        any[]  = [];
  selectedConvention: any    = null;
  isLoadingConv               = false;

  // ── Actividades / Recursos ─────────────────────────────────────────────────
  activities: any[] = [];           // tareas del workprogram filtradas por convenio
  selectedProject:  any = null;
  selectedActivity: any = null;     // actividad seleccionada

  isLoading        = false;
  isSaving         = false;
  hasUnsavedChanges = false;
  saveMsg          = '';
  saveMsgType      = '';

  gridApi!: GridApi;
  rowData: RecursoRow[]        = [];
  private originalRowData: RecursoRow[] = [];

  totalPlan  = 0;
  totalReal  = 0;
  totalVar   = 0;

  // ── Import Excel ───────────────────────────────────────────────────────────
  showImportPanel  = false;
  importPreview:   ImportPreviewRow[] = [];
  isImporting      = false;
  importDone       = false;

  get importOk()   { return this.importPreview.filter(r => r.status === 'ok').length; }
  get importWarn() { return this.importPreview.filter(r => r.status === 'warn').length; }

  // Mapeo de tipos Opus → tipos del sistema
  private readonly TIPO_MAP: Record<string, string> = {
    'mo': 'Personal', 'm.o.': 'Personal', 'mano de obra': 'Personal',
    'mano obra': 'Personal', 'personal': 'Personal', 'labor': 'Personal',
    'eq': 'Equipo', 'equipo': 'Equipo', 'maquinaria': 'Equipo',
    'herramienta': 'Equipo', 'tool': 'Equipo',
    'ma': 'Material', 'mat': 'Material', 'material': 'Material',
    'materiales': 'Material', 'insumo': 'Material',
    'subcontrato': 'Subcontrato', 'sub': 'Subcontrato', 'sc': 'Subcontrato',
    'indirecto': 'Indirecto', 'ind': 'Indirecto',
  };

  colDefs: ColDef[] = [
    {
      field: 'tipo', headerName: 'Tipo de Cargo', width: 130, editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: ['Personal','Material','Equipo','Subcontrato','Indirecto'] },
      cellStyle: (p) => p.data?.__isNew ? { background: '#fffacd' } : {},
    },
    {
      field: 'descripcion',
      headerName: 'Categoría / Recurso',
      width: 220,
      editable: true,
      cellStyle: (p) => p.data?.__isNew ? { background: '#fffacd' } : {},
      // ── Editor dinámico según tipo ──────────────────────────────────────
      cellEditorSelector: (p: any) => {
        const tipo = (p.data?.tipo ?? '').toLowerCase();
        if (tipo === 'personal' && this.personalCatalog.length)
          return { component: 'agSelectCellEditor', params: { values: ['SIN DESCRIPCION', ...this.personalCatalog] } };
        if (tipo === 'equipo' && this.equipoCatalog.length)
          return { component: 'agSelectCellEditor', params: { values: ['SIN DESCRIPCION', ...this.equipoCatalog] } };
        if (tipo === 'material' && this.materialCatalog.length)
          return { component: 'agSelectCellEditor', params: { values: ['SIN DESCRIPCION', ...this.materialCatalog] } };
        return { component: 'agTextCellEditor' };
      },
      // ── Ícono de catálogo en la celda ───────────────────────────────────
      cellRenderer: (p: any) => {
        const tipo = (p.data?.tipo ?? '').toLowerCase();
        const hasCat = ['personal','equipo','material'].includes(tipo);
        const val = p.value || 'SIN DESCRIPCION';
        if (!hasCat) return `<span>${val}</span>`;
        return `<span>${val} <i class="bi bi-chevron-down text-muted" style="font-size:10px;"></i></span>`;
      },
    },
    {
      field: 'unidad', headerName: 'Unidad', width: 120, editable: true,
      cellStyle: (p) => p.data?.__isNew ? { background: '#fffacd' } : {},
    },
    {
      field: 'periodo', headerName: 'Período', width: 110, editable: true,
      cellStyle: (p) => p.data?.__isNew ? { background: '#fffacd' } : {},
    },
    {
      field: 'cantPlan', headerName: 'Cant. Plan', width: 140, editable: true, type: 'numericColumn',
      valueFormatter: (p) => (p.value ?? 0).toFixed(2),
      onCellValueChanged: (p) => {
        p.data.costoPlan = Number(p.data.cantPlan) * Number(p.data.costoUnitPlan);
        this.recalcTotals(); this.markModified(p.data);
      },
    },
    {
      field: 'cantReal', headerName: 'Cant. Real', width: 140, editable: true, type: 'numericColumn',
      valueFormatter: (p) => (p.value ?? 0).toFixed(2),
      onCellValueChanged: (p) => {
        p.data.costoReal = Number(p.data.cantReal) * Number(p.data.costoUnitReal);
        p.data.variacion  = p.data.costoReal - p.data.costoPlan;
        this.recalcTotals(); this.markModified(p.data);
      },
    },
    {
      field: 'costoUnitPlan', headerName: 'C.Unit Plan', width: 140, editable: true, type: 'numericColumn',
      valueFormatter: (p) => (p.value ?? 0).toFixed(2),
      onCellValueChanged: (p) => {
        p.data.costoPlan = Number(p.data.cantPlan) * Number(p.data.costoUnitPlan);
        this.recalcTotals(); this.markModified(p.data);
      },
    },
    {
      field: 'costoUnitReal', headerName: 'C.Unit Real', width: 140, editable: true, type: 'numericColumn',
      valueFormatter: (p) => (p.value ?? 0).toFixed(2),
      onCellValueChanged: (p) => {
        p.data.costoReal = Number(p.data.cantReal) * Number(p.data.costoUnitReal);
        p.data.variacion  = p.data.costoReal - p.data.costoPlan;
        this.recalcTotals(); this.markModified(p.data);
      },
    },
    {
      field: 'costoPlan', headerName: 'Costo Plan', width: 160, editable: false, type: 'numericColumn',
      valueFormatter: (p) => (p.value ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
      cellStyle: { background: '#e8f4fd' },
    },
    {
      field: 'costoReal', headerName: 'Costo Real', width: 160, editable: false, type: 'numericColumn',
      valueFormatter: (p) => (p.value ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
      cellStyle: { background: '#e8f4fd' },
    },
    {
      field: 'variacion', headerName: 'Variación', width: 120, editable: false, type: 'numericColumn',
      valueFormatter: (p) => (p.value ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
      cellStyle: (p) => ({
        background: Number(p.value ?? 0) > 0 ? '#fce4e4' : Number(p.value ?? 0) < 0 ? '#e4fce4' : '#f8f8f8',
        fontWeight: 'bold',
      }),
    },
  ];

  rowClassRules = { 'new-row-highlight': (p: any) => !!p.data?.__isNew };

  constructor() {
    effect(() => {
      const id = this._signalsService.getRootSelectedBySidebar()();
      if (id && id !== this.idCompany) {
        this.idCompany = id;
        this.loadProjects();
        this.loadCatalogs();
      }
    });
  }

  ngOnInit(): void {
    this.idCompany = this._signalsService.getRootSelectedBySidebar()() ?? 0;
    if (this.idCompany) {
      this.loadProjects();
      this.loadCatalogs();
    }
  }

  /** Carga catálogos de Personal (puestos), Equipos y Materiales */
  async loadCatalogs(): Promise<void> {
    if (!this.idCompany) return;
    try {
      // ── Personal: puestos (Tubero, Soldador, ...) ──
      const pos: any[] = await lastValueFrom(
        this._posService.getPositionsByCompany(this.idCompany)
      );
      this.personalCatalog = (pos ?? [])
        .filter((p: any) => p.active !== false)
        .map((p: any) => p.description ?? p.name ?? '')
        .filter(Boolean)
        .sort();
    } catch { this.personalCatalog = []; }

    try {
      // ── Equipos ──
      const eq: any[] = await lastValueFrom(
        this._eqService.getEquipment(this.idCompany)
      );
      this.equipoCatalog = (eq ?? [])
        .map((e: any) => e.description ?? e.name ?? '')
        .filter(Boolean)
        .sort();
    } catch { this.equipoCatalog = []; }

    try {
      // ── Materiales ──
      const mat: any[] = await lastValueFrom(
        this._matService.getMaterials(this.idCompany, 'MATERIAL')
      );
      this.materialCatalog = (mat ?? [])
        .map((m: any) => m.insumo ?? m.articulo ?? m.description ?? '')
        .filter(Boolean)
        .sort();
    } catch { this.materialCatalog = []; }
  }

  async loadProjects(): Promise<void> {
    try {
      const res: any = await lastValueFrom(this._projectsService.getProjectListByCompany(this.idCompany));
      this.projects = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    } catch { this.projects = []; }
  }

  async onProjectChange(): Promise<void> {
    this.selectedActivity   = null;
    this.selectedConvention = null;
    this.conventions        = [];
    this.rowData            = [];
    this.activities         = [];
    this.recalcTotals();
    if (!this.selectedProject) return;
    await this.loadConventions();
  }

  /** Carga los convenios del contrato del proyecto */
  async loadConventions(): Promise<void> {
    const idContrato = this.selectedProject?.idContrato
                    ?? this.selectedProject?.id_contrato
                    ?? 0;
    if (!idContrato) {
      // Sin contrato: cargar actividades sin filtro de convenio
      await this.loadActivities();
      return;
    }
    this.isLoadingConv = true;
    try {
      const res: any = await lastValueFrom(
        this._convService.getConventionsByContractOrProject('contract', idContrato)
      );
      const raw = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      this.conventions = raw
        .filter((c: any) => c.active !== false)
        .sort((a: any, b: any) => a.id - b.id);

      // Auto-seleccionar vigente
      const vigente = this.conventions.find((c: any) => c.vigente);
      if (vigente) {
        this.selectedConvention = vigente;
        await this.loadActivities();
      } else if (this.conventions.length === 1) {
        this.selectedConvention = this.conventions[0];
        await this.loadActivities();
      }
      // Si hay varios y ninguno es vigente → el usuario elige manualmente
    } catch {
      this.conventions = [];
      await this.loadActivities();   // fallback: sin filtro
    } finally {
      this.isLoadingConv = false;
    }
  }

  /** Cambia convenio → recarga actividades filtradas */
  async onConventionChange(): Promise<void> {
    this.selectedActivity = null;
    this.rowData          = [];
    this.activities       = [];
    this.recalcTotals();
    await this.loadActivities();
  }

  /** Etiqueta visible del tipo de convenio */
  convTypeBadge(type: string): { label: string; css: string } {
    const t = (type ?? '').toLowerCase();
    if (t.includes('reprog'))              return { label: 'Reprogramación',       css: 'bg-warning text-dark' };
    if (t.includes('adend') || t.includes('addend')) return { label: 'Adenda',    css: 'bg-info text-dark'    };
    if (t.includes('amend'))               return { label: 'Enmienda',             css: 'bg-secondary'         };
    return                                        { label: 'Programación Original', css: 'bg-primary'          };
  }

  /** Carga las actividades del workprogram.
   *  - Si hay convenio seleccionado → usa endpoint /byconvention (servidor filtra)
   *  - Sin convenio → todas las actividades del proyecto
   */
  async loadActivities(): Promise<void> {
    if (!this.selectedProject) return;
    try {
      const idProject = this.selectedProject.id ?? this.selectedProject.idProject;
      let raw: any[];

      if (this.selectedConvention) {
        // ── Endpoint dedicado: solo devuelve las tareas de ese convenio ──
        raw = await lastValueFrom(
          this._workprogramsService.getByConvention(this.selectedConvention.id, idProject)
        );
      } else {
        // ── Sin convenio: todas las tareas del proyecto ──
        raw = await lastValueFrom(
          this._workprogramsService.getWorkPrograms(idProject, 'Project')
        );
      }

      this.activities = (raw ?? []).map(a => ({
        id:    a.id ?? a.idEntry,
        label: `${a.activity ?? a.wbs ?? ''} — ${(a.text ?? a.description ?? '').substring(0, 55)}`,
        raw:   a,
      })).sort((a, b) => String(a.raw.activity ?? '').localeCompare(String(b.raw.activity ?? '')));
    } catch {
      this.activities = [];
    }
  }

  async onActivityChange(): Promise<void> {
    if (!this.selectedActivity) {
      this.rowData = [];
      this.recalcTotals();
      return;
    }
    await this.loadRecursos();
  }

  async loadRecursos(): Promise<void> {
    if (!this.selectedActivity) return;
    this.isLoading = true;
    if (this.gridApi && !this.gridApi.isDestroyed()) this.gridApi.showLoadingOverlay();
    try {
      const res: any = await lastValueFrom(
        this._projectsService.getPmoRecursosByProject(this.selectedProject.id)
      );
      const raw = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      // Filtrar por idActivity del proyecto
      const actId = this.selectedActivity.id;
      this.rowData = raw
        .filter((r: any) => (r.idActivity ?? r.id_activity) === actId)
        .map((r: any) => this.mapFromApi(r));
      this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
      this.hasUnsavedChanges = false;
      this.recalcTotals();
      this.setRowData(this.rowData);
      if (this.gridApi && !this.gridApi.isDestroyed()) {
        this.rowData.length ? this.gridApi.hideOverlay() : this.gridApi.showNoRowsOverlay();
      }
    } catch (err) {
      console.error('Error cargando recursos PMO', err);
      this.rowData = [];
      this.setRowData([]);
    } finally {
      this.isLoading = false;
    }
  }

  onGridReady(e: GridReadyEvent): void { this.gridApi = e.api; }

  addRow(): void {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Agregó nuevo pmo recursos', 'ModPMO', this.trackingService.getEmail());
    if (!this.selectedActivity) return;
    const newRow: RecursoRow = {
      id: 0,
      idActivity:   this.selectedActivity.id,
      tipo: 'Personal', descripcion: 'SIN DESCRIPCION', unidad: 'día', periodo: '',
      cantPlan: 0, cantReal: 0, costoUnitPlan: 0, costoUnitReal: 0,
      costoPlan: 0, costoReal: 0, variacion: 0,
      __isNew: true,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasUnsavedChanges = true;
    this.setRowData(this.rowData);
    setTimeout(() => {
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'tipo' });
    }, 50);
  }

  async saveChanges(): Promise<void> {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardó cambios en pmo recursos', 'ModPMO', this.trackingService.getEmail());
    if (!this.selectedActivity) return;
    const dirty = this.rowData.filter(r => r.__isNew || r.__modified);
    if (!dirty.length) { this.showMsg('No hay cambios que guardar', 'error'); return; }

    this.isSaving = true;
    try {
      const payload = dirty.map(r => this.mapToApi(r));
      const res: any = await lastValueFrom(this._projectsService.savePmoRecursosBatch(payload));
      await this.loadRecursos();
      this.showMsg(`✓ ${res?.count ?? dirty.length} registros guardados`, 'success');
    } catch (err: any) {
      this.showMsg('Error al guardar — revisa la consola', 'error');
    } finally {
      this.isSaving = false;
    }
  }

  async deleteSelected(): Promise<void> {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Eliminó pmo recursos', 'ModPMO', this.trackingService.getEmail());
    const selected = this.gridApi?.getSelectedRows() ?? [];
    if (!selected.length) return;
    const row: RecursoRow = selected[0];
    if (row.__isNew) {
      this.rowData = this.rowData.filter(r => r !== row);
      this.setRowData(this.rowData);
      this.recalcTotals();
      return;
    }
    if (!confirm(`¿Eliminar "${row.descripcion || row.tipo}"?`)) return;
    try {
      await lastValueFrom(this._projectsService.deletePmoRecurso(row.id));
      await this.loadRecursos();
      this.showMsg('Registro eliminado', 'success');
    } catch { this.showMsg('Error al eliminar', 'error'); }
  }

  revertChanges(): void {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Deshizo cambios en pmo recursos', 'ModPMO', this.trackingService.getEmail());
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.hasUnsavedChanges = false;
    this.setRowData(this.rowData);
    this.recalcTotals();
  }

  exportXLS(): void {
    this.gridApi?.exportDataAsExcel({ fileName: 'PMO_Recursos.xlsx' });
  }

  // ── helpers ──────────────────────────────────────────────────────────────────

  private setRowData(data: RecursoRow[]): void {
    if (this.gridApi && !this.gridApi.isDestroyed())
      this.gridApi.setGridOption('rowData', data);
  }

  private markModified(row: RecursoRow): void {
    if (!row.__isNew) row.__modified = true;
    this.hasUnsavedChanges = true;
  }

  recalcTotals(): void {
    this.totalPlan = this.rowData.reduce((s, r) => s + Number(r.costoPlan ?? 0), 0);
    this.totalReal = this.rowData.reduce((s, r) => s + Number(r.costoReal ?? 0), 0);
    this.totalVar  = this.totalReal - this.totalPlan;
  }

  private mapFromApi(r: any): RecursoRow {
    const cantPlan      = Number(r.cantPlan ?? r.cant_plan ?? 0);
    const cantReal      = Number(r.cantReal ?? r.cant_real ?? 0);
    const costoUnitPlan = Number(r.costoUnitPlan ?? r.costo_unit_plan ?? 0);
    const costoUnitReal = Number(r.costoUnitReal ?? r.costo_unit_real ?? 0);
    const costoPlan     = cantPlan * costoUnitPlan;
    const costoReal     = cantReal * costoUnitReal;
    return {
      id:           r.id ?? 0,
      idActivity:   r.idActivity ?? r.id_activity ?? 0,
      tipo:         r.tipo ?? 'Personal',
      descripcion:  r.descripcion ?? '',
      unidad:       r.unidad ?? 'día',
      periodo:      r.periodo ?? '',
      cantPlan, cantReal, costoUnitPlan, costoUnitReal,
      costoPlan, costoReal,
      variacion:    costoReal - costoPlan,
    };
  }

  private mapToApi(r: RecursoRow): any {
    return {
      id:             r.id,
      idProject:      this.selectedProject?.id ?? 0,
      idCompany:      this.idCompany,
      idActivity:     r.idActivity || this.selectedActivity?.id || null,
      tipo:           r.tipo,
      descripcion:    r.descripcion,
      unidad:         r.unidad,
      periodo:        r.periodo,
      cantPlan:       r.cantPlan,
      cantReal:       r.cantReal,
      costoUnitPlan:  r.costoUnitPlan,
      costoUnitReal:  r.costoUnitReal,
      active:         1,
    };
  }

  private showMsg(msg: string, type: 'success' | 'error'): void {
    this.saveMsg     = msg;
    this.saveMsgType = type;
    setTimeout(() => { this.saveMsg = ''; }, 4000);
  }

  // ── Import Excel ─────────────────────────────────────────────────────────────

  openImportPanel(): void {
    this.showImportPanel = true;
    this.importPreview   = [];
    this.importDone      = false;
  }

  closeImportPanel(): void {
    this.showImportPanel = false;
    this.importPreview   = [];
    this.importDone      = false;
  }

  /** Genera y descarga la plantilla Excel con instrucciones + WBS disponibles */
  downloadTemplate(): void {
    const wb = XLSX.utils.book_new();

    // ── Hoja 1: Plantilla de datos ──────────────────────────────────────────
    const header = ['WBS', 'Tipo', 'Descripcion', 'Unidad', 'Periodo',
                    'Cant.Plan', 'C.Unit.Plan', 'Cant.Real', 'C.Unit.Real'];
    const examples = [
      ['1.1', 'MO', 'Soldador',              'día', 'Sem 1',  5, 850,  0, 0],
      ['1.1', 'EQ', 'Soldadora Lincoln 225', 'día', 'Sem 1',  5, 300,  0, 0],
      ['1.1', 'MA', 'Electrodo 6011 3/32"',  'kg',  '',      20,  45,  0, 0],
      ['1.2', 'MO', 'Tubero',                'día', '',       3, 900,  0, 0],
      ['1.2', 'EQ', 'Dobladora manual 2"',   'día', '',       1, 150,  0, 0],
      ['1.2', 'MA', 'Tubo negro 2" cal.18',  'pza', '',      10, 380,  0, 0],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet([header, ...examples]);
    ws1['!cols'] = [
      { wch: 10 }, { wch: 14 }, { wch: 36 }, { wch: 10 }, { wch: 12 },
      { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'Recursos');

    // ── Hoja 2: WBS disponibles (actividades cargadas) ──────────────────────
    const wbsRows: any[][] = [['WBS', 'ID Actividad', 'Descripción']];
    (this.activities ?? []).forEach(a => {
      wbsRows.push([
        a.raw?.activity ?? '',
        a.id ?? '',
        (a.raw?.text ?? a.raw?.description ?? a.label ?? '').substring(0, 80),
      ]);
    });
    const ws2 = XLSX.utils.aoa_to_sheet(wbsRows);
    ws2['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 70 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'WBS Disponibles');

    // ── Hoja 3: Instrucciones ───────────────────────────────────────────────
    const instrRows = [
      ['INSTRUCCIONES PARA IMPORTAR RECURSOS PMO'],
      [''],
      ['Columna', 'Descripción', 'Valores aceptados'],
      ['WBS',         'Clave de la actividad — debe coincidir con la lista en "WBS Disponibles"', 'Ej: 1.1 · 2.3.1'],
      ['Tipo',        'Tipo de recurso (acepta códigos Opus o nombre completo)',
                      'MO / M.O. / Personal · EQ / Equipo · MA / MAT / Material · Subcontrato · Indirecto'],
      ['Descripcion', 'Nombre del recurso o puesto',           'Texto libre. Ej: Soldador, Excavadora CAT 320'],
      ['Unidad',      'Unidad de medida',                      'día · hr · kg · pza · m3 · ton…'],
      ['Periodo',     'Período de trabajo (opcional)',         'Ej: Sem 1, Ene-2026'],
      ['Cant.Plan',   'Cantidad planeada',                     'Número decimal'],
      ['C.Unit.Plan', 'Costo unitario planeado',               'Número decimal'],
      ['Cant.Real',   'Cantidad real ejecutada (puede ser 0)', 'Número decimal'],
      ['C.Unit.Real', 'Costo unitario real (puede ser 0)',     'Número decimal'],
      [''],
      ['NOTAS:'],
      ['• Las columnas Cant.Real y C.Unit.Real pueden omitirse o dejarse en 0.'],
      ['• Puedes tener múltiples filas con el mismo WBS (un recurso por fila).'],
      ['• Si el WBS no coincide con ninguna actividad, esa fila se ignora al importar.'],
      ['• El archivo puede ser exportado directamente desde Opus o Primavera.'],
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(instrRows);
    ws3['!cols'] = [{ wch: 14 }, { wch: 65 }, { wch: 55 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Instrucciones');

    XLSX.writeFile(wb, 'PMO_Recursos_Plantilla.xlsx');
  }

  /** Dispara el input de archivo oculto */
  triggerFileInput(): void {
    this.fileInputRef?.nativeElement.click();
  }

  /** Evento al seleccionar archivo */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      this.parseExcel(e.target?.result as ArrayBuffer);
    };
    reader.readAsArrayBuffer(file);
    input.value = '';  // reset para poder re-seleccionar el mismo archivo
  }

  /** Parsea el Excel y construye el preview */
  parseExcel(data: ArrayBuffer): void {
    try {
      const wb   = XLSX.read(data, { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (rows.length < 2) {
        this.showMsg('El archivo está vacío o sin datos', 'error'); return;
      }

      // Índices de columnas (flexible, acepta distintos nombres)
      const hdr = rows[0].map((h: any) => String(h).trim().toLowerCase());
      const col = (...names: string[]) => {
        for (const n of names) {
          const i = hdr.findIndex((h: string) => h.replace(/[\s.]/g, '').includes(n.replace(/[\s.]/g, '')));
          if (i >= 0) return i;
        }
        return -1;
      };

      const iWbs  = col('wbs', 'clave', 'partida', 'concepto');
      const iTipo = col('tipo', 'type');
      const iDesc = col('descripcion', 'descripción', 'recurso', 'nombre', 'concepto');
      const iUni  = col('unidad', 'unit');
      const iPer  = col('periodo', 'período', 'period');
      const iCP   = col('cantplan', 'cant.plan', 'cantidadplan', 'cantidad plan');
      const iUP   = col('cunitplan', 'c.unit.plan', 'costounit', 'precio unit', 'costo unit plan');
      const iCR   = col('cantreal', 'cant.real', 'cantidadreal', 'cantidad real');
      const iUR   = col('cunitreal', 'c.unit.real', 'costo unit real');

      if (iWbs < 0 || iTipo < 0) {
        this.showMsg('No se encontraron columnas WBS y Tipo. Usa la plantilla descargable.', 'error'); return;
      }

      // Mapa WBS → actividad
      const wbsMap = new Map<string, { id: number; label: string }>();
      (this.activities ?? []).forEach(a => {
        const key = String(a.raw?.activity ?? '').trim().toLowerCase();
        if (key) wbsMap.set(key, { id: a.id, label: a.label });
      });

      this.importPreview   = [];
      this.importDone      = false;

      for (let i = 1; i < rows.length; i++) {
        const r      = rows[i];
        const wbsRaw = String(r[iWbs] ?? '').trim();
        if (!wbsRaw) continue;

        const tipoRaw  = String(r[iTipo] ?? '').trim();
        const tipo     = (this.TIPO_MAP[tipoRaw.toLowerCase()] ?? tipoRaw) || 'Personal';
        const actFound = wbsMap.get(wbsRaw.toLowerCase());

        const cantPlan      = Math.abs(Number(iCP >= 0 ? r[iCP] : 0) || 0);
        const costoUnitPlan = Math.abs(Number(iUP >= 0 ? r[iUP] : 0) || 0);
        const cantReal      = Math.abs(Number(iCR >= 0 ? r[iCR] : 0) || 0);
        const costoUnitReal = Math.abs(Number(iUR >= 0 ? r[iUR] : 0) || 0);

        this.importPreview.push({
          rowNum:         i,
          wbs:            wbsRaw,
          actividadLabel: actFound?.label ?? '',
          idActivity:     actFound?.id ?? null,
          tipo,
          descripcion:    iDesc >= 0 ? String(r[iDesc] ?? '').trim() : '',
          unidad:         iUni  >= 0 ? String(r[iUni]  ?? '').trim() || 'día' : 'día',
          periodo:        iPer  >= 0 ? String(r[iPer]  ?? '').trim() : '',
          cantPlan, costoUnitPlan, cantReal, costoUnitReal,
          costoPlan:      cantPlan * costoUnitPlan,
          costoReal:      cantReal * costoUnitReal,
          status:         actFound ? 'ok' : 'warn',
          msg:            actFound ? '✓ Actividad encontrada' : '⚠ WBS no encontrado',
        });
      }

      if (!this.importPreview.length)
        this.showMsg('No se encontraron filas de datos en el archivo', 'error');

    } catch (e) {
      console.error('Error parseando Excel', e);
      this.showMsg('Error al leer el archivo. Verifica que sea .xlsx válido', 'error');
    }
  }

  /** Importa todas las filas válidas en batch */
  async executeImport(): Promise<void> {
    const valid = this.importPreview.filter(r => r.status === 'ok' && r.idActivity);
    if (!valid.length) return;

    this.isImporting = true;
    try {
      const payload = valid.map(r => ({
        id:            0,
        idProject:     this.selectedProject?.id ?? 0,
        idCompany:     this.idCompany,
        idActivity:    r.idActivity,
        tipo:          r.tipo,
        descripcion:   r.descripcion || 'SIN DESCRIPCION',
        unidad:        r.unidad || 'día',
        periodo:       r.periodo,
        cantPlan:      r.cantPlan,
        cantReal:      r.cantReal,
        costoUnitPlan: r.costoUnitPlan,
        costoUnitReal: r.costoUnitReal,
        active:        1,
      }));

      await lastValueFrom(this._projectsService.savePmoRecursosBatch(payload));
      this.importDone = true;
      this.showMsg(`✓ ${valid.length} recursos importados correctamente`, 'success');
      // Recargar grid si hay actividad seleccionada
      if (this.selectedActivity) await this.loadRecursos();
    } catch (e) {
      this.showMsg('Error al importar — revisa la consola', 'error');
      console.error(e);
    } finally {
      this.isImporting = false;
    }
  }
}
