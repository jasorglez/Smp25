import { Component, inject, OnInit } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-community';
import { ContractsService } from 'app/services/contracts.service';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexTitleSubtitle,
  NgApexchartsModule
} from "ng-apexcharts";

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  title: ApexTitleSubtitle;
};

interface VentasMensuales {
  mes: string;
  ventas: number;
}

@Component({
  selector: 'app-advances',
  standalone: true,
  imports: [
    AgGridModule,
    NgApexchartsModule
  ],
  templateUrl: './advances.component.html',
  styleUrl: './advances.component.scss'
})
export class AdvancesComponent implements OnInit {

  private _contractsService = inject(ContractsService);
  public contracts: any[] = [];
  // Datos comunes para la tabla y la gráfica
  datosMensuales: VentasMensuales[] = [
    { mes: "Ene", ventas: 10000 },
    { mes: "Feb", ventas: 15000 },
    { mes: "Mar", ventas: 13000 },
    { mes: "Abr", ventas: 17000 },
    { mes: "May", ventas: 20000 },
    { mes: "Jun", ventas: 19000 },
    { mes: "Jul", ventas: 22000 },
    { mes: "Ago", ventas: 25000 },
    { mes: "Sep", ventas: 28000 }
  ];

  // Configuración de AG Grid
  columnDefs: ColDef[] = [
    { field: 'mes', headerName: 'Mes' },
    { field: 'ventas', headerName: 'Ventas' }
  ];

  rowData: VentasMensuales[] = this.datosMensuales;

  // Configuración de ApexCharts
  public chartOptions: Partial<ChartOptions>;

  constructor() {
    this.chartOptions = {
      series: [
        {
          name: "Ventas",
          data: this.datosMensuales.map(dato => dato.ventas)
        }
      ],
      chart: {
        height: 300,
        type: "area"
      },
      title: {
        text: "Ventas Mensuales"
      },
      xaxis: {
        categories: this.datosMensuales.map(dato => dato.mes)
      }
    };
  }

  ngOnInit(): void {
    this._contractsService.getContractsBy2fields(1).subscribe((contracts: any) => {
      console.log(contracts);
      this.contracts = contracts;
    });
  }
}
