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
import { ConceptsexpenditureComponent } from './conceptsexpenditure/conceptsexpenditure.component';
import { CatalogadmonService } from 'app/services/catalogadmon.service';
import { BranchsService } from 'app/services/branchs.service';
import { environment } from '@env/environment';
import { AuthService } from 'app/services/auth.service';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-expenditure',
  standalone: true,
  imports: [NgSelectModule, NgSelectComponent, AgGridModule, MultiLineEditorComponent, CommonModule,
    FormsModule,  ConceptsexpenditureComponent],
  templateUrl: './expenditure.component.html',
  styleUrl: './expenditure.component.scss'
})
export class ExpenditureComponent {

  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  private modalServiceTable         = inject(ModalService);
  private administrationService     = inject(AdministrationService);
  private cataalogAdmonService      = inject(CatalogadmonService);
  private usersxpermissionsService  = inject(UsersxpermissionsService);
  private usersService              = inject(UsersService);
  private signalsService            = inject(SignalsService);
  private branchesService           = inject(BranchsService)
  private authService               = inject(AuthService);
  public trackingService = inject(TrackingService);

  public isIncomeMode: boolean = false;      

  async ngOnInit() {
    
}

constructor() {
//  console.log('🏗️ ExpenditureComponent: Constructor iniciado');
  
  // Effect para cambios de Root/Branch (sin cambios)
  effect(async () => {
    console.log('🔄 Effect Root/Branch ejecutado');
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
    console.log('✅ Effect Root/Branch completado');
  });
  
  // ✅ CORRECCIÓN: Effect mejorado para escuchar actualizaciones del detalle
  effect(() => {
    console.log('👂 Effect MasterUpdate ejecutado');
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
  
  console.log('✅ ExpenditureComponent: Constructor completado');
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
                                    'Egresos - Selección Cuenta', this.trackingService.getEmail());        
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
        this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Sucursales`, 'Egresos ',
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
    this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Cuentas Bancarias`, 'Egresos ',
          this.trackingService.getEmail() );
  }

  private gridApi: GridApi;
  private tempIdCounter: number = 0;

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
        this.incomes = filtered;
      },
      error: (err) => {
        // Manejo de errores HTTP
        console.error('Error obteniendo ingresos. Código:', err.status, 'Detalles:', err);
        this.incomes = [];
      }
    });
    this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Egresos`, 'Egresos ',
          this.trackingService.getEmail() );
  }

  async getBills() {
    this.cataalogAdmonService.getCatalogs(this.idRoot, 'BILL').subscribe(
      (data: any) => {
        this.expenses = data;
      },
      error => {
        console.error(error);
      }
    )
    this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Gastos`, 'Egresos ',
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
      { field: 'id', headerName: 'Id', editable: true, filter: true, width: 50 },
      { field: 'numberDocument', headerName: '# Documento', editable: true, filter: true, width: 150 },
      
      {
              field: 'idBranch',
              headerName: 'Nombre sucursal',
              headerClass: 'required-header',
              hide:
                this.authService.hasDetailedPermission(
                  'principal',
                  'see-all-branches'
                ) || this.signalsService.getemailChoose() === environment.root
                  ? false
                  : true,
              editable: true,
              filter: true,
              width: 170,
              cellEditor: 'agSelectCellEditor',
              filterParams: {
                // can be 'windows' or 'mac'
                defaultToNothingSelected: true,
                //excelMode: 'windows',
              },
      
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
              field: 'date', headerName: 'Fecha', editable: true, cellDataType: 'date', width: 125,
              valueFormatter: (params) => this.formatDate(params.value)
            },

            {
                field: 'idExpend', headerName: 'Tipo Gasto', editable: true, width: 195,
                cellEditor: 'searchableSelect',
                cellEditorParams: {
                  options: this.expenses,
                },
                valueFormatter: (params) => {
                  const foundItem = this.expenses
                    ? this.expenses.find((item) => item.id === params.value)
                    : null;
                  return foundItem ? `${foundItem.description}` : params.value;
                },
            },

            {
              field: 'description', headerName: 'Descripción', editable: true, width: 325, filter: true,
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
        field: 'status',
        headerName: 'Estatus',
        editable: true,
        width: 105,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: [
            'Pendiente',
            'Entregada',
            'Cancelada',
            'Pagada'
          ]
        }
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
  console.log('🏁 Grid ready');
  this.gridApi = params.api;
  
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
      this.trackingService.addLog(this.trackingService.getnameComp(), `Creacion de un Egresos`, 'Egresos ',
          this.trackingService.getEmail() );

    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idAccount: this._idAccount,
      numberDocument: "",
      idBusinnes: this.idRoot,
      idBranch: this.idBranch > 0 ? this.idBranch : null,
      date: new Date().toISOString(),
      idCustomer: 0,
      idExpend: 0,
      uuid: "NA",
      paymentMonth: '',
      dateStamped: null,
      description: "POR COMPROBAR",
      type: "GASTO",
      subtotal: 0,
      tax: 0,
      total: 0,
      createdBy: this.currentUser || 'Usuario temporal',
      createdAt: new Date().toISOString(),
      modifiedBy: null,
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

    // Validar que el array tenga elementos
    if (!this.prefixAndConsecutive?.[0]) {
      alerts.basicAlert(
        'Error de configuración',
        'La configuración de prefijo/consecutivo no está cargada correctamente',
        'error'
      );
      return;
    }

    const newRows = this.incomes.filter((row) => row.__isNew);
    const modifiedRows = this.incomes.filter(
      (row) => row.__modified && !row.__isNew
    );

    // Generar números de documento para nuevas filas
    let currentConsecutive = this.prefixAndConsecutive[0].consecutive;
    newRows.forEach(row => {
      currentConsecutive++;
      row.numberDocument = `${this.prefixAndConsecutive[0].prefix}${currentConsecutive.toString().padStart(4, '0')}`;
    });

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log(cleanedData)
      return this.incomesAndExpensesService.addIncomesAndExpenses(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log(cleanedData)
      return this.incomesAndExpensesService.updateIncomesAndExpenses(row.id, cleanedData);
    });

    // Crear objeto sin array
    const updatedBillingInfo = {
      ...this.prefixAndConsecutive[0],
      consecutive: currentConsecutive
    };

    const updateConsecutiveObs = this.administrationService.updateBillingManagementInfo(
      this.idRoot,
      updatedBillingInfo // Enviar objeto directamente
    ).pipe(
      tap(response => {
        // Actualizar el array local con el nuevo objeto
        this.prefixAndConsecutive = [updatedBillingInfo];
      })
    );

    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables, updateConsecutiveObs).pipe(toArray())
      );

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      
      this.trackingService.addLog(this.trackingService.getnameComp(), `Salvar Egresos`, 'Egresos ',
          this.trackingService.getEmail() );

      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      await this.getExpenditure(); // Refrescar los datos
    } catch (error) {
      console.error(error);
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


}

