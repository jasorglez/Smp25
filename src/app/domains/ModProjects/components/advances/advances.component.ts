import { Component, effect, inject, OnChanges, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { AdvanceService } from 'app/services/advance.service';
import { SignalsService } from 'app/services/signals.service';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { WorkprogramCalendarService, WorkprogramCalendar } from 'app/services/workprogram-calendar.service';
import { WorkprogramDailyService, DailySummary } from 'app/services/workprogram-daily.service';
import { ProjectsService }    from 'app/services/projects.service';
import { ConventionsService } from 'app/services/conventions.service';
import { alerts } from 'app/helpers/alerts';
import { concat, lastValueFrom, toArray } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ApexAxisChartSeries, ApexChart, ApexXAxis, ApexTitleSubtitle,
  NgApexchartsModule, ApexDataLabels, ApexFill, ApexLegend,
  ApexPlotOptions, ApexStroke, ApexTooltip, ApexYAxis, ApexGrid, ApexMarkers
} from 'ng-apexcharts';
import { ChartComponent } from 'ng-apexcharts';
import * as XLSX from 'xlsx';

export type ChartOptions = {
  series: ApexAxisChartSeries; chart: ApexChart; xaxis: ApexXAxis;
  title: ApexTitleSubtitle; dataLabels: ApexDataLabels; plotOptions: ApexPlotOptions;
  yaxis: ApexYAxis; colors: string[]; fill: ApexFill; tooltip: ApexTooltip;
  markers: ApexMarkers; stroke: ApexStroke; grid: ApexGrid; legend: ApexLegend;
};

interface ContractAdvance {
  id?: string | number; __isNew?: boolean; __modified?: boolean;
  accumulateProgram?: number; accumulatePhysical?: number;
  date: string; physicalAdvanced: number; programAdvanced: number;
  idContract?: number | null;
  idProject?: number | null;   // contexto PMO (sin contrato)
}

interface ActiveTask {
  idEntry: number; activity: string; description: string;
  ponderado: number; progressActual: number; avanceHoy: number;
  progressNuevo: number; startDate: string; endDate: string; __modified?: boolean;
}

/** Fila combinada para la Vista Diaria */
interface DailyRow {
  date:        string;
  dayName:     string;   // Lun / Mar / Mié ...
  programado:  number;   // de workprogram_daily (ponderadoDia acumulado)
  real:        number;   // de advanced (physicalAdvanced del día)
  numConceptos: number;
  pctBar:      number;   // real / programado * 100 (para color semáforo)
}

@Component({
  selector: 'app-advances',
  standalone: true,
  imports: [CommonModule, AgGridModule, NgApexchartsModule, FormsModule],
  templateUrl: './advances.component.html',
  styleUrl: './advances.component.scss'
})
export class AdvancesComponent implements OnInit, OnChanges {

  readonly Math = Math;

  // ─── Servicios ──────────────────────────────────────────────────────────────
  private _signalsService    = inject(SignalsService);
  private _advancesService   = inject(AdvanceService);
  private _workprogramsService = inject(WorkprogramsService);
  private _calendarService   = inject(WorkprogramCalendarService);
  private _dailyService      = inject(WorkprogramDailyService);
  private _projectsService    = inject(ProjectsService);
  private _convService        = inject(ConventionsService);

  // ─── IDs del scope activo ────────────────────────────────────────────────────
  curretnContractSelected: number | null = null;
  idProject:    number | null = null;
  idConvention: number | null = null;

  // ─── Selector Proyecto + Convenio (contexto PMO — sin contrato) ──────────────
  readonly SIN_CONVENIO = { id: -1, name: '⚪ Sin convenio' };
  idCompany:               number   = 0;
  pmoProjects:             any[]    = [];
  pmoConventions:          any[]    = [];
  selectedPmoProjectId:    number | null = null;
  selectedPmoConventionId: number | null = null;
  pmoContractId:           number | null = null;
  isLoadingConv            = false;
  private didUserSelectConvention = false;

  get showPmoSelectors(): boolean {
    return !!this.idCompany;
  }

  private get isPmoScope(): boolean {
    return !!this.idProject && (!!this.selectedPmoProjectId || !this.curretnContractSelected);
  }

  private get effectiveContractId(): number | null {
    if (this.isPmoScope) {
      return this.resolveProjectContractId(this.selectedPmoProjectId ?? this.idProject) ?? this.pmoContractId ?? this.curretnContractSelected;
    }
    return this.curretnContractSelected ?? this.pmoContractId;
  }

  // ─── Grid Curva S ───────────────────────────────────────────────────────────
  private gridApi: GridApi;
  datosMensuales: ContractAdvance[] = [];
  monthlyTableData: any[]           = [];
  rowData: ContractAdvance[]        = [];
  selectedRowData: ContractAdvance | null = null;
  notSavedChanges  = false;
  newlyAddedRows: string[] = [];
  private tempIdCounter = 0;

  private readonly ALL_MONTHS = [
    'ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
    'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'
  ];

  // ─── Gráfica Curva S ────────────────────────────────────────────────────────
  @ViewChild('chart') chart: ChartComponent;
  public chartOptions: Partial<ChartOptions> = { series: [], chart: { type: 'line', height: 350 } };

  // ─── Captura Diaria (Punto 6) ───────────────────────────────────────────────
  showDailyCapture    = false;
  dailyCaptureDate    = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  activeTasksData: ActiveTask[]  = [];
  delayedTasksData: ActiveTask[] = [];
  isSavingDailyAdvance = false;
  isLoadingTasks       = false;
  totalPhysicalAdvanceHoy = 0;
  programAdvanceHoy       = 0;

  // ─── ⚙️ Panel Engranaje Calendario ─────────────────────────────────────────
  showCalendarPanel  = false;
  isSavingCalendar   = false;
  calendarConfig: WorkprogramCalendar = {
    idProject: 0, lunes: true, martes: true, miercoles: true,
    jueves: true, viernes: true, sabado: false, domingo: false
  };

  // ─── 📊 Calcular Distribución ───────────────────────────────────────────────
  isGenerating        = false;
  generateStep        = 0;   // 1 = distribuyendo días  |  2 = actualizando Curva S
  genTotal2           = 0;   // total períodos a insertar/actualizar (paso 2)
  genDone2            = 0;   // períodos procesados (paso 2)
  generateResult: any = null;
  genPeriodo: 'dia' | 'semana' | 'quincena' | 'mes' = 'dia'; // período de agrupación Curva S

