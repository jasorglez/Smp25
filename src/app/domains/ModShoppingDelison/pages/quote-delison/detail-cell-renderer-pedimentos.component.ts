import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, ICellRendererParams, GridApi } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ButtonCellRendererComponent } from './button-cell-renderer.component';
import { DetailCellRendererPedimentosItemsComponent } from './detail-cell-renderer-pedimentos-items.component';

@Component({
  selector: 'app-detail-cell-renderer-pedimentos',
  standalone: true,
  imports: [CommonModule, AgGridModule, ButtonCellRendererComponent, DetailCellRendererPedimentosItemsComponent],
  template: `
    <div class="detail-grid-container">
      <ag-grid-angular
        #agGrid
        class="ag-theme-quartz small-text-ag-grid"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [gridOptions]="gridOptions"
        [localeText]="AG_GRID_LOCALE_ES"
        (gridReady)="onGridReady($event)"
        style="height: 300px; width: 100%;">
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
export class DetailCellRendererPedimentosComponent {
  private params!: ICellRendererParams;
  private gridApi!: GridApi;
  rowData: any[] = [];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.buildRowData();
  }

  onGridReady(params: any) {
    this.gridApi = params.api;
  }

  buildRowData() {
    const pedimentos = this.params.data.pedimentos || [];
    this.rowData = [];

    pedimentos.forEach((pedimento: any) => {
      const fechaPedimento = pedimento.createdAt ? pedimento.createdAt.split('T')[0] : '';

      this.rowData.push({
        pedimento: pedimento.name,
        articulos: pedimento.items,
        pdf: 'PDF',
        fechaPedimento: fechaPedimento
      });
    });
  }

  get colDefs(): ColDef[] {
    return [
      {
        field: 'pedimento',
        headerName: 'PEDIMENTO',
        width: 150
      },
      {
        field: 'articulos',
        headerName: 'ARTICULOS',
        width: 200,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleArticulosCascade(node),
        },
        valueGetter: params => params.data.articulos ? params.data.articulos.length : 0,
        editable: false,
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer' }
      },
      {
        field: 'pdf',
        headerName: 'PDF',
        width: 100,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => {
            alert('PDF clicked for ' + node.data.pedimento);
          },
          icon: 'bi-file-earmark-pdf',
          title: 'Ver PDF'
        }
      },
      {
        field: 'fechaPedimento',
        headerName: 'FECHA PEDIMENTO',
        width: 150
      }
    ];
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    masterDetail: true,
    detailRowHeight: 300,
    detailCellRenderer: DetailCellRendererPedimentosItemsComponent
  };

  toggleArticulosCascade(node: any) {
    this.gridApi.setGridOption('detailCellRenderer', DetailCellRendererPedimentosItemsComponent);
    node.setSelected(true);

    const isCurrentlyExpanded = node.expanded;

    if (isCurrentlyExpanded) {
      node.setExpanded(false);
    } else {
      this.gridApi.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id && otherNode.expanded) {
          otherNode.setExpanded(false);
        }
      });
      node.setExpanded(true);
    }
  }
}
