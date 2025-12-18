import { Component, effect, inject } from '@angular/core';
import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { ModalService } from 'app/services/modal.service';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom, concat, toArray, catchError, EMPTY, forkJoin, tap, map } from 'rxjs';
import { AdministrationService } from 'app/services/administration.service';
import { SearchableSelectComponent } from 'app/shared/searchable-select/searchable-select.component';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { UsersService } from 'app/services/users.service';
import { SignalsService } from 'app/services/signals.service';
import { NgSelectComponent, NgSelectModule } from '@ng-select/ng-select';
import { AdditionalInfoComponent } from "../income/additional-info/additional-info.component";
import { CatalogadmonService } from 'app/services/catalogadmon.service';
import { BranchsService } from 'app/services/branchs.service';
import { environment } from '@env/environment';
import { AuthService } from 'app/services/auth.service';
import { TrackingService } from 'app/services/tracking.service';
import { ButtonCellRendererExpenditureComponent } from './button-cell-renderer-expenditure.component';
import { DetailCellRendererExpenditureComponent } from './detail-cell-renderer-expenditure.component';
import { CatalogsService } from 'app/services/catalogs.service';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';

@Component({
  selector: 'app-egresos-palacio',
  standalone: true,
  imports: [NgSelectModule, NgSelectComponent, AgGridModule, MultiLineEditorComponent, CommonModule,
    FormsModule, ButtonCellRendererExpenditureComponent, DetailCellRendererExpenditureComponent],
  templateUrl: './egresos-palacio.component.html',
  styleUrl: './egresos-palacio.component.scss'
})
export class EgresosPalacioComponent {

  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  private modalServiceTable         = inject(ModalService);
  private administrationService     = inject(AdministrationService);
  private cataalogAdmonService      = inject(CatalogadmonService);
  private catalogsService           = inject(CatalogsService);
  private usersxpermissionsService  = inject(UsersxpermissionsService);
  private usersService              = inject(UsersService);
  private signalsService            = inject(SignalsService);
  private branchesService           = inject(BranchsService);
  private rootService               = inject(RootService);
  private base64EncodeService       = inject(Base64EncodeService);
  authService                       = inject(AuthService);
  public trackingService            = inject(TrackingService);

  public isIncomeMode: boolean = false;

  async ngOnInit() {

}

constructor() {
//  console.log('🏗️ EgresosPalacioComponent: Constructor iniciado');

  // Effect para cambios de Root/Branch (sin cambios)
  effect(async () => {
    console.log('🔄 Effect Root/Branch ejecutado - Palacio Municipal');
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    this.idBranch = this.signalsService.getBranchSelectedBySidebar()();

    if (!this.idRoot) {
      console.log('⚠️ No hay idRoot, saliendo del effect');
      return;
    }

    console.log('📊 Cargando datos con idRoot:', this.idRoot, 'idBranch:', this.idBranch);
    await this.getBillingManagementInfo();
    await this.getBankAccounts();
    await this.getExpenditure();
    await this.getBills();
    await this.loadAuthorizers();
    await this.getCurrentUser();
    await this.obtenerBranchs();
    console.log('✅ Effect Root/Branch completado - Palacio Municipal');
  });

  // ✅ CORRECCIÓN: Effect mejorado para escuchar actualizaciones del detalle
  effect(() => {
    console.log('👂 Effect MasterUpdate ejecutado - Palacio Municipal');
    const updateData = this.signalsService.getMasterUpdateTrigger()();
    console.log('📨 Signal recibido:', updateData);

    // ✅ CORRECCIÓN: Verificar que hay datos válidos Y que no es null
    if (updateData && updateData.id && typeof updateData.subtotal === 'number') {
      console.log('🎯 Datos válidos recibidos:', {
        id: updateData.id,
        subtotal: updateData.subtotal,
        tax: updateData.tax,
        total: updateData.total,
        //timestamp: updateData.timestamp
      });

      console.log('🔍 gridApi disponible:', !!this.gridApi);

      if (this.gridApi) {
        console.log('✅ Llamando updateMasterRowInGrid...');
        // ✅ CORRECCIÓN: Usar setTimeout para asegurar que el grid esté listo
        setTimeout(() => {
          this.updateMasterRowInGrid({
            id: updateData.id,
            subtotal: updateData.subtotal,
            tax: updateData.tax,
            total: updateData.total
          });
        }, 50);
      } else {
        console.log('❌ gridApi no disponible, guardando datos para cuando esté listo');
        // ✅ CORRECCIÓN: Guardar los datos para cuando el grid esté listo
        this.pendingMasterUpdate = {
          id: updateData.id,
          subtotal: updateData.subtotal,
          tax: updateData.tax,
          total: updateData.total
        };
      }
    } else {
      console.log('ℹ️ No hay datos válidos para actualizar');
    }
  });

  console.log('✅ EgresosPalacioComponent: Constructor completado');
}


// ✅ CORRECCIÓN: Agregar propiedad para datos pendientes
  private pendingMasterUpdate: any = null;
  showform : string = '';
  branchs  : any[] = [];
  incomes  : any[] = [];
  expenses : any[] = [];
  users    : any[] = [];

