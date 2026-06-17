import { inject, Component, ChangeDetectorRef} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { alerts } from 'app/helpers/alerts';
import { runAutosizeAllColumns } from 'app/helpers/ag-grid-autosize.helper';

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
          <div class="d-flex gap-1">
            <button type="button" class="btn btn-primary btn-lg" (click)="addSucursal()" title="Nueva sucursal">
              <i class="bi bi-plus-lg"></i>
            </button>
            <button type="button" class="btn btn-success btn-lg" (click)="editSucursal()" [disabled]="!selectedSucursal" title="Editar sucursal">
              <i class="bi bi-pencil"></i>
            </button>
            <button type="button" class="btn btn-danger btn-lg" (click)="deleteSucursal()" [disabled]="!selectedSucursal" title="Eliminar sucursal">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="sucursalColumnDefs"
          [rowData]="sucursalRowData"
          [gridOptions]="sucursalGridOptions"
          (gridReady)="onSucursalGridReady($event)"
          (selectionChanged)="onSucursalSelectionChanged($event)">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererSucursalComponent implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);

  params: any;
  materialId: number;
  materialName: string;
  sucursalRowData: any[] = [];
  sucursalGridApi: any;
  selectedSucursal: any = null;

  sucursalGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single',
    onFirstDataRendered: (params: any) => runAutosizeAllColumns(params.api),
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
  
    this.cdr.detectChanges();}

  refresh(): boolean {
    return false;
  }

  onSucursalGridReady(params: any) {
    this.sucursalGridApi = params.api;
  }

  onSucursalSelectionChanged(event: any): void {
    const selectedRows = event.api.getSelectedRows();
    this.selectedSucursal = selectedRows.length > 0 ? selectedRows[0] : null;
  }

  addSucursal(): void {
    // TODO: Implementar agregar sucursal
    alerts.basicAlert('Funcionalidad no implementada', 'Agregar sucursal próximamente', 'info');
  }

  editSucursal(): void {
    if (!this.selectedSucursal) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione una sucursal para editar', 'warning');
      return;
    }
    // TODO: Implementar editar sucursal
    alerts.basicAlert('Funcionalidad no implementada', 'Editar sucursal próximamente', 'info');
  }

  async deleteSucursal(): Promise<void> {
    if (!this.selectedSucursal) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione una sucursal para eliminar', 'warning');
      return;
    }

    const result = await alerts.confirmAlert(
      '¿Eliminar sucursal?',
      `¿Está seguro de eliminar la sucursal ${this.selectedSucursal.sucursal}?`,
      'warning',
      'Sí, eliminar'
    );

    if (result.isConfirmed) {
      // TODO: Implementar eliminación de la sucursal
      alerts.basicAlert('Funcionalidad no implementada', 'Eliminar sucursal próximamente', 'info');
    }
  
    this.cdr.detectChanges();}
}
