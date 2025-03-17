import { RouterModule } from '@angular/router';
import { Component, effect, HostListener, inject, OnInit } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { PayrollService, PayrollData, EmployeePayroll } from '../../../../services/payroll.service';
import { FormsModule } from '@angular/forms';
import { DomainsModule } from 'app/domains/domainsmodule';

import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { alerts } from '../../../../helpers/alerts';
import { AdministrationService } from 'app/services/administration.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { ModalService } from 'app/services/modal.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { DetailpayrollComponent } from "./detailpayroll/detailpayroll.component";
import { SignalsService } from 'app/services/signals.service';


@Component({
  selector: 'app-payroll',
  standalone: true,
  imports: [
    RouterModule,
    DomainsModule,
    AgGridModule,
    FormsModule,
    DetailpayrollComponent
  ],
  templateUrl: './payroll.component.html',
  styleUrl: './payroll.component.scss'
})

export class PayrollComponent implements OnInit {

  ngOnInit() {
    this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
    this.obtenerDatos();
  }

  obtenerDatos() {
    this.administrationService.getNormalPayrolls(this.idBranch).subscribe((data: any) => {
      this.rowData = data;
      console.log("--------------- esto llega en data: ", data);
      console.log("--------------- este es el idbranch: ", this.idBranch);
    },
      (error) => {
        this.rowData = [];
        console.log("Error al obtener datos de normal payrolls: ", error);
      });
  }

  obtenerExistenciaDP(startDate, endDate, idBranch) {
    this.administrationService.getDPPayrollsExistence(startDate, endDate, idBranch).
      subscribe({
        next: (payrollId) => {
          console.log("-------------- PayrollId Recibido: ", payrollId);
          if (payrollId !== 0) {
            console.log(`Nómina encontrada con ID: ${payrollId}`);
          } else {
            console.log('No se encontró ninguna nómina.');
          }
        },
        error: (error) => {
          console.error('Error al obtener el PayrollId:', error);
        }
      })
  }

  private signalsService = inject(SignalsService);

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  mostrarGridDetalle = false;
  datosDetalle: any = [];
  notSavedChanges: boolean = false;
  private tempIdCounter: number = 0;
  id: string;
  idBranch: number;
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  private modalServiceTable = inject(ModalService);
  selectedRowData: any = null;
  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  showPayrollDetailTab: boolean = false;
  gridHeight: string = '80vh';
  DPAvailable: boolean = true;
  aggregatingRecord: boolean = false
  initialDate: string;
  endingDate: string;

  activatePayrollDetailTab() {
    this.showPayrollDetailTab = true;
    this.adjustGridSize();
  }

  adjustGridSize() {
    this.gridHeight = '20vh'; // Adjust as needed
  }

  mostrarDetalle(params: any) {
    this.mostrarGridDetalle = true;
    this.datosDetalle = [
      { detalleId: 1, info: `Detalle de ${params.data.nombre}` },
      { detalleId: 2, info: `Más info de ${params.data.nombre}` }
    ];
  }

  cerrarDetalle() {
    this.mostrarGridDetalle = false;
  }

  get colMaster(): ColDef[] {
    return [
      {
        headerName: 'Fecha Inicio',
        field: 'startDate',
        editable: (params) => { return this.aggregatingRecord },


        valueGetter: (params) => {
          if (params.node.rowIndex == 0) {
            console.log('Params completo:', params);
            console.log('Datos de la fila:', params.data);
            console.log('Valor de startDate:', params.data.startDate);
          }

          return params.data.startDate ? new Date(params.data.startDate) : null;
        },

        cellRenderer: 'agDateCellRenderer',
        /*
        cellEditor: 'agDateCellEditor',
        valueFormatter: (params) => {
          if (params.value) {
            console.log("------- dentro de valueFormatter startDate: ", params.value);
            const date = new Date(params.value);
            this.initialDate = `${('0' + date.getDate()).slice(-2)}-${('0' + (date.getMonth() + 1)).slice(-2)}-${date.getFullYear()}`;
            console.log("------- dentro de valueFormatter startDate valorObtenido: ", this.initialDate);
            return this.initialDate;
          }
          return '';
        },
        */
        width: 170
      },
      {
        headerName: 'Fecha Fin',
        field: 'endDate',
        editable: (params) => { return this.aggregatingRecord },

        /*
        valueGetter: (params) => params.data.endDate ? new Date(params.data.endDate) : null,
        cellRenderer: 'agDateCellRenderer',
        cellEditor: 'agDateCellEditor',
        valueFormatter: (params) => {
          if (params.value) {
            console.log("------- dentro de valueFormatter endDate: ", params.value);

            const date = new Date(params.value);
            this.endingDate = `${('0' + date.getDate()).slice(-2)}-${('0' + (date.getMonth() + 1)).slice(-2)}-${date.getFullYear()}`;
            console.log("------- dentro de valueFormatter endDate valorObtenido: ", this.endingDate);
            return this.endingDate;
          }
          return '';
        },
        */
        width: 170,
      },

      { field: 'totalBaseWorkingHours', headerName: 'Total Jornadas Base', width: 170 },

      {
        field: 'totalBaseExtraHours', headerName: 'Total Jornadas Extra', width: 170, cellEditorParams: {
          maxLength: 15
        }
      },

      { field: 'totalSubtotal', headerName: 'Total Subtotal', width: 140 },

      { field: 'totalDescuentos', headerName: 'Total Descuentos', width: 160 },
      { field: 'total', headerName: 'Total', width: 100 },
      {
        headerName: 'Nóm Digital',
        field: 'NomDigital',
        width: 130,
        //cellRenderer: 'excelDownloadCellRenderer',

        cellRenderer: (params) => {
          const button = document.createElement('button');

          this.DPAvailable = true;

          button.innerHTML = this.DPAvailable ? '✅' : '❌'; // Palomita o cruz roja
          button.style.cursor = 'pointer';
          button.style.border = 'none';
          button.style.background = 'transparent';
          button.style.fontSize = '12px';

          button.addEventListener('click', () => {
            //alert(`Estado en la fila: row: ${params.node.rowIndex} -- Id: ${params.data.id} -- FechaInicial: ${params.data.startDate} -- FechaFinal: ${params.data.endDate}
            //  -- IdBranch Tabla: ${params.data.idBranch} -- ${this.DPAvailable ? 'Disponible' : 'No disponible'}`);
            this.onCheckClick(params);

            // Aquí puedes ejecutar cualquier otra acción, como actualizar el estado
          });


          return button;
        },



        onCellDoubleClicked: this.onCellDoubleClicked.bind(this)
      },
    ]
  };

