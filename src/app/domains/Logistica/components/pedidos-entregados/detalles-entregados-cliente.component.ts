import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';

@Component({
  selector: 'app-detalles-entregados-cliente',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div style="height: 320px; padding: 4px;">
      <ag-grid-angular
        style="width: 100%; height: 100%;"
        class="ag-theme-quartz small-text-ag-grid"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [defaultColDef]="defaultColDef"
        [gridOptions]="gridOptions"
        (gridReady)="onGridReady($event)"
        [localeText]="AG_GRID_LOCALE_ES">
      </ag-grid-angular>
    </div>
  `,
})
export class DetallesEntregadosClienteComponent implements ICellRendererAngularComp {
  private params!: ICellRendererParams;
  private gridApi!: GridApi;

  rowData: any[] = [];
  pinnedBottomRowData: any[] = [];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  public defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
  };

  public gridOptions: any = {
    headerHeight: 28,
    rowHeight: 26,
    animateRows: true,
  };

  public colDefs: ColDef[] = [
    {
      field: 'pedidoFecha',
      headerName: 'Fecha',
      width: 120,
      valueFormatter: (params) => {
        if (params.node?.rowPinned) {
          return '';
        }
        if (!params.value) {
          return '';
        }
        return new Date(params.value).toLocaleDateString('es-MX');
      },
    },
    {
      field: 'pedidoNumero',
      headerName: 'Pedido',
      width: 110,
      valueFormatter: (params) => params.node?.rowPinned ? '' : (params.value ?? '-'),
    },
    {
      field: 'producto',
      headerName: 'Producto',
      flex: 2,
      minWidth: 180,
      valueFormatter: (params) => params.node?.rowPinned ? 'TOTAL CLIENTE' : (params.value ?? '-'),
      cellStyle: (params) => params.node?.rowPinned ? { fontWeight: '700', backgroundColor: '#d1ecf1' } : {},
    },
    {
      field: 'cantidad',
      headerName: 'Cantidad',
      width: 90,
      type: 'numericColumn',
      valueFormatter: (params) => params.node?.rowPinned ? '' : (params.value ?? ''),
    },
    {
      field: 'plataforma',
      headerName: 'Plataforma',
      minWidth: 140,
      valueFormatter: (params) => params.node?.rowPinned ? '' : (params.value ?? ''),
    },
    {
      field: 'venta',
      headerName: 'Venta',
      width: 120,
      type: 'numericColumn',
      valueFormatter: (params) => {
        return params.value != null
          ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value)
          : '$0.00';
      },
      cellStyle: (params) => ({
        textAlign: 'right',
        fontWeight: params.node?.rowPinned ? '700' : '400',
        backgroundColor: params.node?.rowPinned ? '#d1ecf1' : undefined,
      }),
    },
    {
      field: 'impuesto',
      headerName: 'Impuesto',
      width: 120,
      type: 'numericColumn',
      valueFormatter: (params) => {
        return params.value != null
          ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value)
          : '$0.00';
      },
      cellStyle: (params) => ({
        textAlign: 'right',
        fontWeight: params.node?.rowPinned ? '700' : '400',
        backgroundColor: params.node?.rowPinned ? '#d1ecf1' : undefined,
      }),
    },
    {
      headerName: 'Total',
      colId: 'totalLinea',
      width: 120,
      type: 'numericColumn',
      valueGetter: (params) => {
        if (!params.data) {
          return null;
        }
        const cantidad = Number(params.data.cantidad) || 0;
        const venta = Number(params.data.venta) || 0;
        const impuesto = Number(params.data.impuesto) || 0;
        return (cantidad * venta) + impuesto;
      },
      valueFormatter: (params) => {
        return params.value != null
          ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value)
          : '$0.00';
      },
      cellStyle: (params) => ({
        textAlign: 'right',
        fontWeight: '700',
        backgroundColor: params.node?.rowPinned ? '#d1ecf1' : undefined,
      }),
    },
    {
      field: 'estado',
      headerName: 'Estado',
      width: 120,
      valueFormatter: (params) => params.node?.rowPinned ? '' : (params.value ?? ''),
      cellStyle: (params) => {
        if (params.node?.rowPinned) return { backgroundColor: '#d1ecf1' };
        if (params.value === 'ENTREGADO') return { backgroundColor: '#d1ecf1' };
        return {};
      }
    },
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.rowData = (params.data?.detailData || []).map((item: any) => ({
      ...item,
      pedidoNumero: item.pedidoNumero || '-',
      pedidoFecha: item.pedidoFecha || null,
    }));
    this.updatePinnedTotal();
  }

  refresh(params: ICellRendererParams): boolean {
    this.agInit(params);
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
      this.gridApi.setGridOption('pinnedBottomRowData', this.pinnedBottomRowData);
    }
    return true;
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    this.gridApi.setGridOption('rowData', this.rowData);
    this.gridApi.setGridOption('pinnedBottomRowData', this.pinnedBottomRowData);
  }

  private updatePinnedTotal(): void {
    const totalVenta = this.rowData.reduce((sum: number, item: any) => sum + (Number(item?.venta) || 0), 0);
    const totalImpuesto = this.rowData.reduce((sum: number, item: any) => sum + (Number(item?.impuesto) || 0), 0);
    const totalLinea = this.rowData.reduce((sum: number, item: any) => {
      const cantidad = Number(item?.cantidad) || 0;
      const venta = Number(item?.venta) || 0;
      const impuesto = Number(item?.impuesto) || 0;
      return sum + (cantidad * venta) + impuesto;
    }, 0);

    this.pinnedBottomRowData = [{
      producto: 'TOTAL CLIENTE',
      venta: totalVenta,
      impuesto: totalImpuesto,
      totalLinea,
    }];
  }
}
