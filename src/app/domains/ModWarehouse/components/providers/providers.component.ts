import { Component, effect, HostListener, inject } from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import * as bootstrap from 'bootstrap';
import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { alerts } from '../../../../../../helpers/alerts';
import { States } from 'app/interface/states';
import {
  catchError,
  concat,
  EMPTY,
  lastValueFrom,
  of,
  toArray,
  throwError,
  map,
  Observable,
  switchMap
} from 'rxjs';
import { AgGridModule } from 'ag-grid-angular';
import { ModalService } from 'app/services/modal.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { SignalsService } from 'app/services/signals.service';
import { ProvidersPaymentsComponent } from './providers-payments.component';

import { DetailCellRendererComponentContact } from './details/detalle-contactos.component';
import { DetallesBancosxproveedorComponent } from './details/detalles-bancosxproveedor.component'; // This will be for banks
import { DetailCellRendererComponentCuentas } from './details/detail-cell-renderer-cuentas.component';
import { DetallesTiposProveedorComponent } from './details/detalles-tipos-proveedor.component';
import { DetallesMaterialexprovComponent } from './details/detalles-materialexprov.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { RadiusinfluenceComponent } from 'app/domains/ModAdmon/components/radiusinfluence/radiusinfluence.component';
import { CustomersService } from 'app/services/customers.service';
import { ProvidersService } from 'app/services/providers.service';
import { SucursalByMaterialProveedorService } from 'app/services/sucursalByMaterialProveedor.service';
import { MaterialsService } from 'app/services/materials.service';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { InegiService } from 'app/services/inegi.service';
import { BranchsService } from 'app/services/branchs.service';
import { AuthService } from 'app/services/auth.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { RolesService } from 'app/services/roles.service';
import { Icatalog } from 'app/interface/icatalog';
import { ICustomer } from 'app/interface/icustomer';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { TrackingService } from 'app/services/tracking.service';
//import { DetailCellRendererComponent_1 as DetailCellRendererComponent } from "./details/detalle-contactos.component";

@Component({
  selector: 'app-customers',
  standalone: true,
  providers: [CurrencyPipe],
  imports: [
    RouterModule,
    DomainsModule,
    AgGridModule,
    MultiLineEditorComponent,
    ProvidersPaymentsComponent,
    DetailCellRendererComponentContact,
    DetallesBancosxproveedorComponent,
    DetailCellRendererComponentCuentas,
    DetallesTiposProveedorComponent,
    DetallesMaterialexprovComponent
  ],
  templateUrl: './providers.component.html',
  styleUrls: ['./providers.component.scss'],
})
export class ProvidersComponent implements CanComponentDeactivate {

  private trackingService = inject(TrackingService);
  private customerService = inject(CustomersService);
  private providersService = inject(ProvidersService);
  private materialsService = inject(MaterialsService);
  private modalServiceTable = inject(ModalService);
  private signalsService = inject(SignalsService);
  private modalService = inject(NgbModal);
  private route = inject(ActivatedRoute);
  private inegiService = inject(InegiService);
  private branchesService = inject(BranchsService);
  authService = inject(AuthService);
  private catalogsService = inject(CatalogsService);
  private sucursalByMpService = inject(SucursalByMaterialProveedorService);
  private rolesService = inject(RolesService);

  invited: boolean = false;
  departmentOptions: any[] = [];

  private http = inject(HttpClient);
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;


  constructor(private currencyPipe: CurrencyPipe) {
    effect(async () => {
      if (this.signalsService.getRefreshEmployees()() == true) {
        await this.obtenerDatos(); // Actualizar datos cuando se recibe señal
        this.signalsService.resetRefreshEmployees(); // Resetear la señal después de actualizar
      }
    });

    effect(() => {
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.idRoot = this.idCompany; // Sincronizar idRoot con idCompany
      this.invited = this.signalsService.getInvited()();
      if (this.idBranch && this.idCompany) {
        this.obtenerDatos();
        this.obtenerBranchs();
        this.getTypecop();
        this.loadDepartments();
      }
    }, { allowSignalWrites: true });
  }

  async ngOnInit() {
    this.signalsService.deleteClientData();

    // Obtener el tipo de ruta primero
    this.route.data.subscribe((data) => {
      this.type = data['type']; // 'CUSTOMERS' o 'PROVIDERS'
      this.getStates(); // Llamar a la función para obtener los estados
    });

    // Obtener valores iniciales de las señales
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    this.idCompany = this.signalsService.getRootSelectedBySidebar()();
    this.idBranch = this.signalsService.getBranchSelectedBySidebar()();

    // Si las señales ya tienen valores, cargar datos inmediatamente
    if (this.idRoot && this.idCompany && this.idBranch) {
      this.getTypecop();
      this.obtenerBranchs();
      this.obtenerDatos();
    }
    // Si no, el effect del constructor se encargará cuando las señales estén listas
  }

  // Método para actualizar el filterList del autocomplete
  updateContactFilterList() {
    if (this.rowData && Array.isArray(this.rowData)) {
      const contactList = this.rowData
        .map(e => e.nameContact)
        .filter(name => name && typeof name === 'string' && name.trim() !== '');
      
      
      // Actualizar todas las definiciones de columna que usan autocomplete
      this._colMaster = [];
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  type: string = ''; // Para almacenar el tipo (CUSTOMERS o PROVIDERS)
  gridHeight: string = '70vh';
  showCreditsTab: boolean = false;
  private gridApi: GridApi;
  notSavedChanges: boolean = false;
  selectedRowData: any = null;
  isOpen: boolean = false;
  branchs: any[] = [];
  Typecop: any[] = [];
  contactoCatalog: any[] = [];
  // VARIABLES GLOBALES compartidas por todas las columnas
  lastHoveredId: number | null = null;
  lastHoveredColumn: string | null = null;
  collapseTimerColumn: ReturnType<typeof setTimeout> | null = null;
  hoverDelayTimer: ReturnType<typeof setTimeout> | null = null;


  estadobanck: boolean = false;
  estadoid: number = 0;

  // Agregar esta nueva variable para almacenar el ID de la última fila editada
  private lastEditedRowId: number | string | null = null;
  private isNewRowEditing: boolean = false; // Flag para saber si estamos en modo agregar fila
  private newRowEditingIndex: number = -1; // Índice de la fila nueva en edición
  private enterPressedFlag: boolean = false; // Flag para detectar Enter desde editores custom (autocomplete)

  private isProcessingMouseOver = false; // Bandera para evitar eventos MouseOver en cascada
  private lastExpandedNode: any = null;
  private collapseTimer: any = null; // MEJORA: Temporizador para el colapso del detalle
  rowData: any;
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  providersXTableData: { [key: number]: any[] } = {};
  expandedProviders: Set<number> = new Set();
  cellValidationErrors: Map<string, boolean> = new Map(); // Track validation errors per cell

  id: string;
  idRoot: number;
  private tempIdCounter: number = 0;
  selectedTab: string = 'customers-payments';
  idBranch: number = null;
  idCompany: number = null;
  idEmployee: number;
  infoCp: any;


  private estados: string[] = []; // Agregar esta variable para almacenar los estados

  public defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: true,
    lockPosition: false,
    enableRowGroup: true,
    cellClassRules: {
      'new-row-cell': (params: any) => !!params.data?.__isNew
    },
    suppressKeyboardEvent: (params) => {
      if (params.event.key === 'Enter' && params.editing) {
        this.enterPressedFlag = true;
        setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
        return true;
      }
      if (params.event.key === 'Tab') {
        params.event.preventDefault();
        return true;
      }
      return false;
    }
  };

  currentIndex = 0;

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'never';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'never';

  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent,
    detailCellRenderer: DetailCellRendererComponentContact,
    detailCellRendererBanck: DetallesBancosxproveedorComponent,
    detailCellRendererCuentas: DetailCellRendererComponentCuentas,
    detailCellRendererTipoProveedor: DetallesTiposProveedorComponent,
    detailCellRendererMateriales: DetallesMaterialexprovComponent
  };

