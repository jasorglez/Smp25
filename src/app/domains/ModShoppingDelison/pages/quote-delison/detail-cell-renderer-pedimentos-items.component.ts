import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';

@Component({
  selector: 'app-detail-cell-renderer-pedimentos-items',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div class="detail-grid-container">
      <ag-grid-angular
        class="ag-theme-quartz small-text-ag-grid"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [gridOptions]="gridOptions"
        [localeText]="AG_GRID_LOCALE_ES"
        style="height: 250px; width: 100%;">
      </ag-grid-angular>
    </div>
  `,
  styles: [`
    .detail-grid-container {
      padding: 8px;
      background-color: #f8f9fa;
      border-radius: 8px;
    }
  `]
})
export class DetailCellRendererPedimentosItemsComponent {
  private params!: ICellRendererParams;
  private context: any;
  rowData: any[] = [];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.context = params.context;
    this.buildRowData();
  }

  buildRowData() {
    const articulos = this.params.data.articulos || [];
    this.rowData = articulos.map((item: any, index: number) => ({
      articulo: item.article,
      numeroArticulo: index + 1,
      cantidad: item.quantity,
      tipo: item.tipo,
      proveedorInterno: item.proveedorInterno,
      tipoPrioridad: item.priority,
      observacion: item.observaciones,
      pedimento: this.params.data.pedimento
    }));
  }

  checkPedimentoSelection() {
    // This method can be used to check if any pedimento is selected
    // For now, it's a placeholder to match the requisitions component
  }

  get colDefs(): ColDef[] {
    return [
       {
        field: 'recurrent',
        headerName: 'Recurrente',
        width: 120,
        editable: (params) => {
          // Solo es editable si el valor NO es 'Nuevo'.
          return params.data.recurrent !== 'Nuevo';
        },
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Recurrente', 'Nuevo']
        },
        valueSetter: (params: any) => {
          params.data.recurrent = params.newValue;
          return true;
        }
      },

      {
        field: 'articulo',
        headerName: 'Articulo',
        width: 150
      },
      {
        field: 'numeroArticulo',
        headerName: '# Articulo',
        width: 100
      },
      {
        field: 'cantidad',
        headerName: 'Cantidad',
        width: 100
      },
      {
        field: 'tipo',
        headerName: 'Tipo',
        width: 100
      },
      {
        field: 'proveedorInterno',
        headerName: 'Proveedor Interno',
        width: 150
      },
      {
        field: 'tipoPrioridad',
        headerName: 'Tipo Prioridad',
        width: 120
      },
      {
        field: 'observacion',
        headerName: 'Observacion',
        width: 150
      },
       {
      field: 'pedimiento',
      headerName: 'Pedimiento',
      width: 140,
      editable: false,
      cellRenderer: (params: any) => {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = params.value === true;

        input.addEventListener('change', () => {
          params.data.pedimiento = input.checked;
          params.api.refreshCells({ rowNodes: [params.node], columns: ['pedimiento'] });
          this.checkPedimentoSelection();
          // Refresh master grid comments column
          if (this.context && this.context.gridApi) {
            this.context.gridApi.refreshCells({ force: true });
          }
        });

        return input;
      }
      },
    ];
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true
  };
}