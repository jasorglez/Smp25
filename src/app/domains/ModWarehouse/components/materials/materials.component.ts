import { Component, effect, HostListener, inject, OnInit, input, signal } from '@angular/core';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import {
  CellDoubleClickedEvent,
  ColDef,
  GetMainMenuItemsParams,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  MenuItemDef,
} from 'ag-grid-enterprise';
import { alerts } from '../../../../helpers/alerts';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { ModalService } from 'app/services/modal.service';
import { MaterialsService } from 'app/services/materials.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { SignalsService } from 'app/services/signals.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Icatalog } from 'app/interface/icatalog';
import { ProvedoorByBranchComponent } from './components/ProvedoorByBranch/ProvedoorByBranch.component';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { PricePresentations } from 'app/interface/materials.interface';
import { BranchsService } from 'app/services/branchs.service';
import { CustomersService } from 'app/services/customers.service';
import { PriceProductsPresentationsComponent } from './components/price-products-presentations/price-products-presentations.component';
import { DetailCellRendererHistoricoComponent } from './details/detail-cell-renderer-historico.component';
import { DetailCellRendererMaterialesComponent } from './details/detail-cell-renderer-materiales.component';
import { DetailCellRendererParametrosComponent } from './details/detail-cell-renderer-parametros.component';
import { TrackingService } from 'app/services/tracking.service';

declare const bootstrap: any; // Añadir declaración para Bootstrap

@Component({
  selector: 'app-materials',
  standalone: true,
  imports: [
    AutocompleteEditorComponent,
    CommonModule,
    FormsModule,
    AgGridModule,
    MultiLineEditorComponent,
    PriceProductsPresentationsComponent,
    ProvedoorByBranchComponent
  ],
  templateUrl: './materials.component.html',
  styleUrl: './materials.component.scss',
})
export class MaterialsComponent implements CanComponentDeactivate, OnInit {
  private trackingService = inject(TrackingService);
  typeMaterial = input<string>('');
  idRootInput = input<number>(0);
  
  private type: string = '';
  
  private initialized = false;

  constructor(private router: Router) {
    this.route.data.subscribe((data) => {
      this.type = this.typeMaterial() || data['type'] || '';
    });

    effect(() => {
      let newIdRoot = this.signalsService.getRootSelectedBySidebar()();
      let newBranchSelect = this.signalsService.getBranchSelectedBySidebar()();
      
      if ((!newIdRoot || newIdRoot === null || newIdRoot === undefined) && this.idRootInput() > 0) {
        newIdRoot = this.idRootInput();
        newBranchSelect = this.idRootInput();
      }
      
      if (!newIdRoot || newIdRoot === null || newIdRoot === undefined) {
        console.warn('MaterialsComponent: idRoot es undefined/null, esperando datos del sidebar...');
        return;
      }
      
      if (this.initialized && this.idRoot === newIdRoot) {
        return;
      }
      
      this.idRoot = newIdRoot;
      this.branchSelect = newBranchSelect;
      this.initialized = true;
      console.log('MaterialsComponent: idRoot configurado:', this.idRoot, 'branchSelect:', this.branchSelect);
      this.obtenerDatos();
      this.obtenerMedidas();
      this.obtenerFamilias();
      this.obtenerSubfamilias();
      this.obtenerBranchs();
      this.obtenerProveedores();
      this.obtenerUbicaciones();
    });
  }
  
