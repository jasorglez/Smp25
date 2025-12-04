import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, ICellRendererParams, GridApi } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ButtonCellRendererComponent } from './button-cell-renderer.component';
import { DetailCellRendererPedimentosItemsComponent } from './detail-cell-renderer-pedimentos-items.component';
import { DetailCellRendererProveedorQuoteComponent } from './detail-cell-renderer-proveedor-quote.component';

@Component({
  selector: 'app-detail-cell-renderer-pedimentos',
  standalone: true,
  imports: [CommonModule, AgGridModule, ButtonCellRendererComponent, DetailCellRendererPedimentosItemsComponent, DetailCellRendererProveedorQuoteComponent],
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
    const providers = this.params.data.providers || [];
    this.rowData = [];

    pedimentos.forEach((pedimento: any) => {
      const fechaPedimento = pedimento.createdAt ? pedimento.createdAt.split('T')[0] : '';
      const proveedor1 = providers[0]?.name || '';
      const proveedor2 = providers[1]?.name || '';
      const proveedor3 = providers[2]?.name || '';

      this.rowData.push({
        pedimento: pedimento.name,
        articulos: pedimento.items,
        pdf: 'PDF',
        fechaPedimento: fechaPedimento,
        proveedor1: proveedor1,
        proveedor2: proveedor2,
        proveedor3: proveedor3
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
        headerName: 'ARTICULO',
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
      },
      {
        field: 'proveedor1',
        headerName: 'PROVEEDOR 1',
        width: 150,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleProveedorCascade(node, 0),
        },
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer' }
      },
      {
        field: 'proveedor2',
        headerName: 'PROVEEDOR 2',
        width: 150,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleProveedorCascade(node, 1),
        },
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer' }
      },
      {
        field: 'proveedor3',
        headerName: 'PROVEEDOR 3',
        width: 150,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleProveedorCascade(node, 2),
        },
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer' }
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

  toggleProveedorCascade(node: any, providerIndex: number) {
    this.gridApi.setGridOption('detailCellRenderer', DetailCellRendererProveedorQuoteComponent);
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
      // Set context for the provider
      this.gridApi.setGridOption('detailCellRendererParams', {
        selectedProviderIndex: providerIndex,
        providers: this.params.data.providers
      });
      node.setExpanded(true);
    }
  }
}