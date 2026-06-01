import {
  Component, inject, OnInit, effect,
  ElementRef, ViewChild, HostListener
} from '@angular/core';
import { CommonModule }        from '@angular/common';
import { FormsModule }         from '@angular/forms';
import { AgGridModule }        from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, GridOptions } from 'ag-grid-enterprise';
import { lastValueFrom }       from 'rxjs';
import * as XLSX               from 'xlsx';
import { ProjectsService }     from 'app/services/projects.service';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { ConventionsService }  from 'app/services/conventions.service';
import { PosicionesService }   from 'app/services/posiciones.service';
import { EquipmentService }    from 'app/services/equipment.service';
import { MaterialsService }    from 'app/services/materials.service';
import { SignalsService }      from 'app/services/signals.service';

// ── Layout constants ──────────────────────────────────────────────────────────
const ROW_H      = 44;
const HEADER_H   = 52;
const LABEL_W    = 330;
const MIN_DAY_PX = 4;

// ── Interfaces ────────────────────────────────────────────────────────────────
interface ActividadRow {
  id:            number;
  idProject:     number;
  idConvention:  number | null;
  idContract:    number;          // necesario para PUT completo
  idTask:        number;          // necesario para PUT completo
  activity:      string;
  description:   string;
  unit:          string;
  quantity:      number | null;
  costMX:        number | null;
  startDate:     string;
  endDate:       string;
  predecessor:   string;
  criticalRoute: string;
  typeActivity:  string;
  parent:        number;
  sortorder:     number;
  active:        number;
  progress:      number;
  ponderado?:    number | null;
  __isNew?:      boolean;
  __modified?:   boolean;
}

interface RecursoRow {
  id:            number;
  idActivity:    number;
  tipo:          string;
  descripcion:   string;
  unidad:        string;
  periodo:       string;
  cantPlan:      number;
  cantReal:      number;
  costoUnitPlan: number;
  costoUnitReal: number;
  costoPlan:     number;
  costoReal:     number;
  variacion:     number;
  __isNew?:      boolean;
  __toDelete?:   boolean;
}

interface GanttTask {
  id:            number;
  rowRef:        ActividadRow;
  label:         string;
  wbs:           string;
  level:         number;
  startDate:     Date;
  endDate:       Date;
  durationDays:  number;
  progress:      number;
  predecessorId: number;
  isCritical:    boolean;
  isMilestone:   boolean;
  isSummary:     boolean;
  status:        string;
  slack:         number;
  row:           number;
  x:             number;
  y:             number;
  barW:          number;
  progressW:     number;
  fill:          string;
  fillProgress:  string;
}

interface Link {
  id:         number;
  srcTask:    GanttTask;
  tgtTask:    GanttTask;
  isCritical: boolean;
  path:       string;
}

interface MonthLabel {
  label: string;
  x:     number;
  width: number;
}

// ── Component ─────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-pmo-actividades',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './pmo-actividades.component.html',
  styles: [`
    .gantt-wrapper {
      overflow-x: auto; overflow-y: auto;
      max-height: calc(100vh - 340px); min-height: 260px;
      border: 1px solid #dee2e6; border-radius: 8px;
      background: #fff; position: relative;
    }
    .gantt-svg { display: block; }

    /* ── Edit slide panel ── */
    .edit-panel {
      position: fixed; top: 0; right: -460px; width: 440px; height: 100vh;
      background: #fff; box-shadow: -6px 0 30px rgba(0,0,0,.22);
      z-index: 1055; transition: right .28s cubic-bezier(.4,0,.2,1);
      overflow-y: auto; border-left: 5px solid #2980b9;
    }
    .edit-panel.open { right: 0; }
    .edit-panel-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,.18);
      z-index: 1054; display: none;
    }
    .edit-panel-backdrop.open { display: block; }

    /* ── Tabs in panel ── */
    .panel-tabs { display:flex; border-bottom: 2px solid #e9ecef; margin-bottom:12px; }
    .panel-tab  {
      flex:1; padding: 8px 4px; text-align:center; cursor:pointer; font-size:12px;
      font-weight:600; color:#6c757d; border-bottom: 3px solid transparent;
      margin-bottom:-2px; transition: all .15s;
    }
    .panel-tab.active    { color:#2980b9; border-bottom-color:#2980b9; }
    .panel-tab:hover:not(.active) { color:#495057; background:#f8f9fa; }

    /* ── Recurso cards ── */
    .recurso-card {
      border: 1px solid #e9ecef; border-radius: 6px; padding: 8px 10px;
      margin-bottom: 6px; background: #fff; font-size:12px;
    }
    .recurso-card.personal { border-left: 3px solid #2980b9; }
    .recurso-card.material { border-left: 3px solid #27ae60; }
    .recurso-card.equipo   { border-left: 3px solid #f39c12; }
    .recurso-card.otro     { border-left: 3px solid #95a5a6; }
    .recurso-card.to-delete { opacity:.4; text-decoration:line-through; }

    /* ── View toggle ── */
    .view-toggle .btn:first-child { border-radius: 6px 0 0 6px; }
    .view-toggle .btn:last-child  { border-radius: 0 6px 6px 0; }

    /* ── KPI chips ── */
    .kpi-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 16px; border-radius: 20px;
      font-size: 13px; font-weight: 700;
    }

    /* ── Bar hover ── */
    .bar-group { cursor: pointer; }
    .bar-group:hover .bar-border { stroke-width: 2.5 !important; }
    .bar-group:hover rect { filter: brightness(1.1); }
  `]
})
export class PmoActividadesComponent implements OnInit {

  @ViewChild('ganttWrapper')   wrapperRef!:   ElementRef<HTMLDivElement>;
  @ViewChild('xlsImportInput') xlsImportRef!: ElementRef<HTMLInputElement>;

  private _projectsService = inject(ProjectsService);
  private _wpService       = inject(WorkprogramsService);
  private _convService     = inject(ConventionsService);
  private _posService      = inject(PosicionesService);
  private _eqService       = inject(EquipmentService);
  private _matService      = inject(MaterialsService);
  private _signalsService  = inject(SignalsService);

  idCompany = 0;
  projects: any[]  = [];
  selectedProject: any = null;

  conventions:        any[] = [];
  selectedConvention: any   = null;
  isLoadingConv             = false;

  readonly SIN_CONVENIO = { id: -1, name: '⚪ Sin convenio', type: '' };
  targetConvention: any = null;
  isReassigning         = false;

  isLoading         = false;
  isSaving          = false;
  hasUnsavedChanges = false;
  saveMsg           = '';

  // ── Calcular Ponderado ─────────────────────────────────────────────────────
  showPondModal  = false;
  pondModalidad: 'precio' | 'tiempo' | 'volumen' = 'tiempo';
  isCalculating  = false;
  calcProgress   = 0;
  saveMsgType       = '';

  // ── Catálogos para recursos ────────────────────────────────────────────────
  personalCatalog: string[] = [];
  equipoCatalog:   string[] = [];
  materialCatalog: string[] = [];

  // ── View mode ──────────────────────────────────────────────────────────────
  viewMode: 'gantt' | 'tabla' | 'comparacion' = 'tabla';

  // ── Comparación ────────────────────────────────────────────────────────────
  originalConvention: any  = null;
  otherConventions:   any[] = [];
  compLeftData:       any[] = [];
  compRightData:      any[] = [];
  compSelectedRow:    any   = null;
  compLeftGridApi!:   GridApi;
  compRightGridApi!:  GridApi;
  isLoadingComp       = false;
  isLoadingRight      = false;

  // GridOptions definidas como propiedades fijas (no inline en HTML)
  readonly compLeftGridOpts: GridOptions = {
    rowHeight: 28, headerHeight: 30, animateRows: false,
    rowSelection: 'single' as any,
    suppressCellFocus: false,
    defaultColDef: { sortable: true, resizable: true, filter: true, cellStyle: { fontSize: '11px' } },
  };

  readonly compRightGridOpts: GridOptions = {
    rowHeight: 28, headerHeight: 30, animateRows: false,
    defaultColDef: { resizable: true, cellStyle: { fontSize: '11px' } },
  };

  // ColDefs izquierda — fijas, se crean una sola vez
  readonly compLeftCols: ColDef[] = [
    { field: 'activity',    headerName: 'EDT',        width: 80,  pinned: 'left' },
    { field: 'description', headerName: 'Descripción', flex: 2,   tooltipField: 'description' },
    { field: 'unit',        headerName: 'Unidad',     width: 80  },
    { field: 'quantity',    headerName: 'Cantidad',   width: 90,  type: 'numericColumn',
      valueFormatter: (p: any) => p.value != null ? Number(p.value).toLocaleString('es-MX') : '' },
    { field: 'costMX',      headerName: 'Costo MX',   width: 110, type: 'numericColumn',
      valueFormatter: (p: any) => p.value != null ? Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '' },
    { field: 'costDLL',     headerName: 'Costo USD',  width: 110, type: 'numericColumn',
      valueFormatter: (p: any) => p.value != null ? Number(p.value).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '' },
    { field: 'startDate',   headerName: 'Inicio',     width: 120,
      valueFormatter: (p: any) => p.value ? String(p.value).split('T')[0] : '' },
    { field: 'endDate',     headerName: 'Fin',        width: 120,
      valueFormatter: (p: any) => p.value ? String(p.value).split('T')[0] : '' },
    { field: 'ponderado',   headerName: 'Pond. %',    width: 90,  type: 'numericColumn',
      valueFormatter: (p: any) => p.value != null ? Number(p.value).toFixed(2) + '%' : '' },
  ];

