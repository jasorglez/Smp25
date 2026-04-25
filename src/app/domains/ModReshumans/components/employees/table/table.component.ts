import { Component, effect, HostListener, inject } from '@angular/core';
import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { catchError, EMPTY, lastValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { EmployeesService } from 'app/services/employees.service';
import { InegiService } from 'app/services/inegi.service';
import { SignalsService } from 'app/services/signals.service';
import { ModalService } from 'app/services/modal.service';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { States } from 'app/interface/states';
import { EmployeesxLoansComponent } from '../loans/loans.component';
import { AdministrationService } from 'app/services/administration.service';
import { EmployeesxSavingsComponent } from '../savings/savings.component';
import { EmpleadosxProyectosComponent } from '../proyectos/empleadosxproyectos.component';
import { TimeService } from 'app/services/time.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { BranchsService } from 'app/services/branchs.service';
import { RolesService } from 'app/services/roles.service';
import { AuthService } from 'app/services/auth.service';
import { environment } from '@env/environment';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';


@Component({
  selector: 'app-employees-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridModule,
    MultiLineEditorComponent,
    EmployeesxLoansComponent,
    EmployeesxSavingsComponent,
    EmpleadosxProyectosComponent,
  ],
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.scss'],
})
export class EmployeesTableComponent implements CanComponentDeactivate {
  // Inject of new way for Angular 18
  private imageHandlerService = inject(ImageHandlerService);
  private employeeService = inject(EmployeesService);
  private signalsService = inject(SignalsService);
  private modalServiceTable = inject(ModalService);
  private inegiService = inject(InegiService);
  private administrationService = inject(AdministrationService);
  private catalogService = inject(CatalogsService);
  private timeService = inject(TimeService);
  private branchesService = inject(BranchsService);
  authService = inject(AuthService);
  private rolesService = inject(RolesService);
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  id: number;
  idBranch: number;
  idRoot: number;
  idEmployee: number;
  idPosicionSelect: number;

  cp: string;
  infoCp: any;
  private estados: string[] = [];
  newlyAddedRows: string[] = []; // IDs de filas recién añadidas
  notSavedChanges: boolean = false;
  isAdvanced: boolean = false;

  rowData: any[] = [];
  banks: any[] = [];
  catalogGeneralPosiciones: any[] = [];
  depto: any[] = [];
  catalogPosiciones: any[] = [];
  position: any[] = [];
  branchs: any[] = [];
  catalogRoles: any[] = []

