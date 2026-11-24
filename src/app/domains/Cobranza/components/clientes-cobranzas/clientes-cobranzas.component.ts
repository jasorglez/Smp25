import { Component, effect, ElementRef, HostListener, inject, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { alerts } from '../../../../helpers/alerts';
import { States } from 'app/interface/states';
import {
  catchError,
  concat,
  EMPTY,
  lastValueFrom,
  toArray,
  throwError,
} from 'rxjs';
import { map } from 'rxjs/operators';
import { AgGridModule } from 'ag-grid-angular';
import { ModalService } from 'app/services/modal.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { SignalsService } from 'app/services/signals.service';
import { CustomersPaymentsComponent } from 'app/domains/ModAdmon/components/customers/customers-payments.component';
import { CustomersBillingComponent } from 'app/domains/ModAdmon/components/customers/customers-billing.component';
import { CustomersCotizacionesComponent } from 'app/domains/ModAdmon/components/customers/customers-cotizaciones.component';
import { ClientesCobranzasDetailWrapperComponent } from './clientes-cobranzas-detail-wrapper.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { RadiusinfluenceComponent } from 'app/domains/ModAdmon/components/radiusinfluence/radiusinfluence.component';
import { CustomersService } from 'app/services/customers.service';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { InegiService } from 'app/services/inegi.service';
import { BranchsService } from 'app/services/branchs.service';
import { AuthService } from 'app/services/auth.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { Icatalog } from 'app/interface/icatalog';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { TrackingService } from 'app/services/tracking.service';
import { FacturacionService } from 'app/services/facturacion.service';
import { AdministrationService } from 'app/services/administration.service';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { PdfPreviewService } from 'app/services/pdf-preview.service';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { UsersService } from 'app/services/users.service';
import { CobranzaOfflineService } from 'app/services/cobranza-offline.service';

@Component({
  selector: 'app-clientes-cobranzas',
  standalone: true,
  imports: [
    RouterModule,
    DomainsModule,
    FormsModule,
    AgGridModule,
    MultiLineEditorComponent,
    CustomersPaymentsComponent,
    CustomersBillingComponent,
    CustomersCotizacionesComponent,
    ClientesCobranzasDetailWrapperComponent,
  ],
  templateUrl: './clientes-cobranzas.component.html',
  styleUrls: ['./clientes-cobranzas.component.scss'],
})
export class ClientesCobranzasComponent implements CanComponentDeactivate {
  @ViewChild('clientesGrid', { read: ElementRef }) private clientesGridElement: ElementRef<HTMLElement>;
  @ViewChild('newCustomerModal') private customerModal: TemplateRef<any>;
  private enterHighlightedCell: HTMLElement | null = null;

  private customerService = inject(CustomersService);
   private modalServiceTable = inject(ModalService);
   private signalsService = inject(SignalsService);
   private modalService = inject(NgbModal);
   private route = inject(ActivatedRoute);
   private inegiService = inject(InegiService);
   private branchesService = inject(BranchsService);
   authService = inject(AuthService);
   private catalogsService = inject(CatalogsService);
   private trackingService = inject(TrackingService);
   private facturacionService = inject(FacturacionService);
   private administrationService = inject(AdministrationService);
   private incomesAndExpensesService = inject(IncomesAndExpensesService);
  private pdfPreview = inject(PdfPreviewService);
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);
  private usersService = inject(UsersService);
  private cobranzaOffline = inject(CobranzaOfflineService);
  private lastOfflineSyncRevision = 0;

  private http = inject(HttpClient);
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  
  async ngOnInit() {
    this.type = 'CUSTOMERS'; // Default type for customers component
    this.obtenerDatos();
    this.signalsService.deleteClientData();
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    this.loadCollectors();
    await this.getTypecop();
    this.loadFiscalCatalogs(); // Cargar catálogos SAT
    this.loadCustomersBilling(); // Cargar clientes habilitados para facturación
    this.route.data.subscribe((data) => {
      this.type = data['type'] || 'CUSTOMERS'; // 'CUSTOMERS' o 'PROVIDERS'
      this.obtenerDatos(); // Llamar a la función para cargar datos
      this.getStates(); // Llamar a la función para obtener los estados
      this.obtenerBranchs();

    });
  }

  constructor() {
    effect(() => {
      const revision = this.cobranzaOffline.syncRevision();
      if (revision > this.lastOfflineSyncRevision) {
        this.lastOfflineSyncRevision = revision;
        void this.obtenerDatos();
      }
    });

    effect(async () => {
      if (this.signalsService.getRefreshEmployees()() == true) {
        await this.obtenerDatos(); // Actualizar datos cuando se recibe señal
        this.signalsService.resetRefreshEmployees(); // Resetear la señal después de actualizar
      }
    });

    effect(() => {
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.obtenerDatos();
      this.obtenerBranchs();
      this.getTypecop();
      this.signalsService.deleteClientData();
    }, { allowSignalWrites: true });

    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.getTypecop();
  });

    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.obtenerDatos();
      this.obtenerBranchs();
      this.getTypecop();
      this.loadCollectors();
      this.actualizarContextoCotizaciones(); // refrescar contexto del cascade
      console.log(this.contactoCatalog)
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  
  type: string = ''; // Para almacenar el tipo (CUSTOMERS o PROVIDERS)
  gridHeight: string = '75vh';
  showCreditsTab: boolean = false;
  showBillingTab: boolean = false;
  showCotizacionesTab: boolean = false;
  private gridApi: GridApi;
  notSavedChanges: boolean = false;
  selectedRowData: any = null;
  newCustomer: any = null;
  editingCustomerId: number | null = null;
  loadingCustomerForEdit = false;
  savingNewCustomer = false;
  isOpen: boolean = false;
  branchs: any[] = [];
  Typecop: any[] = [];
  collectors: any[] = [];
  generatingCollectorsReport = false;
  generatingPortfolioReport = false;
  collectorsLoading = false;
  private collectorsRequestId = 0;
  contactoCatalog: any[] = [];

  // Catálogos SAT para facturación electrónica
  fiscalRegimes: any[] = [];
  usosFactura: any[] = [];
  customersBilling: any[] = []; // Clientes habilitados para facturación

  // Agregar esta nueva variable para almacenar el ID de la última fila editada
  private lastEditedRowId: number | string | null = null;

  rowData: any;
  private loanTotalsByCustomer = new Map<number, { loans: number; due: number; payments: number; pending: number; overdue: number; overdueInstallments: number }>();
  loanTotalsLoaded = false;
  private loanTotalsRequestId = 0;
  private loanTotalsLoadingRoot: number | null = null;
  balanceFilter: 'all' | 'pending' | 'overdue' = 'all';
  loanTotalsError = '';
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];

  id: string;
  idRoot: number;
  private tempIdCounter: number = 0;
  selectedTab: string = 'customers-payments';
  idBranch: number | null = null;
  idEmployee: number;
  private zipCodeDataByCp = new Map<string, any[]>();

  estados: string[] = []; // Agregar esta variable para almacenar los estados

  public defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: true,
    lockPosition: false,
    enableRowGroup: true, // Enable row grouping for all columns
    flex: 1,
  };

  currentIndex = 0;

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'never';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'never';

  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent,
  };

  idClient = this.signalsService.getIdClient();
  nameClient = this.signalsService.getNameClient()();

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    rowBuffer: 20,
    singleClickEdit: true,
    // ── Master-Detail: wrapper que puede mostrar cotizaciones o agenda ─────
    masterDetail: true,
    detailCellRenderer: ClientesCobranzasDetailWrapperComponent,
    detailRowHeight: 1600,    // toolbar(50) + lista auto + PDF(1400) con margen
    isRowMaster: () => this.type === 'CUSTOMERS',
    isExternalFilterPresent: () => this.type === 'CUSTOMERS' && this.loanTotalsLoaded && this.balanceFilter !== 'all',
    doesExternalFilterPass: (node: any) => {
      if (node.data?.__isNew) return true;
      const totals = this.loanTotalsByCustomer.get(Number(node.data?.id));
      return this.balanceFilter === 'pending' ? (totals?.pending || 0) > 0 : (totals?.overdue || 0) > 0;
    },
    // ──────────────────────────────────────────────────────────────────────
    getRowId: (params: any) => params?.data?.id,
    getRowClass: (params) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onCellFocused: (event: any) => {
      if (event.rowIndex === null || event.rowIndex === undefined || !event.column) {
        this.enterHighlightedCell?.classList.remove('enter-active-cell');
        this.enterHighlightedCell = null;
        return;
      }

      requestAnimationFrame(() =>
        this.highlightEnterCell(event.rowIndex, event.column.getColId())
      );
    },
    onRowClicked: (event) => {
      event.node.setSelected(true);
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
    onCellKeyDown: (event: any) => {
      if (event.event.key === 'Enter') {
        event.event.preventDefault();
        event.event.stopPropagation();
        this.moveToNextColumn(event, event.event.shiftKey);
      }
    },
  };

  private _colMaster: ColDef[] = [];

  get colMaster(): ColDef[] {
    if (this._colMaster.length > 0) {
      return this._colMaster;
    }

    this._colMaster = [
      {
        field: 'estadoCuentaPdf',
        headerName: 'Estado de cuenta',
        width: 132,
        minWidth: 132,
        editable: false,
        hide: this.type !== 'CUSTOMERS',
        sortable: false,
        filter: false,
        cellRenderer: (params: any) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'btn btn-outline-danger btn-sm';
          button.style.cssText = 'font-size:10px;padding:1px 6px;line-height:1.4;';
          button.innerHTML = '<i class="bi bi-file-earmark-pdf-fill me-1"></i> PDF';
          button.title = 'Generar estado de cuenta PDF de este cliente';
          button.setAttribute('aria-label', `Estado de cuenta PDF del cliente ${params.data?.nameContact || params.data?.company || params.data?.id || ''}`);
          button.disabled = !params.data?.id || params.data?.__isNew === true;
          button.addEventListener('click', (event) => {
            event.stopPropagation();
            if (!button.disabled) void this.generatePaymentsPdf(params.data);
          });
          return button;
        },
        cellStyle: { backgroundColor: '#fff1f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
      },
      // ── Cotizaciones — abre cascada inline ────────────────────────────────
      {
        field: 'cotizaciones',
        headerName: '📄',
        width: 60,
        editable: false,
        hide: true,
        sortable: false,
        cellRenderer: (params: any) => {
          const btn = document.createElement('button');
          btn.className = 'btn btn-info btn-sm';
          btn.style.cssText = 'font-size:10px;padding:1px 6px;line-height:1.4;';
          btn.innerHTML = '<i class="bi bi-file-earmark-text"></i>';
          btn.title = 'Cotizaciones del cliente';
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleCascadeWithMode(params.node, 'cotizaciones');
          });
          return btn;
        },
        cellStyle: {
          backgroundColor: '#e8f4ff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
      },
      // ── Agenda — abre cascada inline ──────────────────────────────────────
      {
        field: 'agenda',
        headerName: '📅',
        width: 60,
        editable: false,
        hide: true,
        sortable: false,
        cellRenderer: (params: any) => {
          const btn = document.createElement('button');
          btn.className = 'btn btn-success btn-sm';
          btn.style.cssText = 'font-size:10px;padding:1px 6px;line-height:1.4;';
          btn.innerHTML = '<i class="bi bi-calendar-check"></i>';
          btn.title = 'Agenda de este cliente';
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleCascadeWithMode(params.node, 'agenda');
          });
          return btn;
        },
        cellStyle: {
          backgroundColor: '#f0fff4',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
      },
      {
        field: 'pagos',
        headerName: 'Pagos',
        width: 120,
        minWidth: 110,
        flex: 0,
        editable: false,
        hide: this.type !== 'CUSTOMERS',
        sortable: false,
        cellRenderer: (params: any) => {
          const button = document.createElement('button');
          button.className = 'btn btn-primary btn-sm';
          button.style.cssText = 'font-size:10px;padding:1px 6px;line-height:1.4;';
          button.innerHTML = '<i class="bi bi-cash-coin"></i>';
          button.title = 'Historial de pagos del cliente';
          button.addEventListener('click', (event) => {
            event.stopPropagation();
            this.toggleCascadeWithMode(params.node, 'pagos');
          });
          return button;
        },
        cellStyle: { backgroundColor: '#eef2ff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
      },
      ...([
        { colId: 'totalPrestamos', headerName: 'Total préstamos', key: 'loans', background: '#e7f1ff', color: '#174d80', format: 'currency' },
        { colId: 'totalPagosCobranza', headerName: 'Total pagos', key: 'payments', background: '#e6f4ea', color: '#166534', format: 'currency' },
        { colId: 'totalPendientes', headerName: 'Total pendientes', key: 'pending', background: '#fff3d6', color: '#9a5b00', format: 'currency' },
        { colId: 'totalVencido', headerName: 'Saldo vencido', key: 'overdue', background: '#fee2e2', color: '#991b1b', format: 'currency' },
        { colId: 'cuotasVencidas', headerName: 'Cuotas vencidas', key: 'overdueInstallments', background: '#fee2e2', color: '#991b1b', format: 'number' },
      ] as const).map(column => ({
        colId: column.colId,
        headerName: column.headerName,
        width: 145,
        minWidth: 135,
        flex: 0,
        pinned: 'right' as const,
        lockPinned: true,
        suppressMovable: true,
        editable: false,
        hide: this.type !== 'CUSTOMERS',
        valueGetter: (params: any) => this.loanTotalsLoaded
          ? this.loanTotalsByCustomer.get(Number(params.data?.id))?.[column.key] ?? 0
          : null,
        valueFormatter: (params: any) => params.value === null || params.value === undefined
          ? '—'
          : column.format === 'number'
            ? String(Number(params.value))
            : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(params.value)),
        cellStyle: { backgroundColor: column.background, color: column.color, fontWeight: '600', textAlign: 'right' as const },
      })),
      {
        field: 'enabledForBilling',
        headerName: 'Facturación Electrónica',
        width: 180,
        editable: false,
        hide: true,
        cellRenderer: (params: ICellRendererParams) => {
          const link = document.createElement('a');
          link.href = 'javascript:void(0)';
          link.innerText = 'Ver Facturación';
          link.style.color = '#0d6efd';
          link.style.textDecoration = 'underline';
          link.style.cursor = 'pointer';
          link.addEventListener('click', (e) => {
            e.preventDefault();
            this.onCellDoubleClicked({
              column: { getColId: () => 'enabledForBilling' },
              data: params.data,
              node: params.node,
              api: params.api
            } as any);
          });
          return link;
        }
      },
      {
        field: 'idBranch',
        headerName: 'Nombre sucursal',
        headerClass: 'required-header',
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
        hide:
          this.authService.hasDetailedPermission(
            'principal',
            'see-all-branches'
          ) || this.signalsService.getemailChoose() === environment.root
            ? false
            : true,
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        filter: true,
        width: 170,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => {
          // Ensure depto data is available when creating editor
          return {
            values: this.branchs ? this.branchs.map((item) => item.id) : [],
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
        field: 'idUsuarioCobrador',
        headerName: 'Cobrador / vendedor',
        hide: this.type !== 'CUSTOMERS',
        editable: this.type === 'CUSTOMERS',
        filter: true,
        width: 190,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: () => ({
          values: this.collectors.map(user => Number(user.id)),
          formatValue: (value: number) => this.collectorName(value),
          searchType: 'matchAny',
          allowTyping: true,
          filterList: true,
        }),
        valueFormatter: (params) => this.collectorName(params.value),
        valueSetter: (params) => {
          const id = Number(params.newValue);
          if (!this.collectors.some(user => Number(user.id) === id)) return false;
          params.data.idUsuarioCobrador = id;
          return true;
        },
      },
      {
        field: 'nameContact',
        headerName: 'Nombre Contacto',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        filter: true,
        //suppressMovable: true,
        width: 270,
        cellEditor: 'autocompleteEditor',
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',d
        },
        cellEditorParams: {
          filterList: this.rowData?.map((e) => e.nameContact.toUpperCase()) || [],
          filterKey: 'nameContact',
          placeholder: 'Nombre Contacto',
          minLength: 1
        },
        valueSetter: (params) => {
          const rawValue = params.newValue;
          if (!rawValue || typeof rawValue !== 'string') {
            alerts.basicAlert('Campo requerido', 'El nombre es obligatorio', 'error');
            return false;
          }

          const normalizedValue = this.normalizeCustomerName(rawValue);

          if (!normalizedValue) {
            alerts.basicAlert('Campo requerido', 'El nombre es obligatorio', 'error');
            return false;
          }

          const duplicateExists = this.hasDuplicateCustomerName(
            normalizedValue,
            params.data
          );

          if (duplicateExists) {
            alerts.basicAlert(
              'Cliente duplicado',
              'Este cliente ya está registrado.',
              'error'
            );
            return false;
          }

          params.data[params.colDef.field] = normalizedValue;
          params.data.company = normalizedValue;
          return true;
        },
      },
{
        field: 'company',
        headerName: 'Compania/Cliente',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        width: 250,
        filterParams: {
          defaultToNothingSelected: true,
        },
        suppressMovable: true,
        filter: true,
        valueSetter: (params) => {
          const upperValue = this.normalizeCustomerName(params.newValue);
          if (!upperValue) {
            alerts.basicAlert('Campo requerido', 'El nombre es obligatorio', 'error');
            return false;
          }

          if (this.hasDuplicateCustomerName(upperValue, params.data)) {
            alerts.basicAlert(
              'Cliente duplicado',
              'Este cliente ya está registrado.',
              'error'
            );
            return false;
          }

          params.data[params.colDef.field] = upperValue;
          params.data.nameContact = upperValue;
          return true;
        }
       
      },
      {
        field: 'total',
        headerName:
          this.type === 'CUSTOMERS' ? 'Total Credito' : 'Cuentas X Pagar',
        editable: false,
        filter: 'agNumberColumnFilter',
        suppressMovable: true,
        width: 160,
        hide: this.type === 'CUSTOMERS',
        valueFormatter: (params) => {
          if (params.value) {
            return new Intl.NumberFormat('es-MX', {
              style: 'currency',
              currency: 'MXN',
            }).format(params.value);
          }
          return '$0.00';
        },
        cellStyle: { backgroundColor: '#d4edda' },
      },
      {
        field: 'idTypecop',
        headerName: this.type == 'CUSTOMERS' ? 'Tipo cliente' : 'Tipo proveedor',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        width: 150,
        hide: this.type === 'CUSTOMERS',
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => {
          return {
            values: this.Typecop ? this.Typecop.map((item) => item.id) : [],
          };
        },
        valueFormatter: (params) => {
          if (!params.value) return 'DISTRIBUIDOR';
          const foundItem = this.Typecop
            ? this.Typecop.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.description}` : 'DISTRIBUIDOR';
        },
      },

      {
        field: 'rfc',
        headerName: 'RFC',
        editable: true,
        hide: this.type !== 'CUSTOMERS',
        filter: true,
        width: 145,
        valueSetter: (params) => {
          params.data.rfc = String(params.newValue || '').trim().toUpperCase();
          return true;
        },
      },
      {
        field: 'cp',
        headerName: 'CP',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        filter: true,
        width: 105,
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
      },
      {
        field: 'address',
        headerName: 'Direccion',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        width: 250,
        filter: true,
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
        valueSetter: (params) => {
          params.data[params.colDef.field] = params.newValue.toUpperCase();
          return true;
        }
        /*cellEditor: 'agPopupTextCellEditor',
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
        },*/
      },
      /*{
        field: 'addressfiscal',
        headerName: 'Direccion Fiscal',
        editable: false,
        width: 250,
        filter: true,
        hide: true,
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
        },
      },*/
      {
        field: 'state',
        headerName: 'Estado',
        filter: true,
        width: 160,
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params: any) => {
          // Leer el catálogo al abrir el editor: la respuesta de INEGI llega
          // después de crear las columnas. Conservar además el valor actual
          // si la API no lo devuelve para no borrarlo al iniciar la edición.
          const values = [...this.estados];
          const currentState = String(params.value ?? '').trim();
          const currentStateExists = values.some(
            (state) => state.trim().toLocaleLowerCase() === currentState.toLocaleLowerCase()
          );
          if (currentState && !currentStateExists) values.unshift(currentState);
          return { values };
        },
      },
      {
        field: 'city',
        headerName: 'Ciudad',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
        width: 120,
        filter: true,
      },
      {
        field: 'neighborhood',
        headerName: 'Colonia',
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        filter: true,
        width: 300,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => {
          const cp = String(params.data?.cp ?? '').trim();
          const zipData = this.zipCodeDataByCp.get(cp);
          if (!zipData?.length && /^\d{5}$/.test(cp)) {
            void this.loadZipCodeContext(params.data);
          }
          if (zipData?.length) {
            const asentamientos = zipData[0].asentamientos || [];
            // Ordenar los asentamientos alfabéticamente
            const sortedAsentamientos = [...asentamientos].sort((a, b) =>
              a.localeCompare(b)
            );
            return {
              values: sortedAsentamientos,
            };
          }
          return { values: [] };
        },
        valueFormatter: (params) => {
          return params.value || 'Seleccionar asentamiento';
        },
      },
      {
        field: 'phone',
        headerName: 'Telefono',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        width: 120,
        valueSetter: (params) => {
          const phoneValue = params.newValue;
          // Verificar que el número tenga exactamente 10 dígitos y sea numérico
          const isValidPhone = /^\d{10}$/.test(phoneValue);
          if (!isValidPhone) {
            alerts.basicAlert(
              'Teléfono inválido',
              'El teléfono debe contener exactamente 10 dígitos numéricos.',
              'error'
            );
            return false; // No se permite el cambio
          }
          params.data[params.colDef.field] = phoneValue;
          return true;
        },
      },
      /*{
        field: 'latitud',
        headerName: 'Latitud',
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
        field: 'longitud',
        headerName: 'Longitud',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        width: 120,
        filter: true,
      },*/

      {
        field: 'email',
        headerName: 'Correo',
        width: 200,
        cellEditor: 'agTextCellEditor',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        cellEditorParams: {
          useFormatter: true,
        },
        valueFormatter: (params) => params.value,
        valueSetter: (params) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailRegex.test(params.newValue)) {
            const duplicateExists = this.rowData.some(
              (row, index) =>
                index !== params.node.rowIndex && row.email === params.newValue
            );
            if (duplicateExists) {
              alerts.basicAlert(
                'Añadir usuario',
                'Ya existe un usuario con ese correo electrónico.',
                'error'
              );
              return false;
            }
            params.data[params.colDef.field] = params.newValue;
            return true;
          } else {
            alerts.basicAlert(
              'Editar usuario',
              'Correo electrónico no válido.',
              'error'
            );
            return false;
          }
        },
      },

      {
        field: 'id',
        headerName: 'Id',
        editable: false,
        width: 70,
        hide: true,
        filter: 'agNumberColumnFilter', // Filtro para números (si el ID es numérico)
        filterParams: {
          filterOptions: ['equals'], // Opciones de filtro
        },
      },
      {
        field: 'vigente',
        headerName: 'Activo',
        editable: true,
        width: 100,
        hide: true,
      },
      {
        field: 'radio',
        headerName: 'Radio',
        editable: true,
        width: 90,
        hide: this.type !== 'CUSTOMERS',
      },
    ];

    return this._colMaster;
  }

  async generatePaymentsPdf(customer: any): Promise<void> {
    try {
      const loans: any[] = await lastValueFrom(this.customerService.getCobranzaLoans(customer.id));
      const pdfMake = (await import('pdfmake/build/pdfmake')).default;
      const pdfFonts = await import('pdfmake/build/vfs_fonts');
      (pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;
      const root: any = await lastValueFrom(this.rootService.getRootbyId(customer.idRoot || this.idRoot));
      const logo = root?.picture ? await this.base64EncodeService.convertImageToBase64(root.picture) : null;
      const logo2 = root?.picture2 ? await this.base64EncodeService.convertImageToBase64(root.picture2) : null;
      const money = (value: any) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value || 0));
      const date = (value: any) => value ? String(value).slice(0, 10).split('-').reverse().join('/') : '';
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const loanSummaries = (loans || []).map(loan => {
        const installments = (loan.cuotas || []).filter((item: any) => item.active !== false);
        const rows = installments.map((item: any) => {
          const payments = (item.abonos || []).filter((payment: any) => payment.active !== false);
          const paid = Number.isFinite(Number(item.montoAplicado))
            ? Number(item.montoAplicado)
            : payments.reduce((sum: number, payment: any) => sum + Number(payment.monto || 0), 0);
          const due = Math.max(0, Number(item.montoProgramado || 0) - paid);
          return { item, paid, due };
        });
        const scheduled = rows.reduce((sum: number, row: any) => sum + Number(row.item.montoProgramado || 0), 0);
        const paid = rows.reduce((sum: number, row: any) => sum + row.paid, 0);
        const overdue = rows.filter((row: any) => String(row.item.fechaProgramada || '').slice(0, 10) < today && row.due > 0);
        return { loan, installments, scheduled, paid, balance: Math.max(0, scheduled - paid), overdueCount: overdue.length, overdueBalance: overdue.reduce((sum: number, row: any) => sum + row.due, 0) };
      });
      const totalScheduled = loanSummaries.reduce((sum, item) => sum + item.scheduled, 0);
      const totalPaid = loanSummaries.reduce((sum, item) => sum + item.paid, 0);
      const totalBalance = loanSummaries.reduce((sum, item) => sum + item.balance, 0);
      const overdueCount = loanSummaries.reduce((sum, item) => sum + item.overdueCount, 0);
      const overdueBalance = loanSummaries.reduce((sum, item) => sum + item.overdueBalance, 0);
      const content: any[] = [
        { columns: [logo ? { image: logo, fit: [75, 65] } : { text: '' }, { text: root?.name || '', alignment: 'center', bold: true, fontSize: 12, margin: [0, 15, 0, 0] }, logo2 ? { image: logo2, fit: [75, 65], alignment: 'right' } : { text: '' }], margin: [0, 0, 0, 12] },
        { text: 'ESTADO DE CUENTA DEL CLIENTE', style: 'title' },
        { text: `Cliente: ${customer.nameContact || customer.company || customer.id}`, margin: [0, 0, 0, 4] },
        { text: `Fecha de emisión: ${new Date().toLocaleDateString('es-MX')}`, margin: [0, 0, 0, 14] },
        { table: { widths: ['*', '*', '*', '*', '*'], body: [
          [{ text: 'Préstamos', bold: true }, { text: 'Total programado', bold: true }, { text: 'Total abonado', bold: true }, { text: 'Saldo pendiente', bold: true }, { text: 'Vencido', bold: true }],
          [String(loanSummaries.length), money(totalScheduled), money(totalPaid), money(totalBalance), `${overdueCount} cuotas · ${money(overdueBalance)}`]
        ] }, layout: 'lightHorizontalLines', fontSize: 8, margin: [0, 0, 0, 12] },
      ];
      if (!loans?.length) content.push({ text: 'Este cliente no tiene préstamos registrados.' });
      for (const summary of loanSummaries) {
        const loan = summary.loan;
        const installments = [...summary.installments].sort((a: any, b: any) => a.numeroCuota - b.numeroCuota);
        const interestRate = Number(loan.montoTotal) > 0 ? Math.round(Number(loan.totalInteres || 0) / Number(loan.montoTotal) * 10000) / 100 : 0;
        const frequency = ({ DIARIO: 'diario', SEMANAL: 'semanal', QUINCENAL: 'quincenal', MENSUAL: 'mensual' } as any)[loan.frecuenciaPago] || 'mensual';
        content.push({ text: `Préstamo #${loan.id}  ·  Capital: ${money(loan.montoTotal)}  ·  Interés total: ${money(loan.totalInteres)} (${interestRate}%)  ·  Pagos: ${frequency}  ·  Inicio: ${date(loan.fechaInicio)}`, style: 'loan', margin: [0, 10, 0, 4] });
        content.push({ text: `Total a pagar: ${money(summary.scheduled)}   Abonado: ${money(summary.paid)}   Saldo: ${money(summary.balance)}   Cuotas vencidas: ${summary.overdueCount} (${money(summary.overdueBalance)})`, margin: [0, 0, 0, 5] });
        const rows: any[][] = [[{ text: '#', bold: true }, { text: 'Programado', bold: true }, { text: 'Capital', bold: true }, { text: 'Interés', bold: true }, { text: 'Abonado', bold: true }, { text: 'Saldo', bold: true }, { text: 'Estado', bold: true }]];
        for (const installment of installments) {
          const received = Number.isFinite(Number(installment.montoAplicado)) ? Number(installment.montoAplicado) : (installment.abonos || []).filter((payment: any) => payment.active !== false).reduce((sum: number, payment: any) => sum + Number(payment.monto || 0), 0);
          const balance = Math.max(0, Number(installment.montoProgramado || 0) - received);
          const installmentDate = String(installment.fechaProgramada || '').slice(0, 10);
          const status = balance <= 0 ? 'Pagada' : installmentDate < today ? 'Vencida' : 'Pendiente';
          rows.push([String(installment.numeroCuota), date(installment.fechaProgramada), money(installment.montoCapital ?? installment.montoProgramado), money(installment.montoInteres || 0), money(received), money(balance), status]);
        }
        content.push({ table: { headerRows: 1, widths: [18, 58, 61, 54, 60, 55, '*'], body: rows }, layout: 'lightHorizontalLines', fontSize: 7 });
        const payments = installments.flatMap((item: any) => (item.abonos || []).map((payment: any) => ({ numero: item.numeroCuota, ...payment })));
        if (payments.length) {
          content.push({ text: 'Abonos recibidos', bold: true, margin: [0, 8, 0, 3] });
          content.push({ table: { headerRows: 1, widths: [35, 90, 90, '*'], body: [[{ text: 'Cuota', bold: true }, { text: 'Fecha', bold: true }, { text: 'Monto', bold: true }, { text: 'Comentario', bold: true }], ...payments.map((payment: any) => [String(payment.numero), date(payment.fechaPago), money(payment.monto), payment.comentario || ''])] }, layout: 'lightHorizontalLines', fontSize: 8 });
        }
      }
      const customerName = customer.nameContact || customer.company || `Cliente ${customer.id}`;
      await this.pdfPreview.show((pdfMake as any).createPdf({ pageSize: 'LETTER', pageMargins: [35, 35, 35, 35], content, styles: { title: { fontSize: 15, bold: true }, loan: { fontSize: 11, bold: true } } }), `Estado de cuenta · ${customerName}`, `Estado_cuenta_cliente_${customer.id}.pdf`);
    } catch (error) { console.error(error); alerts.basicAlert('Error', 'No se pudo generar el PDF de pagos.', 'error'); }
  }

  async generateCustomersByCollectorPdf(): Promise<void> {
    if (!this.idRoot || this.generatingCollectorsReport) return;
    this.generatingCollectorsReport = true;
    try {
      const [customers, root]: [any[], any] = await Promise.all([
        lastValueFrom(this.customerService.getCustomersByCompany(Number(this.idRoot), 'CUSTOMERS')) as Promise<any[]>,
        lastValueFrom(this.rootService.getRootbyId(Number(this.idRoot))) as Promise<any>,
      ]);
      const activeCustomers = (Array.isArray(customers) ? customers : []).filter(customer => customer?.active !== false);
      const groups = new Map<number | null, any[]>();
      for (const customer of activeCustomers) {
        const collectorId = customer?.idUsuarioCobrador ? Number(customer.idUsuarioCobrador) : null;
        groups.set(collectorId, [...(groups.get(collectorId) || []), customer]);
      }
      const pdfMake = (await import('pdfmake/build/pdfmake')).default;
      const pdfFonts = await import('pdfmake/build/vfs_fonts');
      (pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;
      const logo = root?.picture ? await this.base64EncodeService.convertImageToBase64(root.picture) : null;
      const logo2 = root?.picture2 ? await this.base64EncodeService.convertImageToBase64(root.picture2) : null;
      const content: any[] = [
        { columns: [logo ? { image: logo, fit: [70, 60] } : { text: '' }, { text: root?.name || '', alignment: 'center', bold: true, fontSize: 12, margin: [0, 15, 0, 0] }, logo2 ? { image: logo2, fit: [70, 60], alignment: 'right' } : { text: '' }], margin: [0, 0, 0, 12] },
        { text: 'CLIENTES POR COBRADOR', bold: true, fontSize: 15, margin: [0, 0, 0, 4] },
        { text: `Fecha de emisión: ${new Date().toLocaleDateString('es-MX')}   ·   Clientes: ${activeCustomers.length}`, margin: [0, 0, 0, 12] },
      ];
      const sortedGroups = [...groups.entries()].sort(([a], [b]) => this.collectorName(a).localeCompare(this.collectorName(b), 'es'));
      if (!sortedGroups.length) content.push({ text: 'No hay clientes activos registrados para esta empresa.' });
      for (const [collectorId, assignedCustomers] of sortedGroups) {
        const customersSorted = assignedCustomers.slice().sort((a, b) => String(a.nameContact || a.company || '').localeCompare(String(b.nameContact || b.company || ''), 'es'));
        content.push({ text: `${this.collectorName(collectorId)}  ·  ${customersSorted.length} cliente(s)`, bold: true, fontSize: 11, margin: [0, 9, 0, 4], headlineLevel: 1 });
        const rows: any[][] = [[{ text: 'Cliente', bold: true }, { text: 'Sucursal', bold: true }, { text: 'Teléfono', bold: true }, { text: 'Dirección', bold: true }]];
        for (const customer of customersSorted) {
          const branch = this.branchs.find(item => Number(item.id) === Number(customer.idBranch));
          rows.push([customer.nameContact || customer.company || `Cliente #${customer.id}`, branch?.name || '', customer.phone || customer.mobile || '', [customer.address, customer.neighborhood, customer.city, customer.state, customer.cp].filter(Boolean).join(', ')]);
        }
        content.push({ table: { headerRows: 1, widths: [120, 75, 75, '*'], body: rows }, layout: 'lightHorizontalLines', fontSize: 8, margin: [0, 0, 0, 5] });
      }
      const safeDate = new Date().toISOString().slice(0, 10);
      await this.pdfPreview.show((pdfMake as any).createPdf({ pageSize: 'LETTER', pageOrientation: 'landscape', pageMargins: [30, 30, 30, 30], content }), 'Clientes por cobrador', `Clientes_por_cobrador_${safeDate}.pdf`);
    } catch (error) {
      console.error('Error al generar reporte de clientes por cobrador:', error);
      alerts.basicAlert('Reporte de clientes', 'No se pudo generar el reporte por cobrador.', 'error');
    } finally {
      this.generatingCollectorsReport = false;
    }
  }

  async generateGeneralLoanPortfolioPdf(): Promise<void> {
    const companyId = Number(this.idRoot || this.signalsService.getRootSelectedBySidebar()()) || 0;
    if (!companyId || this.generatingPortfolioReport) return;
    this.generatingPortfolioReport = true;
    try {
      const [loans, customers, rootResponse]: [any[], any[], any] = await Promise.all([
        lastValueFrom(this.customerService.getCobranzaDashboard(companyId)),
        lastValueFrom(this.customerService.getCustomersByCompany(companyId, 'CUSTOMERS')) as Promise<any[]>,
        lastValueFrom(this.rootService.getRootbyId(companyId)),
      ]);
      const customerRows = Array.isArray(customers) ? customers : [];
      const customersById = new Map(customerRows.map(customer => [Number(customer.id), customer]));
      const activeLoans = (Array.isArray(loans) ? loans : []).filter(loan => loan?.active !== false);
      if (!activeLoans.length) {
        alerts.basicAlert('Cartera de préstamos', 'La empresa no tiene préstamos para incluir en el reporte.', 'info');
        return;
      }

      const root: any = rootResponse?.data ?? rootResponse;
      const [logo, logo2] = await Promise.all([
        root?.picture ? this.base64EncodeService.convertImageToBase64(root.picture).catch(() => null) : Promise.resolve(null),
        root?.picture2 ? this.base64EncodeService.convertImageToBase64(root.picture2).catch(() => null) : Promise.resolve(null),
      ]);
      const pdfMake = (await import('pdfmake/build/pdfmake')).default;
      const pdfFonts = await import('pdfmake/build/vfs_fonts');
      (pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

      const today = new Date();
      const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const money = (value: any) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value || 0));
      const date = (value: any) => {
        const raw = String(value || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '—';
        return new Date(`${raw}T12:00:00`).toLocaleDateString('es-MX');
      };
      const collectorGroups = new Map<number | null, any[]>();
      for (const loan of activeLoans) {
        const customer = customersById.get(Number(loan.idCustomer));
        const collectorId = customer?.idUsuarioCobrador ? Number(customer.idUsuarioCobrador) : null;
        const installments = (loan.cuotas || []).filter((item: any) => item.active !== false);
        const installmentRows = installments.map((item: any) => {
          const payments = (item.abonos || []).filter((payment: any) => payment.active !== false);
          const paid = item.montoAplicado !== null && item.montoAplicado !== undefined && Number.isFinite(Number(item.montoAplicado))
            ? Number(item.montoAplicado)
            : payments.reduce((sum: number, payment: any) => sum + Number(payment.monto || 0), 0);
          const due = Math.max(0, Number(item.montoProgramado || 0) - paid);
          const installmentDate = String(item.fechaProgramada || '').slice(0, 10);
          return { item, due, overdue: due > 0 && installmentDate < todayIso };
        });
        const pending = installmentRows.reduce((sum: number, row: any) => sum + row.due, 0);
        const overdueRows = installmentRows.filter((row: any) => row.overdue);
        const sortedInstallments = installments.slice().sort((a: any, b: any) => String(a.fechaProgramada || '').localeCompare(String(b.fechaProgramada || '')));
        const paymentAmounts = [...new Set(installments.map((item: any) => Number(item.montoProgramado || 0)).filter((amount: number) => amount > 0))];
        const row = {
          collectorName: this.collectorName(collectorId),
          customer: customer?.nameContact || customer?.company || loan.cliente || `Cliente #${loan.idCustomer}`,
          disbursementDate: loan.fechaInicio,
          loanAmount: Number(loan.montoTotal || 0),
          salesNote: String(loan.numeroNotaVenta || '').trim() || '—',
          paymentAmount: paymentAmounts.length === 1 ? money(paymentAmounts[0]) : paymentAmounts.length ? 'Variable' : '—',
          firstPaymentDate: loan.fechaPrimerPago || sortedInstallments[0]?.fechaProgramada,
          pendingText: !installments.length ? 'Sin cuotas' : pending > 0 ? `${money(pending)}${overdueRows.length ? ` · ${overdueRows.length} vencida(s)` : ''}` : 'Al corriente',
          endingDate: sortedInstallments[sortedInstallments.length - 1]?.fechaProgramada,
          pending,
          overdue: overdueRows.reduce((sum: number, item: any) => sum + item.due, 0),
        };
        collectorGroups.set(collectorId, [...(collectorGroups.get(collectorId) || []), row]);
      }

      const allRows = [...collectorGroups.values()].flat();
      const totalPending = allRows.reduce((sum, row) => sum + row.pending, 0);
      const totalOverdue = allRows.reduce((sum, row) => sum + row.overdue, 0);
      const content: any[] = [
        { columns: [logo ? { image: logo, fit: [70, 55] } : { text: '' }, { text: root?.name || 'Cobranza', alignment: 'center', bold: true, fontSize: 12, margin: [0, 14, 0, 0] }, logo2 ? { image: logo2, fit: [70, 55], alignment: 'right' } : { text: '' }], margin: [0, 0, 0, 10] },
        { text: 'CARTERA GENERAL DE PRÉSTAMOS', style: 'title' },
        { text: `Corte al ${today.toLocaleDateString('es-MX')} · ${allRows.length} préstamo(s) · Pendiente: ${money(totalPending)} · Vencido: ${money(totalOverdue)}`, margin: [0, 0, 0, 8] },
      ];
      const sortedGroups = [...collectorGroups.entries()].sort(([a], [b]) => this.collectorName(a).localeCompare(this.collectorName(b), 'es'));
      for (const [collectorId, groupRows] of sortedGroups) {
        groupRows.sort((a, b) => a.customer.localeCompare(b.customer, 'es')
          || String(a.disbursementDate || '').localeCompare(String(b.disbursementDate || ''))
          || a.salesNote.localeCompare(b.salesNote, 'es'));
        content.push({ text: `${this.collectorName(collectorId)} · ${groupRows.length} préstamo(s)`, style: 'section', keepWithNext: true });
        content.push({
          table: { headerRows: 1, widths: [54, 52, '*', 58, 54, 58, 86, 52], body: [
            ['Desembolso', 'Préstamo', 'Cliente', 'Nota de venta', 'Pago', 'Inicio', 'Pendientes', 'Finaliza'].map(text => ({ text, bold: true })),
            ...groupRows.map(row => [date(row.disbursementDate), money(row.loanAmount), row.customer, row.salesNote, row.paymentAmount, date(row.firstPaymentDate), row.pendingText, date(row.endingDate)]),
          ] }, layout: 'lightHorizontalLines', fontSize: 7.5, margin: [0, 0, 0, 6]
        });
      }

      const safeDate = todayIso;
      await this.pdfPreview.show((pdfMake as any).createPdf({
        pageSize: 'LETTER', pageOrientation: 'landscape', pageMargins: [28, 28, 28, 32], content,
        styles: { title: { fontSize: 14, bold: true, margin: [0, 0, 0, 4] }, section: { fontSize: 10, bold: true, color: '#155795', margin: [0, 8, 0, 4] } },
        defaultStyle: { fontSize: 8 },
        footer: (page: number, pages: number) => ({ text: `Cartera general · ${page} de ${pages}`, alignment: 'center', fontSize: 8, margin: [0, 10, 0, 0] }),
      }), 'Cartera general de préstamos', `Cartera_general_prestamos_${safeDate}.pdf`);
    } catch (error) {
      console.error('Error al generar el reporte general de préstamos:', error);
      alerts.basicAlert('Cartera de préstamos', 'No se pudo generar el reporte general en PDF.', 'error');
    } finally {
      this.generatingPortfolioReport = false;
    }
  }

  obtenerDatos() {
    this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Clientes`, 'Menu Administracion Ingresos',
           this.trackingService.getEmail() );

    if (this.idBranch === null || this.idBranch === undefined) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      this.customerService
        .getCustomers(this.idBranch, this.type)
        .subscribe({
          next: (data: any) => {
            this.rowData = data;
            if (this.type === 'CUSTOMERS') this.loadLoanTotals();
            resolve(true);
          },
          error: (error) => {
            console.error('Error obteniendo datos:', error);
            resolve(false);
          }
        });
    });
    
  }

  private loadLoanTotals(force = false): void {
    const rootId = Number(this.signalsService.getRootSelectedBySidebar()()) || 0;
    if (!force && rootId && this.loanTotalsLoadingRoot === rootId) return;
    const requestId = ++this.loanTotalsRequestId;
    this.loanTotalsLoaded = false;
    this.loanTotalsError = '';
    this.loanTotalsByCustomer.clear();
    this.gridApi?.refreshCells({ columns: ['totalPrestamos', 'totalPagosCobranza', 'totalPendientes', 'totalVencido', 'cuotasVencidas'], force: true });
    if (!rootId) return;
    this.loanTotalsLoadingRoot = rootId;
    this.customerService.getCobranzaDashboard(rootId).subscribe({
      next: loans => {
        if (requestId !== this.loanTotalsRequestId || rootId !== Number(this.signalsService.getRootSelectedBySidebar()())) return;
        this.loanTotalsLoadingRoot = null;
        const today = new Date();
        const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        for (const loan of loans || []) {
          const customerId = Number(loan.idCustomer);
          const totals = this.loanTotalsByCustomer.get(customerId) || { loans: 0, due: 0, payments: 0, pending: 0, overdue: 0, overdueInstallments: 0 };
          totals.loans += Number(loan.montoTotal || 0);
          totals.due += (loan.cuotas || []).filter((installment: any) => installment.active !== false)
            .reduce((sum: number, installment: any) => sum + Number(installment.montoProgramado || 0), 0);
          totals.payments += (loan.cuotas || []).flatMap((installment: any) => installment.abonos || [])
            .filter((payment: any) => payment.active !== false)
            .reduce((sum: number, payment: any) => sum + Number(payment.monto || 0), 0);
          const overdueInstallments = (loan.cuotas || []).filter((installment: any) =>
            installment.active !== false
            && String(installment.fechaProgramada || '').slice(0, 10) < todayIso
            && Number(installment.montoProgramado || 0) > Number(installment.montoAplicado || 0));
          totals.overdueInstallments += overdueInstallments.length;
          totals.overdue += overdueInstallments.reduce((sum: number, installment: any) =>
            sum + Math.max(0, Number(installment.montoProgramado || 0) - Number(installment.montoAplicado || 0)), 0);
          totals.pending = Math.max(0, totals.due - totals.payments);
          this.loanTotalsByCustomer.set(customerId, totals);
        }
        this.loanTotalsLoaded = true;
        this.gridApi?.refreshCells({ columns: ['totalPrestamos', 'totalPagosCobranza', 'totalPendientes', 'totalVencido', 'cuotasVencidas'], force: true });
        this.gridApi?.onFilterChanged();
      },
      error: error => {
        if (requestId !== this.loanTotalsRequestId) return;
        this.loanTotalsLoadingRoot = null;
        this.loanTotalsError = 'No se pudieron consultar los saldos para aplicar el filtro.';
        this.gridApi?.onFilterChanged();
        console.error('Error al consultar los totales de préstamos de Cobranza:', error);
      }
    });
  }

  setBalanceFilter(value: string): void {
    this.balanceFilter = value === 'pending' || value === 'overdue' ? value : 'all';
    this.gridApi?.onFilterChanged();
  }

  obtenerBranchs() {
    // alert('this.branchs'+ this.idBranch)
    this.branchesService.getBrancheswoa(this.idRoot).subscribe(
      (data: any) => {
        this.branchs = data;
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  private loadCollectors(): void {
    const rootId = Number(this.idRoot) || 0;
    const requestId = ++this.collectorsRequestId;
    this.collectors = [];
    this.collectorsLoading = rootId > 0;
    if (!rootId) return;

    this.usersService.get2fieldsUsers(rootId).subscribe({
      next: (result: any) => {
        if (requestId !== this.collectorsRequestId || rootId !== Number(this.idRoot)) return;
        this.collectorsLoading = false;
        this.collectors = (Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : Array.isArray(result?.items) ? result.items : [])
          .slice()
          .sort((a: any, b: any) => this.collectorNameFromUser(a).localeCompare(this.collectorNameFromUser(b), 'es'));
        this.gridApi?.refreshCells({ columns: ['idUsuarioCobrador'], force: true });
      },
      error: (error) => {
        if (requestId !== this.collectorsRequestId) return;
        this.collectorsLoading = false;
        console.error('Error al cargar cobradores:', error);
        alerts.basicAlert('Cobradores', 'No se pudieron cargar los cobradores de la empresa.', 'error');
      },
    });
  }

  private collectorNameFromUser(user: any): string {
    return user?.displayName || user?.usersmall || user?.email || `Usuario ${user?.id}`;
  }

  collectorName(id: any): string {
    if (!id) return 'Sin asignar';
    const user = this.collectors.find(item => Number(item.id) === Number(id));
    return user ? this.collectorNameFromUser(user) : `Usuario ${id}`;
  }

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
      this.idClient = this.selectedRowData.id;
      this.signalsService.setIdClient(this.selectedRowData.id);
      this.signalsService.setNameClient(this.selectedRowData.company);
      void this.loadZipCodeContext(this.selectedRowData);
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;

    if (event.colDef.field === 'idBranch') {
      const selecteEmpleado = event.newValue;
      let branchSelect = this.branchs?.find(
        (item) => item.name === selecteEmpleado
      );
      this.customerService
        .getCustomers(branchSelect.id, this.type)
        .subscribe({
          next: (data: any) => {
            this.contactoCatalog = data;
            console.log(this.contactoCatalog)
          },
          error: (error) => {
            console.error('Error obteniendo datos:', error);
          }
        });
    }

    if (event.colDef.field === 'cp') {
      event.data.neighborhood = '';
      void this.loadZipCodeContext(event.data, true);
    }
  }

  /** Carga el catálogo de asentamientos para clientes nuevos y existentes. */
  private async loadZipCodeContext(customer: any, updateLocation = false): Promise<void> {
    const cp = String(customer?.cp ?? '').trim();
    if (!/^\d{5}$/.test(cp)) return;

    const data = this.zipCodeDataByCp.get(cp) || await this.getZipCodeData(cp);
    // Evita aplicar una respuesta tardía si el usuario ya cambió el CP.
    if (!Array.isArray(data) || !data.length || String(customer?.cp ?? '').trim() !== cp) return;

    if (!updateLocation && this.zipCodeDataByCp.has(cp)
      && customer.state && customer.city && customer.latitud && customer.longitud) {
      this.refreshZipCodeCells(customer, ['neighborhood']);
      return;
    }

    const cpData = data[0];
    if (updateLocation || !customer.state) customer.state = cpData.estado || customer.state || '';
    if (updateLocation || !customer.city) customer.city = cpData.ciudad || customer.city || 'N/A';
    this.refreshZipCodeCells(customer, ['state', 'city']);

    this.getCoordinatesFromCP(cp).subscribe({
      next: (coordinates: any[]) => {
        if (String(customer?.cp ?? '').trim() !== cp) return;
        const coordinate = coordinates?.[0];
        if (!coordinate) return;
        customer.latitud = coordinate.lat || customer.latitud || 0;
        customer.longitud = coordinate.lon || customer.longitud || 0;
        this.refreshZipCodeCells(customer, ['latitud', 'longitud']);
      },
      error: () => undefined,
    });
    this.refreshZipCodeCells(customer, ['neighborhood']);
  }

  private refreshZipCodeCells(customer: any, columns: string[]): void {
    if (!this.gridApi || customer?.id == null) return;
    const node = this.gridApi.getRowNode(String(customer.id));
    if (node) this.gridApi.refreshCells({ rowNodes: [node], columns, force: true });
  }

  moveToNextColumn(event: any, backwards = false): void {
    const displayedEditableColumns = this.gridApi.getAllDisplayedColumns().filter((column: any) => {
      const colDef = column.getColDef();
      const editable = colDef.editable;
      return typeof editable === 'function'
        ? editable({ data: event.data, node: event.node, colDef })
        : editable === true;
    });
    const currentColIndex = displayedEditableColumns.findIndex(
      (column: any) => column.getColId() === event.column.getColId()
    );
    if (currentColIndex < 0 || displayedEditableColumns.length < 2) {
      this.gridApi.stopEditing();
      return;
    }

    const step = backwards ? -1 : 1;
    const nextIndex = (currentColIndex + step + displayedEditableColumns.length)
      % displayedEditableColumns.length;
    const nextColKey = displayedEditableColumns[nextIndex].getColId();
    const rowNode = event.node;

    // Commit first, then focus and reopen editing in the next visible column.
    this.gridApi.stopEditing();
    setTimeout(() => {
      const rowIndex = rowNode.rowIndex;
      if (rowIndex === null || rowIndex === undefined) return;
      this.gridApi.ensureIndexVisible(rowIndex);
      this.gridApi.ensureColumnVisible(nextColKey);
      this.gridApi.setFocusedCell(rowIndex, nextColKey);
      this.gridApi.startEditingCell({ rowIndex, colKey: nextColKey });
      requestAnimationFrame(() => this.highlightEnterCell(rowIndex, nextColKey));
    });
  }

  private highlightEnterCell(rowIndex: number, colKey: string): void {
    this.enterHighlightedCell?.classList.remove('enter-active-cell');
    this.enterHighlightedCell = null;

    const cells = this.clientesGridElement?.nativeElement.querySelectorAll<HTMLElement>('.ag-cell[col-id]');
    const targetCell = Array.from(cells || []).find((cell) =>
      cell.getAttribute('col-id') === colKey
      && cell.closest('.ag-row')?.getAttribute('row-index') === String(rowIndex)
    );

    if (targetCell) {
      targetCell.classList.add('enter-active-cell');
      this.enterHighlightedCell = targetCell;
    }
  }

  getCoordinatesFromCP(cp: string) {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${cp}&country=MX&format=json`;
    return this.http.get(url).pipe(
      map((data) => data),
      catchError((error) => {
        console.error('Error obteniendo coordenadas:', error);
        return throwError(() => new Error('Error al obtener coordenadas'));
      })
    );
  }

  async getZipCodeData(cp: string): Promise<any> {
    const cached = this.zipCodeDataByCp.get(cp);
    if (cached) return cached;
    try {
      const data = await lastValueFrom(this.inegiService.getZipCodeData(cp));
      if (Array.isArray(data)) this.zipCodeDataByCp.set(cp, data);
      return data;
    } catch (error) {
      if (error.status === 404) {
        alerts.basicAlert(
          'Código Postal',
          'El código postal no existe o no se encontró información.',
          'error'
        );
      } else {
        console.error('Error fetching data:', error);
      }
      return null;
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.actualizarContextoCotizaciones();
  }

  /** Actualiza el contexto del wrapper de detalle */
  private actualizarContextoCotizaciones() {
    if (!this.gridApi) return;
    this.gridApi.setGridOption('detailCellRendererParams', {
      context: { idCompany: this.idRoot, onBalancesChanged: () => this.loadLoanTotals(true) },
    });
  }

  /**
   * Abre / cierra la cascada según el modo (cotizaciones | agenda).
   * Si el nodo ya está expandido con el mismo modo → cierra.
   * Si está expandido con distinto modo → cambia modo y reabre.
   */
  toggleCascadeWithMode(node: any, mode: 'cotizaciones' | 'agenda' | 'pagos') {
    const api       = this.gridApi;
    const sameMode  = node.expanded && node.data?.__detailMode === mode;

    if (sameMode) {
      node.setExpanded(false);
      api.forEachNode((n: any) => n.setRowHeight(undefined));
      api.onRowHeightChanged();
      return;
    }

    // Colapsar otras filas expandidas
    api.forEachNode((n: any) => {
      if (n.expanded && n.id !== node.id) n.setExpanded(false);
    });
    // Ocultar todas las demás filas
    api.forEachNode((n: any) => {
      if (n.id !== node.id) n.setRowHeight(0);
    });
    api.onRowHeightChanged();

    // Marcar el modo en el dato antes de expandir
    node.data.__detailMode = mode;
    this.actualizarContextoCotizaciones();
    if (node.expanded) {
      node.setExpanded(false);
      setTimeout(() => node.setExpanded(true), 50);
    } else {
      setTimeout(() => node.setExpanded(true), 0);
    }
  }

  /** Compat con código anterior */
  toggleCotizacionesCascade(node: any) {
    this.toggleCascadeWithMode(node, 'cotizaciones');
  }

  /** Abre la cascada para el cliente actualmente seleccionado (botón lateral) */
  openCotizacionesForSelected() {
    if (!this.selectedRowData || !this.gridApi) return;
    const node = this.gridApi.getRowNode(String(this.selectedRowData.id));
    if (node) this.toggleCascadeWithMode(node, 'cotizaciones');
  }

  addRow(content: TemplateRef<any>) {
    if (!this.idRoot) {
      alerts.basicAlert('Error', 'Debe seleccionar una empresa primero', 'error');
      return;
    }
    if (this.notSavedChanges) {
      alerts.basicAlert('Cambios pendientes', 'Guarda o deshaz los cambios del listado antes de agregar otro cliente.', 'warning');
      return;
    }

    this.newCustomer = {
      id: `temp_${this.tempIdCounter++}`,
      idRoot: this.idRoot,
      idBranch: this.idBranch,
      idUsuarioCobrador: null,
      nameContact: '',
      company: '', // Se sincronizará con nameContact
      phone: '',
      rfc: '',
      city: '',
      mobile: '',
      email: '',
      address: '',
      addressfiscal: '',
      state: '',
      total: 0,
      radio: 0,
      vigente: true,
      NumCliente: 0,
      latitud: '',
      longitud: '',
      idTypecop: this.Typecop?.[0]?.id ?? 1,
      fiscalRegime: '',
      usoCfdi: 'G03',
      type: this.type,
      active: true,
      __isNew: true,
    };
    this.editingCustomerId = null;
    this.openCustomerModal(content);
  }

  private openCustomerModal(content: TemplateRef<any>): void {
    const modal = this.modalService.open(content, {
      size: 'lg',
      centered: true,
      backdrop: 'static',
      windowClass: 'cobranza-customer-modal',
      ariaLabelledBy: 'new-customer-modal-title',
    });
    modal.result.then(
      () => this.resetCustomerModal(),
      () => this.resetCustomerModal()
    );
  }

  private resetCustomerModal(): void {
    this.newCustomer = null;
    this.editingCustomerId = null;
  }

  private async editCustomer(row: any): Promise<void> {
    if (this.loadingCustomerForEdit || this.modalService.hasOpenModals()) return;
    if (this.notSavedChanges) {
      alerts.basicAlert('Cambios pendientes', 'Guarda o deshaz los cambios del listado antes de editar este cliente.', 'warning');
      return;
    }

    const customerId = Number(row?.id);
    if (!customerId) return;
    this.loadingCustomerForEdit = true;
    try {
      const customer = await lastValueFrom(this.customerService.getCobranzaCustomerById(customerId, Number(this.idRoot), Number(this.idBranch), this.type));
      if (Number(customer?.idRoot) !== Number(this.idRoot)) {
        alerts.basicAlert('Cliente no disponible', 'El cliente ya no pertenece a la empresa seleccionada.', 'error');
        return;
      }
      this.newCustomer = { ...customer };
      this.editingCustomerId = customerId;
      this.openCustomerModal(this.customerModal);
    } catch (error) {
      console.error('Error al cargar cliente:', error);
      alerts.basicAlert('Error', 'No se pudieron cargar los datos del cliente.', 'error');
    } finally {
      this.loadingCustomerForEdit = false;
    }
  }

  async saveCustomer(form: NgForm, modal: any): Promise<void> {
    if (this.savingNewCustomer || form.invalid) {
      form.control.markAllAsTouched();
      if (form.invalid && !this.savingNewCustomer) {
        alerts.basicAlert('Datos inválidos', 'Revisa los campos marcados antes de guardar.', 'error');
      }
      return;
    }

    const name = this.normalizeCustomerName(this.newCustomer.nameContact);
    if (!name || !this.newCustomer.idBranch || !this.newCustomer.idUsuarioCobrador) {
      alerts.basicAlert('Campos requeridos', 'Captura el nombre y selecciona una sucursal y un cobrador.', 'error');
      return;
    }

    if (!this.collectors.some(user => Number(user.id) === Number(this.newCustomer.idUsuarioCobrador))) {
      alerts.basicAlert('Cobrador inválido', 'Selecciona un cobrador de la empresa actual.', 'error');
      return;
    }

    this.newCustomer.nameContact = name;
    this.newCustomer.company = name;
    if (this.hasDuplicateCustomerName(name, this.newCustomer)) {
      alerts.basicAlert('Cliente duplicado', 'Este cliente ya está registrado.', 'error');
      return;
    }

    this.savingNewCustomer = true;
    try {
      const editingId = this.editingCustomerId;
      const customer = this.cleanDataForServer(this.newCustomer);
      if (!(await this.validateRowsToPersistAreUnique([customer]))) {
        alerts.basicAlert('Cliente duplicado', 'Este cliente ya está registrado.', 'error');
        return;
      }

      const saved = editingId
        ? await lastValueFrom(this.customerService.updateCobranzaCustomer(editingId, customer))
        : await lastValueFrom(this.customerService.createCobranzaCustomer(customer));
      modal.close();
      const refreshed = await this.obtenerDatos();
      const savedId = editingId || Number(saved?.id);
      if (refreshed && savedId) this.selectRowById(savedId);
      if (!refreshed) {
        alerts.basicAlert('Cliente guardado', 'El cliente se guardó, pero no se pudo actualizar el listado. Vuelve a cargar la página.', 'warning');
        return;
      }
      alerts.basicAlert(editingId ? 'Cliente actualizado' : 'Cliente agregado', 'El cliente se guardó correctamente.', 'success');
    } catch (error) {
      console.error('Error al guardar cliente:', error);
      alerts.basicAlert('Error', 'No se pudo guardar el cliente. Intenta nuevamente.', 'error');
    } finally {
      this.savingNewCustomer = false;
    }
  }

  private normalizeCustomerName(value: any): string {
    return (value ?? '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();
  }

  private waitForGridEditingToFinish(): Promise<void> {
    this.gridApi?.stopEditing();

    return new Promise((resolve) => {
      setTimeout(() => resolve(), 100);
    });
  }

  private getCustomerField(row: any, ...keys: string[]): any {
    if (!row) {
      return null;
    }

    const rowKeys = Object.keys(row);
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null) {
        return row[key];
      }

      const matchedKey = rowKeys.find(
        (rowKey) => rowKey.toLowerCase() === key.toLowerCase()
      );
      if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
        return row[matchedKey];
      }
    }

    return null;
  }

  private getCustomerNamesForDuplicateCheck(row: any): string[] {
    return [
      this.normalizeCustomerName(this.getCustomerField(row, 'nameContact')),
      this.normalizeCustomerName(this.getCustomerField(row, 'company')),
      this.normalizeCustomerName(this.getCustomerField(row, 'name')),
      this.normalizeCustomerName(this.getCustomerField(row, 'description', 'Description')),
    ].filter((name, index, names) => name && names.indexOf(name) === index);
  }

  private getCurrentCustomerRows(): any[] {
    if (!this.gridApi) {
      return this.rowData || [];
    }

    const rows: any[] = [];
    this.gridApi.forEachNode((node) => {
      if (node.data) {
        rows.push(node.data);
      }
    });

    return rows;
  }

  private isSameCustomerRow(row: any, currentRow: any): boolean {
    if (row === currentRow) {
      return true;
    }

    const rowId = this.getCustomerField(row, 'id');
    const currentRowId = this.getCustomerField(currentRow, 'id');

    if (!rowId || !currentRowId) {
      return false;
    }

    return rowId.toString() === currentRowId.toString();
  }

  private isInactiveCustomer(row: any): boolean {
    return this.getCustomerField(row, 'active') === false;
  }

  private hasDuplicateCustomerName(name: any, currentRow: any): boolean {
    const normalizedName = this.normalizeCustomerName(name);
    if (!normalizedName) {
      return false;
    }

    return this.getCurrentCustomerRows().some((row: any) => {
      if (this.isSameCustomerRow(row, currentRow) || this.isInactiveCustomer(row)) {
        return false;
      }

      return this.getCustomerNamesForDuplicateCheck(row).includes(normalizedName);
    });
  }

  private hasAnyDuplicateCustomerName(): boolean {
    const seenNames = new Set<string>();

    return this.getCurrentCustomerRows().some((row: any) => {
      if (this.isInactiveCustomer(row)) {
        return false;
      }

      const rowNames = this.getCustomerNamesForDuplicateCheck(row);
      const hasDuplicate = rowNames.some((name) => seenNames.has(name));
      rowNames.forEach((name) => seenNames.add(name));

      return hasDuplicate;
    });
  }

  private hasDuplicateCustomerNameBetweenRows(rowsToCheck: any[], rowsReference: any[]): boolean {
    return rowsToCheck.some((rowToCheck) => {
      const namesToCheck = this.getCustomerNamesForDuplicateCheck(rowToCheck);
      if (namesToCheck.length === 0) {
        return false;
      }

      return rowsReference.some((referenceRow: any) => {
        if (
          this.isSameCustomerRow(referenceRow, rowToCheck) ||
          this.isInactiveCustomer(referenceRow)
        ) {
          return false;
        }

        return this
          .getCustomerNamesForDuplicateCheck(referenceRow)
          .some((referenceName) => namesToCheck.includes(referenceName));
      });
    });
  }

  private async hasDuplicateCustomerNameInSavedData(rowsToSave: any[]): Promise<boolean> {
    if (!rowsToSave.length) {
      return false;
    }

    const savedResponses = await Promise.all([
      this.idRoot
        ? lastValueFrom(this.customerService.getCustomersByCompany(this.idRoot, this.type)).catch(() => [])
        : Promise.resolve([]),
      this.idBranch !== null && this.idBranch !== undefined
        ? lastValueFrom(this.customerService.getCustomers(this.idBranch, this.type)).catch(() => [])
        : Promise.resolve([]),
    ]);

    const savedRows = savedResponses.flatMap((response: any) => response?.data || response || []);

    return this.hasDuplicateCustomerNameBetweenRows(rowsToSave, savedRows);
  }

  private getPrimaryCustomerName(row: any): string {
    return (
      this.normalizeCustomerName(this.getCustomerField(row, 'nameContact')) ||
      this.normalizeCustomerName(this.getCustomerField(row, 'company')) ||
      this.normalizeCustomerName(this.getCustomerField(row, 'name')) ||
      this.normalizeCustomerName(this.getCustomerField(row, 'description', 'Description'))
    );
  }

  private async loadCustomersForDuplicateValidation(): Promise<any[]> {
    const responses = await Promise.all([
      this.idRoot
        ? lastValueFrom(this.customerService.getCustomersByCompany(this.idRoot, this.type)).catch(() => [])
        : Promise.resolve([]),
      this.idBranch !== null && this.idBranch !== undefined
        ? lastValueFrom(this.customerService.getCustomers(this.idBranch, this.type)).catch(() => [])
        : Promise.resolve([]),
    ]);

    return responses.flatMap((response: any) => response?.data || response || []);
  }

  private async validateRowsToPersistAreUnique(rowsToPersist: any[]): Promise<boolean> {
    const persistedRows = await this.loadCustomersForDuplicateValidation();
    const persistedNamesById = new Map<string, Set<string>>();
    const persistedNames = new Set<string>();

    persistedRows.forEach((row: any) => {
      if (this.isInactiveCustomer(row)) {
        return;
      }

      const rowId = this.getCustomerField(row, 'id')?.toString();
      const rowNames = this.getCustomerNamesForDuplicateCheck(row);

      rowNames.forEach((name) => persistedNames.add(name));
      if (rowId) {
        persistedNamesById.set(rowId, new Set(rowNames));
      }
    });

    for (const row of rowsToPersist) {
      const rowId = this.getCustomerField(row, 'id')?.toString();
      const rowNames = this.getCustomerNamesForDuplicateCheck(row);
      const originalNames = rowId ? persistedNamesById.get(rowId) : null;

      const hasDuplicate = rowNames.some(
        (name) => persistedNames.has(name) && !originalNames?.has(name)
      );

      if (hasDuplicate) {
        return false;
      }

      rowNames.forEach((name) => persistedNames.add(name));
    }

    return true;
  }

  async saveChanges() {
    await this.waitForGridEditingToFinish();
    this.rowData = this.getCurrentCustomerRows();

    const isValid = this.rowData.every(
      (item) => item.idBranch && (item.nameContact || item.company)
    );
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar todos los campos antes de guardar.',
        'error'
      );
      return;
    }

    if (this.hasAnyDuplicateCustomerName()) {
      alerts.basicAlert(
        'Cliente duplicado',
        'Este cliente ya está registrado.',
        'error'
      );
      return;
    }

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );
    const rowsToPersist = [...newRows, ...modifiedRows].map((row) =>
      this.cleanDataForServer(row)
    );

    if (!(await this.validateRowsToPersistAreUnique(rowsToPersist))) {
      alerts.basicAlert(
        'Cliente duplicado',
        'Este cliente ya está registrado.',
        'error'
      );
      return;
    }

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.customerService.createCobranzaCustomer(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.customerService.updateCobranzaCustomer(row.id, cleanedData);
    });

    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );

      // Determinar qué ID vamos a seleccionar después de recargar
      if (modifiedRows.length > 0) {
        this.lastEditedRowId = modifiedRows[modifiedRows.length - 1].id;
      } else if (newRows.length > 0) {
        this.lastEditedRowId = 'SELECT_MAX_ID';
      }

      alerts.basicAlert('Datos actualizados', 'Se han guardado los datos correctamente.', 'success');
      this.notSavedChanges = false;
      this.newlyAddedRows = [];

      await this.obtenerDatos();

      // Seleccionar la fila apropiada después de recargar
      if (this.lastEditedRowId) {
        if (this.lastEditedRowId === 'SELECT_MAX_ID') {
          // Encontrar el ID máximo en los datos actuales
          const maxId = Math.max(...this.rowData.map((row) => Number(row.id)));

          this.selectRowById(maxId);
        } else {

          this.selectRowById(this.lastEditedRowId);
        }
        this.lastEditedRowId = null;
      }
    } catch (error) {
      console.error('Error en saveChanges:', error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  private selectRowById(id: number | string) {
    
    if (!this.gridApi) {
      console.error('Grid API no disponible');
      return;
    }
    
    // Dar tiempo al grid para que se actualice
    setTimeout(() => {
      this.gridApi.forEachNode((node) => {
        // Convertir ambos IDs a número para la comparación
        const nodeId =
          typeof node.data.id === 'string'
            ? parseInt(node.data.id)
            : node.data.id;
        const searchId = typeof id === 'string' ? parseInt(id) : id;
        if (nodeId === searchId) {
          node.setSelected(true);
          this.gridApi.ensureNodeVisible(node, 'middle');
        }
      });
    }, 100);
  }

  async deleteEntry() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar cliente',
        'Por favor, seleccione un cliente para eliminar.',
        'error'
      );
      return;
    }

    const selectedData = selectedNodes[0].data;
    const customerName = selectedData.nameContact || selectedData.company || 'este cliente';

    // Preguntar confirmación antes de eliminar
    const result = await alerts.confirmAlert(
      '¿Eliminar cliente?',
      `¿Está seguro que desea eliminar a "${customerName}"?`,
      'warning',
      'Sí, eliminar'
    );

    if (!result.isConfirmed) {
      return;
    }

    // Validar que el préstamo sea 0 o no exista
    if (selectedData.total && selectedData.total !== 0) {
      alerts.basicAlert(
        'Error al eliminar',
        'No se puede eliminar mientras tenga notas activas',
        'error'
      );
      return;
    }

    const id = selectedData.id;

    this.customerService
      .deleteCobranzaCustomer(id)
      .pipe(
        catchError((error) => {
          alerts.basicAlert(
            'Eliminar cliente',
            error.status === 409
              ? (error.error?.message || error.error?.Message || 'No se puede eliminar porque tiene datos relacionados.')
              : 'No fue posible verificar y eliminar el cliente. No se realizó la baja; intenta nuevamente.',
            'error'
          );
          console.error(error);
          return EMPTY;
        })
      )
      .subscribe(() => {
        alerts.basicAlert('Eliminar cliente', 'Cliente eliminado satisfactoriamente.', 'success');
        this.obtenerDatos();
        this.notSavedChanges = false;
        this.selectedRowData = null;
      });
  }

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.detailType;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    } else {
      delete cleanedData.type;
    }
    // Siempre garantizar idRoot correcto — evita registros huérfanos sin empresa
    cleanedData.idRoot = this.idRoot;
    return cleanedData;
  }

  openRadiusInfluenceModal(): void {
    const modalRef = this.modalService.open(RadiusinfluenceComponent, {
      size: 'lg',
    });
  }

  async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
    if (!event.data || event.node.group) return;
    this.signalsService.setProviderOrCustomer(this.type);
    const colId = event.column.getColId();
    const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
    const selectedId = selectedRowData.id; // Obtener el ID del registro

    this.selectedRowData = selectedRowData;

    // Filtrar el grid para mostrar solo el registro con el ID seleccionado solo si la columna es "total"
    if (colId === 'total') {
      this.notSavedChanges = true;
      if(this.gridApi) {
        const filterModel = {
          id: {
            type: 'equals',
            filter: selectedId,
          },
        };
        this.gridApi.setFilterModel(filterModel);
        this.gridApi.onFilterChanged();
      }
      else {
        alert('gridApi no disponible');
      }

      this.activateCreditsTab(); // Activar la pestaña de créditos si es necesario
      return;
    }

    // Activar cascada de facturación
    if (colId === 'enabledForBilling') {
      this.signalsService.setIdClient(selectedId);
      this.signalsService.setNameClient(selectedRowData.nameContact || selectedRowData.company);
      if(this.gridApi) {
        const filterModel = {
          id: {
            type: 'equals',
            filter: selectedId,
          },
        };
        this.gridApi.setFilterModel(filterModel);
        this.gridApi.onFilterChanged();
      }
      this.activateBillingTab();
      return;
    }

    if (this.type !== 'CUSTOMERS' || [
      'cotizaciones', 'agenda', 'pagos', 'totalPrestamos',
      'totalPagosCobranza', 'totalPendientes', 'totalVencido', 'cuotasVencidas'
    ].includes(colId)) return;

    event.api.stopEditing(true);
    await this.editCustomer(selectedRowData);
  }

  async activateCreditsTab() {
    this.collapseAllCascades();
    if (!this.isOpen) {
      setTimeout(async () => await this.adjustGridSize(), 0);
      this.showCreditsTab = true;
      this.showBillingTab = false;
      this.showCotizacionesTab = false;
      this.isOpen = true;
    } else {
      this.resetGridSize();
      this.isOpen = false;
    }
  }

  /** Colapsa todas las filas expandidas (cascada) en el grid de clientes */
  private collapseAllCascades() {
    if (!this.gridApi) return;
    this.gridApi.forEachNode((n: any) => {
      if (n.expanded) n.setExpanded(false);
    });
  }

  async activateBillingTab() {
    if (!this.isOpen) {
      setTimeout(async () => await this.adjustGridSize(), 0);
      this.showBillingTab = true;
      this.showCreditsTab = false;
      this.showCotizacionesTab = false;
      this.isOpen = true;
    } else {
      this.resetGridSize();
      this.isOpen = false;
    }
  }

  async activateCotizacionesTab() {
    if (!this.selectedRowData) return;
    if (!this.isOpen) {
      setTimeout(async () => await this.adjustGridSize(), 0);
      this.showCotizacionesTab = true;
      this.showCreditsTab = false;
      this.showBillingTab = false;
      this.isOpen = true;
    } else if (this.showCotizacionesTab) {
      // Ya está abierto — cerrar
      this.resetGridSize();
      this.isOpen = false;
    } else {
      // Otra pestaña abierta — cambiar a cotizaciones
      this.showCotizacionesTab = true;
      this.showCreditsTab = false;
      this.showBillingTab = false;
    }
  }

  resetGridSize() {
    this.gridHeight = '80vh'; // Reset to default height
    this.showCreditsTab = false;
    this.showBillingTab = false;
    this.showCotizacionesTab = false;
    this.gridApi.setFilterModel(null);
    this.gridApi.onFilterChanged();
  }

  adjustGridSize() {
    this.gridHeight = '20vh'; // Adjust as needed
  }

  // Agregar esta función para obtener los estados
  getStates() {
    this.inegiService.getEstados().subscribe({
      next: (data: { datos: States[] }) => {
        this.estados = data.datos.map((estado) => estado.nom_agee);
        this.estados.unshift('Sin estado'); // Agregar opción "Sin estado"
      },
      error: (error) => {
        console.error('Error fetching states', error);
      },
    });
  }

  getTypecop() {
    // El type del catálogo debe coincidir con lo registrado en la BD
    // CUSTOMERS -> usa catálogo 'TIPO-CLIENTE' o similar
    // PROVIDERS -> usa catálogo 'TIPO-PROVEEDOR' o similar
    const catalogType = this.type === 'CUSTOMERS' ? 'TIPO-CLIENTE' : 'TIPO-PROVEEDOR';

    this.catalogsService.getCatalogsFromAdmon(this.idRoot, catalogType).subscribe(
      (data: Icatalog[]) => {
        this.Typecop = data;
        console.log('✅ Catálogo cargado:', data);
      },
      (error) => {
        console.error('❌ Error fetching catalog:', error);
        // Si falla, intentar con el tipo original
        this.catalogsService.getCatalogsVigente(this.idRoot, this.type).subscribe(
          (data2: Icatalog[]) => {
            this.Typecop = data2;
            console.log('✅ Catálogo alternativo cargado:', data2);
          },
          (error2) => console.error('❌ Error en ambos intentos:', error2)
        );
      }
    );
  }

  // ==================== MÉTODOS PARA FACTURACIÓN ELECTRÓNICA ====================

  loadFiscalCatalogs() {
    // Cargar régimen fiscal
    this.administrationService.getFiscalRegimes().subscribe({
      next: (data: any[]) => {
        this.fiscalRegimes = data;
      },
      error: (err) => console.error('Error cargando regímenes fiscales:', err)
    });

    // Cargar usos CFDI
    this.facturacionService.getUsoCfdi2fields().subscribe({
      next: (data: any[]) => {
        this.usosFactura = data;
      },
      error: (err) => console.error('Error cargando usos CFDI:', err)
    });
  }

  loadCustomersBilling() {
    this.customerService.getCustomersBilling(this.idRoot).subscribe({
      next: (data: any[]) => {
        this.customersBilling = data;
        // Marcar en el grid cuáles están habilitados
        if (this.rowData && Array.isArray(this.rowData)) {
          this.rowData.forEach((customer: any) => {
            const isEnabled = this.customersBilling.some(cb => cb.idCustomer === customer.id);
            customer.enabledForBilling = isEnabled;
          });
          if (this.gridApi) {
            this.gridApi.redrawRows();
          }
        }
      },
      error: (err) => console.error('Error cargando clientes de facturación:', err)
    });
  }

  async toggleBillingEnabled(customer: any, enabled: boolean) {
    if (!customer.id || customer.__isNew) {
      // Si es nuevo, solo marcar el flag, se guardará al hacer saveChanges
      customer.enabledForBilling = enabled;
      return;
    }

    if (enabled) {
      // Habilitar para facturación - INSERT en CustomersBilling
      const billingData = {
        idCustomer: customer.id,
        idRoot: this.idRoot,
        rfc: customer.rfc || '',
        nombreFiscal: customer.name || customer.description || '',
        codigoPostal: customer.cp || '',
        regimenFiscal: customer.fiscalRegime || '',
        usoCfdi: customer.usoCfdi || 'G03',
        correoFacturacion: customer.email || '',
        active: true
      };

      this.customerService.addCustomerBilling(billingData).subscribe({
        next: () => {
          this.loadCustomersBilling();
        },
        error: (err) => {
          console.error(err);
          alerts.basicAlert('Error', 'No se pudo habilitar el cliente para facturación', 'error');
          customer.enabledForBilling = false;
        }
      });
    } else {
      // Deshabilitar - DELETE de CustomersBilling
      const billingRecord = this.customersBilling.find(cb => cb.idCustomer === customer.id);
      if (billingRecord) {
        this.customerService.deleteCustomerBilling(billingRecord.id).subscribe({
          next: () => {
            this.loadCustomersBilling();
          },
          error: (err) => {
            console.error(err);
            alerts.basicAlert('Error', 'No se pudo deshabilitar el cliente', 'error');
            customer.enabledForBilling = true;
          }
        });
      }
    }
  }

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.notSavedChanges);
  }
}