  idClient = this.signalsService.getIdClient();
  nameClient = this.signalsService.getNameClient()();

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    rowBuffer: 20,
    rowClassRules: {
      'new-row-highlight': (params: any) => !!params.data?.__isNew
    },
    masterDetail: true,
    isRowMaster: (dataItem) => {
      return true; // Todas las filas de proveedores son maestras
    },
    onColumnPinned: (event: any) => {
      // Guardar estado de columnas cuando se hace pin/unpin
      this.saveColumnState();
    },
    onColumnVisible: (event: any) => {
      // Guardar estado de columnas cuando se muestra/oculta
      this.saveColumnState();
    },
    onColumnMoved: (event: any) => {
      // Guardar estado de columnas cuando se mueve
      this.saveColumnState();
    },
    onColumnResized: (event: any) => {
      // Guardar estado de columnas cuando se redimensiona
      this.saveColumnState();
    },
    onCellEditingStarted: (event: any) => {
      if (event.data?.__isNew) {
        setTimeout(() => {
          const cell = document.querySelector(
            `.ag-row[row-index="${event.rowIndex}"] .ag-cell[col-id="${event.column.getColId()}"]`
          ) as HTMLElement;
          if (cell) {
            cell.style.outline = '2px solid #e67e00';
            const input = cell.querySelector('input') as HTMLElement;
            if (input) input.style.backgroundColor = '#ffeaa0';
          }
        }, 30);
      }
    },
    onCellEditingStopped: (event: any) => {
      // Quitar amarillo de la celda que dejó de editarse
      if (event.data?.__isNew) {
        const cell = document.querySelector(
          `.ag-row[row-index="${event.rowIndex}"] .ag-cell[col-id="${event.column.getColId()}"]`
        ) as HTMLElement;
        if (cell) {
          cell.style.outline = '';
          const input = cell.querySelector('input') as HTMLElement;
          if (input) input.style.backgroundColor = '';
        }
      }

      // Verificar si hay error de validación en esta celda
      const cellKey = `${event.rowIndex}_${event.column.colId}`;
      if (this.cellValidationErrors.has(cellKey)) {
        setTimeout(() => {
          this.gridApi.startEditingCell({
            rowIndex: event.rowIndex,
            colKey: event.column.colId
          });
        }, 100);
        return;
      }

      // Si se presionó Escape, cancelar modo de edición secuencial
      const isEscapeKey = event.event?.key === 'Escape' || event.event?.keyCode === 27;
      if (isEscapeKey) {
        this.isNewRowEditing = false;
        this.newRowEditingIndex = -1;
        return;
      }

      // Detectar Enter: desde editores nativos (event.event) o desde autocomplete (enterPressedFlag)
      const isEnterKey = event.event?.key === 'Enter' || event.event?.keyCode === 13 || this.enterPressedFlag;
      this.enterPressedFlag = false;

      // Avanzar a la siguiente columna editable si se presiona Enter
      if (isEnterKey) {
        const allColumns = this.gridApi.getColumnDefs();
        const currentIndex = allColumns.findIndex(col => 'field' in col && col.field === event.column.colId);
        const nextEditableCol = allColumns.slice(currentIndex + 1).find(col =>
          'field' in col && col.field && col.editable && !('hide' in col && col.hide)
        );

        if (nextEditableCol && 'field' in nextEditableCol) {
          setTimeout(() => {
            this.gridApi.startEditingCell({
              rowIndex: event.rowIndex,
              colKey: nextEditableCol.field
            });
          }, 100);
        } else {
          if (this.isNewRowEditing && event.data?.__isNew) {
            this.isNewRowEditing = false;
            this.newRowEditingIndex = -1;
          }
        }
      }
    },
    detailCellRendererSelector: (params) => {
      // Función helper para calcular altura dinámica
      const calculateDynamicHeight = (defaultHeight: number = 300): number => {
        const gridElement = document.querySelector('.ag-theme-quartz') as HTMLElement;
        const bodyViewport = gridElement?.querySelector('.ag-body-viewport') as HTMLElement;

        if (!bodyViewport) return defaultHeight;

        const viewportHeight = bodyViewport.clientHeight;
        const hasHorizontalScroll = bodyViewport.scrollWidth > bodyViewport.clientWidth;
        const scrollbarHeight = hasHorizontalScroll ? 17 : 0;

        const rowIndex = params.node.rowIndex || 0;
        const rowHeight = 20;
        const headerHeight = 25;

        const spaceUsedAbove = headerHeight + ((rowIndex + 1) * rowHeight);
        const availableHeight = viewportHeight - spaceUsedAbove - scrollbarHeight + 40;

        return Math.max(250, Math.min(availableHeight, 600));
      };

      // Decide qué renderizador usar basado en la propiedad 'detailType'
      if (params.data.detailType === 'contact') {
        params.node.setRowHeight(calculateDynamicHeight());
        return { component: 'detailCellRenderer' };
      } else if (params.data.detailType === 'bank') {
        params.node.setRowHeight(calculateDynamicHeight());
        return { component: 'detailCellRendererBanck' };
      } else if (params.data.detailType === 'Cuentas') {
        params.node.setRowHeight(calculateDynamicHeight());
        return { component: 'detailCellRendererCuentas' };
      } else if (params.data.detailType === 'tipoProveedor') {
        params.node.setRowHeight(calculateDynamicHeight());
        return { component: 'detailCellRendererTipoProveedor' };
      } else if (params.data.detailType === 'materiales') {
        params.node.setRowHeight(calculateDynamicHeight());
        return { component: 'detailCellRendererMateriales' };
      }
      return undefined; // No mostrar detalle si no hay tipo
    },