  // ─── 📅 Vista Diaria ────────────────────────────────────────────────────────
  showDailyView    = false;
  isLoadingDaily   = false;
  dailyRows: DailyRow[] = [];
  dailyViewFrom    = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                       .toISOString().split('T')[0];
  dailyViewTo      = new Date().toISOString().split('T')[0];

  private readonly DAY_NAMES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

  // ─── Column defs Curva S ────────────────────────────────────────────────────
  public columnDefs: ColDef[] = [
    {
      field: 'date', headerName: 'Fecha', width: 100, editable: true,
      cellEditor: 'agDateCellEditor',
      valueGetter: p => p.data?.date ? String(p.data.date).substring(0, 10) : '',
      valueSetter: p => { p.data.date = p.newValue; return true; },
      valueFormatter: p => {
        if (!p.value) return '';
        const [y, m, d] = String(p.value).split('-');
        return (d && m && y) ? `${d}/${m}/${y.substring(2)}` : p.value;
      }
    },
    { field: 'programAdvanced',  headerName: 'Prog.(%)',  width: 85, editable: true,
      valueFormatter: p => p.value != null ? Number(p.value).toFixed(2) : '' },
    { field: 'physicalAdvanced', headerName: 'Físico(%)', width: 85, editable: true,
      valueFormatter: p => p.value != null ? Number(p.value).toFixed(2) : '' },
    { field: 'accumulateProgram',  headerName: 'Acum.Prog.',  width: 95, editable: false,
      cellStyle: { background: '#f8f9fa', color: '#495057' },
      valueFormatter: p => p.value != null ? Number(p.value).toFixed(2) + '%' : '' },
    { field: 'accumulatePhysical', headerName: 'Acum.Fís.', width: 95, editable: false,
      cellStyle: { background: '#f8f9fa', color: '#495057' },
      valueFormatter: p => p.value != null ? Number(p.value).toFixed(2) + '%' : '' },
  ];

  // ─── Column defs tareas activas ─────────────────────────────────────────────
  public activeTasksColDefs: ColDef[] = [
    { field: 'activity',       headerName: 'Actividad',   width: 90  },
    { field: 'description',    headerName: 'Descripción', flex: 1, minWidth: 180 },
    { field: 'ponderado',      headerName: 'Pond.(%)',    width: 80,
      valueFormatter: p => p.value != null ? Number(p.value).toFixed(3) : '—' },
    { field: 'progressActual', headerName: 'Prog.Act.(%)', width: 100,
      valueFormatter: p => p.value != null ? Number(p.value).toFixed(1) + '%' : '0%' },
    {
      field: 'avanceHoy', headerName: 'Avance Hoy (%)', width: 120, editable: true,
      cellStyle: { background: '#fff9e6', border: '1px solid #e67e22' },
      valueFormatter: p => p.value != null ? Number(p.value).toFixed(1) : '0.0',
      valueSetter: p => {
        const val = Math.min(100, Math.max(0, Number(p.newValue) || 0));
        p.data.avanceHoy     = val;
        p.data.progressNuevo = Math.min(100, (p.data.progressActual ?? 0) + val);
        p.data.__modified    = true;
        this.recalcTotalAdvanceHoy();
        return true;
      }
    },
    { field: 'progressNuevo', headerName: 'Prog.Nuevo(%)', width: 110, editable: false,
      cellStyle: { background: '#f1f7ff', color: '#0e4491', fontWeight: '600' },
      valueFormatter: p => p.value != null ? Number(p.value).toFixed(1) + '%' : '—' },
    { field: 'startDate', headerName: 'Inicio', width: 90 },
    { field: 'endDate',   headerName: 'Fin',    width: 90 },
  ];

  // ─── Grid options ────────────────────────────────────────────────────────────
  public gridOptions: any = {
    headerHeight: 28, rowHeight: 26, rowSelection: 'single',
    stopEditingWhenCellsLoseFocus: true,
    getRowClass: (params: any) => params.node.isSelected() ? 'selected-row' : '',
    rowClassRules: { 'new-row-highlight': (params: any) => !!params.data?.__isNew },
    onRowClicked: (event: any) => {
      event.node.setSelected(true);
      this.selectedRowData = event.data;
    },
    onRowSelected: (event: any) => {
      if (!event.node.isSelected()) return;
      this.gridApi?.forEachNode(n => { if (n.id !== event.node.id) n.setSelected(false); });
    },
    onFirstDataRendered: (p: any) => p.api.sizeColumnsToFit(),
  };

  public activeTasksGridOptions: any = {
    headerHeight: 26, rowHeight: 24,
    stopEditingWhenCellsLoseFocus: true,
    getRowClass: (p: any) => p.data?.endDate && new Date(p.data.endDate) < new Date() ? 'ag-row-warning' : '',
    onFirstDataRendered: (p: any) => p.api.sizeColumnsToFit(),
  };

  // ─── Constructor ─────────────────────────────────────────────────────────────
  constructor() {
    effect(() => {
      const sidebarContract        = this._signalsService.getContractSelectedBySidebar()();
      const sidebarProject         = this._signalsService.getProjectSelectedBySidebar()();
      const vigente                = this._signalsService.getConventionVigente()();
      const contractChangedFromSidebar =
        Number(this.curretnContractSelected) !== Number(sidebarContract);
      const projectChangedFromSidebar =
        !!sidebarProject && Number(this.selectedPmoProjectId) !== Number(sidebarProject);
      this.curretnContractSelected = sidebarContract;
      if (!this.didUserSelectConvention || projectChangedFromSidebar || contractChangedFromSidebar) {
        this.selectedPmoConventionId = vigente?.id ?? null;
        this.idConvention            = vigente?.id ?? null;
      }

      const rootId = this._signalsService.getRootSelectedBySidebar()();
      if (rootId && rootId !== this.idCompany) {
        this.idCompany = rootId;
        this.pmoProjects = [];
        this.pmoConventions = [];
        this.loadPmoProjects();
      }
      // En PMO (sin contrato) el convenio vigente puede ser de otro módulo → ignorarlo
      if (projectChangedFromSidebar || contractChangedFromSidebar) {
        this.selectedPmoProjectId = sidebarProject;
        this.didUserSelectConvention = false;
        this.pmoConventions = [];
      }

      if (this.selectedPmoProjectId) {
        this.idProject = this.selectedPmoProjectId;
        this.pmoContractId = this.resolveProjectContractId(this.selectedPmoProjectId);
      } else {
        this.idProject = sidebarProject;
        if (this.idProject) this.selectedPmoProjectId = this.idProject;
        this.pmoContractId = this.resolveProjectContractId(this.idProject);
      }

      this.syncProjectDateRange();

      this.idConvention = this.selectedPmoConventionId === this.SIN_CONVENIO.id
        ? null
        : (this.selectedPmoConventionId ?? null);
      if (this.selectedPmoProjectId && (!this.pmoConventions.length || contractChangedFromSidebar || projectChangedFromSidebar)) {
        this.loadPmoConventions(this.selectedPmoProjectId);
      }

      this.obtenerDatos();
      // Reset paneles al cambiar proyecto
      this.showCalendarPanel = false;
      this.showDailyView     = false;
      this.generateResult    = null;
      this.dailyRows         = [];
    });
  }