  // ColDefs derecha — las cellStyle usan this.compSelectedRow dinámicamente
  readonly compRightCols: ColDef[] = [
    { field: 'convName',    headerName: 'Versión', width: 130, pinned: 'left',
      cellStyle: (p: any) => p.data?.exists === false ? { background: '#f8d7da', fontWeight: '600' } : { fontWeight: '600' } },
    { field: 'description', headerName: 'Descripción', flex: 2,
      cellStyle: (p: any) => !p.data?.exists ? { background: '#f8d7da' } :
        this.compDiffStyle(p.value, this.compSelectedRow?.description, 'text') },
    { field: 'unit',        headerName: 'Unidad', width: 80,
      cellStyle: (p: any) => !p.data?.exists ? { background: '#f8d7da' } :
        this.compDiffStyle(p.value, this.compSelectedRow?.unit, 'text') },
    { field: 'quantity',    headerName: 'Cantidad', width: 90, type: 'numericColumn',
      valueFormatter: (p: any) => !p.data?.exists ? 'No existe' : (p.value != null ? Number(p.value).toLocaleString('es-MX') : '—'),
      cellStyle: (p: any) => !p.data?.exists ? { background: '#f8d7da', color: '#721c24' } :
        this.compDiffStyle(p.value, this.compSelectedRow?.quantity, 'number') },
    { field: 'costMX',      headerName: 'Costo MX', width: 110, type: 'numericColumn',
      valueFormatter: (p: any) => !p.data?.exists ? '—' : (p.value != null ? Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '—'),
      cellStyle: (p: any) => !p.data?.exists ? { background: '#f8d7da' } :
        this.compDiffStyle(p.value, this.compSelectedRow?.costMX, 'number') },
    { field: 'costDLL',     headerName: 'Costo USD', width: 110, type: 'numericColumn',
      valueFormatter: (p: any) => !p.data?.exists ? '—' : (p.value != null ? Number(p.value).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'),
      cellStyle: (p: any) => !p.data?.exists ? { background: '#f8d7da' } :
        this.compDiffStyle(p.value, this.compSelectedRow?.costDLL, 'number') },
    { field: 'startDate',   headerName: 'Inicio', width: 120,
      valueFormatter: (p: any) => !p.data?.exists ? '—' : (p.value ? String(p.value).split('T')[0] : '—'),
      cellStyle: (p: any) => !p.data?.exists ? { background: '#f8d7da', fontSize: '11px' } :
        { ...this.compDiffStyle(p.value, this.compSelectedRow?.startDate ? String(this.compSelectedRow.startDate).split('T')[0] : null, 'date'), fontSize: '11px' } },
    { field: 'endDate',     headerName: 'Fin', width: 120,
      valueFormatter: (p: any) => !p.data?.exists ? '—' : (p.value ? String(p.value).split('T')[0] : '—'),
      cellStyle: (p: any) => !p.data?.exists ? { background: '#f8d7da', fontSize: '11px' } :
        { ...this.compDiffStyle(p.value, this.compSelectedRow?.endDate ? String(this.compSelectedRow.endDate).split('T')[0] : null, 'date'), fontSize: '11px' } },
    { field: 'ponderado',   headerName: 'Pond. %', width: 90, type: 'numericColumn',
      valueFormatter: (p: any) => !p.data?.exists ? '—' : (p.value != null ? Number(p.value).toFixed(2) + '%' : '—'),
      cellStyle: (p: any) => !p.data?.exists ? { background: '#f8d7da' } :
        this.compDiffStyle(p.value, this.compSelectedRow?.ponderado, 'number') },
  ];
  zoomLevel: 'month' | 'week' = 'month';
  showOnlyCritical = false;

  // ── Gantt SVG data ─────────────────────────────────────────────────────────
  tasks:  GanttTask[]  = [];
  links:  Link[]       = [];
  months: MonthLabel[] = [];
  svgW    = 0;
  svgH    = 0;
  todayX  = 0;
  private chartStart!: Date;
  private chartEnd!:   Date;
  private totalDays  = 0;
  private dayPx      = 6;

  // ── KPIs ───────────────────────────────────────────────────────────────────
  get totalCritical()   { return this.tasks.filter(t => t.isCritical).length; }
  get totalMilestones() { return this.tasks.filter(t => t.isMilestone).length; }
  get totalDelayed()    { return this.tasks.filter(t => t.status === 'Atrasada').length; }
  get totalDone()       { return this.tasks.filter(t => t.status === 'Terminada').length; }
  get avgProgress(): number {
    if (!this.tasks.length) return 0;
    return Math.round(this.tasks.reduce((s, t) => s + t.progress, 0) / this.tasks.length * 100);
  }

  // ── Edit slide panel ───────────────────────────────────────────────────────
  editPanelOpen  = false;
  editingRow:    ActividadRow | null = null;
  editDraft:     Partial<ActividadRow> = {};
  activeTab:     'datos' | 'recursos' = 'datos';

  // ── Recursos en el panel ───────────────────────────────────────────────────
  recursos:          RecursoRow[] = [];
  recursosLoading    = false;
  recursosSaving     = false;
  recursosHasChanges = false;
  newRecurso:        Partial<RecursoRow> | null = null;
  newRecursoDesc:    string = '';   // descripción del nuevo recurso

  get totalRecursosPlan() { return this.recursos.filter(r => !r.__toDelete).reduce((s, r) => s + (r.costoPlan ?? 0), 0); }
  get totalRecursosReal() { return this.recursos.filter(r => !r.__toDelete).reduce((s, r) => s + (r.costoReal ?? 0), 0); }
  get totalRecursosVar()  { return this.totalRecursosReal - this.totalRecursosPlan; }
  get recursosVisibles()  { return this.recursos.filter(r => !r.__toDelete); }

  // ── Table / AG Grid ────────────────────────────────────────────────────────
  gridApi!: GridApi;
  rowData: ActividadRow[] = [];
  private originalRowData: ActividadRow[] = [];
  private editableColumnOrder = ['activity','description','unit','quantity','costMX','startDate','endDate','predecessor','criticalRoute'];
  private enterPressed = false;

  colDefs: ColDef[] = [
    { field: 'activity',    headerName: 'WBS / Partida',   width: 110, editable: true },
    { field: 'description', headerName: 'Descripción',     width: 240, editable: true },
    { field: 'unit',        headerName: 'Unidad',          width: 80,  editable: true },
    {
      field: 'quantity', headerName: 'Cantidad', width: 90, editable: true, type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(2) : '',
      onCellValueChanged: (p) => this.markModified(p.data),
    },
    {
      field: 'costMX', headerName: 'P.U. MXN', width: 110, editable: true, type: 'numericColumn',
      valueFormatter: (p) => p.value != null
        ? Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '',
      onCellValueChanged: (p) => this.markModified(p.data),
    },
    {
      field: 'ponderado', headerName: 'Ponderado', width: 95, editable: false, type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(3) : '',
    },
    {
      field: 'startDate', headerName: 'Inicio', width: 115, editable: true,
      cellEditor: 'agDateCellEditor',
      valueGetter: (p) => p.data?.startDate ? String(p.data.startDate).substring(0, 10) : '',
      valueSetter: (p) => {
        const v = p.newValue;
        p.data.startDate = v instanceof Date
          ? `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`
          : (v ? String(v).substring(0, 10) : '');
        return true;
      },
      valueFormatter: (p) => {
        if (!p.value) return '';
        const [y, m, d] = String(p.value).split('-');
        return d && m && y ? `${d}/${m}/${y}` : p.value;
      },
      onCellValueChanged: (p) => this.markModified(p.data),
    },
    {
      field: 'endDate', headerName: 'Término', width: 115, editable: true,
      cellEditor: 'agDateCellEditor',
      valueGetter: (p) => p.data?.endDate ? String(p.data.endDate).substring(0, 10) : '',
      valueSetter: (p) => {
        const v = p.newValue;
        p.data.endDate = v instanceof Date
          ? `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`
          : (v ? String(v).substring(0, 10) : '');
        return true;
      },
      valueFormatter: (p) => {
        if (!p.value) return '';
        const [y, m, d] = String(p.value).split('-');
        return d && m && y ? `${d}/${m}/${y}` : p.value;
      },
      onCellValueChanged: (p) => this.markModified(p.data),
    },
    {
      field: 'progress', headerName: '% Avance', width: 90, editable: true, type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? `${(Number(p.value) * 100).toFixed(0)}%` : '0%',
      onCellValueChanged: (p) => this.markModified(p.data),
    },
    { field: 'predecessor', headerName: 'Pred.', width: 80, editable: true },
    {
      field: 'criticalRoute', headerName: 'R.C.', width: 70, editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: ['Si', 'No'] },
      cellStyle: (p) => p.value === 'Si' ? { color: '#c0392b', fontWeight: 'bold' } : {},
    },
    {
      field: 'typeActivity', headerName: 'Tipo', width: 100, editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: ['Activity', 'Milestone', 'Summary'] },
      cellStyle: (p) => p.value === 'Milestone'
        ? { color: '#8e44ad', fontWeight: 'bold' }
        : p.value === 'Summary' ? { color: '#2980b9', fontWeight: 'bold' } : {},
    },
  ];

  gridOptions: GridOptions = {
    defaultColDef: {
      sortable: true, resizable: true, minWidth: 60,
      suppressKeyboardEvent: (params) => {
        if (params.event.key === 'Enter' && params.editing) {
          this.enterPressed = true;
          setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
          return true;
        }
        return false;
      },
    },
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    rowSelection: 'single',
    animateRows: true,
    overlayLoadingTemplate: "<span class='ag-overlay-loading-center'>Cargando actividades…</span>",
    overlayNoRowsTemplate:  "<span class='text-muted small'>Sin actividades. Usa <b>+ Agregar</b> o importa desde Excel.</span>",
  };

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
    if (this.idCompany) { this.loadProjects(); this.loadCatalogs(); }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.viewMode === 'gantt' && this.rowData.length) this.buildGanttData(this.rowData);
  }

  // ── Catálogos ──────────────────────────────────────────────────────────────
  async loadCatalogs(): Promise<void> {
    if (!this.idCompany) return;
    try {
      const pos: any[] = await lastValueFrom(this._posService.getPositionsByCompany(this.idCompany));
      this.personalCatalog = (pos ?? []).filter((p: any) => p.active !== false)
        .map((p: any) => p.description ?? p.name ?? '').filter(Boolean).sort();
    } catch { this.personalCatalog = []; }
    try {
      const eq: any[] = await lastValueFrom(this._eqService.getEquipment(this.idCompany));
      this.equipoCatalog = (eq ?? []).map((e: any) => e.description ?? e.name ?? '').filter(Boolean).sort();
    } catch { this.equipoCatalog = []; }
    try {
      const mat: any[] = await lastValueFrom(this._matService.getMaterials(this.idCompany, 'MATERIAL'));
      this.materialCatalog = (mat ?? []).map((m: any) => m.insumo ?? m.articulo ?? m.description ?? '').filter(Boolean).sort();
    } catch { this.materialCatalog = []; }
  }

  catalogForTipo(tipo: string): string[] {
    const t = (tipo ?? '').toLowerCase();
    if (t === 'personal') return ['SIN DESCRIPCION', ...this.personalCatalog];
    if (t === 'equipo')   return ['SIN DESCRIPCION', ...this.equipoCatalog];
    if (t === 'material') return ['SIN DESCRIPCION', ...this.materialCatalog];
    return [];
  }

  tipoColor(tipo: string): string {
    const t = (tipo ?? '').toLowerCase();
    if (t === 'personal')    return '#2980b9';
    if (t === 'material')    return '#27ae60';
    if (t === 'equipo')      return '#f39c12';
    if (t === 'subcontrato') return '#8e44ad';
    return '#95a5a6';
  }

  tipoCardClass(tipo: string): string {
    const t = (tipo ?? '').toLowerCase();
    if (t === 'personal') return 'personal';
    if (t === 'material') return 'material';
    if (t === 'equipo')   return 'equipo';
    return 'otro';
  }

  // ── Recursos: cargar / nuevo / guardar / borrar ───────────────────────────
  async loadRecursosForActivity(idActivity: number): Promise<void> {
    if (!idActivity || !this.selectedProject) return;
    this.recursosLoading = true;
    this.recursos        = [];
    this.newRecurso      = null;
    try {
      const res: any = await lastValueFrom(
        this._projectsService.getPmoRecursosByProject(this.selectedProject.id)
      );
      const raw = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      this.recursos = raw
        .filter((r: any) => (r.idActivity ?? r.id_activity) === idActivity)
        .map((r: any) => this.mapRecursoFromApi(r));
      this.recursosHasChanges = false;
    } catch (e) {
      console.error('Error cargando recursos', e);
      this.recursos = [];
    } finally { this.recursosLoading = false; }
  }

  startNewRecurso(): void {
    if (!this.editingRow) return;
    this.newRecurso = {
      id: 0,
      idActivity:    this.editingRow.id,
      tipo:          'Personal',
      descripcion:   '',
      unidad:        'día',
      periodo:       '',
      cantPlan:      0,
      cantReal:      0,
      costoUnitPlan: 0,
      costoUnitReal: 0,
      costoPlan:     0,
      costoReal:     0,
      variacion:     0,
      __isNew:       true,
    };
    this.newRecursoDesc = '';
  }

  onNewRecursoTipoChange(): void {
    // Reset descripcion when tipo changes
    this.newRecursoDesc = '';
    if (this.newRecurso) this.newRecurso.descripcion = '';
  }

  onNewRecursoDescSelect(val: string): void {
    if (this.newRecurso) this.newRecurso.descripcion = val;
    this.newRecursoDesc = val;
  }

  calcNewRecursoCostos(): void {
    if (!this.newRecurso) return;
    this.newRecurso.costoPlan = (this.newRecurso.cantPlan ?? 0) * (this.newRecurso.costoUnitPlan ?? 0);
    this.newRecurso.costoReal = (this.newRecurso.cantReal ?? 0) * (this.newRecurso.costoUnitReal ?? 0);
    this.newRecurso.variacion = (this.newRecurso.costoReal ?? 0) - (this.newRecurso.costoPlan ?? 0);
  }

  confirmAddRecurso(): void {
    if (!this.newRecurso || !this.editingRow) return;
    if (!this.newRecurso.tipo) { return; }
    const desc = this.newRecursoDesc || this.newRecurso.descripcion || 'SIN DESCRIPCION';
    this.calcNewRecursoCostos();
    this.recursos.push({
      id:            0,
      idActivity:    this.editingRow.id,
      tipo:          this.newRecurso.tipo!,
      descripcion:   desc,
      unidad:        this.newRecurso.unidad || 'día',
      periodo:       this.newRecurso.periodo || '',
      cantPlan:      this.newRecurso.cantPlan ?? 0,
      cantReal:      this.newRecurso.cantReal ?? 0,
      costoUnitPlan: this.newRecurso.costoUnitPlan ?? 0,
      costoUnitReal: this.newRecurso.costoUnitReal ?? 0,
      costoPlan:     this.newRecurso.costoPlan ?? 0,
      costoReal:     this.newRecurso.costoReal ?? 0,
      variacion:     this.newRecurso.variacion ?? 0,
      __isNew:       true,
    });
    this.newRecurso     = null;
    this.newRecursoDesc = '';
    this.recursosHasChanges = true;
  }

  cancelNewRecurso(): void { this.newRecurso = null; this.newRecursoDesc = ''; }

  markRecursoToDelete(r: RecursoRow): void {
    if (r.__isNew) {
      this.recursos = this.recursos.filter(x => x !== r);
    } else {
      r.__toDelete = true;
    }
    this.recursosHasChanges = true;
  }

  async saveRecursos(): Promise<void> {
    if (!this.selectedProject || !this.editingRow) return;
    this.recursosSaving = true;
    try {
      // Eliminar los marcados
      const toDelete = this.recursos.filter(r => r.__toDelete && r.id > 0);
      for (const r of toDelete) {
        await lastValueFrom(this._projectsService.deletePmoRecurso(r.id));
      }
      // Guardar nuevos / modificados
      const toSave = this.recursos.filter(r => !r.__toDelete && r.__isNew);
      if (toSave.length) {
        const payload = toSave.map(r => ({
          id:           r.id,
          idProject:    this.selectedProject.id,
          idCompany:    this.idCompany,
          idActivity:   r.idActivity || this.editingRow!.id,
          tipo:         r.tipo,
          descripcion:  r.descripcion,
          unidad:       r.unidad,
          periodo:      r.periodo,
          cantPlan:     r.cantPlan,
          cantReal:     r.cantReal,
          costoUnitPlan: r.costoUnitPlan,
          costoUnitReal: r.costoUnitReal,
          active:       1,
        }));
        await lastValueFrom(this._projectsService.savePmoRecursosBatch(payload));
      }
      // Recargar
      await this.loadRecursosForActivity(this.editingRow.id);
      this.recursosHasChanges = false;
      this.showMsg('✓ Recursos guardados', 'success');
    } catch (e) {
      this.showMsg('Error al guardar recursos', 'error');
      console.error(e);
    } finally { this.recursosSaving = false; }
  }

  private mapRecursoFromApi(r: any): RecursoRow {
    const cantPlan      = Number(r.cantPlan ?? r.cant_plan ?? 0);
    const cantReal      = Number(r.cantReal ?? r.cant_real ?? 0);
    const costoUnitPlan = Number(r.costoUnitPlan ?? r.costo_unit_plan ?? 0);
    const costoUnitReal = Number(r.costoUnitReal ?? r.costo_unit_real ?? 0);
    return {
      id:           r.id ?? 0,
      idActivity:   r.idActivity ?? r.id_activity ?? 0,
      tipo:         r.tipo ?? 'Personal',
      descripcion:  r.descripcion ?? '',
      unidad:       r.unidad ?? 'día',
      periodo:      r.periodo ?? '',
      cantPlan, cantReal, costoUnitPlan, costoUnitReal,
      costoPlan:  cantPlan * costoUnitPlan,
      costoReal:  cantReal * costoUnitReal,
      variacion:  (cantReal * costoUnitReal) - (cantPlan * costoUnitPlan),
    };
  }

  // ── Project / Convention ───────────────────────────────────────────────────
  async loadProjects(): Promise<void> {
    try {
      const res: any = await lastValueFrom(this._projectsService.getProjectListByCompany(this.idCompany));
      this.projects = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    } catch { this.projects = []; }
  }

  async onProjectChange(): Promise<void> {
    this.selectedConvention = null;
    this.conventions        = [];
    this.rowData            = [];
    this.tasks              = [];
    this.links              = [];
    this.hasUnsavedChanges  = false;
    if (!this.selectedProject) return;
    await this.loadConventions();
  }

  async loadConventions(): Promise<void> {
    const idContrato = this.selectedProject?.idContrato ?? this.selectedProject?.id_contrato ?? 0;
    if (!idContrato) { await this.loadActividades(); return; }
    this.isLoadingConv = true;
    try {
      const res: any = await lastValueFrom(
        this._convService.getConventionsByContractOrProject('contract', idContrato)
      );
      const raw = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      this.conventions = raw.filter((c: any) => c.active !== false).sort((a: any, b: any) => a.id - b.id);
      const vigente = this.conventions.find((c: any) => c.vigente);
      if (vigente)                            { this.selectedConvention = vigente;            await this.loadActividades(); }
      else if (this.conventions.length === 1) { this.selectedConvention = this.conventions[0]; await this.loadActividades(); }
    } catch {
      this.conventions = [];
      await this.loadActividades();
    } finally { this.isLoadingConv = false; }
  }

  async onConventionChange(): Promise<void> {
    this.rowData = []; this.tasks = []; this.links = [];
    this.hasUnsavedChanges = false;
    this.setRowData([]);
    await this.loadActividades();
  }

  get isSinConvenio(): boolean { return this.selectedConvention === this.SIN_CONVENIO; }

  async loadActividades(): Promise<void> {
    if (!this.selectedProject) return;
    this.isLoading = true;
    if (this.gridApi && !this.gridApi.isDestroyed()) this.gridApi.showLoadingOverlay();
    try {
      const idProject = this.selectedProject.id ?? this.selectedProject.idProject;
      let raw: any[];
      if (this.isSinConvenio) {
        raw = await lastValueFrom(this._wpService.getWorkPrograms(idProject, 'Project'));
        raw = (raw ?? []).filter(r => (r.id_convention ?? r.idConvention ?? null) === null);
      } else if (this.selectedConvention) {
        raw = await lastValueFrom(this._wpService.getByConvention(this.selectedConvention.id, idProject));
      } else {
        raw = await lastValueFrom(this._wpService.getWorkPrograms(idProject, 'Project'));
      }
      // WBS mixto: agrupadores alfanuméricos (A, I, II…) deben aparecer ANTES de las actividades numéricas
      const numWbsRe   = /^[\d][\d.]*$/;
      const mappedRows = (raw ?? []).map(r => this.mapFromApi(r));
      const isMixedWbs = mappedRows.some(r => r.activity && !numWbsRe.test(r.activity))
                      && mappedRows.some(r => r.activity &&  numWbsRe.test(r.activity));
      this.rowData = mappedRows.sort((a, b) => {
        if (isMixedWbs) {
          const ga = numWbsRe.test(a.activity || '') ? 1 : 0; // 0=agrupador (primero), 1=numérico
          const gb = numWbsRe.test(b.activity || '') ? 1 : 0;
          if (ga !== gb) return ga - gb;
        }
        const d = a.sortorder - b.sortorder;
        return d !== 0 ? d : a.id - b.id; // desempate por id (orden de inserción)
      });
      this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
      this.hasUnsavedChanges = false;
      this.recalcParentPonderados(); // acumula sumas en memoria (no toca BD)
      this.setRowData(this.rowData);
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.rowData.length ? this.gridApi.hideOverlay() : this.gridApi.showNoRowsOverlay();
      if (this.viewMode === 'gantt') setTimeout(() => this.buildGanttData(this.rowData), 60);
    } catch (err) {
      console.error('Error cargando actividades PMO', err);
      this.rowData = []; this.setRowData([]);
    } finally { this.isLoading = false; }
  }

  // ── View / Zoom ─────────────────────────────────────────────────────────────
  setViewMode(mode: 'gantt' | 'tabla' | 'comparacion'): void {
    this.viewMode = mode;
    if (mode === 'comparacion') this.loadComparacion();
    if (mode === 'gantt' && this.rowData.length)
      setTimeout(() => this.buildGanttData(this.rowData), 60);
  }

  setZoom(z: 'month' | 'week'): void {
    this.zoomLevel = z;
    if (this.rowData.length) setTimeout(() => this.buildGanttData(this.rowData), 50);
  }

  toggleCritical(): void {
    if (this.rowData.length) setTimeout(() => this.buildGanttData(this.rowData), 50);
  }

  // ── Gantt build ─────────────────────────────────────────────────────────────
  buildGanttData(rows: ActividadRow[]): void {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    // Incluir registros con startDate aunque no tengan endDate (endDate = startDate + 1 día)
    const valid = rows.filter(r => r.startDate);
    if (!valid.length) { this.tasks = []; this.links = []; return; }

    const levelOf = (wbs: string): number => Math.max(0, wbs.split('.').length - 1);

    const all: GanttTask[] = valid.map((r, i) => {
      const sd = new Date(r.startDate); sd.setHours(0, 0, 0, 0);
      // Si no hay fecha fin, usar startDate + 1 día para mostrar barra mínima
      const edRaw = r.endDate ? new Date(r.endDate) : new Date(sd.getTime() + 86400000);
      const ed = edRaw; ed.setHours(0, 0, 0, 0);
      const dur  = Math.max(0, Math.ceil((ed.getTime() - sd.getTime()) / 86400000));
      const prog = Math.min(1, Math.max(0, r.progress ?? 0));
      const isMilestone = r.typeActivity === 'Milestone' || dur === 0;
      const isSummary   = r.typeActivity === 'Summary';
      const slack = ed >= today
        ? Math.ceil((ed.getTime() - today.getTime()) / 86400000)
        : -Math.ceil((today.getTime() - ed.getTime()) / 86400000);
      const isCritical = r.criticalRoute === 'Si' || (!isMilestone && !isSummary && slack <= 2 && prog < 1);
      const predId = Number(r.predecessor) || 0;

      let status = 'Sin iniciar';
      if (prog >= 1)                      status = 'Terminada';
      else if (today > ed)                status = 'Atrasada';
      else if (today >= sd && slack <= 5) status = 'En Riesgo';
      else if (prog > 0)                  status = 'En Tiempo';

      const fill         = isCritical ? '#e74c3c' : isMilestone ? '#8e44ad' : isSummary ? '#2c3e50' : '#2980b9';
      const fillProgress = isCritical ? '#c0392b' : '#1a5276';

      return {
        id: r.id || (-(i + 1)),
        rowRef: r,
        label: r.description || r.activity,
        wbs: r.activity,
        level: levelOf(r.activity),
        startDate: sd, endDate: ed,
        durationDays: dur, progress: prog,
        predecessorId: predId,
        isCritical, isMilestone, isSummary,
        status, slack,
        row: 0, x: 0, y: 0, barW: 0, progressW: 0,
        fill, fillProgress,
      };
    });

    const visible = this.showOnlyCritical ? all.filter(t => t.isCritical || t.isMilestone) : all;
    visible.forEach((t, i) => { t.row = i; t.y = HEADER_H + i * ROW_H; });

    const dates = visible.flatMap(t => [t.startDate, t.endDate]);
    let minD = new Date(Math.min(...dates.map(d => d.getTime())));
    let maxD = new Date(Math.max(...dates.map(d => d.getTime())));
    minD.setDate(minD.getDate() - 7);
    maxD.setDate(maxD.getDate() + 14);
    this.chartStart = minD;
    this.chartEnd   = maxD;
    this.totalDays  = Math.ceil((maxD.getTime() - minD.getTime()) / 86400000);

    const containerW = this.wrapperRef?.nativeElement?.clientWidth ?? 900;
    const availW     = Math.max(containerW - LABEL_W - 20, 400);
    this.dayPx = this.zoomLevel === 'week'
      ? Math.max(MIN_DAY_PX * 2, availW / this.totalDays)
      : Math.max(MIN_DAY_PX,     availW / this.totalDays);
    const chartW = Math.ceil(this.totalDays * this.dayPx);

    visible.forEach(t => {
      t.x         = this.xForDate(t.startDate);
      t.barW      = t.isMilestone ? 0 : Math.max(8, t.durationDays * this.dayPx);
      t.progressW = t.barW * t.progress;
    });

    this.todayX = this.xForDate(today);
    this.months = this.buildMonthLabels();

    const idMap = new Map<number, GanttTask>(visible.map(t => [t.id, t]));
    const lnks: Link[] = [];
    visible.forEach(t => {
      if (t.predecessorId > 0) {
        const src = idMap.get(t.predecessorId);
        if (src) lnks.push({
          id: Math.abs(src.id) * 100000 + Math.abs(t.id),
          srcTask: src, tgtTask: t,
          isCritical: src.isCritical && t.isCritical,
          path: this.buildArrowPath(src, t),
        });
      }
    });

    this.tasks = visible;
    this.links = lnks;
    this.svgW  = LABEL_W + chartW;
    this.svgH  = HEADER_H + visible.length * ROW_H + 10;
  }

  private xForDate(d: Date): number {
    return LABEL_W + Math.round(((d.getTime() - this.chartStart.getTime()) / 86400000) * this.dayPx);
  }

  private buildArrowPath(src: GanttTask, tgt: GanttTask): string {
    const x1 = src.isMilestone ? src.x + 11 : src.x + src.barW;
    const y1 = HEADER_H + src.row * ROW_H + ROW_H / 2;
    const x2 = tgt.x;
    const y2 = HEADER_H + tgt.row * ROW_H + ROW_H / 2;
    if (y1 === y2) return `M${x1},${y1} L${x2},${y2}`;
    const midX = x1 + Math.max(8, (x2 - x1) * 0.4);
    return `M${x1},${y1} L${midX},${y1} L${midX},${y2} L${x2},${y2}`;
  }

  private buildMonthLabels(): MonthLabel[] {
    const labels: MonthLabel[] = [];
    const cur = new Date(this.chartStart); cur.setDate(1);
    const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    while (cur <= this.chartEnd) {
      const next = new Date(cur); next.setMonth(next.getMonth() + 1);
      const x1 = this.xForDate(cur < this.chartStart ? this.chartStart : cur);
      const x2 = this.xForDate(next > this.chartEnd  ? this.chartEnd   : next);
      labels.push({ label: `${MONTHS_ES[cur.getMonth()]} ${cur.getFullYear()}`, x: x1, width: x2 - x1 });
      cur.setMonth(cur.getMonth() + 1);
    }
    return labels;
  }

  // ── Gantt helpers ──────────────────────────────────────────────────────────
  milestonePoints(t: GanttTask): string {
    const cx = t.x, cy = HEADER_H + t.row * ROW_H + ROW_H / 2, s = 11;
    return `${cx},${cy-s} ${cx+s},${cy} ${cx},${cy+s} ${cx-s},${cy}`;
  }

  statusBadgeColor(s: string): string {
    switch (s) {
      case 'Atrasada':  return '#e74c3c';
      case 'En Riesgo': return '#f39c12';
      case 'En Tiempo': return '#27ae60';
      case 'Terminada': return '#8e44ad';
      default:          return '#95a5a6';
    }
  }

  trackById(_: number, t: GanttTask) { return t.id; }
  trackByLink(_: number, l: Link)    { return l.id; }
  trackByIdx(i: number)              { return i; }

  // ── Edit panel ─────────────────────────────────────────────────────────────
  openEditPanel(t: GanttTask): void {
    this.editingRow = t.rowRef;
    this.editDraft  = {
      activity:      t.rowRef.activity,
      description:   t.rowRef.description,
      unit:          t.rowRef.unit,
      quantity:      t.rowRef.quantity,
      costMX:        t.rowRef.costMX,
      startDate:     t.rowRef.startDate ? String(t.rowRef.startDate).substring(0, 10) : '',
      endDate:       t.rowRef.endDate   ? String(t.rowRef.endDate).substring(0, 10)   : '',
      progress:      t.rowRef.progress ?? 0,
      predecessor:   t.rowRef.predecessor,
      criticalRoute: t.rowRef.criticalRoute,
      typeActivity:  t.rowRef.typeActivity,
    };
    this.activeTab     = 'datos';
    this.newRecurso    = null;
    this.editPanelOpen = true;
    // Cargar recursos de esta actividad (solo si tiene id)
    if (t.rowRef.id > 0) this.loadRecursosForActivity(t.rowRef.id);
    else                 this.recursos = [];
  }

  closeEditPanel(): void {
    this.editPanelOpen = false;
    this.editingRow    = null;
    this.newRecurso    = null;
  }

  applyEditDraft(): void {
    if (!this.editingRow) return;
    Object.assign(this.editingRow, this.editDraft);
    if (!this.editingRow.__isNew) this.editingRow.__modified = true;
    this.hasUnsavedChanges = true;
    this.closeEditPanel();
    setTimeout(() => this.buildGanttData(this.rowData), 50);
  }

  get editProgressPct(): number { return Math.round((this.editDraft.progress ?? 0) * 100); }
  set editProgressPct(v: number) { this.editDraft.progress = v / 100; }

  // ── Reassign ───────────────────────────────────────────────────────────────
  async reassignToConvention(): Promise<void> {
    if (!this.targetConvention || !this.rowData.length) return;
    if (!confirm(`¿Asignar las ${this.rowData.length} actividades visibles al convenio "${this.targetConvention.name || this.targetConvention.folio}"?`)) return;
    this.isReassigning = true;
    let updated = 0;
    try {
      for (const row of this.rowData) {
        row.idConvention = this.targetConvention.id;
        const payload = this.mapToApi(row);
        if (row.id === 0) await lastValueFrom(this._wpService.addWorkProgram(payload));
        else              await lastValueFrom(this._wpService.updateWorkProgram(row.id, payload));
        updated++;
      }
      this.showMsg(`✓ ${updated} actividad(es) asignadas a "${this.targetConvention.name || this.targetConvention.folio}"`, 'success');
      this.selectedConvention = this.targetConvention;
      this.targetConvention   = null;
      await this.loadActividades();
    } catch (err) {
      this.showMsg('Error al reasignar — revisa la consola', 'error');
      console.error(err);
    } finally { this.isReassigning = false; }
  }

  // ── AG Grid events ─────────────────────────────────────────────────────────
  onGridReady(e: GridReadyEvent): void { this.gridApi = e.api; }

  onCellEditingStopped(event: any): void {
    const data: ActividadRow = event.data;
    if (!data.__isNew) data.__modified = true;
    this.hasUnsavedChanges = true;
    if (!this.enterPressed) return;
    this.enterPressed = false;
    const cur = this.editableColumnOrder.indexOf(event.column.getColId());
    if (cur !== -1 && cur < this.editableColumnOrder.length - 1) {
      setTimeout(() => {
        this.gridApi.startEditingCell({ rowIndex: event.rowIndex, colKey: this.editableColumnOrder[cur + 1] });
      }, 80);
    }
  }

  // ── CRUD actividades ────────────────────────────────────────────────────────
  addRow(): void {
    if (!this.selectedProject) return;
    const newRow: ActividadRow = {
      id: 0,
      idProject:     this.selectedProject.id,
      idConvention:  this.isSinConvenio ? null : (this.selectedConvention?.id ?? null),
      idContract:    0,
      idTask:        0,
      activity: '', description: '', unit: '',
      quantity: null, costMX: null,
      startDate: '', endDate: '',
      predecessor: '', criticalRoute: 'No', typeActivity: 'Activity',
      parent: 0, sortorder: this.rowData.length, active: 1, progress: 0,
      __isNew: true,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasUnsavedChanges = true;

    if (this.viewMode === 'tabla') {
      this.setRowData(this.rowData);
      setTimeout(() => {
        if (this.gridApi && !this.gridApi.isDestroyed())
          this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'activity' });
      }, 50);
    } else {
      const fakeTask: GanttTask = {
        id: 0, rowRef: newRow, label: 'Nueva actividad', wbs: '', level: 0,
        startDate: new Date(), endDate: new Date(),
        durationDays: 0, progress: 0, predecessorId: 0,
        isCritical: false, isMilestone: false, isSummary: false,
        status: 'Sin iniciar', slack: 0,
        row: 0, x: 0, y: 0, barW: 0, progressW: 0,
        fill: '#2980b9', fillProgress: '#1a5276',
      };
      this.openEditPanel(fakeTask);
    }
  }

  async saveChanges(): Promise<void> {
    const dirty = this.rowData.filter(r => r.__isNew || r.__modified);
    if (!dirty.length) { this.showMsg('No hay cambios que guardar', 'error'); return; }
    this.isSaving = true;
    let saved = 0;
    try {
      for (const row of dirty) {
        const payload = this.mapToApi(row);
        if (row.id === 0) {
          const res: any = await lastValueFrom(this._wpService.addWorkProgram(payload));
          row.id = res?.id ?? res?.data?.id ?? 0;
          row.__isNew = false; row.__modified = false;
        } else {
          await lastValueFrom(this._wpService.updateWorkProgram(row.id, payload));
          row.__modified = false;
        }
        saved++;
      }
      this.hasUnsavedChanges = false;
      this.originalRowData   = JSON.parse(JSON.stringify(this.rowData));
      this.setRowData(this.rowData);
      if (this.viewMode === 'gantt') setTimeout(() => this.buildGanttData(this.rowData), 50);
      this.showMsg(`✓ ${saved} actividad(es) guardada(s)`, 'success');
    } catch (err: any) {
      this.showMsg('Error al guardar — revisa la consola', 'error');
      console.error(err);
    } finally { this.isSaving = false; }
  }

  async deleteSelected(): Promise<void> {
    if (this.viewMode === 'gantt') {
      this.showMsg('Para eliminar usa la vista Tabla, selecciona la fila y pulsa Borrar', 'error');
      return;
    }
    const selected = this.gridApi?.getSelectedRows() ?? [];
    if (!selected.length) { this.showMsg('Selecciona una fila para eliminar', 'error'); return; }
    const row: ActividadRow = selected[0];
    if (row.__isNew) {
      this.rowData = this.rowData.filter(r => r !== row);
      this.setRowData(this.rowData);
      return;
    }
    if (!confirm(`¿Eliminar "${row.description || row.activity}"?`)) return;
    try {
      await lastValueFrom(this._wpService.deleteWorkProgram(row.id));
      await this.loadActividades();
      this.showMsg('Actividad eliminada', 'success');
    } catch { this.showMsg('Error al eliminar', 'error'); }
  }

  revertChanges(): void {
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.hasUnsavedChanges = false;
    this.setRowData(this.rowData);
    if (this.viewMode === 'gantt') setTimeout(() => this.buildGanttData(this.rowData), 50);
  }

  exportXLS(): void {
    if (this.viewMode === 'tabla') { this.gridApi?.exportDataAsExcel({ fileName: 'PMO_Actividades.xlsx' }); return; }
    this.showMsg('Cambia a vista Tabla para exportar Excel', 'error');
  }

  // ── Convention badge ───────────────────────────────────────────────────────
  convTypeBadge(type: string): { label: string; css: string } {
    const t = (type ?? '').toLowerCase();
    if (t.includes('reprog'))                        return { label: 'Reprogramación',       css: 'bg-warning text-dark' };
    if (t.includes('adend') || t.includes('addend')) return { label: 'Adenda',               css: 'bg-info text-dark'    };
    return                                                  { label: 'Programación Original', css: 'bg-primary'           };
  }

  // ── Private helpers ────────────────────────────────────────────────────────
  private setRowData(data: ActividadRow[]): void {
    if (this.gridApi && !this.gridApi.isDestroyed())
      this.gridApi.setGridOption('rowData', data);
  }

  private markModified(row: ActividadRow): void {
    if (!row.__isNew) row.__modified = true;
    this.hasUnsavedChanges = true;
  }

  private mapFromApi(r: any): ActividadRow {
    return {
      id:            r.id ?? 0,
      idProject:     r.id_project    ?? r.idProject    ?? 0,
      idConvention:  r.id_convention ?? r.idConvention ?? null,
      idContract:    Number(r.id_contract ?? r.idContract ?? 0),
      idTask:        Number(r.idtask      ?? r.idTask      ?? 0),
      activity:      r.activity ?? '',
      description:   r.text ?? r.description ?? r.especification ?? '',
      unit:          r.measure ?? r.unit ?? '',
      quantity:      r.quantity   != null ? Number(r.quantity)  : null,
      costMX:        r.costMX     != null ? Number(r.costMX)    : null,
      startDate:     r.startdate  ?? r.startDate ?? '',
      endDate:       r.endate     ?? r.endDate   ?? '',
      predecessor:   String(r.predecesor ?? r.predecessor ?? ''),
      criticalRoute: r.criticroute ?? r.criticalRoute ?? 'No',
      typeActivity:  r.typeactivity ?? r.typeActivity ?? 'Activity',
      parent:        Number(r.parent    ?? 0),
      sortorder:     Number(r.sortorder ?? 0),
      active:        Number(r.active    ?? 1),
      progress:      Math.min(1, Math.max(0, Number(r.progress ?? 0))),
      ponderado:     r.ponderado != null ? Number(r.ponderado) : null,
    };
  }

  private mapToApi(r: ActividadRow): any {
    return {
      id:           r.id,
      idProject:    r.idProject,
      idConvention: r.idConvention,   // camelCase — C# mapea idConvention → IdConvention ✓
      idContract:   r.idContract ?? 0,
      idTask:       r.idTask     ?? 0,
      activity:     r.activity,
      text:         r.description,
      description:  r.description,
      measure:      r.unit || null,
      quantity:     r.quantity ?? 0,
      costMX:       r.costMX ?? 0,
      costDLL:      0,
      startdate:    r.startDate || null,
      endDate:      r.endDate   || null,
      endate:       r.endDate   || null,
      progress:     r.progress ?? 0,
      ponderado:    r.ponderado ?? null,
      criticroute:  r.criticalRoute,
      typeActivity: r.typeActivity,
      parent:       r.parent,
      sortorder:    r.sortorder,
      predecesor:   Number(r.predecessor) || 0,
      active:       r.active,
      type:         'Project',
      resources:    null,
      phase:        null,
    };
  }

  // ── Calcular Ponderado ──────────────────────────────────────────────────────
  async calcularPonderado(): Promise<void> {
    if (this.isCalculating) return;

    // Recargar desde BD para garantizar que endate esté fresco antes del PUT
    // (previene que se envíe null si había ediciones no guardadas en memoria)
    await this.loadActividades();

    const filas = this.rowData;
    if (!filas.length) { alert('No hay actividades cargadas.'); return; }

    // ── Detección robusta de hojas ─────────────────────────────────────────
    // 1) Padre estructural: su id aparece como parent de otro
    const parentSet = new Set(filas.map(r => r.parent).filter(p => p > 0));

    // 2) Padre por WBS (dot notation): "1" es padre si existe "1.1"
    const wbsSet = new Set(filas.map(r => r.activity || '').filter(Boolean));
    const wbsParents = new Set(
      Array.from(wbsSet).filter(wbs =>
        Array.from(wbsSet).some(other => other.startsWith(wbs + '.'))
      )
    );

    // WBS mixto: excluir agrupadores alfanuméricos (A, I, II…) de hojas.
    // En modo 'tiempo', su duración grande infla el total → hojas solo suman ~38.7% no 100%.
    const numWbsRe   = /^[\d][\d.]*$/;
    const hasMixedWbs = filas.some(r => r.activity && !numWbsRe.test(r.activity))
                     && filas.some(r => r.activity &&  numWbsRe.test(r.activity));

    // Hojas = ni padre estructural, ni padre WBS, ni Summary/Milestone, ni agrupador alfanumérico
    const hojas = filas.filter(r =>
      r.id > 0 &&
      !parentSet.has(r.id) &&
      !wbsParents.has(r.activity || '') &&
      r.typeActivity !== 'Summary' &&
      r.typeActivity !== 'Milestone' &&
      (!hasMixedWbs || numWbsRe.test(r.activity || ''))  // excluir alfanuméricos en WBS mixto
    );
    const agrupadores = filas.filter(r => r.id > 0 && !hojas.includes(r));

    if (!hojas.length) { alert('No se encontraron actividades hoja.'); return; }

    // ── Advertir si hay hojas sin fecha término ────────────────────────────
    // Sin endate el algoritmo de distribución diaria las ignora → distribución incompleta
    const sinFechaFin = hojas.filter(h => !h.endDate);
    if (sinFechaFin.length > 0) {
      const ok = confirm(
        `⚠️ ${sinFechaFin.length} actividad(es) no tienen Fecha Término:\n` +
        sinFechaFin.slice(0, 5).map(h => `  • ${h.activity} — ${h.description}`).join('\n') +
        (sinFechaFin.length > 5 ? `\n  ...y ${sinFechaFin.length - 5} más` : '') +
        '\n\nSin Fecha Término la distribución diaria no funcionará (0 conceptos).' +
        '\n¿Continuar de todas formas?'
      );
      if (!ok) return;
    }

    // Calcular métrica según modalidad
    let getMetric: (r: ActividadRow) => number;
    if (this.pondModalidad === 'tiempo') {
      getMetric = (r) => {
        if (!r.startDate || !r.endDate) return 0;
        const ms = new Date(r.endDate).getTime() - new Date(r.startDate).getTime();
        return Math.max(0, Math.ceil(ms / 86400000));
      };
    } else if (this.pondModalidad === 'volumen') {
      getMetric = (r) => Math.abs(Number(r.quantity ?? 0));
    } else { // precio
      getMetric = (r) => Math.abs(Number(r.quantity ?? 0) * Number(r.costMX ?? 0));
    }

    const total = hojas.reduce((s, r) => s + getMetric(r), 0);
    if (total === 0) { alert(`No hay datos de ${this.pondModalidad} en las actividades hoja.`); return; }

    this.showPondModal  = false;
    this.isCalculating  = true;
    this.calcProgress   = 0;

    try {
      // ── Calcular ponderados en memoria ────────────────────────────────────
      // Solo HOJAS se guardan en BD (agrupadores PMO tienen parent=0 → no se guardan).
      // La distribución diaria usa ponderado > 0 como filtro de hoja.
      const hojasConMetrica = hojas.filter(h => getMetric(h) > 0);
      const batchItems: { id: number; ponderado: number | null }[] = [];
      let sumAssigned = 0;

      hojas.forEach(hoja => {
        let pond: number;
        if (getMetric(hoja) <= 0) {
          pond = 0; // agrupador o actividad sin datos → ponderado=0
        } else if (hoja === hojasConMetrica[hojasConMetrica.length - 1]) {
          // Último ítem con métrica recibe el resto para que la suma sea exactamente 1.000
          pond = Math.round((100 - sumAssigned) * 1000) / 1000;
        } else {
          pond = Math.round((getMetric(hoja) / total) * 100 * 1000) / 1000;
        }
        sumAssigned += pond;
        hoja.ponderado = pond;
        batchItems.push({ id: hoja.id, ponderado: pond });
      });
      // Reset agrupadores a 0 (cabeceras, no hojas reales) — limpia residuales como IV=0.001
      agrupadores.forEach(a => {
        if ((a.ponderado ?? 0) !== 0) {
          a.ponderado = 0;
          batchItems.push({ id: a.id, ponderado: 0 });
        }
      });

      this.calcProgress = 50; // cálculo terminado, guardando…

      // ── 1 PATCH batch en lugar de N PUTs ─────────────────────────────────
      await lastValueFrom(this._wpService.patchWorkProgramPonderadoBatch(batchItems));
      this.calcProgress = 100;

      await this.loadActividades(); // recalcParentPonderados se llama dentro
      alert(`✅ Ponderado calculado (${this.pondModalidad}) — ${hojas.length} concepto(s) actualizados. Agrupadores muestran suma acumulada (solo display).`);
    } catch {
      alert('Error al guardar ponderados. Revisa la consola.');
    } finally {
      this.isCalculating = false;
      this.calcProgress  = 0;
    }
  }

  // ── Recalcula ponderados de agrupadores EN MEMORIA (no se guarda en BD) ────
  // Se llama después de cada loadActividades para mostrar la suma acumulada.
  // Los agrupadores PMO tienen parent=0 en BD → no hay jerarquía real;
  // solo funciona si el proyecto tiene relación padre-hijo correctamente configurada.
  private recalcParentPonderados(): void {
    const filas = this.rowData;
    if (!filas.length) return;

    // Identificar qué IDs son padres de alguien
    const parentSet = new Set(filas.map(r => r.parent).filter(p => p > 0));
    if (parentSet.size === 0) return; // estructura plana — no hay nada que acumular

    // childrenMap: parentId → [childIds]
    const childrenMap = new Map<number, number[]>();
    filas.forEach(r => {
      if (r.parent > 0) {
        const arr = childrenMap.get(r.parent) ?? [];
        arr.push(r.id);
        childrenMap.set(r.parent, arr);
      }
    });

    // pondMap inicializado con ponderados de hojas (los que vienen de BD)
    const pondMap = new Map<number, number>(
      filas.filter(r => !parentSet.has(r.id)).map(r => [r.id, r.ponderado ?? 0])
    );

    // Ordenar agrupadores más profundos primero
    const agrupadores = filas.filter(r => parentSet.has(r.id) && r.id > 0);
    const depthOf = (id: number): number => {
      const row = filas.find(f => f.id === id);
      return row && row.parent > 0 ? 1 + depthOf(row.parent) : 0;
    };
    agrupadores.sort((a, b) => depthOf(b.id) - depthOf(a.id));

    for (const par of agrupadores) {
      const children = childrenMap.get(par.id) ?? [];
      const sum = children.reduce((s, cid) => s + (pondMap.get(cid) ?? 0), 0);
      const pond = Math.round(sum * 1000) / 1000;
      pondMap.set(par.id, pond);
      par.ponderado = pond; // solo en memoria, no en BD
    }

    // Refrescar grid con los nuevos valores de agrupadores
    this.setRowData(this.rowData);
  }

  // ── Importar actividades desde Excel ────────────────────────────────────────
  triggerImport(): void { this.xlsImportRef?.nativeElement.click(); }

  async importXLS(event: Event): Promise<void> {
    if (!this.selectedProject) { alert('Selecciona un proyecto primero.'); return; }
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    input.value = ''; // reset para permitir volver a seleccionar el mismo archivo

    try {
      const data = await file.arrayBuffer();
      const wb   = XLSX.read(data, { type: 'array', cellDates: true });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (rawRows.length < 2) { alert('El archivo está vacío o no tiene datos.'); return; }

      // ── Mapeo de encabezados (insensible a mayúsculas / acentos) ─────────
      const hdr = (rawRows[0] as string[]).map(h => String(h ?? '').toLowerCase().trim()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')); // quita acentos

      const col = (...kws: string[]): number =>
        hdr.findIndex(h => kws.some(k => h.includes(k)));

      const iActivity    = col('wbs','partida','activity','actividad','clave','codigo');
      const iDescription = col('descripcion','description','concepto','nombre','especif','activid');
      const iUnit        = col('unidad','unit','um','u.m.');
      const iQuantity    = col('cantidad','quantity','volumen','vol');
      const iCostMX      = col('precio','cost','costo','p.u.','pu ','unitario');
      const iStart       = col('inicio','fecha_ini','fecha ini','fecha_inicio','fecha inicio','startdate','start date');
      // 'fin' y 'end' solos son muy genéricos (coinciden con "finiquito", "pendiente", etc.)
      // Usar únicamente keywords compuestas o específicas
      const iEnd         = col('termino','fecha_fin','fecha fin','fecha_term','fecha_termino','fecha final','endate','end date');
      const iPred        = col('pred','predecesor','predecessor','antecede');
      const iType        = col('tipo','type','typeactivity');
      const iCritical    = col('critica','critical','ruta');
      const iProgress    = col('avance','progress','porcentaje');
      const iSortorder   = col('orden','sortorder','sort','secuencia','seq');

      if (iDescription < 0 && iActivity < 0) {
        alert('No se encontró columna de Descripción o WBS.\nRevisa que la primera fila tenga encabezados.');
        return;
      }

      // ── Parsear fecha ─────────────────────────────────────────────────────
      const fmtDate = (v: any): string => {
        if (!v) return '';
        if (v instanceof Date) {
          const y = v.getFullYear(), m = v.getMonth() + 1, d = v.getDate();
          return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        }
        const s = String(v).trim();
        if (!s || s === '0') return '';
        // dd/mm/yyyy o dd-mm-yyyy
        const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
        // yyyy-mm-dd
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
        return '';
      };

      const str  = (i: number, r: any[]) => i >= 0 ? String(r[i] ?? '').trim() : '';
      const num  = (i: number, r: any[]) => i >= 0 && r[i] !== '' ? Number(r[i]) : null;

      // ── Construir filas parseadas ──────────────────────────────────────────
      interface PRow {
        activity: string; description: string; unit: string;
        quantity: number | null; costMX: number | null;
        startDate: string; endDate: string;
        predecessor: string; typeActivity: string;
        criticalRoute: string; progress: number; sortorder: number;
      }

      const parsed: PRow[] = rawRows.slice(1)
        .map((r, idx) => {
          const prog = num(iProgress, r);
          return {
            activity:      str(iActivity, r),
            description:   str(iDescription, r),
            unit:          str(iUnit, r),
            quantity:      num(iQuantity, r),
            costMX:        num(iCostMX, r),
            startDate:     fmtDate(iStart >= 0 ? r[iStart] : ''),
            endDate:       fmtDate(iEnd   >= 0 ? r[iEnd]   : ''),
            predecessor:   str(iPred, r),
            typeActivity:  str(iType, r) || 'Activity',
            criticalRoute: str(iCritical, r) || 'No',
            progress:      prog != null
              ? Math.min(1, Math.max(0, prog > 1 ? prog / 100 : prog)) : 0,
            sortorder:     iSortorder >= 0 && r[iSortorder] !== ''
              ? Number(r[iSortorder]) : (idx + 1),
          };
        })
        .filter(r => r.activity || r.description); // descartar filas vacías

      if (!parsed.length) { alert('No se encontraron filas con datos.'); return; }

      // ── Auto-detectar agrupadores por WBS dot-notation ────────────────────
      // "1" es padre de "1.1", "1.1" es padre de "1.1.1", etc.
      const wbsSet = new Set(parsed.map(r => r.activity).filter(Boolean));
      const wbsParents = new Set(
        Array.from(wbsSet).filter(wbs =>
          Array.from(wbsSet).some(other => other !== wbs && other.startsWith(wbs + '.'))
        )
      );

      // Promover Activity → Summary si se detecta como padre WBS
      parsed.forEach(r => {
        if (r.activity && wbsParents.has(r.activity) && r.typeActivity === 'Activity')
          r.typeActivity = 'Summary';
      });

      // ── Reordenar por WBS: numérico puro O mixto (agrupadores alfanuméricos + numéricos) ─
      // Numérico: "1" < "1.1" < "1.2" < "1.10" < "2" < "10"
      // Mixto:    A, I, II, III, IV → primero (grupo 0);  1, 2, 3… → después (grupo 5)
      const wbsNumericRe  = /^[\d][\d.]*$/;
      const allHaveNumWbs = parsed.length > 0 && parsed.every(r => wbsNumericRe.test(r.activity || ''));
      const hasMixedWbs   = !allHaveNumWbs
                          && parsed.some(r => r.activity && !wbsNumericRe.test(r.activity))
                          && parsed.some(r => r.activity &&  wbsNumericRe.test(r.activity));
      if (allHaveNumWbs || hasMixedWbs) {
        const smartKey = (wbs: string): string => {
          const s = (wbs || '').trim();
          if (!s) return '9~';
          if (wbsNumericRe.test(s))
            return '5~' + s.split('.').map(seg => String(parseInt(seg, 10) || 0).padStart(6, '0')).join('.');
          return '0~' + s.toLowerCase().padEnd(30, '~'); // agrupadores → primero
        };
        parsed.sort((a, b) => smartKey(a.activity).localeCompare(smartKey(b.activity)));
        parsed.forEach((p, i) => { p.sortorder = i + 1; });
      }

      const idProject    = this.selectedProject.id;
      const idConvention = (this.selectedConvention && !this.isSinConvenio)
        ? this.selectedConvention.id : null;

      const total = parsed.length;
      this.isSaving = true;
      this.showMsg(`Preparando ${total} actividades…`, 'success');

      // ── Batch POST — 1 request en lugar de N ──────────────────────────────
      const payloads: any[] = parsed.map(p => ({
        id:           0,
        idProject,
        idConvention,
        idContract:   0,
        idTask:       0,
        activity:     p.activity,
        text:         p.description,
        description:  p.description,
        measure:      p.unit || null,
        quantity:     p.quantity  ?? 0,
        costMX:       p.costMX   ?? 0,
        costDLL:      0,
        startdate:    p.startDate || null,
        endate:       p.endDate   || null,
        progress:     p.progress,
        ponderado:    null,
        criticroute:  p.criticalRoute,
        typeActivity: p.typeActivity,
        parent:       0,
        sortorder:    p.sortorder,
        predecesor:   Number(p.predecessor) || 0,
        active:       1,
        type:         'Project',
        resources:    null,
        phase:        null,
      }));

      this.showMsg(`Importando ${total} actividades…`, 'success');
      const result = await lastValueFrom(this._wpService.addWorkProgramBatch(payloads));
      const saved = result?.inserted ?? total;

      await this.loadActividades();
      this.isSaving = false;
      const summ = wbsParents.size > 0
        ? `\n${wbsParents.size} agrupador(es) detectados automáticamente (Summary).` : '';
      this.showMsg(`✓ ${saved} actividad(es) importadas`, 'success');
      alert(`✅ Importación completa: ${saved}/${total} actividades.${summ}`);

    } catch (e: any) {
      console.error('Error importación XLS:', e);
      this.isSaving = false;
      alert('Error al importar el archivo: ' + (e?.message ?? String(e)));
    }
  }

  private showMsg(msg: string, type: 'success' | 'error'): void {
    this.saveMsg = msg; this.saveMsgType = type;
    setTimeout(() => { this.saveMsg = ''; }, 4000);
  }

  // ── Vista Comparación ────────────────────────────────────────────────────────

  async loadComparacion(): Promise<void> {
    if (!this.selectedProject || this.conventions.length < 1) return;
    this.isLoadingComp  = true;
    this.compLeftData   = [];
    this.compSelectedRow = null;
    this.compRightData  = [];

    const sorted = [...this.conventions].sort((a, b) => a.id - b.id);
    this.originalConvention = sorted[0];
    this.otherConventions   = sorted.slice(1);

    const idPrj = this.selectedProject.id ?? this.selectedProject.idProject;
    try {
      const res: any = await lastValueFrom(
        this._wpService.getByConvention(this.originalConvention.id, idPrj)
      ).catch(() => []);
      const raw: any[] = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      this.compLeftData = raw.map(r => ({
        ...r,
        startDate: r.startDate ?? r.startdate ?? '',
        endDate:   r.endDate   ?? r.enDate ?? r.endate ?? '',
      }));
    } finally { this.isLoadingComp = false; }
  }

  async onCompRowSelected(row: any): Promise<void> {
    this.compSelectedRow = row;
    this.compRightData   = [];
    if (!row || !this.otherConventions.length) return;
    this.isLoadingRight = true;

    const idPrj  = this.selectedProject.id ?? this.selectedProject.idProject;
    const wbs    = String(row.activity ?? '');
    const desc   = String(row.description ?? '');

    const results = await Promise.all(
      this.otherConventions.map(async (conv) => {
        const res: any = await lastValueFrom(
          this._wpService.getByConvention(conv.id, idPrj)
        ).catch(() => []);
        const items: any[] = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        const found = items.find(i =>
          (wbs && String(i.activity ?? '') === wbs) ||
          String(i.description ?? '') === desc
        );
        return {
          convName:    conv.name || conv.folio || `Ver. #${conv.id}`,
          convId:      conv.id,
          exists:      !!found,
          description: found?.description  ?? null,
          unit:        found?.unit         ?? null,
          quantity:    found?.quantity != null ? Number(found.quantity)   : null,
          costMX:      found?.costMX   != null ? Number(found.costMX)     : null,
          costDLL:     found?.costDLL  != null ? Number(found.costDLL)    : null,
          startDate:   found ? String(found.startDate ?? found.startdate ?? '').split('T')[0] : null,
          endDate:     found ? String(found.endDate   ?? found.enDate ?? found.endate ?? '').split('T')[0] : null,
          ponderado:   found?.ponderado != null ? Number(found.ponderado) : null,
        };
      })
    );
    this.compRightData  = results;
    this.isLoadingRight = false;
    // Refrescar estilos de celdas después de actualizar compSelectedRow
    if (this.compRightGridApi && !this.compRightGridApi.isDestroyed()) {
      this.compRightGridApi.setGridOption('rowData', results);
      setTimeout(() => this.compRightGridApi?.refreshCells({ force: true }), 50);
    }
  }

  // Estilo de celda: compara valor de versión vs original
  compDiffStyle(val: any, origVal: any, kind: 'number' | 'date' | 'text'): any {
    if (val === null || val === undefined) return { background: '#fff3cd', color: '#856404' };
    if (origVal === null || origVal === undefined) return {};
    if (kind === 'number') {
      const v = Number(val), o = Number(origVal);
      if (v > o) return { background: '#d4edda', color: '#155724', fontWeight: '600' };
      if (v < o) return { background: '#f8d7da', color: '#721c24', fontWeight: '600' };
    }
    if (kind === 'date') {
      if (String(val) > String(origVal)) return { background: '#f8d7da', color: '#721c24', fontWeight: '600' };
      if (String(val) < String(origVal)) return { background: '#d4edda', color: '#155724', fontWeight: '600' };
    }
    if (kind === 'text') {
      if (String(val) !== String(origVal)) return { background: '#fff3cd', color: '#856404' };
    }
    return {};
  }

}
