import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { SignalsService } from 'app/services/signals.service';
import { CuentasContablesService } from 'app/services/cuentas-contables.service';

import { ProjectsService } from 'app/services/projects.service';
import { EmployeesService } from 'app/services/employees.service';
import { forkJoin, lastValueFrom, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { ICuentaContable } from 'app/interface/icuentas-contables';
import { NgApexchartsModule, ChartComponent } from 'ng-apexcharts';
import { Workbook } from 'exceljs';
import { PdfWorkerService } from 'app/services/pdf-worker.service';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexTitleSubtitle,
  ApexLegend,
  ApexYAxis,
  ApexNonAxisChartSeries,
  ApexTooltip,
  ApexStroke,
  ApexFill,
} from 'ng-apexcharts';

// Tipos para las gráficas
export type LineChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  title: ApexTitleSubtitle;
  stroke: ApexStroke;
  tooltip: ApexTooltip;
  fill: ApexFill;
  legend: ApexLegend;
};

export type PieChartOptions = {
  series: ApexNonAxisChartSeries;
  chart: ApexChart;
  labels: any;
  title: ApexTitleSubtitle;
  legend: ApexLegend;
  colors: string[];
  plotOptions: any;
};

// Interfaz para clasificación de gastos (basada en cuentas contables)
export interface ClasificacionContable {
  codigo: string;
  nombre: string;
  gastoAnterior: number;
  gastoMesActual: number;
  gastoAcumulado: number;
  tipo: 'INGRESO' | 'EGRESO' | 'OTRO';
}

// Interfaz para flujo mensual
export interface FlujoMensual {
  mes: string;
  anio: number;
  egresoMensual: number;
  ingresoMensual: number;
  flujoMensual: number;
  flujoAcumulado: number;
}

@Component({
  selector: 'app-dashboard-hco',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, FormsModule],
  templateUrl: './dashboard-hco.component.html',
  styleUrl: './dashboard-hco.component.scss',
})
export class DashboardHcoComponent {
  @ViewChild('personalChartRef') private personalChartRef?: ChartComponent;
  @ViewChild('pieChartRef') private pieChartRef?: ChartComponent;
  @ViewChild('combustibleChartRef')
  private combustibleChartRef?: ChartComponent;
  @ViewChild('lineChartRef') private lineChartRef?: ChartComponent;

  private pdfWorkerService = inject(PdfWorkerService);
  private cdr = inject(ChangeDetectorRef);

  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  private cuentasContablesService = inject(CuentasContablesService);
  private signalsService = inject(SignalsService);

