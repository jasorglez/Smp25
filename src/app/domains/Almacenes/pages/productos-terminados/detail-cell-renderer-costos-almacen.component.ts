import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-detail-cell-renderer-costos-almacen',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  template: `
    <div
      style="padding: 10px; background-color: #fff3e0; height: 100%; display: flex; flex-direction: column;">
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Costos y Almacén para {{ productoName }}</strong>
          <div class="d-flex gap-2">
            <button
              class="btn btn-sm btn-success me-2"
              (click)="addItem()"
              [disabled]="!gridApi">
              <i class="bi bi-plus-lg"></i> Agregar
            </button>
            <button
              class="btn btn-sm btn-primary me-2 position-relative"
              (click)="saveItems()"
              [disabled]="!hasChanges">
              <i class="bi bi-floppy"></i> Guardar
              <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
                *ngIf="hasChanges">
                <span class="visually-hidden">Hay cambios sin guardar</span>
              </span>
            </button>
            <button
              class="btn btn-sm btn-warning me-2"
              (click)="revertChanges()">
              <i class="bi bi-arrow-clockwise"></i> Deshacer
            </button>
            <button
              class="btn btn-sm btn-danger"
              (click)="deleteSelected()"
              [disabled]="!selectedRow">
              <i class="bi bi-trash"></i> Borrar
            </button>
          </div>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="columnDefs"
          [rowData]="rowData"
          [gridOptions]="gridOptions"
          (gridReady)="onGridReady($event)"
          (cellValueChanged)="onCellValueChanged($event)"
          (selectionChanged)="onSelectionChanged($event)">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererCostosAlmacenComponent implements ICellRendererAngularComp {

  params: any;
  productoName: string;
  rowData: any[] = [];
  gridApi: any;
  selectedRow: any = null;
  hasChanges: boolean = false;

  gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    rowSelection: 'single'
  };

  columnDefs = [
    { field: 'precioCompra', headerName: 'Precio de compra', editable: true, width: 150, type: 'numericColumn', valueFormatter: p => `$${p.value}` },
    { field: 'porcUtilidad', headerName: '% De Utilidad', editable: true, width: 120, type: 'numericColumn', valueFormatter: p => `${p.value}%` },
    { field: 'descripcionProducto', headerName: 'Descripcion del Producto', editable: true, flex: 1 },
    { field: 'cantMinima', headerName: 'Cantidad minima en almacen', editable: true, width: 200, type: 'numericColumn' },
    { field: 'cantResurtir', headerName: 'Cantidad a Resurtir', editable: true, width: 160, type: 'numericColumn' }
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.productoName = params.data.producto || 'Producto';
    this.loadData();
  }

  refresh(): boolean {
    return false;
  }

  loadData() {
    this.rowData = [
      { id: 1, precioCompra: 75, porcUtilidad: 25, descripcionProducto: 'Materia prima principal', cantMinima: 50, cantResurtir: 100 },
      { id: 2, precioCompra: 15, porcUtilidad: 30, descripcionProducto: 'Empaque individual', cantMinima: 200, cantResurtir: 500 }
    ];
  }

  onGridReady(params: any) {
    this.gridApi = params.api;
    params.api.sizeColumnsToFit();
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasChanges = true;
  }

  onSelectionChanged(event: any): void {
    const selectedRows = event.api.getSelectedRows();
    this.selectedRow = selectedRows.length > 0 ? selectedRows[0] : null;
  }

  addItem(): void { /* Lógica para agregar */ }
  saveItems() { /* Lógica para guardar */ }
  revertChanges() { this.loadData(); this.hasChanges = false; }
  deleteSelected(): void {
    if (!this.selectedRow) return;
    this.rowData = this.rowData.filter(row => row.id !== this.selectedRow.id);
    this.selectedRow = null;
    this.hasChanges = true;
  }
}