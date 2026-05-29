import { Component, effect, inject, OnChanges, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { AdvanceService } from 'app/services/advance.service';
import { SignalsService } from 'app/services/signals.service';
import { WorkprogramsService } from 'app/services/workprograms.service';
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
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  title: ApexTitleSubtitle;
  dataLabels: ApexDataLabels;
  plotOptions: ApexPlotOptions;
  yaxis: ApexYAxis;
  colors: string[];
  fill: ApexFill;
  tooltip: ApexTooltip;
  markers: ApexMarkers;
  stroke: ApexStroke;
  grid: ApexGrid;
  legend: ApexLegend;
};

interface ContractAdvance {
  id?: string | number;
  __isNew?: boolean;
  __modified?: boolean;
  accumulateProgram?: number;
  accumulatePhysical?: number;
  date: string;
  physicalAdvanced: number;
  programAdvanced: number;
  idContract?: number;
}

interface ActiveTask {
  idEntry: number;
  activity: string;
  description: string;
  ponderado: number;
  progressActual: number;  // 0-100
  avanceHoy: number;       // editable — avance INCREMENTAL hoy (0-100)
  progressNuevo: number;   // read-only = progressActual + avanceHoy (cap 100)
  startDate: string;
  endDate: string;
  __modified?: boolean;
}

@Component({
  selector: 'app-advances',
  standalone: true,
  imports: [CommonModule, AgGridModule, NgApexchartsModule, FormsModule],
  templateUrl: './advances.component.html',
  styleUrl: './advances.component.scss'
})
export class AdvancesComponent implements OnInit, OnChanges {

  // Exponer Math al template
  readonly Math = Math;

  // ─── Servicios ──────────────────────────────────────────────────────────────
  private _signalsService      = inject(SignalsService);
  private _advancesService     = inject(AdvanceService);
  private _workprogramsService = inject(WorkprogramsService);

  // ─── Grid Curva S ───────────────────────────────────────────────────────────
  private gridApi: GridApi;
  datosMensuales: ContractAdvance[]  = [];
  monthlyTableData: any[]             = [];
  rowData: ContractAdvance[]          = [];
  selectedRowData: ContractAdvance | null = null;
  notSavedChanges  = false;
  newlyAddedRows: string[] = [];
  private tempIdCounter = 0;

  curretnContractSelected: number | null = null;
  idProject: number | null = null;
  idConvention: number | null = null;

  private readonly ALL_MONTHS = [
    'ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
    'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'
  ];

  // ─── Gráfica Curva S ────────────────────────────────────────────────────────
  @ViewChild('chart') chart: ChartComponent;
  public chartOptions: Partial<ChartOptions> = { series: [], chart: { type: 'line', height: 350 } };

  // ─── Punto 6 — Captura Diaria por Tarea ────────────────────────────────────
  showDailyCapture    = false;
  dailyCaptureDate    = new Date().toISOString().split('T')[0];
  activeTasksData: ActiveTask[]  = [];
  delayedTasksData: ActiveTask[] = [];
  isSavingDailyAdvance = false;
  isLoadingTasks       = false;
  totalPhysicalAdvanceHoy = 0;
  programAdvanceHoy   = 0;   // el usuario puede indicar el programado del día

