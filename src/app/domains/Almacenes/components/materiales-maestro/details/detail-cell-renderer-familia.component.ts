import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-detail-cell-renderer-familia',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  template: `
    <div
      style="padding: 10px; background-color: #fff3e0; height: 100%; display: flex; flex-direction: column;">
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Detalles de Subfamilia: {{ familiaName }}</strong>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="familiaColumnDefs"
          [rowData]="familiaRowData"
          [gridOptions]="familiaGridOptions"
          (gridReady)="onFamiliaGridReady($event)">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererFamiliaComponent implements ICellRendererAngularComp {

  params: any;
  materialId: number;
  familiaName: string;
  familiaRowData: any[] = [];
  familiaGridApi: any;

  familiaGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single'
  };

  familiaColumnDefs = [
    {
      field: 'subfamilia',
      headerName: 'Subfamilia',
      width: 150
    },
    {
      field: 'sabor',
      headerName: 'Sabor',
      width: 150
    },
    {
      field: 'presentacion',
      headerName: 'Presentación',
      width: 150
    },
    {
      field: 'descripcion',
      headerName: 'Descripción',
      width: 300,
      flex: 1
    }
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.materialId = params.data.id;
    this.familiaName = params.data.subfamilia || 'N/A';

    // Cargar datos de familia desde los datos del material
    this.familiaRowData = params.data.familiaData || [];
  }

  refresh(): boolean {
    return false;
  }

  onFamiliaGridReady(params: any) {
    this.familiaGridApi = params.api;
    params.api.sizeColumnsToFit();
  }
}
