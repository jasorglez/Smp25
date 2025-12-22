import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { AuthService } from 'app/services/auth.service';
import { SignalsService } from 'app/services/signals.service';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
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
    NgApexchartsModule,
  ],
  templateUrl: './dastot-pal.component.html',
  styleUrl: './dastot-pal.component.scss',
})
export class DastotPalComponent implements OnInit {
  @ViewChild('chartIngresos') chartIngresos!: ChartComponent;
  @ViewChild('chartEgresos') chartEgresos!: ChartComponent;

  authService = inject(AuthService);
  private signalsService = inject(SignalsService);
  private incomesExpensesService = inject(IncomesAndExpensesService);

  // Grid variables
  gridApi!: GridApi;
  rowData: TotalData[] = [];
  isLoading: boolean = false;
  errorMessage: string = '';

  // Date range variables
  startDate: string = '2025-01-01';
  endDate: string = '2025-12-31';

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
      cellStyle: { textAlign: 'right', fontWeight: 'bold', color: '#28a745' },
    },
    {
      field: 'egresos',
      headerName: 'Total Egresos',
      width: 150,
      valueFormatter: (params) => {
        if (params.value == null) return '$0.00';
        return '$' + params.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      },
      cellStyle: { textAlign: 'right', fontWeight: 'bold', color: '#dc3545' },
    },
    {
      headerName: 'PDF',
      width: 100,
      cellRenderer: () => {
        return '<button class="btn btn-sm btn-outline-danger"><i class="bi bi-file-pdf"></i> PDF</button>';
      },
      cellStyle: { textAlign: 'center' },
    },
  ];

  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 25,
    enableRangeSelection: true,
    pagination: false,
    domLayout: 'autoHeight',
  };

  ngOnInit(): void {
    // Esperar a que haya un idRoot antes de cargar datos
    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    if (idRoot) {
      this.loadData();
    }
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    this.gridApi.sizeColumnsToFit();
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
}