  id: number;
  notSavedChanges: boolean = false;
  newlyAddedRows: string[] = [];
  selectedIncomes: any = null;
  currentUser: string;

  idRoot      : number;
  idBranch    : number;
  triggerValue: number = 0;

  bankAccounts: any[] = [];
  prefixAndConsecutive: any[] = [];

  private _idAccount: number; // Variable de respaldo para el setter

  // Añadir setter para idAccount con lógica de actualización
  set idAccount(value: number) {
    if (this._idAccount !== value) {
      this._idAccount = value;

          // Agregar log cuando se selecciona una cuenta
    if (value) {
      const selectedAccount = this.bankAccounts.find(account => account.id === value);
      if (selectedAccount) {
        const accountDetails = `${selectedAccount.nameAccount} - ${selectedAccount.bankName}`;
        this.trackingService.addLog(this.trackingService.getnameComp(), `Selección de cuenta bancaria: ${accountDetails}`,
                                    'Palacio Municipal - Egresos', this.trackingService.getEmail());
      }
    }

      this.signalsService.setIdIncomeAndExpense(null);
      this.getExpenditure(); // Ejecutar getIncomes cuando cambia el valor
    }
  }

  get idAccount(): number {
    return this._idAccount;
  }

  obtenerBranchs() {
    // alert('this.branchs'+ this.idBranch)
    this.branchesService.getBrancheswoa(this.idRoot).subscribe(
      (data: any) => {
        this.branchs = data;
      },
      (error) => console.error('Error fetching data:', error)
    );
        this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Sucursales`, 'Palacio Municipal - Egresos',
          this.trackingService.getEmail() );
  }

  async getBillingManagementInfo() {
    this.administrationService.getBillingManagementInfo(this.idRoot).subscribe(
      (data: any) => {
        this.prefixAndConsecutive = Array.isArray(data) ? data : [data];
      },
      (error) => {
        console.error('Error al obtener la información de gestión de facturación:', error);
      }
    );
    this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Cuentas Bancarias`, 'Palacio Municipal - Egresos',
          this.trackingService.getEmail() );
  }

  private gridApi: GridApi;
  private tempIdCounter: number = 0;

  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    headerHeight: 24,
    rowHeight: 24,
    animateRows: true,
    masterDetail: true,
    detailRowHeight: 700,
    isRowMaster: (dataItem: any) => true,
    detailCellRenderer: DetailCellRendererExpenditureComponent,
    getRowClass: (params) => {
      // Verificar si la fila está seleccionada
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    getRowStyle: (params) => {
      if (params.data) {
        switch (params.data.status) {
          case 'Pendiente':
            return { backgroundColor: '#cce5ff', color: '#004085' }; // Azul
          case 'Pagada':
            return { backgroundColor: '#d4edda', color: '#155724' }; // Verde
          case 'Cancelada':
            return { backgroundColor: '#f8d7da', color: '#721c24' }; // Rojo
          case 'Entregada':
            return { backgroundColor: '#fff3cd', color: '#856404' }; // Amarillo
          default:
            return null;
        }
      }
      return null;
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

  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  components = {
    multiLineEditor: MultiLineEditorComponent,
    searchableSelect: SearchableSelectComponent
  };

  async getExpenditure() {
    this.incomesAndExpensesService.getIncomesAndExpenses(this.idRoot).subscribe({
      next: (incomes) => {
        // Filtrado y manejo de caso sin datos

        const filtered = incomes?.filter(income => {
          return income.type === "GASTO" && income.idAccount === this.idAccount
        }) || [];

        // Agregar propiedades para master-detail
        this.incomes = filtered.map(income => ({
          ...income,
          countrow: 0, // Se actualizará al cargar conceptos
          countDocumentos: 0, // Se actualizará al cargar documentos comprobados
          detailType: null,
          detailData: []
        }));

        // Cargar el conteo de conceptos y documentos para cada egreso
        this.loadConceptCounts();
        this.loadDocumentosComprobadosCount();
      },
      error: (err) => {
        // Manejo de errores HTTP
        console.error('Error obteniendo egresos. Código:', err.status, 'Detalles:', err);
        this.incomes = [];
      }
    });
    this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Egresos`, 'Palacio Municipal - Egresos',
          this.trackingService.getEmail() );
  }

  async getBills() {
    this.administrationService.getByNivelObjeto(this.idRoot, 1).subscribe(
      (data: any) => {
        this.expenses = data;
      },
      error => {
        console.error(error);
      }
    )
    this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Objetos de Gasto`, 'Palacio Municipal - Egresos',
          this.trackingService.getEmail() );
  }

  // Nuevo método para cargar usuarios autorizadores
  private async loadAuthorizers() {
    forkJoin({
      permissions: this.usersxpermissionsService.getDataUsersxPermissions('root'),
      allUsers: this.usersService.getDataUsers(this.idRoot)
    }).subscribe({
      next: ({ permissions, allUsers }) => {
        // Manejo seguro de las respuestas
        const validPermissions = Array.isArray(permissions) ? permissions : [];
        const validUsers = Array.isArray(allUsers?.data) ? allUsers.data : [];

        const authorizedUserIds = [
          ...new Set(
            validPermissions
              .filter((p: { idPermission: number }) => p.idPermission === this.idRoot)
              .map((p: { idUser: number }) => p.idUser)
          )
        ] as number[];

        this.users = validUsers
          .filter((user: { id: number }) => authorizedUserIds.includes(user.id))
          .map((user: any) => ({
            id: user.id,
            smallName: user.usersmall || 'Sin nombre'
          }));
      },
      error: (err) => console.error('Error cargando datos:', err)
    });
  }

  async getCurrentUser() {
    this.usersService.getUserByEmail(String(localStorage.getItem('mail'))).subscribe({
      next: (response) => {
        if (response?.data?.usersmall) {
          this.currentUser = response.data.usersmall;
        } else {
          this.currentUser = 'Sin nombre';
        }
      },
      error: (err) => {
        console.error('Error obteniendo usuario:', err);
        this.currentUser = 'Error al cargar';
      }
    });
  }

  // Agregar función de formato de fecha
  private formatDate(value: string): string {
    if (!value) return '';
    const date = new Date(value);
    return [
      date.getDate().toString().padStart(2, '0'),
      (date.getMonth() + 1).toString().padStart(2, '0'),
      date.getFullYear()
    ].join('-');
  }

  // Column Definitions: Defines the columns to be displayed.
  get colMaster(): ColDef[] {
    return [
      {
        field: 'countrow',
        headerName: 'Items',
        width: 90,
        cellRenderer: ButtonCellRendererExpenditureComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleCascade(node),
        },
        valueGetter: params => params.data.countrow || 0,
        editable: false,
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer', textDecoration: 'underline' }
      },
      {
        field: 'pdfReport',
        headerName: 'PDF',
        width: 80,
        cellRenderer: (params: any) => {
          return '<i class="bi bi-file-earmark-pdf" style="font-size: 1.2rem; color: #dc3545; cursor: pointer;"></i>';
        },
        editable: false,
        cellStyle: { textAlign: 'center', cursor: 'pointer' },
        onCellClicked: (params: any) => {
          this.toggleReportDetail(params.node);
        }
      },
      {
        field: 'countDocumentos',
        headerName: 'Comprobación',
        width: 130,
        cellRenderer: ButtonCellRendererExpenditureComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleComprobacionDetail(node),
          icon: 'bi-file-earmark-check',
          title: 'Hacer clic para ver los documentos comprobados'
        },
        valueGetter: params => params.data.countDocumentos || 0,
        editable: false,
        cellStyle: { backgroundColor: '#d4edda', cursor: 'pointer', textDecoration: 'underline' }
      },
      {
        field: 'status',
        headerName: 'Estatus',
        editable: true,
        width: 90,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: [
            'Pendiente',
            'Entregada',
            'Cancelada',
            'Pagada'
          ]
        }
      },
      { field: 'numberDocument', headerName: '# Doc/Fac', editable: false, filter: true, width: 120, hide: false },

      { field: 'date', headerName: 'Fecha', editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true
        }, cellDataType: 'date', width: 125,
              valueFormatter: (params) => this.formatDate(params.value)
            },

            {
                field: 'idExpend', headerName: 'Objeto de Gasto', editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true
        }, width: 250,
                cellEditor: 'searchableSelect',
                cellEditorParams: {
                  options: this.expenses,
                  valueField: 'id',
                  displayField: 'nombre'
                },
                valueFormatter: (params) => {
                  const foundItem = this.expenses
                    ? this.expenses.find((item) => item.id === params.value)
                    : null;
                  return foundItem ? `${foundItem.codigo} - ${foundItem.nombre}` : params.value;
                },
            },

            {
              field: 'description', headerName: 'Descripción', editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true
        }, width: 155, filter: true,
              cellEditor: 'agPopupTextCellEditor',
              cellEditorParams: {
                maxLength: 100,
                cols: 50,
                rows: 3,
                onKeyDown: (event: KeyboardEvent) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.stopPropagation();
                  }
                },
              },
              onCellDoubleClicked: (event: CellDoubleClickedEvent) => {
                if (!event.node.group) {
                  this.modalServiceTable.showModal({
                    params: event,
                    value: event.value,
                  });
                }
              },
              cellRenderer: (params: ICellRendererParams) => {
                if (params.node.group) {
                  return params.value;
                }
                return params.value;
              }
            },

      {
        field: 'subtotal',
        headerName: 'Subtotal',
        type: 'number',
        editable: false,
        width: 120,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },

      {
        field: 'tax',
        headerName: 'Impuestos',
        type: 'number',
        editable: false,
        width: 110,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
      {
        field: 'total',
        headerName: 'Total',
        type: 'number',
        editable: false,
        width: 130,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },

      {
        field: 'createdBy',
        headerName: 'Autoriza',
        editable: false,
        width: 105
      }

    ]
  };

  onSelectedRow(event: any) {
    this.id = event.data.id;
    //console.log('Type fila seleccionada:', event.data.type);
    this.signalsService.setIdIncomeAndExpense(this.id);
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedIncomes = selectedNodes[0].data;
      this.signalsService.setIdIncomeAndExpense(this.selectedIncomes.id);
    } else {
      this.selectedIncomes = null;
    }
  }

  onCellValueChanged(event: any) {

    // Actualizar campos de modificación solo para filas existentes
    if (!event.data.__isNew) {
      event.data.modifiedBy = this.currentUser;
      event.data.modifiedAt = new Date().toISOString();
    }

    event.data.__modified = true;
    this.notSavedChanges = true;
  }

 // ✅ CORRECCIÓN: Modificar onGridReady para procesar actualizaciones pendientes
