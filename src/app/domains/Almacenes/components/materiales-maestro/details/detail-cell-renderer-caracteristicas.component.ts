import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-detail-cell-renderer-caracteristicas',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  template: `
    <div
      style="padding: 10px; background-color: #e8eaf6; height: 100%; display: flex; flex-direction: column;">
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Características de: {{ subfamiliaName }}</strong>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="caracteristicasColumnDefs"
          [rowData]="caracteristicasRowData"
          [gridOptions]="caracteristicasGridOptions"
          (gridReady)="onCaracteristicasGridReady($event)">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererCaracteristicasComponent implements ICellRendererAngularComp {

  params: any;
  subfamiliaId: number;
  subfamiliaName: string;
  caracteristicasRowData: any[] = [];
  caracteristicasGridApi: any;

  caracteristicasGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single'
  };

  caracteristicasColumnDefs: any[] = [
    {
      field: 'sabor',
      headerName: 'Sabor',
      width: 200,
      flex: 1
    },
    {
      field: 'presentacion',
      headerName: 'Presentación',
      width: 200,
      flex: 1
    },
    {
      field: 'descripcion',
      headerName: 'Descripción',
      width: 400,
      flex: 2
    }
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.subfamiliaId = params.data.id;
    this.subfamiliaName = params.data.subfamilia || 'N/A';

    // Cargar datos de características desde los datos de la subfamilia
    this.caracteristicasRowData = params.data.caracteristicasData || [];
  }

  refresh(): boolean {
    return false;
  }

  onCaracteristicasGridReady(params: any) {
    this.caracteristicasGridApi = params.api;
    params.api.sizeColumnsToFit();
  }
}
