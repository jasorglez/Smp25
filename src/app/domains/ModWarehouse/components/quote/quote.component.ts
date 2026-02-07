import { Component, effect, HostListener, inject } from '@angular/core';
import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { CatalogsService } from 'app/services/catalogs.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { CustomersService } from 'app/services/customers.service';
import { DepartmentsService } from 'app/services/departments.service';
import { CurrencyService } from 'app/services/currency.service';
import { SignalsService } from 'app/services/signals.service';
import { ModalService } from 'app/services/modal.service';
import { ReceiptsService } from 'app/services/receipts.service';
import { UsersService } from 'app/services/users.service';
import { MaterialsService } from 'app/services/materials.service';
import { SetupService } from 'app/services/setup.service';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { ProviderDetailCellRendererComponent } from './provider-detail-cell-renderer.component';
import { ProviderQuoteDetailComponent } from './provider-quote-detail.component';

interface Catalog {
  id: number;
  description: string;
}

interface Provider {
  id: number;
  name: string;
}

@Component({
  selector: 'app-quote',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, MultiLineEditorComponent, ProviderDetailCellRendererComponent, ProviderQuoteDetailComponent],
  templateUrl: './quote.component.html',
  styleUrl: './quote.component.scss'
})
export class QuoteComponent implements CanComponentDeactivate {
  // Inject of new way for Angular 18
private quotesService = inject(OcAndReqsService);
  private customersService = inject(CustomersService);
  private catalogsService = inject(CatalogsService);
  private departmentsService = inject(DepartmentsService);
  private currencyService = inject(CurrencyService);
  private signalsService = inject(SignalsService);
  private modalServiceTable = inject(ModalService);
  private receiptsService = inject(ReceiptsService);
  private usersService = inject(UsersService);
  private materialsService = inject(MaterialsService);
  private setupService = inject(SetupService);

  // Variables compartidas
  masterNotSavedChanges: boolean = false;
  id: string = null;
  idBranch: number = null;
  idProject: number = null;
  idReference: number = null;
  private tempIdCounter: number = 0;
  idQuote: number | string = null;
private lastProcessedQuote: number = null;
  private masterGridApi: GridApi;
  idRoot: number = null;
  projectOrBranch: boolean = null; // True = Project, False = Branch
  typeReference: string = null; // project or branch

  // Variables Master
  masterRowData: any[] = [];
  masterSelectedRowData: any = null;
  newlyAddedMasterRows: string[] = [];

  // COTIZ tracking - each slot maps to a COTIZ record
  cotizSlots: { cotizId: number | null; idProvider: number | null; providerName: string }[] = [
    { cotizId: null, idProvider: null, providerName: '' },
    { cotizId: null, idProvider: null, providerName: '' },
    { cotizId: null, idProvider: null, providerName: '' }
  ];

  // Modal de selección de proveedor
  showProviderModal: boolean = false;
  selectedProviderSlot: number = 0; // 1, 2, or 3
  selectedProviderId: number = null;

<<<<<<< HEAD
=======
  // Track expanded provider detail
  expandedRowId: any = null;
  expandedProviderNumber: number | null = null;
>>>>>>> ea50633dee190ce669eecad028e214c96b87790d

  // Catálogos Master
  proveedores: any[] = [];
  departamentos: any[] = [];
  ubicaciones: any[] = [];
  monedas: any[] = [];
  usuarios: any[] = [];
  tipoPago: any[] = [];

  // Catálogos para productos (para las cascadas)
  productos: any[] = [];

  // Catálogos para requisiciones
  requisiciones: any[] = [];

  // Items from the selected requisition for the cascades
  requisitionItems: any[] = [];
  private pendingCotizLoad: boolean = false;

  // Configuración Grid
  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  
  // Caché para columnas del maestro (evita parpadeo)
  private _colMaster: ColDef[] = [];

  constructor() {
    effect(() => {
      const currentRoot = this.signalsService.getRootSelectedBySidebar()();
      const currentProject = this.signalsService.getProjectSelectedBySidebar()();
      const currentBranch = this.signalsService.getBranchSelectedBySidebar()();
      const currentQuote = this.signalsService.getIdRequisition()();

      console.log('Quote component signals:', { currentRoot, currentProject, currentBranch, currentQuote });

      // Si cambió el root, limpiar datos
      if (this.idRoot !== currentRoot) {
        this.clearAllData();
      }

      // Detectar si solo cambió la cotización seleccionada (no root, project o branch)
      const rootChanged = this.idRoot !== currentRoot;
      const projectChanged = this.idProject !== currentProject;
      const branchChanged = this.idBranch !== currentBranch;
      const requisitionChanged = this.lastProcessedQuote !== currentQuote;

      // Solo considerar que cambió la cotización si había una anteriormente o si ahora hay una
      const onlyQuoteChanged = !rootChanged && !projectChanged && !branchChanged &&
                                    requisitionChanged &&
                                    (this.lastProcessedQuote !== null || currentQuote !== null);

      this.idRoot = currentRoot;
      this.idProject = currentProject;
      this.idBranch = currentBranch;
      this.idQuote = currentQuote;

      // Actualizar el estado procesado después de la lógica
      this.lastProcessedQuote = currentQuote;

      if (this.idRoot) {
        this.getSetupData().then(() => {
          this.idReference = this.projectOrBranch ? this.idProject : this.idBranch;

          // Solo cargar datos si tenemos la referencia apropiada Y no es solo cambio de cotización
          if (this.idReference && !onlyQuoteChanged) {
            this.obtenerDepartamentos();
            this.obtenerDatos();
            this.obtenerUbicaciones();
            this.obtenerMonedas();
            this.obtenerUsuarios();
            this.obtenerProveedores();
            this.obtenerTipoPago();
            this.obtenerProductos();
            this.obtenerRequisiciones();
          }
        });

        // Update grid context with new idRoot
        if (this.masterGridApi) {
          this.masterGridApi.setGridOption('context', {
            productos: this.productos,
            quoteDetails: [],
            idRoot: this.idRoot,
          });
          console.log('Updated grid context with idRoot:', this.idRoot);
        }
      }
    });
  }

