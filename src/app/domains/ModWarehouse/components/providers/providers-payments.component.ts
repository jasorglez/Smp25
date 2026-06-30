import { Component, effect, HostListener, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
} from 'ag-grid-enterprise';
import { alerts } from '../../../../helpers/alerts';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { SignalsService } from 'app/services/signals.service';
import { CustomersService } from 'app/services/customers.service';
import { AccountbanksComponent } from 'app/domains/ModAdmon/components/accountbanks/accountbanks.component';
import { TimeService } from 'app/services/time.service';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-providers-payments',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule],
  templateUrl: './providers-payments.component.html',
  styleUrl: './providers-payments.component.scss',
})
export class ProvidersPaymentsComponent {
  private trackingService = inject(TrackingService);
  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.masterNotSavedChanges || this.detailNotSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  // Inject of new way for Angular 18
  private customersService = inject(CustomersService);
  private signalsService = inject(SignalsService);
  private timeService = inject(TimeService);
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

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

  ngOnInit() {}

  constructor() {
    effect(() => {
      this.userRoot = this.signalsService.getUserRoot()();
      this.idClient = this.signalsService.getIdClient()();
      this.type = this.signalsService.getProviderOrCustomer()();
      this.loadData();
      if(this.userRoot == 1){
        return this.authorizedPass = true;
      }
      return this.authorizedPass = false;
    });
  }

  authorizedPass:boolean = false;
  maestroRowData: any[] = [];
  detalleRowData: any[] = [];
  gridApi: any;
  idCustomer: number;
  type: string = null;
  userRoot: number = 0;
  id: number;
  masterNotSavedChanges: boolean = false;
  detailNotSavedChanges: boolean = false;
  selectedLoanId: any;
  private tempIdCounter: number = 0;
  masterNewlyAddedRows: string[] = [];
  detailedNewlyAddedRows: string[] = [];
  private selectedCreditIdBeforeRefresh: number;

  // Interceptar signals
  idClient = this.signalsService.getIdClient()();
  nameClient = this.signalsService.getNameClient()();
  idCredit: number;

  // Column Definitions: Defines the columns to be displayed.

  // Column Definitions: Defines the columns to be displayed.
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

  private maestroGridApi: GridApi;
  private detalleGridApi: GridApi;

  maestroColumnDefs: ColDef[] = [
    {
      field: 'numberNote',
      headerName: 'Número de nota',
      editable: (params) => params.data?.__isNew === true,
      filter: true,
      flex: 2,
    },
    {
      field: 'date',
      headerName: 'Fecha',
      filter: 'agDateColumnFilter',
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
      field: 'total',
      headerName: 'Total de la Nota',
      editable: (params) => params.data?.__isNew === true || this.authorizedPass,
      valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: 'MXN',
        }).format(params.value || 0);
      },
      flex: 1,
    },
    {
      field: 'account',
      headerName: 'Abono Cuenta',
      editable: false,
      flex: 1,
      valueFormatter: (params) => {
        if (params.value) {
          return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }).format(params.value);
        }
        return '$0.00';
      },
    },
    {
      field: 'remain',
      headerName: 'Restante',
      editable: false,
      valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: 'MXN',
        }).format(params.value || 0);
      },
      flex: 1,
    },
  ];

  detalleColumnDefs: ColDef[] = [
    {
      headerName: 'Fecha',
      field: 'datePayment',
      valueGetter: (params) =>
        params.data.datePayment ? new Date(params.data.datePayment) : null ,
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
      width: 100,
      editable: (params) => params.data?.__isNew === true || this.authorizedPass,
    },
    {
      headerName: 'Abono *',
      headerClass: 'required-header',
      field: 'amount',
      valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: 'MXN',
        }).format(params.value || 0);
      },
      width: 100,
      editable: (params) => params.data?.__isNew === true || this.authorizedPass,
    },
    {
      field: 'comments',
      headerName: 'Comentario',
      editable: (params) => params.data?.__isNew === true || this.authorizedPass,
      hide: this.signalsService.getProviderOrCustomer()() == 'CUSTOMERS',
      width: 200,
    },
  ];

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

  loadData(preserveSelection: boolean = false) {
    if (this.idClient === null || this.idClient === undefined) {
      return;
    }

    this.customersService.getClientCredits(this.idClient).subscribe(
      (maestroRowData: any[]) => {
        if (!maestroRowData || maestroRowData.length === 0) {
          this.maestroRowData = this.detalleRowData = [];
        } else {
          this.maestroRowData = maestroRowData;
          console.log(this.maestroRowData)

          setTimeout(() => {
            if (this.maestroGridApi && this.maestroRowData.length > 0) {
              // Buscar la fila que coincide con el ID guardado
              const rowToSelect =
                preserveSelection && this.selectedCreditIdBeforeRefresh
                  ? this.maestroRowData.findIndex(
                      (row) => row.id === this.selectedCreditIdBeforeRefresh
                    )
                  : 0;

              this.maestroGridApi
                .getDisplayedRowAtIndex(rowToSelect)
                ?.setSelected(true);

              // Restablecer el ID guardado
              this.selectedCreditIdBeforeRefresh = null;
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
    if (this.idCredit === null || this.idCredit === undefined) {
      return;
    }
    this.customersService.getDetailsCredits(this.idCredit).subscribe(
      (detalleRowData: any[]) => {
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

  async addRow(type: string) {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Agregó nuevo providers payments', 'Almacenes', this.trackingService.getEmail());
    const tempId = `temp_${this.tempIdCounter++}`;
    const timeData = await this.getTime();

    if (type === 'Master') {
      const newRow = {
        id: tempId,
        idCustomer: this.idClient,
        numberNote: '',
        date: timeData.dateObj,
        account: 0,
        type: this.type,
        remain: 0,
        total: 0,
        active: true,
        __isNew: true,
      };
      this.maestroRowData = [newRow, ...this.maestroRowData];
      this.masterNotSavedChanges = true;

      setTimeout(() => {
        if (this.maestroGridApi) {
          const rowNode = this.maestroGridApi.getDisplayedRowAtIndex(0);
          rowNode?.setSelected(true);

          this.maestroGridApi.startEditingCell({
            rowIndex: 0,
            colKey: 'account',
          });
        }
      });
    } else if (type === 'Detailed') {
      const newRow = {
        id: tempId,
        idCredit: this.idCredit,
        datePayment: timeData.dateObj,
        amount: 0,
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
            colKey: 'amount',
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

      this.idCredit = selectedMaestro.id;
      this.loadDetailedData();
    } else {
      this.detalleRowData = [];
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
      return this.customersService.addClientCredit(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.customersService.updateClientCredit(row.id, cleanedData);
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
    this.selectedCreditIdBeforeRefresh = this.idCredit;

    const isValid = this.detalleRowData.every((item) => item.amount);
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
      return this.customersService.addDetailCredit(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.customersService.updateDetailCredit(row.id, cleanedData);
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
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
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

    this.customersService
      .deleteClientCredit(id)
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
        alerts.basicAlert('Eliminar entrada', 'Entrada eliminada satisfactoriamente.', 'success');
        this.loadData();
        this.masterNotSavedChanges = false;
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

    this.customersService
      .deleteDetailCredit(id)
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
