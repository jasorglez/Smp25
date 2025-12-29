
//soriano develop

import { Component, effect, inject, HostListener } from '@angular/core';
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
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
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
import { PdfButtonCellRendererComponent } from './pdf-button-cell-renderer.component';
import { CatalogsService } from 'app/services/catalogs.service';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { ProviderModalService } from './services/provider-modal.service';
import { CustomersService } from 'app/services/customers.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-egresos-palacio',
  standalone: true,
  imports: [NgSelectModule, NgSelectComponent, AgGridModule, MultiLineEditorComponent, CommonModule,
    FormsModule, ButtonCellRendererExpenditureComponent, DetailCellRendererExpenditureComponent,
    PdfButtonCellRendererComponent, SelectWithTooltipEditorV2Component, DatePipe],
  templateUrl: './egresos-palacio.component.html',
  styleUrl: './egresos-palacio.component.scss'
})
export class EgresosPalacioComponent {

  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  private modalServiceTable = inject(ModalService);
  private administrationService = inject(AdministrationService);
  private cataalogAdmonService = inject(CatalogadmonService);
  private catalogsService = inject(CatalogsService);
  private usersxpermissionsService = inject(UsersxpermissionsService);
  private usersService = inject(UsersService);
  private signalsService = inject(SignalsService);
  private branchesService = inject(BranchsService);
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);
  private providerModalService = inject(ProviderModalService);
  private customersService = inject(CustomersService);
  authService = inject(AuthService);
  public trackingService = inject(TrackingService);

  public isIncomeMode: boolean = false;

  // Propiedades para el modal de reporte consolidado
  showConsolidatedReportModal: boolean = false;
  reportStartDate: string = '';
  reportEndDate: string = '';
  isGeneratingConsolidatedReport: boolean = false;

  // Propiedades para el modal de proveedor
  showProviderModal: boolean = false;
  newProvider: any = {
    idRoot: 0,
    idBranch: 0,
    idTypecop: 3, // PROVEEDOR
    nameContact: '',
    company: '',
    rfc: '',
    city: '',
    position: 'GERENCIA',
    address: '',
    addressFiscal: '',
    cp: '',
    state: '',
    neighborhood: '',
    total: 0,
    radio: 0,
    phone: '',
    mobile: '',
    email: 'info@x.com',
    vigente: true,
    numCliente: 0,
    latitud: '',
    longitud: '',
    typeCustomer: '',
    typework: '',
    type: 'PROVIDERS',
    fieldContact: 0,
    fieldBank: 0,
    fieldCuenta: 0,
    active: true
  };

  async ngOnInit() {

  }

  constructor() {
    effect(async () => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();

      if (!this.idRoot) return;

      await this.getBillingManagementInfo();
      await this.getBankAccounts();
      await this.getBills();
      await this.getTypeComps();
      await this.getExpenditure();
      await this.loadAuthorizers();
      await this.getCurrentUser();
      await this.obtenerBranchs();
    });

    effect(() => {
      const updateData = this.signalsService.getMasterUpdateTrigger()();

      if (updateData && updateData.id && typeof updateData.subtotal === 'number') {
        if (this.gridApi) {
          setTimeout(() => {
            this.updateMasterRowInGrid({
              id: updateData.id,
              subtotal: updateData.subtotal,
              tax: updateData.tax,
              total: updateData.total
            });
          }, 50);
        } else {
          this.pendingMasterUpdate = {
            id: updateData.id,
            subtotal: updateData.subtotal,
            tax: updateData.tax,
            total: updateData.total
          };
        }
      }
    });

    this.providerModalService.modalRequest$.subscribe((data) => {
      this.openProviderModal(data.idRoot);
    });
  }


  // ✅ CORRECCIÓN: Agregar propiedad para datos pendientes
  private pendingMasterUpdate: any = null;
  private isGeneratingReport: boolean = false; // Flag para evitar múltiples clics
  private lastSavedIds: number[] = []; // IDs de los registros que se acaban de guardar
  private workingRowId: number | string | null = null; // ID del registro en el que se está trabajando (puede ser temp_ para nuevos)
  externalFilterActive: boolean = false;
  showform: string = '';
  branchs: any[] = [];
  incomes: any[] = [];
  expenses: any[] = [];
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
  typeComps: any[] = [];

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
    this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Cuentas Bancarias`, 'Palacio Municipal - Egresos',
      this.trackingService.getEmail());
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
    detailCellRenderer: DetailCellRendererExpenditureComponent,
    suppressMenuHide: false,
    popupParent: document.body,
    isExternalFilterPresent: () => {
      return this.externalFilterActive;
    },
    doesExternalFilterPass: (node: any) => {
      return node.data.visible !== false;
    },
    tooltipShowDelay: 500,
    tooltipHideDelay: 10000,
    getRowClass: (params) => {
      // Verificar si la fila está seleccionada
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    getRowStyle: (params) => {
      // Prioridad 1: Fila seleccionada (rojo claro)
      if (params.node.isSelected()) {
        return { backgroundColor: '#ffe6e6', color: '#000000', fontWeight: 'bold' };
      }

      // Prioridad 2: Fila en la que se está trabajando (amarillo destacado con borde)
      if (params.data && this.workingRowId && params.data.id === this.workingRowId) {
        return {
          backgroundColor: '#fff9c4',
          color: '#000000',
          fontWeight: 'bold',
          borderLeft: '4px solid #ffa000',
          borderRight: '4px solid #ffa000'
        };
      }

      // Prioridad 3: Filas recién guardadas (verde claro brillante)
      if (params.data && this.lastSavedIds.includes(params.data.id)) {
        return { backgroundColor: '#c8e6c9', color: '#000000', fontWeight: 'bold' };
      }

      // Prioridad 4: Validación de montos "Por Comprobar" vs "Comprobado"
      if (params.data) {
        const porComprobar = Number(params.data.totalComp) || 0;
        const comprobado = Number(params.data.total) || 0;

        // Si los montos no coinciden, resaltar en rojo
        if (porComprobar !== comprobado && porComprobar > 0) {
          const diferencia = Math.abs(porComprobar - comprobado);
          return {
            backgroundColor: '#ffe6e6',
            color: '#cc0000',
            fontWeight: 'bold',
            borderLeft: '4px solid #cc0000',
            borderRight: '4px solid #cc0000'
          };
        }
      }

      // Prioridad 5: Estados por defecto
      if (params.data) {
        switch (params.data.status) {
          case 'Pendiente':
            return { backgroundColor: '#cce5ff', color: '#000000' }; // Azul claro con texto negro
          case 'Pagada':
            return { backgroundColor: '#d4edda', color: '#000000' }; // Verde claro con texto negro
          case 'Cancelada':
            return { backgroundColor: '#f8d7da', color: '#000000' }; // Rojo claro con texto negro
          case 'Entregada':
            return { backgroundColor: '#fff3cd', color: '#000000' }; // Amarillo claro con texto negro
          default:
            return { color: '#000000' }; // Negro por defecto
        }
      }
      return { color: '#000000' }; // Negro por defecto
    },
    onRowClicked: (event) => {
      // Seleccionar la fila al hacer clic en cualquier celda, excepto en la columna PDF
      if (event.column && event.column.getColId() !== 'pdfReport') {
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
    onCellKeyDown: (event: any) => {
      // Cuando se presiona Enter
      if (event.event.key === 'Enter' && !event.event.shiftKey) {
        event.event.preventDefault();
        event.event.stopPropagation();

        const currentColumn = event.column ? event.column.getColId() : '';

        // Secuencia de navegación: date -> idTypeComp -> idExpend -> totalComp
        if (currentColumn === 'date') {
          setTimeout(() => {
            this.gridApi.setFocusedCell(event.node.rowIndex, 'idTypeComp');
            this.gridApi.startEditingCell({
              rowIndex: event.node.rowIndex,
              colKey: 'idTypeComp'
            });
          }, 50);
        } else if (currentColumn === 'idTypeComp') {
          setTimeout(() => {
            this.gridApi.setFocusedCell(event.node.rowIndex, 'idExpend');
            this.gridApi.startEditingCell({
              rowIndex: event.node.rowIndex,
              colKey: 'idExpend'
            });
          }, 50);
        } else if (currentColumn === 'idExpend') {
          setTimeout(() => {
            this.gridApi.setFocusedCell(event.node.rowIndex, 'totalComp');
            this.gridApi.startEditingCell({
              rowIndex: event.node.rowIndex,
              colKey: 'totalComp'
            });
          }, 50);
        }
      }
    },
  };

  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];

  public defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: true,
    editable: false,
    wrapHeaderText: true,
    autoHeaderHeight: true,
    tooltipValueGetter: (params: any) => {
      if (params.data) {
        const porComprobar = Number(params.data.totalComp) || 0;
        const comprobado = Number(params.data.total) || 0;
        if (porComprobar !== comprobado && porComprobar > 0) {
          const diferencia = Math.abs(porComprobar - comprobado);
          return `⚠️ Falta Comprobar: $${diferencia.toFixed(2)}`;
        }
      }
      return null;
    }
  };

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
          date: income.date ? new Date(income.date) : null, // Convertir a Date
          countItems: income.countItems || 0, // Usar valor de la BD si existe
          countDocomps: income.countDocomps || 0, // Usar valor de la BD si existe
          detailType: null,
          detailData: [],
          visible: true,
          objetoGastoCodigo: this.expenses.find(e => e.id === income.idExpend)?.codigo || ''
        }));

        // Contadores se actualizan localmente al interactuar con el detalle
      },
      error: (err) => {
        // Manejo de errores HTTP
        console.error('Error obteniendo egresos. Código:', err.status, 'Detalles:', err);
        this.incomes = [];
      }
    });
    this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Egresos`, 'Palacio Municipal - Egresos',
      this.trackingService.getEmail());
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
      this.trackingService.getEmail());
  }

  async getTypeComps() {
    this.cataalogAdmonService.getCatalogs(this.idRoot, 'TYPECOMP').subscribe(
      (data: any) => {
        this.typeComps = data;
      },
      error => {
        console.error(error);
      }
    )
    this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Tipos de Comprobante`, 'Palacio Municipal - Egresos',
      this.trackingService.getEmail());
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
  private formatDate(value: string | Date | null | undefined): string {
    if (!value) return '';
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) return '';
      return [
        date.getDate().toString().padStart(2, '0'),
        (date.getMonth() + 1).toString().padStart(2, '0'),
        date.getFullYear()
      ].join('/');
    } catch (error) {
      return '';
    }
  }

  // Función para obtener el nombre del mes en español
  private getMonthName(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const meses = [
      'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
      'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
    ];
    return meses[dateObj.getMonth()];
  }

  // Column Definitions: Defines the columns to be displayed.
  // CRÍTICO: Debe ser una propiedad cacheada, NO un getter puro, para evitar re-evaluación constante
  // que causa re-renderizado de filtros en cada ciclo de change detection
  private _colMaster: ColDef[] = [];

  get colMaster(): ColDef[] {
    // Si ya fue inicializado, retornar la misma instancia
    if (this._colMaster.length > 0) {
      return this._colMaster;
    }

    // Inicializar una sola vez
    this._colMaster = [
      {
        headerName: '#',
        width: 50,
        valueGetter: (params) => params.node!.rowIndex! + 1,
        pinned: 'left',
        cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' }
      },
      {
        field: 'countItems',
        headerName: 'Items',
        width: 80,
        cellRenderer: ButtonCellRendererExpenditureComponent,
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
        cellRenderer: PdfButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => {
            console.log('🔵 PDF Click detectado desde PdfButtonCellRenderer:', node.data.id);
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
        field: 'countDocomps',
        headerName: 'Comprobación',
        width: 130,
        cellRenderer: ButtonCellRendererExpenditureComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleComprobacionDetail(node),
          icon: 'bi-file-earmark-check',
          title: 'Hacer clic para ver los documentos comprobados'
        },
        valueGetter: params => params.data.countDocomps || 0,
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
        },
        cellRenderer: (params: any) => {
          if (!params.data) return params.value;

          const porComprobar = Number(params.data.totalComp) || 0;
          const comprobado = Number(params.data.total) || 0;

          if (porComprobar !== comprobado && porComprobar > 0) {
            const diferencia = Math.abs(porComprobar - comprobado);
            const tooltip = `Falta Comprobar: $${diferencia.toFixed(2)}`;
            return `<span title="${tooltip}" class="cell-mismatch">${params.value || ''}</span>`;
          }

          return params.value || '';
        }
      },

      {
        field: 'facturado',
        headerName: 'Comprobado',
        cellRenderer: 'agCheckboxCellRenderer',
        cellEditor: 'agCheckboxCellEditor',
        editable: true,
        width: 100
      },

      {
        field: 'numberDocument',
        headerName: '# Doc/Fac',
        editable: false,
        filter: true,
        width: 120,
        hide: false,
        tooltipValueGetter: (params) => {
          if (params.data) {
            const porComprobar = Number(params.data.totalComp) || 0;
            const comprobado = Number(params.data.total) || 0;
            if (porComprobar !== comprobado && porComprobar > 0) {
              const diferencia = Math.abs(porComprobar - comprobado);
              return `Falta Comprobar: $${diferencia.toFixed(2)} (Por Comprobar: $${porComprobar.toFixed(2)} - Comprobado: $${comprobado.toFixed(2)})`;
            }
          }
          return null;
        }
      },
      {
        field: 'date',
        headerName: 'Fecha',
        editable: true,
        filter: 'agSetColumnFilter',
        filterParams: {
          //   excelMode: 'mac',
          defaultToNothingSelected: true,
        },
        cellDataType: 'date',
        width: 95,
        valueFormatter: (params) => {
          if (!params.value) return '';
          const date = params.value instanceof Date ? params.value : new Date(params.value);
          return this.formatDate(date);
        },
        valueGetter: (params) => {
          // Asegurar que siempre devuelva un objeto Date
          if (!params.data.date) return null;
          return params.data.date instanceof Date ? params.data.date : new Date(params.data.date);
        },
        valueSetter: (params) => {
          // Asegurar que siempre se guarde como objeto Date
          if (!params.newValue) {
            params.data.date = params.oldValue;
            return false;
          }
          return true;
        },
      },
      {
        field: 'idTypeComp', headerName: 'Tipo Comprobante', editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true
        }, width: 110,
        wrapText: true,
        autoHeight: true,
        cellStyle: { 'white-space': 'normal', 'line-height': '1.4' },
        cellEditor: SelectWithTooltipEditorV2Component,
        cellEditorParams: {
          options: this.typeComps.map(obj => ({
            id: obj.id,
            description: obj.description,
            valueAddition: obj.id.toString(),
            valueAddition2: obj.description
          }))
        },
        valueFormatter: (params) => {
          const foundItem = this.typeComps
            ? this.typeComps.find((item) => item.id === params.value)
            : null;
          return foundItem ? foundItem.description : params.value;
        },
      },

      {
        field: 'idExpend', headerName: 'Objeto de Gasto',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true
        }, width: 170,
        wrapText: true,
        autoHeight: true,
        cellStyle: { 'white-space': 'normal', 'line-height': '1.4' },
        cellEditor: SelectWithTooltipEditorV2Component,
        cellEditorParams: {
          options: this.expenses.map(obj => ({
            id: obj.id,
            description: `${obj.codigo} - ${obj.nombre}`,
            valueAddition: obj.codigo || '',
            valueAddition2: obj.nombre || ''
          }))
        },
        valueFormatter: (params) => {
          const foundItem = this.expenses
            ? this.expenses.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.codigo} - ${foundItem.nombre}` : params.value;
        },
      },

      {
        field: 'description',
        headerName: 'Descripción',
        editable: false, // No editable directamente, solo mediante modal
        width: 155,
        filter: true,
        wrapText: true,
        cellStyle: {
          'white-space': 'normal',
          'line-height': '1.4',
          cursor: 'pointer',
          textDecoration: 'underline dotted'
        },
        onCellClicked: (event: any) => {
          // Abrir modal con un solo clic para mejor UX
          if (!event.node.group) {
            this.modalServiceTable.showModal({
              params: event,
              value: event.value || '',
            });
          }
        },
        onCellDoubleClicked: (event: CellDoubleClickedEvent) => {
          // También soportar doble clic
          if (!event.node.group) {
            this.modalServiceTable.showModal({
              params: event,
              value: event.value || '',
            });
          }
        },
        cellRenderer: (params: any) => {
          if (!params.data) return params.value;

          const porComprobar = Number(params.data.totalComp) || 0;
          const comprobado = Number(params.data.total) || 0;

          if (porComprobar !== comprobado && porComprobar > 0) {
            const diferencia = Math.abs(porComprobar - comprobado);
            const tooltip = `Falta Comprobar: $${diferencia.toFixed(2)}`;
            return `<span title="${tooltip}" class="cell-mismatch">${params.value || ''}</span>`;
          }

          return params.value || '';
        }
      },

      {
        field: 'subtotal',
        headerName: 'Subtotal',
        editable: false,
        hide: true,
        width: 100,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },

      {
        field: 'totalComp',
        headerName: 'Por Comprobar',
        editable: true,
        width: 140,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }),
        cellRenderer: (params: any) => {
          if (!params.data) return params.valueFormatted || '';

          const porComprobar = Number(params.data.totalComp) || 0;
          const comprobado = Number(params.data.total) || 0;

          if (porComprobar !== comprobado && porComprobar > 0) {
            const diferencia = Math.abs(porComprobar - comprobado);
            const tooltip = `Falta Comprobar: $${diferencia.toFixed(2)}`;
            return `<span title="${tooltip}" class="cell-mismatch">${params.valueFormatted || ''}</span>`;
          }

          return params.valueFormatted || '';
        }
      },

      {
        field: 'total',
        headerName: 'Comprobado',
        editable: false,
        width: 130,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }),
        cellRenderer: (params: any) => {
          if (!params.data) return params.valueFormatted || '';

          const porComprobar = Number(params.data.totalComp) || 0;
          const comprobado = Number(params.data.total) || 0;

          if (porComprobar !== comprobado && porComprobar > 0) {
            const diferencia = Math.abs(porComprobar - comprobado);
            const tooltip = `Falta Comprobar: $${diferencia.toFixed(2)}`;
            return `<span title="${tooltip}" class="cell-mismatch">${params.valueFormatted || ''}</span>`;
          }

          return params.valueFormatted || '';
        }
      },

      {
        field: 'tax',
        headerName: 'Impuestos',
        hide: true,
        editable: false,
        width: 100,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
      {
        field: 'isr',
        headerName: 'ISR',
        editable: false,
        hide: true,
        width: 100,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },

      {
        field: 'createdBy',
        headerName: 'Autoriza',
        hide: true,
        editable: false,
        width: 105
      },

      {
        field: 'mostrartodo',
        headerName: 'Mostrar Todos',
        cellRenderer: 'agCheckboxCellRenderer',
        cellEditor: 'agCheckboxCellEditor',
        editable: true,
        width: 120
      }

    ];

    // Retornar la instancia inicializada
    return this._colMaster;
  }

  onSelectedRow(event: any) {
    this.id = event.data.id;
    this.workingRowId = event.data.id; // Marcar como fila de trabajo
    this.signalsService.setIdIncomeAndExpense(this.id);

    // Refrescar el grid para actualizar el estilo de las filas
    this.gridApi?.redrawRows();
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedIncomes = selectedNodes[0].data;
      this.workingRowId = selectedNodes[0].data.id; // Marcar como fila de trabajo
      this.signalsService.setIdIncomeAndExpense(this.selectedIncomes.id);
    } else {
      this.selectedIncomes = null;
    }

    // Refrescar el grid para actualizar el estilo de las filas
    this.gridApi?.redrawRows();
  }

  onCellValueChanged(event: any) {
    // Marcar la fila como fila de trabajo
    this.workingRowId = event.data.id;

    // Si se cambió la fecha, actualizar automáticamente el mes y refrescar la celda
    if (event.colDef.field === 'date' && event.newValue) {
      const fechaPago = new Date(event.newValue);
      event.data.paymentMonth = this.getMonthName(fechaPago);

      // Asegurar que la fecha se guarde como objeto Date
      event.data.date = fechaPago;

      // Refrescar la celda para mostrar el formato correcto
      this.gridApi.refreshCells({
        rowNodes: [event.node],
        columns: ['date'],
        force: true
      });
    }

    // Si se cambió el Objeto de Gasto, componer automáticamente la Descripción
    if (event.colDef.field === 'idExpend' && event.newValue) {
      const objetoSeleccionado = this.expenses.find(obj => obj.id === event.newValue);
      if (objetoSeleccionado && event.data.paymentMonth && event.data.date) {
        // Obtener el año de la fecha
        const fechaPago = new Date(event.data.date);
        const year = fechaPago.getFullYear();

        // Componer: Mes - Año
        event.data.description = `${event.data.paymentMonth} -${year}`;

        // Refrescar la celda de descripción
        this.gridApi.refreshCells({
          rowNodes: [event.node],
          columns: ['description'],
          force: true
        });
      }
    }

    // Actualizar campos de modificación solo para filas existentes
    if (!event.data.__isNew) {
      event.data.modifiedBy = this.currentUser;
      event.data.modifiedAt = new Date().toISOString();
    }

    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onCellDoubleClicked(event: CellDoubleClickedEvent) {
    // Si es la columna "date", permitir edición con doble click
    if (event.colDef.field === 'date') {
      this.gridApi.startEditingCell({
        rowIndex: event.rowIndex,
        colKey: 'date'
      });
      return;
    }

    // Al hacer doble click en cualquier otra celda, mostrar todas las filas
    // y colapsar cualquier detalle expandido
    if (event.node.expanded) {
      event.node.setExpanded(false);
      event.node.data.detailType = null;
    }

    // Mostrar todas las filas
    this.externalFilterActive = false;
    this.gridApi.forEachNode((node) => {
      node.data.visible = true;
    });
    this.gridApi.onFilterChanged();
  }

  onGridReady(params: GridReadyEvent) {
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
        typeComps: this.typeComps,
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
            this.updateExpenditureCountItems(expenditureId, count);
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
            this.updateExpenditureCountDocomps(expenditureId, count);
          }
        }
      }
    });

    if (this.pendingMasterUpdate) {
      setTimeout(() => {
        this.updateMasterRowInGrid(this.pendingMasterUpdate);
        this.pendingMasterUpdate = null;
      }, 100);
    }
  }
  addRow() {
    this.trackingService.addLog(this.trackingService.getnameComp(), `Creacion de un Egreso`, 'Palacio Municipal - Egresos',
      this.trackingService.getEmail());

    const now = new Date();

    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idAccount: this._idAccount,
      numberDocument: "",
      idBusinnes: this.idRoot,
      idBranch: 0,
      date: now,
      idTypeComp: 0,
      totalComp: 0,
      idCustomer: 0,
      idExpend: 0,
      uuid: "NA",
      paymentMonth: this.getMonthName(now),
      dateStamped: new Date().toISOString(),
      description: "POR COMPROBAR",
      type: "GASTO",
      subtotal: 0,
      tax: 0,
      isr: 0,
      total: 0,
      facturado: false,
      createdBy: this.currentUser || 'Usuario temporal',
      createdAt: new Date().toISOString(),
      modifiedBy: this.currentUser || 'Usuario temporal',
      modifiedAt: new Date().toISOString(),
      status: "Pagada",
      active: true,
      __isNew: true,
      visible: true,
    };
    this.incomes = [newItem, ...this.incomes];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;

    // Marcar como fila de trabajo
    this.workingRowId = tempId;

    // Encontrar el índice de la nueva fila
    const newRowIndex = this.incomes.findIndex((row) => row.id === tempId);

    // Refrescar el grid y la celda de fecha para aplicar el formato correcto
    setTimeout(() => {
      this.gridApi.ensureIndexVisible(newRowIndex);

      // Refrescar la celda de fecha para aplicar el valueFormatter
      const rowNode = this.gridApi.getDisplayedRowAtIndex(newRowIndex);
      if (rowNode) {
        // Seleccionar la nueva fila
        rowNode.setSelected(true);

        this.gridApi.refreshCells({
          rowNodes: [rowNode],
          columns: ['date'],
          force: true
        });
      }

      // Refrescar el grid para aplicar el estilo de fila de trabajo
      this.gridApi.redrawRows();

      // Iniciar edición en la columna 'date' con la fecha actual
      this.gridApi.startEditingCell({
        rowIndex: newRowIndex,
        colKey: 'date',
      });
    }, 100); // Aumentar delay para asegurar que se aplique el formato
  }

  @HostListener('document:keydown.f10', ['$event'])
  handleKeyboardEvent(event: Event) {
    event.preventDefault();
    if (this.gridApi) {
      this.gridApi.stopEditing();
    }
    // Dar tiempo a que el grid procese la edición y actualice el modelo
    setTimeout(() => {
      this.saveChanges();
    }, 100);
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

    const hasNegativeTotal = this.incomes.some((item) => item.total < 0);
    if (hasNegativeTotal) {
      alerts.basicAlert(
        'Error de validación',
        'El total no puede ser negativo.',
        'error'
      );
      return;
    }

    const newRows = this.incomes.filter((row) => row.__isNew);
    const modifiedRows = this.incomes.filter(
      (row) => row.__modified && !row.__isNew
    );

    if (newRows.length === 0 && modifiedRows.length === 0) {
      // Verificar si hay filas expandidas (detalle abierto) antes de mostrar alerta
      let hasExpandedRows = false;
      if (this.gridApi) {
        this.gridApi.forEachNode((node) => {
          if (node.expanded) hasExpandedRows = true;
        });
      }

      if (!hasExpandedRows) {
        alerts.basicAlert('Información', 'No se detectaron cambios para guardar.', 'info');
      }
      return;
    }

    // Guardar los IDs de las filas modificadas (para registros existentes)
    const idsToHighlight = modifiedRows
      .filter(row => !row.id.toString().startsWith('temp_'))
      .map(row => row.id);

    // Guardar los números de documento de las nuevas filas para encontrarlas después
    const newRowDocNumbers: string[] = [];

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
        const docNumber = `${this.prefixAndConsecutive[0].prefixexp}${currentConsecutive.toString().padStart(4, '0')}`;
        row.numberDocument = docNumber;
        newRowDocNumbers.push(docNumber);
      });
    }

    try {
      // Guardar los registros de egresos
      const savedResults = await this.saveExpenditureRecords(newRows, modifiedRows);

      // Agregar los IDs de los nuevos registros guardados
      if (savedResults && savedResults.length > 0) {
        savedResults.forEach((result: any) => {
          if (result?.id) {
            idsToHighlight.push(result.id);
          }
        });
      }

      // Guardar los IDs y números de documento para resaltarlos después de recargar
      this.lastSavedIds = idsToHighlight;

      // Si no se obtuvieron IDs de los resultados, usaremos los números de documento
      if (newRowDocNumbers.length > 0 && idsToHighlight.length === modifiedRows.length) {
        // Solo tenemos IDs de filas modificadas, necesitaremos buscar las nuevas por número de documento
        this.lastSavedIds = [...idsToHighlight, ...newRowDocNumbers as any];
      }

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

      // Refrescar los datos
      await this.getExpenditure();

      // Después de recargar, seleccionar y hacer scroll al primer registro guardado
      setTimeout(() => {
        if (this.lastSavedIds.length > 0 && this.gridApi) {
          let firstNodeFound: any = null;

          // Buscar los nodos correspondientes y construir lista de IDs reales
          const realIds: number[] = [];
          this.gridApi.forEachNode((node) => {
            // Buscar por ID numérico
            if (typeof this.lastSavedIds[0] === 'number' && node.data.id === this.lastSavedIds[0]) {
              if (!firstNodeFound) firstNodeFound = node;
            }

            // Buscar también por número de documento (para las filas nuevas)
            this.lastSavedIds.forEach((savedId: any) => {
              if (typeof savedId === 'string' && node.data.numberDocument === savedId) {
                realIds.push(node.data.id);
                if (!firstNodeFound) firstNodeFound = node;
              } else if (typeof savedId === 'number' && node.data.id === savedId) {
                realIds.push(node.data.id);
              }
            });
          });

          // Actualizar la lista con IDs reales
          this.lastSavedIds = [...new Set([...this.lastSavedIds.filter(id => typeof id === 'number'), ...realIds])];

          // Seleccionar y hacer scroll al primer nodo encontrado
          if (firstNodeFound) {
            firstNodeFound.setSelected(true);
            this.gridApi.ensureNodeVisible(firstNodeFound, 'middle');
            this.workingRowId = firstNodeFound.data.id;
          }

          // Refrescar el grid para aplicar los estilos de resaltado
          this.gridApi.redrawRows();

          // Limpiar el resaltado después de 5 segundos
          setTimeout(() => {
            this.lastSavedIds = [];
            this.workingRowId = null;
            this.gridApi?.redrawRows();
          }, 5000);
        }
      }, 500);

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

    // Mostrar confirmación antes de eliminar
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

    // Eliminar propiedades internas del frontend
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.detailType;
    delete cleanedData.detailData;
    delete cleanedData.visible;
    delete cleanedData.objetoGastoCodigo;

    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }

    // Convertir Date a ISO string para el servidor
    if (cleanedData.date && cleanedData.date instanceof Date) {
      cleanedData.date = cleanedData.date.toISOString();
    }

    return cleanedData;
  }

  // Método para guardar los registros de egresos
  private async saveExpenditureRecords(newRows: any[], modifiedRows: any[]): Promise<any[]> {
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
      const results = await lastValueFrom(
        forkJoin(allObservables) // Usar forkJoin para ejecutar todas en paralelo
      );
      return results || [];
    }

    return [];
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
    }
  }


  private updateMasterRowInGrid(updatedData: { id: number; subtotal: number; tax: number; isr?: number; total: number }) {
    if (!this.gridApi || !updatedData?.id) return;

    const selectedNodes = this.gridApi.getSelectedNodes();
    const currentSelectedId = selectedNodes.length > 0 ? selectedNodes[0].data.id : null;

    const rowNode = this.gridApi.getRowNode(updatedData.id.toString());

    if (rowNode) {
      const currentData = rowNode.data;
      currentData.subtotal = updatedData.subtotal;
      currentData.tax = updatedData.tax;
      if (updatedData.isr !== undefined) {
        currentData.isr = updatedData.isr;
      }
      currentData.total = updatedData.total;

      this.gridApi.applyTransaction({ update: [currentData] });

      if (currentSelectedId === updatedData.id) {
        setTimeout(() => {
          const updatedNode = this.gridApi.getRowNode(updatedData.id.toString());
          if (updatedNode) {
            updatedNode.setSelected(true);
            this.gridApi.ensureNodeVisible(updatedNode);
          }
        }, 50);
      }
    } else {
      const itemIndex = this.incomes.findIndex(item => item.id === updatedData.id);

      if (itemIndex !== -1) {
        this.incomes[itemIndex].subtotal = updatedData.subtotal;
        this.incomes[itemIndex].tax = updatedData.tax;
        if (updatedData.isr !== undefined) {
          this.incomes[itemIndex].isr = updatedData.isr;
        }
        this.incomes[itemIndex].total = updatedData.total;

        setTimeout(() => {
          if (currentSelectedId) {
            const nodeToSelect = this.gridApi.getRowNode(currentSelectedId.toString());
            if (nodeToSelect) {
              nodeToSelect.setSelected(true);
              this.gridApi.ensureNodeVisible(nodeToSelect);
            }
          }
        }, 100);
      }
    }
  }

  // ==================== MÉTODOS PARA CASCADAS ====================

  toggleCascade(node: any) {
    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data.detailType === 'concepts';

    if (isCurrentlyExpanded) {
      // Si ya está expandido con conceptos, colapsarlo y mostrar todas las filas
      node.setExpanded(false);
      node.data.detailType = null;
      this.externalFilterActive = false;
      api.forEachNode((n: any) => {
        n.data.visible = true;
      });
      api.onFilterChanged();
    } else {
      // Expandir con conceptos, ocultar las demás filas
      this.externalFilterActive = true;
      api.forEachNode((n: any) => {
        n.data.visible = n.id === node.id ? true : false;
      });
      api.onFilterChanged();

      // Si la fila está expandida con otro tipo de detalle, cerrarla
      if (node.expanded && node.data.detailType !== 'concepts') {
        node.setExpanded(false);
      }

      // Cambiar el tipo de detalle a 'concepts'
      node.data.detailType = 'concepts';

      // Expandir con los conceptos
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
      // Si ya está expandido con el reporte, colapsarlo y mostrar todas las filas
      console.log('🟡 Colapsando reporte expandido');
      node.setExpanded(false);
      node.data.detailType = null;
      this.externalFilterActive = false;
      api.forEachNode((n: any) => {
        n.data.visible = true;
      });
      api.onFilterChanged();
      return; // Salir temprano
    }

    // Verificar si ya se está generando un reporte
    if (this.isGeneratingReport) {
      console.log('🔴 Ya se está generando un reporte, ignorando clic');
      alerts.basicAlert(
        'Procesando',
        'Ya se está generando un reporte. Por favor espere.',
        'warning'
      );
      return;
    }

    // Marcar que se está generando
    this.isGeneratingReport = true;
    console.log('🟢 Iniciando generación de reporte');

    // Mostrar mensaje de progreso inicial
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
      // Expandir con reporte, ocultar las demás filas
      this.externalFilterActive = true;
      api.forEachNode((n: any) => {
        n.data.visible = n.id === node.id ? true : false;
      });
      api.onFilterChanged();

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

      // Expandir con el reporte
      await new Promise(resolve => setTimeout(resolve, 1000));
      node.setExpanded(true);

      // Completar progreso al 100%
      clearInterval(progressInterval);
      alerts.updateLoadingProgress(
        'Reporte generado',
        'El documento se ha procesado correctamente',
        100
      );

      console.log('✅ Reporte generado exitosamente');

      // Cerrar mensaje de carga después de 800ms
      setTimeout(() => {
        alerts.closeLoading();
        this.isGeneratingReport = false; // Liberar el lock
        console.log('🔓 Lock liberado');
      }, 800);

    } catch (error) {
      clearInterval(progressInterval);
      alerts.closeLoading();
      this.isGeneratingReport = false; // Liberar el lock en caso de error
      console.log('🔴 Error generando reporte, lock liberado');
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al generar el reporte. Por favor, intente nuevamente.',
        'error'
      );
      console.error('Error generando reporte:', error);
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
      // Mostrar todas las filas
      this.externalFilterActive = false;
      this.gridApi.forEachNode((node) => {
        node.data.visible = true;
      });
      this.gridApi.onFilterChanged();
    }
  }

  toggleComprobacionDetail(node: any) {
    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data.detailType === 'comprobacion';

    if (isCurrentlyExpanded) {
      // Si ya está expandido con comprobación, colapsarlo y mostrar todas las filas
      node.setExpanded(false);
      node.data.detailType = null;
      this.externalFilterActive = false;
      api.forEachNode((n: any) => {
        n.data.visible = true;
      });
      api.onFilterChanged();
    } else {
      // Expandir con comprobación, ocultar las demás filas
      this.externalFilterActive = true;
      api.forEachNode((n: any) => {
        n.data.visible = n.id === node.id ? true : false;
      });
      api.onFilterChanged();

      // Si la fila está expandida con otro tipo de detalle, cerrarla
      if (node.expanded && node.data.detailType !== 'comprobacion') {
        node.setExpanded(false);
      }

      // Cambiar el tipo de detalle a 'comprobacion'
      node.data.detailType = 'comprobacion';

      // Expandir con la comprobación
      setTimeout(() => {
        node.setExpanded(true);
      }, 0);
    }
  }

  // ==================== MÉTODOS PARA CONCEPTOS ====================

  loadCountItems() {
    // Cargar el conteo de conceptos para cada egreso
    this.incomes.forEach(income => {
      this.incomesAndExpensesService.getConceptsFromIncomesAndExpenses(income.id).subscribe({
        next: (concepts: any[]) => {
          this.updateExpenditureCountItems(income.id, concepts.length);
        },
        error: (error) => {
          console.error('Error loading concept count for expenditure:', income.id, error);
        }
      });
    });
  }

  updateExpenditureCountItems(expenditureId: number, count: number) {
    if (this.gridApi) {
      this.gridApi.forEachNode((node) => {
        if (node.data && node.data.id === expenditureId) {
          node.data.countItems = count;
          this.gridApi.refreshCells({
            rowNodes: [node],
            columns: ['countItems'],
            force: true
          });

          // Guardar en el servidor
          const dataToSave = {
            countItems: count,
            countDocomps: node.data.countDocomps || 0,
            modifiedBy: this.currentUser
          };
          this.administrationService.updateRowsIncorExp(expenditureId, dataToSave).subscribe({
            next: () => {
              // Contador actualizado
            },
            error: (error) => {
              console.error('Error actualizando contador de items:', error);
            }
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
        isr: data.isr,
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
        this.updateExpenditureCountItems(expenditureId, conceptsData.length);

        // Actualizar la fila del maestro con los nuevos totales incluyendo ISR
        this.updateMasterRowInGrid({
          id: expenditureId,
          subtotal: subtotal,
          tax: tax,
          isr: data.isr,
          total: total
        });

        // Refrescar la lista de egresos para mostrar totales actualizados
        // setTimeout(() => this.getExpenditure(), 500);
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

  loadCountDocomps() {
    // Cargar el conteo de documentos comprobados para cada egreso
    this.incomes.forEach(income => {
      this.administrationService.getDocumentComprobados(income.id).subscribe({
        next: (documentos: any[]) => {
          this.updateExpenditureCountDocomps(income.id, documentos.length);
        },
        error: (error) => {
          console.error('Error loading document count for expenditure:', income.id, error);
        }
      });
    });
  }

  updateExpenditureCountDocomps(expenditureId: number, count: number) {
    if (this.gridApi) {
      this.gridApi.forEachNode((node) => {
        if (node.data && node.data.id === expenditureId) {
          node.data.countDocomps = count;
          this.gridApi.refreshCells({
            rowNodes: [node],
            columns: ['countDocomps'],
            force: true
          });

          // Guardar en el servidor
          const dataToSave = {
            countItems: node.data.countItems || 0,
            countDocomps: count,
            modifiedBy: this.currentUser
          };
          this.administrationService.updateRowsIncorExp(expenditureId, dataToSave).subscribe({
            next: () => {
              // Contador actualizado
            },
            error: (error) => {
              console.error('Error actualizando contador de documentos:', error);
            }
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

  // ==================== MÉTODOS PARA EL MODAL DE PROVEEDOR ====================

  openProviderModal(idRoot: number) {
    this.newProvider = {
      idRoot: idRoot,
      idBranch: this.idBranch || 0,
      idTypecop: 3, // PROVEEDOR
      nameContact: '',
      company: '',
      rfc: '',
      city: '',
      position: 'GERENCIA',
      address: '',
      addressFiscal: '',
      cp: '',
      state: '',
      neighborhood: '',
      total: 0,
      radio: 0,
      phone: '',
      mobile: '',
      email: 'info@x.com',
      vigente: true,
      numCliente: 0,
      latitud: '',
      longitud: '',
      typeCustomer: '',
      typework: '',
      type: 'PROVIDERS',
      fieldContact: 0,
      fieldBank: 0,
      fieldCuenta: 0,
      active: true
    };
    this.showProviderModal = true;
    document.body.classList.add('modal-open');
  }

  closeProviderModal() {
    this.showProviderModal = false;
    document.body.classList.remove('modal-open');
  }

  async saveNewProvider() {
    if (!this.newProvider.company || !this.newProvider.nameContact) {
      alerts.basicAlert(
        'Error',
        'La Compañía y el Nombre de Contacto son obligatorios.',
        'error'
      );
      return;
    }

    // Mostrar datos para copiar y probar en Swagger
    const jsonData = JSON.stringify(this.newProvider, null, 2);
    prompt('📋 COPIAR DATOS PARA SWAGGER:\n\nSelecciona todo (Ctrl+A) y copia (Ctrl+C):', jsonData);

    try {
      const result: any = await lastValueFrom(
        this.customersService.addCustomer(this.newProvider)
      );

      alerts.basicAlert(
        'Proveedor creado',
        'El proveedor se ha creado correctamente.',
        'success'
      );

      this.providerModalService.confirmSave({
        id: result.id,
        name: this.newProvider.company
      });

      this.signalsService.setNewProviderCreated(result.id, this.newProvider.company);

      this.closeProviderModal();

    } catch (error) {
      console.error('Error creando proveedor:', error);
      alerts.basicAlert(
        'Error',
        `Error al crear el proveedor. ${error?.error?.message || error?.message || 'Error desconocido'}`,
        'error'
      );
    }
  }

  // ==================== MÉTODOS PARA REPORTE CONSOLIDADO ====================

  openConsolidatedReportModal() {
    // Establecer fechas por defecto: primer y último día del mes actual
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Formatear fechas para input type="date" (YYYY-MM-DD)
    this.reportStartDate = this.formatDateForInput(firstDay);
    this.reportEndDate = this.formatDateForInput(lastDay);

    this.showConsolidatedReportModal = true;
    document.body.classList.add('modal-open');

    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Abrir modal de reporte consolidado',
      'Palacio Municipal - Egresos',
      this.trackingService.getEmail()
    );
  }

  closeConsolidatedReportModal() {
    this.showConsolidatedReportModal = false;
    document.body.classList.remove('modal-open');
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async generateConsolidatedReport() {
    if (!this.reportStartDate || !this.reportEndDate) {
      alerts.basicAlert('Error', 'Por favor seleccione ambas fechas', 'error');
      return;
    }

    // Validar que la fecha de inicio no sea mayor que la fecha de término
    if (new Date(this.reportStartDate) > new Date(this.reportEndDate)) {
      alerts.basicAlert('Error', 'La fecha de inicio no puede ser mayor que la fecha de término', 'error');
      return;
    }

    this.isGeneratingConsolidatedReport = true;

    try {
      // Filtrar egresos por rango de fechas
      const startDate = new Date(this.reportStartDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(this.reportEndDate);
      endDate.setHours(23, 59, 59, 999);

      const filteredExpenses = this.incomes.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= startDate && expenseDate <= endDate && expense.facturado === true;
      });

      if (filteredExpenses.length === 0) {
        alerts.basicAlert(
          'Sin datos',
          'No se encontraron egresos en el rango de fechas seleccionado',
          'warning'
        );
        this.isGeneratingConsolidatedReport = false;
        return;
      }

      // Agrupar por Objeto de Gasto (idExpend)
      const groupedByObjetoGasto = this.groupByObjetoGasto(filteredExpenses);

      // Ordenar grupos por código de objeto de gasto
      const sortedGroups = this.sortGroups(groupedByObjetoGasto);

      // Generar PDF consolidado
      await this.generateConsolidatedPDF(sortedGroups);

      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        `Generar reporte consolidado del ${this.reportStartDate} al ${this.reportEndDate}`,
        'Palacio Municipal - Egresos',
        this.trackingService.getEmail()
      );

      // Cerrar modal
      this.closeConsolidatedReportModal();

    } catch (error) {
      console.error('Error generando reporte consolidado:', error);
      alerts.basicAlert('Error', 'Error al generar el reporte consolidado', 'error');
    } finally {
      this.isGeneratingConsolidatedReport = false;
    }
  }

  private groupByObjetoGasto(expenses: any[]): Map<number, any[]> {
    const grouped = new Map<number, any[]>();

    expenses.forEach(expense => {
      const idExpend = expense.idExpend;
      if (!grouped.has(idExpend)) {
        grouped.set(idExpend, []);
      }
      grouped.get(idExpend)!.push(expense);
    });

    // Ordenar por fecha dentro de cada grupo
    grouped.forEach((expensesInGroup, idExpend) => {
      expensesInGroup.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });
    });

    return grouped;
  }

  private sortGroups(grouped: Map<number, any[]>): Array<{ idExpend: number; codigo: string; nombre: string; expenses: any[] }> {
    const sortedGroups: Array<{ idExpend: number; codigo: string; nombre: string; expenses: any[] }> = [];

    grouped.forEach((expenses, idExpend) => {
      const objetoGasto = this.expenses.find(obj => obj.id === idExpend);
      sortedGroups.push({
        idExpend,
        codigo: objetoGasto?.codigo || '',
        nombre: objetoGasto?.nombre || '',
        expenses
      });
    });

    // Ordenar por código de objeto de gasto
    sortedGroups.sort((a, b) => {
      const codigoA = a.codigo || '';
      const codigoB = b.codigo || '';
      return codigoA.localeCompare(codigoB);
    });

    return sortedGroups;
  }

  private async generateConsolidatedPDF(groups: Array<{ idExpend: number; codigo: string; nombre: string; expenses: any[] }>) {
    // Importar pdfMake dinámicamente
    const pdfMake = (await import('pdfmake/build/pdfmake')).default;
    const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
    (pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

    // Obtener información de la empresa y firmas
    const rootResponse: any = await lastValueFrom(
      this.rootService.getRootbyId(this.idRoot)
    );

    const logoBase64 = await this.base64EncodeService.convertImageToBase64(rootResponse.picture);
    const watermarkBase64 = rootResponse.picture3
      ? await this.base64EncodeService.convertImageToBase64(rootResponse.picture3)
      : null;

    const setupManagementInfo: any = await lastValueFrom(
      this.administrationService.getSetupManagementInfo(this.idRoot)
    );
    const firmas = Array.isArray(setupManagementInfo) && setupManagementInfo.length > 0
      ? setupManagementInfo[0]
      : null;

    // Construir el contenido del PDF
    const content: any[] = [];

    // Objeto para almacenar totales por grupo
    const groupTotals: Array<{ codigo: string; nombre: string; total: number; count: number }> = [];

    // Cargar objetos nivel 1 y nivel 4 una sola vez (para todos los egresos con mostrartodo=true)
    let objetosNivel1: any[] = [];
    let objetosNivel4: any[] = [];
    const necesitaObjetosNivel = groups.some(group =>
      group.expenses.some(expense => expense.mostrartodo === true)
    );

    if (necesitaObjetosNivel) {
      try {
        const dataNivel1: any = await lastValueFrom(
          this.administrationService.getByNivelObjeto(this.idRoot, 1)
        );
        objetosNivel1 = (dataNivel1 || []).map((obj: any) => ({
          id: obj.id,
          codigo: obj.codigo,
          nombre: obj.nombre,
          codigoNombre: `${obj.codigo} - ${obj.nombre}`
        }));

        const dataNivel4: any = await lastValueFrom(
          this.administrationService.getByNivelObjeto(this.idRoot, 4)
        );
        objetosNivel4 = (dataNivel4 || []).map((obj: any) => ({
          id: obj.id,
          codigo: obj.codigo,
          nombre: obj.nombre,
          codigoNombre: `${obj.codigo} - ${obj.nombre}`
        }));
      } catch (error) {
        console.error('Error cargando objetos nivel 1 y 4:', error);
      }
    }

    for (const group of groups) {
      let groupTotal = 0;

      for (let i = 0; i < group.expenses.length; i++) {
        const expense = group.expenses[i];

        // Cargar conceptos de este egreso
        const concepts: any[] = await lastValueFrom(
          this.incomesAndExpensesService.getConceptsFromIncomesAndExpenses(expense.id)
        );

        // Calcular totalFinal para cada concepto
        concepts.forEach(concept => {
          concept.aplicaIsr = concept.aplicaIsr !== undefined ? concept.aplicaIsr : false;
          concept.totalFinal = (concept.total || 0) + (concept.iva2 || 0) - (concept.isr || 0);
        });

        // Calcular totales
        const total = concepts.reduce((acc, row) => acc + (Number(row.totalFinal) || 0), 0);
        groupTotal += total;

        // Agregar contenido de este egreso (página individual)
        content.push(...this.buildReportPage(
          expense,
          concepts,
          total,
          rootResponse,
          group,
          objetosNivel1,
          objetosNivel4
        ));

        // Agregar salto de página si no es el último egreso
        if (i < group.expenses.length - 1 || groups.indexOf(group) < groups.length - 1) {
          content.push({ text: '', pageBreak: 'after' });
        }
      }

      // Guardar el total de este grupo
      groupTotals.push({
        codigo: group.codigo,
        nombre: group.nombre,
        total: groupTotal,
        count: group.expenses.length
      });
    }

    // Agregar página de resumen al final
    content.push({ text: '', pageBreak: 'after' });
    content.push(...this.buildSummaryPage(groupTotals, rootResponse));

    // Definición del documento
    const docDefinition: any = {
      pageSize: 'LETTER',
      pageMargins: [40, 60, 40, 60],
      background: watermarkBase64 ? [
        {
          image: 'watermark',
          width: 400,
          opacity: 0.15,
          absolutePosition: { x: 106, y: 250 }
        }
      ] : [],
      content: content,
      images: watermarkBase64 ? {
        logo: logoBase64,
        watermark: watermarkBase64
      } : {
        logo: logoBase64
      },
      styles: {
        companyName: { fontSize: 14, bold: true, color: '#333333' },
        companyInfo: { fontSize: 9, color: '#666666' },
        documentTitle: { fontSize: 16, bold: true, color: '#cc0000' },
        documentNumber: { fontSize: 12, bold: true, color: '#333333' },
        documentDate: { fontSize: 10, color: '#666666' },
        sectionTitle: { fontSize: 11, bold: true, color: '#cc0000' },
        masterLabel: { fontSize: 9, bold: true, color: '#333333' },
        masterValue: { fontSize: 9, color: '#000000' },
        tableHeader: { fontSize: 8, bold: true, fillColor: '#e6e6e6', color: '#000000' },
        tableCell: { fontSize: 8, color: '#000000' },
        totalLabel: { fontSize: 9, bold: true, color: '#000000' },
        totalValue: { fontSize: 9, bold: true, color: '#cc0000' },
        signatureTitle: { fontSize: 8, bold: true, color: '#333333' },
        signatureName: { fontSize: 8, color: '#000000' },
        signatureLabel: { fontSize: 8, italics: true, color: '#666666' },
        groupTitle: { fontSize: 10, bold: true, color: '#0066cc', fillColor: '#e6f2ff' },
        subtotalLabel: { fontSize: 8, bold: true, color: '#333333' },
        subtotalValue: { fontSize: 8, bold: true, color: '#0066cc' }
      }
    };

    // Generar PDF y abrirlo en nueva pestaña
    const pdfDocGenerator = pdfMake.createPdf(docDefinition);
    pdfDocGenerator.open();

    alerts.basicAlert(
      'Reporte generado',
      `Se generó el reporte consolidado con ${groups.reduce((acc, g) => acc + g.expenses.length, 0)} egresos agrupados en ${groups.length} objetos de gasto.`,
      'success'
    );
  }

  private buildReportPage(
    expense: any,
    concepts: any[],
    total: number,
    rootResponse: any,
    group: any,
    objetosNivel1: any[],
    objetosNivel4: any[]
  ): any[] {
    // Determinar el texto del objeto de gasto
    let objetoGastoTexto: string;
    if (expense.mostrartodo === true && objetosNivel1.length > 0 && objetosNivel4.length > 0) {
      objetoGastoTexto = this.getObjetosNivel1Text(concepts, objetosNivel1, objetosNivel4);
    } else {
      objetoGastoTexto = `${group.codigo} - ${group.nombre}`;
    }

    return [
      // Header con logo y título
      {
        columns: [
          { image: 'logo', width: 80, alignment: 'left' },
          {
            stack: [
              { text: rootResponse.name || 'Empresa', style: 'companyName', alignment: 'center' },
              { text: rootResponse.email || '', style: 'companyInfo', alignment: 'center' },
              { text: rootResponse.web || '', style: 'companyInfo', alignment: 'center' }
            ],
            width: '*'
          },
          {
            stack: [
              { text: 'RECIBO DE EGRESO', style: 'documentTitle', alignment: 'right' },
              { text: `No. ${expense.numberDocument || 'Sin Número'}`, style: 'documentNumber', alignment: 'right', margin: [0, 5, 0, 0] },
              { text: `Fecha de Pago: ${this.formatDate(expense.date)}`, style: 'documentDate', alignment: 'right', margin: [0, 3, 0, 0] }
            ],
            width: 150
          }
        ],
        margin: [0, 0, 0, 20]
      },
      // Línea separadora
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#333333' }],
        margin: [0, 0, 0, 15]
      },
      // DETALLES DEL EGRESO
      { text: 'DETALLES DEL EGRESO', style: 'sectionTitle', margin: [0, 10, 0, 10] },
      {
        table: {
          widths: ['25%', '75%'],
          body: [
            [{ text: 'FECHA PAGO:', style: 'masterLabel' }, { text: this.formatDate(expense.date), style: 'masterValue' }],
            [{ text: 'OBJETO DE GASTO:', style: 'masterLabel' }, { text: `${objetoGastoTexto}        $ ${this.formatCurrency(total || 0)}`, style: 'masterValue' }]
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#cccccc',
          vLineColor: () => '#cccccc',
          paddingTop: () => 5,
          paddingBottom: () => 5,
          paddingLeft: () => 8,
          paddingRight: () => 8
        },
        margin: [0, 0, 0, 15]
      },
      // Tabla de Conceptos - Condicional según mostrartodo
      ...(expense.mostrartodo === true && objetosNivel1.length > 0 && objetosNivel4.length > 0
        ? this.generarTablaAgrupadaConsolidado(concepts, total, objetosNivel1, objetosNivel4)
        : [
          // Tabla simple (estructura original)
          {
            table: {
              headerRows: 1,
              widths: [70, 100, '*', 80],
              body: [
                [
                  { text: 'Fecha', style: 'tableHeader' },
                  { text: 'NUMERO DE RECIBO O FOLIO FISCAL (FACTURA)', style: 'tableHeader' },
                  { text: 'Descripción', style: 'tableHeader' },
                  { text: 'Total', style: 'tableHeader', alignment: 'right' }
                ],
                ...concepts.map(concept => [
                  { text: this.formatDate(concept.dateExpend), style: 'tableCell', fontSize: 7 },
                  { text: concept.numeroIdentificacion || '', style: 'tableCell', fontSize: 7 },
                  { text: concept.description || '', style: 'tableCell' },
                  { text: this.formatCurrency(concept.totalFinal || 0), style: 'tableCell', alignment: 'right' }
                ]),
                [
                  { text: '', border: [false, false, false, false] },
                  { text: '', border: [false, false, false, false] },
                  { text: 'TOTAL:', style: 'totalLabel', alignment: 'right', border: [false, true, false, false] },
                  { text: this.formatCurrency(total), style: 'totalValue', alignment: 'right', border: [false, true, false, false] }
                ]
              ]
            },
            layout: {
              hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#333333',
              vLineColor: () => '#cccccc',
              paddingTop: () => 3,
              paddingBottom: () => 3,
              paddingLeft: () => 4,
              paddingRight: () => 4
            },
            margin: [0, 0, 0, 20]
          }
        ])
    ];
  }

  private buildSummaryPage(groupTotals: Array<{ codigo: string; nombre: string; total: number; count: number }>, rootResponse: any): any[] {
    // Calcular el gran total
    const grandTotal = groupTotals.reduce((acc, group) => acc + group.total, 0);
    const totalCount = groupTotals.reduce((acc, group) => acc + group.count, 0);

    // Obtener el rango de fechas formateado
    const startDateFormatted = this.formatDate(this.reportStartDate);
    const endDateFormatted = this.formatDate(this.reportEndDate);

    return [
      // Header con logo y título
      {
        columns: [
          { image: 'logo', width: 80, alignment: 'left' },
          {
            stack: [
              { text: rootResponse.name || 'Empresa', style: 'companyName', alignment: 'center' },
              { text: rootResponse.email || '', style: 'companyInfo', alignment: 'center' },
              { text: rootResponse.web || '', style: 'companyInfo', alignment: 'center' }
            ],
            width: '*'
          },
          {
            stack: [
              { text: 'RESUMEN CONSOLIDADO', style: 'documentTitle', alignment: 'right' },
              { text: `Periodo: ${startDateFormatted} al ${endDateFormatted}`, style: 'documentDate', alignment: 'right', margin: [0, 5, 0, 0] }
            ],
            width: 180
          }
        ],
        margin: [0, 0, 0, 20]
      },
      // Línea separadora
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#333333' }],
        margin: [0, 0, 0, 15]
      },
      // Título de la sección
      { text: 'RESUMEN POR OBJETO DE GASTO', style: 'sectionTitle', margin: [0, 10, 0, 15] },
      // Tabla de resumen
      {
        table: {
          headerRows: 1,
          widths: [80, '*', 80, 100],
          body: [
            [
              { text: 'Código', style: 'tableHeader' },
              { text: 'Objeto de Gasto', style: 'tableHeader' },
              { text: 'Cantidad', style: 'tableHeader', alignment: 'center' },
              { text: 'Total', style: 'tableHeader', alignment: 'right' }
            ],
            ...groupTotals.map(group => [
              { text: group.codigo, style: 'tableCell', bold: true, fontSize: 9 },
              { text: group.nombre, style: 'tableCell', fontSize: 9 },
              { text: group.count.toString(), style: 'tableCell', alignment: 'center', fontSize: 9 },
              { text: this.formatCurrency(group.total), style: 'tableCell', alignment: 'right', fontSize: 9 }
            ]),
            // Fila de totales
            [
              { text: '', border: [false, true, false, false] },
              { text: 'TOTAL GENERAL:', style: 'totalLabel', alignment: 'right', border: [false, true, false, false], bold: true },
              { text: totalCount.toString(), style: 'totalLabel', alignment: 'center', border: [false, true, false, false], bold: true },
              { text: this.formatCurrency(grandTotal), style: 'totalValue', alignment: 'right', border: [false, true, false, false], fontSize: 11, bold: true }
            ]
          ]
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#333333',
          vLineColor: () => '#cccccc',
          paddingTop: () => 5,
          paddingBottom: () => 5,
          paddingLeft: () => 8,
          paddingRight: () => 8
        },
        margin: [0, 0, 0, 20]
      },
      // Información adicional
      {
        text: [
          { text: 'Total de Egresos: ', bold: true, fontSize: 10 },
          { text: `${totalCount} documentos\n`, fontSize: 10 },
          { text: 'Periodo: ', bold: true, fontSize: 10 },
          { text: `${startDateFormatted} al ${endDateFormatted}\n`, fontSize: 10 },
          { text: 'Monto Total: ', bold: true, fontSize: 10 },
          { text: `$ ${this.formatCurrency(grandTotal)}`, fontSize: 10, color: '#cc0000' }
        ],
        margin: [0, 20, 0, 0],
        alignment: 'left'
      }
    ];
  }

  private formatCurrency(amount: number): string {
    return amount.toLocaleString('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /**
   * Mapea un ID de objeto nivel 4 a su código de nivel 1 padre
   */
  private getNivel1CodigoFromNivel4Id(idCatIng: number, objetosNivel4: any[]): string | null {
    const objetoNivel4 = objetosNivel4.find(obj => obj.id === idCatIng);
    if (!objetoNivel4 || !objetoNivel4.codigo) {
      return null;
    }

    const codigo = objetoNivel4.codigo;
    const primerDigito = codigo.toString().charAt(0);
    return `${primerDigito}000`;
  }

  /**
   * Agrupa conceptos por objeto de gasto nivel 1
   */
  private agruparConceptosPorNivel1Consolidado(
    concepts: any[],
    objetosNivel1: any[],
    objetosNivel4: any[]
  ): Map<string, any> {
    const grupos = new Map<string, any>();

    concepts.forEach(concepto => {
      const idCatIng = concepto.idCatIng;
      const codigoNivel1 = this.getNivel1CodigoFromNivel4Id(idCatIng, objetosNivel4);

      if (!codigoNivel1) {
        if (!grupos.has('sin-clasificar')) {
          grupos.set('sin-clasificar', {
            nivel1Info: { codigo: '', nombre: 'SIN CLASIFICAR', codigoNombre: 'SIN CLASIFICAR' },
            conceptos: [],
            subtotal: 0
          });
        }
        const grupo = grupos.get('sin-clasificar');
        grupo.conceptos.push(concepto);
        grupo.subtotal += concepto.totalFinal || 0;
        return;
      }

      const nivel1Info = objetosNivel1.find(obj => obj.codigo === codigoNivel1);
      if (!nivel1Info) {
        return;
      }

      if (!grupos.has(codigoNivel1)) {
        grupos.set(codigoNivel1, {
          nivel1Info: nivel1Info,
          conceptos: [],
          subtotal: 0
        });
      }

      const grupo = grupos.get(codigoNivel1);
      grupo.conceptos.push(concepto);
      grupo.subtotal += concepto.totalFinal || 0;
    });

    return grupos;
  }

  /**
   * Genera tabla agrupada por nivel 1 para el reporte consolidado
   */
  private generarTablaAgrupadaConsolidado(
    concepts: any[],
    total: number,
    objetosNivel1: any[],
    objetosNivel4: any[]
  ): any[] {
    const elementos: any[] = [];
    const grupos = this.agruparConceptosPorNivel1Consolidado(concepts, objetosNivel1, objetosNivel4);

    const gruposOrdenados = Array.from(grupos.entries()).sort((a, b) => {
      if (a[0] === 'sin-clasificar') return 1;
      if (b[0] === 'sin-clasificar') return -1;
      return a[0].localeCompare(b[0]);
    });

    gruposOrdenados.forEach(([codigoNivel1, grupo], index) => {
      if (index > 0) {
        elementos.push({
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }],
          margin: [0, 10, 0, 10]
        });
      }

      elementos.push({
        text: grupo.nivel1Info.codigoNombre,
        style: 'groupTitle',
        margin: [0, 10, 0, 5]
      });

      elementos.push({
        table: {
          headerRows: 1,
          widths: [70, 100, '*', 80],
          body: [
            [
              { text: 'Fecha', style: 'tableHeader' },
              { text: 'FOLIO FISCAL', style: 'tableHeader' },
              { text: 'Descripción', style: 'tableHeader' },
              { text: 'Total', style: 'tableHeader', alignment: 'right' }
            ],
            ...grupo.conceptos.map((concept: any) => [
              { text: this.formatDate(concept.dateExpend), style: 'tableCell', fontSize: 7 },
              { text: concept.numeroIdentificacion || '', style: 'tableCell', fontSize: 7 },
              { text: concept.description || '', style: 'tableCell' },
              { text: this.formatCurrency(concept.totalFinal || 0), style: 'tableCell', alignment: 'right' }
            ]),
            [
              { text: '', border: [false, false, false, false] },
              { text: '', border: [false, false, false, false] },
              { text: 'SUBTOTAL:', style: 'subtotalLabel', alignment: 'right', border: [false, true, false, false] },
              { text: this.formatCurrency(grupo.subtotal), style: 'subtotalValue', alignment: 'right', border: [false, true, false, false] }
            ]
          ]
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#333333',
          vLineColor: () => '#cccccc',
          paddingTop: () => 3,
          paddingBottom: () => 3,
          paddingLeft: () => 4,
          paddingRight: () => 4
        },
        margin: [0, 0, 0, 5]
      });
    });

    elementos.push({
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: '#333333' }],
      margin: [0, 15, 0, 5]
    });

    elementos.push({
      columns: [
        { text: '', width: '*' },
        { text: '', width: 170 },
        { text: 'TOTAL GENERAL:', style: 'totalLabel', alignment: 'right', width: 100 },
        { text: this.formatCurrency(total), style: 'totalValue', alignment: 'right', width: 80 }
      ],
      margin: [0, 5, 0, 20]
    });

    return elementos;
  }

  /**
   * Obtiene el texto de objetos nivel 1 concatenados
   */
  private getObjetosNivel1Text(concepts: any[], objetosNivel1: any[], objetosNivel4: any[]): string {
    const grupos = this.agruparConceptosPorNivel1Consolidado(concepts, objetosNivel1, objetosNivel4);

    const objetosTexto = Array.from(grupos.entries())
      .filter(([codigo, grupo]) => codigo !== 'sin-clasificar')
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([codigo, grupo]) => grupo.nivel1Info.nombre);

    return objetosTexto.length > 0 ? objetosTexto.join(' + ') : 'Sin objetos de gasto';
  }

}