  onCheckClick(params: any): void {
    console.log("entrando a oncheckclick()");
              if (!params.data) return;

          const payrollId = params.data.id;
          const startDate = params.data.startDate ? new Date(params.data.startDate) : null;
          const endDate = params.data.endDate ? new Date(params.data.endDate) : null;
          //const idBranch = this.idBranch;
          const idBranch = params.data.idBranch;
          console.log("el valor de idBranch es: ", idBranch);

          if (!startDate || !endDate) {
            console.error('Fechas no válidas');
            alert('No se pudo descargar el archivo: fechas no válidas');
            return;
          }

          // Llamar al servicio para descargar el Excel
          this.payrollService.downloadPayrollExcel(idBranch, startDate, endDate)
            .subscribe({
              next: (blob: Blob) => {
                // Crear un nombre de archivo descriptivo
                const fileName = `Nomina_${new Date(startDate).toISOString().split('T')[0]}_${new Date(endDate).toISOString().split('T')[0]}.xlsx`;

                // Crear URL del objeto y generar la descarga
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                link.click();

                // Liberar el objeto URL
                window.URL.revokeObjectURL(url);
              },
              error: (error) => {
                console.error('Error al descargar el archivo:', error);
                alert('No se pudo descargar el archivo. Por favor, inténtelo de nuevo.');
              }
            });
        }



  onCellValueChanged(event: any) {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    rowClass: (params) => {
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
    onCellDoubleClicked: this.onCellDoubleClicked.bind(this),
  };

  onCellDoubleClicked(event: CellDoubleClickedEvent): void {
    //alert("Holaaaaaaaaaaaaa");
    const colId = event.column.getColId();
    const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
    console.log("DOBLE CLICK", event.data);
    console.log("DOBLE CLICK en columna", colId);

    const selectedId = selectedRowData.id; // Obtener el ID del registro
    this.signalsService.setNormalPayrollId(selectedId);
    console.log("el ID NORMAYPAYROLL ES", selectedId);


    if (colId === 'NomDigital') {     // Filtrar el grid para mostrar solo el registro con el ID seleccionado
      const filterModel = {
        id: {
          type: 'equals',
          filter: selectedId,
        },
      };

      this.gridApi.setFilterModel(filterModel);
      this.gridApi.onFilterChanged();
    }

    console.log("---------------- el valor de aggregatingrecord es: ", this.aggregatingRecord);
    if (!this.aggregatingRecord)
      this.activatePayrollDetailTab();

    // Puedes agregar lógica adicional aquí si necesitas guardar los datos seleccionados
    this.selectedRowData = selectedRowData;
  }

  /*
  onCellDoubleClicked(event: CellDoubleClickedEvent): void {
    const colId = event.column.getColId();
    const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
    const selectedId = selectedRowData.id; // Obtener el ID del registro

    if (colId === 'loan' || colId === 'saving') {
      // Filtrar el grid para mostrar solo el registro con el ID seleccionado
      const filterModel = {
        id: {
          type: 'equals',
          filter: selectedId,
        },
      };

      this.gridApi.setFilterModel(filterModel);
      this.gridApi.onFilterChanged();
    }

    if (colId === 'loan') {
      this.activateLoansTab();
    }

    if (colId === 'saving') {
      this.activateSavingsTab();
    }

    // Puedes agregar lógica adicional aquí si necesitas guardar los datos seleccionados
     this.selectedRowData = selectedRowData;
  }
  */

  addRow() {
    console.log('---------------------- entrando a alta de nomina');
    console.log("......... esto contiene rowdata: ", this.rowData);
    //const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      //id: tempId,
      idBranch: this.idBranch,
      startDate: '',
      endDate: '',
      active: true,
      __isNew: true,
    };
    console.log(".....................  NUEVO ITEM:   ", newItem);
    this.rowData = [newItem, ...this.rowData];
    this.notSavedChanges = true;
    this.aggregatingRecord = true;
    console.log("....................... rowData: ", this.rowData);
    console.log("....................... newItem: ", newItem.idBranch);

  }

