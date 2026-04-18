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
  public monthlyTableData: any[] = [];
  private readonly ALL_MONTHS = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

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
          name: 'Avance Programado',
          data: []
        },
        {
          name: 'Avance Físico',
          data: []
        }
      ],
      chart: {
        height: 380,
        width: '100%',
        type: "line",
        stacked: false,
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        animations: {
          enabled: true,
          speed: 800
        },
        toolbar: {
          show: true
        }
      },
      colors: ["#1e88e5", "#d32f2f", "#ffd700"],
      dataLabels: {
        enabled: false
      },
      fill: {
        type: 'gradient',
        gradient: {
          opacityFrom: 0.45,
          opacityTo: 0.05,
          stops: [20, 100, 100, 100]
        }
      },
      stroke: {
        curve: "smooth",
        width: [3, 3],
        lineCap: 'round'
      },
      title: {
        text: "📊 Seguimiento de Obra",
        align: "left",
        style: {
          fontSize: '18px',
          fontWeight: '700',
          color: '#1a237e'
        }
      },
      grid: {
        show: true,
        borderColor: '#e8eaf6',
        strokeDashArray: 3
      },
      markers: {
        size: 4,
        strokeWidth: 2
      },
      xaxis: {
        categories: [],
        labels: {
          style: {
            colors: ['#666'],
            fontSize: '12px'
          }
        }
      },
      yaxis: {
        title: {
          text: "Avance Acumulado (%)"
        },
        labels: {
          formatter: (value) => value.toFixed(0) + '%'
        }
      },
      legend: {
        position: "top",
        horizontalAlign: "center",
        floating: false
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
    // Actualizar datos del grid
    this.rowData = this.datosMensuales.map(advance => ({
      date: advance.date.split('T')[0],
      programAdvanced: advance.programAdvanced,
      physicalAdvanced: advance.physicalAdvanced,
      accumulateProgram: advance.accumulateProgram,
      accumulatePhysical: advance.accumulatePhysical,
      idContract: advance.idContract,
      id: advance.id
    }));

    // Agrupar datos por mes (cada 10 días = 1 mes), 12 meses total
    const programSeries: any[] = new Array(12).fill(null);
    const physicalSeries: any[] = new Array(12).fill(null);
    const hitosSeries: any[] = new Array(12).fill(null);

    this.monthlyTableData = this.ALL_MONTHS.map(m => ({ month: m, program: null, physical: null, hito: null }));

    for (let i = 0; i < 9; i++) {
      const endIndex = (i + 1) * 10 - 1;
      if (endIndex < this.datosMensuales.length) {
        const program = parseFloat(this.datosMensuales[endIndex].accumulateProgram.toFixed(2));
        const physical = parseFloat(this.datosMensuales[endIndex].accumulatePhysical.toFixed(2));
        // hito = suma del mes (diferencia entre acumulados)
        const startIndex = i * 10;
        const hitoVal = parseFloat(
          (this.datosMensuales[endIndex].accumulateProgram -
          (startIndex > 0 ? this.datosMensuales[startIndex - 1].accumulateProgram : 0)).toFixed(2)
        );
        programSeries[i] = program;
        physicalSeries[i] = physical;
        hitosSeries[i] = hitoVal;
        this.monthlyTableData[i].program = program;
        this.monthlyTableData[i].physical = physical;
        this.monthlyTableData[i].hito = hitoVal;
      }
    }

    // Actualizar datos de la gráfica: 12 puntos mensuales
    this.chartOptions = {
      series: [
        { name: 'Avance Programado Acumulado', data: programSeries, type: 'line' },
        { name: 'Avance Real Acumulado',        data: physicalSeries, type: 'line' },
        { name: 'Hitos de Avance',              data: hitosSeries,   type: 'column' }
      ],
      chart: {
        height: 380,
        width: '100%',
        type: "line",
        stacked: false,
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        animations: {
          enabled: true,
          speed: 800,
          animateGradually: {
            enabled: true,
            delay: 150
          },
          dynamicAnimation: {
            enabled: true,
            speed: 150
          }
        },
        toolbar: {
          show: true,
          tools: {
            download: true,
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true
          },
          autoSelected: 'zoom'
        },
        background: '#fff'
      },
      colors: ["#e67e22", "#2980b9", "#f1c40f"],
      dataLabels: { enabled: false },
      fill: {
        type: ['gradient', 'gradient', 'solid'],
        gradient: {
          shade: 'light',
          type: 'vertical',
          opacityFrom: 0.3,
          opacityTo: 0.05,
          stops: [0, 100]
        }
      },
      stroke: {
        curve: "smooth",
        width: [3, 3, 0],
        dashArray: [0, 0, 0],
        lineCap: 'round'
      },
      plotOptions: {
        bar: {
          columnWidth: '55%',
          borderRadius: 3
        }
      },
      title: {
        text: "Curva S — Avance Programado vs Avance Real",
        align: "left",
        margin: 15,
        style: {
          fontSize: '15px',
          fontWeight: '700',
          color: '#1a237e',
          fontFamily: 'Arial, sans-serif'
        }
      },
      grid: {
        show: true,
        borderColor: '#e8eaf6',
        strokeDashArray: 3,
        xaxis: {
          lines: {
            show: false
          }
        },
        yaxis: {
          lines: {
            show: true
          }
        },
        padding: {
          left: 0,
          right: 0,
          bottom: 0
        }
      },
      markers: {
        size: 4,
        strokeWidth: 2,
        hover: {
          size: 7
        }
      },
      xaxis: {
        categories: this.ALL_MONTHS,
        labels: {
          style: {
            colors: ['#555'],
            fontSize: '11px',
            fontWeight: '600'
          }
        },
        axisBorder: { show: true, color: '#ccc' },
        axisTicks:  { show: true, color: '#ccc' }
      },
      yaxis: {
        min: 0,
        max: 110,
        tickAmount: 10,
        title: {
          text: "Avance Acumulado (%)",
          style: {
            color: '#1a237e',
            fontSize: '13px',
            fontWeight: '700'
          }
        },
        labels: {
          formatter: (value) => {
            return value.toFixed(0) + '%'
          },
          style: {
            colors: ['#666'],
            fontSize: '11px'
          }
        },
        axisBorder: {
          show: true,
          color: '#e8eaf6'
        },
        axisTicks: {
          show: true,
          color: '#e8eaf6'
        }
      },
      legend: {
        position: "top",
        horizontalAlign: "center",
        floating: false,
        fontSize: '13px',
        fontWeight: '600'
      },
      tooltip: {
        theme: 'light',
        shared: true,
        intersect: false,
        x: {
          show: true,
          format: 'dd/MM/yyyy'
        },
        y: {
          formatter: (value) => {
            return value.toFixed(1) + '%'
          }
        }
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