  private projectsService = inject(ProjectsService);
  private employeesService = inject(EmployeesService);
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);

  // Estado del componente
  public rootId: number;
  public startDate: string = '';
  public endDate: string = '';
  public selectedYear: number | null = null;
  public availableYears: number[] = [];
  public isExportingPdf = false;
  public isExportingXlsx = false;

  // Flags de carga — todos deben ser true para habilitar exportación
  private _loadedEmployees = false;
  private _loadedProjects = false;
  private _loadedCuentas = false;
  private _loadedEgresos = false;
  public isDataReady = false;

  private checkDataReady(): void {
    this.isDataReady =
      this._loadedEmployees &&
      this._loadedProjects &&
      this._loadedCuentas &&
      this._loadedEgresos;
  }

  private resetLoadFlags(): void {
    this._loadedEmployees = false;
    this._loadedProjects = false;
    this._loadedCuentas = false;
    this._loadedEgresos = false;
    this.isDataReady = false;
  }

  // Datos crudos - separados por tipo
  private egresosData: any[] = [];
  private ingresosData: any[] = [];
  private cuentasContablesNivel2: ICuentaContable[] = [];

  // KPIs
  public totalEgresos: number = 0;
  public totalIngresos: number = 0;
  public flujoNeto: number = 0;
  public margenPorcentaje: number = 0;

  // Datos para tablas - Solo clasificación de EGRESOS
  public clasificacionEgresos: ClasificacionContable[] = [];
  public flujoMensual: FlujoMensual[] = [];
  public totalesPorAnio: {
    anio: number;
    egreso: number;
    ingreso: number;
    flujo: number;
  }[] = [];

  // Opciones de gráficas
  public pieChartOptions: Partial<PieChartOptions>;
  public lineChartOptions: Partial<LineChartOptions>;
  public combustiblePieChartOptions: Partial<PieChartOptions>;
  public personalPieChartOptions: Partial<PieChartOptions>;

  // Datos de personal

  private projectsList: any[] = [];
  private allEmployees: any[] = [];
  private allEmployeeProjects: any[] = [];
  private nominaRecordsCache: any[] = [];
  private branchesList: any[] = [];
  public totalPersonal: number = 0;

  // Datos de combustible
  public totalCombustible: number = 0;

  // Datos de nómina
  public totalNomina: number = 0;
  public nominaByCategory: { label: string; amount: number }[] = [];

  constructor() {
    // Inicializar fechas por defecto (últimos 24 meses para tener histórico)
    const today = new Date();
    const twentyFourMonthsAgo = new Date(
      new Date().setMonth(today.getMonth() - 24),
    );
    const pad = (n: number) => String(n).padStart(2, '0');
    this.endDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    this.startDate = `${twentyFourMonthsAgo.getFullYear()}-${pad(twentyFourMonthsAgo.getMonth() + 1)}-${pad(twentyFourMonthsAgo.getDate())}`;

    // Generar años disponibles para el filtro
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 5; i <= currentYear; i++) {
      this.availableYears.push(i);
    }

    effect(
      () => {
        this.rootId = this.signalsService.getRootSelectedBySidebar()();
        if (this.rootId) {
          this.loadData(this.rootId);
        }
      },
      { allowSignalWrites: true },
    );
  }

  public onFilterChange(): void {
    this.processAllData();
  }

  public async exportToPdf(): Promise<void> {
    if (this.isExportingPdf || this.isExportingXlsx) return;
    this.isExportingPdf = true;

    try {
      // Obtener logo de la empresa
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

      const [pieChart, barChart, combustibleChart, lineChart] =
        await Promise.all([
          this.captureChartAsBase64(this.personalChartRef),
          this.captureChartAsBase64(this.pieChartRef),
          this.captureChartAsBase64(this.combustibleChartRef),
          this.captureChartAsBase64(this.lineChartRef),
        ]);

      const content = this.buildStructuredPdfContent({
        pieChart,
        barChart,
        combustibleChart,
        lineChart,
      });

      const documentDefinition = {
        pageSize: 'TABLOID',
        pageOrientation: 'landscape',
        pageMargins: [20, 65, 20, 20],
        header: this.buildPdfHeader(logoBase64),
        content,
        styles: {
          title: {
            bold: true,
            color: '#1A365D',
            fontSize: 14,
            alignment: 'center',
          },
          subtitle: { color: '#475569', fontSize: 10, alignment: 'center' },
          sectionTitle: {
            bold: true,
            color: '#1A365D',
            fontSize: 10,
            margin: [0, 0, 0, 4],
          },
          kpiTitle: {
            bold: true,
            color: '#475569',
            fontSize: 8,
            alignment: 'center',
          },
          kpiValue: {
            bold: true,
            color: '#0F172A',
            fontSize: 11,
            alignment: 'center',
          },
          tableHeader: { bold: true, color: '#FFFFFF', fontSize: 8 },
          tableCell: { fontSize: 7.5, color: '#334155' },
          tableCellRight: {
            fontSize: 7.5,
            color: '#334155',
            alignment: 'right',
          },
          totalLabel: { bold: true, fontSize: 8, color: '#0F172A' },
          totalValue: {
            bold: true,
            fontSize: 8,
            color: '#0F172A',
            alignment: 'right',
          },
        },
      };

      await this.pdfWorkerService.generateAndDownload(
        documentDefinition,
        this.getExportFileName('pdf'),
      );
    } catch (error) {
      console.error('Error exportando dashboard a PDF:', error);
      alerts.basicAlert(
        'Error',
        'No fue posible exportar el dashboard a PDF.',
        'error',
      );
    } finally {
      this.isExportingPdf = false;
    }
  }

  private buildStructuredPdfContent(images: {
    pieChart: string | null;
    barChart: string | null;
    combustibleChart: string | null;
    lineChart: string | null;
  }): any[] {
    const kpiTable = {
      table: {
        widths: ['25%', '25%', '25%', '25%'],
        body: [
          [
            this.buildPdfKpiCell(
              'EGRESOS TOTALES',
              this.formatCurrency(this.totalEgresos),
              '#DC2626',
            ),
            this.buildPdfKpiCell(
              'INGRESOS TOTALES',
              this.formatCurrency(this.totalIngresos),
              '#16A34A',
            ),
            this.buildPdfKpiCell(
              'FLUJO NETO',
              this.formatCurrency(this.flujoNeto),
              this.flujoNeto >= 0 ? '#2563EB' : '#DC2626',
            ),
            this.buildPdfKpiCell(
              'MARGEN',
              `${this.margenPorcentaje.toFixed(1)}%`,
              '#7C3AED',
            ),
          ],
        ],
      },
      layout: 'siafKpi',
      margin: [0, 8, 0, 12],
    };

    const rightColumnCharts: any[] = [];
    if (images.barChart) {
      rightColumnCharts.push({
        text: 'GASTO TOTAL ACUMULADO',
        style: 'sectionTitle',
        alignment: 'center',
        margin: [0, 0, 0, 2],
      });
      rightColumnCharts.push({ image: images.barChart, width: 285, margin: [0, 0, 0, 10] });
    }
    if (images.pieChart) {
      rightColumnCharts.push({
        text: 'CANTIDAD DE PERSONAL',
        style: 'sectionTitle',
        alignment: 'center',
        margin: [0, 0, 0, 2],
      });
      rightColumnCharts.push({ image: images.pieChart, width: 285, margin: [0, 0, 0, 6] });
    }
    if (images.combustibleChart) {
      rightColumnCharts.push({
        text: 'CONSUMO DE COMBUSTIBLE',
        style: 'sectionTitle',
        alignment: 'center',
        margin: [0, 0, 0, 2],
      });
      rightColumnCharts.push({ image: images.combustibleChart, width: 285, margin: [0, 0, 0, 10] });
    }
    if (rightColumnCharts.length === 0) {
      rightColumnCharts.push({
        text: 'Sin graficas para mostrar',
        style: 'tableCell',
      });
    }

    const leftColumnStack: any[] = [
      this.buildPdfClasificacionTable(),
      { text: ' ', margin: [0, 4, 0, 4] },
      { text: 'GASTO E INGRESO POR MES', style: 'sectionTitle' },
      this.buildPdfFlujoMensualTable(),
    ];

    if (images.lineChart) {
      leftColumnStack.push({
        text: 'COMPORTAMIENTO DEL NEGOCIO',
        style: 'sectionTitle',
        margin: [0, 8, 0, 4],
      });
      leftColumnStack.push({ image: images.lineChart, fit: [760, 480] });
    }

    const content: any[] = [
      kpiTable,
      {
        columns: [
          { width: '*', stack: leftColumnStack },
          { width: 295, stack: rightColumnCharts },
        ],
        columnGap: 10,
      },
    ];

    return content;
  }

  private buildPdfHeader(logoBase64: string | null): any {
    const logoCell = logoBase64
      ? { image: logoBase64, width: 55, alignment: 'left' }
      : { text: '', alignment: 'left' };

    const mes = this.getMesActualNombre().toUpperCase();
    const anio = this.selectedYear || new Date().getFullYear();
    const titulo = `TABLERO DE GASTOS E INGRESOS ${mes}-${anio}`;

    return {
      margin: [20, 10, 20, 0],
      table: {
        widths: ['15%', '*', '20%'],
        body: [
          [
            logoCell,
            {
              stack: [
                {
                  text: titulo,
                  fontSize: 12,
                  bold: true,
                  alignment: 'center',
                  color: '#1A365D',
                },
                {
                  text: 'Sistema de Gestión de Calidad',
                  fontSize: 8,
                  alignment: 'center',
                  color: '#475569',
                  margin: [0, 2, 0, 0],
                },
              ],
            },
            {
              stack: [
                {
                  text: 'Referencia: HCO-ADM-SGC-005',
                  fontSize: 7,
                  alignment: 'right',
                  color: '#334155',
                },
                {
                  text: 'Código: HCO-ADM-FO-017',
                  fontSize: 7,
                  alignment: 'right',
                  color: '#334155',
                },
                {
                  text: 'Rev.: 00',
                  fontSize: 7,
                  alignment: 'right',
                  color: '#334155',
                },
              ],
            },
          ],
        ],
      },
      layout: 'noBorders',
    };
  }

  private buildPdfKpiCell(label: string, value: string, color: string): any {
    return {
      stack: [
        { text: label, style: 'kpiTitle', color },
        { text: value, style: 'kpiValue' },
      ],
      fillColor: '#F8FAFC',
    };
  }

  private buildPdfPersonalTable(): any {
    const body: any[] = [
      [
        { text: 'PROYECTO', style: 'tableHeader', fillColor: '#0E7490' },
        {
          text: 'CANTIDAD',
          style: 'tableHeader',
          fillColor: '#0E7490',
          alignment: 'right',
        },
      ],
    ];

    const countByLabel = this.getPersonalByProject();
    countByLabel.forEach((count, label) => {
      body.push([
        { text: label, style: 'tableCell' },
        { text: count.toString(), style: 'tableCellRight' },
      ]);
    });

    body.push([
      { text: 'TOTAL', style: 'totalLabel', fillColor: '#CFFAFE' },
      {
        text: this.totalPersonal.toString(),
        style: 'totalValue',
        fillColor: '#CFFAFE',
      },
    ]);

    return {
      table: { headerRows: 1, widths: ['70%', '30%'], body },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 0],
    };
  }

  private getPersonalByProject(): Map<string, number> {
    const countByLabel = new Map<string, number>();
    this.allEmployees.forEach((emp) => {
      const empProjects = this.allEmployeeProjects.filter(
        (ep) => ep.idEmployee === emp.id,
      );
      let label: string;
      if (empProjects.length === 0) {
        label = 'Sin Proyecto';
      } else if (empProjects.length > 1) {
        label = 'Multiproyectos';
      } else {
        const project = this.projectsList.find(
          (p) => p.id === empProjects[0].idProyect,
        );
        label = project ? project.name : `Proyecto ${empProjects[0].idProyect}`;
      }
      countByLabel.set(label, (countByLabel.get(label) || 0) + 1);
    });
    return countByLabel;
  }

  private buildPdfClasificacionTable(): any {
    const body: any[] = [
      [
        { text: 'CLASIFICACION', style: 'tableHeader', fillColor: '#1A365D' },
        {
          text: 'TOTAL ANTERIOR',
          style: 'tableHeader',
          fillColor: '#1A365D',
          alignment: 'right',
        },
        {
          text: this.getMesActualNombre().toUpperCase(),
          style: 'tableHeader',
          fillColor: '#1A365D',
          alignment: 'right',
        },
        {
          text: 'TOTAL ACUMULADO',
          style: 'tableHeader',
          fillColor: '#1A365D',
          alignment: 'right',
        },
      ],
    ];

    this.clasificacionEgresos.forEach((item) => {
      body.push([
        { text: `${item.codigo} - ${item.nombre}`, style: 'tableCell' },
        {
          text: this.formatCurrency(item.gastoAnterior),
          style: 'tableCellRight',
        },
        {
          text: this.formatCurrency(item.gastoMesActual),
          style: 'tableCellRight',
        },
        {
          text: this.formatCurrency(item.gastoAcumulado),
          style: 'tableCellRight',
        },
      ]);
    });

    body.push([
      { text: 'Gran Total', style: 'totalLabel', fillColor: '#FEE2E2' },
      {
        text: this.formatCurrency(this.getTotalEgresoAnterior()),
        style: 'totalValue',
        fillColor: '#FEE2E2',
      },
      {
        text: this.formatCurrency(this.getTotalEgresoMesActual()),
        style: 'totalValue',
        fillColor: '#FEE2E2',
      },
      {
        text: this.formatCurrency(this.getTotalEgresoAcumulado()),
        style: 'totalValue',
        fillColor: '#FEE2E2',
      },
    ]);

    return {
      table: {
        headerRows: 1,
        widths: ['46%', '18%', '18%', '18%'],
        body,
      },
      layout: 'lightHorizontalLines',
    };
  }

  private buildPdfFlujoMensualTable(): any {
    const body: any[] = [
      [
        { text: 'MES', style: 'tableHeader', fillColor: '#1A365D' },
        {
          text: 'EGRESO MENSUAL S/IVA',
          style: 'tableHeader',
          fillColor: '#1A365D',
          alignment: 'right',
        },
        {
          text: 'INGRESO S/IVA',
          style: 'tableHeader',
          fillColor: '#1A365D',
          alignment: 'right',
        },
        {
          text: 'FLUJO MENSUAL',
          style: 'tableHeader',
          fillColor: '#1A365D',
          alignment: 'right',
        },
      ],
    ];

    this.flujoMensual.forEach((item, index) => {
      body.push([
        { text: item.mes, style: 'tableCell' },
        {
          text: this.formatCurrency(item.egresoMensual),
          style: 'tableCellRight',
        },
        {
          text: this.formatCurrency(item.ingresoMensual),
          style: 'tableCellRight',
        },
        {
          text: this.formatCurrency(item.flujoMensual),
          style: 'tableCellRight',
          color: item.flujoMensual >= 0 ? '#15803D' : '#DC2626',
        },
      ]);

      if (this.flujoMensual[index + 1]?.anio !== item.anio) {
        const flujoAnio = this.getTotalAnio(item.anio, 'flujo');
        body.push([
          {
            text: `Total ${item.anio}`,
            style: 'totalLabel',
            fillColor: '#DBEAFE',
          },
          {
            text: this.formatCurrency(this.getTotalAnio(item.anio, 'egreso')),
            style: 'totalValue',
            fillColor: '#DBEAFE',
          },
          {
            text: this.formatCurrency(this.getTotalAnio(item.anio, 'ingreso')),
            style: 'totalValue',
            fillColor: '#DBEAFE',
          },
          {
            text: this.formatCurrency(flujoAnio),
            style: 'totalValue',
            fillColor: '#DBEAFE',
            color: flujoAnio >= 0 ? '#15803D' : '#DC2626',
          },
        ]);
      }
    });

    const totalGeneral = this.getTotalGeneral();
    body.push([
      { text: 'Total General', style: 'tableHeader', fillColor: '#1A365D' },
      {
        text: this.formatCurrency(totalGeneral.egreso),
        style: 'tableHeader',
        fillColor: '#1A365D',
        alignment: 'right',
      },
      {
        text: this.formatCurrency(totalGeneral.ingreso),
        style: 'tableHeader',
        fillColor: '#1A365D',
        alignment: 'right',
      },
      {
        text: this.formatCurrency(totalGeneral.flujo),
        style: 'tableHeader',
        fillColor: '#1A365D',
        alignment: 'right',
      },
    ]);

    body.push([
      { text: '', border: [false, false, false, false] },
      { text: '', border: [false, false, false, false] },
      { text: 'Margen', style: 'totalLabel', alignment: 'right' },
      {
        text: `${this.margenPorcentaje.toFixed(1)}%`,
        style: 'totalValue',
        color: '#15803D',
      },
    ]);

    return {
      table: {
        headerRows: 1,
        widths: ['28%', '24%', '24%', '24%'],
        body,
      },
      layout: 'lightHorizontalLines',
    };
  }

  private formatCurrency(value: number): string {
    const safeValue = Number.isFinite(value) ? value : 0;
    return `$${safeValue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  public async exportToXlsx(): Promise<void> {
    if (this.isExportingPdf || this.isExportingXlsx) return;
    this.isExportingXlsx = true;

    try {
      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet('Dashboard HCO');
      const endRow = this.buildEditableDashboardWorksheet(worksheet);
      await this.addDashboardChartsToWorksheet(workbook, worksheet, endRow);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      this.downloadBlob(blob, this.getExportFileName('xlsx'));
    } catch (error) {
      console.error('Error exportando dashboard a XLSX:', error);
      alerts.basicAlert(
        'Error',
        'No fue posible exportar el dashboard a XLSX.',
        'error',
      );
    } finally {
      this.isExportingXlsx = false;
    }
  }

  private buildEditableDashboardWorksheet(worksheet: any): number {
    worksheet.views = [{ showGridLines: false }];
    worksheet.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };

    worksheet.columns = [
      { width: 38 },
      { width: 19 },
      { width: 19 },
      { width: 19 },
      { width: 3 },
      { width: 20 },
      { width: 20 },
      { width: 20 },
      { width: 20 },
      { width: 20 },
      { width: 20 },
      { width: 20 },
      { width: 20 },
      { width: 20 },
    ];

    worksheet.mergeCells('A1:N1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'SISTEMA INTEGRAL DE ADMINISTRACION FINANCIERA';
    titleCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1A365D' },
    };

    worksheet.mergeCells('A2:N2');
    const subtitleCell = worksheet.getCell('A2');
    subtitleCell.value = `Dashboard HCO - ${this.getFilterPeriodLabel()}`;
    subtitleCell.font = { italic: true, color: { argb: 'FF1A365D' }, size: 11 };
    subtitleCell.alignment = { horizontal: 'center' };

    this.writeKpiCard(
      worksheet,
      'A4',
      'B4',
      'A5',
      'B5',
      'EGRESOS TOTALES',
      this.totalEgresos,
      'FFDC2626',
    );
    this.writeKpiCard(
      worksheet,
      'C4',
      'D4',
      'C5',
      'D5',
      'INGRESOS TOTALES',
      this.totalIngresos,
      'FF16A34A',
    );
    this.writeKpiCard(
      worksheet,
      'E4',
      'F4',
      'E5',
      'F5',
      'FLUJO NETO',
      this.flujoNeto,
      this.flujoNeto >= 0 ? 'FF2563EB' : 'FFDC2626',
    );

    worksheet.mergeCells('G4:H4');
    const margenTitle = worksheet.getCell('G4');
    margenTitle.value = 'MARGEN';
    margenTitle.font = { bold: true, color: { argb: 'FF7C3AED' } };
    margenTitle.alignment = { horizontal: 'center' };
    margenTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF5F3FF' },
    };

    worksheet.mergeCells('G5:H5');
    const margenValue = worksheet.getCell('G5');
    margenValue.value = (this.margenPorcentaje || 0) / 100;
    margenValue.numFmt = '0.0%';
    margenValue.font = { bold: true, size: 12, color: { argb: 'FF7C3AED' } };
    margenValue.alignment = { horizontal: 'center' };
    margenValue.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF5F3FF' },
    };

    worksheet.mergeCells('I4:J4');
    const personalTitle = worksheet.getCell('I4');
    personalTitle.value = 'PERSONAL';
    personalTitle.font = { bold: true, color: { argb: 'FF0891B2' } };
    personalTitle.alignment = { horizontal: 'center' };
    personalTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0F2FE' },
    };

    worksheet.mergeCells('I5:J5');
    const personalValue = worksheet.getCell('I5');
    personalValue.value = this.totalPersonal;
    personalValue.font = { bold: true, size: 12, color: { argb: 'FF0E7490' } };
    personalValue.alignment = { horizontal: 'center' };
    personalValue.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0F2FE' },
    };

    let currentRow = 8;
    currentRow = this.writeClasificacionEgresosTable(worksheet, currentRow);
    currentRow += 2;
    currentRow = this.writeFlujoMensualTable(worksheet, currentRow);
    currentRow += 2;
    currentRow = this.writePersonalPorSucursalTable(worksheet, currentRow);
    return currentRow;
  }

  private writeKpiCard(
    worksheet: any,
    titleFrom: string,
    titleTo: string,
    valueFrom: string,
    valueTo: string,
    title: string,
    value: number,
    color: string,
  ): void {
    worksheet.mergeCells(`${titleFrom}:${titleTo}`);
    const titleCell = worksheet.getCell(titleFrom);
    titleCell.value = title;
    titleCell.font = { bold: true, color: { argb: color }, size: 10 };
    titleCell.alignment = { horizontal: 'center' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8FAFC' },
    };

    worksheet.mergeCells(`${valueFrom}:${valueTo}`);
    const valueCell = worksheet.getCell(valueFrom);
    valueCell.value = Number.isFinite(value) ? value : 0;
    valueCell.numFmt = '"$"#,##0.00';
    valueCell.font = { bold: true, size: 13, color: { argb: 'FF1E293B' } };
    valueCell.alignment = { horizontal: 'center' };
    valueCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFFFF' },
    };
  }

  private writeClasificacionEgresosTable(
    worksheet: any,
    startRow: number,
  ): number {
    worksheet.mergeCells(`A${startRow}:D${startRow}`);
    const titleCell = worksheet.getCell(`A${startRow}`);
    titleCell.value = 'CLASIFICACION DE EGRESOS (CUENTAS CONTABLES)';
    titleCell.font = { bold: true, color: { argb: 'FFDC2626' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF1F2' },
    };

    const headerRow = startRow + 1;
    const headers = [
      'CLASIFICACION',
      'TOTAL ANTERIOR',
      this.getMesActualNombre().toUpperCase(),
      'TOTAL ACUMULADO',
    ];
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(headerRow, index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.alignment = { horizontal: index === 0 ? 'left' : 'right' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1A365D' },
      };
    });

    let row = headerRow + 1;
    this.clasificacionEgresos.forEach((item) => {
      worksheet.getCell(`A${row}`).value = `${item.codigo} - ${item.nombre}`;
      this.setMoneyCell(worksheet.getCell(`B${row}`), item.gastoAnterior);
      this.setMoneyCell(worksheet.getCell(`C${row}`), item.gastoMesActual);
      this.setMoneyCell(worksheet.getCell(`D${row}`), item.gastoAcumulado);
      row++;
    });

    worksheet.getCell(`A${row}`).value = 'Gran Total';
    worksheet.getCell(`A${row}`).font = {
      bold: true,
      color: { argb: 'FFB91C1C' },
    };
    worksheet.getCell(`A${row}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEE2E2' },
    };
    this.setMoneyCell(
      worksheet.getCell(`B${row}`),
      this.getTotalEgresoAnterior(),
      true,
    );
    this.setMoneyCell(
      worksheet.getCell(`C${row}`),
      this.getTotalEgresoMesActual(),
      true,
    );
    this.setMoneyCell(
      worksheet.getCell(`D${row}`),
      this.getTotalEgresoAcumulado(),
      true,
    );

    return row;
  }

  private writeFlujoMensualTable(worksheet: any, startRow: number): number {
    worksheet.mergeCells(`A${startRow}:D${startRow}`);
    const titleCell = worksheet.getCell(`A${startRow}`);
    titleCell.value = 'GASTO E INGRESO POR MES';
    titleCell.font = { bold: true, color: { argb: 'FF1A365D' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };

    const headerRow = startRow + 1;
    const headers = [
      'MES',
      'EGRESO MENSUAL S/IVA',
      'INGRESO S/IVA',
      'FLUJO MENSUAL',
    ];
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(headerRow, index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.alignment = { horizontal: index === 0 ? 'left' : 'right' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1A365D' },
      };
    });

    let row = headerRow + 1;
    this.flujoMensual.forEach((item, index) => {
      worksheet.getCell(`A${row}`).value = item.mes;
      this.setMoneyCell(worksheet.getCell(`B${row}`), item.egresoMensual);
      this.setMoneyCell(worksheet.getCell(`C${row}`), item.ingresoMensual);
      this.setMoneyCell(
        worksheet.getCell(`D${row}`),
        item.flujoMensual,
        false,
        item.flujoMensual >= 0 ? 'FF15803D' : 'FFDC2626',
      );
      row++;

      if (this.flujoMensual[index + 1]?.anio !== item.anio) {
        worksheet.getCell(`A${row}`).value = `Total ${item.anio}`;
        worksheet.getCell(`A${row}`).font = {
          bold: true,
          color: { argb: 'FF1E40AF' },
        };
        worksheet.getCell(`A${row}`).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFDBEAFE' },
        };
        this.setMoneyCell(
          worksheet.getCell(`B${row}`),
          this.getTotalAnio(item.anio, 'egreso'),
          true,
        );
        this.setMoneyCell(
          worksheet.getCell(`C${row}`),
          this.getTotalAnio(item.anio, 'ingreso'),
          true,
        );
        const flujoAnual = this.getTotalAnio(item.anio, 'flujo');
        this.setMoneyCell(
          worksheet.getCell(`D${row}`),
          flujoAnual,
          true,
          flujoAnual >= 0 ? 'FF15803D' : 'FFDC2626',
        );
        row++;
      }
    });

    worksheet.getCell(`A${row}`).value = 'Total General';
    worksheet.getCell(`A${row}`).font = {
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    worksheet.getCell(`A${row}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1A365D' },
    };

    const totalGeneral = this.getTotalGeneral();
    this.setMoneyCell(
      worksheet.getCell(`B${row}`),
      totalGeneral.egreso,
      true,
      'FFFFFFFF',
      'FF1A365D',
    );
    this.setMoneyCell(
      worksheet.getCell(`C${row}`),
      totalGeneral.ingreso,
      true,
      'FFFFFFFF',
      'FF1A365D',
    );
    this.setMoneyCell(
      worksheet.getCell(`D${row}`),
      totalGeneral.flujo,
      true,
      'FFFFFFFF',
      'FF1A365D',
    );
    row++;

    worksheet.getCell(`C${row}`).value = 'Margen';
    worksheet.getCell(`C${row}`).font = {
      bold: true,
      color: { argb: 'FF15803D' },
    };
    worksheet.getCell(`C${row}`).alignment = { horizontal: 'right' };
    const marginCell = worksheet.getCell(`D${row}`);
    marginCell.value = (this.margenPorcentaje || 0) / 100;
    marginCell.numFmt = '0.0%';
    marginCell.font = { bold: true, color: { argb: 'FF15803D' } };
    marginCell.alignment = { horizontal: 'right' };

    return row;
  }

  private writePersonalPorSucursalTable(
    worksheet: any,
    startRow: number,
  ): number {
    worksheet.mergeCells(`A${startRow}:B${startRow}`);
    const titleCell = worksheet.getCell(`A${startRow}`);
    titleCell.value = 'PERSONAL POR SUCURSAL';
    titleCell.font = { bold: true, color: { argb: 'FF0E7490' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0F2FE' },
    };

    const headerRow = startRow + 1;
    ['PROYECTO', 'CANTIDAD'].forEach((h, i) => {
      const cell = worksheet.getCell(headerRow, i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: i === 0 ? 'left' : 'right' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0E7490' },
      };
    });

    const countByLabel = this.getPersonalByProject();

    let row = headerRow + 1;
    countByLabel.forEach((count, label) => {
      worksheet.getCell(`A${row}`).value = label;
      const countCell = worksheet.getCell(`B${row}`);
      countCell.value = count;
      countCell.alignment = { horizontal: 'right' };
      row++;
    });

    worksheet.getCell(`A${row}`).value = 'TOTAL';
    worksheet.getCell(`A${row}`).font = { bold: true };
    worksheet.getCell(`A${row}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFCFFAFE' },
    };
    const totalCell = worksheet.getCell(`B${row}`);
    totalCell.value = this.totalPersonal;
    totalCell.font = { bold: true };
    totalCell.alignment = { horizontal: 'right' };
    totalCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFCFFAFE' },
    };

    return row;
  }

  private setMoneyCell(
    cell: any,
    value: number,
    bold = false,
    fontColor = 'FF1E293B',
    fillColor = '',
  ): void {
    cell.value = Number.isFinite(value) ? value : 0;
    cell.numFmt = '"$"#,##0.00';
    cell.alignment = { horizontal: 'right' };
    cell.font = { bold, color: { argb: fontColor } };
    if (fillColor) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: fillColor },
      };
    }
  }

  private async addDashboardChartsToWorksheet(
    workbook: Workbook,
    worksheet: any,
    endRow: number,
  ): Promise<void> {
    const [pieChart, barChart, combustibleChart, lineChart] = await Promise.all(
      [
        this.captureChartAsBase64(this.personalChartRef),
        this.captureChartAsBase64(this.pieChartRef),
        this.captureChartAsBase64(this.combustibleChartRef),
        this.captureChartAsBase64(this.lineChartRef),
      ],
    );

    if (pieChart) {
      const imageId = workbook.addImage({ base64: pieChart, extension: 'png' });
      worksheet.addImage(imageId, {
        tl: { col: 5, row: 7 },
        ext: { width: 500, height: 260 },
      });
    }

    if (barChart) {
      const imageId = workbook.addImage({ base64: barChart, extension: 'png' });
      worksheet.addImage(imageId, {
        tl: { col: 5, row: 24 },
        ext: { width: 500, height: 250 },
      });
    }

    if (combustibleChart) {
      const imageId = workbook.addImage({
        base64: combustibleChart,
        extension: 'png',
      });
      worksheet.addImage(imageId, {
        tl: { col: 5, row: 41 },
        ext: { width: 500, height: 250 },
      });
    }

    if (lineChart) {
      const imageId = workbook.addImage({
        base64: lineChart,
        extension: 'png',
      });
      worksheet.addImage(imageId, {
        tl: { col: 0, row: Math.max(endRow + 2, 42) },
        ext: { width: 1230, height: 300 },
      });
    }
  }

  private async captureChartAsBase64(
    chartRef: ChartComponent | undefined,
  ): Promise<string | null> {
    if (!chartRef) return null;
    try {
      const result = await (chartRef as any).dataURI();
      return result?.imgURI ?? null;
    } catch {
      return null;
    }
  }

  // Método legacy mantenido por compatibilidad — no se usa en exportaciones
  private async captureElementAsBase64_legacy(
    selector: string,
  ): Promise<string | null> {
    const element = document.querySelector(selector) as HTMLElement | null;
    if (!element) return null;

    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    const scale = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale,
      useCORS: true,
      width: element.scrollWidth,
      height: element.scrollHeight,
      windowWidth: Math.max(
        document.documentElement.clientWidth,
        element.scrollWidth,
      ),
      windowHeight: Math.max(
        document.documentElement.clientHeight,
        element.scrollHeight,
      ),
      scrollX: 0,
      scrollY: -window.scrollY,
    });

    return canvas.toDataURL('image/png');
  }

  private getFilterPeriodLabel(): string {
    const start = this.startDate || 'sin fecha inicial';
    const end = this.endDate || 'sin fecha final';
    const year = this.selectedYear ? String(this.selectedYear) : 'Todos';
    return `Periodo ${start} al ${end} | Año: ${year}`;
  }

  private loadData(rootId: number): void {
    this.resetLoadFlags();

    // Cargar total de personal de la empresa y agrupar por proyecto
    this.employeesService.getEmployees(-rootId).subscribe((data: any) => {
      this.allEmployees = Array.isArray(data) ? data : [];
      this.totalPersonal = this.allEmployees.length;
      this._loadedEmployees = true;
      this.checkDataReady();
      this.preparePersonalPieChart();
    });

    this.employeesService
      .getEmployeeProjectsByRoot(rootId)
      .subscribe((data: any) => {
        this.allEmployeeProjects = Array.isArray(data) ? data : [];
        this.preparePersonalPieChart();
        this.calcularNominaPorCategoria();
      });

    this.projectsService
      .getProjectListByCompany(rootId)
      .subscribe((data: any) => {
        this.projectsList = Array.isArray(data) ? data : [];
        this._loadedProjects = true;
        this.checkDataReady();
        this.preparePersonalPieChart();
      });

    // Cargar todas las cuentas contables (nivel 1 y 2) para poder subir al padre
    this.cuentasContablesService.getAll(rootId).subscribe((data) => {
      this.cuentasContablesNivel2 = data || [];
      console.log(
        '✅ Cuentas contables cargadas:',
        this.cuentasContablesNivel2.length,
      );
      this._loadedCuentas = true;
      this.checkDataReady();
      this.processAllData();
    });

    // Cargar ingresos y egresos desde la misma fuente que income/expenditure
    this.incomesAndExpensesService
      .getIncomesAndExpenses(rootId)
      .subscribe((data) => {
        const rows = Array.isArray(data) ? data : [];
        const gastos = rows.filter(
          (item) => String(item?.type ?? '').toUpperCase() === 'GASTO',
        );
        this.ingresosData = rows.filter(
          (item) => String(item?.type ?? '').toUpperCase() === 'DEPOSITO',
        );

        console.log('✅ Egresos cargados (GASTO):', gastos.length);
        console.log(
          '✅ Ingresos cargados (DEPOSITO):',
          this.ingresosData.length,
        );

        // Expandir gastos usando dateExpend de los conceptos (detalles-expenditure)
        // para que la fecha de clasificación mensual refleje la fecha real del concepto
        if (gastos.length === 0) {
          this.egresosData = [];
          this._loadedEgresos = true;
          this.checkDataReady();
          this.processAllData();
          return;
        }

        const conceptRequests = gastos.map((gasto) =>
          this.incomesAndExpensesService
            .getConceptsFromIncomesAndExpenses(gasto.id)
            .pipe(
              map((concepts) => ({
                gasto,
                concepts: Array.isArray(concepts) ? concepts : [],
              })),
              catchError(() => of({ gasto, concepts: [] })),
            ),
        );

        forkJoin(conceptRequests).subscribe((results) => {
          const expandedEgresos: any[] = [];

          results.forEach(({ gasto, concepts }) => {
            const activeConcepts = concepts.filter(
              (c: any) => c?.active !== false && (c?.total ?? 0) !== 0,
            );
            if (activeConcepts.length === 0) {
              // Sin conceptos: usar el gasto padre con su fecha original
              expandedEgresos.push(gasto);
            } else {
              // Expandir a nivel de concepto usando dateExpend como fecha
              activeConcepts.forEach((concept: any) => {
                expandedEgresos.push({
                  ...gasto,
                  date: concept.dateExpend ?? gasto.date,
                  total: concept.total ?? 0,
                  conceptoDescripcion: concept.description ?? '',
                });
              });
            }
          });

          this.egresosData = expandedEgresos;
          console.log(
            '✅ Egresos expandidos con fechas de conceptos:',
            expandedEgresos.length,
          );
          this._loadedEgresos = true;
          this.checkDataReady();
          this.processAllData();
        });
      });
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private getExportFileName(extension: 'pdf' | 'xlsx'): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    return `dashboard-hco_${timestamp}.${extension}`;
  }

  private processAllData(): void {
    // Filtrar por rango de fechas
    let filteredExpenseData = this.filterByDateRange(this.egresosData, false);
    let filteredIncomeData = this.filterByDateRange(this.ingresosData, true);

    // Para KPIs usar datos por endpoint, sin depender del mapeo contable 4xxx/5xxx/6xxx.
    const egresosReales = filteredExpenseData;
    const ingresosReales = filteredIncomeData.filter(
      (i) => String(i?.status ?? '').toLowerCase() === 'pagada',
    );

    console.log(
      `📊 Datos: ${egresosReales.length} egresos, ${ingresosReales.length} ingresos`,
    );

    // Calcular KPIs (ingresos pagados sin IVA)
    this.totalEgresos = egresosReales.reduce(
      (sum, e) => sum + this.getMonto(e),
      0,
    );
    this.totalIngresos = ingresosReales.reduce((sum, i) => {
      const subtotal = Number(i?.subtotal);
      return sum + (Number.isFinite(subtotal) ? subtotal : 0);
    }, 0);
    this.flujoNeto = this.totalIngresos - this.totalEgresos;
    this.margenPorcentaje =
      this.totalIngresos > 0 ? (this.flujoNeto / this.totalIngresos) * 100 : 0;

    // Preparar datos para tablas y gráficas
    this.prepareClasificacionEgresos(filteredExpenseData);
    this.prepareFlujoMensual(egresosReales, ingresosReales);
    this.preparePieChart();
    this.prepareLineChart();
    this.prepareCombustibleChart(filteredExpenseData);
    this.calcularTotalNomina(filteredExpenseData);
  }

  private getIdExpend(item: any): number | null {
    // Priorizar idSubclasificacion (usado en expenditure) sobre idExpend
    const candidates = [
      item?.idSubclasificacion,
      item?.idClasificacion,
      item?.idExpend,
      item?.id_expend,
      item?.idCuentaContable,
      item?.id_cuenta_contable,
      item?.idExpense,
    ];

    for (const candidate of candidates) {
      const numeric = Number(candidate);
      if (Number.isFinite(numeric) && numeric > 0) {
        return numeric;
      }
    }
    return null;
  }

  private parseTipoGastoTexto(
    value: any,
  ): { codigo: string; nombre: string } | null {
    const text = String(value ?? '').trim();
    if (!text) return null;

    const parts = text
      .split('-')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      const codigo = parts[0];
      const nombre = parts.slice(1).join(' - ');
      return { codigo, nombre };
    }

    return { codigo: text, nombre: 'Tipo de gasto' };
  }

  private getTipoGasto(item: any): { codigo: string; nombre: string } {
    // Para idSubclasificacion (nivel 2): subir al padre (nivel 1) via idPadre
    if (item?.idSubclasificacion) {
      const subcuenta = this.cuentasContablesNivel2.find(
        (c) => c.id === item.idSubclasificacion,
      );
      if (subcuenta?.idPadre) {
        const padre = this.cuentasContablesNivel2.find(
          (c) => c.id === subcuenta.idPadre,
        );
        if (padre) {
          return {
            codigo: String(padre.codigo ?? subcuenta.idPadre),
            nombre: padre.nombre || padre.descripcion || 'Clasificación',
          };
        }
      }
      // Fallback: si no tiene padre, usar la subcuenta misma
      if (subcuenta) {
        return {
          codigo: String(subcuenta.codigo ?? item.idSubclasificacion),
          nombre:
            subcuenta.nombre || subcuenta.descripcion || 'Subclasificación',
        };
      }
    }

    // Para idClasificacion (nivel 1): buscar directamente
    if (item?.idClasificacion) {
      const cuenta = this.cuentasContablesNivel2.find(
        (c) => c.id === item.idClasificacion,
      );
      if (cuenta) {
        return {
          codigo: String(cuenta.codigo ?? item.idClasificacion),
          nombre: cuenta.nombre || cuenta.descripcion || 'Clasificación',
        };
      }
    }

    // Fallback: buscar por idExpend (campo antiguo)
    const idExpend = this.getIdExpend(item);
    if (idExpend) {
      const cuenta = this.cuentasContablesNivel2.find((c) => c.id === idExpend);
      if (cuenta?.idPadre) {
        const padre = this.cuentasContablesNivel2.find(
          (c) => c.id === cuenta.idPadre,
        );
        if (padre) {
          return {
            codigo: String(padre.codigo ?? cuenta.idPadre),
            nombre: padre.nombre || padre.descripcion || 'Clasificación',
          };
        }
      }
      if (cuenta) {
        return {
          codigo: String(cuenta.codigo ?? idExpend),
          nombre: cuenta.nombre || cuenta.descripcion || 'Cuenta contable',
        };
      }
    }

    const fromText = this.parseTipoGastoTexto(
      item?.expenseTypeText ??
        item?.tipoGastoTexto ??
        item?.tipoGasto ??
        item?.cuentaContableTexto,
    );
    if (fromText) {
      return fromText;
    }

    if (idExpend) {
      return { codigo: String(idExpend), nombre: 'Cuenta contable' };
    }

    return { codigo: 'SIN-CLASIFICAR', nombre: 'Sin clasificar' };
  }

  private filterByDateRange(data: any[], usePaymentDate: boolean): any[] {
    if (!this.startDate || !this.endDate) return data;
    const start = this.parseDateValue(this.startDate);
    const end = this.parseDateValue(this.endDate);
    if (!start || !end) return data;
    end.setHours(23, 59, 59, 999);

    return data.filter((item) => {
      const itemDate = this.getItemDate(item, usePaymentDate);
      if (!itemDate) return false;
      return itemDate >= start && itemDate <= end;
    });
  }

  private parseDateValue(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date)
      return Number.isNaN(value.getTime()) ? null : value;

    const asString = String(value).trim();
    if (!asString) return null;

    // Fechas solo-fecha (YYYY-MM-DD) se parsean como UTC por spec; forzar local añadiendo hora
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(asString)
      ? asString + 'T00:00:00'
      : asString;
    const isoDate = new Date(normalized);
    if (!Number.isNaN(isoDate.getTime())) return isoDate;

    // Formato dd-MM-yyyy o dd/MM/yyyy
    const match = asString.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (match) {
      const day = Number(match[1]);
      const month = Number(match[2]);
      const year = Number(match[3]);
      const parsed = new Date(year, month - 1, day);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }

  private getItemDate(item: any, usePaymentDate: boolean): Date | null {
    const rawDate = usePaymentDate
      ? (item?.date ??
        item?.paymentDate ??
        item?.fechaPago ??
        item?.dateStamped ??
        item?.datestamped)
      : (item?.date ?? item?.dateStamped ?? item?.datestamped);

    return this.parseDateValue(rawDate);
  }

  private getMonto(item: any): number {
    const value = Number(item?.total);
    return Number.isFinite(value) ? value : 0;
  }

  private prepareClasificacionEgresos(egresos: any[]): void {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const grouped = new Map<string, ClasificacionContable>();

    egresos.forEach((item) => {
      const tipoGasto = this.getTipoGasto(item);
      const key = `${tipoGasto.codigo}|${tipoGasto.nombre}`;
      const itemDate = this.getItemDate(item, false);
      if (!itemDate) return;

      if (!grouped.has(key)) {
        grouped.set(key, {
          codigo: tipoGasto.codigo,
          nombre: tipoGasto.nombre,
          gastoAnterior: 0,
          gastoMesActual: 0,
          gastoAcumulado: 0,
          tipo: 'EGRESO',
        });
      }

      const registro = grouped.get(key)!;
      const monto = this.getMonto(item);
      if (
        itemDate.getFullYear() === currentYear &&
        itemDate.getMonth() === currentMonth
      ) {
        registro.gastoMesActual += monto;
      } else {
        registro.gastoAnterior += monto;
      }
      registro.gastoAcumulado =
        registro.gastoAnterior + registro.gastoMesActual;
    });

    this.clasificacionEgresos = Array.from(grouped.values())
      .filter((item) => item.gastoAcumulado > 0)
      .sort((a, b) =>
        a.codigo.localeCompare(b.codigo, 'es', { numeric: true }),
      );

    console.log(
      `📊 Egresos clasificados por tipo de gasto: ${this.clasificacionEgresos.length} tipos`,
    );
  }

  private prepareFlujoMensual(egresos: any[], ingresos: any[]): void {
    const monthMap = new Map<string, { egreso: number; ingreso: number }>();
    const monthNames = [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ];

    // Procesar egresos (5xxx, 6xxx)
    egresos.forEach((item) => {
      const date = this.getItemDate(item, false);
      if (!date) return;
      const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
      const current = monthMap.get(key) || { egreso: 0, ingreso: 0 };
      current.egreso += this.getMonto(item);
      monthMap.set(key, current);
    });

    // Procesar ingresos (solo pagados, sin IVA)
    ingresos
      .filter((item) => String(item?.status ?? '').toLowerCase() === 'pagada')
      .forEach((item) => {
        const date = this.getItemDate(item, true);
        if (!date) return;
        const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
        const current = monthMap.get(key) || { egreso: 0, ingreso: 0 };
        const subtotal = Number(item?.subtotal);
        current.ingreso += Number.isFinite(subtotal) ? subtotal : 0;
        monthMap.set(key, current);
      });

    // Convertir a array ordenado
    const sortedKeys = Array.from(monthMap.keys()).sort();
    let flujoAcumulado = 0;
    const totalesPorAnioMap = new Map<
      number,
      { egreso: number; ingreso: number; flujo: number }
    >();

    this.flujoMensual = sortedKeys.map((key) => {
      const [year, month] = key.split('-').map(Number);
      const data = monthMap.get(key)!;
      const flujoMes = data.ingreso - data.egreso;
      flujoAcumulado += flujoMes;

      // Acumular totales por año
      const anioData = totalesPorAnioMap.get(year) || {
        egreso: 0,
        ingreso: 0,
        flujo: 0,
      };
      anioData.egreso += data.egreso;
      anioData.ingreso += data.ingreso;
      anioData.flujo += flujoMes;
      totalesPorAnioMap.set(year, anioData);

      return {
        mes: monthNames[month],
        anio: year,
        egresoMensual: data.egreso,
        ingresoMensual: data.ingreso,
        flujoMensual: flujoMes,
        flujoAcumulado: flujoAcumulado,
      };
    });

    // Convertir totales por año
    this.totalesPorAnio = Array.from(totalesPorAnioMap.entries())
      .map(([anio, data]) => ({ anio, ...data }))
      .sort((a, b) => a.anio - b.anio);
  }

  private preparePersonalPieChart(): void {
    if (this.allEmployees.length === 0 || this.projectsList.length === 0) {
      return;
    }

    const countByLabel = this.getPersonalByProject();

    const labels: string[] = [];
    const series: number[] = [];
    countByLabel.forEach((count, label) => {
      labels.push(label);
      series.push(count);
    });

    this.personalPieChartOptions = {
      series,
      chart: { type: 'donut', height: 280 },
      labels,
      plotOptions: {
        pie: {
          donut: {
            labels: {
              show: true,
              name: { show: true },
              value: { show: true, fontSize: '14px', fontWeight: 700 },
              total: {
                show: true,
                showAlways: true,
                label: `${this.totalPersonal} personas`,
                fontSize: '11px',
                fontWeight: 700,
                formatter: () => this.totalNomina > 0 ? this.formatCurrency(this.totalNomina) : '',
              },
            },
          },
        },
      },
      legend: { position: 'bottom', fontSize: '10px' },
      colors: [
        '#c55a11', // naranja oscuro — Sin Proyecto
        '#4472c4', // azul office
        '#70ad47', // verde
        '#ffc000', // amarillo
        '#ed7d31', // naranja medio
        '#5b9bd5', // azul claro
        '#a9d18e', // verde claro
        '#ff0000', // rojo
        '#7030a0', // morado
      ],
    };
  }

  private preparePieChart(): void {
    // Filtrar solo egresos con valor > 0
    const egresosConValor = this.clasificacionEgresos.filter(
      (e) => e.gastoAcumulado > 0,
    );

    if (egresosConValor.length === 0) {
      this.pieChartOptions = null;
      return;
    }

    const labels = egresosConValor.map((e) => `${e.codigo} - ${e.nombre}`);
    const series = egresosConValor.map((e) => e.gastoAcumulado);

    this.pieChartOptions = {
      series: series,
      chart: { type: 'donut', height: 320 },
      labels: labels,
      plotOptions: {
        pie: {
          donut: {
            labels: {
              show: true,
              total: {
                show: true,
                showAlways: true,
                label: 'Total',
                fontSize: '13px',
                fontWeight: 700,
                formatter: () => this.formatCurrency(this.totalEgresos),
              },
            },
          },
        },
      },
      legend: { position: 'bottom', fontSize: '10px' },
      colors: [
        '#1e3a5f',
        '#2563eb',
        '#3b82f6',
        '#60a5fa',
        '#93c5fd',
        '#bfdbfe',
        '#dbeafe',
        '#7c3aed',
        '#a78bfa',
        '#c4b5fd',
      ],
    };
  }

  private prepareLineChart(): void {
    if (this.flujoMensual.length === 0) {
      this.lineChartOptions = null;
      return;
    }

    const categories = this.flujoMensual.map(
      (f) => `${f.mes.substring(0, 3)} ${f.anio.toString().substring(2)}`,
    );
    const egresoData = this.flujoMensual.map((f) => f.egresoMensual);
    const ingresoData = this.flujoMensual.map((f) => f.ingresoMensual);
    const flujoData = this.flujoMensual.map((f) => f.flujoAcumulado);

    this.lineChartOptions = {
      series: [
        { name: 'EGRESO MENSUAL S/IVA', data: egresoData },
        { name: 'INGRESO S/IVA', data: ingresoData },
        { name: 'FLUJO ACUMULADO', data: flujoData },
      ],
      chart: {
        type: 'area',
        height: 350,
        toolbar: { show: false },
        zoom: { enabled: false },
      },
      stroke: { curve: 'smooth', width: [2, 2, 3] },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.4,
          opacityTo: 0.1,
          stops: [0, 90, 100],
        },
      },
      xaxis: {
        categories: categories,
        labels: { rotate: -45, style: { fontSize: '10px' } },
      },
      yaxis: {
        labels: {
          formatter: (val) => '$' + (val / 1000).toFixed(1) + 'K',
        },
      },
      tooltip: {
        y: {
          formatter: (val) =>
            `$${val.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        },
      },
      legend: { position: 'top', horizontalAlign: 'center' },
    };
  }

  private prepareCombustibleChart(filteredExpenseData: any[]): void {
    // Identificar cuentas de combustible dinámicamente por nombre o código (56xx)
    const combustibleIds = new Set(
      this.cuentasContablesNivel2
        .filter((c) => {
          const nombre = String(c.nombre ?? c.descripcion ?? '').toUpperCase();
          const codigo = String(c.codigo ?? '');
          return (
            nombre.includes('COMBUSTIBLE') ||
            nombre.includes('GASOLINA') ||
            nombre.includes('DIESEL') ||
            codigo.startsWith('56')
          );
        })
        .map((c) => c.id),
    );

    if (combustibleIds.size === 0) {
      this.totalCombustible = 0;
      this.combustiblePieChartOptions = null;
      return;
    }

    const items = filteredExpenseData.filter(
      (item) =>
        combustibleIds.has(item.idSubclasificacion) ||
        combustibleIds.has(item.idClasificacion),
    );

    if (items.length === 0) {
      this.totalCombustible = 0;
      this.combustiblePieChartOptions = null;
      return;
    }

    // Agrupar por proyecto
    const grouped = new Map<string, number>();
    items.forEach((item) => {
      const project = this.projectsList.find((p) => p.id === item.idProject);
      const label = project
        ? project.name
        : item.idProject
          ? `Proyecto ${item.idProject}`
          : 'SIN PROYECTO';
      grouped.set(label, (grouped.get(label) ?? 0) + this.getMonto(item));
    });

    const labels = Array.from(grouped.keys());
    const series = Array.from(grouped.values());
    this.totalCombustible = series.reduce((sum, v) => sum + v, 0);

    this.combustiblePieChartOptions = {
      series,
      chart: { type: 'donut', height: 280 },
      labels,
      plotOptions: {
        pie: {
          donut: {
            labels: {
              show: true,
              total: {
                show: true,
                showAlways: true,
                label: 'Total',
                fontSize: '13px',
                fontWeight: 700,
                formatter: () => this.formatCurrency(this.totalCombustible),
              },
            },
          },
        },
      },
      legend: { position: 'bottom', fontSize: '10px' },
      colors: [
        '#4472c4', // azul
        '#70ad47', // verde
        '#ed7d31', // naranja
        '#ffc000', // amarillo
        '#a5a5a5', // gris
        '#5b9bd5', // azul claro
        '#a9d18e', // verde claro
        '#ff0000', // rojo
        '#7030a0', // morado
        '#c55a11', // naranja oscuro
      ],
    };
  }

  private calcularTotalNomina(filteredExpenseData: any[]): void {
    const nominaIds = new Set(
      this.cuentasContablesNivel2
        .filter((c) => {
          const nombre = String(c.nombre ?? c.descripcion ?? '').toUpperCase();
          return nombre.includes('NOMINA') || nombre.includes('NÓMINA');
        })
        .map((c) => c.id),
    );

    if (nominaIds.size === 0) {
      this.totalNomina = 0;
      this.nominaByCategory = [];
      return;
    }

    const nominaRecords = filteredExpenseData.filter(
      (item) =>
        nominaIds.has(item.idSubclasificacion) ||
        nominaIds.has(item.idClasificacion),
    );

    // Total síncrono — mismo cálculo que antes
    this.totalNomina = nominaRecords.reduce(
      (sum, item) => sum + this.getMonto(item),
      0,
    );
    this.nominaByCategory = [];

    if (nominaRecords.length === 0) return;

    this.nominaRecordsCache = nominaRecords;
    this.preparePersonalPieChart();
    this.calcularNominaPorCategoria();
  }

  private calcularNominaPorCategoria(): void {
    if (this.nominaRecordsCache.length === 0) return;

    Promise.all(
      this.nominaRecordsCache.map((record) =>
        lastValueFrom(
          this.incomesAndExpensesService
            .getConceptsFromIncomesAndExpenses(record.id)
            .pipe(catchError(() => of([]))),
        ),
      ),
    ).then((results) => {
      const categoryTotals = new Map<string, number>();

      results.flat().forEach((concept: any) => {
        const amount = concept.total
          ? Number(concept.total)
          : Number(concept.quantity ?? 1) * Number(concept.price ?? 0);
        if (!amount) return;

        const empId = Number(concept.idExpense);
        if (!this.allEmployees.some((e) => Number(e.id) === empId)) return;

        const empProjects = this.allEmployeeProjects.filter(
          (ep) => Number(ep.idEmployee) === empId,
        );

        let label: string;
        if (empProjects.length === 0) {
          label = 'Sin Proyecto';
        } else if (empProjects.length > 1) {
          label = 'Multiproyectos';
        } else {
          const project = this.projectsList.find(
            (p) => p.id === empProjects[0].idProyect,
          );
          label = project
            ? project.name
            : `Proyecto ${empProjects[0].idProyect}`;
        }

        categoryTotals.set(label, (categoryTotals.get(label) || 0) + amount);
      });

      this.nominaByCategory = Array.from(categoryTotals.entries()).map(
        ([label, amount]) => ({ label, amount }),
      );
      this.cdr.detectChanges();
    });
  }

  // Helpers para la vista - EGRESOS
  public getTotalEgresoAnterior(): number {
    return this.clasificacionEgresos.reduce(
      (sum, c) => sum + c.gastoAnterior,
      0,
    );
  }

  public getTotalEgresoMesActual(): number {
    return this.clasificacionEgresos.reduce(
      (sum, c) => sum + c.gastoMesActual,
      0,
    );
  }

  public getTotalEgresoAcumulado(): number {
    return this.clasificacionEgresos.reduce(
      (sum, c) => sum + c.gastoAcumulado,
      0,
    );
  }

  public getTotalGeneral(): { egreso: number; ingreso: number; flujo: number } {
    return {
      egreso: this.totalesPorAnio.reduce((sum, t) => sum + t.egreso, 0),
      ingreso: this.totalesPorAnio.reduce((sum, t) => sum + t.ingreso, 0),
      flujo: this.totalesPorAnio.reduce((sum, t) => sum + t.flujo, 0),
    };
  }

  public getTotalAnio(
    anio: number,
    tipo: 'egreso' | 'ingreso' | 'flujo',
  ): number {
    const anioData = this.totalesPorAnio.find((t) => t.anio === anio);
    if (!anioData) return 0;
    return anioData[tipo];
  }

  // Obtener el nombre del mes actual
  public getMesActualNombre(): string {
    const monthNames = [
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
    return monthNames[new Date().getMonth()];
  }
}
