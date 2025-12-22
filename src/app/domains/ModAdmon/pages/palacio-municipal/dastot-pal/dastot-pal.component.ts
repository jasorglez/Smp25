import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { AuthService } from 'app/services/auth.service';
import { SignalsService } from 'app/services/signals.service';
import { CatalogadmonService } from 'app/services/catalogadmon.service';
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

interface CategorySummary {
  category: string;
  estatal: number;
  municipal: number;
  propios: number;
  total: number;
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
  @ViewChild('chart') chart!: ChartComponent;

  authService = inject(AuthService);
  private signalsService = inject(SignalsService);
  private catalogadmonService = inject(CatalogadmonService);

  // Grid variables
  gridApi!: GridApi;
  rowData: CategorySummary[] = [];

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
      field: 'category',
      headerName: 'Categoría',
      width: 250,
      pinned: 'left',
    },
    {
      field: 'estatal',
      headerName: 'Estatal',
      width: 150,
      valueFormatter: (params) => {
        if (params.value == null) return '$0.00';
        return '$' + params.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      },
      cellStyle: { textAlign: 'right' },
    },
    {
      field: 'municipal',
      headerName: 'Municipal',
      width: 150,
      valueFormatter: (params) => {
        if (params.value == null) return '$0.00';
        return '$' + params.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      },
      cellStyle: { textAlign: 'right' },
    },
    {
      field: 'propios',
      headerName: 'Propios',
      width: 150,
      valueFormatter: (params) => {
        if (params.value == null) return '$0.00';
        return '$' + params.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      },
      cellStyle: { textAlign: 'right' },
    },
    {
      field: 'total',
      headerName: 'Total',
      width: 150,
      valueFormatter: (params) => {
        if (params.value == null) return '$0.00';
        return '$' + params.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      },
      cellStyle: { textAlign: 'right', fontWeight: 'bold' },
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
    this.loadData();
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    this.gridApi.sizeColumnsToFit();
  }

  async loadData(): Promise<void> {
    // TODO: Implementar llamada al endpoint cuando esté disponible
    // Por ahora, datos de ejemplo (consolidado de ingresos y egresos)
    this.rowData = [
      {
        category: 'Total Ingresos',
        estatal: 100000,
        municipal: 60000,
        propios: 40000,
        total: 200000,
      },
      {
        category: 'Total Egresos',
        estatal: 85000,
        municipal: 65000,
        propios: 50000,
        total: 200000,
      },
      {
        category: 'Saldo',
        estatal: 15000,
        municipal: -5000,
        propios: -10000,
        total: 0,
      },
    ];

    this.updateChart();
  }

  updateChart(): void {
    // Calcular totales por tipo de cuenta (solo para visualización positiva)
    const estatototal = Math.abs(this.rowData[0]?.estatal || 0);
    const municipalTotal = Math.abs(this.rowData[0]?.municipal || 0);
    const propiosTotal = Math.abs(this.rowData[0]?.propios || 0);

    this.chartOptions.series = [estatototal, municipalTotal, propiosTotal];
  }

  onDateRangeChange(): void {
    console.log('Fecha inicio:', this.startDate);
    console.log('Fecha fin:', this.endDate);
    // TODO: Recargar datos con el nuevo rango de fechas
    this.loadData();
  }
}
