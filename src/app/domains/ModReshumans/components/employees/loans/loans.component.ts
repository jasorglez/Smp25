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
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { TimeService } from 'app/services/time.service';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-employeesxloans',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './loans.component.html',
  styleUrl: './loans.component.scss',
})
export class EmployeesxLoansComponent {
  private employeesxloansService = inject(EmployeesxloansService);
  private signalsService = inject(SignalsService);
  private timeService = inject(TimeService);
  private trackingService = inject(TrackingService);

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
  userRoot: number = 0;
  authorizedPass:boolean = false;
  rowData: any[] = [];
  maestroRowData: any[] = [];
  detalleRowData: any[] = [];
  loanIds: number;
  gridApi: any;
  idEmployee: number;
  idLoan: number = null;
  id: number;
  masterNotSavedChanges: boolean = false;
  detailNotSavedChanges: boolean = false;
  selectedLoanId: any;
  private tempIdCounter: number = 0;
  masterNewlyAddedRows: string[] = [];
  detailedNewlyAddedRows: string[] = [];
  private selectedLoanIdBeforeRefresh: number;

  ngOnInit() {}

  constructor() {
    effect(() => {
      this.idEmployee = this.signalsService.getIdEmployee()();
      this.userRoot = this.signalsService.getUserRoot()();
      this.loadData();
      if(this.userRoot == 1){
        return this.authorizedPass = true;
      }
      return this.authorizedPass = false;
    });
  }

