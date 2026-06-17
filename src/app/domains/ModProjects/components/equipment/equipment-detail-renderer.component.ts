import { Component, ChangeDetectorRef, HostListener, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { DistributionService } from 'app/services/distribution.service';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-equipment-detail-renderer',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, SelectWithTooltipEditorV2Component],
  template: `

    <!-- ── DISTRIBUCIÓN ─────────────────────────────────────────────── -->
    <div *ngIf="detailType === 'distribution'"
         style="padding: 12px; background: #f8f9fa; height: 100%; box-sizing: border-box;">

      <div class="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">

        <!-- Botones CRUD -->
        <div class="d-flex gap-1 align-items-center"
             (mousedown)="stopGridEvent($event)"
             (click)="stopGridEvent($event)">
          <button class="btn btn-sm btn-success" [disabled]="false" (click)="onAddClick($event)" title="Agregar (F1)">
            <i class="bi bi-plus-lg"></i>
          </button>
          <button class="btn btn-sm btn-primary position-relative" [disabled]="false" (click)="onSaveClick($event)" title="Guardar (F10)">
            <i class="bi bi-floppy"></i>
            <span *ngIf="notSaved"
                  class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle">
            </span>
          </button>
          <button class="btn btn-sm btn-warning" [disabled]="false" (click)="onRevertClick($event)">
            <i class="bi bi-arrow-clockwise"></i>
          </button>
          <button class="btn btn-sm btn-danger" [disabled]="false" (click)="onDeleteClick($event)">
            <i class="bi bi-trash"></i>
          </button>
        </div>

        <!-- Indicador de sumas -->
        <div class="d-flex gap-2 align-items-center">
          <span class="badge bg-secondary">{{ equipmentData?.description }}</span>
          <span class="badge bg-light text-dark border">Total: {{ equipmentQty | number:'1.3-3' }}</span>
          <span class="badge" [ngClass]="sumClass">Distribuido: {{ distributionSum | number:'1.3-3' }}</span>
          <span class="badge" [ngClass]="pendingClass">Pendiente: {{ pending | number:'1.3-3' }}</span>
        </div>

        <!-- Auto-distribución -->
        <div class="d-flex gap-1 align-items-center border-start ps-2"
             (mousedown)="stopGridEvent($event)" (click)="stopGridEvent($event)">
          <small class="text-muted fw-semibold">Dividir en</small>
          <input type="number" [(ngModel)]="autoMonths" min="1" max="120"
                 style="width:52px; height:24px; font-size:11px;"
                 class="form-control form-control-sm text-center"
                 title="Número de meses">
          <small class="text-muted">meses</small>
          <button class="btn btn-sm btn-outline-primary py-0 px-2"
                  style="height:24px; font-size:11px;"
                  (click)="triggerAutoDistribute($event)"
                  title="Distribuir cantidad total automáticamente en N meses">
            <i class="bi bi-magic me-1"></i>Auto
          </button>
        </div>

      </div>

      <ag-grid-angular
        style="width: 100%; height: 320px;"
        class="ag-theme-quartz small-text-ag-grid"
        [rowData]="distributionRows"
        [columnDefs]="colDefs"
        [defaultColDef]="defaultColDef"
        [gridOptions]="distGridOptions"
        [rowSelection]="'single'"
        [stopEditingWhenCellsLoseFocus]="true"
        (gridReady)="onGridReady($event)"
        (cellValueChanged)="onCellValueChanged($event)"
      ></ag-grid-angular>
    </div>

  `,
})
export class EquipmentDetailRendererComponent implements ICellRendererAngularComp, OnInit {

  params: any;
  detailType: string = '';
  idCompany: number;
  equipmentData: any;

  distributionRows: any[] = [];
  notSaved = false;
  autoMonths: number = 1;
  private serverSnapshotRows: any[] = [];
  private gridApi: GridApi;
  private tempCounter = 0;
  private _colDefs: ColDef[] = [];

  private distributionService = inject(DistributionService);
  private cdr = inject(ChangeDetectorRef);

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

  // ── Getters de totales ─────────────────────────────────────────────────
  get equipmentQty():    number { return Number(this.equipmentData?.quantity ?? 0); }
  get distributionSum(): number { return this.distributionRows.reduce((s, r) => s + Number(r.quantity || 0), 0); }
  get pending():         number { return this.equipmentQty - this.distributionSum; }
  get sumClass():     string { return this.distributionSum > this.equipmentQty ? 'bg-danger' : 'bg-success'; }
  get pendingClass(): string { return this.pending < 0 ? 'bg-danger' : this.pending === 0 ? 'bg-success' : 'bg-warning text-dark'; }

