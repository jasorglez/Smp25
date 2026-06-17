import {
  Component, EventEmitter, HostListener, Input, OnChanges, Output, inject,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { DistributionService } from 'app/services/distribution.service';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-workprogram-distribution',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
<div *ngIf="visible" class="modal d-block" tabindex="-1"
     style="background:rgba(0,0,0,.45); z-index:1055;">
  <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
    <div class="modal-content">

      <!-- Header -->
      <div class="modal-header bg-primary text-white py-2">
        <div>
          <h6 class="modal-title mb-0">
            <i class="bi bi-calendar3 me-1"></i> Distribución Mensual
          </h6>
          <small class="opacity-75">{{ taskName }}</small>
        </div>
        <button type="button" class="btn-close btn-close-white" (click)="close()"></button>
      </div>

      <!-- Body -->
      <div class="modal-body p-3">

        <!-- Toolbar -->
        <div class="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">

          <!-- Botones CRUD -->
          <div class="d-flex gap-1">
            <button class="btn btn-sm btn-success" (click)="addRow()" title="Agregar (F1)">
              <i class="bi bi-plus-lg"></i>
            </button>
            <button class="btn btn-sm btn-primary position-relative" (click)="save()" title="Guardar (F10)">
              <i class="bi bi-floppy"></i>
              <span *ngIf="notSaved"
                    class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle">
              </span>
            </button>
            <button class="btn btn-sm btn-warning" (click)="revert()">
              <i class="bi bi-arrow-clockwise"></i>
            </button>
            <button class="btn btn-sm btn-danger" (click)="deleteRow()">
              <i class="bi bi-trash"></i>
            </button>
          </div>

          <!-- Indicadores de cantidad -->
          <div class="d-flex gap-2 align-items-center flex-wrap">
            <span class="badge bg-light text-dark border">
              Total: {{ taskQuantity | number:'1.3-3' }}
            </span>
            <span class="badge" [ngClass]="sumClass">
              Distribuido: {{ distributionSum | number:'1.3-3' }}
            </span>
            <span class="badge" [ngClass]="pendingClass">
              Pendiente: {{ pending | number:'1.3-3' }}
            </span>
          </div>

          <!-- Auto-distribución -->
          <div class="d-flex gap-1 align-items-center border-start ps-2">
            <small class="text-muted fw-semibold">Dividir en</small>
            <input type="number" [(ngModel)]="autoMonths" min="1" max="120"
                   style="width:52px; height:28px; font-size:12px;"
                   class="form-control form-control-sm text-center"
                   title="Número de meses">
            <small class="text-muted">meses</small>
            <button class="btn btn-sm btn-outline-primary py-0 px-2"
                    style="height:28px; font-size:12px;"
                    (click)="triggerAutoDistribute()"
                    title="Distribuir cantidad total automáticamente en N meses">
              <i class="bi bi-magic me-1"></i>Auto
            </button>
          </div>

        </div>

        <!-- Grid -->
        <ag-grid-angular
          style="width: 100%; height: 340px;"
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [defaultColDef]="defaultColDef"
          [gridOptions]="gridOptions"
          [rowSelection]="'single'"
          [stopEditingWhenCellsLoseFocus]="true"
          (gridReady)="onGridReady($event)"
          (cellValueChanged)="onCellValueChanged($event)"
        ></ag-grid-angular>

      </div>

      <!-- Footer -->
      <div class="modal-footer py-2">
        <button class="btn btn-sm btn-secondary" (click)="close()">
          <i class="bi bi-x-lg me-1"></i>Cerrar
        </button>
      </div>

    </div>
  </div>
</div>
  `,
})
export class WorkprogramDistributionComponent implements OnChanges {
  @Input() visible = false;
  @Input() idWorkprogram: number | null = null;
  @Input() idCompany: number | null = null;
  @Input() taskName = '';
  @Input() taskQuantity: number = 0;
  @Output() closed = new EventEmitter<void>();

  private distributionService = inject(DistributionService);
  private cdr = inject(ChangeDetectorRef);

  gridApi!: GridApi;
  rowData: any[] = [];
  notSaved = false;
  autoMonths: number = 1;
  private serverSnapshot: any[] = [];
  private tempCounter = 0;
  private _colDefs: ColDef[] = [];

  private readonly MONTHS = [
    { id: 1,  description: 'Enero'      },
    { id: 2,  description: 'Febrero'    },
    { id: 3,  description: 'Marzo'      },
    { id: 4,  description: 'Abril'      },
    { id: 5,  description: 'Mayo'       },
    { id: 6,  description: 'Junio'      },
    { id: 7,  description: 'Julio'      },
    { id: 8,  description: 'Agosto'     },
    { id: 9,  description: 'Septiembre' },
    { id: 10, description: 'Octubre'    },
    { id: 11, description: 'Noviembre'  },
    { id: 12, description: 'Diciembre'  },
  ];

  private get YEARS() {
    const cur = new Date().getFullYear();
    const arr = [];
    for (let y = 2020; y <= cur + 5; y++) arr.push({ id: y, description: String(y) });
    return arr;
  }

  // ── Indicadores ───────────────────────────────────────────────────────
  get distributionSum(): number { return this.rowData.reduce((s, r) => s + Number(r.quantity || 0), 0); }
  get pending(): number         { return this.taskQuantity - this.distributionSum; }
  get sumClass():     string    { return this.distributionSum > this.taskQuantity ? 'bg-danger' : 'bg-success'; }
  get pendingClass(): string    { return this.pending < 0 ? 'bg-danger' : this.pending === 0 ? 'bg-success' : 'bg-warning text-dark'; }

  // ── Lifecycle ─────────────────────────────────────────────────────────
  ngOnChanges(): void {
    if (this.visible && this.idWorkprogram) {
      this._colDefs = [];
      this.loadDistribution();
    }
    if (!this.visible) {
      this.rowData = [];
      this.notSaved = false;
    }
  }

  close(): void { this.closed.emit(); }

  // ── Grid config ───────────────────────────────────────────────────────
  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
  };

  public defaultColDef: ColDef = { sortable: false, resizable: true };

  get colDefs(): ColDef[] {
    if (this._colDefs.length > 0) return this._colDefs;
    this._colDefs = [
      {
        headerName: '#', width: 50, editable: false,
        valueGetter: (p) => p.node.rowIndex + 1,
        cellStyle: { textAlign: 'center', fontWeight: 'bold' },
      },
      {
        field: 'year', headerName: 'Año', editable: true, width: 120,
        cellEditor: SelectWithTooltipEditorV2Component,
        cellEditorParams: () => ({
          options: this.YEARS.map(y => ({ id: y.id, description: y.description, valueAddition: '', valueAddition2: '' })),
          specialValues: [], onSpecialValue: () => {},
        }),
        cellRenderer: (p: any) => p.value ? String(p.value) : '',
      },
      {
        field: 'month', headerName: 'Mes', editable: true, width: 160,
        cellEditor: SelectWithTooltipEditorV2Component,
        cellEditorParams: () => ({
          options: this.MONTHS.map(m => ({ id: m.id, description: m.description, valueAddition: '', valueAddition2: '' })),
          specialValues: [], onSpecialValue: () => {},
        }),
        cellRenderer: (p: any) => {
          const m = this.MONTHS.find(x => x.id === Number(p.value));
          return m ? m.description : '';
        },
      },
      {
        field: 'quantity', headerName: 'Cantidad', editable: true, width: 140,
        type: 'numericColumn',
        valueParser: (p) => { const v = parseFloat(String(p.newValue).replace(',', '.')); return isNaN(v) ? 0 : v; },
        valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(3) : '0.000',
      },
    ];
    return this._colDefs;
  }

  onGridReady(params: GridReadyEvent): void { this.gridApi = params.api; }

  onCellValueChanged(event: any): void {
    this.notSaved = true;
    if (event?.data && !event.data.__isNew) event.data.__modified = true;
    const err = this.validateGridRules(true);
    if (err) alerts.basicAlert('Validación', err, 'warning');
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.visible) return;
    if (event.key === 'F1' || event.key === 'F9') { event.preventDefault(); this.addRow(); return; }
    if (event.key === 'F10') { event.preventDefault(); this.save(); return; }
    if (event.key === 'F2')  { event.preventDefault(); this.revert(); }
    if (event.key === 'Escape') { this.close(); }
  }

  // ── Load ──────────────────────────────────────────────────────────────
  private loadDistribution(): void {
    if (!this.idWorkprogram || !this.idCompany) return;
    this.distributionService
      .getByReference('WORKPROGRAM', this.idWorkprogram, this.idCompany)
      .subscribe({
        next: (data) => {
          this.serverSnapshot = Array.isArray(data) ? [...data] : [];
          this.rowData = [...this.serverSnapshot];
          this.notSaved = false;
          this.cdr.detectChanges();
          this.gridApi?.setGridOption('rowData', this.rowData);
        },
        error: (err) => console.error('Error cargando distribución:', err),
      });
  }

  // ── Next period helper ────────────────────────────────────────────────
  private nextYearMonth(): { year: number; month: number } {
    const periods = this.rowData
      .map(r => ({ year: Number(r?.year || 0), month: Number(r?.month || 0) }))
      .filter(p => p.year > 0 && p.month >= 1 && p.month <= 12);

    if (!periods.length) {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() + 1 };
    }
    periods.sort((a, b) => a.year === b.year ? a.month - b.month : a.year - b.year);
    const last = periods[periods.length - 1];
    return last.month === 12
      ? { year: last.year + 1, month: 1 }
      : { year: last.year, month: last.month + 1 };
  }

  // ── CRUD ──────────────────────────────────────────────────────────────
  addRow(): void {
    this.gridApi?.stopEditing();
    const { year, month } = this.nextYearMonth();
    const newRow = {
      id: `dist_${this.tempCounter++}`,
      idCompany: this.idCompany,
      idReference: this.idWorkprogram,
      type: 'WORKPROGRAM',
      year, month,
      quantity: 0, active: true, __isNew: true,
    };
    this.rowData = [newRow, ...this.rowData];
    this.notSaved = true;
    this.cdr.detectChanges();
    this.gridApi?.setGridOption('rowData', this.rowData);
    setTimeout(() => {
      this.gridApi?.ensureIndexVisible(0);
      this.gridApi?.startEditingCell({ rowIndex: 0, colKey: 'year' });
    }, 150);
  }

  async save(): Promise<void> {
    const newRows      = this.rowData.filter(r => r.__isNew);
    const modifiedRows = this.rowData.filter(r => r.__modified && !r.__isNew);
    if (!newRows.length && !modifiedRows.length) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes.', 'info');
      return;
    }
    const err = this.validateGridRules(false);
    if (err) { alerts.basicAlert('Validación', err, 'error'); return; }
    try {
      await Promise.all([
        ...newRows.map(r      => lastValueFrom(this.distributionService.save(this.clean(r)))),
        ...modifiedRows.map(r => lastValueFrom(this.distributionService.update(r.id, this.clean(r)))),
      ]);
      alerts.basicAlert('Guardado', 'Distribución guardada correctamente.', 'success');
      this.notSaved = false;
      this.loadDistribution();
    } catch (err) {
      console.error(err);
      alerts.basicAlert('Error', 'Error al guardar la distribución.', 'error');
    }
  
    this.cdr.detectChanges();}

  revert(): void {
    this.gridApi?.stopEditing();
    this.notSaved = false;
    this.rowData = [...this.serverSnapshot];
    this.cdr.detectChanges();
    this.gridApi?.setGridOption('rowData', this.rowData);
    this.loadDistribution();
  }

  deleteRow(): void {
    const selected = this.gridApi?.getSelectedNodes();
    if (!selected?.length) { alerts.basicAlert('Eliminar', 'Selecciona una fila.', 'error'); return; }
    const row = selected[0].data;
    if (typeof row.id === 'string') {
      this.rowData = this.rowData.filter(r => r.id !== row.id);
      this.notSaved = this.rowData.some(r => r.__isNew || r.__modified);
      this.gridApi?.setGridOption('rowData', this.rowData);
      return;
    }
    alerts.confirmAlert('Eliminar', '¿Eliminar esta distribución?', 'warning', 'Sí, eliminar').then(res => {
      if (!res.isConfirmed) return;
      this.distributionService.delete(row.id).subscribe({
        next: () => {
          alerts.basicAlert('Eliminado', 'Distribución eliminada.', 'success');
          this.notSaved = false;
          this.loadDistribution();
        },
        error: () => alerts.basicAlert('Error', 'No se pudo eliminar.', 'error'),
      });
    });
  }

  private clean(row: any): any {
    const d = { ...row };
    delete d.__isNew; delete d.__modified;
    if (typeof d.id === 'string') delete d.id;
    return d;
  }

  // ── Auto-distribución ─────────────────────────────────────────────────
  triggerAutoDistribute(): void {
    const total = this.taskQuantity;
    if (!total || total <= 0) {
      alerts.basicAlert('Auto-distribuir', 'La cantidad de la tarea debe ser mayor a 0.', 'warning');
      return;
    }
    if (!this.autoMonths || this.autoMonths < 1) {
      alerts.basicAlert('Auto-distribuir', 'El número de meses debe ser mayor a 0.', 'warning');
      return;
    }
    const doDistribute = () => {
      this.gridApi?.stopEditing();
      this.rowData = this.generateAutoRows(total, Math.floor(this.autoMonths));
      this.notSaved = true;
      this.cdr.detectChanges();
      this.gridApi?.setGridOption('rowData', this.rowData);
    };
    if (this.serverSnapshot.length > 0) {
      alerts.confirmAlert(
        'Auto-distribuir',
        `Se reemplazarán ${this.serverSnapshot.length} distribuciones existentes. ¿Continuar?`,
        'warning', 'Sí, reemplazar'
      ).then(res => { if (res.isConfirmed) doDistribute(); });
    } else {
      doDistribute();
    }
  }

  private generateAutoRows(total: number, nMonths: number): any[] {
    const rows: any[] = [];
    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth() + 1;
    const base = Math.floor((total / nMonths) * 1000) / 1000;
    let remaining = total;
    for (let i = 0; i < nMonths; i++) {
      const qty = i === nMonths - 1 ? Math.round(remaining * 1000) / 1000 : base;
      rows.push({
        id: `dist_auto_${this.tempCounter++}`,
        idCompany: this.idCompany,
        idReference: this.idWorkprogram,
        type: 'WORKPROGRAM',
        year: y, month: m,
        quantity: qty,
        active: true, __isNew: true,
      });
      remaining -= base;
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return rows;
  }

  private validateGridRules(silent: boolean): string | null {
    // Validar que la suma no supere la cantidad total de la tarea
    if (this.taskQuantity > 0 && this.distributionSum > this.taskQuantity) {
      return `La suma distribuida (${this.distributionSum.toFixed(3)}) no puede ser mayor a la cantidad de la tarea (${this.taskQuantity.toFixed(3)}).`;
    }
    // Validar periodos duplicados (mismo año+mes)
    const seen = new Map<string, boolean>();
    for (const r of this.rowData) {
      const y = Number(r?.year || 0), m = Number(r?.month || 0);
      if (!y || !m) continue;
      const key = `${y}-${m}`;
      if (seen.has(key)) {
        const mn = this.MONTHS.find(x => x.id === m)?.description || `${m}`;
        return `No se permite repetir periodo: ${mn} ${y}.`;
      }
      seen.set(key, true);
    }
    if (!silent) {
      const invalid = this.rowData.filter(r => {
        const y = Number(r?.year || 0), m = Number(r?.month || 0);
        return !y || !m || !Number.isFinite(Number(r?.quantity));
      });
      if (invalid.length) return 'Todos los registros deben tener Año, Mes y Cantidad válidos.';
    }
    return null;
  }
}
