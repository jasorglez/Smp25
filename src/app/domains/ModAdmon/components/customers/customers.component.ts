import { Component, effect, HostListener, inject } from '@angular/core';
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
import { CustomersPaymentsComponent } from './customers-payments.component';
import { CustomersBillingComponent } from './customers-billing.component';
import { CustomersCotizacionesComponent } from './customers-cotizaciones.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { RadiusinfluenceComponent } from '../radiusinfluence/radiusinfluence.component';
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

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [
    RouterModule,
    DomainsModule,
    AgGridModule,
    MultiLineEditorComponent,
    CustomersPaymentsComponent,
    CustomersBillingComponent,
    CustomersCotizacionesComponent,
  ],
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.scss'],
})
export class CustomersComponent implements CanComponentDeactivate {
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

  private http = inject(HttpClient);
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  
  async ngOnInit() {
    this.type = 'CUSTOMERS'; // Default type for customers component
    this.obtenerDatos();
    this.signalsService.deleteClientData();
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
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
  isOpen: boolean = false;
  branchs: any[] = [];
  Typecop: any[] = [];
  contactoCatalog: any[] = [];

  // Catálogos SAT para facturación electrónica
  fiscalRegimes: any[] = [];
  usosFactura: any[] = [];
  customersBilling: any[] = []; // Clientes habilitados para facturación

  // Agregar esta nueva variable para almacenar el ID de la última fila editada
  private lastEditedRowId: number | string | null = null;
  private pendingEditCell: { rowIndex: number; colKey: string } | null = null;

  rowData: any;
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];

  id: string;
  idRoot: number;
  private tempIdCounter: number = 0;
  selectedTab: string = 'customers-payments';
  idBranch: number | null = null;
  idEmployee: number;
  infoCp: any;
  

  private estados: string[] = []; // Agregar esta variable para almacenar los estados