onGridReady(params: GridReadyEvent) {
  console.log('🏁 Grid ready - Palacio Municipal - Egresos');
  this.gridApi = params.api;

  // Configurar el detailCellRendererParams para pasar datos al detail renderer
  this.gridApi.setGridOption('detailCellRendererParams', {
    getDetailRowData: (params) => {
      params.successCallback(params.data.detailData);
    },
    context: {
      idRoot: this.idRoot,
      componentParent: this,
      gridApi: this.gridApi,
      catalogsService: this.catalogsService,
      administrationService: this.administrationService,
      catalogadmonService: this.cataalogAdmonService,
      rootService: this.rootService,
      base64EncodeService: this.base64EncodeService,
      objetosGasto: this.expenses,
      CONCEPTS: {
        load: (expenditureId: number, callback: (data: any[]) => void) => {
          this.loadConceptsData(expenditureId, callback);
        },
        save: (expenditureId: number, data: any) => {
          this.saveConceptsById(expenditureId, data);
        },
        delete: (params: any, callback: () => void) => {
          this.deleteConceptRow(params, callback);
        },
        updateCount: (expenditureId: number, count: number) => {
          this.updateExpenditureConceptCount(expenditureId, count);
        }
      },
      DOCUMENTOS_COMPROBADOS: {
        load: (expenditureId: number, callback: (data: any[]) => void) => {
          this.loadDocumentosComprobados(expenditureId, callback);
        },
        save: (expenditureId: number, data: any) => {
          this.saveDocumentosComprobados(expenditureId, data);
        },
        delete: (params: any, callback: () => void) => {
          this.deleteDocumentoComprobado(params, callback);
        },
        updateCount: (expenditureId: number, count: number) => {
          this.updateExpenditureDocumentosCount(expenditureId, count);
        }
      }
    }
  });

  // ✅ CORRECCIÓN: Procesar actualizaciones pendientes
  if (this.pendingMasterUpdate) {
    console.log('⏳ Procesando actualización pendiente:', this.pendingMasterUpdate);
    setTimeout(() => {
      this.updateMasterRowInGrid(this.pendingMasterUpdate);
      this.pendingMasterUpdate = null;
    }, 100);
  }
}
  addRow() {
      this.trackingService.addLog(this.trackingService.getnameComp(), `Creacion de un Egreso`, 'Palacio Municipal - Egresos',
          this.trackingService.getEmail() );

    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idAccount: this._idAccount,
      numberDocument: "",
      idBusinnes: this.idRoot,
      idBranch: 0,
      date: new Date().toISOString(),
      idCustomer: 0,
      idExpend: 0,
      uuid: "NA",
      paymentMonth: '',
      dateStamped: new Date().toISOString(),
      description: "POR COMPROBAR",
      type: "GASTO",
      subtotal: 0,
      tax: 0,
      total: 0,
      createdBy: this.currentUser || 'Usuario temporal',
      createdAt: new Date().toISOString(),
      modifiedBy: this.currentUser || 'Usuario temporal',
      modifiedAt: new Date().toISOString(),
      status: "Pagada",
      active: true,
      __isNew: true,
    };
    this.incomes = [newItem, ...this.incomes];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;

    // Encontrar el índice de la nueva fila
    const newRowIndex = this.incomes.findIndex((row) => row.id === tempId);

    // Encontrar la primera columna editable
    const firstEditableCol = this.colMaster.find(col => col.editable);
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
    const isValid = this.incomes.every((item) => item.description);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar todos los campos antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.incomes.filter((row) => row.__isNew);
    const modifiedRows = this.incomes.filter(
      (row) => row.__modified && !row.__isNew
    );

    // Solo validar configuración si hay nuevas filas que necesitan número de documento
    let currentConsecutive = 0;
    if (newRows.length > 0) {
      if (!this.prefixAndConsecutive?.[0]) {
        alerts.basicAlert(
          'Error de configuración',
          'La configuración de prefijo/consecutivo no está cargada correctamente',
          'error'
        );
        return;
      }

      // Obtener el último consecutivo específico de esta cuenta bancaria para EGRESOS
      currentConsecutive = await this.getLastConsecutiveForAccountExp(this._idAccount);

      // Generar números de documento para nuevas filas
      newRows.forEach(row => {
        currentConsecutive++;
        row.numberDocument = `${this.prefixAndConsecutive[0].prefixexp}${currentConsecutive.toString().padStart(4, '0')}`;
      });
    }

    try {
      // Guardar los registros de egresos
      await this.saveExpenditureRecords(newRows, modifiedRows);

      // Éxito
      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );

      this.trackingService.addLog(this.trackingService.getnameComp(), `Salvar Egresos`, 'Palacio Municipal - Egresos',
          this.trackingService.getEmail());

      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      await this.getExpenditure(); // Refrescar los datos

    } catch (error) {
      console.error('Error crítico en saveChanges:', error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al guardar los registros. Por favor, intente nuevamente.',
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
    selectedData.active = 0;
    this.incomesAndExpensesService.deleteIncomesAndExpenses(id).pipe(
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
      .subscribe(
        () => {
          alerts.basicAlert(
            'Eliminar entrada',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );
          this.getExpenditure();

          alerts.basicAlert(
            'Eliminar entrada',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );
          this.notSavedChanges = false;
          this.selectedIncomes = null;
        }
      );
  }

  revert() {
    this.getExpenditure();
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

  // Método para guardar los registros de egresos
  private async saveExpenditureRecords(newRows: any[], modifiedRows: any[]): Promise<void> {
    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Save Registro en Egresos - Palacio Municipal',
        'Menu Administración - Palacio Municipal - Egresos',
        this.trackingService.getEmail()
      );
      return this.incomesAndExpensesService.addIncomesAndExpenses(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Update Registro en Egresos - Palacio Municipal',
        'Menu Administración - Palacio Municipal - Egresos',
        this.trackingService.getEmail()
      );
      return this.incomesAndExpensesService.updateIncomesAndExpenses(row.id, cleanedData);
    });

    // Ejecutar todas las operaciones de guardado
    const allObservables = [...addObservables, ...updateObservables];

    if (allObservables.length > 0) {
      await lastValueFrom(
        forkJoin(allObservables) // Usar forkJoin para ejecutar todas en paralelo
      );
    }
  }

  // Método para obtener el último consecutivo para una cuenta específica (EGRESOS)
  private async getLastConsecutiveForAccountExp(idAccount: number): Promise<number> {
    try {
      // Obtener todos los egresos de esta cuenta bancaria desde el servidor
      const allExpenses: any = await lastValueFrom(
        this.incomesAndExpensesService.getIncomesAndExpenses(this.idRoot)
      );

      // Filtrar solo los de esta cuenta y tipo GASTO
      const accountExpenses = allExpenses?.filter((expense: any) =>
        expense.type === "GASTO" &&
        expense.idAccount === idAccount &&
        expense.numberDocument
      ) || [];

      if (accountExpenses.length === 0) {
        // Si no hay egresos previos, empezar desde 0
        return 0;
      }

      // Extraer los consecutivos numéricos de los números de documento
      const prefix = this.prefixAndConsecutive[0].prefixexp;
      const consecutives = accountExpenses
        .map((expense: any) => {
          const numberDocument = expense.numberDocument || '';
          // Remover el prefijo y convertir a número
          if (numberDocument.startsWith(prefix)) {
            const numericPart = numberDocument.substring(prefix.length);
            return parseInt(numericPart, 10);
          }
          return 0;
        })
        .filter((num: number) => !isNaN(num));

      // Retornar el máximo consecutivo encontrado
      const maxConsecutive = consecutives.length > 0 ? Math.max(...consecutives) : 0;

      return maxConsecutive;

    } catch (error) {
      console.error('Error obteniendo último consecutivo de egresos:', error);
      // En caso de error, retornar 0 para empezar desde el principio
      return 0;
    }
  }

  async getBankAccounts() {
    this.administrationService.getAccountBanks(this.idRoot).subscribe(
      (data: any) => {
        this.bankAccounts = data;
      },
      error => {
        console.error(error);
        this.bankAccounts = []; // Vaciamos el array en caso de error
      }
    )
  }