  ngOnInit() {
    // El effect() del constructor ya maneja toda la carga de datos
    // Solo necesitamos inicializar algunos servicios básicos aquí
    this.signalsService.deleteRequisitionData();
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.masterNotSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  nameQuote = this.signalsService.getRequisitionName();

  get isQuoteSaved(): boolean {
    return this.idQuote != null && typeof this.idQuote === 'number';
  }

  getQuoteId(): number {
    return typeof this.idQuote === 'number' ? this.idQuote : 0;
  }

  // Column Definitions: Defines the columns to be displayed.
public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 35,
    masterDetail: true,
    detailRowHeight: 800,
    isRowMaster: (dataItem: any) => true,
    detailCellRenderer: ProviderDetailCellRendererComponent,
    getRowClass: (params) => {
      // Verificar si la fila está seleccionada
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      // Verificar si está bloqueada (convertida a OC)
      if (params.data?.locked === true) {
        return 'locked-row';
      }
      return '';
    },
    onRowClicked: (event) => {
      // Seleccionar la fila al hacer clic en cualquier celda
      event.node.setSelected(true);
    },
    onRowSelected: (event) => {
      // Corregir usando el api del evento y verificando existencia
      if (event.node.isSelected() && event.api) {
        event.api.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
  };

  get colMaster(): ColDef[] {
    // Si ya tenemos columnas cacheadas, devolverlas para evitar re-renderizado
    if (this._colMaster.length > 0) {
      return this._colMaster;
    }
    
    // Construir y cachear las columnas solo la primera vez
    this._colMaster = [
{
  field: 'folio',
  headerName: 'Número Doc',
  editable: (params) => !params.data?.locked,
  filter: true,
  width: 150,
},
      {
        field: 'dateCreate',
        headerName: 'Fecha Cotizacion',
        editable: (params) => !params.data?.locked,
        width: 150,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        },
      },

      {
        field: 'idDepartament',
        headerName: 'Departamento Solicita',
        editable: (params) => !params.data?.locked,
        width: 190,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: this.departamentos.map((item) => item.id),
        }),
        valueFormatter: (params) => {
          const foundItem = this.departamentos.find((item) => item.id === params.value);
          return foundItem ? `${foundItem.description}` : params.value;
        },
      },
      {
        field: 'solicit',
        headerName: 'Solicitante',
        editable: (params) => !params.data?.locked,
        width: 190,
      },
{
  field: 'idReq',
  headerName: 'Requisición',
  editable: (params) => !params.data?.locked,
  width: 180,
  cellEditor: 'agSelectCellEditor',
  cellEditorParams: () => ({
    values: this.requisiciones.map((item) => item.id),
  }),
  valueFormatter: (params) => {
    const foundItem = this.requisiciones.find((item) => item.id === params.value);
    return foundItem ? `${foundItem.folio}` : (params.value || '');
  },
  onCellValueChanged: (params) => {
    this.onRequisitionChanged(params);
  }
},
{
  field: 'pedimento',
  headerName: 'Pedimento #',
  editable: false,
  width: 120,
  filter: true,
  valueFormatter: (params) => {
    return params.value ? `#${params.value}` : '';
  }
},

{
  field: 'proveedor1',
  headerName: 'Proveedor 1',
  width: 150,
  cellRenderer: (params: any) => {
    // Get provider info from the row data itself, not global slots
    const providerName = params.data.proveedor1Name || '';
    const count = params.data.proveedor1Count || 0;
    const hasProvider = params.data.proveedor1Id > 0;
    const label = providerName ? `${providerName} (${count})` : `${count} items`;
    const btnClass = hasProvider ? 'btn-primary' : 'btn-outline-primary';
    return `<div class="provider-cell" style="text-align: center; padding: 5px; cursor: pointer;">
              <div class="btn btn-sm ${btnClass}" style="pointer-events: none;">${label}</div>
            </div>`;
  },
  editable: false,
  onCellClicked: (params: any) => {
    console.log('Clicked Proveedor 1:', params.data);
    this.openProviderQuote(params.data, 1);
  }
},
{
  field: 'proveedor2',
  headerName: 'Proveedor 2',
  width: 150,
  cellRenderer: (params: any) => {
    // Get provider info from the row data itself, not global slots
    const providerName = params.data.proveedor2Name || '';
    const count = params.data.proveedor2Count || 0;
    const hasProvider = params.data.proveedor2Id > 0;
    const label = providerName ? `${providerName} (${count})` : `${count} items`;
    const btnClass = hasProvider ? 'btn-success' : 'btn-outline-success';
    return `<div class="provider-cell" style="text-align: center; padding: 5px; cursor: pointer;">
              <div class="btn btn-sm ${btnClass}" style="pointer-events: none;">${label}</div>
            </div>`;
  },
  editable: false,
  onCellClicked: (params: any) => {
    console.log('Clicked Proveedor 2:', params.data);
    this.openProviderQuote(params.data, 2);
  }
},
{
  field: 'proveedor3',
  headerName: 'Proveedor 3',
  width: 150,
  cellRenderer: (params: any) => {
    // Get provider info from the row data itself, not global slots
    const providerName = params.data.proveedor3Name || '';
    const count = params.data.proveedor3Count || 0;
    const hasProvider = params.data.proveedor3Id > 0;
    const label = providerName ? `${providerName} (${count})` : `${count} items`;
    const btnClass = hasProvider ? 'btn-warning' : 'btn-outline-warning';
    return `<div class="provider-cell" style="text-align: center; padding: 5px; cursor: pointer;">
              <div class="btn btn-sm ${btnClass}" style="pointer-events: none;">${label}</div>
            </div>`;
  },
  editable: false,
  onCellClicked: (params: any) => {
    console.log('Clicked Proveedor 3:', params.data);
    this.openProviderQuote(params.data, 3);
  }
},

{
 field: 'comments',
 headerName: 'Comentario',
 editable: false,
 width: 150,
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
  },
     ];
    
