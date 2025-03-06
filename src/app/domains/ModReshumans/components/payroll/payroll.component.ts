import { RouterModule } from '@angular/router';
import { Component, HostListener, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
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

@Component({
  selector: 'app-payroll',
  standalone: true,
  imports: [
    RouterModule,
    DomainsModule,
    AgGridModule,
    FormsModule],
  templateUrl: './payroll.component.html',
  styleUrl: './payroll.component.scss'
})

export class PayrollComponent implements OnInit {

  ngOnInit() {
    //Called after the constructor, initializing input properties, and the first call to ngOnChanges.
    //Add 'implements OnInit' to the class.
    this.obtenerDatos();
  }

  obtenerDatos() {
    this.administrationService.getNormalPayrolls().subscribe((data: any) => {
      this.rowData = data;
      console.log("--------------- esto llega en data: ", data);
    });
  }


  //private administrationService = inject(AdministrationService);

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  notSavedChanges: boolean = false;
  private tempIdCounter: number = 0;
  newlyAddedRows: string[] = [];
  id: string;
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  private modalServiceTable = inject(ModalService);
  selectedRowData: any = null;
  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';

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
};

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idBranch  : 1,
      name      : '',
      branch    : '',
      numBranch : '',
      contact   : '',
      phone     : '',
      picture   : '',
      code      : '',
      active: true,
      __isNew: true,
    };
    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) => item.name && item.branch);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar todos los campos antes de guardar.',
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
      return this.administrationService.addBanks(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.administrationService.updateBanks(row.id, cleanedData);
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

  get colMaster(): ColDef[] {
    return [
      { headerName: 'Fecha Inicio',
        field: 'startDate',
        filter: 'agDateColumnFilter',
        floatingFilter: true,
        floatingFilterComponentParams: {
          suppressFilterButton: true,
        },
        valueGetter: (params) =>
          params.data.startDate ? new Date(params.data.startDate) : null,
        cellRenderer: 'agDateCellRenderer',
        cellEditor: 'agDateCellEditor',
        valueFormatter: (params) => {
          if (params.value) {
            const date = new Date(params.value);
            return `${('0' + date.getDate()).slice(-2)}-${(
              '0' +
              (date.getMonth() + 1)
            ).slice(-2)}-${date.getFullYear()}`;
          }
          return '';
        },
        width: 170
      },
      { headerName: 'Fecha Fin',
        field: 'endDate',
        filter: 'agDateColumnFilter',
        floatingFilter: true,
        floatingFilterComponentParams: {
          suppressFilterButton: true,
        },
        valueGetter: (params) => params.data.endDate ? new Date(params.data.endDate) : null,
        cellRenderer: 'agDateCellRenderer',
        cellEditor: 'agDateCellEditor',
        valueFormatter: (params) => {
          if (params.value) {
            const date = new Date(params.value);
            return `${('0' + date.getDate()).slice(-2)}-${(
              '0' +
              (date.getMonth() + 1)
            ).slice(-2)}-${date.getFullYear()}`;
          }
          return '';
        },
        width: 170
       },

      { field: 'totalBaseWorkingDays', headerName: 'Total Jornadas Base', editable: true, width: 170 },

      { field: 'totalBaseExtraDays', headerName: 'Total Jornadas Extra', editable: true, width: 170, cellEditorParams: {
          maxLength: 15  }
      },

      { field: 'totalSubtotal', headerName: 'Total Subtotal', editable: true, width: 140 },

      { field: 'totalDescuentos', headerName: 'Total Descuentos', editable: true, width: 160 },
      { field: 'total', headerName: 'Total', editable: true, width: 100 },

    ]
  };

  // Definición de columnas para AG Grid
  columnDefs: ColDef[] = [
    { field: 'nombre', headerName: 'Nombre', sortable: true, filter: true, resizable: true },
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

  constructor(private payrollService: PayrollService, private administrationService: AdministrationService) {}

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

  // Carga los datos desde el API
  loadData(): void {
    this.isLoading = true;

    this.payrollService.getPayrolls().subscribe({
      next: (data) => {
        // Procesar los datos para obtener todos los empleados de todas las nóminas
        let allEmployees: EmployeePayroll[] = [];

        data.forEach(payroll => {
          if (payroll.empleados && Array.isArray(payroll.empleados)) {
            // Añadir información de la nómina a cada empleado
            const employeesWithPayrollInfo = payroll.empleados.map(emp => ({
              ...emp,
              empresa: payroll.empresa,
              periodo: payroll.periodo,
              ejercicio: payroll.ejercicio
            }));

            allEmployees = [...allEmployees, ...employeesWithPayrollInfo];
          }
        });

        this.rowData = allEmployees;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al obtener datos de nóminas:', error);
        this.isLoading = false;
        // Aquí podrías mostrar un mensaje de error
      }
    });
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
    this.loadData();
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
}

