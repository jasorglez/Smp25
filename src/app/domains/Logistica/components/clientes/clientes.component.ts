import { Component, effect, HostListener, inject } from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { alerts } from '../../../../helpers/alerts';
import { States } from 'app/interface/states';
import {
  catchError,
  concat,
  EMPTY,
  lastValueFrom,
  toArray,
  throwError,
} from 'rxjs';
import { map } from 'rxjs/operators';
import { AgGridModule } from 'ag-grid-angular';
import { ModalService } from 'app/services/modal.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { SignalsService } from 'app/services/signals.service';
import { CustomersPaymentsComponent } from '../../../ModAdmon/components/customers/customers-payments.component';
import { CustomersBillingComponent } from '../../../ModAdmon/components/customers/customers-billing.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { RadiusinfluenceComponent } from '../../../ModAdmon/components/radiusinfluence/radiusinfluence.component';
import { CustomersService } from 'app/services/customers.service';
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
import { FacturacionService } from 'app/services/facturacion.service';
import { AdministrationService } from 'app/services/administration.service';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';

@Component({
  selector: 'app-clientes-logistica',
  standalone: true,
  imports: [
    RouterModule,
    DomainsModule,
    AgGridModule,
    MultiLineEditorComponent,
    CustomersPaymentsComponent,
    CustomersBillingComponent,
  ],
  templateUrl: './clientes.component.html',
  styleUrls: ['./clientes.component.scss'],
})
export class ClientesLogisticaComponent implements CanComponentDeactivate {
  private customerService = inject(CustomersService);
   private modalServiceTable = inject(ModalService);
   private signalsService = inject(SignalsService);
   private modalService = inject(NgbModal);
   private route = inject(ActivatedRoute);
   private inegiService = inject(InegiService);
   private branchesService = inject(BranchsService);
  authService = inject(AuthService);
   private catalogsService = inject(CatalogsService);
   private trackingService = inject(TrackingService);
   private facturacionService = inject(FacturacionService);
   private administrationService = inject(AdministrationService);
   private incomesAndExpensesService = inject(IncomesAndExpensesService);

  private http = inject(HttpClient);
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  
  async ngOnInit() {
    this.type = 'CUSTOMERS';
    this.signalsService.deleteClientData();
    this.loadFiscalCatalogs();
    this.loadCustomersBilling();
    this.route.data.subscribe((data) => {
      this.type = data['type'] || 'CUSTOMERS';
      this.obtenerDatos();
      this.getStates();
      this.obtenerBranchs();
      this.getTypecop();
      this.refreshData();
    });
  }