    return this._colMaster;
  }

  // Column Definitions: Defines the columns to be displayed.
  get colDetails(): ColDef[] {
    return [
      {
        field: 'requisitionItemId',
        headerName: 'Material Requisición',
        editable: true,
        flex: 3,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.requisitionItems ? this.requisitionItems.map((item) => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.requisitionItems
            ? this.requisitionItems.find((item) => item.id === params.value)
            : null;
          if (foundItem) {
            const product = this.productos.find((p: any) => p.id === foundItem.idSupplie);
            return product ? `${product.description} (Cant: ${foundItem.quantity})` : `Material ${foundItem.idSupplie}`;
          }
          return params.value;
        },
        onCellValueChanged: (params) => {
          this.onRequisitionItemChanged(params);
        }
      },
      {
        field: 'quantity',
        headerName: 'Cantidad a Cotizar',
        editable: true,
        filter: true,
        flex: 1,
      },
      {
        field: 'price',
        headerName: 'Precio',
        editable: true,
        filter: true,
        flex: 1,
        valueFormatter: (params) => {
          return params.value ? `$${params.value.toFixed(2)}` : '$0.00';
        },
      },
      {
        field: 'comment',
        headerName: 'Comentarios',
        editable: true,
        filter: true,
        flex: 2,
      },
    ];
  }

  // ==================== MASTER METHODS ====================

  obtenerDatos() {
    this.quotesService
      .getOcAndReqs(this.typeReference, this.idReference, 'QUOTE')
      .subscribe(
        (data: any) => {
          this.masterRowData = data;
          console.log(this.typeReference, this.idReference, this.masterRowData);
          // Load provider COTIZ info once proveedores are available
          this.pendingCotizLoad = true;
          if (this.proveedores.length > 0) {
            this.loadAllCotizInfo();
            this.pendingCotizLoad = false;
          }
        },
        (error) => console.error('Error fetching data:', error)
      );
  }

