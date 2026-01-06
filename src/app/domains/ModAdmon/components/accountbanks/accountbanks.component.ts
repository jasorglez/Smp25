import { Component, HostListener, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';

import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { alerts } from '../../../../helpers/alerts';
import { AdministrationService } from 'app/services/administration.service';

import { catchError, concat, EMPTY, lastValueFrom, of, toArray } from 'rxjs';
import { AgGridModule } from 'ag-grid-angular';
import { ModalService } from 'app/services/modal.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { AuthService } from 'app/services/auth.service';

interface Bank {
  id: number;
  name: string;
}

@Component({
  selector: 'app-accountbanks',
  standalone: true,
  imports: [
    RouterModule,
    DomainsModule,
    AgGridModule,
    MultiLineEditorComponent,
  ],
  templateUrl: './accountbanks.component.html',
  styleUrl: './accountbanks.component.scss',
})
export class AccountbanksComponent implements CanComponentDeactivate {
  authService = inject(AuthService);
  ngOnInit() {
    this.obtenerDatos();
    this.obtenerBanks();
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  private lastSelectedId: string | null = null;
  notSavedChanges: boolean = false;
  rowMaster: any;
  rowDetails: any;
  accounts: { [key: string]: string } = {};
  errorMessage: string = '';
  isLoading: boolean = false;

  newlyAddedRows: string[] = [];
  selectedRowData: any = null;

  banks: any;
  id: string;
  private tempIdCounter: number = 0;

  private gridApi!: GridApi;

  currentIndex = 0;

  private detailsGridApi!: GridApi<any>;

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  frameworkComponents = {
    multiLineEditor: MultiLineEditorComponent,
  };

  // Inject of new way for Angular 18
  private administrationService = inject(AdministrationService);
  private modalServiceTable = inject(ModalService);
  private imageHandlerService = inject(ImageHandlerService);

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

  private _colMaster: ColDef[] = [];
  private _colDetails: ColDef[] = [];

  // Column Definitions: Defines the columns to be displayed.
  get colMaster(): ColDef[] {
    if (this._colMaster.length > 0) {
      return this._colMaster;
    }

    this._colMaster = [
      {
        field: 'idBanco',
        headerName: 'Banco',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.banks ? this.banks.map((item) => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.banks
            ? this.banks.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.name}` : params.value;
        },
      },
      {
        field: 'numberAccount',
        headerName: 'Numero Cuenta',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        filter: true,
        width: 200,
      },

      {
        field: 'nameAccount',
        headerName: 'Nombre Cuenta',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        width: 360,
        filter: true,
      },

      {
        field: 'interbancaria',
        headerName: 'Interbancaria',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        width: 160,
      },

      {
        field: 'folioCheque',
        headerName: 'Inicio Cheque',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        width: 129,
        cellEditorParams: {
          maxLength: 5,
        },
      },

      {
        field: 'folioSinCheque',
        headerName: 'Termino Cheque',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        width: 140,
      },

      {
        field: 'gasto',
        headerName: 'Gastos',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        width: 105,
        valueFormatter: (params) =>
          params.value?.toLocaleString('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }),
      },
      {
        field: 'depositoPagado',
        headerName: 'Ingresos',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        width: 105,
        valueFormatter: (params) =>
          params.value?.toLocaleString('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }),
      },
      {
        field: 'saldo',
        headerName: 'Saldo',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        width: 110,
        valueFormatter: (params) =>
          params.value?.toLocaleString('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }),
      },
      {
        field: 'maskin',
        headerName: 'Mask In',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        width: 120,
        filter: true,
      },
      {
        field: 'consecin',
        headerName: 'Consec In',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        width: 110,
        filter: true,
      },
      {
        field: 'maskex',
        headerName: 'Mask Ex',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        width: 120,
        filter: true,
      },
      {
        field: 'consecex',
        headerName: 'Consec Ex',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        width: 110,
        filter: true,
      },
    ];

    return this._colMaster;
  }

  // Column Definitions: Defines the columns to be displayed.
  get colDetails(): ColDef[] {
    if (this._colDetails.length > 0) {
      return this._colDetails;
    }

    this._colDetails = [
      {
        field: 'numeroDocumento',
        headerName: 'Numero Documento',
        editable: false,
        filter: true,
        width: 200,
        cellStyle: (params) => {
          const deposito =
            typeof params.data.deposito === 'string'
              ? parseFloat(params.data.deposito.replace(/,/g, ''))
              : params.data.deposito || 0;
          const gasto =
            typeof params.data.gasto === 'string'
              ? parseFloat(params.data.gasto.replace(/,/g, ''))
              : params.data.gasto || 0;
          return {
            backgroundColor:
              deposito > 0 ? '#e6ffe6' : gasto > 0 ? '#ffe6e6' : null,
          };
        },
      },
      {
        field: 'fecha',
        headerName: 'Fecha',
        editable: false,
        width: 200,
        filter: true,
      },
      {
        field: 'descripcion',
        headerName: 'Descripcion',
        editable: false,
        width: 285,
      },
      {
        field: 'tipo',
        headerName: 'Tipo',
        editable: false,
        width: 160,
      },
      {
        field: 'deposito',
        headerName: 'Deposito',
        editable: false,
        width: 160,
        valueFormatter: (params) => {
          const value = params.value || 0;
          return `$ ${value.toLocaleString('es-MX', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;
        },
        cellStyle: (params) => {
          const value =
            typeof params.value === 'string'
              ? parseFloat(params.value.replace(/,/g, ''))
              : params.value || 0;
          return {
            color: value > 0 ? '#008000' : null,
            backgroundColor: value > 0 ? '#e6ffe6' : null,
            fontWeight: value > 0 ? 'bold' : 'normal',
          };
        },
      },
      {
        field: 'gasto',
        headerName: 'Gasto',
        editable: false,
        width: 160,
        valueFormatter: (params) => {
          const value = params.value || 0;
          return `$ ${value.toLocaleString('es-MX', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;
        },
        cellStyle: (params) => {
          const value =
            typeof params.value === 'string'
              ? parseFloat(params.value.replace(/,/g, ''))
              : params.value || 0;
          return {
            color: value > 0 ? '#FF0000' : null,
            backgroundColor: value > 0 ? '#ffe6e6' : null,
            fontWeight: value > 0 ? 'bold' : 'normal',
          };
        },
      },
      {
        field: 'saldo',
        headerName: 'SALDO',
        editable: false,
        width: 160,
        valueFormatter: (params) => {
          const value = params.value || 0;
          return `$ ${value.toLocaleString('es-MX', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;
        },
        cellStyle: {
          color: '#000080',
          fontWeight: 'bold',
        },
      },
    ];

    return this._colDetails;
  }

  obtenerBanks() {
    this.administrationService.get2fieldsBanks().subscribe({
      next: (data: any) => {
        this.banks = data;
      },
      error: (error) => {
        console.error('Error al cargar bancos:', error);
        this.banks = [];
        alerts.basicAlert('Error', 'Error al cargar el catálogo de bancos', 'error');
      }
    });
  }

  obtenerDatos() {
    this.isLoading = true;
    this.rowMaster = [];

    const companyId = parseInt(localStorage.getItem('company') || '0');
    if (!companyId) {
      console.error('No hay empresa seleccionada en localStorage');
      this.isLoading = false;
      return;
    }

    this.administrationService
      .getAccountBanks(companyId)
      .subscribe({
        next: (response: any) => {
          if (response && response.length > 0) {
            this.rowMaster = response;
          } else {
            this.rowMaster = [];
          }
        },
        error: (error) => {
          // 404 significa "no hay datos", no es un error real
          if (error.status === 404) {
            this.rowMaster = [];
            console.log('No hay cuentas bancarias para esta empresa');
          } else {
            // Otros errores sí son problemas reales
            console.error('Error al cargar cuentas bancarias:', error);
            this.rowMaster = [];
            alerts.basicAlert('Error', 'Error al cargar las cuentas bancarias', 'error');
          }
          this.isLoading = false;
        },
        complete: () => {
          this.isLoading = false;
        }
      });
  }

  private loadBalanceData(id: string) {
    if (!id || id === this.lastSelectedId) return;

    this.lastSelectedId = id;
    this.rowDetails = [];
    this.isLoading = true;

    this.administrationService.getBalance(parseInt(id)).subscribe({
      next: (response: any) => {
        if (response.success && response.hasData) {
          this.rowDetails = response.data;
        } else {
          this.rowDetails = [];
          alerts.basicAlert('Aviso', 'No hay datos disponibles', 'info');
        }
      },
      error: () => {
        this.rowDetails = [];
        alerts.basicAlert('Error', 'Error al cargar los datos', 'error');
      },
      complete: () => {
        this.isLoading = false;
      },
    });
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      const selectedData = selectedNodes[0].data;
      this.selectedRowData = selectedData;

      // Solo cargar balance si el ID no es temporal (nueva fila)
      if (selectedData.id && !selectedData.id.toString().startsWith('temp_')) {
        this.loadBalanceData(selectedData.id);
      } else {
        // Limpiar detalles para filas nuevas
        this.rowDetails = [];
      }
    } else {
      this.selectedRowData = null;
      this.rowDetails = [];
    }
  }

  onCellValueChanged(event: any) {
    //  console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onMasterGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onDetailGridReady(params: GridReadyEvent) {
    this.detailsGridApi = params.api;
  }

  addRow() {
    const companyId = parseInt(localStorage.getItem('company') || '0');
    if (!companyId || companyId === 0) {
      alerts.basicAlert('Error', 'No se ha seleccionado una empresa válida', 'error');
      return;
    }

    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idBussines: companyId,
      numberAccount: '',
      nameAccount: '',
      signAccount: 'sin firma',
      interbancaria: '',
      folioCheque: '',
      folioSinCheque: '',
      idBanco: null,
      gasto: 0,
      depositoPagado: 0,
      saldo: 0,
      maskin: '',
      consecin: 0,
      maskex: '',
      consecex: 0,
      eAplicaFiscal: 'Si',
      active: true,
      __isNew: true,
    };
    this.rowMaster = [newItem, ...this.rowMaster];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;

    // Seleccionar la nueva fila después de agregarla
    setTimeout(() => {
      this.gridApi.forEachNode((node) => {
        if (node.data.id === tempId) {
          node.setSelected(true);
          this.gridApi.ensureNodeVisible(node, 'top');
        }
      });
    }, 100);
  }

  async saveChanges() {
    //console.log('RowData', this.rowData)

    const isValid = this.rowMaster.every(
      (item) => item.numberAccount && item.nameAccount
    );
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar todos los campos antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.rowMaster.filter((row) => row.__isNew);
    const modifiedRows = this.rowMaster.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log('📤 Datos a enviar al POST:', cleanedData);
      return this.administrationService.addAccountBanks(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.administrationService.updateAccountBanks(row.id, cleanedData);
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
      console.error('❌ Error completo:', error);
      if (error?.error) {
        console.error('📋 Detalle del error del servidor:', error.error);
      }
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  async deleteEntry() {
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
    const id = selectedData.id;

    // Verificar si es una fila temporal (no guardada)
    if (id.toString().startsWith('temp_')) {
      // Eliminar del array local sin llamar al API
      this.rowMaster = this.rowMaster.filter(row => row.id !== id);
      this.newlyAddedRows = this.newlyAddedRows.filter(tempId => tempId !== id);
      this.notSavedChanges = this.rowMaster.some(row => row.__isNew || row.__modified);
      this.selectedRowData = null;
      this.gridApi.setGridOption('rowData', this.rowMaster);
      alerts.basicAlert(
        'Eliminar entrada',
        'Entrada eliminada satisfactoriamente.',
        'success'
      );
      return;
    }

    // Verificar si la cuenta tiene movimientos (gastos e ingresos)
    const gasto = selectedData.gasto || 0;
    const deposito = selectedData.depositoPagado || 0;

    if (gasto > 0 || deposito > 0) {
      alerts.basicAlert(
        'No se puede eliminar',
        'Tienes Gastos e Ingresos en la cuenta. No es posible eliminarla.',
        'error'
      );
      return;
    }

    // Confirmar eliminación antes de proceder
    const result = await alerts.confirmAlert(
      'Eliminar cuenta bancaria',
      `¿Está seguro que desea eliminar la cuenta "${selectedData.nameAccount}"?`,
      'warning',
      'Sí, eliminar'
    );

    if (!result.isConfirmed) {
      return;
    }

    this.administrationService
      .deleteAccountBanks(id)
      .pipe(
        catchError((error) => {
          console.error('❌ Error al eliminar:', error);
          alerts.basicAlert(
            'Eliminar entrada',
            'Error al eliminar la entrada.',
            'error'
          );
          return EMPTY;
        })
      )
      .subscribe(() => {
        alerts.basicAlert(
          'Eliminar entrada',
          'Entrada eliminada satisfactoriamente.',
          'success'
        );
        this.notSavedChanges = false;
        this.selectedRowData = null;
        this.obtenerDatos();
      });
  }

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
  }

  private cleanDataForServer(data: any): any {
    const companyId = parseInt(localStorage.getItem('company') || '0');

    // Solo enviar los campos que el API espera
    const cleanedData: any = {
      idBussines: data.idBussines || companyId,
      numberAccount: data.numberAccount || '',
      nameAccount: data.nameAccount || '',
      signAccount: data.signAccount || 'sin firma',
      interbancaria: data.interbancaria || '',
      folioCheque: data.folioCheque || '',
      folioSinCheque: data.folioSinCheque || '',
      idBanco: data.idBanco || null,
      maskin: data.maskin || '',
      consecin: data.consecin || 0,
      maskex: data.maskex || '',
      consecex: data.consecex || 0,
      eAplicaFiscal: data.eAplicaFiscal || 'Si'
    };

    // Solo incluir ID si no es temporal (para updates)
    if (data.id && !data.id.toString().startsWith('temp_')) {
      cleanedData.id = data.id;
    }

    console.log('🔍 CompanyId:', companyId, '| idBussines final:', cleanedData.idBussines);

    return cleanedData;
  }

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  async canDeactivate(): Promise<boolean> {
    if (!this.notSavedChanges) {
      return Promise.resolve(true);
    }

    const result = await alerts.confirmAlert(
      'Cambios sin guardar',
      'Tienes cambios sin guardar. ¿Deseas salir sin guardar?',
      'warning',
      'Sí, salir'
    );
    return result.isConfirmed;
  }
}
