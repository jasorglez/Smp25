import { Component, computed, effect, inject, Signal } from '@angular/core';
import { CatalogsService } from 'app/services/catalogs.service';
import { TablesxmodulesService } from 'app/services/tablesxmodules.service';
import { SignalsService } from 'app/services/signals.service';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { concat, EMPTY, lastValueFrom } from 'rxjs';
import { toArray } from 'rxjs/operators';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { CatFamSubComponent } from 'app/domains/Almacenes/components/cat-fam-sub/cat-fam-sub.component';
import { EleccionFamiliasComponent } from './eleccion-familias.component';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  RowSelectedEvent,
  CellDoubleClickedEvent
} from 'ag-grid-enterprise';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';


import { alerts } from '../../../../helpers/alerts';
import { AuthService } from 'app/services/auth.service';
import { SharedModule } from 'app/shared/shared.module';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { SubatalogsComponent } from "../../../ModWarehouse/components/catalogs/catalogs.component";
import { AutorizacionMontosComponent } from "../../../ModShoppingDelison/pages/subPages/autorizacion-montos/autorizacion-montos.component";
import { ProductosTerminadosComponent } from "../../../Almacenes/pages/productos-terminados/productos-terminados.component";
import { CondicionesPagoComponent } from "../../../ModShoppingDelison/pages/subPages/condiciones-pago/condiciones-pago.component";
import { DescripcionEmpaqueComponent } from "../../../ModShoppingDelison/pages/subPages/descripcion-empaque/descripcion-empaque.component";
import { UnidadesComponent } from "../../../ModShoppingDelison/pages/subPages/unidades/unidades.component";
import { DimensionesComponent } from "../../../ModShoppingDelison/pages/subPages/dimensiones/dimensiones.component";
import { PesoVolumenComponent } from "../../../ModShoppingDelison/pages/subPages/peso-volumen/peso-volumen.component";

//soriano
@Component({
  selector: 'app-catalogs',
  standalone: true,
  imports: [
    RouterModule,
    DomainsModule,
    AgGridModule,
    SharedModule,
    TranslateModule,
    SubatalogsComponent,
    CatFamSubComponent, EleccionFamiliasComponent,
    AutorizacionMontosComponent,
    ProductosTerminadosComponent,
    CondicionesPagoComponent,
    DescripcionEmpaqueComponent,
    UnidadesComponent,
    DimensionesComponent,
    PesoVolumenComponent
],
  templateUrl: './catalogs.component.html',
  styleUrl: './catalogs.component.scss',
})
export class CatalogsComponent implements CanComponentDeactivate {
  authService = inject(AuthService);
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  notSavedChanges: boolean = false;
  rowData: any;

  newlyAddedRows: string[] = [];
  table: any[] = [];
  selectedRowData: any = null;
  listsections: any[] = [];
  idRoot: number;
  selectedCatalog: string; // Variable para almacenar e
  showDetailsTab: boolean = false;
  typeCatalog: string;
  cat:boolean = false;
  montos:boolean = false;
  prodTerminado:boolean = false;
  condicionesPago:boolean = false;
  enConstruccion: string = '';
  requisicionesTab: string = 'autorizacion';
  materialesTab: string = 'empaque';
  gridHeight: string = '50vh';
  prefixAndConsecutive: any[] = [];
  private tempIdCounter: number = 0;
  private gridApi: GridApi;
  select: string;
  active: string = ""
   // --- Propiedades para el nuevo modal de Elección de Familias ---
  public showEleccionFamiliasModal = false;

  menuSelect: number;
  showWarehTab: Signal<boolean>;
  showAdmonTab: Signal<boolean>;
  selectedSection: any;
  idCatalog

