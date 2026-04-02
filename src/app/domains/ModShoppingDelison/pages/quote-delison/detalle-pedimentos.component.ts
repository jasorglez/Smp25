import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, ICellRendererParams, GridApi } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ButtonCellRendererComponent } from './button-cell-renderer.component';
import { PdfButtonCellRendererPedimentosComponent } from './pdf-button-cell-renderer-pedimentos.component';
import { DetalleItemsPedimentosComponent } from './detalle-items-pedimentos.component';
import { DetalleItemsProveedorComponent } from './detalle-items-proveedor.component';
import { DetailCellRendererPedimentoReportComponent } from './detail-cell-renderer-pedimento-report.component';

@Component({
  selector: 'app-detail-cell-renderer-pedimentos',
  standalone: true,
  imports: [CommonModule, AgGridModule, ButtonCellRendererComponent, PdfButtonCellRendererPedimentosComponent, DetalleItemsPedimentosComponent, DetalleItemsProveedorComponent, DetailCellRendererPedimentoReportComponent],
  template: `
    <div class="detail-grid-container">
      <!-- Grid con tamaño completo -->
      <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
        <ag-grid-angular
          #agGrid
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          [localeText]="AG_GRID_LOCALE_ES"
          (gridReady)="onGridReady($event)"
          style="width: 150%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
        </ag-grid-angular>
      </div>
    </div>
  `,
  styles: [`
    .detail-grid-container {
      padding: 5px;
      background-color: #f8f9fa;
      border-radius: 8px;
      margin-bottom: 0;
      height: 100%;
      max-height: 100%;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      overflow: hidden;
    }
  `]
})
export class DetailCellRendererPedimentosComponent {
  private params!: ICellRendererParams;
  private gridApi!: GridApi;
  rowData: any[] = [];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  private expandedRowId: string | null = null;

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

      // ✅ Usar el número de pedimento secuencial (1, 2, 3, etc.) en lugar del folio
      const numeroPedimento = pedimento.pedimento || 0;
      const pedimentoFormateado = `Pedimento-${numeroPedimento}`;