  public maestroGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    getRowClass: (params) => {
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
    getRowClass: (params) => {
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

  loadData(preserveSelection: boolean = false) {
    if (this.idEmployee === null || this.idEmployee === undefined) {
      return;
    }

    this.employeesxloansService
      .getLoansByEmployee(this.idEmployee, 'PRESTAMO')
      .subscribe(
        (maestroRowData: any[]) => {
          if (!maestroRowData || maestroRowData.length === 0) {
            this.maestroRowData = this.detalleRowData = [];
          } else {
            this.maestroRowData = maestroRowData;

            setTimeout(() => {
              if (this.maestroGridApi && this.maestroRowData.length > 0) {
                // Buscar la fila que coincide con el ID guardado
                const rowToSelect =
                  preserveSelection && this.selectedLoanIdBeforeRefresh
                    ? this.maestroRowData.findIndex(
                        (row) => row.id === this.selectedLoanIdBeforeRefresh
                      )
                    : 0;

                this.maestroGridApi
                  .getDisplayedRowAtIndex(rowToSelect)
                  ?.setSelected(true);

                // Restablecer el ID guardado
                this.selectedLoanIdBeforeRefresh = null;
              }
            });
          }
          this.trackingService.addLog(this.trackingService.getnameComp(),'Get Registro en Prestamos', 'Menu Recursos Humanos Prestamos',  this.trackingService.getEmail());
        },
        (error) => {
          console.error('Error loading loans data:', error);
        }
      );
  }

  loadDetailedData() {
    if (this.idLoan === null || this.idLoan === undefined) {
      return;
    }

    this.employeesxloansService.getConceptsxLoansCredit(this.idLoan).subscribe(
      (detalleRowData) => {
        if (!detalleRowData || detalleRowData.length === 0) {
          this.detalleRowData = [];
        } else {
          this.detalleRowData = detalleRowData;
          // Seleccionar la primera fila después de cargar los datos de detalle
          setTimeout(() => {
            if (this.detalleGridApi && this.detalleRowData.length > 0) {
              this.detalleGridApi.getDisplayedRowAtIndex(0)?.setSelected(true);
            }
          });
        }
        this.trackingService.addLog(this.trackingService.getnameComp(),'Get Registro en Detalle de Prestamos', 'Menu Recursos Humanos Prestamos',  this.trackingService.getEmail());
      },
      (error) => {
        console.error('Error loading detailed loan data:', error);
        alerts.basicAlert('Error', 'Error al cargar los datos', 'error');
      }
    );
  }

  maestroColumnDefs: ColDef[] = [
    {
      headerName: 'ID',
      field: 'id',
      flex: 1,
      editable: false,
      valueFormatter: (params) => {
        // Ocultar IDs temporales
        if (params.value && params.value.toString().startsWith('temp_')) {
          return '';
        }
        return params.value;
      },
    },
    {
      headerName: 'Fecha',
      field: 'date',
      valueGetter: (params) =>
        params.data.date ? new Date(params.data.date) : null,
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
      editable: (params) => params.data?.__isNew === true || this.authorizedPass,
    },
    {
      headerName: 'Préstamo *',
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
      editable: (params) => params.data?.__isNew === true || this.authorizedPass,
    },
    {
      headerName: 'Pagado',
      field: 'payments',
      valueFormatter: (params) => {
        if (params.value) {
          return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }).format(params.value);
        }
        return '$0.00';
      },
      flex: 1,
      editable: false,
    },
    {
      headerName: 'Restante',
      field: 'remain',
      valueFormatter: (params) => {
        if (params.value) {
          return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }).format(params.value);
        }
        return '$0.00';
      },
      flex: 1,
      editable: false,
    },
  ];

  detalleColumnDefs: ColDef[] = [
    {
      headerName: 'Fecha',
      field: 'date',
      valueGetter: (params) =>
        params.data.date ? new Date(params.data.date) : null,
      cellEditor: 'agDateCellEditor',
      cellEditorParams: {
        min: new Date(2000, 0, 1),
        max: new Date(2050, 11, 31),
      },
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
      editable: (params) => params.data?.__isNew === true || this.authorizedPass,
    },
    {
      headerName: 'Abono *',
      headerClass: 'required-header',
      field: 'total',
      valueFormatter: (params) => {
        if (params.value) {
          return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }).format(params.value);
        }
        return '$0.00';
      },
      flex: 2,
      editable: (params) => params.data?.__isNew === true || this.authorizedPass,
    },
    {
      headerName: 'Comentario',
      field: 'descripcion',
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
        date: timeData.dateObj,
        type: 'PRESTAMO',
        monto: 0,
        payments: 0,
        __isNew: true,
        active: true,
      };
      // Añadir la nueva fila al principio del array
      this.maestroRowData = [newRow, ...this.maestroRowData];
      this.trackingService.addLog(this.trackingService.getnameComp(),'Add Registro en Prestamos', 'Menu Administracion Prestamos',  this.trackingService.getEmail());
      this.masterNotSavedChanges = true;

      // Seleccionar la nueva fila y entrar en modo edición
      setTimeout(() => {
        if (this.maestroGridApi) {
          // Ahora la fila nueva está en el índice 0
          const rowNode = this.maestroGridApi.getDisplayedRowAtIndex(0);
          rowNode?.setSelected(true);

          // Iniciar la edición de la celda 'monto'
          this.maestroGridApi.startEditingCell({
            rowIndex: 0,
            colKey: 'monto',
          });
        }
      });
    } else if (type === 'Detailed') {
      const newRow = {
        id: tempId,
        idLoanAndCredit: this.idLoan,
        date: timeData.dateObj,
        status: 'Pendiente',
        total: 0,
        comments: '',
        __isNew: true,
        active: true,
      };
      // Añadir la nueva fila al principio del array
      this.detalleRowData = [newRow, ...this.detalleRowData];
      this.trackingService.addLog(this.trackingService.getnameComp(),'Add Registro en Prestamos', 'Menu Administracion Prestamos',  this.trackingService.getEmail());
      this.detailNotSavedChanges = true;

      // Seleccionar la nueva fila
      setTimeout(() => {
        if (this.detalleGridApi) {
          // Ahora la fila nueva está en el índice 0
          const rowNode = this.detalleGridApi.getDisplayedRowAtIndex(0);
          rowNode?.setSelected(true);

          // Iniciar la edición de la celda 'total'
          this.detalleGridApi.startEditingCell({
            rowIndex: 0,
            colKey: 'total',
          });
        }
      });
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

      // Verificar si la fila maestra es nueva
      if (selectedMaestro?.__isNew === true) {
        this.detalleRowData = [];
        return;
      }

      this.idLoan = selectedMaestro.id;
      this.loadDetailedData();
    } else {
      this.detalleRowData = [];
    }
  }

  async saveMasterChanges() {
    const isValid = this.maestroRowData.every((item) => item.monto);
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
      this.trackingService.addLog(this.trackingService.getnameComp(),'Add Registro en Prestamos', 'Menu Administracion Prestamos',  this.trackingService.getEmail());
      return this.employeesxloansService.addLoan(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      this.trackingService.addLog(this.trackingService.getnameComp(),'Update Registro en Prestamos', 'Menu Administracion Prestamos',  this.trackingService.getEmail());
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

      this.signalsService.triggerRefreshEmployees();
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }
  // aqui se termina el saveMasterChanges

  revertMasterData() {
    this.loadData();
    this.masterNotSavedChanges = false;
    this.trackingService.addLog(this.trackingService.getnameComp(),'Revertir Registro en Prestamos', 'Menu Administracion Prestamos',  this.trackingService.getEmail());
  }

  async saveDetailChanges() {
    // Guardar el ID actual antes de actualizar
    this.selectedLoanIdBeforeRefresh = this.idLoan;

    const isValid = this.detalleRowData.every((item) => item.total);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe ingresar un valor de abono.',
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
      this.trackingService.addLog(this.trackingService.getnameComp(),'Add Registro en Detalle de Prestamos', 'Menu Administracion Prestamos',  this.trackingService.getEmail());
      return this.employeesxloansService.addConcept(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      this.trackingService.addLog(this.trackingService.getnameComp(),'Update Registro en Detalle de Prestamos', 'Menu Administracion Prestamos',  this.trackingService.getEmail());
      return this.employeesxloansService.updateConcept(row.id, cleanedData);
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
      this.detailNotSavedChanges = false;
      this.detailedNewlyAddedRows = [];

      // Recargar datos manteniendo la selección
      await this.loadData(true); // Pasar true para indicar que es una recarga post-guardado
      this.signalsService.triggerRefreshEmployees();
    } catch (error) {
      if (error.status === 400) {
        alerts.basicAlert(
          'Añadir entrada',
          error.error.message || 'Error al actualizar los datos.',
          'error'
        );
      } else {
        alerts.basicAlert(
          'Error',
          'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
          'error'
        );
      }
      console.error(error);
    }
  }

  revertDetailData() {
    this.loadDetailedData();
    this.detailNotSavedChanges = false;
    this.trackingService.addLog(this.trackingService.getnameComp(),'Revertir Detalle Registro en Prestamos', 'Menu Administracion Prestamos',  this.trackingService.getEmail());
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

  async deleteMasterEntry() {
    const selectedNodes = this.maestroGridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Por favor, seleccione una entrada para eliminar.',
        'error'
      );
      return;
    }
    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    this.employeesxloansService
      .deleteLoan(id)
      .pipe(
        catchError((error) => {
          // Verificar si el error es un 400 y mostrar un mensaje específico
          if (error.status === 400) {
            alerts.basicAlert(
              'Eliminar entrada',
              error.error.message || 'Error al eliminar la entrada.',
              'error'
            );
          } else {
            alerts.basicAlert(
              'Eliminar entrada',
              'Error al eliminar la entrada.',
              'error'
            );
          }
          console.error(error);
          return EMPTY;
        })
      )
      .subscribe(() => {
        alerts.basicAlert(
          'Eliminar entrada',
          'Entrada eliminada satisfactoriamente.',
          'success'
        );
        this.loadData();

        alerts.basicAlert(
          'Eliminar entrada',
          'Entrada eliminada satisfactoriamente.',
          'success'
        );
        this.masterNotSavedChanges = false;
        this.trackingService.addLog(this.trackingService.getnameComp(),'Delete Registro en Prestamos', 'Menu Administracion Prestamos',  this.trackingService.getEmail());
        this.signalsService.triggerRefreshEmployees();
      });
  }

  async deleteDetalleEntry() {
    const selectedNodes = this.detalleGridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Por favor, seleccione una entrada para eliminar.',
        'error'
      );
      return;
    }
    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    this.employeesxloansService
      .deleteConcept(id)
      .pipe(
        catchError((error) => {
          alerts.basicAlert(
            'Eliminar entrada',
            'Error al eliminar la entrada.',
            'error'
          );
          console.error(error);
          return EMPTY;
        })
      )
      .subscribe(() => {
        alerts.basicAlert(
          'Eliminar entrada',
          'Entrada eliminada satisfactoriamente.',
          'success'
        );
        this.loadData();

        alerts.basicAlert(
          'Eliminar entrada',
          'Entrada eliminada satisfactoriamente.',
          'success'
        );
        this.detailNotSavedChanges = false;
        this.trackingService.addLog(this.trackingService.getnameComp(),'Delete Detalle Registro en Prestamos', 'Menu Administracion Prestamos',  this.trackingService.getEmail());
        this.signalsService.triggerRefreshEmployees();
      });
  }
}