  constructor(private route: ActivatedRoute) {
    effect(() => {
      this.permisos(this.signalsService.getCatalogSelected());
    if(this.signalsService.getCloseCatalog()()){
      this.notSavedChanges = false;
      this.idCatalog = null;
      if (this.gridApi) {
        this.gridApi.setFilterModel(null);
        this.gridApi.onFilterChanged();
      }
      this.gridHeight="50vh";
      this.signalsService.setCloseCatalog(false);
    }
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.route.paramMap.subscribe(params => {
        this.selectedSection = params.get('section')!;
      });
    this.obtenerTables();
    this.obtenerTablesSecitons();
    this.obtenerDatos();
    this.gridHeight="50vh"
    if (this.gridApi) {
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
    }
    
  },{ allowSignalWrites: true });
  }

  ngOnInit() {
    this.rowData = []
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    this.route.paramMap.subscribe(params => {
      this.selectedSection = params.get('section')!;
      this.signalsService.setSectionSelected('')
    });
    this.obtenerTables();
    this.obtenerTablesSecitons();
    this.obtenerDatos();
    this.gridHeight="50vh"

    if (this.gridApi) {
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
    }
  }

    // --- Métodos para el nuevo modal de Elección de Familias ---
  openEleccionFamiliasModal() {
    this.showEleccionFamiliasModal = true;
  }

  closeEleccionFamiliasModal() {
    this.showEleccionFamiliasModal = false;
  }

  refres(open: boolean){
    this.cat = open;
    this.montos = false;
    this.prodTerminado = false;
    this.condicionesPago = false;
    this.enConstruccion = '';
  }

  showMontos(){
    this.cat = false;
    this.montos = true;
    this.prodTerminado = false;
    this.condicionesPago = false;
    this.enConstruccion = '';
  }

  showProdTerminado(){
    this.cat = false;
    this.montos = false;
    this.prodTerminado = true;
    this.condicionesPago = false;
    this.enConstruccion = '';
  }

  showCondicionesPago(){
    this.cat = false;
    this.montos = false;
    this.prodTerminado = false;
    this.condicionesPago = true;
    this.enConstruccion = '';
  }

  showEnConstruccion(item: string){
    this.cat = false;
    this.montos = false;
    this.prodTerminado = false;
    this.condicionesPago = false;
    this.enConstruccion = item;
  }

  permisos(type: string){
    switch (type) {
        case 'RESOURCEHUMAN':
          this.typeCatalog = 'hr'
        break
        case 'ADMINISTRATION':
          this.typeCatalog = 'administration'
        break
        case 'SHOPPINGDELISON':
          this.typeCatalog = 'shoppingDelison'
        break
        case 'ALMACENES':
        case 'WAREHOUSE':
          this.typeCatalog = 'warehouses'
        break
    }
  }

