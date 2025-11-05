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
  toArray,
  throwError,
  map,
  Observable
} from 'rxjs';
import { AgGridModule } from 'ag-grid-angular';
import { ModalService } from 'app/services/modal.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { SignalsService } from 'app/services/signals.service';
import { ProvidersPaymentsComponent } from './providers-payments.component';

import { DetailCellRendererComponentContact } from './details/detail-cell-renderer-contact.component'; // This seems to be the one for contacts
import { DetailCellRendererComponentBanck } from './details/detail-cell-renderer-banck.component'; // This will be for banks
import { DetailCellRendererComponentCuentas } from './details/detail-cell-renderer-cuentas.component';
import { DetailCellRendererTipoProveedorComponent } from './details/detail-cell-renderer-tipo-proveedor.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { RadiusinfluenceComponent } from 'app/domains/ModAdmon/components/radiusinfluence/radiusinfluence.component';
import { CustomersService } from 'app/services/customers.service';
import { ProvidersService } from 'app/services/providers.service';
import { MaterialsService } from 'app/services/materials.service';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { InegiService } from 'app/services/inegi.service';
import { BranchsService } from 'app/services/branchs.service';
import { AuthService } from 'app/services/auth.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { Icatalog } from 'app/interface/icatalog';
import { ICustomer } from 'app/interface/icustomer';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { TrackingService } from 'app/services/tracking.service';
//import { DetailCellRendererComponent_1 as DetailCellRendererComponent } from "./details/detail-cell-renderer-contact.component";  

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
    DetailCellRendererComponentBanck,
    DetailCellRendererComponentCuentas,
    DetailCellRendererTipoProveedorComponent
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

      if (this.idBranch && this.idCompany) {
        this.obtenerDatos();
        this.obtenerBranchs();
        this.getTypecop();
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

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }
  
  type: string = ''; // Para almacenar el tipo (CUSTOMERS o PROVIDERS)
  gridHeight: string = '90vh';
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

  private isProcessingMouseOver = false; // Bandera para evitar eventos MouseOver en cascada
  private lastExpandedNode: any = null;
  private collapseTimer: any = null; // MEJORA: Temporizador para el colapso del detalle
  rowData: any;
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  providersXTableData: { [key: number]: any[] } = {};  
  expandedProviders: Set<number> = new Set();

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
    enableRowGroup: true, // Enable row grouping for all columnsddsd
    // flex: 1, // Commented out to allow autosize to work properly
  };

  currentIndex = 0;

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'never';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'never';

  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent,
    detailCellRenderer: DetailCellRendererComponentContact,
    detailCellRendererBanck: DetailCellRendererComponentBanck,
    detailCellRendererCuentas: DetailCellRendererComponentCuentas,
    detailCellRendererTipoProveedor: DetailCellRendererTipoProveedorComponent
  };

  idClient = this.signalsService.getIdClient();
  nameClient = this.signalsService.getNameClient()();

  public gridOptions: any = {
  headerHeight: 25,
  rowHeight: 20,
  rowBuffer: 20,
  masterDetail: true,
  isRowMaster: (dataItem) => {
    return true; // Todas las filas de proveedores son maestras
  },
  detailCellRendererSelector: (params) => {
    // Decide qué renderizador usar basado en la propiedad 'detailType'
    if (params.data.detailType === 'contact') {
      return { component: 'detailCellRenderer' };
    } else if (params.data.detailType === 'bank') {
      return { component: 'detailCellRendererBanck' };
    } else if (params.data.detailType === 'Cuentas') {
      params.node.setRowHeight(700);
      return { component: 'detailCellRendererCuentas' };
    } else if (params.data.detailType === 'tipoProveedor') {
      params.node.setRowHeight(250);
      return { component: 'detailCellRendererTipoProveedor' };
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
    console.log('onFirstDataRendered - autosizing columns...');

    // Obtener todas las columnas
    const allColumnIds: string[] = [];
    params.api.getColumns()?.forEach((column: any) => {
      allColumnIds.push(column.getId());
    });

    console.log('Columns to autosize:', allColumnIds);

    // Autoajustar todas las columnas al contenido (considera header y datos)
    params.api.autoSizeColumns(allColumnIds, false);

    console.log('Autosize completed');
  },

};

  get colMaster(): ColDef[] {
    return [
      {
        field: 'id',
        headerName: 'ID',
        hide: true, // La ocultamos porque es para uso interno
        filter: 'agNumberColumnFilter',
      },
      {
        field: 'vigente',
        headerName: 'Activo',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('shoppingDelison', 'providers', 'update');
        },
      },

      {
        field: 'company',
        headerName: 'Compañía',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('shoppingDelison', 'providers', 'update');
        },
      },

      {
        field: 'nameContact',
        headerName: 'Contacto principal',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('shoppingDelison', 'providers', 'update');
        },
        filter: true,
        cellEditor: 'autocompleteEditor',
        /*cellRenderer: (params) => { 
          const div = document.createElement('div'); 
          div.innerText = params.value; 
          const rowData = params.data;
          div.addEventListener('mouseenter', () => { 
            console.log('Hover sobre celda:', params.value); 
            console.log('Datos completos de la fila:', rowData);
            const modal = new bootstrap.Modal(document.getElementById('bonus')!);
            modal.show();
          }); 
          div.addEventListener('mouseleave', () => { 
            console.log('Mouse fuera de celda:', params.value); 
            div.setAttribute('data-bs-dismiss', 'modal');
          }); 
          return div; 
        },*/
        cellEditorParams: {
          filterList: this.rowData?.map(e => e.nameContact
          ),
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

          const normalizedValue = rawValue.trim().toUpperCase();

          if (!normalizedValue) {
            alerts.basicAlert('Campo requerido', 'El nombre es obligatorio', 'error');
            return false;
          }

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
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('shoppingDelison', 'providers', 'update');
        },
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
        field: 'phone',
        headerName: 'Telefono principal',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('shoppingDelison', 'providers', 'update');
        },
      },

      {
        field: 'email',
        headerName: 'Email Principal',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('shoppingDelison', 'providers', 'update');
        },
      },

      {
        field: 'fieldContact',
        headerName: 'Contactos',
        cellRenderer: this.createDetailToggleCellRenderer('contact'),
        editable: false,
        cellStyle: { backgroundColor: '#d4edda' },
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
        headerName: 'Materiales',
        editable: false,
        cellStyle: { backgroundColor: '#d4edda' },
      },


      {
        field: 'cp',
        headerName: 'Cp',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('shoppingDelison', 'providers', 'update');
        },
      },
      {
        field: 'address',
        headerName: 'Dirección',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('shoppingDelison', 'providers', 'update');
        },
      },
      {
        field: 'city',
        headerName: 'Ciudad',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('shoppingDelison', 'providers', 'update');
        },
      },
      {
        field: 'state',
        headerName: 'Estado',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('shoppingDelison', 'providers', 'update');
        },
      },
      {
        field: '',
        headerName: 'Colonia',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('shoppingDelison', 'providers', 'update');
        },
      },
    ];
  }

  // Función auxiliar para obtener el tipo de detalle desde el ID de la columna
  getDetailTypeFromColId(colId: string): string | null {
    if (colId === 'fieldContact') return 'contact';
    if (colId === 'fieldBank') return 'bank';
    if (colId === 'fieldCuenta') return 'Cuentas';
    if (colId === 'typeProvider') return 'tipoProveedor';
    return null;
  }



