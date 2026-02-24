import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { SignalsService } from 'app/services/signals.service';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { TrackingService } from 'app/services/tracking.service';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom } from 'rxjs';
import { Workbook } from 'exceljs';

// Interfaz para los datos del reporte por año
export interface FacturacionAnual {
  anio: number;
  montoTotalOC: number;
  montoTotalFacturado: number;
  montoTotalPagado: number;
  cuentasPorCobrar: number;
  gastosTotales: number;
  diferenciaPagadoVsGastos: number;
}

@Component({
  selector: 'app-reporte-facturacion-anual',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reporte-facturacion-anual.component.html',
  styleUrl: './reporte-facturacion-anual.component.scss'
})
export class ReporteFacturacionAnualComponent {
  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  private signalsService = inject(SignalsService);
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);
  private trackingService = inject(TrackingService);

  // Estado del componente
  public rootId: number;
  public companyName: string = '';
  public fechaActual: string = '';
  public isExportingPdf = false;
  public isExportingXlsx = false;
  public isLoading = true;

  // Filtros de año
  public anioInicio: number;
  public anioFin: number;
  public aniosDisponibles: number[] = [];

  // Datos crudos
  private ingresos: any[] = [];
  private egresos: any[] = [];

  // Datos procesados para el reporte
  public facturacionAnual: FacturacionAnual[] = [];

  // Totales
  public totales = {
    montoTotalOC: 0,
    montoTotalFacturado: 0,
    montoTotalPagado: 0,
    cuentasPorCobrar: 0,
    gastosTotales: 0,
    diferenciaPagadoVsGastos: 0
  };

  constructor() {
    // Establecer año actual y rango por defecto
    const today = new Date();
    this.fechaActual = this.formatDateDisplay(today);
    this.anioFin = today.getFullYear();
    this.anioInicio = this.anioFin - 2; // Últimos 3 años por defecto

    // Generar años disponibles (últimos 10 años)
    for (let i = this.anioFin; i >= this.anioFin - 10; i--) {
      this.aniosDisponibles.push(i);
    }

    effect(() => {
      this.rootId = this.signalsService.getRootSelectedBySidebar()();
      if (this.rootId) {
        this.loadAllData();
      }
    }, { allowSignalWrites: true });
  }

  public onFilterChange(): void {
    if (this.rootId && !this.isLoading) {
      // Asegurar que año inicio <= año fin
      if (this.anioInicio > this.anioFin) {
        const temp = this.anioInicio;
        this.anioInicio = this.anioFin;
        this.anioFin = temp;
      }
      this.processData();
    }
  }

  private formatDateDisplay(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const month = months[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);
    return `${day}-${month}-${year}`;
  }

  private async loadAllData(): Promise<void> {
    this.isLoading = true;
    try {
      const [rootData, incomesData] = await Promise.all([
        lastValueFrom(this.rootService.getRootbyId(this.rootId)),
        lastValueFrom(this.incomesAndExpensesService.getIncomesAndExpenses(this.rootId))
      ]);

      this.companyName = (rootData as any)?.name || (rootData as any)?.nameCompany || 'Empresa';

      // Separar ingresos y egresos
      const allData = Array.isArray(incomesData) ? incomesData : [];
      this.ingresos = allData.filter(item => String(item?.type ?? '').toUpperCase() === 'DEPOSITO');
      this.egresos = allData.filter(item => String(item?.type ?? '').toUpperCase() === 'GASTO');

      console.log('Datos cargados:', {
        ingresos: this.ingresos.length,
        egresos: this.egresos.length
      });

      this.processData();
    } catch (error) {
      console.error('Error cargando datos:', error);
      alerts.basicAlert('Error', 'Error al cargar los datos del reporte', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  private processData(): void {
    // Agrupar ingresos y egresos por año
    const datosPorAnio = new Map<number, {
      montoTotalOC: number;
      montoTotalFacturado: number;
      montoTotalPagado: number;
      gastosTotales: number;
    }>();

    // Inicializar años en el rango
    for (let anio = this.anioInicio; anio <= this.anioFin; anio++) {
      datosPorAnio.set(anio, {
        montoTotalOC: 0,
        montoTotalFacturado: 0,
        montoTotalPagado: 0,
        gastosTotales: 0
      });
    }

    // Procesar ingresos
    this.ingresos.forEach(ingreso => {
      const fechaStr = ingreso.date || ingreso.dateStamped;
      if (!fechaStr) return;

      const fecha = new Date(fechaStr);
      if (isNaN(fecha.getTime())) return;

      const anio = fecha.getFullYear();
      if (anio < this.anioInicio || anio > this.anioFin) return;

      const current = datosPorAnio.get(anio)!;
      const subtotal = Number(ingreso.subtotal) || Number(ingreso.total) || 0;

      // Monto total facturado: todos los ingresos
      current.montoTotalFacturado += subtotal;

      // Monto total OC: ingresos que tienen OC (ordenCompra, oc, purchaseOrder, etc.)
      const tieneOC = ingreso.ordenCompra || ingreso.oc || ingreso.purchaseOrder ||
                      ingreso.numOC || ingreso.numeroOC || ingreso.ocNumber;
      if (tieneOC) {
        current.montoTotalOC += subtotal;
      }

      // Monto total pagado: ingresos con status "Pagada" o "Pagado"
      const status = String(ingreso.status || '').toLowerCase();
      if (status === 'pagada' || status === 'pagado' || status === 'paid') {
        current.montoTotalPagado += subtotal;
      }
    });

    // Procesar egresos (gastos)
    this.egresos.forEach(egreso => {
      const fechaStr = egreso.date || egreso.dateStamped;
      if (!fechaStr) return;

      const fecha = new Date(fechaStr);
      if (isNaN(fecha.getTime())) return;

      const anio = fecha.getFullYear();
      if (anio < this.anioInicio || anio > this.anioFin) return;

      const current = datosPorAnio.get(anio)!;
      const subtotal = Number(egreso.subtotal) || Number(egreso.total) || 0;

      // Gastos totales: todos los egresos
      current.gastosTotales += subtotal;
    });

    // Convertir a array y calcular cuentas por cobrar y diferencia
    this.facturacionAnual = Array.from(datosPorAnio.entries())
      .map(([anio, data]) => ({
        anio,
        montoTotalOC: data.montoTotalOC,
        montoTotalFacturado: data.montoTotalFacturado,
        montoTotalPagado: data.montoTotalPagado,
        cuentasPorCobrar: data.montoTotalFacturado - data.montoTotalPagado,
        gastosTotales: data.gastosTotales,
        diferenciaPagadoVsGastos: data.montoTotalPagado - data.gastosTotales
      }))
      .sort((a, b) => a.anio - b.anio);

    // Calcular totales
    this.totales = this.facturacionAnual.reduce((acc, f) => ({
      montoTotalOC: acc.montoTotalOC + f.montoTotalOC,
      montoTotalFacturado: acc.montoTotalFacturado + f.montoTotalFacturado,
      montoTotalPagado: acc.montoTotalPagado + f.montoTotalPagado,
      cuentasPorCobrar: acc.cuentasPorCobrar + f.cuentasPorCobrar,
      gastosTotales: acc.gastosTotales + f.gastosTotales,
      diferenciaPagadoVsGastos: acc.diferenciaPagadoVsGastos + f.diferenciaPagadoVsGastos
    }), {
      montoTotalOC: 0,
      montoTotalFacturado: 0,
      montoTotalPagado: 0,
      cuentasPorCobrar: 0,
      gastosTotales: 0,
      diferenciaPagadoVsGastos: 0
    });
  }

  public formatCurrency(value: number): string {
    if (!Number.isFinite(value)) return '$0.00';
    return value.toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  private formatCurrencyShort(value: number): string {
    if (!Number.isFinite(value)) return '$0';
    return '$' + value.toLocaleString('es-MX', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  public async exportToPdf(): Promise<void> {
    if (this.isExportingPdf || this.isExportingXlsx) return;
    this.isExportingPdf = true;

    try {
      const pdfMake = (await import('pdfmake/build/pdfmake')).default;
      const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
      (pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

      // Obtener logo
      const rootData: any = await lastValueFrom(this.rootService.getRootbyId(this.rootId));
      let logoBase64: string | null = null;
      if (rootData?.picture) {
        try {
          logoBase64 = await this.base64EncodeService.convertImageToBase64(rootData.picture);
        } catch (e) {
          console.warn('No se pudo cargar el logo');
        }
      }

      const content = this.buildPdfContent();

      const docDefinition: any = {
        pageSize: 'LETTER',
        pageOrientation: 'portrait',
        pageMargins: [40, 80, 40, 40],
        header: () => this.buildPdfHeader(logoBase64),
        footer: (currentPage: number, pageCount: number) => ({
          text: `Página ${currentPage} de ${pageCount}`,
          alignment: 'center',
          fontSize: 8,
          margin: [0, 10, 0, 0]
        }),
        content,
        styles: {
          tableHeader: { fontSize: 9, bold: true, color: '#FFFFFF', fillColor: '#1a365d' },
          tableCell: { fontSize: 9, color: '#333333' },
          tableCellRight: { fontSize: 9, color: '#333333', alignment: 'right' },
          tableCellMoney: { fontSize: 9, color: '#333333', alignment: 'right' },
          totalRow: { fontSize: 9, bold: true, fillColor: '#e2e8f0' },
          sectionTitle: { fontSize: 12, bold: true, color: '#1a365d', margin: [0, 15, 0, 10] }
        }
      };

      const pdf = pdfMake.createPdf(docDefinition);
      try {
        pdf.open();
      } catch {
        pdf.download(`reporte-facturacion-anual-${new Date().toISOString().split('T')[0]}.pdf`);
        alerts.basicAlert('Reporte descargado', 'El navegador bloqueó la ventana emergente. El reporte se descargó automáticamente.', 'info');
      }

      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Exportación PDF - Reporte Facturación Anual',
        'Reporte Facturación',
        this.trackingService.getEmail()
      );
    } catch (error) {
      console.error('Error exportando PDF:', error);
      alerts.basicAlert('Error', 'Error al generar el PDF', 'error');
    } finally {
      this.isExportingPdf = false;
    }
  }

  private buildPdfHeader(logoBase64: string | null): any {
    const logoCell = logoBase64
      ? { image: logoBase64, width: 50, alignment: 'left' }
      : { text: this.companyName, bold: true, fontSize: 12, alignment: 'left' };

    return {
      margin: [40, 15, 40, 0],
      table: {
        widths: ['20%', '*', '25%'],
        body: [[
          logoCell,
          {
            stack: [
              { text: 'REPORTE DE FACTURACIÓN ANUAL', fontSize: 14, bold: true, alignment: 'center', color: '#1a365d' },
              { text: this.companyName, fontSize: 10, alignment: 'center', color: '#666' }
            ]
          },
          {
            stack: [
              { text: `Período: ${this.anioInicio} - ${this.anioFin}`, fontSize: 9, alignment: 'right', color: '#333' },
              { text: `Fecha: ${this.fechaActual}`, fontSize: 9, alignment: 'right', color: '#666' }
            ]
          }
        ]]
      },
      layout: 'noBorders'
    };
  }

  private buildPdfContent(): any[] {
    const content: any[] = [];

    // Tabla de facturación anual
    const headers = ['Año', 'Monto OC', 'Facturado', 'Pagado', 'Ctas x Cobrar', 'Gastos', 'Dif. Pagado vs Gastos'];

    const body: any[] = [
      headers.map(h => ({ text: h, style: 'tableHeader', alignment: 'center' }))
    ];

    this.facturacionAnual.forEach(f => {
      body.push([
        { text: f.anio.toString(), style: 'tableCell', alignment: 'center' },
        { text: this.formatCurrencyShort(f.montoTotalOC), style: 'tableCellMoney' },
        { text: this.formatCurrencyShort(f.montoTotalFacturado), style: 'tableCellMoney' },
        { text: this.formatCurrencyShort(f.montoTotalPagado), style: 'tableCellMoney' },
        { text: this.formatCurrencyShort(f.cuentasPorCobrar), style: 'tableCellMoney', color: f.cuentasPorCobrar > 0 ? '#dc2626' : '#333' },
        { text: this.formatCurrencyShort(f.gastosTotales), style: 'tableCellMoney' },
        { text: this.formatCurrencyShort(f.diferenciaPagadoVsGastos), style: 'tableCellMoney', color: f.diferenciaPagadoVsGastos >= 0 ? '#15803d' : '#dc2626' }
      ]);
    });

    // Fila de totales
    body.push([
      { text: 'TOTAL', style: 'totalRow', alignment: 'center', bold: true },
      { text: this.formatCurrencyShort(this.totales.montoTotalOC), style: 'totalRow', alignment: 'right' },
      { text: this.formatCurrencyShort(this.totales.montoTotalFacturado), style: 'totalRow', alignment: 'right' },
      { text: this.formatCurrencyShort(this.totales.montoTotalPagado), style: 'totalRow', alignment: 'right' },
      { text: this.formatCurrencyShort(this.totales.cuentasPorCobrar), style: 'totalRow', alignment: 'right', color: '#dc2626' },
      { text: this.formatCurrencyShort(this.totales.gastosTotales), style: 'totalRow', alignment: 'right' },
      { text: this.formatCurrencyShort(this.totales.diferenciaPagadoVsGastos), style: 'totalRow', alignment: 'right', color: this.totales.diferenciaPagadoVsGastos >= 0 ? '#15803d' : '#dc2626' }
    ]);

    content.push({
      table: {
        headerRows: 1,
        widths: [35, '*', '*', '*', '*', '*', '*'],
        body
      },
      layout: {
        hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.3,
        vLineWidth: () => 0.3,
        hLineColor: () => '#aaa',
        vLineColor: () => '#ccc',
        fillColor: (rowIndex: number) => rowIndex === 0 ? '#1a365d' : (rowIndex % 2 === 0 ? '#f8fafc' : null)
      }
    });

    return content;
  }

  public async exportToXlsx(): Promise<void> {
    if (this.isExportingPdf || this.isExportingXlsx) return;
    this.isExportingXlsx = true;

    try {
      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet('Facturación Anual');

      worksheet.views = [{ showGridLines: false }];

      // Título
      worksheet.mergeCells('A1:G1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'REPORTE DE FACTURACIÓN ANUAL';
      titleCell.font = { bold: true, size: 14, color: { argb: 'FF1A365D' } };
      titleCell.alignment = { horizontal: 'center' };

      // Info
      worksheet.getCell('A2').value = `Empresa: ${this.companyName}`;
      worksheet.getCell('A3').value = `Período: ${this.anioInicio} - ${this.anioFin}`;

      // Headers
      const headers = ['Año', 'Monto Total OC', 'Monto Total Facturado', 'Monto Total Pagado', 'Cuentas por Cobrar', 'Gastos Totales', 'Dif. Pagado vs Gastos'];
      const headerRow = worksheet.getRow(5);
      headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } };
        cell.alignment = { horizontal: 'center' };
      });

      // Datos
      let rowIndex = 6;
      this.facturacionAnual.forEach(f => {
        const row = worksheet.getRow(rowIndex);
        row.getCell(1).value = f.anio;
        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(2).value = f.montoTotalOC;
        row.getCell(2).numFmt = '"$"#,##0.00';
        row.getCell(3).value = f.montoTotalFacturado;
        row.getCell(3).numFmt = '"$"#,##0.00';
        row.getCell(4).value = f.montoTotalPagado;
        row.getCell(4).numFmt = '"$"#,##0.00';
        row.getCell(5).value = f.cuentasPorCobrar;
        row.getCell(5).numFmt = '"$"#,##0.00';
        if (f.cuentasPorCobrar > 0) {
          row.getCell(5).font = { color: { argb: 'FFDC2626' } };
        }
        row.getCell(6).value = f.gastosTotales;
        row.getCell(6).numFmt = '"$"#,##0.00';
        row.getCell(7).value = f.diferenciaPagadoVsGastos;
        row.getCell(7).numFmt = '"$"#,##0.00';
        row.getCell(7).font = { color: { argb: f.diferenciaPagadoVsGastos >= 0 ? 'FF15803D' : 'FFDC2626' } };
        rowIndex++;
      });

      // Fila totales
      const totalRow = worksheet.getRow(rowIndex);
      totalRow.getCell(1).value = 'TOTAL';
      totalRow.font = { bold: true };
      totalRow.getCell(2).value = this.totales.montoTotalOC;
      totalRow.getCell(2).numFmt = '"$"#,##0.00';
      totalRow.getCell(3).value = this.totales.montoTotalFacturado;
      totalRow.getCell(3).numFmt = '"$"#,##0.00';
      totalRow.getCell(4).value = this.totales.montoTotalPagado;
      totalRow.getCell(4).numFmt = '"$"#,##0.00';
      totalRow.getCell(5).value = this.totales.cuentasPorCobrar;
      totalRow.getCell(5).numFmt = '"$"#,##0.00';
      totalRow.getCell(6).value = this.totales.gastosTotales;
      totalRow.getCell(6).numFmt = '"$"#,##0.00';
      totalRow.getCell(7).value = this.totales.diferenciaPagadoVsGastos;
      totalRow.getCell(7).numFmt = '"$"#,##0.00';

      // Anchos
      worksheet.columns = [
        { width: 10 }, { width: 18 }, { width: 22 }, { width: 20 }, { width: 20 }, { width: 18 }, { width: 22 }
      ];

      // Generar archivo
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte-facturacion-anual-${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Exportación XLSX - Reporte Facturación Anual',
        'Reporte Facturación',
        this.trackingService.getEmail()
      );

      alerts.basicAlert('Éxito', 'Archivo Excel generado correctamente', 'success');
    } catch (error) {
      console.error('Error exportando XLSX:', error);
      alerts.basicAlert('Error', 'Error al generar el archivo Excel', 'error');
    } finally {
      this.isExportingXlsx = false;
    }
  }
}
