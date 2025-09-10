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
  map 
} from 'rxjs';
import { AgGridModule } from 'ag-grid-angular';
import { ModalService } from 'app/services/modal.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { SignalsService } from 'app/services/signals.service';
import { ProvidersPaymentsComponent } from './providers-payments.component';
import { DetailCellRendererComponent } from './detail-cell-renderer.component';
import { DetailCellRendererComponentContact } from './details/detail-cell-renderer-contact.component';
import { DetailCellRendererComponentBanck } from './details/detail-cell-renderer-banck.component';
import { DetailCellRendererComponentCuentas } from './details/detail-cell-renderer-cuentas.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { RadiusinfluenceComponent } from 'app/domains/ModAdmon/components/radiusinfluence/radiusinfluence.component';
import { CustomersService } from 'app/services/customers.service';
import { ProvidersService } from 'app/services/providers.service';
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
//import { DetailCellRendererComponent_1 as DetailCellRendererComponent } from "./details/detail-cell-renderer-contact.component";  

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [
    RouterModule,
    DomainsModule,
    AgGridModule,
    MultiLineEditorComponent,
    ProvidersPaymentsComponent,
    DetailCellRendererComponent,
    DetailCellRendererComponentContact
],
  templateUrl: './providers.component.html',
  styleUrls: ['./providers.component.scss'],
})
export class ProvidersComponent implements CanComponentDeactivate {
  
  private trackingService = inject(TrackingService);
  private customerService = inject(CustomersService);
  private providersService = inject(ProvidersService);
  private modalServiceTable = inject(ModalService);
  private signalsService = inject(SignalsService);
  private modalService = inject(NgbModal);
  private route = inject(ActivatedRoute);
  private inegiService = inject(InegiService);
  private branchesService = inject(BranchsService);
  private authService = inject(AuthService);
  private catalogsService = inject(CatalogsService);


  private http = inject(HttpClient);
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  

