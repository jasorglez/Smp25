import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-detail-cell-renderer-parametros',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  template: `
    <div
      style="padding: 10px; background-color: #fff9c4; height: 100%; display: flex; flex-direction: column;">
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Parámetros de: {{ articuloName }}</strong>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="parametrosColumnDefs"
          [rowData]="parametrosRowData"
          [gridOptions]="parametrosGridOptions"
          (gridReady)="onParametrosGridReady($event)">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererParametrosComponent implements ICellRendererAngularComp {

  params: any;
  articuloId: number;
  articuloName: string;
  parametrosRowData: any[] = [];
  parametrosGridApi: any;

  parametrosGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single'
  };

  parametrosColumnDefs: any[] = [
    {
      field: 'parametros',
      headerName: 'Parámetros',
      width: 200,
      flex: 1
    },
    {
      field: 'minimo',
      headerName: 'Mínimo',
      width: 120,
      editable: true
    },
    {
      field: 'objetivo',
      headerName: 'Objetivo',
      width: 120,
      editable: true
    },
    {
      field: 'maximo',
      headerName: 'Máximo',
      width: 120,
      editable: true
    }
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.articuloId = params.data.id;
    this.articuloName = params.data.articulo || 'N/A';

    // Cargar datos de parámetros desde los datos del artículo
    this.parametrosRowData = params.data.parametrosData || [];
  }

  refresh(): boolean {
    return false;
  }

  onParametrosGridReady(params: any) {
    this.parametrosGridApi = params.api;
    params.api.sizeColumnsToFit();
  }
}
