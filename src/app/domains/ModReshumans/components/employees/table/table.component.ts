import { Component, effect, HostListener, inject } from '@angular/core';
import {
  CellDoubleClickedEvent, IFilterComp,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { catchError, concat, EMPTY, lastValueFrom, toArray, tap } from 'rxjs';
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
import { HRService } from 'app/services/hr.service';
import { EmployeesxSavingsComponent } from '../savings/savings.component';
import { TimeService } from 'app/services/time.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { BranchsService } from 'app/services/branchs.service';
import { AuthService } from 'app/services/auth.service';

@Component({
  selector: 'app-employees-table',
  standalone: true,
  imports: [CommonModule,
    FormsModule,
    AgGridModule,
    MultiLineEditorComponent,
    EmployeesxLoansComponent,
    EmployeesxSavingsComponent,],
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.scss']
})
export class EmployeesTableComponent {
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
  private authService = inject(AuthService);

  id: number;
  idBranch: number;
  idRoot: number;
  idEmployee: number;

  cp: string;
  infoCp: any;
  private estados: string[] = [];
  newlyAddedRows: string[] = []; // IDs de filas recién añadidas
  notSavedChanges: boolean = false;

  rowData: any[] = [];
  banks: any[] = [];
  depto: any[] = [];
  position: any[] = [];
  branchs: any[] = [];

  // Variables de control del grid
  valorsenal: string = 'administrador';
  selectedRowData: any = null; // Fila seleccionada actualmente
  tempIdCounter: number = 0; // Contador para IDs temporales
  private digits: number = 4; // Nueva variable para configuración de dígitos
  private gridApi: GridApi; // API del grid
  private isOpen: boolean = false; // Variable para controlar el modal de edición
  public defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: true,
    lockPosition: false,
    enableRowGroup: true, // Enable row grouping for all columns
    flex: 1,
  };
  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';

  // Declare the missing properties
  gridHeight: string = '80vh';
  showLoansTab: boolean = false;
  showSavingsTab: boolean = false;

  // Agregar esta nueva variable para almacenar el ID de la última fila editada
  private lastEditedRowId: number | string | null = null;

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
      if (this.signalsService.getRefreshEmployees()() == true) {
        await this.obtenerDatos(); // Actualizar datos cuando se recibe señal
        this.signalsService.resetRefreshEmployees(); // Resetear la señal después de actualizar
      }
    });

    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      if (this.idBranch == null) {
        this.rowData = [];
        alerts.basicAlert(
          'Empleados',
          'Debe elegir una sucursal primero.',
          'error'
        );
      } else {
        this.obtenerDatos();
        this.obtenerBranchs();
        this.getBanks()
        this.getDeptoandPosition();
        this.getStates();
      }
    });
  }

  ngOnInit() {


  }

  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
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
    onCellKeyDown: (params) => {
      if (params.event.key === 'Enter') {
        // Obtener todas las columnas editables
        const editableColumns = this.colMaster.filter((col) => col.editable);
        const currentColIndex = editableColumns.findIndex(
          (col) => col.field === params.column.getColDef().field
        );

        if (currentColIndex < editableColumns.length - 1) {
          // Añadir delay de 50ms antes de mover el foco
          setTimeout(() => {
            // Mover a la siguiente columna editable
            params.api.startEditingCell({
              rowIndex: params.node.rowIndex,
              colKey: editableColumns[currentColIndex + 1].field,
            });
          }, 200); // Retraso para permitir que termine la edición actual
        }
        params.event.preventDefault(); // Prevenir comportamiento por defecto
      }
    },
    onCellDoubleClicked: this.onCellDoubleClicked.bind(this),
  };

  get colMaster(): ColDef[] {
    return [
      {
        field: 'id', headerName: 'Id', editable: false, width: 70, hide: false,
        filter: 'agNumberColumnFilter', // Filtro para números (si el ID es numérico)
        filterParams: {
          filterOptions: ['equals'], // Opciones de filtro
        },
      },
      {
        field: 'picture',
        headerName: 'Fotografía',
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
      },
      {
        field: 'idBranch',
        headerName: 'Nombre sucursal *',
        headerClass: 'required-header',
        hide: this.authService.hasDetailedPermission('principal', 'see-all-branches') ||
          this.signalsService.getemailChoose() === 'root@beapp.com.mx' ? false : true,
        editable: true,
        filter: true,
        width: 170,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => {
          // Ensure depto data is available when creating editor
          return {
            values: this.branchs ? this.branchs.map((item) => item.id) : []
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
      },
      {
        field: 'name',
        headerName: 'Nombre *',
        headerClass: 'required-header',
        editable: true,
        cellStyle: (params) => this.validateRequiredField(params.value),
        suppressMovable: true,
        filter: 'agSetColumnFilter',
        filterParams: {
          // can be 'windows' or 'mac'
          excelMode: 'mac',
        },
        width: 270,
        cellEditor: 'autocompleteEditor',
        cellEditorParams: {
          filterList: this.rowData.map((e) => e.name),
          filterKey: 'name',
          placeholder: 'Buscar empleado...',
          minLength: 1,
        },
        valueSetter: (params) => {
          if (!params.newValue || params.newValue.trim() === '') {
            alerts.basicAlert(
              'Campo requerido',
              'El nombre es obligatorio',
              'error'
            );
            return false;
          }
          const duplicateExists = this.rowData.some(
            (row, index) =>
              index !== params.node.rowIndex && row.name === params.newValue
          );

          if (duplicateExists) {
            alerts.basicAlert(
              'Nombre duplicado',
              'Ya existe un empleado con ese nombre.',
              'error'
            );
            return false;
          }

          params.data[params.colDef.field] = params.newValue;
          return true;
        },
      },
      {
        field: 'email',
        headerName: 'Correo electrónico *',
        headerClass: 'required-header',
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
        filter: true,
      },
      {
        field: 'clockPassword',
        headerName: 'Contraseña Reloj',
        width: 100,
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
        field: 'loan',
        headerName: 'Préstamos',
        editable: false,
        filter: 'agNumberColumnFilter',
        suppressMovable: true,
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
      },
      {
        field: 'saving',
        headerName: 'Ahorro',
        editable: false,
        filter: 'agNumberColumnFilter',
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
      },
      {
        field: 'idDepto',
        headerName: 'Departamento',
        editable: true,
        suppressMovable: true,
        filter: false,
        width: 190,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => {
          // Ensure depto data is available when creating editor
          return {
            values: this.depto ? this.depto.map((item) => item.id) : []
          };
        },
        valueFormatter: (params) => {
          // Handle potential null values and properly format the displayed value
          if (!params.value) return '';

          const foundDepto = this.depto
            ? this.depto.find((item) => item.id === params.value)
            : null;

          return foundDepto ? foundDepto.description : params.value;
        },
      },
      {
        field: 'idBank',
        headerName: 'Banco',
        editable: true,
        suppressMovable: true,
        filter: false,
        width: 200,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.banks.map((user) => user.id),
        },
        valueFormatter: (params) => {
          const foundBank = this.banks
            ? this.banks.find((user) => user.id === params.value)
            : null;
          return foundBank ? `${foundBank.name}` : params.value;
        },
      },
      {
        field: 'address',
        headerName: 'Dirección',
        editable: false,
        filter: 'agTextColumnFilter',
        width: 300,
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
      {
        field: 'cp',
        headerName: 'CP',
        editable: true,
        filter: true,
        width: 100,
      },
      {
        field: 'state',
        headerName: 'Estado',
        filter: true,
        width: 150,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.estados,
        },
      },
      {
        field: 'city',
        headerName: 'Ciudad',
        editable: true,
        filter: true,
        width: 150,
      },
      {
        field: 'neighborhood',
        headerName: 'Colonia',
        editable: true,
        filter: true,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => {
          if (this.infoCp && this.infoCp.length > 0) {
            const asentamientos = this.infoCp[0].asentamientos;
            return {
              values: asentamientos,
            };
          }
          return { values: [] };
        },
        valueFormatter: (params) => {
          return params.value || 'Seleccionar asentamiento';
        },
      },
      {
        field: 'phone',
        headerName: 'Teléfono',
        editable: true,
        filter: true,
        width: 150,
        valueSetter: (params) => {
          const phoneValue = params.newValue;
          // Verificar que el número tenga exactamente 10 dígitos y sea numérico
          const isValidPhone = /^\d{10}$/.test(phoneValue);
          if (!isValidPhone) {
            alerts.basicAlert(
              'Teléfono inválido',
              'El teléfono debe contener exactamente 10 dígitos numéricos.',
              'error'
            );
            return false; // No se permite el cambio
          }
          params.data[params.colDef.field] = phoneValue;
          return true;
        },
      },
      {
        field: 'idPosition',
        headerName: 'Position',
        editable: true,
        suppressMovable: true,
        filter: false,
        width: 190,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => {
          // Ensure depto data is available when creating editor
          return {
            values: this.position ? this.position.map((item) => item.id) : []
          };
        },
        valueFormatter: (params) => {
          // Handle potential null values and properly format the displayed value
          if (!params.value) return '';

          const foundDepto = this.depto
            ? this.position.find((item) => item.id === params.value)
            : null;

          return foundDepto ? foundDepto.description : params.value;
        },
      },
      {
        field: 'priceXHour',
        headerName: 'Precio por hora',
        editable: true,
        filter: true,
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
        editable: true,
        filter: true,
        width: 150,
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: {
          min: 0,
          max: 96,
          precision: 0,
        },
      },
      {
        field: 'ingressDate',
        headerName: 'Fecha de ingreso',
        editable: false,
        filter: true,
        width: 150,
        cellRenderer: 'agDateCellRenderer',
        cellEditor: 'agDateCellEditor',
        valueFormatter: (params) => {
          if (params.value) {
            const date = new Date(params.value);
            return `${('0' + date.getDate()).slice(-2)}-${(
              '0' +
              (date.getMonth() + 1)
            ).slice(-2)}-${date.getFullYear()}`;
          }
          return '';
        },
      },
      {
        field: 'vigente',
        headerName: 'Vigente',
        editable: true,
        suppressMovable: true,
        filter: true,
        width: 100,
      },
      {
        field: 'rfc',
        headerName: 'RFC',
        editable: true,
        filter: true,
        width: 150,
      }
    ];
  }

  // ==================== MASTER METHODS ====================

  obtenerBranchs() {
    // alert('this.branchs'+ this.idBranch)
    this.branchesService.getBrancheswoa(this.idRoot).subscribe(
      (data: any) => {
        this.branchs = data;
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  obtenerDatos() {
    return new Promise((resolve) => {
      this.employeeService.getEmployees(this.idBranch).subscribe(
        (data: any) => {
          this.rowData = data;
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
        this.banks = data;
      },
      (error) => {
        if (error.status == 404) this.banks = [];
        console.error('Error fetching data:', error);
      }
    );
  }

  getDeptoandPosition() {
    this.catalogService.getCatalogs(this.idRoot, 'DEPARTAMENT').subscribe(
      (data: any) => {
        this.depto = data;
      },
      (error) => {
        if (error.status == 404) this.depto = [];
        console.error('Error fetching data:', error);
      }
    );

    this.catalogService.getCatalogs(this.idRoot, 'POSITION').subscribe(
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
      city: '',
      neighborhood: '',
      rfc: '',
      state: '',
      phone: '',
      baseHours: 0,
      priceXHour: 0,
      ingressDate: timeData.dateObj,
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
      this.gridApi.startEditingCell({
        rowIndex: newRowIndex,
        colKey: 'name',
      });
    }, 50); // Un pequeño retraso de 50ms
  }

  async saveMasterChanges() {
    const isValid = this.rowData.every((item) => item.name && item.idBranch && item.email);
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

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.employeeService.addEmployee(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.employeeService.updateEmployee(row.id, cleanedData);
    });

    try {
      const responses = await lastValueFrom(
        concat(
          ...addObservables,
          ...updateObservables
        ).pipe(toArray())
      );

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
          const maxId = Math.max(...this.rowData.map(row => Number(row.id)));
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
        const nodeId = typeof node.data.id === 'string' ? parseInt(node.data.id) : node.data.id;
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
    return cleanedData;
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
    this.gridHeight = '80vh'; // Reset to default height
    this.showLoansTab = false;
    this.showSavingsTab = false;
    if (this.gridApi) {
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
    }
  }

  async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
    const colId = event.column.getColId();
    const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
    const selectedId = selectedRowData.id; // Obtener el ID del registro

    if (colId === 'loan' || colId === 'saving') {
      // Filtrar el grid para mostrar solo el registro con el ID seleccionado
      const filterModel = {
        id: {
          type: 'equals',
          filter: selectedId,
        },
      };

      this.gridApi.setFilterModel(filterModel);
      this.gridApi.onFilterChanged();
    }

    if (colId === 'loan') {
      await this.activateLoansTab();
    }

    if (colId === 'saving') {
      await this.activateSavingsTab();
    }

    // Puedes agregar lógica adicional aquí si necesitas guardar los datos seleccionados
    this.selectedRowData = selectedRowData;
  }

  async activateLoansTab() {
    if (!this.isOpen || this.showSavingsTab) {
      await this.adjustGridSize();
      this.showLoansTab = true;
      this.showSavingsTab = false;
      this.isOpen = true;
    }
    else {
      await this.resetGridSize();
      this.isOpen = false;
    }
  }

  async activateSavingsTab() {
    if (!this.isOpen || this.showLoansTab) {
      await this.adjustGridSize();
      this.showLoansTab = false;
      this.showSavingsTab = true;
      this.isOpen = true;
    }
    else {
      await this.resetGridSize();
      this.isOpen = false;
    }
  }

  async adjustGridSize() {
    this.gridHeight = '20vh'; // Adjust as needed
  }
}
