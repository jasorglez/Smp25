import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';
import { FormsModule } from '@angular/forms';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { SignalsService } from 'app/services/signals.service';
import { PedidosService } from 'app/services/pedidos.service';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom, forkJoin } from 'rxjs';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { TrackingService } from 'app/services/tracking.service';
import { CustomersService } from 'app/services/customers.service';
import { MaterialsService } from 'app/services/materials.service';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { DetallesPedidosComponent } from './detalles-pedidos/detalles-pedidos.component';
import { DetallesClientesComponent } from './detalles-clientes/detalles-clientes.component';
import { NumArticulosRendererComponent } from './pedidos-button-num-articulos.component';
import { ButtonCellRendererExpenditureComponent } from 'app/domains/ModAdmon/components/egresos-palacio/button-cell-renderer-expenditure.component';
import { PdfButtonCellRendererComponent } from 'app/domains/ModAdmon/components/egresos-palacio/pdf-button-cell-renderer.component';

@Component({
  selector: 'app-pedidos-logistica',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, DetallesPedidosComponent, DetallesClientesComponent, NumArticulosRendererComponent, ButtonCellRendererExpenditureComponent, PdfButtonCellRendererComponent],
  templateUrl: './pedidos.component.html',
  styleUrls: ['./pedidos.component.scss'],
})
export class PedidosLogisticaComponent implements CanComponentDeactivate {
  private signalsService = inject(SignalsService);
  private pedidosService = inject(PedidosService);
  private trackingService = inject(TrackingService);
  private customersService = inject(CustomersService);
  private materialsService = inject(MaterialsService);
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);
  
  ngOnInit() {
    (window as any).pedidosComponent = this;
    // Cargar impuesto global desde localStorage
    const impuestoGuardado = localStorage.getItem(this.IMPUESTO_STORAGE_KEY);
    if (impuestoGuardado) {
      const valor = Number(impuestoGuardado);
      if (!isNaN(valor) && valor > 0) {
        this.defaultImpuesto = valor;
      }
    }
  }

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  idCompany: number = null;
  idBranch: number = null;
  rowData: any[] = [];
  /** Lista completa de pedidos (sin filtro por estado de líneas). */
  private allPedidosRowData: any[] = [];
  /** Detalles agrupados por id de pedido; sirve para filtrar el nivel 1 por estado de las líneas. */
  private detallesByPedidoCache = new Map<number, any[]>();
  /** Igual que Productos: null = Todos. Por defecto Solicitado. */
  activeFilter: string | null = 'SOLICITADO';
  selectedRowData: any = null;
  hasUnsavedChanges: boolean = false;
  externalFilterActive: boolean = false;
  gridHeight: string = '75vh';
  tempIdCounter: number = 0;
  newlyAddedRows: string[] = [];
  detalleContext: any = null;
  expandedRowId: number | null = null;
  defaultImpuesto: number = 16;
  private readonly IMPUESTO_STORAGE_KEY = 'logistica_impuesto_global';

  // Modal ticket individual por cliente
  showClienteModal: boolean = false;
  selectedClienteId: number | null = null;
  clienteModalList: { id: number; name: string }[] = [];
  clienteModalPedido: any = null;
  private clienteModalDetalles: any[] = [];

  // Modal Impuesto
  showImpuestoModal: boolean = false;
  impuestoTemp: number | null = null;

  // Modal Cliente General
  showClienteGeneralModal: boolean = false;
  selectedClienteGeneralId: number | null = null;

  private gridApi: GridApi;
  private _colMaster: ColDef[] = [];
  public clientesList: any[] = [];
  public components = {
    detallesPedidosRenderer: DetallesPedidosComponent
  };

  public defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: true,
    lockPosition: false,
    enableRowGroup: true,
    flex: 1,
  };

  public gridOptions: any = {
    headerHeight: 24,
    rowHeight: 26,
    animateRows: true,
    suppressRowTransform: true,
    masterDetail: true,
    detailCellRenderer: DetallesPedidosComponent,
    // Altura fija para evitar que el detalle quede en 0px
    detailRowHeight: 620,
    isRowMaster: (dataItem: any) => true,
    getRowClass: (params: any) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowClicked: (event: any) => {
      event.node.setSelected(true);
    },
    onRowSelected: (event: any) => {
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node: any) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
    onRowExpanded: (event: any) => {
      this.expandedRowId = event.node.data?.id || null;
    },
    onRowCollapsed: (event: any) => {
      if (event.node.data?.id === this.expandedRowId) {
        this.expandedRowId = null;
      }
    },
  };

  public rowSelection: 'single' | 'multiple' = 'single';

  constructor() {
    effect(() => {
      const currentRoot = this.signalsService.getRootSelectedBySidebar()();
      const currentBranch = this.signalsService.getBranchSelectedBySidebar()();
      if (currentRoot && currentRoot !== this.idCompany) {
        this.idCompany = currentRoot;
        this.idBranch = currentBranch;
        this.loadData();
      } else if (currentRoot && currentBranch && currentBranch !== this.idBranch) {
        this.idBranch = currentBranch;
        this.refreshClientesList();
      }
    });
  }

  private refreshClientesList(): void {
    const clientes$ = this.idBranch
      ? this.customersService.getCustomers(this.idBranch, 'CUSTOMERS')
      : this.customersService.getCustomersByCompany(this.idCompany, 'CUSTOMERS');
    clientes$.subscribe({
      next: (data: any) => {
        this.clientesList = data?.data || data || [];
        if (this.gridApi) this.gridApi.refreshCells({ force: true });
      },
      error: () => { this.clientesList = []; }
    });
  }

  async loadData() {
    if (!this.idCompany) return;

    this.setupDetailParams();

    forkJoin({
      pedidos: this.pedidosService.getPedidosByCompany(this.idCompany),
      detalles: this.pedidosService.getDetallesByCompany(this.idCompany),
      clientes: this.idBranch
        ? this.customersService.getCustomers(this.idBranch, 'CUSTOMERS')
        : this.customersService.getCustomersByCompany(this.idCompany, 'CUSTOMERS')
    }).subscribe({
      next: (results: any) => {
        const pedidosList = results.pedidos?.data || results.pedidos || [];
        const detallesList = results.detalles?.data || results.detalles || [];
        this.clientesList = results.clientes?.data || results.clientes || [];

        // Agrupar detalles por pedidoId
        const detallesByPedido = new Map<number, any[]>();
        for (const d of detallesList) {
          if (!detallesByPedido.has(d.idPedido)) detallesByPedido.set(d.idPedido, []);
          detallesByPedido.get(d.idPedido)!.push(d);
        }
        this.detallesByPedidoCache = detallesByPedido;

        // Calcular clientes únicos por pedido para mostrar en Items
        this.allPedidosRowData = pedidosList.map((pedido: any) => {
          const detallesDePedido = detallesByPedido.get(pedido.id) || [];
          const uniqueClientIds = [...new Set(detallesDePedido.map((d: any) => d.idCliente).filter(Boolean))];
          const clientesLabel = uniqueClientIds.length;

          // Total (nivel 1) = suma de (cantidad × venta + impuesto) de todos los detalles del pedido (nivel 2)
          const totalVenta = detallesDePedido.reduce((sum: number, d: any) => {
            const cantidad = Number(d?.cantidad) || 0;
            const venta = Number(d?.venta) || 0;
            const impuesto = Number(d?.impuesto) || 0;
            return sum + (cantidad * venta) + impuesto;
          }, 0);

          // Número de artículos (cantidad de detalles)
          const numArticulos = detallesDePedido.length;

          return { ...pedido, total: totalVenta, clientesLabel, numArticulos, impuesto: pedido.impuesto ?? 0, detailData: [], visible: true };
        });

        this.applyEstadoFilter();

        queueMicrotask(() => {
          if (this.gridApi) {
            this.gridApi.setFilterModel(null);
            this.gridApi.onFilterChanged();
          }
        });
      },
      error: (error) => {
        console.error('Error loading pedidos:', error);
        this.allPedidosRowData = [];
        this.detallesByPedidoCache = new Map();
        this.rowData = [];
        alerts.basicAlert('Error', 'No se pudieron cargar los pedidos', 'error');
      },
    });
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.setupDetailParams();
  }

  setFilter(estado: string | null): void {
    this.activeFilter = estado;
    this.loadData();
  }

  private normalizeDetalleEstado(estado: unknown): string {
    if (estado === undefined || estado === null || estado === '') {
      return 'SOLICITADO';
    }
    return String(estado).toUpperCase();
  }

  /** Un pedido entra en el filtro si alguna línea tiene ese estado; sin líneas se trata como SOLICITADO. */
  private pedidoMatchesEstadoFilter(pedidoId: unknown): boolean {
    if (this.activeFilter === null) {
      return true;
    }
    const pid = Number(pedidoId);
    if (Number.isNaN(pid)) {
      return this.activeFilter === 'SOLICITADO';
    }
    const ds = this.detallesByPedidoCache.get(pid) || [];
    if (ds.length === 0) {
      return this.activeFilter === 'SOLICITADO';
    }
    return ds.some((d: any) => this.normalizeDetalleEstado(d.estado) === this.activeFilter);
  }

  private applyEstadoFilter(): void {
    this.rowData = this.allPedidosRowData.map((p: any) => {
      if (p.__isNew) {
        return p;
      }
      // Recalcular numArticulos y total basado en el filtro activo
      const detallesDePedido = this.detallesByPedidoCache.get(p.id) || [];
      const detallesFiltrados = this.activeFilter === null
        ? detallesDePedido
        : detallesDePedido.filter((d: any) => this.normalizeDetalleEstado(d.estado) === this.activeFilter);

      const numArticulosFiltrados = detallesFiltrados.length;

      // Recalcular total con detalles filtrados
      const totalFiltrado = detallesFiltrados.reduce((sum: number, d: any) => {
        const cantidad = Number(d?.cantidad) || 0;
        const venta = Number(d?.venta) || 0;
        const impuesto = Number(d?.impuesto) || 0;
        return sum + (cantidad * venta) + impuesto;
      }, 0);

      return {
        ...p,
        numArticulos: numArticulosFiltrados,
        total: totalFiltrado
      };
    }).filter(
      (p: any) => p.__isNew || this.pedidoMatchesEstadoFilter(p.id)
    );

    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
      this.setupDetailParams();
    }
  }

  private setupDetailParams(): void {
    if (!this.gridApi) return;
    this.gridApi.setGridOption('detailCellRendererParams', {
      getDetailRowData: (params: any) => {
        const detailData = params.data?.detailData || [];
        // Filtrar detalles por estado activo
        const filteredData = this.activeFilter === null
          ? detailData
          : detailData.filter((d: any) => this.normalizeDetalleEstado(d.estado) === this.activeFilter);
        params.successCallback(filteredData);
      },
      context: {
        idCompany: this.idCompany,
        idBranch: this.idBranch,
        componentParent: this,
        gridApi: this.gridApi,
        pedidosService: this.pedidosService,
        trackingService: this.trackingService,
        customersService: this.customersService,
        materialsService: this.materialsService,
        rootService: this.rootService,
        base64EncodeService: this.base64EncodeService,
        activeFilter: this.activeFilter,
        CONCEPTS: {
          load: (idPedido: number, callback: (data: any[]) => void) => {
            this.loadDetallesData(idPedido, callback);
          },
          save: (idPedido: number, data: any) => {
            return this.saveDetallesById(idPedido, data);
          },
          delete: (params: any, callback: () => void, newCount?: number) => {
            this.deleteDetalleRow(params, callback, newCount);
          },
          updateCount: (idPedido: number, count: number) => {
            this.updatePedidoNumArticulos(idPedido, count);
          },
          updateTotalVenta: (idPedido: number, totalVenta: number) => {
            this.updatePedidoTotalVenta(idPedido, totalVenta);
          }
        }
      }
    });
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedRowData = null;
    }
  }

  onImpuestoChanged() {
    if (this.selectedRowData) {
      this.selectedRowData.impuesto = this.defaultImpuesto;
      this.selectedRowData.__modified = true;
      this.hasUnsavedChanges = true;
      // Refrescar la fila en el grid
      if (this.gridApi) {
        this.gridApi.refreshCells({ rowNodes: [this.gridApi.getRowNode(String(this.selectedRowData.id))], columns: ['impuesto'], force: true });
      }
    }
  }

  openImpuestoModal() {
    this.impuestoTemp = this.defaultImpuesto;
    this.showImpuestoModal = true;
  }

  closeImpuestoModal() {
    this.showImpuestoModal = false;
    this.impuestoTemp = null;
  }

  async saveImpuesto() {
    if (this.impuestoTemp === null || this.impuestoTemp === undefined || this.impuestoTemp <= 0) {
      alerts.basicAlert('Error', 'Ingresa un valor de impuesto válido (mayor a 0)', 'error');
      return;
    }

    this.defaultImpuesto = this.impuestoTemp;
    localStorage.setItem(this.IMPUESTO_STORAGE_KEY, String(this.impuestoTemp));
    alerts.basicAlert('Éxito', `Impuesto global actualizado a ${this.impuestoTemp}%`, 'success');
    this.closeImpuestoModal();
  }

  get colMaster(): ColDef[] {
    if (this._colMaster.length > 0) {
      return this._colMaster;
    }

    this._colMaster = [
      {
        field: 'id',
        colId: 'id',
        headerName: 'ID',
        hide: true,
        filter: 'agTextColumnFilter',
        suppressColumnsToolPanel: true,
      },
      {
        field: 'itemsBtn',
        headerName: 'Items',
        editable: false,
        minWidth: 100,
        cellRenderer: ButtonCellRendererExpenditureComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleDetalleClientes(node),
          icon: 'bi-people',
        },
        valueGetter: (params) => params.data?.clientesLabel ?? 0,
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer' }
      },
      {
        field: 'pdfReport',
        headerName: 'PDF',
        editable: false,
        minWidth: 80,
        cellRenderer: PdfButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleDetallePdf(node),
          icon: 'bi-file-earmark-pdf',
          iconColor: '#dc3545',
          title: 'Ver PDF del pedido'
        },
        cellStyle: { backgroundColor: '#fff3e0', textAlign: 'center' }
      },
      {
        field: 'pdfTicket',
        headerName: 'Ticket',
        editable: false,
        minWidth: 90,
        cellRenderer: PdfButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.generateTicketPDF(node),
          icon: 'bi-receipt',
          iconColor: '#1565c0',
          title: 'Ticket por cliente (sin costo)'
        },
        cellStyle: { backgroundColor: '#e3f2fd', textAlign: 'center' }
      },
      {
        field: 'pdfTicketCliente',
        headerName: 'T.Cliente',
        editable: false,
        minWidth: 110,
        cellRenderer: PdfButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.openClienteModal(node),
          icon: 'bi-person-badge',
          iconColor: '#6a1b9a',
          title: 'Ticket individual por cliente'
        },
        cellStyle: { backgroundColor: '#f3e5f5', textAlign: 'center' }
      },
      {
        field: 'numero',
        headerName: 'Número',
        editable: false,
        flex: 1,
           filter: 'agSetColumnFilter',
      filterParams: {
        defaultToNothingSelected: true,
      },
        minWidth: 130,
      },
      {
        field: 'fecha',
        headerName: 'Fecha',
        editable: true,
        flex: 1,
           filter: 'agSetColumnFilter',
      filterParams: {
        defaultToNothingSelected: true,
      },
        minWidth: 130,
        valueFormatter: (params) => {
          if (!params.value) return '';
          const date = new Date(params.value);
          return date.toLocaleDateString('es-MX');
        },
      },
      {
        field: 'numArticulos',
        headerName: 'Articulos',
        editable: false,
        minWidth: 110,
        cellRenderer: NumArticulosRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => {
            const parent = (window as any).pedidosComponent;
            if (parent && typeof parent.toggleDetalle === 'function') {
              parent.toggleDetalle(node);
            } else {
              node.setExpanded(!node.expanded);
            }
          }
        },
        cellStyle: { backgroundColor: '#e3f2fd' }
      },
      {
        field: 'total',
        headerName: 'Total',
        editable: false,
        minWidth: 100,
        valueFormatter: (params) => {
          if (params.value) {
            return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
          }
          return '$0.00';
        },
        cellStyle: { backgroundColor: '#d4edda', fontWeight: 'bold' }
      },
      {
        field: 'impuesto',
        headerName: 'Imp. %',
        hide: true,
        editable: true,
        minWidth: 80,
        type: 'numericColumn',
        cellStyle: { backgroundColor: '#fff9e6' },
        valueFormatter: (params) => {
          return params.value ? params.value.toFixed(2) + '%' : '0.00%';
        },
        valueSetter: (params: any) => {
          const val = parseFloat(params.newValue);
          params.data.impuesto = isNaN(val) ? 0 : val;
          return true;
        }
      },
      {
        field: 'banco',
        headerName: 'Banco',
        editable: false,
        minWidth: 120,
        filter: 'agSetColumnFilter',
        filterParams: {
          defaultToNothingSelected: true,
        },
        cellStyle: { backgroundColor: '#f0f0f0' }
      },
      {
        colId: 'totalPagarBanco',
        headerName: 'Pago al banco',
        editable: false,
        minWidth: 120,
        valueGetter: (params) => params.data?.totalPagarBanco ?? 0,
        valueFormatter: (params) => {
          const value = params.value ?? 0;
          return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
        },
        cellStyle: { backgroundColor: '#e7f1ff', fontWeight: 'bold' }
      },
      {
        field: 'comentario',
        headerName: 'Comentario',
        editable: true,
        flex: 2,
        minWidth: 200,
      },
      {
        field: 'active',
        headerName: 'Activo',
        editable: true,
        minWidth: 100,
        cellRenderer: (params: ICellRendererParams) => {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = params.value === true || params.value === 1 || params.value === '1';
          checkbox.style.cursor = 'pointer';
          return checkbox;
        },
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: [true, false],
        },
        valueSetter: (params: any) => {
          params.data.active = params.newValue;
          return true;
        },
      },
    ];

    return this._colMaster;
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }

  private getNextPedidoNumero(): string {
    const maxSequence = this.allPedidosRowData.reduce((max, row) => {
      const numero = String(row?.numero || '').trim().toUpperCase();
      const match = numero.match(/^PED-(\d+)$/);

      if (!match) return max;

      const sequence = parseInt(match[1], 10);
      return Number.isNaN(sequence) ? max : Math.max(max, sequence);
    }, 0);

    return `PED-${String(maxSequence + 1).padStart(3, '0')}`;
  }

  add() {
    if (!this.gridApi) {
      console.error('Grid API not initialized');
      alerts.basicAlert('Error', 'El grid no está listo', 'error');
      return;
    }

    const tempId = `temp_${this.tempIdCounter++}`;
    const newPedido = {
      id: tempId,
      idCompany: this.idCompany,
      numero: this.getNextPedidoNumero(),
      fecha: new Date().toISOString().split('T')[0],
      comentario: '',
      active: true,
      __isNew: true,
    };

    this.allPedidosRowData = [newPedido, ...this.allPedidosRowData];
    this.newlyAddedRows.push(tempId);
    this.hasUnsavedChanges = true;
    this.applyEstadoFilter();

    setTimeout(() => {
      this.gridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'fecha',
      });
    }, 0);
  }

  async saveChanges() {
    const newRows = this.allPedidosRowData.filter((row) => row.__isNew);
    const modifiedRows = this.allPedidosRowData.filter((row) => row.__modified && !row.__isNew);

    try {
      for (const row of newRows) {
        const dataToSend = {
          idCompany: row.idCompany,
          numero: row.numero,
          fecha: row.fecha,
          comentario: row.comentario,
          active: row.active,
          banco: row.banco,
          totalPagarBanco: row.totalPagarBanco,
        };
        await lastValueFrom(this.pedidosService.createPedido(dataToSend));
      }

      for (const row of modifiedRows) {
        const dataToSend = {
          id: row.id,
          idCompany: row.idCompany,
          numero: row.numero,
          fecha: row.fecha,
          comentario: row.comentario,
          active: row.active,
          banco: row.banco,
          totalPagarBanco: row.totalPagarBanco,
          impuesto: row.impuesto,
        };
        await lastValueFrom(this.pedidosService.updatePedido(row.id, dataToSend));
      }

      alerts.toastAlert('Pedidos guardados correctamente', 'success');
      this.hasUnsavedChanges = false;
      this.newlyAddedRows = [];
      
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Guardar Pedidos',
        'Menu Logística Pedidos',
        this.trackingService.getEmail()
      );

      await this.loadData();
    } catch (error) {
      console.error('Error saving pedidos:', error);
      alerts.basicAlert('Error', 'No se pudieron guardar los pedidos', 'error');
    }
  }

  revertChanges() {
    this.loadData();
    this.hasUnsavedChanges = false;
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Cancelar Cambios en Pedidos',
      'Menu Logística Pedidos',
      this.trackingService.getEmail()
    );
  }

  delete() {
    if (!this.selectedRowData) {
      alerts.basicAlert('Eliminar', 'Seleccione un pedido para eliminar', 'warning');
      return;
    }

    if (this.selectedRowData.__isNew) {
      this.allPedidosRowData = this.allPedidosRowData.filter((row) => row.id !== this.selectedRowData.id);
      this.applyEstadoFilter();
      this.hasUnsavedChanges = false;
      this.selectedRowData = null;
      return;
    }

    alerts
      .confirmAlert(
        'Eliminar Pedido',
        '¿Está seguro que desea eliminar este pedido?',
        'warning',
        'Sí, eliminar'
      )
      .then(async (result) => {
        if (result.isConfirmed) {
          try {
            await lastValueFrom(this.pedidosService.deletePedido(this.selectedRowData.id));
            alerts.basicAlert('Eliminado', 'Pedido eliminado correctamente', 'success');
            this.trackingService.addLog(
              this.trackingService.getnameComp(),
              'Eliminar Pedido',
              'Menu Logística Pedidos',
              this.trackingService.getEmail()
            );
            await this.loadData();
          } catch (error) {
            alerts.basicAlert('Error', 'No se pudo eliminar el pedido', 'error');
          }
        }
      });
  }

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.hasUnsavedChanges);
  }

  /** Igual que Proveedores: filtro equals sobre `id` (texto: sirve para id numérico y `temp_*`). */
  private buildIdEqualsFilterModel(id: string | number | undefined | null): Record<string, unknown> | null {
    if (id === undefined || id === null) {
      return null;
    }
    return {
      id: { filterType: 'text', type: 'equals', filter: String(id) },
    };
  }

  toggleDetalle(node: any) {
    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data?.detailType === 'pedidos';

    if (isCurrentlyExpanded) {
      api.forEachNode((n: any) => { if (n.expanded) n.setExpanded(false); });
      if (node.data) {
        node.data.detailType = null;
      }
      this.selectedRowData = null;
      api.setFilterModel(null);
      api.onFilterChanged();
    } else {
      api.forEachNode((n: any) => { if (n.expanded) n.setExpanded(false); if (n.data) n.data.detailType = null; });

      if (node.data) {
        node.data.detailType = 'pedidos';
        this.selectedRowData = node.data;
      }

      this.gridApi.setGridOption('detailCellRenderer', DetallesPedidosComponent);

      setTimeout(() => {
        const filterModel = this.buildIdEqualsFilterModel(node.data?.id);
        if (filterModel) {
          api.setFilterModel(filterModel);
          api.onFilterChanged();
        }
        node.setExpanded(true);
      }, 0);
    }
  }

  toggleDetallePdf(node: any) {
    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data?.detailType === 'pdf';

    if (isCurrentlyExpanded) {
      api.forEachNode((n: any) => { if (n.expanded) n.setExpanded(false); });
      if (node.data) node.data.detailType = null;
      this.selectedRowData = null;
    } else {
      api.forEachNode((n: any) => { if (n.expanded) n.setExpanded(false); if (n.data) n.data.detailType = null; });

      if (node.data) {
        node.data.detailType = 'pdf';
        this.selectedRowData = node.data;
      }
      setTimeout(() => node.setExpanded(true), 0);
    }
  }

  toggleDetalleClientes(node: any) {
    console.log('[toggleDetalleClientes] called — node.id:', node.id, 'node.data.id:', node.data?.id, 'expanded:', node.expanded, 'detailType:', node.data?.detailType);
    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data?.detailType === 'clientes';

    if (isCurrentlyExpanded) {
      api.forEachNode((n: any) => {
        if (n.expanded) n.setExpanded(false);
      });
      if (node.data) node.data.detailType = null;
      this.selectedRowData = null;
      api.setFilterModel(null);
      api.onFilterChanged();
    } else {
      api.forEachNode((n: any) => {
        if (n.expanded) n.setExpanded(false);
        if (n.data) n.data.detailType = null;
      });

      if (node.data) {
        node.data.detailType = 'clientes';
        this.selectedRowData = node.data;
      }
      console.log('[toggleDetalleClientes] about to expand — detailType now:', node.data?.detailType);

      this.gridApi.setGridOption('detailCellRenderer', DetallesClientesComponent);

      setTimeout(() => {
        console.log('[toggleDetalleClientes] setTimeout — calling setExpanded(true), detailType:', node.data?.detailType);
        const filterModel = this.buildIdEqualsFilterModel(node.data?.id);
        if (filterModel) {
          api.setFilterModel(filterModel);
          api.onFilterChanged();
        }

        api.redrawRows({ rowNodes: [node] });
        node.setExpanded(true);
      }, 0);
    }
  }

  private updatePedidoNumArticulos(idPedido: number, count: number) {
    if (this.gridApi) {
      this.gridApi.forEachNode((node: any) => {
        if (node.data && node.data.id === idPedido) {
          node.data.numArticulos = count;
          this.gridApi.refreshCells({
            rowNodes: [node],
            columns: ['numArticulos'],
            force: true
          });
        }
      });
    }
  }

  private updatePedidoTotalVenta(idPedido: number, totalVenta: number) {
    if (!this.gridApi) return;
    this.gridApi.forEachNode((node: any) => {
      if (node.data && node.data.id === idPedido) {
        node.data.total = totalVenta;
        this.gridApi.refreshCells({
          rowNodes: [node],
          columns: ['total', 'totalPagarBanco'],
          force: true,
        });
      }
    });
  }

  private loadDetallesData(idPedido: number, successCallback: any) {
    this.pedidosService.getDetallesByPedido(idPedido).subscribe({
      next: (data: any) => {
        let detalles: any[] = [];
        if (data?.data) {
          if (Array.isArray(data.data)) {
            detalles = data.data;
          } else if (data.data.id) {
            detalles = [data.data];
          }
        }
        // Agregar clienteName para el agrupamiento en el grid de detalles
        detalles = detalles.map(d => ({
          ...d,
          clienteName: (() => {
            const c = this.clientesList.find((c: any) => c.id == d.idCliente);
            return c?.nameContact || c?.company || '';
          })()
        }));

        // Filtrar por estado activo si está configurado
        if (this.activeFilter !== null) {
          detalles = detalles.filter((d: any) => this.normalizeDetalleEstado(d.estado) === this.activeFilter);
        }

        successCallback(detalles);
      },
      error: (error) => {
        console.error('Error loading detalles:', error);
        successCallback([]);
      }
    });
  }

  private saveDetallesById(idPedido: number, data: any): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const detallesData = data.detalles || data;
        const expandedPedidoId = this.expandedRowId;

        const newRows = detallesData.filter((row: any) => row.__isNew);
        const modifiedRows = detallesData.filter((row: any) => row.__modified && !row.__isNew);

        for (const row of newRows) {
          const dataToSend = {
            idPedido: idPedido,
            idCliente: row.idCliente,
            producto: row.producto,
            cantidad: row.cantidad || 1,
            plataforma: row.plataforma,
            aplicaImpuestos: row.aplicaImpuestos,
            costo: row.costo || 0,
            venta: row.venta || 0,
            impuesto: row.impuesto || 0,
            estado: row.estado || 'SOLICITADO',
            comentario: row.comentario,
            active: row.active ?? true,
          };
          await lastValueFrom(this.pedidosService.createDetalle(dataToSend));
        }

        for (const row of modifiedRows) {
          const dataToSend = {
            id: row.id,
            idPedido: idPedido,
            idCliente: row.idCliente,
            producto: row.producto,
            cantidad: row.cantidad || 1,
            plataforma: row.plataforma,
            aplicaImpuestos: row.aplicaImpuestos,
            costo: row.costo || 0,
            venta: row.venta || 0,
            impuesto: row.impuesto || 0,
            estado: row.estado || 'SOLICITADO',
            comentario: row.comentario,
            active: row.active,
          };
          await lastValueFrom(this.pedidosService.updateDetalle(row.id, dataToSend));
        }

        // Recargar toda la tabla desde el backend
        if (newRows.length > 0 || modifiedRows.length > 0) {
          await new Promise(resolve => {
            setTimeout(() => {
              this.loadData();
              // Re-expandir la fila que estaba expandida
              if (expandedPedidoId !== null && this.gridApi) {
                setTimeout(() => {
                  const rowNode = this.gridApi.getRowNode(String(expandedPedidoId));
                  if (rowNode) {
                    rowNode.setExpanded(true);
                  }
                }, 100);
              }
              resolve(null);
            }, 300);
          });
        }

        resolve();
      } catch (error) {
        console.error('Error saving detalles:', error);
        reject(error);
      }
    });
  }

  async generatePedidoPDF(node: any): Promise<void> {
    const pedido = node.data;
    if (!pedido) return;

    try {
      const pdfMake = (await import('pdfmake/build/pdfmake')).default;
      const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
      (pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

      // Logo de la empresa
      let logoBase64: string | null = null;
      try {
        const rootData: any = await lastValueFrom(this.rootService.getRootbyId(this.idCompany));
        if (rootData?.picture) {
          logoBase64 = await this.base64EncodeService.convertImageToBase64(rootData.picture);
        }
      } catch { /* sin logo */ }

      // Cargar detalles del pedido
      let detalles: any[] = [];
      try {
        const response: any = await lastValueFrom(this.pedidosService.getDetallesByPedido(pedido.id));
        detalles = response?.data ? (Array.isArray(response.data) ? response.data : [response.data]) : [];
      } catch { detalles = []; }

      const getClienteName = (idCliente: number) => {
        const found = this.clientesList.find((c: any) => c.id == idCliente);
        return found?.nameContact || found?.company || found?.name || String(idCliente || '-');
      };

      const fechaStr = pedido.fecha ? new Date(pedido.fecha).toLocaleDateString('es-MX') : '-';
      const currency = (val: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);

      const totalPedido = detalles.reduce((sum: number, d: any) => {
        const sub = (d.cantidad || 0) * (d.venta || 0);
        return sum + sub + (d.impuesto || 0);
      }, 0);

      const logoCell = logoBase64
        ? { image: logoBase64, width: 60, alignment: 'left' as const }
        : { text: '', width: 60 };

      const tableBody: any[] = [
        [
          { text: 'Cliente',    style: 'tableHeader' },
          { text: 'Producto',   style: 'tableHeader' },
          { text: 'Cant.',      style: 'tableHeader' },
          { text: 'Plataforma', style: 'tableHeader' },
          { text: 'Costo',      style: 'tableHeader' },
          { text: 'Venta',      style: 'tableHeader' },
          { text: 'Imp.%',      style: 'tableHeader' },
          { text: 'Total',      style: 'tableHeader' },
          { text: 'Estado',     style: 'tableHeader' },
        ],
        ...detalles.map((d: any) => {
          const sub = (d.cantidad || 0) * (d.venta || 0);
          const total = sub + (d.impuesto || 0);
          return [
            { text: getClienteName(d.idCliente), fontSize: 8 },
            { text: d.producto || '-', fontSize: 8 },
            { text: String(d.cantidad || 0), alignment: 'center', fontSize: 8 },
            { text: d.plataforma || '-', fontSize: 8 },
            { text: currency(d.costo), alignment: 'right', fontSize: 8 },
            { text: currency(d.venta), alignment: 'right', fontSize: 8 },
            { text: (d.impuesto || 0) + '%', alignment: 'center', fontSize: 8 },
            { text: currency(total), alignment: 'right', fontSize: 8 },
            { text: d.estado || '-', fontSize: 8 },
          ];
        }),
        [
          { text: 'TOTAL', colSpan: 7, bold: true, alignment: 'right', fontSize: 9 },
          {}, {}, {}, {}, {}, {},
          { text: currency(totalPedido), bold: true, alignment: 'right', fontSize: 9 },
          {}
        ]
      ];

      const docDefinition: any = {
        pageOrientation: 'landscape',
        pageMargins: [30, 55, 30, 35],
        header: () => ({
          margin: [30, 10, 30, 0],
          table: {
            widths: ['auto', '*', 'auto'],
            body: [[
              logoCell,
              {
                stack: [
                  { text: `Pedido #${pedido.numero || pedido.id}`, style: 'headerTitle' },
                  { text: `Fecha: ${fechaStr}   |   Items: ${detalles.length}   |   Total: ${currency(totalPedido)}`, fontSize: 8, color: '#555', alignment: 'center' }
                ]
              },
              { text: new Date().toLocaleDateString('es-MX'), fontSize: 8, color: '#888', alignment: 'right', margin: [0, 6, 0, 0] }
            ]]
          },
          layout: 'noBorders'
        }),
        content: [
          pedido.comentario
            ? { text: `Comentario: ${pedido.comentario}`, style: 'info', margin: [0, 0, 0, 8] }
            : { text: '' },
          { text: 'Detalles del Pedido', style: 'sectionTitle', margin: [0, 0, 0, 4] },
          detalles.length > 0
            ? {
                table: {
                  headerRows: 1,
                  widths: ['*', '*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
                  body: tableBody
                },
                layout: 'lightHorizontalLines'
              }
            : { text: 'Sin detalles registrados.', italics: true, color: '#999' }
        ],
        styles: {
          headerTitle:  { fontSize: 14, bold: true, color: '#1a237e', alignment: 'center' },
          sectionTitle: { fontSize: 11, bold: true, color: '#333' },
          info:         { fontSize: 9, color: '#444' },
          tableHeader:  { bold: true, fontSize: 9, fillColor: '#e3f2fd', color: '#1a237e' }
        },
        footer: (currentPage: number, pageCount: number) => ({
          text: `Página ${currentPage} de ${pageCount}`,
          alignment: 'center', fontSize: 8, color: '#999', margin: [0, 8, 0, 0]
        })
      };

      const pdf = pdfMake.createPdf(docDefinition);
      try { pdf.open(); } catch { pdf.download(`Pedido_${pedido.numero || pedido.id}.pdf`); }

    } catch (error) {
      console.error('Error generando PDF del pedido:', error);
      alerts.basicAlert('Error', 'No se pudo generar el PDF del pedido', 'error');
    }
  }

  async generateTicketPDF(node: any): Promise<void> {
    const pedido = node.data;
    if (!pedido) return;

    try {
      const pdfMake = (await import('pdfmake/build/pdfmake')).default;
      const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
      (pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

      // Logo
      let logoBase64: string | null = null;
      try {
        const rootData: any = await lastValueFrom(this.rootService.getRootbyId(this.idCompany));
        if (rootData?.picture) {
          logoBase64 = await this.base64EncodeService.convertImageToBase64(rootData.picture);
        }
      } catch { /* sin logo */ }

      // Detalles del pedido
      let detalles: any[] = [];
      try {
        const response: any = await lastValueFrom(this.pedidosService.getDetallesByPedido(pedido.id));
        detalles = response?.data ? (Array.isArray(response.data) ? response.data : [response.data]) : [];
      } catch { detalles = []; }

      const getClienteName = (idCliente: number) => {
        const found = this.clientesList.find((c: any) => c.id == idCliente);
        return found?.nameContact || found?.company || found?.name || String(idCliente || '-');
      };

      const fechaStr = pedido.fecha ? new Date(pedido.fecha).toLocaleDateString('es-MX') : '-';
      const currency = (val: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);

      // Agrupar ítems por cliente
      const clienteMap = new Map<number, any[]>();
      for (const d of detalles) {
        const key = Number(d.idCliente) || 0;
        if (!clienteMap.has(key)) clienteMap.set(key, []);
        clienteMap.get(key)!.push(d);
      }

      // Ordenar clientes por nombre
      const clientesOrdenados = [...clienteMap.entries()].sort((a, b) =>
        getClienteName(a[0]).localeCompare(getClienteName(b[0]))
      );

      const logoCell = logoBase64
        ? { image: logoBase64, width: 60, alignment: 'left' as const }
        : { text: '', width: 60 };

      // Total general del pedido
      const grandTotal = detalles.reduce((sum: number, d: any) => {
        const sub = (d.cantidad || 0) * (d.venta || 0);
        return sum + sub + (d.impuesto || 0);
      }, 0);

      // Construir contenido agrupado por cliente
      const content: any[] = [];

      if (pedido.comentario) {
        content.push({ text: `Comentario: ${pedido.comentario}`, style: 'info', margin: [0, 0, 0, 8] });
      }

      for (const [idCliente, items] of clientesOrdenados) {
        const nombreCliente = getClienteName(idCliente);
        const subtotalCliente = items.reduce((sum: number, d: any) => {
          const sub = (d.cantidad || 0) * (d.venta || 0);
          return sum + sub + (d.impuesto || 0);
        }, 0);

        // Encabezado del cliente
        content.push({
          table: {
            widths: ['*', 'auto'],
            body: [[
              { text: nombreCliente, style: 'clienteHeader' },
              { text: currency(subtotalCliente), style: 'clienteHeader', alignment: 'right' as const }
            ]]
          },
          layout: 'noBorders',
          margin: [0, 10, 0, 2]
        });

        // Tabla de ítems del cliente (sin columna Costo)
        const rows: any[] = items.map((d: any) => {
          const sub = (d.cantidad || 0) * (d.venta || 0);
          const total = sub + (d.impuesto || 0);
          return [
            { text: d.producto || '-', fontSize: 8 },
            { text: String(d.cantidad || 0), alignment: 'center', fontSize: 8 },
            { text: d.plataforma || '-', fontSize: 8 },
            { text: currency(d.venta), alignment: 'right', fontSize: 8 },
            { text: (d.impuesto || 0) + '%', alignment: 'center', fontSize: 8 },
            { text: currency(total), alignment: 'right', bold: true, fontSize: 8 },
            { text: d.estado || '-', fontSize: 8 },
          ];
        });

        content.push({
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'Producto',   style: 'tableHeader' },
                { text: 'Cant.',      style: 'tableHeader' },
                { text: 'Plataforma', style: 'tableHeader' },
                { text: 'Venta',      style: 'tableHeader' },
                { text: 'Imp.%',      style: 'tableHeader' },
                { text: 'Total',      style: 'tableHeader' },
                { text: 'Estado',     style: 'tableHeader' },
              ],
              ...rows,
              [
                { text: 'SUBTOTAL', colSpan: 5, bold: true, alignment: 'right', fontSize: 8, fillColor: '#f5f5f5' },
                {}, {}, {}, {},
                { text: currency(subtotalCliente), bold: true, alignment: 'right', fontSize: 8, fillColor: '#f5f5f5' },
                { text: '', fillColor: '#f5f5f5' }
              ]
            ]
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 4]
        });
      }

      // Total general
      content.push({ text: ' ', margin: [0, 6, 0, 0] });
      content.push({
        table: {
          widths: ['*', 'auto'],
          body: [[
            { text: 'TOTAL GENERAL', bold: true, fontSize: 11, alignment: 'right', color: '#1a237e' },
            { text: currency(grandTotal), bold: true, fontSize: 11, alignment: 'right', color: '#1a237e' }
          ]]
        },
        layout: {
          hLineWidth: (i: number) => (i === 0 || i === 1) ? 2 : 0,
          vLineWidth: () => 0,
          hLineColor: () => '#1a237e'
        }
      });

      const docDef: any = {
        pageOrientation: 'portrait',
        pageSize: 'A4',
        pageMargins: [30, 60, 30, 35],
        header: () => ({
          margin: [30, 10, 30, 0],
          table: {
            widths: ['auto', '*', 'auto'],
            body: [[
              logoCell,
              {
                stack: [
                  { text: `Ticket — Pedido #${pedido.numero || pedido.id}`, style: 'headerTitle' },
                  { text: `Fecha: ${fechaStr}   |   Clientes: ${clientesOrdenados.length}   |   Items: ${detalles.length}`, fontSize: 8, color: '#555', alignment: 'center' }
                ]
              },
              { text: new Date().toLocaleDateString('es-MX'), fontSize: 8, color: '#888', alignment: 'right', margin: [0, 6, 0, 0] }
            ]]
          },
          layout: 'noBorders'
        }),
        content,
        styles: {
          headerTitle:  { fontSize: 13, bold: true, color: '#1a237e', alignment: 'center' },
          clienteHeader:{ fontSize: 10, bold: true, color: '#ffffff', fillColor: '#1565c0', margin: [4, 3, 4, 3] },
          info:         { fontSize: 9, color: '#444' },
          tableHeader:  { bold: true, fontSize: 8, fillColor: '#e3f2fd', color: '#1a237e' }
        },
        footer: (currentPage: number, pageCount: number) => ({
          text: `Página ${currentPage} de ${pageCount}`,
          alignment: 'center', fontSize: 8, color: '#999', margin: [0, 8, 0, 0]
        })
      };

      const pdf = pdfMake.createPdf(docDef);
      try { pdf.open(); } catch { pdf.download(`Ticket_${pedido.numero || pedido.id}.pdf`); }

    } catch (error) {
      console.error('Error generando ticket PDF:', error);
      alerts.basicAlert('Error', 'No se pudo generar el ticket', 'error');
    }
  }

  // ─── Modal ticket individual por cliente ─────────────────────────────────

  async openClienteModal(node: any): Promise<void> {
    const pedido = node.data;
    if (!pedido) return;

    // Cargar detalles del pedido para extraer clientes únicos
    let detalles: any[] = [];
    try {
      const response: any = await lastValueFrom(this.pedidosService.getDetallesByPedido(pedido.id));
      detalles = response?.data ? (Array.isArray(response.data) ? response.data : [response.data]) : [];
    } catch { detalles = []; }

    if (detalles.length === 0) {
      alerts.basicAlert('Sin ítems', 'Este pedido no tiene detalles registrados', 'info');
      return;
    }

    const getClienteName = (id: number) => {
      const found = this.clientesList.find((c: any) => c.id == id);
      return found?.nameContact || found?.company || found?.name || String(id || '-');
    };

    const uniqueIds = [...new Set(detalles.map((d: any) => Number(d.idCliente)).filter(id => id > 0))];

    this.clienteModalPedido   = pedido;
    this.clienteModalDetalles = detalles;
    this.clienteModalList     = uniqueIds
      .map(id => ({ id, name: getClienteName(id) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    this.selectedClienteId    = null;
    this.showClienteModal     = true;
  }

  closeClienteModal(): void {
    this.showClienteModal     = false;
    this.selectedClienteId    = null;
    this.clienteModalList     = [];
    this.clienteModalDetalles = [];
    this.clienteModalPedido   = null;
  }

  async printSelectedCliente(): Promise<void> {
    if (this.selectedClienteId === null) {
      alerts.basicAlert('Sin selección', 'Por favor seleccione un cliente', 'warning');
      return;
    }

    // Guardar referencias antes de cerrar el modal
    const pedido   = this.clienteModalPedido;
    const detalles = this.clienteModalDetalles;
    const cliente  = this.clienteModalList.find(c => c.id === this.selectedClienteId)!;

    this.closeClienteModal();
    await this.generateClienteTicketPDF(pedido, cliente, detalles);
  }

  private async generateClienteTicketPDF(
    pedido: any,
    cliente: { id: number; name: string },
    allDetalles: any[]
  ): Promise<void> {
    const items = allDetalles.filter(d =>
      Number(d.idCliente) === cliente.id && d.estado === 'RECIBIDO'
    );
    if (items.length === 0) {
      alerts.basicAlert('Sin ítems', `${cliente.name} no tiene ítems con estado RECIBIDO en este pedido`, 'info');
      return;
    }

    try {
      const pdfMake = (await import('pdfmake/build/pdfmake')).default;
      const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
      (pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

      // Logo
      let logoBase64: string | null = null;
      try {
        const rootData: any = await lastValueFrom(this.rootService.getRootbyId(this.idCompany));
        if (rootData?.picture) {
          logoBase64 = await this.base64EncodeService.convertImageToBase64(rootData.picture);
        }
      } catch { /* sin logo */ }

      const fechaStr = pedido.fecha ? new Date(pedido.fecha).toLocaleDateString('es-MX') : '-';
      const currency = (val: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);

      const totalCliente = items.reduce((sum: number, d: any) => {
        const sub = (d.cantidad || 0) * (d.venta || 0);
        return sum + sub + (d.impuesto || 0);
      }, 0);

      const logoCell = logoBase64
        ? { image: logoBase64, width: 60, alignment: 'left' as const }
        : { text: '', width: 60 };

      const rows: any[] = items.map((d: any) => {
        const sub = (d.cantidad || 0) * (d.venta || 0);
        const total = sub + (d.impuesto || 0);
        return [
          { text: d.producto || '-', fontSize: 8 },
          { text: String(d.cantidad || 0), alignment: 'center', fontSize: 8 },
          { text: d.plataforma || '-', fontSize: 8 },
          { text: currency(d.venta), alignment: 'right', fontSize: 8 },
          { text: (d.impuesto || 0) + '%', alignment: 'center', fontSize: 8 },
          { text: currency(total), alignment: 'right', bold: true, fontSize: 8 },
          { text: d.estado || '-', fontSize: 8 },
        ];
      });

      const content: any[] = [];

      if (pedido.comentario) {
        content.push({ text: `Comentario: ${pedido.comentario}`, fontSize: 9, color: '#444', italics: true, margin: [0, 0, 0, 8] });
      }

      // Encabezado del cliente
      content.push({
        table: {
          widths: ['*', 'auto'],
          body: [[
            { text: cliente.name, fontSize: 11, bold: true, color: '#ffffff', fillColor: '#6a1b9a', margin: [4, 3, 4, 3] },
            { text: currency(totalCliente), fontSize: 11, bold: true, color: '#ffffff', fillColor: '#6a1b9a', alignment: 'right', margin: [4, 3, 4, 3] }
          ]]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 4]
      });

      // Tabla de ítems (sin Costo)
      content.push({
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'Producto',   style: 'tableHeader' },
              { text: 'Cant.',      style: 'tableHeader' },
              { text: 'Plataforma', style: 'tableHeader' },
              { text: 'Venta',      style: 'tableHeader' },
              { text: 'Imp.%',      style: 'tableHeader' },
              { text: 'Total',      style: 'tableHeader' },
              { text: 'Estado',     style: 'tableHeader' },
            ],
            ...rows,
            [
              { text: 'TOTAL', colSpan: 5, bold: true, alignment: 'right', fontSize: 9, fillColor: '#ede7f6' },
              {}, {}, {}, {},
              { text: currency(totalCliente), bold: true, alignment: 'right', fontSize: 9, fillColor: '#ede7f6' },
              { text: '', fillColor: '#ede7f6' }
            ]
          ]
        },
        layout: 'lightHorizontalLines'
      });

      const docDef: any = {
        pageOrientation: 'portrait',
        pageSize: 'A4',
        pageMargins: [30, 60, 30, 35],
        header: () => ({
          margin: [30, 10, 30, 0],
          table: {
            widths: ['auto', '*', 'auto'],
            body: [[
              logoCell,
              {
                stack: [
                  { text: `Ticket — Pedido #${pedido.numero || pedido.id}`, fontSize: 13, bold: true, color: '#6a1b9a', alignment: 'center' },
                  { text: `Cliente: ${cliente.name}   |   Fecha: ${fechaStr}`, fontSize: 8, color: '#555', alignment: 'center' }
                ]
              },
              { text: new Date().toLocaleDateString('es-MX'), fontSize: 8, color: '#888', alignment: 'right', margin: [0, 6, 0, 0] }
            ]]
          },
          layout: 'noBorders'
        }),
        content,
        styles: {
          tableHeader: { bold: true, fontSize: 8, fillColor: '#ede7f6', color: '#4a148c' }
        },
        footer: (currentPage: number, pageCount: number) => ({
          text: `Página ${currentPage} de ${pageCount}`,
          alignment: 'center', fontSize: 8, color: '#999', margin: [0, 8, 0, 0]
        })
      };

      const pdf = pdfMake.createPdf(docDef);
      try { pdf.open(); } catch {
        pdf.download(`Ticket_${pedido.numero || pedido.id}_${cliente.name}.pdf`);
      }

    } catch (error) {
      console.error('Error generando ticket cliente:', error);
      alerts.basicAlert('Error', 'No se pudo generar el ticket', 'error');
    }
  }

  async generateAllPedidosPDF(): Promise<void> {
    if (!this.idCompany) {
      alerts.basicAlert('Sin empresa', 'Seleccione una empresa primero', 'warning');
      return;
    }
    if (!this.allPedidosRowData.length) {
      alerts.basicAlert('Sin pedidos', 'No hay pedidos para generar el reporte', 'info');
      return;
    }

    alerts.showLoading('Generando reporte...', 'Cargando todos los pedidos y sus items');

    try {
      const pdfMake = (await import('pdfmake/build/pdfmake')).default;
      const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
      (pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

      // Logo de la empresa
      let logoBase64: string | null = null;
      try {
        const rootData: any = await lastValueFrom(this.rootService.getRootbyId(this.idCompany));
        if (rootData?.picture) {
          logoBase64 = await this.base64EncodeService.convertImageToBase64(rootData.picture);
        }
      } catch { /* sin logo */ }

      // Cargar todos los detalles de la empresa en una sola llamada
      let todosDetalles: any[] = [];
      try {
        const resp: any = await lastValueFrom(this.pedidosService.getDetallesByCompany(this.idCompany));
        const raw = resp?.data ?? resp ?? [];
        todosDetalles = Array.isArray(raw) ? raw : [raw];
      } catch { todosDetalles = []; }

      // Índice detalles por idPedido
      const detallesPorPedido = new Map<number, any[]>();
      for (const d of todosDetalles) {
        const key = Number(d.idPedido);
        if (!detallesPorPedido.has(key)) detallesPorPedido.set(key, []);
        detallesPorPedido.get(key)!.push(d);
      }

      const currency = (v: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0);

      const clienteName = (idCliente: number) => {
        const c = this.clientesList.find((x: any) => x.id == idCliente);
        return c?.nameContact || c?.company || c?.name || String(idCliente || '-');
      };

      // Ordenar pedidos por fecha ascendente
      const pedidosOrdenados = [...this.allPedidosRowData]
        .filter((p: any) => !p.__isNew)
        .sort(
          (a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime()
        );

      const logoCell = logoBase64
        ? { image: logoBase64, width: 60, alignment: 'left' as const }
        : { text: '', width: 60 };

      let grandTotal = 0;
      const content: any[] = [];

      for (const pedido of pedidosOrdenados) {
        const items = detallesPorPedido.get(Number(pedido.id)) || [];
        const fechaStr = pedido.fecha ? new Date(pedido.fecha).toLocaleDateString('es-MX') : '-';

        const totalPedido = items.reduce((sum: number, d: any) => {
          const sub = (d.cantidad || 0) * (d.venta || 0);
          return sum + sub + (d.impuesto || 0);
        }, 0);
        grandTotal += totalPedido;

        // Encabezado del pedido
        content.push({
          table: {
            widths: ['*'],
            body: [[{
              text: `Pedido: ${pedido.numero || pedido.id}   |   Fecha: ${fechaStr}   |   Items: ${items.length}   |   Total: ${currency(totalPedido)}`,
              style: 'pedidoHeader'
            }]]
          },
          layout: 'noBorders',
          margin: [0, 10, 0, 2]
        });

        if (pedido.comentario) {
          content.push({
            text: `Comentario: ${pedido.comentario}`,
            style: 'comentario',
            margin: [0, 0, 0, 4]
          });
        }

        if (items.length === 0) {
          content.push({
            text: 'Sin items registrados.',
            italics: true,
            color: '#999',
            fontSize: 8,
            margin: [0, 2, 0, 4]
          });
        } else {
          const rows: any[] = items.map((d: any) => {
            const sub = (d.cantidad || 0) * (d.venta || 0);
            const tot = sub + (d.impuesto || 0);
            return [
              { text: clienteName(d.idCliente), fontSize: 7 },
              { text: d.producto || '-', fontSize: 7 },
              { text: String(d.cantidad || 0), alignment: 'center', fontSize: 7 },
              { text: d.plataforma || '-', fontSize: 7 },
              { text: currency(d.costo), alignment: 'right', fontSize: 7 },
              { text: currency(d.venta), alignment: 'right', fontSize: 7 },
              { text: (d.impuesto || 0) + '%', alignment: 'center', fontSize: 7 },
              { text: currency(tot), alignment: 'right', fontSize: 7, bold: true },
              { text: d.estado || '-', fontSize: 7 },
            ];
          });

          content.push({
            table: {
              headerRows: 1,
              widths: ['*', '*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
              body: [
                [
                  { text: 'Cliente',    style: 'tableHeader' },
                  { text: 'Producto',   style: 'tableHeader' },
                  { text: 'Cant.',      style: 'tableHeader' },
                  { text: 'Plataforma', style: 'tableHeader' },
                  { text: 'Costo',      style: 'tableHeader' },
                  { text: 'Venta',      style: 'tableHeader' },
                  { text: 'Imp.%',      style: 'tableHeader' },
                  { text: 'Total',      style: 'tableHeader' },
                  { text: 'Estado',     style: 'tableHeader' },
                ],
                ...rows,
                [
                  { text: 'SUBTOTAL PEDIDO', colSpan: 7, bold: true, alignment: 'right', fontSize: 8, fillColor: '#f5f5f5' },
                  {}, {}, {}, {}, {}, {},
                  { text: currency(totalPedido), bold: true, alignment: 'right', fontSize: 8, fillColor: '#f5f5f5' },
                  { text: '', fillColor: '#f5f5f5' }
                ]
              ]
            },
            layout: 'lightHorizontalLines',
            margin: [0, 0, 0, 4]
          });
        }
      }

      // Total general al final del documento
      content.push({ text: ' ', margin: [0, 8, 0, 0] });
      content.push({
        table: {
          widths: ['*', 'auto'],
          body: [[
            { text: 'TOTAL GENERAL DE TODOS LOS PEDIDOS', bold: true, fontSize: 12, alignment: 'right', color: '#1a237e' },
            { text: currency(grandTotal), bold: true, fontSize: 12, alignment: 'right', color: '#1a237e' }
          ]]
        },
        layout: {
          hLineWidth: (i: number) => (i === 0 || i === 1) ? 2 : 0,
          vLineWidth: () => 0,
          hLineColor: () => '#1a237e'
        },
        margin: [0, 0, 0, 0]
      });

      const docDef: any = {
        pageOrientation: 'landscape',
        pageMargins: [30, 60, 30, 35],
        header: () => ({
          margin: [30, 10, 30, 0],
          table: {
            widths: ['auto', '*', 'auto'],
            body: [[
              logoCell,
              {
                stack: [
                  { text: 'Reporte General de Pedidos', fontSize: 13, bold: true, color: '#1a237e', alignment: 'center' },
                  { text: `Total de pedidos: ${pedidosOrdenados.length}   |   Generado: ${new Date().toLocaleDateString('es-MX')}`, fontSize: 8, color: '#555', alignment: 'center' }
                ]
              },
              { text: '', width: 60 }
            ]]
          },
          layout: 'noBorders'
        }),
        content,
        styles: {
          pedidoHeader:{ fontSize: 10, bold: true, color: '#ffffff', fillColor: '#1a237e', padding: [6, 5, 6, 5] },
          comentario:  { fontSize: 8, color: '#555', italics: true },
          tableHeader: { bold: true, fontSize: 8, fillColor: '#e3f2fd', color: '#1a237e' }
        },
        footer: (currentPage: number, pageCount: number) => ({
          text: `Página ${currentPage} de ${pageCount}`,
          alignment: 'center',
          fontSize: 8,
          color: '#999',
          margin: [0, 10, 0, 0]
        })
      };

      alerts.closeLoading();
      const pdf = pdfMake.createPdf(docDef);
      try {
        pdf.open();
      } catch {
        pdf.download(`Reporte_General_Pedidos.pdf`);
      }

    } catch (error) {
      alerts.closeLoading();
      console.error('Error generando PDF general:', error);
      alerts.basicAlert('Error', 'No se pudo generar el reporte general', 'error');
    }
  }

  private deleteDetalleRow(contextParams: any, doneCallback: () => void, count?: number) {
    const rowId = contextParams.data.id;

    if (contextParams.data.__isNew) {
      if (contextParams.api) {
        contextParams.api.applyTransaction({ remove: [contextParams.data] });
      }
      doneCallback();
    } else {
      alerts.confirmAlert(
        '¿Eliminar detalle?',
        '¿Está seguro que desea eliminar este registro?',
        'warning',
        'Sí, eliminar'
      ).then(async (result) => {
        if (!result.isConfirmed) return;

        try {
          await lastValueFrom(this.pedidosService.deleteDetalle(rowId));
          alerts.basicAlert('Eliminado', 'Detalle eliminado correctamente', 'success');
          if (contextParams.api) {
            contextParams.api.applyTransaction({ remove: [contextParams.data] });
          }
          doneCallback();
        } catch (err) {
          console.error('Error deleting detalle:', err);
          alerts.basicAlert('Error', 'No se pudo eliminar el detalle', 'error');
        }
      });
    }
  }

  // ==================== MODAL CLIENTE GENERAL ====================

  openClienteGeneralModal(): void {
    this.selectedClienteGeneralId = null;
    this.showClienteGeneralModal = true;
  }

  closeClienteGeneralModal(): void {
    this.showClienteGeneralModal = false;
    this.selectedClienteGeneralId = null;
  }

  async generateClienteGeneralTicket(): Promise<void> {
    if (this.selectedClienteGeneralId === null) {
      alerts.basicAlert('Sin selección', 'Por favor seleccione un cliente', 'warning');
      return;
    }

    const cliente = this.clientesList.find(c => c.id === this.selectedClienteGeneralId);
    if (!cliente) return;

    this.closeClienteGeneralModal();
    await this.generateClienteGeneralTicketPDF(cliente);
  }

  private async generateClienteGeneralTicketPDF(cliente: any): Promise<void> {
    try {
      const pdfMake = (await import('pdfmake/build/pdfmake')).default;
      const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
      (pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

      // Logo
      let logoBase64: string | null = null;
      try {
        const rootData: any = await lastValueFrom(this.rootService.getRootbyId(this.idCompany));
        if (rootData?.picture) {
          logoBase64 = await this.base64EncodeService.convertImageToBase64(rootData.picture);
        }
      } catch { /* sin logo */ }

      // Obtener todos los detalles del cliente (RECIBIDO)
      let todosDetalles: any[] = [];
      try {
        const resp: any = await lastValueFrom(this.pedidosService.getDetallesByCompany(this.idCompany));
        const raw = resp?.data ?? resp ?? [];
        todosDetalles = Array.isArray(raw) ? raw : [raw];
      } catch { todosDetalles = []; }

      // Filtrar por cliente y estado RECIBIDO
      const detallesCliente = todosDetalles.filter((d: any) =>
        Number(d.idCliente) === Number(cliente.id) && d.estado === 'RECIBIDO'
      );

      if (detallesCliente.length === 0) {
        alerts.basicAlert('Sin ítems', `${cliente.nameContact || cliente.company} no tiene ítems RECIBIDO`, 'info');
        return;
      }

      // Agrupar por pedido
      const pedidoMap = new Map<number, any[]>();
      for (const d of detallesCliente) {
        const key = Number(d.idPedido);
        if (!pedidoMap.has(key)) pedidoMap.set(key, []);
        pedidoMap.get(key)!.push(d);
      }

      const currency = (val: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);

      const logoCell = logoBase64
        ? { image: logoBase64, width: 60, alignment: 'left' as const }
        : { text: '', width: 60 };

      // Construir contenido
      const content: any[] = [];
      let grandTotal = 0;

      // Agrupar pedidos ordenados
      const pedidosOrdenados = [...pedidoMap.entries()].sort((a, b) => a[0] - b[0]);

      for (const [idPedido, items] of pedidosOrdenados) {
        const pedido = this.allPedidosRowData.find(p => p.id === idPedido);
        const fechaStr = pedido?.fecha ? new Date(pedido.fecha).toLocaleDateString('es-MX') : '-';

        const subtotalPedido = items.reduce((sum: number, d: any) => {
          const sub = (d.cantidad || 0) * (d.venta || 0);
          return sum + sub + (d.impuesto || 0);
        }, 0);
        grandTotal += subtotalPedido;

        // Encabezado del pedido
        content.push({
          table: {
            widths: ['*', 'auto'],
            body: [[
              { text: `Pedido: ${pedido?.numero || idPedido}   Fecha: ${fechaStr}`, style: 'pedidoHeader' },
              { text: currency(subtotalPedido), style: 'pedidoHeader', alignment: 'right' as const }
            ]]
          },
          layout: 'noBorders',
          margin: [0, 10, 0, 2]
        });

        // Tabla de ítems
        const rows: any[] = items.map((d: any) => {
          const sub = (d.cantidad || 0) * (d.venta || 0);
          const total = sub + (d.impuesto || 0);
          return [
            { text: d.producto || '-', fontSize: 8 },
            { text: String(d.cantidad || 0), alignment: 'center', fontSize: 8 },
            { text: d.plataforma || '-', fontSize: 8 },
            { text: currency(d.venta), alignment: 'right', fontSize: 8 },
            { text: (d.impuesto || 0) + '%', alignment: 'center', fontSize: 8 },
            { text: currency(total), alignment: 'right', bold: true, fontSize: 8 }
          ];
        });

        content.push({
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'Producto', style: 'tableHeader' },
                { text: 'Cant.', style: 'tableHeader' },
                { text: 'Plataforma', style: 'tableHeader' },
                { text: 'Venta', style: 'tableHeader' },
                { text: 'Imp.%', style: 'tableHeader' },
                { text: 'Total', style: 'tableHeader' }
              ],
              ...rows,
              [
                { text: 'SUBTOTAL', colSpan: 4, bold: true, alignment: 'right', fontSize: 8, fillColor: '#f5f5f5' },
                {}, {}, {},
                {},
                { text: currency(subtotalPedido), bold: true, alignment: 'right', fontSize: 8, fillColor: '#f5f5f5' }
              ]
            ]
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 4]
        });
      }

      // Total general
      content.push({ text: ' ', margin: [0, 6, 0, 0] });
      content.push({
        table: {
          widths: ['*', 'auto'],
          body: [[
            { text: 'TOTAL GENERAL', bold: true, fontSize: 11, alignment: 'right', color: '#0d47a1' },
            { text: currency(grandTotal), bold: true, fontSize: 11, alignment: 'right', color: '#0d47a1' }
          ]]
        },
        layout: {
          hLineWidth: (i: number) => (i === 0 || i === 1) ? 2 : 0,
          vLineWidth: () => 0,
          hLineColor: () => '#0d47a1'
        }
      });

      const docDef: any = {
        pageOrientation: 'portrait',
        pageSize: 'A4',
        pageMargins: [30, 60, 30, 35],
        header: () => ({
          margin: [30, 10, 30, 0],
          table: {
            widths: ['auto', '*', 'auto'],
            body: [[
              logoCell,
              {
                stack: [
                  { text: `Ticket General — ${cliente.nameContact || cliente.company}`, fontSize: 13, bold: true, color: '#0d47a1', alignment: 'center' },
                  { text: `Total de pedidos: ${pedidosOrdenados.length}`, fontSize: 8, color: '#555', alignment: 'center' }
                ]
              },
              { text: new Date().toLocaleDateString('es-MX'), fontSize: 8, color: '#888', alignment: 'right', margin: [0, 6, 0, 0] }
            ]]
          },
          layout: 'noBorders'
        }),
        content,
        styles: {
          pedidoHeader: { fontSize: 10, bold: true, color: '#ffffff', fillColor: '#0d47a1', margin: [4, 3, 4, 3] },
          tableHeader: { bold: true, fontSize: 8, fillColor: '#e3f2fd', color: '#0d47a1' }
        },
        footer: (currentPage: number, pageCount: number) => ({
          text: `Página ${currentPage} de ${pageCount}`,
          alignment: 'center', fontSize: 8, color: '#999', margin: [0, 8, 0, 0]
        })
      };

      const pdf = pdfMake.createPdf(docDef);
      try { pdf.open(); } catch {
        pdf.download(`Ticket_General_${cliente.nameContact || cliente.company}.pdf`);
      }

    } catch (error) {
      console.error('Error generando ticket general:', error);
      alerts.basicAlert('Error', 'No se pudo generar el ticket', 'error');
    }
  }
}
