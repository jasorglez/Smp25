import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';

@Component({
  selector: 'app-eleccion-familias',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <ag-grid-angular
      style="width: 100%; height: 400px;"
      class="ag-theme-quartz"
      [columnDefs]="columnDefs"
      [rowData]="rowData"
      [gridOptions]="gridOptions"
      (gridReady)="onGridReady($event)">
    </ag-grid-angular>
  `
})
export class EleccionFamiliasComponent {
  private gridApi!: GridApi;

  columnDefs: ColDef[] = [
    { headerName: 'Columna1', field: 'col1', flex: 1, filter: true },
    { headerName: 'Columna2', field: 'col2', flex: 1, filter: true }
  ];

  rowData = [
    { col1: 'Dato Fila 1 - Col 1', col2: 'Dato Fila 1 - Col 2' },
    { col1: 'Dato Fila 2 - Col 1', col2: 'Dato Fila 2 - Col 2' },
    { col1: 'Dato Fila 3 - Col 1', col2: 'Dato Fila 3 - Col 2' }
  ];

  gridOptions = {
    headerHeight: 25,
    rowHeight: 25,
  };

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }
}