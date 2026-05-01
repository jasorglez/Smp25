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
import { catchError, concat, EMPTY, forkJoin, lastValueFrom, of, toArray } from 'rxjs';
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
import { SearchableSelectComponent } from 'app/shared/searchable-select/searchable-select.component';
import { States } from 'app/interface/states';
import { AdministrationService } from 'app/services/administration.service';
import { TimeService } from 'app/services/time.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { BranchsService } from 'app/services/branchs.service';
import { RolesService } from 'app/services/roles.service';
import { AuthService } from 'app/services/auth.service';
import { UsersService } from 'app/services/users.service';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { PermitionsService } from 'app/services/permitions.service';
import { environment } from '@env/environment';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { DetailEmployeeClockComponent } from '../detail-employee-clock/detail-employee-clock.component';
import { DetailEmployeeLoansComponent } from '../detail-employee-loans/detail-employee-loans.component';
import { DetailEmployeeSavingsComponent } from '../detail-employee-savings/detail-employee-savings.component';
import { DetailEmployeeDocumentsComponent } from '../detail-employee-documents/detail-employee-documents.component';
import { DetailEmployeePersonalDataComponent } from '../detail-employee-personal-data/detail-employee-personal-data.component';

@Component({
  selector: 'app-employees-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridModule,
    MultiLineEditorComponent,
    SearchableSelectComponent,
    DetailEmployeeClockComponent,
    DetailEmployeeLoansComponent,
    DetailEmployeeSavingsComponent,
    DetailEmployeeDocumentsComponent,
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
  private usersService = inject(UsersService);
  private usersxpermissionsService = inject(UsersxpermissionsService);
  private permitionsService = inject(PermitionsService);
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  id: number;
  idBranch: number;
  idRoot: number;
  idUser: number;
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
  usersCatalog: any[] = [];
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
  private digits: number = 4; // Nueva variable para configuración de dígitos
  private gridApi: GridApi; // API del grid
  public defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: true,
    lockPosition: false,
    enableRowGroup: true,
    suppressKeyboardEvent: (params) => {
      // Suppress Enter so we can handle it in onCellKeyDown
      return params.event.key === 'Enter';
    }
  };
  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';

  // Declare the missing properties
  gridHeight: string = '80vh';

  // Agregar esta nueva variable para almacenar el ID de la última fila editada
  private lastEditedRowId: number | string | null = null;
  private originalRowsById = new Map<number, any>();

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
    searchableSelectComponent: SearchableSelectComponent,
    detailEmployeeClock: DetailEmployeeClockComponent,
    detailEmployeeLoans: DetailEmployeeLoansComponent,
    detailEmployeeSavings: DetailEmployeeSavingsComponent,
    detailEmployeeDocuments: DetailEmployeeDocumentsComponent,
    detailEmployeePersonalData: DetailEmployeePersonalDataComponent,
  };

  detailMode: 'clock' | 'loans' | 'savings' | 'documents' | 'personalData' = 'clock';
  private expandingViaColumn = false;

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
      this.idUser = this.signalsService.getIdUSer()();
      if (!this.idRoot) return;
      this.getGeneralPosicion();
      this.getRoles();
      this.obtenerBranchs();
      this.getBanks();
      this.loadUsersCatalog();
      this.getDeptoandPosition();
      this.getStates();
    });

    effect(() => {
      const update = this.signalsService.getEmployeeBaseHoursUpdate()();
      if (!update || !this.gridApi) return;
      this.gridApi.forEachNode((node: any) => {
        if (node.data?.id === update.id) {
          node.data.baseHours = parseFloat(update.baseHours);
          this.gridApi.refreshCells({ rowNodes: [node], columns: ['baseHours'], force: true });
        }
      });
    });
  }

  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    rowBuffer: 20,
    masterDetail: true,
    isRowMaster: () => true,
    detailCellRendererSelector: () => {
      if (this.detailMode === 'loans') return { component: 'detailEmployeeLoans' };
      if (this.detailMode === 'savings') return { component: 'detailEmployeeSavings' };
      if (this.detailMode === 'documents') return { component: 'detailEmployeeDocuments' };
      if (this.detailMode === 'personalData') return { component: 'detailEmployeePersonalData' };
      return { component: 'detailEmployeeClock' };
    },
    detailRowHeight: 980,
    onRowGroupOpened: (event: any) => {
      if (!event.expanded) {
        event.api.setFilterModel(null);
        this.detailMode = 'clock';
      } else if (!this.expandingViaColumn) {
        this.detailMode = 'clock';
      }
      this.expandingViaColumn = false;
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
        // Obtener todas las columnas editables en el orden mostrado
        const displayedCols = params.api.getAllDisplayedColumns();
        const editableColumns = displayedCols.filter((col: any) => {
          const colDef = col.getColDef();
          if (typeof colDef.editable === 'function') {
            return colDef.editable({ ...params, column: col, colDef: colDef });
          }
          return colDef.editable === true;
        });

        const currentColIndex = editableColumns.findIndex(
          (col: any) => col.getColId() === params.column.getColId()
        );

        if (currentColIndex >= 0 && currentColIndex < editableColumns.length - 1) {
          params.api.stopEditing();
          
          const nextColId = editableColumns[currentColIndex + 1].getColId();
          params.api.setFocusedCell(params.node.rowIndex, nextColId);
          
          // CRITICAL: AG-Grid ignores startEditingCell if called synchronously inside an event handler
          setTimeout(() => {
            const nextColDef = params.api.getColumn(nextColId)?.getColDef();
            const isSelect = nextColDef?.cellEditor === 'agSelectCellEditor';
            
            params.api.startEditingCell({
              rowIndex: params.node.rowIndex,
              colKey: nextColId,
              key: isSelect ? ' ' : undefined // Usa espacio para abrir agSelect, evita Enter
            });
          }, 50);
        } else {
          params.api.stopEditing();
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
    },
    onColumnPinned: () => this.saveColumnState(),
    onColumnVisible: () => this.saveColumnState(),
    onColumnMoved: (event) => { if (event.finished) this.saveColumnState(); },
    onColumnResized: (event) => { if (event.finished) this.saveColumnState(); },
  };


  private readonly COLUMN_STATE_KEY = 'employees-table-column-state-v2';

  private saveColumnState(): void {
    if (!this.gridApi) return;
    localStorage.setItem(this.COLUMN_STATE_KEY, JSON.stringify(this.gridApi.getColumnState()));
  }

  private restoreColumnState(): void {
    const saved = localStorage.getItem(this.COLUMN_STATE_KEY);
    if (!saved || !this.gridApi) return;
    try {
      this.gridApi.applyColumnState({ state: JSON.parse(saved), applyOrder: true });
    } catch {
      localStorage.removeItem(this.COLUMN_STATE_KEY);
    }
  }

  // CRÍTICO: Debe ser una propiedad cacheada, NO un getter puro, para evitar re-evaluación constante
  // que causa re-renderizado de filtros en cada ciclo de change detection
  private _colMaster: ColDef[] = [];

  get colMaster(): ColDef[] {
    // Si ya fue inicializado, retornar la misma instancia
    if (this._colMaster.length > 0) {
      return this._colMaster;
    }

    // Inicializar una sola vez basado en el modo
    if (this.isAdvanced == true) {
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
          hide: true,
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
            return this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_prin', 'update');
          },
          /*suppressMovable: true,
          filter: true,*/
          width: 100,
        },
        {
          field: 'idBranch',
          headerName: 'Sucursal',
          headerClass: 'required-header',
          hide: false,
          editable: (params) => {
            if (params.data.__isNew) {
              return true;
            }
            return this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_prin', 'update');
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
            return this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_prin', 'update');
          },
          suppressMovable: true,
          width: 270,
          filter: 'agSetColumnFilter',
          filterParams: {
            //excelMode: 'mac',
            defaultToNothingSelected: true,
          },
          cellStyle: (params) => this.validateRequiredField(params.value),
          cellEditor: 'searchableSelectComponent',
          cellEditorParams: (params) => this.getEmployeeNameEditorParams(params),
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

            if (!/^[A-ZÁÉÍÓÚÑÜ\s'-]+$/i.test(normalizedValue)) {
              alerts.basicAlert('Nombre inválido', 'El nombre solo puede contener letras, espacios, guiones y apóstrofes.', 'error');
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
          headerClass: 'required-header',
          editable: (params) => {
            if (params.data.__isNew) {
              return true;
            }
            return this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_prin', 'update');
          },
          suppressMovable: true,
          width: 170,
          filter: 'agSetColumnFilter',
          cellStyle: (params) => this.validateRequiredField(params.value),
          filterParams: {
            defaultToNothingSelected: true,
          },
          //cellStyle: (params) => this.validateRequiredField(params.value),
          cellEditor: 'searchableSelectComponent',
          cellEditorParams: (params) => this.getEmployeeCodeEditorParams(params),
          valueSetter: (params) => {
            const rawValue = params.newValue;
            if (!rawValue || typeof rawValue !== 'string') {
              alerts.basicAlert('Campo requerido', 'El código es obligatorio.', 'error');
              return false;
            }

            const normalizedValue = rawValue.trim().toUpperCase();

            if (!normalizedValue) {
              alerts.basicAlert('Campo requerido', 'El código es obligatorio.', 'error');
              return false;
            }

            const duplicateExists = this.rowData.some(
              (row, index) =>
                index !== params.node.rowIndex &&
                row.employeeCode?.toUpperCase() === normalizedValue
            );

            if (duplicateExists) {
              alerts.basicAlert(
                'Código duplicado',
                'Ya existe un empleado con ese código.',
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
          field: 'clockPassword',
          headerName: 'Contraseña Reloj',
          width: 100,
          hide: this.idRoot == 18,
          editable: false,
          cellRenderer: (params: ICellRendererParams) => {
            // Mostrar valor real para nuevas filas, ocultar para existentes
            if (params.data.id.toString().startsWith('temp_')) {
              return params.value;
            }
            return '••••'; // Mostrar puntos para contraseñas existentes
          },
          onCellDoubleClicked: (params: CellDoubleClickedEvent) => {
            if (!params.data.id.toString().startsWith('temp_')) {
              alerts.basicAlert(
                'Contraseña Reloj',
                `La contraseña es: ${params.data.clockPassword}`,
                'info'
              );
            }
          },
        },
        {
          field: 'baseHours',
          headerName: 'Horas base',
          hide: this.idRoot == 18,
          editable: false,
          cellStyle: { backgroundColor: '#d4edda' },
          cellRenderer: (params: any) => {
            const v = params.value;
            let hoursStr = '';
            if (typeof v === 'number' && !isNaN(v)) {
              const h = Math.floor(v);
              const m = Math.round((v - h) * 60);
              hoursStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            }
            return `<span>${hoursStr}</span><span class="text-primary ms-2" style="cursor:pointer;font-size:0.75rem;text-decoration:underline"><i class="bi bi-clock me-1"></i>Ver</span>`;
          },
          onCellClicked: (params: any) => {
            const expand = !params.node.expanded;
            params.api.forEachNode((n: any) => { if (n.expanded) n.setExpanded(false); });
            if (expand) {
              params.api.setFilterModel({ id: { filterType: 'number', type: 'equals', filter: params.data.id } });
              params.node.setExpanded(true);
            }
          },
        },
        {
          field: 'documents',
          headerName: 'Docs',
          editable: false,
          suppressMovable: true,
          width: 70,
          cellRenderer: () => `<i class="bi bi-file-earmark-text" style="cursor:pointer;" title="Ver documentos del empleado"></i>`,
          cellStyle: { backgroundColor: '#cce5ff', textAlign: 'center' },
        },
        {
          field: 'loan',
          headerName: 'Préstamos',
          editable: false,
          hide: this.idRoot == 18 || !this.authService.hasSubDetailedPermission('hr', 'employees', 'Emp_Pre'),
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
          hide: this.idRoot == 18 || !this.authService.hasSubDetailedPermission('hr', 'employees', 'Emp_Aho'),
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
          field: 'priceXHour',
          headerName: 'Precio por hora *',
          hide: this.idRoot == 18,
          headerClass: 'required-header',
          cellStyle: (params) => this.validateRequiredField(params.value),
          editable: (params) => {
            if (params.data.__isNew) {
              return true;
            }
            return this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_prin', 'update');
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
          field: 'personalData',
          headerName: 'Datos Personales',
          editable: false,
          suppressMovable: true,
          width: 120,
          cellRenderer: () => `<i class="bi bi-person-lines-fill" style="cursor:pointer;" title="Ver datos personales"></i>`,
          cellStyle: { backgroundColor: '#e2d9f3', textAlign: 'center' },
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
            return this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_prin', 'update');
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
          onCellValueChanged: (params) => {
            const newRolId = params.newValue;
            if (newRolId && newRolId !== params.oldValue) {
              // Llama al método que recarga las posiciones válidas para ese rol
              this.getPoscionesbyRole(newRolId);
            }
          },
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

            return foundDepto ? foundDepto.description : '';
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
            return this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_prin', 'update');
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
            return this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_prin', 'update');
          },
          headerClass: 'required-header',
          cellStyle: (params) => this.validateRequiredField(params.value),
          suppressMovable: true,
          filter: true,
          filterParams: {
            // can be 'windows' or 'mac'
            defaultToNothingSelected: true,
            //excelMode: 'mac',
          },
          width: 200,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: () => ({
            values: this.banks.map((user) => user.id),
          }),
          valueGetter: (params) => {
            if (!params.data || !params.data.idBank) return 'EFECTIVO';
            const foundBank = this.banks?.find((user) => user.id === params.data.idBank);
            return foundBank ? foundBank.name : 'EFECTIVO';
          },
          valueFormatter: (params) => {
            const foundBank = this.banks
              ? this.banks.find((user) => user.id === params.value)
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
            return this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_prin', 'update');
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
          hide: true,
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
            return this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_prin', 'update');
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
          headerName: 'Sucursal',
          headerClass: 'required-header',
          hide: false,
          editable: (params) => {
            if (params.data.__isNew) {
              return true;
            }
            return this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_prin', 'update');
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
            return this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_prin', 'update');
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
          cellEditor: 'searchableSelectComponent',
          cellEditorParams: (params) => this.getEmployeeNameEditorParams(params),
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

            if (!/^[A-ZÁÉÍÓÚÑÜ\s'-]+$/i.test(normalizedValue)) {
              alerts.basicAlert('Nombre inválido', 'El nombre solo puede contener letras, espacios, guiones y apóstrofes.', 'error');
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
          headerClass: 'required-header',
          editable: (params) => {
            if (params.data.__isNew) {
              return true;
            }
            return this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_prin', 'update');
          },
          suppressMovable: true,
          width: 170,
          filter: 'agSetColumnFilter',
          cellStyle: (params) => this.validateRequiredField(params.value),
          filterParams: {
            defaultToNothingSelected: true,
          },
          //cellStyle: (params) => this.validateRequiredField(params.value),
          cellEditor: 'searchableSelectComponent',
          cellEditorParams: (params) => this.getEmployeeCodeEditorParams(params),
          valueSetter: (params) => {
            const rawValue = params.newValue;
            if (!rawValue || typeof rawValue !== 'string') {
              alerts.basicAlert('Campo requerido', 'El código es obligatorio.', 'error');
              return false;
            }

            const normalizedValue = rawValue.trim().toUpperCase();

            if (!normalizedValue) {
              alerts.basicAlert('Campo requerido', 'El código es obligatorio.', 'error');
              return false;
            }

            const duplicateExists = this.rowData.some(
              (row, index) =>
                index !== params.node.rowIndex &&
                row.employeeCode?.toUpperCase() === normalizedValue
            );

            if (duplicateExists) {
              alerts.basicAlert(
                'Código duplicado',
                'Ya existe un empleado con ese código.',
                'error'
              );
              return false;
            }

            params.data[params.colDef.field] = normalizedValue;
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
          field: 'clockPassword',
          headerName: 'Contraseña Reloj',
          width: 100,
          hide: this.idRoot == 18,
          editable: false,
          cellRenderer: (params: ICellRendererParams) => {
            // Mostrar valor real para nuevas filas, ocultar para existentes
            if (params.data.id.toString().startsWith('temp_')) {
              return params.value;
            }
            return '••••'; // Mostrar puntos para contraseñas existentes
          },
          onCellDoubleClicked: (params: CellDoubleClickedEvent) => {
            if (!params.data.id.toString().startsWith('temp_')) {
              alerts.basicAlert(
                'Contraseña Reloj',
                `La contraseña es: ${params.data.clockPassword}`,
                'info'
              );
            }
          },
        },
        {
          field: 'baseHours',
          headerName: 'Horas base',
          hide: this.idRoot == 18,
          editable: false,
          cellStyle: { backgroundColor: '#d4edda' },
          cellRenderer: (params: any) => {
            const v = params.value;
            let hoursStr = '';
            if (typeof v === 'number' && !isNaN(v)) {
              const h = Math.floor(v);
              const m = Math.round((v - h) * 60);
              hoursStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            }
            return `<span>${hoursStr}</span><span class="text-primary ms-2" style="cursor:pointer;font-size:0.75rem;text-decoration:underline"><i class="bi bi-clock me-1"></i>Ver</span>`;
          },
          onCellClicked: (params: any) => {
            const expand = !params.node.expanded;
            params.api.forEachNode((n: any) => { if (n.expanded) n.setExpanded(false); });
            if (expand) {
              params.api.setFilterModel({ id: { filterType: 'number', type: 'equals', filter: params.data.id } });
              params.node.setExpanded(true);
            }
          },
        },
        {
          field: 'documents',
          headerName: 'Docs',
          editable: false,
          suppressMovable: true,
          width: 70,
          cellRenderer: () => `<i class="bi bi-file-earmark-text" style="cursor:pointer;" title="Ver documentos del empleado"></i>`,
          cellStyle: { backgroundColor: '#cce5ff', textAlign: 'center' },
        },
        {
          field: 'loan',
          headerName: 'Préstamos',
          editable: false,
          hide: this.idRoot == 18,
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
          hide: this.idRoot == 18,
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
          field: 'priceXHour',
          headerName: 'Precio por hora *',
          hide: this.idRoot == 18,
          headerClass: 'required-header',
          cellStyle: (params) => this.validateRequiredField(params.value),
          editable: (params) => {
            if (params.data.__isNew) {
              return true;
            }
            return this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_prin', 'update');
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
          field: 'personalData',
          headerName: 'Datos Personales',
          editable: false,
          suppressMovable: true,
          width: 120,
          cellRenderer: () => `<i class="bi bi-person-lines-fill" style="cursor:pointer;" title="Ver datos personales"></i>`,
          cellStyle: { backgroundColor: '#e2d9f3', textAlign: 'center' },
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
            return this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_prin', 'update');
          },
          suppressMovable: true,
          filter: true,
          filterParams: {
            defaultToNothingSelected: true,
          },
          width: 190,
          cellEditor: 'agSelectCellEditor',
          onCellValueChanged: (params) => {
            const newRolId = params.newValue;
            if (newRolId && newRolId !== params.oldValue) {
              this.getPoscionesbyRole(newRolId);
            }
          },
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

            return foundDepto ? foundDepto.description : '';
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
            return this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_prin', 'update');
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
            return this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_prin', 'update');
          },
          headerClass: 'required-header',
          cellStyle: (params) => this.validateRequiredField(params.value),
          suppressMovable: true,
          filter: true,
          filterParams: {
            // can be 'windows' or 'mac'
            defaultToNothingSelected: true,
            //excelMode: 'mac',
          },
          width: 200,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: () => ({
            values: this.banks.map((user) => user.id),
          }),
          valueGetter: (params) => {
            if (!params.data || !params.data.idBank) return 'EFECTIVO';
            const foundBank = this.banks?.find((user) => user.id === params.data.idBank);
            return foundBank ? foundBank.name : 'EFECTIVO';
          },
          valueFormatter: (params) => {
            const foundBank = this.banks
              ? this.banks.find((user) => user.id === params.value)
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
            return this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_prin', 'update');
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
      ];
    }

    // Retornar la instancia cacheada (inicializada en if o else)
    return this._colMaster;
  }

  // ==================== MASTER METHODS ====================

  obtenerBranchs() {
    this.branchesService.getBranchesByUserAndCompany(this.idUser, this.idRoot).subscribe({
      next: (data: any) => {
        this.branchs = (data.project || []).map((row: any) => ({
          id: row.idPermission || row.idBranch || row.id,
          name: row.name || row.description || ''
        }));
        this.obtenerDatos();
      },
      error: (error) => console.error('Error fetching branches:', error)
    });
  }

  obtenerDatos() {
    return new Promise((resolve) => {
      if (!this.branchs || this.branchs.length === 0) {
        this.rowData = [];
        this.gridApi?.setGridOption('rowData', this.rowData);
        resolve(false);
        return;
      }

      const branchesToLoad = this.idBranch > 0
        ? this.branchs.filter(b => b.id === this.idBranch)
        : this.branchs;

      const requests = branchesToLoad.map(branch =>
        this.employeeService.getEmployees(branch.id).pipe(catchError(() => of([])))
      );

      forkJoin(requests).subscribe({
        next: (results: any[]) => {
          const allEmployees = results.flat();
          if (this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_prin', 'read')) {
            this.rowData = allEmployees;
          } else {
            this.rowData = [];
          }
          this.captureOriginalRows(this.rowData);
          this.gridApi.setGridOption('rowData', this.rowData);
          setTimeout(() => resolve(true), 100);
        },
        error: (error) => {
          console.error('Error fetching employees:', error);
          resolve(false);
        }
      });
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
        //console.log(this.catalogRoles)
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
      },
      (error) => {
        if (error.status == 404) this.banks = [];
        console.error('Error fetching data:', error);
      }
    );
  }

  private getEmployeeNameEditorParams(params: any) {
    return {
      options: this.buildEmployeeNameOptions(params),
      displayField: 'name',
      valueField: 'name',
      searchFields: ['name', 'email', 'employeeCode'],
      placeholder: 'Buscar empleado...',
      popupWidth: 310,
      onOptionSelected: (option: any) => this.applySelectedEmployeeToRow(option, params),
    };
  }

  private getEmployeeCodeEditorParams(params: any) {
    return {
      options: this.buildEmployeeCodeOptions(params),
      displayField: 'employeeCode',
      valueField: 'employeeCode',
      searchFields: ['employeeCode', 'name', 'email'],
      placeholder: 'Buscar código...',
      popupWidth: 310,
    };
  }

  private buildEmployeeNameOptions(params: any): any[] {
    const currentRowId = params?.data?.id;

    return (this.rowData || [])
      .filter((employee: any) => !employee?.__isNew && employee?.id !== currentRowId)
      .map((employee: any) => ({
        id: employee?.id ?? null,
        name: String(employee?.name ?? '').trim().toUpperCase(),
        email: String(employee?.email ?? '').trim(),
        employeeCode: String(employee?.employeeCode ?? '').trim().toUpperCase(),
        idBranch: employee?.idBranch ?? null,
      }))
      .filter((employee: any) => employee.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private buildEmployeeCodeOptions(params: any): any[] {
    const currentRowId = params?.data?.id;

    return (this.rowData || [])
      .filter((employee: any) => !employee?.__isNew && employee?.id !== currentRowId)
      .map((employee: any) => ({
        id: employee?.id ?? null,
        employeeCode: String(employee?.employeeCode ?? '').trim().toUpperCase(),
        name: String(employee?.name ?? '').trim().toUpperCase(),
        email: String(employee?.email ?? '').trim(),
      }))
      .filter((employee: any) => employee.employeeCode)
      .sort((a, b) => a.employeeCode.localeCompare(b.employeeCode));
  }

  private applySelectedEmployeeToRow(option: any, params: any): void {
    const row = params?.data;
    if (!row || !option) return;

    const selectedName = String(option.name ?? '').trim().toUpperCase();
    if (!selectedName) return;

    const rowIndex = params?.node?.rowIndex ?? -1;
    if (this.hasDuplicateEmployeeName(selectedName, rowIndex)) {
      return;
    }

    if (row.__isNew || !String(row.email ?? '').trim()) {
      row.email = option.email || '';
    }

    if (row.__isNew || !String(row.employeeCode ?? '').trim()) {
      row.employeeCode = option.employeeCode || '';
    }

    row.__linkedEmployeeId = option.id ?? null;

    if (this.gridApi && params?.node) {
      this.gridApi.refreshCells({
        rowNodes: [params.node],
        columns: ['employeeCode', 'email'],
        force: true,
      });
    }
  }

  private hasDuplicateEmployeeName(name: string, currentRowIndex: number): boolean {
    return this.rowData.some(
      (row, index) =>
        index !== currentRowIndex &&
        String(row?.name ?? '').trim().toUpperCase() === name
    );
  }

  loadUsersCatalog() {
    this.usersService.get2fieldsUsers(this.idRoot).subscribe({
      next: (data: any) => { this.usersCatalog = data?.data || data || []; },
      error: () => { this.usersCatalog = []; }
    });
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

      this.signalsService.setIdEmployee(this.idEmployee);
    } else {
      this.selectedRowData = null;
    }
  }

  onMasterCellValueChanged(event: any) {
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
    this.restoreColumnState();
  }

  onMasterRowSelected(event: any) {
    this.id = event.data.id;
  }

  async addMasterRow() {
    const timeData = await this.getTime();
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idBranch: this.idBranch > 0 ? this.idBranch : (this.branchs.length > 0 ? this.branchs[0].id : null),
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
      priceXHour: 0,
      ingressDate: timeData.dateObj, // Guardar como objeto Date
      position: '',
      email: '',
      picture: '',
      idDepto: 0,
      vigente: true,
      active: true,
      __isNew: true,
      clockPassword: this.generateUniqueClockPassword(),
    };

    // Actualizar el estado
    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    // Encontrar el índice de la nueva fila
    const newRowIndex = this.rowData.findIndex((row) => row.id === tempId);

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

      this.gridApi.startEditingCell({
        rowIndex: newRowIndex,
        colKey: 'idBranch',
        key: ' '
      });
    }, 100);

  }

  async saveMasterChanges() {
    const isValid = this.rowData.every(
      (item) =>
        item.name &&
        item.idBranch &&
        (item.employeeCode || item.email) &&
        item.idDepto && // se agregan dos inputs para la validación de los campos requeridos
        item.idPosition &&
        (item.priceXHour || this.idRoot == 18)
    );
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar los campos obligatorios antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );
    const branchChangedRows = modifiedRows.filter((row) => this.didBranchChange(row));
    const deptoPosChangedRows = modifiedRows.filter((row) => this.didDeptoPosChange(row));
    const nameChangedRows = modifiedRows.filter((row) => this.didNameChange(row));

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.employeeService.addEmployee(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.employeeService.updateEmployee(row.id, cleanedData);
    });

    try {
      await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );

      for (const row of branchChangedRows) {
        await this.syncUserPrincipalBranch(row);
      }
      for (const row of deptoPosChangedRows) {
        await this.syncUserDeptoPosPermission(row);
      }
      for (const row of nameChangedRows) {
        await this.syncUserDisplayName(row);
      }

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

      // Vincular empleados nuevos a su usuario si existe match por nombre
      for (const newRow of newRows) {
        await this.linkNewEmployeeToUser(newRow);
      }

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
    delete cleanedData.__linkedUserId;
    delete cleanedData.__linkedEmployeeId;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  private captureOriginalRows(rows: any[]): void {
    this.originalRowsById.clear();
    for (const row of rows || []) {
      const id = Number(row?.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      this.originalRowsById.set(id, {
        idBranch: Number(row?.idBranch ?? 0) || 0,
        idDepto: Number(row?.idDepto ?? 0) || 0,
        idPosition: Number(row?.idPosition ?? 0) || 0,
        email: String(row?.email ?? '').trim(),
        employeeCode: String(row?.employeeCode ?? '').trim(),
        name: String(row?.name ?? '').trim(),
      });
    }
  }

  private didBranchChange(row: any): boolean {
    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0) return false;
    const original = this.originalRowsById.get(id);
    if (!original) return false;
    const currentBranchId = Number(row?.idBranch ?? 0) || 0;
    return currentBranchId > 0 && currentBranchId !== Number(original.idBranch ?? 0);
  }

  private getOriginalBranchId(row: any): number {
    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0) return 0;
    const original = this.originalRowsById.get(id);
    return Number(original?.idBranch ?? 0) || 0;
  }

  private didDeptoPosChange(row: any): boolean {
    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0) return false;
    const original = this.originalRowsById.get(id);
    if (!original) return false;
    const curDepto = Number(row?.idDepto ?? 0) || 0;
    const curPos = Number(row?.idPosition ?? 0) || 0;
    const origDepto = Number(original.idDepto ?? 0) || 0;
    const origPos = Number(original.idPosition ?? 0) || 0;
    return (curDepto > 0 && curDepto !== origDepto) || (curPos > 0 && curPos !== origPos);
  }

  private didNameChange(row: any): boolean {
    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0) return false;
    const original = this.originalRowsById.get(id);
    if (!original) return false;
    return (row?.name ?? '').trim() !== (original.name ?? '').trim();
  }

  private async syncUserDisplayName(row: any): Promise<void> {
    const newName = (row?.name ?? '').trim();
    if (!newName) return;
    const employeeId = Number(row?.id);
    if (employeeId <= 0) return;

    try {
      const rawUsers = await lastValueFrom(
        this.usersService.getDataUsers(this.idRoot).pipe(catchError(() => of([])))
      );
      const users = this.toUsersArray(rawUsers);
      const linkedUser = users.find((u: any) => Number(u?.idEmpleado ?? u?.idEmployee ?? 0) === employeeId);
      if (!linkedUser) return;
      const userId = linkedUser.id ?? linkedUser.Id;
      if (!userId) return;
      await lastValueFrom(
        this.usersService.updateUser(userId, { ...linkedUser, displayName: newName }).pipe(catchError(() => of(null)))
      );
    } catch {
      // name sync is best-effort
    }
  }

  private getOriginalDepto(row: any): number {
    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0) return 0;
    return Number(this.originalRowsById.get(id)?.idDepto ?? 0) || 0;
  }

  private getOriginalPosition(row: any): number {
    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0) return 0;
    return Number(this.originalRowsById.get(id)?.idPosition ?? 0) || 0;
  }

  private normalizeMatchString(value: any): string {
    return String(value ?? '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private toUsersArray(raw: any): any[] {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.data)) return raw.data;
    if (Array.isArray(raw?.response?.data)) return raw.response.data;
    if (Array.isArray(raw?.project)) return raw.project;
    return [];
  }

  private toBranchPermissionRows(raw: any): any[] {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.project)) return raw.project;
    if (Array.isArray(raw?.data)) return raw.data;
    return [];
  }

  private async resolveUserIdsForEmployee(row: any): Promise<number[]> {
    const candidateIds = new Set<number>();
    const rawUsers = await lastValueFrom(
      this.usersService.getDataUsers(this.idRoot).pipe(catchError(() => of([])))
    );
    let users = this.toUsersArray(rawUsers);
    if (users.length === 0) {
      const allUsersResponse = await lastValueFrom(
        this.usersService.getAllUsers().pipe(catchError(() => of([])))
      );
      users = this.toUsersArray(allUsersResponse);
    }
    if (users.length === 0) return [...candidateIds];

    // Prefer active users to avoid touching stale duplicate accounts
    const activeUsers = users.filter((u: any) => Number(u?.active ?? 1) !== 0);
    const usersToSearch = activeUsers.length > 0 ? activeUsers : users;

    const targetName = this.normalizeMatchString(row?.name);
    const targetEmail = this.normalizeMatchString(row?.email);
    const targetCode = this.normalizeMatchString(row?.employeeCode);

    const exactNameMatches = usersToSearch.filter((user: any) => {
      const userName = this.normalizeMatchString(user?.displayName);
      return targetName.length > 0 && userName === targetName;
    });
    if (exactNameMatches.length > 0) {
      for (const user of exactNameMatches) {
        const userId = Number(user?.id ?? 0) || 0;
        if (userId > 0) candidateIds.add(userId);
      }
      return [...candidateIds];
    }

    for (const user of usersToSearch) {
      const userName = this.normalizeMatchString(user?.displayName);
      const userEmail = this.normalizeMatchString(user?.email);
      const userSmall = this.normalizeMatchString(user?.usersmall);
      const userId = Number(user?.id ?? 0) || 0;
      if (userId <= 0) continue;

      if (targetName.length > 0 && userName === targetName) {
        candidateIds.add(userId);
        continue;
      }
      if (
        targetName.length > 0 &&
        userName.length > 0 &&
        (userName.includes(targetName) || targetName.includes(userName))
      ) {
        candidateIds.add(userId);
        continue;
      }
      if (targetEmail && userEmail === targetEmail) {
        candidateIds.add(userId);
        continue;
      }
      if (targetCode && userSmall && userSmall === targetCode) {
        candidateIds.add(userId);
        continue;
      }
    }

    return [...candidateIds];
  }

  private async linkNewEmployeeToUser(newRow: any): Promise<void> {
    const targetName = this.normalizeMatchString(newRow?.name);
    if (!targetName) return;

    // Find the saved employee in reloaded rowData to get its real ID
    const saved = this.rowData.find(
      r => typeof r.id === 'number' && this.normalizeMatchString(r.name) === targetName
    );
    if (!saved) return;
    const employeeId = Number(saved.id);

    // Fetch users for this company
    const rawUsers = await lastValueFrom(
      this.usersService.getDataUsers(this.idRoot).pipe(catchError(() => of([])))
    );
    let users = this.toUsersArray(rawUsers);
    if (users.length === 0) {
      const allRaw = await lastValueFrom(this.usersService.getAllUsers().pipe(catchError(() => of([]))));
      users = this.toUsersArray(allRaw);
    }
    if (users.length === 0) return;

    const activeUsers = users.filter((u: any) => Number(u?.active ?? 1) !== 0);
    const pool = activeUsers.length > 0 ? activeUsers : users;

    const matches = pool.filter(
      (u: any) => this.normalizeMatchString(u?.displayName) === targetName
    );
    if (matches.length !== 1) return; // No match or ambiguous — skip

    const user = matches[0];
    const userId = Number(user?.id ?? 0);
    if (userId <= 0) return;

    // Don't overwrite an existing employee link
    const existingLink = Number(user?.idEmpleado ?? user?.idEmployee ?? 0);
    if (existingLink > 0) return;

    await lastValueFrom(
      this.usersService.updateUser(String(userId), { ...user, idEmpleado: employeeId })
        .pipe(catchError(() => of(null)))
    );
  }

  private async syncSingleUserPrincipalBranch(idUser: number, row: any): Promise<void> {
    const newBranchId = Number(row?.idBranch ?? 0) || 0;
    const oldBranchId = this.getOriginalBranchId(row);
    if (newBranchId <= 0 || oldBranchId <= 0 || newBranchId === oldBranchId) return;

    try {
      const rawPermissions = await lastValueFrom(
        this.usersxpermissionsService
          .getUsersxPermissionsGeneral('branch', idUser)
          .pipe(catchError(() => of([])))
      );
      const branchPermissions = this.toUsersArray(rawPermissions);

      const oldRow = branchPermissions.find((p: any) =>
        Number(p?.idPermission ?? p?.IdPermission ?? 0) === oldBranchId
      );
      const newRow = branchPermissions.find((p: any) =>
        Number(p?.idPermission ?? p?.IdPermission ?? 0) === newBranchId
      );

      // 1. Eliminar la sucursal anterior de la cascada
      const oldRowId = Number(oldRow?.id ?? oldRow?.Id ?? 0) || 0;
      if (oldRowId > 0) {
        await lastValueFrom(
          this.usersxpermissionsService
            .deleteUserxPermission(oldRowId)
            .pipe(catchError(() => of(null)))
        );
      }

      // 2. Agregar la nueva sucursal si aún no existe
      if (!newRow) {
        await lastValueFrom(
          this.usersxpermissionsService
            .addUserxPermission({
              idUser,
              idPermission: newBranchId,
              type: 'branch',
              description: null,
              active: 1,
            })
            .pipe(catchError(() => of(null)))
        );
      }

      // 3. Marcar la nueva sucursal como principal
      await lastValueFrom(
        this.usersxpermissionsService
          .setPrincipal(idUser, newBranchId)
          .pipe(catchError(() => of(null)))
      );
    } catch (error) {
      console.error('Error sincronizando sucursal principal del usuario:', error);
    }
  }

  private async syncUserPrincipalBranch(row: any): Promise<void> {
    const userIds = await this.resolveUserIdsForEmployee(row);
    if (userIds.length === 0) return;
    for (const idUser of userIds) {
      await this.syncSingleUserPrincipalBranch(idUser, row);
    }
  }

  private async syncSingleUserDeptoPosPermission(idUser: number, row: any): Promise<void> {
    const newDepto = Number(row?.idDepto ?? 0) || 0;
    const newPos = Number(row?.idPosition ?? 0) || 0;
    const oldDepto = this.getOriginalDepto(row);
    const oldPos = this.getOriginalPosition(row);
    const branchId = Number(row?.idBranch ?? 0) || 0;
    const oldBranchId = this.getOriginalBranchId(row) || branchId;

    if (newDepto <= 0 || newPos <= 0) return;
    if (oldDepto <= 0 || oldPos <= 0) return;
    if (newDepto === oldDepto && newPos === oldPos) return;

    try {
      // Obtener los combos existentes para verificar si el nuevo ya existe
      const rawCombos = await lastValueFrom(
        this.permitionsService.getRolYPosicion(idUser, branchId).pipe(catchError(() => of([])))
      );
      const combos: any[] = Array.isArray(rawCombos) ? rawCombos
        : Array.isArray(rawCombos?.data) ? rawCombos.data
          : [];

      const newComboExists = combos.some((c: any) =>
        Number(c?.idRole ?? c?.IdRole ?? 0) === newDepto &&
        Number(c?.idPosicion ?? c?.IdPosicion ?? 0) === newPos
      );

      // 1. Eliminar el combo anterior de la cascada
      await lastValueFrom(
        this.permitionsService.deleteRoles(idUser, oldBranchId, oldDepto, oldPos)
          .pipe(catchError(() => of(null)))
      );

      // 2. Agregar el nuevo combo solo si no existe ya
      if (!newComboExists) {
        await lastValueFrom(
          this.permitionsService.addPermitionsDetailBydescription({
            idUser,
            idBranch: branchId,
            idRole: newDepto,
            idPosicion: newPos,
            active: true,
          }).pipe(catchError(() => of(null)))
        );
      }

      // 3. Marcar el nuevo combo como principal
      await lastValueFrom(
        this.permitionsService.setPrincipal(idUser, branchId, newDepto, newPos)
          .pipe(catchError(() => of(null)))
      );
    } catch (error) {
      console.error('Error sincronizando departamento/posición del usuario:', error);
    }
  }

  private async resolveUserIdByEmployeeId(employeeId: number): Promise<number[]> {
    if (employeeId <= 0) return [];
    try {
      const rawUsers = await lastValueFrom(
        this.usersService.getDataUsers(this.idRoot).pipe(catchError(() => of([])))
      );
      const users = this.toUsersArray(rawUsers);
      return users
        .filter((u: any) => Number(u?.idEmpleado ?? u?.idEmployee ?? 0) === employeeId)
        .map((u: any) => Number(u?.id ?? 0))
        .filter((id: number) => id > 0);
    } catch { return []; }
  }

  private async syncUserDeptoPosPermission(row: any): Promise<void> {
    const employeeId = Number(row?.id ?? 0);
    let userIds = await this.resolveUserIdByEmployeeId(employeeId);
    if (userIds.length === 0) {
      userIds = await this.resolveUserIdsForEmployee(row);
    }
    if (userIds.length === 0) return;
    for (const idUser of userIds) {
      await this.syncSingleUserDeptoPosPermission(idUser, row);
    }
  }

  private generateUniqueClockPassword(): string {
    let isUnique = false;
    let password = '';

    while (!isUnique) {
      // Generar código con la cantidad de dígitos configurados
      const min = Math.pow(10, this.digits - 1);
      const max = Math.pow(10, this.digits) - 1;
      password = Math.floor(min + Math.random() * (max - min + 1))
        .toString()
        .padStart(this.digits, '0'); // Asegurar leading zeros

      // Verificar unicidad
      isUnique = !this.rowData.some((row) => row.clockPassword === password);
    }
    return password;
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
    this.gridHeight = '80vh';
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
  }

  async onCellClicked(event: any): Promise<void> {
    const colId = event.column.getColId();
    if (colId === 'idDepto') {
      const roleId = event.data.idDepto;
      if (roleId) {
        this.catalogPosiciones = await this.getPoscionesbyRole(roleId);
      } else {
        this.catalogPosiciones = [];
      }
    }
    if (colId === 'idPosition') {
      const roleId = event.data.idDepto;
      this.idPosicionSelect = event.data.idPosition
      if (roleId) {
        this.catalogPosiciones = await this.getPoscionesbyRole(roleId);
      } else {
        this.catalogPosiciones = [];
      }
    }
    if (colId === 'loan' || colId === 'saving' || colId === 'documents' || colId === 'personalData') {
      const rowNode = event.node;
      const newMode = colId === 'loan' ? 'loans' : colId === 'saving' ? 'savings' : colId === 'personalData' ? 'personalData' : 'documents';
      if (rowNode.expanded && this.detailMode === newMode) {
        rowNode.setExpanded(false);
        this.gridApi.setFilterModel(null);
        this.gridApi.onFilterChanged();
      } else {
        this.detailMode = newMode;
        this.expandingViaColumn = true;
        this.gridApi.setFilterModel({ id: { type: 'equals', filter: event.data.id } });
        this.gridApi.onFilterChanged();
        rowNode.setExpanded(true);
      }
    }
  }

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.notSavedChanges);
  }
}
