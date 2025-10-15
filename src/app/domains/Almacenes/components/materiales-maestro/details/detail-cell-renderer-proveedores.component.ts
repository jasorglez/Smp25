import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule, CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-detail-cell-renderer-proveedores',
  standalone: true,
  providers: [CurrencyPipe],
  imports: [AgGridModule, CommonModule],
  template: `
    <div
      style="padding: 10px; background-color: #e3f2fd; height: 100%; display: flex; flex-direction: column;">
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Proveedores de: {{ materialName }}</strong>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="proveedorColumnDefs"
          [rowData]="proveedorRowData"
          [gridOptions]="proveedorGridOptions"
          (gridReady)="onProveedorGridReady($event)">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererProveedoresComponent implements ICellRendererAngularComp {

  params: any;
  materialId: number;
  materialName: string;
  proveedorRowData: any[] = [];
  proveedorGridApi: any;

  constructor(private currencyPipe: CurrencyPipe) {}

  proveedorGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single'
  };

  proveedorColumnDefs = [
    {
      field: 'nombreProveedor',
      headerName: 'Nombre Proveedor',
      width: 200,
      flex: 1
    },
    {
      field: 'precioUnitario',
      headerName: 'Precio Unitario',
      width: 130,
      valueFormatter: (params) => {
        const isNumeric = params.value !== null && params.value !== '' && !isNaN(Number(params.value));
        return isNumeric ? this.currencyPipe.transform(params.value, '', 'symbol', '1.2-2') : '$0.00';
      }
    },
    {
      field: 'descripcionEmpaque',
      headerName: 'Descripción Empaque',
      width: 180,
      flex: 1
    },
    {
      field: 'piezasPorPaquete',
      headerName: 'Piezas x Paquete',
      width: 140
    },
    {
      field: 'medidas',
      headerName: 'Medidas',
      width: 140,
      flex: 1
    },
    {
      field: 'pesoVolumen',
      headerName: 'Peso o Volumen',
      width: 140
    },
    {
      field: 'caducidadGarantia',
      headerName: 'Caducidad o Garantía',
      width: 160,
      flex: 1
    },
    {
      field: 'sucursal',
      headerName: 'Sucursal',
      width: 150,
      flex: 1
    }
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.materialId = params.data.id;
    this.materialName = params.data.articulo || params.data.numMat;

    // Cargar proveedores desde los datos del material
    this.proveedorRowData = params.data.proveedoresData || [];
  }

  refresh(): boolean {
    return false;
  }

  onProveedorGridReady(params: any) {
    this.proveedorGridApi = params.api;
    params.api.sizeColumnsToFit();
  }
}
