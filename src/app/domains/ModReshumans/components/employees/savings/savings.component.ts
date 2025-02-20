import { CommonModule } from '@angular/common';
import { Component, effect, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
} from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { EmployeesxloansService } from 'app/services/employeesxloans.service';
import { SignalsService } from 'app/services/signals.service';
import { TimeService } from 'app/services/time.service';
import { concat, lastValueFrom, toArray } from 'rxjs';

@Component({
  selector: 'app-employeesxsavings',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './savings.component.html',
  styleUrl: './savings.component.scss',
})
export class EmployeesxSavingsComponent {
  private employeesxloansService = inject(EmployeesxloansService);
  private signalsService = inject(SignalsService);
  private timeService = inject(TimeService);

  defaultColDef = {
    flex: 1,
    resizable: true,
    sortable: true,
    filter: true,
    editable: (params) => {
      // Permitir edición solo si la fila es nueva
      return params.data?.__isNew === true;
    },
  };

  rowData: any[] = [];
  maestroRowData: any[] = [];
  detalleRowData: any[] = [];
  loanIds: number;
  gridApi: any;
  idEmployee: number;
  idLoan: number = null;
  nameLoan: string = null;
  id: number;
  masterNotSavedChanges: boolean = false;
  detailNotSavedChanges: boolean = false;
  selectedLoanId: any;
  private tempIdCounter: number = 0;
  masterNewlyAddedRows: string[] = [];
  detailedNewlyAddedRows: string[] = [];

  ngOnInit() {}

  constructor() {
    effect(() => {
      this.idEmployee = this.signalsService.getIdEmployee()();
      this.loadData();
      this.loadDetailedData();
    });
  }

  public maestroGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowClass: (params) => {
      // Verificar si la fila está seleccionada
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onMaestroRowClicked: (event) => {
      // Seleccionar la fila al hacer clic en cualquier celda
      event.node.setSelected(true);
    },
    onMaestroRowSelected: (event) => {
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

  public detalleGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowClass: (params) => {
      // Verificar si la fila está seleccionada
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onDetalleRowClicked: (event) => {
      // Seleccionar la fila al hacer clic en cualquier celda
      event.node.setSelected(true);
    },
    onDetalleRowSelected: (event) => {
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

  loadData() {
    if (this.idEmployee === null || this.idEmployee === undefined) {
      return;
    }
    console.log('Loading data for employee ID:', this.idEmployee);

    this.employeesxloansService
      .getLoansByEmployee(this.idEmployee, 'AHORRO')
      .subscribe(
        (maestroRowData: any[]) => {
          if (!maestroRowData || maestroRowData.length === 0) {
            this.maestroRowData = this.detalleRowData = [];
          } else {
            this.maestroRowData = maestroRowData;
          }
        },
        (error) => {
          console.error('Error loading loans data:', error);
        }
      );
  }

  loadDetailedData() {
    if (this.idEmployee === null || this.idEmployee === undefined) {
      return;
    }
    console.log('Loading DETAILED data for employee ID:', this.idEmployee);

    this.employeesxloansService
      .getLoansByEmployee(this.idEmployee, 'RETIRO')
      .subscribe(
        (detalleRowData) => {
          if (!detalleRowData || detalleRowData.length === 0) {
            console.log('No detailed data found');
            this.detalleRowData = [];
          } else {
            console.log('Detailed loans data:', detalleRowData);
            this.detalleRowData = detalleRowData;
          }
        },
        (error) => {
          console.error('Error loading detailed loan data:', error);
          alerts.basicAlert('Error', 'Error al cargar los datos', 'error');
        }
      );
  }

  maestroColumnDefs: ColDef[] = [
    {
      headerName: 'Ahorro *',
      headerClass: 'required-header',
      field: 'name',
      flex: 2,
      editable: (params) => params.data?.__isNew === true,
    },
    {
      headerName: 'Fecha',
      field: 'date',
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
      flex: 1,
      editable: (params) => params.data?.__isNew === true,
    },
    {
      headerName: 'Total *',
      headerClass: 'required-header',
      field: 'monto',
      valueFormatter: (params) => {
        if (params.value) {
          return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }).format(params.value);
        }
        return '';
      },
      flex: 1,
      editable: (params) => params.data?.__isNew === true,
    },
  ];

  detalleColumnDefs: ColDef[] = [
    {
      headerName: 'Retiro *',
      headerClass: 'required-header',
      field: 'name',
      flex: 2,
      editable: (params) => params.data?.__isNew === true,
    },
    {
      headerName: 'Fecha',
      field: 'date',
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
      flex: 1,
      editable: (params) => params.data?.__isNew === true,
    },
    {
      headerName: 'Total *',
      headerClass: 'required-header',
      field: 'monto',
      valueFormatter: (params) => {
        if (params.value) {
          return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }).format(params.value);
        }
        return '';
      },
      flex: 1,
      editable: (params) => params.data?.__isNew === true,
    },
  ];