obtenerProveedores() {
    this.customersService.getCustomersByCompany(this.idRoot, 'PROVIDERS').subscribe(
      (data: any) => {
        this.proveedores = data;
        console.log('Proveedores cargados:', this.proveedores.length);
        // If master data was already loaded, now load COTIZ info
        if (this.pendingCotizLoad && this.masterRowData.length > 0) {
          this.loadAllCotizInfo();
          this.pendingCotizLoad = false;
        }
      },
      (error) => console.error('Error fetching providers:', error)
    );
  }

  obtenerUsuarios() {
    this.usersService.getDataUsers(this.idRoot).subscribe(
      (response: any) => {
        this.usuarios = response.data;
      },
      (error) => console.error('Error fetching users:', error)
    );
  }

  obtenerDepartamentos() {
    this.departmentsService.getDepartments(this.idRoot).subscribe(
      (data: Catalog[]) => {
        this.departamentos = data;
        console.log(this.departamentos);
      },
      (error) => console.error('Error fetching departments:', error)
    );
  }

  obtenerUbicaciones() {
    this.catalogsService.getLocations().subscribe(
      (data: Catalog[]) => {
        this.ubicaciones = data;
      },
      (error) => console.error('Error fetching locations:', error)
    );
  }

  obtenerMonedas() {
    this.currencyService.getCurrencies(this.idRoot).subscribe(
      (data: Catalog[]) => {
        this.monedas = data;
        console.log('Monedas', this.monedas);
      },
      (error) => console.error('Error fetching currencies:', error)
    );
  }

  obtenerTipoPago() {
    this.currencyService.getPaymentTypes(this.idRoot).subscribe(
      (data: Catalog[]) => {
        this.tipoPago = data;
      },
      (error) => console.error('Error fetching payment types:', error)
    );
  }

  obtenerProductos() {
    this.materialsService.getMaterials2Fields(this.idRoot).subscribe(
      (data: Catalog[]) => {
        this.productos = data;
      },
      (error) => console.error('Error fetching materials:', error)
    );
  }

  obtenerRequisiciones() {
    this.quotesService
      .getOcAndReqs(this.typeReference, this.idReference, 'REQUIS')
      .subscribe(
        (data: any) => {
          this.requisiciones = data;
          console.log('Requisiciones loaded:', this.requisiciones);
        },
        (error) => console.error('Error fetching requisitions:', error)
      );
  }

  onMasterSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      // Crear una copia profunda del dato seleccionado
      this.masterSelectedRowData = { ...selectedNodes[0].data };
      this.masterNotSavedChanges = false;

      // Set idQuote for cascades
      this.idQuote = this.masterSelectedRowData.id;

      // Load requisition items for the combo box if requisition is selected
      if (this.masterSelectedRowData.idReq) {
        this.quotesService.getReqItems(this.masterSelectedRowData.idReq).subscribe({
          next: (items: any[]) => {
            this.requisitionItems = items;
            console.log('Requisition items loaded for combo box:', this.requisitionItems);
            // Update grid context with new items
            this.updateGridContext();
            // Initialize cascades with requisition items
            this.initializeProviderCascades();
          },
          error: (error) => {
            console.error('Error loading requisition items:', error);
            this.requisitionItems = [];
            this.updateGridContext();
          }
        });

        // Load existing COTIZs for this REQUIS
        this.loadExistingCotiz(this.masterSelectedRowData.idReq);
      } else {
        this.requisitionItems = [];
        this.resetCotizSlots();
        // Initialize empty cascades
        this.initializeProviderCascades();
      }

      // Solo actualizar las señales si no es una fila nueva
      if (!this.newlyAddedMasterRows.includes(this.masterSelectedRowData.id)) {
        this.signalsService.setIdRequisition(this.masterSelectedRowData.id);
        this.signalsService.setRequisitionName(
          this.masterSelectedRowData.folio
        );
        this.signalsService.setRequisitionSolicitant(
          this.masterSelectedRowData.solicit
        );
        this.signalsService.setRequisitionDate(
          this.masterSelectedRowData.dateCreate
        );
      }
    } else {
      this.masterSelectedRowData = null;
      this.idQuote = null;
      this.requisitionItems = [];
    }
  }

  initializeProviderCascades() {
    if (this.masterSelectedRowData && this.requisitionItems.length > 0) {
      // Initialize provider cascades with the requisition items
      const cascadeData = this.requisitionItems.map((item: any, index: number) => {
        const product = this.productos.find((p: any) => p.id === item.idSupplie);
        return {
          id: `temp_${this.tempIdCounter++}_${index}`,
          idQuoteItem: item.id,
          productName: product ? product.description : `Producto ${item.idSupplie}`,
          quantity: item.quantity,
          price: 0,
          comment: item.comment || '',
          idSupplie: item.idSupplie,
          dateuse: item.dateuse,
          __isNew: true
        };
      });

      this.masterSelectedRowData.proveedor1Data = [...cascadeData];
      this.masterSelectedRowData.proveedor2Data = [...cascadeData];
      this.masterSelectedRowData.proveedor3Data = [...cascadeData];

      this.masterSelectedRowData.proveedor1Count = cascadeData.length;
      this.masterSelectedRowData.proveedor2Count = cascadeData.length;
      this.masterSelectedRowData.proveedor3Count = cascadeData.length;

      // Update grid context with latest data
      if (this.masterGridApi) {
        this.masterGridApi.setGridOption('context', {
          productos: this.productos,
          quoteDetails: cascadeData,
          idRoot: this.idRoot,
        });

        // Refresh the grid to show updated counts
        this.masterGridApi.refreshCells({
          columns: ['proveedor1', 'proveedor2', 'proveedor3'],
          force: true
        });
      }

      console.log('Provider cascades initialized with', cascadeData.length, 'items');
    } else if (this.masterSelectedRowData) {
      // Initialize empty cascades
      this.masterSelectedRowData.proveedor1Data = [];
      this.masterSelectedRowData.proveedor2Data = [];
      this.masterSelectedRowData.proveedor3Data = [];

      this.masterSelectedRowData.proveedor1Count = 0;
      this.masterSelectedRowData.proveedor2Count = 0;
      this.masterSelectedRowData.proveedor3Count = 0;

      if (this.masterGridApi) {
        this.masterGridApi.refreshCells({
          columns: ['proveedor1', 'proveedor2', 'proveedor3'],
          force: true
        });
      }
    }
  }

  onMasterCellValueChanged(event: any) {
    const updatedData = { ...event.data };

    // Preservar el estado temporal y la selección
    if (this.newlyAddedMasterRows.includes(updatedData.id)) {
      updatedData.__isNew = true;
    }

    updatedData.__modified = true;
    this.masterNotSavedChanges = true;

    // Actualizar el array de datos
    this.masterRowData = this.masterRowData.map((row) =>
      row.id === updatedData.id ? updatedData : row
    );

    // Actualizar la fila en la cuadrícula
    const rowNode = this.masterGridApi.getRowNode(updatedData.id);
    if (rowNode) {
      rowNode.setData(updatedData);
      // Mantener la selección si es necesario
      if (
        this.masterSelectedRowData &&
        this.masterSelectedRowData.id === updatedData.id
      ) {
        rowNode.setSelected(true);
      }
    }
  }

  onMasterGridReady(params: GridReadyEvent) {
    this.masterGridApi = params.api;

    // Set initial context for detail cell renderer
    this.updateGridContext();

    console.log('Master grid ready, idRoot:', this.idRoot);
  }

  updateGridContext() {
    if (this.masterGridApi) {
      this.masterGridApi.setGridOption('context', {
        productos: this.productos,
        quoteDetails: this.requisitionItems,
        idRoot: this.idRoot,
      });
    }
  }

  onMasterRowSelected(event: any) {
    this.id = event.data.id;
  }

  onRequisitionChanged(params: any) {
    const requisitionId = params.newValue;
    const rowData = params.data;

    // Update the idReq field
    rowData.idReq = requisitionId;

    // Load requisition items for the combo box
    if (requisitionId) {
      this.quotesService.getReqItems(requisitionId).subscribe({
        next: (items: any[]) => {
          this.requisitionItems = items;
          console.log('Requisition items loaded for combo:', this.requisitionItems);
        },
        error: (error) => {
          console.error('Error loading requisition items:', error);
          this.requisitionItems = [];
        }
      });
    } else {
      this.requisitionItems = [];
    }

    // Clear provider data when requisition changes
    rowData.proveedor1Data = [];
    rowData.proveedor2Data = [];
    rowData.proveedor3Data = [];
    rowData.proveedor1Count = 0;
    rowData.proveedor2Count = 0;
    rowData.proveedor3Count = 0;

    rowData.__modified = true;
    this.masterNotSavedChanges = true;

    if (this.masterGridApi) {
      this.masterGridApi.refreshCells({
        rowNodes: [params.node],
        columns: ['proveedor1', 'proveedor2', 'proveedor3'],
        force: true
      });
    }

    console.log('Requisition changed to:', requisitionId);
  }

  onRequisitionItemChanged(params: any) {
    const requisitionItemId = params.newValue;
    const rowData = params.data;

    if (requisitionItemId) {
      const selectedItem = this.requisitionItems.find(item => item.id === requisitionItemId);
      if (selectedItem) {
        // Auto-fill quantity from requisition
        rowData.quantity = selectedItem.quantity;
        rowData.idSupplie = selectedItem.idSupplie;
        rowData.dateuse = selectedItem.dateuse;
        rowData.comment = selectedItem.comment || '';
      }
    }

    rowData.__modified = true;
    this.masterNotSavedChanges = true;
  }

  addMasterRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      folio: '',
      typeReference: this.typeReference,
      idReference: this.idReference,
      dateCreate: new Date().toISOString(),
      idProveedor: 0,
      idDepartament: 0,
      delivery: 'A',
      deliveryTime: 'NA',
      dateSupply: '',
      idPayment: 0,
      idCurrency: 0,
      conditions: '',
      IdAuthorize: 0,
      priority: '',
      solicit: this.signalsService.getDisplayName()(),
      type: 'QUOTE',
      comments: '',
      typeOc: 'INSUMOS',
      active: true,
      idReq: null,
      proveedor1Count: 0,
      proveedor2Count: 0,
      proveedor3Count: 0,
      proveedor1Data: [],
      proveedor2Data: [],
      proveedor3Data: [],
      __isNew: true,
    };

    // Actualizar el estado
    this.masterRowData = [newItem, ...this.masterRowData];
    this.newlyAddedMasterRows.push(tempId);
    this.masterNotSavedChanges = true;

    // Set as selected
    this.masterSelectedRowData = newItem;
    this.idQuote = tempId;

    // Update grid with all records
    if (this.masterGridApi) {
      this.masterGridApi.setGridOption('rowData', this.masterRowData);
      // Select the new row
      setTimeout(() => {
        const rowNode = this.masterGridApi.getRowNode(tempId);
        if (rowNode) {
          rowNode.setSelected(true);
        }
      }, 100);
    }

    // Initialize empty cascades for new record
    this.requisitionItems = [];
    this.initializeProviderCascades();
  }

  async saveMasterChanges() {
    const isValid = this.masterRowData.every((item) => item.folio);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar todos los campos antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.masterRowData.filter((row) => row.__isNew);
    const modifiedRows = this.masterRowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log('Quote - Datos para agregar:', cleanedData);
      return this.quotesService.addOcAndReq(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log('Quote - Datos para actualizar (ID:', row.id, '):', cleanedData);
      return this.quotesService.updateOcAndReq(row.id, cleanedData);
    });

    // Using concat to combine observables and lastValueFrom for async/await
    try {
      await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );

      // Lock requisitions that are assigned to saved QUOTEs
      // Get all rows that have a requisition associated
      const allRowsWithReq = [...newRows, ...modifiedRows].filter(row => row.idReq);

      for (const row of allRowsWithReq) {
        try {
          // Use the new PATCH endpoint to lock the requisition
          await lastValueFrom(this.quotesService.lockRequisition(row.idReq, true));
          console.log('Requisition locked:', row.idReq);
        } catch (err) {
          console.error('Error locking requisition:', row.idReq, err);
        }
      }

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.masterNotSavedChanges = false;
      this.newlyAddedMasterRows = [];
      this.obtenerDatos(); // Refrescar los datos

      // If we just saved a new quote, update idQuote
      if (this.masterSelectedRowData && this.masterSelectedRowData.id) {
        this.idQuote = this.masterSelectedRowData.id;
      }
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  deleteMasterEntry() {
    const selectedNodes = this.masterGridApi.getSelectedNodes();
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
    this.quotesService
      .deleteOcAndReq(id)
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

        alerts.basicAlert(
          'Eliminar entrada',
          'Entrada eliminada satisfactoriamente.',
          'success'
        );
        this.masterNotSavedChanges = false;
        this.masterSelectedRowData = null;
      });
  }

  revertMasterData() {
    this.obtenerDatos();
    this.masterNotSavedChanges = false;
  }

