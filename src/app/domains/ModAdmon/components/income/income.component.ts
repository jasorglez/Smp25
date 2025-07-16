import { Component, effect, inject } from '@angular/core';
import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { ModalService } from 'app/services/modal.service';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { FormsModule, NgSelectOption } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom, concat, toArray, catchError, EMPTY, forkJoin, tap, map } from 'rxjs';
import { AdministrationService } from 'app/services/administration.service';
import { SearchableSelectComponent } from 'app/shared/searchable-select/searchable-select.component';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { UsersService } from 'app/services/users.service';
import { SignalsService } from 'app/services/signals.service';
import { NgSelectComponent, NgSelectModule } from '@ng-select/ng-select';
import { AdditionalInfoComponent } from "./additional-info/additional-info.component";
import { ConceptsincomeComponent } from './conceptsincome/conceptsincome.component';
import { CustomersService } from 'app/services/customers.service';
import { BranchsService } from 'app/services/branchs.service';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-income',
  standalone: true,
  imports: [NgSelectModule, NgSelectComponent, AgGridModule, MultiLineEditorComponent, CommonModule, 
             FormsModule, AdditionalInfoComponent, ConceptsincomeComponent],
  templateUrl: './income.component.html',
  styleUrl: './income.component.scss'
})
export class IncomeComponent {
  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  private modalServiceTable = inject(ModalService);
  private administrationService = inject(AdministrationService);
  private customersService = inject(CustomersService);
  private usersxpermissionsService = inject(UsersxpermissionsService);
  private usersService = inject(UsersService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private BranchsService = inject(BranchsService)
  

  ngOnInit() {       
   
  }

  constructor() {
     this.onSelectedRow = this.onSelectedRow.bind(this);
     this.onSelectionChanged = this.onSelectionChanged.bind(this);

     this.onCellValueChanged = this.onCellValueChanged.bind(this);
     this.onGridReady = this.onGridReady.bind(this);

    effect(async () => {
      this.root = this.signalsService.getRootSelectedBySidebar()();
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.idAccount = null;

      await this.getBillingManagementInfo();
      await this.getBankAccounts();
      await this.getIncomes();
    
      await this.getCustomers();   // Obtener clientes después de sucursales
      await this.loadAuthorizers();
      await this.getCurrentUser();

    }, { allowSignalWrites: true });
    effect(() => {
      const shouldUpdate = this.signalsService.getupdateIncAndExp()();
      if (shouldUpdate) {
        this.revert();
        setTimeout(() => this.signalsService.resetSignalIncAndExp());
      }
    }, { allowSignalWrites: true }); // Add this option);
    
  };

  // NUEVA PROPIEDAD: Para controlar qué pestaña está visible,  'concepts' será la pestaña por defecto al inicio.
  public activeTab: string = 'concepts';

  showform : string = '';
  branches: number[] = [];
  incomes: any[] = [];
  customers: any[] = [];
  users: any[] = [];
  id: number;
  notSavedChanges: boolean = false;
  newlyAddedRows: string[] = [];
  selectedIncomes: any = null;
  currentUser: string;
  root: number;
  idBranch: number;
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
        this.trackingService.addLog(
          this.trackingService.getnameComp(), `Selección de cuenta bancaria: ${accountDetails}`, 'Menu Administracion Ingresos - Selección Cuenta',
          this.trackingService.getEmail()
        );
      }
    }

      this.signalsService.setIdIncomeAndExpense(null);
      this.getIncomes(); // Ejecutar getIncomes cuando cambia el valor
  }
}


  get idAccount(): number {
    return this._idAccount;
  }


  // NUEVO MÉTODO: Para cambiar la pestaña activa al hacer clic.
  public setActiveTab(tab: string): void {
    this.activeTab = tab;
  }
  
  async getBillingManagementInfo() {
    this.administrationService.getBillingManagementInfo(this.root).subscribe(
      (data: any) => {
        this.prefixAndConsecutive = Array.isArray(data) ? data : [data];
      },
      (error) => {
        console.error('Error al obtener la información de gestión de facturación:', error);
      }
    );
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

  async getIncomes() {
    this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Ingresos`, 'Menu Administracion Ingresos',
          this.trackingService.getEmail() );
          
    this.incomesAndExpensesService.getIncomesAndExpenses(this.root).subscribe({
      next: (incomes) => {
        // Filtrado y manejo de caso sin datos
        const filtered = incomes?.filter(income => {
          return income.type === "DEPOSITO" && income.idAccount === this.idAccount
        }) || [];
        this.incomes = filtered;
      },
      error: (err) => {
        // Manejo de errores HTTP
        console.error('Error obteniendo ingresos. Código:', err.status, 'Detalles:', err);
        this.incomes = [];
      }
    });
  }


  async getCustomers() {
    this.customersService.getCustomersByCompany(this.root, 'CUSTOMERS').subscribe(
      (data: any) => {
        this.customers = data;
      },
      error => {
        console.error(error);
      }
    )
      this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Clientes`, 'Menu Administracion Ingresos',
           this.trackingService.getEmail() );
  }

  // Nuevo método para cargar usuarios autorizadores
  private async loadAuthorizers() {
    forkJoin({
      permissions: this.usersxpermissionsService.getDataUsersxPermissions('root'),
      allUsers: this.usersService.getDataUsers(this.root)
    }).subscribe({
      next: ({ permissions, allUsers }) => {
        // Manejo seguro de las respuestas
        const validPermissions = Array.isArray(permissions) ? permissions : [];
        const validUsers = Array.isArray(allUsers?.data) ? allUsers.data : [];

        const authorizedUserIds = [
          ...new Set(
            validPermissions
              .filter((p: { idPermission: number }) => p.idPermission === this.root)
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
      { field: 'numberDocument', headerName: '# Documento', editable: false, filter: true, width: 130 },
      {
        field: 'description', headerName: 'Descripción', editable: true, width: 315, filter: true,
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
        field: 'dateStamped', headerName: 'Entrega', editable: true, cellDataType: 'date', width: 130,
        valueFormatter: (params) => this.formatDate(params.value)
      },

      {
        field: 'date', headerName: 'Pago', editable: true, cellDataType: 'date', width: 100,
        valueFormatter: (params) => this.formatDate(params.value)
      },

      {
        field: 'idCustomer', headerName: 'Cliente', editable: true, width: 160,
        cellEditor: 'searchableSelect',
        cellEditorParams: {
          options: this.customers,
        },
        valueFormatter: (params) => {
          const foundItem = this.customers
            ? this.customers.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.description}` : params.value;
        },
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
        width: 100,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
      {
        field: 'total',
        headerName: 'Total',
        type: 'number',
        editable: false,
        width: 120,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },

      {
        field: 'paymentMonth', headerName: 'Mes', editable: true, width: 100,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
          ]
        }
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
      },
  
      {
        field: 'idExpend',
        headerName: 'Autoriza',
        editable: true,
        width: 105,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.users.map(user => user.id)
        },
        valueFormatter: (params) => {
          const foundUser = this.users
            ? this.users.find((user) => user.id === params.value)
            : null;
          return foundUser ? `${foundUser.smallName}` : params.value;
        },
      },

    ]
  };

  onSelectedRow(event: any) {
    this.id = event.data.id;
      console.log('Setting idIncomeAndExpense to:', this.id); // Debug log
    this.signalsService.setIdIncomeAndExpense(this.id);
  }

// MODIFICAMOS onSelectionChanged
  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedIncomes = selectedNodes[0].data;
      this.signalsService.setIdIncomeAndExpense(this.selectedIncomes.id);
      
      // Cada vez que seleccionamos una nueva fila, volvemos a la pestaña por defecto.
      this.setActiveTab('concepts'); 

    } else {
       this.selectedIncomes = null;
       this.signalsService.setIdIncomeAndExpense(null);
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

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idAccount      : this._idAccount,
      numberDocument : "",
      idBusinnes     : this.root,
      idBranch       : this.idBranch, // Asignar la primera sucursal por defecto
      date           : new Date().toISOString(),
      idCustomer     : 0,
      idExpend       : 0,
      uuid           : "NA",
      paymentMonth   : '',
      dateStamped: null,
      description: "",
      type: "DEPOSITO",
      subtotal: 0,
      tax: 0,
      total: 0,
      createdBy: this.currentUser || 'Usuario temporal',
      createdAt: new Date().toISOString(),
      modifiedBy: null,
      modifiedAt: new Date().toISOString(),
      status: "Pendiente",
      active: true,
      __isNew: true,
    };
    this.incomes = [newItem, ...this.incomes];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;

    this.trackingService.addLog(this.trackingService.getnameComp(),'Ingreso en Administracion', 'Menu Administracion Ingresos',  this.trackingService.getEmail());

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
    
    const isValid = this.incomes.every((item) =>   item.description );
  
    console.log('Guardando cambios...', isValid);

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
      this.trackingService.addLog(this.trackingService.getnameComp(),'Save Registro en Ingresos', 'Menu Administracion Ingresos',  this.trackingService.getEmail());
      return this.incomesAndExpensesService.addIncomesAndExpenses(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      this.trackingService.addLog(this.trackingService.getnameComp(),'Update Registro en Ingresos', 'Menu Administracion Ingresos',  this.trackingService.getEmail());
      return this.incomesAndExpensesService.updateIncomesAndExpenses(row.id, cleanedData);
    });

    // Crear objeto sin array
    const updatedBillingInfo = {
      ...this.prefixAndConsecutive[0],
      consecutive: currentConsecutive
    };

    const updateConsecutiveObs = this.administrationService.updateBillingManagementInfo(
      this.root,
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
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      await this.getIncomes(); // Refrescar los datos
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
          this.getIncomes();

          alerts.basicAlert(
            'Eliminar entrada',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );
          this.trackingService.addLog(this.trackingService.getnameComp(),'Delete Registro Ingresos', 'Menu Administracion Ingresos',  this.trackingService.getEmail());
          this.notSavedChanges = false;
          this.selectedIncomes = null;
        }
      );
  }

  revert() {
    this.getIncomes();
    this.notSavedChanges = false;
    console.log('Reverted unsaved changes', this.trackingService.getnameComp());
    console.log('Reverted Email:  ', this.trackingService.getEmail());

    this.trackingService.addLog(this.trackingService.getnameComp(),'Cancelar Salvar Registro Ingresos', 'Menu Administracion Ingresos',  this.trackingService.getEmail());    
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
    this.administrationService.getAccountBanks(this.root).subscribe(
      (data: any) => {
        this.bankAccounts = data;
      },
      error => {
        console.error(error);
        this.bankAccounts = []; // Vaciamos el array en caso de error
      }
    )
  }

}

