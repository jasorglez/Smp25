import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { SignalsService } from 'app/services/signals.service';
import { PedidosService } from 'app/services/pedidos.service';

@Component({
  selector: 'storeComponent',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  templateUrl: './productos.component.html',
})
export class MaterialsComponent {
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  private signalsService = inject(SignalsService);
  private pedidosService = inject(PedidosService);

  idcompany: number = null;
  rowData: any[] = [];
  gridHeight: string = '85vh';

  private gridApi: GridApi;

  public defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1,
  };

  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 28,
    animateRows: true,
    rowSelection: 'single',
  };

  public colDefs: ColDef[] = [
    {
      headerName: '#',
      width: 50,
      valueGetter: (params) => params.node!.rowIndex! + 1,
      pinned: 'left',
      cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' },
    },
    {
      field: 'producto',
      headerName: 'Producto',
      flex: 2,
      minWidth: 200,
    },
    {
      field: 'costo',
      headerName: 'Costo',
      width: 120,
      type: 'numericColumn',
      valueFormatter: (params) =>
        params.value
          ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value)
          : '$0.00',
      cellStyle: { textAlign: 'right' },
    },
    {
      field: 'venta',
      headerName: 'Venta',
      width: 120,
      type: 'numericColumn',
      valueFormatter: (params) =>
        params.value
          ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value)
          : '$0.00',
      cellStyle: { textAlign: 'right' },
    },
    {
      field: 'impuesto',
      headerName: 'Impuesto',
      width: 110,
      type: 'numericColumn',
      valueFormatter: (params) =>
        params.value
          ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value)
          : '$0.00',
      cellStyle: { textAlign: 'right' },
    },
  ];

  constructor() {
    effect(() => {
      const currentRoot = this.signalsService.getRootSelectedBySidebar()();
      if (currentRoot && currentRoot !== this.idcompany) {
        this.idcompany = currentRoot;
        this.loadData();
      }
    });
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  private loadData(): void {
    if (!this.idcompany) return;
    this.pedidosService.getDetallesByCompany(this.idcompany).subscribe({
      next: (response: any) => {
        this.rowData = response?.data || response || [];
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }
      },
      error: (e) => {
        console.error('Error cargando detalles de pedidos:', e);
        this.rowData = [];
      },
    });
  }
}
