import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { AuthService } from 'app/services/auth.service';
import { SignalsService } from 'app/services/signals.service';
import { CatalogadmonService } from 'app/services/catalogadmon.service';
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

interface IncomeData {
  nameAccount: string;
  ingresos: number;
}

@Component({
  selector: 'app-dasing-pal',
  standalone: true,
  imports: [
    RouterModule,
    DomainsModule,
    AgGridModule,
    FormsModule,
    CommonModule,
    NgApexchartsModule,
  ],
  templateUrl: './dasing-pal.component.html',
  styleUrl: './dasing-pal.component.scss',
})
export class DasingPalComponent implements OnInit {
  @ViewChild('chart') chart!: ChartComponent;

  authService = inject(AuthService);
  private signalsService = inject(SignalsService);
  private incomesExpensesService = inject(IncomesAndExpensesService);

  // Grid variables
  gridApi!: GridApi;
  rowData: IncomeData[] = [];
  isLoading: boolean = false;
  errorMessage: string = '';

  // Date range variables
  startDate: string = '2025-01-01';
  endDate: string = '2025-12-31';

  // Chart configuration
  public chartOptions: ChartOptions = {
    series: [0, 0, 0],
    chart: {
      type: 'pie',
      height: 400,
    },
    labels: ['Estatal', 'Municipal', 'Propios'],
    colors: ['#00E396', '#008FFB', '#FEB019'],
    legend: {
      position: 'bottom',
      fontSize: '14px',
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
      width: 180,
      valueFormatter: (params) => {
        if (params.value == null) return '$0.00';
        return '$' + params.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      },
      cellStyle: { textAlign: 'right', fontWeight: 'bold' },
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

      const response = await this.incomesExpensesService.getIncomesByAccount(
        idRoot,
        'DEPOSITO',
        this.startDate,
        this.endDate
      ).toPromise();

      if (response?.success && response?.hasData) {
        this.rowData = response.data;
        this.updateChart();
      } else {
        this.errorMessage = response?.message || 'No hay datos en el rango de fechas seleccionado';
        this.rowData = [];
        this.chartOptions.series = [0, 0, 0];
      }
    } catch (error: any) {
      console.error('Error al cargar datos:', error);

      // Si es un error 404, significa que no hay datos (todos en 0)
      if (error?.status === 404) {
        this.errorMessage = 'No hay datos en el rango de fechas seleccionado';
        this.rowData = [];
        this.chartOptions.series = [0, 0, 0];
      } else {
        this.errorMessage = 'Error al cargar los datos: ' + (error?.message || 'Error desconocido');
        this.rowData = [];
        this.chartOptions.series = [0, 0, 0];
      }
    } finally {
      this.isLoading = false;
    }
  }

  updateChart(): void {
    // Separar totales por tipo de cuenta basado en el nombre
    let estatalTotal = 0;
    let municipalTotal = 0;
    let propiosTotal = 0;

    this.rowData.forEach(item => {
      const nameUpper = item.nameAccount.toUpperCase();
      // Verificar en orden de prioridad para evitar conflictos
      if (nameUpper.includes('INGRESOS PROPIOS') || nameUpper.includes('INGRESO PROPIO')) {
        propiosTotal += item.ingresos;
      } else if (nameUpper.includes('ESTATAL')) {
        estatalTotal += item.ingresos;
      } else if (nameUpper.includes('MUNICIPAL') || nameUpper.includes('MUNICIPALES')) {
        municipalTotal += item.ingresos;
      }
    });

    this.chartOptions.series = [estatalTotal, municipalTotal, propiosTotal];
  }

  onDateRangeChange(): void {
    if (this.startDate && this.endDate) {
      this.loadData();
    }
  }
}
