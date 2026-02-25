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

// Interfaz para datos por trimestre
export interface DatosTrimestre {
  periodo: string;
  anio: number;
  trimestre: number;
  egresoMensual: number;
  ingresoSinIva: number;
  flujoMensual: number;
  esTotalAnio?: boolean;
  esTotalGeneral?: boolean;
}

@Component({
  selector: 'app-compuesto-negocio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './compuesto-negocio.component.html',
  styleUrl: './compuesto-negocio.component.scss'
})
export class CompuestoNegocioComponent {
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
  public datosTrimestre: DatosTrimestre[] = [];

  // Totales generales
  public totales = {
    egresoMensual: 0,
    ingresoSinIva: 0,
    flujoMensual: 0
  };

  constructor() {
    const today = new Date();
    this.fechaActual = this.formatDateDisplay(today);
    this.anioFin = today.getFullYear();
    this.anioInicio = this.anioFin - 3;

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

  private getTrimestreFromMonth(month: number): number {
    if (month <= 2) return 1;      // Ene, Feb, Mar
    if (month <= 5) return 2;      // Abr, May, Jun
    if (month <= 8) return 3;      // Jul, Ago, Sep
    return 4;                       // Oct, Nov, Dic
  }

  private processData(): void {
    // Agrupar por año y trimestre
    const datosPorTrimestreAnio = new Map<string, { egreso: number; ingreso: number }>();

    // Procesar ingresos
    this.ingresos.forEach(ingreso => {
      const fechaStr = ingreso.date || ingreso.dateStamped;
      if (!fechaStr) return;

      const fecha = new Date(fechaStr);
      if (isNaN(fecha.getTime())) return;

      const anio = fecha.getFullYear();
      if (anio < this.anioInicio || anio > this.anioFin) return;

      const trimestre = this.getTrimestreFromMonth(fecha.getMonth());
      const key = `${anio}-${trimestre}`;

      const current = datosPorTrimestreAnio.get(key) || { egreso: 0, ingreso: 0 };
      current.ingreso += Number(ingreso.subtotal) || Number(ingreso.total) || 0;
      datosPorTrimestreAnio.set(key, current);
    });

    // Procesar egresos
    this.egresos.forEach(egreso => {
      const fechaStr = egreso.date || egreso.dateStamped;
      if (!fechaStr) return;

      const fecha = new Date(fechaStr);
      if (isNaN(fecha.getTime())) return;

      const anio = fecha.getFullYear();
      if (anio < this.anioInicio || anio > this.anioFin) return;

      const trimestre = this.getTrimestreFromMonth(fecha.getMonth());
      const key = `${anio}-${trimestre}`;

      const current = datosPorTrimestreAnio.get(key) || { egreso: 0, ingreso: 0 };
      current.egreso += Number(egreso.subtotal) || Number(egreso.total) || 0;
      datosPorTrimestreAnio.set(key, current);
    });

    // Construir array con trimestres y totales por año
    this.datosTrimestre = [];
    let flujoAcumulado = 0;

    for (let anio = this.anioInicio; anio <= this.anioFin; anio++) {
      let totalEgresoAnio = 0;
      let totalIngresoAnio = 0;

      for (let trimestre = 1; trimestre <= 4; trimestre++) {
        const key = `${anio}-${trimestre}`;
        const datos = datosPorTrimestreAnio.get(key) || { egreso: 0, ingreso: 0 };

        // Solo agregar trimestres que tengan datos o estén en el rango
        const flujo = datos.ingreso - datos.egreso;
        flujoAcumulado += flujo;

        this.datosTrimestre.push({
          periodo: `Total Trimestre ${trimestre}-${anio}`,
          anio,
          trimestre,
          egresoMensual: datos.egreso,
          ingresoSinIva: datos.ingreso,
          flujoMensual: flujoAcumulado
        });

        totalEgresoAnio += datos.egreso;
        totalIngresoAnio += datos.ingreso;
      }

      // Total del año
      this.datosTrimestre.push({
        periodo: `Total ${anio}`,
        anio,
        trimestre: 0,
        egresoMensual: totalEgresoAnio,
        ingresoSinIva: totalIngresoAnio,
        flujoMensual: flujoAcumulado,
        esTotalAnio: true
      });
    }

    // Calcular totales generales
    this.totales = {
      egresoMensual: this.datosTrimestre
        .filter(d => !d.esTotalAnio)
        .reduce((acc, d) => acc + d.egresoMensual, 0),
      ingresoSinIva: this.datosTrimestre
        .filter(d => !d.esTotalAnio)
        .reduce((acc, d) => acc + d.ingresoSinIva, 0),
      flujoMensual: flujoAcumulado
    };

    // Agregar fila de total general
    this.datosTrimestre.push({
      periodo: 'Total General',
      anio: 0,
      trimestre: 0,
      egresoMensual: this.totales.egresoMensual,
      ingresoSinIva: this.totales.ingresoSinIva,
      flujoMensual: this.totales.flujoMensual,
      esTotalGeneral: true
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  public async exportToPdf(): Promise<void> {
    if (this.isExportingPdf || this.isExportingXlsx) return;
    this.isExportingPdf = true;

    try {
      const pdfMake = (await import('pdfmake/build/pdfmake')).default;
      const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
      (pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

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
          tableCellMoney: { fontSize: 9, color: '#333333', alignment: 'right' },
          totalAnio: { fontSize: 9, bold: true, fillColor: '#c7d2fe', color: '#1e3a8a' },
          totalGeneral: { fontSize: 10, bold: true, fillColor: '#1a365d', color: '#FFFFFF' }
        }
      };

      const pdf = pdfMake.createPdf(docDefinition);
      try {
        pdf.open();
      } catch {
        pdf.download(`compuesto-negocio-${new Date().toISOString().split('T')[0]}.pdf`);
        alerts.basicAlert('Reporte descargado', 'El navegador bloqueó la ventana emergente. El reporte se descargó automáticamente.', 'info');
      }

      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Exportación PDF - Compuesto Negocio',
        'Compuesto Negocio',
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
              { text: 'COMPUESTO NEGOCIO', fontSize: 14, bold: true, alignment: 'center', color: '#1a365d' },
              { text: 'Flujo de Efectivo por Trimestre', fontSize: 10, alignment: 'center', color: '#666' }
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

    const headers = ['MES', 'EGRESO MENSUAL S/IVA', 'INGRESO S/IVA', 'FLUJO MENSUAL'];

    const body: any[] = [
      headers.map(h => ({ text: h, style: 'tableHeader', alignment: 'center' }))
    ];

    this.datosTrimestre.forEach(d => {
      if (d.esTotalGeneral) {
        body.push([
          { text: d.periodo, style: 'totalGeneral' },
          { text: this.formatCurrencyShort(d.egresoMensual), style: 'totalGeneral', alignment: 'right' },
          { text: this.formatCurrencyShort(d.ingresoSinIva), style: 'totalGeneral', alignment: 'right' },
          { text: this.formatCurrencyShort(d.flujoMensual), style: 'totalGeneral', alignment: 'right' }
        ]);
      } else if (d.esTotalAnio) {
        body.push([
          { text: d.periodo, style: 'totalAnio' },
          { text: this.formatCurrencyShort(d.egresoMensual), style: 'totalAnio', alignment: 'right' },
          { text: this.formatCurrencyShort(d.ingresoSinIva), style: 'totalAnio', alignment: 'right' },
          { text: this.formatCurrencyShort(d.flujoMensual), style: 'totalAnio', alignment: 'right', color: d.flujoMensual >= 0 ? '#166534' : '#dc2626' }
        ]);
      } else {
        body.push([
          { text: d.periodo, style: 'tableCell', color: '#1e40af' },
          { text: this.formatCurrencyShort(d.egresoMensual), style: 'tableCellMoney' },
          { text: this.formatCurrencyShort(d.ingresoSinIva), style: 'tableCellMoney' },
          { text: this.formatCurrencyShort(d.flujoMensual), style: 'tableCellMoney', color: d.flujoMensual >= 0 ? '#166534' : '#dc2626' }
        ]);
      }
    });

    content.push({
      table: {
        headerRows: 1,
        widths: ['*', 100, 100, 100],
        body
      },
      layout: {
        hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.3,
        vLineWidth: () => 0.3,
        hLineColor: () => '#aaa',
        vLineColor: () => '#ccc'
      }
    });

    return content;
  }

  public async exportToXlsx(): Promise<void> {
    if (this.isExportingPdf || this.isExportingXlsx) return;
    this.isExportingXlsx = true;

    try {
      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet('Compuesto Negocio');

      worksheet.views = [{ showGridLines: false }];

      // Título
      worksheet.mergeCells('A1:D1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'COMPUESTO NEGOCIO - FLUJO DE EFECTIVO POR TRIMESTRE';
      titleCell.font = { bold: true, size: 14, color: { argb: 'FF1A365D' } };
      titleCell.alignment = { horizontal: 'center' };

      worksheet.getCell('A2').value = `Empresa: ${this.companyName}`;
      worksheet.getCell('A3').value = `Período: ${this.anioInicio} - ${this.anioFin}`;

      // Headers
      const headers = ['MES', 'EGRESO MENSUAL S/IVA', 'INGRESO S/IVA', 'FLUJO MENSUAL'];
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
      this.datosTrimestre.forEach(d => {
        const row = worksheet.getRow(rowIndex);

        row.getCell(1).value = d.periodo;
        row.getCell(2).value = d.egresoMensual;
        row.getCell(2).numFmt = '"$"#,##0.00';
        row.getCell(3).value = d.ingresoSinIva;
        row.getCell(3).numFmt = '"$"#,##0.00';
        row.getCell(4).value = d.flujoMensual;
        row.getCell(4).numFmt = '"$"#,##0.00';

        if (d.esTotalGeneral) {
          row.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } };
          });
        } else if (d.esTotalAnio) {
          row.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FF1E3A8A' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC7D2FE' } };
          });
        } else {
          row.getCell(1).font = { color: { argb: 'FF1E40AF' } };
        }

        // Color del flujo según sea positivo o negativo
        if (!d.esTotalGeneral) {
          row.getCell(4).font = {
            ...row.getCell(4).font,
            color: { argb: d.flujoMensual >= 0 ? 'FF166534' : 'FFDC2626' }
          };
        }

        rowIndex++;
      });

      // Anchos
      worksheet.columns = [
        { width: 25 }, { width: 20 }, { width: 18 }, { width: 18 }
      ];

      // Generar archivo
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `compuesto-negocio-${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Exportación XLSX - Compuesto Negocio',
        'Compuesto Negocio',
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
