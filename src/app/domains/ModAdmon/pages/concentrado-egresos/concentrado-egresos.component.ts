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
import { CuentasContablesService } from 'app/services/cuentas-contables.service';
import { AdministrationService } from 'app/services/administration.service';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom } from 'rxjs';
import { Workbook } from 'exceljs';

// Interfaz para los datos del reporte
export interface ConcentradoEgreso {
  id: number;
  proveedor: string;
  empresa: string;
  proyecto: string;
  fecha: Date | null;
  mes: string;
  anioEjercicio: number;
  ejercicio: string;
  clasificacion: string;
  subclasificacion: string;
  concepto: string;
  importeSinIva: number;
  iva: number;
  otrosImpuestos: number;
  importeTotal: number;
  numeroFactura: string;
  tipoPago: string;
  cuenta: string;
  observaciones: string;
}

@Component({
  selector: 'app-concentrado-egresos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './concentrado-egresos.component.html',
  styleUrl: './concentrado-egresos.component.scss',
})
export class ConcentradoEgresosComponent {
  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  private signalsService = inject(SignalsService);
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);
  private trackingService = inject(TrackingService);
  private pdfWorkerService = inject(PdfWorkerService);
  private projectsService = inject(ProjectsService);
  private customersService = inject(CustomersService);
  private cuentasContablesService = inject(CuentasContablesService);
  private administrationService = inject(AdministrationService);

  private readonly SAT_FORMAS_PAGO: Record<string, string> = {
    '01': 'Efectivo',
    '02': 'Cheque nominativo',
    '03': 'Transferencia electrónica',
    '04': 'Tarjeta de crédito',
    '05': 'Monedero electrónico',
    '06': 'Dinero electrónico',
    '08': 'Vales de despensa',
    '12': 'Dación en pago',
    '13': 'Pago por subrogación',
    '14': 'Pago por consignación',
    '15': 'Condonación',
    '17': 'Compensación',
    '23': 'Novación',
    '24': 'Confusión',
    '25': 'Remisión de deuda',
    '26': 'Prescripción o caducidad',
    '27': 'A satisfacción del acreedor',
    '28': 'Tarjeta de débito',
    '29': 'Tarjeta de servicios',
    '30': 'Aplicación de anticipos',
    '31': 'Intermediario pagos',
    '99': 'Por definir',
  };

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
  private egresos: any[] = [];
  private projects: any[] = [];
  private providers: any[] = [];
  private clients: any[] = [];
  private cuentasContables: any[] = [];
  private accounts: any[] = [];

  // Datos procesados para el reporte
  public concentradoEgresos: ConcentradoEgreso[] = [];

  // Totales
  public totales = {
    importeSinIva: 0,
    iva: 0,
    otrosImpuestos: 0,
    importeTotal: 0,
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
      const [
        rootData,
        expensesData,
        projectsData,
        providersData,
        clientsData,
        cuentasData,
        accountsData,
      ] = await Promise.all([
        lastValueFrom(this.rootService.getRootbyId(this.rootId)),
        lastValueFrom(
          this.incomesAndExpensesService.getIncomesAndExpenses(this.rootId),
        ),
        lastValueFrom(
          this.projectsService.getProjectListByCompany(this.rootId),
        ),
        lastValueFrom(
          this.customersService.getCustomersByCompany(this.rootId, 'PROVIDERS'),
        ),
        lastValueFrom(
          this.customersService.getCustomersByCompany(this.rootId, 'CUSTOMERS'),
        ),
        lastValueFrom(this.cuentasContablesService.getAll(this.rootId)),
        lastValueFrom(this.administrationService.getAccountBanks(this.rootId)),
      ]);

      this.companyName =
        (rootData as any)?.name || (rootData as any)?.nameCompany || 'Empresa';

      // Filtrar solo egresos (GASTO)
      const allData = Array.isArray(expensesData) ? expensesData : [];
      this.egresos = allData.filter(
        (item) => String(item?.type ?? '').toUpperCase() === 'GASTO',
      );

      // Mapear proyectos
      const projectsArray = Array.isArray(projectsData) ? projectsData : [];
      this.projects = projectsArray.map((p: any) => ({
        id: p.id,
        name: p.name || p.number || 'Sin nombre',
      }));

      // Mapear proveedores
      const providersArray = Array.isArray(providersData) ? providersData : [];
      this.providers = providersArray.map((c: any) => ({
        id: c.id,
        name: c.nameContact || c.company || c.name || 'Sin nombre',
      }));

      // Mapear clientes
      const clientsArray = Array.isArray(clientsData) ? clientsData : [];
      this.clients = clientsArray.map((c: any) => ({
        id: c.id,
        name: c.company || c.nameContact || c.name || 'Sin nombre',
      }));

      // Mapear cuentas contables
      const cuentasArray = Array.isArray(cuentasData) ? cuentasData : [];
      this.cuentasContables = cuentasArray.map((c: any) => ({
        id: c.id,
        name: c.nombre || c.name || '',
        code: c.codigo || c.code || '',
      }));

      // Mapear cuentas bancarias
      const accountsArray = Array.isArray(accountsData) ? accountsData : [];
      this.accounts = accountsArray.map((a: any) => ({
        id: a.id,
        label: a.nameAccount
          ? `${a.nameAccount} - ${a.bankName}`
          : a.number || a.description || '',
      }));

      console.log('Datos cargados:', {
        egresos: this.egresos.length,
        proyectos: this.projects.length,
        proveedores: this.providers.length,
        cuentas: this.cuentasContables.length,
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
    const meses = [
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

    // Filtrar por rango de fechas
    const filtered = this.egresos.filter((egreso) => {
      const fechaStr = egreso.date || egreso.dateStamped;
      if (!fechaStr) return false;

      const fecha = new Date(fechaStr);
      if (isNaN(fecha.getTime())) return false;

      const fechaFormatted = this.formatDateForInput(fecha);
      return (
        fechaFormatted >= this.fechaInicio && fechaFormatted <= this.fechaFin
      );
    });

    // Procesar cada egreso
    this.concentradoEgresos = filtered
      .map((egreso) => {
        const fecha = egreso.date ? new Date(egreso.date) : null;
        const mes = fecha ? meses[fecha.getMonth()] : '';
        const anioEjercicio = fecha
          ? fecha.getFullYear()
          : new Date().getFullYear();

        // Obtener proyecto
        const project = this.projects.find((p) => p.id === egreso.idProject);

        // Obtener proveedor (desde idCustomer, campo usado en expenditure)
        const provider = this.providers.find((p) => p.id === egreso.idCustomer);

        // Obtener cliente (desde idClient)
        const client = this.clients.find((c) => c.id === egreso.idClient);

        // Obtener clasificación y subclasificación (desde cuentas contables, como en expenditure)
        const clasificacionCuenta = this.cuentasContables.find(
          (c) => c.id === egreso.idClasificacion,
        );
        const subclasificacionCuenta = this.cuentasContables.find(
          (c) => c.id === egreso.idSubclasificacion,
        );

        // Obtener cuenta bancaria (id_account → Accounts)
        const accountId = egreso.idAccount ?? egreso.id_account;
        const account = this.accounts.find((a) => a.id === accountId);

        // Tipo de pago: código SAT + nombre
        const formaPagoCodigo = egreso.formaPago || egreso.forma_pago || '';
        const formaPagoNombre = this.SAT_FORMAS_PAGO[formaPagoCodigo] || '';
        const tipoPago = formaPagoCodigo
          ? formaPagoNombre
            ? `${formaPagoCodigo} - ${formaPagoNombre}`
            : formaPagoCodigo
          : '';

        // Calcular importes
        const subtotal = Number(egreso.subtotal) || 0;
        const iva = Number(egreso.tax) || 0;
        const otrosImpuestos = Number(egreso.otherTaxes) || 0;
        const total = Number(egreso.total) || 0;

        return {
          id: egreso.id,
          proveedor: provider?.name || '',
          empresa: client?.name || '',
          observaciones: egreso.observaciones || '',
          proyecto: project?.name || '',
          fecha,
          mes,
          anioEjercicio,
          ejercicio: egreso.ejercicio || '',
          clasificacion: clasificacionCuenta
            ? `${clasificacionCuenta.code} - ${clasificacionCuenta.name}`
            : '',
          subclasificacion: subclasificacionCuenta
            ? `${subclasificacionCuenta.code} - ${subclasificacionCuenta.name}`
            : '',
          concepto: egreso.concept || egreso.description || '',
          importeSinIva: subtotal,
          iva,
          otrosImpuestos,
          importeTotal: total,
          numeroFactura:
            egreso.uuid && egreso.uuid !== 'NA'
              ? egreso.uuid
              : egreso.numberDocument || '',
          tipoPago,
          cuenta: account?.label || '',
        };
      })
      .sort((a, b) => {
        // Ordenar por fecha descendente
        if (!a.fecha) return 1;
        if (!b.fecha) return -1;
        return b.fecha.getTime() - a.fecha.getTime();
      });

    // Calcular totales
    this.totales = this.concentradoEgresos.reduce(
      (acc, e) => ({
        importeSinIva: acc.importeSinIva + e.importeSinIva,
        iva: acc.iva + e.iva,
        otrosImpuestos: acc.otrosImpuestos + e.otrosImpuestos,
        importeTotal: acc.importeTotal + e.importeTotal,
      }),
      {
        importeSinIva: 0,
        iva: 0,
        otrosImpuestos: 0,
        importeTotal: 0,
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
          tableCell: { fontSize: 5.5, color: '#333333' },
          tableCellRight: {
            fontSize: 5.5,
            color: '#333333',
            alignment: 'right',
          },
          tableCellMoney: {
            fontSize: 5.5,
            color: '#333333',
            alignment: 'right',
          },
          totalRow: { fontSize: 6, bold: true, fillColor: '#e2e8f0' },
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
      const fileName = `concentrado-egresos-${this.fechaInicio}-al-${this.fechaFin}.pdf`;
      await this.pdfWorkerService.generateAndDownload(
        docDefinition,
        fileName,
        footerTemplate,
      );

      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Exportación PDF - Concentrado de Egresos',
        'Concentrado Egresos',
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
                  text: 'Concentrado de Egresos',
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
              ],
            },
            {
              stack: [
                {
                  text: 'Referencia: HCO-ADM-SGC-005',
                  fontSize: 7,
                  alignment: 'right',
                },
                {
                  text: 'Código: HCO-ADM-FO-016',
                  fontSize: 7,
                  alignment: 'right',
                },
                { text: 'Rev.: 01', fontSize: 7, alignment: 'right' },
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
      'EMPRESA',
      'PROYECTO',
      'FECHA',
      'MES',
      'AÑO',
      'EJERCICIO',
      'CLASIFICACION',
      'SUBCLASIFICACION',
      'CONCEPTO',
      'IMPORTE S/IVA',
      'IVA',
      'OTROS IMPUESTOS',
      'IMPORTE TOTAL',
      '# FACTURA',
      'PROVEEDOR',
      'OBSERVACIONES',
      'TIPO DE PAGO',
      'CUENTA',
    ];

    const body: any[] = [
      headers.map((h) => ({
        text: h,
        style: 'tableHeader',
        alignment: 'center',
      })),
    ];

    this.concentradoEgresos.forEach((e) => {
      body.push([
        { text: e.empresa, style: 'tableCell', alignment: 'left' },
        { text: e.proyecto, style: 'tableCell', alignment: 'left' },
        { text: this.formatDateShort(e.fecha), style: 'tableCell', alignment: 'center' },
        { text: e.mes, style: 'tableCell', alignment: 'center' },
        { text: e.anioEjercicio.toString(), style: 'tableCell', alignment: 'center' },
        { text: e.ejercicio, style: 'tableCell', alignment: 'center' },
        { text: e.clasificacion, style: 'tableCell', alignment: 'left' },
        { text: e.subclasificacion, style: 'tableCell', alignment: 'left' },
        { text: e.concepto, style: 'tableCell', alignment: 'left' },
        { text: this.formatCurrencyShort(e.importeSinIva), style: 'tableCellMoney' },
        { text: this.formatCurrencyShort(e.iva), style: 'tableCellMoney' },
        { text: e.otrosImpuestos > 0 ? this.formatCurrencyShort(e.otrosImpuestos) : '', style: 'tableCellMoney' },
        { text: this.formatCurrencyShort(e.importeTotal), style: 'tableCellMoney', bold: true },
        { text: e.numeroFactura, style: 'tableCell', alignment: 'center' },
        { text: e.proveedor, style: 'tableCell', alignment: 'left' },
        { text: e.observaciones || '', style: 'tableCell', alignment: 'left' },
        { text: e.tipoPago, style: 'tableCell', alignment: 'center' },
        { text: e.cuenta, style: 'tableCell', alignment: 'left' },
      ]);
    });

    // Fila de totales (18 columnas)
    body.push([
      { text: 'TOTAL', colSpan: 9, style: 'totalRow', alignment: 'right', bold: true },
      {}, {}, {}, {}, {}, {}, {}, {},
      { text: this.formatCurrencyShort(this.totales.importeSinIva), style: 'totalRow', alignment: 'right' },
      { text: this.formatCurrencyShort(this.totales.iva), style: 'totalRow', alignment: 'right' },
      { text: this.totales.otrosImpuestos > 0 ? this.formatCurrencyShort(this.totales.otrosImpuestos) : '', style: 'totalRow', alignment: 'right' },
      { text: this.formatCurrencyShort(this.totales.importeTotal), style: 'totalRow', alignment: 'right' },
      { text: '', style: 'totalRow' },
      { text: '', style: 'totalRow' },
      { text: '', style: 'totalRow' },
      { text: '', style: 'totalRow' },
      { text: '', style: 'totalRow' },
    ]);

    content.push({
      table: {
        headerRows: 1,
        widths: [
          '*',  // EMPRESA
          '*',  // PROYECTO
          46,   // FECHA
          28,   // MES
          26,   // AÑO
          26,   // EJERCICIO
          '*',  // CLASIFICACION
          '*',  // SUBCLASIFICACION
          '*',  // CONCEPTO
          55,   // IMPORTE S/IVA
          40,   // IVA
          46,   // OTROS IMPUESTOS
          55,   // IMPORTE TOTAL
          60,   // # FACTURA
          '*',  // PROVEEDOR
          '*',  // OBSERVACIONES
          42,   // TIPO DE PAGO
          '*',  // CUENTA
        ],
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
      const worksheet = workbook.addWorksheet('Concentrado Egresos');

      worksheet.views = [{ showGridLines: false }];

      // Título
      worksheet.mergeCells('A1:P1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'CONCENTRADO DE EGRESOS';
      titleCell.font = { bold: true, size: 14, color: { argb: 'FF1A5276' } };
      titleCell.alignment = { horizontal: 'center' };

      // Info
      worksheet.getCell('A2').value = `Empresa: ${this.companyName}`;
      worksheet.getCell('A3').value =
        `Período: ${this.fechaInicio} al ${this.fechaFin}`;

      // Headers
      const headers = [
        'EMPRESA',
        'PROYECTO',
        'FECHA',
        'MES',
        'AÑO',
        'EJERCICIO',
        'CLASIFICACION',
        'SUBCLASIFICACION',
        'CONCEPTO',
        'IMPORTE S/IVA',
        'IVA',
        'OTROS IMPUESTOS',
        'IMPORTE TOTAL',
        '# FACTURA',
        'PROVEEDOR',
        'OBSERVACIONES',
        'TIPO DE PAGO',
        'CUENTA',
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
      this.concentradoEgresos.forEach((e) => {
        const row = worksheet.getRow(rowIndex);
        row.getCell(1).value = e.empresa;
        row.getCell(2).value = e.proyecto;
        row.getCell(3).value = e.fecha ? this.formatDateShort(e.fecha) : '';
        row.getCell(4).value = e.mes;
        row.getCell(5).value = e.anioEjercicio;
        row.getCell(6).value = e.ejercicio;
        row.getCell(7).value = e.clasificacion;
        row.getCell(8).value = e.subclasificacion;
        row.getCell(9).value = e.concepto;
        row.getCell(10).value = e.importeSinIva;
        row.getCell(10).numFmt = '"$"#,##0.00';
        row.getCell(11).value = e.iva;
        row.getCell(11).numFmt = '"$"#,##0.00';
        row.getCell(12).value = e.otrosImpuestos || '';
        if (e.otrosImpuestos) row.getCell(12).numFmt = '"$"#,##0.00';
        row.getCell(13).value = e.importeTotal;
        row.getCell(13).numFmt = '"$"#,##0.00';
        row.getCell(13).font = { bold: true };
        row.getCell(14).value = e.numeroFactura;
        row.getCell(15).value = e.proveedor;
        row.getCell(16).value = e.observaciones || '';
        row.getCell(17).value = e.tipoPago;
        row.getCell(18).value = e.cuenta;
        rowIndex++;
      });

      // Fila totales
      const totalRow = worksheet.getRow(rowIndex);
      totalRow.getCell(1).value = 'TOTAL';
      totalRow.font = { bold: true };
      totalRow.getCell(10).value = this.totales.importeSinIva;
      totalRow.getCell(10).numFmt = '"$"#,##0.00';
      totalRow.getCell(11).value = this.totales.iva;
      totalRow.getCell(11).numFmt = '"$"#,##0.00';
      totalRow.getCell(12).value = this.totales.otrosImpuestos || '';
      if (this.totales.otrosImpuestos)
        totalRow.getCell(12).numFmt = '"$"#,##0.00';
      totalRow.getCell(13).value = this.totales.importeTotal;
      totalRow.getCell(13).numFmt = '"$"#,##0.00';
      totalRow.getCell(13).font = { bold: true, color: { argb: 'FFDC2626' } };

      // Anchos (18 columnas)
      worksheet.columns = [
        { width: 20 }, // EMPRESA
        { width: 18 }, // PROYECTO
        { width: 12 }, // FECHA
        { width: 10 }, // MES
        { width: 8  }, // AÑO
        { width: 12 }, // EJERCICIO
        { width: 22 }, // CLASIFICACION
        { width: 25 }, // SUBCLASIFICACION
        { width: 30 }, // CONCEPTO
        { width: 14 }, // IMPORTE S/IVA
        { width: 12 }, // IVA
        { width: 14 }, // OTROS IMPUESTOS
        { width: 14 }, // IMPORTE TOTAL
        { width: 20 }, // # FACTURA
        { width: 20 }, // PROVEEDOR
        { width: 25 }, // OBSERVACIONES
        { width: 18 }, // TIPO DE PAGO
        { width: 22 }, // CUENTA
      ];

      // Generar archivo
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `concentrado-egresos-${this.fechaInicio}-al-${this.fechaFin}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Exportación XLSX - Concentrado de Egresos',
        'Concentrado Egresos',
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
