import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { SignalsService } from 'app/services/signals.service';
import { PedidosService } from 'app/services/pedidos.service';
import { CustomersService } from 'app/services/customers.service';
import { forkJoin } from 'rxjs';

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
  private customersService = inject(CustomersService);

  idcompany: number = null;
  idBranch: number = null;
  rowData: any[] = [];
  gridHeight: string = '82vh';
  activeFilter: string | null = null;

  private gridApi: GridApi;
  private allData: any[] = [];

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
      filter: 'agSetColumnFilter',
      filterParams: {
        defaultToNothingSelected: true,
      },
      flex: 2,
      minWidth: 200,
    },
    {
      field: 'clienteName',
      headerName: 'Cliente',
      flex: 2,
      minWidth: 160,
      filter: 'agSetColumnFilter',
      filterParams: {
        defaultToNothingSelected: true,
      },
    },
    {
      field: 'pedidoNumero',
      headerName: 'Pedido',
      width: 100,
      filter: 'agSetColumnFilter',
      filterParams: {
        defaultToNothingSelected: true,
      },
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
    {
      field: 'estado',
      headerName: 'Estado',
      width: 120,
      cellStyle: (params) => {
        if (params.value === 'RECIBIDO')   return { backgroundColor: '#d4edda' };
        if (params.value === 'CANCELADO')  return { backgroundColor: '#f8d7da' };
        if (params.value === 'ALMACENADO') return { backgroundColor: '#cce5ff' };
        if (params.value === 'REVENDIDO')  return { backgroundColor: '#fff3cd' };
        return { backgroundColor: '#e2e3e5' };
      },
    },
  ];

  constructor() {
    effect(() => {
      const currentRoot = this.signalsService.getRootSelectedBySidebar()();
      const currentBranch = this.signalsService.getBranchSelectedBySidebar()();
      if (currentRoot && currentRoot !== this.idcompany) {
        this.idcompany = currentRoot;
        this.idBranch = currentBranch;
        this.loadData();
      } else if (currentRoot && currentBranch && currentBranch !== this.idBranch) {
        this.idBranch = currentBranch;
        this.loadData();
      }
    });
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  setFilter(estado: string | null): void {
    this.activeFilter = estado;
    this.applyFilter();
  }

  private applyFilter(): void {
    this.rowData = this.activeFilter
      ? this.allData.filter(d => d.estado === this.activeFilter)
      : [...this.allData];
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
    }
  }

  private loadData(): void {
    if (!this.idcompany) return;
    forkJoin({
      detalles: this.pedidosService.getDetallesByCompany(this.idcompany),
      pedidos:  this.pedidosService.getPedidosByCompany(this.idcompany),
      clientes: this.idBranch
        ? this.customersService.getCustomers(this.idBranch, 'CUSTOMERS')
        : this.customersService.getCustomersByCompany(this.idcompany, 'CUSTOMERS'),
    }).subscribe({
      next: (results: any) => {
        const detallesList: any[] = results.detalles?.data || results.detalles || [];
        const pedidosList:  any[] = results.pedidos?.data  || results.pedidos  || [];
        const clientesList: any[] = results.clientes?.data || results.clientes || [];

        const key = (v: any) => (v === undefined || v === null ? null : String(v));
        const pedidosMap  = new Map(pedidosList.map((p: any) => [key(p.id), p]));
        const clientesMap = new Map(clientesList.map((c: any) => [key(c.id), c]));

        this.allData = detallesList.map((d: any) => {
          const pedido  = pedidosMap.get(key(d.idPedido));
          const cliente = clientesMap.get(key(d.idCliente));
          return {
            ...d,
            // Igual que en el 2º nivel: el nombre viene del endpoint de clientes
            clienteName:  cliente?.nameContact || cliente?.company || cliente?.name || cliente?.Description || '-',
            pedidoNumero: pedido?.numero || d.idPedido  || '-',
          };
        });

        this.applyFilter();

      },
      error: (e) => {
        console.error('Error cargando productos:', e);
        this.rowData = [];
      },
    });
  }
}