  private maestroGridApi: GridApi;
  private detalleGridApi: GridApi;

  private async getTime(): Promise<{ dateObj: Date; formatted: string }> {
    const time = await lastValueFrom(this.timeService.getTime());
    const date = new Date(time.localTime);
    return {
      dateObj: date,
      formatted: `${('0' + date.getDate()).slice(-2)}-${(
        '0' +
        (date.getMonth() + 1)
      ).slice(-2)}-${date.getFullYear()}`,
    };
  }

  async addRow(type: string) {
    const tempId = `temp_${this.tempIdCounter++}`;
    const timeData = await this.getTime();

    if (type === 'Master') {
      const newRow = {
        id: tempId,
        idEmpleado: this.idEmployee,
        name: `AHORRO ${timeData.formatted}`,
        date: timeData.dateObj,
        type: 'AHORRO',
        monto: 0,
        payments: 0,
        __isNew: true,
        active: true,
      };
      this.maestroRowData = [...this.maestroRowData, newRow];
      this.masterNotSavedChanges = true;
    } else if (type === 'Detailed') {
      const newRow = {
        id: tempId,
        idEmpleado: this.idEmployee,
        name: `RETIRO ${timeData.formatted}`,
        date: timeData.dateObj,
        type: 'RETIRO',
        monto: 0,
        payments: 0,
        __isNew: true,
        active: true,
      };
      this.detalleRowData = [...this.detalleRowData, newRow];
      this.detailNotSavedChanges = true;
    }
  }

  onMaestroGridReady(params: GridReadyEvent) {
    this.maestroGridApi = params.api;
  }

  onDetalleGridReady(params: GridReadyEvent) {
    this.detalleGridApi = params.api;
  }

  onMaestroSelectionChanged(event: SelectionChangedEvent) {
    const selectedRows = this.maestroGridApi.getSelectedRows();
    if (selectedRows.length > 0) {
      const selectedMaestro = selectedRows[0];
      this.idLoan = selectedMaestro.id;
    }
  }

  async saveMasterChanges() {
    const isValid = this.maestroRowData.every((item) => item.total);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe ingresar un valor de préstamo.',
        'error'
      );
      return;
    }

    const newRows = this.maestroRowData.filter((row) => row.__isNew);
    const modifiedRows = this.maestroRowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.employeesxloansService.addLoan(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.employeesxloansService.updateLoan(row.id, cleanedData);
    });

    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.masterNotSavedChanges = false;
      this.masterNewlyAddedRows = [];
      await this.loadData(); // Refrescar los datos
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  revertMasterData() {
    this.loadData();
    this.masterNotSavedChanges = false;
  }

  async saveDetailChanges() {
    const isValid = this.detalleRowData.every((item) => item.monto);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe ingresar un valor de retiro.',
        'error'
      );
      return;
    }

    const newRows = this.detalleRowData.filter((row) => row.__isNew);
    const modifiedRows = this.detalleRowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.employeesxloansService.addLoan(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.employeesxloansService.updateLoan(row.id, cleanedData);
    });

    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.masterNotSavedChanges = false;
      this.masterNewlyAddedRows = [];
      await this.loadData();
    } catch (error) {
      if (error.status === 400 && error.error?.error === 'Insufficient savings for RETIRO.') {
        alerts.basicAlert(
          'Fondos insuficientes',
          'El empleado no tiene suficientes ahorros para realizar este retiro',
          'error'
        );
      } else {
        console.error(error);
        alerts.basicAlert(
          'Error',
          'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
          'error'
        );
      }
    }
  }

  revertDetailData() {
    this.loadDetailedData();
    this.detailNotSavedChanges = false;
  }

  onMasterCellValueChanged(event: any): void {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.masterNotSavedChanges = true;
  }

  onDetailCellValueChanged($event) {
    console.log('Dato cambiado:', $event.data);
    $event.data.__modified = true;
    this.detailNotSavedChanges = true;
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
