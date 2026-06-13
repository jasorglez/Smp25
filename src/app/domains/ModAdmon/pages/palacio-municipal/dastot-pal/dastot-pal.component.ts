import { Component, ElementRef, inject, OnInit, ViewChild, effect } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { AuthService } from 'app/services/auth.service';
import { SignalsService } from 'app/services/signals.service';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { alerts } from 'app/helpers/alerts';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  ApexChart,
  ApexNonAxisChartSeries,
  ApexResponsive,
  ApexLegend,
  ApexDataLabels,
  ChartComponent,
  NgApexchartsModule,
} from 'ng-apexcharts';
import { DetailCellRendererTotalesComponent } from './detail-cell-renderer-totales.component';

export type ChartOptions = {
  series: ApexNonAxisChartSeries;
  chart: ApexChart;
  responsive: ApexResponsive[];
  labels: string[];
  legend: ApexLegend;
  dataLabels: ApexDataLabels;
  colors: string[];
};

interface TotalData {
  nameAccount: string;
  ingresos: number;
  egresos: number;
}

@Component({
  selector: 'app-dastot-pal',
  standalone: true,
  imports: [
    RouterModule,
    DomainsModule,
    AgGridModule,
    FormsModule,
    CommonModule,
    NgApexchartsModule
  ],
  templateUrl: './dastot-pal.component.html',
  styleUrl: './dastot-pal.component.scss',
})
export class DastotPalComponent implements OnInit {
  @ViewChild('chartIngresos') chartIngresos!: ChartComponent;
  @ViewChild('chartEgresos') chartEgresos!: ChartComponent;
  @ViewChild('reportView') reportView!: ElementRef<HTMLElement>;