  public defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: true,
    lockPosition: false,
    enableRowGroup: true, // Enable row grouping for all columns
    flex: 1,
  };

  currentIndex = 0;

  // Orden de columnas editables para navegación con Enter
  private editableColumns: string[] = [
    'nameContact',
    'company',
    'idBranch',
    'idTypecop',
    'cp',
    'address',
    'state',
    'city',
    'neighborhood',
    'phone',
    'email',
  ];

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
    getRowId: (params: any) => params?.data?.id,
    getRowClass: (params) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
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
        this.moveToNextColumn(event);
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
        field: 'vigente',
        headerName: 'Activo',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        width: 100,
      },
      {
        field: 'enabledForBilling',
        headerName: 'Facturación Electrónica',
        width: 180,
        editable: false,
        hide: this.type != 'CUSTOMERS',
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
        headerName: 'Compania',
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
        //hide: this.type != 'CUSTOMERS',
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
      
   /*   {
        field: 'rfc',
        headerName: 'RFC',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        filter: true,
        width: 100,
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
        valueSetter: (params) => {
          params.data[params.colDef.field] = params.newValue.toUpperCase();
          return true;
        }
      },*/

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
        cellEditorParams: {
          values: this.estados, // Usar la lista de estados obtenida
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
          if (this.infoCp && this.infoCp.length > 0) {
            const asentamientos = this.infoCp[0].asentamientos;
            // Ordenar los asentamientos alfabéticamente
            const sortedAsentamientos = asentamientos.sort((a, b) =>
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
      {
        field: 'rfc',
        headerName: 'RFC',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        hide: true,
        width: 100,
      },
      
      { field: 'radio', headerName: 'Radio', editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        }, width: 90 , hide: this.type != 'CUSTOMERS'},
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
    ];

    return this._colMaster;
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
            resolve(true);
          },
          error: (error) => {
            console.error('Error obteniendo datos:', error);
            resolve(false);
          }
        });
    });
    
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

      setTimeout(async () => {
        const data = await this.getZipCodeData(event.newValue);
        this.getCoordinatesFromCP(data[0].cp).subscribe((data: any) => {
          event.data.latitud = data[0].lat || 0;
          event.data.longitud = data[0].lon || 0;
        });
        if (data && data.length > 0) {
          const cpData = data[0];
          event.data.state = cpData.estado;
          event.data.city = cpData.ciudad || 'N/A';

          this.gridApi.applyTransaction({ update: [event.data ] });
        }
      }, 500);
    }
  }

  moveToNextColumn(event: any): void {
    const currentColKey = event.colDef.field;
    const currentRowIndex = event.rowIndex;
    const rowId = event.node?.id;

    const currentColIndex = this.editableColumns.indexOf(currentColKey);

    if (currentColIndex < this.editableColumns.length - 1) {
      const nextColKey = this.editableColumns[currentColIndex + 1];

      setTimeout(() => {
        this.gridApi.setFocusedCell(currentRowIndex, nextColKey);
        const cellEl = rowId
          ? (document.querySelector(`[row-id="${rowId}"] [col-id="${nextColKey}"]`) as HTMLElement)
          : null;
        if (cellEl) {
          cellEl.click();
        }
      }, 80);
    } else {
      this.gridApi.stopEditing();
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
    try {
      const data = await lastValueFrom(this.inegiService.getZipCodeData(cp));
      this.infoCp = data;
      
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
  }

  addRow() {
    if (!this.idRoot) {
      alerts.basicAlert('Error', 'Debe seleccionar una empresa primero', 'error');
      return;
    }
    
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idRoot: this.idRoot,
      idBranch: this.idBranch,
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
      idTypecop: 1,
      fiscalRegime: '',
      usoCfdi: 'G03',
      type: this.type,
      active: true,
      __isNew: true,
    };

    // Insertar la fila al inicio y mantener rowData sincronizado para guardar la fila nueva.
    this.rowData = [newItem, ...(this.rowData || [])];
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
    }
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;

    this.focusNewCustomerNameCell(tempId);
  }

  private focusNewCustomerNameCell(tempId: string): void {
    // "Nombre" en la tabla corresponde al campo `company`
    const colKey = 'company';
    let attempts = 0;

    const focusCell = () => {
      if (!this.gridApi) return;

      const node = this.gridApi.getRowNode(tempId);
      if (!node || node.rowIndex === null || node.rowIndex === undefined) {
        if (attempts++ < 12) {
          setTimeout(focusCell, 50);
        }
        return;
      }

      const rowIndex = node.rowIndex;
      this.gridApi.ensureIndexVisible(rowIndex, 'top');
      this.gridApi.ensureColumnVisible(colKey);
      node.setSelected(true);

      requestAnimationFrame(() => {
        this.gridApi.setFocusedCell(rowIndex, colKey);
        this.gridApi.startEditingCell({ rowIndex, colKey });

        requestAnimationFrame(() => {
          const editingInput = document.querySelector(
            '.ag-cell-inline-editing input, .autocomplete-input-editing'
          ) as HTMLInputElement;
          editingInput?.focus();
          editingInput?.select();
        });
      });
    };

    setTimeout(focusCell, 0);
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
      return this.customerService.addCustomer(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.customerService.updateCustomer(row.id, cleanedData);
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
        'Eliminar entrada',
        'Por favor, seleccione una entrada para eliminar.',
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

    // Verificar si el cliente está siendo usado en ingresos o egresos
    try {
      const incomesAndExpenses = await lastValueFrom(
        this.incomesAndExpensesService.getIncomesAndExpenses(this.idRoot)
      );

      const isBeingUsed = incomesAndExpenses?.some(
        (record: any) => record.idCustomer === id && record.active !== false
      );

      if (isBeingUsed) {
        alerts.basicAlert(
          'No se puede eliminar',
          'Este cliente está siendo utilizado en registros de ingresos/egresos. Debe eliminar o modificar esos registros primero.',
          'error'
        );
        return;
      }
    } catch (error) {
      console.error('Error verificando uso del cliente:', error);
    }

    selectedData.active = 0;
    this.customerService
      .deleteCustomer(id)
      .pipe(
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
      .subscribe(() => {
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
    }
  }

  async activateCreditsTab() {
    if (!this.isOpen) {
      setTimeout(async () => await this.adjustGridSize(), 0);
      this.showCreditsTab = true;
      this.showBillingTab = false;
      this.isOpen = true;
    } else {
      this.resetGridSize();
      this.isOpen = false;
    }
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
