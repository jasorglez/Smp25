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
import { AdministrationService } from 'app/services/administration.service';

@Component({
  selector: 'app-employeesxsavings',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './savings.component.html',
  styleUrl: './savings.component.scss',
})
export class EmployeesxSavingsComponent {
  private administrationService = inject(AdministrationService);
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

  maestroRowData: any[] = [];
  detalleRowData: any[] = [];
  loanIds: number;
  gridApi: any;
  idEmployee: number;
  idLoan: number = null;
  nameLoan: string = null;
  id: number;
  userRoot: number = 0;
  authorizedPass:boolean = false;
  masterNotSavedChanges: boolean = false;
  detailNotSavedChanges: boolean = false;
  selectedLoanId: any;
  private tempIdCounter: number = 0;
  masterNewlyAddedRows: string[] = [];
  detailedNewlyAddedRows: string[] = [];
  private selectedLoanIdBeforeRefresh: number;
  modal:boolean = false;

  ngOnInit() {}

  constructor() {
    effect(() => {
      this.idEmployee = this.signalsService.getIdEmployee()();
      this.userRoot = this.signalsService.getUserRoot()();
      this.loadData();
      if (this.signalsService.getInitSaving()() == true) {
        this.modal = true; // Abrir modal si la señal está activa
        this.addRow('Master'); // Actualizar datos cuando se recibe señal
        this.signalsService.resetInitSaving(); // Resetear la señal después de actualizar
      }
      if(this.userRoot == 1){
        return this.authorizedPass = true;
      }
      return this.authorizedPass = false;
      
    }, { allowSignalWrites: true });
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

  loadData(preserveSelection: boolean = false) {
    if (this.idEmployee === null || this.idEmployee === undefined) {
      return;
    }

    this.employeesxloansService
      .getLoansByEmployee(this.idEmployee, 'AHORRO')
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
          setTimeout(() => {
            if (this.detalleGridApi && this.detalleRowData.length > 0) {
              this.detalleGridApi.getDisplayedRowAtIndex(0)?.setSelected(true);
            }
          });
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
      headerName: 'Ahorro *',
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
      headerName: 'Retirado',
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
        date: this.modal? this.signalsService.getFechaNomina().fechaFin : timeData.dateObj,
        type: 'AHORRO',
        monto: 0,
        payments: 0,
        __isNew: true,
        active: true,
      };
      this.maestroRowData = [newRow, ...this.maestroRowData];
      this.masterNotSavedChanges = true;

      setTimeout(() => {
        if (this.maestroGridApi) {
          const rowNode = this.maestroGridApi.getDisplayedRowAtIndex(0);
          rowNode?.setSelected(true);

          this.maestroGridApi.startEditingCell({
            rowIndex: 0,
            colKey: 'monto',
          });
        }
      }, 500);
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
      this.detalleRowData = [newRow, ...this.detalleRowData];
      this.detailNotSavedChanges = true;

      setTimeout(() => {
        if (this.detalleGridApi) {
          const rowNode = this.detalleGridApi.getDisplayedRowAtIndex(0);
          rowNode?.setSelected(true);

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

      if(this.modal){
        const idEmployeePayroll = this.signalsService.getIdEmployeePayroll()();
        this.administrationService.updateSavingNormalPayroll(
          idEmployeePayroll,
          responses[0].monto
        ).subscribe(
          (res) => {
            console.log('Ahorro actualizado correctamente:', res);
            alerts.basicAlert(
              'Ahorro actualizado',
              'El ahorro se ha actualizado correctamente.',
              'success'
            );
          },
          (error) => {
            console.error('Error al actualizar el ahorro:', error);
            alerts.basicAlert(
              'Error',
              error?.error?.message || 'No se pudo actualizar el ahorro.',
              'error'
            );
          }
        );
      }

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.detailNotSavedChanges = false;
      this.detailedNewlyAddedRows = [];
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

  revertMasterData() {
    this.loadData();
    this.masterNotSavedChanges = false;
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
      return this.employeesxloansService.addConcept(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
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
        this.signalsService.triggerRefreshEmployees();
      });
  }
}