    getRowClass: (params) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
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
    onFirstDataRendered: (params) => {

      // Obtener todas las columnas
      const allColumnIds: string[] = [];
      params.api.getColumns()?.forEach((column: any) => {
        allColumnIds.push(column.getId());
      });


      // Autoajustar todas las columnas al contenido (considera header y datos)
      params.api.autoSizeColumns(allColumnIds, false);

    },

  };

  private _colMaster: ColDef[] = [];

  get colMaster(): ColDef[] {
    if (this._colMaster.length > 0) {
      return this._colMaster;
    }

    this._colMaster = [
      {
        field: 'id',
        headerName: 'ID',
        hide: true, // La ocultamos porque es para uso interno
        filter: 'agNumberColumnFilter',
      },
      {
        field: 'vigente',
        headerName: 'Activo',
        editable: true,
        cellRenderer: 'agCheckboxCellRenderer',
        cellEditor: 'agCheckboxCellEditor',
      },

      {
        field: 'typeIntOrExt',
        headerName: 'Tipo',
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Interno', 'Externo']
        },
      },

      {
        field: 'autorizacion',
        headerName: 'Por autorizar',
        width: 130,
        editable: false,
        sortable: false,
        filter: false,
        cellRenderer: this.createAutorizacionCheckboxRenderer(),
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      },

      {
        field: 'company',
        headerName: 'Compañía *',
        editable: true,
        headerClass: 'my-header-red',
        cellEditorSelector: (params: any) => this.companyEditorSelector(params),
        valueSetter: (params) => {
          const rawValue = params.newValue;

          // Permitir vacío, la validación de "al menos uno" se hace al guardar
          if (!rawValue || typeof rawValue !== 'string' || rawValue.trim() === '') {
            params.data[params.colDef.field] = '';
            // Limpiar error de validación
            this.cellValidationErrors.delete(`${params.node.rowIndex}_company`);
            return true;
          }

          const normalizedValue = rawValue.trim().toUpperCase();

          // Verificar duplicados en company (solo en el mismo idRoot)
          const duplicateExists = this.rowData.some(
            (row, index) =>
              index !== params.node.rowIndex &&
              row.company?.toUpperCase() === normalizedValue
          );

          if (duplicateExists) {
            // Marcar error de validación
            this.cellValidationErrors.set(`${params.node.rowIndex}_company`, true);
            alerts.basicAlert(
              'Empresa duplicada',
              'Ya existe una empresa registrada con ese nombre.',
              'error'
            );
            return false;
          }

          // Limpiar error de validación si pasó la validación
          this.cellValidationErrors.delete(`${params.node.rowIndex}_company`);
          params.data[params.colDef.field] = normalizedValue;
          return true;
        }
      },

      {
        field: 'nameContact',
        headerName: 'Contacto principal *',
        editable: true,
        filter: true,
        cellEditor: 'autocompleteEditor',
        headerClass: 'my-header-red',
        /*cellRenderer: (params) => { 
          const div = document.createElement('div');  #
          div.innerText = params.value; 
          const rowData = params.data;
          div.addEventListener('mouseenter', () => { 
            const modal = new bootstrap.Modal(document.getElementById('bonus')!);
            modal.show();
          }); 
          div.addEventListener('mouseleave', () => { 
            div.setAttribute('data-bs-dismiss', 'modal');
          }); 
          return div; 
        },*/
        cellEditorParams: (params: any) => {
          // Generar el filterList en tiempo real
          const contactList = this.rowData && Array.isArray(this.rowData) 
            ? this.rowData
                .map(e => e.nameContact)
                .filter(name => name && typeof name === 'string' && name.trim() !== '')
            : [];
          
          
          return {
            filterList: contactList,
            filterKey: 'nameContact',
            placeholder: 'Nombre Contacto',
            minLength: 1,
            onEnterPressed: () => { this.enterPressedFlag = true; }
          };
        },

        valueSetter: (params) => {
          const rawValue = params.newValue;

          // Permitir vacío, la validación de "al menos uno" se hace al guardar
          if (!rawValue || typeof rawValue !== 'string' || rawValue.trim() === '') {
            params.data[params.colDef.field] = '';
            return true;
          }

          const normalizedValue = rawValue.trim().toUpperCase();

          const duplicateExists = this.contactoCatalog.some(
            (row, index) =>
              index !== params.node.rowIndex &&
              row.nameContact?.toUpperCase() === normalizedValue
          );

          if (duplicateExists) {
            alerts.basicAlert(
              'Nombre duplicado',
              'Ya existe un nombre de contacto registrado.',
              'error'
            );
            return false;
          }

          params.data[params.colDef.field] = normalizedValue;
          return true;
        },
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',d
        },
      },

      {
        field: 'position',
        headerName: 'Puesto/Area',
        editable: true,
        headerClass: 'my-header-red',
        valueSetter: (params) => {
          const rawValue = params.newValue;
          // Permitir vacío, el campo es opcional
          if (!rawValue || rawValue.toString().trim() === '') {
            params.data[params.colDef.field] = '';
            return true;
          }
          params.data[params.colDef.field] = rawValue.toString().toUpperCase();
          return true;
        }
      },

      //Es un combo de Tipo de Proveedor qe le compro
      {
        field: 'typeProvider',
        headerName: 'Tipo Proveedor',
        editable: false,
        cellRenderer: (params: any): HTMLElement => {
          const div = document.createElement('div');

          // Mostrar el valor desde typework o typeProvider
          const displayValue = params.data.typework || params.data.typeProvider;

          if (displayValue) {
            div.innerText = displayValue;
          } else {
            div.innerText = '🔽 Seleccionar...';
            div.style.color = '#888';
          }

          div.style.cursor = 'pointer';
          div.style.textDecoration = 'underline';
          div.style.background = '#fff3cd';
          div.style.padding = '2px 5px';
          div.style.borderRadius = '3px';

          return div;
        },
      }, 

      {
        field: 'fieldBank',
        headerName: 'Bancos',
        editable: false,
        cellRenderer: this.createDetailToggleCellRenderer('bank'),
        cellStyle: { backgroundColor: '#d4edda' },
      },

      {
        field: 'fieldCuenta',
        headerName: 'Cuentas x Pagar',
        cellRenderer: this.createDetailToggleCellRenderer('Cuentas'),
        cellStyle: { backgroundColor: '#d4edda' },
        editable: false
      },

      {
        field: 'fieldMaterial',
        headerName: 'Materiales y Sucursales',
        cellRenderer: this.createDetailToggleCellRenderer('materiales'),
        editable: false,
        cellStyle: { backgroundColor: '#d4edda' },
      },

       {
        field: 'fieldContact',
        headerName: 'Contactos',
        cellRenderer: this.createDetailToggleCellRenderer('contact'),
        editable: false,
        cellStyle: { backgroundColor: '#d4edda' },
      },

      {
        field: 'phone',
        headerName: 'Telefono principal',
        editable: true,
        valueSetter: (params) => {
          const rawValue = params.newValue;
          if (!rawValue || rawValue.toString().trim() === '') {
            params.data[params.colDef.field] = '';
            return true;
          }

          // Eliminar todo lo que no sea número
          const digits = rawValue.toString().replace(/\D/g, '');

          if (digits.length !== 10) {
            alerts.basicAlert('Formato inválido', 'El teléfono debe tener 10 dígitos.', 'error');
            return false;
          }

          // Formatear como (XXX) XXX-XXXX
          const formatted = `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6, 10)}`;
          params.data[params.colDef.field] = formatted;
          return true;
        },
      },

      {
        field: 'email',
        headerName: 'Email Principal',
        editable: true,
        valueSetter: (params) => {
          const rawValue = params.newValue;

          // Si es vacío, null, undefined o caracteres basura como '*', limpiar
          if (!rawValue || rawValue === null || rawValue === undefined) {
            params.data[params.colDef.field] = '';
            return true;
          }

          const trimmed = rawValue.toString().trim();

          // Si el valor es solo caracteres no válidos para email (*, etc.), ignorar
          if (trimmed.length <= 1 && !/[a-zA-Z0-9]/.test(trimmed)) {
            params.data[params.colDef.field] = '';
            return true;
          }

          params.data[params.colDef.field] = trimmed;
          return true;
        },
      },


      {
        field: 'cp',
        headerName: 'Cp',
        editable: true,
      },
      {
        field: 'address',
        headerName: 'Dirección',
        editable: true,
      },
      {
        field: 'city',
        headerName: 'Ciudad',
        editable: true,
      },
      {
        field: 'state',
        headerName: 'Estado',
        editable: true,
      },
      {
        field: '',
        headerName: 'Colonia',
        editable: true,
      },
    ];

    return this._colMaster;
  }

  // Función auxiliar para obtener el tipo de detalle desde el ID de la columna
  getDetailTypeFromColId(colId: string): string | null {
    if (colId === 'fieldContact') return 'contact';
    if (colId === 'fieldBank') return 'bank';
    if (colId === 'fieldCuenta') return 'Cuentas';
    if (colId === 'typeProvider') return 'tipoProveedor';
    if (colId === 'fieldMaterial') return 'materiales';
    return null;
  }

  // Carga los departamentos desde la BD
  private loadDepartments() {
    if (!this.idCompany) return;

    this.rolesService.getRoles(this.idCompany).subscribe({
      next: (data: any) => {
        const raw = data?.data ?? data ?? [];
        this.departmentOptions = Array.isArray(raw) ? raw : [];
      },
      error: (error) => {
        console.error('Error cargando departamentos:', error);
        this.departmentOptions = [];
      }
    });
  }

  // Selector de editor para columna Compañía (dropdown si es Interno, autocomplete si es Externo)
  private companyEditorSelector(params: any) {
    const typeIntOrExt = params.data?.typeIntOrExt;

    if (typeIntOrExt === 'Interno') {
      // Obtener nombres de departamentos desde departmentOptions
      const allDepartments = this.departmentOptions
        .filter(dept => dept.active)
        .map(dept => dept.description)
        .sort();

      // Obtener departamentos ya asignados en otras filas
      const assignedDepartments = this.rowData
        .filter((row, index) => index !== params.node.rowIndex && row.typeIntOrExt === 'Interno' && row.company)
        .map(row => row.company.toUpperCase());

      // Filtrar departamentos disponibles (excluir los ya asignados)
      const availableDepartments = allDepartments.filter(
        dept => !assignedDepartments.includes(dept.toUpperCase())
      );

      return {
        component: 'agSelectCellEditor',
        params: {
          values: availableDepartments
        }
      };
    } else {
      // Autocomplete para Externo (comportamiento original)
      const companyList = this.rowData && Array.isArray(this.rowData)
        ? this.rowData
            .map(e => e.company)
            .filter(name => name && typeof name === 'string' && name.trim() !== '')
        : [];

      return {
        component: 'autocompleteEditor',
        params: {
          filterList: companyList,
          filterKey: 'company',
          placeholder: 'Nombre Compañía',
          minLength: 1,
          onEnterPressed: () => { this.enterPressedFlag = true; }
        }
      };
    }
  }



  /** Respuesta POST/GET de flags: objeto plano id → bool (tolerante a envoltorios). */
  private normalizeFlagPayload(raw: unknown): Record<string, boolean> {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
      return {};
    }
    const o = raw as Record<string, unknown>;
    const inner = (o['data'] ?? o['result'] ?? o) as Record<string, unknown>;
    if (inner == null || typeof inner !== 'object' || Array.isArray(inner)) {
      return {};
    }
    const out: Record<string, boolean> = {};
    for (const k of Object.keys(inner)) {
      const v = inner[k];
      out[k] = v === true || v === 1 || v === '1';
    }
    return out;
  }

  /**
   * matprov puede devolver `autorizacion`, `porAutorizar` o `por_autorizar`; en SQL a veces llega como 0/1.
   */
  private readPorAutorizarFlag(data: any): boolean {
    if (!data) return false;
    const v =
      data.autorizacion ??
      data.porAutorizar ??
      data.PorAutorizar ??
      data.por_autorizar;
    if (v === undefined || v === null || v === '') return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    const s = String(v).trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'no') return false;
    return false;
  }

  /** Solo lectura: refleja «Por autorizar»; no se alterna desde el grid. */
  private createAutorizacionCheckboxRenderer(): (params: any) => HTMLElement {
    return (params: any): HTMLElement => {
      const wrap = document.createElement('div');
      wrap.style.cssText =
        'display:flex;align-items:center;justify-content:center;height:100%;width:100%;';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.title = 'Por autorizar (no editable aquí)';
      cb.checked =
        params.data?.autorizacion === true ||
        params.data?.autorizacion === 1 ||
        this.readPorAutorizarFlag(params.data);
      cb.disabled = true;
      cb.style.cursor = 'default';

      wrap.appendChild(cb);
      return wrap;
    };
  }

  createDetailToggleCellRenderer(detailType: string): (params: any) => HTMLElement {
    return (params: any): HTMLElement => {
      const div = document.createElement('div');
      //console.log(params.data.id)
      switch
      (detailType) {
        case 'contact':
          div.innerText = params.data.fieldContact;
          break;
        case 'bank':
          // Mostrar el nombre del banco principal seguido del número de bancos activos entre paréntesis
          const bankCount = params.data.fieldBank || 0;
          const principalName = params.data.principalBankName || '';

          if (principalName && bankCount > 0) {
            div.innerText = `${principalName} (${bankCount})`;
          } else if (bankCount > 0) {
            div.innerText = `(${bankCount})`;
          } else {
            div.innerText = '0';
          }
          break;
        case 'Cuentas':
          const isNumeric = params.data.fieldCuenta !== null && params.data.fieldCuenta !== '' && !isNaN(Number(params.data.fieldCuenta));
          const value = isNumeric ? this.currencyPipe.transform(params.data.fieldCuenta, '', 'symbol', '1.2-2') : '$0.00';
          div.innerText = value;
          break;
        case 'materiales':
          div.innerText = params.data.fieldMaterial || '0';
          break;
      }
      // Usamos innerHTML para poder renderizar el ícono
      //div.innerHTML = params.data.id;
      div.style.cursor = 'pointer';
      div.style.textDecoration = 'underline';
      div.style.background = '#d4edda';

      const node = params.node;
      const api = params.api;


      return div;
    };
  }




  obtenerDatos() {
    if (!this.idRoot) {
      return Promise.resolve(false);
    }

    this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Proveedores`, 'Menu Administracion Proveedores ',
      this.trackingService.getEmail());

    return new Promise((resolve) => {
      // Usar el endpoint de Tracking que mapea active -> vigente correctamente
      this.customerService
        .getProvidersForGrid(this.idRoot)
        .pipe(
          switchMap((grid) => {
            const data: any[] = Array.isArray(grid) ? grid : [];
            const ids = [
              ...new Set(
                data
                  .map((r: any) => Number(r.id))
                  .filter((n: number) => Number.isFinite(n) && n > 0)
              ),
            ];
            if (ids.length === 0) {
              return of({ data, flags: {} as Record<string, boolean> });
            }
            return this.customerService.getAutorizacionFlagsByIds(ids, this.idRoot).pipe(
              map((flags) => ({ data, flags })),
              catchError((err) => {
                console.warn('No se pudieron cargar por_autorizar desde Tracking; solo matprov.', err);
                return of({ data, flags: {} as Record<string, boolean> });
              })
            );
          })
        )
        .subscribe({
          next: ({ data, flags }) => {
            const flagMap = this.normalizeFlagPayload(flags);

            const merged: any[] = data.map((row: any) => {
              let next = { ...row };
              if (next.email) {
                const trimmed = next.email.toString().trim();
                if (trimmed.length <= 1 && !/[a-zA-Z0-9]/.test(trimmed)) {
                  next = { ...next, email: '' };
                }
              }
              const id = Number(next.id);
              const key = Number.isFinite(id) ? String(id) : '';
              const fromApi =
                key !== '' && flagMap[key] !== undefined ? flagMap[key] : undefined;
              const autorizacion =
                fromApi !== undefined ? !!fromApi : this.readPorAutorizarFlag(next);
              return { ...next, autorizacion };
            });

            this.rowData = merged;
            this.updateContactFilterList();
            setTimeout(() => {
              try {
                this.gridApi?.refreshCells({ force: true });
              } catch {
                /* grid aún no listo */
              }
            }, 0);
            resolve(true);
          },
          error: (error) => {
            console.error('Error obteniendo datos:', error);
            resolve(false);
          },
        });
    });

  }

  obtenerBranchs() {
    this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Sucursales`, 'Menu Administracion Proveedores ',
      this.trackingService.getEmail());

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

          this.gridApi.applyTransaction({ update: [event.data] });
        }
      }, 500);
    }
  }

  onCellClicked(event: any): void {
    event.node.setSelected(true);

    const colId = event.column.getColId();
    const isDetailColumn = colId === 'fieldContact' || colId === 'fieldBank' || colId === 'fieldCuenta' || colId === 'typeProvider' || colId === 'fieldMaterial';

    if (isDetailColumn) {
      const node = event.node;
      const api = event.api;
      const detailType = this.getDetailTypeFromColId(colId);

      // Determinar si la fila actual ya está expandida CON ESTE MISMO tipo de detalle
      const isCurrentlyExpanded = node.expanded && event.data.detailType === detailType;

      // Colapsar TODAS las filas expandidas (incluida la actual)
      api.forEachNode(otherNode => {
        if (otherNode.expanded) {
          otherNode.setExpanded(false);
        }
      });

      if (isCurrentlyExpanded) {
        // Si se hace clic en la misma celda que ya está abierta...
        // ...ya se cerró arriba, solo limpiar el filtro.
        api.setFilterModel(null);
        api.onFilterChanged();
      } else {
        // Si se hace clic en una celda diferente (o la fila está cerrada)...
        // ...se establece el nuevo tipo de detalle y se expande la fila.

        // Limpiar filtro antes de aplicar uno nuevo
        api.setFilterModel(null);

        // Aplicar filtro por ID para enfocar la fila actual.
        const filterModel = {
          id: { filterType: 'number', type: 'equals', filter: event.data.id },
        };
        api.setFilterModel(filterModel);

        // Expandir la fila con el detalle correcto
        event.data.detailType = detailType;
        node.setExpanded(true);
      }
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

    // Cargar estado de columnas desde localStorage
    this.loadColumnState();

    // Configurar master-detail después de que el grid esté listo
    this.gridApi.setGridOption('detailCellRendererParams', {
      getDetailRowData: (params) => {
        params.successCallback(params.data.detailData);
      },
      context: { // Pasamos las funciones de CRUD a los componentes de detalle
        idRoot: this.idRoot, // ⭐ Pasar idRoot al contexto para los detail renderers
        CONTACT: { // Para la grilla de Contactos
          load: (providerId: number, type: string, callback: (data: any[]) => void) => {
            this.loadProviderXTableData(providerId, type, callback);
          },
          save: (providerId: number, data: any[], type: string) => {
            this.saveProviderDetailsById(providerId, data, type);
          },
          delete: (params: any, callback: () => void) => {
            this.deleteDetailRow(params, callback, 'CONTACT');
          }
        },
        BANK: { // Para la grilla de Bancos
          load: (providerId: number, type: string, callback: (data: any[]) => void) => {
            this.loadProviderXTableData(providerId, type, callback);
          },
          save: (providerId: number, data: any[], type: string) => {
            this.saveProviderDetailsById(providerId, data, type);
          },
          delete: (params: any, callback: () => void) => {
            this.deleteDetailRow(params, callback, 'BANK');
          }
        },
        CUENTA: { // Para la grilla de Cuentas por Pagar
          load: (providerId: number, type: string, callback: any) => {
            this.loadProviderXTableData(providerId, type, callback);
          },
          save: (providerId: number, data: any[], type: string) => {
            this.saveProviderDetailsById(providerId, data, type);
          },
          delete: (params: any, callback: any) => {
            this.deleteDetailRow(params, callback, 'CUENTA');
          }
        },
        MATERIAL: { // Para la grilla de Materiales
          load: (providerId: number, type: string, callback: (data: any[]) => void) => {
            // For materiales, we generate fake data instead of loading from server
            const fakeData = this.generateFakeMaterialsForProvider(providerId);
            callback(fakeData);
          },
          save: (providerId: number, data: any[], type: string) => {
            // For fake data, just simulate save
            // Could implement local storage or just log
          },
          delete: (params: any, callback: () => void) => {
            // For fake data, just simulate delete
            callback();
          }
        }
      }
    });


  }

  // Guardar estado de columnas (pin, orden, visibilidad) en localStorage
  private saveColumnState() {
    if (!this.gridApi) return;

    try {
      const columnState = this.gridApi.getColumnState();
      const localStorageKey = `providers_column_state_${this.idRoot}`;
      localStorage.setItem(localStorageKey, JSON.stringify(columnState));
    } catch (error) {
      console.error('Error guardando estado de columnas:', error);
    }
  }

  // Cargar estado de columnas desde localStorage
  private loadColumnState() {
    if (!this.gridApi) return;

    try {
      const localStorageKey = `providers_column_state_${this.idRoot}`;
      const savedState = localStorage.getItem(localStorageKey);

      if (savedState) {
        const columnState = JSON.parse(savedState);
        this.gridApi.applyColumnState({
          state: columnState,
          applyOrder: true
        });
      }
    } catch (error) {
      console.error('Error cargando estado de columnas:', error);
    }
  }

  addRow() {
    this.trackingService.addLog(this.trackingService.getnameComp(), `Agregar Proveedores`, 'Menu Administracion Proveedores ',
      this.trackingService.getEmail());

    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idRoot: this.idRoot,
      nameContact: '',
      company: '',
      position: 'GERENCIA',
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
      autorizacion: false,
      NumCliente: 0,
      latitud: '',
      longitud: '',
      idTypecop: 0,
      type: 'PROVIDERS',
      typeIntOrExt: 'Externo',  // Tipo Interno/Externo por defecto
      fieldContact: 1,
      fieldBank: 0,
      fieldCuenta: 0,
      active: true,
      typework: '',  // Nuevo campo para Tipo de Proveedor (cascada)
      __isNew: true,
    };
    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;

    // Activar modo de edición de nueva fila
    this.isNewRowEditing = true;
    this.newRowEditingIndex = 0;

    // Usar setTimeout para asegurar que el grid haya renderizado la nueva fila
    setTimeout(() => {
      const firstRowIndex = 0;

      // Asegurar que la fila sea visible
      this.gridApi.ensureIndexVisible(firstRowIndex);

      // Seleccionar la fila
      this.gridApi.getModel().getRow(firstRowIndex)?.setSelected(true);

      // Iniciar edición en 'company' (primera columna útil)
      setTimeout(() => {
        this.gridApi.startEditingCell({
          rowIndex: firstRowIndex,
          colKey: 'company'
        });
      }, 200);
    }, 100);
  }

  async saveChanges() {

    this.trackingService.addLog(this.trackingService.getnameComp(), `Guardar Proveedores`, 'Menu Administracion Proveedores ',
      this.trackingService.getEmail());

    let errorMessage = '';
    const isValid = this.rowData.every((item, index) => {

      // Validar que al menos Compañía o Contacto Principal estén llenos
      const hasCompany = item.company && item.company.toString().trim() !== '';
      const hasContact = item.nameContact && item.nameContact.toString().trim() !== '';

      if (!hasCompany && !hasContact) {
        errorMessage = `Fila ${index + 1}: Debe llenar al menos Compañía o Contacto Principal.`;
        return false;
      }

      // Validar formato de Email solo en filas nuevas o modificadas
      if ((item.__isNew || item.__modified) && item.email && item.email.toString().trim() !== '') {
        const emailStr = item.email.toString().trim();
        // Ignorar caracteres basura como '*'
        if (emailStr.length <= 1 && !/[a-zA-Z0-9]/.test(emailStr)) {
          item.email = ''; // Limpiar basura silenciosamente
        } else {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(emailStr)) {
            errorMessage = `Fila ${index + 1}: El formato del Email "${emailStr}" es inválido.`;
            return false;
          }
        }
      }

      if (this.type === 'CUSTOMERS' && (!item.idTypecop || item.idTypecop === 0)) {
        errorMessage = `Fila ${index + 1}: Debe seleccionar el Tipo de Cliente.`;
        return false;
      }

      return true;
    });

    if (!isValid) {
      alerts.basicAlert(
        'Validación requerida',
        errorMessage,
        'warning'
      );
      return;
    }

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );


    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.customerService.addCustomer(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.customerService.updateCustomer(row.id, cleanedData);
    });

    try {
      const responses: ICustomer[] = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray()) as Observable<ICustomer[]>
      );

      // Determinar qué ID vamos a seleccionar después de recargar
      if (modifiedRows.length > 0) {
        this.lastEditedRowId = modifiedRows[modifiedRows.length - 1].id;
      } else if (newRows.length > 0) {
        this.lastEditedRowId = 'SELECT_MAX_ID';
        const data = {
          campo1: 0,
          campo2: responses[0].nameContact,
          campo3: responses[0].position,
          campo4: responses[0].phone,
          campo5: responses[0].email,
          campo6: "NA",
          campo7: true,
          idTabla: responses[0].id,
          type: "CONTACT"
        };
        this.providersService.addProviderXTable(data).subscribe();
      }

      // Guardar también los cambios de ProviderXTable
      await this.saveProviderXTableChanges();

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
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

  /** Quita vínculos en Warehouse (subfamilias, ProveedorXTabla, sucursales por material) antes de borrar el Customer. */
  private async deleteWarehouseLinksForProvider(providerId: number): Promise<void> {
    try {
      const subRows: any = await lastValueFrom(
        this.providersService.getSubfamilyxProviderByProvider(providerId)
      );
      const subList = Array.isArray(subRows) ? subRows : [];
      for (const row of subList) {
        const sid = row?.id;
        if (sid != null && Number(sid) > 0) {
          try {
            await lastValueFrom(this.providersService.deleteSubfamilyxProvider(Number(sid)));
          } catch (e) {
            console.warn('No se pudo eliminar SubfamilyxProvider', sid, e);
          }
        }
      }
    } catch (e) {
      console.warn('getSubfamilyxProviderByProvider', e);
    }

    const types = ['MATERIAL', 'CONTACT', 'BANK'];
    for (const type of types) {
      let list: any;
      try {
        list = await lastValueFrom(this.providersService.getProvidersXTable(providerId, type));
      } catch {
        continue;
      }
      const rows = Array.isArray(list) ? list : [];
      for (const row of rows) {
        const pxtId = row?.id;
        if (pxtId == null || Number(pxtId) <= 0) continue;
        if (type === 'MATERIAL') {
          try {
            const sucs: any = await lastValueFrom(
              this.sucursalByMpService.getSucursalByMaterial(Number(pxtId))
            );
            const sl = Array.isArray(sucs) ? sucs : [];
            for (const s of sl) {
              if (s?.id != null) {
                try {
                  await lastValueFrom(
                    this.sucursalByMpService.deleteSucursalByMaterial(Number(s.id))
                  );
                } catch (e) {
                  console.warn('deleteSucursalByMaterial', s?.id, e);
                }
              }
            }
          } catch (e) {
            console.warn('getSucursalByMaterial', pxtId, e);
          }
        }
        try {
          await lastValueFrom(this.providersService.deleteProviderXTable(Number(pxtId)));
        } catch (e) {
          console.warn('deleteProviderXTable', pxtId, e);
        }
      }
    }
  }

  async deleteEntry() {
    this.trackingService.addLog(this.trackingService.getnameComp(), `Eliminar Proveedores`, 'Menu Administracion Proveedores ',
      this.trackingService.getEmail());
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
    
    const id = Number(selectedData?.id);
    
    if (!Number.isFinite(id) || id <= 0) {
      alerts.basicAlert('Eliminar entrada', 'Identificador de proveedor no válido.', 'error');
      return;
    }

    const creditTotal = Number(selectedData?.total);
    if (Number.isFinite(creditTotal) && creditTotal !== 0) {
      alerts.basicAlert(
        'Error al eliminar',
        'No se puede eliminar mientras tenga saldo o notas de crédito distintas de cero.',
        'error'
      );
      return;
    }

    const confirm = await alerts.confirmAlert(
      'Eliminar proveedor',
      `Se eliminará permanentemente el proveedor "${selectedData.company || selectedData.nameContact || id}" y sus vínculos en almacén (materiales, contactos, bancos). ¿Continuar?`,
      'warning',
      'Sí, eliminar'
    );
    if (!confirm.isConfirmed) {
      return;
    }

    try {
      await this.deleteWarehouseLinksForProvider(id);
      
      const response = await lastValueFrom(this.customerService.deleteCustomer(id));
      
      await alerts.basicAlert('Eliminar entrada', 'Proveedor eliminado correctamente.', 'success');
      await this.obtenerDatos();
      this.notSavedChanges = false;
      this.selectedRowData = null;
    } catch (error: any) {
      console.error('🔍 deleteEntry - Error:', error);
      console.error('🔍 deleteEntry - Error status:', error?.status);
      console.error('🔍 deleteEntry - Error statusText:', error?.statusText);
      console.error('🔍 deleteEntry - Error error:', error?.error);
      console.error('🔍 deleteEntry - Error message:', error?.message);
      await alerts.basicAlert(
        'Eliminar entrada',
        error?.error?.message || error?.message || 'Error al eliminar el proveedor en el servidor.',
        'error'
      );
    }
  }

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.typeProvider; // Solo para visualización, no va a BD
    delete cleanedData.tipoProveedorRows; // Solo para reconstruir grid, no va a BD
    delete cleanedData.detailType; // Propiedad interna del grid
    cleanedData.active = cleanedData.vigente === true;
    // NO incluir 'type' para evitar actualizarlo en ediciones
    // El 'type' solo se debe incluir al agregar nuevos registros
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    } else {
      // Si NO es un registro nuevo (temp_), eliminar 'type' para no actualizarlo
      delete cleanedData.type;
    }
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

    this.notSavedChanges = true;
    this.selectedRowData = selectedRowData;

    // Filtrar el grid para mostrar solo el registro con el ID seleccionado solo si la columna es "total"
    if (colId === 'total') {
      if (this.gridApi) {
        const filterModel = {
          id: {
            filterType: 'number',
            type: 'equals', // o 'contains', 'startsWith', etc.
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
  }

  async activateCreditsTab() {
    if (!this.isOpen) {
      setTimeout(async () => await this.adjustGridSize(), 0);
      this.showCreditsTab = true;
      this.isOpen = true;
    } else {
      this.resetGridSize();
      this.isOpen = false;
    }
  }

  resetGridSize() {
    this.gridHeight = '80vh'; // Reset to default height
    this.showCreditsTab = false;
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
    this.catalogsService.getCatalogsVigente(this.idRoot, 'CONTACT').subscribe(
      (data: Icatalog[]) => {
        this.Typecop = data;
      },
      (error) => console.error('Error fetching measures:', error)
    );
  }

  loadProviderXTableData(providerId: number, type: string, successCallback: any) {
    this.providersService.getProvidersXTable(providerId, type).subscribe({
      next: (data: any) => {
        this.providersXTableData[providerId] = data;
        successCallback(data);
      },
      error: (error) => {
        console.error('Error loading provider details:', error);
        successCallback([]);
      }
    });
  }

  onDetailCellValueChanged(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;
  }


  async deleteDetailRow(params: any, successCallback: () => void, type: string) {
    const providerId = params.data.idTabla;
    const detailId = params.data.id;

    if (params.data.__isNew) {
      // Si es una fila nueva, solo removerla del array local
      this.providersXTableData[providerId] = (this.providersXTableData[providerId] || []).filter(
        item => item.id !== detailId
      ) || [];
      params.api.applyTransaction({ remove: [params.data] });
      this.notSavedChanges = true;
    } else {
      // Si es una fila existente, eliminarla del servidor
      try {
        this.customerService.updateFiel(providerId, type, "RESTA").subscribe();
        await lastValueFrom(this.providersService.deleteProviderXTable(detailId));

        alerts.basicAlert('Contacto eliminado', 'El contacto se eliminó correctamente.', 'success');
        successCallback(); // Llama al callback para recargar los datos en el componente hijo
      } catch (error) {
        console.error('Error deleting detail row:', error);
        alerts.basicAlert(
          'Error',
          'Error al eliminar el contacto.',
          'error'
        );
      }
    }
  }

  async saveProviderDetailsById(providerId: number, data: any[], type: string) {
    const newDetails = data.filter((row: any) => row.__isNew);
    const modifiedDetails = data.filter((row: any) => row.__modified && !row.__isNew);


    try {
      for (const row of newDetails) {
        const cleanedData = this.cleanDataForServer(row);

        this.customerService.updateFiel(row.idTabla, row.type, "SUMA").subscribe();

        await lastValueFrom(this.providersService.addProviderXTable(cleanedData));
        // NO recargar toda la tabla aquí - causaba que se cierre el detalle
        // this.obtenerDatos();
      }

      for (const row of modifiedDetails) {
        const cleanedData = this.cleanDataForServer(row);

        const resultado = await lastValueFrom(this.providersService.updateProviderXTable(row.id, cleanedData));
      }

      if (newDetails.length > 0 || modifiedDetails.length > 0) {
        // Esperar a que el alert se cierre antes de continuar
        await alerts.basicAlert(
          'Detalles guardados',
          'Se han guardado los detalles correctamente.',
          'success'
        );

        // No es necesario recargar aquí, el componente hijo lo hace.
        // Simplemente limpiamos los flags.
        this.updateCantidad(providerId);
        data.forEach(row => {
          delete row.__isNew;
          delete row.__modified;
        })
      }

    } catch (error) {
      console.error('Error saving contacts:', error);
      await alerts.basicAlert(
        'Error',
        'Error al guardar los detalles.',
        'error'
      );
    }
  }

  async saveProviderXTableChanges() {
    const allDetailChanges = [];

    // Handle contact data
    for (const [providerId, details] of Object.entries(this.providersXTableData)) {
      const newDetails = details.filter((row: any) => row.__isNew);
      const modifiedDetails = details.filter((row: any) => row.__modified && !row.__isNew);

      newDetails.forEach(row => {
        allDetailChanges.push({
          type: 'add',
          data: this.cleanDataForServer(row)
        });
      });

      modifiedDetails.forEach(row => {
        allDetailChanges.push({
          type: 'update',
          id: row.id,
          data: this.cleanDataForServer(row)
        });
      });
    }

    if (allDetailChanges.length === 0) return;

    try {
      for (const change of allDetailChanges) {
        if (change.type === 'add') {
          await lastValueFrom(this.providersService.addProviderXTable(change.data));
        } else if (change.type === 'update') {
          await lastValueFrom(this.providersService.updateProviderXTable(change.id, change.data));
        }
      }

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los contactos correctamente.',
        'success'
      );

      // Reload contact data
      for (const providerId of Object.keys(this.providersXTableData)) {
        this.loadProviderXTableData(Number(providerId), 'CONTACT', (data) => { // Asumiendo que esto es para contactos, si no, se necesita el tipo
          this.providersXTableData[Number(providerId)] = data;
        });
      }

    } catch (error) {
      console.error('Error saving detail changes:', error);
      alerts.basicAlert(
        'Error',
        'Error al guardar los cambios en contactos.',
        'error'
      );
    }
  }

  updateCantidad(id) {
    // alert('Actualizar cantidad de contactos para proveedor ID:' + id);

  }

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.notSavedChanges);
  }

  // Generate fake materials data for a provider
  private generateFakeMaterialsForProvider(providerId: number): any[] {
    const categories = ['Electrónica', 'Mecánica', 'Química', 'Textil', 'Construcción', 'Automotriz'];
    const subcategories = {
      'Electrónica': ['Circuitos', 'Sensores', 'Baterías', 'Cables'],
      'Mecánica': ['Engranajes', 'Ejes', 'Rodamientos', 'Sellos'],
      'Química': ['Ácidos', 'Bases', 'Solventes', 'Catalizadores'],
      'Textil': ['Telas', 'Hilos', 'Tintes', 'Aditivos'],
      'Construcción': ['Cemento', 'Acero', 'Madera', 'Vidrio'],
      'Automotriz': ['Frenos', 'Motor', 'Suspensión', 'Eléctrica']
    };
    const units = ['Pieza', 'Kg', 'Litro', 'Metro', 'Caja', 'Paquete'];
    const names = [
      'Resistor 10K', 'Capacitor 100uF', 'Tornillo M8', 'Acido Sulfúrico', 'Tela Algodón',
      'Cemento Portland', 'Batería 12V', 'Engranaje Helicoidal', 'Solvente Orgánico', 'Cable USB'
    ];

    const materials = [];
    const count = Math.floor(Math.random() * 8) + 3; // 3-10 materials

    for (let i = 0; i < count; i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      const subcategory = subcategories[category][Math.floor(Math.random() * subcategories[category].length)];
      const unit = units[Math.floor(Math.random() * units.length)];
      const price = Math.floor(Math.random() * 1000) + 10;

      materials.push({
        id: `mat_${providerId}_${i + 1}`,
        idTabla: providerId,
        codigo: `MAT${String(i + 1).padStart(3, '0')}`,
        nombre: names[Math.floor(Math.random() * names.length)],
        descripcion: `Descripción del material ${i + 1}`,
        categoria: category,
        subcategoria: subcategory,
        unidad: unit,
        precio: price,
        vigente: Math.random() > 0.2, // 80% active
        type: 'MATERIAL',
        active: true
      });
    }

    return materials;
  }
}