createQuote(idQuote: number, action: string) {
    this.receiptsService.generateOC(idQuote, action);
  }


  // Método para invalidar la caché de columnas (útil cuando cambian catálogos)
  refreshColumnCache(): void {
    this._colMaster = [];
    
    // Forzar actualización del grid si ya está inicializado
    if (this.masterGridApi) {
      this.masterGridApi.setGridOption('columnDefs', this.colMaster);
    }
  }

// Método para abrir cotización de proveedor específico
  openProviderQuote(quoteData: any, providerNumber: number): void {
    console.log('Provider quote - Data:', { quoteData, providerNumber });

    // Validar que haya idReq
    if (!quoteData.idReq) {
      alerts.basicAlert('Sin Requisición', 'Debe asignar una requisición antes de cotizar con proveedores.', 'warning');
      return;
    }

    // Validar que la fila QUOTE esté guardada (no temporal)
    if (quoteData.id && quoteData.id.toString().startsWith('temp_')) {
      alerts.basicAlert('Guardar primero', 'Debe guardar la cotización antes de asignar proveedores.', 'warning');
      return;
    }

    // Check if clicking same provider on same row - toggle close
    if (this.expandedRowId === quoteData.id && this.expandedProviderNumber === providerNumber) {
      console.log('Same provider clicked, collapsing detail');
      this.collapseProviderDetail(quoteData);
      return;
    }

    // Get provider data from row data (not global slots)
    const providerId = quoteData[`proveedor${providerNumber}Id`] || 0;
    const providerName = quoteData[`proveedor${providerNumber}Name`] || '';
    const cotizId = quoteData[`proveedor${providerNumber}CotizId`] || null;

    console.log('Provider data from row:', {
      providerId,
      providerName,
      cotizId,
      providerCount: quoteData[`proveedor${providerNumber}Count`],
      'All provider fields': {
        [`proveedor${providerNumber}Id`]: quoteData[`proveedor${providerNumber}Id`],
        [`proveedor${providerNumber}Name`]: quoteData[`proveedor${providerNumber}Name`],
        [`proveedor${providerNumber}CotizId`]: quoteData[`proveedor${providerNumber}CotizId`],
        [`proveedor${providerNumber}Count`]: quoteData[`proveedor${providerNumber}Count`]
      }
    });

    // SI YA HAY COTIZACIÓN CREADA (cotizId y providerId), abrir directamente el detail
    if (cotizId && providerId > 0) {
      console.log('Opening provider detail for EXISTING COTIZ with', quoteData[`proveedor${providerNumber}Count`] || 0, 'items');
      this.openProviderDetail(quoteData, providerNumber, cotizId, providerId);
      return;
    }

    // Si no hay cotización creada, abrir modal de selección para crearla
    console.log('No existing COTIZ found, opening provider selection modal to create new one');
    this.selectedProviderSlot = providerNumber;
    this.selectedProviderId = null;
    this.showProviderModal = true;
  }

