import { Component, inject, OnInit, effect, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, Grid, GridApi, GridReadyEvent } from 'ag-grid-community';
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
import { concat, lastValueFrom, toArray } from 'rxjs';
import { ChartComponent } from 'ng-apexcharts';
import { CommonModule } from '@angular/common';
import { alerts } from 'app/helpers/alerts';
import { OilfieldService } from 'app/services/oilfield.service';
import * as XLSX from 'xlsx';

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
  accumulateProgram?: number;
  accumulatePhysical?: number;
  date: string;
  physicalAdvanced: number;
  programAdvanced: number;
  idContract: number;
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

  private _signalsService = inject(SignalsService);
  private _advancesService = inject(AdvanceService);


  public contracts: any[] = [];
  public curretnContractSelected: number;
  public contractSelectedBySidebar = this._signalsService.getContractSelectedBySidebar();
  private gridApi: GridApi;
  // Datos comunes para la tabla y la gráfica
  datosMensuales: ContractAdvance[] = [];

  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    getRowClass: (params) => {
      // Verificar si la fila está seleccionada
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowClicked: (event) => {
      // Seleccionar la fila al hacer clic en cualquier celda
      event.node.setSelected(true);
    },

    onRowSelected: (event) => {
      // Deseleccionar otras filas cuando se selecciona una nueva
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
  };

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  columnDefs: ColDef[] = [
    { field: 'date', headerName: 'Fecha', width: 150, editable: true },
    { field: 'programAdvanced', headerName: 'Programado', width: 150, editable: true },
    { field: 'physicalAdvanced', headerName: 'Fisico', width: 100, editable: true },
    {
      field: 'accumulateProgram', headerName: 'Acumulado Programado', width: 220, editable: true, cellDataType: 'number',
      valueFormatter: (params) => {
        if (params.value) {
          return params.value.toFixed(2);
        }
        return '';
      }
    },
    {
      field: 'accumulatePhysical', headerName: 'Acumulado Fisico', width: 190, editable: true,
      cellDataType: 'number',
      valueFormatter: (params) => {
        if (params.value) {
          return params.value.toFixed(2);
        }
        return '';
      }
    }
  ];

  rowData: ContractAdvance[] = [];

  // Configuración de ApexCharts
  @ViewChild('chart') chart: ChartComponent;
  public chartOptions: Partial<ChartOptions>;
  private tempIdCounter: number = 0;
  newlyAddedRows: string[] = [];
  notSavedChanges: boolean;

  constructor() {
    this.chartOptions = {
      series: [
        {
          name: 'acumulado programado',
          data: this.datosMensuales.map(d => d.accumulateProgram)
        },
        {
          name: 'acumulado fisico',
          data: this.datosMensuales.map(d => d.accumulatePhysical)
        }
      ],
      chart: {
        height: '100%',
        width: '100%',
        type: "line",
        fontFamily: 'inherit',
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
        enabled: true,
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
          text: "dias"
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
    effect(() => {
      const nuevoValor = this._signalsService.getContractSelectedBySidebar();
      this.curretnContractSelected = nuevoValor();
      this.obtenerDatos();
    });
  }

  ngOnInit(): void {
    if (this.curretnContractSelected) {
      this.obtenerDatos()
    }
  }

  onCellValueChanged(event: any) {
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

    // Encontrar el índice de la nueva fila
    const newRowIndex = this.rowData.findIndex((row) => row.id === tempId);

    // Encontrar la primera columna editable
    const firstEditableCol = this.columnDefs.find(col => col.editable);
    const firstEditableColKey = firstEditableCol ? firstEditableCol.field : null;

    // Usar setTimeout para asegurar que el grid haya renderizado la nueva fila
    setTimeout(() => {
      if (firstEditableColKey) {
        this.gridApi.startEditingCell({
          rowIndex: newRowIndex,
          colKey: firstEditableColKey, // Editar la primera columna editable
        });
      }
    }, 50); // Un pequeño retraso de 50ms
  }

  async saveChanges() {
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
    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
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
      let acumuladoProgramado = 0;
      let acumuladoFisico = 0;
      this.datosMensuales = (advances as unknown as ContractAdvance[]).map(advance => {
        acumuladoProgramado += advance.programAdvanced;
        acumuladoFisico += advance.physicalAdvanced;
        return {
          date: advance.date.split('T')[0],
          programAdvanced: advance.programAdvanced,
          physicalAdvanced: advance.physicalAdvanced,
          accumulateProgram: acumuladoProgramado,
          accumulatePhysical: acumuladoFisico,
          idContract: advance.idContract,
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
    this.rowData = this.datosMensuales.map(advance => ({
      date: advance.date.split('T')[0],
      programAdvanced: advance.programAdvanced,
      physicalAdvanced: advance.physicalAdvanced,
      accumulateProgram: advance.accumulateProgram,
      accumulatePhysical: advance.accumulatePhysical,
      idContract: advance.idContract,
      id: advance.id
    }));

    // Actualizar datos de la gráfica
    this.chartOptions = {
      series: [
        {
          name: 'acumulado programado',
          data: this.datosMensuales.map(d => d.accumulateProgram)
        },
        {
          name: 'acumulado fisico',
          data: this.datosMensuales.map(d => d.accumulatePhysical)
        }
      ],
      chart: {
        height: '100%',
        width: '100%',
        type: "line",
        fontFamily: 'inherit',
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
        enabled: true,
        formatter: function (value) {
          const value2 = Number(value).toFixed(2);
          return value2; // muestra dos decimales
        }
      },
      stroke: {
        curve: "smooth"
      },
      title: {
        text: "Avance de contrato",
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
          text: "Medida de avance"
        },
        labels: {
          formatter: (value) => {
            return value.toFixed(2)
          },
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

    if (this.chart && this.chart.updateOptions) {
      this.chart.updateOptions(this.chartOptions);
    } else {
      console.warn('La instancia de la gráfica no está disponible para actualizar');
    }
  }

  importExcel(event: any) {
    const file = event.target.files[0];
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];

    if (!allowedTypes.includes(file.type)) {
      alerts.basicAlert(
        'Error de archivo',
        'Por favor, seleccione un archivo Excel válido (.xlsx o .xls).',
        'error'
      );
      return;
    }

    const fileReader = new FileReader();

    fileReader.onload = (e: any) => {
      const arrayBuffer = e.target.result;
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { raw: true });


      // Procesar los datos
      const processedData = data.map((row: any) => ({
        date: this.excelDateToJSDate(Number(row['Fecha'])),
        programAdvanced: Number(row['Programado']),
        physicalAdvanced: Number(row['Fisico']),
        idContract: this.curretnContractSelected,
        active: 1,
      }));


      processedData.map(item => {
        this._advancesService.addAdvance(item).subscribe((response) => {
        });

      });

      setTimeout(() => {
        this.obtenerDatos();
      }, 1000);

      alerts.basicAlert(
        'Importación exitosa',
        'Los datos del Excel se han importado correctamente.',
        'success'
      );

    };

    fileReader.readAsArrayBuffer(file);


  }

  private excelDateToJSDate(excelDate: number): string {
    // Excel usa el 1 de enero de 1900 como día 1
    const date = new Date((excelDate - 1) * 24 * 60 * 60 * 1000);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
