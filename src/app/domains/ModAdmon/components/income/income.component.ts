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
import { CustomersService } from 'app/services/customers.service';
import { BranchsService } from 'app/services/branchs.service';
import { TrackingService } from 'app/services/tracking.service';
import { FacturacionService } from 'app/services/facturacion.service';
import { AuthService } from 'app/services/auth.service';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { ButtonCellRendererIncomeComponent } from './button-cell-renderer-income.component';
import { PdfButtonCellRendererIncomeComponent } from './pdf-button-cell-renderer-income.component';
import { DetalleIngresosComponent } from './detalle-ingresos.component';
import { CatalogsService } from 'app/services/catalogs.service';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { ProjectsService } from 'app/services/projects.service';

@Component({
  selector: 'app-income',
  standalone: true,
  imports: [NgSelectModule, NgSelectComponent, AgGridModule, MultiLineEditorComponent, CommonModule,
             FormsModule, SelectWithTooltipEditorV2Component, ButtonCellRendererIncomeComponent,
             PdfButtonCellRendererIncomeComponent, DetalleIngresosComponent],
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
  public signalsService = inject(SignalsService);
  public trackingService = inject(TrackingService);
  private BranchsService = inject(BranchsService);
  private facturacionService = inject(FacturacionService);
  private catalogsService = inject(CatalogsService);
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);
  private projectsService = inject(ProjectsService);
  authService = inject(AuthService);

  private isGeneratingReport: boolean = false;

  // Propiedades para el modal de reporte de ingresos
  showIngresoReportModal: boolean = false;
  reportStartDate: string = '';
  reportEndDate: string = '';
  isGeneratingIngresoReport: boolean = false;
  reportIngresoType: string = 'listado'; // 'listado' | 'saldos'


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
      await this.loadSATCatalogs();  // Cargar catálogos SAT
      await this.loadProjects();     // Cargar proyectos
      await this.loadBranches();     // Cargar sucursales para modal de cliente
      await this.loadCustomerTypes(); // Cargar tipos de cliente

    }, { allowSignalWrites: true });
    effect(() => {
      const shouldUpdate = this.signalsService.getupdateIncAndExp()();
      if (shouldUpdate) {
        this.revert();
        setTimeout(() => this.signalsService.resetSignalIncAndExp());
      }
    }, { allowSignalWrites: true }); // Add this option);

  };


  hasConsecutiveError: boolean = false;

  showform : string = '';
  branches: any[] = [];
  incomes: any[] = [];
  customers: any[] = [];

  // Modal de nuevo cliente
  showCustomerModal: boolean = false;
  customerTypes: any[] = [];
  newCustomer: any = {
    idBranch: null,
    nameContact: '',
    company: '',
    idTypecop: null
  };
  private isRevertingCustomer: boolean = false; // Flag para evitar recursión
  private currentEditingNode: any = null; // Nodo de la fila que se está editando
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

  // Catálogos SAT para facturación electrónica
  formasPago: any[] = [];
  metodosPago: any[] = [];

  // Proyectos
  projects: any[] = [];

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
    headerHeight: 24,
    rowHeight: 24,
    animateRows: true,
    masterDetail: true,
    detailRowHeight: 600,
    isRowMaster: (dataItem: any) => true,
    detailCellRenderer: DetalleIngresosComponent,
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
      // Seleccionar la fila al hacer clic en cualquier celda, excepto en las columnas de cascada
      const colId = event.column.getColId();
      if (colId !== 'pdfReport' && colId !== 'countItems') {
        event.node.setSelected(true);
      }
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

        // Agregar propiedades para master-detail
        this.incomes = filtered.map(income => ({
          ...income,
          countItems: income.countItems || 0,
          detailType: null,
          detailData: []
        }));

      },
      error: (err) => {
        // Manejo de errores HTTP
        console.error('Error obteniendo ingresos. Código:', err.status, 'Detalles:', err);
        this.incomes = [];
      }
    });
  }


  async getCustomers() {
    // Obtener todos los clientes de la compañía
    this.customersService.getCustomersByCompany(this.root, 'CUSTOMERS').subscribe(
      (data: any) => {
        // Mapear para formato consistente y ordenar por id descendente (más recientes primero)
        this.customers = data
          .map((item: any) => ({
            id: item.id,
            description: item.company || item.nameContact || item.name,
            name: item.company || item.nameContact || item.name,
            rfc: item.rfc,
            cp: item.cp,
            fiscalRegime: item.fiscalRegime,
            usoCfdi: item.usoCfdi,
            email: item.email
          }))
          .sort((a: any, b: any) => b.id - a.id); // Ordenar por id descendente
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
      next: (user) => {
        if (user?.usersmall) {
          this.currentUser = user.usersmall;
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

  // Cargar catálogos SAT para facturación electrónica
  async loadSATCatalogs() {
    forkJoin({
      formasPago: this.facturacionService.getFormaPago2fields(),
      metodosPago: this.facturacionService.getMetodoPago2fields()
    }).subscribe({
      next: (data: any) => {
        this.formasPago = data.formasPago || [];
        this.metodosPago = data.metodosPago || [];
      },
      error: (err) => console.error('Error cargando catálogos SAT:', err)
    });
  }

  // Cargar proyectos de la compañía
  async loadProjects() {
    this.projectsService.getProjectListByCompany(this.root).subscribe({
      next: (data: any) => {
        this.projects = (data || []).map((p: any) => ({
          id: p.id,
          name: p.name || p.number || 'Sin nombre'
        }));
      },
      error: (err) => {
        console.error('Error cargando proyectos:', err);
        this.projects = [];
      }
    });
  }

  // Cargar sucursales para el modal de nuevo cliente
  async loadBranches() {
    this.BranchsService.getBranches(this.root).subscribe({
      next: (data: any) => {
        this.branches = (data || []).map((b: any) => ({
          id: b.id,
          name: b.name || b.description || 'Sin nombre'
        }));
      },
      error: (err) => {
        console.error('Error cargando sucursales:', err);
        this.branches = [];
      }
    });
  }

  // Cargar tipos de cliente para el modal
  async loadCustomerTypes() {
    this.catalogsService.getCatalogsFromAdmon(this.root, 'TIPO-CLIENTE').subscribe({
      next: (data: any) => {
        this.customerTypes = (data || []).map((t: any) => ({
          id: t.id,
          description: t.description || t.name || 'Sin descripción'
        }));
      },
      error: (err) => {
        console.error('Error cargando tipos de cliente:', err);
        // Intentar catálogo alternativo
        this.catalogsService.getCatalogsVigente(this.root, 'CUSTOMERS').subscribe({
          next: (data2: any) => {
            this.customerTypes = (data2 || []).map((t: any) => ({
              id: t.id,
              description: t.description || t.name || 'Sin descripción'
            }));
          },
          error: () => {
            this.customerTypes = [];
          }
        });
      }
    });
  }

  // Column Definitions: Defines the columns to be displayed.
  private _colMaster: ColDef[] | null = null;
  get colMaster(): ColDef[] {
    if (this._colMaster) return this._colMaster;
    this._colMaster = [
      {
        field: 'countItems',
        headerName: 'Items',
        width: 90,
        cellRenderer: ButtonCellRendererIncomeComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleCascade(node),
        },
        valueGetter: params => params.data.countItems || 0,
        editable: false,
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer', textDecoration: 'underline' }
      },
      {
        field: 'pdfReport',
        headerName: 'PDF',
        width: 80,
        cellRenderer: PdfButtonCellRendererIncomeComponent,
        cellRendererParams: {
          onClick: (node: any) => {
            this.toggleReportDetail(node, 'report');
          },
          icon: 'bi-file-earmark-pdf',
          iconColor: '#dc3545',
          title: 'Hacer clic para generar el recibo PDF'
        },
        editable: false,
        cellStyle: { backgroundColor: '#fff3e0', textAlign: 'center' }
      },

       {
        field: 'idCustomer', headerName: 'Cliente', editable: true, width: 160,
        cellEditor: SelectWithTooltipEditorV2Component,
        cellEditorParams: () => ({
          options: [
            ...this.customers.map(obj => ({
              id: obj.id,
              description: obj.description,
              valueAddition: obj.id || '',
              valueAddition2: obj.description || ''
            })),
            // Opción especial para agregar nuevo cliente
            {
              id: 'NEW_CUSTOMER',
              description: '➕ Nuevo Registro',
              valueAddition: 'Agregar nuevo cliente',
              valueAddition2: 'Clic para crear'
            }
          ],
          // Valores especiales que disparan callback
          specialValues: ['NEW_CUSTOMER'],
          // Callback cuando se selecciona un valor especial
          onSpecialValue: (value: string, params: any) => {
            if (value === 'NEW_CUSTOMER') {
              // Guardar referencia al nodo actual para asignar el cliente después
              this.currentEditingNode = params.node;
              this.openCustomerModal();
            }
          }
        }),
        valueFormatter: (params) => {
          if (params.value === 'NEW_CUSTOMER') return '';
          const foundItem = this.customers
            ? this.customers.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.description}` : params.value;
        },
      },

      {
        field: 'idProject',
        headerName: 'Proyecto',
        editable: true,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: this.projects.map(p => p.id)
        }),
        valueFormatter: (params) => {
          if (!params.value) return '';
          const foundProject = this.projects.find(p => p.id === params.value);
          return foundProject ? foundProject.name : params.value;
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
        field: 'idBranch',
        headerName: 'Sucursal',
        editable: true,
        width: 140,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: this.branches.map(b => b.id)
        }),
        valueFormatter: (params) => {
          if (!params.value) return '';
          const foundBranch = this.branches.find(b => b.id === params.value);
          return foundBranch ? foundBranch.name : params.value;
        }
      },

      { field: 'numberDocument', headerName: '# Docto', editable: false, filter: true, width: 130 },
      {
        field: 'description', headerName: 'Descripción', editable: true, width: 315, filter: true, hide: true,
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
        field: 'dateStamped', headerName: 'Fecha Factura', editable: true, cellDataType: 'date', width: 130,
        valueFormatter: (params) => this.formatDate(params.value)
      },

      {
        field: 'date', headerName: 'Fecha Pago', editable: true, cellDataType: 'date', width: 130,
        valueFormatter: (params) => this.formatDate(params.value)
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
        editable: false,filter: true,
        width: 120,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },

           {
        field: 'paymentMonth',
        headerName: 'Mes',
        editable: true,
        width: 110,
        filter: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
        }
      },

      { field: 'oc', headerName: 'OC', editable: true, width: 100, filter: true },

      {
        field: 'formaPago',
        headerName: 'Forma Pago',
        editable: true,
        hide: true,
        width: 250,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: this.formasPago.map(fp => fp.formaPagoValue)
        }),
        valueFormatter: (params) => {
          if (!params.value) return '';
          const found = this.formasPago.find(fp => fp.formaPagoValue === params.value);
          return found ? `${found.formaPagoValue} - ${found.descripcion}` : params.value;
        }
      },

      {
        field: 'metodoPago',
        headerName: 'Método Pago',
        editable: true,
        hide: true,
        width: 280,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: this.metodosPago.map(mp => mp.metodoPagoValue)
        }),
        valueFormatter: (params) => {
          if (!params.value) return '';
          const found = this.metodosPago.find(mp => mp.metodoPagoValue === params.value);
          return found ? `${found.metodoPagoValue} - ${found.descripcion}` : params.value;
        }
      },

      {
        field: 'uuid',
        headerName: 'Num Factura/UUID',
        editable: true,
        width: 180,
        filter: true,
        cellEditor: 'agTextCellEditor',
        cellEditorParams: {
          maxLength: 36
        },
        valueFormatter: (params) => {
          if (!params.value || params.value === 'NA') return 'Sin Timbrar';
          return params.value.substring(0, 15) + '...';
        },
        cellStyle: (params) => {
          if (params.value && params.value !== 'NA') {
            return { backgroundColor: '#d4edda', color: '#155724' }; // Verde si está timbrado
          }
          return { backgroundColor: '#fff3cd', color: '#856404' }; // Amarillo si no está timbrado
        }
      },


      {
        field: 'idExpend',
        headerName: 'Autoriza',
        editable: true,
        width: 105,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: this.users.map(user => user.id)
        }),
        valueFormatter: (params) => {
          const foundUser = this.users
            ? this.users.find((user) => user.id === params.value)
            : null;
          return foundUser ? `${foundUser.smallName}` : params.value;
        },
      },

    ];
    return this._colMaster;
  }

  onSelectedRow(event: any) {
    this.id = event.data.id;
    this.signalsService.setIdIncomeAndExpense(this.id);
  }

onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedIncomes = selectedNodes[0].data;
      this.signalsService.setIdIncomeAndExpense(this.selectedIncomes.id);
    } else {
       this.selectedIncomes = null;
       this.signalsService.setIdIncomeAndExpense(null);
    }
  }


  onCellValueChanged(event: any) {
    // Evitar recursión cuando estamos revirtiendo el valor
    if (this.isRevertingCustomer) {
      this.isRevertingCustomer = false;
      return;
    }

    // Detectar si se seleccionó "Nuevo Registro" en el campo Cliente
    if (event.column.getColId() === 'idCustomer' && event.newValue === 'NEW_CUSTOMER') {
      // Marcar que estamos revirtiendo para evitar recursión
      this.isRevertingCustomer = true;
      // Revertir al valor anterior
      event.node.setDataValue('idCustomer', event.oldValue);
      // Abrir modal de nuevo cliente
      setTimeout(() => {
        this.openCustomerModal();
      }, 100);
      return;
    }

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

    // Configurar el detailCellRendererParams para pasar datos al detail renderer
    this.gridApi.setGridOption('detailCellRendererParams', {
      getDetailRowData: (params) => {
        params.successCallback(params.data.detailData);
      },
      context: {
        idRoot: this.root,
        componentParent: this,
        gridApi: this.gridApi,
        catalogsService: this.catalogsService,
        administrationService: this.administrationService,
        rootService: this.rootService,
        base64EncodeService: this.base64EncodeService,
        CONCEPTS: {
          load: (incomeId: number, callback: (data: any[]) => void) => {
            this.loadConceptsData(incomeId, callback);
          },
          updateCount: (incomeId: number, count: number) => {
            this.updateIncomeCountItems(incomeId, count);
          }
        }
      }
    });
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idAccount      : this._idAccount,
      numberDocument : "",
      idBusinnes     : this.root,
      idBranch       : this.idBranch, // Asignar la primera sucursal por defecto
      idProject      : null,          // Proyecto
      paymentMonth   : '',            // Mes de pago
      oc             : '',            // Orden de Compra
      date           : null,
      idCustomer     : 0,
      idExpend       : 0,
      uuid           : "NA",
      dateStamped: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      description: "",
      type: "DEPOSITO",
      subtotal: 0,
      tax: 0,
      total: 0,
      // Campos de facturación electrónica
      formaPago: '01', // 01 = Efectivo (valor por defecto)
      metodoPago: 'PUE', // PUE = Pago en una sola exhibición
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
  // Campos requeridos (idProject NO es requerido - puede ir vacío)
  const requiredFields = [
    { field: 'idCustomer',   label: 'Cliente',       check: (v: any) => !!v && v !== 0 },
  ];

  for (const item of this.incomes) {
    for (const rf of requiredFields) {
      if (!rf.check(item[rf.field])) {
        alerts.basicAlert(
          'Campo requerido',
          `Falta llenar el campo: "${rf.label}"`,
          'error'
        );
        return;
      }
    }
  }

  // Validar que la cuenta bancaria tenga Máscaras y Consecutivos configurados
  const selectedAccount = this.bankAccounts.find(a => a.id === this._idAccount);
  if (selectedAccount) {
    const missingBankFields: string[] = [];
    if (!selectedAccount.maskin)   missingBankFields.push('Máscara IN (maskin)');
    if (!selectedAccount.consecin) missingBankFields.push('Consecutivo IN (consecin)');
    if (!selectedAccount.maskex)   missingBankFields.push('Máscara EX (maskex)');
    if (!selectedAccount.consecex) missingBankFields.push('Consecutivo EX (consecex)');

    if (missingBankFields.length > 0) {
      alerts.basicAlert(
        'Cuenta bancaria incompleta',
        `La cuenta "${selectedAccount.nameAccount}" no tiene configurados los siguientes campos requeridos:\n\n• ${missingBankFields.join('\n• ')}\n\nConfigúralos en Cuentas Bancarias antes de guardar.`,
        'warning'
      );
      return;
    }
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

    // Generar números de documento para nuevas filas
    currentConsecutive = this.prefixAndConsecutive[0].consecutive;
    newRows.forEach(row => {
      currentConsecutive++;
      row.numberDocument = `${this.prefixAndConsecutive[0].prefix}${currentConsecutive.toString().padStart(4, '0')}`;
    });
  }

  try {
    // PRIMERO: Guardar los registros de income (SIEMPRE)
    await this.saveIncomeRecords(newRows, modifiedRows);

    // LUEGO: Actualizar el consecutivo si hay nuevas filas (manejar error específico)
 if (newRows.length > 0) {
  try {
    await this.updateBillingManagement(currentConsecutive);
    this.hasConsecutiveError = false;
  } catch (consecutiveError) {
    // Error específico del consecutivo - mostrar alerta pero no revertir todo
    console.error('Error actualizando consecutivo:', consecutiveError);
    this.hasConsecutiveError = true;
    alerts.basicAlert(
      'Advertencia - Consecutivo',
      'Los registros se guardaron correctamente, pero hubo un problema al actualizar el consecutivo. Contacte al administrador.',
      'warning'
    );
  }
}

    // Éxito completo o parcial
    if (newRows.length === 0 || !this.hasConsecutiveError) {
      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
    }

    this.notSavedChanges = false;
    this.newlyAddedRows = [];
    await this.getIncomes(); // Refrescar los datos

  } catch (error: any) {
    console.error('Error crítico en saveChanges:', error);
    const detail = error?.error?.message
      || error?.error?.title
      || error?.message
      || JSON.stringify(error?.error || error || '');
    alerts.basicAlert(
      'Error al guardar',
      detail,
      'error'
    );
  }
}


  // Método separado para guardar los registros de income
  private async saveIncomeRecords(newRows: any[], modifiedRows: any[]): Promise<void> {
    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Save Registro en Ingresos',
        'Menu Administracion Ingresos',
        this.trackingService.getEmail()
      );
      return this.incomesAndExpensesService.addIncomesAndExpenses(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Update Registro en Ingresos',
        'Menu Administracion Ingresos',
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

// Método separado para actualizar el billing management (SOLO consecutivo)
private async updateBillingManagement(currentConsecutive: number): Promise<void> {
  // CORRECCIÓN: Envolver el consecutive en un objeto "request"
  const payload = {
    request: {
      consecutive: currentConsecutive
    }
  };

  await lastValueFrom(
    this.administrationService.updateBillingManagementConsecutive(
      this.root,
      payload
    ).pipe(
      tap((updatedBilling: any) => {
        // Actualizar el array local con la respuesta completa del servidor
        this.prefixAndConsecutive = [updatedBilling];
      }),
      catchError((error) => {
        console.error('Error actualizando consecutivo:', error);

        // Log específico para tracking
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          `Error actualizando consecutivo: ${error.message}`,
          'Menu Administracion Ingresos - Error Consecutivo',
          this.trackingService.getEmail()
        );

        throw error; // Re-lanzar el error para manejarlo en saveChanges
      })
    )
  );
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

  // ==================== METODOS PARA CASCADAS ====================

  toggleCascade(node: any) {
    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data.detailType === 'concepts';

    if (isCurrentlyExpanded) {
      // Si ya esta expandido con conceptos, colapsarlo
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

      // Ocultar todas las demas filas
      api.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id) {
          otherNode.setRowHeight(0);
        }
      });

      // Si la fila esta expandida con otro tipo de detalle, cerrarla
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

  async toggleReportDetail(node: any, reportType: 'report' | 'contribution' = 'report') {
    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data.detailType === reportType;

    if (isCurrentlyExpanded) {
      // Si ya esta expandido con el reporte, colapsarlo
      node.setExpanded(false);

      // Restaurar alturas de todas las filas
      api.forEachNode((otherNode: any) => {
        otherNode.setRowHeight(undefined);
      });
      api.onRowHeightChanged();
      return;
    }

    // Verificar si ya se esta generando un reporte
    if (this.isGeneratingReport) {
      alerts.basicAlert(
        'Procesando',
        'Ya se esta generando un reporte. Por favor espere.',
        'warning'
      );
      return;
    }

    // Marcar que se esta generando
    this.isGeneratingReport = true;

    try {
      // Colapsar cualquier otra fila expandida
      api.forEachNode((otherNode: any) => {
        if (otherNode.expanded && otherNode.id !== node.id) {
          otherNode.setExpanded(false);
        }
      });

      // Ocultar todas las demas filas
      api.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id) {
          otherNode.setRowHeight(0);
        }
      });

      // Si la fila esta expandida con otro tipo de detalle, cerrarla
      if (node.expanded && node.data.detailType !== reportType) {
        node.setExpanded(false);
      }

      // Cambiar el tipo de detalle al tipo solicitado
      node.data.detailType = reportType;

      // Aplicar cambios de altura
      api.onRowHeightChanged();

      // Expandir con el reporte
      await new Promise(resolve => setTimeout(resolve, 500));
      node.setExpanded(true);

    } finally {
      // Restablecer el flag
      setTimeout(() => {
        this.isGeneratingReport = false;
      }, 1000);
    }
  }

  loadConceptsData(incomeId: number, callback: (data: any[]) => void) {
    this.incomesAndExpensesService.getConceptsFromIncomesAndExpenses(incomeId).subscribe({
      next: (data: any) => {
        callback(data || []);
      },
      error: (err) => {
        console.error('Error loading concepts:', err);
        callback([]);
      }
    });
  }

  updateIncomeCountItems(incomeId: number, count: number) {
    // Actualizar el conteo en la fila del grid
    const rowNode = this.gridApi?.getRowNode(incomeId.toString());
    if (rowNode) {
      rowNode.setDataValue('countItems', count);
    }
  }

  collapseCurrentRow(node: any) {
    if (node) {
      node.setExpanded(false);

      // Restaurar alturas de todas las filas
      this.gridApi.forEachNode((otherNode: any) => {
        otherNode.setRowHeight(undefined);
      });
      this.gridApi.onRowHeightChanged();
    }
  }

  // ==================== METODOS PARA MODAL DE CLIENTE ====================

  openCustomerModal() {
    this.newCustomer = {
      idBranch: null,
      nameContact: '',
      company: '',
      idTypecop: null
    };
    this.showCustomerModal = true;
  }

  closeCustomerModal() {
    this.showCustomerModal = false;
    this.newCustomer = {
      idBranch: null,
      nameContact: '',
      company: '',
      idTypecop: null
    };
  }

  // ==================== METODOS PARA REPORTE DE INGRESOS ====================

  openIngresoReportModal() {
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const firstDay = new Date(previousMonth.getFullYear(), previousMonth.getMonth(), 1);
    const lastDay = new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0);
    this.reportStartDate = this.formatDateForInput(firstDay);
    this.reportEndDate = this.formatDateForInput(lastDay);
    this.showIngresoReportModal = true;
    document.body.classList.add('modal-open');
  }

  closeIngresoReportModal() {
    this.showIngresoReportModal = false;
    document.body.classList.remove('modal-open');
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatCurrencyNumber(amount: number): string {
    return (amount || 0).toLocaleString('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  async generateIngresoReport() {
    if (!this.reportStartDate || !this.reportEndDate) {
      alerts.basicAlert('Error', 'Por favor seleccione ambas fechas', 'error');
      return;
    }

    if (this.reportIngresoType === 'saldos') {
      await this.generateSaldosIngresoReport();
      return;
    }

    const [sy, sm, sd] = this.reportStartDate.split('-');
    const [ey, em, ed] = this.reportEndDate.split('-');
    const startDate = new Date(+sy, +sm - 1, +sd);
    const endDate   = new Date(+ey, +em - 1, +ed);

    if (startDate > endDate) {
      alerts.basicAlert('Error', 'La fecha de inicio no puede ser mayor que la fecha de término', 'error');
      return;
    }

    // Filtrar ingresos en el rango usando fecha de factura (dateStamped)
    const filtered = this.incomes.filter(income => {
      const raw = income.dateStamped || income.date;
      if (!raw) return false;
      const d = new Date(raw);
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return ds >= this.reportStartDate && ds <= this.reportEndDate;
    });

    if (filtered.length === 0) {
      alerts.basicAlert('Sin datos', 'No se encontraron ingresos en el rango de fechas seleccionado', 'warning');
      return;
    }

    this.isGeneratingIngresoReport = true;

    try {
      const pdfMake = (await import('pdfmake/build/pdfmake')).default;
      const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
      (pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

      // Obtener información de la empresa
      const rootResponse: any = await lastValueFrom(this.rootService.getRootbyId(this.root));
      const companyName: string = rootResponse?.name || rootResponse?.nameCompany || 'Empresa';
      const logoBase64 = rootResponse?.picture
        ? await this.base64EncodeService.convertImageToBase64(rootResponse.picture)
        : null;

      // Construir filas de la tabla
      const tableBody: any[] = [
        // Encabezado
        [
          { text: 'MES',              style: 'th', alignment: 'center' },
          { text: 'EMPRESA',          style: 'th', alignment: 'center' },
          { text: 'PROYECTO',         style: 'th', alignment: 'center' },
          { text: 'FECHA FACTURA',    style: 'th', alignment: 'center' },
          { text: 'FECHA DE PAGO',    style: 'th', alignment: 'center' },
          { text: 'FACTURA',          style: 'th', alignment: 'center' },
          { text: 'OC',               style: 'th', alignment: 'center' },
          { text: 'IMP. FACTURADO',   style: 'th', alignment: 'right'  },
          { text: 'IMP. N/DESCUENTO', style: 'th', alignment: 'right'  },
          { text: 'SUBTOTAL',         style: 'th', alignment: 'right'  },
          { text: 'IVA',              style: 'th', alignment: 'right'  },
          { text: 'TOTAL',            style: 'th', alignment: 'right'  },
          { text: 'ESTATUS',          style: 'th', alignment: 'center' },
          { text: 'ESTATUS PAGO',     style: 'th', alignment: 'center' },
          { text: 'DÍAS',             style: 'th', alignment: 'center' },
          { text: 'F. VENCIMIENTO',   style: 'th', alignment: 'center' },
          { text: 'DÍAS VENC.',       style: 'th', alignment: 'center' },
        ]
      ];

      let totalSubtotal = 0;
      let totalIva = 0;
      let totalGeneral = 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      filtered.forEach(income => {
        const project = this.projects.find(p => p.id === income.idProject);
        const invoiceDate = income.dateStamped ? new Date(income.dateStamped) : null;
        const paymentDate = income.date ? new Date(income.date) : null;

        // Días entre fecha factura y fecha pago
        const dias = invoiceDate && paymentDate
          ? Math.round((paymentDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
          : '';

        // Fecha de vencimiento = fecha factura + 30 días
        let fechaVenc = '';
        let diasVenc: number | string = '';
        if (invoiceDate) {
          const dueDate = new Date(invoiceDate.getTime());
          dueDate.setDate(dueDate.getDate() + 30);
          fechaVenc = this.formatDateForInput(dueDate).split('-').reverse().join('-'); // dd-MM-yyyy
          diasVenc = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }

        const actura = income.uuid && income.uuid !== 'NA' ? income.uuid.substring(0, 10) + '...' : income.numberDocument || '';

        totalSubtotal  += income.subtotal || 0;
        totalIva       += income.tax || 0;
        totalGeneral   += income.total || 0;

        // Color para días de vencimiento: rojo si vencido, verde si al corriente, o si ya está pagada
        const diasVencColor = income.status === 'Pagada' ? '#155724'
          : (typeof diasVenc === 'number' && diasVenc < 0) ? '#721c24' : '#000';

        tableBody.push([
          { text: income.paymentMonth || '',             style: 'td', alignment: 'center' },
          { text: companyName,                           style: 'td', alignment: 'left'   },
          { text: project?.name || '',                   style: 'td', alignment: 'left'   },
          { text: this.formatDate(income.dateStamped),   style: 'td', alignment: 'center' },
          { text: this.formatDate(income.date),          style: 'td', alignment: 'center' },
          { text: actura,                                style: 'td', alignment: 'center' },
          { text: income.oc || '',                       style: 'td', alignment: 'center' },
          { text: `$${this.formatCurrencyNumber(income.total)}`,     style: 'td', alignment: 'right' },
          { text: '',                                    style: 'td', alignment: 'right'  },
          { text: `$${this.formatCurrencyNumber(income.subtotal)}`,  style: 'td', alignment: 'right' },
          { text: `$${this.formatCurrencyNumber(income.tax)}`,       style: 'td', alignment: 'right' },
          { text: `$${this.formatCurrencyNumber(income.total)}`,     style: 'td', alignment: 'right' },
          { text: income.status || '',                   style: 'td', alignment: 'center' },
          { text: income.formaPago || '',                style: 'td', alignment: 'center' },
          { text: dias.toString(),                       style: 'td', alignment: 'center' },
          { text: fechaVenc,                             style: 'td', alignment: 'center' },
          { text: diasVenc.toString(), style: 'td', alignment: 'center', color: diasVencColor, bold: typeof diasVenc === 'number' && diasVenc < 0 },
        ]);
      });

      // Fila de totales
      tableBody.push([
        { text: 'TOTAL', colSpan: 9, style: 'totalLabel', alignment: 'right', bold: true, border: [false, true, false, false] },
        {}, {}, {}, {}, {}, {}, {}, {},
        { text: `$${this.formatCurrencyNumber(totalSubtotal)}`, style: 'totalValue', alignment: 'right', border: [false, true, false, false], bold: true },
        { text: `$${this.formatCurrencyNumber(totalIva)}`,      style: 'totalValue', alignment: 'right', border: [false, true, false, false], bold: true },
        { text: `$${this.formatCurrencyNumber(totalGeneral)}`,  style: 'totalValue', alignment: 'right', border: [false, true, false, false], bold: true, color: '#cc0000' },
        { text: '', border: [false, true, false, false] },
        { text: '', border: [false, true, false, false] },
        { text: '', border: [false, true, false, false] },
        { text: '', border: [false, true, false, false] },
        { text: '', border: [false, true, false, false] },
      ]);

      // Período en texto
      const startDateObj = new Date(+sy, +sm - 1, 1);
      const endDateObj   = new Date(+ey, +em - 1, 1);
      const meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
      let periodText = '';
      if (+sy === +ey && +sm === +em) {
        periodText = `MES DE ${meses[startDateObj.getMonth()]} ${sy}`;
      } else if (+sy === +ey) {
        periodText = `PERIODO DE ${meses[startDateObj.getMonth()]} A ${meses[endDateObj.getMonth()]} ${sy}`;
      } else {
        periodText = `PERIODO DE ${meses[startDateObj.getMonth()]} ${sy} A ${meses[endDateObj.getMonth()]} ${ey}`;
      }

      // Celda del logo
      const logoCell: any = logoBase64
        ? { image: logoBase64, width: 70, alignment: 'left' }
        : { text: companyName, bold: true, fontSize: 11, alignment: 'left' };

      const docDefinition: any = {
        pageSize: 'LETTER',
        pageOrientation: 'landscape',
        pageMargins: [20, 60, 20, 40],
        footer: (currentPage: number, pageCount: number) => ({
          text: `Página ${currentPage} / ${pageCount}`,
          alignment: 'center',
          fontSize: 7,
          margin: [0, 10, 0, 0]
        }),
        header: () => ({
          margin: [20, 8, 20, 0],
          table: {
            widths: ['20%', '*', '25%'],
            body: [[
              logoCell,
              {
                stack: [
                  { text: 'Control de Facturación e Ingresos', style: 'reportTitle', alignment: 'center' },
                  { text: 'Sistema de Gestión de Calidad',     fontSize: 8,  alignment: 'center', color: '#555' },
                  { text: periodText,                           fontSize: 7,  alignment: 'center', color: '#333', margin: [0, 2, 0, 0] },
                ]
              },
              {
                stack: [
                  { text: 'Referencia: HCO-ADM-SGC-004', fontSize: 7, alignment: 'right' },
                  { text: 'Código:     HCO-ADM-FO-013',  fontSize: 7, alignment: 'right' },
                  { text: 'Rev.:       00',               fontSize: 7, alignment: 'right' },
                ]
              }
            ]]
          },
          layout: 'noBorders'
        }),
        content: [
          {
            table: {
              headerRows: 1,
              widths: [40, 52, 52, 42, 42, 50, 32, 46, 46, 42, 38, 44, 40, 38, 24, 44, 36],
              body: tableBody
            },
            layout: {
              hLineWidth:  (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.3,
              vLineWidth:  () => 0.3,
              hLineColor:  () => '#aaa',
              vLineColor:  () => '#ccc',
              fillColor:   (rowIndex: number) => rowIndex === 0 ? '#1a5276' : (rowIndex % 2 === 0 ? '#eaf4fb' : null),
            }
          }
        ],
        styles: {
          reportTitle: { fontSize: 12, bold: true, color: '#1a5276' },
          th:          { fontSize: 6,  bold: true, color: '#ffffff', margin: [1, 2, 1, 2] },
          td:          { fontSize: 6,  color: '#222',   margin: [1, 1, 1, 1] },
          totalLabel:  { fontSize: 7,  bold: true },
          totalValue:  { fontSize: 7,  bold: true },
        }
      };

      const pdf = pdfMake.createPdf(docDefinition);
      try {
        pdf.open();
      } catch {
        pdf.download(`reporte-ingresos-${this.reportStartDate}-al-${this.reportEndDate}.pdf`);
        alerts.basicAlert('Reporte descargado', 'El navegador bloqueó la ventana emergente. El reporte se descargó automáticamente.', 'info');
      }

      this.closeIngresoReportModal();
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        `Reporte de Ingresos generado: ${this.reportStartDate} al ${this.reportEndDate}`,
        'Menu Administracion Ingresos - Reporte',
        this.trackingService.getEmail()
      );

    } catch (error) {
      console.error('Error generando reporte:', error);
      alerts.basicAlert('Error', 'Error al generar el reporte PDF', 'error');
    } finally {
      this.isGeneratingIngresoReport = false;
    }
  }

  // ==================== REPORTE DE SALDOS (INGRESOS) ====================

  private async generateSaldosIngresoReport() {
    this.isGeneratingIngresoReport = true;
    try {
      const selectedAccount = this.bankAccounts.find(a => a.id === this.idAccount);
      const accountName = selectedAccount
        ? `${selectedAccount.nameAccount} - ${selectedAccount.bankName}`
        : 'Cuenta';

      const response: any = await lastValueFrom(
        this.administrationService.getBalance(this.idAccount)
      );

      if (!response || !response.hasData || !response.data || response.data.length === 0) {
        alerts.basicAlert('Aviso', 'No hay movimientos disponibles para esta cuenta', 'info');
        return;
      }

      const filtered = response.data.filter((item: any) => {
        if (!item.fecha) return false;
        const d = new Date(item.fecha);
        if (isNaN(d.getTime())) return false;
        const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        return ds >= this.reportStartDate && ds <= this.reportEndDate;
      });

      if (filtered.length === 0) {
        alerts.basicAlert('Sin datos', 'No hay movimientos en el rango de fechas seleccionado', 'info');
        return;
      }

      let logoData: string | null = null;
      try {
        const rootData: any = await lastValueFrom(this.rootService.getRootbyId(this.root || 1));
        if (rootData?.picture) {
          logoData = await this.base64EncodeService.convertImageToBase64(rootData.picture);
        }
      } catch {}

      const pdfMake = (await import('pdfmake/build/pdfmake')).default;
      const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
      pdfMake.vfs = pdfFonts.vfs;

      const period = `Del ${this.reportStartDate} al ${this.reportEndDate}`;

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
          { text: deposito > 0 ? `$${this.formatCurrencyNumber(deposito)}` : '', style: 'td', fillColor: bg, alignment: 'right', color: '#008000' },
          { text: gasto > 0 ? `$${this.formatCurrencyNumber(gasto)}` : '', style: 'td', fillColor: bg, alignment: 'right', color: '#CC0000' },
          { text: `$${this.formatCurrencyNumber(saldo)}`, style: 'td', fillColor: bg, alignment: 'right', color: saldo >= 0 ? '#000080' : '#CC0000' },
        ]);
      });

      tableRows.push([
        { text: 'TOTAL', colSpan: 4, style: 'totalLabel', alignment: 'right', bold: true, border: [false, true, false, false] },
        {}, {}, {},
        { text: `$${this.formatCurrencyNumber(totalDeposito)}`, style: 'totalValue', alignment: 'right', border: [false, true, false, false], bold: true, color: '#008000' },
        { text: `$${this.formatCurrencyNumber(totalGasto)}`, style: 'totalValue', alignment: 'right', border: [false, true, false, false], bold: true, color: '#CC0000' },
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
        pdf.download(`saldos-cuenta-${this.reportStartDate}-al-${this.reportEndDate}.pdf`);
        alerts.basicAlert('Reporte descargado', 'El navegador bloqueó la ventana emergente. El reporte se descargó automáticamente.', 'info');
      }
      this.closeIngresoReportModal();
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        `Reporte de Saldos generado: ${this.reportStartDate} al ${this.reportEndDate}`,
        'Menu Administracion Ingresos - Saldos',
        this.trackingService.getEmail()
      );
    } catch (error) {
      console.error('Error al generar reporte de saldos:', error);
      alerts.basicAlert('Error', 'Error al generar el reporte de saldos', 'error');
    } finally {
      this.isGeneratingIngresoReport = false;
    }
  }

  saveNewCustomer() {
    if (!this.newCustomer.idBranch || !this.newCustomer.nameContact || !this.newCustomer.idTypecop) {
      alerts.basicAlert(
        'Nuevo Cliente',
        'Por favor complete todos los campos requeridos.',
        'error'
      );
      return;
    }

    const customerData = {
      idRoot: this.root,
      idBranch: this.newCustomer.idBranch,
      idTypecop: this.newCustomer.idTypecop,
      nameContact: this.newCustomer.nameContact,
      company: this.newCustomer.company || this.newCustomer.nameContact,
      type: 'CUSTOMERS',
      active: true,
      vigente: true,
      email: '',
      phone: '',
      mobile: '',
      address: '',
      city: '',
      state: '',
      cp: '',
      rfc: ''
    };

    this.customersService.addCustomer(customerData).subscribe({
      next: (response: any) => {
        const newCustomerId = response.id;

        alerts.basicAlert(
          'Nuevo Cliente',
          'Cliente guardado correctamente.',
          'success'
        );
        this.closeCustomerModal();

        // Recargar la lista de clientes
        this.getCustomers();

        // Asignar automáticamente el nuevo cliente a la fila que se estaba editando
        if (this.currentEditingNode && newCustomerId) {
          const nodeToUpdate = this.currentEditingNode;
          setTimeout(() => {
            nodeToUpdate.setDataValue('idCustomer', newCustomerId);
            nodeToUpdate.data.__modified = true;
            this.notSavedChanges = true;

            // Refrescar la celda para mostrar el nombre
            if (this.gridApi) {
              this.gridApi.refreshCells({
                rowNodes: [nodeToUpdate],
                columns: ['idCustomer'],
                force: true
              });
            }
            this.currentEditingNode = null;
          }, 300);
        }
      },
      error: (err) => {
        console.error('Error guardando cliente:', err);
        alerts.basicAlert(
          'Error',
          `Error al guardar el cliente: ${err?.error?.message || err?.message || 'Error desconocido'}`,
          'error'
        );
      }
    });
  }

}
