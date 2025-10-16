import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams, GridApi } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { DetailCellRendererSucursalComponent } from './detail-cell-renderer-sucursal.component';

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
          [components]="components"
          (gridReady)="onProveedorGridReady($event)"
          (cellClicked)="onCellClicked($event)">
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
    rowSelection: 'single',
    masterDetail: true,
    isRowMaster: (dataItem: any) => {
      return true; // Todas las filas pueden tener detalle de sucursal
    },
    detailCellRendererSelector: (params: any) => {
      if (params.data.detailType === 'sucursal') {
        return { component: 'detailCellRendererSucursal' };
      }
      return undefined;
    }
  };

  components = {
    detailCellRendererSucursal: DetailCellRendererSucursalComponent
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
      flex: 1,
      cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer', textDecoration: 'underline' },
      cellRenderer: (params: any) => {
        const div = document.createElement('div');
        div.innerText = params.value || '';
        div.style.cursor = 'pointer';
        div.style.textDecoration = 'underline';
        return div;
      }
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

  onCellClicked(event: any): void {
    const colId = event.column.getColId();

    if (colId === 'sucursal') {
      const node = event.node;
      const api = event.api;

      // Verificar si ya está expandido con detalle de sucursal
      const isCurrentlyExpanded = node.expanded && event.data.detailType === 'sucursal';

      if (isCurrentlyExpanded) {
        // Si ya está expandido, colapsarlo y mostrar todas las filas
        node.setExpanded(false);

        // Mostrar todas las filas de nuevo
        api.forEachNode((otherNode: any) => {
          otherNode.setRowHeight(undefined);
        });
        api.onRowHeightChanged();
      } else {
        // Colapsar cualquier otra fila expandida en este grid
        api.forEachNode((otherNode: any) => {
          if (otherNode.expanded && otherNode.id !== node.id) {
            otherNode.setExpanded(false);
          }
        });

        // Ocultar todas las demás filas (altura 0)
        api.forEachNode((otherNode: any) => {
          if (otherNode.id !== node.id) {
            otherNode.setRowHeight(0);
          }
        });

        // Si la fila está expandida con otro tipo de detalle, cerrarla primero
        if (node.expanded && event.data.detailType !== 'sucursal') {
          node.setExpanded(false);
        }

        // Asignar sucursalData del material padre al proveedor
        event.data.sucursalData = this.params.data.sucursalData || [];
        event.data.detailType = 'sucursal';

        // Aplicar los cambios de altura
        api.onRowHeightChanged();

        // Expandir con el detalle de sucursal
        setTimeout(() => {
          node.setExpanded(true);
        }, 0);
      }
    }
  }
}
