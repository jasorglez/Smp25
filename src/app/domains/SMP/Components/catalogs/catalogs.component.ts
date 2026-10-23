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
import { TrackingService } from 'app/services/tracking.service';
import { RolesService } from 'app/services/roles.service';
import { PosicionesService } from 'app/services/posiciones.service';

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
    CatFamSubComponent, EleccionFamiliasComponent
],
  templateUrl: './catalogs.component.html',
  styleUrl: './catalogs.component.scss',
})
export class CatalogsComponent implements CanComponentDeactivate {
  authService = inject(AuthService);
  private trackingService = inject(TrackingService);
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  notSavedChanges: boolean = false;
  saving: boolean = false;
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
      console.log(this.listsections)
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
      this.selectedSection = this.signalsService.getSectionSelected();
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
    const sectionRoute = this.route.firstChild || this.route;
    sectionRoute.paramMap.subscribe(params => {
      const section = params.get('section') || '';
      this.selectedSection = section;
      this.signalsService.setSectionSelected(section);
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
  private rolesService = inject(RolesService);
  private positionsService = inject(PosicionesService);
  private signalsService = inject(SignalsService);
  private tableService = inject(TablesxmodulesService);
  private hrRoles: any[] = [];

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
          this.table = Array.isArray(data) ? data : [];
          const selected = this.table.find((item) => item.name === this.selectedCatalog) || this.table[0];
          if (selected) {
            this.selectedCatalog = selected.name;
            this.select = selected.name;
            this.obtenerDatos();
          } else {
            this.rowData = [];
          }
        },
        (error) => {
          if (error.status == 404) this.table = [];
          console.error('Error fetching data:', error);
        }
      );
  }
  obtenerTablesSecitons() {
    this.tableService
      .getTablesxmodulesSection(this.signalsService.getCatalogSelected())
      .subscribe(
        (data: any) => {
          this.listsections = data;
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
    console.log(`Obteniendo datos para tipo: ${catalogType}`);

    const isHrDepartmentCatalog = catalogType === 'RESOURCEHUMAN' && this.selectedCatalog === 'DEPARTAMENT';
    const isHrPositionCatalog = catalogType === 'RESOURCEHUMAN' && this.selectedCatalog === 'POSITION';

    if (isHrDepartmentCatalog || isHrPositionCatalog) {
      const isDepartmentCatalog = this.selectedCatalog === 'DEPARTAMENT';
      this.rolesService.getRoles(this.idRoot).subscribe({
        next: (response: any) => {
          this.hrRoles = Array.isArray(response) ? response : response?.data || [];
          if (isDepartmentCatalog) {
            this.rowData = this.hrRoles;
            return;
          }
          this.positionsService.getPositionsByCompany(this.idRoot).subscribe({
            next: (positions: any[]) => this.rowData = Array.isArray(positions) ? positions : [],
            error: (error) => {
              console.error('Error cargando puestos de Recursos Humanos:', error);
              this.rowData = [];
            }
          });
        },
        error: (error) => {
          console.error('Error cargando departamentos de Recursos Humanos:', error);
          this.hrRoles = [];
          this.rowData = [];
        }
      });
      return;
    }

    this.hrRoles = [];

    // Determina qué servicio usar
    const service = this.catalogService;
    service.getCatalogs(this.idRoot, this.selectedCatalog)
      .subscribe({
        next: (data: any[]) => {
          this.rowData = data 
         console.log(data)},
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
        field: 'idRoles',
        headerName: 'Departamento',
        hide: this.typeCatalog !== 'hr' || this.selectedCatalog !== 'POSITION',
        editable: (params) => params.data.__isNew || this.authService.getCrudPermission(this.typeCatalog, 'catalogs', '', '', '', 'update'),
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.hrRoles.map((role) => String(role.id)) }),
        valueFormatter: (params) => this.hrRoles.find((role) => Number(role.id) === Number(params.value))?.description || '',
        valueSetter: (params) => {
          const roleId = Number(params.newValue);
          if (!this.hrRoles.some((role) => Number(role.id) === roleId)) return false;
          params.data.idRoles = roleId;
          return true;
        },
        width: 180,
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
        valueGetter: (params) => this.typeCatalog === 'hr' ? params.data?.active : params.data?.vigente,
        valueSetter: (params) => {
          if (this.typeCatalog === 'hr') params.data.active = Boolean(params.newValue);
          else params.data.vigente = Boolean(params.newValue);
          return true;
        },
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
      if (this.typeCatalog === 'hr') {
        this.selectedRowData = selectedRowData;
        this.idCatalog = null;
        return;
      }
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
    console.log('Dato cambiado:', event.data);
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
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Agregó nuevo catalogs', 'Sistema', this.trackingService.getEmail());
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idCompany: this.idRoot,
      idRoles: this.typeCatalog === 'hr' && this.selectedCatalog === 'POSITION'
        ? this.hrRoles[0]?.id ?? null
        : null,
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
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardó cambios en catalogs', 'Sistema', this.trackingService.getEmail());
    if (this.saving) return;
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

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      cleanedData.valueAddition = String(cleanedData.valueAddition);
      if (this.typeCatalog === 'hr' && this.selectedCatalog === 'DEPARTAMENT') {
        return this.rolesService.addRoles({
          idCompany: this.idRoot,
          description: cleanedData.description,
          comment: cleanedData.comment || '',
          active: cleanedData.active !== false,
        });
      }
      if (this.typeCatalog === 'hr' && this.selectedCatalog === 'POSITION') {
        return this.positionsService.addPosition({
          idCompany: this.idRoot,
          idRoles: Number(cleanedData.idRoles),
          description: cleanedData.description,
          active: cleanedData.active !== false,
        });
      }
      return this.catalogService.addCatalog(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      cleanedData.valueAddition = String(cleanedData.valueAddition);
      if (this.typeCatalog === 'hr' && this.selectedCatalog === 'DEPARTAMENT') {
        return this.rolesService.updateRoles(String(row.id), {
          id: row.id,
          idCompany: this.idRoot,
          description: cleanedData.description,
          comment: cleanedData.comment || '',
          active: cleanedData.active !== false,
        });
      }
      if (this.typeCatalog === 'hr' && this.selectedCatalog === 'POSITION') {
        return this.positionsService.updatePosition(String(row.id), {
          id: row.id,
          idCompany: this.idRoot,
          idRoles: Number(cleanedData.idRoles),
          description: cleanedData.description,
          active: cleanedData.active !== false,
        });
      }
      return this.catalogService.updateCatalog(row.id, cleanedData);
    });

    this.saving = true;
    try {
      await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      this.obtenerDatos();
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    } finally {
      this.saving = false;
    }
  }

  revert() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Deshizo cambios en catalogs', 'Sistema', this.trackingService.getEmail());
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
