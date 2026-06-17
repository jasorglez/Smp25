import { inject, Component, ChangeDetectorRef} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { DetailCellRendererCaracteristicasComponent } from './detail-cell-renderer-caracteristicas.component';
import { alerts } from 'app/helpers/alerts';
import { runAutosizeAllColumns } from 'app/helpers/ag-grid-autosize.helper';

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
          <div class="d-flex gap-1">
            <button type="button" class="btn btn-primary btn-lg" (click)="addSubfamilia()" title="Nueva subfamilia">
              <i class="bi bi-plus-lg"></i>
            </button>
            <button type="button" class="btn btn-success btn-lg" (click)="editSubfamilia()" [disabled]="!selectedSubfamilia" title="Editar subfamilia">
              <i class="bi bi-pencil"></i>
            </button>
            <button type="button" class="btn btn-danger btn-lg" (click)="deleteSubfamilia()" [disabled]="!selectedSubfamilia" title="Eliminar subfamilia">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="familiaColumnDefs"
          [rowData]="familiaRowData"
          [gridOptions]="familiaGridOptions"
          [components]="components"
          (gridReady)="onFamiliaGridReady($event)"
          (cellClicked)="onCellClicked($event)"
          (selectionChanged)="onFamiliaSelectionChanged($event)">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererFamiliaComponent implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);

  params: any;
  materialId: number;
  familiaName: string;
  familiaRowData: any[] = [];
  familiaGridApi: any;
  selectedSubfamilia: any = null;

  familiaGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single',
    masterDetail: true,
    isRowMaster: (dataItem: any) => {
      return true; // Todas las filas pueden tener detalle de características
    },
    detailCellRendererSelector: (params: any) => {
      if (params.data.detailType === 'caracteristicas') {
        return { component: 'detailCellRendererCaracteristicas' };
      }
      return undefined;
    },
    onFirstDataRendered: (params: any) => runAutosizeAllColumns(params.api),
  };

  components = {
    detailCellRendererCaracteristicas: DetailCellRendererCaracteristicasComponent
  };

  familiaColumnDefs = [
    {
      field: 'subfamilia',
      headerName: 'Subfamilia',
      width: 200,
      flex: 1
    },
    {
      field: 'caracteristicas',
      headerName: 'Características',
      width: 200,
      flex: 1,
      cellStyle: { backgroundColor: '#e8eaf6', cursor: 'pointer', textDecoration: 'underline' },
      cellRenderer: (params: any) => {
        const div = document.createElement('div');
        div.innerText = 'Ver Características';
        div.style.cursor = 'pointer';
        div.style.textDecoration = 'underline';
        return div;
      }
    }
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.materialId = params.data.id;
    this.familiaName = params.data.subfamilia || 'N/A';

    // Cargar datos de familia desde los datos del material
    this.familiaRowData = params.data.familiaData || [];
  
    this.cdr.detectChanges();}

  refresh(): boolean {
    return false;
  }

  onFamiliaGridReady(params: any) {
    this.familiaGridApi = params.api;
  }

  onFamiliaSelectionChanged(event: any): void {
    const selectedRows = event.api.getSelectedRows();
    this.selectedSubfamilia = selectedRows.length > 0 ? selectedRows[0] : null;
  }

  addSubfamilia(): void {
    // TODO: Implementar agregar subfamilia
    alerts.basicAlert('Funcionalidad no implementada', 'Agregar subfamilia próximamente', 'info');
  }

  editSubfamilia(): void {
    if (!this.selectedSubfamilia) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione una subfamilia para editar', 'warning');
      return;
    }
    // TODO: Implementar editar subfamilia
    alerts.basicAlert('Funcionalidad no implementada', 'Editar subfamilia próximamente', 'info');
  }

  async deleteSubfamilia(): Promise<void> {
    if (!this.selectedSubfamilia) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione una subfamilia para eliminar', 'warning');
      return;
    }

    const result = await alerts.confirmAlert(
      '¿Eliminar subfamilia?',
      `¿Está seguro de eliminar la subfamilia ${this.selectedSubfamilia.subfamilia}?`,
      'warning',
      'Sí, eliminar'
    );

    if (result.isConfirmed) {
      // TODO: Implementar eliminación de la subfamilia
      alerts.basicAlert('Funcionalidad no implementada', 'Eliminar subfamilia próximamente', 'info');
    }
  }

  onCellClicked(event: any): void {
    const colId = event.column.getColId();

    if (colId === 'caracteristicas') {
      const node = event.node;
      const api = event.api;

      // Verificar si ya está expandido con detalle de características
      const isCurrentlyExpanded = node.expanded && event.data.detailType === 'caracteristicas';

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
        if (node.expanded && event.data.detailType !== 'caracteristicas') {
          node.setExpanded(false);
        }

        // Asignar el tipo de detalle
        event.data.detailType = 'caracteristicas';

        // Aplicar los cambios de altura
        api.onRowHeightChanged();

        // Expandir con el detalle de características
        setTimeout(() => {
          node.setExpanded(true);
        }, 0);
      }
    }
  }
}