// Confirmar selección de proveedor desde el modal
  async confirmProviderSelection(): Promise<void> {
    if (!this.selectedProviderId) {
      alerts.basicAlert('Selección requerida', 'Debe seleccionar un proveedor.', 'warning');
      return;
    }

// Verificar que no esté ya en otro slot (solo para nuevas cotizaciones)
    const alreadyUsed = this.cotizSlots.find(s => s.idProvider === this.selectedProviderId);
    if (alreadyUsed && alreadyUsed.cotizId) {
      alerts.basicAlert('Proveedor duplicado', 'Este proveedor ya está asignado en otro slot.', 'warning');
      return;
    }

    this.showProviderModal = false;
    const providerNumber = this.selectedProviderSlot;
    const slotIndex = providerNumber - 1;
    const quoteData = this.masterSelectedRowData;
    const idProvider = this.selectedProviderId;

    // Get provider name
    const provider = this.proveedores.find((p: any) => p.id === idProvider);
    const providerName = provider ? provider.name : `Proveedor ${idProvider}`;

    // Get REQUIS data to copy fields
    const requis = this.requisiciones.find((r: any) => r.id === quoteData.idReq);

    try {
      // Create COTIZ record
      const cotizData: any = {
        type: 'COTIZ',
        folio: `COTIZ-${quoteData.folio}-P${providerNumber}`,
        typeReference: this.typeReference,
        idReference: this.idReference,
        idReq: quoteData.idReq,
        idProvider: idProvider,
        dateCreate: new Date().toISOString(),
        dateSupply: new Date().toISOString(),
        idDepartament: quoteData.idDepartament || (requis ? requis.idDepartament : 0),
        solicit: quoteData.solicit || (requis ? requis.solicit : ''),
        delivery: quoteData.delivery || 'A',
        deliveryTime: quoteData.deliveryTime || '',
        typeOc: 'INSUMOS',
        idPayment: 0,
        idCurrency: 0,
        idAuthorize: 0,
        active: true
      };

      console.log('Creating COTIZ:', cotizData);
      const cotizResponse: any = await lastValueFrom(this.quotesService.addOcAndReq(cotizData));
      const cotizId = cotizResponse.id;
      console.log('COTIZ created with ID:', cotizId);

      // Copy items from REQUIS to COTIZ
      const reqItems: any[] = await lastValueFrom(this.quotesService.getReqItems(quoteData.idReq));
      for (const item of reqItems) {
        const detailData: any = {
          idMovement: cotizId,
          idSupplie: item.idSupplie || 0,
          idProvider: idProvider,
          nameProvider: providerName,
          quantity: item.quantity || 0,
          price: 0,
          dateuse: item.dateuse,
          type: 'COTIZ',
          recurrent: item.recurrent || 'Recurrente',
          nameArticle: item.nameArticle || item.namearticle || '',
          numArticle: item.numArticle || item.numarticle || '',
          intorext: item.intorext || 'Interno',
          provInt: item.provInt || item.provint || 'Sin Proveedor',
          typePriority: item.typePriority || item.typepriority || 'Normal',
          comment: item.comment || '',
          active: true
        };
        await lastValueFrom(this.quotesService.addReqItem(detailData));
      }

      // Update slot
      this.cotizSlots[slotIndex] = { cotizId, idProvider, providerName };

      // Update row data with provider info
      quoteData[`proveedor${providerNumber}Id`] = idProvider;
      quoteData[`proveedor${providerNumber}Name`] = providerName;
      quoteData[`proveedor${providerNumber}CotizId`] = cotizId;
      quoteData[`proveedor${providerNumber}Count`] = reqItems.length;

      // Refresh grid
      if (this.masterGridApi) {
        this.masterGridApi.refreshCells({
          columns: ['proveedor1', 'proveedor2', 'proveedor3'],
          force: true
        });
      }

      alerts.basicAlert('COTIZ creada', `Cotización creada para ${providerName} con ${reqItems.length} items.`, 'success');

      // Open the detail grid
      this.openProviderDetail(quoteData, providerNumber, cotizId, idProvider);

    } catch (error) {
      console.error('Error creating COTIZ:', error);
      alerts.basicAlert('Error', 'No se pudo crear la cotización del proveedor.', 'error');
    }
  }

  cancelProviderSelection(): void {
    this.showProviderModal = false;
    this.selectedProviderId = null;
    this.selectedProviderSlot = 0;
  }

  // Collapse the provider detail
  private collapseProviderDetail(quoteData: any): void {
    if (this.masterGridApi) {
      this.masterGridApi.forEachNode((node: any) => {
        if (node.data && node.data.id === quoteData.id && node.expanded) {
          node.setExpanded(false);
        }
      });
    }
    this.expandedRowId = null;
    this.expandedProviderNumber = null;
  }

  // Open the provider detail grid with COTIZ data
  private openProviderDetail(quoteData: any, providerNumber: number, cotizId: number, idProvider: number): void {
    if (this.masterGridApi) {
      this.masterGridApi.setGridOption('detailCellRenderer', ProviderQuoteDetailComponent);

      this.masterGridApi.setGridOption('detailCellRendererParams', {
        getDetailRowData: (params: any) => {
          params.successCallback([{
            quoteData: quoteData,
            providerNumber: providerNumber,
            requisitionItems: this.requisitionItems || []
          }]);
        },
        context: {
          idRoot: this.idRoot,
          productos: this.productos,
          proveedores: this.proveedores,
          componentParent: this,
          gridApi: this.masterGridApi,
          providerQuoteData: {
            quoteData: quoteData,
            providerNumber: providerNumber,
            idQuote: quoteData.id,
            idReq: quoteData.idReq,
            cotizId: cotizId,
            idProvider: idProvider
          }
        }
      });

      // Track expanded state
      this.expandedRowId = quoteData.id;
      this.expandedProviderNumber = providerNumber;

      // Collapse all, then expand selected
      this.masterGridApi.forEachNode((node: any) => {
        if (node.data && node.data.id === quoteData.id) {
          node.setExpanded(false);
          setTimeout(() => node.setExpanded(true), 50);
        } else if (node.expanded) {
          node.setExpanded(false);
        }
      });
    }
  }

