import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';

@Component({
  selector: 'app-detalles-clientes',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div style="height: 280px; padding: 4px;">
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
  `
})
export class DetallesClientesComponent implements ICellRendererAngularComp {
  private params!: ICellRendererParams;
  private gridApi!: GridApi;
  private context: any;
  private pedidoNumero: any = '-';

  rowData: any[] = [];
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
    groupDefaultExpanded: 0,
    groupIncludeFooter: true,
    getRowStyle: (params: any) => {
      if (params.node?.footer) return { backgroundColor: '#d4edda', fontWeight: 'bold' };
      return null;
    },
    autoGroupColumnDef: {
      headerName: 'Cliente',
      minWidth: 200,
      pinned: 'left',
      cellRendererParams: {
        suppressCount: false,
        footerValueGetter: (params: any) => `Total — ${params.value}`,
      },
    },
    popupParent: typeof document !== 'undefined' ? document.body : undefined,
  };

  public colDefs: ColDef[] = [
    {
      field: 'clienteName',
      rowGroup: true,
      hide: true,
    },
    {
      field: 'producto',
      headerName: 'Producto',
      flex: 2,
      minWidth: 150,
    },
    {
      headerName: 'Pedido',
      width: 100,
      valueGetter: (params) => params.node?.group ? null : this.pedidoNumero,
    },
    {
      field: 'cantidad',
      headerName: 'Cantidad',
      width: 90,
      type: 'numericColumn',
      valueFormatter: (params) => params.node?.group ? '' : (params.value ?? ''),
    },
    {
      field: 'plataforma',
      headerName: 'Plataforma',
      width: 130,
      valueFormatter: (params) => params.node?.group ? '' : (params.value ?? ''),
    },
    {
      field: 'costo',
      headerName: 'Costo',
      width: 110,
      type: 'numericColumn',
      aggFunc: 'sum',
      valueFormatter: (params) => {
        if (params.node?.group && !params.node?.footer) return '';
        return params.value != null
          ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value)
          : '$0.00';
      },
    },
    {
      field: 'venta',
      headerName: 'Venta',
      width: 110,
      type: 'numericColumn',
      aggFunc: 'sum',
      valueFormatter: (params) => {
        if (params.node?.group && !params.node?.footer) return '';
        return params.value != null
          ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value)
          : '$0.00';
      },
    },
    {
      field: 'estado',
      headerName: 'Estado',
      width: 120,
      valueFormatter: (params) => params.node?.group ? '' : (params.value ?? ''),
      cellStyle: (params) => {
        if (params.node?.group) return {};
        if (params.value === 'RECIBIDO')   return { backgroundColor: '#d4edda' };
        if (params.value === 'CANCELADO')  return { backgroundColor: '#f8d7da' };
        if (params.value === 'ALMACENADO') return { backgroundColor: '#cce5ff' };
        if (params.value === 'REVENDIDO')  return { backgroundColor: '#fff3cd' };
        return { backgroundColor: '#e2e3e5' };
      }
    },
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.context = params.context;
    this.pedidoNumero = params.data?.numero ?? '-';
    this.loadData();
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    if (this.rowData.length > 0) {
      this.gridApi.setGridOption('rowData', this.rowData);
    }
  }

  private loadData(): void {
    if (this.context?.CONCEPTS?.load) {
      const pedidoId = this.params.data.id;
      this.context.CONCEPTS.load(pedidoId, (data: any[]) => {
        this.rowData = data;
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }
      });
    }
  }

  refresh(): boolean {
    return true;
  }
}