private updateMasterRow(updatedData: any) {
  if (!this.gridApi) return;

  const rowNode = this.gridApi.getRowNode(updatedData.id.toString());
  if (rowNode) {
    // Obtenemos la data actual de la fila
    const currentData = rowNode.data;

    // Sobrescribimos solo los campos de totales
    currentData.subtotal = updatedData.subtotal;
    currentData.tax = updatedData.tax;
    currentData.total = updatedData.total;

    // Aplicamos la transacción para que AG Grid refresque solo esa fila
    this.gridApi.applyTransaction({ update: [currentData] });
    console.log(`Fila maestra ${updatedData.id} actualizada con nuevos totales.`);
  }
}


// ✅ MÉTODO MEJORADO para actualizar la fila del maestro sin perder la selección
private updateMasterRowInGrid(updatedData: { id: number; subtotal: number; tax: number; total: number }) {
  console.log('🔄 updateMasterRowInGrid iniciado con:', updatedData);

  if (!this.gridApi) {
    console.log('❌ gridApi no disponible');
    return;
  }

  if (!updatedData?.id) {
    console.log('❌ updatedData o id no válidos');
    return;
  }

  // BOOKMARK: Guardar la selección actual
  const selectedNodes = this.gridApi.getSelectedNodes();
  const currentSelectedId = selectedNodes.length > 0 ? selectedNodes[0].data.id : null;
  console.log('🔖 Selección actual guardada:', currentSelectedId);

  // Buscar el nodo de la fila a actualizar
  console.log('🔍 Buscando nodo con ID:', updatedData.id.toString());
  const rowNode = this.gridApi.getRowNode(updatedData.id.toString());
  console.log('🎯 Nodo encontrado:', !!rowNode);

  if (rowNode) {
    console.log('📝 Datos actuales del nodo:', {
      id: rowNode.data.id,
      subtotal_actual: rowNode.data.subtotal,
      tax_actual: rowNode.data.tax,
      total_actual: rowNode.data.total
    });

    // Actualizar los datos del nodo
    const currentData = rowNode.data;
    currentData.subtotal = updatedData.subtotal;
    currentData.tax = updatedData.tax;
    currentData.total = updatedData.total;

    console.log('📝 Datos después de actualizar:', {
      id: currentData.id,
      subtotal_nuevo: currentData.subtotal,
      tax_nuevo: currentData.tax,
      total_nuevo: currentData.total
    });

    // Aplicar la transacción para actualizar la fila
    console.log('🔄 Aplicando transacción...');
    this.gridApi.applyTransaction({ update: [currentData] });
    console.log('✅ Transacción aplicada');

    console.log(`✅ Fila maestra ${updatedData.id} actualizada con nuevos totales.`);

    // RESTAURAR BOOKMARK: Mantener la selección si era la misma fila
    if (currentSelectedId === updatedData.id) {
      console.log('🔖 Restaurando selección...');
      setTimeout(() => {
        const updatedNode = this.gridApi.getRowNode(updatedData.id.toString());
        if (updatedNode) {
          updatedNode.setSelected(true);
          this.gridApi.ensureNodeVisible(updatedNode);
          console.log('✅ Selección restaurada');
        } else {
          console.log('❌ No se pudo restaurar la selección');
        }
      }, 50);
    }
  } else {
    console.warn(`⚠️ No se encontró la fila ${updatedData.id} en el grid.`);

    // Plan B: Actualizar el array local
    console.log('🔄 Ejecutando Plan B - Actualizar array local...');
    const itemIndex = this.incomes.findIndex(item => item.id === updatedData.id);
    console.log('🔍 Índice en array local:', itemIndex);

    if (itemIndex !== -1) {
      console.log('📝 Datos actuales en array:', {
        subtotal_actual: this.incomes[itemIndex].subtotal,
        tax_actual: this.incomes[itemIndex].tax,
        total_actual: this.incomes[itemIndex].total
      });

      this.incomes[itemIndex].subtotal = updatedData.subtotal;
      this.incomes[itemIndex].tax = updatedData.tax;
      this.incomes[itemIndex].total = updatedData.total;

      console.log('📝 Datos después de actualizar array:', {
        subtotal_nuevo: this.incomes[itemIndex].subtotal,
        tax_nuevo: this.incomes[itemIndex].tax,
        total_nuevo: this.incomes[itemIndex].total
      });

      // RESTAURAR BOOKMARK después del refresco
      setTimeout(() => {
        if (currentSelectedId) {
          console.log('🔖 Intentando restaurar selección después de Plan B...');
          const nodeToSelect = this.gridApi.getRowNode(currentSelectedId.toString());
          if (nodeToSelect) {
            nodeToSelect.setSelected(true);
            this.gridApi.ensureNodeVisible(nodeToSelect);
            console.log('✅ Selección restaurada (Plan B)');
          } else {
            console.log('❌ No se pudo restaurar la selección (Plan B)');
          }
        }
      }, 100);
    } else {
      console.log('❌ No se encontró el item en el array local');
    }
  }
}

  // ==================== MÉTODOS PARA CASCADAS ====================

  toggleCascade(node: any) {
    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data.detailType === 'concepts';

    if (isCurrentlyExpanded) {
      // Si ya está expandido con conceptos, colapsarlo
      node.setExpanded(false);

      // Restaurar alturas de todas las filas
      api.forEachNode((otherNode: any) => {
        otherNode.setRowHeight(undefined);
      });
      api.onRowHeightChanged();
    } else {
      // Colapsar cualquier otra fila expandida
      api.forEachNode((otherNode: any) => {
        if (otherNode.expanded && otherNode.id !== node.id) {
          otherNode.setExpanded(false);
        }
      });

      // Ocultar todas las demás filas
      api.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id) {
          otherNode.setRowHeight(0);
        }
      });

      // Si la fila está expandida con otro tipo de detalle, cerrarla
      if (node.expanded && node.data.detailType !== 'concepts') {
        node.setExpanded(false);
      }

      // Cambiar el tipo de detalle a 'concepts'
      node.data.detailType = 'concepts';

      // Aplicar cambios de altura
      api.onRowHeightChanged();

      // Expandir con los conceptos
      setTimeout(() => {
        node.setExpanded(true);
      }, 0);
    }
  }

  toggleReportDetail(node: any) {
    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data.detailType === 'report';

    if (isCurrentlyExpanded) {
      // Si ya está expandido con el reporte, colapsarlo
      node.setExpanded(false);

      // Restaurar alturas de todas las filas
      api.forEachNode((otherNode: any) => {
        otherNode.setRowHeight(undefined);
      });
      api.onRowHeightChanged();
    } else {
      // Colapsar cualquier otra fila expandida
      api.forEachNode((otherNode: any) => {
        if (otherNode.expanded && otherNode.id !== node.id) {
          otherNode.setExpanded(false);
        }
      });

      // Ocultar todas las demás filas
      api.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id) {
          otherNode.setRowHeight(0);
        }
      });

      // Si la fila está expandida con otro tipo de detalle, cerrarla
      if (node.expanded && node.data.detailType !== 'report') {
        node.setExpanded(false);
      }

      // Cambiar el tipo de detalle a 'report'
      node.data.detailType = 'report';

      // Agregar la descripción del objeto de gasto formateada para el PDF
      if (node.data.idExpend && this.expenses) {
        const foundItem = this.expenses.find((item) => item.id === node.data.idExpend);
        if (foundItem) {
          node.data.objetoGastoTexto = `${foundItem.codigo} - ${foundItem.nombre}`;
        } else {
          node.data.objetoGastoTexto = 'Sin descripción';
        }
      } else {
        node.data.objetoGastoTexto = 'Sin objeto de gasto';
      }

      // Aplicar cambios de altura
      api.onRowHeightChanged();

      // Expandir con el reporte
      setTimeout(() => {
        node.setExpanded(true);
      }, 0);
    }
  }

  collapseReportDetail(expenditureId: number) {
    if (this.gridApi) {
      this.gridApi.forEachNode((node) => {
        if (node.data && node.data.id === expenditureId) {
          node.setExpanded(false);
          node.data.detailType = null;
        }
      });

      // Restaurar alturas
      this.gridApi.forEachNode((node) => {
        node.setRowHeight(undefined);
      });
      this.gridApi.onRowHeightChanged();
    }
  }

  toggleComprobacionDetail(node: any) {
    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data.detailType === 'comprobacion';

    if (isCurrentlyExpanded) {
      // Si ya está expandido con comprobación, colapsarlo
      node.setExpanded(false);

      // Restaurar alturas de todas las filas
      api.forEachNode((otherNode: any) => {
        otherNode.setRowHeight(undefined);
      });
      api.onRowHeightChanged();
    } else {
      // Colapsar cualquier otra fila expandida
      api.forEachNode((otherNode: any) => {
        if (otherNode.expanded && otherNode.id !== node.id) {
          otherNode.setExpanded(false);
        }
      });

      // Ocultar todas las demás filas
      api.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id) {
          otherNode.setRowHeight(0);
        }
      });

      // Si la fila está expandida con otro tipo de detalle, cerrarla
      if (node.expanded && node.data.detailType !== 'comprobacion') {
        node.setExpanded(false);
      }

      // Cambiar el tipo de detalle a 'comprobacion'
      node.data.detailType = 'comprobacion';

      // Aplicar cambios de altura
      api.onRowHeightChanged();

      // Expandir con la comprobación
      setTimeout(() => {
        node.setExpanded(true);
      }, 0);
    }
  }

  // ==================== MÉTODOS PARA CONCEPTOS ====================

  loadConceptCounts() {
    // Cargar el conteo de conceptos para cada egreso
    this.incomes.forEach(income => {
      this.incomesAndExpensesService.getConceptsFromIncomesAndExpenses(income.id).subscribe({
        next: (concepts: any[]) => {
          this.updateExpenditureConceptCount(income.id, concepts.length);
        },
        error: (error) => {
          console.error('Error loading concept count for expenditure:', income.id, error);
        }
      });
    });
  }

  updateExpenditureConceptCount(expenditureId: number, count: number) {
    if (this.gridApi) {
      this.gridApi.forEachNode((node) => {
        if (node.data && node.data.id === expenditureId) {
          node.data.countrow = count;
          this.gridApi.refreshCells({
            rowNodes: [node],
            columns: ['countrow'],
            force: true
          });
        }
      });
    }
  }

  loadConceptsData(expenditureId: number, successCallback: any) {
    this.incomesAndExpensesService.getConceptsFromIncomesAndExpenses(expenditureId).subscribe({
      next: (data: any) => {
        successCallback(data);
      },
      error: (error) => {
        console.error('Error loading concepts:', error);
        successCallback([]);
      }
    });
  }

  async saveConceptsById(expenditureId: number, data: any) {
    const conceptsData = data.concepts || data;
    const subtotal = data.subtotal || 0;
    const tax = data.tax || 0;
    const total = data.total || 0;

    const newConcepts = conceptsData.filter((row: any) => row.__isNew);
    const modifiedConcepts = conceptsData.filter((row: any) => row.__modified && !row.__isNew);

    try {
      // Guardar conceptos nuevos
      for (const concept of newConcepts) {
        const cleaned = this.cleanConceptData(concept);
        await lastValueFrom(this.incomesAndExpensesService.addConceptFromIncomesAndExpenses(cleaned));
      }

      // Actualizar conceptos modificados
      for (const concept of modifiedConcepts) {
        const cleaned = this.cleanConceptData(concept);
        await lastValueFrom(this.incomesAndExpensesService.updateConceptFromIncomesAndExpenses(concept.id, cleaned));
      }

      // Actualizar el documento principal con los totales
      const mainDocumentResponse: any[] = await lastValueFrom(
        this.incomesAndExpensesService.getIncomeAndExpenseById(expenditureId)
      );

      const mainDocument = mainDocumentResponse[0];
      const updatedDocument = {
        ...mainDocument,
        subtotal: subtotal,
        tax: tax,
        total: total
      };

      await lastValueFrom(
        this.incomesAndExpensesService.updateIncomesAndExpenses(expenditureId, updatedDocument)
      );

      if (newConcepts.length > 0 || modifiedConcepts.length > 0) {
        alerts.basicAlert(
          'Conceptos guardados',
          'Se han guardado los conceptos correctamente.',
          'success'
        );

        // Actualizar el contador de conceptos
        this.updateExpenditureConceptCount(expenditureId, conceptsData.length);

        // Refrescar la lista de egresos para mostrar totales actualizados
        setTimeout(() => this.getExpenditure(), 500);
      }

    } catch (error) {
      console.error('Error saving concepts:', error);
      alerts.basicAlert(
        'Error',
        'Error al guardar los conceptos.',
        'error'
      );
    }
  }

  async deleteConceptRow(params: any, successCallback: () => void) {
    const conceptId = params.data.id;

    if (params.data.__isNew) {
      params.api.applyTransaction({ remove: [params.data] });
      successCallback();
    } else {
      try {
        await lastValueFrom(this.incomesAndExpensesService.deleteConceptFromIncomesAndExpenses(conceptId));
        alerts.basicAlert('Concepto eliminado', 'El concepto se eliminó correctamente.', 'success');
        successCallback();
      } catch (error) {
        console.error('Error deleting concept:', error);
        alerts.basicAlert(
          'Error',
          'Error al eliminar el concepto.',
          'error'
        );
      }
    }
  }

  private cleanConceptData(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  // ==================== MÉTODOS PARA DOCUMENTOS COMPROBADOS ====================

  loadDocumentosComprobadosCount() {
    // Cargar el conteo de documentos comprobados para cada egreso
    this.incomes.forEach(income => {
      this.administrationService.getDocumentComprobados(income.id).subscribe({
        next: (documentos: any[]) => {
          this.updateExpenditureDocumentosCount(income.id, documentos.length);
        },
        error: (error) => {
          console.error('Error loading document count for expenditure:', income.id, error);
        }
      });
    });
  }

  updateExpenditureDocumentosCount(expenditureId: number, count: number) {
    if (this.gridApi) {
      this.gridApi.forEachNode((node) => {
        if (node.data && node.data.id === expenditureId) {
          node.data.countDocumentos = count;
          this.gridApi.refreshCells({
            rowNodes: [node],
            columns: ['countDocumentos'],
            force: true
          });
        }
      });
    }
  }

  loadDocumentosComprobados(expenditureId: number, successCallback: any) {
    this.administrationService.getDocumentComprobados(expenditureId).subscribe({
      next: (data: any) => {
        successCallback(data);
      },
      error: (error) => {
        console.error('Error loading documentos comprobados:', error);
        successCallback([]);
      }
    });
  }

  async saveDocumentosComprobados(expenditureId: number, data: any) {
    const documentosData = data.documentos || data;

    const newDocumentos = documentosData.filter((row: any) => row.__isNew);
    const modifiedDocumentos = documentosData.filter((row: any) => row.__modified && !row.__isNew);

    try {
      // Guardar documentos nuevos
      for (const documento of newDocumentos) {
        const cleaned = this.cleanDocumentoData(documento);
        cleaned.idincorexp = expenditureId;
        await lastValueFrom(this.administrationService.addDocumentComprobados(cleaned));
      }

      // Actualizar documentos modificados
      for (const documento of modifiedDocumentos) {
        const cleaned = this.cleanDocumentoData(documento);
        await lastValueFrom(this.administrationService.updateDocumentComprobados(documento.id, cleaned));
      }

      if (newDocumentos.length > 0 || modifiedDocumentos.length > 0) {
        alerts.basicAlert(
          'Documentos guardados',
          'Se han guardado los documentos correctamente.',
          'success'
        );
      }

    } catch (error) {
      console.error('Error saving documentos:', error);
      alerts.basicAlert(
        'Error',
        'Error al guardar los documentos.',
        'error'
      );
    }
  }

  async deleteDocumentoComprobado(params: any, successCallback: () => void) {
    const documentoId = params.data.id;

    if (params.data.__isNew) {
      params.api.applyTransaction({ remove: [params.data] });
      successCallback();
    } else {
      try {
        await lastValueFrom(this.administrationService.deleteDocumentComprobado(documentoId));
        alerts.basicAlert('Documento eliminado', 'El documento se eliminó correctamente.', 'success');
        successCallback();
      } catch (error) {
        console.error('Error deleting documento:', error);
        alerts.basicAlert(
          'Error',
          'Error al eliminar el documento.',
          'error'
        );
      }
    }
  }

  private cleanDocumentoData(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    // Asegurar que modifiedBy sea string vacío en lugar de null
    if (cleanedData.modifiedBy === null || cleanedData.modifiedBy === undefined) {
      cleanedData.modifiedBy = '';
    }
    return cleanedData;
  }

}
