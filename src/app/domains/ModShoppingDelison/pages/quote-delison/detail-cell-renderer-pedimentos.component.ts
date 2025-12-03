import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ButtonCellRendererComponent } from '../../../ModWareHousesTD/components/inandout-st/button-cell-renderer.component';
import { DetailCellRendererPedimentosItemsComponent } from './detail-cell-renderer-pedimentos-items.component';
import { DetailCellRendererQuotesProvidersComponent } from './detail-cell-renderer-quotes-providers.component';

@Component({
  selector: 'app-detail-cell-renderer-pedimentos',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, DetailCellRendererPedimentosItemsComponent, DetailCellRendererQuotesProvidersComponent],
  template: `
    <div class="detail-grid-container">
      <div class="detail-header mb-2">r
        <h6>Pedimentos de la Cotización</h6>
      </div>
      <ag-grid-angular
        #agGrid
        class="ag-theme-quartz small-text-ag-grid"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [gridOptions]="gridOptions"
        [localeText]="AG_GRID_LOCALE_ES"
        (gridReady)="onGridReady($event)"
        style="height: 250px; width: 100%;">
      </ag-grid-angular>
    </div>
  `,
  styles: [`
    .detail-grid-container {
      padding: 10px;
      background-color: #f8f9fa;
    }
    .detail-header {
      border-bottom: 1px solid #dee2e6;
      padding-bottom: 5px;
    }
  `]
})
export class DetailCellRendererPedimentosComponent implements OnInit {

  private params!: any;
  private gridApi!: GridApi;

  rowData: any[] = [];
  cascadeType: 'items' | 'provider' | null = null;
  selectedProviderIndex: number | null = null;

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    this.loadData();
  }

  agInit(params: any): void {
    this.params = params;
    this.loadData();
  }

  loadData() {
    if (this.params && this.params.data && this.params.data.pedimentos) {
      // Transform pedimentos data to include provider info
      this.rowData = this.params.data.pedimentos.map((pedimento: any) => ({
        ...pedimento,
        fechaPedimento: pedimento.createdAt || new Date().toISOString(),
        providers: this.params.data.providers || []
      }));
    }
  }

  get colDefs(): ColDef[] {
    return [
      {
        headerName: '#',
        width: 50,
        valueGetter: (params) => params.node.rowIndex + 1,
        pinned: 'left',
        cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' }
      },

      {
        field: 'name',
        headerName: 'Pedimento',
        width: 120,
        valueGetter: (params) => params.data.name || `Pedimento ${params.node.rowIndex + 1}`
      },

      {
        field: 'itemsCount',
        headerName: 'Items',
        width: 120,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.openItemsCascade(node),
        },
        valueGetter: (params) => params.data.items ? params.data.items.length : 0,
        editable: false,
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer', textDecoration: 'underline' }
      },

      {
        field: 'fechaPedimento',
        headerName: 'Fecha Pedimento',
        width: 150,
        valueFormatter: (params) => {
          if (params.value) {
            return new Date(params.value).toLocaleDateString();
          }
          return '';
        }
      },
      
      {
        field: 'pdf',
        headerName: 'PDF',
        width: 80,
        cellRenderer: (params: any) => {
          return `<button class="btn btn-sm btn-primary">PDF</button>`;
        }
      },
      {
        field: 'provider1',
        headerName: 'Proveedor 1',
        width: 150,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.openProviderCascade(node, 0),
        },
        valueGetter: (params) => params.data.providers && params.data.providers[0] ? params.data.providers[0].name : '',
        editable: false,
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer', textDecoration: 'underline' }
      },
      {
        field: 'provider2',
        headerName: 'Proveedor 2',
        width: 150,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.openProviderCascade(node, 1),
        },
        valueGetter: (params) => params.data.providers && params.data.providers[1] ? params.data.providers[1].name : '',
        editable: false,
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer', textDecoration: 'underline' }
      },
      {
        field: 'provider3',
        headerName: 'Proveedor 3',
        width: 150,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.openProviderCascade(node, 2),
        },
        valueGetter: (params) => params.data.providers && params.data.providers[2] ? params.data.providers[2].name : '',
        editable: false,
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer', textDecoration: 'underline' }
      }
    ];
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    masterDetail: true,
    detailRowHeight: 400,
    isRowMaster: (dataItem: any) => true,
    detailCellRenderer: DetailCellRendererPedimentosItemsComponent
  };

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;

    this.gridApi.setGridOption('detailCellRendererParams', {
      getDetailRowData: (params: any) => {
        if (params.data.cascadeType === 'items') {
          params.successCallback(params.data.items || []);
        } else if (params.data.cascadeType === 'provider') {
          // For provider cascade, we'll show the provider details in the renderer
          params.successCallback([params.data.providers[params.data.selectedProviderIndex]]);
        } else {
          params.successCallback([]);
        }
      },
      cascadeType: (params: any) => params.data.cascadeType,
      selectedProviderIndex: (params: any) => params.data.selectedProviderIndex
    });
  }

  openItemsCascade(node: any) {
    const api = this.gridApi;

    if (node.expanded && this.cascadeType === 'items') {
      // If already expanded with items, collapse it
      node.setExpanded(false);
      this.cascadeType = null;
    } else {
      // Close any other expanded cascades
      api.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id && otherNode.expanded) {
          otherNode.setExpanded(false);
          otherNode.data.cascadeType = null;
        }
      });

      // Set cascade type and expand
      this.cascadeType = 'items';
      node.data.cascadeType = 'items';
      node.setExpanded(true);
      console.log('Opening items cascade for pedimento:', node.data);
    }
  }

  openProviderCascade(node: any, providerIndex: number) {
    const api = this.gridApi;

    if (node.expanded && this.cascadeType === 'provider' && this.selectedProviderIndex === providerIndex) {
      // If already expanded with this provider, collapse it
      node.setExpanded(false);
      this.cascadeType = null;
      this.selectedProviderIndex = null;
    } else {
      // Close any other expanded cascades
      api.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id && otherNode.expanded) {
          otherNode.setExpanded(false);
          otherNode.data.cascadeType = null;
          otherNode.data.selectedProviderIndex = null;
        }
      });

      // Set cascade type and provider index
      this.cascadeType = 'provider';
      this.selectedProviderIndex = providerIndex;
      node.data.cascadeType = 'provider';
      node.data.selectedProviderIndex = providerIndex;
      node.setExpanded(true);
      console.log('Opening provider cascade for pedimento:', node.data, 'provider index:', providerIndex);
    }
  }

  openProviderDetail(node: any, providerIndex: number) {
    // This would open another level of detail or modal with provider information
    console.log('Opening provider detail for pedimento:', node.data, 'provider index:', providerIndex);
    if (node.data.providers && node.data.providers[providerIndex]) {
      console.log('Provider details:', node.data.providers[providerIndex]);
    }
  }
}