  constructor() {
    effect(async () => {
      if (this.signalsService.getRefreshEmployees()() == true) {
        await this.obtenerDatos();
        this.signalsService.resetRefreshEmployees();
      }
    });

    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      if (this.idRoot) {
        this.obtenerDatos();
        this.obtenerBranchs();
        this.getTypecop();
        this.signalsService.deleteClientData();
      }
      this.refreshData();
      this.signalsService.deleteClientData();
    }, { allowSignalWrites: true });
  }

  private refreshData() {
    if (!this.idRoot) return;
    this.obtenerDatos();
    this.obtenerBranchs();
    this.getTypecop();
    this.loadCustomersBilling();
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  
  type: string = '';
  gridHeight: string = '75vh';
  showCreditsTab: boolean = false;
  showBillingTab: boolean = false;
  private gridApi: GridApi;
  notSavedChanges: boolean = false;
  selectedRowData: any = null;
  isOpen: boolean = false;
  branchs: any[] = [];
  Typecop: any[] = [];
  contactoCatalog: any[] = [];

  fiscalRegimes: any[] = [];
  usosFactura: any[] = [];
  customersBilling: any[] = [];

  private lastEditedRowId: number | string | null = null;

  rowData: any;
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];

  id: string;
  idRoot: number;
  private tempIdCounter: number = 0;
  selectedTab: string = 'customers-payments';
  idBranch: number | null = null;
  idEmployee: number;
  infoCp: any;
  

  private estados: string[] = [];

  public defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: true,
    lockPosition: false,
    enableRowGroup: true,
    flex: 1,
  };

  currentIndex = 0;

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'never';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'never';

  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent,
  };

  idClient = this.signalsService.getIdClient();
  nameClient = this.signalsService.getNameClient()();

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    rowBuffer: 20,
    getRowId: (params: any) => params?.data?.id,
    getRowClass: (params) => {
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
  };

  private _colMaster: ColDef[] = [];

  get colMaster(): ColDef[] {
    if (this._colMaster.length > 0) {
      return this._colMaster;
    }

    this._colMaster = [
      {
        field: 'vigente',
        headerName: 'Activo',
        editable: () => true,
        width: 100,
      },
      {
        field: 'enabledForBilling',
        headerName: 'Facturación Electrónica',
        width: 180,
        editable: false,
        hide: this.type != 'CUSTOMERS',
        cellRenderer: (params: ICellRendererParams) => {
          const link = document.createElement('a');
          link.href = 'javascript:void(0)';
          link.innerText = 'Ver Facturación';
          link.style.color = '#0d6efd';
          link.style.textDecoration = 'underline';
          link.style.cursor = 'pointer';
          link.addEventListener('click', (e) => {
            e.preventDefault();
            this.onCellDoubleClicked({
              column: { getColId: () => 'enabledForBilling' },
              data: params.data,
              node: params.node,
              api: params.api
            } as any);
          });
          return link;
        }
      },
      {
        field: 'idBranch',
        headerName: 'Nombre sucursal',
        headerClass: 'required-header',
        filterParams: { defaultToNothingSelected: true },
        hide: this.authService.hasDetailedPermission('principal', 'see-all-branches') || this.signalsService.getemailChoose() === environment.root
          ? false
          : true,
        editable: () => true,
        filter: true,
        width: 170,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => {
          return {
            values: this.branchs ? this.branchs.map((item) => item.id) : [],
          };
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          const foundBranch = this.branchs ? this.branchs.find((item) => item.id === params.value) : null;
          return foundBranch ? foundBranch.name : params.value;
        },
        valueGetter: (params) => {
          if (!params.data || !params.data.idBranch) return '';
          const branch = this.branchs?.find(b => b.id === params.data.idBranch);
          return branch ? branch.name : '';
        },
      },
      {
        field: 'nameContact',
        headerName: 'Nombre',
        editable: () => true,
        filter: true,
        width: 270,
        cellEditor: 'autocompleteEditor',
        filterParams: { defaultToNothingSelected: true },
        cellEditorParams: () => {
          const isPersistedRow = (e: any) => {
            const id = e?.id;
            const isTempId = typeof id === 'string' && id.startsWith('temp_');
            return !e?.__isNew && !isTempId;
          };

          // Preferir catálogo desde backend; si no existe, usar el grid pero SOLO filas persistidas (ya guardadas).
          const srcRaw = (Array.isArray(this.contactoCatalog) && this.contactoCatalog.length > 0)
            ? this.contactoCatalog
            : (Array.isArray(this.rowData) ? this.rowData : []);

          const src = srcRaw.filter(isPersistedRow);

          const list = src
            .map((e: any) => String(e?.nameContact || e?.company || '').trim().toUpperCase())
            .filter(Boolean);

          // Quitar duplicados manteniendo el orden
          const uniqueList = Array.from(new Set(list));

          return {
            filterList: uniqueList,
            filterKey: 'nameContact',
            placeholder: 'Nombre',
            minLength: 1,
            toUpperCase: true,
          };
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
          const duplicateExists = this.contactoCatalog.some((row, index) => index !== params.node.rowIndex && row.nameContact?.toUpperCase() === normalizedValue);
          if (duplicateExists) {
            alerts.basicAlert('Nombre duplicado', 'Ya existe un nombre de contacto registrado.', 'error');
            return false;
          }
          params.data[params.colDef.field] = normalizedValue;
          params.data.company = normalizedValue;
          return true;
        },
      },
      
      {
        field: 'total',
        headerName: this.type === 'CUSTOMERS' ? 'Total Credito' : 'Cuentas X Pagar',
        editable: false,
        filter: 'agNumberColumnFilter',
        suppressMovable: true,
        width: 160,
        valueFormatter: (params) => {
          if (params.value) {
            return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
          }
          return '$0.00';
        },
        cellStyle: { backgroundColor: '#d4edda' },
      },

      {
        field: 'cp',
        headerName: 'CP',
        editable: () => true,
        filter: true,
        width: 105,
        filterParams: { defaultToNothingSelected: true },
      },
      {
        field: 'address',
        headerName: 'Direccion',
        editable: () => true,
        width: 250,
        filter: true,
        filterParams: { defaultToNothingSelected: true },
        valueSetter: (params) => {
          params.data[params.colDef.field] = params.newValue.toUpperCase();
          return true;
        }
      },
      {
        field: 'state',
        headerName: 'Estado',
        filter: true,
        width: 160,
        filterParams: { defaultToNothingSelected: true },
        editable: () => true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: this.estados },
      },
      {
        field: 'city',
        headerName: 'Ciudad',
        editable: () => true,
        filterParams: { defaultToNothingSelected: true },
        width: 120,
        filter: true,
      },
      {
        field: 'neighborhood',
        headerName: 'Colonia',
        filterParams: { defaultToNothingSelected: true },
        editable: () => true,
        filter: true,
        width: 300,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => {
          if (this.infoCp && this.infoCp.length > 0) {
            const asentamientos = this.infoCp[0].asentamientos;
            const sortedAsentamientos = asentamientos.sort((a, b) => a.localeCompare(b));
            return { values: sortedAsentamientos };
          }
          return { values: [] };
        },
        valueFormatter: (params) => params.value || 'Seleccionar asentamiento',
      },
      {
        field: 'phone',
        headerName: 'Telefono',
        editable: () => true,
        width: 120,
        valueSetter: (params) => {
          const phoneValue = params.newValue;
          const isValidPhone = /^\d{10}$/.test(phoneValue);
          if (!isValidPhone) {
            alerts.basicAlert('Teléfono inválido', 'El teléfono debe contener exactamente 10 dígitos numéricos.', 'error');
            return false;
          }
          params.data[params.colDef.field] = phoneValue;
          return true;
        },
      },
      {
        field: 'rfc',
        headerName: 'RFC',
        editable: () => true,
        hide: true,
        width: 100,
      },
      { field: 'radio', headerName: 'Radio', editable: () => true, width: 90, hide: this.type != 'CUSTOMERS' },
      {
        field: 'email',
        headerName: 'Correo',
        width: 200,
        cellEditor: 'agTextCellEditor',
        editable: () => true,
        cellEditorParams: { useFormatter: true },
        valueFormatter: (params) => params.value,
        valueSetter: (params) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailRegex.test(params.newValue)) {
            const duplicateExists = this.rowData.some((row, index) => index !== params.node.rowIndex && row.email === params.newValue);
            if (duplicateExists) {
              alerts.basicAlert('Añadir usuario', 'Ya existe un usuario con ese correo electrónico.', 'error');
              return false;
            }
            params.data[params.colDef.field] = params.newValue;
            return true;
          } else {
            alerts.basicAlert('Editar usuario', 'Correo electrónico no válido.', 'error');
            return false;
          }
        },
      },
      {
        field: 'id',
        headerName: 'Id',
        editable: false,
        width: 70,
        hide: true,
        filter: 'agNumberColumnFilter',
        filterParams: { filterOptions: ['equals'] },
      },
    ];
    return this._colMaster;
  }

  obtenerDatos() {
    this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Clientes`, 'Menu Logistica', this.trackingService.getEmail());
    if (!this.idRoot) {
      return Promise.resolve(false);
    }

    const customers$ = this.idBranch && this.idBranch > 0
      ? this.customerService.getCustomers(this.idBranch, this.type)
      : this.customerService.getCustomersByCompany(this.idRoot, this.type);

    return new Promise((resolve) => {
      customers$.subscribe({
        next: (data: any) => { this.rowData = data; resolve(true); },
        error: (error) => { console.error('Error obteniendo datos:', error); resolve(false); }
      });
    });
  }

  obtenerBranchs() {
    if (!this.idRoot) return;
    this.branchesService.getBrancheswoa(this.idRoot).subscribe((data: any) => { this.branchs = data; }, (error) => console.error('Error fetching data:', error));
  }

  onSelectedRow(event: any) { this.id = event.data.id; }

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
      let branchSelect = this.branchs?.find((item) => item.name === selecteEmpleado);
      this.customerService.getCustomers(branchSelect.id, this.type).subscribe({
        next: (data: any) => { this.contactoCatalog = data; },
        error: (error) => console.error('Error obteniendo datos:', error)
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
          this.gridApi.applyTransaction({ update: [event.data] });
        }
      }, 500);
    }
  }

  getCoordinatesFromCP(cp: string) {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${cp}&country=MX&format=json`;
    return this.http.get(url).pipe(map((data) => data), catchError((error) => { console.error('Error obteniendo coordenadas:', error); return throwError(() => new Error('Error al obtener coordenadas')); }));
  }

  async getZipCodeData(cp: string): Promise<any> {
    try {
      const data = await lastValueFrom(this.inegiService.getZipCodeData(cp));
      this.infoCp = data;
      return data;
    } catch (error) {
      if (error.status === 404) {
        alerts.basicAlert('Código Postal', 'El código postal no existe o no se encontró información.', 'error');
      } else {
        console.error('Error fetching data:', error);
      }
      return null;
    }
  }

  onGridReady(params: GridReadyEvent) { this.gridApi = params.api; }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId, idRoot: this.idRoot, idBranch: this.idBranch, nameContact: '', company: '', phone: '', rfc: '', city: '', mobile: '', email: '', address: '', addressfiscal: '', state: '', total: 0, radio: 0, vigente: true, NumCliente: 0, latitud: '', longitud: '', idTypecop: 1, fiscalRegime: '', usoCfdi: 'G03', type: this.type, active: true, __isNew: true,
    };
    this.rowData = [newItem, ...(this.rowData || [])];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;

    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
    }

    this.focusNewCustomerNameCell(tempId);
  }

  private focusNewCustomerNameCell(tempId: string): void {
    // En esta tabla, la columna visible "Nombre" corresponde al campo `nameContact`
    const colKey = 'nameContact';
    let attempts = 0;

    const focusCell = () => {
      if (!this.gridApi) return;

      const node = this.gridApi.getRowNode(tempId);
      if (!node || node.rowIndex === null || node.rowIndex === undefined) {
        if (attempts++ < 12) {
          setTimeout(focusCell, 50);
        }
        return;
      }

      const rowIndex = node.rowIndex;
      this.gridApi.ensureIndexVisible(rowIndex, 'top');
      this.gridApi.ensureColumnVisible(colKey);
      node.setSelected(true);

      requestAnimationFrame(() => {
        this.gridApi.setFocusedCell(rowIndex, colKey);
        this.gridApi.startEditingCell({ rowIndex, colKey });

        requestAnimationFrame(() => {
          const editingInput = document.querySelector(
            '.ag-cell-inline-editing input, .autocomplete-input-editing'
          ) as HTMLInputElement;
          editingInput?.focus();
          editingInput?.select();
        });
      });
    };

    setTimeout(focusCell, 0);
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) => item.idBranch && (item.nameContact || item.company));
    if (!isValid) {
      alerts.basicAlert('Añadir entrada', 'Debe llenar todos los campos antes de guardar.', 'error');
      return;
    }

    // Validación extra: evitar guardar nombres duplicados (contra ya guardados y entre cambios actuales)
    const normalizeName = (v: any) => String(v ?? '').trim().toUpperCase();
    const isTempId = (id: any) => typeof id === 'string' && id.startsWith('temp_');

    const persistedRowsSource = (Array.isArray(this.contactoCatalog) && this.contactoCatalog.length > 0)
      ? this.contactoCatalog
      : (Array.isArray(this.rowData) ? this.rowData : []);

    const persistedNameById = new Map<string, string>();
    for (const r of persistedRowsSource) {
      if (!r) continue;
      if (r.__isNew) continue;
      if (isTempId(r.id)) continue;
      const id = r.id != null ? String(r.id) : '';
      if (!id) continue;
      const name = normalizeName(r.nameContact || r.company);
      if (!name) continue;
      persistedNameById.set(id, name);
    }

    const changes = this.rowData.filter((r: any) => r?.__isNew || r?.__modified);
    const nameToIds = new Map<string, string[]>();
    for (const r of changes) {
      const id = r?.id != null ? String(r.id) : '';
      const name = normalizeName(r?.nameContact || r?.company);
      if (!name) continue;
      const arr = nameToIds.get(name) ?? [];
      arr.push(id);
      nameToIds.set(name, arr);
    }

    // Duplicados dentro del mismo guardado (dos filas con el mismo nombre)
    const intraDuplicates = [...nameToIds.entries()].filter(([, ids]) => ids.length > 1).map(([name]) => name);
    if (intraDuplicates.length > 0) {
      this.gridApi?.stopEditing();
      await alerts.minimalAlert(
        'Nombre duplicado',
        `No se puede guardar. Hay nombres repetidos en los cambios: ${intraDuplicates.slice(0, 5).join(', ')}${intraDuplicates.length > 5 ? '…' : ''}`,
        'error'
      );
      // Deshacer movimiento de "crear cliente" (volver al estado anterior)
      this.revert();
      return;
    }

    // Duplicados contra registros ya guardados (excluyendo el mismo id al actualizar)
    const againstPersistedDuplicates: string[] = [];
    for (const r of changes) {
      const id = r?.id != null ? String(r.id) : '';
      const name = normalizeName(r?.nameContact || r?.company);
      if (!name) continue;

      for (const [pid, pname] of persistedNameById.entries()) {
        if (pid === id) continue; // misma fila (edición)
        if (pname === name) {
          againstPersistedDuplicates.push(name);
          break;
        }
      }
    }

    if (againstPersistedDuplicates.length > 0) {
      const uniq = Array.from(new Set(againstPersistedDuplicates));
      this.gridApi?.stopEditing();
      await alerts.minimalAlert(
        'Nombre duplicado',
        `No se puede guardar. Ya existen registrados: ${uniq.slice(0, 5).join(', ')}${uniq.length > 5 ? '…' : ''}`,
        'error'
      );
      // Deshacer movimiento de "crear cliente" (volver al estado anterior)
      this.revert();
      return;
    }

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter((row) => row.__modified && !row.__isNew);
    const addObservables = newRows.map((row) => { const cleanedData = this.cleanDataForServer(row); return this.customerService.addCustomer(cleanedData); });
    const updateObservables = modifiedRows.map((row) => { const cleanedData = this.cleanDataForServer(row); return this.customerService.updateCustomer(row.id, cleanedData); });
    try {
      const responses = await lastValueFrom(concat(...addObservables, ...updateObservables).pipe(toArray()));
      if (modifiedRows.length > 0) { this.lastEditedRowId = modifiedRows[modifiedRows.length - 1].id; } else if (newRows.length > 0) { this.lastEditedRowId = 'SELECT_MAX_ID'; }
      alerts.toastAlert('Datos actualizados correctamente', 'success');
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      await this.obtenerDatos();
      if (this.lastEditedRowId) {
        if (this.lastEditedRowId === 'SELECT_MAX_ID') {
          const maxId = Math.max(...this.rowData.map((row) => Number(row.id)));
          this.selectRowById(maxId);
        } else {
          this.selectRowById(this.lastEditedRowId);
        }
        this.lastEditedRowId = null;
      }
    } catch (error) {
      console.error('Error en saveChanges:', error);
      alerts.basicAlert('Error', 'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.', 'error');
    }
  }

  private selectRowById(id: number | string) {
    if (!this.gridApi) { console.error('Grid API no disponible'); return; }
    setTimeout(() => {
      this.gridApi.forEachNode((node) => {
        const nodeId = typeof node.data.id === 'string' ? parseInt(node.data.id) : node.data.id;
        const searchId = typeof id === 'string' ? parseInt(id) : id;
        if (nodeId === searchId) {
          node.setSelected(true);
          this.gridApi.ensureNodeVisible(node, 'middle');
        }
      });
    }, 100);
  }

  async deleteEntry() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert('Eliminar entrada', 'Por favor, seleccione una entrada para eliminar.', 'error');
      return;
    }
    const selectedData = selectedNodes[0].data;
    const customerName = selectedData.nameContact || selectedData.company || 'este cliente';
    const result = await alerts.confirmAlert('¿Eliminar cliente?', `¿Está seguro que desea eliminar a "${customerName}"?`, 'warning', 'Sí, eliminar');
    if (!result.isConfirmed) return;
    if (selectedData.total && selectedData.total !== 0) {
      alerts.basicAlert('Error al eliminar', 'No se puede eliminar mientras tenga notas activas', 'error');
      return;
    }
    const id = selectedData.id;
    try {
      const incomesAndExpenses = await lastValueFrom(this.incomesAndExpensesService.getIncomesAndExpenses(this.idRoot));
      const isBeingUsed = incomesAndExpenses?.some((record: any) => record.idCustomer === id && record.active !== false);
      if (isBeingUsed) { alerts.basicAlert('No se puede eliminar', 'Este cliente está siendo utilizado en registros de ingresos/egresos.', 'error'); return; }
    } catch (error) { console.error('Error verificando uso del cliente:', error); }
    selectedData.active = 0;
    this.customerService.deleteCustomer(id).pipe(catchError((error) => { alerts.basicAlert('Eliminar entrada', 'Error al eliminar la entrada.', 'error'); console.error(error); return EMPTY; })).subscribe(() => { alerts.basicAlert('Eliminar entrada', 'Entrada eliminada satisfactoriamente.', 'success'); this.obtenerDatos(); this.notSavedChanges = false; this.selectedRowData = null; });
  }

  revert() { this.obtenerDatos(); this.notSavedChanges = false; }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.detailType;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) { delete cleanedData.id; } else { delete cleanedData.type; }
    return cleanedData;
  }

  openRadiusInfluenceModal(): void {
    const modalRef = this.modalService.open(RadiusinfluenceComponent, { size: 'lg' });
  }

  async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
    this.signalsService.setProviderOrCustomer(this.type);
    const colId = event.column.getColId();
    const selectedRowData = event.data;
    const selectedId = selectedRowData.id;
    this.selectedRowData = selectedRowData;
    if (colId === 'total') {
      this.notSavedChanges = true;
      if (this.gridApi) {
        const filterModel = { id: { type: 'equals', filter: selectedId } };
        this.gridApi.setFilterModel(filterModel);
        this.gridApi.onFilterChanged();
      }
      this.activateCreditsTab();
    }
    if (colId === 'enabledForBilling') {
      this.signalsService.setIdClient(selectedId);
      this.signalsService.setNameClient(selectedRowData.nameContact || selectedRowData.company);
      if (this.gridApi) {
        const filterModel = { id: { type: 'equals', filter: selectedId } };
        this.gridApi.setFilterModel(filterModel);
        this.gridApi.onFilterChanged();
      }
      this.activateBillingTab();
    }
  }

  async activateCreditsTab() {
    if (!this.isOpen) { setTimeout(async () => await this.adjustGridSize(), 0); this.showCreditsTab = true; this.showBillingTab = false; this.isOpen = true; } else { this.resetGridSize(); this.isOpen = false; }
  }

  async activateBillingTab() {
    if (!this.isOpen) { setTimeout(async () => await this.adjustGridSize(), 0); this.showBillingTab = true; this.showCreditsTab = false; this.isOpen = true; } else { this.resetGridSize(); this.isOpen = false; }
  }

  resetGridSize() { this.gridHeight = '80vh'; this.showCreditsTab = false; this.showBillingTab = false; this.gridApi.setFilterModel(null); this.gridApi.onFilterChanged(); }
  adjustGridSize() { this.gridHeight = '20vh'; }

  getStates() {
    this.inegiService.getEstados().subscribe({ next: (data: { datos: States[] }) => { this.estados = data.datos.map((estado) => estado.nom_agee); this.estados.unshift('Sin estado'); }, error: (error) => console.error('Error fetching states', error) });
  }

  getTypecop() {
    if (!this.idRoot) return;
    const catalogType = this.type === 'CUSTOMERS' ? 'TIPO-CLIENTE' : 'TIPO-PROVEEDOR';
    
    this.catalogsService.getCatalogsFromAdmon(this.idRoot, catalogType).subscribe({
      next: (data: Icatalog[]) => { 
        this.Typecop = data; 
      },
      error: (error) => { 
        // Corrección: Usar catalogType ('TIPO-CLIENTE') en lugar de this.type ('CUSTOMERS')
        this.catalogsService.getCatalogsVigente(this.idRoot, catalogType).subscribe({
          next: (data2: Icatalog[]) => { this.Typecop = data2; },
          error: (error2) => console.error('Error en ambos intentos de catálogo:', error2)
        }); 
      }
    });
  }

  loadFiscalCatalogs() {
    this.administrationService.getFiscalRegimes().subscribe({ next: (data: any[]) => { this.fiscalRegimes = data; }, error: (err) => console.error('Error cargando regímenes fiscales:', err) });
    this.facturacionService.getUsoCfdi2fields().subscribe({ next: (data: any[]) => { this.usosFactura = data; }, error: (err) => console.error('Error cargando usos CFDI:', err) });
  }

  loadCustomersBilling() {
    if (!this.idRoot) return;
    this.customerService.getCustomersBilling(this.idRoot).subscribe({
      next: (data: any[]) => {
        this.customersBilling = data;
        if (this.rowData && Array.isArray(this.rowData)) {
          this.rowData.forEach((customer: any) => { const isEnabled = this.customersBilling.some(cb => cb.idCustomer === customer.id); customer.enabledForBilling = isEnabled; });
          if (this.gridApi) { this.gridApi.redrawRows(); }
        }
      },
      error: (err) => console.error('Error cargando clientes de facturación:', err)
    });
  }

  async toggleBillingEnabled(customer: any, enabled: boolean) {
    if (!customer.id || customer.__isNew) { customer.enabledForBilling = enabled; return; }
    if (enabled) {
      const billingData = { idCustomer: customer.id, idRoot: this.idRoot, rfc: customer.rfc || '', nombreFiscal: customer.name || customer.description || '', codigoPostal: customer.cp || '', regimenFiscal: customer.fiscalRegime || '', usoCfdi: customer.usoCfdi || 'G03', correoFacturacion: customer.email || '', active: true };
      this.customerService.addCustomerBilling(billingData).subscribe({ next: () => { alerts.basicAlert('Éxito', 'Cliente habilitado para facturación electrónica', 'success'); this.loadCustomersBilling(); }, error: (err) => { console.error(err); alerts.basicAlert('Error', 'No se pudo habilitar el cliente para facturación', 'error'); customer.enabledForBilling = false; } });
    } else {
      const billingRecord = this.customersBilling.find(cb => cb.idCustomer === customer.id);
      if (billingRecord) {
        this.customerService.deleteCustomerBilling(billingRecord.id).subscribe({ next: () => { alerts.basicAlert('Éxito', 'Cliente deshabilitado para facturación electrónica', 'success'); this.loadCustomersBilling(); }, error: (err) => { console.error(err); alerts.basicAlert('Error', 'No se pudo deshabilitar el cliente', 'error'); customer.enabledForBilling = true; } });
      }
    }
  }

  async canDeactivate(): Promise<boolean> { return confirmExitIfUnsaved(this.notSavedChanges); }
}
