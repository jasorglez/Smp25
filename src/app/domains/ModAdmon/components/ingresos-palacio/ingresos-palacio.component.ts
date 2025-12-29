import { Component, effect, inject, OnInit } from '@angular/core';
import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { ModalService } from 'app/services/modal.service';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { FormBuilder, FormGroup, FormsModule, NgSelectOption, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { ConceptsincomeComponent } from '../income/conceptsincome/conceptsincome.component';
import { BranchsService } from 'app/services/branchs.service';
import { TrackingService } from 'app/services/tracking.service';
import { AuthService } from 'app/services/auth.service';
import { CatalogadmonService } from 'app/services/catalogadmon.service';
import { ButtonCellRendererIncomeComponent } from './button-cell-renderer.component';
import { DetailCellRendererIncomeComponent } from './detail-cell-renderer-income.component';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { PdfButtonCellRendererComponent } from '../egresos-palacio/pdf-button-cell-renderer.component';
import { CatalogsService } from 'app/services/catalogs.service';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';

import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;


declare var bootstrap: any;

@Component({
  selector: 'app-ingresos-palacio',
  standalone: true,
  imports: [NgSelectModule, NgSelectComponent, AgGridModule, MultiLineEditorComponent, CommonModule, ReactiveFormsModule,
            FormsModule, AdditionalInfoComponent, ConceptsincomeComponent, ButtonCellRendererIncomeComponent,
            DetailCellRendererIncomeComponent, SelectWithTooltipEditorV2Component, PdfButtonCellRendererComponent],
  templateUrl: './ingresos-palacio.component.html',
  styleUrl: './ingresos-palacio.component.scss'
})
export class IngresosPalacioComponent implements OnInit {
  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  private modalServiceTable = inject(ModalService);
  private administrationService = inject(AdministrationService);
  private catalogadmonService = inject(CatalogadmonService);
  private catalogsService = inject(CatalogsService);
  private usersxpermissionsService = inject(UsersxpermissionsService);
  private usersService = inject(UsersService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private BranchsService = inject(BranchsService);
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);
  authService = inject(AuthService);
  private formBuilder = inject(FormBuilder);

  ngOnInit() {
    // Si quieres la fecha '2025-10' como valor inicial, ponla aquí.
    // Si quieres que sea dinámica (el mes anterior), puedes descomentar las líneas de abajo.
    const hoy = new Date();
     const mes = this.obtenerAnoMes(hoy);
     const mesAnterior = new Date(hoy);
     mesAnterior.setMonth(hoy.getMonth() - 1);
     const mesAnteriorStr = this.obtenerAnoMes(mesAnterior);

    this.myForm = this.formBuilder.group({
      tipoReporte: ['GENERAL', Validators.required],
      fechaInicio: ['2024-10', Validators.required],
      fechaFin: [mes, Validators.required]
    });
  }

  constructor() {
    // La inicialización del formulario se ha movido a ngOnInit
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

      await this.getIngresosCatalog();   // Obtener catálogo de ingresos nivel 2
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

  private isGeneratingReport: boolean = false; // Flag para evitar múltiples clics
  showform : string = '';
  branches: number[] = [];
  incomes: any[] = [];
  ingresosCatalog: any[] = [];
  users: any[] = [];
  id: number;
  notSavedChanges: boolean = false;
  private modalInstance: any = null;
  newlyAddedRows: string[] = [];
  myForm: FormGroup;
  selectedIncomes: any = null;
  currentUser: string;
  root: number;
  idBranch: number;
  bankAccounts: any[] = [];
  prefixAndConsecutive: any[] = [];
  tipos: any[] = [];


  private _idAccount: number; // Variable de respaldo para el setter

  // Añadir setter para idAccount con lógica de actualización

  set idAccount(value: number) {
    if (this._idAccount !== value) {
      this._idAccount = value;

     // Agregar log cuando se selecciona una cuenta
    if (value) {
      const selectedAccount = this.bankAccounts.find(account => account.id === value);
      console.log('//////Cuenta seleccionada:', selectedAccount);

      if (selectedAccount) {
        const accountDetails = `${selectedAccount.nameAccount} - ${selectedAccount.bankName}`;

        this.trackingService.addLog(
          this.trackingService.getnameComp(), `Selección de cuenta bancaria: ${accountDetails}`, 'Menu Administración - Palacio Municipal - Ingresos',
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

  obtenerAnoMes(fecha: Date): string {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0'); // +1 porque enero es 0
    return `${año}-${mes}`;
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
    detailRowHeight: 700,
    isRowMaster: (dataItem: any) => true,
    detailCellRenderer: DetailCellRendererIncomeComponent,
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
      // Seleccionar la fila al hacer clic en cualquier celda, excepto en la columna PDF
      if (event.column.getColId() !== 'pdfReport') {
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
      // Cuando se presiona Enter en la columna Pago, mover a Catálogo Ingreso
      if (event.event.key === 'Enter' && !event.event.shiftKey) {
        const currentColumn = event.column.getColId();

        if (currentColumn === 'date') {
          // Detener la propagación para evitar el comportamiento por defecto
          event.event.preventDefault();
          event.event.stopPropagation();

          // Mover el focus a la columna 'idCustomer' (Catálogo Ingreso)
          const rowIndex = event.node.rowIndex;
          setTimeout(() => {
            // Establecer el focus en la celda
            this.gridApi.setFocusedCell(rowIndex, 'idCustomer');

            // Iniciar la edición inmediatamente
            this.gridApi.startEditingCell({
              rowIndex: rowIndex,
              colKey: 'idCustomer',
              key: null
            });
          }, 50);
        }
      }
    }
  };

  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  components = {
    multiLineEditor: MultiLineEditorComponent,
    searchableSelect: SearchableSelectComponent
  };

  async getIncomes() {

    this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Ingresos`, 'Menu Administración - Palacio Municipal',
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
          countItems: income.countItems || 0, // Usar valor de la BD si existe
          detailType: null,
          detailData: []
        }));

        // Contadores se actualizan localmente al interactuar con el detalle

      },
      error: (err) => {
        // Manejo de errores HTTP
        console.error('Error obteniendo ingresos. Código:', err.status, 'Detalles:', err);
        this.incomes = [];
      }
    });
  }


  async getIngresosCatalog() {
    // Obtener catálogo de ingresos nivel 2
    this.catalogadmonService.getCatalogsxNivel(this.root, 'INCOME', 2).subscribe(
      (data: any) => {
        this.ingresosCatalog = data || [];
      },
      error => {
        console.error('Error cargando catálogo de ingresos:', error);
        this.ingresosCatalog = [];
      }
    )
    this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Catálogo Ingresos`, 'Menu Administración - Palacio Municipal - Ingresos',
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

  // Función para obtener el nombre del mes en español
  private getMonthName(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
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
        cellRenderer: PdfButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => {
            console.log('🔵 PDF Click detectado en Ingresos - ID:', node.data.id);
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
      {
        field: 'description', headerName: 'Descripción', editable: true, width: 280, filter: true,
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
        field: 'dateStamped', headerName: 'Entrega', editable: true, filter: true, cellDataType: 'date', width: 100, hide: true,
        valueFormatter: (params) => this.formatDate(params.value)
      },

      {
        field: 'date', headerName: 'Pago', editable: true, filter: true,cellDataType: 'date', width: 100,
        valueFormatter: (params) => this.formatDate(params.value)
      },

      {
        field: 'idCustomer', headerName: 'Catálogo Ingreso', editable: true, width: 180,
        cellEditor: SelectWithTooltipEditorV2Component,
        cellEditorParams: {
          options: this.ingresosCatalog.map(obj => ({
            id: obj.id,
            description: obj.description,
            valueAddition: obj.id || '',
            valueAddition2: obj.description || ''
          }))
        },
        valueFormatter: (params) => {
          const foundItem = this.ingresosCatalog
            ? this.ingresosCatalog.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.description}` : params.value;
        },
      },

      {
        field: 'subtotal',
        headerName: 'Subtotal',
        type: 'number',
        editable: false,
        width: 100,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
      {
        field: 'tax',
        headerName: 'Impuestos',
        type: 'number',
        editable: false,
        width: 80,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
      {
        field: 'total',
        headerName: 'Total',
        type: 'number',filter: true,
        editable: false,
        width: 100,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },

      {
        field: 'paymentMonth', headerName: 'Mes', editable: true, width: 80,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
          ]
        }
      },

      {
        field: 'createdBy',
        headerName: 'Autoriza',
        editable: false,
        width: 105
      },

    ];

    return this._colMaster;
  }

  onSelectedRow(event: any) {
    this.id = event.data.id;
      console.log('Setting idIncomeAndExpense to:', this.id); // Debug log
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

    // Si se cambió la fecha de Pago, actualizar automáticamente el mes
    if (event.colDef.field === 'date' && event.newValue) {
      const fechaPago = new Date(event.newValue);
      event.data.paymentMonth = this.getMonthName(fechaPago);

      // Refrescar la celda del mes para mostrar el cambio
      this.gridApi.refreshCells({
        rowNodes: [event.node],
        columns: ['paymentMonth'],
        force: true
      });
    }

    // Si se cambió el Catálogo Ingreso, componer automáticamente la Descripción
    if (event.colDef.field === 'idCustomer' && event.newValue) {
      const catalogoSeleccionado = this.ingresosCatalog.find(cat => cat.id === event.newValue);
      if (catalogoSeleccionado && event.data.paymentMonth && event.data.date) {
        // Obtener el año de la fecha de pago
        const fechaPago = new Date(event.data.date);
        const year = fechaPago.getFullYear();

        // Componer: Mes + ' ' + Año + ' ' + Descripción del Catálogo
        event.data.description = `${event.data.paymentMonth} ${year} ${catalogoSeleccionado.description}`;

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
        catalogadmonService: this.catalogadmonService,
        rootService: this.rootService,
        base64EncodeService: this.base64EncodeService,
        ingresosCatalog: this.ingresosCatalog,
        CONCEPTS: {
          load: (incomeId: number, callback: (data: any[]) => void) => {
            this.loadConceptsData(incomeId, callback);
          },
          save: (incomeId: number, data: any) => {
            this.saveConceptsById(incomeId, data);
          },
          delete: (params: any, callback: () => void) => {
            this.deleteConceptRow(params, callback);
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

    // Calcular fechas automáticamente
    const fechaEntrega = new Date(); // Fecha actual (hoy)
    const fechaPago = new Date(fechaEntrega); // Clonar fecha
    fechaPago.setDate(fechaPago.getDate() + 7); // Sumar 7 días

    // Obtener mes automáticamente de la fecha de Pago
    const mesAutomatico = this.getMonthName(fechaPago);

    const newItem = {
      id: tempId,
      idAccount      : this._idAccount,
      numberDocument : "",
      idBusinnes     : this.root,
      idBranch       : this.idBranch, // Asignar la primera sucursal por defecto
      date           : fechaPago.toISOString(), // Pago = Entrega + 7 días
      idCustomer     : 0,
      idExpend       : this.users.length > 0 ? this.users[0].id : 0, // Primer usuario por defecto
      uuid           : "NA",
      paymentMonth   : mesAutomatico, // Mes automático según fecha de Pago
      dateStamped    : fechaEntrega.toISOString(), // Entrega = hoy
      description: "",
      type: "DEPOSITO",
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

    this.trackingService.addLog(this.trackingService.getnameComp(),'Ingreso en Administracion - Palacio Municipal', 'Menu Administración - Palacio Municipal - Ingresos',  this.trackingService.getEmail());

    // Encontrar el índice de la nueva fila
    const newRowIndex = this.incomes.findIndex((row) => row.id === tempId);

    // Usar setTimeout para asegurar que el grid haya renderizado la nueva fila
    setTimeout(() => {
      // Establecer el focus en la columna 'date' (Pago)
      this.gridApi.setFocusedCell(newRowIndex, 'date');

      // Abrir la celda en modo de edición
      this.gridApi.startEditingCell({
        rowIndex: newRowIndex,
        colKey: 'date', // Abrir columna Pago en modo edición
        key: null
      });
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

    // Obtener el último consecutivo específico de esta cuenta bancaria
    currentConsecutive = await this.getLastConsecutiveForAccount(this._idAccount);

    // Generar números de documento para nuevas filas
    newRows.forEach(row => {
      currentConsecutive++;
      row.numberDocument = `${this.prefixAndConsecutive[0].prefix}${currentConsecutive.toString().padStart(4, '0')}`;
    });
  }

  try {
    // Guardar los registros de income
    await this.saveIncomeRecords(newRows, modifiedRows);

    // Éxito
    alerts.basicAlert(
      'Datos actualizados',
      'Se han actualizado los datos correctamente.',
      'success'
    );

    this.notSavedChanges = false;
    this.newlyAddedRows = [];
    await this.getIncomes(); // Refrescar los datos

  } catch (error) {
    console.error('Error crítico en saveChanges:', error);
    alerts.basicAlert(
      'Error',
      'Ocurrió un error al guardar los registros. Por favor, intente nuevamente.',
      'error'
    );
  }
}


  // Método separado para guardar los registros de income
  private async saveIncomeRecords(newRows: any[], modifiedRows: any[]): Promise<void> {
    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log('Guardando nueva fila:', cleanedData);
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Save Registro en Ingresos - Palacio Municipal',
        'Menu Administración - Palacio Municipal - Ingresos',
        this.trackingService.getEmail()
      );
      return this.incomesAndExpensesService.addIncomesAndExpenses(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log('Actualizando fila existente:', cleanedData);
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Update Registro en Ingresos - Palacio Municipal',
        'Menu Administración - Palacio Municipal - Ingresos',
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
          this.trackingService.addLog(this.trackingService.getnameComp(),'Delete Registro Ingresos - Palacio Municipal', 'Menu Administración - Palacio Municipal - Ingresos',  this.trackingService.getEmail());
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

    this.trackingService.addLog(this.trackingService.getnameComp(),'Cancelar Salvar Registro Ingresos - Palacio Municipal', 'Menu Administración - Palacio Municipal - Ingresos',  this.trackingService.getEmail());
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
        this.tipos = this.bankAccounts.map(acc => {
        const [nombre, tipo] = acc.nameAccount.split('-');
        return {
          nombre: nombre.trim(),
          tipo: tipo?.trim()
        };
      });
      console.log(this.tipos);
      },
      error => {
        console.error(error);
        this.bankAccounts = []; // Vaciamos el array en caso de error
      }
    )
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

  async toggleReportDetail(node: any) {
    console.log('🟢 toggleReportDetail llamado en Ingresos - ID:', node.data.id, 'isGenerating:', this.isGeneratingReport);

    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data.detailType === 'report';

    if (isCurrentlyExpanded) {
      // Si ya está expandido con el reporte, colapsarlo
      console.log('🟡 Colapsando reporte expandido en Ingresos');
      node.setExpanded(false);

      // Restaurar alturas de todas las filas
      api.forEachNode((otherNode: any) => {
        otherNode.setRowHeight(undefined);
      });
      api.onRowHeightChanged();
      return; // Salir temprano
    }

    // Verificar si ya se está generando un reporte
    if (this.isGeneratingReport) {
      console.log('🔴 Ya se está generando un reporte en Ingresos, ignorando clic');
      alerts.basicAlert(
        'Procesando',
        'Ya se está generando un reporte. Por favor espere.',
        'warning'
      );
      return;
    }

    // Marcar que se está generando
    this.isGeneratingReport = true;
    console.log('🟢 Iniciando generación de reporte en Ingresos');

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

      // Agregar la descripción del catálogo formateada para el PDF
      if (node.data.idCustomer && this.ingresosCatalog) {
        const foundItem = this.ingresosCatalog.find((item) => item.id === node.data.idCustomer);
        if (foundItem) {
          node.data.catalogoIngresoTexto = foundItem.description;
        } else {
          node.data.catalogoIngresoTexto = 'Sin descripción';
        }
      } else {
        node.data.catalogoIngresoTexto = 'Sin catálogo';
      }

      // Aplicar cambios de altura
      api.onRowHeightChanged();

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

      console.log('✅ Reporte generado exitosamente en Ingresos');

      // Cerrar mensaje de carga después de 800ms
      setTimeout(() => {
        alerts.closeLoading();
        this.isGeneratingReport = false; // Liberar el lock
        console.log('🔓 Lock liberado en Ingresos');
      }, 800);

    } catch (error) {
      clearInterval(progressInterval);
      alerts.closeLoading();
      this.isGeneratingReport = false; // Liberar el lock en caso de error
      console.log('🔴 Error generando reporte en Ingresos, lock liberado');
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al generar el reporte. Por favor, intente nuevamente.',
        'error'
      );
      console.error('Error generando reporte:', error);
    }
  }

  collapseReportDetail(incomeId: number) {
    if (this.gridApi) {
      this.gridApi.forEachNode((node) => {
        if (node.data && node.data.id === incomeId) {
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


  // ==================== MÉTODOS PARA CONCEPTOS ====================

  loadCountItems() {
    // Cargar el conteo de conceptos para cada ingreso
    this.incomes.forEach(income => {
      this.incomesAndExpensesService.getConceptsFromIncomesAndExpenses(income.id).subscribe({
        next: (concepts: any[]) => {
          this.updateIncomeCountItems(income.id, concepts.length);
        },
        error: (error) => {
          console.error('Error loading concept count for income:', income.id, error);
        }
      });
    });
  }

  updateIncomeCountItems(incomeId: number, count: number) {
    if (this.gridApi) {
      this.gridApi.forEachNode((node) => {
        if (node.data && node.data.id === incomeId) {
          node.data.countItems = count;
          this.gridApi.refreshCells({
            rowNodes: [node],
            columns: ['countItems'],
            force: true
          });

          // Guardar en el servidor
          const dataToSave = {
            countItems: count,
            modifiedBy: this.currentUser
          };
          this.administrationService.updateRowsIncorExp(incomeId, dataToSave).subscribe({
            next: () => {
              console.log('Contador de items actualizado en servidor');
            },
            error: (error) => {
              console.error('Error actualizando contador de items:', error);
            }
          });
        }
      });
    }
  }

  loadConceptsData(incomeId: number, successCallback: any) {
    this.incomesAndExpensesService.getConceptsFromIncomesAndExpenses(incomeId).subscribe({
      next: (data: any) => {
        successCallback(data);
      },
      error: (error) => {
        console.error('Error loading concepts:', error);
        successCallback([]);
      }
    });
  }

  async saveConceptsById(incomeId: number, data: any) {
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
        this.incomesAndExpensesService.getIncomeAndExpenseById(incomeId)
      );

      const mainDocument = mainDocumentResponse[0];
      const updatedDocument = {
        ...mainDocument,
        subtotal: subtotal,
        tax: tax,
        total: total
      };

      await lastValueFrom(
        this.incomesAndExpensesService.updateIncomesAndExpenses(incomeId, updatedDocument)
      );

      if (newConcepts.length > 0 || modifiedConcepts.length > 0) {
        alerts.basicAlert(
          'Conceptos guardados',
          'Se han guardado los conceptos correctamente.',
          'success'
        );

        // Actualizar el contador de conceptos
        this.updateIncomeCountItems(incomeId, conceptsData.length);

        // Refrescar la lista de ingresos para mostrar totales actualizados
        this.signalsService.triggerUpdateIncAndExp();
        setTimeout(() => this.getIncomes(), 500);
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


  /**
   * Obtiene el último consecutivo usado para una cuenta bancaria específica
   * Analiza todos los ingresos de la cuenta y extrae el número más alto
   */
  private async getLastConsecutiveForAccount(idAccount: number): Promise<number> {
    try {
      // Obtener todos los ingresos de esta cuenta bancaria desde el servidor
      const allIncomes: any = await lastValueFrom(
        this.incomesAndExpensesService.getIncomesAndExpenses(this.root)
      );

      // Filtrar solo los de esta cuenta y tipo DEPOSITO
      const accountIncomes = allIncomes?.filter((income: any) =>
        income.type === "DEPOSITO" &&
        income.idAccount === idAccount &&
        income.numberDocument
      ) || [];

      if (accountIncomes.length === 0) {
        // Si no hay ingresos previos, empezar desde 0
        return 0;
      }

      // Extraer los consecutivos numéricos de los números de documento
      const prefix = this.prefixAndConsecutive[0].prefix;
      const consecutives = accountIncomes
        .map((income: any) => {
          const numberDocument = income.numberDocument || '';
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

      console.log(`✅ Último consecutivo para cuenta ${idAccount}: ${maxConsecutive}`);
      return maxConsecutive;

    } catch (error) {
      console.error('Error obteniendo último consecutivo:', error);
      // En caso de error, retornar 0 para empezar desde el principio
      return 0;
    }
  }
  excel(){
    const modalElement = document.getElementById('optionExcel');
        if (modalElement) {
          this.modalInstance = new bootstrap.Modal(modalElement, {
            backdrop: 'static',
            keyboard: false
          });
          this.modalInstance.show();
        }
  }
  
  onSubmit() {
    if (this.myForm.invalid) {
      alerts.basicAlert('Formulario inválido', 'Por favor, seleccione las fechas de inicio y fin.', 'error');
      return;
    }

    const { fechaInicio, fechaFin, tipoReporte } = this.myForm.value;

    this.incomesAndExpensesService.getExcel(fechaInicio, fechaFin, tipoReporte).subscribe({
      next: (base64String: string) => {
        try {
          const byteCharacters = atob(base64String);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `Reporte_Ingresos_${new Date().toISOString().slice(0, 10)}.xlsx`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          this.closeModal();
        } catch (error) {
          console.error('Error al decodificar o descargar el archivo:', error);
          alerts.basicAlert('Error', 'No se pudo procesar el archivo para la descarga.', 'error');
        }
      },
      error: (err) => {
        console.error('Error al generar el Excel:', err);
        alerts.basicAlert('Error', 'Ocurrió un error al generar el reporte en el servidor.', 'error');
      }
    });
  }

  closeModal() {
    this.modalInstance?.hide();
  }

}
