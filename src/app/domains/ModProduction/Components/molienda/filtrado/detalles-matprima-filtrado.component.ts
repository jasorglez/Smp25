import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom } from 'rxjs';
import { ProductionService } from 'app/services/production.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-detalles-matprima-filtrado',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
    <div style="padding: 6px; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; background-color: #f3f0ff;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; flex-shrink: 0;">
        <strong style="font-size: 0.85rem; color: #4a148c;">Detalle de Materia Prima</strong>
        <div class="d-flex gap-1">
          <button class="btn btn-xs btn-success" (click)="addRow()" [disabled]="!gridApi">
            <i class="bi bi-plus-lg"></i>
          </button>
          <button class="btn btn-xs btn-primary position-relative" (click)="saveChanges()" [disabled]="!hasChanges">
            <i class="bi bi-floppy"></i>
            <span *ngIf="hasChanges"
                  class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle">
            </span>
          </button>
          <button class="btn btn-xs btn-warning" (click)="revert()">
            <i class="bi bi-arrow-clockwise"></i>
          </button>
          <button class="btn btn-xs btn-danger" (click)="deleteRow()" [disabled]="!selectedRow">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
      <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          (gridReady)="onGridReady($event)"
          (selectionChanged)="onSelectionChanged($event)"
          (cellValueChanged)="onCellValueChanged($event)"
          style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
        </ag-grid-angular>
      </div>
    </div>
  `,
  styles: [`:host { display: block; height: 100%; overflow: hidden; }`]
})
export class DetallesMatprimaFiltradoComponent {
  private productionService = inject(ProductionService);
  private signalsService = inject(SignalsService);

  private internalParams: any;
  private idMolienda: number | null = null;
  private originalRowData: any[] = [];

  gridApi!: GridApi;
  rowData: any[] = [];
  hasChanges = false;
  selectedRow: any = null;

  colDefs: ColDef[] = [
    {
      field: 'fechaMolienda',
      headerName: 'Fecha molienda',
      editable: true,
      cellEditor: 'agDateStringCellEditor',
      valueFormatter: (p: any) => {
        if (!p.value) return '';
        const [y, m, d] = String(p.value).split('-');
        return d && m && y ? `${d}/${m}/${y}` : p.value;
      },
      valueSetter: (p: any) => { p.data.fechaMolienda = p.newValue; p.data.__modified = true; this.hasChanges = true; return true; },
    },
    {
      field: 'usuario',
      headerName: 'Usuario',
      editable: false,
      cellStyle: { backgroundColor: '#f0f0f0', color: '#6c757d' },
    },
    {
      field: 'idMatPrima',
      headerName: 'Materia Prima',
      editable: true,
      cellEditor: 'agNumberCellEditor',
      valueSetter: (p: any) => { p.data.idMatPrima = p.newValue; p.data.__modified = true; this.hasChanges = true; return true; },
    },
    {
      field: 'jugo',
      headerName: 'Jugo',
      editable: true,
      cellEditor: 'agNumberCellEditor',
      valueFormatter: (p: any) => p.value != null ? String(p.value) : '',
      valueSetter: (p: any) => { p.data.jugo = p.newValue; p.data.__modified = true; this.hasChanges = true; return true; },
    },
    {
      field: 'rendimiento',
      headerName: '% Rendimiento',
      editable: true,
      cellEditor: 'agNumberCellEditor',
      valueFormatter: (p: any) => p.value != null ? `${Number(p.value).toFixed(2)}%` : '',
      valueSetter: (p: any) => { p.data.rendimiento = p.newValue; p.data.__modified = true; this.hasChanges = true; return true; },
    },
  ];

  gridOptions: any = {
    getRowId: (params: any) => String(params.data.id ?? params.data.__tempId),
    headerHeight: 25,
    rowHeight: 22,
    rowSelection: 'single',
    suppressRowClickSelection: true,
    autoSizeStrategy: { type: 'fitCellContents' },
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    defaultColDef: { resizable: true, sortable: true },
  };

  agInit(params: any) {
    this.internalParams = params;
    this.idMolienda = params?.data?.id ?? null;
    if (this.gridApi && !this.gridApi.isDestroyed()) this.loadData();
  }

  refresh(params: any): boolean {
    this.internalParams = params;
    return true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.loadData();
  }

  onSelectionChanged(event: any) {
    const nodes = event.api.getSelectedNodes();
    this.selectedRow = nodes.length > 0 ? nodes[0].data : null;
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasChanges = true;
  }

  async loadData() {
    if (!this.idMolienda) { this.rowData = []; return; }
    try {
      const items = await lastValueFrom(this.productionService.getMoliendaMatDetalleByMolienda(this.idMolienda));
      const mapped = (Array.isArray(items) ? items : []).map(i => this.mapRow(i));
      this.originalRowData = JSON.parse(JSON.stringify(mapped));
      this.rowData = mapped;
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', mapped);
      this.notifyParentHasDetail(mapped.length > 0);
    } catch (e) {
      console.error('Error cargando detalle matprima:', e);
    }
  }

  private mapRow(i: any): any {
    return {
      id: i.id,
      idMolienda: i.idMolienda,
      fechaMolienda: i.fechaMolienda ? String(i.fechaMolienda).substring(0, 10) : null,
      usuario: i.usuario ?? '',
      idMatPrima: i.idMatPrima ?? null,
      jugo: i.jugo ?? null,
      rendimiento: i.rendimiento ?? null,
      __isNew: false,
      __modified: false,
    };
  }

  private toPayload(row: any) {
    return {
      idMolienda: this.idMolienda,
      fechaMolienda: row.fechaMolienda || null,
      usuario: row.usuario || null,
      idMatPrima: row.idMatPrima ?? null,
      jugo: row.jugo ?? null,
      rendimiento: row.rendimiento ?? null,
    };
  }

  addRow() {
    const today = new Date().toISOString().substring(0, 10);
    const usuario = this.signalsService.getDisplayName()() ?? '';
    const newRow = {
      id: null, __tempId: `new_${Date.now()}`, __isNew: true,
      idMolienda: this.idMolienda,
      fechaMolienda: today,
      usuario,
      idMatPrima: null,
      jugo: null,
      rendimiento: null,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasChanges = true;
    if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.gridApi.setGridOption('rowData', this.rowData);
      setTimeout(() => this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'fechaMolienda' }), 80);
    }
  }

  async saveChanges() {
    const newRows = this.rowData.filter(r => r.__isNew);
    const modRows = this.rowData.filter(r => r.__modified && !r.__isNew);
    if (!newRows.length && !modRows.length) return;
    try {
      for (const row of newRows) {
        const created = await lastValueFrom(this.productionService.createMoliendaMatDetalle(this.toPayload(row)));
        row.id = created.id;
        row.__isNew = false;
      }
      for (const row of modRows) {
        await lastValueFrom(this.productionService.updateMoliendaMatDetalle(row.id, this.toPayload(row)));
        row.__modified = false;
      }
      this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
      this.hasChanges = false;
      this.notifyParentHasDetail(this.rowData.length > 0);
    } catch (e) {
      console.error('Error guardando detalle matprima:', e);
      alerts.reqErrorToast('Error al guardar');
    }
  }

  revert() {
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.hasChanges = false;
    this.selectedRow = null;
    if (this.gridApi && !this.gridApi.isDestroyed())
      this.gridApi.setGridOption('rowData', this.rowData);
  }

  async deleteRow() {
    if (!this.selectedRow) return;
    if (this.selectedRow.__isNew) {
      this.rowData = this.rowData.filter(r => r !== this.selectedRow);
      this.selectedRow = null;
      this.hasChanges = this.rowData.some(r => r.__isNew || r.__modified);
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', this.rowData);
      return;
    }
    try {
      await lastValueFrom(this.productionService.deleteMoliendaMatDetalle(this.selectedRow.id));
      this.rowData = this.rowData.filter(r => r !== this.selectedRow);
      this.originalRowData = this.originalRowData.filter(r => r.id !== this.selectedRow.id);
      this.selectedRow = null;
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', this.rowData);
      this.notifyParentHasDetail(this.rowData.length > 0);
    } catch (e) {
      console.error('Error eliminando:', e);
      alerts.reqErrorToast('Error al eliminar');
    }
  }

  // Notifica al padre (vía params.context) que el estado hasDetail cambió
  private notifyParentHasDetail(hasDetail: boolean) {
    this.internalParams?.context?.onMatDetailChanged?.(this.idMolienda, hasDetail);
  }
}
