import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { SignalsService } from 'app/services/signals.service';
import { PedidosService } from 'app/services/pedidos.service';
import { CustomersService } from 'app/services/customers.service';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { TrackingService } from 'app/services/tracking.service';
import { forkJoin, lastValueFrom } from 'rxjs';
import { alerts } from 'app/helpers/alerts';
import { DetallesEntregadosClienteComponent } from './detalles-entregados-cliente.component';
import { PdfButtonCellRendererComponent } from 'app/domains/ModAdmon/components/egresos-palacio/pdf-button-cell-renderer.component';
import { NumArticulosRendererComponent } from '../pedidos/pedidos-button-num-articulos.component';

@Component({
  selector: 'app-pedidos-entregados',
  standalone: true,
  imports: [CommonModule, RouterModule, AgGridModule, DetallesEntregadosClienteComponent, PdfButtonCellRendererComponent, NumArticulosRendererComponent],
  templateUrl: './pedidos-entregados.component.html',
})
export class PedidosEntregadosComponent {
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  private readonly ESTADO_ENTREGADO = 'ENTREGADO';
  private signalsService = inject(SignalsService);
  private pedidosService = inject(PedidosService);
  private customersService = inject(CustomersService);
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);
  private trackingService = inject(TrackingService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  idCompany: number = null;
  idBranch: number = null;
  rowData: any[] = [];
  gridHeight: string = '75vh';

  private gridApi: GridApi;
  private clientesList: any[] = [];
  private allRowData: any[] = [];
  private activeExpandedRowId: string | null = null;

  public defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
  };

  public gridOptions: any = {
    headerHeight: 24,
    rowHeight: 26,
    animateRows: true,
    masterDetail: true,
    detailCellRenderer: DetallesEntregadosClienteComponent,
    detailRowHeight: 340,
    isRowMaster: (dataItem: any) => !!dataItem?.detailData?.length,
  };

  public colDefs: ColDef[] = [
    {
      field: 'pdfTicketCliente',
      headerName: 'Ticket',
      editable: false,
      width: 136,
      minWidth: 91,
      cellRenderer: PdfButtonCellRendererComponent,
      cellRendererParams: {
        onClick: (node: any) => this.generateClienteTicket(node),
        icon: 'bi-receipt',
        iconColor: '#1565c0',
        title: 'Ticket entregado por cliente'
      },
      cellStyle: { backgroundColor: '#e3f2fd', textAlign: 'center' }
    },
    {
      field: 'clienteNombre',
      headerName: 'Cliente',
      width: 324,
      minWidth: 216,
    },
    {
      field: 'numArticulos',
      headerName: 'Articulos',
      width: 143,
      minWidth: 117,
      type: 'numericColumn',
      cellRenderer: NumArticulosRendererComponent,
      cellRendererParams: {
        onClick: (node: any) => this.toggleDetalle(node),
      },
      cellStyle: { textAlign: 'center', backgroundColor: '#e3f2fd', cursor: 'pointer' },
    },
    {
      field: 'total',
      headerName: 'Total',
      width: 140,
      minWidth: 110,
      type: 'numericColumn',
      valueFormatter: (params) =>
        params.value != null
          ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value)
          : '$0.00',
      cellStyle: { textAlign: 'right', fontWeight: '700', backgroundColor: '#d4edda' },
    },
    {
      field: 'pedidosCount',
      headerName: 'Pedidos',
      width: 180,
      minWidth: 160,
      type: 'numericColumn',
      cellStyle: { textAlign: 'center', backgroundColor: '#e8f5e9' },
    },
    {
      field: 'cerrado',
      headerName: 'Cerrado',
      width: 95,
      minWidth: 90,
      editable: false,
      sortable: false,
      filter: false,
      cellRenderer: (params: any) => {
        const checked = params.value ? 'checked' : '';
        return `<div class="d-flex justify-content-center align-items-center h-100">
                  <input type="checkbox" ${checked} disabled />
                </div>`;
      },
      cellStyle: { textAlign: 'center', backgroundColor: '#fff8e1' },
    },
  ];

  constructor() {
    effect(() => {
      const currentRoot = this.signalsService.getRootSelectedBySidebar()();
      const currentBranch = this.signalsService.getBranchSelectedBySidebar()();

      if (currentRoot && currentRoot !== this.idCompany) {
        this.idCompany = currentRoot;
        this.idBranch = currentBranch;
        this.loadData();
      } else if (currentRoot && currentBranch !== this.idBranch) {
        this.idBranch = currentBranch;
        this.loadData();
      }
    });
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    this.setupDetailParams();
  }

  toggleDetalle(node: any): void {
    if (!this.gridApi) return;

    const rowId = node?.data?.id;
    if (!rowId) return;

    if (this.activeExpandedRowId === rowId) {
      this.activeExpandedRowId = null;
      this.updateMasterRows(this.allRowData);
      return;
    }

    const selectedRow = this.allRowData.find((item: any) => item.id === rowId);
    if (!selectedRow) return;

    this.activeExpandedRowId = rowId;
    this.updateMasterRows([selectedRow]);

    setTimeout(() => {
      if (!this.gridApi) return;

      let selectedNode: any = null;
      this.gridApi.forEachNode((currentNode: any) => {
        if (currentNode?.data?.id === rowId) {
          selectedNode = currentNode;
        }
      });

      selectedNode?.setExpanded(true);
    }, 0);
  }

  goBackToPedidos(): void {
    this.router.navigate(['../pedidos'], { relativeTo: this.route });
  }

  private setupDetailParams(): void {
    if (!this.gridApi) return;

    this.gridApi.setGridOption('detailCellRendererParams', {
      getDetailRowData: (params: any) => {
        params.successCallback(params.data?.detailData || []);
      },
    });
  }

  private loadData(): void {
    if (!this.idCompany) return;

    forkJoin({
      pedidos: this.pedidosService.getPedidosByCompany(this.idCompany),
      detalles: this.pedidosService.getDetallesByCompany(this.idCompany),
      clientes: this.idBranch
        ? this.customersService.getCustomers(this.idBranch, 'CUSTOMERS')
        : this.customersService.getCustomersByCompany(this.idCompany, 'CUSTOMERS'),
    }).subscribe({
      next: (results: any) => {
        const pedidosList: any[] = results.pedidos?.data || results.pedidos || [];
        const detallesList: any[] = results.detalles?.data || results.detalles || [];
        this.clientesList = results.clientes?.data || results.clientes || [];

        const pedidosMap = new Map(pedidosList.map((pedido: any) => [Number(pedido.id), pedido]));
        const deliveredDetails = detallesList
          .filter((detalle: any) => String(detalle?.estado || '').toUpperCase() === this.ESTADO_ENTREGADO)
          .map((detalle: any) => {
            const pedido = pedidosMap.get(Number(detalle.idPedido));
            const cliente = this.clientesList.find((c: any) => c.id == detalle.idCliente);
            return {
              ...detalle,
              pedidoNumero: pedido?.numero || detalle.idPedido || '-',
              pedidoFecha: pedido?.fecha || null,
              clienteNombre: cliente?.nameContact || cliente?.company || cliente?.name || cliente?.Description || '-',
            };
          });

        const clientesMap = new Map<string, any[]>();
        for (const detalle of deliveredDetails) {
          const key = String(detalle.idCliente ?? '0');
          if (!clientesMap.has(key)) {
            clientesMap.set(key, []);
          }
          clientesMap.get(key)!.push(detalle);
        }

        this.allRowData = Array.from(clientesMap.entries())
          .map(([clienteId, items]) => {
            const uniquePedidos = [...new Set(items.map((item: any) => item.idPedido).filter(Boolean))];
            const total = items.reduce((sum: number, item: any) => {
              const cantidad = Number(item?.cantidad) || 0;
              const venta = Number(item?.venta) || 0;
              const impuesto = Number(item?.impuesto) || 0;
              return sum + (cantidad * venta) + impuesto;
            }, 0);

            return {
              id: `cliente-entregado-${clienteId}`,
              clienteId: Number(clienteId),
              clienteNombre: items[0]?.clienteNombre || '-',
              pedidosCount: uniquePedidos.length,
              numArticulos: items.length,
              cerrado: items.every((item: any) => !!(item?.cerrado ?? item?.closed)),
              total,
              detailData: items.sort((a: any, b: any) => String(a.pedidoNumero).localeCompare(String(b.pedidoNumero))),
            };
          })
          .sort((a, b) => a.clienteNombre.localeCompare(b.clienteNombre));

        if (this.activeExpandedRowId) {
          const activeRow = this.allRowData.find((item: any) => item.id === this.activeExpandedRowId);
          this.updateMasterRows(activeRow ? [activeRow] : this.allRowData);
          if (!activeRow) {
            this.activeExpandedRowId = null;
          }
        } else {
          this.updateMasterRows(this.allRowData);
        }
      },
      error: (error) => {
        console.error('Error cargando pedidos entregados:', error);
        this.allRowData = [];
        this.activeExpandedRowId = null;
        this.updateMasterRows([]);
        alerts.basicAlert('Error', 'No se pudieron cargar los pedidos entregados', 'error');
      },
    });
  }

  private updateMasterRows(rows: any[]): void {
    this.rowData = [...rows];

    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
      this.setupDetailParams();
    }
  }

  async generateClienteTicket(node: any): Promise<void> {
    const clienteRow = node?.data;
    if (!clienteRow) return;

    const items = clienteRow.detailData || [];
    if (items.length === 0) {
      alerts.basicAlert('Sin items', 'Este cliente no tiene productos entregados', 'info');
      return;
    }

    try {
      const pdfMake = (await import('pdfmake/build/pdfmake')).default;
      const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
      (pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

      let logoBase64: string | null = null;
      try {
        const rootData: any = await lastValueFrom(this.rootService.getRootbyId(this.idCompany));
        if (rootData?.picture) {
          logoBase64 = await this.base64EncodeService.convertImageToBase64(rootData.picture);
        }
      } catch {}

      const currency = (val: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);

      const logoCell = logoBase64
        ? { image: logoBase64, width: 60, alignment: 'left' as const }
        : { text: '', width: 60 };

      const content: any[] = [];
      const grandTotal = items.reduce((sum: number, item: any) => {
        const cantidad = Number(item?.cantidad) || 0;
        const venta = Number(item?.venta) || 0;
        const impuesto = Number(item?.impuesto) || 0;
        return sum + (cantidad * venta) + impuesto;
      }, 0);

      const rows = items.map((item: any) => {
        const cantidad = Number(item?.cantidad) || 0;
        const venta = Number(item?.venta) || 0;
        const impuesto = Number(item?.impuesto) || 0;
        const total = (cantidad * venta) + impuesto;
        return [
          { text: item.pedidoNumero || '-', fontSize: 8 },
          { text: item.pedidoFecha ? new Date(item.pedidoFecha).toLocaleDateString('es-MX') : '-', fontSize: 8 },
          { text: item.producto || '-', fontSize: 8 },
          { text: String(cantidad), alignment: 'center', fontSize: 8 },
          { text: item.plataforma || '-', fontSize: 8 },
          { text: currency(venta), alignment: 'right', fontSize: 8 },
          { text: currency(impuesto), alignment: 'right', fontSize: 8 },
          { text: currency(total), alignment: 'right', bold: true, fontSize: 8 },
        ];
      });

      content.push({
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'Pedido', style: 'tableHeader' },
              { text: 'Fecha', style: 'tableHeader' },
              { text: 'Producto', style: 'tableHeader' },
              { text: 'Cant.', style: 'tableHeader' },
              { text: 'Plataforma', style: 'tableHeader' },
              { text: 'Venta', style: 'tableHeader' },
              { text: 'Impuesto', style: 'tableHeader' },
              { text: 'Total', style: 'tableHeader' },
            ],
            ...rows,
            [
              { text: 'TOTAL GENERAL', colSpan: 7, bold: true, alignment: 'right', fontSize: 8, fillColor: '#f5f5f5' },
              {}, {}, {}, {}, {}, {},
              { text: currency(grandTotal), bold: true, alignment: 'right', fontSize: 8, fillColor: '#f5f5f5' }
            ]
          ]
        },
        layout: 'lightHorizontalLines',
        margin: [0, 10, 0, 4]
      });

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
                  { text: `Ticket General — ${clienteRow.clienteNombre}`, fontSize: 13, bold: true, color: '#0d47a1', alignment: 'center' },
                  { text: `Pedidos: ${clienteRow.pedidosCount}   |   Items: ${clienteRow.numArticulos}`, fontSize: 8, color: '#555', alignment: 'center' }
                ]
              },
              { text: new Date().toLocaleDateString('es-MX'), fontSize: 8, color: '#888', alignment: 'right', margin: [0, 6, 0, 0] }
            ]]
          },
          layout: 'noBorders'
        }),
        content,
        styles: {
          tableHeader: { bold: true, fontSize: 8, fillColor: '#e3f2fd', color: '#0d47a1' }
        },
        footer: (currentPage: number, pageCount: number) => ({
          text: `Página ${currentPage} de ${pageCount}`,
          alignment: 'center',
          fontSize: 8,
          color: '#999',
          margin: [0, 8, 0, 0]
        })
      };

      this.trackingService.addLog(this.trackingService.getnameComp(), 'Imprimió/abrió ticket pedido entregado', 'Logística / Pedidos Entregados', this.trackingService.getEmail());
      const pdf = pdfMake.createPdf(docDef);
      try {
        pdf.open();
      } catch {
        pdf.download(`Ticket_Entregado_${clienteRow.clienteNombre}.pdf`);
      }
    } catch (error) {
      console.error('Error generando ticket entregado por cliente:', error);
      alerts.basicAlert('Error', 'No se pudo generar el ticket', 'error');
    }
  }
}