  // ── AG Grid lifecycle ──────────────────────────────────────────────────
  agInit(params: ICellRendererParams): void {
    this.params = params;
    const data  = (params as any).data;

    // Full-width row de distribución
    if (data?.__isDistDetail) {
      this.detailType    = 'distribution';
      this.idCompany     = data.idCompany ?? (params as any).context?.idCompany;
      this.equipmentData = { ...data, id: data.__equipmentId };
      this.loadDistribution();
      return;
    }

    // Fallback (uso como detailCellRenderer legacy)
    this.detailType    = data?.detailType ?? '';
    this.idCompany     = (params as any).context?.idCompany ?? data?.idCompany;
    this.equipmentData = data;
    if (this.detailType === 'distribution') this.loadDistribution();
  
    this.cdr.detectChanges();}

  refresh(_params: ICellRendererParams): boolean { return false; }
  ngOnInit(): void {}

  onClose(): void {
    this.params?.context?.componentParent?.collapseDetail();
  }

  // ── Carga datos ────────────────────────────────────────────────────────
  private loadDistribution(): void {
    if (!this.equipmentData?.id || typeof this.equipmentData.id === 'string') return;

    this.distributionService
      .getByReference('EQUIPMENT', this.equipmentData.id, this.idCompany)
      .subscribe({
        next: (data) => {
          this.serverSnapshotRows = Array.isArray(data) ? [...data] : [];
          this.distributionRows = [...this.serverSnapshotRows];
          this.notSaved = false;
          this.cdr.detectChanges();
          this.gridApi?.setGridOption('rowData', this.distributionRows);
        },
        error: (err) => console.error('Error cargando distribución:', err),
      });
  }