  ngOnInit(): void {}
  ngOnChanges(_: SimpleChanges): void {}
  onGridReady(params: GridReadyEvent): void { this.gridApi = params.api; }

  // ─── Cambio de celda → recalcular acumulados ────────────────────────────────
  onCellValueChanged(_event: any): void {
    this.notSavedChanges = true;
    _event.data.__modified = true;
    this.recalcAccumulationInGrid();
  }

  private recalcAccumulationInGrid(): void {
    const rows: ContractAdvance[] = [];
    this.gridApi?.forEachNode(n => rows.push(n.data));
    rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let prog = 0, fis = 0;
    rows.forEach(r => {
      prog += Number(r.programAdvanced  ?? 0);
      fis  += Number(r.physicalAdvanced ?? 0);
      r.accumulateProgram  = this.normalizeClosingPercent(Math.round(prog * 1000) / 1000);
      r.accumulatePhysical = this.normalizeClosingPercent(Math.round(fis  * 1000) / 1000);
    });
    this.gridApi?.refreshCells({ force: true });
  }

  // ─── CRUD Curva S ────────────────────────────────────────────────────────────
  addRow(): void {
    const tempId  = `temp_${this.tempIdCounter++}`;
    const isPmo   = this.isPmoScope;
    const newItem: ContractAdvance = {
      id: tempId, date: new Date().toISOString().split('T')[0],
      idContract:       isPmo ? null : (this.effectiveContractId ?? 0),
      idProject:        isPmo ? this.idProject : null,
      physicalAdvanced: 0, programAdvanced: 0,
      accumulateProgram: 0, accumulatePhysical: 0, __isNew: true,
    };
    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
    setTimeout(() => this.gridApi?.startEditingCell({ rowIndex: 0, colKey: 'date' }), 50);
  }

  async deleteEntry(): Promise<void> {
    if (!this.selectedRowData) {
      alerts.basicAlert('Sin selección', 'Haz clic en una fila para seleccionarla.', 'warning'); return;
    }
    const id = this.selectedRowData.id;
    if (id && String(id).startsWith('temp_')) {
      this.rowData = this.rowData.filter(r => r.id !== id);
      this.selectedRowData = null;
      this.notSavedChanges = this.rowData.some(r => r.__isNew || r.__modified);
      return;
    }
    const result = await alerts.confirmAlert('¿Eliminar?', '¿Eliminar este registro de la Curva S?', 'warning', 'Sí, eliminar');
    if (!result.isConfirmed) return;
    try {
      await lastValueFrom(this._advancesService.deleteAdvance(Number(id)));
      alerts.basicAlert('Eliminado', 'Registro eliminado.', 'success');
      this.selectedRowData = null;
      this.obtenerDatos();
    } catch {
      alerts.basicAlert('Error', 'No se pudo eliminar.', 'error');
    }
  }

  async saveChanges(): Promise<void> {
    const valid = this.rowData.every(r => r.date && !isNaN(Number(r.programAdvanced)) && !isNaN(Number(r.physicalAdvanced)));
    if (!valid) { alerts.basicAlert('Campos incompletos', 'Verifica fecha y valores.', 'error'); return; }
    const newRows = this.rowData.filter(r => r.__isNew);
    const modRows = this.rowData.filter(r => r.__modified && !r.__isNew);
    const addObs  = newRows.map(r => this._advancesService.addAdvance(this.cleanDataForServer(r)));
    const updObs  = modRows.map(r => this._advancesService.updateAdvance(Number(r.id), this.cleanDataForServer(r)));
    try {
      await lastValueFrom(concat(...addObs, ...updObs).pipe(toArray()));
      alerts.basicAlert('Guardado', 'Registros guardados correctamente.', 'success');
      this.notSavedChanges = false;
      this.newlyAddedRows  = [];
      this.obtenerDatos();
    } catch { alerts.basicAlert('Error', 'Ocurrió un error al guardar.', 'error'); }
  }

  revert(): void { this.obtenerDatos(); this.notSavedChanges = false; }

  // ─── PMO: cargar proyectos por empresa ──────────────────────────────────────
  loadPmoProjects(): void {
    if (!this.idCompany) return;
    this._projectsService.getProjectListByCompany(this.idCompany).subscribe({
      next: (res: any) => {
        this.pmoProjects = Array.isArray(res) ? res : (res?.data ?? []);
        this.pmoContractId = this.resolveProjectContractId(this.selectedPmoProjectId);
        this.syncProjectDateRange();
        if (this.selectedPmoProjectId) {
          const exists = this.pmoProjects.some((project: any) => Number(project.id) === Number(this.selectedPmoProjectId));
          if (exists) {
            this.loadPmoConventions(this.selectedPmoProjectId);
          }
        }
      },
      error: () => { this.pmoProjects = []; }
    });
  }

  onPmoProjectSelected(id: number): void {
    this.selectedPmoProjectId    = id;
    this.idProject               = id;
    this.pmoContractId           = this.resolveProjectContractId(id);
    this.didUserSelectConvention = false;
    this.selectedPmoConventionId = null;
    this.idConvention            = null;
    this.pmoConventions          = [];
    this.syncProjectDateRange();
    this.clearPmoData();
    this.loadPmoConventions(id);
  }