  // Variables de control del grid
  valorsenal: string = 'administrador';
  selectedRowData: any = null; // Fila seleccionada actualmente
  tempIdCounter: number = 0; // Contador para IDs temporales
  private gridApi: GridApi; // API del grid
  private isOpen: boolean = false; // Variable para controlar el modal de edición
  public defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: true,
    lockPosition: false,
    enableRowGroup: true,
  };
  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';

  // Declare the missing properties
  gridHeight: string = '80vh';
  showLoansTab: boolean = false;
  showSavingsTab: boolean = false;
  showProyectosTab: boolean = false;

  // Agregar esta nueva variable para almacenar el ID de la última fila editada
  private lastEditedRowId: number | string | null = null;
  private effectInitialized = false;

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent,
  };

  constructor() {
    effect(async () => {
      this.isAdvanced = this.signalsService.getIsAdvanced();
      if (this.signalsService.getRefreshEmployees()() == true) {
        await this.obtenerDatos(); // Actualizar datos cuando se recibe señal
        this.signalsService.resetRefreshEmployees(); // Resetear la señal después de actualizar
      }
    }, { allowSignalWrites: true });

    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      if (this.idBranch == null) {
        this.rowData = [];
        if (this.effectInitialized) {
          alerts.basicAlert(
            'Empleados',
            'Debe elegir una sucursal primero.',
            'error'
          );
        }
      } else {
        this.effectInitialized = true;
        this.getGeneralPosicion();
        this.getRoles()
        this.obtenerDatos();
        this.obtenerBranchs();
        this.getBanks();
        this.getDeptoandPosition();
        this.getStates();
      }
    });
  }

  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    rowBuffer: 20,
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
      // Puedes agregar aquí más lógica si es necesario, por ejemplo, actualizar datos seleccionados o activar pestañas
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
    onCellKeyDown: (params) => {
      if (params.event.key === 'Enter') {
        // Obtener todas las columnas editables
        const editableColumns = this.colMaster.filter((col) => col.editable);
        const currentColIndex = editableColumns.findIndex(
          (col) => col.field === params.column.getColDef().field
        );

        if (currentColIndex < editableColumns.length - 1) {
          // Añadir delay de 50ms antes de mover el foco
          requestAnimationFrame(() => {
            // Mover a la siguiente columna editable
            params.api.startEditingCell({
              rowIndex: params.node.rowIndex,
              colKey: editableColumns[currentColIndex + 1].field,
            });
          }); // Retraso para permitir que termine la edición actual
        }
        params.event.preventDefault(); // Prevenir comportamiento por defecto
      }
    },
    onCellDoubleClicked: this.onCellDoubleClicked.bind(this),
    onFirstDataRendered: (params) => {
      const allColumnIds: string[] = [];
      params.api.getColumns()?.forEach((column: any) => {
        allColumnIds.push(column.getId());
      });

      // Autoajustar todas las columnas al contenido (skipHeader=false considera header y datos)
      params.api.autoSizeColumns(allColumnIds, false);
    }
  };
  

  // CRÍTICO: Debe ser una propiedad cacheada, NO un getter puro, para evitar re-evaluación constante
  // que causa re-renderizado de filtros en cada ciclo de change detection
  private _colMaster: ColDef[] = [];

  get colMaster(): ColDef[] {
    // Si ya fue inicializado, retornar la misma instancia
    if (this._colMaster.length > 0) {
      return this._colMaster;
    }

    // Inicializar una sola vez basado en el modo
    if(this.isAdvanced == true){
    this._colMaster = [
      {
        headerName: '#',
        width: 50,
        valueGetter: (params) => params.node!.rowIndex! + 1,
        editable: false,
        pinned: 'left',
        cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold', textAlign: 'center' }
      },
      {
        field: 'id',
        headerName: 'Id',
        editable: false,
        width: 70,
        hide: false,
        filter: 'agNumberColumnFilter', // Filtro para números (si el ID es numérico)
        filterParams: {
          filterOptions: ['equals'], // Opciones de filtro
        },
      },
      {
        field: 'vigente',
        hide: this.idRoot == 18,
        headerName: 'Activo',        
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'employees','Emp_prin',  'update');
        },
        /*suppressMovable: true,
        filter: true,*/
        width: 100,
      },
      {
        field: 'idBranch',
        headerName: 'Nombre sucursal',
        headerClass: 'required-header',
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
          return this.authService.getCrudPermissionDetail('hr', 'employees','Emp_prin',  'update');
        },
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
        field: 'name',
        headerName: 'Nombre',
        headerClass: 'required-header',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'employees','Emp_prin', 'update');
        },
        suppressMovable: true,
        width: 270,
        filter: 'agSetColumnFilter',
        filterParams: {
          //excelMode: 'mac',
          defaultToNothingSelected: true,
        },
        cellStyle: (params) => this.validateRequiredField(params.value),
        cellEditor: 'autocompleteEditor',
        cellEditorParams: {
          filterList: this.rowData?.map((e) => e.name.toUpperCase()) || [],
          filterKey: 'name',
          placeholder: 'Buscar empleado...',
          minLength: 1,
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
      
          const duplicateExists = this.rowData.some(
            (row, index) =>
              index !== params.node.rowIndex &&
              row.name?.toUpperCase() === normalizedValue
          );
      
          if (duplicateExists) {
            alerts.basicAlert(
              'Nombre duplicado',
              'Ya existe un empleado con ese nombre.',
              'error'
            );
            return false;
          }
      
          params.data[params.colDef.field] = normalizedValue;
          return true;
        },
        valueFormatter: (params) => params.value || '',
      },
      {
        field: 'employeeCode',
        headerName: 'UserName22',
        hide: true,
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'employees','Emp_prin','update');
        },
        suppressMovable: true,
        width: 170,
        filter: 'agSetColumnFilter',
        filterParams: {
          defaultToNothingSelected: true,
        },
        cellEditor: 'autocompleteEditor',
        cellEditorParams: {
          filterList: this.rowData?.map((e) => e.employeeCode?.toUpperCase()) || [],
          filterKey: 'employeeCode',
          placeholder: 'Buscar código...',
          minLength: 1,
        },
        valueSetter: (params) => {
          const rawValue = params.newValue;
          const normalizedValue = rawValue ? rawValue.trim().toUpperCase() : '';

          if (normalizedValue) {
            const duplicateExists = this.rowData.some(
              (row, index) =>
                index !== params.node.rowIndex &&
                row.employeeCode?.toUpperCase() === normalizedValue
            );
            if (duplicateExists) {
              alerts.basicAlert('Código duplicado', 'Ya existe un empleado con ese código.', 'error');
              return false;
            }
          }

          params.data[params.colDef.field] = normalizedValue || null;
          return true;
        },
        valueFormatter: (params) => params.value || '',
      },
      {
        field: 'loan',
        headerName: 'Préstamos',
        editable: false,
        hide: true,
        filter: 'agNumberColumnFilter',
        suppressMovable: true,
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
        width: 110,
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
        field: 'saving',
        headerName: 'Ahorro',
        hide: true,
        editable: false,
        filter: 'agNumberColumnFilter',
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
        suppressMovable: true,
        width: 100,
        
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
        field: 'proyectos',
        headerName: 'Proyectos',
        editable: false,
        width: 110,
        sortable: false,
        filter: false,
        cellStyle: (params) => params.data?.__isNew
          ? { backgroundColor: '#e9ecef', cursor: 'not-allowed', textAlign: 'center', color: '#adb5bd' }
          : { backgroundColor: '#e8f4fd', cursor: 'pointer', textAlign: 'center', color: '#1a5276' },
        cellRenderer: (params) => params.data?.__isNew
          ? '<i class="bi bi-ban"></i>'
          : '<i class="bi bi-kanban"></i> Ver',
      },
      {
        field: 'priceXHour',
        headerName: 'Precio por hora *',
        hide: true,
        headerClass: 'required-header',
        cellStyle: (params) => this.validateRequiredField(params.value),
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'employees','Emp_prin',  'update');
        },
        filter: 'agNumberColumnFilter',
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
        width: 150,
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: {
          min: 0,
          max: 999999,
          precision: 2,
        },
        valueFormatter: (params) => {
          if (params.value) {
            return new Intl.NumberFormat('es-MX', {
              style: 'currency',
              currency: 'MXN',
            }).format(params.value);
          }
          return '';
        },
      },
      {
        field: 'baseHours',
        headerName: 'Horas base',
        hide: true,
        editable: false,
        valueFormatter: (params) => {
        const value = params.value;
        if (typeof value !== 'number' || isNaN(value)) return '';
      
        const hours = Math.floor(value);
        const minutes = Math.round((value - hours) * 60);
      
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      },
      },
      {
        field: 'idDepto',
        headerName: 'Departamento',
        headerClass: 'required-header',
        cellStyle: (params) => this.validateRequiredField(params.value),
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'employees','Emp_prin',  'update');
        },
        suppressMovable: true,
        filter: true,
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
        width: 190,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => {
          return {
            values: this.catalogRoles
              ? this.catalogRoles.map(item => item.id)
              : []
          };
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          const found = this.catalogRoles?.find(item => item.id === params.value);
          return found ? found.description : params.value;
        },
        valueSetter: (params) => {
          const newDeptId = params.newValue;

          if (params.data.idDepto === newDeptId) return false;

          params.data.idDepto = newDeptId;

          this.getPoscionesbyRole(newDeptId).then((posiciones) => {
            // Guardar las posiciones directamente en la fila
            this.catalogPosiciones = posiciones;

            // --- INICIO DE LA CORRECCIÓN ---
            // Verificar si la posición actual sigue siendo válida en el nuevo catálogo
            const currentPositionId = params.data.idPosition;
            const isPositionStillValid = posiciones.some(p => p.id === currentPositionId);

            // Si la posición ya no es válida, la reseteamos. Si no, la mantenemos.
            if (!isPositionStillValid) {
              params.data.idPosition = null;
            }
            // --- FIN DE LA CORRECCIÓN ---

            // Refrescar celdas
            if (this.gridApi) {
              this.gridApi.refreshCells({ rowNodes: [params.node], force: true });
            }
          });
        
          return true;
        },
        valueGetter: (params) => {
          // Handle potential null values and properly format the displayed value
          if (!params.data || !params.data.idDepto) return '';

          const foundDepto = this.catalogRoles
            ? this.catalogRoles.find((d) => d.id === params.data.idDepto)
            : null;

          return foundDepto ? foundDepto.description :'';
        },
        
        
      },
      {
        field: 'idPosition',
        headerName: 'Posicion',
        width: 190,
        headerClass: 'required-header',
        cellStyle: (params) => this.validateRequiredField(params.value),
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'employees','Emp_prin',  'update');
        },
        suppressMovable: true,
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
        filter: true, // Opcional: Ocultar el botón de filtro si no es para el usuario
        flex: 0,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => {
          return {
            values: this.catalogPosiciones
              ? this.catalogPosiciones.map(item => item.description)
              : []
          };
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
            const found = this.catalogGeneralPosiciones?.find(item => item.id == params.value);
            return found ? found.description : params.value;

        },
        valueSetter: (params) => {
          const selectedDesc = params.newValue;
          let found = this.catalogPosiciones?.find(p => p.description === selectedDesc);
          if (!found) found = this.catalogGeneralPosiciones?.find(p => p.description === selectedDesc);
          if (!found) return false;
          params.data.idPosition = found.id;
          return true;
        },
        valueGetter: (params) => {
          if (!params.data || params.data.idPosition == null) return '';
          const found = this.catalogGeneralPosiciones
            ? this.catalogGeneralPosiciones.find((d) => d.id == params.data.idPosition)
            : null;
          return found ? found.description : '';
        },
      },

      {
        field: 'idBank',
        headerName: 'Banco',
        hide: this.idRoot == 18,
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'employees','Emp_prin',  'update');
        },
        headerClass: 'required-header',
        cellStyle: (params) => this.validateRequiredField(params.value),
        suppressMovable: true,
        filter: true,
        filterParams: {
          defaultToNothingSelected: true,
        },
        width: 200,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => ({
          values: this.banks.map((b) => b.id),
        }),
        valueGetter: (params) => {
          if (!params.data || !params.data.idBank) return 'EFECTIVO';
          const foundBank = this.banks?.find((b) => b.id === params.data.idBank);
          return foundBank ? foundBank.name : 'EFECTIVO';
        },
        valueFormatter: (params) => {
          const foundBank = this.banks
            ? this.banks.find((b) => b.id === params.value)
            : null;
          return foundBank ? `${foundBank.name}` : params.value;
        },

      },
      {
        field: 'ingressDate',
        headerName: 'Fecha de ingreso',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'employees','Emp_prin',  'update');
        },
        filter: 'agDateColumnFilter',
        filterParams: {
          defaultToNothingSelected: true,
        },
        width: 150,
        cellEditor: 'agDateCellEditor',
        valueGetter: (params) => {
          // Asegurar que siempre devuelva un objeto Date
          if (!params.data.ingressDate) {
            return new Date();
          }
          return params.data.ingressDate instanceof Date
            ? params.data.ingressDate
            : new Date(params.data.ingressDate);
        },
        valueSetter: (params) => {
          // Asegurar que siempre se guarde como objeto Date
          if (!params.newValue) {
            params.data.ingressDate = new Date();
            return true;
          }

          const date = params.newValue instanceof Date
            ? params.newValue
            : new Date(params.newValue);

          if (isNaN(date.getTime())) {
            alerts.basicAlert('Error', 'Fecha inválida', 'error');
            return false;
          }

          params.data.ingressDate = date;
          return true;
        },
        valueFormatter: (params) => {
          try {
            if (!params.value) return '';
            const date = params.value instanceof Date ? params.value : new Date(params.value);
            if (isNaN(date.getTime())) return '';
            return `${('0' + date.getDate()).slice(-2)}-${('0' + (date.getMonth() + 1)).slice(-2)}-${date.getFullYear()}`;
          } catch {
            return '';
          }
        },
      },
      { field: 'username', hide: true, editable: false },
    ];
    } else {
      this._colMaster = [
      {
        headerName: '#',
        width: 50,
        hide: true,
        valueGetter: (params) => params.node!.rowIndex! + 1,
        editable: false,
        pinned: 'left',
        cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold', textAlign: 'center' }
      },
      {
        field: 'id',
        headerName: 'Id',
        editable: false,
        width: 70,
        hide: false,
        filter: 'agNumberColumnFilter', // Filtro para números (si el ID es numérico)
        filterParams: {
          filterOptions: ['equals'], // Opciones de filtro
        },
      },
      {
        field: 'vigente',
        hide: this.idRoot == 18,
        headerName: 'Activo',        
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'employees','Emp_prin',  'update');
        },
        /*suppressMovable: true,
        filter: true,*/
        width: 100,
      },
      /*{
        field: 'picture',
        headerName: 'Fotografía 2',
        cellRenderer: this.imageHandlerService.imageCellRenderer.bind(
          this.imageHandlerService
        ),
        cellRendererParams: {
          clicked: this.imageHandlerService.onImageCellClicked.bind(
            this.imageHandlerService
          ),
          field: 'picture',
        },
        editable: false,
        width: 100,
      },*/
      {
        field: 'idBranch',
        headerName: 'Nombre sucursal',
        headerClass: 'required-header',
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
          return this.authService.getCrudPermissionDetail('hr', 'employees','Emp_prin',  'update');
        },
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
        field: 'name',
        headerName: 'Nombre',
        headerClass: 'required-header',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'employees','Emp_prin',  'update');
        },
        suppressMovable: true,
        width: 270,
        filter: 'agSetColumnFilter',
        //esta es la busqueda correcta
        filterParams: {
          //excelMode: 'mac',
          defaultToNothingSelected: true,
        },
        cellStyle: (params) => this.validateRequiredField(params.value),
        cellEditor: 'autocompleteEditor',
        cellEditorParams: {
          filterList: this.rowData?.map((e) => e.name.toUpperCase()) || [],
          filterKey: 'name',
          placeholder: 'Buscar empleado...',
          minLength: 1,
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
      
          const duplicateExists = this.rowData.some(
            (row, index) =>
              index !== params.node.rowIndex &&
              row.name?.toUpperCase() === normalizedValue
          );
      
          if (duplicateExists) {
            alerts.basicAlert(
              'Nombre duplicado',
              'Ya existe un empleado con ese nombre.',
              'error'
            );
            return false;
          }
      
          params.data[params.colDef.field] = normalizedValue;
          return true;
        },
        valueFormatter: (params) => params.value || '',
      },
      {
        field: 'employeeCode',
        headerName: 'UserName',
        hide: true,
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'employees','Emp_prin',  'update');
        },
        suppressMovable: true,
        width: 170,
        filter: 'agSetColumnFilter',
        filterParams: {
          defaultToNothingSelected: true,
        },
        cellEditor: 'autocompleteEditor',
        cellEditorParams: {
          filterList: this.rowData?.map((e) => e.employeeCode?.toUpperCase()) || [],
          filterKey: 'employeeCode',
          placeholder: 'Buscar código...',
          minLength: 1,
        },
        valueSetter: (params) => {
          const rawValue = params.newValue;
          const normalizedValue = rawValue ? rawValue.trim().toUpperCase() : '';

          if (normalizedValue) {
            const duplicateExists = this.rowData.some(
              (row, index) =>
                index !== params.node.rowIndex &&
                row.employeeCode?.toUpperCase() === normalizedValue
            );
            if (duplicateExists) {
              alerts.basicAlert('Código duplicado', 'Ya existe un empleado con ese código.', 'error');
              return false;
            }
          }

          params.data[params.colDef.field] = normalizedValue || null;
          return true;
        },
        valueFormatter: (params) => params.value || '',
      },
      /*{
        field: 'email',
        headerName: 'Correo electrónico',
        //headerClass: 'required-header',
        //cellStyle: (params) => this.validateRequiredField(params.value),
        cellEditor: 'agTextCellEditor',
        editable: true,
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
                'Email duplicado',
                'Ya existe un empleado con ese correo electrónico.',
                'error'
              );
              return false;
            }

            params.data[params.colDef.field] = params.newValue;
            return true;
          } else {
            alerts.basicAlert(
              'Email inválido',
              'Formato de correo electrónico no válido.',
              'error'
            );
            return false;
          }
        },
        //filter: "agSetColumnFilter",
        //suppressMovable: true,
      },*/
      {
        field: 'loan',
        headerName: 'Préstamos',
        editable: false,
        hide: true,
        filter: 'agNumberColumnFilter',
        suppressMovable: true,
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
        width: 110,
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
        field: 'saving',
        headerName: 'Ahorro',
        hide: true,
        editable: false,
        filter: 'agNumberColumnFilter',
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
        suppressMovable: true,
        width: 100,
        
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
        field: 'proyectos',
        headerName: 'Proyectos',
        editable: false,
        width: 110,
        sortable: false,
        filter: false,
        cellStyle: (params) => params.data?.__isNew
          ? { backgroundColor: '#e9ecef', cursor: 'not-allowed', textAlign: 'center', color: '#adb5bd' }
          : { backgroundColor: '#e8f4fd', cursor: 'pointer', textAlign: 'center', color: '#1a5276' },
        cellRenderer: (params) => params.data?.__isNew
          ? '<i class="bi bi-ban"></i>'
          : '<i class="bi bi-kanban"></i> Ver',
      },
      {
        field: 'priceXHour',
        headerName: 'Precio por hora *',
        hide: true,
        headerClass: 'required-header',
        cellStyle: (params) => this.validateRequiredField(params.value),
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'employees','Emp_prin',  'update');
        },
        filter: 'agNumberColumnFilter',
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
        width: 150,
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: {
          min: 0,
          max: 999999,
          precision: 2,
        },
        valueFormatter: (params) => {
          if (params.value) {
            return new Intl.NumberFormat('es-MX', {
              style: 'currency',
              currency: 'MXN',
            }).format(params.value);
          }
          return '';
        },
      },
      {
        field: 'baseHours',
        headerName: 'Horas base',
        hide: true,
        editable: false,
        valueFormatter: (params) => {
        const value = params.value;
        if (typeof value !== 'number' || isNaN(value)) return '';
      
        const hours = Math.floor(value);
        const minutes = Math.round((value - hours) * 60);
      
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      },
      },
      {
        field: 'idDepto',
        headerName: 'Departamento',
        headerClass: 'required-header',
        cellStyle: (params) => this.validateRequiredField(params.value),
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'employees','Emp_prin',  'update');
        },
        suppressMovable: true,
        filter: true,
        filterParams: {
          defaultToNothingSelected: true,
        },
        width: 190,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => {
          return {
            values: this.catalogRoles
              ? this.catalogRoles.map(item => item.id)
              : []
          };
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          const found = this.catalogRoles?.find(item => item.id === params.value);
          return found ? found.description : params.value;
        },
        valueSetter: (params) => {
          const newDeptId = params.newValue;

          if (params.data.idDepto === newDeptId) return false;

          params.data.idDepto = newDeptId;

          this.getPoscionesbyRole(newDeptId).then((posiciones) => {
            this.catalogPosiciones = posiciones;

            const currentPositionId = params.data.idPosition;
            const isPositionStillValid = posiciones.some(p => p.id === currentPositionId);

            if (!isPositionStillValid) {
              params.data.idPosition = null;
            }

            if (this.gridApi) {
              this.gridApi.refreshCells({ rowNodes: [params.node], force: true });
            }
          });

          return true;
        },
        valueGetter: (params) => {
          if (!params.data || !params.data.idDepto) return '';

          const foundDepto = this.catalogRoles
            ? this.catalogRoles.find((d) => d.id === params.data.idDepto)
            : null;

          return foundDepto ? foundDepto.description :'';
        },

      },
      {
        field: 'idPosition',
        headerName: 'Posicion',
        width: 190,
        headerClass: 'required-header',
        cellStyle: (params) => this.validateRequiredField(params.value),
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'employees','Emp_prin',  'update');
        },
        suppressMovable: true,
        filterParams: {
          defaultToNothingSelected: true,
        },
        filter: true,
        flex: 0,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => {
          return {
            values: this.catalogPosiciones
              ? this.catalogPosiciones.map(item => item.description)
              : []
          };
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
            const found = this.catalogGeneralPosiciones?.find(item => item.id == params.value);
            return found ? found.description : params.value;

        },
        valueSetter: (params) => {
          const selectedDesc = params.newValue;
          let found = this.catalogPosiciones?.find(p => p.description === selectedDesc);
          if (!found) found = this.catalogGeneralPosiciones?.find(p => p.description === selectedDesc);
          if (!found) return false;
          params.data.idPosition = found.id;
          return true;
        },
        valueGetter: (params) => {
          if (!params.data || params.data.idPosition == null) return '';
          const found = this.catalogGeneralPosiciones
            ? this.catalogGeneralPosiciones.find((d) => d.id == params.data.idPosition)
            : null;
          return found ? found.description : '';
        },
      },

      {
        field: 'idBank',
        headerName: 'Banco',
        hide: this.idRoot == 18,
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'employees','Emp_prin',  'update');
        },
        headerClass: 'required-header',
        cellStyle: (params) => this.validateRequiredField(params.value),
        suppressMovable: true,
        filter: true,
        filterParams: {
          defaultToNothingSelected: true,
        },
        width: 200,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => ({
          values: this.banks.map((b) => b.id),
        }),
        valueGetter: (params) => {
          if (!params.data || !params.data.idBank) return 'EFECTIVO';
          const foundBank = this.banks?.find((b) => b.id === params.data.idBank);
          return foundBank ? foundBank.name : 'EFECTIVO';
        },
        valueFormatter: (params) => {
          const foundBank = this.banks
            ? this.banks.find((b) => b.id === params.value)
            : null;
          return foundBank ? `${foundBank.name}` : params.value;
        },

      },
      {
        field: 'ingressDate',
        headerName: 'Fecha de ingreso',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'employees','Emp_prin',  'update');
        },
        filter: 'agDateColumnFilter',
        filterParams: {
          defaultToNothingSelected: true,
        },
        width: 150,
        cellEditor: 'agDateCellEditor',
        valueGetter: (params) => {
          // Asegurar que siempre devuelva un objeto Date
          if (!params.data.ingressDate) {
            return new Date();
          }
          return params.data.ingressDate instanceof Date
            ? params.data.ingressDate
            : new Date(params.data.ingressDate);
        },
        valueSetter: (params) => {
          // Asegurar que siempre se guarde como objeto Date
          if (!params.newValue) {
            params.data.ingressDate = new Date();
            return true;
          }

          const date = params.newValue instanceof Date
            ? params.newValue
            : new Date(params.newValue);

          if (isNaN(date.getTime())) {
            alerts.basicAlert('Error', 'Fecha inválida', 'error');
            return false;
          }

          params.data.ingressDate = date;
          return true;
        },
        valueFormatter: (params) => {
          try {
            if (!params.value) return '';
            const date = params.value instanceof Date ? params.value : new Date(params.value);
            if (isNaN(date.getTime())) return '';
            return `${('0' + date.getDate()).slice(-2)}-${('0' + (date.getMonth() + 1)).slice(-2)}-${date.getFullYear()}`;
          } catch {
            return '';
          }
        },
      },
      { field: 'username', hide: true, editable: false },
    ];
    }

    // Retornar la instancia cacheada (inicializada en if o else)
    return this._colMaster;
  }

  // ==================== MASTER METHODS ====================

  obtenerBranchs() {
    this.branchesService.getBrancheswoa(this.idRoot).subscribe(
      (data: any) => {
        this.branchs = data;
        this.gridApi?.refreshCells({ force: true });
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  obtenerDatos() {
    return new Promise((resolve) => {
      this.employeeService.getEmployees(this.idBranch).subscribe(
        (data: any) => {
          if(this.authService.getCrudPermissionDetail('hr', 'employees','Emp_prin', 'read')){
            this.rowData = data;
          }else{
            this.rowData =[];
          }
          
          console.log('Datos obtenidos del servidor:', this.rowData);

          // Actualizar el grid y esperar a que termine
          this.gridApi.setGridOption('rowData', this.rowData);

          // Dar tiempo al grid para actualizar los datos
          setTimeout(() => {
            resolve(true);
          }, 100);
        },
        (error) => {
          console.error('Error fetching data:', error);
          resolve(false);
        }
      );
    });
  }

  getStates() {
    this.inegiService.getEstados().subscribe({
      next: (data: { datos: States[] }) => {
        this.estados = data.datos.map((estado) => estado.nom_agee);
        this.estados.unshift('Sin estado');
      },
      error: (error) => {
        console.error('Error fetching states', error);
      },
    });
  }
  getGeneralPosicion() {
    this.rolesService.getGeneralPosicion(this.idRoot).subscribe(
      (data: any) => {
        this.catalogGeneralPosiciones = data;
        this.gridApi?.refreshCells({ force: true });
      },
      (error) => {
        if (error.status == 404) this.catalogGeneralPosiciones = [];
        console.error('Error fetching data:', error);
      }
    );
  }

  getRoles() {
    this.rolesService.getCatalogRoles(this.idRoot).subscribe(
      (data: any) => {
        this.catalogRoles = data;
        this.gridApi?.refreshCells({ force: true });
      },
      (error) => {
        if (error.status == 404) this.catalogRoles = [];
        console.error('Error fetching data:', error);
      }
    );
  }
  getPoscionesbyRole(roles: number): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.rolesService.getCatalogPosiciones(this.idRoot, roles).subscribe({
        next: (data: any) => {
          
          resolve(data || []);
        },
        error: (error) => {
          if (error.status === 404) {
            resolve([]);
          } else {
            console.error('Error fetching posiciones:', error);
            reject(error);
          }
        }
      });
    });
  }

  // mandarlo a llamar de una funcion tools y  Reusamos codigo, la otra es el estandar para el log.....

  async getZipCodeData(cp: string): Promise<any> {
    try {
      const data = await lastValueFrom(this.inegiService.getZipCodeData(cp));
      this.infoCp = data;
      console.log(this.infoCp);
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

  getBanks() {
    this.administrationService.get2fieldsBanks().subscribe(
      (data: any) => {
        this.banks = [{ id: null, name: 'EFECTIVO' }, ...data];
        this.gridApi?.refreshCells({ force: true });
      },
      (error) => {
        if (error.status == 404) this.banks = [];
        console.error('Error fetching data:', error);
      }
    );
  }

  getDeptoandPosition() {
    this.catalogService.getCatalogsVigente(this.idRoot, 'DEPARTAMENT').subscribe(
      (data: any) => {
        this.depto = data;
      },
      (error) => {
        if (error.status == 404) this.depto = [];
        console.error('Error fetching data:', error);
      }
    );

    this.catalogService.getCatalogsVigente(this.idRoot, 'POSITION').subscribe(
      (data: any) => {
        this.position = data;
      },
      (error) => {
        if (error.status == 404) this.position = [];
        console.error('Error fetching data:', error);
      }
    );
  }

  onMasterSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
      this.idEmployee = this.selectedRowData.id;
      console.log('Datos de la fila seleccionada:', this.selectedRowData);

      this.signalsService.setIdEmployee(this.idEmployee);
    } else {
      this.selectedRowData = null;
    }
  }

  onMasterCellValueChanged(event: any) {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;
    // Si el campo cambiado es el código postal
    if (event.colDef.field === 'cp') {
      // Limpiar el neighborhood cuando cambia el CP
      event.data.neighborhood = '';

      this.getZipCodeData(event.newValue).then((data: any) => {
        if (data && data.length > 0) {
          const cpData = data[0];
          event.data.state = cpData.estado;
          event.data.city = cpData.ciudad || 'N/A'; // Usar 'N/A' si no hay ciudad

          // Actualizar el grid
          this.gridApi.applyTransaction({ update: [event.data] });
        }
      });
    }
  }

  onMasterGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    
  }

  onMasterRowSelected(event: any) {
    this.id = event.data.id;
  }

  async addMasterRow() {
    const timeData = await this.getTime();
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idBranch: this.idBranch > 0 ? this.idBranch : null,
      name: '',
      address: '',
      cp: '',
      employeeCode: '',
      city: '',
      neighborhood: '',
      rfc: '',
      state: '',
      phone: '',
      baseHours: 0,
      priceXHour: 1,
      ingressDate: timeData.dateObj, // Guardar como objeto Date
      position: '',
      email: '',
      picture: '',
      idDepto: 0,
      vigente: true,
      active: true,
      __isNew: true,
    };

    // Actualizar el estado
    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    // Encontrar el índice de la nueva fila
    const newRowIndex = this.rowData.findIndex((row) => row.id === tempId);

    // Encontrar la primera columna editable
    const firstEditableCol = this.colMaster.find((col) => col.editable);
    const firstEditableColKey = firstEditableCol
      ? firstEditableCol.field
      : null;

    // Usar setTimeout para asegurar que el grid haya renderizado la nueva fila
    setTimeout(() => {
      // Refrescar la celda de fecha para aplicar el valueFormatter
      const rowNode = this.gridApi.getDisplayedRowAtIndex(newRowIndex);
      if (rowNode) {
        this.gridApi.refreshCells({
          rowNodes: [rowNode],
          columns: ['ingressDate'],
          force: true
        });
      }

      if (firstEditableColKey) {
        this.gridApi.startEditingCell({
          rowIndex: newRowIndex,
          colKey: 'idBranch', // Editar la primera columna editable
        });
      }
    }, 100);

  }

  async saveMasterChanges() {
    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const rowsToSave = [...newRows, ...modifiedRows];

    if (rowsToSave.length === 0) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar.', 'info');
      return;
    }

    const invalidRow = rowsToSave.find(
      (item) =>
        !item.name ||
        !item.idBranch ||
        !item.idDepto ||
        !item.idPosition
    );
    if (invalidRow) {
      const missing: string[] = [];
      if (!invalidRow.name)       missing.push('Nombre');
      if (!invalidRow.idBranch)   missing.push('Sucursal');
      if (!invalidRow.idDepto)    missing.push('Departamento');
      if (!invalidRow.idPosition) missing.push('Posición');
      alerts.basicAlert(
        'Campos incompletos',
        `Faltan: ${missing.join(', ')}`,
        'error'
      );
      return;
    }

    try {
      await Promise.all([
        ...newRows.map((row) => lastValueFrom(this.employeeService.addEmployee(this.cleanDataForServer(row)))),
        ...modifiedRows.map((row) => lastValueFrom(this.employeeService.updateEmployee(row.id, this.cleanDataForServer(row)))),
      ]);

      // Determinar qué ID vamos a seleccionar después de recargar
      if (modifiedRows.length > 0) {
        // Si hay filas modificadas, guardamos el ID de la última modificada
        this.lastEditedRowId = modifiedRows[modifiedRows.length - 1].id;
      } else if (newRows.length > 0) {
        // Si hay filas nuevas, marcaremos que necesitamos seleccionar el ID máximo
        this.lastEditedRowId = 'SELECT_MAX_ID';
      }

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.newlyAddedRows = [];

      await this.obtenerDatos(); // Esperar a que se actualicen los datos

      // Seleccionar la fila apropiada después de recargar
      if (this.lastEditedRowId) {
        if (this.lastEditedRowId === 'SELECT_MAX_ID') {
          // Encontrar el ID máximo en los datos actuales
          const maxId = Math.max(...this.rowData.map((row) => Number(row.id)));
          this.selectRowById(maxId);
        } else {
          this.selectRowById(this.lastEditedRowId);
        }
        this.lastEditedRowId = null; // Resetear el ID
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

  private selectRowById(id: number | string) {
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

  deleteMasterEntry() {
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
    console.log('Datos del empleado a eliminar:', selectedData);

    // Validar que el préstamo sea 0 o no exista
    if (selectedData.loan && selectedData.loan !== 0) {
      alerts.basicAlert(
        'Error al eliminar',
        'No se puede eliminar el empleado mientras tenga préstamos activos',
        'error'
      );
      return;
    }

    const id = selectedData.id;
    selectedData.active = 0;
    alerts
      .confirmAlert(
        'Eliminar empleado',
        '¿Está seguro que desea eliminar este empleado?',
        'warning',
        'Sí, eliminar'
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.employeeService
            .deleteEmployee(id)
            .pipe(
              catchError((error) => {
                alerts.basicAlert(
                  'Eliminar empleado',
                  'Error al eliminar el empleado.',
                  'error'
                );
                console.error(error);
                return EMPTY;
              })
            )
            .subscribe(() => {
              alerts.basicAlert(
                'Empleado eliminado',
                'El empleado se eliminó correctamente',
                'success'
              );
              this.obtenerDatos();
              this.notSavedChanges = false;
              this.selectedRowData = null;
            });
        }
      });
  }

  revertMasterData() {
    this.obtenerDatos();
    this.notSavedChanges = false;
  }

  // ==================== UTILITY METHODS ====================

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    if (cleanedData.name) {
      cleanedData.username = cleanedData.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '');
    }
    return cleanedData;
  }

  private validateRequiredField(value: any): any {
    return {
      backgroundColor: !value ? '#fff3cd' : 'transparent',
      border: !value ? '2px solid #ff9966' : 'none',
    };
  }

  private async getTime(): Promise<{ dateObj: Date; formatted: string }> {
    const time = await lastValueFrom(this.timeService.getTime());
    const date = new Date(time.localTime);
    return {
      dateObj: date,
      formatted: `${('0' + date.getDate()).slice(-2)}-${(
        '0' +
        (date.getMonth() + 1)
      ).slice(-2)}-${date.getFullYear()}`,
    };
  }

  resetGridSize() {
    this.gridHeight = '80vh'; // Reset to default height
    this.showLoansTab = false;
    this.showSavingsTab = false;
    this.showProyectosTab = false;
    if (this.gridApi) {
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
    }
  }

  async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
    // Verificar que event.data esté disponible antes de acceder a sus propiedades
    if (!event.data) {
      console.warn('No hay datos en la fila seleccionada');
      return;
    }
  
    const colId = event.column.getColId();
    const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
    const selectedId = selectedRowData.id; // Obtener el ID del registro 
  
    this.notSavedChanges = true;
    this.selectedRowData = selectedRowData;
  
    // Filtrar el grid para mostrar solo el registro con el ID seleccionado
    if (colId === 'loan' || colId === 'saving' || (colId === 'proyectos' && !selectedRowData.__isNew)) {
      if (this.gridApi) {
        const filterModel = {
          id: {
            type: 'equals',
            filter: selectedId,
          },
        };
        this.gridApi.setFilterModel(filterModel);
        this.gridApi.onFilterChanged();
      } else {
        alert('gridApi no disponible');
      }
    }
  
    // Activar la pestaña de préstamos si la columna es 'loan'
    if (colId === 'loan') {
      try {
        await this.activateLoansTab();
      } catch (error) {
        console.error('Error activando la pestaña de préstamos:', error);
      }
    }
  
    // Activar la pestaña de ahorros si la columna es 'saving'
    if (colId === 'saving') {
      try {
        await this.activateSavingsTab();
      } catch (error) {
        console.error('Error activando la pestaña de ahorros:', error);
      }
    }

    // Activar la pestaña de proyectos si la columna es 'proyectos'
    if (colId === 'proyectos') {
      if (selectedRowData.__isNew) {
        alerts.basicAlert('Proyectos', 'Debe guardar el empleado antes de asignar proyectos.', 'warning');
        return;
      }
      try {
        await this.activateProyectosTab();
      } catch (error) {
        console.error('Error activando la pestaña de proyectos:', error);
      }
    }
  
    // Eliminar la asignación duplicada de selectedRowData
    // this.selectedRowData = selectedRowData; // Esta línea ya se encuentra al principio
  }
  async onCellClicked(event: any): Promise<void> {
    const colId = event.column.getColId();
    if (colId === 'idDepto') {
      const roleId = event.data.idDepto;
      console.log(event.data)
      if (roleId) {
        this.catalogPosiciones = await this.getPoscionesbyRole(roleId);
      } else {
        this.catalogPosiciones = [];
      }
    }
    if (colId === 'idPosition') {
      const selectedData = event.data;
      const roleId = event.data.idDepto;
      this.idPosicionSelect = event.data.idPosition
      if (roleId) {
        this.catalogPosiciones = await this.getPoscionesbyRole(roleId);
      } else {
        this.catalogPosiciones = [];
      }
    }
  }
  
  async activateLoansTab() {
    if (!this.isOpen || this.showSavingsTab || this.showProyectosTab) {
      await this.adjustGridSize();
      this.showLoansTab = true;
      this.showSavingsTab = false;
      this.showProyectosTab = false;
      this.isOpen = true;
    } else {
      await this.resetGridSize();
      this.isOpen = false;
    }
  }

  async activateSavingsTab() {
    if (!this.isOpen || this.showLoansTab) {
      await this.adjustGridSize();
      this.showLoansTab = false;
      this.showSavingsTab = true;
      this.showProyectosTab = false;
      this.isOpen = true;
    } else {
      await this.resetGridSize();
      this.isOpen = false;
    }
  }

  async activateProyectosTab() {
    if (!this.isOpen || this.showLoansTab || this.showSavingsTab) {
      await this.adjustGridSize();
      this.showLoansTab = false;
      this.showSavingsTab = false;
      this.showProyectosTab = true;
      this.isOpen = true;
    } else {
      await this.resetGridSize();
      this.isOpen = false;
    }
  }

  async adjustGridSize() {
    this.gridHeight = '20vh'; // Adjust as needed
  }

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.notSavedChanges);
  }
}
