import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { forkJoin, lastValueFrom } from 'rxjs';

import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { CustomersService } from 'app/services/customers.service';
import { RemisionesService } from 'app/services/remisiones.service';
import { RootService } from 'app/services/root.service';
import { SignalsService } from 'app/services/signals.service';
import { NumArticulosRendererComponent } from '../pedidos/pedidos-button-num-articulos.component';
import { DetallesRemisionesComponent } from './detalles-remisiones.component';

@Component({
  selector: 'app-remisiones-logistica',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, NumArticulosRendererComponent, DetallesRemisionesComponent],
  templateUrl: './remisiones.component.html',
  styleUrl: './remisiones.component.scss',
})
export class RemisionesComponent {
  private signalsService = inject(SignalsService);
  private remisionesService = inject(RemisionesService);
  private customersService = inject(CustomersService);
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  idCompany = 0;
  idBranch = 0;
  activeFilter: string | null = 'ABIERTA';
  rowData: any[] = [];
  selectedRowData: any = null;
  expandedRowId: number | null = null;
  focusedRemisionId: number | null = null;
  private preFocusRowData: any[] = [];

  private allRowData: any[] = [];
  private gridApi?: GridApi;
  private pdfMakeModule: any | null = null;
  private logoBase64Cache: string | null | undefined = undefined;

