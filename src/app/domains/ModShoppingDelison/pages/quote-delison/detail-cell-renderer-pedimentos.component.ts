import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, ICellRendererParams, GridApi } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ButtonCellRendererComponent } from './button-cell-renderer.component';
import { DetailCellRendererPedimentosItemsComponent } from './detail-cell-renderer-pedimentos-items.component';
import { DetailCellRendererProveedorComponent } from './detail-cell-renderer-proveedor.component';

@Component({
  selector: 'app-detail-cell-renderer-pedimentos',
  standalone: true,
  imports: [CommonModule, AgGridModule, ButtonCellRendererComponent, DetailCellRendererPedimentosItemsComponent, DetailCellRendererProveedorComponent],
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
        [domLayout]="'autoHeight'"
        style="width: 120%;">
      </ag-grid-angular>
    </div>
  `,
  styles: [`
    .detail-grid-container {
      background-color: #f8f9fa;
      border-radius: 8px;
      margin-bottom: 0;
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

      // ✅ Extraer los últimos 3 dígitos del folio
      const folio = pedimento.folio || '';
      const ultimosTresDigitos = folio.slice(-3); // Obtener los últimos 3 caracteres
      const pedimentoFormateado = `Pedimento-${ultimosTresDigitos}`;

      this.rowData.push({
        pedimento: pedimentoFormateado,
        folio: folio,
        articulos: pedimento.items,
        idProvider: pedimento.idProvider || 0,
        idProvider2: pedimento.idProvider2 || 0,
        idProvider3: pedimento.idProvider3 || 0,
        pdf: 'PDF',
        fechaPedimento: fechaPedimento
      });
    });
  }

  get colDefs(): ColDef[] {
    return [
      {
        field: 'pedimento',
        headerName: 'PEDIMENTO #',
        width: 180
      },
    
    /*  {
        field: 'folio',
        headerName: 'FOLIO COT',
        width: 120
      },*/
    
      {
        field: 'articulos',
        headerName: 'ARTICULOS',
        width: 180,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleArticulosCascade(node),
        },
        valueGetter: params => params.data.articulos ? params.data.articulos.length : 0,
        editable: false,
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer' }
      },

      {
        field: '',
        headerName: 'PDF',
        width: 120
      },

        {
        field: 'fechaPedimento',
        headerName: 'FECHA PEDIMENTO',
        width: 200
      },

      {
        field: 'idProvider',
        headerName: 'PROVEEDOR 1',
        width: 200,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleProviderCascade(node, 'idProvider', 'Proveedor A'),
          icon: 'bi-person-badge',
          title: 'Ver/Editar Proveedor A'
        },
        valueGetter: () => 'Proveedor A',
        cellStyle: { backgroundColor: '#e3f2fd', cursor: 'pointer' }
      },

      {
        field: 'idProvider2',
        headerName: 'PROVEEDOR 2',
        width: 200,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleProviderCascade(node, 'idProvider2', 'Proveedor B'),
          icon: 'bi-person-badge',
          title: 'Ver/Editar Proveedor B'
        },
        valueGetter: () => 'Proveedor B',
        cellStyle: { backgroundColor: '#fff3e0', cursor: 'pointer' }
      },
      {
        field: 'idProvider3',
        headerName: 'PROVEEDOR 3',
        width: 200,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleProviderCascade(node, 'idProvider3', 'Proveedor C'),
          icon: 'bi-person-badge',
          title: 'Ver/Editar Proveedor C'
        },
        valueGetter: () => 'Proveedor C',
        cellStyle: { backgroundColor: '#f3e5f5', cursor: 'pointer' }
      }
    ];
  }

  // Tipo de detalle activo: 'articulos' o 'proveedor'
  private activeDetailType: string = 'articulos';
  private activeProviderField: string = '';
  private activeProviderLabel: string = '';

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    masterDetail: true,
    detailRowHeight: 450,
    detailCellRendererSelector: (params: any) => {
      if (params.data.detailType === 'proveedor') {
        return {
          component: DetailCellRendererProveedorComponent,
          params: {
            providerField: params.data.providerField,
            providerLabel: params.data.providerLabel
          }
        };
      }
      // Por defecto, mostrar artículos
      return { component: DetailCellRendererPedimentosItemsComponent };
    },
    embedFullWidthRows: true,
    suppressCellFocus: true,
    context: {
      providerField: '',
      providerLabel: ''
    }
  };

  toggleArticulosCascade(node: any) {
    // Establecer el tipo de detalle como artículos
    node.data.detailType = 'articulos';
    node.setSelected(true);

    const isCurrentlyExpanded = node.expanded && this.activeDetailType === 'articulos';

    if (isCurrentlyExpanded) {
      node.setExpanded(false);
    } else {
      this.gridApi.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id && otherNode.expanded) {
          otherNode.setExpanded(false);
        }
      });
      this.activeDetailType = 'articulos';
      node.setExpanded(true);
    }
  }

  toggleProviderCascade(node: any, providerField: string, providerLabel: string) {
    node.setSelected(true);

    // Verificar si ya está expandido con el mismo proveedor
    const isCurrentlyExpanded = node.expanded &&
      node.data.detailType === 'proveedor' &&
      node.data.providerField === providerField;

    if (isCurrentlyExpanded) {
      node.setExpanded(false);
    } else {
      // Cerrar otros nodos expandidos
      this.gridApi.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id && otherNode.expanded) {
          otherNode.setExpanded(false);
        }
      });

      // Establecer el tipo de detalle y los parámetros del proveedor
      node.data.detailType = 'proveedor';
      node.data.providerField = providerField;
      node.data.providerLabel = providerLabel;

      this.activeDetailType = 'proveedor';
      this.activeProviderField = providerField;
      this.activeProviderLabel = providerLabel;

      // Actualizar el contexto del grid
      this.gridOptions.context = {
        providerField: providerField,
        providerLabel: providerLabel
      };

      node.setExpanded(true);
    }
  }
}
