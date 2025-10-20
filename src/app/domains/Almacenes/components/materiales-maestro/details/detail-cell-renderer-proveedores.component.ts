import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams, GridApi } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { DetailCellRendererSucursalComponent } from './detail-cell-renderer-sucursal.component';
import { alerts } from 'app/helpers/alerts';

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
          <div class="d-flex gap-1">
            <button type="button" class="btn btn-primary btn-lg" (click)="addProveedor()" title="Nuevo proveedor">
              <i class="bi bi-plus-lg"></i>
            </button>
            <button type="button" class="btn btn-success btn-lg" (click)="editProveedor()" [disabled]="!selectedProveedor" title="Editar proveedor">
              <i class="bi bi-pencil"></i>
            </button>
            <button type="button" class="btn btn-danger btn-lg" (click)="deleteProveedor()" [disabled]="!selectedProveedor" title="Eliminar proveedor">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="proveedorColumnDefs"
          [rowData]="proveedorRowData"
          [gridOptions]="proveedorGridOptions"
          [components]="components"
          (gridReady)="onProveedorGridReady($event)"
          (cellClicked)="onCellClicked($event)"
          (selectionChanged)="onProveedorSelectionChanged($event)">
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
  selectedProveedor: any = null;

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
      headerName: 'Precio Unitario(PZA/KG/L)',
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
      width: 120
    },
    {
      field: 'medidas',
      headerName: 'Medidas',
      width: 120,
      flex: 1
    },
    {
      field: 'pesoVolumen',
      headerName: 'Peso/Volumen(PZA/KG/L',
      width: 140
    },
    {
      field: 'caducidadGarantia',
      headerName: 'Caducidad o Garantía(Meses)',
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

  onProveedorSelectionChanged(event: any): void {
    const selectedRows = event.api.getSelectedRows();
    this.selectedProveedor = selectedRows.length > 0 ? selectedRows[0] : null;
  }

  addProveedor(): void {
    // TODO: Implementar agregar proveedor
    alerts.basicAlert('Funcionalidad no implementada', 'Agregar proveedor próximamente', 'info');
  }

  editProveedor(): void {
    if (!this.selectedProveedor) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un proveedor para editar', 'warning');
      return;
    }
    // TODO: Implementar editar proveedor
    alerts.basicAlert('Funcionalidad no implementada', 'Editar proveedor próximamente', 'info');
  }

  async deleteProveedor(): Promise<void> {
    if (!this.selectedProveedor) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un proveedor para eliminar', 'warning');
      return;
    }

    const result = await alerts.confirmAlert(
      '¿Eliminar proveedor?',
      `¿Está seguro de eliminar el proveedor ${this.selectedProveedor.nombreProveedor}?`,
      'warning',
      'Sí, eliminar'
    );

    if (result.isConfirmed) {
      // TODO: Implementar eliminación del proveedor
      alerts.basicAlert('Funcionalidad no implementada', 'Eliminar proveedor próximamente', 'info');
    }
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
