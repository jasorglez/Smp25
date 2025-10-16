import { Component, effect, HostListener, inject, signal } from '@angular/core';
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
export class MaterialsComponent implements CanComponentDeactivate {
  type: string = '';

  constructor(private router: Router) {
    this.route.data.subscribe((data) => {
      this.type = data['type']; // 'SALES' or 'CONSUMABLE'
    });

    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.obtenerDatos();
      this.obtenerMedidas();
      this.obtenerFamilias();
      this.obtenerSubfamilias();
      this.obtenerBranchs();
      this.obtenerProveedores();
      this.obtenerUbicaciones();
    });
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
      if (this.type === 'PRIMERA_FASE' && params.data.detailType === 'historico') {
        return { component: 'detailCellRendererHistorico' };
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
          field: 'materialPrimeraFase',
          headerName: 'Material Primera Fase',
          editable: true,
          width: 200,
          flex: 1
        },
        {
          field: 'materiaPrimaBasica',
          headerName: 'Materia Prima Basica',
          editable: true,
          width: 200,
          flex: 1
        },
        {
          field: 'costo',
          headerName: 'Costo',
          editable: true,
          width: 120,
          valueFormatter: (params) => {
            return params.value ? `$${params.value.toFixed(2)}` : '$0.00';
          }
        },
        {
          field: 'cantidadLtsKg',
          headerName: 'Cantidad LTS/KG',
          editable: true,
          width: 140
        },
        {
          field: 'proporcion',
          headerName: 'Proporcion',
          editable: true,
          width: 120
        },
        {
          field: 'porDefinir',
          headerName: 'Por Definir',
          editable: true,
          width: 120
        },
        {
          field: 'costoTotal',
          headerName: 'Costo Total',
          editable: true,
          width: 120,
          valueFormatter: (params) => {
            return params.value ? `$${params.value.toFixed(2)}` : '$0.00';
          }
        },
        {
          field: 'productoMermaLtsKg',
          headerName: 'Producto Merma LTS/KG',
          editable: true,
          width: 180
        },
        {
          field: 'porcentajeMerma',
          headerName: 'Porcentaje Merma(2%)',
          editable: true,
          width: 160
        },
        {
          field: 'costoFinal',
          headerName: 'Costo Final',
          editable: true,
          width: 120,
          valueFormatter: (params) => {
            return params.value ? `$${params.value.toFixed(2)}` : '$0.00';
          }
        },
        {
          field: 'fechaCambio',
          headerName: 'Fecha Cambio',
          editable: true,
          width: 120,
          valueFormatter: (params) => {
            if (params.value) {
              return params.value.split('T')[0];
            }
            return '';
          }
        },
        {
          field: 'lote',
          headerName: 'Lote',
          editable: true,
          width: 120
        },
        {
          field: 'parametros',
          headerName: 'Parametros',
          editable: true,
          width: 150,
          flex: 1
        },
        {
          field: 'historico',
          headerName: 'Historico',
          editable: false,
          width: 120,
          cellStyle: { backgroundColor: '#f3e5f5', cursor: 'pointer', textDecoration: 'underline' },
          cellRenderer: (params: any) => {
            const div = document.createElement('div');
            div.innerText = 'Ver Histórico';
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
          materialPrimeraFase: 'Salsa Picante Premium',
          materiaPrimaBasica: 'Chile Habanero',
          costo: 125.50,
          cantidadLtsKg: '15.5 KG',
          proporcion: '25%',
          porDefinir: 'Especias',
          costoTotal: 1850.75,
          productoMermaLtsKg: '0.31 KG',
          porcentajeMerma: '2%',
          costoFinal: 1887.77,
          fechaCambio: '2025-01-15T00:00:00',
          lote: 'LT-2025-001',
          parametros: 'Temp: 4-8°C, pH: 3.5-4.0',
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
          materialPrimeraFase: 'Base Chocolate Obscuro',
          materiaPrimaBasica: 'Cacao en Polvo',
          costo: 285.00,
          cantidadLtsKg: '22.8 KG',
          proporcion: '45%',
          porDefinir: 'Azúcar',
          costoTotal: 3250.60,
          productoMermaLtsKg: '0.46 KG',
          porcentajeMerma: '2%',
          costoFinal: 3315.61,
          fechaCambio: '2025-01-10T00:00:00',
          lote: 'LT-2025-002',
          parametros: 'Temp: 18-22°C, Humedad: <50%',
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
          materialPrimeraFase: 'Aderezo Ranch Especial',
          materiaPrimaBasica: 'Crema Ácida',
          costo: 98.75,
          cantidadLtsKg: '12.0 LTS',
          proporcion: '35%',
          porDefinir: 'Hierbas',
          costoTotal: 1420.80,
          productoMermaLtsKg: '0.24 LTS',
          porcentajeMerma: '2%',
          costoFinal: 1449.22,
          fechaCambio: '2025-01-12T00:00:00',
          lote: 'LT-2025-003',
          parametros: 'Temp: 2-6°C, Caducidad: 30 días',
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
          materialPrimeraFase: 'Conservador Natural',
          materiaPrimaBasica: 'Ácido Cítrico',
          costo: 45.20,
          cantidadLtsKg: '5.5 KG',
          proporcion: '10%',
          porDefinir: 'Sal',
          costoTotal: 625.30,
          productoMermaLtsKg: '0.11 KG',
          porcentajeMerma: '2%',
          costoFinal: 637.81,
          fechaCambio: '2025-01-08T00:00:00',
          lote: 'LT-2025-004',
          parametros: 'Temp: Ambiente, pH: 2.0-3.0',
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
          materialPrimeraFase: 'Emulsificante Vegetal',
          materiaPrimaBasica: 'Lecitina de Soya',
          costo: 165.90,
          cantidadLtsKg: '8.2 KG',
          proporcion: '18%',
          porDefinir: 'Estabilizante',
          costoTotal: 1950.45,
          productoMermaLtsKg: '0.16 KG',
          porcentajeMerma: '2%',
          costoFinal: 1989.46,
          fechaCambio: '2025-01-14T00:00:00',
          lote: 'LT-2025-005',
          parametros: 'Temp: 15-25°C, No GMO',
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

    // Solo para Primera Fase y columna Historico
    if (this.type === 'PRIMERA_FASE' && colId === 'historico') {
      const node = event.node;
      const api = event.api;

      // Verificar si ya está expandido con detalle de historico
      const isCurrentlyExpanded = node.expanded && event.data.detailType === 'historico';

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
        if (node.expanded) {
          node.setExpanded(false);
        }

        // Asignar el tipo de detalle
        event.data.detailType = 'historico';

        // Aplicar los cambios de altura
        api.onRowHeightChanged();

        // Expandir con el detalle de historico
        setTimeout(() => {
          node.setExpanded(true);
        }, 0);
      }
    }
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idCompany: 1,
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
    const isValid = this.rowData.every(
      (item) => item.insumo && item.description
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
