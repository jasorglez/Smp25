import { Component, HostListener, inject, OnDestroy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { SignalrService } from 'app/services/signalr.service';
import { Subscription } from 'rxjs';

import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { alerts } from '../../../../helpers/alerts';
import { AdministrationService } from 'app/services/administration.service';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';

import { catchError, concat, EMPTY, lastValueFrom, of, toArray } from 'rxjs';
import { AgGridModule } from 'ag-grid-angular';
import { ModalService } from 'app/services/modal.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { AuthService } from 'app/services/auth.service';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { TrackingService } from 'app/services/tracking.service';
import { FormsModule } from '@angular/forms';

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
    FormsModule,
  ],
  templateUrl: './accountbanks.component.html',
  styleUrl: './accountbanks.component.scss',
})
export class AccountbanksComponent implements CanComponentDeactivate, OnDestroy {
  authService = inject(AuthService);
  private signalRService = inject(SignalrService);
  private admonSub!: Subscription;

  ngOnInit() {
    this.obtenerDatos();
    this.obtenerBanks();
    this.admonSub = this.signalRService.admonUpdate$.subscribe(data => {
      if (data) this.refreshAll();
    });
  }

  ngOnDestroy() {
    this.admonSub?.unsubscribe();
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
  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  private modalServiceTable = inject(ModalService);
  private imageHandlerService = inject(ImageHandlerService);
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);
  private trackingService = inject(TrackingService);

  // Propiedades para el modal de reporte de saldos
  showSaldosModal: boolean = false;
  reportSaldosStartDate: string = '';
  reportSaldosEndDate: string = '';
  isGeneratingSaldosReport: boolean = false;

  // Propiedades para el modal de ajuste de saldo
  showAjusteModal: boolean = false;
  ajusteDate: string = '';
  ajusteMonto: number = 0;
  ajusteDescripcion: string = '';
  ajusteTipo: string = 'DEPOSITO';
  isSavingAjuste: boolean = false;
  saldoActual: number = 0;

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
    if (!id) return;

    this.lastSelectedId = id;
    this.rowDetails = [];

