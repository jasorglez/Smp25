import {
  Component, inject, OnInit, effect,
  ElementRef, ViewChild, HostListener
} from '@angular/core';
import { CommonModule }        from '@angular/common';
import { FormsModule }         from '@angular/forms';
import { AgGridModule }        from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, GridOptions } from 'ag-grid-enterprise';
import { lastValueFrom }       from 'rxjs';
import { ProjectsService }     from 'app/services/projects.service';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { ConventionsService }  from 'app/services/conventions.service';
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
  __isNew?:      boolean;
  __modified?:   boolean;
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
    /* ── Gantt wrapper ── */
    .gantt-wrapper {
      overflow-x: auto; overflow-y: auto;
      max-height: calc(100vh - 340px); min-height: 260px;
      border: 1px solid #dee2e6; border-radius: 8px;
      background: #fff; position: relative;
    }
    .gantt-svg { display: block; }

    /* ── Edit slide panel ── */
    .edit-panel {
      position: fixed; top: 0; right: -440px; width: 420px; height: 100vh;
      background: #fff; box-shadow: -6px 0 30px rgba(0,0,0,.22);
      z-index: 1055; transition: right .28s cubic-bezier(.4,0,.2,1);
      overflow-y: auto;
      border-left: 5px solid #2980b9;
    }
    .edit-panel.open { right: 0; }
    .edit-panel-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,.18);
      z-index: 1054; display: none;
    }
    .edit-panel-backdrop.open { display: block; }

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

  @ViewChild('ganttWrapper') wrapperRef!: ElementRef<HTMLDivElement>;

  private _projectsService = inject(ProjectsService);
  private _wpService       = inject(WorkprogramsService);
  private _convService     = inject(ConventionsService);
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
  saveMsgType       = '';

  // ── View mode ──────────────────────────────────────────────────────────────
  viewMode: 'gantt' | 'tabla' = 'gantt';
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
  editPanelOpen = false;
  editingRow:   ActividadRow | null = null;
  editDraft:    Partial<ActividadRow> = {};

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
      field: 'startDate', headerName: 'Inicio', width: 115, editable: true,
      cellEditor: 'agDateCellEditor',
      valueGetter: (p) => p.data?.startDate ? String(p.data.startDate).substring(0, 10) : '',
      valueSetter: (p) => { p.data.startDate = p.newValue; return true; },
      valueFormatter: (p) => {
        if (!p.value) return '';
        const [y, m, d] = String(p.value).split('-');
        return d && m && y ? `${d}/${m}/${y}` : p.value;
      },
    },
    {
      field: 'endDate', headerName: 'Término', width: 115, editable: true,
      cellEditor: 'agDateCellEditor',
      valueGetter: (p) => p.data?.endDate ? String(p.data.endDate).substring(0, 10) : '',
      valueSetter: (p) => { p.data.endDate = p.newValue; return true; },
      valueFormatter: (p) => {
        if (!p.value) return '';
        const [y, m, d] = String(p.value).split('-');
        return d && m && y ? `${d}/${m}/${y}` : p.value;
      },
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
      if (id && id !== this.idCompany) { this.idCompany = id; this.loadProjects(); }
    });
  }

  ngOnInit(): void {
    this.idCompany = this._signalsService.getRootSelectedBySidebar()() ?? 0;
    if (this.idCompany) this.loadProjects();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.viewMode === 'gantt' && this.rowData.length) this.buildGanttData(this.rowData);
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
      this.rowData         = (raw ?? []).map(r => this.mapFromApi(r));
      this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
      this.hasUnsavedChanges = false;
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
  setViewMode(mode: 'gantt' | 'tabla'): void {
    this.viewMode = mode;
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
    const valid = rows.filter(r => r.startDate && r.endDate);
    if (!valid.length) { this.tasks = []; this.links = []; return; }

    const levelOf = (wbs: string): number => Math.max(0, wbs.split('.').length - 1);

    const all: GanttTask[] = valid.map((r, i) => {
      const sd = new Date(r.startDate); sd.setHours(0, 0, 0, 0);
      const ed = new Date(r.endDate);   ed.setHours(0, 0, 0, 0);
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
      if (prog >= 1)                              status = 'Terminada';
      else if (today > ed)                        status = 'Atrasada';
      else if (today >= sd && slack <= 5)         status = 'En Riesgo';
      else if (prog > 0)                          status = 'En Tiempo';

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
    this.editPanelOpen = true;
  }

  closeEditPanel(): void { this.editPanelOpen = false; this.editingRow = null; }

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

  // ── CRUD ───────────────────────────────────────────────────────────────────
  addRow(): void {
    if (!this.selectedProject) return;
    const newRow: ActividadRow = {
      id: 0,
      idProject:     this.selectedProject.id,
      idConvention:  this.isSinConvenio ? null : (this.selectedConvention?.id ?? null),
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
      // In Gantt mode → open edit panel for the new row directly
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
      idProject:     r.id_project ?? r.idProject ?? 0,
      idConvention:  r.id_convention ?? r.idConvention ?? null,
      activity:      r.activity ?? '',
      description:   r.description ?? r.especification ?? '',
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
    };
  }

  private mapToApi(r: ActividadRow): any {
    return {
      id:           r.id,
      idProject:    r.idProject,
      id_convention: r.idConvention,
      activity:     r.activity,
      text:         r.description,
      description:  r.description,
      measure:      r.unit || null,
      quantity:     r.quantity ?? 0,
      costMX:       r.costMX ?? 0,
      costDLL:      0,
      salePrice:    0,
      startdate:    r.startDate || null,
      endate:       r.endDate   || null,
      progress:     r.progress ?? 0,
      ponderado:    null,
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

  private showMsg(msg: string, type: 'success' | 'error'): void {
    this.saveMsg = msg; this.saveMsgType = type;
    setTimeout(() => { this.saveMsg = ''; }, 4000);
  }
}