createDetailToggleCellRenderer(detailType: string): (params: any) => HTMLElement {
  return (params: any): HTMLElement => {
    const div = document.createElement('div');
    //console.log(params.data.id)
    switch
      (detailType){
      case 'contact':
        div.innerText = params.data.fieldContact;
        break;
      case 'bank':
        div.innerText = params.data.fieldBank;
        break;
      case 'Cuentas':
        const isNumeric = params.data.fieldCuenta !== null && params.data.fieldCuenta !== '' && !isNaN(Number(params.data.fieldCuenta));
        const value = isNumeric ? this.currencyPipe.transform(params.data.fieldCuenta, '','symbol', '1.2-2') : '$0.00';
        div.innerText = value;
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
      console.log('idRoot no está disponible aún');
      return Promise.resolve(false);
    }

    this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Proveedores`, 'Menu Administracion Proveedores ',
          this.trackingService.getEmail() );

    return new Promise((resolve) => {
      this.materialsService
        .getProvidersxmaterials(this.idRoot)
        .subscribe({
          next: (data: any) => {
            if(this.authService.getCrudPermission('shoppingDelison', 'providers', 'read')){
            this.rowData = data;
            }
            console.log(this.rowData)
            console.log(data)
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
    this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Sucursales`, 'Menu Administracion Proveedores ',
          this.trackingService.getEmail() );

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

  onCellClicked(event: any): void {
  event.node.setSelected(true);
  console.log('Celda clickeada:', event);

  const colId = event.column.getColId();
  const isDetailColumn = colId === 'fieldContact' || colId === 'fieldBank' || colId === 'fieldCuenta' || colId === 'typeProvider';

  if (isDetailColumn) {
    const node = event.node;
    const api = event.api;
    const detailType = this.getDetailTypeFromColId(colId);

    // Determinar si la fila actual ya está expandida CON ESTE MISMO tipo de detalle
    const isCurrentlyExpanded = node.expanded && event.data.detailType === detailType;

    // Colapsar cualquier otra fila que esté expandida
    api.forEachNode(otherNode => {
      if (otherNode.expanded && otherNode.id !== node.id) {
        otherNode.setExpanded(false);
      }
    });

    if (isCurrentlyExpanded) { // Si se hace clic en la misma celda que ya está abierta...
      // ...se cierra y se limpia el filtro.
      node.setExpanded(false);
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

    // Configurar master-detail después de que el grid esté listo
    this.gridApi.setGridOption('detailCellRendererParams', {
      getDetailRowData: (params) => {
        params.successCallback(params.data.detailData);
      },
      context: { // Pasamos las funciones de CRUD a los componentes de detalle
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
        }
      }
    });


  }

  addRow() {
    this.trackingService.addLog(this.trackingService.getnameComp(), `Agregar Proveedores`, 'Menu Administracion Proveedores ',
          this.trackingService.getEmail() );

    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idBranch: this.idBranch,
      idRoot: this.idRoot,
      nameContact: '',
      company: '',
      position: '',
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
      idTypecop: 0,
      type: this.type,
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

    // Encontrar el índice de la nueva fila
    const newRowIndex = this.rowData.findIndex((row) => row.id === tempId);

    // Encontrar la primera columna editable
    const firstEditableCol = this.colMaster.find((col) => col.editable);
    const firstEditableColKey = firstEditableCol
      ? firstEditableCol.field
      : null;

    // Usar setTimeout para asegurar que el grid haya renderizado la nueva fila
    
    setTimeout(() => {
      const firstRowIndex = 0;

      this.gridApi.ensureIndexVisible(firstRowIndex);

      this.gridApi.startEditingCell({
        rowIndex: firstRowIndex,
        colKey: 'idBranch'
      });
    }, 0);// Un pequeño retraso de 50ms
  }

  async saveChanges() {

    this.trackingService.addLog(this.trackingService.getnameComp(), `Guardar Proveedores`, 'Menu Administracion Proveedores ',
          this.trackingService.getEmail() );

    const isValid = this.rowData.every(
      (item) => (item.nameContact || item.company) && 
        (this.type == 'PROVIDERS') || (this.type == 'CUSTOMERS' && item.idTypecop)
        
    );
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar todos los campos antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );


    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log('Datos a AGREGAR (incluyendo typework):', cleanedData);
      return this.customerService.addCustomer(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log('Datos a ACTUALIZAR (incluyendo typework):', cleanedData);
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

  async deleteEntry() {
    this.trackingService.addLog(this.trackingService.getnameComp(), `Eliminar Proveedores`, 'Menu Administracion Proveedores ',
          this.trackingService.getEmail() );
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

    // Validar que el préstamo sea 0 o no exista
    if (selectedData.total && selectedData.total !== 0) {
      alerts.basicAlert(
        'Error al eliminar',
        'No se puede eliminar mientras tenga notas activas',
        'error'
      );
      return;
    }

    // Validar que el proveedor no esté siendo usado en materiales
    try {
      const materialsData: any = await lastValueFrom(
        this.providersService.getProvidersXTable(selectedData.id, 'MATERIAL')
      );

      if (materialsData && materialsData.length > 0) {
        alerts.basicAlert(
          'No se puede eliminar',
          `Este proveedor está siendo utilizado en ${materialsData.length} material(es). No se puede eliminar.`,
          'error'
        );
        return;
      }
    } catch (error) {
      console.error('Error verificando uso del proveedor:', error);
      alerts.basicAlert(
        'Error',
        'Error al verificar si el proveedor está en uso.',
        'error'
      );
      return;
    }

    const id = selectedData.id;
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
        alerts.basicAlert(
          'Eliminar entrada',
          'Entrada eliminada satisfactoriamente.',
          'success'
        );
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
    delete cleanedData.typeProvider; // Solo para visualización, no va a BD
    delete cleanedData.tipoProveedorRows; // Solo para reconstruir grid, no va a BD
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
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
      if(this.gridApi) {
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
    console.log(`Saving details for provider ${providerId}, type: ${type}`, data);
    const newDetails = data.filter((row: any) => row.__isNew);
    const modifiedDetails = data.filter((row: any) => row.__modified && !row.__isNew);

    try {
      for (const row of newDetails) {
        this.customerService.updateFiel(row.idTabla, row.type, "SUMA").subscribe();
        await lastValueFrom(this.providersService.addProviderXTable(this.cleanDataForServer(row))); 
        this.obtenerDatos(); 
      }

      for (const row of modifiedDetails) {
        await lastValueFrom(this.providersService.updateProviderXTable(row.id, this.cleanDataForServer(row)));
      }

      if (newDetails.length > 0 || modifiedDetails.length > 0) {
        alerts.basicAlert(
          'Detalles guardados',
          'Se han guardado los detalles correctamente.',
          'success'
        );

        // No es necesario recargar aquí, el componente hijo lo hace.
        // Simplemente limpiamos los flags.
        data.forEach(row => {
          delete row.__isNew;
          delete row.__modified;
        })
      }

    } catch (error) {
      console.error('Error saving contacts:', error);
      alerts.basicAlert(
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

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.notSavedChanges);
  }
}
