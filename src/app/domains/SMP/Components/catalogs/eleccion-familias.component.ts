import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-eleccion-familias',
  standalone: true,
  imports: [CommonModule, AgGridModule, TranslateModule],
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
  private translate = inject(TranslateService);
  private gridApi!: GridApi;

  columnDefs: ColDef[] = [
    { headerName: this.translate.instant('modules.shopping.ui.catalogs.columnOne'), field: 'col1', flex: 1, filter: true },
    { headerName: this.translate.instant('modules.shopping.ui.catalogs.columnTwo'), field: 'col2', flex: 1, filter: true }
  ];

  rowData = [
    { col1: this.translate.instant('modules.shopping.ui.catalogs.sampleRow', { row: 1, column: 1 }), col2: this.translate.instant('modules.shopping.ui.catalogs.sampleRow', { row: 1, column: 2 }) },
    { col1: this.translate.instant('modules.shopping.ui.catalogs.sampleRow', { row: 2, column: 1 }), col2: this.translate.instant('modules.shopping.ui.catalogs.sampleRow', { row: 2, column: 2 }) },
    { col1: this.translate.instant('modules.shopping.ui.catalogs.sampleRow', { row: 3, column: 1 }), col2: this.translate.instant('modules.shopping.ui.catalogs.sampleRow', { row: 3, column: 2 }) }
  ];

  gridOptions = {
    headerHeight: 25,
    rowHeight: 25,
  };

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }
}