    this.administrationService.getBalance(parseInt(id)).subscribe({
      next: (response: any) => {
        if (response.success && response.hasData) {
          this.rowDetails = response.data;
        } else {
          // Una cuenta puede no tener movimientos todavía; esto no impide editarla.
          this.rowDetails = [];
        }
      },
      error: () => {
        this.rowDetails = [];
        alerts.basicAlert('Error', 'Error al cargar los datos', 'error');
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

  refreshAll() {
    const prevSelected = this.selectedRowData?.id?.toString() ?? null;
    this.lastSelectedId = null;
    this.obtenerDatos();
    if (prevSelected) {
      this.rowDetails = [];
      this.loadBalanceData(prevSelected);
    }
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

  // ==================== REPORTE DE SALDOS ====================

  openSaldosModal() {
    if (!this.selectedRowData) {
      alerts.basicAlert('Aviso', 'Seleccione una cuenta bancaria primero.', 'warning');
      return;
    }
    if (!this.rowDetails || this.rowDetails.length === 0) {
      alerts.basicAlert('Aviso', 'La cuenta seleccionada no tiene movimientos registrados.', 'info');
      return;
    }
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const firstDay = new Date(prev.getFullYear(), prev.getMonth(), 1);
    const lastDay  = new Date(prev.getFullYear(), prev.getMonth() + 1, 0);
    this.reportSaldosStartDate = this.formatDateSaldos(firstDay);
    this.reportSaldosEndDate   = this.formatDateSaldos(lastDay);
    this.showSaldosModal = true;
    document.body.classList.add('modal-open');
  }

  closeSaldosModal() {
    this.showSaldosModal = false;
    document.body.classList.remove('modal-open');
  }

  private formatDateSaldos(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  formatCurrencySaldos(amount: number): string {
    return (amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async generateSaldosReport() {
    if (!this.reportSaldosStartDate || !this.reportSaldosEndDate) {
      alerts.basicAlert('Error', 'Por favor seleccione ambas fechas', 'error');
      return;
    }

    const filtered = (this.rowDetails || []).filter((item: any) => {
      if (!item.fecha) return false;
      const d = new Date(item.fecha);
      if (isNaN(d.getTime())) return false;
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return ds >= this.reportSaldosStartDate && ds <= this.reportSaldosEndDate;
    });

    if (filtered.length === 0) {
      alerts.basicAlert('Sin datos', 'No hay movimientos en el rango de fechas seleccionado', 'info');
      return;
    }

    this.isGeneratingSaldosReport = true;

    try {
      const companyId = parseInt(localStorage.getItem('company') || '0');
      const bankName = this.banks
        ? (this.banks.find((b: any) => b.id === this.selectedRowData?.idBanco)?.name || '')
        : '';
      const accountName = `${this.selectedRowData?.nameAccount || ''} - ${bankName}`;

      let logoData: string | null = null;
      try {
        const rootData: any = await lastValueFrom(this.rootService.getRootbyId(companyId));
        if (rootData?.picture) {
          logoData = await this.base64EncodeService.convertImageToBase64(rootData.picture);
        }
      } catch {}

      const pdfMake = (await import('pdfmake/build/pdfmake')).default;
      const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
      pdfMake.vfs = pdfFonts;

      const period = `Del ${this.reportSaldosStartDate} al ${this.reportSaldosEndDate}`;

      const tableRows: any[] = [[
        { text: 'NUMERO DOCUMENTO', style: 'th' },
        { text: 'FECHA',            style: 'th' },
        { text: 'DESCRIPCION',      style: 'th' },
        { text: 'TIPO',             style: 'th' },
        { text: 'DEPOSITO',         style: 'th' },
        { text: 'GASTO',            style: 'th' },
        { text: 'SALDO',            style: 'th' },
      ]];

      let totalDeposito = 0;
      let totalGasto = 0;

      filtered.forEach((item: any, idx: number) => {
        const bg = idx % 2 === 0 ? '#eaf4fb' : '#ffffff';
        const deposito = parseFloat(item.deposito) || 0;
        const gasto    = parseFloat(item.gasto)    || 0;
        const saldo    = parseFloat(item.saldo)    || 0;
        totalDeposito += deposito;
        totalGasto    += gasto;

        const fechaDisplay = (() => {
          try {
            const d = new Date(item.fecha);
            return isNaN(d.getTime()) ? (item.fecha || '') :
              `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
          } catch { return item.fecha || ''; }
        })();

        tableRows.push([
          { text: item.numeroDocumento || '', style: 'td', fillColor: bg },
          { text: fechaDisplay, style: 'td', fillColor: bg, alignment: 'center' },
          { text: item.descripcion || '', style: 'td', fillColor: bg },
          { text: item.tipo || '', style: 'td', fillColor: bg, alignment: 'center' },
          { text: deposito > 0 ? `$${this.formatCurrencySaldos(deposito)}` : '', style: 'td', fillColor: bg, alignment: 'right', color: '#008000' },
          { text: gasto > 0 ? `$${this.formatCurrencySaldos(gasto)}` : '', style: 'td', fillColor: bg, alignment: 'right', color: '#CC0000' },
          { text: `$${this.formatCurrencySaldos(saldo)}`, style: 'td', fillColor: bg, alignment: 'right', color: saldo >= 0 ? '#000080' : '#CC0000' },
        ]);
      });

      tableRows.push([
        { text: 'TOTAL', colSpan: 4, style: 'totalLabel', alignment: 'right', bold: true, border: [false, true, false, false] },
        {}, {}, {},
        { text: `$${this.formatCurrencySaldos(totalDeposito)}`, style: 'totalValue', alignment: 'right', border: [false, true, false, false], bold: true, color: '#008000' },
        { text: `$${this.formatCurrencySaldos(totalGasto)}`,    style: 'totalValue', alignment: 'right', border: [false, true, false, false], bold: true, color: '#CC0000' },
        { text: '', border: [false, true, false, false] },
      ]);

      const docDefinition: any = {
        pageSize: 'LETTER',
        pageOrientation: 'landscape',
        pageMargins: [20, 60, 20, 40],
        header: (currentPage: number, pageCount: number) => ({
          columns: [
            logoData
              ? { image: logoData, width: 60, margin: [20, 10, 0, 0] }
              : { text: '', width: 60, margin: [20, 10, 0, 0] },
            {
              stack: [
                { text: 'ESTADO DE CUENTA / REPORTE DE SALDOS', fontSize: 11, bold: true, alignment: 'center' },
                { text: accountName, fontSize: 9, alignment: 'center', color: '#444' },
                { text: period, fontSize: 8, alignment: 'center', color: '#666' },
              ],
              margin: [0, 10, 0, 0]
            },
            {
              stack: [
                { text: 'Referencia: EST-CTB', fontSize: 7, alignment: 'right', color: '#666' },
                { text: 'Código: 09', fontSize: 7, alignment: 'right', color: '#666' },
                { text: 'Rev: 00', fontSize: 7, alignment: 'right', color: '#666' },
                { text: `Pág. ${currentPage}/${pageCount}`, fontSize: 7, alignment: 'right', color: '#666' },
              ],
              margin: [0, 10, 20, 0]
            }
          ]
        }),
        content: [{
          table: {
            headerRows: 1,
            widths: [85, 65, '*', 65, 70, 70, 70],
            body: tableRows,
          },
          layout: {
            hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 1 : 0.3,
            vLineWidth: () => 0.3,
            hLineColor: () => '#aaa',
            vLineColor: () => '#aaa',
          }
        }],
        styles: {
          th:         { fontSize: 7, bold: true, color: '#FFFFFF', fillColor: '#1a5276', alignment: 'center', margin: [2, 3, 2, 3] },
          td:         { fontSize: 7, margin: [2, 2, 2, 2] },
          totalLabel: { fontSize: 7, margin: [2, 3, 2, 3] },
          totalValue: { fontSize: 7, margin: [2, 3, 2, 3] },
        }
      };

      const pdf = pdfMake.createPdf(docDefinition);
      try {
        pdf.open();
      } catch {
        pdf.download(`saldos-${this.selectedRowData?.nameAccount || 'cuenta'}-${this.reportSaldosStartDate}-al-${this.reportSaldosEndDate}.pdf`);
        alerts.basicAlert('Reporte descargado', 'El navegador bloqueó la ventana emergente. El reporte se descargó automáticamente.', 'info');
      }
      this.closeSaldosModal();
      this.trackingService.addLog(
        'AccountBanks',
        `Reporte de Saldos: ${accountName} - ${this.reportSaldosStartDate} al ${this.reportSaldosEndDate}`,
        'Cuentas Bancarias - Saldos',
        this.trackingService.getEmail()
      );
    } catch (error) {
      console.error('Error al generar reporte de saldos:', error);
      alerts.basicAlert('Error', 'Error al generar el reporte PDF', 'error');
    } finally {
      this.isGeneratingSaldosReport = false;
    }
  }

  // ==================== AJUSTE DE SALDO ====================

  openAjusteModal() {
    if (!this.selectedRowData) {
      alerts.basicAlert('Aviso', 'Seleccione una cuenta bancaria primero.', 'warning');
      return;
    }

    // Saldo inicial: columna Saldo del grid maestro
    this.saldoActual = this.selectedRowData.saldo || 0;

    this.ajusteDate = this.formatDateSaldos(new Date());
    this.ajusteMonto = 0;
    this.ajusteDescripcion = '';
    this.ajusteTipo = 'DEPOSITO';
    this.showAjusteModal = true;
    document.body.classList.add('modal-open');
  }

  onAjusteDateChange() {
    if (!this.ajusteDate || !this.rowDetails?.length) return;

    const fechaSel = this.ajusteDate; // 'YYYY-MM-DD'

    // Convertir fecha de cada fila al mismo formato YYYY-MM-DD (igual que el PDF)
    const toDs = (fecha: any): string => {
      const d = new Date(fecha);
      return isNaN(d.getTime()) ? ''
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Ordenar por fecha ascendente y quedarse con las que sean <= fecha seleccionada
    const candidatos = (this.rowDetails as any[])
      .filter(item => item.fecha && toDs(item.fecha) !== '' && toDs(item.fecha) <= fechaSel)
      .sort((a, b) => toDs(a.fecha) < toDs(b.fecha) ? -1 : toDs(a.fecha) > toDs(b.fecha) ? 1 : 0);

    if (candidatos.length > 0) {
      // El último (más reciente hasta esa fecha) tiene el saldo acumulado correcto
      this.saldoActual = parseFloat(candidatos[candidatos.length - 1].saldo) || 0;
    } else {
      // No hay movimientos anteriores a esa fecha
      this.saldoActual = this.selectedRowData?.saldo || 0;
    }
  }

  closeAjusteModal() {
    this.showAjusteModal = false;
    document.body.classList.remove('modal-open');
  }

  async saveAjuste() {
    if (!this.ajusteDescripcion.trim()) {
      alerts.basicAlert('Error', 'La descripción es obligatoria.', 'error');
      return;
    }
    if (!this.ajusteMonto || this.ajusteMonto <= 0) {
      alerts.basicAlert('Error', 'El monto debe ser mayor a cero.', 'error');
      return;
    }
    if (!this.ajusteDate) {
      alerts.basicAlert('Error', 'La fecha es obligatoria.', 'error');
      return;
    }

    this.isSavingAjuste = true;

    try {
      const companyId = parseInt(localStorage.getItem('company') || '0');
      // Añadir hora para evitar desfase de zona horaria
      const fechaAjuste = new Date(this.ajusteDate + 'T12:00:00');
      const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const paymentMonth = meses[fechaAjuste.getMonth()];

      const adjustmentData = {
        idAccount: this.selectedRowData.id,
        idBusinnes: companyId,
        idBranch: 0,
        date: fechaAjuste.toISOString(),
        idCustomer: 0,
        idExpend: 0,
        uuid: 'NA',
        paymentMonth: paymentMonth,
        dateStamped: new Date().toISOString(),
        description: `AJUSTE - ${this.ajusteDescripcion.trim()}`,
        type: this.ajusteTipo,
        subtotal: this.ajusteMonto,
        tax: 0,
        total: this.ajusteMonto,
        createdBy: localStorage.getItem('mail') || 'sistema',
        createdAt: new Date().toISOString(),
        modifiedBy: null,
        modifiedAt: new Date().toISOString(),
        status: 'Pagada',
        active: true,
      };

      await lastValueFrom(this.incomesAndExpensesService.addIncomesAndExpenses(adjustmentData));

      alerts.basicAlert('Ajuste guardado', 'El ajuste de saldo se ha registrado correctamente.', 'success');

      this.closeAjusteModal();

      // Recargar saldo forzando la recarga
      if (this.selectedRowData?.id) {
        this.lastSelectedId = null;
        this.loadBalanceData(this.selectedRowData.id.toString());
      }

      this.trackingService.addLog(
        'AccountBanks',
        `Ajuste de Saldo: ${this.selectedRowData?.nameAccount} - ${this.ajusteTipo} $${this.ajusteMonto}`,
        'Cuentas Bancarias - Ajuste Saldo',
        this.trackingService.getEmail()
      );
    } catch (error) {
      console.error('Error al guardar ajuste:', error);
      alerts.basicAlert('Error', 'Error al registrar el ajuste de saldo.', 'error');
    } finally {
      this.isSavingAjuste = false;
    }
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
