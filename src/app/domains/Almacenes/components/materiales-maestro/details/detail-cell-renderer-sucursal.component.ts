import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-detail-cell-renderer-sucursal',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  template: `
    <div
      style="padding: 10px; background-color: #e8f5e9; height: 100%; display: flex; flex-direction: column;">
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Detalles de Sucursales - Material: {{ materialName }}</strong>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="sucursalColumnDefs"
          [rowData]="sucursalRowData"
          [gridOptions]="sucursalGridOptions"
          (gridReady)="onSucursalGridReady($event)">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererSucursalComponent implements ICellRendererAngularComp {

  params: any;
  materialId: number;
  materialName: string;
  sucursalRowData: any[] = [];
  sucursalGridApi: any;

  sucursalGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single'
  };

  sucursalColumnDefs = [
    {
      field: 'sucursal',
      headerName: 'Sucursal',
      width: 200
    },
    {
      field: 'fechaAlta',
      headerName: 'Fecha Alta',
      width: 120
    },
    {
      field: 'stockMinimo',
      headerName: 'Stock Mínimo',
      width: 130,
      valueFormatter: (params: any) => params.value ? params.value.toLocaleString() : '0'
    },
    {
      field: 'resurtido',
      headerName: 'Resurtido',
      width: 130,
      valueFormatter: (params: any) => params.value ? params.value.toLocaleString() : '0'
    },
    {
      field: 'capacidadMaxAlmacen',
      headerName: 'Capacidad Max Almacén',
      width: 180,
      valueFormatter: (params: any) => params.value ? params.value.toLocaleString() : '0'
    },
    {
      field: 'tiempoEntrega',
      headerName: 'Tiempo de Entrega',
      width: 150,
      flex: 1
    }
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.materialId = params.data.id;
    this.materialName = params.data.articulo || 'N/A';

    // Cargar datos de sucursales desde los datos del material
    this.sucursalRowData = params.data.sucursalData || [];
  }

  refresh(): boolean {
    return false;
  }

  onSucursalGridReady(params: any) {
    this.sucursalGridApi = params.api;
    params.api.sizeColumnsToFit();
  }
}