  // ─── Column defs: grid de avances (Curva S) ─────────────────────────────────
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
    {
      field: 'programAdvanced', headerName: 'Prog.(%)', width: 85, editable: true,
      valueFormatter: p => p.value != null ? Number(p.value).toFixed(2) : ''
    },
    {
      field: 'physicalAdvanced', headerName: 'Físico(%)', width: 85, editable: true,
      valueFormatter: p => p.value != null ? Number(p.value).toFixed(2) : ''
    },
    {
      field: 'accumulateProgram', headerName: 'Acum.Prog.', width: 95, editable: false,
      cellStyle: { background: '#f8f9fa', color: '#495057' },
      valueFormatter: p => p.value != null ? Number(p.value).toFixed(2) + '%' : ''
    },
    {
      field: 'accumulatePhysical', headerName: 'Acum.Fís.', width: 95, editable: false,
      cellStyle: { background: '#f8f9fa', color: '#495057' },
      valueFormatter: p => p.value != null ? Number(p.value).toFixed(2) + '%' : ''
    },
  ];

  // ─── Column defs: grid de tareas activas / retrasadas ───────────────────────
  public activeTasksColDefs: ColDef[] = [
    { field: 'activity',       headerName: 'Actividad',      width: 90  },
    { field: 'description',    headerName: 'Descripción',     flex: 1,  minWidth: 180 },
    { field: 'ponderado',      headerName: 'Pond.(%)',        width: 80, valueFormatter: p => p.value != null ? Number(p.value).toFixed(3) : '—' },
    { field: 'progressActual', headerName: 'Prog.Act.(%)',    width: 100, valueFormatter: p => p.value != null ? Number(p.value).toFixed(1) + '%' : '0%' },
    {
      field: 'avanceHoy',
      headerName: 'Avance Hoy (%)',
      width: 120, editable: true,
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
    {
      field: 'progressNuevo', headerName: 'Prog.Nuevo(%)', width: 110,
      editable: false,
      cellStyle: { background: '#f1f7ff', color: '#0e4491', fontWeight: '600' },
      valueFormatter: p => p.value != null ? Number(p.value).toFixed(1) + '%' : '—'
    },
    { field: 'startDate', headerName: 'Inicio', width: 90 },
    { field: 'endDate',   headerName: 'Fin',    width: 90 },
  ];

  // ─── Grid options ────────────────────────────────────────────────────────────
  public gridOptions: any = {
    headerHeight: 28,
    rowHeight: 26,
    rowSelection: 'single',
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
      this.curretnContractSelected  = this._signalsService.getContractSelectedBySidebar()();
      this.idProject                = this._signalsService.getProjectSelectedBySidebar()();
      const vigente                 = this._signalsService.getConventionVigente()();
      this.idConvention             = vigente?.id ?? null;
      this.obtenerDatos();
    });
  }

  ngOnInit(): void {}
  ngOnChanges(_: SimpleChanges): void {}

  onGridReady(params: GridReadyEvent): void { this.gridApi = params.api; }

  // ─── Cambio de celda → recalcular acumulados en pantalla ────────────────────
  onCellValueChanged(_event: any): void {
    this.notSavedChanges = true;
    _event.data.__modified = true;
    this.recalcAccumulationInGrid();
  }

  /** Recalcula accumulateProgram / accumulatePhysical en el grid (sort por fecha) */
  private recalcAccumulationInGrid(): void {
    const rows: ContractAdvance[] = [];
    this.gridApi?.forEachNode(n => rows.push(n.data));
    rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let prog = 0, fis = 0;
    rows.forEach(r => {
      prog += Number(r.programAdvanced  ?? 0);
      fis  += Number(r.physicalAdvanced ?? 0);
      r.accumulateProgram  = Math.round(prog * 1000) / 1000;
      r.accumulatePhysical = Math.round(fis  * 1000) / 1000;
    });
    this.gridApi?.refreshCells({ force: true });
  }

  // ─── Agregar fila ────────────────────────────────────────────────────────────
  addRow(): void {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem: ContractAdvance = {
      id:               tempId,
      date:             new Date().toISOString().split('T')[0],
      idContract:       this.curretnContractSelected ?? 0,
      physicalAdvanced: 0,
      programAdvanced:  0,
      accumulateProgram: 0,
      accumulatePhysical: 0,
      __isNew: true,
    };
    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
    setTimeout(() => this.gridApi?.startEditingCell({ rowIndex: 0, colKey: 'date' }), 50);
  }

  // ─── Eliminar registro ───────────────────────────────────────────────────────
  async deleteEntry(): Promise<void> {
    if (!this.selectedRowData) {
      alerts.basicAlert('Sin selección', 'Haz clic en una fila para seleccionarla.', 'warning');
      return;
    }
    const id = this.selectedRowData.id;
    // Fila nueva aún no guardada
    if (id && String(id).startsWith('temp_')) {
      this.rowData = this.rowData.filter(r => r.id !== id);
      this.selectedRowData = null;
      this.notSavedChanges = this.rowData.some(r => r.__isNew || r.__modified);
      return;
    }
    const result = await alerts.confirmAlert(
      '¿Eliminar registro?',
      '¿Deseas eliminar este registro de avance de la Curva S?',
      'warning', 'Sí, eliminar'
    );
    if (!result.isConfirmed) return;
    try {
      await lastValueFrom(this._advancesService.deleteAdvance(Number(id)));
      alerts.basicAlert('Eliminado', 'Registro eliminado.', 'success');
      this.selectedRowData = null;
      this.obtenerDatos();
    } catch {
      alerts.basicAlert('Error', 'No se pudo eliminar el registro.', 'error');
    }
  }

  // ─── Guardar cambios ─────────────────────────────────────────────────────────
  async saveChanges(): Promise<void> {
    const valid = this.rowData.every(r => r.date && !isNaN(Number(r.programAdvanced)) && !isNaN(Number(r.physicalAdvanced)));
    if (!valid) {
      alerts.basicAlert('Campos incompletos', 'Verifica fecha y valores numéricos.', 'error');
      return;
    }
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
    } catch {
      alerts.basicAlert('Error', 'Ocurrió un error al guardar.', 'error');
    }
  }

  revert(): void { this.obtenerDatos(); this.notSavedChanges = false; }

  // ─── Cargar y recalcular datos (FIX: sort por fecha antes de acumulados) ────
  obtenerDatos(): void {
    if (!this.curretnContractSelected) return;
    this._advancesService.getAdvancesByContract(this.curretnContractSelected, 'Contract').subscribe({
      next: (advances: any) => {
        // SORT ASC por fecha antes de recalcular acumulados
        const sorted = (advances as ContractAdvance[]).sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        let acumProg = 0, acumFis = 0;
        this.datosMensuales = sorted.map(adv => {
          acumProg += Number(adv.programAdvanced  ?? 0);
          acumFis  += Number(adv.physicalAdvanced ?? 0);
          return {
            id:                Number(adv.id),
            date:              String(adv.date).split('T')[0],
            programAdvanced:   Number(adv.programAdvanced),
            physicalAdvanced:  Number(adv.physicalAdvanced),
            accumulateProgram: Math.round(acumProg * 1000) / 1000,
            accumulatePhysical: Math.round(acumFis * 1000) / 1000,
            idContract:        adv.idContract,
          };
        });
        this.rowData = [...this.datosMensuales];
        this.actualizarDatos();
      },
      error: () => alerts.basicAlert('Error', 'Error al cargar los avances.', 'error')
    });
  }

  // ─── Actualizar Curva S y tabla mensual ─────────────────────────────────────
  private actualizarDatos(): void {
    // ── Eje X con FECHAS REALES (FIX: ya no usa 12 meses fijos) ──────────────
    const sorted = [...this.datosMensuales].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const xCategories   = sorted.map(d => {
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
        height: 340,
        type: 'line' as any,
        stacked: false,
        fontFamily: "'Segoe UI', sans-serif",
        toolbar: { show: true },
        background: '#fff',
        animations: { enabled: true, speed: 600 }
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
        text: 'Curva S — Avance Programado vs Real',
        align: 'left',
        style: { fontSize: '14px', fontWeight: '700', color: '#1a237e' }
      },
      grid: { show: true, borderColor: '#e8eaf6', strokeDashArray: 3 },
      markers: { size: 4, strokeWidth: 2, hover: { size: 7 } },
      xaxis: {
        categories: xCategories,
        tickAmount: Math.min(xCategories.length, 20),
        labels: {
          rotate: xCategories.length > 10 ? -45 : 0,
          style: { colors: '#555', fontSize: '10px' }
        }
      },
      yaxis: {
        min: 0, max: yMax, tickAmount: 10,
        title: { text: 'Avance Acumulado (%)' },
        labels: { formatter: (v: number) => v.toFixed(0) + '%' }
      },
      legend: { position: 'top', horizontalAlign: 'center', fontSize: '12px' },
      tooltip: {
        shared: true, intersect: false,
        y: { formatter: (v: number) => v != null ? v.toFixed(2) + '%' : '' }
      }
    };

    // ── Tabla mensual por AÑO-MES (FIX: soporta contratos multi-año) ─────────
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

    if (this.chart?.updateOptions) {
      this.chart.updateOptions(this.chartOptions);
    }
  }

  private cleanDataForServer(data: ContractAdvance): any {
    const clean = { ...data };
    delete clean.__isNew;
    delete clean.__modified;
    if (clean.id && String(clean.id).startsWith('temp_')) delete clean.id;
    return clean;
  }

  // ─── Importar Excel ──────────────────────────────────────────────────────────
  importExcel(event: any): void {
    const file = event.target.files[0];
    if (!file) return;
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (!allowedTypes.includes(file.type)) {
      alerts.basicAlert('Error', 'Selecciona un archivo Excel (.xlsx o .xls).', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const wb        = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const sheet     = wb.Sheets[wb.SheetNames[0]];
      const data: any[] = XLSX.utils.sheet_to_json(sheet, { raw: true });
      const processed = data.map((row: any) => ({
        date:             this.excelDateToISO(Number(row['Fecha'])),
        programAdvanced:  Number(row['Programado'] ?? 0),
        physicalAdvanced: Number(row['Fisico']     ?? 0),
        idContract:       this.curretnContractSelected,
        active:           1,
      }));
      processed.forEach(item => this._advancesService.addAdvance(item).subscribe());
      setTimeout(() => this.obtenerDatos(), 1200);
      alerts.basicAlert('Importado', `${processed.length} registros importados.`, 'success');
    };
    reader.readAsArrayBuffer(file);
  }

  private excelDateToISO(serial: number): string {
    const date  = new Date((serial - 1) * 86400000);
    const y     = date.getFullYear();
    const m     = String(date.getMonth() + 1).padStart(2, '0');
    const d     = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  PUNTO 6 — Captura de Avance Diario por Tarea
  // ════════════════════════════════════════════════════════════════════════════

  /** Abre / cierra la sección de captura diaria */
  async openDailyCapture(): Promise<void> {
    this.showDailyCapture = !this.showDailyCapture;
    if (this.showDailyCapture) {
      await this.loadActiveTasks();
    }
  }

  /** Recargar tareas al cambiar la fecha */
  async onCaptureDateChange(): Promise<void> {
    await this.loadActiveTasks();
  }

  /** Calcula el total de avance físico del día en tiempo real */
  recalcTotalAdvanceHoy(): void {
    const all = [...this.activeTasksData, ...this.delayedTasksData];
    this.totalPhysicalAdvanceHoy = Math.round(
      all.reduce((sum, t) => sum + (Number(t.ponderado ?? 0) * Number(t.avanceHoy ?? 0) / 100), 0)
      * 1000
    ) / 1000;
  }

  /** Carga tareas activas y retrasadas del workprogram para la fecha seleccionada */
  async loadActiveTasks(): Promise<void> {
    this.isLoadingTasks = true;
    this.activeTasksData  = [];
    this.delayedTasksData = [];
    this.totalPhysicalAdvanceHoy = 0;
    this.programAdvanceHoy       = 0;

    try {
      // Cargar tareas del programa de trabajo
      const allTasks: any[] = await lastValueFrom(
        (this.idProject && this.idProject > 0)
          ? this._workprogramsService.getWorkPrograms(this.idProject, 'Project')
          : this._workprogramsService.getWorkPrograms(this.curretnContractSelected!, 'Contract')
      );

      if (!allTasks?.length) {
        alerts.basicAlert('Sin tareas', 'No hay tareas en el programa de trabajo para este contrato/proyecto.', 'warning');
        return;
      }

      // Tareas hoja: no aparecen como parent de otra tarea Y tienen ponderado > 0
      const parentSet = new Set(allTasks.map(t => String(t.parent)));
      const leafTasks = allTasks.filter(t =>
        !parentSet.has(String(t.idTask)) &&
        Number(t.ponderado ?? 0) > 0
      );

      if (!leafTasks.length) {
        alerts.basicAlert(
          'Sin ponderado',
          'Las tareas hoja no tienen ponderado. Ve al Programa de Trabajo, presiona ⚙️ para elegir modalidad y luego % para calcular.',
          'warning'
        );
        return;
      }

      const captureMs = new Date(this.dailyCaptureDate + 'T00:00:00').getTime();

      leafTasks.forEach(t => {
        const startMs = t.startDate ? new Date(t.startDate).getTime() : 0;
        const endMs   = t.endDate   ? new Date(t.endDate).getTime()   : Infinity;
        const prog100 = Math.round(Number(t.progress ?? 0) * 100 * 10) / 10; // 0-1 → 0-100

        const task: ActiveTask = {
          idEntry:        Number(t.id),
          activity:       t.activity   || '',
          description:    t.text       || t.description || '',
          ponderado:      Number(t.ponderado ?? 0),
          progressActual: prog100,
          avanceHoy:      0,
          progressNuevo:  prog100,
          startDate:      t.startDate ? String(t.startDate).split('T')[0] : '',
          endDate:        t.endDate   ? String(t.endDate).split('T')[0]   : '',
        };

        if (startMs <= captureMs && captureMs <= endMs) {
          this.activeTasksData.push(task);          // ← En ejecución hoy
        } else if (endMs < captureMs && prog100 < 100) {
          this.delayedTasksData.push(task);         // ← Retrasadas
        }
      });

      this.activeTasksData  = [...this.activeTasksData.sort( (a,b) => a.activity.localeCompare(b.activity))];
      this.delayedTasksData = [...this.delayedTasksData.sort((a,b) => a.activity.localeCompare(b.activity))];

    } catch {
      alerts.basicAlert('Error', 'No se pudieron cargar las tareas del programa de trabajo.', 'error');
    } finally {
      this.isLoadingTasks = false;
    }
  }

  /** Guarda: actualiza workprogram.progress + inserta registro en advanced */
  async saveDailyAdvance(): Promise<void> {
    const modified = [...this.activeTasksData, ...this.delayedTasksData].filter(
      t => t.__modified && t.avanceHoy > 0
    );

    if (!modified.length && this.totalPhysicalAdvanceHoy === 0) {
      alerts.basicAlert('Sin cambios', 'No se registraron avances para guardar.', 'warning');
      return;
    }

    this.isSavingDailyAdvance = true;
    try {
      // 1. Actualizar workprogram.progress para cada tarea modificada (PATCH — solo el campo progress)
      for (const task of modified) {
        const newFraction = Math.min(1, task.progressNuevo / 100);
        await lastValueFrom(
          this._workprogramsService.patchWorkProgramProgress(task.idEntry, newFraction)
        );
      }

      // 2. Calcular acumulados para el nuevo registro de Curva S
      const lastRec      = this.datosMensuales.length > 0 ? this.datosMensuales[this.datosMensuales.length - 1] : null;
      const prevAccumPrg = lastRec?.accumulateProgram  ?? 0;
      const prevAccumFis = lastRec?.accumulatePhysical ?? 0;
      const newAccumPrg  = Math.round((prevAccumPrg + this.programAdvanceHoy)       * 1000) / 1000;
      const newAccumFis  = Math.round((prevAccumFis + this.totalPhysicalAdvanceHoy) * 1000) / 1000;

      // 3. Insertar en tabla advanced
      await lastValueFrom(this._advancesService.addAdvance({
        date:               this.dailyCaptureDate,
        programAdvanced:    this.programAdvanceHoy,
        physicalAdvanced:   this.totalPhysicalAdvanceHoy,
        accumulateProgram:  newAccumPrg,
        accumulatePhysical: newAccumFis,
        idContract:         this.curretnContractSelected,
        type:               'Contract',
        active:             1,
      }));

      alerts.basicAlert(
        '✅ Avance registrado',
        `Avance físico del día: ${this.totalPhysicalAdvanceHoy.toFixed(3)}%\nAcumulado físico: ${newAccumFis.toFixed(2)}%`,
        'success'
      );

      // Recargar Curva S y tareas
      this.obtenerDatos();
      await this.loadActiveTasks();

    } catch {
      alerts.basicAlert('Error', 'Ocurrió un error al registrar el avance diario.', 'error');
    } finally {
      this.isSavingDailyAdvance = false;
    }
  }
}
