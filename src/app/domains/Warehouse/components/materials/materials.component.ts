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
    rowClass: (params) => {
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
    // onCellDoubleClicked: this.onCellDoubleClicked.bind(this),
  };

  get colMaster(): ColDef[] {
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

  obtenerDatos() {
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