  // ─── PMO: cargar convenios del proyecto ──────────────────────────────────────
  private resolveProjectContractId(projectId: number | null): number | null {
    if (!projectId) return null;
    const project = this.pmoProjects.find((item: any) => Number(item.id) === Number(projectId));
    const candidates = [
      project?.idContrato,
      project?.id_contrato,
      project?.idContract,
      project?.id_contract,
      project?.contractId,
      project?.contract_id,
      project?.selectedContract,
      project?.idc
    ];
    for (const candidate of candidates) {
      const parsed = Number(candidate);
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return null;
  }

  loadPmoConventions(idProject: number): void {
    this.isLoadingConv = true;
    const contractId = this.resolveProjectContractId(idProject);
    this.pmoContractId = contractId;
    const scopeType = contractId ? 'Contract' : 'Project';
    const scopeId = contractId ?? idProject;
    this._convService.getConventionsByContractOrProject(scopeType, scopeId).subscribe({
      next: (res: any) => {
        this.isLoadingConv  = false;
        this.pmoConventions = Array.isArray(res) ? res : (res?.data ?? []);
        const signalConvention = this._signalsService.getConventionVigente()();
        if (signalConvention?.id && !this.pmoConventions.some((item: any) => Number(item.id) === Number(signalConvention.id))) {
          this.pmoConventions = [
            ...this.pmoConventions,
            { id: signalConvention.id, name: signalConvention.name, description: signalConvention.name, vigente: true, active: 1 }
          ];
        }
        if (!this.pmoConventions.length) {
          this.selectedPmoConventionId = this.SIN_CONVENIO.id;
          this.idConvention = null;
          this.obtenerDatos();
          return;
        }
        const currentSignalConventionId = this._signalsService.getConventionVigente()()?.id ?? null;
        const normalizedVigente = (value: any) =>
          value === true || value === 1 || value === '1' || value === 'true';
        this._convService.getVigenteByType(scopeType, scopeId).subscribe({
          next: (vigente) => {
            const preferredConvention =
              this.pmoConventions.find((item: any) => Number(item.id) === Number(this.selectedPmoConventionId)) ??
              this.pmoConventions.find((item: any) => Number(item.id) === Number(signalConvention?.id)) ??
              this.pmoConventions.find((item: any) => Number(item.id) === Number(vigente?.id)) ??
              this.pmoConventions.find((item: any) => Number(item.id) === Number(currentSignalConventionId)) ??
              this.pmoConventions.find((item: any) => normalizedVigente(item.vigente)) ??
              this.pmoConventions[0];
            this.onPmoConventionSelected(preferredConvention.id);
          },
          error: () => {
            const preferredConvention =
              this.pmoConventions.find((item: any) => Number(item.id) === Number(this.selectedPmoConventionId)) ??
              this.pmoConventions.find((item: any) => Number(item.id) === Number(signalConvention?.id)) ??
              this.pmoConventions.find((item: any) => Number(item.id) === Number(currentSignalConventionId)) ??
              this.pmoConventions.find((item: any) => normalizedVigente(item.vigente)) ??
              this.pmoConventions[0];
            this.onPmoConventionSelected(preferredConvention.id);
          }
        });
      },
      error: () => {
        this.isLoadingConv  = false;
        this.pmoConventions = [];
        this.selectedPmoConventionId = this.SIN_CONVENIO.id;
        this.idConvention   = null;
        this.obtenerDatos();
      }
    });
  }

  private syncProjectDateRange(): void {
    if (!this.selectedPmoProjectId || !this.pmoProjects.length) return;
    const project = this.pmoProjects.find((item: any) => Number(item.id) === Number(this.selectedPmoProjectId));
    const start = project?.programStart || project?.startDate || project?.start;
    const end = project?.programEnd || project?.endDate || project?.end;
    if (start) this.dailyViewFrom = String(start).split('T')[0];
    if (end) this.dailyViewTo = String(end).split('T')[0];
  }

  onPmoConventionSelected(id: number): void {
    this.didUserSelectConvention = true;
    this.selectedPmoConventionId = id;
    this.idConvention            = id === this.SIN_CONVENIO.id ? null : id;
    this.clearPmoData();
    this.obtenerDatos();
  }

  private clearPmoData(): void {
    this.rowData          = [];
    this.datosMensuales   = [];
    this.monthlyTableData = [];
    this.showDailyView    = false;
    this.generateResult   = null;
    this.dailyRows        = [];
  }

  // ─── Cargar Curva S ──────────────────────────────────────────────────────────
  obtenerDatos(): void {
    if (this.isPmoScope) {
      this._advancesService.getAdvancesByProject(this.idProject, 'Project').subscribe({
        next: (advances: any) => this.processAdvances(advances as ContractAdvance[]),
        error: () => alerts.basicAlert('Error', 'Error al cargar los avances.', 'error')
      });
      return;
    }
    // Contexto Proyectos: tiene contrato
    if (this.curretnContractSelected) {
      this._advancesService.getAdvancesByContract(this.curretnContractSelected, 'Contract').subscribe({
        next: (advances: any) => this.processAdvances(advances as ContractAdvance[]),
        error: () => alerts.basicAlert('Error', 'Error al cargar los avances.', 'error')
      });
      return;
    }
    // Sin contexto: limpiar grid
    this.rowData          = [];
    this.datosMensuales   = [];
    this.monthlyTableData = [];
  }

  private processAdvances(advances: ContractAdvance[]): void {
    const sorted = [...advances].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    let acumProg = 0, acumFis = 0;
    this.datosMensuales = sorted.map(adv => {
      acumProg += Number(adv.programAdvanced  ?? 0);
      acumFis  += Number(adv.physicalAdvanced ?? 0);
      return {
        id: Number(adv.id),
        date: String(adv.date).split('T')[0],
        programAdvanced:    Number(adv.programAdvanced),
        physicalAdvanced:   Number(adv.physicalAdvanced),
        accumulateProgram:  this.normalizeClosingPercent(Math.round(acumProg * 1000) / 1000),
        accumulatePhysical: this.normalizeClosingPercent(Math.round(acumFis  * 1000) / 1000),
        idContract: adv.idContract,
      };
    });
    this.rowData = [...this.datosMensuales];
    this.actualizarDatos();
    if (this.showDailyView) this.loadDailyView();
  }

  private actualizarDatos(): void {
    const sorted       = [...this.datosMensuales].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const xCategories  = sorted.map(d => {
      const dt = new Date(d.date + 'T00:00:00');
      return `${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')}/${dt.getFullYear().toString().substring(2)}`;
    });
    const programSeries  = sorted.map(d => Math.round((d.accumulateProgram  ?? 0) * 100) / 100);
    const physicalSeries = sorted.map(d => Math.round((d.accumulatePhysical ?? 0) * 100) / 100);
    const maxAcum = Math.max(...programSeries, ...physicalSeries, 10);
    const yMax    = Math.min(110, Math.ceil(maxAcum / 10) * 10 + 10);

    this.chartOptions = {
      series: [
        { name: 'Programado Acumulado', data: programSeries,  type: 'line'   },
        { name: 'Real Acumulado',        data: physicalSeries, type: 'line'   },
        { name: 'Programado (barra)',     data: programSeries,  type: 'column' },
        { name: 'Real (barra)',           data: physicalSeries, type: 'column' },
      ],
      chart: {
        height: 340, type: 'line' as any, stacked: false,
        fontFamily: "'Segoe UI', sans-serif", toolbar: { show: true },
        background: '#fff', animations: { enabled: true, speed: 600 }
      },
      colors: ['#e67e22', '#2980b9', '#f39c12', '#3498db'],
      dataLabels: { enabled: false },
      fill: {
        type: ['gradient', 'gradient', 'solid', 'solid'] as any,
        gradient: { shade: 'light', type: 'vertical', opacityFrom: 0.3, opacityTo: 0.05 }
      },
      stroke: { curve: 'smooth', width: [4, 4, 0, 0], lineCap: 'round' },
      plotOptions: { bar: { columnWidth: '40%', borderRadius: 2 } },
      title: {
        text: 'Curva S — Avance Programado vs Real', align: 'left',
        style: { fontSize: '14px', fontWeight: '700', color: '#1a237e' }
      },
      grid: { show: true, borderColor: '#e8eaf6', strokeDashArray: 3 },
      markers: { size: 4, strokeWidth: 2, hover: { size: 7 } },
      xaxis: {
        categories: xCategories,
        tickAmount: Math.min(xCategories.length, 20),
        labels: { rotate: xCategories.length > 10 ? -45 : 0, style: { colors: '#555', fontSize: '10px' } }
      },
      yaxis: {
        min: 0, max: yMax, tickAmount: 10,
        title: { text: 'Avance Acumulado (%)' },
        labels: { formatter: (v: number) => v.toFixed(0) + '%' }
      },
      legend: { position: 'top', horizontalAlign: 'center', fontSize: '12px' },
      tooltip: { shared: true, intersect: false, y: { formatter: (v: number) => v != null ? v.toFixed(2) + '%' : '' } }
    };

    const byYearMonth: { [key: string]: ContractAdvance[] } = {};
    this.datosMensuales.forEach(d => {
      const dt  = new Date(d.date + 'T00:00:00');
      const key = `${dt.getFullYear()}-${String(dt.getMonth()).padStart(2, '0')}`;
      if (!byYearMonth[key]) byYearMonth[key] = [];
      byYearMonth[key].push(d);
    });
    this.monthlyTableData = Object.keys(byYearMonth).sort().map(key => {
      const [yearStr, monthIdxStr] = key.split('-');
      const records = byYearMonth[key];
      const last    = records[records.length - 1];
      return {
        month:    `${this.ALL_MONTHS[Number(monthIdxStr)]} '${yearStr.substring(2)}`,
        program:  Math.round((last.accumulateProgram  ?? 0) * 10) / 10,
        physical: Math.round((last.accumulatePhysical ?? 0) * 10) / 10,
        hito:     Math.round(records.reduce((s, r) => s + Number(r.programAdvanced), 0) * 10) / 10,
      };
    });

    if (this.chart?.updateOptions) this.chart.updateOptions(this.chartOptions);
  }

  private cleanDataForServer(data: ContractAdvance): any {
    const clean: any = { ...data };
    delete clean.__isNew; delete clean.__modified;
    if (clean.id && String(clean.id).startsWith('temp_')) delete clean.id;
    // Contexto PMO: asegurar type=Project
    const isPmo = this.isPmoScope;
    clean.type   = isPmo ? 'Project' : 'Contract';
    clean.active = 1;
    if (isPmo) clean.idProject = this.idProject;
    return clean;
  }

  // ─── Importar Excel ──────────────────────────────────────────────────────────
  importExcel(event: any): void {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const wb    = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data: any[] = XLSX.utils.sheet_to_json(sheet, { raw: true });
      const isPmo = this.isPmoScope;
      const processed = data.map((row: any) => ({
        date:             this.excelDateToISO(Number(row['Fecha'])),
        programAdvanced:  Number(row['Programado'] ?? 0),
        physicalAdvanced: Number(row['Fisico']     ?? 0),
        ...(isPmo
          ? { idProject: this.idProject, type: 'Project' }
          : { idContract: this.curretnContractSelected, type: 'Contract' }),
        active: 1,
      }));
      processed.forEach(item => this._advancesService.addAdvance(item).subscribe());
      setTimeout(() => this.obtenerDatos(), 1200);
      alerts.basicAlert('Importado', `${processed.length} registros importados.`, 'success');
    };
    reader.readAsArrayBuffer(file);
  }

