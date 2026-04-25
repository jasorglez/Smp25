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
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  idCompany = 0;
  idBranch = 0;
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
    {
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
          this.printRemisionTicket(params.data);
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
      if (this.selectedRemision?.id === remision.id) {
        this.closeDetalleModal();
      }
      this.loadData();
    } catch (error) {
      alerts.closeLoading();
      console.error('Error cerrando remision:', error);
      alerts.basicAlert('Error', 'No se pudo cerrar la remision', 'error');
    }
  }

  async openDetalleModal(remision: any): Promise<void> {
    alerts.showLoading('Cargando detalle...', 'Consultando los renglones de la remision.');
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
      console.error('Error cargando detalle de remision:', error);
      alerts.basicAlert('Error', 'No se pudo cargar el detalle de la remision', 'error');
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

  async printRemisionTicket(remision: any): Promise<void> {
    if (!remision?.id) return;

    try {
      alerts.showLoading('Generando ticket...', 'Preparando PDF de la remision.');
      const detalleRows = await this.getRemisionDetalleRows(remision.id);
      await this.buildTicketPdf(remision, detalleRows);
      alerts.closeLoading();
    } catch (error) {
      alerts.closeLoading();
      console.error('Error generando ticket de remision:', error);
      alerts.basicAlert('Error', 'No se pudo generar el ticket de la remision', 'error');
    }
  }

  async printPedidoTicketFromDetalle(row: any): Promise<void> {
    const remision = this.selectedRemision;
    if (!remision?.id || !row?.idPedido) return;

    try {
      alerts.showLoading('Generando ticket...', 'Preparando PDF del pedido.');
      const detalleRows = this.selectedDetalleRows?.length
        ? this.selectedDetalleRows
        : await this.getRemisionDetalleRows(remision.id);

      const pedidoRows = (detalleRows || []).filter((x: any) => Number(x.idPedido) === Number(row.idPedido));
      await this.buildTicketPdf(remision, pedidoRows, Number(row.idPedido));
      alerts.closeLoading();
    } catch (error) {
      alerts.closeLoading();
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
    try {
      const rootData: any = await lastValueFrom(this.rootService.getRootbyId(this.idCompany));
      if (!rootData?.picture) return null;
      return await this.base64EncodeService.convertImageToBase64(rootData.picture);
    } catch {
      return null;
    }
  }

  private async buildTicketPdf(remision: any, detalleRows: any[], pedidoId?: number): Promise<void> {
    const pdfMake = (await import('pdfmake/build/pdfmake')).default;
    const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
    (pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

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
    try {
      pdf.open();
    } catch {
      pdf.download(fileName);
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
