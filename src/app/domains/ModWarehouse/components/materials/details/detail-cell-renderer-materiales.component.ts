import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-detail-cell-renderer-materiales',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  template: `
    <div
      style="padding: 10px; background-color: #e1f5fe; height: 100%; display: flex; flex-direction: column;">
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Materiales de: {{ articuloName }}</strong>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="materialesColumnDefs"
          [rowData]="materialesRowData"
          [gridOptions]="materialesGridOptions"
          (gridReady)="onMaterialesGridReady($event)">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererMaterialesComponent implements ICellRendererAngularComp {

  params: any;
  articuloId: number;
  articuloName: string;
  materialesRowData: any[] = [];
  materialesGridApi: any;

  materialesGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single'
  };

  materialesColumnDefs: any[] = [
    {
      field: 'materiales',
      headerName: 'Materiales',
      width: 200,
      flex: 1
    },
    {
      field: 'costo',
      headerName: 'Costo',
      width: 120,
      valueFormatter: (params: any) => {
        return params.value ? `$${params.value.toFixed(2)}` : '$0.00';
      }
    },
    {
      field: 'cantidad',
      headerName: 'Cantidad',
      width: 120
    },
    {
      field: 'proporcion',
      headerName: 'Proporción',
      width: 120
    },
    {
      field: 'checkBox',
      headerName: 'Check Box',
      width: 100,
      editable: true,
      cellRenderer: 'agCheckboxCellRenderer',
      cellEditor: 'agCheckboxCellEditor'
    },
    {
      field: 'costoTotal',
      headerName: 'Costo Total',
      width: 130,
      valueFormatter: (params: any) => {
        return params.value ? `$${params.value.toFixed(2)}` : '$0.00';
      }
    },
    {
      field: 'merma',
      headerName: 'Merma',
      width: 120
    }
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.articuloId = params.data.id;
    this.articuloName = params.data.articulo || 'N/A';

    // Cargar datos de materiales desde los datos del artículo
    this.materialesRowData = params.data.materialesData || [];
  }

  refresh(): boolean {
    return false;
  }

  onMaterialesGridReady(params: any) {
    this.materialesGridApi = params.api;
    params.api.sizeColumnsToFit();
  }
}
