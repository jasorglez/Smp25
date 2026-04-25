import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { SignalsService } from 'app/services/signals.service';
import { PedidosService } from 'app/services/pedidos.service';
import { CustomersService } from 'app/services/customers.service';
import { forkJoin, lastValueFrom } from 'rxjs';
import { alerts } from 'app/helpers/alerts';
import { RemisionesService } from 'app/services/remisiones.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'storeComponent',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  templateUrl: './productos.component.html',
  styleUrls: ['./productos.component.scss'],
})
export class MaterialsComponent {
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  private readonly ESTADO_ENTREGADO = 'ENTREGADO';
  private readonly ESTADO_REMISION = 'REMISION';
  private readonly MANUAL_ESTADOS = ['RECIBIDO', 'CANCELADO', 'ALMACENADO', 'REVENDIDO', 'SOLICITADO'];

  private signalsService = inject(SignalsService);
  private pedidosService = inject(PedidosService);
  private customersService = inject(CustomersService);
  private remisionesService = inject(RemisionesService);

  idcompany: number = null;
  idBranch: number = null;
  rowData: any[] = [];
  gridHeight: string = '82vh';
  activeFilter: string | null = null;
  hasUnsavedChanges: boolean = false;

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
    groupDefaultExpanded: 0,
    suppressAggFuncInHeader: true,
    groupDisplayType: 'singleColumn',
    onCellValueChanged: (event: any) => {
      event.data.__modified = true;
      this.hasUnsavedChanges = true;
      // Refrescar el color del estado inmediatamente
      if (this.gridApi) {
        this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['estado'], force: true });
      }
    }
  };

  public autoGroupColumnDef: ColDef = {
    headerName: 'Cliente',
    minWidth: 260,
    pinned: 'left',
    cellStyle: (params) => params.node?.group ? { fontWeight: '700' } : { fontWeight: '600' },
    cellRendererParams: {
      suppressCount: false,
    },
  };

  public colDefs: ColDef[] = this.buildColumnDefs();

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

    this.updateGrouping();

    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
    }
  }

  private updateGrouping(): void {
    const groupByClient = this.activeFilter === this.ESTADO_ENTREGADO;

    this.colDefs = this.buildColumnDefs(groupByClient);

    if (this.gridApi) {
      this.gridApi.setGridOption('columnDefs', this.colDefs);
      this.gridApi.setGridOption('groupDefaultExpanded', groupByClient ? -1 : 0);
    }
  }

  private buildColumnDefs(groupByClient: boolean = false): ColDef[] {
    return [
      {
        headerName: '#',
        width: 50,
        valueGetter: (params) => {
          if (params.node?.group) {
            return '';
          }

          return (params.node?.rowIndex ?? 0) + 1;
        },
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
        rowGroup: groupByClient,
        hide: groupByClient,
        sort: groupByClient ? 'asc' : null,
        filter: 'agSetColumnFilter',
        filterParams: {
          defaultToNothingSelected: true,
        },
      },
      {
        field: 'pedidoNumero',
        headerName: 'Pedido',
        width: 100,
        sort: groupByClient ? 'asc' : null,
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
        aggFunc: groupByClient ? 'sum' : undefined,
        valueFormatter: (params) =>
          params.value
            ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value)
            : '$0.00',
        cellStyle: (params) => ({
          textAlign: 'right',
          fontWeight: params.node?.group ? '700' : '400',
        }),
      },
      {
        field: 'venta',
        headerName: 'Venta',
        width: 120,
        type: 'numericColumn',
        aggFunc: groupByClient ? 'sum' : undefined,
        valueFormatter: (params) =>
          params.value
            ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value)
            : '$0.00',
        cellStyle: (params) => ({
          textAlign: 'right',
          fontWeight: params.node?.group ? '700' : '400',
        }),
      },
      {
        field: 'impuesto',
        headerName: 'Impuesto',
        width: 110,
        type: 'numericColumn',
        aggFunc: groupByClient ? 'sum' : undefined,
        valueFormatter: (params) =>
          params.value
            ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value)
            : '$0.00',
        cellStyle: (params) => ({
          textAlign: 'right',
          fontWeight: params.node?.group ? '700' : '400',
        }),
      },
      {
        field: 'estado',
        headerName: 'Estado',
        width: 140,
        editable: (params) => !this.isBackendControlledState(params.data?.estado),
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.MANUAL_ESTADOS
        },
        valueSetter: (params: any) => {
          params.data.estado = params.newValue;
          return true;
        },
        cellStyle: (params) => {
          if (params.value === 'RECIBIDO')   return { backgroundColor: '#d4edda' };
          if (params.value === 'CANCELADO')  return { backgroundColor: '#f8d7da' };
          if (params.value === 'ALMACENADO') return { backgroundColor: '#cce5ff' };
          if (params.value === 'REVENDIDO')  return { backgroundColor: '#fff3cd' };
          if (params.value === 'REMISION')   return { backgroundColor: '#ffe5b4' };
          if (params.value === 'ENTREGADO')  return { backgroundColor: '#d1ecf1' };
          return { backgroundColor: '#e2e3e5' };
        },
      },
      {
        field: 'cantidad',
        headerName: 'Cantidad',
        width: 100,
        type: 'numericColumn',
        cellStyle: { textAlign: 'center' },
      },
      {
        headerName: 'Acciones',
        width: 200,
        editable: false,
        sortable: false,
        filter: false,
        suppressSizeToFit: true,
        cellStyle: { padding: '2px 4px', display: 'flex', alignItems: 'center' },
        cellRenderer: (params: any) => {
          if (params.data?.estado !== 'RECIBIDO') return '';
          const div = document.createElement('div');
          div.style.cssText = 'display:flex;gap:4px;align-items:center;height:100%';

          const btnBorrar = document.createElement('button');
          btnBorrar.type = 'button';
          btnBorrar.className = 'btn btn-danger btn-sm';
          btnBorrar.style.cssText = 'font-size:11px;padding:1px 7px;line-height:1.5';
          btnBorrar.innerHTML = '<i class="bi bi-trash"></i> Borrar';
          btnBorrar.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); this.deleteRow(params.data); });

          const btnRemision = document.createElement('button');
          btnRemision.type = 'button';
          btnRemision.className = 'btn btn-secondary btn-sm';
          btnRemision.style.cssText = 'font-size:11px;padding:1px 7px;line-height:1.5';
          btnRemision.innerHTML = '<i class="bi bi-truck"></i> Remisión';
          btnRemision.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); this.sendToRemision(params.data); });

          div.appendChild(btnBorrar);
          div.appendChild(btnRemision);
          return div;
        },
      },
    ];
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
            clienteName:  cliente?.nameContact || cliente?.company || cliente?.name || cliente?.Description || '-',
            pedidoNumero: pedido?.numero || d.idPedido  || '-',
            __modified: false,
          };
        });

        this.applyFilter();
        this.hasUnsavedChanges = false;
      },
      error: (e) => {
        console.error('Error cargando productos:', e);
        this.rowData = [];
      },
    });
  }

  async saveChanges(): Promise<void> {
    const modified = this.allData.filter(r => r.__modified);
    if (modified.length === 0) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    alerts.showLoading('Guardando...', 'Actualizando estados');
    try {
      for (const row of modified) {
        await lastValueFrom(this.pedidosService.updateDetalle(row.id, {
          id:              row.id,
          idPedido:        row.idPedido,
          idCliente:       row.idCliente,
          producto:        row.producto,
          cantidad:        row.cantidad        || 1,
          plataforma:      row.plataforma,
          aplicaimpuestos: row.aplicaimpuestos,
          costo:           row.costo           || 0,
          venta:           row.venta           || 0,
          impuesto:        row.impuesto        || 0,
          estado:          row.estado          || 'SOLICITADO',
          comentario:      row.comentario,
          active:          row.active,
        }));
        row.__modified = false;
      }
      alerts.closeLoading();
      this.hasUnsavedChanges = false;
      alerts.toastAlert('Estados actualizados correctamente', 'success');
    } catch (error) {
      alerts.closeLoading();
      console.error('Error guardando cambios:', error);
      alerts.basicAlert('Error', 'No se pudieron guardar los cambios', 'error');
    }
  }

  revertChanges(): void {
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por deshacer', 'info');
      return;
    }
    this.loadData();
  }

  private isBackendControlledState(estado: unknown): boolean {
    const normalized = String(estado ?? '').toUpperCase();
    return normalized === this.ESTADO_REMISION || normalized === this.ESTADO_ENTREGADO;
  }

  async deleteRow(item: any): Promise<void> {
    const result = await Swal.fire({
      title: '¿Eliminar ítem?',
      text: '¿Estás seguro de que deseas eliminar este registro?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      allowOutsideClick: false,
      customClass: { container: 'swal-over-modal' }
    });
    if (!result.isConfirmed) return;
    try {
      await lastValueFrom(this.pedidosService.deleteDetalle(item.id));
      this.allData = this.allData.filter(r => r.id !== item.id);
      this.applyFilter();
      alerts.toastAlert('Ítem eliminado', 'success');
    } catch (e) {
      console.error('Error eliminando ítem:', e);
      alerts.basicAlert('Error', 'No se pudo eliminar el ítem', 'error');
    }
  }

  async sendToRemision(item: any): Promise<void> {
    const detalleId  = Number(item?.id ?? 0);
    const clienteId  = Number(item?.idCliente ?? 0);
    const pedidoId   = Number(item?.idPedido ?? 0);
    const idCompany  = Number(this.idcompany ?? 0);

    if (detalleId <= 0 || !idCompany || !clienteId) {
      alerts.basicAlert('Datos incompletos', 'Falta empresa, cliente o ID del ítem.', 'warning');
      return;
    }

    const cantidadDisponible = Number(item.cantidad) || 0;
    if (cantidadDisponible <= 0) {
      alerts.basicAlert('Cantidad inválida', 'El ítem debe tener una cantidad válida para remisionar.', 'warning');
      return;
    }

    const qResult = await Swal.fire({
      title: 'Cantidad a remisionar',
      text: 'Indica la cantidad que deseas mandar a remisión.',
      input: 'number',
      inputValue: String(cantidadDisponible),
      inputAttributes: { min: '1', max: String(cantidadDisponible), step: '1' },
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      preConfirm: (value: string) => {
        const cantidad = Number(value);
        if (!Number.isFinite(cantidad) || cantidad <= 0) {
          Swal.showValidationMessage('La cantidad debe ser mayor a 0');
          return false;
        }
        if (cantidad > cantidadDisponible) {
          Swal.showValidationMessage(`Disponible: ${cantidadDisponible}`);
          return false;
        }
        return cantidad;
      }
    });
    if (!qResult.isConfirmed) return;

    const cantidadRemitida = Number(qResult.value);
    const comentario = '';
    const createdBy  = localStorage.getItem('mail') || 'WEB';

    try {
      alerts.showLoading('Preparando remisión...', 'Consultando remisiones abiertas del cliente.');
      const abiertasResponse: any = await lastValueFrom(
        this.remisionesService.getByCliente(idCompany, clienteId, 'ABIERTA')
      );
      const remisionesAbiertas = this.extractOpenRemisiones(abiertasResponse, idCompany, clienteId);
      alerts.closeLoading();

      let idRemision = 0;
      let openResponse: any = null;

      if (remisionesAbiertas.length > 0) {
        const selectedOption = await this.askOpenRemisionSelection(remisionesAbiertas);
        if (!selectedOption) return;

        if (selectedOption === 'NEW') {
          alerts.showLoading('Creando remisión...', '');
          openResponse = await lastValueFrom(
            this.remisionesService.createOrReuseOpen({
              idCompany, IdCompany: idCompany,
              idCliente: clienteId, IdCliente: clienteId,
              forceNew: true, ForceNew: true,
              comentario, Comentario: comentario,
              createdBy, CreatedBy: createdBy,
            })
          );
          alerts.closeLoading();
        } else {
          idRemision = Number(selectedOption);
        }
      } else {
        alerts.showLoading('Creando remisión...', '');
        openResponse = await lastValueFrom(
          this.remisionesService.createOrReuseOpen({
            idCompany, IdCompany: idCompany,
            idCliente: clienteId, IdCliente: clienteId,
            comentario, Comentario: comentario,
            createdBy, CreatedBy: createdBy,
          })
        );
        alerts.closeLoading();
      }

      if (openResponse) {
        idRemision = Number(
          openResponse?.id ?? openResponse?.Id ??
          openResponse?.Data?.id ?? openResponse?.Data?.Id ??
          openResponse?.data?.id ?? openResponse?.data?.Id ??
          openResponse?.remision?.id ?? openResponse?.remision?.Id ?? 0
        );
      }

      if (idRemision <= 0) throw new Error('No se pudo determinar la remisión destino.');

      const payload = {
        idCompany, IdCompany: idCompany,
        idCliente: clienteId, IdCliente: clienteId,
        idRemision, IdRemision: idRemision,
        idPedido: pedidoId, IdPedido: pedidoId,
        idDetallePedido: detalleId, IdDetallePedido: detalleId,
        idDetalle: detalleId, IdDetalle: detalleId,
        cantidadRemitida, CantidadRemitida: cantidadRemitida,
        cantidad: cantidadRemitida, Cantidad: cantidadRemitida,
        comentario, Comentario: comentario,
        createdBy, CreatedBy: createdBy,
      };

      alerts.showLoading('Mandando a remisión...', 'Agregando detalle a la remisión seleccionada.');
      await lastValueFrom(this.remisionesService.addDetalle(payload));
      alerts.closeLoading();
      alerts.toastAlert('Detalle mandado a remisión', 'success');
      this.loadData();
    } catch (error) {
      alerts.closeLoading();
      const msg = (error as any)?.error?.message || (error as any)?.message || 'No se pudo mandar el detalle a remisión.';
      alerts.basicAlert('Error', msg, 'error');
    }
  }

  private extractOpenRemisiones(response: any, idCompany: number, idCliente: number): any[] {
    const possibleLists = [
      response?.data, response?.Data,
      response?.data?.remisiones, response?.Data?.Remisiones,
      response?.remisiones, response?.Remisiones
    ];
    let list: any[] = [];
    for (const candidate of possibleLists) {
      if (Array.isArray(candidate)) { list = candidate; break; }
      if (candidate && typeof candidate === 'object') {
        const nested = candidate?.remisiones || candidate?.Remisiones;
        if (Array.isArray(nested)) { list = nested; break; }
      }
    }
    return list
      .filter((r: any) =>
        String(r?.estado ?? '').toUpperCase() === 'ABIERTA' &&
        Number(r?.idCompany ?? r?.IdCompany ?? 0) === idCompany &&
        Number(r?.idCliente ?? r?.IdCliente ?? 0) === idCliente
      )
      .sort((a: any, b: any) =>
        new Date(b?.fechaCreacion || 0).getTime() - new Date(a?.fechaCreacion || 0).getTime()
      );
  }

  private async askOpenRemisionSelection(remisionesAbiertas: any[]): Promise<number | 'NEW' | null> {
    const inputOptions: Record<string, string> = {};
    for (const r of remisionesAbiertas) {
      const id = Number(r?.id ?? r?.Id ?? 0);
      if (id <= 0) continue;
      const folio = r?.folio || r?.Folio || `#${id}`;
      const fecha = r?.fechaCreacion || r?.FechaCreacion;
      inputOptions[String(id)] = `${folio} | Creada: ${fecha ? new Date(fecha).toLocaleString('es-MX') : '-'}`;
    }
    inputOptions['NEW'] = '➕ Crear nueva remisión';

    const firstId = Number(remisionesAbiertas[0]?.id ?? remisionesAbiertas[0]?.Id ?? 0);
    const defaultSelected = remisionesAbiertas.length === 1 && firstId > 0 ? String(firstId) : '';

    const result = await Swal.fire({
      title: 'Selecciona remisión abierta',
      text: 'Elige a cuál remisión deseas enviar el detalle.',
      input: 'radio',
      inputOptions,
      inputValue: defaultSelected,
      width: '28rem',
      showCancelButton: true,
      confirmButtonText: 'Usar remisión',
      cancelButtonText: 'Cancelar',
      customClass: {
        container: 'swal-over-modal',
        popup: 'swal-remisiones-popup',
        title: 'swal-remisiones-title',
        htmlContainer: 'swal-remisiones-text',
        input: 'swal-remisiones-radio',
        actions: 'swal-remisiones-actions',
      },
      inputValidator: (value) => (!value ? 'Debes seleccionar una remisión' : null)
    });

    if (!result.isConfirmed) return null;
    if (result.value === 'NEW') return 'NEW';
    const selectedId = Number(result.value || 0);
    return selectedId > 0 ? selectedId : null;
  }
}