  authService = inject(AuthService);
  private signalsService = inject(SignalsService);
  private incomesExpensesService = inject(IncomesAndExpensesService);
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);

  // Grid variables
  gridApi!: GridApi;
  rowData: TotalData[] = [];
  isLoading: boolean = false;
  errorMessage: string = '';
  currentDetailType: string = 'DEPOSITO'; // Track which column was clicked
  isGeneratingPdf: boolean = false;
  pdfProgress: number = 0;
  pdfProgressText: string = '';

  // Date range variables
  startDate: string = '2025-01-01';
  endDate: string = '2025-12-31';

  constructor() {
    // Escuchar cambios en la señal de root
    effect(() => {
      const idRoot = this.signalsService.getRootSelectedBySidebar()();
      if (idRoot) {
        this.loadData();
      }
    });
  }

  // Chart configuration para Ingresos
  public chartIngresosOptions: ChartOptions = {
    series: [0, 0, 0],
    chart: {
      type: 'pie',
      height: 350,
    },
    labels: ['Estatal', 'Municipal', 'Propios'],
    colors: ['#00E396', '#008FFB', '#FEB019'],
    legend: {
      position: 'bottom',
      fontSize: '12px',
    },
    dataLabels: {
      enabled: true,
      formatter: function (val: number) {
        return val.toFixed(1) + '%';
      },
    },
    responsive: [
      {
        breakpoint: 480,
        options: {
          chart: {
            width: 300,
          },
          legend: {
            position: 'bottom',
          },
        },
      },
    ],
  };

  // Chart configuration para Egresos
  public chartEgresosOptions: ChartOptions = {
    series: [0, 0, 0],
    chart: {
      type: 'pie',
      height: 350,
    },
    labels: ['Estatal', 'Municipal', 'Propios'],
    colors: ['#00E396', '#008FFB', '#FEB019'],
    legend: {
      position: 'bottom',
      fontSize: '12px',
    },
    dataLabels: {
      enabled: true,
      formatter: function (val: number) {
        return val.toFixed(1) + '%';
      },
    },
    responsive: [
      {
        breakpoint: 480,
        options: {
          chart: {
            width: 300,
          },
          legend: {
            position: 'bottom',
          },
        },
      },
    ],
  };

  // Column definitions for AG Grid
  columnDefs: ColDef[] = [
    {
      field: 'nameAccount',
      headerName: 'Descripción',
      flex: 1,
      minWidth: 300,
    },
    {
      field: 'ingresos',
      headerName: 'Total Ingresos',
      width: 150,
      valueFormatter: (params) => {
        if (params.value == null) return '$0.00';
        return '$' + params.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      },
      cellStyle: { textAlign: 'right', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline', color: '#28a745' },
      onCellClicked: (params) => {
        this.toggleDetail(params.node, 'DEPOSITO');
      }
    },
    {
      field: 'egresos',
      headerName: 'Total Egresos',
      width: 150,
      valueFormatter: (params) => {
        if (params.value == null) return '$0.00';
        return '$' + params.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      },
      cellStyle: { textAlign: 'right', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline', color: '#dc3545' },
      onCellClicked: (params) => {
        this.toggleDetail(params.node, 'GASTO');
      }
    },
    {
      headerName: 'Diferencia',
      width: 150,
      valueGetter: (params) => {
        const ingresos = params.data?.ingresos || 0;
        const egresos = params.data?.egresos || 0;
        return ingresos - egresos;
      },
      valueFormatter: (params) => {
        if (params.value == null) return '$0.00';
        return '$' + params.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      },
      cellStyle: (params) => {
        const diferencia = params.value || 0;
        let color = '#000000'; // negro para 0
        if (diferencia > 0) {
          color = '#28a745'; // verde para positivo
        } else if (diferencia < 0) {
          color = '#dc3545'; // rojo para negativo
        }
        return { textAlign: 'right', fontWeight: 'bold', color: color };
      },
    },
    {
      headerName: 'PDF',
      width: 100,
      cellRenderer: () => {
        return '<button class="btn btn-sm btn-outline-danger"><i class="bi bi-file-pdf"></i> PDF</button>';
      },
      cellStyle: { textAlign: 'center' },
      onCellClicked: (params) => {
        this.exportCurrentViewPdf();
      },
    },
  ];

  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 25,
    enableRangeSelection: true,
    pagination: false,
    domLayout: 'autoHeight',
    masterDetail: true,
    detailRowHeight: 350,
    detailCellRenderer: DetailCellRendererTotalesComponent,
    isRowMaster: () => true,
  };

  ngOnInit(): void {
    // El effect en el constructor se encarga de cargar los datos cuando cambia idRoot
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    this.gridApi.sizeColumnsToFit();

    // Configurar el contexto para el detail renderer
    this.updateDetailContext();
  }

  updateDetailContext(): void {
    if (!this.gridApi) return;

    const contextToSet = {
      context: {
        incomesExpensesService: this.incomesExpensesService,
        idRoot: this.signalsService.getRootSelectedBySidebar()(),
        detailType: this.currentDetailType,
        startDate: this.startDate,
        endDate: this.endDate,
      }
    };


    this.gridApi.setGridOption('detailCellRendererParams', contextToSet);
  }

  // Variable para almacenar todos los datos originales
  private allRowData: TotalData[] = [];
  private expandedNodeAccount: string | null = null;

  toggleDetail(node: any, detailType: string): void {
    const isExpanded = node.expanded;
    const isSameType = this.currentDetailType === detailType;
    const clickedData = node.data;


    // Si está expandido y es el mismo tipo, contraer y restaurar datos
    if (isExpanded && isSameType) {
      node.setExpanded(false);
      this.expandedNodeAccount = null;
      if (this.allRowData.length > 0) {
        this.rowData = [...this.allRowData];
        this.allRowData = [];
      }
      return;
    }

    // Cerrar todos los detalles abiertos
    this.gridApi.forEachNode((otherNode: any) => {
      if (otherNode.expanded) {
        otherNode.setExpanded(false);
      }
    });

    // Actualizar tipo y contexto
    this.currentDetailType = detailType;
    this.updateDetailContext();

    // Guardar datos completos si no están guardados
    if (this.allRowData.length === 0) {
      this.allRowData = [...this.rowData];
    }

    // Filtrar para mostrar solo la fila seleccionada
    this.rowData = this.allRowData.filter(item => item.nameAccount === clickedData.nameAccount);
    this.expandedNodeAccount = clickedData.nameAccount;

    // Pequeño delay para asegurar que el contexto y datos se actualicen antes de expandir
    setTimeout(() => {
      this.gridApi.forEachNode((n: any) => {
        if (n.data?.nameAccount === clickedData.nameAccount) {
          n.setExpanded(true);
        }
      });
    }, 50);
  }

  async loadData(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      const idRoot = this.signalsService.getRootSelectedBySidebar()();

      if (!idRoot) {
        this.errorMessage = 'No se ha seleccionado una raíz desde el sidebar';
        this.rowData = [];
        return;
      }

      // Cargar ingresos y egresos en paralelo
      // Usar Promise.allSettled para manejar errores 404 individualmente
      const [ingresosResult, egresosResult] = await Promise.allSettled([
        this.incomesExpensesService.getIncomesByAccount(idRoot, 'DEPOSITO', this.startDate, this.endDate).toPromise(),
        this.incomesExpensesService.getIncomesByAccount(idRoot, 'GASTO', this.startDate, this.endDate).toPromise()
      ]);

      // Crear un mapa de cuentas únicas
      const accountsMap = new Map<string, TotalData>();

      // Procesar ingresos
      if (ingresosResult.status === 'fulfilled') {
        const ingresosResponse = ingresosResult.value;
        if (ingresosResponse?.success && ingresosResponse?.hasData) {
          ingresosResponse.data.forEach((item: any) => {
            accountsMap.set(item.nameAccount, {
              nameAccount: item.nameAccount,
              ingresos: item.ingresos || 0,
              egresos: 0
            });
          });
        }
      } else if (ingresosResult.reason?.status !== 404) {
        // Solo loguear si NO es 404
        console.error('Error al cargar ingresos:', ingresosResult.reason);
      }

      // Procesar egresos
      if (egresosResult.status === 'fulfilled') {
        const egresosResponse = egresosResult.value;
        if (egresosResponse?.success && egresosResponse?.hasData) {
          egresosResponse.data.forEach((item: any) => {
            const existing = accountsMap.get(item.nameAccount);
            if (existing) {
              existing.egresos = item.ingresos || 0;
            } else {
              accountsMap.set(item.nameAccount, {
                nameAccount: item.nameAccount,
                ingresos: 0,
                egresos: item.ingresos || 0
              });
            }
          });
        }
      } else if (egresosResult.reason?.status !== 404) {
        // Solo loguear si NO es 404
        console.error('Error al cargar egresos:', egresosResult.reason);
      }

      // Convertir mapa a array
      this.rowData = Array.from(accountsMap.values());

      if (this.rowData.length === 0) {
        this.errorMessage = 'No hay datos en el rango de fechas seleccionado';
        this.chartIngresosOptions.series = [0, 0, 0];
        this.chartEgresosOptions.series = [0, 0, 0];
      } else {
        this.updateCharts();
      }
    } catch (error: any) {
      console.error('Error al cargar datos:', error);

      // Si es un error 404, significa que no hay datos (todos en 0)
      if (error?.status === 404) {
        this.errorMessage = 'No hay datos en el rango de fechas seleccionado';
        this.rowData = [];
        this.chartIngresosOptions.series = [0, 0, 0];
        this.chartEgresosOptions.series = [0, 0, 0];
      } else {
        this.errorMessage = 'Error al cargar los datos: ' + (error?.message || 'Error desconocido');
        this.rowData = [];
        this.chartIngresosOptions.series = [0, 0, 0];
        this.chartEgresosOptions.series = [0, 0, 0];
      }
    } finally {
      this.isLoading = false;
    }
  }

  updateCharts(): void {
    // Separar totales de INGRESOS por tipo de cuenta
    let ingEstatalTotal = 0;
    let ingMunicipalTotal = 0;
    let ingPropiosTotal = 0;

    // Separar totales de EGRESOS por tipo de cuenta
    let egrEstatalTotal = 0;
    let egrMunicipalTotal = 0;
    let egrPropiosTotal = 0;

    this.rowData.forEach(item => {
      const nameUpper = item.nameAccount.toUpperCase();
      const ingresosValue = item.ingresos || 0;
      const egresosValue = item.egresos || 0;

      // Verificar en orden de prioridad para evitar conflictos
      if (nameUpper.includes('INGRESOS PROPIOS') || nameUpper.includes('INGRESO PROPIO')) {
        ingPropiosTotal += ingresosValue;
        egrPropiosTotal += egresosValue;
      } else if (nameUpper.includes('ESTATAL')) {
        ingEstatalTotal += ingresosValue;
        egrEstatalTotal += egresosValue;
      } else if (nameUpper.includes('MUNICIPAL') || nameUpper.includes('MUNICIPALES')) {
        ingMunicipalTotal += ingresosValue;
        egrMunicipalTotal += egresosValue;
      }
    });

    this.chartIngresosOptions.series = [ingEstatalTotal, ingMunicipalTotal, ingPropiosTotal];
    this.chartEgresosOptions.series = [egrEstatalTotal, egrMunicipalTotal, egrPropiosTotal];
  }

  onDateRangeChange(): void {
    if (this.startDate && this.endDate) {
      this.loadData();
    }
  }

  private setPdfProgress(value: number, text: string): void {
    this.pdfProgress = Math.max(0, Math.min(100, value));
    this.pdfProgressText = text;
  }

  private computeCategoryTotals(sourceData?: TotalData[]): { ingresos: number[]; egresos: number[] } {
    const data = sourceData || this.rowData;
    let ingEstatalTotal = 0;
    let ingMunicipalTotal = 0;
    let ingPropiosTotal = 0;
    let egrEstatalTotal = 0;
    let egrMunicipalTotal = 0;
    let egrPropiosTotal = 0;

    data.forEach(item => {
      const nameUpper = (item.nameAccount || '').toUpperCase();
      const ingresosValue = Number(item.ingresos || 0);
      const egresosValue = Number(item.egresos || 0);

      if (nameUpper.includes('INGRESOS PROPIOS') || nameUpper.includes('INGRESO PROPIO')) {
        ingPropiosTotal += ingresosValue;
        egrPropiosTotal += egresosValue;
      } else if (nameUpper.includes('ESTATAL')) {
        ingEstatalTotal += ingresosValue;
        egrEstatalTotal += egresosValue;
      } else if (nameUpper.includes('MUNICIPAL') || nameUpper.includes('MUNICIPALES')) {
        ingMunicipalTotal += ingresosValue;
        egrMunicipalTotal += egresosValue;
      }
    });

    return {
      ingresos: [ingEstatalTotal, ingMunicipalTotal, ingPropiosTotal],
      egresos: [egrEstatalTotal, egrMunicipalTotal, egrPropiosTotal],
    };
  }

  private formatCurrency(value: number): string {
    return '$' + Number(value || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  private formatDateDMY(value: any): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private async loadDetailRowsForPdf(
    idRoot: number,
    type: 'DEPOSITO' | 'GASTO',
    nameAccount: string
  ): Promise<any[]> {
    try {
      const response = await this.incomesExpensesService
        .getDetailFromIncomesAndExpenses(idRoot, type, nameAccount, this.startDate, this.endDate)
        .toPromise();
      if (response?.success && response?.hasData && Array.isArray(response?.data)) {
        return response.data;
      }
      return [];
    } catch {
      return [];
    }
  }

  async openPdfReport(row: TotalData): Promise<void> {
    if (!row) return;
    try {
      const pdfMake = (await import('pdfmake/build/pdfmake')).default;
      const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
      (pdfMake as any).vfs =
        (pdfFonts as any).pdfMake?.vfs ||
        (pdfFonts as any).default?.pdfMake?.vfs ||
        (pdfFonts as any).vfs;

      const diferencia = Number(row.ingresos || 0) - Number(row.egresos || 0);
      const now = new Date();

      const docDefinition: any = {
        pageSize: 'LETTER',
        pageMargins: [30, 30, 30, 30],
        content: [
          { text: 'Reporte Consolidado - Palacio Municipal', style: 'title' },
          { text: `Cuenta: ${row.nameAccount || ''}`, style: 'subtitle' },
          { text: `Periodo: ${this.startDate} a ${this.endDate}`, margin: [0, 0, 0, 10] },
          {
            table: {
              widths: ['*', '*', '*'],
              body: [
                [
                  { text: 'Ingresos', style: 'th' },
                  { text: 'Egresos', style: 'th' },
                  { text: 'Diferencia', style: 'th' },
                ],
                [
                  { text: this.formatCurrency(row.ingresos), style: 'td' },
                  { text: this.formatCurrency(row.egresos), style: 'td' },
                  { text: this.formatCurrency(diferencia), style: 'td' },
                ],
              ],
            },
            layout: 'lightHorizontalLines',
          },
          {
            text: `Generado: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
            margin: [0, 12, 0, 0],
            fontSize: 9,
            color: '#666',
          }
        ],
        styles: {
          title: { fontSize: 15, bold: true, margin: [0, 0, 0, 6] },
          subtitle: { fontSize: 12, bold: true, margin: [0, 0, 0, 6] },
          th: { bold: true, fillColor: '#e9ecef', margin: [0, 4, 0, 4] },
          td: { margin: [0, 4, 0, 4] },
        },
        defaultStyle: {
          fontSize: 10,
        },
      };

      pdfMake.createPdf(docDefinition).open();
    } catch (error) {
      console.error('Error al generar PDF:', error);
      alerts.basicAlert('PDF', 'No se pudo generar el reporte PDF.', 'error');
    }
  }

  async exportCurrentViewPdf(): Promise<void> {
    this.isGeneratingPdf = true;
    this.setPdfProgress(5, 'Inicializando...');
    try {
      const reportRows = this.allRowData.length > 0 ? this.allRowData : this.rowData;

      this.setPdfProgress(15, 'Cargando motor PDF...');
      const pdfMake = (await import('pdfmake/build/pdfmake')).default;
      const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
      (pdfMake as any).vfs =
        (pdfFonts as any).pdfMake?.vfs ||
        (pdfFonts as any).default?.pdfMake?.vfs ||
        (pdfFonts as any).vfs;

      const rootId = this.signalsService.getRootSelectedBySidebar()();
      let logoBase64: string | null = null;
      let logo2Base64: string | null = null;
      let companyName = 'Empresa';
      this.setPdfProgress(30, 'Cargando logos de empresa...');
      if (rootId) {
        try {
          const rootData: any = await this.rootService.getRootbyId(rootId).toPromise();
          companyName = rootData?.name || rootData?.nameCompany || companyName;
          if (rootData?.picture) {
            logoBase64 = await this.base64EncodeService.convertImageToBase64(rootData.picture);
          }
          if (rootData?.picture2) {
            logo2Base64 = await this.base64EncodeService.convertImageToBase64(rootData.picture2);
          }
          if (!logo2Base64) logo2Base64 = logoBase64;
        } catch (logoError) {
          console.warn('No se pudieron cargar logos de la empresa:', logoError);
        }
      }

      this.setPdfProgress(45, 'Capturando gráficas...');
      await new Promise(resolve => setTimeout(resolve, 250));
      const [chartIngresosImg, chartEgresosImg] = await Promise.all([
        this.captureApexChartAsBase64(this.chartIngresos),
        this.captureApexChartAsBase64(this.chartEgresos),
      ]);

      this.setPdfProgress(60, 'Preparando tablas...');
      const categoryTotals = this.computeCategoryTotals(reportRows);
      const categoryTableBody = [
        [
          { text: 'Cuenta', style: 'th' },
          { text: 'Ingresos', style: 'th' },
          { text: 'Egresos', style: 'th' },
          { text: 'Diferencia', style: 'th' },
        ],
        ['Estatal', categoryTotals.ingresos[0], categoryTotals.egresos[0]],
        ['Municipal', categoryTotals.ingresos[1], categoryTotals.egresos[1]],
        ['Propios', categoryTotals.ingresos[2], categoryTotals.egresos[2]],
      ].map((row: any, idx: number) => {
        if (idx === 0) return row;
        const diferencia = Number(row[1]) - Number(row[2]);
        return [
          { text: row[0], style: 'td' },
          { text: this.formatCurrency(row[1]), style: 'tdNum' },
          { text: this.formatCurrency(row[2]), style: 'tdNum' },
          { text: this.formatCurrency(diferencia), style: 'tdNum' },
        ];
      });

      const tableBody = [
        [
          { text: 'Descripción', style: 'th' },
          { text: 'Ingresos', style: 'th' },
          { text: 'Egresos', style: 'th' },
          { text: 'Diferencia', style: 'th' },
        ],
        ...reportRows.map((item) => {
          const ingresos = Number(item.ingresos || 0);
          const egresos = Number(item.egresos || 0);
          const diferencia = ingresos - egresos;
          return [
            { text: item.nameAccount || '', style: 'td' },
            { text: this.formatCurrency(ingresos), style: 'tdNum' },
            { text: this.formatCurrency(egresos), style: 'tdNum' },
            { text: this.formatCurrency(diferencia), style: 'tdNum' },
          ];
        }),
      ];

      const content: any[] = [
        {
          table: {
            widths: ['*', 95, 95, 95],
            body: tableBody,
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 12],
        },
      ];

      if (chartIngresosImg || chartEgresosImg) {
        content.push({
          columns: [
            chartIngresosImg ? { image: chartIngresosImg, width: 250 } : { text: '' },
            chartEgresosImg ? { image: chartEgresosImg, width: 250 } : { text: '' },
          ],
          columnGap: 10,
        });
      }

      content.push(
        { text: 'Totales por Cuenta (Estatal / Municipal / Propios)', style: 'subtitle', margin: [0, 12, 0, 6] },
        {
          table: {
            widths: ['*', 95, 95, 95],
            body: categoryTableBody,
          },
          layout: 'lightHorizontalLines',
        }
      );

      this.setPdfProgress(72, 'Cargando detallados de ingresos y egresos...');
      if (rootId && reportRows.length > 0) {
        for (const account of reportRows) {
          const nameAccount = account.nameAccount || '';
          const [detailsIngresos, detailsEgresos] = await Promise.all([
            this.loadDetailRowsForPdf(rootId, 'DEPOSITO', nameAccount),
            this.loadDetailRowsForPdf(rootId, 'GASTO', nameAccount),
          ]);

          const toDetailBody = (rows: any[], type: 'DEPOSITO' | 'GASTO') => ([
            [
              { text: 'Mes / Anio', style: 'th' },
              { text: 'Descripcion', style: 'th' },
              { text: 'Fecha', style: 'th' },
              { text: 'Total', style: 'th' },
            ],
            ...rows.map((r: any) => {
              const d = new Date(r?.date);
              const monthYear = Number.isNaN(d.getTime())
                ? ''
                : d.toLocaleString('es-MX', { month: 'long', year: 'numeric' });
              return [
                { text: monthYear, style: 'td' },
                { text: nameAccount, style: 'td' },
                { text: this.formatDateDMY(r?.date), style: 'td' },
                {
                  text: this.formatCurrency(Number(r?.total || 0)),
                  style: 'tdNum',
                  color: type === 'DEPOSITO' ? '#198754' : '#dc3545'
                },
              ];
            })
          ]);

          content.push(
            { text: `Detalle de Ingresos y Egresos: ${nameAccount}`, style: 'subtitle', margin: [0, 12, 0, 6], pageBreak: 'before' },
            { text: 'Ingresos', style: 'sectionTitle', color: '#198754', margin: [0, 0, 0, 4] },
            {
              table: {
                widths: [110, '*', 80, 90],
                body: toDetailBody(detailsIngresos, 'DEPOSITO'),
              },
              layout: 'lightHorizontalLines',
              margin: [0, 0, 0, 8],
            },
            { text: 'Egresos', style: 'sectionTitle', color: '#dc3545', margin: [0, 0, 0, 4] },
            {
              table: {
                widths: [110, '*', 80, 90],
                body: toDetailBody(detailsEgresos, 'GASTO'),
              },
              layout: 'lightHorizontalLines',
            }
          );
        }
      }

      this.setPdfProgress(85, 'Generando PDF...');
      pdfMake.createPdf({
        pageSize: 'LETTER',
        pageMargins: [20, 80, 20, 28],
        header: {
          margin: [20, 12, 20, 0],
          columns: [
            {
              width: 80,
              stack: [
                logoBase64 ? { image: logoBase64, width: 65, margin: [0, 0, 0, 4] } : { text: '' },
                logo2Base64 ? { image: logo2Base64, width: 65 } : { text: '' },
              ]
            },
            {
              width: '*',
              stack: [
                { text: companyName, style: 'title', alignment: 'left' },
                { text: 'Dashboard Total - Palacio Municipal', style: 'subtitle', alignment: 'left' },
                { text: `Periodo: ${this.startDate} a ${this.endDate}`, alignment: 'left', fontSize: 9, color: '#4b5563' },
              ],
              margin: [8, 8, 0, 0]
            }
          ]
        },
        footer: (currentPage: number, pageCount: number) => ({
          margin: [20, 0, 20, 8],
          columns: [
            { text: `Generado: ${new Date().toLocaleString()}`, fontSize: 8, color: '#6b7280' },
            { text: `Pagina ${currentPage} de ${pageCount}`, alignment: 'right', fontSize: 8, color: '#6b7280' }
          ]
        }),
        content,
        styles: {
          title: { fontSize: 14, bold: true },
          subtitle: { fontSize: 11, bold: true },
          sectionTitle: { fontSize: 10, bold: true },
          th: { bold: true, fillColor: '#e9ecef', fontSize: 9 },
          td: { fontSize: 9 },
          tdNum: { fontSize: 9, alignment: 'right' },
        },
      }).open();
      this.setPdfProgress(100, 'Reporte generado');
    } catch (error) {
      console.error('Error exportando PDF de pantalla:', error);
      alerts.basicAlert('PDF', 'No se pudo exportar el PDF de la pantalla.', 'error');
    } finally {
      setTimeout(() => {
        this.isGeneratingPdf = false;
        this.setPdfProgress(0, '');
      }, 700);
    }
  }

  private async captureApexChartAsBase64(chart: ChartComponent | undefined): Promise<string | null> {
    if (!chart) return null;
    try {
      const dataUri = await (chart as any).dataURI();
      return dataUri?.imgURI || null;
    } catch (error) {
      console.warn('No se pudo capturar grafica ApexCharts:', error);
      return null;
    }
  }
}