  async ngOnInit() {
    this.obtenerDatos();
    this.signalsService.deleteClientData();
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    await this.getTypecop();
    this.route.data.subscribe((data) => {
      this.type = data['type']; // 'CUSTOMERS' o 'PROVIDERS'
      this.obtenerDatos(); // Llamar a la función para cargar datos
      this.getStates(); // Llamar a la función para obtener los estadosd
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
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      if (this.idBranch) {
        this.obtenerDatos();
        this.obtenerBranchs();
        this.getTypecop();
      }
    }, { allowSignalWrites: true });

    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.getTypecop();
  });

    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      if (this.idRoot) {
        this.obtenerDatos();
        this.obtenerBranchs();
        this.getTypecop();
      }
    }, { allowSignalWrites: true });
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
    flex: 1,
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
    detailCellRendererCuentas: DetailCellRendererComponentCuentas
  };

  idClient = this.signalsService.getIdClient();
  nameClient = this.signalsService.getNameClient()();

  public gridOptions: any = {
  headerHeight: 25,
  rowHeight: 20,
  suppressEnterWhenEditing: false,
  rowBuffer: 20,
  masterDetail: true,
  isRowMaster: (dataItem) => {
    return true; // Todas las filas de proveedores son maestras
  },
  detailCellRendererSelector: (params) => {
    // Decide qué renderizador usar basado en la propiedad 'detailType'
    if (params.data.detailType === 'contact') {
      return {
        component: 'detailCellRenderer',
        // MEJORA: Añadir listeners para controlar el colapso al entrar/salir del panel de detalle
        params: {
          onMouseEnter: () => clearTimeout(this.collapseTimer),
          onMouseLeave: () => {
            params.node.setExpanded(false);
          }
        }
      };
    } else if (params.data.detailType === 'bank') {
      return { component: 'detailCellRendererBanck' };
    }else if (params.data.detailType === 'Cuentas') {
      return { component: 'detailCellRendererCuentas' };
    }
    return undefined; // No mostrar detalle si no hay tipo
  },
  
  rowClass: (params) => {
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

  // ⭐ Nuevo evento: mostrar detalle al pasar el mouse por fieldContact
  /*onCellMouseOver: (event) => {
    if (event.column.getColId() === 'fieldContact') {
      event.node.setExpanded(true); // Expande la fila
    }
  },

  // (Opcional) colapsar cuando el mouse salga
  onCellMouseOut: (event) => {
    if (event.column.getColId() === 'fieldContact') {
      event.node.setExpanded(false); // Colapsa la fila
    }
  }*/
};


  get colMaster(): ColDef[] {
    return [
      {
        field: 'vigente',
        headerName: 'Activo',
        editable: true,
        width: 100,
      },
      
      {
        field: 'nameContact',
        headerName: 'Contacto principal',
        editable: true,
        filter: true,
        cellEditor: 'autocompleteEditor',
        width: 200,
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
        field: 'company',
        headerName: 'Compañía',
        editable: true,
        width: 100,
      },
      {
        field: 'fieldContact',
        headerName: 'Contactos',
        cellRenderer: this.createHoverCellRenderer('contact'),
        editable: false
      },
      {
        field: 'fieldBank',
        headerName: 'Bancos',
        editable: false,
        cellRenderer: this.createHoverCellRenderer('bank')
      },
      {
        field: 'fieldCuenta',
        headerName: 'Cuentas',
        cellRenderer: this.createHoverCellRenderer('Cuentas'),
        editable: false
      },
      {
        field: 'phone',
        headerName: 'Telefono principal',
        editable: true,
        width: 100,
      },
      {
        field: 'email',
        headerName: 'Correo principal',
        editable: true,
        width: 100,
      },
      {
        field: 'cp',
        headerName: 'Cp',
        editable: true,
        width: 100,
      },
      {
        field: 'address',
        headerName: 'Dirección',
        editable: true,
        width: 100,
      },
      {
        field: 'city',
        headerName: 'Estado',
        editable: true,
        width: 100,
      },
      {
        field: 'state',
        headerName: 'Ciudad',
        editable: true,
        width: 100,
      },
      {
        field: '',
        headerName: 'Colonia',
        editable: true,
        width: 100,
      },
    ];
  }

createHoverCellRenderer(detailType: string): (params: any) => HTMLElement {
  // Variables compartidas entre celdas
  let lastHoveredId: number | null = null;
  let hoverDelayTimer: ReturnType<typeof setTimeout> | null = null;
  let collapseTimer: ReturnType<typeof setTimeout> | null = null;

  return (params: any): HTMLElement => {
    const div = document.createElement('div');
    div.innerText = params.value;

    const rowData = params.data;
    const node = params.node;
    const api = params.api;

    let isExpanded = false;

    div.addEventListener('mouseenter', () => {
      // Cancelar temporizadores pendientes
      if (hoverDelayTimer) {
        clearTimeout(hoverDelayTimer);
        hoverDelayTimer = null;
      }

      if (collapseTimer) {
        clearTimeout(collapseTimer);
        collapseTimer = null;
      }

      // Iniciar temporizador para detectar hover prolongado
      hoverDelayTimer = setTimeout(() => {
        console.log('Hover sostenido sobre celda:', params.value);
        console.log('Fila ID:', rowData.id);

        const isSameRow = lastHoveredId === rowData.id;

        if (isSameRow) {
          // ✅ Si es la misma fila → colapsar
          node.setExpanded(false);
          lastHoveredId = null;
          isExpanded = false;
          console.log("Fila colapsada:", rowData.id);
        } else {
          // ✅ Si es una nueva fila → expandir
          rowData.detailType = detailType;
          rowData.tieneDetalle = true;

          api.forEachNode((n) => {
            if (n.id !== node.id) {
              n.setExpanded(false);
            }
          });

          node.setExpanded(true);
          lastHoveredId = rowData.id;
          isExpanded = true;
          console.log("Fila expandida:", rowData.id);
        }

        hoverDelayTimer = null;
      }, 500); // 1 segundo de hover requerido
    });

    div.addEventListener('mouseleave', () => {
      // Cancelar el hover retrasado si el mouse sale antes
      if (hoverDelayTimer) {
        clearTimeout(hoverDelayTimer);
        hoverDelayTimer = null;
      }

      // Si la fila está expandida, iniciar colapso con retardo
      if (lastHoveredId === rowData.id && isExpanded && !collapseTimer) {
        collapseTimer = setTimeout(() => {
          node.setExpanded(false);
          lastHoveredId = null;
          isExpanded = false;
          collapseTimer = null;
          console.log("Fila colapsada por mouseleave:", rowData.id);
        }, 300); // 300ms de retardo
      }
    });

    return div;
  };
}



  handleRowHover(event: any) {
    const node = event.node;

    // Si el mouse se mueve sobre el mismo nodo que ya está expandido, no hacemos nada.
    if (this.lastExpandedNode && this.lastExpandedNode.id === node.id) {
      return;
    }

    // Si hay un nodo previamente expandido, lo contraemos.
    if (this.lastExpandedNode) {
      this.lastExpandedNode.setExpanded(false);
    }

    // Expandimos el nodo actual y lo guardamos como el último expandido.
    node.setExpanded(true);
    this.lastExpandedNode = node;
  }

  collapseAllOnLeave() {
    if (this.lastExpandedNode) {
      this.lastExpandedNode.setExpanded(false);
      this.lastExpandedNode = null;
    }
  }
  

  obtenerDatos() {
    if (!this.idBranch) {
      console.log('idBranch no está disponible aún');
      return Promise.resolve(false);
    }

    this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Proveedores`, 'Menu Administracion Proveedores ',
          this.trackingService.getEmail() );

    return new Promise((resolve) => {
      this.customerService
        .getProviders(this.idCompany)
        .subscribe({
          next: (data: any) => {
            this.rowData = data;
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
      context: {
        CONTACT: {
          load: (providerId: number, type: string, callback: any) => {
            this.loadProviderXTableData(providerId, type, callback);
          },
          save: (providerId: number, data: any[], type: string) => {
            this.saveProviderDetailsById(providerId, data, type);
          },
          delete: (params: any, callback: any) => {
            this.deleteDetailRow(params);
            callback();
          }
        },
        BANK: {
          load: (providerId: number, type: string, callback: any) => {
            this.loadProviderXTableData(providerId, type, callback);
          },
          save: (providerId: number, data: any[], type: string) => {
            this.saveProviderDetailsById(providerId, data, type);
          },
          delete: (params: any, callback: any) => {
            this.deleteDetailRow(params);
            callback();
          }
        },
        CUENTA: {
          load: (providerId: number, type: string, callback: any) => {
            this.loadProviderXTableData(providerId, type, callback);
          },
          save: (providerId: number, data: any[], type: string) => {
            this.saveProviderDetailsById(providerId, data, type);
          },
          delete: (params: any, callback: any) => {
            this.deleteDetailRow(params);
            callback();
          }
        }
      }
    });


    // Expandir todas las filas por defecto después de cargar datos
    setTimeout(() => {
      this.gridApi.forEachNode((node) => {
        if (node.master) {
          node.setExpanded(true);
        }
      });
    }, 500);
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
      active: true,
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


  getDetailColumnDefs(): ColDef[] {
    return [
      {
        field: 'campo2',
        headerName: 'Nombre',
        editable: true,
        width: 200,
        valueSetter: (params) => {
          params.data[params.colDef.field] = params.newValue.toUpperCase();
          return true;
        }
      },
      {
        field: 'campo3',
        headerName: 'Puesto',
        editable: true,
        width: 150,
        valueSetter: (params) => {
          params.data[params.colDef.field] = params.newValue.toUpperCase();
          return true;
        }
      },
      {
        field: 'campo4',
        headerName: 'Teléfono',
        editable: true,
        width: 120,
        valueSetter: (params) => {
          const phoneValue = params.newValue;
          const isValidPhone = /^\d{10}$/.test(phoneValue);
          if (!isValidPhone) {
            alerts.basicAlert(
              'Teléfono inválido',
              'El teléfono debe contener exactamente 10 dígitos numéricos.',
              'error'
            );
            return false;
          }
          params.data[params.colDef.field] = phoneValue;
          return true;
        }
      },
      {
        field: 'campo5',
        headerName: 'Email',
        editable: true,
        width: 180,
        valueSetter: (params) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (params.newValue && !emailRegex.test(params.newValue)) {
            alerts.basicAlert(
              'Email inválido',
              'Correo electrónico no válido.',
              'error'
            );
            return false;
          }
          params.data[params.colDef.field] = params.newValue;
          return true;
        }
      },
      {
        field: 'active',
        headerName: 'Activo',
        editable: true,
        width: 80,
        cellEditor: 'agCheckboxCellEditor'
      },
      {
        headerName: 'Acciones',
        width: 100,
        cellRenderer: (params: any) => {
          const button = document.createElement('button');
          button.className = 'btn btn-sm btn-danger';
          button.innerHTML = '<i class="bi bi-trash"></i>';
          button.onclick = () => this.deleteDetailRow(params);
          return button;
        },
        editable: false
      }
    ];
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


  async deleteDetailRow(params: any) {
    const providerId = params.data.idTabla;
    const detailId = params.data.id;
    
    if (params.data.__isNew) {
      // Si es una fila nueva, solo removerla del array local
      this.providersXTableData[providerId] = this.providersXTableData[providerId]?.filter(
        item => item.id !== detailId
      ) || [];
      params.api.applyTransaction({ remove: [params.data] });
      this.notSavedChanges = true;
    } else {
      // Si es una fila existente, eliminarla del servidor
      try {
        await lastValueFrom(this.providersService.deleteProviderXTable(detailId));
        alerts.basicAlert('Contacto eliminado', 'El contacto se eliminó correctamente.', 'success');
        
        // Recargar los datos del detalle
        this.loadProviderXTableData(providerId, params.data.type, (data) => {
          this.providersXTableData[providerId] = data; // Esto puede que no sea necesario si el grid se refresca solo
          params.api.applyTransaction({ remove: [params.data] });
        });
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
        await lastValueFrom(this.providersService.addProviderXTable(this.cleanDataForServer(row)));
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

        // Recargar datos del proveedor específico
        this.loadProviderXTableData(providerId, type, (refreshedData) => {
          this.providersXTableData[providerId] = refreshedData;
        });
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
