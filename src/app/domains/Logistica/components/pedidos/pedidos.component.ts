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
  }

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  idCompany: number = null;
  rowData: any[] = [];
  selectedRowData: any = null;
  hasUnsavedChanges: boolean = false;
  externalFilterActive: boolean = false;
  gridHeight: string = '75vh';
  tempIdCounter: number = 0;
  newlyAddedRows: string[] = [];
  detalleContext: any = null;
  expandedRowId: number | null = null;

  private gridApi: GridApi;
  private _colMaster: ColDef[] = [];
  private clientesList: any[] = [];
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
    detailCellRendererSelector: (params: any) => {
      if (params.data?.detailType === 'clientes') {
        return { component: DetallesClientesComponent };
      }
      return undefined;
    },
    detailRowAutoHeight: true,
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
  };

  public rowSelection: 'single' | 'multiple' = 'single';

  constructor() {
    effect(() => {
      const currentRoot = this.signalsService.getRootSelectedBySidebar()();
      if (currentRoot && currentRoot !== this.idCompany) {
        this.idCompany = currentRoot;
        this.loadData();
      }
    });
  }

  async loadData() {
    if (!this.idCompany) return;

    this.setupDetailParams();

    forkJoin({
      pedidos: this.pedidosService.getPedidosByCompany(this.idCompany),
      detalles: this.pedidosService.getDetallesByCompany(this.idCompany),
      clientes: this.customersService.getCustomersByCompany(this.idCompany, 'CUSTOMERS')
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

        // Calcular clientes únicos por pedido para mostrar en Items
        this.rowData = pedidosList.map((pedido: any) => {
          const detallesDePedido = detallesByPedido.get(pedido.id) || [];
          const uniqueClientIds = [...new Set(detallesDePedido.map((d: any) => d.idCliente).filter(Boolean))];
          const clientesLabel = uniqueClientIds.length;

          return { ...pedido, clientesLabel, detailData: [], visible: true };
        });

        queueMicrotask(() => {
          if (this.gridApi) {
            this.gridApi.setFilterModel(null);
            this.gridApi.onFilterChanged();
          }
        });
      },
      error: (error) => {
        console.error('Error loading pedidos:', error);
        alerts.basicAlert('Error', 'No se pudieron cargar los pedidos', 'error');
      },
    });
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.setupDetailParams();
  }

  private setupDetailParams(): void {
    if (!this.gridApi) return;
    this.gridApi.setGridOption('detailCellRendererParams', {
      getDetailRowData: (params: any) => {
        const detailData = params.data?.detailData || [];
        params.successCallback(detailData);
      },
      context: {
        idCompany: this.idCompany,
        componentParent: this,
        gridApi: this.gridApi,
        pedidosService: this.pedidosService,
        trackingService: this.trackingService,
        customersService: this.customersService,
        materialsService: this.materialsService,
        rootService: this.rootService,
        base64EncodeService: this.base64EncodeService,
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
        width: 90,
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
        width: 70,
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
        field: 'numero',
        headerName: 'Número',
        editable: false,
        flex: 1,
        minWidth: 120,
      },
      {
        field: 'fecha',
        headerName: 'Fecha',
        editable: true,
        flex: 1,
        minWidth: 120,
        valueFormatter: (params) => {
          if (!params.value) return '';
          const date = new Date(params.value);
          return date.toLocaleDateString('es-MX');
        },
      },
      {
        field: 'numArticulos',
        headerName: 'Número Materiales',
        editable: false,
        width: 140,
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
        width: 130,
        valueFormatter: (params) => {
          if (params.value) {
            return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
          }
          return '$0.00';
        },
        cellStyle: { backgroundColor: '#d4edda', fontWeight: 'bold' }
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
        width: 100,
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
    const maxSequence = this.rowData.reduce((max, row) => {
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

    this.rowData = [newPedido, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    setTimeout(() => {
      this.gridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'fecha',
      });
    }, 0);
  }

  async saveChanges() {
    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter((row) => row.__modified && !row.__isNew);

    try {
      for (const row of newRows) {
        const dataToSend = {
          idCompany: row.idCompany,
          numero: row.numero,
          fecha: row.fecha,
          comentario: row.comentario,
          active: row.active,
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
      this.rowData = this.rowData.filter((row) => row.id !== this.selectedRowData.id);
      this.gridApi.setGridOption('rowData', this.rowData);
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
      api.forEachNode((n: any) => {
        if (n.expanded) {
          n.setExpanded(false);
        }
      });
      if (node.data) {
        node.data.detailType = null;
      }
      api.setFilterModel(null);
      api.onFilterChanged();
    } else {
      api.forEachNode((n: any) => {
        if (n.expanded) {
          n.setExpanded(false);
        }
        if (n.data) {
          n.data.detailType = null;
        }
      });

      api.setFilterModel(null);
      api.onFilterChanged();

      const filterModel = this.buildIdEqualsFilterModel(node.data?.id);
      if (filterModel) {
        api.setFilterModel(filterModel);
        api.onFilterChanged();
      }

      if (node.data) {
        node.data.detailType = 'pedidos';
      }

      setTimeout(() => {
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
      api.setFilterModel(null);
      api.onFilterChanged();
    } else {
      api.forEachNode((n: any) => { if (n.expanded) n.setExpanded(false); if (n.data) n.data.detailType = null; });
      api.setFilterModel(null);
      api.onFilterChanged();

      const filterModel = this.buildIdEqualsFilterModel(node.data?.id);
      if (filterModel) { api.setFilterModel(filterModel); api.onFilterChanged(); }

      if (node.data) node.data.detailType = 'pdf';
      setTimeout(() => node.setExpanded(true), 0);
    }
  }

  toggleDetalleClientes(node: any) {
    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data?.detailType === 'clientes';

    if (isCurrentlyExpanded) {
      api.forEachNode((n: any) => {
        if (n.expanded) n.setExpanded(false);
      });
      if (node.data) node.data.detailType = null;
      api.setFilterModel(null);
      api.onFilterChanged();
    } else {
      api.forEachNode((n: any) => {
        if (n.expanded) n.setExpanded(false);
        if (n.data) n.data.detailType = null;
      });
      api.setFilterModel(null);
      api.onFilterChanged();

      const filterModel = this.buildIdEqualsFilterModel(node.data?.id);
      if (filterModel) {
        api.setFilterModel(filterModel);
        api.onFilterChanged();
      }

      if (node.data) node.data.detailType = 'clientes';
      setTimeout(() => node.setExpanded(true), 0);
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
          clienteName: this.clientesList.find((c: any) => c.id == d.idCliente)?.name || d.idCliente || '-'
        }));
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
        
        const newRows = detallesData.filter((row: any) => row.__isNew);
        const modifiedRows = detallesData.filter((row: any) => row.__modified && !row.__isNew);

        for (const row of newRows) {
          const dataToSend = {
            idPedido: idPedido,
            idCliente: row.idCliente,
            producto: row.producto,
            cantidad: row.cantidad || 1,
            plataforma: row.plataforma,
            aplicaimpuestos: row.aplicaimpuestos,
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
            aplicaimpuestos: row.aplicaimpuestos,
            costo: row.costo || 0,
            venta: row.venta || 0,
            impuesto: row.impuesto || 0,
            estado: row.estado || 'SOLICITADO',
            comentario: row.comentario,
            active: row.active,
          };
          await lastValueFrom(this.pedidosService.updateDetalle(row.id, dataToSend));
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

      // Cargar detalles del pedido
      let detalles: any[] = [];
      try {
        const response: any = await lastValueFrom(this.pedidosService.getDetallesByPedido(pedido.id));
        detalles = response?.data ? (Array.isArray(response.data) ? response.data : [response.data]) : [];
      } catch { detalles = []; }

      const getClienteName = (idCliente: number) => {
        const found = this.clientesList.find((c: any) => c.id == idCliente);
        return found ? found.name : (idCliente || '-');
      };

      const fechaStr = pedido.fecha
        ? new Date(pedido.fecha).toLocaleDateString('es-MX')
        : '-';

      const currency = (val: number) =>
        val ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val) : '$0.00';

      const totalPedido = detalles.reduce((sum: number, d: any) => {
        const subtotal = (d.cantidad || 0) * (d.venta || 0);
        return sum + subtotal + subtotal * ((d.impuesto || 0) / 100);
      }, 0);

      const tableBody: any[] = [
        [
          { text: 'Cliente', style: 'tableHeader' },
          { text: 'Producto', style: 'tableHeader' },
          { text: 'Cant.', style: 'tableHeader' },
          { text: 'Plataforma', style: 'tableHeader' },
          { text: 'Costo', style: 'tableHeader' },
          { text: 'Venta', style: 'tableHeader' },
          { text: 'Imp.%', style: 'tableHeader' },
          { text: 'Total', style: 'tableHeader' },
          { text: 'Estado', style: 'tableHeader' },
        ],
        ...detalles.map((d: any) => {
          const sub = (d.cantidad || 0) * (d.venta || 0);
          const total = sub + sub * ((d.impuesto || 0) / 100);
          return [
            { text: getClienteName(d.idCliente), fontSize: 8 },
            { text: d.producto || '-', fontSize: 8 },
            { text: d.cantidad || 0, alignment: 'center', fontSize: 8 },
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
        pageMargins: [30, 40, 30, 40],
        content: [
          { text: `Pedido #${pedido.numero || pedido.id}`, style: 'title' },
          { text: ' ' },
          {
            columns: [
              { text: `Fecha: ${fechaStr}`, style: 'info' },
              { text: `Número de artículos: ${detalles.length}`, style: 'info' },
              { text: `Total: ${currency(totalPedido)}`, style: 'info', bold: true },
            ]
          },
          pedido.comentario ? { text: `Comentario: ${pedido.comentario}`, style: 'info', margin: [0, 4, 0, 0] } : {},
          { text: ' ' },
          { text: 'Detalles del Pedido', style: 'sectionTitle' },
          { text: ' ' },
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
          title: { fontSize: 16, bold: true, color: '#1a237e' },
          sectionTitle: { fontSize: 11, bold: true, color: '#333' },
          info: { fontSize: 9, color: '#444' },
          tableHeader: { bold: true, fontSize: 9, fillColor: '#e3f2fd', color: '#1a237e' }
        }
      };

      const pdf = pdfMake.createPdf(docDefinition);
      try {
        pdf.open();
      } catch {
        pdf.download(`Pedido_${pedido.numero || pedido.id}.pdf`);
      }

    } catch (error) {
      console.error('Error generando PDF del pedido:', error);
      alerts.basicAlert('Error', 'No se pudo generar el PDF del pedido', 'error');
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
}