  ngOnInit() {
    const initialRoot = this.signalsService.getRootSelectedBySidebar()();
    if (initialRoot) {
      this.initialized = true;
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  notSavedChanges: boolean = false;
  newFamilyName: string = '';
  newLocationName: string = '';
  newSubFamilyName: string = '';
  selectedFamily: number = null;
  rowData: any[] = [];
  proveedoresData: any[] = [];
  public priceXproductsData = signal<PricePresentations[]>([]);
  public idMaterial = signal<number>(0);
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  private estados: string[] = [];
  medidas: any;
  parentId: number = 200;
  familias: any;
  subfamilias2: any;
  branchs: any[] = [];
  branchSelect: number;
  ubicaciones: any;
  id: string = null;
  idRoot: number = null;
  gridHeight: string = '80vh';
  showContainerTabs: boolean = false;
  showContainerTabsProveedoresByBranch: boolean = false;
  showMeasureTab: boolean = false;
  showSavingsTab: boolean = false;
  private isOpen: boolean = false;
  private tempIdCounter: number = 0;
  material = {
    picture: null as string,
    description: null as string,
    measure: null as string,
  };

  private gridApi: GridApi;

  currentIndex = 0;

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent,
    detailCellRendererHistorico: DetailCellRendererHistoricoComponent,
    detailCellRendererMateriales: DetailCellRendererMaterialesComponent,
    detailCellRendererParametros: DetailCellRendererParametrosComponent,
  };

  // Inject of new way for Angular 18
  private customerService = inject(CustomersService);
  private materialsService = inject(MaterialsService);
  private catalogsService = inject(CatalogsService);
  private modalServiceTable = inject(ModalService);
  private branchesService = inject(BranchsService);
  private imageHandlerService = inject(ImageHandlerService);
  private signalsService = inject(SignalsService);
  private route = inject(ActivatedRoute);

  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    masterDetail: true,
    isRowMaster: (dataItem: any) => {
      return this.type === 'PRIMERA_FASE' && dataItem.historicoData && dataItem.historicoData.length > 0;
    },
    detailCellRendererSelector: (params: any) => {
      if (this.type === 'PRIMERA_FASE') {
        if (params.data.detailType === 'historico') {
          return { component: 'detailCellRendererHistorico' };
        }
        if (params.data.detailType === 'materiales') {
          return { component: 'detailCellRendererMateriales' };
        }
        if (params.data.detailType === 'parametros') {
          return { component: 'detailCellRendererParametros' };
        }
      }
      return undefined;
    },
    getRowClass: (params) => {
      // Verificar si la fila está seleccionada
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowClicked: (event) => {
      // Seleccionar la fila al hacer clic en cualquier celda
      event.node.setSelected(true);
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
    onCellClicked: this.onCellClicked.bind(this),
  };

  get colMaster(): ColDef[] {
    // Columnas específicas para Primera Fase
    if (this.type === 'PRIMERA_FASE') {
      return [
        {
          field: 'articulo',
          headerName: 'Artículo',
          editable: true,
          width: 250,
          flex: 1
        },
        {
          field: 'fase',
          headerName: 'Fase',
          editable: true,
          width: 150,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: {
            values: ['Primera', 'Segunda']
          }
        },
        {
          field: 'materiales',
          headerName: 'Materiales',
          editable: false,
          width: 150,
          cellStyle: { backgroundColor: '#e1f5fe', cursor: 'pointer', textDecoration: 'underline' },
          cellRenderer: (params: any) => {
            const count = params.data.materialesData ? params.data.materialesData.length : 0;
            const div = document.createElement('div');
            div.innerText = `${count} materiales`;
            div.style.cursor = 'pointer';
            div.style.textDecoration = 'underline';
            return div;
          }
        },
        {
          field: 'costoFinal',
          headerName: 'Costo Final',
          editable: true,
          width: 130,
          valueFormatter: (params) => {
            return params.value ? `$${params.value.toFixed(2)}` : '$0.00';
          }
        },
        {
          field: 'fechaCambio',
          headerName: 'Fecha Cambio',
          editable: true,
          width: 130,
          valueFormatter: (params) => {
            if (params.value) {
              return params.value.split('T')[0];
            }
            return '';
          }
        },
        {
          field: 'numArticulo',
          headerName: 'Num Artículo',
          editable: true,
          width: 130
        },
        {
          field: 'parametros',
          headerName: 'Parámetros',
          editable: false,
          width: 150,
          cellStyle: { backgroundColor: '#fff9c4', cursor: 'pointer', textDecoration: 'underline' },
          cellRenderer: (params: any) => {
            const div = document.createElement('div');
            div.innerText = 'Parámetros';
            div.style.cursor = 'pointer';
            div.style.textDecoration = 'underline';
            return div;
          }
        }
      ];
    }

    // Columnas originales para otros tipos
    return [
      { field: 'vigente', headerName: 'Activo', editable: true, width: 100 },
      {
        field: 'id',
        editable: false,
        width: 70,
        hide: true,
        filter: 'agNumberColumnFilter', // Filtro para números (si el ID es numérico)
        filterParams: {
          filterOptions: ['equals'], // Opciones de filtro
        },
      },
      /*{
        field: 'idBranch',
        headerName: 'Sucursal',
        headerClass: 'required-header',             
        editable: true,
        filter: true,
        width: 170,
        cellEditor: 'agSelectCellEditor',
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'windows',
        },

        cellEditorParams: (params) => {
          return {
            values: this.branchs
              ? this.branchs
                  .slice() // Creamos una copia para no modificar el array original
                  .sort((a, b) => a.name.localeCompare(b.name)) // Ordenamos por nombre
                  .map((item) => item.id) // Extraemos solo los IDs
              : [],
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
        field: 'idProveedor',
        headerName: 'Proveedor',
        editable: true,
        filter: true,
        cellEditor: 'autocompleteEditor',
        width: 200,
        cellEditorParams: {
          filterList: this.proveedoresData?.map(e => e.nameContact
          ),
          filterKey: 'nameContact',
          placeholder: 'Proveedor',
          minLength: 1
        },
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
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

          const duplicateExists = this.proveedoresData.some(
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
      },*/
      {
        field: 'idProveedor',
        headerName: 'Proveedor',
        editable: false,

      },
      {
        field: 'description',
        headerName: 'Materia prima',
        editable: true,
        width: 285,
        filter: true,
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
      {
        headerName: 'SubFamilia',
      },
      {
        headerName: 'Descripcion',
      },
      {
        headerName: 'Medidas',
      },
      /*{
        field: 'price',
        headerName: 'Precio',
        editable: true,
        filter: true,
        width: 150,
      },
      /*{
        field: 'weight',
        headerName: 'Unidad',
        editable: true,
        filter: true,
        width: 150,
      },*/
      {
        field: 'weight',
        headerName: 'Peso por unidad',
        editable: true,
        filter: true,
        width: 150,
      },
      {
        field: 'insumo',
        headerName: 'Num. Material',
        editable: true,
        filter: true,
        width: 150,
        cellEditor: 'autocompleteEditor',
        cellEditorParams: {
          filterList: this.rowData.map((e) => e.insumo),
          filterKey: 'insumo',
          placeholder: 'Número Material',
          minLength: 1,
        },
        valueSetter: (params) => {
          const duplicateExists = this.rowData.some(
            (row, index) =>
              index !== params.node.rowIndex && row.insumo === params.newValue
          );

          if (duplicateExists) {
            alerts.basicAlert(
              'Código duplicado',
              'Ya existe el código de insumo.',
              'error'
            );
            return false;
          }

          params.data[params.colDef.field] = params.newValue;
          return true;
        },
        cellStyle: { backgroundColor: '#d4edda' },
      },
      {
        field: 'date',
        headerName: 'Fecha de alta MP',
        editable: true,
        width: 110,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        },
      },
      /*{
        field: 'stockMin',
        headerName: 'Stock Mínimo',
        editable: true,
        width: 150,
        cellDataType: 'number',
        cellEditorParams: { min: 0 },
      },//pasara alguna parte de inventarios
      {
        headerName: "Cantidad a pedir"
      },
      {
        field: 'stockMax',
        headerName: 'Stock Máximo',
        editable: true,
        width: 150,
        cellDataType: 'number',
        cellEditorParams: { min: 0 },
      },pasara alguna parte de inventarios
      {
        field: 'idFamilia',
        headerName: 'Producto',
        editable: true,
        width: 150,
        filter: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.familias ? this.familias.map((item) => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.familias
            ? this.familias.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.description}` : params.value;
        },
        valueGetter: (params) => {
          console.log(params)
          if (!params.data || !params.data.idFamilia) return '';
          const familias = this.familias?.find(b => b.id === params.data.idFamilia);
        
          return familias ? familias.description : '';
        },
        mainMenuItems: (params: GetMainMenuItemsParams) => {
          const familyMenuItems: (MenuItemDef | string)[] = [
            {
              name: 'Añadir familia',
              action: () => {
                this.openAddFamilyModal();
              },
            },
            'separator',
            ...params.defaultItems.slice(0),
          ];
          return familyMenuItems;
        },
      },
      
      {
        field: 'typeMaterial',
        headerName: 'Tipo Material',
        editable: true,
        filter: true,
        width: 150,
      },
      
      

      {
        field: 'idSubfamilia',
        headerName: 'Presentación',
        editable: true,
        width: 150,
        filter: true,
        cellEditor: 'agSelectCellEditor',
        mainMenuItems: (params: GetMainMenuItemsParams) => {
          const subFamilyMenuItems: (MenuItemDef | string)[] = [
            {
              name: 'Añadir subfamilia',
              action: () => {
                this.openAddSubFamilyModal();
              },
            },
            'separator',
            ...params.defaultItems.slice(0),
          ];
          return subFamilyMenuItems;
        },
        cellEditorParams: (params) => {
          // Obtener el idFamilia de la fila actual
          const idFamilia = params.data.idFamilia;

          // Filtrar subfamilias por parentId (idFamilia) usando subfamilias2
          const subfamiliasFiltradas = this.subfamilias2.filter(
            (item) => item.parentId === idFamilia
          );

          return {
            values: subfamiliasFiltradas.map((item) => item.id),
            valueFormatter: (id) => {
              const foundItem = subfamiliasFiltradas.find(
                (item) => item.id === id
              );
              return foundItem ? foundItem.description : id;
            },
          };
        },
        valueFormatter: (params) => {
          // Mostrar la descripción de la subfamilia usando subfamilias2
          const foundItem = this.subfamilias2
            ? this.subfamilias2.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.description}` : params.value;
        },
        valueGetter: (params) => {
          console.log(params)
          if (!params.data || !params.data.idSubfamilia) return '';
          const familias = this.subfamilias2?.find(b => b.id === params.data.idSubfamilia);
        
          return familias ? familias.description : '';
        },
      },

      {
        headerName: "Peso por unidad"
      },
      {
        field: 'idMedida',
        headerName: 'Medidas',
        editable: true,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.medidas ? this.medidas.map((item) => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.medidas
            ? this.medidas.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.description}` : params.value;
        },
      },
      {
        headerName: 'Empaquetado',
      },
      /*{
        field: 'costoMN',
        headerName: 'Costo MXN',
        editable: true,
        width: 150,
        valueFormatter: (params) => {
          return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }).format(params.value);
        },
      },*/
      {
        headerName: 'Caducidad (En meses)',
      },
      /*{
        field: 'costoDLL',
        headerName: 'Costo DLL',
        editable: true,
        width: 150,
        valueFormatter: (params) => {
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(params.value);
        },
      },
      {
        field: 'ventaMN',
        headerName: 'Venta MXN',
        editable: true,
        width: 150,
        valueFormatter: (params) => {
          return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }).format(params.value);
        },
      },
      {
        field: 'ventaDLL',
        headerName: 'Venta DLL',
        editable: true,
        width: 150,
        valueFormatter: (params) => {
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(params.value);
        },
      },*/
      {
        headerName: 'Tiempo de entrega (En semanas)',//en desimal
      },
      
      {
        field: 'picture',
        headerName: 'Imagen',
        editable: false,
        width: 150,
        cellRenderer: this.imageHandlerService.imageCellRenderer.bind(
          this.imageHandlerService
        ),
        cellRendererParams: {
          clicked: this.imageHandlerService.onImageCellClicked.bind(
            this.imageHandlerService
          ),
          field: 'picture',
        },
      },
      
      /*
      
      {
        field: 'idUbication',
        headerName: 'Ubicacion',
        editable: true,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.ubicaciones
            ? this.ubicaciones.map((item) => item.id)
            : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.ubicaciones
            ? this.ubicaciones.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.description}` : params.value;
        },
        mainMenuItems: (params: GetMainMenuItemsParams) => {
          const locationMenuItems: (MenuItemDef | string)[] = [
            {
              name: 'Añadir ubicación',
              action: () => {
                this.openAddLocationModal();
              },
            },
            'separator',
            ...params.defaultItems.slice(0),
          ];
          return locationMenuItems;
        },
      },*/
      
      /*{
        field: 'barCode',
        headerName: 'Codigo Barra',
        editable: true,
        filter: true,
        width: 150,
      },*/
      
    ];
  }

  obtenerDatos(): any {
    // Datos fake para Primera Fase
    if (this.type === 'PRIMERA_FASE') {
      this.rowData = [
        {
          id: 1,
          articulo: 'Salsa Picante Premium',
          fase: 'Primera',
          costoFinal: 1887.77,
          fechaCambio: '2025-01-15T00:00:00',
          numArticulo: 'ART-001',
          materialesData: [
            {
              id: 101,
              materiales: 'Chile Habanero',
              costo: 125.50,
              cantidad: '15.5 KG',
              proporcion: '25%',
              checkBox: true,
              costoTotal: 1850.75,
              merma: '0.31 KG (2%)'
            },
            {
              id: 102,
              materiales: 'Vinagre Blanco',
              costo: 45.00,
              cantidad: '5.0 LTS',
              proporcion: '10%',
              checkBox: true,
              costoTotal: 225.00,
              merma: '0.10 LTS (2%)'
            },
            {
              id: 103,
              materiales: 'Sal Marina',
              costo: 12.50,
              cantidad: '2.0 KG',
              proporcion: '5%',
              checkBox: false,
              costoTotal: 25.00,
              merma: '0.04 KG (2%)'
            },
            {
              id: 104,
              materiales: 'Especias Mix',
              costo: 85.00,
              cantidad: '1.5 KG',
              proporcion: '3%',
              checkBox: true,
              costoTotal: 127.50,
              merma: '0.03 KG (2%)'
            }
          ],
          parametrosData: [
            {
              id: 1001,
              parametros: 'Temperatura',
              minimo: '4°C',
              objetivo: '6°C',
              maximo: '8°C'
            },
            {
              id: 1002,
              parametros: 'pH',
              minimo: '3.5',
              objetivo: '3.8',
              maximo: '4.0'
            },
            {
              id: 1003,
              parametros: 'Viscosidad',
              minimo: '500 cP',
              objetivo: '600 cP',
              maximo: '700 cP'
            }
          ],
          historicoData: [
            {
              materialPrimeraFase: 'Salsa Picante Premium',
              materiaPrimaBasica: 'Chile Habanero',
              costo: 125.50,
              cantidadLtsKg: '15.5 KG',
              costoTotal: 1850.75,
              productoMermaLtsKg: '0.31 KG',
              porcentajeMerma: '2.00%',
              costoFinal: 1887.77,
              fechaCambio: '2025-01-15T00:00:00',
              asignado: true
            },
            {
              materialPrimeraFase: 'Salsa Picante Premium',
              materiaPrimaBasica: 'Chile Habanero',
              costo: 120.00,
              cantidadLtsKg: '15.5 KG',
              costoTotal: 1767.50,
              productoMermaLtsKg: '0.31 KG',
              porcentajeMerma: '2.00%',
              costoFinal: 1803.05,
              fechaCambio: '2024-12-10T00:00:00',
              asignado: false
            },
            {
              materialPrimeraFase: 'Salsa Picante Premium',
              materiaPrimaBasica: 'Chile Habanero',
              costo: 115.75,
              cantidadLtsKg: '15.0 KG',
              costoTotal: 1702.50,
              productoMermaLtsKg: '0.30 KG',
              porcentajeMerma: '2.00%',
              costoFinal: 1736.55,
              fechaCambio: '2024-11-20T00:00:00',
              asignado: false
            },
            {
              materialPrimeraFase: 'Salsa Picante Premium',
              materiaPrimaBasica: 'Chile Habanero',
              costo: 110.00,
              cantidadLtsKg: '14.5 KG',
              costoTotal: 1620.00,
              productoMermaLtsKg: '0.29 KG',
              porcentajeMerma: '2.00%',
              costoFinal: 1652.40,
              fechaCambio: '2024-10-15T00:00:00',
              asignado: false
            }
          ]
        },
        {
          id: 2,
          articulo: 'Base Chocolate Obscuro',
          fase: 'Primera',
          costoFinal: 3315.61,
          fechaCambio: '2025-01-10T00:00:00',
          numArticulo: 'ART-002',
          materialesData: [
            {
              id: 201,
              materiales: 'Cacao en Polvo',
              costo: 285.00,
              cantidad: '22.8 KG',
              proporcion: '45%',
              checkBox: true,
              costoTotal: 3250.60,
              merma: '0.46 KG (2%)'
            },
            {
              id: 202,
              materiales: 'Azúcar Refinada',
              costo: 65.00,
              cantidad: '18.0 KG',
              proporcion: '35%',
              checkBox: true,
              costoTotal: 1170.00,
              merma: '0.36 KG (2%)'
            },
            {
              id: 203,
              materiales: 'Leche en Polvo',
              costo: 120.00,
              cantidad: '8.0 KG',
              proporcion: '15%',
              checkBox: true,
              costoTotal: 960.00,
              merma: '0.16 KG (2%)'
            },
            {
              id: 204,
              materiales: 'Vainilla',
              costo: 95.00,
              cantidad: '0.5 KG',
              proporcion: '1%',
              checkBox: true,
              costoTotal: 47.50,
              merma: '0.01 KG (2%)'
            },
            {
              id: 205,
              materiales: 'Lecitina de Soya',
              costo: 55.00,
              cantidad: '1.0 KG',
              proporcion: '2%',
              checkBox: false,
              costoTotal: 55.00,
              merma: '0.02 KG (2%)'
            },
            {
              id: 206,
              materiales: 'Sal',
              costo: 8.00,
              cantidad: '0.8 KG',
              proporcion: '2%',
              checkBox: true,
              costoTotal: 6.40,
              merma: '0.02 KG (2%)'
            },
            {
              id: 207,
              materiales: 'Manteca de Cacao',
              costo: 340.00,
              cantidad: '4.5 KG',
              proporcion: '9%',
              checkBox: true,
              costoTotal: 1530.00,
              merma: '0.09 KG (2%)'
            },
            {
              id: 208,
              materiales: 'Esencia de Chocolate',
              costo: 180.00,
              cantidad: '0.3 KG',
              proporcion: '0.5%',
              checkBox: false,
              costoTotal: 54.00,
              merma: '0.01 KG (2%)'
            },
            {
              id: 209,
              materiales: 'Emulsificante E476',
              costo: 210.00,
              cantidad: '0.6 KG',
              proporcion: '1.5%',
              checkBox: true,
              costoTotal: 126.00,
              merma: '0.01 KG (2%)'
            }
          ],
          parametrosData: [
            {
              id: 2001,
              parametros: 'Temperatura',
              minimo: '18°C',
              objetivo: '20°C',
              maximo: '22°C'
            },
            {
              id: 2002,
              parametros: 'Humedad',
              minimo: '40%',
              objetivo: '45%',
              maximo: '50%'
            },
            {
              id: 2003,
              parametros: 'Tiempo Mezclado',
              minimo: '15 min',
              objetivo: '20 min',
              maximo: '25 min'
            }
          ],
          historicoData: [
            {
              materialPrimeraFase: 'Base Chocolate Obscuro',
              materiaPrimaBasica: 'Cacao en Polvo',
              costo: 285.00,
              cantidadLtsKg: '22.8 KG',
              costoTotal: 3250.60,
              productoMermaLtsKg: '0.46 KG',
              porcentajeMerma: '2.00%',
              costoFinal: 3315.61,
              fechaCambio: '2025-01-10T00:00:00',
              asignado: true
            },
            {
              materialPrimeraFase: 'Base Chocolate Obscuro',
              materiaPrimaBasica: 'Cacao en Polvo',
              costo: 275.00,
              cantidadLtsKg: '22.8 KG',
              costoTotal: 3135.00,
              productoMermaLtsKg: '0.46 KG',
              porcentajeMerma: '2.00%',
              costoFinal: 3197.70,
              fechaCambio: '2024-12-01T00:00:00',
              asignado: false
            },
            {
              materialPrimeraFase: 'Base Chocolate Obscuro',
              materiaPrimaBasica: 'Cacao en Polvo',
              costo: 265.00,
              cantidadLtsKg: '22.0 KG',
              costoTotal: 2987.50,
              productoMermaLtsKg: '0.44 KG',
              porcentajeMerma: '2.00%',
              costoFinal: 3047.25,
              fechaCambio: '2024-10-15T00:00:00',
              asignado: false
            }
          ]
        },
        {
          id: 3,
          articulo: 'Aderezo Ranch Especial',
          fase: 'Segunda',
          costoFinal: 1449.22,
          fechaCambio: '2025-01-12T00:00:00',
          numArticulo: 'ART-003',
          materialesData: [
            {
              id: 301,
              materiales: 'Crema Ácida',
              costo: 98.75,
              cantidad: '12.0 LTS',
              proporcion: '35%',
              checkBox: true,
              costoTotal: 1420.80,
              merma: '0.24 LTS (2%)'
            },
            {
              id: 302,
              materiales: 'Mayonesa',
              costo: 75.00,
              cantidad: '8.0 LTS',
              proporcion: '25%',
              checkBox: true,
              costoTotal: 600.00,
              merma: '0.16 LTS (2%)'
            },
            {
              id: 303,
              materiales: 'Perejil Deshidratado',
              costo: 45.00,
              cantidad: '1.5 KG',
              proporcion: '10%',
              checkBox: true,
              costoTotal: 67.50,
              merma: '0.03 KG (2%)'
            },
            {
              id: 304,
              materiales: 'Cebollín',
              costo: 38.00,
              cantidad: '1.2 KG',
              proporcion: '8%',
              checkBox: false,
              costoTotal: 45.60,
              merma: '0.02 KG (2%)'
            },
            {
              id: 305,
              materiales: 'Ajo en Polvo',
              costo: 55.00,
              cantidad: '0.8 KG',
              proporcion: '5%',
              checkBox: true,
              costoTotal: 44.00,
              merma: '0.02 KG (2%)'
            }
          ],
          parametrosData: [
            {
              id: 3001,
              parametros: 'Temperatura',
              minimo: '2°C',
              objetivo: '4°C',
              maximo: '6°C'
            },
            {
              id: 3002,
              parametros: 'Caducidad',
              minimo: '25 días',
              objetivo: '30 días',
              maximo: '35 días'
            },
            {
              id: 3003,
              parametros: 'Densidad',
              minimo: '0.95 g/ml',
              objetivo: '1.0 g/ml',
              maximo: '1.05 g/ml'
            }
          ],
          historicoData: [
            {
              materialPrimeraFase: 'Aderezo Ranch Especial',
              materiaPrimaBasica: 'Crema Ácida',
              costo: 98.75,
              cantidadLtsKg: '12.0 LTS',
              costoTotal: 1420.80,
              productoMermaLtsKg: '0.24 LTS',
              porcentajeMerma: '2.00%',
              costoFinal: 1449.22,
              fechaCambio: '2025-01-12T00:00:00',
              asignado: true
            },
            {
              materialPrimeraFase: 'Aderezo Ranch Especial',
              materiaPrimaBasica: 'Crema Ácida',
              costo: 95.00,
              cantidadLtsKg: '12.0 LTS',
              costoTotal: 1367.00,
              productoMermaLtsKg: '0.24 LTS',
              porcentajeMerma: '2.00%',
              costoFinal: 1394.34,
              fechaCambio: '2025-01-08T00:00:00',
              asignado: false
            },
            {
              materialPrimeraFase: 'Aderezo Ranch Especial',
              materiaPrimaBasica: 'Crema Ácida',
              costo: 92.00,
              cantidadLtsKg: '12.0 LTS',
              costoTotal: 1324.00,
              productoMermaLtsKg: '0.24 LTS',
              porcentajeMerma: '2.00%',
              costoFinal: 1350.48,
              fechaCambio: '2024-12-20T00:00:00',
              asignado: false
            },
            {
              materialPrimeraFase: 'Aderezo Ranch Especial',
              materiaPrimaBasica: 'Crema Ácida',
              costo: 88.00,
              cantidadLtsKg: '11.5 LTS',
              costoTotal: 1254.00,
              productoMermaLtsKg: '0.23 LTS',
              porcentajeMerma: '2.00%',
              costoFinal: 1279.08,
              fechaCambio: '2024-11-05T00:00:00',
              asignado: false
            }
          ]
        },
        {
          id: 4,
          articulo: 'Conservador Natural',
          fase: 'Primera',
          costoFinal: 637.81,
          fechaCambio: '2025-01-08T00:00:00',
          numArticulo: 'ART-004',
          materialesData: [
            {
              id: 401,
              materiales: 'Ácido Cítrico',
              costo: 45.20,
              cantidad: '5.5 KG',
              proporcion: '10%',
              checkBox: true,
              costoTotal: 625.30,
              merma: '0.11 KG (2%)'
            },
            {
              id: 402,
              materiales: 'Sal Refinada',
              costo: 12.00,
              cantidad: '3.0 KG',
              proporcion: '15%',
              checkBox: true,
              costoTotal: 36.00,
              merma: '0.06 KG (2%)'
            }
          ],
          parametrosData: [
            {
              id: 4001,
              parametros: 'Temperatura Ambiente',
              minimo: '18°C',
              objetivo: '22°C',
              maximo: '25°C'
            },
            {
              id: 4002,
              parametros: 'pH',
              minimo: '2.0',
              objetivo: '2.5',
              maximo: '3.0'
            },
            {
              id: 4003,
              parametros: 'Concentración',
              minimo: '8%',
              objetivo: '10%',
              maximo: '12%'
            }
          ],
          historicoData: [
            {
              materialPrimeraFase: 'Conservador Natural',
              materiaPrimaBasica: 'Ácido Cítrico',
              costo: 45.20,
              cantidadLtsKg: '5.5 KG',
              costoTotal: 625.30,
              productoMermaLtsKg: '0.11 KG',
              porcentajeMerma: '2.00%',
              costoFinal: 637.81,
              fechaCambio: '2025-01-08T00:00:00',
              asignado: true
            },
            {
              materialPrimeraFase: 'Conservador Natural',
              materiaPrimaBasica: 'Ácido Cítrico',
              costo: 43.50,
              cantidadLtsKg: '5.5 KG',
              costoTotal: 601.75,
              productoMermaLtsKg: '0.11 KG',
              porcentajeMerma: '2.00%',
              costoFinal: 613.79,
              fechaCambio: '2024-11-25T00:00:00',
              asignado: false
            },
            {
              materialPrimeraFase: 'Conservador Natural',
              materiaPrimaBasica: 'Ácido Cítrico',
              costo: 40.00,
              cantidadLtsKg: '5.0 KG',
              costoTotal: 550.00,
              productoMermaLtsKg: '0.10 KG',
              porcentajeMerma: '2.00%',
              costoFinal: 561.00,
              fechaCambio: '2024-09-10T00:00:00',
              asignado: false
            }
          ]
        },
        {
          id: 5,
          articulo: 'Emulsificante Vegetal',
          fase: 'Primera',
          costoFinal: 1989.46,
          fechaCambio: '2025-01-14T00:00:00',
          numArticulo: 'ART-005',
          materialesData: [
            {
              id: 501,
              materiales: 'Lecitina de Soya',
              costo: 165.90,
              cantidad: '8.2 KG',
              proporcion: '18%',
              checkBox: true,
              costoTotal: 1360.38,
              merma: '0.16 KG (2%)'
            },
            {
              id: 502,
              materiales: 'Mono y Diglicéridos',
              costo: 185.50,
              cantidad: '5.5 KG',
              proporcion: '12%',
              checkBox: true,
              costoTotal: 1020.25,
              merma: '0.11 KG (2%)'
            },
            {
              id: 503,
              materiales: 'Goma Xantana',
              costo: 220.00,
              cantidad: '3.8 KG',
              proporcion: '8%',
              checkBox: false,
              costoTotal: 836.00,
              merma: '0.08 KG (2%)'
            },
            {
              id: 504,
              materiales: 'Goma Guar',
              costo: 195.75,
              cantidad: '4.2 KG',
              proporcion: '9%',
              checkBox: true,
              costoTotal: 822.15,
              merma: '0.08 KG (2%)'
            },
            {
              id: 505,
              materiales: 'Polisorbato 60',
              costo: 310.00,
              cantidad: '2.5 KG',
              proporcion: '5%',
              checkBox: false,
              costoTotal: 775.00,
              merma: '0.05 KG (2%)'
            },
            {
              id: 506,
              materiales: 'Aceite de Girasol',
              costo: 95.40,
              cantidad: '12.0 LT',
              proporcion: '26%',
              checkBox: true,
              costoTotal: 1144.80,
              merma: '0.24 LT (2%)'
            },
            {
              id: 507,
              materiales: 'Estearato de Magnesio',
              costo: 145.00,
              cantidad: '1.8 KG',
              proporcion: '3%',
              checkBox: true,
              costoTotal: 261.00,
              merma: '0.04 KG (2%)'
            },
            {
              id: 508,
              materiales: 'Antioxidante BHT',
              costo: 275.00,
              cantidad: '0.6 KG',
              proporcion: '1%',
              checkBox: false,
              costoTotal: 165.00,
              merma: '0.01 KG (2%)'
            },
            {
              id: 509,
              materiales: 'Colorante Natural',
              costo: 190.00,
              cantidad: '0.4 KG',
              proporcion: '0.8%',
              checkBox: true,
              costoTotal: 76.00,
              merma: '0.01 KG (2%)'
            }
          ],
          parametrosData: [
            {
              id: 5001,
              parametros: 'Temperatura Almacenamiento',
              minimo: '15°C',
              objetivo: '20°C',
              maximo: '25°C'
            },
            {
              id: 5002,
              parametros: 'Índice de Emulsificación',
              minimo: '85%',
              objetivo: '92%',
              maximo: '95%'
            },
            {
              id: 5003,
              parametros: 'Viscosidad',
              minimo: '800 cP',
              objetivo: '1000 cP',
              maximo: '1200 cP'
            }
          ],
          historicoData: [
            {
              materialPrimeraFase: 'Emulsificante Vegetal',
              materiaPrimaBasica: 'Lecitina de Soya',
              costo: 165.90,
              cantidadLtsKg: '8.2 KG',
              costoTotal: 1950.45,
              productoMermaLtsKg: '0.16 KG',
              porcentajeMerma: '2.00%',
              costoFinal: 1989.46,
              fechaCambio: '2025-01-14T00:00:00',
              asignado: true
            },
            {
              materialPrimeraFase: 'Emulsificante Vegetal',
              materiaPrimaBasica: 'Lecitina de Soya',
              costo: 160.00,
              cantidadLtsKg: '8.2 KG',
              costoTotal: 1880.00,
              productoMermaLtsKg: '0.16 KG',
              porcentajeMerma: '2.00%',
              costoFinal: 1917.60,
              fechaCambio: '2024-12-18T00:00:00',
              asignado: false
            },
            {
              materialPrimeraFase: 'Emulsificante Vegetal',
              materiaPrimaBasica: 'Lecitina de Soya',
              costo: 155.00,
              cantidadLtsKg: '8.0 KG',
              costoTotal: 1805.00,
              productoMermaLtsKg: '0.16 KG',
              porcentajeMerma: '2.00%',
              costoFinal: 1841.10,
              fechaCambio: '2024-10-30T00:00:00',
              asignado: false
            },
            {
              materialPrimeraFase: 'Emulsificante Vegetal',
              materiaPrimaBasica: 'Lecitina de Soya',
              costo: 145.00,
              cantidadLtsKg: '8.0 KG',
              costoTotal: 1690.00,
              productoMermaLtsKg: '0.16 KG',
              porcentajeMerma: '2.00%',
              costoFinal: 1723.80,
              fechaCambio: '2024-08-15T00:00:00',
              asignado: false
            }
          ]
        }
      ];
      return;
    }

    // Obtener datos normales del servicio para otros tipos
    return this.materialsService.getMaterials(this.idRoot, this.type).subscribe(
      (data: any) => {
        this.rowData = data;
        console.log(this.rowData)
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  obtenerMedidas() {
    this.catalogsService.getCatalogs(this.idRoot, 'MEASURE').subscribe(
      (data: Icatalog[]) => {
        this.medidas = data;
      },
      (error) => console.error('Error fetching measures:', error)
    );
  }

  obtenerFamilias() {
    this.catalogsService.getFamilyById(this.idRoot).subscribe(
      (data: Icatalog[]) => {
        this.familias = data;
      },
      (error) => console.error('Error fetching families:', error)
    );
  }

  obtenerSubfamilias() {
    this.catalogsService.getCatalogs(this.idRoot, 'SUBFAMILY').subscribe(
      (data: Icatalog[]) => {
        this.subfamilias2 = data;
      },
      (error) => console.error('Error fetching subfamilies:', error)
    );
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
  obtenerUbicaciones() {
    this.catalogsService.getCatalogs(this.idRoot, 'UBICATION').subscribe(
      (data: Icatalog[]) => {
        this.ubicaciones = data;
      },
      (error) => console.error('Error fetching locations:', error)
    );
  }

  obtenerProveedores() {
    return new Promise((resolve) => {
      this.customerService
        .getCustomers(this.branchSelect, this.type)
        .subscribe({
          next: (data: any) => {
            this.proveedoresData = data;
            resolve(true);
          },
          error: (error) => {
            console.error('Error obteniendo datos:', error);
            resolve(false);
          }
        });
    });
  }  

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
      this.selectedFamily = this.selectedRowData.idFamilia;
      this.material.description = this.selectedRowData.description;
      const foundMeasure = this.medidas.find(
        (item) => item.id === this.selectedRowData.idMedida
      );
      this.material.measure = foundMeasure ? foundMeasure.description : '';
      this.material.picture = this.selectedRowData.picture;
    } else {
      this.selectedRowData = null;
    }
  }

  async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
    const colId = event.column.getColId();
    const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
    const selectedId = selectedRowData.id; // Obtener el ID del registro

    this.notSavedChanges = true;

    if (colId === 'insumo') {
      // Filtrar el grid para mostrar solo el registro con el ID seleccionado
      const filterModel = {
        id: {
          type: 'equals',
          filter: selectedId,
        },
      };

      this.priceXproductsData.set(selectedRowData.pricePresentations);
      this.idMaterial.set(selectedRowData.id);
      this.gridApi.setFilterModel(filterModel);
      this.gridApi.onFilterChanged();
      this.activatedTabs();
    }
    if (colId === 'idProveedor') {
      // Filtrar el grid para mostrar solo el registro con el ID seleccionado
      const filterModel = {
          id: {
            type: 'equals',
            filter: selectedId,
          },
        };
        this.signalsService.setIdMaterial(selectedId);
        this.gridApi.setFilterModel(filterModel);
        this.gridApi.onFilterChanged();
        this.activatedTabsProveedoresByBranch();
      };

    // Puedes agregar lógica adicional aquí si necesitas guardar los datos seleccionados
    this.selectedRowData = selectedRowData;
  }

  // TODO para futuros botones de navegacion
  async selectTab(tab: string) {
    await this.activateMeasureTab();
  }

  async activatedTabs() {
    if (!this.isOpen) {
      await this.adjustGridSize();
      this.activateMeasureTab();
      this.showContainerTabs = true;
      this.isOpen = true;
    } else {
      await this.resetGridSize();
      this.isOpen = false;
      this.showMeasureTab = false;
      this.showContainerTabs = false;
    }
  }

  async activatedTabsProveedoresByBranch() {
    if (!this.isOpen) {
      await this.adjustGridSize();
      this.activateMeasureTab();
      this.showContainerTabsProveedoresByBranch = true;
      this.isOpen = true;
    } else {
      await this.resetGridSize();
      this.isOpen = false;
      this.showMeasureTab = false;
      this.showContainerTabsProveedoresByBranch = false;
    }
  }

  async activateMeasureTab() {
    if (!this.isOpen || this.showSavingsTab) {
      await this.adjustGridSize();
      this.showMeasureTab = true;
      // this.showSavingsTab = false;
      // this.isOpen = true;
    }
  }

  async adjustGridSize() {
    this.gridHeight = '25vh'; // Adjust as needed
  }

  // async activateSavingsTab() {
  //   if (!this.isOpen || this.showLoansTab) {
  //     await this.adjustGridSize();
  //     this.showLoansTab = false;
  //     this.showSavingsTab = true;
  //     this.isOpen = true;
  //   } else {
  //     await this.resetGridSize();
  //     this.isOpen = false;
  //   }
  // }
  resetGridSize() {
    this.gridHeight = '80vh'; // Reset to default height
    this.showMeasureTab = false;
    this.showSavingsTab = false;
    if (this.gridApi) {
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
    }
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;

    /*if (event.data.idMedida) {
      event.data.idMedida = Number(event.data.idMedida);
    }
    /*if (event.colDef.field === 'idBranch') {
      const selectedBranch = event.newValue;
      const branchInfo = this.branchs?.find(
        (item) => item.name === selectedBranch
      );
        this.customerService
          .getCustomers(branchInfo.id, 'PROVIDERS')
          .subscribe({
            next: (data: any) => {
              this.proveedoresData = data;
            },
            error: (error) => {
              console.error('Error obteniendo datos:', error);
            }
          });
      if (bonusInfo) {
        event.data.quantity = parseFloat(bonusInfo.valueAddition);
      }
    }
    if (event.colDef.field === 'idProveedor') {
      const selectedProveedor = event.newValue;
      const proveedorInfo = this.proveedoresData?.find(
        (item) => item.nameContact === selectedProveedor
      );
        
      console.log(proveedorInfo.id)
      if (bonusInfo) {
        event.data.quantity = parseFloat(bonusInfo.valueAddition);
      }
    }*/
   
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onCellClicked(event: any): void {
    const colId = event.column.getColId();

    // Solo para Primera Fase y columnas clickeables
    if (this.type === 'PRIMERA_FASE' && (colId === 'historico' || colId === 'materiales' || colId === 'parametros')) {
      const node = event.node;
      const api = event.api;

      // Determinar el tipo de detalle según la columna
      let detailType = '';
      if (colId === 'historico') detailType = 'historico';
      if (colId === 'materiales') detailType = 'materiales';
      if (colId === 'parametros') detailType = 'parametros';

      // Verificar si ya está expandido con este mismo tipo de detalle
      const isCurrentlyExpanded = node.expanded && event.data.detailType === detailType;

      if (isCurrentlyExpanded) {
        // Si ya está expandido, colapsarlo y mostrar todas las filas
        node.setExpanded(false);

        // Mostrar todas las filas de nuevo
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

        // Ocultar todas las demás filas (altura 0)
        api.forEachNode((otherNode: any) => {
          if (otherNode.id !== node.id) {
            otherNode.setRowHeight(0);
          }
        });

        // Si la fila está expandida con otro tipo de detalle, cerrarla primero
        if (node.expanded && event.data.detailType !== detailType) {
          node.setExpanded(false);
        }

        // Asignar el tipo de detalle
        event.data.detailType = detailType;

        // Aplicar los cambios de altura
        api.onRowHeightChanged();

        // Expandir con el detalle correspondiente
        setTimeout(() => {
          node.setExpanded(true);
        }, 0);
      }
    }
  }

  addRow() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Agregó nuevo materials', 'Almacenes', this.trackingService.getEmail());
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idCompany: this.idRoot,
      insumo: '',
      articulo: '',
      description: '',
      date: new Date().toISOString(),
      idMedida: null,
      idFamilia: null,
      idSubfamilia: null,
      idUbication: null,
      aplicaResg: false,
      picture: '',
      costoMN: 0,
      costoDLL: 0,
      ventaMN: 0,
      ventaDLL: 0,
      stockMin: 0,
      stockMax: 0,
      vigente: true,
      active: true,
      typematerial: this.type,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    setTimeout(() => {
      const firstRowIndex = 0;

      this.gridApi.ensureIndexVisible(firstRowIndex);

      this.gridApi.startEditingCell({
        rowIndex: firstRowIndex,
        colKey: 'description'
      });
    }, 0);// Un pequeño retraso de 50ms
  }

  async saveChanges() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardó cambios en materials', 'Almacenes', this.trackingService.getEmail());
    /*const isValid = this.rowData.every(
      (item) => item.insumo && item.description
    );
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar todos los campos antes de guardar.',
        'error'
      );
      return;
    }*/

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.materialsService.addMaterial(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.materialsService.updateMaterial(row.id, cleanedData);
    });

    // Using concat to combine observables and lastValueFrom for async/await
    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );
      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      this.obtenerDatos(); // Refrescar los datos
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
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Eliminó materials', 'Almacenes', this.trackingService.getEmail());
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
    this.materialsService
      .deleteMaterial(id)
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
        this.notSavedChanges = false;
        this.selectedRowData = null;
      });
  }

  revert() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Deshizo cambios en materials', 'Almacenes', this.trackingService.getEmail());
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

  refresh() {
    this.obtenerFamilias();
    this.obtenerSubfamilias();
  }

  // Métodos para abrir el modal de Añadir Familia
  openAddFamilyModal() {
    const modal = document.getElementById('addFamilyModal');
    if (modal) {
      const bootstrapModal = new bootstrap.Modal(modal);
      bootstrapModal.show();
    }
  }

  openAddSubFamilyModal() {
    const modal = document.getElementById('addSubFamilyModal');
    if (modal) {
      const bootstrapModal = new bootstrap.Modal(modal);
      bootstrapModal.show();
    }
  }

  openAddLocationModal() {
    const modal = document.getElementById('addLocationModal');
    if (modal) {
      const bootstrapModal = new bootstrap.Modal(modal);
      bootstrapModal.show();
    }
  }

  onSubmitFamily() {
    if (this.newFamilyName) {
      this.catalogsService
        .addCatalog({
          id: 0,
          idCompany: this.idRoot,
          description: this.newFamilyName,
          type: 'FAMILY',
        })
        .subscribe(
          (response) => {
            alerts.basicAlert(
              'Éxito',
              'Familia añadida correctamente',
              'success'
            );
            this.obtenerFamilias();

            if (response.catalog.type === 'FAMILY' && this.selectedRowData) {
              this.selectedRowData.idFamilia = response.id;
              this.notSavedChanges = true;
            }

            const modal = document.getElementById('addFamilyModal');
            if (modal) {
              const bootstrapModal = bootstrap.Modal.getInstance(modal);
              bootstrapModal.hide();
            }
            this.newFamilyName = '';
          },
          (error) => {
            alerts.basicAlert('Error', 'No se pudo añadir la familia', 'error');
            console.error(error);
          }
        );
    }
  }

  onSubmitSubFamily() {
    if (this.newSubFamilyName && this.selectedFamily) {
      this.catalogsService
        .addCatalog({
          id: 0,
          description: this.newSubFamilyName,
          parentId: this.selectedFamily,
          type: 'SUBFAMILY',
        })
        .subscribe(
          (response) => {
            alerts.basicAlert(
              'Éxito',
              'Subfamilia añadida correctamente',
              'success'
            );
            this.obtenerSubfamilias();

            if (response.catalog.type === 'SUBFAMILY' && this.selectedRowData) {
              this.selectedRowData.idSubfamilia = response.id;
              this.notSavedChanges = true;
            }

            const modal = document.getElementById('addSubFamilyModal');
            if (modal) {
              const bootstrapModal = bootstrap.Modal.getInstance(modal);
              bootstrapModal.hide();
            }
            this.newSubFamilyName = '';
          },
          (error) => {
            alerts.basicAlert('Error', 'No se pudo añadir la familia', 'error');
            console.error(error);
          }
        );
    }
  }

  onSubmitLocation() {
    console.log('Intentando enviar ubicación:', {
      name: this.newLocationName,
      idRoot: this.idRoot,
    });

    if (this.newLocationName) {
      this.catalogsService
        .addCatalog({
          id: 0,
          idCompany: this.idRoot,
          description: this.newLocationName,
          type: 'UBICATION',
        })
        .subscribe(
          (response) => {
            console.log('Respuesta del servidor:', response);
            alerts.basicAlert(
              'Éxito',
              'Ubicación añadida correctamente',
              'success'
            );
            this.obtenerUbicaciones();

            if (this.selectedRowData) {
              this.selectedRowData.idUbication = response.id;
              this.notSavedChanges = true;
            }

            const modal = document.getElementById('addLocationModal');
            if (modal) {
              const bootstrapModal = bootstrap.Modal.getInstance(modal);
              bootstrapModal.hide();
            }
            this.newLocationName = '';
          },
          (error) => {
            console.error('Error al añadir ubicación:', error);
            alerts.basicAlert(
              'Error',
              'No se pudo añadir la ubicación',
              'error'
            );
          }
        );
    }
  }

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.notSavedChanges);
  }
}