// Load existing COTIZs for a given REQUIS ID
   loadExistingCotiz(idReq: number): void {
     this.resetCotizSlots();

     this.quotesService.getCotizByReq(idReq, this.typeReference, this.idReference).subscribe({
       next: (cotizList: any[]) => {
         // Filter only those with matching idReq
         const matching = cotizList.filter((c: any) => c.idReq === idReq && c.active !== false);
         console.log('Existing COTIZs for idReq', idReq, ':', matching);

         // Clear provider data on master row first
         if (this.masterSelectedRowData) {
           this.masterSelectedRowData.proveedor1Id = 0;
           this.masterSelectedRowData.proveedor1Name = '';
           this.masterSelectedRowData.proveedor1CotizId = null;
           this.masterSelectedRowData.proveedor2Id = 0;
           this.masterSelectedRowData.proveedor2Name = '';
           this.masterSelectedRowData.proveedor2CotizId = null;
           this.masterSelectedRowData.proveedor3Id = 0;
           this.masterSelectedRowData.proveedor3Name = '';
           this.masterSelectedRowData.proveedor3CotizId = null;
         }

         // Assign to slots (up to 3)
         matching.slice(0, 3).forEach((cotiz: any, index: number) => {
           const provider = this.proveedores.find((p: any) => p.id === cotiz.idProvider);
           this.cotizSlots[index] = {
             cotizId: cotiz.id,
             idProvider: cotiz.idProvider,
             providerName: provider ? provider.name : `Proveedor ${cotiz.idProvider}`
           };

// Update provider data on master row AND grid data
            if (this.masterSelectedRowData) {
              this.masterSelectedRowData[`proveedor${index + 1}Id`] = cotiz.idProvider;
              this.masterSelectedRowData[`proveedor${index + 1}Name`] = provider ? provider.name : `Proveedor ${cotiz.idProvider}`;
              this.masterSelectedRowData[`proveedor${index + 1}CotizId`] = cotiz.id;
              this.masterSelectedRowData[`proveedor${index + 1}Count`] = cotiz.countrow || 0;
              
              // Also update the grid row data to persist changes
              const gridRowData = this.masterRowData.find(row => row.id === this.masterSelectedRowData.id);
              if (gridRowData) {
                gridRowData[`proveedor${index + 1}Id`] = cotiz.idProvider;
                gridRowData[`proveedor${index + 1}Name`] = provider ? provider.name : `Proveedor ${cotiz.idProvider}`;
                gridRowData[`proveedor${index + 1}CotizId`] = cotiz.id;
                gridRowData[`proveedor${index + 1}Count`] = cotiz.countrow || 0;
                console.log(`✅ Updated grid row data for provider ${index + 1}:`, {
                  id: cotiz.idProvider,
                  name: provider ? provider.name : `Proveedor ${cotiz.idProvider}`,
                  cotizId: cotiz.id,
                  count: cotiz.countrow || 0
                });
              }
            }
         });

// Refresh provider columns with proper data update
        if (this.masterGridApi) {
          // First update the data with applyTransaction
          this.masterGridApi.applyTransaction({ 
            update: [this.masterSelectedRowData] 
          });
          // Then refresh the cells
          this.masterGridApi.refreshCells({
            columns: ['proveedor1', 'proveedor2', 'proveedor3'],
            force: true
          });
        }
       },
       error: (error) => {
         console.error('Error loading existing COTIZs:', error);
       }
     });
   }

  // Load COTIZ info for ALL master rows on initial load
  async loadAllCotizInfo(): Promise<void> {
    const rowsWithReq = this.masterRowData.filter(row => row.idReq);
    if (rowsWithReq.length === 0) return;

    const updatedRows: any[] = [];

    // Load all COTIZ info in parallel and collect results
    const promises = rowsWithReq.map(async (row) => {
      try {
        const cotizList: any[] = await lastValueFrom(
          this.quotesService.getCotizByReq(row.idReq, this.typeReference, this.idReference)
        );
        const matching = cotizList.filter((c: any) => c.idReq === row.idReq && c.active !== false);

        // Initialize provider fields to ensure they exist
        row.proveedor1Id = 0;
        row.proveedor1Name = '';
        row.proveedor1CotizId = null;
        row.proveedor1Count = 0;
        row.proveedor2Id = 0;
        row.proveedor2Name = '';
        row.proveedor2CotizId = null;
        row.proveedor2Count = 0;
        row.proveedor3Id = 0;
        row.proveedor3Name = '';
        row.proveedor3CotizId = null;
        row.proveedor3Count = 0;

        matching.slice(0, 3).forEach((cotiz: any, index: number) => {
          const provider = this.proveedores.find((p: any) => p.id === cotiz.idProvider);
          row[`proveedor${index + 1}Id`] = cotiz.idProvider;
          row[`proveedor${index + 1}Name`] = provider ? provider.name : `Proveedor ${cotiz.idProvider}`;
          row[`proveedor${index + 1}CotizId`] = cotiz.id;
          row[`proveedor${index + 1}Count`] = cotiz.countrow || 0;
        });

        updatedRows.push(row);
      } catch (err) {
        console.error('Error loading COTIZ for row', row.id, err);
      }
    });

    // Wait for all to complete
    await Promise.all(promises);

    // Refresh the entire grid once after all data is loaded
    if (this.masterGridApi && updatedRows.length > 0) {
      // Update all rows in a single transaction
      this.masterGridApi.applyTransaction({ update: updatedRows });

      // Force redraw of provider columns for all rows
      this.masterGridApi.redrawRows();

      console.log('✅ Provider columns refreshed for', updatedRows.length, 'rows');
    }
  }

  resetCotizSlots(): void {
    this.cotizSlots = [
      { cotizId: null, idProvider: null, providerName: '' },
      { cotizId: null, idProvider: null, providerName: '' },
      { cotizId: null, idProvider: null, providerName: '' }
    ];
  }


  // ==================== UTILITY METHODS ====================

  private clearAllData() {
    // Limpiar datos master
    this.masterRowData = [];
    this.masterSelectedRowData = null;
    this.newlyAddedMasterRows = [];
    this.masterNotSavedChanges = false;

    // Limpiar catálogos
    this.departamentos = [];
    this.productos = [];
    this.monedas = [];

    // Limpiar IDs
    this.idReference = null;
    this.idQuote = null;
    this.lastProcessedQuote = null;
    this.projectOrBranch = null;
    this.typeReference = null;

    // Limpiar COTIZ slots
    this.resetCotizSlots();
  }