      this.rowData.push({
        pedimento: pedimentoFormateado,
        folio: pedimento.folio || '',
        articulos: pedimento.items,
        cotizacionId: pedimento.id,
        requisitionId: this.params.data.id,
        numeroPedimentoRaw: numeroPedimento,
        idProvider: pedimento.idProvider || 0,
        idProvider2: pedimento.idProvider2 || 0,
        idProvider3: pedimento.idProvider3 || 0,
        name_idProvider: pedimento.name_idProvider || '',
        name_idProvider2: pedimento.name_idProvider2 || '',
        name_idProvider3: pedimento.name_idProvider3 || '',
        pdf: 'PDF',
        creo: pedimento.createdBy || 'N/A',
        createdBy: pedimento.createdBy || 'N/A',
        fechaPedimento: fechaPedimento,
        createdAt: pedimento.createdAt // Guardar fecha completa para ordenar
      });
    });

    // ✅ Ordenar del más reciente al más antiguo (DESC)
    this.rowData.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA; // DESC: más reciente primero
    });
  }

  get colDefs(): ColDef[] {
    return [
      {
        field: 'pedimento',
        headerName: 'PEDIMENTO #',
        width: 220
      },

    /*  {
        field: 'folio',
        headerName: 'FOLIO COT',
        width: 120
      },*/

      {
        field: 'articulos',
        headerName: 'ARTICULOS',
        width: 200,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleArticulosCascade(node),
        },
        valueGetter: params => {
          const articulos = params.data.articulos || [];
          const solicitados = articulos.filter((item: any) => item.pedimento === true).length;
          const total = articulos.length;
          return `${solicitados}/${total}`;
        },
        editable: false,
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer' }
      },

      {
        field: 'pdf',
        headerName: 'PDF',
        width: 80,
        cellRenderer: PdfButtonCellRendererPedimentosComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleReportCascade(node),
          icon: 'bi-file-earmark-pdf',
          iconColor: '#dc3545',
          title: 'Generar reporte PDF del Pedimento'
        },
        editable: false,
        cellStyle: { backgroundColor: '#fff3e0', textAlign: 'center' }
      },

      {
        field: 'creo',
        headerName: 'QUIEN LO CREÓ2',
        width: 180
      },

      {
        field: 'fechaPedimento',
        headerName: 'FECHA PEDIMENTO',
        width: 160
      },

      {
        field: 'idProvider',
        headerName: 'PROVEEDOR 1',
        width: 210,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleProviderCascade(node, 'idProvider', 'Proveedor A'),
          icon: 'bi-person-badge',
          title: 'Ver/Editar Proveedor A'
        },
        valueGetter: (params: any) => params.data?.name_idProvider || (params.data?.idProvider > 0 ? `Prov. ${params.data.idProvider}` : 'Proveedor A'),
        cellStyle: { backgroundColor: '#e3f2fd', cursor: 'pointer' }
      },

      {
        field: 'idProvider2',
        headerName: 'PROVEEDOR 2',
        width: 210,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleProviderCascade(node, 'idProvider2', 'Proveedor B'),
          icon: 'bi-person-badge',
          title: 'Ver/Editar Proveedor B'
        },
        valueGetter: (params: any) => params.data?.name_idProvider2 || (params.data?.idProvider2 > 0 ? `Prov. ${params.data.idProvider2}` : 'Proveedor B'),
        cellStyle: { backgroundColor: '#fff3e0', cursor: 'pointer' }
      },

      {
        field: 'idProvider3',
        headerName: 'PROVEEDOR 3',
        width: 210,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleProviderCascade(node, 'idProvider3', 'Proveedor C'),
          icon: 'bi-person-badge',
          title: 'Ver/Editar Proveedor C'
        },
        valueGetter: (params: any) => params.data?.name_idProvider3 || (params.data?.idProvider3 > 0 ? `Prov. ${params.data.idProvider3}` : 'Proveedor C'),
        cellStyle: { backgroundColor: '#f3e5f5', cursor: 'pointer' }
      },

      {
        field: 'createdBy',
        headerName: 'CREÓ',
        width: 100
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
    detailRowHeight: 550,
    detailCellRendererSelector: (params: any) => {
      if (params.data.detailType === 'proveedor') {
        return {
          component: DetalleItemsProveedorComponent,
          params: {
            providerField: params.data.providerField,
            providerLabel: params.data.providerLabel
          }
        };
      }
      if (params.data.detailType === 'report') {
        return {
          component: DetailCellRendererPedimentoReportComponent,
          params: {
            reportProviderField: params.data.reportProviderField,
            reportProviderLabel: params.data.reportProviderLabel
          }
        };
      }
      // Por defecto, mostrar artículos
      return { component: DetalleItemsPedimentosComponent };
    },
    embedFullWidthRows: true,
    suppressCellFocus: true,
    getRowClass: (params: any) => {
      if (params.data.isExpanded) {
        return 'expanded-row';
      }
      return '';
    },
    context: {
      componentParent: this,
      providerField: '',
      providerLabel: ''
    }
  };

  toggleArticulosCascade(node: any) {
    // Establecer el tipo de detalle como artículos
    node.data.detailType = 'articulos';
    node.setSelected(true);

    const isCurrentlyExpanded = node.expanded && this.activeDetailType === 'articulos' && this.expandedRowId === node.id;

    if (isCurrentlyExpanded) {
      // Si ya está expandido, colapsarlo y restaurar todas las filas
      node.setExpanded(false);
      this.expandedRowId = null;
      node.data.isExpanded = false;

      // Restaurar alturas de todas las filas
      this.gridApi.forEachNode((otherNode: any) => {
        otherNode.setRowHeight(undefined);
      });
      this.gridApi.onRowHeightChanged();
      this.gridApi.redrawRows();
    } else {
      // Colapsar cualquier otra fila expandida
      if (this.expandedRowId) {
        this.gridApi.forEachNode((otherNode: any) => {
          if (otherNode.id === this.expandedRowId) {
            otherNode.setExpanded(false);
            otherNode.data.isExpanded = false;
          }
        });
      }

      // Ocultar todas las demás filas (altura 0)
      this.gridApi.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id) {
          otherNode.setRowHeight(0);
        }
      });

      // Guardar el ID de la fila expandida
      this.expandedRowId = node.id;
      node.data.isExpanded = true;
      this.activeDetailType = 'articulos';

      // Aplicar los cambios de altura
      this.gridApi.onRowHeightChanged();
      this.gridApi.redrawRows();

      // Expandir con el detalle correspondiente
      setTimeout(() => {
        node.setExpanded(true);
      }, 0);
    }
  }

  toggleProviderCascade(node: any, providerField: string, providerLabel: string) {
    node.setSelected(true);

    // Verificar si ya está expandido con el mismo proveedor
    const isCurrentlyExpanded = node.expanded &&
      node.data.detailType === 'proveedor' &&
      node.data.providerField === providerField &&
      this.expandedRowId === node.id;

    if (isCurrentlyExpanded) {
      // Si ya está expandido, colapsarlo y restaurar todas las filas
      node.setExpanded(false);
      this.expandedRowId = null;
      node.data.isExpanded = false;

      // Restaurar alturas de todas las filas
      this.gridApi.forEachNode((otherNode: any) => {
        otherNode.setRowHeight(undefined);
      });
      this.gridApi.onRowHeightChanged();
      this.gridApi.redrawRows();
    } else {
      // Colapsar cualquier otra fila expandida
      if (this.expandedRowId) {
        this.gridApi.forEachNode((otherNode: any) => {
          if (otherNode.id === this.expandedRowId) {
            otherNode.setExpanded(false);
            otherNode.data.isExpanded = false;
          }
        });
      }

      // Ocultar todas las demás filas (altura 0)
      this.gridApi.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id) {
          otherNode.setRowHeight(0);
        }
      });

      // Establecer el tipo de detalle y los parámetros del proveedor
      node.data.detailType = 'proveedor';
      node.data.providerField = providerField;
      node.data.providerLabel = providerLabel;

      // Guardar el ID de la fila expandida
      this.expandedRowId = node.id;
      node.data.isExpanded = true;
      this.activeDetailType = 'proveedor';
      this.activeProviderField = providerField;
      this.activeProviderLabel = providerLabel;

      // Mutar el contexto existente (no reemplazar) para que AG Grid mantenga la referencia
      this.gridOptions.context.providerField = providerField;
      this.gridOptions.context.providerLabel = providerLabel;

      // Aplicar los cambios de altura
      this.gridApi.onRowHeightChanged();
      this.gridApi.redrawRows();

      // Expandir con el detalle correspondiente
      setTimeout(() => {
        node.setExpanded(true);
      }, 0);
    }
  }

  toggleReportCascade(node: any) {
    node.setSelected(true);

    // Verificar si ya está expandido con reporte
    const isCurrentlyExpanded = node.expanded &&
      node.data.detailType === 'report' &&
      this.expandedRowId === node.id;

    if (isCurrentlyExpanded) {
      // Si ya está expandido, colapsarlo y restaurar todas las filas
      node.setExpanded(false);
      this.expandedRowId = null;
      node.data.isExpanded = false;

      // Restaurar alturas de todas las filas
      this.gridApi.forEachNode((otherNode: any) => {
        otherNode.setRowHeight(undefined);
      });
      this.gridApi.onRowHeightChanged();
      this.gridApi.redrawRows();
    } else {
      // Colapsar cualquier otra fila expandida
      if (this.expandedRowId) {
        this.gridApi.forEachNode((otherNode: any) => {
          if (otherNode.id === this.expandedRowId) {
            otherNode.setExpanded(false);
            otherNode.data.isExpanded = false;
          }
        });
      }

      // Ocultar todas las demás filas (altura 0)
      this.gridApi.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id) {
          otherNode.setRowHeight(0);
        }
      });

      // Establecer el tipo de detalle como reporte
      // Por defecto usamos idProvider (Proveedor A), pero se puede modificar
      node.data.detailType = 'report';
      node.data.reportProviderField = 'idProvider';
      node.data.reportProviderLabel = 'Proveedor A';

      // Guardar el ID de la fila expandida
      this.expandedRowId = node.id;
      node.data.isExpanded = true;
      this.activeDetailType = 'report';

      // Aplicar los cambios de altura
      this.gridApi.onRowHeightChanged();
      this.gridApi.redrawRows();

      // Expandir con el detalle del reporte
      setTimeout(() => {
        node.setExpanded(true);
      }, 0);
    }
  }

  collapseReportDetail() {
    if (this.expandedRowId && this.gridApi) {
      this.gridApi.forEachNode((node: any) => {
        if (node.id === this.expandedRowId) {
          node.setExpanded(false);
          node.data.isExpanded = false;
          node.data.detailType = null;
        }
        node.setRowHeight(undefined);
      });
      this.expandedRowId = null;
      this.gridApi.onRowHeightChanged();
      this.gridApi.redrawRows();
    }
  }
}