  ngOnInit(): void {
    (window as any).remisionesComponent = this;
  }

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
    context: { componentParent: this },
    getRowId: (params: any) => String(params.data?.id ?? ''),
    masterDetail: true,
    detailCellRenderer: DetallesRemisionesComponent,
    detailRowHeight: 620,
    isRowMaster: () => true,
    onRowExpanded: (event: any) => {
      this.expandedRowId = event.node.data?.id || null;
    },
    onRowCollapsed: (event: any) => {
      if (event.node.data?.id === this.expandedRowId) {
        this.expandedRowId = null;
      }
      if (event.node.data?.id === this.focusedRemisionId) {
        this.exitFocusedView();
      }
    },
  };

  public colDefs: ColDef[] = [
    {
      colId: 'acciones',
      headerName: 'Acciones',
      minWidth: 140,
      width: 150,
      pinned: 'left',
      lockPinned: true,
      suppressMovable: true,
      sortable: false,
      filter: false,
      editable: false,
      cellRenderer: (params: any) => {
        const isAbierta = String(params.data?.estado || '').toUpperCase() === 'ABIERTA';
        return `
          <div class="d-flex gap-1 justify-content-center">
            ${isAbierta ? '<button class="btn btn-sm btn-warning" data-action="close">Cerrar</button>' : '<span class="text-muted ms-1">Cerrada</span>'}
          </div>
        `;
      },
      onCellClicked: (params: any) => {
        const action = (params.event?.target as HTMLElement | null)?.getAttribute('data-action');
        if (action === 'close' && String(params.data?.estado || '').toUpperCase() === 'ABIERTA') {
          this.closeRemision(params.data);
        }
      },
      cellStyle: { textAlign: 'center' },
    },
    {
      colId: 'verArticulos',
      field: 'numArticulos',
      headerName: 'Ver',
      minWidth: 110,
      width: 110,
      maxWidth: 110,
      resizable: false,
      pinned: 'left',
      lockPinned: true,
      suppressMovable: true,
      editable: false,
      cellRenderer: NumArticulosRendererComponent,
      cellRendererParams: {
        onClick: (node: any) => {
          this.toggleDetalle(node);
        }
      },
      cellStyle: { backgroundColor: '#e3f2fd' }
    },
    {
      colId: 'ticket',
      headerName: 'Ticket',
      minWidth: 90,
      width: 90,
      maxWidth: 100,
      sortable: false,
      filter: false,
      editable: false,
      cellRenderer: () => `
        <div class="d-flex justify-content-center align-items-center h-100">
          <i class="bi bi-file-earmark-pdf-fill text-danger" data-action="print" title="Imprimir ticket de remision" style="font-size:1.2rem; cursor:pointer;"></i>
        </div>
      `,
      onCellClicked: (params: any) => {
        const action = (params.event?.target as HTMLElement | null)?.getAttribute('data-action');
        if (action === 'print') {
          this.toggleDetallePdf(params.node);
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
      headerName: 'Creacion',
      minWidth: 170,
      valueFormatter: (params) => this.formatDateTime(params.value),
    },

    
    {
      field: 'fechaCierre',
      headerName: 'Cierre',
      minWidth: 170,
      valueFormatter: (params) => this.formatDateTime(params.value),
    },

    { field: 'diasTranscurridos', headerName: 'Dias', width: 90, type: 'numericColumn' },

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
        const companyChanged = currentRoot !== this.idCompany;
        this.idCompany = currentRoot;
        this.idBranch = currentBranch;
        if (companyChanged) {
          this.logoBase64Cache = undefined;
        }
        this.loadData();
      }
    });
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    this.gridApi.setGridOption('context', { componentParent: this });
    // Fuerza orden y visibilidad (evita que estado previo del usuario o cache oculte "Ver").
    this.gridApi.applyColumnState({
      state: [
        { colId: 'acciones', hide: false },
        { colId: 'verArticulos', hide: false, width: 110 },
        { colId: 'ticket', hide: false },
      ],
      applyOrder: true
    });
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
            numArticulos: Number(item?.totalRenglones || 0),
            detailData: [],
            detailType: 'detalle',
            detailPdfUrl: null,
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
      this.gridApi.applyColumnState({
        state: [
          { colId: 'acciones', hide: false },
          { colId: 'verArticulos', hide: false, width: 110 },
          { colId: 'ticket', hide: false },
        ],
        applyOrder: true
      });
    }
  }

  private enterFocusedView(idRemision: number): void {
    if (!idRemision || !this.gridApi) return;
    if (this.focusedRemisionId === idRemision) return;

    this.preFocusRowData = [...this.rowData];
    this.focusedRemisionId = idRemision;
    const focused = this.preFocusRowData.find((x: any) => Number(x.id) === Number(idRemision));
    this.rowData = focused ? [focused] : [];
    this.gridApi.setGridOption('rowData', this.rowData);
  }

  private exitFocusedView(): void {
    if (!this.gridApi) return;
    this.focusedRemisionId = null;
    this.preFocusRowData = [];
    this.applyFilter();
  }

  async closeRemision(remision: any): Promise<void> {
    const commentResult = await alerts.inputAlert(
      'Cerrar remision',
      `Folio ${remision.folio}. Puedes capturar un comentario opcional de cierre.`,
      'textarea',
      remision.comentario || '',
      {
        required: false,
        confirmButtonText: 'Cerrar remision',
      }
    );

    if (!commentResult.isConfirmed) return;

    alerts.showLoading('Cerrando remision...', 'Actualizando estado y detalles relacionados.');
    try {
      await lastValueFrom(
        this.remisionesService.closeRemision(remision.id, {
          closedBy: localStorage.getItem('mail') || '',
          comentario: String(commentResult.value ?? '').trim(),
        })
      );

      alerts.closeLoading();
      alerts.toastAlert('Remision cerrada correctamente', 'success');
      this.loadData();
    } catch (error) {
      alerts.closeLoading();
      console.error('Error cerrando remision:', error);
      alerts.basicAlert('Error', 'No se pudo cerrar la remision', 'error');
    }
  }

  async toggleDetalle(node: any): Promise<void> {
    if (!node?.data) return;
    this.selectedRowData = node.data;

    if (node.expanded) {
      node.setExpanded(false);
      this.exitFocusedView();
      return;
    }

    this.enterFocusedView(node.data.id);
    const focusedNode = this.gridApi?.getRowNode(String(node.data.id)) || node;

    node.data.detailType = 'detalle';
    if (!Array.isArray(focusedNode.data.detailData) || focusedNode.data.detailData.length === 0) {
      focusedNode.data.detailData = await this.getRemisionDetalleRows(focusedNode.data.id);
    }

    this.gridApi?.redrawRows({ rowNodes: [focusedNode] });
    focusedNode.setExpanded(true);
  }

  async toggleDetallePdf(node: any): Promise<void> {
    if (!node?.data?.id) return;
    this.selectedRowData = node.data;
    this.enterFocusedView(node.data.id);
    const focusedNode = this.gridApi?.getRowNode(String(node.data.id)) || node;

    focusedNode.data.detailType = 'pdf';
    focusedNode.data.detailPdfLoading = true;
    this.syncDetailNode(focusedNode, true);

    if (focusedNode.data.detailPdfUrl) {
      focusedNode.data.detailPdfLoading = false;
      this.syncDetailNode(focusedNode, true);
      return;
    }

    const currentRows = Array.isArray(focusedNode.data.detailData) ? focusedNode.data.detailData : [];
    const pdfUrl = await this.generateRemisionPdfUrl(focusedNode.data, currentRows.length > 0 ? currentRows : undefined);
    focusedNode.data.detailPdfLoading = false;
    if (pdfUrl) {
      focusedNode.data.detailPdfUrl = pdfUrl;
    }
    this.syncDetailNode(focusedNode, true);
  }

  async toggleDetallePdfById(idRemision: number): Promise<void> {
    if (!idRemision || !this.gridApi) return;
    const node = this.gridApi.getRowNode(String(idRemision));
    if (!node) return;
    await this.toggleDetallePdf(node);
  }

  closeDetallePdfById(idRemision: number): void {
    if (!idRemision || !this.gridApi) return;
    const node = this.gridApi.getRowNode(String(idRemision));
    if (!node?.data) return;
    node.data.detailType = 'detalle';
    node.data.detailPdfLoading = false;
    this.syncDetailNode(node, true);
  }

  closeFocusedDetalleById(idRemision: number): void {
    if (!this.gridApi) return;
    const targetId = idRemision || this.focusedRemisionId || this.expandedRowId;
    if (!targetId) return;
    const node = this.gridApi.getRowNode(String(targetId));
    if (node) {
      node.setExpanded(false);
    }
    this.exitFocusedView();
  }

  async updateDetalleCantidadById(idRemision: number, row: any, nuevaCantidadRemitida: number): Promise<void> {
    if (!idRemision || !row) return;
    const idRemisionDetalle = this.getRemisionDetalleId(row);
    if (idRemisionDetalle <= 0) {
      alerts.basicAlert('Error', 'No se pudo identificar el detalle de remisión a modificar.', 'error');
      return;
    }

    const cantidadOriginal = Number(row?.cantidad ?? 0);
    const cantidadNueva = Number(nuevaCantidadRemitida ?? 0);
    if (!Number.isFinite(cantidadNueva) || cantidadNueva <= 0) {
      alerts.basicAlert('Cantidad inválida', 'La cantidad remitida debe ser mayor a 0.', 'warning');
      return;
    }
    if (cantidadOriginal > 0 && cantidadNueva > cantidadOriginal) {
      alerts.basicAlert('Cantidad inválida', `La cantidad remitida no puede ser mayor a ${cantidadOriginal}.`, 'warning');
      return;
    }

    const confirmUpdate = await alerts.confirmAlert(
      '¿Estas seguro?',
      `Se actualizará la cantidad remitida a ${cantidadNueva}.`,
      'question',
      'Sí, actualizar'
    );
    if (!confirmUpdate.isConfirmed) return;

    const payload = {
      idRemision,
      IdRemision: idRemision,
      idRemisionDetalle,
      IdRemisionDetalle: idRemisionDetalle,
      idDetallePedido: Number(row?.idDetallePedido ?? row?.IdDetallePedido ?? 0),
      IdDetallePedido: Number(row?.idDetallePedido ?? row?.IdDetallePedido ?? 0),
      cantidadRemitida: cantidadNueva,
      CantidadRemitida: cantidadNueva,
      updatedBy: localStorage.getItem('mail') || 'WEB',
      UpdatedBy: localStorage.getItem('mail') || 'WEB',
    };

    try {
      alerts.showLoading('Actualizando remisión...', 'Ajustando cantidades en pedido y remisión.');
      await lastValueFrom(this.remisionesService.updateDetalle(idRemisionDetalle, payload));
      alerts.closeLoading();
      alerts.toastAlert('Cantidad modificada. Regresó ajuste al pedido.', 'success');
      await this.reloadFocusedDetalle(idRemision);
    } catch (error: any) {
      alerts.closeLoading();
      const backendMessage =
        error?.error?.message ||
        error?.error?.title ||
        error?.message ||
        'No se pudo actualizar el detalle de remisión.';
      alerts.basicAlert('Error', backendMessage, 'error');
    }
  }

  async deleteDetalleById(idRemision: number, row: any): Promise<void> {
    if (!idRemision || !row) return;
    const idRemisionDetalle = this.getRemisionDetalleId(row);
    if (idRemisionDetalle <= 0) {
      alerts.basicAlert('Error', 'No se pudo identificar el detalle de remisión a eliminar.', 'error');
      return;
    }

    const payload = {
      idRemision,
      IdRemision: idRemision,
      idRemisionDetalle,
      IdRemisionDetalle: idRemisionDetalle,
      idDetallePedido: Number(row?.idDetallePedido ?? row?.IdDetallePedido ?? 0),
      IdDetallePedido: Number(row?.idDetallePedido ?? row?.IdDetallePedido ?? 0),
      deletedBy: localStorage.getItem('mail') || 'WEB',
      DeletedBy: localStorage.getItem('mail') || 'WEB',
    };

    const confirmDelete = await alerts.confirmAlert(
      '¿Estas seguro?',
      'Se eliminará este detalle de la remisión y la cantidad regresará al pedido como SOLICITADO.',
      'warning',
      'Sí, eliminar'
    );
    if (!confirmDelete.isConfirmed) return;

    try {
      alerts.showLoading('Eliminando detalle...', 'Regresando cantidad al pedido.');
      await lastValueFrom(this.remisionesService.deleteDetalle(idRemisionDetalle, payload));
      alerts.closeLoading();
      alerts.toastAlert('Detalle eliminado. Regresó al pedido.', 'success');
      await this.reloadFocusedDetalle(idRemision);
    } catch (error: any) {
      alerts.closeLoading();
      const backendMessage =
        error?.error?.message ||
        error?.error?.title ||
        error?.message ||
        'No se pudo eliminar el detalle de remisión.';
      alerts.basicAlert('Error', backendMessage, 'error');
    }
  }

  private getRemisionDetalleId(row: any): number {
    return Number(
      row?.id ??
      row?.Id ??
      row?.idRemisionDetalle ??
      row?.IdRemisionDetalle ??
      row?.idDetalleRemision ??
      row?.IdDetalleRemision ??
      0
    );
  }

  private async reloadFocusedDetalle(idRemision: number): Promise<void> {
    if (!this.gridApi) return;
    const node = this.gridApi.getRowNode(String(idRemision));
    if (!node?.data) return;

    const detailRows = await this.getRemisionDetalleRows(idRemision);
    node.data.detailData = detailRows;
    node.data.numArticulos = detailRows.length;
    node.data.totalCantidadRemitida = (detailRows || []).reduce((acc: number, row: any) => acc + (Number(row?.cantidadRemitida) || 0), 0);
    node.data.totalImporte = (detailRows || []).reduce((acc: number, row: any) => {
      const subtotal = (Number(row?.cantidadRemitida) || 0) * (Number(row?.venta) || 0);
      return acc + subtotal + (Number(row?.impuesto) || 0);
    }, 0);
    node.data.detailPdfUrl = null;
    node.data.detailPdfLoading = false;
    node.data.detailType = 'detalle';

    const idxAll = this.allRowData.findIndex((x: any) => Number(x?.id) === Number(idRemision));
    if (idxAll >= 0) {
      this.allRowData[idxAll] = { ...this.allRowData[idxAll], ...node.data };
    }

    this.syncDetailNode(node, true);
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

  async printRemisionTicket(remision: any): Promise<void> {
    if (!remision?.id) return;

    try {
      alerts.showLoading('Generando ticket...', 'Preparando PDF de la remision.');
      const detalleRows = await this.getRemisionDetalleRows(remision.id);
      await this.buildTicketPdf(remision, detalleRows, undefined, 'open');
      alerts.closeLoading();
    } catch (error) {
      alerts.closeLoading();
      console.error('Error generando ticket de remision:', error);
      alerts.basicAlert('Error', 'No se pudo generar el ticket de la remision', 'error');
    }
  }

  async printPedidoTicketFromCascade(remision: any, row: any, providedRows?: any[]): Promise<void> {
    if (!remision?.id || !row?.idPedido) return;

    try {
      const detalleRows = Array.isArray(providedRows) && providedRows.length > 0
        ? providedRows
        : await this.getRemisionDetalleRows(remision.id);
      const pedidoRows = (detalleRows || []).filter((x: any) => Number(x.idPedido) === Number(row.idPedido));
      const pdfUrl = await this.buildTicketPdf(remision, pedidoRows, Number(row.idPedido), 'blob');
      if (!pdfUrl || !this.gridApi) return;

      const node = this.gridApi.getRowNode(String(remision.id));
      if (!node?.data) return;

      node.data.detailPdfUrl = pdfUrl;
      node.data.detailType = 'pdf';
      node.data.detailPdfLoading = false;
      this.syncDetailNode(node, true);
    } catch (error) {
      console.error('Error generando ticket del pedido en remision:', error);
      alerts.basicAlert('Error', 'No se pudo generar el ticket del pedido', 'error');
    }
  }

  private async getRemisionDetalleRows(idRemision: number): Promise<any[]> {
    const response: any = await lastValueFrom(this.remisionesService.getDetalle(idRemision));
    const payload = response?.data || response?.Data || {};
    const detalleRows = payload?.detalles || payload?.Detalles || [];
    return (detalleRows || []).map((row: any) => ({
      ...row,
      totalLinea: (Number(row.cantidadRemitida) || 0) * (Number(row.venta) || 0) + (Number(row.impuesto) || 0),
    }));
  }

  private async getCompanyLogoBase64(): Promise<string | null> {
    if (this.logoBase64Cache !== undefined) {
      return this.logoBase64Cache;
    }

    try {
      const rootData: any = await lastValueFrom(this.rootService.getRootbyId(this.idCompany));
      if (!rootData?.picture) {
        this.logoBase64Cache = null;
        return null;
      }
      this.logoBase64Cache = await this.base64EncodeService.convertImageToBase64(rootData.picture);
      return this.logoBase64Cache;
    } catch {
      this.logoBase64Cache = null;
      return null;
    }
  }

  private async getPdfMakeLib(): Promise<any> {
    if (this.pdfMakeModule) {
      return this.pdfMakeModule;
    }

    const pdfMake = (await import('pdfmake/build/pdfmake')).default;
    const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
    (pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;
    this.pdfMakeModule = pdfMake;
    return pdfMake;
  }

  private syncDetailNode(node: any, keepExpanded = false): void {
    if (!this.gridApi || !node?.data) return;

    node.setData({ ...node.data });
    this.gridApi.refreshCells({ rowNodes: [node], force: true });
    this.gridApi.redrawRows({ rowNodes: [node] });
    if (keepExpanded && !node.expanded) {
      node.setExpanded(true);
    }
  }

  private async buildTicketPdf(
    remision: any,
    detalleRows: any[],
    pedidoId?: number,
    mode: 'open' | 'blob' = 'open'
  ): Promise<string | void> {
    const pdfMake = await this.getPdfMakeLib();

    const rows = Array.isArray(detalleRows) ? detalleRows : [];
    const clienteNombre =
      remision?.clienteName ||
      this.allRowData.find((r: any) => Number(r?.id) === Number(remision?.id))?.clienteName ||
      `Cliente ${remision?.idCliente ?? '-'}`;
    const logoBase64 = await this.getCompanyLogoBase64();
    const logoCell = logoBase64
      ? { image: logoBase64, width: 60, alignment: 'left' as const }
      : { text: '', width: 60 };

    const total = rows.reduce((acc: number, row: any) => {
      const subtotal = (Number(row.cantidadRemitida) || 0) * (Number(row.venta) || 0);
      return acc + subtotal + (Number(row.impuesto) || 0);
    }, 0);

    const docDefinition: any = {
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
                { text: pedidoId ? `Ticket Pedido #${pedidoId}` : `Ticket Remision ${remision?.folio || ''}`, style: 'headerTitle' },
                {
                  text: `Estado: ${remision?.estado || '-'}   |   Renglones: ${rows.length}`,
                  fontSize: 8,
                  color: '#555',
                  alignment: 'center',
                },
              ],
            },
            { text: new Date().toLocaleDateString('es-MX'), fontSize: 8, color: '#888', alignment: 'right', margin: [0, 6, 0, 0] },
          ]],
        },
        layout: 'noBorders',
      }),
      content: [
        {
          text: 'Maestro',
          style: 'sectionTitle',
          margin: [0, 0, 0, 6],
        },
        {
          table: {
            widths: ['*', '*', '*', '*'],
            body: [
              [
                { text: `Folio: ${remision?.folio || '-'}`, fontSize: 9 },
                { text: `Cliente: ${clienteNombre}`, fontSize: 9 },
                { text: `Estado: ${remision?.estado || '-'}`, fontSize: 9 },
                { text: '', fontSize: 9 },
              ],
              [
                { text: `Creacion: ${this.formatDateTime(remision?.fechaCreacion) || '-'}`, fontSize: 9 },
                { text: `Cierre: ${this.formatDateTime(remision?.fechaCierre) || '-'}`, fontSize: 9 },
                { text: `Creada por: ${remision?.createdBy || '-'}`, fontSize: 9 },
                { text: `Cerrada por: ${remision?.closedBy || '-'}`, fontSize: 9 },
              ],
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 10],
        },
        { text: 'Detalle', style: 'sectionTitle', margin: [0, 0, 0, 6] },
        {
          table: {
            headerRows: 1,
            widths: [40, '*', 36, 34, 66, 66, 72],
            body: [
              [
                { text: 'Pedido', style: 'tableHeader' },
                { text: 'Producto', style: 'tableHeader' },
                { text: 'Solicitado', style: 'tableHeader', alignment: 'center' },
                { text: 'Remit.', style: 'tableHeader', alignment: 'center' },
                { text: 'Venta', style: 'tableHeader', alignment: 'right' },
                { text: 'Impuesto', style: 'tableHeader', alignment: 'right' },
                { text: 'Total', style: 'tableHeader', alignment: 'right' },
              ],
              ...rows.map((row: any) => [
                { text: this.getPedidoNumber(row), fontSize: 8 },
                { text: String(row.producto || '-'), fontSize: 8 },
                { text: this.formatNumber(row.cantidad), alignment: 'center', fontSize: 8, noWrap: true },
                { text: this.formatNumber(row.cantidadRemitida), alignment: 'center', fontSize: 8, noWrap: true },
                { text: this.formatCurrency(row.venta), alignment: 'right', fontSize: 7, noWrap: true },
                { text: this.formatCurrency(row.impuesto), alignment: 'right', fontSize: 7, noWrap: true },
                { text: this.formatCurrency(row.totalLinea), alignment: 'right', bold: true, fontSize: 7, noWrap: true },
              ]),
            ],
          },
          layout: {
            hLineColor: () => '#d6dce5',
            vLineColor: () => '#d6dce5',
            paddingLeft: () => 2,
            paddingRight: () => 2,
            paddingTop: () => 1,
            paddingBottom: () => 1,
          },
        },
        {
          margin: [0, 10, 0, 0],
          table: {
            widths: ['*', 120],
            body: [[
              { text: 'TOTAL', alignment: 'right', bold: true, fontSize: 11 },
              { text: this.formatCurrency(total), alignment: 'right', bold: true, fontSize: 11 },
            ]],
          },
          layout: 'noBorders',
        },
      ],
      styles: {
        headerTitle: { fontSize: 13, bold: true, color: '#1a237e', alignment: 'center' },
        sectionTitle: { fontSize: 10, bold: true, color: '#1565c0' },
        tableHeader: { bold: true, fontSize: 8, fillColor: '#e3f2fd', color: '#1a237e' },
      },
      footer: (currentPage: number, pageCount: number) => ({
        text: `Pagina ${currentPage} de ${pageCount}`,
        alignment: 'center',
        fontSize: 8,
        color: '#999',
        margin: [0, 8, 0, 0],
      }),
    };

    const fileName = pedidoId
      ? `Ticket_Pedido_${pedidoId}_Remision_${remision?.folio || remision?.id || 'NA'}.pdf`
      : `Ticket_Remision_${remision?.folio || remision?.id || 'NA'}.pdf`;

    const pdf = pdfMake.createPdf(docDefinition);
    if (mode === 'blob') {
      return await new Promise<string>((resolve) => {
        pdf.getBlob((blob: Blob) => {
          resolve(URL.createObjectURL(blob));
        });
      });
    }

    try {
      pdf.open();
    } catch {
      pdf.download(fileName);
    }
  }

  async generateRemisionPdfUrl(remision: any, providedRows?: any[]): Promise<string | null> {
    if (!remision?.id) return null;
    try {
      const detalleRows = Array.isArray(providedRows) && providedRows.length > 0
        ? providedRows
        : await this.getRemisionDetalleRows(remision.id);
      const url = await this.buildTicketPdf(remision, detalleRows, undefined, 'blob');
      return typeof url === 'string' ? url : null;
    } catch {
      return null;
    }
  }

  getPedidoNumber(row: any): string {
    const candidates = [
      row?.numeroPedido,
      row?.NumeroPedido,
      row?.numero,
      row?.Numero,
      row?.pedido,
      row?.Pedido,
      row?.folioPedido,
      row?.FolioPedido,
      row?.idPedido,
      row?.IdPedido
    ];

    for (const value of candidates) {
      if (value === null || value === undefined) continue;
      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
      }

      const text = String(value).trim();
      if (!text) continue;
      return text;
    }

    return '-';
  }
}
