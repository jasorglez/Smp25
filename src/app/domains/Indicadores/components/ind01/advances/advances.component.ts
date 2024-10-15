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
import { concat, lastValueFrom, Subscription, toArray } from 'rxjs';
import { ChartComponent } from 'ng-apexcharts';
import { CommonModule } from '@angular/common';
import { alerts } from 'app/helpers/alerts';
import { OilfieldService } from 'app/services/oilfield.service';

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
  id?: string;
  __isNew?: boolean;
  __modified?: boolean;
  accumalateProgram?: number;
  accumulatePhysical?: number;
  date: string;
  physicalAdvanced: number;
  programAdvanced: number;
}

@Component({
  selector: 'app-advances',
  standalone: true,
  imports: [
    CommonModule,
    AgGridModule,
    NgApexchartsModule
  ],
  templateUrl: './advances.component.html',
  styleUrl: './advances.component.scss'
})
export class AdvancesComponent implements OnInit, OnChanges {
deleteEntry() {
throw new Error('Method not implemented.');
}



  private _contractsService = inject(ContractsService);
  private _signalsService = inject(SignalsService);
  private _advancesService = inject(AdvanceService);
  private _oilfieldsService = inject(OilfieldService);

  public contracts: any[] = [];
  public curretnContractSelected: number;
  public contractSelectedBySidebar = this._signalsService.getContractSelectedBySidebar();
  // Datos comunes para la tabla y la gráfica
  datosMensuales: ContractAdvance[] = [];

  // Configuración de AG Grid
  columnDefs: ColDef[] = [
    { field: 'date', headerName: 'Fecha', width: 150, editable: true },
    { field: 'programAdvanced', headerName: 'Programado', width: 150, editable: true },
    { field: 'physicalAdvanced', headerName: 'Fisico', width: 100, editable: true },
    { field: 'accumalateProgram', headerName: 'Acumulado Programado', width: 220, editable: true },
    { field: 'accumulatePhysical', headerName: 'Acumulado Fisico', width: 190, editable: true }
  ];

  rowData: ContractAdvance[] = [];

  // Configuración de ApexCharts
  public chartOptions: Partial<ChartOptions>;
  @ViewChild('chart') chart: ChartComponent;
  private tempIdCounter: number = 0;
  newlyAddedRows: string[] = [];
  notSavedChanges: boolean;

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
      this.obtenerDatos();
    });

   
   
  }

  ngOnInit(): void {
    
  }

  onCellValueChanged(event: any) {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['advances']) {
      this.actualizarDatos();
    }
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      type: 'Contract',
      date: new Date().toISOString().split('T')[0],
      idContract: this.curretnContractSelected,
      physicalAdvanced: 0,
      programAdvanced: 0,
      accumalateProgram: 0,
      accumulatePhysical: 0,
      active: 1,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }

  async saveChanges() {
    console.log(this.rowData);
    const isValid = this.rowData.every((item) => 
      item.date && 
      typeof item.programAdvanced === 'number' && 
      typeof item.physicalAdvanced === 'number' &&
      !isNaN(item.programAdvanced) &&
      !isNaN(item.physicalAdvanced)
    );
    
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar todos los campos con valores válidos antes de guardar. Asegúrese de que la fecha esté presente y que los avances programados y físicos sean números.',
        'error'
      );
      return;
    }

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );
    console.log(newRows, modifiedRows);
    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log(cleanedData);
      return this._advancesService.addAdvance(cleanedData);  
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this._advancesService.updateAdvance(Number(row.id), cleanedData);
    });

    // Using concat to combine observables and lastValueFrom for async/await
    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );
      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      this.obtenerDatos(); // Refrescar los datos
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }
  obtenerDatos() {
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
          accumulatePhysical: acumuladoFisico,
          id: advance.id
        };
      });
      this.rowData = this.datosMensuales;
      this.actualizarDatos();
    });
  }

  revert() {
  this.obtenerDatos()
    this.notSavedChanges = false;
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  private actualizarDatos() {
    // Actualizar datos de la tabla
    console.log(this.datosMensuales);
    this.rowData = this.datosMensuales.map(advance => ({
      date: advance.date.split('T')[0],
      programAdvanced: advance.programAdvanced, 
      physicalAdvanced: advance.physicalAdvanced,
      accumalateProgram: advance.accumalateProgram,
      accumulatePhysical: advance.accumulatePhysical,
      id: advance.id
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
