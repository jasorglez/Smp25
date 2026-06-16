import {
  Component, EventEmitter, Input, OnChanges, Output, inject, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { DistributionService } from 'app/services/distribution.service';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom } from 'rxjs';

const MN = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MK_RE = /^\d{4}-\d{2}$/;

@Component({
  selector: 'app-workprogram-distribution-full',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
<div *ngIf="visible" class="modal d-block" tabindex="-1"
     style="background:rgba(0,0,0,.5); z-index:1060;">
  <div class="modal-dialog modal-fullscreen">
    <div class="modal-content">

      <!-- ── Header ─────────────────────────────────────────────────── -->
      <div class="modal-header bg-primary text-white py-2">
        <div class="d-flex align-items-center gap-3">
          <h6 class="modal-title mb-0">
            <i class="bi bi-calendar3-range me-1"></i>Distribución — Programa de Trabajo Completo
          </h6>
          <span *ngIf="isLoading" class="spinner-border spinner-border-sm text-white"></span>
          <span class="badge bg-light text-dark" *ngIf="tasks.length">{{ tasks.length }} actividades</span>
        </div>
        <button type="button" class="btn-close btn-close-white" (click)="close()"></button>
      </div>

      <!-- ── Body ───────────────────────────────────────────────────── -->
      <div class="modal-body p-2 d-flex flex-column" style="overflow:hidden;">

        <!-- Toolbar -->
        <div class="d-flex align-items-center gap-2 mb-2 flex-wrap">

          <!-- CRUD -->
          <div class="d-flex gap-1">
            <button class="btn btn-sm btn-primary position-relative" (click)="save()" [disabled]="!notSaved || isLoading" title="Guardar (F10)">
              <i class="bi bi-floppy"></i>
              <span *ngIf="notSaved"
                    class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"></span>
            </button>
            <button class="btn btn-sm btn-warning" (click)="reload()" [disabled]="isLoading" title="Deshacer y recargar">
              <i class="bi bi-arrow-clockwise"></i>
            </button>
          </div>

          <div class="vr"></div>

          <!-- Agregar mes -->
          <div class="d-flex gap-1 align-items-center">
            <small class="text-muted fw-semibold">Agregar mes:</small>
            <select class="form-select form-select-sm" style="width:100px;" [(ngModel)]="addMonth">
              <option *ngFor="let m of MONTHS_LIST" [value]="m.id">{{ m.name }}</option>
            </select>
            <input type="number" class="form-control form-control-sm text-center" style="width:80px;"
                   [(ngModel)]="addYear" min="2020" max="2050" placeholder="Año">
            <button class="btn btn-sm btn-outline-secondary" (click)="addMonthColumn()" [disabled]="isLoading">
              <i class="bi bi-plus-lg me-1"></i>Mes
            </button>
          </div>

          <div class="vr"></div>

          <!-- Auto-distribuir TODOS -->
          <div class="d-flex gap-1 align-items-center">
            <small class="text-muted fw-semibold">Auto-distribuir todas en</small>
            <input type="number" class="form-control form-control-sm text-center" style="width:60px;"
                   [(ngModel)]="autoMonths" min="1" max="120" title="Número de meses">
            <small class="text-muted">meses desde</small>
            <select class="form-select form-select-sm" style="width:100px;" [(ngModel)]="autoStartMonth">
              <option *ngFor="let m of MONTHS_LIST" [value]="m.id">{{ m.name }}</option>
            </select>
            <input type="number" class="form-control form-control-sm text-center" style="width:80px;"
                   [(ngModel)]="autoStartYear" min="2020" max="2050">
            <button class="btn btn-sm btn-outline-primary" (click)="autoDistributeAll()" [disabled]="isLoading">
              <i class="bi bi-magic me-1"></i>Auto Todo
            </button>
          </div>

          <div class="vr"></div>

          <!-- Resumen -->
          <div class="d-flex gap-2 align-items-center ms-auto">
            <span class="badge bg-light text-dark border" *ngIf="monthKeys.length">
              <i class="bi bi-calendar3 me-1"></i>{{ monthKeys.length }} meses
            </span>
            <span class="badge bg-success" *ngIf="tasksWithDist > 0">
              {{ tasksWithDist }} con distribución
            </span>
            <span class="badge bg-warning text-dark" *ngIf="tasksWithoutDist > 0">
              {{ tasksWithoutDist }} sin distribución
            </span>
          </div>
        </div>

        <!-- Grid -->
        <ag-grid-angular
          style="width:100%; flex:1; min-height:0;"
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [defaultColDef]="defaultColDef"
          [gridOptions]="gridOptions"
          [stopEditingWhenCellsLoseFocus]="true"
          (gridReady)="onGridReady($event)"
          (cellValueChanged)="onCellValueChanged($event)"
        ></ag-grid-angular>

      </div>

      <!-- ── Footer ──────────────────────────────────────────────────── -->
      <div class="modal-footer py-2">
        <small class="text-muted me-auto">
          <i class="bi bi-info-circle me-1"></i>
          Edita directamente cada celda. Pon 0 o vacío para eliminar una distribución.
        </small>
        <button class="btn btn-sm btn-primary position-relative me-2" (click)="save()" [disabled]="!notSaved || isLoading">
          <i class="bi bi-floppy me-1"></i>Guardar
          <span *ngIf="notSaved"
                class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"></span>
        </button>
        <button class="btn btn-sm btn-secondary" (click)="close()">
          <i class="bi bi-x-lg me-1"></i>Cerrar
        </button>
      </div>

    </div>
  </div>
</div>
  `,
})
export class WorkprogramDistributionFullComponent implements OnChanges {
  @Input() visible = false;
  @Input() idCompany: number | null = null;
  @Input() idProject: number | null = null;
  @Input() idContract: number | null = null;
  @Input() idConvention: number | null = null;
  @Input() typeWorkProgram: string = 'Project';
  @Output() closed = new EventEmitter<void>();

  private distService = inject(DistributionService);
  private wpService   = inject(WorkprogramsService);
  private cdr         = inject(ChangeDetectorRef);

  gridApi!: GridApi;
  colDefs: ColDef[] = [];
  rowData: any[] = [];
  tasks: any[] = [];
  monthKeys: string[] = [];
  isLoading = false;
  notSaved  = false;

  autoMonths      = 1;
  autoStartMonth  = new Date().getMonth() + 1;
  autoStartYear   = new Date().getFullYear();
  addMonth        = new Date().getMonth() + 1;
  addYear         = new Date().getFullYear();

  readonly MONTHS_LIST = MN.map((name, i) => ({ id: i + 1, name }));

  // taskId → monthKey → { id: number|null, origQty: number }
  private distIndex = new Map<number, Map<string, { id: number | null; origQty: number }>>();

  get tasksWithDist():    number { return this.rowData.filter(r => r.__totalDist > 0).length; }
  get tasksWithoutDist(): number { return this.rowData.filter(r => !r.__totalDist).length; }

  // ── Grid config ──────────────────────────────────────────────────────
  public defaultColDef: ColDef = { sortable: false, resizable: true };

  public gridOptions: any = {
    headerHeight: 32,
    rowHeight: 22,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__modified },
  };

  onGridReady(params: GridReadyEvent): void { this.gridApi = params.api; }

  // ── Lifecycle ────────────────────────────────────────────────────────
  ngOnChanges(): void {
    if (this.visible) this.load();
    if (!this.visible) this.reset();
  }

  close(): void { this.closed.emit(); }

  reload(): void { this.load(); }

  private reset(): void {
    this.rowData = [];
    this.colDefs = [];
    this.notSaved = false;
    this.distIndex.clear();
    this.monthKeys = [];
    this.tasks = [];
  }

  // ── Load all tasks + all distributions ───────────────────────────────
  async load(): Promise<void> {
    if (!this.idCompany) return;
    this.isLoading = true;
    this.notSaved  = false;
    this.cdr.detectChanges();
    try {
      const id = this.typeWorkProgram === 'Project' ? this.idProject : this.idContract;
      const raw = await lastValueFrom(
        this.idConvention
          ? this.wpService.getByConvention(this.idConvention, this.idProject ?? undefined)
          : this.wpService.getWorkPrograms(id, this.typeWorkProgram)
      ).catch(() => []);

      this.tasks = (Array.isArray(raw) ? raw : []).filter(t => t.id && !isNaN(Number(t.id)));

      this.distIndex.clear();
      const monthSet = new Set<string>();

      await Promise.all(this.tasks.map(async (task) => {
        const dists = await lastValueFrom(
          this.distService.getByReference('WORKPROGRAM', task.id, this.idCompany)
        ).catch(() => []) as any[];

        const taskMap = new Map<string, { id: number | null; origQty: number }>();
        (Array.isArray(dists) ? dists : []).forEach(d => {
          const key = `${d.year}-${String(d.month).padStart(2, '0')}`;
          taskMap.set(key, { id: d.id ?? null, origQty: Number(d.quantity || 0) });
          monthSet.add(key);
        });
        this.distIndex.set(task.id, taskMap);
      }));

      this.monthKeys = Array.from(monthSet).sort();
      this.buildColDefs();
      this.buildRows();
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  // ── Build column definitions ─────────────────────────────────────────
  private buildColDefs(): void {
    const fixed: ColDef[] = [
      {
        headerName: '#', width: 45, editable: false, pinned: 'left',
        valueGetter: p => p.node.rowIndex + 1,
        cellStyle: { textAlign: 'center', color: '#888', fontSize: '10px' },
      },
      {
        headerName: 'Actividad / Tarea', field: '__label', editable: false,
        width: 260, pinned: 'left',
        cellStyle: { fontWeight: '500', fontSize: '11px' },
        tooltipField: '__label',
      },
      {
        headerName: 'Unidad', field: 'measure', editable: false,
        width: 65, pinned: 'left',
        cellStyle: { textAlign: 'center', fontSize: '11px' },
      },
      {
        headerName: 'Cant. Total', field: 'quantity', editable: false,
        width: 90, pinned: 'left', type: 'numericColumn',
        valueFormatter: p => p.value != null && p.value !== 0 ? Number(p.value).toFixed(3) : '',
        cellStyle: { fontSize: '11px' },
      },
      {
        headerName: 'Distribuido', field: '__totalDist', editable: false,
        width: 90, pinned: 'left', type: 'numericColumn',
        valueFormatter: p => p.value != null && p.value !== 0 ? Number(p.value).toFixed(3) : '0.000',
        cellStyle: (p: any) => ({
          fontWeight: 'bold', fontSize: '11px',
          color: Number(p.value) > Number(p.data?.quantity || 0)
            ? '#c0392b' : Number(p.value) === Number(p.data?.quantity || 0) && Number(p.value) > 0
              ? '#1e8449' : '#888',
        }),
      },
      {
        headerName: 'Pendiente', field: '__pending', editable: false,
        width: 90, pinned: 'left', type: 'numericColumn',
        valueFormatter: p => p.value != null ? Number(p.value).toFixed(3) : '',
        cellStyle: (p: any) => ({
          fontSize: '11px',
          color: Number(p.value) < 0 ? '#c0392b' : Number(p.value) === 0 ? '#1e8449' : '#e67e00',
          fontWeight: 'bold',
        }),
      },
    ];

    const monthCols: ColDef[] = this.monthKeys.map(key => this.makeMonthCol(key));
    this.colDefs = [...fixed, ...monthCols];
  }

  private makeMonthCol(key: string): ColDef {
    const [y, m] = key.split('-');
    return {
      headerName: `${MN[Number(m) - 1]}\n${y}`,
      field: key,
      editable: true,
      width: 75,
      type: 'numericColumn',
      valueParser: p => {
        const s = String(p.newValue ?? '').trim();
        if (!s) return null;
        const v = parseFloat(s.replace(',', '.'));
        return isNaN(v) ? null : v;
      },
      valueFormatter: p => (p.value != null && p.value !== 0) ? Number(p.value).toFixed(3) : '',
      headerClass: 'ag-header-cell-text-align-center',
    } as ColDef;
  }

  // ── Build row data ────────────────────────────────────────────────────
  private buildRows(): void {
    this.rowData = this.tasks.map(task => {
      const taskMap = this.distIndex.get(task.id) ?? new Map();
      const row: any = {
        __taskId:         task.id,
        __label:          [task.activity, task.text].filter(Boolean).join(' — '),
        measure:          task.measure || '',
        quantity:         Number(task.quantity ?? 0),
        __modifiedMonths: new Set<string>(),
        __modified:       false,
        __totalDist:      0,
        __pending:        0,
      };
      let total = 0;
      this.monthKeys.forEach(key => {
        const qty = taskMap.get(key)?.origQty ?? 0;
        row[key] = qty || null;
        total += qty;
      });
      row.__totalDist = total;
      row.__pending   = Number(task.quantity ?? 0) - total;
      return row;
    });

    setTimeout(() => {
      this.gridApi?.setGridOption('columnDefs', this.colDefs);
      this.gridApi?.setGridOption('rowData', this.rowData);
    }, 0);
  }

  // ── Cell edit ────────────────────────────────────────────────────────
  onCellValueChanged(event: any): void {
    if (!event.data || !MK_RE.test(event.colDef.field ?? '')) return;
    const key = event.colDef.field;
    event.data.__modifiedMonths.add(key);
    event.data.__modified = true;
    // Recalculate totals
    let total = 0;
    this.monthKeys.forEach(k => total += Number(event.data[k] || 0));
    event.data.__totalDist = total;
    event.data.__pending   = Number(event.data.quantity || 0) - total;
    this.notSaved = true;
    this.gridApi?.refreshCells({ rowNodes: [event.node], force: true });
  }

  // ── Add a month column ───────────────────────────────────────────────
  addMonthColumn(): void {
    const key = `${this.addYear}-${String(this.addMonth).padStart(2, '0')}`;
    if (this.monthKeys.includes(key)) {
      alerts.basicAlert('Mes duplicado', `${MN[this.addMonth - 1]} ${this.addYear} ya existe.`, 'warning');
      return;
    }
    this.monthKeys.push(key);
    this.monthKeys.sort();
    this.rowData.forEach(row => { if (!(key in row)) row[key] = null; });
    // Rebuild month cols in sorted order
    const fixed  = this.colDefs.filter(c => !MK_RE.test(c.field ?? ''));
    const months = this.monthKeys.map(k => this.makeMonthCol(k));
    this.colDefs = [...fixed, ...months];
    this.gridApi?.setGridOption('columnDefs', this.colDefs);
    this.gridApi?.setGridOption('rowData', this.rowData);
  }

  // ── Auto-distribute ALL tasks ─────────────────────────────────────────
  autoDistributeAll(): void {
    if (!this.autoMonths || this.autoMonths < 1) {
      alerts.basicAlert('Auto-distribuir', 'El número de meses debe ser mayor a 0.', 'warning');
      return;
    }
    const nMonths = Math.floor(this.autoMonths);
    // Build the required month keys
    const neededKeys: string[] = [];
    let y = this.autoStartYear, m = this.autoStartMonth;
    for (let i = 0; i < nMonths; i++) {
      neededKeys.push(`${y}-${String(m).padStart(2, '0')}`);
      m++; if (m > 12) { m = 1; y++; }
    }
    // Add missing columns
    const newKeys = neededKeys.filter(k => !this.monthKeys.includes(k));
    newKeys.forEach(key => {
      this.monthKeys.push(key);
      this.rowData.forEach(row => { if (!(key in row)) row[key] = null; });
    });
    this.monthKeys.sort();

    // Distribute each task proportionally
    const tasksWithQty = this.rowData.filter(r => Number(r.quantity || 0) > 0);
    if (!tasksWithQty.length) {
      alerts.basicAlert('Auto-distribuir', 'No hay tareas con cantidad mayor a 0.', 'warning');
      return;
    }
    tasksWithQty.forEach(row => {
      const total = Number(row.quantity || 0);
      const base  = Math.floor((total / nMonths) * 1000) / 1000;
      let remaining = total;
      neededKeys.forEach((key, i) => {
        const qty = i === nMonths - 1 ? Math.round(remaining * 1000) / 1000 : base;
        row[key] = qty || null;
        row.__modifiedMonths.add(key);
        remaining -= base;
      });
      // Recalculate
      let distTotal = 0;
      this.monthKeys.forEach(k => distTotal += Number(row[k] || 0));
      row.__totalDist = distTotal;
      row.__pending   = total - distTotal;
      row.__modified  = true;
    });

    this.notSaved = true;
    // Rebuild colDefs with new months if any
    if (newKeys.length) {
      const fixed  = this.colDefs.filter(c => !MK_RE.test(c.field ?? ''));
      const months = this.monthKeys.map(k => this.makeMonthCol(k));
      this.colDefs = [...fixed, ...months];
      this.gridApi?.setGridOption('columnDefs', this.colDefs);
    }
    this.gridApi?.setGridOption('rowData', this.rowData);
    this.gridApi?.refreshCells({ force: true });
  }

  // ── Save all changes ──────────────────────────────────────────────────
  async save(): Promise<void> {
    const modifiedRows = this.rowData.filter(r => r.__modifiedMonths?.size > 0);
    if (!modifiedRows.length) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes.', 'info');
      return;
    }

    const ops: Promise<any>[] = [];

    modifiedRows.forEach(row => {
      const taskId  = row.__taskId;
      const taskMap = this.distIndex.get(taskId) ?? new Map();

      (row.__modifiedMonths as Set<string>).forEach(key => {
        const [yr, mo] = key.split('-');
        const qty      = Number(row[key] || 0);
        const existing = taskMap.get(key);

        if (existing?.id) {
          if (qty > 0) {
            // Update
            ops.push(lastValueFrom(this.distService.update(existing.id, {
              id: existing.id, idCompany: this.idCompany, idReference: taskId,
              type: 'WORKPROGRAM', year: Number(yr), month: Number(mo),
              quantity: qty, active: true,
            })));
          } else {
            // Delete (qty = 0 or empty)
            ops.push(lastValueFrom(this.distService.delete(existing.id)));
          }
        } else if (qty > 0) {
          // Create
          ops.push(lastValueFrom(this.distService.save({
            idCompany: this.idCompany, idReference: taskId,
            type: 'WORKPROGRAM', year: Number(yr), month: Number(mo),
            quantity: qty, active: true,
          })));
        }
      });
    });

    if (!ops.length) {
      alerts.basicAlert('Sin cambios', 'No hay cambios efectivos.', 'info');
      return;
    }

    try {
      await Promise.all(ops);
      alerts.basicAlert('Guardado', `${ops.length} distribuciones guardadas correctamente.`, 'success');
      await this.load();
    } catch (err) {
      console.error(err);
      alerts.basicAlert('Error', 'Error al guardar las distribuciones.', 'error');
    }
  }
}