  currentIndex = 0;
  private catalogService = inject(CatalogsService);
  private signalsService = inject(SignalsService);
  private tableService = inject(TablesxmodulesService);

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';

  
  onSectionSelected(item: any): void {
    this.signalsService.setSectionSelected(item.sections);
    this.rowData = [];
    this.selectedCatalog= '';
    this.idCatalog = null;
    this.obtenerTables(); // Cargar las tablas de la sección seleccionada
  }
  onOptionSelected(item: any): void {
    this.select = item.name
  }  
  onCatalogChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    this.selectedCatalog = selectElement.value; // Almacena el valor seleccionado
    this.obtenerDatos(); // Vuelve a ejecutar la consulta con el nuevo valor
  }
   async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
      // Verificar que event.data esté disponible antes de acceder a sus propiedades
      if (!event.data) {
        console.warn('No hay datos en la fila seleccionada');
        return;
      }
      
      if(this.select =="FAMILY"){
        const colId = event.column.getColId();
        const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
        this.idCatalog = selectedRowData.id; // Obtener el ID del registro 
        this.signalsService.setIdCatalogFamily(this.idCatalog)
        if (this.gridApi) {
          const filterModel = {
            id: {
              type: 'equals',
              filter: this.idCatalog,
            },
          };
          this.gridApi.setFilterModel(filterModel);
          this.gridApi.onFilterChanged();
          this.gridHeight="20vh"
        } else {
          alert('gridApi no disponible');
        }
   }
  }


  obtenerTables() {
    this.tableService
      .getTablesxmodules(this.signalsService.getCatalogSelected(), this.signalsService.getSectionSelected())
      .subscribe(
        (data: any) => {
          this.table = data;
        },
        (error) => {
          if (error.status == 404) this.table = [];
          console.error('Error fetching data:', error);
        }
      );
  }
  private readonly sectionOrder: Record<string, string[]> = {
    hr: ['EMPLEADOS', 'CHECADOR', 'NOMINA'],
  };

  obtenerTablesSecitons() {
    this.tableService
      .getTablesxmodulesSection(this.signalsService.getCatalogSelected())
      .subscribe(
        (data: any) => {
          const order = this.sectionOrder[this.typeCatalog];
          if (order) {
            this.listsections = [...data].sort((a, b) => {
              const ai = order.indexOf((a.sections ?? '').toUpperCase());
              const bi = order.indexOf((b.sections ?? '').toUpperCase());
              return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
            });
          } else {
            this.listsections = data;
          }
        },
        (error) => {
          if (error.status == 404) this.table = [];
          console.error('Error fetching data:', error);
        }
      );
  }

  obtenerDatos() {
    const catalogType = this.signalsService.getCatalogSelected();
    this.rowData = [];

    // Determina qué servicio usar
    const service = this.catalogService;
    service.getCatalogs(this.idRoot, this.selectedCatalog)
      .subscribe({
        next: (data: any[]) => {
          this.rowData = data 
},
        error: (err) => console.error(`Error (${catalogType || 'desconocido'}):`, err)
      });
  }

  

  //OPERACIONES DE LOS GRIDS

  get colMaster(): ColDef[] {
    return [
      {
        field: 'id',
        headerName: 'Id',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission(this.typeCatalog, 'catalogs','','','', 'update');
        },
        width: 80,
        hide:true,
        filter: 'agNumberColumnFilter', // Filtro para números (si el ID es numérico)
        filterParams: {
          filterOptions: ['equals'], // Opciones de filtro
        },
      },
      {
        field: 'valueAddition',
        headerName: 'name',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission(this.typeCatalog, 'catalogs','','','', 'update');
        },
        width: 100,
        hide: this.selectedCatalog !== 'TRABREALIZADO',
      },
      {
        field: 'description',
        headerName: 'Descripción',
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission(this.typeCatalog, 'catalogs','','','', 'update');
        },
        filter: true,
        width: 250,
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

          const duplicateExists = this.rowData.some(
            (row, index) =>
              index !== params.node.rowIndex &&
              row.description?.toUpperCase() === normalizedValue
          );

          if (duplicateExists) {
            alerts.basicAlert(
              'Nombre duplicado',
              `Ya existe un  con ese nombre.`,//${}
              'error'
            );
            return false;
          }

          params.data[params.colDef.field] = normalizedValue;
          return true;
        },
      },
      {
        field: 'valueAddition',
        headerName:
          this.selectedCatalog === 'BONUS'
            ? 'Monto'
            : this.selectedCatalog === 'CUSTOMERS'
            ? 'Color'
            : 'Campo',
        cellRenderer:
          this.selectedCatalog === 'CUSTOMERS' ? ColorPickerRenderer : '',
        cellRendererParams: {
          onChange: (valueAddition: string) => {},
        },

        valueFormatter: (params) => {
          //const foundItem = this.bonusCatalogos?.find((item) => item.id === params.value);
          //console.log(foundItem)
          //const value = foundItem ? foundItem.valueAddition : params.value;
          //console.log(value)
          if(this.selectedCatalog === 'BONUS'){
            return params.value
            ? `$${Number(params.value).toLocaleString('es-MX', {
                minimumFractionDigits: 2,
              })}`
            : '';
          }
          return params.value
        },

        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission(this.typeCatalog, 'catalogs','','','', 'update');
        },
        width: 100,
        hide:
          this.selectedCatalog !== 'BONUS' &&
          this.selectedCatalog !== 'CUSTOMERS'
      },
      {
        field: 'valueAdditionBit',
        headerName: 
        this.selectedCatalog === 'ABSENCES'
            ? 'Suma a horas ajustadas'
            : this.selectedCatalog === 'REASON'
            ? 'Aplicacion de horas a nomina'
            : 'Campo',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission(this.typeCatalog, 'catalogs','','','', 'update');
        },
        width: 200,
        hide:this.selectedCatalog !== 'ABSENCES' && this.selectedCatalog !== 'REASON'
      },
      {
        field: 'price',
        headerName: 'Precio',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission(this.typeCatalog, 'catalogs','','','', 'update');
        },
        width: 100,
        hide: this.selectedCatalog !== 'TRABREALIZADO',
        valueFormatter: (params) => {
          return params.value
          ? `$${Number(params.value).toLocaleString('es-MX', {
              minimumFractionDigits: 2,
            })}`
          : '';
        return params.value
        },
      },
      {
        field: 'vigente',
        headerName: 'Activo',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission(this.typeCatalog, 'catalogs','','','', 'update');
        },
        hide: this.idRoot == 18, // Solo mostrar si idRoot es 18
        width: 100,
      },
    ];
  }

  public frameworkComponents = {
    colorPickerRenderer: ColorPickerRenderer,
  };

  onSelectedRow(event: RowSelectedEvent): void {
    if (event.node && event.node.isSelected()) {
      // Verificar si la fila está seleccionada
      const selectedRowData = event.data;
      const selectedId = selectedRowData?.id;

      if (selectedId) {
        // Actualiza el servicio de señales
        this.signalsService.setProcces(parseInt(selectedId));

        // Asigna los datos seleccionados
        this.selectedRowData = selectedRowData;

        // Forzar la actualización del componente hijo
        this.showDetailsTab = false;
        setTimeout(() => {
          this.showDetailsTab = true;
        }, 0);
      }
    }
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 20,
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
  };

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedRowData = null;
    }
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

  ///OPERATIONS DE LOS GRABADOS
  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idCompany: this.idRoot,
      description: '',
      valueAddition: '',
      valueAdditionBit: true,
      type: this.selectedCatalog,
      vigente: true,
      active: 1,
      __isNew: true,
    };
    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
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
    const isValid = this.rowData.every((item) => item.description);
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

    // console.log('modifiedRows', modifiedRows);

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);

      cleanedData.valueAddition = String(cleanedData.valueAddition);
      return this, this.catalogService.addCatalog(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      cleanedData.valueAddition = String(cleanedData.valueAddition);
      return this.catalogService.updateCatalog(row.id, cleanedData);
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

  revert() {
    this.obtenerTables();
    this.obtenerDatos();
    this.notSavedChanges = false;
    //this.idCatalog = null;
    /*if (this.gridApi) {
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
    }
    this.gridHeight="50vh"*/
    
  }

  deleteEntry() {}

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.notSavedChanges);
  }
}

// Componente personalizado para el color picker
@Component({
  selector: 'color-picker-renderer',
  template: `
    <input
      type="color"
      [value]="color"
      (input)="onChange($event)"
      style="width: 100%; height: 100%; border: none;"
    />
  `,
})
export class ColorPickerRenderer implements ICellRendererAngularComp {
  public color: string = '#ffffff';
  public params: any;

  agInit(params: any): void {
    this.params = params;
    this.color = params.value || '#ffffff';
  }

  refresh(params: any): boolean {
    this.color = params.value;
    return true;
  }

  onChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.color = input.value;

    // Llama a la función onChange si existe
    if (this.params?.onChange) {
      this.params.onChange(this.color);
    }

    // ✅ ACTUALIZAR EL DATO EN LA FILA
    if (this.params?.data) {
      this.params.data[this.params.colDef.field] = this.color;
      this.params.data.__modified = true; // Marcar como modificado si aplica
    }
  }
}
