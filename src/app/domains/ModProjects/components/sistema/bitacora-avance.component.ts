import { Component, inject, Input, OnInit } from '@angular/core';
import { CommonModule }           from '@angular/common';
import { FormsModule }            from '@angular/forms';
import { AgGridModule }           from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams }    from 'ag-grid-enterprise';
import { lastValueFrom }          from 'rxjs';
import { WorkprogramsService }    from 'app/services/workprograms.service';
import { AdvanceService }         from 'app/services/advance.service';
import { SignalsService }         from 'app/services/signals.service';
import { alerts }                 from 'app/helpers/alerts';

interface ActiveTask {
  idEntry:        number;
  activity:       string;
  description:    string;
  ponderado:      number;   // 0-100
  progressActual: number;   // 0-100 (convertido de 0-1)
  avanceHoy:      number;   // editable — avance INCREMENTAL hoy (%)
  progressNuevo:  number;   // progressActual + avanceHoy (cap 100)
  startDate:      string;
  endDate:        string;
  __modified?:    boolean;
}

@Component({
  selector: 'app-bitacora-avance',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
<div style="padding:8px; background:#f8f9fa; border-radius:4px;">

  <!-- ── Header ──────────────────────────────────────────────────────── -->
  <div class="d-flex align-items-center gap-2 flex-wrap mb-2"
       style="background:#fff3cd; border:1px solid #ffc107; border-radius:6px; padding:8px 12px;">

    <i class="bi bi-calendar-check-fill text-warning fs-5"></i>
    <strong class="me-1">Avance Diario por Tarea</strong>

    <!-- Av. Prog. día -->
    <div class="d-flex align-items-center gap-1 ms-2">
      <label class="form-label mb-0 small fw-semibold">Av. Prog. día (%):</label>
      <input type="number" class="form-control form-control-sm"
             [(ngModel)]="programAdvanceHoy"
             min="0" max="100" step="0.01" style="width:90px;"
             title="Avance programado del día según el plan">
    </div>

    <!-- Badge avance calculado -->
    <span class="badge fs-6 px-3 py-2 ms-auto"
          [class.bg-success]="totalPhysicalAdvanceHoy > 0"
          [class.bg-secondary]="totalPhysicalAdvanceHoy === 0">
      <i class="bi bi-calculator me-1"></i>
      Avance físico: {{ totalPhysicalAdvanceHoy | number:'1.3-3' }}%
    </span>

    <!-- Botón registrar -->
    <button class="btn btn-warning btn-sm fw-semibold"
            (click)="saveDailyAdvance()"
            [disabled]="isSaving || isLoading">
      <span *ngIf="isSaving" class="spinner-border spinner-border-sm me-1" role="status"></span>
      <i *ngIf="!isSaving" class="bi bi-save me-1"></i>
      Registrar en Curva S
    </button>

    <!-- Cerrar -->
    <button class="btn btn-outline-secondary btn-sm" (click)="closeDetail()" title="Cerrar">
      <i class="bi bi-x-lg"></i>
    </button>
  </div>

  <!-- ── Spinner ──────────────────────────────────────────────────────── -->
  <div *ngIf="isLoading" class="text-center py-3">
    <div class="spinner-border spinner-border-sm text-warning me-2"></div>
    <small class="text-muted">Cargando tareas del programa de trabajo...</small>
  </div>

  <!-- ── Sin tareas ───────────────────────────────────────────────────── -->
  <div *ngIf="!isLoading && !activeTasksData.length && !delayedTasksData.length"
       class="alert alert-info py-2 small mb-0">
    <i class="bi bi-info-circle me-2"></i>
    No hay tareas activas para la fecha <strong>{{ reportDate }}</strong>, o las tareas hoja no tienen ponderado calculado.
    Ve al <strong>Programa de Trabajo → ⚙️ → % Calcular Ponderado</strong>.
  </div>

  <!-- ── En ejecución ─────────────────────────────────────────────────── -->
  <div *ngIf="!isLoading && activeTasksData.length > 0">
    <div class="d-flex align-items-center gap-2 mb-1">
      <span class="badge bg-success">▶ En ejecución: {{ activeTasksData.length }}</span>
      <small class="text-muted">Tareas cuya ventana incluye la fecha del reporte</small>
    </div>
    <ag-grid-angular
      class="ag-theme-quartz small-text-ag-grid"
      [style.height.px]="Math.min(320, 32 + activeTasksData.length * 26)"
      style="width:100%;"
      [columnDefs]="activeColDefs"
      [rowData]="activeTasksData"
      [gridOptions]="taskGridOptions"
      [stopEditingWhenCellsLoseFocus]="true"
      (gridReady)="onActiveGridReady($event)">
    </ag-grid-angular>
  </div>

  <!-- ── Retrasadas ───────────────────────────────────────────────────── -->
  <div *ngIf="!isLoading && delayedTasksData.length > 0" class="mt-2">
    <div class="d-flex align-items-center gap-2 mb-1">
      <span class="badge bg-danger">⚠ Retrasadas: {{ delayedTasksData.length }}</span>
      <small class="text-muted">Fecha de término vencida y progreso &lt; 100%</small>
    </div>
    <ag-grid-angular
      class="ag-theme-quartz small-text-ag-grid"
      [style.height.px]="Math.min(260, 32 + delayedTasksData.length * 26)"
      style="width:100%;"
      [columnDefs]="activeColDefs"
      [rowData]="delayedTasksData"
      [gridOptions]="taskGridOptions"
      [stopEditingWhenCellsLoseFocus]="true">
    </ag-grid-angular>
  </div>

  <!-- ── Fórmula ──────────────────────────────────────────────────────── -->
  <div *ngIf="!isLoading && (activeTasksData.length || delayedTasksData.length)"
       class="alert alert-light border mt-2 py-1 small mb-0">
    <i class="bi bi-info-circle me-1 text-muted"></i>
    <strong>Cálculo:</strong> Avance físico = Σ (Ponderado<sub>i</sub> × Avance Hoy<sub>i</sub>) ÷ 100
    — La columna <em>Avance Hoy</em> (fondo naranja) es editable.
  </div>

</div>
  `,
  styles: [`
    :host { display: block; }
  `]
})
export class BitacoraAvanceComponent implements OnInit, ICellRendererAngularComp {

  readonly Math = Math;

  @Input() data:    any = null;
  @Input() context: any = null;

  private _workprogramsService = inject(WorkprogramsService);
  private _advancesService     = inject(AdvanceService);
  private _signalsService      = inject(SignalsService);

  reportData: any = null;
  reportDate  = '';
  idProject   = 0;
  idContract: number | null = null;

  activeTasksData:  ActiveTask[] = [];
  delayedTasksData: ActiveTask[] = [];

  isLoading            = false;
  isSaving             = false;
  totalPhysicalAdvanceHoy = 0;
  programAdvanceHoy    = 0;

  private activeGridApi: GridApi | null = null;

  // ── Column defs ────────────────────────────────────────────────────────────
  activeColDefs: ColDef[] = [
    { field: 'activity',       headerName: 'WBS',         width: 80 },
    { field: 'description',    headerName: 'Descripción', flex: 1, minWidth: 160 },
    { field: 'ponderado',      headerName: 'Pond.(%)',    width: 80,
      valueFormatter: p => p.value != null ? Number(p.value).toFixed(3) : '—' },
    { field: 'progressActual', headerName: 'Prog.Act.(%)', width: 100,
      valueFormatter: p => p.value != null ? Number(p.value).toFixed(1) + '%' : '0%' },
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
        this.recalcTotal();
        return true;
      }
    },
    { field: 'progressNuevo', headerName: 'Prog.Nuevo(%)', width: 110, editable: false,
      cellStyle: { background: '#f1f7ff', color: '#0e4491', fontWeight: '600' },
      valueFormatter: p => p.value != null ? Number(p.value).toFixed(1) + '%' : '—' },
    { field: 'startDate', headerName: 'Inicio', width: 90 },
    { field: 'endDate',   headerName: 'Fin',    width: 90 },
  ];

  taskGridOptions: any = {
    headerHeight: 26, rowHeight: 24,
    stopEditingWhenCellsLoseFocus: true,
    onFirstDataRendered: (p: any) => p.api.sizeColumnsToFit(),
  };

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  agInit(params: ICellRendererParams): void {
    this.data       = params.data;
    this.context    = params.context;
    this.reportData = params.data;
    this.init();
  }

  refresh(params: ICellRendererParams): boolean {
    this.data = params.data; this.reportData = params.data;
    return true;
  }

  ngOnInit(): void {
    if (this.data) { this.reportData = this.data; this.init(); }
  }

  private init(): void {
    this.idProject  = this.reportData?.idProject  ?? 0;
    this.idContract = this.reportData?.idContract ?? this._signalsService.getContractSelectedBySidebar()();
    this.reportDate = this.reportData?.date
      ? String(this.reportData.date).substring(0, 10)
      : new Date().toISOString().split('T')[0];
    this.loadActiveTasks();
  }

  onActiveGridReady(e: GridReadyEvent): void { this.activeGridApi = e.api; }

  // ── Cargar tareas activas / retrasadas ─────────────────────────────────────
  async loadActiveTasks(): Promise<void> {
    if (!this.idProject && !this.idContract) return;
    this.isLoading = true;
    this.activeTasksData  = [];
    this.delayedTasksData = [];
    this.totalPhysicalAdvanceHoy = 0;

    try {
      const allTasks: any[] = await lastValueFrom(
        this.idProject > 0
          ? this._workprogramsService.getWorkPrograms(this.idProject,   'Project')
          : this._workprogramsService.getWorkPrograms(this.idContract!, 'Contract')
      );

      if (!allTasks?.length) return;

      // Solo hojas con ponderado > 0
      const parentSet = new Set(allTasks.map(t => String(t.parent)));
      const leafTasks = allTasks.filter(t =>
        !parentSet.has(String(t.idTask)) && Number(t.ponderado ?? 0) > 0
      );
      if (!leafTasks.length) return;

      const captureMs = new Date(this.reportDate + 'T00:00:00').getTime();

      leafTasks.forEach(t => {
        const startMs  = t.startDate ? new Date(t.startDate).getTime() : 0;
        const endMs    = t.endDate   ? new Date(t.endDate).getTime()   : Infinity;
        const prog100  = Math.round(Number(t.progress ?? 0) * 100 * 10) / 10;

        const task: ActiveTask = {
          idEntry:        Number(t.id),
          activity:       t.activity  || '',
          description:    t.text      || t.description || '',
          ponderado:      Number(t.ponderado ?? 0),
          progressActual: prog100,
          avanceHoy:      0,
          progressNuevo:  prog100,
          startDate:      t.startDate ? String(t.startDate).split('T')[0] : '',
          endDate:        t.endDate   ? String(t.endDate).split('T')[0]   : '',
        };

        if (startMs <= captureMs && captureMs <= endMs) {
          this.activeTasksData.push(task);
        } else if (endMs < captureMs && prog100 < 100) {
          this.delayedTasksData.push(task);
        }
      });

      this.activeTasksData  = [...this.activeTasksData.sort( (a,b) => a.activity.localeCompare(b.activity))];
      this.delayedTasksData = [...this.delayedTasksData.sort((a,b) => a.activity.localeCompare(b.activity))];

    } catch {
      // silencioso — si falla solo no muestra tareas
    } finally {
      this.isLoading = false;
    }
  }

  // ── Recalcular total ──────────────────────────────────────────────────────
  recalcTotal(): void {
    const all = [...this.activeTasksData, ...this.delayedTasksData];
    this.totalPhysicalAdvanceHoy = Math.round(
      all.reduce((sum, t) => sum + (Number(t.ponderado) * Number(t.avanceHoy) / 100), 0)
      * 1000
    ) / 1000;
  }

  // ── Registrar avance en Curva S ───────────────────────────────────────────
  async saveDailyAdvance(): Promise<void> {
    const modified = [...this.activeTasksData, ...this.delayedTasksData]
      .filter(t => t.__modified && t.avanceHoy > 0);

    if (!modified.length && this.totalPhysicalAdvanceHoy === 0) {
      alerts.basicAlert('Sin cambios', 'Ingresa el avance de al menos una tarea.', 'warning');
      return;
    }

    this.isSaving = true;
    try {
      // 1. PATCH progress en workprogram para cada tarea modificada
      for (const task of modified) {
        const fraction = Math.min(1, task.progressNuevo / 100);
        await lastValueFrom(
          this._workprogramsService.patchWorkProgramProgress(task.idEntry, fraction)
        );
      }

      // 2. Obtener acumulados del último registro
      const type = this.idProject > 0 ? 'Project' : 'Contract';
      const refId = this.idProject > 0 ? this.idProject : this.idContract!;
      let prevPrg = 0, prevFis = 0;
      try {
        const prev: any[] = await lastValueFrom(
          this._advancesService.getAdvancesByProject(refId, type)
        );
        if (prev?.length) {
          const sorted = prev.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          const last   = sorted[sorted.length - 1];
          prevPrg = Number(last.accumulateProgram  ?? 0);
          prevFis = Number(last.accumulatePhysical ?? 0);
        }
      } catch { /* sin historial previo, acumula desde 0 */ }

      const newAccumPrg = Math.round((prevPrg + this.programAdvanceHoy)       * 1000) / 1000;
      const newAccumFis = Math.round((prevFis + this.totalPhysicalAdvanceHoy) * 1000) / 1000;

      // 3. Insertar en tabla advanced
      await lastValueFrom(this._advancesService.addAdvance({
        date:               this.reportDate,
        programAdvanced:    this.programAdvanceHoy,
        physicalAdvanced:   this.totalPhysicalAdvanceHoy,
        accumulateProgram:  newAccumPrg,
        accumulatePhysical: newAccumFis,
        idProject:          this.idProject   > 0    ? this.idProject   : null,
        idContract:         this.idContract  != null ? this.idContract : null,
        type,
        active: 1,
      }));

      alerts.basicAlert(
        '✅ Avance registrado',
        `Avance físico del día: ${this.totalPhysicalAdvanceHoy.toFixed(3)}%\n` +
        `Avance programado: ${this.programAdvanceHoy.toFixed(2)}%\n` +
        `Acumulado físico: ${newAccumFis.toFixed(2)}%`,
        'success'
      );

      // Resetear avances del día y recargar para reflejar nuevos progress
      await this.loadActiveTasks();
      this.programAdvanceHoy = 0;

    } catch {
      alerts.basicAlert('Error', 'No se pudo registrar el avance. Verifica la conexión.', 'error');
    } finally {
      this.isSaving = false;
    }
  }

  // ── Cerrar detalle ────────────────────────────────────────────────────────
  closeDetail(): void {
    if (this.context?.componentParent?.collapseBitacoraDetail) {
      this.context.componentParent.collapseBitacoraDetail(this.reportData?.id);
    }
  }
}
