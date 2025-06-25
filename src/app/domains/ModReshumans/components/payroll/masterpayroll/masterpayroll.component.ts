import { alerts } from 'app/helpers/alerts';
import { RouterModule } from '@angular/router';
import { Component, effect, HostListener, inject, OnInit } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { CurrencyPipe, formatCurrency } from '@angular/common';

import {
  PayrollService,
  PayrollData,
  EmployeePayroll,
} from 'app/services/payroll.service';

import { FormsModule } from '@angular/forms';
import { DomainsModule } from 'app/domains/domainsmodule';

import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';

import { AdministrationService } from 'app/services/administration.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { ModalService } from 'app/services/modal.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { DetailpayrollComponent } from '../detailpayroll/detailpayroll.component';
import { SignalsService } from 'app/services/signals.service';
import { AuthService } from 'app/services/auth.service';
import { BranchsService } from 'app/services/branchs.service';

@Component({
  selector: 'app-master-payroll',
  standalone: true,
  imports: [
    RouterModule,
    DomainsModule,
    AgGridModule,
    FormsModule,
    DetailpayrollComponent,
  ],
  templateUrl: './masterpayroll.component.html',
  styleUrl: './masterpayroll.component.scss',
})
export class MasterPayrollComponent implements OnInit {
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      if (this.idBranch == null) {
        this.rowData = [];
        alerts.basicAlert(
          'Empleados',
          'Debe elegir una sucursal primero.',
          'error'
        );
      } else {
        this.obtenerDatos();
        this.obtenerBranchs();
      }
    });
  }

  ngOnInit() {
    this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
    this.obtenerDatos();
  }

  obtenerDatos() {
    this.administrationService.getNormalPayrolls(this.idBranch).subscribe(
      (data: any) => {
        this.rowData = data;
        console.log(
          '---- Masterpayroll component. esto es data desde obtenerDatos(): ',
          data
        );
      },
      (error) => {
        this.rowData = [];
      }
    );
  }

  obtenerExistenciaDP(startDate, endDate, idBranch) {
    this.administrationService
      .getDPPayrollsExistence(startDate, endDate, idBranch)
      .subscribe({
        next: (payrollId) => {
          if (payrollId !== 0) {
          } else {
          }
        },
        error: (error) => {
          console.error('Error al obtener el PayrollId:', error);
        },
      });
  }

  private signalsService = inject(SignalsService);
  private authService = inject(AuthService);
  private branchesService = inject(BranchsService);
  private administrationService = inject(AdministrationService);
  private payrollService = inject(PayrollService);

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
  aggregatingRecord: boolean = false;
  initialDate: string;
  endingDate: string;
  branchs: any[] = [];
  idRoot: number;

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
      { detalleId: 2, info: `Más info de ${params.data.nombre}` },
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
        filter: 'agDateColumnFilter',

        editable: (params) => {
          return this.aggregatingRecord;
        },

        cellEditor: 'agDateCellEditor',

        valueGetter: (params) => {
          if (params.node.rowIndex == 0) {
          }
          return params.data.startDate ? new Date(params.data.startDate) : null;
        },

        valueFormatter: (params) => {
          if (params.value) {
            const date = new Date(params.value);
            this.initialDate = `${('0' + date.getDate()).slice(-2)}-${(
              '0' +
              (date.getMonth() + 1)
            ).slice(-2)}-${date.getFullYear()}`;
            return this.initialDate;
          }
          return '';
        },

        valueSetter: (params) => {
          if (!params.newValue) {
            alerts.basicAlert(
              'Campo requerido',
              'la fecha de inicio es requerida.',
              'error'
            );
            return false;
          }
          const duplicateExists = this.rowData.some(
            (row, index) =>
              index !== params.node.rowIndex && row.name === params.newValue
          );

          if (duplicateExists) {
            alerts.basicAlert(
              'Fecha duplicada',
              'Ya existe una fecha.',
              'error'
            );
            return false;
          }

          params.data[params.colDef.field] = params.newValue;
          return true;
        },

        width: 170,
      },
      {
        headerName: 'Fecha Fin',
        field: 'endDate',
        filter: 'agDateColumnFilter',
        editable: (params) => {
          return this.aggregatingRecord;
        },
        cellEditor: 'agDateCellEditor',
        valueGetter: (params) =>
          params.data.endDate ? new Date(params.data.endDate) : null,

        valueFormatter: (params) => {
          if (params.value) {
            const date = new Date(params.value);
            this.endingDate = `${('0' + date.getDate()).slice(-2)}-${(
              '0' +
              (date.getMonth() + 1)
            ).slice(-2)}-${date.getFullYear()}`;
            return this.endingDate;
          }
          return '';
        },
        valueSetter: (params) => {
          if (!params.newValue) {
            alerts.basicAlert(
              'Campo requerido',
              'la fecha de fin es requerida.',
              'error'
            );
            return false;
          }
          const duplicateExists = this.rowData.some(
            (row, index) =>
              index !== params.node.rowIndex && row.name === params.newValue
          );

          if (duplicateExists) {
            alerts.basicAlert(
              'Fecha duplicada',
              'Ya existe una fecha.',
              'error'
            );
            return false;
          }

          params.data[params.colDef.field] = params.newValue;
          return true;
        },
        width: 170,
      },

      {
        headerName: 'Sucursal',
        field: 'idBranch',
        headerClass: 'required-header',
        hide:
          this.authService.hasDetailedPermission(
            'principal',
            'see-all-branches'
          ) || this.signalsService.getemailChoose() === 'root@beapp.com.mx'
            ? false
            : true,
        editable: true,
        filter: true,
        width: 170,
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
        cellEditor: 'agSelectCellEditor',

        cellEditorParams: (params) => {
          return {
            values: this.branchs
              ? this.branchs
                  .slice() // Creamos una copia para no modificar el array original
                  .sort((a, b) => a.name.localeCompare(b.name)) // Ordenamos por nombre
                  .map((item) => item.id) // Extraemos solo los IDs
              : [],
          };
        },

        valueFormatter: (params) => {
          // Handle potential null values and properly format the displayed value
          if (!params.value) return '';

          const foundBranch = this.branchs
            ? this.branchs.find((item) => item.id === params.value)
            : null;

          return foundBranch ? foundBranch.name : params.value;
        },

        valueGetter: (params) => {
          if (!params.data || !params.data.idBranch) return '';
          const branch = this.branchs?.find(b => b.id === params.data.idBranch);
          return branch ? branch.name : '';
        },
      },

      {
        field: 'totalBaseWorkingHours',
        headerName: 'Total Jornadas Base',
        width: 170,
      },

      {
        field: 'totalBaseExtraHours',
        headerName: 'Total Jornadas Extra',
        width: 170,
        cellEditorParams: {
          maxLength: 15,
        },
      },

       { field: 'totalBonos',
        headerName: 'Total Bonos',
        width: 140,
        valueFormatter: params =>  this.formatCurrencyMx(params.value)
      },

      { field: 'totalSubtotal',
        headerName: 'Total Subtotal',
        width: 140,
        valueFormatter: params =>  this.formatCurrencyMx(params.value)
      },

      { field: 'totalDescuentos',
        headerName: 'Total Descuentos',
        width: 160,
        valueFormatter: params => this.formatCurrencyMx(params.value)
       },
      { field: 'total',
        headerName: 'Total',
        width: 100,
        valueFormatter: params => this.formatCurrencyMx(params.value)
      },
      {
        headerName: 'Nóm Digital',
        field: 'NomDigital',
        width: 130,
        valueFormatter: params => this.formatCurrencyMx(params.value),
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
        onCellDoubleClicked: this.onCellDoubleClicked.bind(this),
      },
    ];
  }

  onCheckClick(params: any): void {
    if (!params.data) return;

    const payrollId = params.data.id;
    const startDate = params.data.startDate ? new Date(params.data.startDate) : null;
    const endDate = params.data.endDate ? new Date(params.data.endDate) : null;
    //const idBranch = this.idBranch;
    const idBranch = params.data.idBranch;

    if (!startDate || !endDate) {
      console.error('Fechas no válidas');
      alert('No se pudo descargar el archivo: fechas no válidas');
      return;
    }

    // Llamar al servicio para descargar el Excel
    this.payrollService
      .downloadPayrollExcel(idBranch, startDate, endDate)
      .subscribe({
        next: (blob: Blob) => {
          // Crear un nombre de archivo descriptivo
          const fileName = `Nomina_${
            new Date(startDate).toISOString().split('T')[0]
          }_${new Date(endDate).toISOString().split('T')[0]}.xlsx`;

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
          alert(
            'No se pudo descargar el archivo. Por favor, inténtelo de nuevo.'
          );
        },
      });
  }

  onCellValueChanged(event: any) {
    if (
      event.data.endDate &&
      event.data.startDate &&
      event.data.endDate <= event.data.startDate
    ) {
      alerts.basicAlert(
        'Error',
        'La fecha de fin no puede ser menor o igual a la fecha de inicio.',
        'error'
      );
      event.data.endDate = '';
      event.data.startDate = '';
      return;
    }
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
    console.log(
      'Datos de la fila seleccionada:',
      selectedRowData,
      'Columna:',
      colId
    );
    this.signalsService.setFechaNomina(selectedRowData.startDate, selectedRowData.endDate);

    const selectedId = selectedRowData.id; // Obtener el ID del registro
    this.signalsService.setNormalPayrollId(selectedId);

    if (colId === 'NomDigital') {
      // Filtrar el grid para mostrar solo el registro con el ID seleccionado
      const filterModel = {
        id: {
          type: 'equals',
          filter: selectedId,
        },
      };
      console.log(selectedId);

      this.gridApi.setFilterModel(filterModel);
      this.gridApi.onFilterChanged();
    }

    if (!this.aggregatingRecord) this.activatePayrollDetailTab();

    // Puedes agregar lógica adicional aquí si necesitas guardar los datos seleccionados
    this.selectedRowData = selectedRowData;
  }

  addRow() {
    //const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      //id: tempId,
      //idBranch: this.idBranch,
      idBranch: this.idBranch > 0 ? this.idBranch : null,

      startDate: '',
      endDate: '',
      active: true,
      __isNew: true,
    };
    this.rowData = [newItem, ...this.rowData];
    this.notSavedChanges = true;
    this.aggregatingRecord = true;
  }

  async saveChanges() {
    const isValid = this.rowData.every(
      (item) => item.startDate && item.endDate && item.idBranch
    );
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
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      this.administrationService.addNormalPayroll(cleanedData).subscribe({
        next: (response) => {
          alerts.basicAlert('Datos guardados', response.message, 'success');
          this.notSavedChanges = false;
          this.aggregatingRecord = false;
          this.obtenerDatos(); // Refrescar los datos
          this.resetGridSize();
        },
        error: (error) => {
          const errorMessage =
            error?.error ||
            'Ocurrió un error al guardar los datos. Intente nuevamente.';
          alerts.basicAlert(
            'Error',
            error.error.message || errorMessage,
            'error'
          );
          this.notSavedChanges = false;
          this.aggregatingRecord = false;
          this.obtenerDatos(); // Refrescar los datos
          this.resetGridSize();
        },
      });
    });
  }

  onSelectionChanged(event: any) {
    console.log(event);
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
    {
      field: 'nombre',
      headerName: 'Nombre',
      sortable: true,
      filter: true,
      resizable: true,
    },
    {
      field: 'codigoEmpleado',
      headerName: 'Código',
      sortable: true,
      filter: true,
      resizable: true,
    },
    {
      field: 'diasTrabajados',
      headerName: 'Días',
      sortable: true,
      filter: true,
      width: 90,
    },
    {
      field: 'salarioDiario',
      headerName: 'Sal. Diario',
      sortable: true,
      filter: true,
      valueFormatter: this.currencyFormatter,
    },
    {
      field: 'salarioDiarioIntegrado',
      headerName: 'SDI',
      sortable: true,
      filter: true,
      valueFormatter: this.currencyFormatter,
    },
    {
      field: 'sueldos',
      headerName: 'Sueldos',
      sortable: true,
      filter: true,
      valueFormatter: this.currencyFormatter,
    },
    {
      field: 'totalPercepciones',
      headerName: 'Tot. Percepciones',
      sortable: true,
      filter: true,
      valueFormatter: this.currencyFormatter,
    },
    {
      field: 'percepcionesGravadas',
      headerName: 'Perc. Gravadas',
      sortable: true,
      filter: true,
      valueFormatter: this.currencyFormatter,
    },
    {
      field: 'impuestoArt96',
      headerName: 'Imp. Art.96',
      sortable: true,
      filter: true,
      valueFormatter: this.currencyFormatter,
    },
    {
      field: 'ISPT',
      headerName: 'ISPT',
      sortable: true,
      filter: true,
      valueFormatter: this.currencyFormatter,
    },
    {
      field: 'IMSS',
      headerName: 'IMSS',
      sortable: true,
      filter: true,
      valueFormatter: this.currencyFormatter,
    },
    {
      field: 'neto',
      headerName: 'Neto',
      sortable: true,
      filter: true,
      valueFormatter: this.currencyFormatter,
    },
  ];

  // Configuración por defecto para todas las columnas
  defaultColDef: ColDef = {
    flex: 1,
    minWidth: 100,
    resizable: true,
    sortable: true,
    filter: true,
  };

  // Formateo de valores monetarios
  currencyFormatter(params: any) {
    if (typeof params.value !== 'number') {
      return params.value;
    }
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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
        fileName: `Nominas_${new Date().toISOString().split('T')[0]}.xlsx`,
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
    console.log(event);
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

  deleteEntry() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Por favor, seleccione una entrada para eliminar.',
        'error'
      );
      return;
    }

    const selectedData = selectedNodes[0].data;
    console.log('Datos de la nomina a eliminar:', selectedData);

    const id = selectedData.id;
    selectedData.active = 0;
    alerts
      .confirmAlert(
        'Eliminar nómina',
        '¿Está seguro que desea eliminar esta nómina?',
        'warning',
        'Sí, eliminar'
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.payrollService
            .deletePayroll(id)
            .pipe(
              catchError((error) => {
                alerts.basicAlert(
                  'Eliminar nómina',
                  'Error al eliminar la nómina.',
                  'error'
                );
                console.error(error);
                return EMPTY;
              })
            )
            .subscribe(() => {
              alerts.basicAlert(
                'Nómina eliminada',
                'La nómina se eliminó correctamente',
                'success'
              );
              this.obtenerDatos();
              this.notSavedChanges = false;
              this.selectedRowData = null;
            });
        }
      });
  }

  obtenerBranchs() {
    this.branchesService.getBrancheswoa(this.idRoot).subscribe(
      (data: any) => {
        this.branchs = data;
        console.log('this.branchs ' + this.branchs);
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  formatCurrencyMx(value: number): string {
  if (value == null) return '';
  return value.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

}