private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.proveedor1Data;
    delete cleanedData.proveedor2Data;
    delete cleanedData.proveedor3Data;
    delete cleanedData.proveedor1Count;
    delete cleanedData.proveedor2Count;
    delete cleanedData.proveedor3Count;
    delete cleanedData.providerNumber;
    // Delete provider UI fields
    delete cleanedData.proveedor1Id;
    delete cleanedData.proveedor1Name;
    delete cleanedData.proveedor1CotizId;
    delete cleanedData.proveedor2Id;
    delete cleanedData.proveedor2Name;
    delete cleanedData.proveedor2CotizId;
    delete cleanedData.proveedor3Id;
    delete cleanedData.proveedor3Name;
    delete cleanedData.proveedor3CotizId;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    // Si existe dateCreate, copiar su valor a dateSupply
    if (cleanedData.dateCreate) {
      cleanedData.dateSupply = cleanedData.dateCreate;
    }
    return cleanedData;
  }

  getSetupData(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.setupService.getWarehouseSetup(this.idRoot).subscribe({
        next: (data: any) => {
          this.projectOrBranch = data[0].projectOrBranch;
          this.typeReference = this.projectOrBranch ? 'project' : 'branch';
          console.log(this.projectOrBranch);
          resolve(); // Resolvemos la promesa aquí
        },
        error: (err) => {
          if (err.status === 404) {
            console.error(err);
            alerts.basicAlert(
              'Cotizaciones',
              'No se encontró la configuración de almacenes de la empresa.',
              'error'
            );
          }
          reject(err); // Rechazamos la promesa en caso de error
        }
      });
    });
  }

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.masterNotSavedChanges);
  }
}
