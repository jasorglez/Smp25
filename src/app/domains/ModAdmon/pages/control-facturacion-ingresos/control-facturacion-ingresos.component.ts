import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { SignalsService } from 'app/services/signals.service';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { TrackingService } from 'app/services/tracking.service';
import { PdfWorkerService } from 'app/services/pdf-worker.service';
import { ProjectsService } from 'app/services/projects.service';
import { CustomersService } from 'app/services/customers.service';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom } from 'rxjs';
import { Workbook } from 'exceljs';

// Interfaz para los datos del reporte
export interface FacturacionIngreso {
  id: number;
  mes: string;
  cliente: string;
  proyecto: string;
  fechaFactura: Date | null;
  fechaPago: Date | null;
  factura: string;
  oc: string;
  importeFactura: number;
  importeDescuento: number;
  subtotal: number;
  iva: number;
  total: number;
  estatus: string;
  estatusPago: string;
  diasPlazo: number | null;
  dias: number | null;
  fechaVencimiento: Date | null;
  diasVencimiento: number | null;
}

@Component({
  selector: 'app-control-facturacion-ingresos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './control-facturacion-ingresos.component.html',
  styleUrl: './control-facturacion-ingresos.component.scss',
})
export class ControlFacturacionIngresosComponent {
  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  private signalsService = inject(SignalsService);
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);
  private trackingService = inject(TrackingService);
  private pdfWorkerService = inject(PdfWorkerService);
  private projectsService = inject(ProjectsService);
  private customersService = inject(CustomersService);

  // Estado del componente
  public rootId: number;
  public companyName: string = '';
  public fechaActual: string = '';
  public isExportingPdf = false;
  public isExportingXlsx = false;
  public isLoading = true;

  // Filtros de fecha
  public fechaInicio: string = '';
  public fechaFin: string = '';

  // Datos crudos
  private ingresos: any[] = [];
  private projects: any[] = [];
  private customers: any[] = [];

  // Datos procesados para el reporte
  public facturacionIngresos: FacturacionIngreso[] = [];

  // Totales
  public totales = {
    importeFactura: 0,
    importeDescuento: 0,
    subtotal: 0,
    iva: 0,
    total: 0,
  };

  constructor() {
    // Establecer fechas por defecto (mes anterior)
    const today = new Date();
    this.fechaActual = this.formatDateDisplay(today);

    const twentyFourMonthsAgo = new Date(
      today.getFullYear(),
      today.getMonth() - 24,
      1,
    );

    this.fechaInicio = this.formatDateForInput(twentyFourMonthsAgo);
    this.fechaFin = this.formatDateForInput(today);

    effect(
      () => {
        this.rootId = this.signalsService.getRootSelectedBySidebar()();
        if (this.rootId) {
          this.loadAllData();
        }
      },
      { allowSignalWrites: true },
    );
  }

  public onFilterChange(): void {
    if (this.rootId && !this.isLoading) {
      // Validar fechas
      if (this.fechaInicio > this.fechaFin) {
        const temp = this.fechaInicio;
        this.fechaInicio = this.fechaFin;
        this.fechaFin = temp;
      }
      this.processData();
    }
  }

  private formatDateDisplay(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const months = [
      'ene',
      'feb',
      'mar',
      'abr',
      'may',
      'jun',
      'jul',
      'ago',
      'sep',
      'oct',
      'nov',
      'dic',
    ];
    const month = months[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);
    return `${day}-${month}-${year}`;
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDateShort(date: Date | null): string {
    if (!date) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private async loadAllData(): Promise<void> {
    this.isLoading = true;
    try {
      const [rootData, incomesData, projectsData, customersData] =
        await Promise.all([
          lastValueFrom(this.rootService.getRootbyId(this.rootId)),
          lastValueFrom(
            this.incomesAndExpensesService.getIncomesAndExpenses(this.rootId),
          ),
          lastValueFrom(
            this.projectsService.getProjectListByCompany(this.rootId),
          ),
          lastValueFrom(
            this.customersService.getCustomersByCompany(
              this.rootId,
              'CUSTOMERS',
            ),
          ),
        ]);

      this.companyName =
        (rootData as any)?.name || (rootData as any)?.nameCompany || 'Empresa';

      // Filtrar solo ingresos (DEPOSITO)
      const allData = Array.isArray(incomesData) ? incomesData : [];
      this.ingresos = allData.filter(
        (item) => String(item?.type ?? '').toUpperCase() === 'DEPOSITO',
      );

      // Mapear proyectos
      const projectsArray = Array.isArray(projectsData) ? projectsData : [];
      this.projects = projectsArray.map((p: any) => ({
        id: p.id,
        name: p.name || p.number || 'Sin nombre',
      }));

      // Mapear clientes
      const customersArray = Array.isArray(customersData) ? customersData : [];
      this.customers = customersArray.map((c: any) => ({
        id: c.id,
        name: c.company || c.nameContact || c.name || 'Sin nombre',
      }));

      console.log('Datos cargados:', {
        ingresos: this.ingresos.length,
        proyectos: this.projects.length,
        clientes: this.customers.length,
      });

      this.processData();
    } catch (error) {
      console.error('Error cargando datos:', error);
      alerts.basicAlert(
        'Error',
        'Error al cargar los datos del reporte',
        'error',
      );
    } finally {
      this.isLoading = false;
    }
  }

  private processData(): void {
    // Filtrar por rango de fechas
    const filtered = this.ingresos.filter((ingreso) => {
      const fechaStr = ingreso.date || ingreso.dateStamped;
      if (!fechaStr) return false;
      const fecha = new Date(fechaStr);
      if (isNaN(fecha.getTime())) return false;
      const fechaFormatted = this.formatDateForInput(fecha);
      return (
        fechaFormatted >= this.fechaInicio && fechaFormatted <= this.fechaFin
      );
    });

    // Agrupar por (idCliente, idProyecto, paymentMonth) para respetar el mes capturado en income
    const grupos = new Map<
      string,
      {
        idCliente: number;
        idProyecto: number;
        paymentMonth: string;
        importeFactura: number;
        importeDescuento: number;
        subtotal: number;
        iva: number;
        total: number;
        fechaFactura: Date | null;
        fechaPago: Date | null;
        statuses: Set<string>;
        estatusPagos: Set<string>;
        diasPlazo: number | null;
        ocs: Set<string>;
        facturas: Set<string>;
      }
    >();

    filtered.forEach((ingreso) => {
      const idCliente = ingreso.idCustomer;
      const idProyecto = ingreso.idProject;
      if (!idCliente || !idProyecto) return;

      const paymentMonth = (ingreso.paymentMonth || '').trim();
      const key = `${idCliente}_${idProyecto}_${paymentMonth}`;
      const current = grupos.get(key) || {
        idCliente,
        idProyecto,
        paymentMonth,
        importeFactura: 0,
        importeDescuento: 0,
        subtotal: 0,
        iva: 0,
        total: 0,
        fechaFactura: null,
        fechaPago: null,
        statuses: new Set<string>(),
        estatusPagos: new Set<string>(),
        diasPlazo: null,
        ocs: new Set<string>(),
        facturas: new Set<string>(),
      };

      if (current.diasPlazo == null && ingreso.diasPlazo != null) {
        current.diasPlazo = Number(ingreso.diasPlazo);
      }
      current.importeFactura += Number(ingreso.total) || 0;
      current.subtotal += Number(ingreso.subtotal) || 0;
      current.iva += Number(ingreso.tax) || 0;
      current.total += Number(ingreso.total) || 0;
      if (ingreso.deliveryStatus) current.statuses.add(ingreso.deliveryStatus);
      if (ingreso.status) current.estatusPagos.add(ingreso.status);

      const oc = (ingreso.oc || '').toString().trim();
      if (oc) current.ocs.add(oc);

      const numDoc =
        ingreso.uuid && ingreso.uuid !== 'NA'
          ? ingreso.uuid
          : (ingreso.numberDocument || '').toString().trim();
      if (numDoc) current.facturas.add(numDoc);

      const fechaFactura = ingreso.dateStamped
        ? new Date(ingreso.dateStamped)
        : null;
      if (fechaFactura) {
        if (!current.fechaFactura || fechaFactura < current.fechaFactura)
          current.fechaFactura = fechaFactura;
      }
      const fechaPago = ingreso.date ? new Date(ingreso.date) : null;
      if (fechaPago) {
        if (!current.fechaPago || fechaPago > current.fechaPago)
          current.fechaPago = fechaPago;
      }

      grupos.set(key, current);
    });

    // Convertir a filas
    const mesOrden = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    this.facturacionIngresos = [];
    grupos.forEach(
      ({
        idCliente,
        idProyecto,
        paymentMonth,
        importeFactura,
        subtotal,
        iva,
        total,
        fechaFactura,
        fechaPago,
        statuses,
        estatusPagos,
        diasPlazo,
        ocs,
        facturas,
      }) => {
        const customer = this.customers.find((c) => c.id === idCliente);
        const project = this.projects.find((p) => p.id === idProyecto);
        if (!project) return;

        const estatus = [...statuses].join(' / ');
        const estatusPago = [...estatusPagos].join(' / ');
        const oc = ocs.size > 0 ? [...ocs].join(', ') : '';
        const factura = facturas.size > 0 ? [...facturas].join(', ') : '';

        const dias =
          fechaFactura && fechaPago
            ? Math.round(
                (fechaPago.getTime() - fechaFactura.getTime()) /
                  (1000 * 60 * 60 * 24),
              )
            : null;

        let fechaVencimiento: Date | null = null;
        let diasVencimiento: number | null = null;
        if (fechaFactura && diasPlazo != null) {
          fechaVencimiento = new Date(fechaFactura);
          fechaVencimiento.setDate(fechaVencimiento.getDate() + diasPlazo);
          const fv = new Date(fechaVencimiento);
          fv.setHours(0, 0, 0, 0);
          diasVencimiento = Math.floor(
            (fv.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
          );
        }

        this.facturacionIngresos.push({
          id: idProyecto,
          mes: paymentMonth,
          cliente: customer?.name || '',
          proyecto: project?.name || '',
          fechaFactura,
          fechaPago,
          factura,
          oc,
          importeFactura,
          importeDescuento: 0,
          subtotal,
          iva,
          total,
          estatus,
          estatusPago,
          diasPlazo,
          dias,
          fechaVencimiento,
          diasVencimiento,
        });
      },
    );

    this.facturacionIngresos.sort((a, b) => {
      const ma = mesOrden.indexOf(a.mes);
      const mb = mesOrden.indexOf(b.mes);
      if (ma !== mb) return ma - mb;
      const cmp = a.cliente.localeCompare(b.cliente);
      return cmp !== 0 ? cmp : a.proyecto.localeCompare(b.proyecto);
    });

    // Calcular totales (excluir canceladas)
    this.totales = this.facturacionIngresos
      .filter((f) => f.estatusPago?.toLowerCase() !== 'cancelada')
      .reduce(
        (acc, f) => ({
          importeFactura: acc.importeFactura + f.importeFactura,
          importeDescuento: acc.importeDescuento + f.importeDescuento,
          subtotal: acc.subtotal + f.subtotal,
          iva: acc.iva + f.iva,
          total: acc.total + f.total,
        }),
        {
          importeFactura: 0,
          importeDescuento: 0,
          subtotal: 0,
          iva: 0,
          total: 0,
        },
      );
  }

  public formatCurrency(value: number): string {
    if (!Number.isFinite(value)) return '$0.00';
    return value.toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private formatCurrencyShort(value: number): string {
    if (!Number.isFinite(value)) return '$0';
    return (
      '$' +
      value.toLocaleString('es-MX', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  getStatusClass(estatus: string): string {
    switch (estatus?.toLowerCase()) {
      case 'pagada':
        return 'status-pagada';
      case 'pendiente':
        return 'status-pendiente';
      case 'cancelada':
        return 'status-cancelada';
      case 'entregada':
        return 'status-entregada';
      default:
        return '';
    }
  }

  private getPdfStatusStyle(estatus: string): {
    fillColor: string;
    color: string;
  } {
    switch (estatus?.toLowerCase()) {
      case 'pagada':
        return { fillColor: '#d4edda', color: '#155724' };
      case 'pendiente':
        return { fillColor: '#cce5ff', color: '#004085' };
      case 'cancelada':
        return { fillColor: '#f8d7da', color: '#721c24' };
      case 'entregada':
        return { fillColor: '#fff3cd', color: '#856404' };
      default:
        return { fillColor: '', color: '#333333' };
    }
  }

  getDiasVencimientoClass(dias: number | null, estatus: string): string {
    if (estatus?.toLowerCase() === 'pagada') return 'dias-pagado';
    if (dias === null) return '';
    if (dias < 0) return 'dias-vencido';
    if (dias <= 7) return 'dias-proximo';
    return 'dias-ok';
  }

  public async exportToPdf(): Promise<void> {
    if (this.isExportingPdf || this.isExportingXlsx) return;
    this.isExportingPdf = true;

    try {
      // Obtener logo
      const rootData: any = await lastValueFrom(
        this.rootService.getRootbyId(this.rootId),
      );
      let logoBase64: string | null = null;
      if (rootData?.picture) {
        try {
          logoBase64 = await this.base64EncodeService.convertImageToBase64(
            rootData.picture,
          );
        } catch (e) {
          console.warn('No se pudo cargar el logo');
        }
      }

      const content = this.buildPdfContent();

      // Período en texto
      const [sy, sm] = this.fechaInicio.split('-');
      const [ey, em] = this.fechaFin.split('-');
      const meses = [
        'ENERO',
        'FEBRERO',
        'MARZO',
        'ABRIL',
        'MAYO',
        'JUNIO',
        'JULIO',
        'AGOSTO',
        'SEPTIEMBRE',
        'OCTUBRE',
        'NOVIEMBRE',
        'DICIEMBRE',
      ];
      let periodText = '';
      if (sy === ey && sm === em) {
        periodText = `MES DE ${meses[parseInt(sm) - 1]} ${sy}`;
      } else if (sy === ey) {
        periodText = `PERIODO DE ${meses[parseInt(sm) - 1]} A ${meses[parseInt(em) - 1]} ${sy}`;
      } else {
        periodText = `PERIODO DE ${meses[parseInt(sm) - 1]} ${sy} A ${meses[parseInt(em) - 1]} ${ey}`;
      }

      const docDefinition: any = {
        pageSize: 'TABLOID',
        pageOrientation: 'landscape',
        pageMargins: [15, 60, 15, 30],
        header: this.buildPdfHeader(logoBase64, periodText),
        content,
        styles: {
          tableHeader: {
            fontSize: 6,
            bold: true,
            color: '#FFFFFF',
            fillColor: '#1a5276',
          },
          tableCell: { fontSize: 6, color: '#333333' },
          tableCellRight: { fontSize: 6, color: '#333333', alignment: 'right' },
          tableCellMoney: { fontSize: 6, color: '#333333', alignment: 'right' },
          totalRow: { fontSize: 7, bold: true, fillColor: '#e2e8f0' },
          sectionTitle: {
            fontSize: 12,
            bold: true,
            color: '#1a5276',
            margin: [0, 15, 0, 10],
          },
        },
      };

      const footerTemplate = {
        text: 'Página {cp} de {pc}',
        alignment: 'center',
        fontSize: 7,
        margin: [0, 5, 0, 0],
      };
      const fileName = `control-facturacion-ingresos-${this.fechaInicio}-al-${this.fechaFin}.pdf`;
      await this.pdfWorkerService.generateAndDownload(
        docDefinition,
        fileName,
        footerTemplate,
      );

      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Exportación PDF - Control Facturación e Ingresos',
        'Control Facturación',
        this.trackingService.getEmail(),
      );
    } catch (error) {
      console.error('Error exportando PDF:', error);
      alerts.basicAlert('Error', 'Error al generar el PDF', 'error');
    } finally {
      this.isExportingPdf = false;
    }
  }

  private buildPdfHeader(logoBase64: string | null, periodText: string): any {
    const logoCell = logoBase64
      ? { image: logoBase64, width: 50, alignment: 'left' }
      : { text: this.companyName, bold: true, fontSize: 10, alignment: 'left' };

    return {
      margin: [15, 8, 15, 0],
      table: {
        widths: ['15%', '*', '20%'],
        body: [
          [
            logoCell,
            {
              stack: [
                {
                  text: 'Control de Facturación e Ingresos',
                  fontSize: 12,
                  bold: true,
                  alignment: 'center',
                  color: '#1a5276',
                },
                {
                  text: 'Sistema de Gestión de Calidad',
                  fontSize: 8,
                  alignment: 'center',
                  color: '#666',
                },
                {
                  text: periodText,
                  fontSize: 7,
                  alignment: 'center',
                  color: '#333',
                  margin: [0, 2, 0, 0],
                },
              ],
            },
            {
              stack: [
                {
                  text: 'Referencia: HCO-ADM-SGC-004',
                  fontSize: 7,
                  alignment: 'right',
                },
                {
                  text: 'Código: HCO-ADM-FO-013',
                  fontSize: 7,
                  alignment: 'right',
                },
                { text: 'Rev.: 00', fontSize: 7, alignment: 'right' },
              ],
            },
          ],
        ],
      },
      layout: 'noBorders',
    };
  }

  private buildPdfContent(): any[] {
    const content: any[] = [];

    const headers = [
      'MES',
      'CLIENTE',
      'PROYECTO',
      'F. FACTURA',
      'F. PAGO',
      'FACTURA',
      'OC',
      'IMP. FACT.',
      'DESC.',
      'SUBTOTAL',
      'IVA',
      'TOTAL',
      'ESTATUS',
      'EST. PAGO',
      'DÍAS',
      'F. VENC.',
      'DÍAS V.',
    ];

    const body: any[] = [
      headers.map((h) => ({
        text: h,
        style: 'tableHeader',
        alignment: 'center',
      })),
    ];

    this.facturacionIngresos.forEach((f) => {
      const diasVencColor =
        f.estatusPago?.toLowerCase() === 'pagada'
          ? '#155724'
          : f.diasVencimiento !== null && f.diasVencimiento < 0
            ? '#dc2626'
            : '#333';

      body.push([
        { text: f.mes, style: 'tableCell', alignment: 'center' },
        { text: f.cliente, style: 'tableCell', alignment: 'left' },
        { text: f.proyecto, style: 'tableCell', alignment: 'left' },
        {
          text: this.formatDateShort(f.fechaFactura),
          style: 'tableCell',
          alignment: 'center',
        },
        {
          text: this.formatDateShort(f.fechaPago),
          style: 'tableCell',
          alignment: 'center',
        },
        { text: f.factura, style: 'tableCell', alignment: 'center' },
        { text: f.oc, style: 'tableCell', alignment: 'center' },
        {
          text: this.formatCurrencyShort(f.importeFactura),
          style: 'tableCellMoney',
        },
        {
          text:
            f.importeDescuento > 0
              ? this.formatCurrencyShort(f.importeDescuento)
              : '',
          style: 'tableCellMoney',
        },
        { text: this.formatCurrencyShort(f.subtotal), style: 'tableCellMoney' },
        { text: this.formatCurrencyShort(f.iva), style: 'tableCellMoney' },
        {
          text: this.formatCurrencyShort(f.total),
          style: 'tableCellMoney',
          bold: true,
        },
        {
          text: f.estatus,
          style: 'tableCell',
          alignment: 'center',
          ...this.getPdfStatusStyle(f.estatus),
        },
        {
          text: f.estatusPago,
          style: 'tableCell',
          alignment: 'center',
          ...this.getPdfStatusStyle(f.estatusPago),
        },
        {
          text: f.dias !== null ? f.dias.toString() : '',
          style: 'tableCell',
          alignment: 'center',
        },
        {
          text: this.formatDateShort(f.fechaVencimiento),
          style: 'tableCell',
          alignment: 'center',
        },
        {
          text: f.diasVencimiento !== null ? f.diasVencimiento.toString() : '',
          style: 'tableCell',
          alignment: 'center',
          color: diasVencColor,
          bold: f.diasVencimiento !== null && f.diasVencimiento < 0,
        },
      ]);
    });

    // Fila de totales (18 columnas: colSpan 7 + 6 placeholders + 5 money + 6 trailing)
    body.push([
      {
        text: 'TOTAL',
        colSpan: 7,
        style: 'totalRow',
        alignment: 'right',
        bold: true,
      },
      {},
      {},
      {},
      {},
      {},
      {},
      {
        text: this.formatCurrencyShort(this.totales.importeFactura),
        style: 'totalRow',
        alignment: 'right',
      },
      {
        text:
          this.totales.importeDescuento > 0
            ? this.formatCurrencyShort(this.totales.importeDescuento)
            : '',
        style: 'totalRow',
        alignment: 'right',
      },
      {
        text: this.formatCurrencyShort(this.totales.subtotal),
        style: 'totalRow',
        alignment: 'right',
      },
      {
        text: this.formatCurrencyShort(this.totales.iva),
        style: 'totalRow',
        alignment: 'right',
      },
      {
        text: this.formatCurrencyShort(this.totales.total),
        style: 'totalRow',
        alignment: 'right',
      },
      { text: '', style: 'totalRow' },
      { text: '', style: 'totalRow' },
      { text: '', style: 'totalRow' },
      { text: '', style: 'totalRow' },
      { text: '', style: 'totalRow' },
    ]);

    content.push({
      table: {
        headerRows: 1,
        widths: [53, 102, 102, 58, 58, 69, 47, 66, 53, 66, 53, 69, 63, 53, 37, 58, 43],
        body,
      },
      layout: 'siafStripeTeal',
    });

    return content;
  }

  public async exportToXlsx(): Promise<void> {
    if (this.isExportingPdf || this.isExportingXlsx) return;
    this.isExportingXlsx = true;

    try {
      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet('Control Facturación');

      worksheet.views = [{ showGridLines: false }];

      // Título
      worksheet.mergeCells('A1:R1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'CONTROL DE FACTURACIÓN E INGRESOS';
      titleCell.font = { bold: true, size: 14, color: { argb: 'FF1A5276' } };
      titleCell.alignment = { horizontal: 'center' };

      // Info
      worksheet.getCell('A2').value = `Empresa: ${this.companyName}`;
      worksheet.getCell('A3').value =
        `Período: ${this.fechaInicio} al ${this.fechaFin}`;

      // Headers
      const headers = [
        'Mes',
        'Cliente',
        'Proyecto',
        'Fecha Factura',
        'Fecha Pago',
        'Factura/NC',
        'OC',
        'Importe Factura',
        'Importe Desc.',
        'Subtotal',
        'IVA',
        'Total',
        'Estatus',
        'Estatus Pago',
        'Días',
        'Fecha Venc.',
        'Días Venc.',
      ];
      const headerRow = worksheet.getRow(5);
      headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1A5276' },
        };
        cell.alignment = { horizontal: 'center' };
      });

      // Datos
      let rowIndex = 6;
      this.facturacionIngresos.forEach((f) => {
        const row = worksheet.getRow(rowIndex);
        row.getCell(1).value = f.mes;
        row.getCell(2).value = f.cliente;
        row.getCell(3).value = f.proyecto;
        row.getCell(4).value = f.fechaFactura
          ? this.formatDateShort(f.fechaFactura)
          : '';
        row.getCell(5).value = f.fechaPago
          ? this.formatDateShort(f.fechaPago)
          : '';
        row.getCell(6).value = f.factura;
        row.getCell(7).value = f.oc;
        row.getCell(8).value = f.importeFactura;
        row.getCell(8).numFmt = '"$"#,##0.00';
        row.getCell(9).value = f.importeDescuento || '';
        if (f.importeDescuento) row.getCell(9).numFmt = '"$"#,##0.00';
        row.getCell(10).value = f.subtotal;
        row.getCell(10).numFmt = '"$"#,##0.00';
        row.getCell(11).value = f.iva;
        row.getCell(11).numFmt = '"$"#,##0.00';
        row.getCell(12).value = f.total;
        row.getCell(12).numFmt = '"$"#,##0.00';
        row.getCell(12).font = { bold: true };
        row.getCell(13).value = f.estatus;
        row.getCell(14).value = f.estatusPago;
        row.getCell(15).value = f.dias !== null ? f.dias : '';
        row.getCell(16).value = f.fechaVencimiento
          ? this.formatDateShort(f.fechaVencimiento)
          : '';
        row.getCell(17).value =
          f.diasVencimiento !== null ? f.diasVencimiento : '';
        if (f.diasVencimiento !== null && f.diasVencimiento < 0) {
          row.getCell(17).font = { color: { argb: 'FFDC2626' }, bold: true };
        }
        rowIndex++;
      });

      // Fila totales
      const totalRow = worksheet.getRow(rowIndex);
      totalRow.getCell(1).value = 'TOTAL';
      totalRow.font = { bold: true };
      totalRow.getCell(8).value = this.totales.importeFactura;
      totalRow.getCell(8).numFmt = '"$"#,##0.00';
      totalRow.getCell(9).value = this.totales.importeDescuento || '';
      totalRow.getCell(10).value = this.totales.subtotal;
      totalRow.getCell(10).numFmt = '"$"#,##0.00';
      totalRow.getCell(11).value = this.totales.iva;
      totalRow.getCell(11).numFmt = '"$"#,##0.00';
      totalRow.getCell(12).value = this.totales.total;
      totalRow.getCell(12).numFmt = '"$"#,##0.00';
      totalRow.getCell(12).font = { bold: true, color: { argb: 'FFDC2626' } };

      // Anchos
      worksheet.columns = [
        { width: 10 },
        { width: 15 },
        { width: 18 },
        { width: 12 },
        { width: 12 },
        { width: 15 },
        { width: 10 },
        { width: 14 },
        { width: 12 },
        { width: 12 },
        { width: 10 },
        { width: 12 },
        { width: 12 },
        { width: 12 },
        { width: 8 },
        { width: 12 },
        { width: 10 },
      ];

      // Generar archivo
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `control-facturacion-ingresos-${this.fechaInicio}-al-${this.fechaFin}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Exportación XLSX - Control Facturación e Ingresos',
        'Control Facturación',
        this.trackingService.getEmail(),
      );

      alerts.basicAlert(
        'Éxito',
        'Archivo Excel generado correctamente',
        'success',
      );
    } catch (error) {
      console.error('Error exportando XLSX:', error);
      alerts.basicAlert('Error', 'Error al generar el archivo Excel', 'error');
    } finally {
      this.isExportingXlsx = false;
    }
  }
}
