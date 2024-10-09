import { Component, inject, OnInit, effect, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-community';
import { AdvanceService } from 'app/services/advance.service';
import { ContractsService } from 'app/services/contracts.service';
import { SignalsService } from 'app/services/signals.service';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexTitleSubtitle,
  NgApexchartsModule,
  ApexDataLabels,
  ApexFill,
  ApexLegend,
  ApexPlotOptions,
  ApexStroke,
  ApexTooltip,
  ApexYAxis,
  ApexGrid,
  ApexMarkers
} from "ng-apexcharts";
import { Subscription } from 'rxjs';
import { ChartComponent } from 'ng-apexcharts';

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  title: ApexTitleSubtitle;
  dataLabels: ApexDataLabels;
  plotOptions: ApexPlotOptions;
  yaxis: ApexYAxis;
  colors: string[];
  fill: ApexFill;
  tooltip: ApexTooltip;
  markers: ApexMarkers;
  stroke: ApexStroke;
  grid: ApexGrid;
  legend: ApexLegend;
};

interface ContractAdvance {
  accumalateProgram: number;
  accumulatePhysical: number;
  date: string;
  physicalAdvanced: number;
  programAdvanced: number;
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
export class AdvancesComponent implements OnInit, OnChanges {

  private _contractsService = inject(ContractsService);
  private _signalsService = inject(SignalsService);
  private _advancesService = inject(AdvanceService);

  public contracts: any[] = [];
  public curretnContractSelected: number;
  public contractSelectedBySidebar = this._signalsService.getContractSelectedBySidebar();
  // Datos comunes para la tabla y la gráfica
  datosMensuales: ContractAdvance[] = [];

  // Configuración de AG Grid
  columnDefs: ColDef[] = [
    { field: 'date', headerName: 'Fecha', width: 150 },
    { field: 'programAdvanced', headerName: 'Programado', width: 150 },
    { field: 'physicalAdvanced', headerName: 'Fisico', width: 100 },
    { field: 'accumalateProgram', headerName: 'Acumulado Programado', width: 220 },
    { field: 'accumulatePhysical', headerName: 'Acumulado Fisico', width: 190 }
  ];

  rowData: ContractAdvance[] = [];

  // Configuración de ApexCharts
  public chartOptions: Partial<ChartOptions>;
  @ViewChild('chart') chart: ChartComponent;

  constructor() {
    this.chartOptions = {
      series: [
        {
          name: 'acumulado programado',
          data: this.datosMensuales.map(d => d.accumalateProgram)
        },
        {
          name: 'acumulado fisico',
          data: this.datosMensuales.map(d => d.accumulatePhysical)
        }
      ],  
      chart: {
        height: 300,
        type: "line"
      },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: "55%",
          borderRadius: 5
        }
      },
      dataLabels: {
        enabled: false
      },
      stroke: {
        show: true,
        width: 2,
        colors: ["transparent"]
      },
      title: {
        text: "estadisticas"
      },
      xaxis: {  
        categories: this.datosMensuales.map(dato => dato.date)
      },
      yaxis: {
        title: {
          text: "$ (thousands)"
        }
      },
      fill: {
        opacity: 1
      },
      tooltip: {
        y: {
          formatter: function(val) {
            return "$ " + val + " thousands";
          }
        }
      }
    };
    effect(() => {
      const nuevoValor = this._signalsService.getContractSelectedBySidebar();
      console.log('El valor ha cambiado:', nuevoValor());
      this.curretnContractSelected = nuevoValor();
      this._advancesService.getAdvancesByContract(this.curretnContractSelected, 'Contract').subscribe((advances: ContractAdvance) => {
        console.log(advances);
        let acumuladoProgramado = 0;
        let acumuladoFisico = 0;
        this.datosMensuales = (advances as unknown as ContractAdvance[]).map(advance => {
          acumuladoProgramado += advance.programAdvanced;
          acumuladoFisico += advance.physicalAdvanced;
          return {
            date: advance.date.split('T')[0],
            programAdvanced: advance.programAdvanced,
            physicalAdvanced: advance.physicalAdvanced,
            accumalateProgram: acumuladoProgramado,
            accumulatePhysical: acumuladoFisico
          };
        });
        this.rowData = this.datosMensuales;
        this.actualizarDatos();
      });
    });

   
   
  }

  ngOnInit(): void {
    
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['advances']) {
      this.actualizarDatos();
    }
  }

  private actualizarDatos() {
    // Actualizar datos de la tabla
    console.log(this.datosMensuales);
    this.rowData = this.datosMensuales.map(advance => ({
      date: advance.date.split('T')[0],
      programAdvanced: advance.programAdvanced, 
      physicalAdvanced: advance.physicalAdvanced,
      accumalateProgram: advance.accumalateProgram,
      accumulatePhysical: advance.accumulatePhysical
    }));

    // Actualizar datos de la gráfica
    this.chartOptions = {
      series: [
        {
          name: 'acumulado programado',
          data: this.datosMensuales.map(d => d.accumalateProgram)
        },
        {
          name: 'acumulado fisico',
          data: this.datosMensuales.map(d => d.accumulatePhysical)
        }
      ],
      chart: {
        height: 350,
        type: "line",
        dropShadow: {
          enabled: true,
          color: "#000",
          top: 18,
          left: 7,
          blur: 10,
          opacity: 0.2
        },
        toolbar: {
          show: false
        }
      },
      colors: ["#77B6EA", "#545454"],
      dataLabels: {
        enabled: true
      },
      stroke: {
        curve: "smooth"
      },
      title: {
        text: "Average High & Low Temperature",
        align: "left"
      },
      grid: {
        borderColor: "#e7e7e7",
        row: {
          colors: ["#f3f3f3", "transparent"], // takes an array which will be repeated on columns
          opacity: 0.5
        }
      },
      markers: {
        size: 1
      },
      xaxis: {
        categories: this.datosMensuales.map(d => d.date)
      },
      yaxis: {
        title: {
          text: "Temperature"
        }
      },
      legend: {
        position: "top",
        horizontalAlign: "right",
        floating: true,
        offsetY: -25,
        offsetX: -5
      }
      
    };

    if (this.chart) {
      this.chart.updateOptions(this.chartOptions);
    }
  }
}
