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
    <div class="d-flex justify-content-end gap-2 mb-2">
      <button type="button" class="btn btn-sm btn-success position-relative" (click)="saveItem()" title="Guardar cambios">
        <i class="bi bi-floppy"></i>
        <span
          class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
          *ngIf="masterNotSavedChanges">
          <span class="visually-hidden">Hay cambios sin guardar</span>
        </span>
      </button>

       <button type="button" class="btn btn-sm btn-warning" (click)="revertItem()" title="Deshacer cambios">
         <i class="bi bi-arrow-clockwise"></i>
       </button>

       <button type="button" class="btn btn-sm btn-danger" (click)="deleteItem()" title="Eliminar requisición">
         <i class="bi bi-trash"></i>
       </button>

    </div>

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
    masterNotSavedChanges: boolean = false;

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.context = params.context;
    this.buildRowData();
  }

  buildRowData() {
    const articulos = this.params.data.articulos || [];
    console.log('📋 buildRowData - articulos recibidos:', articulos);
    this.rowData = articulos.map((item: any, index: number) => {
      console.log(`   Item ${index}: pedimentoNum = "${item.pedimentoNum}"`);
      return {
        articulo: item.article,
        numeroArticulo: item.numArticle || (index + 1),
        cantidad: item.quantity,
        tipo: item.tipo,
        proveedorInterno: item.proveedorInterno,
        tipoPrioridad: item.priority,
        observacion: item.observaciones,
        pedimento: this.params.data.pedimento,
        pedimentoNumber: item.pedimentoNum || '' // ✅ Backend usa "pedimentoNum"
      };
    });
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
        width: 120
      },
      {
        field: 'numeroArticulo',
        headerName: '# Articulo',
        width: 120
      },
      {
        field: 'cantidad',
        headerName: 'Cantidad',
        width: 100
      },
      {
        field: 'tipo',
        headerName: 'Tipo',
        width: 130
      },
      {
        field: 'proveedorInterno',
        headerName: 'Proveedor Interno',
        width: 200
      },
      {
        field: 'tipoPrioridad',
        headerName: 'Tipo Prioridad',
        width: 200
      },
      {
        field: 'observacion',
        headerName: 'Observacion',
        width: 150
      },
       {
      field: 'pedimiento',
      headerName: 'Pedimento',
      width: 100,
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
      {
        field: 'pedimentoNumber',
        headerName: 'Pedimento #',
        width: 140,
        editable: false,
        cellRenderer: (params: any) => {
          if (!params.value) {
            return ''; // Si no hay valor, la celda estará vacía.
          }

          const numbers = String(params.value).split(',');
          const colorMap: { [key: string]: string } = {
            '1': '#0d6efd', // Azul
            '2': '#198754', // Verde
            '3': '#6f42c1', // Púrpura
          };

          const coloredSpans = numbers.map(num => {
            const color = colorMap[num.trim()] || 'black'; // Color por defecto si no está en el mapa
            return `<span style="color: ${color}; font-weight: bold; padding: 0 2px;">${num.trim()}</span>`;
          }).join(',');

          return coloredSpans;
        }
      },
    ];
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true
  };

saveItem() {

}

deleteItem()
{

}

revertItem(){

}


}
