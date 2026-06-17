import { inject, Component, ChangeDetectorRef} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { alerts } from 'app/helpers/alerts';
import { runAutosizeAllColumns } from 'app/helpers/ag-grid-autosize.helper';

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
          <div class="d-flex gap-1">
            <button type="button" class="btn btn-primary btn-lg" (click)="addCaracteristica()" title="Nueva característica">
              <i class="bi bi-plus-lg"></i>
            </button>
            <button type="button" class="btn btn-success btn-lg" (click)="editCaracteristica()" [disabled]="!selectedCaracteristica" title="Editar característica">
              <i class="bi bi-pencil"></i>
            </button>
            <button type="button" class="btn btn-danger btn-lg" (click)="deleteCaracteristica()" [disabled]="!selectedCaracteristica" title="Eliminar característica">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="caracteristicasColumnDefs"
          [rowData]="caracteristicasRowData"
          [gridOptions]="caracteristicasGridOptions"
          (gridReady)="onCaracteristicasGridReady($event)"
          (selectionChanged)="onCaracteristicasSelectionChanged($event)">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererCaracteristicasComponent implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);

  params: any;
  subfamiliaId: number;
  subfamiliaName: string;
  caracteristicasRowData: any[] = [];
  caracteristicasGridApi: any;
  selectedCaracteristica: any = null;

  caracteristicasGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single',
    onFirstDataRendered: (params: any) => runAutosizeAllColumns(params.api),
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
  
    this.cdr.detectChanges();}

  refresh(): boolean {
    return false;
  }

  onCaracteristicasGridReady(params: any) {
    this.caracteristicasGridApi = params.api;
  }

  onCaracteristicasSelectionChanged(event: any): void {
    const selectedRows = event.api.getSelectedRows();
    this.selectedCaracteristica = selectedRows.length > 0 ? selectedRows[0] : null;
  }

  addCaracteristica(): void {
    // TODO: Implementar agregar característica
    alerts.basicAlert('Funcionalidad no implementada', 'Agregar característica próximamente', 'info');
  }

  editCaracteristica(): void {
    if (!this.selectedCaracteristica) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione una característica para editar', 'warning');
      return;
    }
    // TODO: Implementar editar característica
    alerts.basicAlert('Funcionalidad no implementada', 'Editar característica próximamente', 'info');
  }

  async deleteCaracteristica(): Promise<void> {
    if (!this.selectedCaracteristica) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione una característica para eliminar', 'warning');
      return;
    }

    const result = await alerts.confirmAlert(
      '¿Eliminar característica?',
      `¿Está seguro de eliminar la característica ${this.selectedCaracteristica.sabor}?`,
      'warning',
      'Sí, eliminar'
    );

    if (result.isConfirmed) {
      // TODO: Implementar eliminación de la característica
      alerts.basicAlert('Funcionalidad no implementada', 'Eliminar característica próximamente', 'info');
    }
  
    this.cdr.detectChanges();}
}
