import { inject, Component, ChangeDetectorRef} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-detail-cell-renderer-historico',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  template: `
    <div
      style="padding: 10px; background-color: #f3e5f5; height: 100%; display: flex; flex-direction: column;">
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Histórico de: {{ materialName }}</strong>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="historicoColumnDefs"
          [rowData]="historicoRowData"
          [gridOptions]="historicoGridOptions"
          (gridReady)="onHistoricoGridReady($event)">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererHistoricoComponent implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);

  params: any;
  materialId: number;
  materialName: string;
  historicoRowData: any[] = [];
  historicoGridApi: any;

  historicoGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single'
  };

  historicoColumnDefs: any[] = [
    {
      field: 'materialPrimeraFase',
      headerName: 'Material Primera Fase',
      width: 200,
      flex: 1
    },
    {
      field: 'materiaPrimaBasica',
      headerName: 'Material Prima Basica',
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
      field: 'cantidadLtsKg',
      headerName: 'Cantidad LTS/KGS',
      width: 140
    },
    {
      field: 'costoTotal',
      headerName: 'Costo Total',
      width: 120,
      valueFormatter: (params: any) => {
        return params.value ? `$${params.value.toFixed(2)}` : '$0.00';
      }
    },
    {
      field: 'productoMermaLtsKg',
      headerName: 'Producto Merma LTS/KG',
      width: 180
    },
    {
      field: 'porcentajeMerma',
      headerName: 'Porcentaje Merma (% 2.00 %)',
      width: 180
    },
    {
      field: 'costoFinal',
      headerName: 'Costo Final',
      width: 120,
      valueFormatter: (params: any) => {
        return params.value ? `$${params.value.toFixed(2)}` : '$0.00';
      }
    },
    {
      field: 'fechaCambio',
      headerName: 'Fecha Cambio',
      width: 120,
      valueFormatter: (params: any) => {
        if (params.value) {
          return new Date(params.value).toLocaleDateString('es-MX');
        }
        return '';
      },
      sort: 'desc'
    },
    {
      field: 'asignado',
      headerName: 'Asignado',
      width: 100,
      editable: true,
      cellRenderer: 'agCheckboxCellRenderer',
      cellEditor: 'agCheckboxCellEditor'
    }
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.materialId = params.data.id;
    this.materialName = params.data.materialPrimeraFase || 'N/A';

    // Cargar datos de histórico desde los datos del material
    // Ordenar por fecha descendente (más reciente primero)
    this.historicoRowData = (params.data.historicoData || []).sort((a: any, b: any) => {
      const dateA = new Date(a.fechaCambio).getTime();
      const dateB = new Date(b.fechaCambio).getTime();
      return dateB - dateA; // Descendente
    });
  
    this.cdr.detectChanges();}

  refresh(): boolean {
    return false;
  }

  onHistoricoGridReady(params: any) {
    this.historicoGridApi = params.api;
    params.api.sizeColumnsToFit();
  }
}
