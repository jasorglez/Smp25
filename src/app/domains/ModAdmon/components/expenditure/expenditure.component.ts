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
import { CatalogadmonService } from 'app/services/catalogadmon.service';
import { BranchsService } from 'app/services/branchs.service';
import { environment } from '@env/environment';
import { AuthService } from 'app/services/auth.service';
import { TrackingService } from 'app/services/tracking.service';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { EmployeesService } from 'app/services/employees.service';
import { CustomersService } from 'app/services/customers.service';
import { CuentasContablesService } from 'app/services/cuentas-contables.service';
import { ProjectsService } from 'app/services/projects.service';
import { ButtonCellRendererExpenditure2Component } from './button-cell-renderer-expenditure2.component';
import { PdfButtonCellRendererExpenditure2Component } from './pdf-button-cell-renderer-expenditure2.component';
import { DetallesExpenditureComponent } from './detalles-expenditure.component';

@Component({
  selector: 'app-expenditure',
  standalone: true,
  imports: [NgSelectModule, NgSelectComponent, AgGridModule, MultiLineEditorComponent, CommonModule,
    FormsModule, ButtonCellRendererExpenditure2Component, PdfButtonCellRendererExpenditure2Component,
    DetallesExpenditureComponent],
  templateUrl: './expenditure.component.html',
  styleUrl: './expenditure.component.scss'
})
export class ExpenditureComponent {

  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  public modalServiceTable = inject(ModalService);
  private administrationService = inject(AdministrationService);
  private cataalogAdmonService = inject(CatalogadmonService);
  private catalogsService = inject(CatalogsService);
  private usersxpermissionsService = inject(UsersxpermissionsService);
  private usersService = inject(UsersService);
  public signalsService = inject(SignalsService);
  private branchesService = inject(BranchsService);
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);
  private employeesService = inject(EmployeesService);
  private customersService = inject(CustomersService);
  private cuentasContablesService = inject(CuentasContablesService);
  private projectsService = inject(ProjectsService);
  authService = inject(AuthService);
  public trackingService = inject(TrackingService);

  public isIncomeMode: boolean = false;

  async ngOnInit() {
  }

  constructor() {
    // Effect para cambios de Root/Branch
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
      await this.loadEmployees();
      await this.loadProviders();
      await this.loadCuentasContables();
      await this.loadCuentasContablesNivel2();
      await this.loadCuentasContablesNivel3();
      await this.loadProjects();

      // Refrescar columnas después de cargar datos
      this.refreshColumnDefinitions();
      // Actualizar contexto del detalle con los datos cargados
      this.updateDetailContext();
      console.log('✅ Effect Root/Branch completado');
    });

    // Effect para escuchar actualizaciones del detalle
    effect(() => {
      console.log('👂 Effect MasterUpdate ejecutado');
      const updateData = this.signalsService.getMasterUpdateTrigger()();
      console.log('📨 Signal recibido:', updateData);

      if (updateData && updateData.id && typeof updateData.subtotal === 'number') {
        console.log('🎯 Datos válidos recibidos:', {
          id: updateData.id,
          subtotal: updateData.subtotal,
          tax: updateData.tax,
          total: updateData.total,
        });

        console.log('🔍 gridApi disponible:', !!this.gridApi);

        if (this.gridApi) {
          console.log('✅ Llamando updateMasterRowInGrid...');
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

  // Propiedades para datos pendientes y control
  private pendingMasterUpdate: any = null;
  private isGeneratingReport: boolean = false;
  externalFilterActive: boolean = false;
  showform: string = '';
  branchs: any[] = [];
  incomes: any[] = [];
  expenses: any[] = [];
  employees: any[] = [];
  providers: any[] = [];
  cuentasContables: any[] = [];
  cuentasContablesNivel2: any[] = [];
  cuentasContablesNivel3: any[] = [];
  projects: any[] = [];
  users: any[] = [];

  id: number;
  notSavedChanges: boolean = false;
  newlyAddedRows: string[] = [];
  selectedIncomes: any = null;
  currentUser: string;

  idRoot: number;
  idBranch: number;
  triggerValue: number = 0;

  bankAccounts: any[] = [];
  prefixAndConsecutive: any[] = [];

  private _idAccount: number;

  set idAccount(value: number) {
    if (this._idAccount !== value) {
      this._idAccount = value;

      if (value) {
        const selectedAccount = this.bankAccounts.find(account => account.id === value);
        if (selectedAccount) {
          const accountDetails = `${selectedAccount.nameAccount} - ${selectedAccount.bankName}`;
          this.trackingService.addLog(this.trackingService.getnameComp(), `Selección de cuenta bancaria: ${accountDetails}`,
            'Egresos - Selección Cuenta', this.trackingService.getEmail());
        }
      }

      this.signalsService.setIdIncomeAndExpense(null);
      this.getExpenditure();
    }
  }

  get idAccount(): number {
    return this._idAccount;
  }

  obtenerBranchs() {
    this.branchesService.getBrancheswoa(this.idRoot).subscribe(
      (data: any) => {
        this.branchs = data;
      },
      (error) => console.error('Error fetching data:', error)
    );
    this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Sucursales`, 'Egresos ',
      this.trackingService.getEmail());
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
      this.trackingService.getEmail());
  }

  public gridApi: GridApi;
  private tempIdCounter: number = 0;

  // Grid Options con Master-Detail
  public gridOptions: any = {
    headerHeight: 24,
    rowHeight: 35, // Aumentado para accommodate descripciones largas
    animateRows: true,
    masterDetail: true,
    detailRowHeight: 600,
    detailCellRenderer: DetallesExpenditureComponent,
    isExternalFilterPresent: () => {
      return this.externalFilterActive;
    },
    doesExternalFilterPass: (node: any) => {
      return node.data.visible !== false;
    },
    getRowClass: (params) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    getRowStyle: (params) => {
      if (params.node.isSelected()) {
        return { backgroundColor: '#ffe6e6', color: '#000000', fontWeight: 'bold' };
      }

      if (params.data) {
        switch (params.data.status) {
          case 'Pendiente':
            return { backgroundColor: '#cce5ff', color: '#000000' };
          case 'Pagada':
            return { backgroundColor: '#d4edda', color: '#000000' };
          case 'Cancelada':
            return { backgroundColor: '#f8d7da', color: '#000000' };
          case 'Entregada':
            return { backgroundColor: '#fff3cd', color: '#000000' };
          default:
            return { color: '#000000' };
        }
      }
      return { color: '#000000' };
    },
    onRowClicked: (event) => {
      if (event.column && event.column.getColId() !== 'pdfReport') {
        event.node.setSelected(true);
      }
    },
    onRowSelected: (event) => {
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
    return new Promise<void>((resolve) => {
      this.incomesAndExpensesService.getIncomesAndExpenses(this.idRoot).subscribe({
        next: (incomes) => {
          const filtered = incomes?.filter(income => {
            return income.type === "GASTO" && income.idAccount === this.idAccount
          }) || [];

          // Agregar propiedades para master-detail
          this.incomes = filtered.map(income => {
            const countItems = income.countItems || income.countitems || 0;
            return {
              ...income,
              countItems: countItems,
              detailType: null,
              detailData: [],
              visible: true
            };
          });

          console.log('✅ Egresos cargados:', this.incomes.length);
          resolve();
        },
        error: (err) => {
          console.error('Error obteniendo egresos. Código:', err.status, 'Detalles:', err);
          this.incomes = [];
          resolve();
        }
      });
    });
    this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Egresos`, 'Egresos ',
      this.trackingService.getEmail());
  }

  async getBills() {
    return new Promise<void>((resolve) => {
      this.cataalogAdmonService.getCatalogs(this.idRoot, 'BILL').subscribe(
        (data: any) => {
          this.expenses = data;
          console.log('✅ Tipos de Gasto cargados:', this.expenses.length);
          resolve();
        },
        error => {
          console.error(error);
          this.expenses = [];
          resolve();
        }
      );
    });
    this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Gastos`, 'Egresos ',
      this.trackingService.getEmail());
  }

  async loadEmployees() {
    return new Promise<void>((resolve) => {
      const idBranchNegative = -Math.abs(this.idRoot);
      this.employeesService.getEmployees(idBranchNegative).subscribe(
        (data: any) => {
          this.employees = (data || []).map((e: any) => ({
            id: e.id,
            name: e.name || 'Sin nombre'
          }));
          console.log('✅ Empleados cargados:', this.employees.length);
          resolve();
        },
        error => {
          console.error('Error cargando empleados:', error);
          this.employees = [];
          resolve();
        }
      );
    });
  }

  async loadProviders() {
    return new Promise<void>((resolve) => {
      this.customersService.getCustomersByCompany(this.idRoot, 'PROVIDERS').subscribe(
        (data: any) => {
          this.providers = (data || []).map((p: any) => ({
            id: p.id,
            name: p.name || 'Sin nombre'
          }));
          console.log('✅ Proveedores cargados:', this.providers.length);
          resolve();
        },
        error => {
          console.error('Error cargando proveedores:', error);
          this.providers = [];
          resolve();
        }
      );
    });
  }

  async loadCuentasContables() {
    return new Promise<void>((resolve) => {
      this.cuentasContablesService.getHojas(this.idRoot).subscribe(
        (data: any) => {
          this.cuentasContables = data || [];
          console.log('✅ Cuentas contables cargadas:', this.cuentasContables.length);
          resolve();
        },
        error => {
          console.error('Error cargando cuentas contables:', error);
          this.cuentasContables = [];
          resolve();
        }
      );
    });
  }

  async loadCuentasContablesNivel2() {
    return new Promise<void>((resolve) => {
      this.cuentasContablesService.getByNivel(this.idRoot, 2).subscribe(
        (data: any) => {
          this.cuentasContablesNivel2 = data || [];
          console.log('✅ Cuentas contables Nivel 2 cargadas:', this.cuentasContablesNivel2.length);
          resolve();
        },
        error => {
          console.error('Error cargando cuentas contables nivel 2:', error);
          this.cuentasContablesNivel2 = [];
          resolve();
        }
      );
    });
  }

  async loadCuentasContablesNivel3() {
    return new Promise<void>((resolve) => {
      this.cuentasContablesService.getByNivel(this.idRoot, 3).subscribe(
        (data: any) => {
          this.cuentasContablesNivel3 = data || [];
          console.log('✅ Cuentas contables Nivel 3 cargadas:', this.cuentasContablesNivel3.length);
          resolve();
        },
        error => {
          console.error('Error cargando cuentas contables nivel 3:', error);
          this.cuentasContablesNivel3 = [];
          resolve();
        }
      );
    });
  }

  async loadProjects() {
    return new Promise<void>((resolve) => {
      this.projectsService.getProjectListByCompany(this.idRoot).subscribe(
        (data: any) => {
          this.projects = (data || []).map((p: any) => ({
            id: p.id,
            name: p.name || p.projectName || 'Sin nombre'
          }));
          console.log('✅ Proyectos cargados:', this.projects.length);
          resolve();
        },
        error => {
          console.error('Error cargando proyectos:', error);
          this.projects = [];
          resolve();
        }
      );
    });
  }

  private async loadAuthorizers() {
    forkJoin({
      permissions: this.usersxpermissionsService.getDataUsersxPermissions('root'),
      allUsers: this.usersService.getDataUsers(this.idRoot)
    }).subscribe({
      next: ({ permissions, allUsers }) => {
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
    return new Promise<void>((resolve) => {
      this.usersService.getUserByEmail(String(localStorage.getItem('mail'))).subscribe({
        next: (user) => {
          if (user?.usersmall) {
            this.currentUser = user.usersmall;
          } else {
            this.currentUser = 'Sin nombre';
          }
          resolve();
        },
        error: (err) => {
          console.error('Error obteniendo usuario:', err);
          this.currentUser = 'Error al cargar';
          resolve();
        }
      });
    });
  }

  private formatDate(value: string): string {
    if (!value) return '';
    const date = new Date(value);
    return [
      date.getDate().toString().padStart(2, '0'),
      (date.getMonth() + 1).toString().padStart(2, '0'),
      date.getFullYear()
    ].join('/');
  }

  // Cache para definiciones de columnas
  private _colMaster: ColDef[] = [];

  get colMaster(): ColDef[] {
    if (this._colMaster.length > 0) {
      return this._colMaster;
    }

    this._colMaster = [
      {
        headerName: '#',
        width: 50,
        valueGetter: (params) => params.node!.rowIndex! + 1,
        pinned: 'left',
        cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' }
      },
      {
        field: 'countitems',
        headerName: 'Items',
        width: 80,
        cellRenderer: ButtonCellRendererExpenditure2Component,
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
        width: 70,
        cellRenderer: PdfButtonCellRendererExpenditure2Component,
        cellRendererParams: {
          onClick: (node: any) => {
            console.log('🔵 PDF Click detectado:', node.data.id);
            this.toggleReportDetail(node);
          },
          icon: 'bi-file-earmark-pdf',
          iconColor: '#dc3545',
          title: 'Hacer clic para generar el reporte PDF'
        },
        editable: false,
        cellStyle: { backgroundColor: '#fff3e0', textAlign: 'center' }
      },
      {
        field: 'numberDocument', headerName: '# Documento', editable: true, filter: true, width: 130
      },
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
        width: 150,
        cellEditor: 'agSelectCellEditor',
        filterParams: {
          defaultToNothingSelected: true,
        },
        cellEditorParams: (params) => {
          return {
            values: this.branchs
              ? this.branchs
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((item) => item.id)
              : [],
          };
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          const foundBranch = this.branchs
            ? this.branchs.find((item) => item.id === params.value)
            : null;
          return foundBranch ? foundBranch.name : params.value;
        },
        valueSetter: (params) => {
          params.data.idBranch = params.newValue;
          return true;
        },
      },
      {
        field: 'date', headerName: 'Fecha', editable: true, cellDataType: 'date', width: 100,
        valueFormatter: (params) => this.formatDate(params.value)
      },
      {
        field: 'idExpend', headerName: 'Tipo Gasto', editable: true, width: 220,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => {
          return {
            values: this.cuentasContablesNivel2
              ? this.cuentasContablesNivel2.map((c) => c.id)
              : []
          };
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          const cuenta = this.cuentasContablesNivel2?.find((c) => c.id === params.value);
          return cuenta ? `${cuenta.codigo} - ${cuenta.nombre}` : params.value;
        },
      },
      {
        field: 'description', headerName: 'Descripción', editable: true, width: 200, filter: true,
        cellClass: 'description-cell',
        cellEditor: 'agPopupTextCellEditor',
        cellEditorParams: {
          maxLength: 600,
          cols: 60,
          rows: 4,
          style: 'word-wrap: break-word; white-space: normal; resize: vertical;',
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
          const value = params.value || '';
          return `<div class="description-content" style="word-wrap: break-word; white-space: normal; line-height: 1.2; padding: 2px; overflow: visible; max-height: none;">${value}</div>`;
        }
      },
     
      {
        field: 'subtotal',
        headerName: 'Subtotal',
        type: 'number',
        editable: false,
        width: 110,
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
        width: 110,
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
      {
        field: 'idProject',
        headerName: 'Proyecto',
        editable: true,
        width: 180,
        filter: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => {
          return {
            values: this.projects
              ? this.projects.map((p) => p.id)
              : []
          };
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          const project = this.projects?.find((p) => p.id === params.value);
          return project ? project.name : params.value;
        },
        tooltipValueGetter: (params) => {
          if (!params.value) return '';
          const project = this.projects?.find((p) => p.id === params.value);
          return project ? project.name : '';
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
          return params.value.length > 15 ? params.value.substring(0, 15) + '...' : params.value;
        },
        cellStyle: (params) => {
          if (params.value && params.value !== 'NA') {
            return { backgroundColor: '#d4edda', color: '#155724' };
          }
          return { backgroundColor: '#fff3cd', color: '#856404' };
        }
      },

      {
        field: 'status',
        headerName: 'Estatus',
        editable: true,
        width: 100,
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
    ];

    return this._colMaster;
  }

  // Método para refrescar las definiciones de columnas
  private refreshColumnDefinitions() {
    console.log('🔄 Refrescando columnas. expenses:', this.expenses.length);
    this._colMaster = [];
    if (this.gridApi) {
      this.gridApi.setGridOption('columnDefs', this.colMaster);
      console.log('✅ Columnas actualizadas en el grid');
    } else {
      console.log('⚠️ Grid API no disponible aún');
    }
  }

  // Método para actualizar el contexto del detalle después de cargar datos
  private updateDetailContext() {
    if (this.gridApi) {
      console.log('🔄 Actualizando contexto del detalle. Empleados:', this.employees.length, 'Proveedores:', this.providers.length);
      this.gridApi.setGridOption('detailCellRendererParams', {
        getDetailRowData: (params: any) => {
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
          expenses: this.expenses,
          employees: this.employees,
          providers: this.providers,
          cuentasContables: this.cuentasContables,
          cuentasContablesNivel3: this.cuentasContablesNivel3,
          modalServiceTable: this.modalServiceTable,
          CONCEPTS: {
            load: (expenditureId: number, callback: (data: any[]) => void) => {
              this.loadConceptsData(expenditureId, callback);
            },
            save: (expenditureId: number, data: any) => {
              return this.saveConceptsById(expenditureId, data);
            },
            delete: (params: any, callback: () => void, newCount?: number) => {
              this.deleteConceptRow(params, callback, newCount);
            },
            updateCount: (expenditureId: number, count: number) => {
              this.updateExpenditureCountItems(expenditureId, count);
            }
          }
        }
      });
      console.log('✅ Contexto del detalle actualizado');
    }
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
    }
  }

  onCellValueChanged(event: any) {
    if (!event.data.__isNew) {
      event.data.modifiedBy = this.currentUser;
      event.data.modifiedAt = new Date().toISOString();
    }

    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onCellDoubleClicked(event: CellDoubleClickedEvent) {
    if (event.colDef.field === 'date') {
      this.gridApi.startEditingCell({
        rowIndex: event.rowIndex,
        colKey: 'date'
      });
      return;
    }

    if (event.node.expanded) {
      event.node.setExpanded(false);
      event.node.data.detailType = null;
    }

    this.externalFilterActive = false;
    this.gridApi.forEachNode((node) => {
      node.data.visible = true;
    });
    this.gridApi.onFilterChanged();
  }

  onGridReady(params: GridReadyEvent) {
    console.log('🏁 Grid ready');
    this.gridApi = params.api;

    // Configurar el detailCellRendererParams
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
        expenses: this.expenses,
        employees: this.employees,
        providers: this.providers,
        cuentasContables: this.cuentasContables,
        cuentasContablesNivel3: this.cuentasContablesNivel3,
        modalServiceTable: this.modalServiceTable,
        CONCEPTS: {
          load: (expenditureId: number, callback: (data: any[]) => void) => {
            this.loadConceptsData(expenditureId, callback);
          },
          save: (expenditureId: number, data: any) => {
            return this.saveConceptsById(expenditureId, data);
          },
          delete: (params: any, callback: () => void, newCount?: number) => {
            this.deleteConceptRow(params, callback, newCount);
          },
          updateCount: (expenditureId: number, count: number) => {
            this.updateExpenditureCountItems(expenditureId, count);
          }
        }
      }
    });

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
      this.trackingService.getEmail());

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
      idProject: null,
      dateStamped: null,
      description: "POR COMPROBAR",
      type: "GASTO",
      subtotal: 0,
      tax: 0,
      total: 0,
      countItems: 0,
      countitems: 0,
      createdBy: this.currentUser || 'Usuario temporal',
      createdAt: new Date().toISOString(),
      modifiedBy: null,
      modifiedAt: new Date().toISOString(),
      status: "Pagada",
      active: true,
      __isNew: true,
      visible: true,
      detailType: null,
      detailData: []
    };
    this.incomes = [newItem, ...this.incomes];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;

    const newRowIndex = this.incomes.findIndex((row) => row.id === tempId);

    setTimeout(() => {
      this.gridApi.ensureIndexVisible(newRowIndex);
      this.gridApi.startEditingCell({
        rowIndex: newRowIndex,
        colKey: 'date',
      });
    }, 50);
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

    try {
      if (addObservables.length > 0 || updateObservables.length > 0) {
        const responses = await lastValueFrom(
          concat(...addObservables, ...updateObservables).pipe(toArray())
        );
      }

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizados los datos correctamente.',
        'success'
      );

      this.trackingService.addLog(this.trackingService.getnameComp(), `Salvar Egresos`, 'Egresos ',
        this.trackingService.getEmail());

      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      await this.getExpenditure();
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

    const result = await alerts.confirmAlert(
      '¿Eliminar egreso?',
      `¿Está seguro que desea eliminar el egreso "${selectedData.numberDocument}"? Esta acción no se puede deshacer.`,
      'warning',
      'Sí, eliminar'
    );

    if (!result.isConfirmed) {
      return;
    }

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
    delete cleanedData.detailType;
    delete cleanedData.detailData;
    delete cleanedData.visible;
    // Sincronizar countItems (frontend) → countitems (backend)
    if ('countItems' in cleanedData) {
      cleanedData.countitems = cleanedData.countItems;
      delete cleanedData.countItems;
    }
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  async getBankAccounts() {
    return new Promise<void>((resolve) => {
      this.administrationService.getAccountBanks(this.idRoot).subscribe(
        (data: any) => {
          this.bankAccounts = data;
          resolve();
        },
        error => {
          console.error(error);
          this.bankAccounts = [];
          resolve();
        }
      );
    });
  }

  // ==================== MÉTODOS PARA CASCADAS ====================

  toggleCascade(node: any) {
    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data.detailType === 'concepts';

    if (isCurrentlyExpanded) {
      node.setExpanded(false);
      node.data.detailType = null;
      this.externalFilterActive = false;
      api.forEachNode((n: any) => {
        n.data.visible = true;
      });
      api.onFilterChanged();
    } else {
      this.externalFilterActive = true;
      api.forEachNode((n: any) => {
        n.data.visible = n.id === node.id ? true : false;
      });
      api.onFilterChanged();

      if (node.expanded && node.data.detailType !== 'concepts') {
        node.setExpanded(false);
      }

      node.data.detailType = 'concepts';

      setTimeout(() => {
        node.setExpanded(true);
      }, 0);
    }
  }

  async toggleReportDetail(node: any) {
    console.log('🟢 toggleReportDetail llamado - ID:', node.data.id, 'isGenerating:', this.isGeneratingReport);

    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data.detailType === 'report';

    if (isCurrentlyExpanded) {
      console.log('🟡 Colapsando reporte expandido');
      node.setExpanded(false);
      node.data.detailType = null;
      this.externalFilterActive = false;
      api.forEachNode((n: any) => {
        n.data.visible = true;
      });
      api.onFilterChanged();
      return;
    }

    if (this.isGeneratingReport) {
      console.log('🔴 Ya se está generando un reporte, ignorando clic');
      alerts.basicAlert(
        'Procesando',
        'Ya se está generando un reporte. Por favor espere.',
        'warning'
      );
      return;
    }

    this.isGeneratingReport = true;
    console.log('🟢 Iniciando generación de reporte');

    let progress = 0;
    alerts.showLoadingWithProgress(
      'Generando reporte...',
      'Por favor espere mientras se procesa el documento',
      progress
    );

    const progressInterval = setInterval(() => {
      progress += 10;
      if (progress <= 90) {
        alerts.updateLoadingProgress(
          'Generando reporte...',
          'Por favor espere mientras se procesa el documento',
          progress
        );
      }
    }, 100);

    try {
      this.externalFilterActive = true;
      api.forEachNode((n: any) => {
        n.data.visible = n.id === node.id ? true : false;
      });
      api.onFilterChanged();

      if (node.expanded && node.data.detailType !== 'report') {
        node.setExpanded(false);
      }

      node.data.detailType = 'report';

      // Agregar descripción del tipo de gasto
      if (node.data.idExpend && this.expenses) {
        const foundItem = this.expenses.find((item) => item.id === node.data.idExpend);
        if (foundItem) {
          node.data.expenseTypeText = foundItem.description;
        } else {
          node.data.expenseTypeText = 'Sin descripción';
        }
      } else {
        node.data.expenseTypeText = 'Sin tipo de gasto';
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      node.setExpanded(true);

      clearInterval(progressInterval);
      alerts.updateLoadingProgress(
        'Reporte generado',
        'El documento se ha procesado correctamente',
        100
      );

      console.log('✅ Reporte generado exitosamente');

      setTimeout(() => {
        alerts.closeLoading();
        this.isGeneratingReport = false;
        console.log('🔓 Lock liberado');
      }, 800);

    } catch (error) {
      clearInterval(progressInterval);
      alerts.closeLoading();
      this.isGeneratingReport = false;
      console.log('🔴 Error generando reporte, lock liberado');
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al generar el reporte. Por favor, intente nuevamente.',
        'error'
      );
      console.error('Error generando reporte:', error);
    }
  }

  collapseCurrentRow(expenditureId: number) {
    if (this.gridApi) {
      this.gridApi.forEachNode((node) => {
        if (node.data && node.data.id === expenditureId) {
          node.setExpanded(false);
          node.data.detailType = null;
        }
      });
      this.externalFilterActive = false;
      this.gridApi.forEachNode((node) => {
        node.data.visible = true;
      });
      this.gridApi.onFilterChanged();
    }
  }

  // ==================== MÉTODOS PARA CONCEPTOS ====================

  updateExpenditureCountItems(expenditureId: number, count: number) {
    console.log(`🔄 PADRE: updateExpenditureCountItems llamado. ID: ${expenditureId}, Nuevo Count: ${count}`);
    if (this.gridApi) {
      let found = false;
      this.gridApi.forEachNode((node) => {
        if (node.data && node.data.id === expenditureId) {
          found = true;
          const oldCount = node.data.countItems;
          console.log(`   Registro encontrado. ID: ${expenditureId}, Count anterior: ${oldCount}, Count nuevo: ${count}`);
          node.data.countItems = count;
          node.data.countitems = count;
          this.gridApi.refreshCells({
            rowNodes: [node],
            columns: ['countItems'],
            force: true
          });
        }
      });
      if (!found) {
        console.warn(`   ⚠️ No se encontró el registro con ID ${expenditureId} en el grid`);
      }
    } else {
      console.warn('   ⚠️ gridApi no está disponible');
    }
  }

  loadConceptsData(expenditureId: number, successCallback: any) {
    console.log('🟢 PADRE: Cargando conceptos desde servidor para ID:', expenditureId);
    this.incomesAndExpensesService.getConceptsFromIncomesAndExpenses(expenditureId).subscribe({
      next: (data: any) => {
        console.log(`✅ PADRE: Conceptos recibidos del servidor para ID ${expenditureId}:`, data?.length || 0);
        if (data && data.length > 0) {
          console.log('   Primer concepto:', data[0]);
        }
        successCallback(data);
      },
      error: (error) => {
        console.error('❌ PADRE: Error loading concepts para ID', expenditureId, error);
        successCallback([]);
      }
    });
  }

  async saveConceptsById(expenditureId: number, data: any) {
    console.log('💾 PADRE: saveConceptsById iniciado. ID:', expenditureId);
    console.log('💾 PADRE: Data recibida:', data);

    const conceptsData = data.concepts || data;
    const subtotal = data.subtotal || 0;
    const tax = data.tax || 0;
    const total = data.total || 0;

    const newConcepts = conceptsData.filter((row: any) => row.__isNew);
    const modifiedConcepts = conceptsData.filter((row: any) => row.__modified && !row.__isNew);

    console.log('💾 PADRE: Conceptos NUEVOS:', newConcepts.length);
    console.log('💾 PADRE: Conceptos MODIFICADOS:', modifiedConcepts.length);
    console.log('💾 PADRE: Total conceptos:', conceptsData.length);

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
        total: total,
        countitems: conceptsData.length,
        idBranch: mainDocument.idBranch // Preservar la sucursal existente
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
      }

      console.log('💾 PADRE: Actualizando maestro después de guardar. ID:', expenditureId);

      this.updateExpenditureCountItems(expenditureId, conceptsData.length);

      this.updateMasterRowInGrid({
        id: expenditureId,
        subtotal: subtotal,
        tax: tax,
        total: total
      });

      console.log('✅ PADRE: Maestro actualizado con totales');

    } catch (error) {
      console.error('Error saving concepts:', error);
      alerts.basicAlert(
        'Error',
        'Error al guardar los conceptos.',
        'error'
      );
    }
  }

  async deleteConceptRow(params: any, successCallback: () => void, newCount?: number) {
    const conceptId = params.data.id;
    const expenditureId = params.data.idIncorExp;

    if (params.data.__isNew) {
      if (params.api) {
        params.api.applyTransaction({ remove: [params.data] });
      }
      successCallback();
    } else {
      try {
        await lastValueFrom(this.incomesAndExpensesService.deleteConceptFromIncomesAndExpenses(conceptId));

        // Actualizar countItems en la base de datos
        if (expenditureId && typeof newCount === 'number') {
          const mainDocResponse: any[] = await lastValueFrom(
            this.incomesAndExpensesService.getIncomeAndExpenseById(expenditureId)
          );
          if (mainDocResponse && mainDocResponse[0]) {
            const mainDoc = mainDocResponse[0];
            const updatedDoc = {
              ...mainDoc,
              countitems: newCount
            };
            await lastValueFrom(
              this.incomesAndExpensesService.updateIncomesAndExpenses(expenditureId, updatedDoc)
            );
            console.log(`✅ countItems actualizado en BD: ${newCount}`);
          }
        }

        alerts.basicAlert('Concepto eliminado', 'El concepto se eliminó correctamente.', 'success');
        if (params.api) {
          params.api.applyTransaction({ remove: [params.data] });
        }
        successCallback();
      } catch (error) {
        console.error('Error deleting concept:', error);
        alerts.basicAlert('Error', 'Error al eliminar el concepto.', 'error');
      }
    }
  }

  private cleanConceptData(concept: any): any {
    const cleaned = { ...concept };
    delete cleaned.__isNew;
    delete cleaned.__modified;
    if (cleaned.id && cleaned.id.toString().startsWith('temp_')) {
      delete cleaned.id;
    }
    return cleaned;
  }

  // ==================== MÉTODOS PARA ACTUALIZAR MAESTRO ====================

  private updateMasterRow(updatedData: any) {
    if (!this.gridApi) return;

    const rowNode = this.gridApi.getRowNode(updatedData.id.toString());
    if (rowNode) {
      const currentData = rowNode.data;
      currentData.subtotal = updatedData.subtotal;
      currentData.tax = updatedData.tax;
      currentData.total = updatedData.total;
      this.gridApi.applyTransaction({ update: [currentData] });
      console.log(`Fila maestra ${updatedData.id} actualizada con nuevos totales.`);
    }
  }

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

    const selectedNodes = this.gridApi.getSelectedNodes();
    const currentSelectedId = selectedNodes.length > 0 ? selectedNodes[0].data.id : null;
    console.log('🔖 Selección actual guardada:', currentSelectedId);

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

      console.log('🔄 Aplicando transacción...');
      this.gridApi.applyTransaction({ update: [currentData] });
      console.log('✅ Transacción aplicada');

      setTimeout(() => {
        this.gridApi.refreshCells({
          rowNodes: [rowNode],
          columns: ['subtotal', 'tax', 'total'],
          force: true
        });
        console.log('✅ Celdas refrescadas');
      }, 100);

      console.log(`✅ Fila maestra ${updatedData.id} actualizada con nuevos totales.`);

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

      console.log('🔄 Ejecutando Plan B - Actualizar array local...');
      const itemIndex = this.incomes.findIndex(item => item.id === updatedData.id);
      console.log('🔍 Índice en array local:', itemIndex);

      if (itemIndex !== -1) {
        this.incomes[itemIndex].subtotal = updatedData.subtotal;
        this.incomes[itemIndex].tax = updatedData.tax;
        this.incomes[itemIndex].total = updatedData.total;

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