  private excelDateToISO(serial: number): string {
    const date = new Date((serial - 1) * 86400000);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  ⚙️ PANEL ENGRANAJE — Configuración días laborables
  // ════════════════════════════════════════════════════════════════════════════

  async openCalendarPanel(): Promise<void> {
    this.showCalendarPanel = !this.showCalendarPanel;
    if (!this.showCalendarPanel) return;

    // Intentar cargar config existente
    try {
      const cfg = await lastValueFrom(
        this._calendarService.get(this.idProject!, this.effectiveContractId, this.idConvention)
      );
      this.calendarConfig = { ...cfg };
    } catch {
      // 404 = no existe todavía → defaults L-V
      this.calendarConfig = {
        idProject:    this.idProject    ?? 0,
        idContract:   this.effectiveContractId,
        idConvention: this.idConvention,
        lunes: true, martes: true, miercoles: true,
        jueves: true, viernes: true, sabado: false, domingo: false
      };
    }
  }

  async saveCalendar(): Promise<void> {
    if (!this.idProject) { alerts.basicAlert('Sin proyecto', 'Selecciona un proyecto.', 'warning'); return; }
    this.isSavingCalendar = true;
    try {
      this.calendarConfig.idProject    = this.idProject;
      this.calendarConfig.idContract   = this.effectiveContractId;
      this.calendarConfig.idConvention = this.idConvention;
      await lastValueFrom(this._calendarService.save(this.calendarConfig));
      alerts.basicAlert('✅ Guardado', 'Configuración de días laborables guardada.', 'success');
      this.showCalendarPanel = false;
    } catch {
      alerts.basicAlert('Error', 'No se pudo guardar la configuración.', 'error');
    } finally {
      this.isSavingCalendar = false;
    }
  }

  get workingDaysCount(): number {
    return [this.calendarConfig.lunes, this.calendarConfig.martes,
            this.calendarConfig.miercoles, this.calendarConfig.jueves,
            this.calendarConfig.viernes, this.calendarConfig.sabado,
            this.calendarConfig.domingo].filter(Boolean).length;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  📊 CALCULAR DISTRIBUCIÓN DIARIA
  // ════════════════════════════════════════════════════════════════════════════

  async generateDistribution(): Promise<void> {
    if (!this.idProject) { alerts.basicAlert('Sin proyecto', 'Selecciona un proyecto.', 'warning'); return; }

    const confirm = await alerts.confirmAlert(
      '¿Calcular distribución?',
      'Se borrará la distribución previa y se recalculará desde cero.\nTambién se actualizará la Curva S (programados semanales).\n¿Continuar?',
      'question', 'Sí, calcular'
    );
    if (!confirm.isConfirmed) return;

    this.isGenerating   = true;
    this.generateStep   = 1;
    this.genTotal2      = 0;
    this.genDone2       = 0;
    this.generateResult = null;
    try {
      await this.syncDailyViewRangeFromWorkprogram();

      // ── PASO 1: Distribución de días por concepto ────────────────────────────
      const res = await lastValueFrom(
        this._dailyService.generate(this.idProject, this.effectiveContractId, this.idConvention)
      );
      this.generateResult = res;

      if (!res.success) {
        alerts.basicAlert('Sin datos', res.mensaje, 'warning');
        return;
      }

      // ── PASO 2: Insertar/Actualizar en tabla advanced (Curva S por período) ───
      this.generateStep = 2;
      await this.autoPopulateProgramAdvances();

      alerts.basicAlert(
        '✅ Distribución generada',
        `${res.conceptosProcesados} conceptos → ${res.filasGeneradas} días calculados.\n${this.genDone2} semanas grabadas en Curva S.`,
        'success'
      );
      this.showDailyView = true;
      await this.loadDailyView();
      this.obtenerDatos();

    } catch {
      alerts.basicAlert('Error', 'No se pudo calcular la distribución.', 'error');
    } finally {
      this.isGenerating = false;
      this.generateStep = 0;
    }
  }

  // ─── Inserta/actualiza avances programados semanales en tabla advanced ───────
  private async autoPopulateProgramAdvances(): Promise<void> {
    // 1. Obtener resumen diario completo para el rango del proyecto
    const allSummaries = await lastValueFrom(
      this._dailyService.getSummary(
        this.idProject!,
        this.effectiveContractId,
        this.idConvention,
        this.dailyViewFrom,
        this.dailyViewTo
      )
    ).catch(() => [] as DailySummary[]);

    if (!allSummaries?.length) return;

    // 2. Agrupar por período configurable (día / semana / quincena / mes)
    const getPeriodKey = (rawDate: string): string => {
      const d = new Date(rawDate + 'T12:00:00');
      switch (this.genPeriodo) {
        case 'dia':
          return rawDate;                                   // cada día es su propio período
        case 'semana': {                                    // viernes de la semana
          const dw = d.getDay();
          d.setDate(d.getDate() + (dw === 0 ? -2 : dw === 6 ? -1 : 5 - dw));
          return d.toISOString().substring(0, 10);
        }
        case 'quincena': {                                  // 15 ó último día del mes
          if (d.getDate() <= 15) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`;
          } else {
            return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().substring(0, 10);
          }
        }
        case 'mes':                                         // último día del mes
        default:
          return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().substring(0, 10);
      }
    };

    const periodMap = new Map<string, number>();
    for (const s of allSummaries) {
      const key = getPeriodKey(String(s.date).substring(0, 10));
      periodMap.set(key, (periodMap.get(key) ?? 0) + Number(s.ponderadoDia ?? 0));
    }
    if (!periodMap.size) return;

    // 3. Ordenar períodos y normalizar a exactamente 100.00
    //    La BD usa decimal(18,2) → solo 2 decimales útiles.
    //    Si los ponderados del workprogram no suman 100 (ej. 101.02), escalamos primero.
    //    Luego usamos aritmética entera de "centésimas" para evitar deriva de punto flotante:
    //    suma = accumulatedCents + (10000 − accumulatedCents) = 10000 = 100.00 exacto.
    const weekEntries = Array.from(periodMap.entries()).sort(([a], [b]) => a.localeCompare(b));
    const rawTotal    = weekEntries.reduce((s, [, v]) => s + v, 0);
    const scale       = rawTotal > 0 ? 100 / rawTotal : 1;   // normalizar al 100% real
    let accumulatedCents = 0;                                  // entero: suma × 100
    const normalizedWeeks: [string, number][] = weekEntries.map(([date, value], i) => {
      if (i < weekEntries.length - 1) {
        const cents = Math.round(value * scale * 100);        // 2dp como entero
        accumulatedCents += cents;
        return [date, cents / 100];
      } else {
        // Último período = resto exacto en centésimas → cierra SIEMPRE a 100.00
        return [date, (10000 - accumulatedCents) / 100];
      }
    });

    // 4. Cargar avances existentes para saber cuáles actualizar vs crear
    const existingRaw: any = await lastValueFrom(
      this._advancesService.getAdvancesByProject(this.idProject!, 'Project')
    ).catch(() => []);
    const existing: any[] = Array.isArray(existingRaw) ? existingRaw
                          : ((existingRaw as any)?.data ?? []);
    const existingByDate = new Map<string, any>(
      existing.map((a: any) => [String(a.date ?? '').substring(0, 10), a])
    );

    // 5. Insertar/actualizar uno a uno — permite mostrar progreso real (X/N)
    this.genTotal2 = normalizedWeeks.length;
    this.genDone2  = 0;

    for (const [weekDate, programAdvanced] of normalizedWeeks) {
      const found = existingByDate.get(weekDate);
      try {
        if (found?.id && !String(found.id).startsWith('temp_')) {
          // Actualizar programAdvanced — conservar physicalAdvanced del usuario
          await lastValueFrom(this._advancesService.updateAdvance(Number(found.id), {
            ...found,
            programAdvanced,
            type:      'Project',
            idProject: this.idProject,
            idConvenio: this.idConvention ?? 0,
            active:    1,
          }));
        } else {
          await lastValueFrom(this._advancesService.addAdvance({
            date:               weekDate,
            programAdvanced,
            physicalAdvanced:   0,
            accumulateprogram:  0,
            accumulatephysical: 0,
            type:               'Project',
            idProject:          this.idProject,
            idConvenio:         this.idConvention ?? 0,
            active:             1,
          }));
        }
      } catch { /* ignorar errores individuales — continuar con el resto */ }
      this.genDone2++;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  📅 VISTA DIARIA — Barras programado vs real
  // ════════════════════════════════════════════════════════════════════════════

  async toggleDailyView(): Promise<void> {
    this.showDailyView = !this.showDailyView;
    if (this.showDailyView) await this.loadDailyView();
  }

  async loadDailyView(): Promise<void> {
    if (!this.idProject) return;
    this.isLoadingDaily = true;
    this.dailyRows = [];
    try {
      await this.syncDailyViewRangeFromWorkprogram();
      // 1. Programado: de workprogram_daily
      const summaries = await this.getDailySummariesWithFallback();

      // 2. Real: del mapa de datosMensuales (physicalAdvanced por fecha)
      const realMap = new Map<string, number>();
      this.datosMensuales.forEach(d => {
        const key = String(d.date).substring(0, 10);
        realMap.set(key, (realMap.get(key) ?? 0) + Number(d.physicalAdvanced ?? 0));
      });

      // 3. Construir filas combinadas
      this.dailyRows = summaries.map(s => {
        const dateStr = String(s.date).substring(0, 10);
        const real    = realMap.get(dateStr) ?? 0;
        const prog    = Number(s.ponderadoDia ?? 0);
        const pct     = prog > 0 ? Math.min(100, Math.round((real / prog) * 100)) : 0;
        const dayIdx  = new Date(dateStr + 'T00:00:00').getDay();
        return {
          date:        dateStr,
          dayName:     this.DAY_NAMES[dayIdx],
          programado:  Math.round(prog  * 10000) / 10000,
          real:        Math.round(real  * 10000) / 10000,
          numConceptos: s.numConceptos,
          pctBar:      pct
        };
      });

    } catch {
      alerts.basicAlert('Error', 'No se pudo cargar la vista diaria. ¿Ya calculaste la distribución?', 'warning');
    } finally {
      this.isLoadingDaily = false;
    }
  }

  // ─── Getters totales para tfoot ──────────────────────────────────────────────
  private async syncDailyViewRangeFromWorkprogram(): Promise<void> {
    if (!this.idProject) return;

    try {
      const tasks: any[] = await lastValueFrom(
        this.idConvention
          ? this._workprogramsService.getByConvention(this.idConvention, this.idProject ?? undefined)
          : this.effectiveContractId
          ? this._workprogramsService.getWorkPrograms(this.effectiveContractId, 'Contract')
          : this._workprogramsService.getWorkPrograms(this.idProject, 'Project')
      );

      if (!tasks?.length) return;

      const startDates = tasks
        .map(task => task?.startDate ? String(task.startDate).split('T')[0] : null)
        .filter(Boolean)
        .sort();

      const endDates = tasks
        .map(task => task?.endDate ? String(task.endDate).split('T')[0] : null)
        .filter(Boolean)
        .sort();

      const minStart = startDates[0];
      const maxEnd = endDates[endDates.length - 1];

      if (minStart && (!this.dailyViewFrom || minStart < this.dailyViewFrom)) {
        this.dailyViewFrom = minStart;
      }

      if (maxEnd && (!this.dailyViewTo || maxEnd > this.dailyViewTo)) {
        this.dailyViewTo = maxEnd;
      }
    } catch {
      // Si no se puede resolver el rango, conservar el rango actual de la vista.
    }
  }

  private async getDailySummariesWithFallback(): Promise<DailySummary[]> {
    const scopes = [
      { idContract: this.effectiveContractId, idConvention: this.idConvention },
      { idContract: this.effectiveContractId, idConvention: null },
      { idContract: null, idConvention: this.idConvention },
      { idContract: null, idConvention: null }
    ];

    for (const scope of scopes) {
      const summaries = await lastValueFrom(
        this._dailyService.getSummary(
          this.idProject!,
          scope.idContract,
          scope.idConvention,
          this.dailyViewFrom,
          this.dailyViewTo
        )
      );

      if (summaries?.length) {
        return summaries;
      }
    }

    return [];
  }

  private async getProgramAdvanceForDate(date: string): Promise<number> {
    const scopes = [
      { idContract: this.effectiveContractId, idConvention: this.idConvention },
      { idContract: this.effectiveContractId, idConvention: null },
      { idContract: null, idConvention: this.idConvention },
      { idContract: null, idConvention: null }
    ];

    for (const scope of scopes) {
      const summaries = await lastValueFrom(
        this._dailyService.getSummary(
          this.idProject!,
          scope.idContract,
          scope.idConvention,
          date,
          date
        )
      );

      if (summaries?.length) {
        return Math.round(
          summaries.reduce((sum, item) => sum + Number(item.ponderadoDia ?? 0), 0) * 1000
        ) / 1000;
      }
    }

    return 0;
  }

  private normalizeClosingPercent(value: number | null | undefined): number {
    const numeric = Number(value ?? 0);
    // Snap a 100 cualquier valor dentro de ±0.1 — cubre deriva de punto flotante al leer 2dp de BD
    if (Math.abs(100 - numeric) <= 0.1) {
      return 100;
    }
    return numeric;
  }

  get totalProgramadoPeriodo(): number {
    return this.normalizeClosingPercent(
      Math.round(this.dailyRows.reduce((s, r) => s + r.programado, 0) * 10000) / 10000
    );
  }
  get totalRealPeriodo(): number {
    return this.normalizeClosingPercent(
      Math.round(this.dailyRows.reduce((s, r) => s + r.real, 0) * 10000) / 10000
    );
  }
  get totalCumplimientoPct(): number {
    if (this.totalProgramadoPeriodo === 0) return 0;
    return Math.round((this.totalRealPeriodo / this.totalProgramadoPeriodo) * 100);
  }

  /** Color semáforo según % cumplimiento real/programado */
  barColor(pct: number): string {
    if (pct === 0)    return '#adb5bd'; // gris — sin real
    if (pct >= 95)    return '#198754'; // verde — cumplido
    if (pct >= 70)    return '#fd7e14'; // naranja — parcial
    return '#dc3545';                   // rojo — bajo
  }

  /** Ancho de la barra real relativo al programado (para visualización) */
  realBarWidth(row: DailyRow): number {
    if (row.programado === 0) return 0;
    return Math.min(100, (row.real / row.programado) * 100);
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  CAPTURA DIARIA (Punto 6 — existente)
  // ════════════════════════════════════════════════════════════════════════════

  async openDailyCapture(): Promise<void> {
    this.showDailyCapture = !this.showDailyCapture;
    if (this.showDailyCapture) await this.loadActiveTasks();
  }

  async onCaptureDateChange(): Promise<void> { await this.loadActiveTasks(); }

  recalcTotalAdvanceHoy(): void {
    const all = [...this.activeTasksData, ...this.delayedTasksData];
    this.totalPhysicalAdvanceHoy = Math.round(
      all.reduce((sum, t) => sum + (Number(t.ponderado ?? 0) * Number(t.avanceHoy ?? 0) / 100), 0) * 1000
    ) / 1000;
  }

  async loadActiveTasks(): Promise<void> {
    this.isLoadingTasks  = true;
    this.activeTasksData = []; this.delayedTasksData = [];
    this.totalPhysicalAdvanceHoy = 0; this.programAdvanceHoy = 0;
    try {
      const allTasks: any[] = await lastValueFrom(
        this.idConvention
          ? this._workprogramsService.getByConvention(this.idConvention, this.idProject ?? undefined)
          : this.effectiveContractId
          ? this._workprogramsService.getWorkPrograms(this.effectiveContractId!, 'Contract')
          : this._workprogramsService.getWorkPrograms(this.idProject, 'Project')
      );
      if (!allTasks?.length) { alerts.basicAlert('Sin tareas', 'No hay tareas en el programa de trabajo.', 'warning'); return; }

      const parentSet = new Set(allTasks.map(t => String(t.parent)));
      const leafTasks = allTasks.filter(t => !parentSet.has(String(t.idTask)) && Number(t.ponderado ?? 0) > 0);
      if (!leafTasks.length) {
        alerts.basicAlert('Sin ponderado', 'Las tareas no tienen ponderado calculado.', 'warning'); return;
      }
      this.programAdvanceHoy = await this.getProgramAdvanceForDate(this.dailyCaptureDate);
      const captureDate = this.dailyCaptureDate;                          // YYYY-MM-DD local
      leafTasks.forEach(t => {
        const startDate = t.startDate ? String(t.startDate).split('T')[0] : '';
        const endDate   = t.endDate   ? String(t.endDate).split('T')[0]   : '9999-12-31';
        const prog100 = Math.round(Number(t.progress ?? 0) * 100 * 10) / 10;
        const task: ActiveTask = {
          idEntry: Number(t.id), activity: t.activity || '',
          description: t.text || t.description || '',
          ponderado: Number(t.ponderado ?? 0), progressActual: prog100,
          avanceHoy: 0, progressNuevo: prog100,
          startDate, endDate,
        };
        // Comparar strings ISO (evita problemas de timezone UTC vs local)
        if (startDate <= captureDate && captureDate <= endDate) this.activeTasksData.push(task);
        else if (endDate < captureDate && prog100 < 100)        this.delayedTasksData.push(task);
      });
      this.activeTasksData  = [...this.activeTasksData.sort( (a,b) => a.activity.localeCompare(b.activity))];
      this.delayedTasksData = [...this.delayedTasksData.sort((a,b) => a.activity.localeCompare(b.activity))];
    } catch { alerts.basicAlert('Error', 'No se pudieron cargar las tareas.', 'error'); }
    finally { this.isLoadingTasks = false; }
  }

  async saveDailyAdvance(): Promise<void> {
    const modified = [...this.activeTasksData, ...this.delayedTasksData].filter(t => t.__modified && t.avanceHoy > 0);
    if (!modified.length && this.totalPhysicalAdvanceHoy === 0) {
      alerts.basicAlert('Sin cambios', 'No se registraron avances para guardar.', 'warning'); return;
    }
    this.isSavingDailyAdvance = true;
    try {
      for (const task of modified) {
        await lastValueFrom(this._workprogramsService.patchWorkProgramProgress(task.idEntry, Math.min(1, task.progressNuevo / 100)));
      }
      const lastRec     = this.datosMensuales.length > 0 ? this.datosMensuales[this.datosMensuales.length - 1] : null;
      const newAccumPrg = this.normalizeClosingPercent(
        Math.round(((lastRec?.accumulateProgram  ?? 0) + this.programAdvanceHoy) * 1000) / 1000
      );
      const newAccumFis = this.normalizeClosingPercent(
        Math.round(((lastRec?.accumulatePhysical ?? 0) + this.totalPhysicalAdvanceHoy) * 1000) / 1000
      );
      const isPmo       = this.isPmoScope;
      await lastValueFrom(this._advancesService.addAdvance({
        date: this.dailyCaptureDate,
        programAdvanced:    this.programAdvanceHoy,
        physicalAdvanced:   this.totalPhysicalAdvanceHoy,
        accumulateProgram:  newAccumPrg,
        accumulatePhysical: newAccumFis,
        ...(isPmo
          ? { idProject: this.idProject, type: 'Project' }
          : { idContract: this.curretnContractSelected, type: 'Contract' }),
        active: 1,
      }));
      alerts.basicAlert('✅ Avance registrado',
        `Físico del día: ${this.totalPhysicalAdvanceHoy.toFixed(3)}%\nAcumulado: ${newAccumFis.toFixed(2)}%`, 'success');
      this.obtenerDatos();
      await this.loadActiveTasks();
    } catch { alerts.basicAlert('Error', 'Error al registrar el avance diario.', 'error'); }
    finally { this.isSavingDailyAdvance = false; }
  }
}