  // ── Grid config ────────────────────────────────────────────────────────
  public distGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
  };

  public defaultColDef: ColDef = {
    sortable: false,
    resizable: true,
  };

  get colDefs(): ColDef[] {
    if (this._colDefs.length > 0) return this._colDefs;
    this._colDefs = [
      {
        headerName: '#', width: 50, editable: false,
        valueGetter: (p) => p.node.rowIndex + 1,
        cellStyle: { textAlign: 'center', fontWeight: 'bold' },
      },
      {
        field: 'year', headerName: 'Año', editable: true, width: 110,
        cellEditor: SelectWithTooltipEditorV2Component,
        cellEditorParams: () => ({
          options: this.YEARS.map(y => ({ id: y.id, description: y.description, valueAddition: '', valueAddition2: '' })),
          specialValues: [], onSpecialValue: () => {},
        }),
        cellRenderer: (p: any) => p.value ? String(p.value) : '',
      },
      {
        field: 'month', headerName: 'Mes', editable: true, width: 140,
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
        field: 'quantity', headerName: 'Cantidad', editable: true, width: 120,
        type: 'numericColumn',
        valueParser: (p) => { const v = parseFloat(String(p.newValue).replace(',', '.')); return isNaN(v) ? 0 : v; },
        valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(3) : '0.000',
      },
    ];
    return this._colDefs;
  }

  onGridReady(params: GridReadyEvent): void { this.gridApi = params.api; }

  stopGridEvent(event?: Event): void {
    event?.preventDefault?.();
    event?.stopPropagation?.();
  }

  onAddClick(event?: Event): void {
    this.stopGridEvent(event);
    this.addRow();
  }

  onSaveClick(event?: Event): void {
    this.stopGridEvent(event);
    this.save();
  }

  onRevertClick(event?: Event): void {
    this.stopGridEvent(event);
    this.revert();
  }

  onDeleteClick(event?: Event): void {
    this.stopGridEvent(event);
    this.deleteRow();
  }

  onCellValueChanged(event: any): void {
    this.notSaved = true;
    if (event?.data && !event.data.__isNew) {
      event.data.__modified = true;
    }
    const validationError = this.validateGridRules(true);
    if (validationError) {
      alerts.basicAlert('Validación', validationError, 'warning');
    }
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    if (this.detailType !== 'distribution') return;
    if (event.key === 'F1' || event.key === 'F9') {
      event.preventDefault();
      this.addRow();
      return;
    }
    if (event.key === 'F10') {
      event.preventDefault();
      this.save();
      return;
    }
    if (event.key === 'F2') {
      event.preventDefault();
      this.revert();
    }
  }

  // ── Calcula el siguiente mes/año desde las filas existentes ────────────
  private nextYearMonth(): { year: number; month: number } {
    const periods = this.distributionRows
      .map((row) => this.normalizePeriod(row))
      .filter((p) => p.year > 0 && p.month >= 1 && p.month <= 12);

    if (!periods.length) {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() + 1 };
    }

    periods.sort((a, b) => (a.year === b.year ? a.month - b.month : a.year - b.year));
    const last = periods[periods.length - 1];
    if (last.month === 12) {
      return { year: last.year + 1, month: 1 };
    }
    return { year: last.year, month: last.month + 1 };
  }

  // ── CRUD ───────────────────────────────────────────────────────────────
  addRow(): void {
    this.gridApi?.stopEditing();
    const tempId = `dist_${this.tempCounter++}`;
    const { year, month } = this.nextYearMonth();
    const newRow = {
      id: tempId, idCompany: this.idCompany,
      idReference: this.equipmentData?.id, type: 'EQUIPMENT',
      year, month,
      quantity: 0, active: true, __isNew: true,
    };
    this.distributionRows = [newRow, ...this.distributionRows];
    this.notSaved = true;
    this.cdr.detectChanges();
    this.gridApi?.setGridOption('rowData', this.distributionRows);
    setTimeout(() => {
      this.gridApi?.ensureIndexVisible(0);
      this.gridApi?.startEditingCell({ rowIndex: 0, colKey: 'year' });
    }, 150);
  }

  async save(): Promise<void> {
    const newRows      = this.distributionRows.filter(r => r.__isNew);
    const modifiedRows = this.distributionRows.filter(r => r.__modified && !r.__isNew);
    if (!newRows.length && !modifiedRows.length) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes.', 'info');
      return;
    }
    const validationError = this.validateGridRules(false);
    if (validationError) {
      alerts.basicAlert('Validación', validationError, 'error');
      return;
    }
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
    this.distributionRows = [...this.serverSnapshotRows];
    this.cdr.detectChanges();
    this.gridApi?.setGridOption('rowData', this.distributionRows);
    this.loadDistribution();
  }

  deleteRow(): void {
    const selected = this.gridApi?.getSelectedNodes();
    if (!selected?.length) { alerts.basicAlert('Eliminar', 'Selecciona una fila.', 'error'); return; }
    const row = selected[0].data;
    if (typeof row.id === 'string') {
      this.distributionRows = this.distributionRows.filter(r => r.id !== row.id);
      this.notSaved = this.distributionRows.some(r => r.__isNew || r.__modified);
      this.gridApi?.setGridOption('rowData', this.distributionRows);
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

  private normalizePeriod(row: any): { year: number; month: number } {
    return {
      year: Number(row?.year || 0),
      month: Number(row?.month || 0),
    };
  }

  private getDuplicatePeriodRows(): any[] {
    const seen = new Map<string, any>();
    const duplicates: any[] = [];
    for (const row of this.distributionRows) {
      const { year, month } = this.normalizePeriod(row);
      if (!year || !month) continue;
      const key = `${year}-${month}`;
      if (seen.has(key)) {
        duplicates.push(row);
      } else {
        seen.set(key, row);
      }
    }
    return duplicates;
  }

  // ── Auto-distribución ──────────────────────────────────────────────────
  triggerAutoDistribute(event?: Event): void {
    this.stopGridEvent(event);
    const total = this.equipmentQty;
    if (!total || total <= 0) {
      alerts.basicAlert('Auto-distribuir', 'La cantidad total del equipo debe ser mayor a 0.', 'warning');
      return;
    }
    if (!this.autoMonths || this.autoMonths < 1) {
      alerts.basicAlert('Auto-distribuir', 'El número de meses debe ser mayor a 0.', 'warning');
      return;
    }
    const doDistribute = () => {
      this.gridApi?.stopEditing();
      this.distributionRows = this.generateAutoRows(total, Math.floor(this.autoMonths));
      this.notSaved = true;
      this.cdr.detectChanges();
      this.gridApi?.setGridOption('rowData', this.distributionRows);
    };
    if (this.serverSnapshotRows.length > 0) {
      alerts.confirmAlert(
        'Auto-distribuir',
        `Se reemplazarán ${this.serverSnapshotRows.length} distribuciones existentes. ¿Continuar?`,
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
        idReference: this.equipmentData?.id,
        type: 'EQUIPMENT',
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
    if (this.distributionSum > this.equipmentQty) {
      return `La suma distribuida (${this.distributionSum.toFixed(3)}) no puede ser mayor al total del equipo (${this.equipmentQty.toFixed(3)}).`;
    }

    const duplicateRows = this.getDuplicatePeriodRows();
    if (duplicateRows.length > 0) {
      const { year, month } = this.normalizePeriod(duplicateRows[0]);
      const monthName = this.MONTHS.find(m => m.id === month)?.description || `${month}`;
      return `No se permite repetir periodo: ${monthName} ${year}.`;
    }

    if (!silent) {
      const invalidRows = this.distributionRows.filter((row) => {
        const { year, month } = this.normalizePeriod(row);
        return !year || !month || !Number.isFinite(Number(row?.quantity));
      });
      if (invalidRows.length > 0) {
        return 'Todos los registros deben tener Año, Mes y Cantidad válidos.';
      }
    }
    return null;
  }
}