  async saveChanges() {
    console.log("----------------------------------- entrando a salvar cambios")
    const isValid = this.rowData.every((item) => item.startDate && item.endDate && item.idBranch);
    // llamar al servicio de verificacion de existencia de nomina digital

    if (!isValid || this.rowData.startDate <= this.rowData.endDate) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar correctamente las fechas de inicio y fin de la semana laborada antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.rowData.filter((row) => row.__isNew);
    console.log("----------------estos son los new rows: ", newRows);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log("-------------------- los datos cleaned son: ", cleanedData);
      var resultado = this.administrationService.addNormalPayroll(cleanedData);
      console.log("-------------------- el resultado del endpoint es: ", resultado);

      return resultado;
    });

    /*
    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.administrationService.updateBanks(row.id, cleanedData);
    });
    */

    // Using concat to combine observables and lastValueFrom for async/await
    try {
      const responses = await lastValueFrom(
        concat(...addObservables).pipe(toArray())
      );
      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.aggregatingRecord = false;
      this.obtenerDatos(); // Refrescar los datos
      this.resetGridSize();
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  onSelectionChanged(event: any) {
    console.log(event)
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedRowData = null;
    }
  }

  // Datos para la tabla
  rowData: any;

  // Estado de carga
  isLoading = false;

  // Referencia al grid API
  private gridApi: any;
  private valorObtenido: any;

  // Definición de columnas para AG Grid
  columnDefs: ColDef[] = [
    { field: 'nombre', headerName: 'Nombre', sortable: true, filter: true, resizable: true },
    { field: 'codigoEmpleado', headerName: 'Código', sortable: true, filter: true, resizable: true },
    { field: 'diasTrabajados', headerName: 'Días', sortable: true, filter: true, width: 90 },
    { field: 'salarioDiario', headerName: 'Sal. Diario', sortable: true, filter: true, valueFormatter: this.currencyFormatter },
    { field: 'salarioDiarioIntegrado', headerName: 'SDI', sortable: true, filter: true, valueFormatter: this.currencyFormatter },
    { field: 'sueldos', headerName: 'Sueldos', sortable: true, filter: true, valueFormatter: this.currencyFormatter },
    { field: 'totalPercepciones', headerName: 'Tot. Percepciones', sortable: true, filter: true, valueFormatter: this.currencyFormatter },
    { field: 'percepcionesGravadas', headerName: 'Perc. Gravadas', sortable: true, filter: true, valueFormatter: this.currencyFormatter },
    { field: 'impuestoArt96', headerName: 'Imp. Art.96', sortable: true, filter: true, valueFormatter: this.currencyFormatter },
    { field: 'ISPT', headerName: 'ISPT', sortable: true, filter: true, valueFormatter: this.currencyFormatter },
    { field: 'IMSS', headerName: 'IMSS', sortable: true, filter: true, valueFormatter: this.currencyFormatter },
    { field: 'neto', headerName: 'Neto', sortable: true, filter: true, valueFormatter: this.currencyFormatter }
  ];

  // Configuración por defecto para todas las columnas
  defaultColDef: ColDef = {
    flex: 1,
    minWidth: 100,
    resizable: true,
    sortable: true,
    filter: true
  };

  constructor(private payrollService: PayrollService, private administrationService: AdministrationService) {
    effect(() => {
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.obtenerDatos();
    });
  }

  // Formateo de valores monetarios
  currencyFormatter(params: any) {
    if (typeof params.value !== 'number') {
      return params.value;
    }
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(params.value);
  }



  // Evento cuando el grid está listo
  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    // Ajustar columnas al tamaño óptimo
    this.gridApi.sizeColumnsToFit();
  }

  // Método para exportar a Excel
  exportToExcel(): void {
    if (this.gridApi) {
      this.gridApi.exportDataAsExcel({
        fileName: `Nominas_${new Date().toISOString().split('T')[0]}.xlsx`
      });
    }
  }

  // Método para refrescar los datos
  refreshData(): void {
    this.aggregatingRecord = false;
    this.obtenerDatos();
    this.resetGridSize();
  }

  onSelectedRow(event: any) {
    console.log(event)
    this.id = event.data.id;
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

  resetGridSize() {
    this.gridHeight = '80vh'; // Reset to default height
    this.showPayrollDetailTab = false; // Ocultar la pestaña de detalle
    if (this.gridApi) {
      this.gridApi.setFilterModel(null); // Limpiar filtros
      this.gridApi.onFilterChanged(); // Aplicar cambios
    }
  }
}

