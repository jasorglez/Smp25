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
  rowData: any[] = [];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  agInit(params: ICellRendererParams): void {
    this.params = params;
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

  get colDefs(): ColDef[] {
    return [
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
        field: 'pedimento',
        headerName: 'Pedimento',
        width: 150
      }
    ];
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true
  };
}