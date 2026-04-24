import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { forkJoin, lastValueFrom } from 'rxjs';

import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { CustomersService } from 'app/services/customers.service';
import { RemisionesService } from 'app/services/remisiones.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-remisiones-logistica',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './remisiones.component.html',
  styleUrl: './remisiones.component.scss',
})
export class RemisionesComponent {
  private signalsService = inject(SignalsService);
  private remisionesService = inject(RemisionesService);
  private customersService = inject(CustomersService);

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  idCompany: number = 0;
  idBranch: number = 0;
  activeFilter: string | null = 'ABIERTA';
  rowData: any[] = [];
  showDetalleModal = false;
  selectedRemision: any = null;
  selectedDetalleRows: any[] = [];

  private allRowData: any[] = [];
  private gridApi?: GridApi;

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
      headerName: 'Acciones',
      minWidth: 190,
      width: 190,
      sortable: false,
      filter: false,
      editable: false,
      cellRenderer: (params: any) => {
        const isAbierta = String(params.data?.estado || '').toUpperCase() === 'ABIERTA';
        return `
          <div class="d-flex gap-1 justify-content-center">
            <button class="btn btn-sm btn-info" data-action="view">Ver</button>
            ${isAbierta ? '<button class="btn btn-sm btn-warning" data-action="close">Cerrar</button>' : '<span class="text-muted ms-1">Cerrada</span>'}
          </div>
        `;
      },
      onCellClicked: (params: any) => {
        const action = (params.event?.target as HTMLElement | null)?.getAttribute('data-action');
        if (action === 'view') {
          this.openDetalleModal(params.data);
          return;
        }
        if (action === 'close' && String(params.data?.estado || '').toUpperCase() === 'ABIERTA') {
          this.closeRemision(params.data);
        }
      },
      cellStyle: { textAlign: 'center' },
    },
    { field: 'id', headerName: 'ID', width: 90, maxWidth: 100 },
    { field: 'folio', headerName: 'Folio', minWidth: 170 },
    { field: 'clienteName', headerName: 'Cliente', minWidth: 240 },
    {
      field: 'estado',
      headerName: 'Estado',
      width: 120,
      cellStyle: (params) => {
        if (params.value === 'ABIERTA') return { backgroundColor: '#ffe5d0', fontWeight: 'bold' };
        if (params.value === 'CERRADA') return { backgroundColor: '#d1ecf1', fontWeight: 'bold' };
        return {};
      }
    },
    {
      field: 'fechaCreacion',
      headerName: 'Creación',
      minWidth: 170,
      valueFormatter: (params) => this.formatDateTime(params.value),
    },
    {
      field: 'fechaCierre',
      headerName: 'Cierre',
      minWidth: 170,
      valueFormatter: (params) => this.formatDateTime(params.value),
    },
    { field: 'diasTranscurridos', headerName: 'Días', width: 90, type: 'numericColumn' },
    { field: 'totalRenglones', headerName: 'Renglones', width: 110, type: 'numericColumn' },
    {
      field: 'totalCantidadRemitida',
      headerName: 'Cant. remitida',
      minWidth: 130,
      type: 'numericColumn',
      valueFormatter: (params) => this.formatNumber(params.value),
    },
    {
      field: 'totalImporte',
      headerName: 'Importe',
      minWidth: 130,
      type: 'numericColumn',
      valueFormatter: (params) => this.formatCurrency(params.value),
    },
    { field: 'createdBy', headerName: 'Creada por', minWidth: 180 },
    { field: 'closedBy', headerName: 'Cerrada por', minWidth: 180 },
    { field: 'comentario', headerName: 'Comentario', minWidth: 260 },
  ];

  constructor() {
    effect(() => {
      const currentRoot = this.signalsService.getRootSelectedBySidebar()();
      const currentBranch = this.signalsService.getBranchSelectedBySidebar()();

      if (currentRoot && (currentRoot !== this.idCompany || currentBranch !== this.idBranch)) {
        this.idCompany = currentRoot;
        this.idBranch = currentBranch;
        this.loadData();
      }
    });
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
  }

  setFilter(estado: string | null): void {
    this.activeFilter = estado;
    this.applyFilter();
  }

  loadData(): void {
    if (!this.idCompany) return;

    const clientes$ = this.idBranch
      ? this.customersService.getCustomers(this.idBranch, 'CUSTOMERS')
      : this.customersService.getCustomersByCompany(this.idCompany, 'CUSTOMERS');

    forkJoin({
      remisiones: this.remisionesService.getResumenByCompany(this.idCompany),
      clientes: clientes$,
    }).subscribe({
      next: (results: any) => {
        const remisiones = results.remisiones?.data || results.remisiones?.Data || [];
        const clientes = results.clientes?.data || results.clientes || [];
        const clientesMap = new Map((clientes || []).map((c: any) => [Number(c.id), c]));

        this.allRowData = (remisiones || []).map((item: any) => {
          const cliente: any = clientesMap.get(Number(item.idCliente));
          return {
            ...item,
            estado: String(item.estado || '').toUpperCase(),
            clienteName: cliente?.nameContact || cliente?.company || cliente?.name || `Cliente ${item.idCliente}`,
          };
        });

        this.applyFilter();
      },
      error: (error) => {
        console.error('Error cargando remisiones:', error);
        this.allRowData = [];
        this.rowData = [];
        alerts.basicAlert('Error', 'No se pudieron cargar las remisiones', 'error');
      },
    });
  }

  private applyFilter(): void {
    this.rowData = this.activeFilter
      ? this.allRowData.filter((x: any) => x.estado === this.activeFilter)
      : [...this.allRowData];

    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
    }
  }

  async closeRemision(remision: any): Promise<void> {
    const commentResult = await alerts.inputAlert(
      'Cerrar remisión',
      `Folio ${remision.folio}. Puedes capturar un comentario opcional de cierre.`,
      'textarea',
      remision.comentario || '',
      {
        required: false,
        confirmButtonText: 'Cerrar remisión',
      }
    );

    if (!commentResult.isConfirmed) return;

    alerts.showLoading('Cerrando remisión...', 'Actualizando estado y detalles relacionados.');
    try {
      await lastValueFrom(
        this.remisionesService.closeRemision(remision.id, {
          closedBy: localStorage.getItem('mail') || '',
          comentario: String(commentResult.value ?? '').trim(),
        })
      );

      alerts.closeLoading();
      alerts.toastAlert('Remisión cerrada correctamente', 'success');
      if (this.selectedRemision?.id === remision.id) {
        this.closeDetalleModal();
      }
      this.loadData();
    } catch (error) {
      alerts.closeLoading();
      console.error('Error cerrando remisión:', error);
      alerts.basicAlert('Error', 'No se pudo cerrar la remisión', 'error');
    }
  }

  async openDetalleModal(remision: any): Promise<void> {
    alerts.showLoading('Cargando detalle...', 'Consultando los renglones de la remisión.');
    try {
      const response: any = await lastValueFrom(this.remisionesService.getDetalle(remision.id));
      const payload = response?.data || response?.Data || {};
      const detalleRows = payload?.detalles || payload?.Detalles || [];

      this.selectedRemision = remision;
      this.selectedDetalleRows = (detalleRows || []).map((row: any) => ({
        ...row,
        totalLinea: (Number(row.cantidadRemitida) || 0) * (Number(row.venta) || 0) + (Number(row.impuesto) || 0),
      }));
      this.showDetalleModal = true;
      alerts.closeLoading();
    } catch (error) {
      alerts.closeLoading();
      console.error('Error cargando detalle de remisión:', error);
      alerts.basicAlert('Error', 'No se pudo cargar el detalle de la remisión', 'error');
    }
  }

  closeDetalleModal(): void {
    this.showDetalleModal = false;
    this.selectedRemision = null;
    this.selectedDetalleRows = [];
  }

  formatDateTime(value: unknown): string {
    if (!value) return '';
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('es-MX');
  }

  formatCurrency(value: unknown): string {
    const numericValue = Number(value) || 0;
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(numericValue);
  }

  formatNumber(value: unknown): string {
    const numericValue = Number(value) || 0;
    return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(numericValue);
  }
}
