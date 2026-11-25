import { CommonModule } from '@angular/common';
import { Component, computed, effect, HostListener, inject, Injectable, OnDestroy, ViewChild } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { UsersService } from 'app/services/users.service';
import { alerts } from 'app/helpers/alerts';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { catchError, concat, EMPTY, lastValueFrom, of, toArray, tap, Observable, from, mergeMap, Subscription } from 'rxjs';
import { MatDialogModule } from '@angular/material/dialog';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { RolesService } from 'app/services/roles.service';
import { EmployeesService } from 'app/services/employees.service';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { SignalsService } from 'app/services/signals.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { AuthService } from 'app/services/auth.service';
import { PermitionsService } from 'app/services/permitions.service';
import { TrackingService } from 'app/services/tracking.service';
import { DetallePermisosXSucursalesComponent } from './details/detallepermisosxsucursales.component';
import { PermissionsViewByUserComponent } from './details/detail-permissions-user/permissions-view.component';
import { ModalService } from 'app/services/permissions-modal.service';
import { UsersDetailWrapperComponent } from './details/users-detail-wrapper.component';
import { ButtonCellRendererExpenditureComponent } from 'app/domains/ModAdmon/components/egresos-palacio/button-cell-renderer-expenditure.component';

@Injectable({
  providedIn: 'root',
})

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    FormsModule,
    AgGridModule,
    MatDialogModule,
    DetallePermisosXSucursalesComponent,
    PermissionsViewByUserComponent,
    ReactiveFormsModule,
    ButtonCellRendererExpenditureComponent
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnDestroy {

  // ✅ Referencia al componente de permisos dentro del modal
  @ViewChild('permissionsViewRef') permissionsViewRef: PermissionsViewByUserComponent;

  idRoot: number;
  gridHeight: string = '80vh';
  newlyAddedRows: string[] = [];
  entrada: any;
  departamentos: any[] = [];
  position: any[] = [];
  rowData: any[] = [];

  paginationPageSize = 20;
  pagination = true;
  notSavedChanges: boolean = false;
  paginationPageSizeSelector = false;
  id: string;
  userRoot: number = 0;
  authorizedPass: boolean = false;
  dataEmpleado: any = null;
  empleadoCatalgos: any[] = [];
  idUser: number = null;
  isAdvanced: boolean = false;
  invited: boolean = false;
  showDeletedUsers = false;

  get isRootUser(): boolean {
    const rootFlag = this.signalsService.getUserRoot()();
    return this.authService.isRoot()
      || String(rootFlag).toLowerCase() === 'true'
      || Number(rootFlag) === 1;
  }

  // --- Modal ---
  showPermissionsModal: boolean = false;
  modalUserName: string = '';
  modalPermissions: { idUser: number, idBranch: number, idRole: number, idPosicion: number } | null = null;
  private modalSubscription: Subscription;

  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  private permissionType: string = 'root';

  private editableColumnOrder = ['displayName', 'email', 'password', 'isRoot'];
  private enterPressed: boolean = false;

  usersService                = inject(UsersService);
  private readonly translate = inject(TranslateService);
  private imageHandlerService = inject(ImageHandlerService);
  private usersxrootService   = inject(UsersxpermissionsService);
  private trackingService     = inject(TrackingService);
  private catalogService      = inject(CatalogsService);
  private signalsService      = inject(SignalsService);
  private rolesService        = inject(RolesService);
  private employeeService     = inject(EmployeesService);
  private permitionsService   = inject(PermitionsService);
  private modalService        = inject(ModalService);
  authService                 = inject(AuthService);

  profile = computed(() => this.signalsService.profile);

  enviarSignal() {
    const departmentName = this.getDepartmentName(this.selectedRowData.idDepartament);
    this.signalsService.profileSignal(
      this.selectedRowData.id,
      this.selectedRowData.email,
      this.selectedRowData.picture,
      this.selectedRowData.displayName,
      departmentName,
      this.selectedRowData.position
    );
    this.signalsService.setCompanyFromPermissions(null);
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue = 'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  verification(): boolean {
    if (this.userRoot == 1) {
      return this.authorizedPass = true;
    }
    return this.authorizedPass = false;
  }

  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.idUser = this.signalsService.getIdUSer()();
      this.userRoot = this.signalsService.getUserRoot()();
      this.isAdvanced = this.signalsService.getIsAdvanced();
      this.invited = this.signalsService.getInvited()();
      if (this.gridApi) {
        const showSecurity = this.isAdvanced || this.idUser === 42 || this.idRoot === 9;
        this.gridApi.setColumnsVisible(['idRol'], showSecurity);
      }
      this.obtenerDatos();
      this.getRoles();
      this.verification();
      this.obtenerEmpleados();
      if (this.signalsService.getRefresSecurity()()) {
        this.obtenerDatos();
        this.signalsService.setRefresSecurity(false);
      }
    });

    this.modalSubscription = this.modalService.openPermissions$.subscribe(data => {
      this.modalPermissions = {
        idUser: data.idUser,
        idBranch: data.idBranch,
        idRole: data.idRole,
        idPosicion: data.idPosicion,
      };
      this.modalUserName = data.userName;
      this.showPermissionsModal = true;
    });
  }

  ngOnDestroy(): void {
    this.modalSubscription?.unsubscribe();
  }

  closePermissionsModal() {
    this.showPermissionsModal = false;
    this.modalPermissions = null;
    this.modalUserName = '';
  }

  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent,
    detailPermissionsRenderer: DetallePermisosXSucursalesComponent,
    usersDetailWrapper: UsersDetailWrapperComponent
  }

  obtenerEmpleados() {
    return new Promise((resolve) => {
      this.employeeService.getEmployeesVigente(-this.idRoot).subscribe(
        (data: any) => {
          this.empleadoCatalgos = data;
          console.log(this.empleadoCatalgos);
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

  obtenerDatos() {
    const observer = {
      next: (response: any) => {
        if (response && response.code === 200 && response.data) {
          const users = response.data.map((item: any) => {
            return { id: item.id, ...item };
          });
          this.rowData = users.filter(row => this.showDeletedUsers
            ? Number(row.active) === 0
            : Number(row.active) !== 0);
        } else {
          console.error('Respuesta inválida del servidor');
        }
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Get Registro en Usuarios',
          'Menu Recursos Humanos Usuarios',
          this.trackingService.getEmail()
        );
      },
      error: (error) => {
        console.error('Error al obtener los datos:', error);
      }
    };

    if (this.showDeletedUsers && this.isRootUser && this.idRoot) {
      this.usersService.getDeletedUsers(this.idRoot).subscribe(observer);
    } else if (this.authService.isRoot()) {
      this.usersService.getAllUsers().subscribe(observer);
    } else {
      this.usersService.getDataUsers(this.idRoot).subscribe(observer);
    }
  }

  toggleDeletedUsers(): void {
    if (!this.isRootUser || !this.idRoot) return;
    this.showDeletedUsers = !this.showDeletedUsers;
    this.selectedRowData = null;
    this.gridApi?.deselectAll();
    this.obtenerDatos();
  }

  async restoreDeletedUser(): Promise<void> {
    if (!this.isRootUser || !this.showDeletedUsers) return;
    const selected = this.gridApi?.getSelectedNodes()?.[0]?.data;
    if (!selected || Number(selected.active) !== 0) {
      alerts.basicAlert(this.translate.instant('modules.userSetup.ui.alerts.restoreUser'), this.translate.instant('modules.userSetup.ui.alerts.selectDeletedUser'), 'warning');
      return;
    }

    const confirmation = await alerts.confirmAlert(
      this.translate.instant('modules.userSetup.ui.alerts.restoreUser'),
      this.translate.instant('modules.userSetup.ui.alerts.reactivateUser', { name: selected.displayName || selected.email }),
      'question',
      this.translate.instant('modules.userSetup.ui.alerts.yesRestore')
    );
    if (!confirmation.isConfirmed) return;

    this.usersService.restoreDeletedUser(Number(selected.id), this.idRoot).subscribe({
      next: () => {
        alerts.basicAlert(this.translate.instant('modules.userSetup.ui.alerts.userRestored'), this.translate.instant('modules.userSetup.ui.alerts.userActiveAgain'), 'success');
        this.selectedRowData = null;
        this.obtenerDatos();
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          `Restauró usuario ${selected.id}`,
          'Menu Administracion Usuarios',
          this.trackingService.getEmail()
        );
      },
      error: (error) => {
        const message = error?.error?.message || this.translate.instant('modules.userSetup.ui.alerts.restoreFailed');
        alerts.basicAlert(this.translate.instant('modules.userSetup.ui.alerts.restoreUser'), message, 'error');
      }
    });
  }

  getRoles() {
    this.rolesService.getRoles(this.idRoot).subscribe(
      (data: any) => {
        this.departamentos = data.data;
      },
      (error) => {
        if (error.status == 404) this.departamentos = [];
        console.error('Error fetching data:', error);
      }
    );
  }

  getDepartmentName(idDepartament: number): string {
    const department = this.departamentos.find(dept => dept.id === idDepartament);
    return department ? department.description : 'Departamento no encontrado';
  }

  procesoData(userId: number): Observable<any> {
    if (!this.dataEmpleado || !this.dataEmpleado.idBranch) {
      console.warn('No hay datos válidos de empleado o sucursal.');
      return EMPTY;
    }

    const sucursal = {
      idUser: userId,
      idPermission: this.dataEmpleado.idBranch,
      type: 'branch',
      description: null,
      active: 1
    };

    const addBranchPermission$ = this.usersxrootService.addUserxPermission(sucursal);

    const addDetailedPermissions$ = from(this.getCRUD(this.dataEmpleado.idPosition)).pipe(
      mergeMap(rolesDefinidos => {
        if (!rolesDefinidos || rolesDefinidos.length === 0) {
          return EMPTY;
        }
        const detailObservables = rolesDefinidos.map(permiso => {
          const detailData = {
            idUser: userId,
            idBranch: this.dataEmpleado.idBranch,
            idRole: this.dataEmpleado.idDepto,
            idPosicion: this.dataEmpleado.idPosition,
            idDetailedPermission: permiso.idDetailedPermission,
            canCreate: permiso.canCreate,
            canRead: permiso.canRead,
            canUpdate: permiso.canUpdate,
            canDelete: permiso.canDelete,
            active: permiso.active
          };
          return this.permitionsService.addPermitionsDetail(detailData);
        });
        return concat(...detailObservables);
      })
    );

    return concat(addBranchPermission$, addDetailedPermissions$);
  }

  getCRUD(idPosicion: number): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.rolesService.getCatalogCRUD(idPosicion).subscribe({
        next: (data: any) => {
          resolve(data || []);
        },
        error: (error) => {
          if (error.status === 404) {
            resolve([]);
          } else {
            reject(error);
          }
        }
      });
    });
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridOptions.context.componentParent = this;
    this.gridApi.setGridOption('columnDefs', this.columnDefs);
    this.restoreEmailColumnWidth();
    const showSecurity = this.isAdvanced || this.idUser === 42 || this.idRoot === 9;
    this.gridApi.setColumnsVisible(['idRol'], showSecurity);
  }

  onColumnResized(event: any): void {
    if (event.finished === false) return;
    const emailColumn = event.column?.getColId() === 'email'
      ? event.column
      : event.columns?.find((column: any) => column?.getColId() === 'email');
    if (!emailColumn) return;
    const width = Number(emailColumn.getActualWidth());
    if (!Number.isFinite(width) || width < 200) return;
    try {
      localStorage.setItem('smp:users:main:email:width', String(width));
    } catch { /* almacenamiento del navegador no disponible */ }
  }

  private restoreEmailColumnWidth(): void {
    try {
      const width = Number(localStorage.getItem('smp:users:main:email:width'));
      if (Number.isFinite(width) && width >= 200) {
        this.gridApi.applyColumnState({ state: [{ colId: 'email', width }], applyOrder: false });
      }
    } catch { /* almacenamiento del navegador no disponible */ }
  }

  onCellEditingStopped(event: any) {
    if (!this.enterPressed) return;
    this.enterPressed = false;
    const currentIndex = this.editableColumnOrder.indexOf(event.column.getColId());
    if (currentIndex !== -1 && currentIndex < this.editableColumnOrder.length - 1) {
      setTimeout(() => {
        this.gridApi.startEditingCell({
          rowIndex: event.rowIndex,
          colKey: this.editableColumnOrder[currentIndex + 1]
        });
      }, 100);
    }
  }

  public defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    minWidth: 100,
    suppressKeyboardEvent: (params) => {
      if (params.event.key === 'Enter' && params.editing) {
        this.enterPressed = true;
        setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
        return true;
      }
      return false;
    }
  };

  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    masterDetail: true,
    isRowMaster: () => true,
    detailCellRenderer: 'usersDetailWrapper',
    detailRowHeight: 1000,
    context: { componentParent: null },
    rowClass: (params) => {
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

  private _columnDefs: ColDef[] = [];

  get columnDefs(): ColDef[] {
    if (this._columnDefs.length > 0) {
      return this._columnDefs;
    }

    this._columnDefs = [
      { field: 'id', headerName: 'ID', hide: true, filter: 'agNumberColumnFilter', width: 80 },
      { field: 'active', hide: true },
      {
        field: 'displayName',
        headerName: this.translate.instant('modules.userSetup.ui.grid.nameRequired'),
        editable: () => !this.showDeletedUsers,
        filter: true,
        cellEditor: 'autocompleteEditor',
        minWidth: 240,
        flex: 1.5,
        cellEditorParams: (params) => ({
          filterList: this.empleadoCatalgos.map(e => e.name),
          filterKey: 'name',
          placeholder: 'Nombre (máximo 150 caracteres)',
          maxLength: 150,
          minLength: 1,
          onEnterPressed: () => { this.enterPressed = true; }
        }),
        valueSetter: (params) => {
          const newValue = params.newValue?.toUpperCase() ?? '';
          if (newValue.length > 150) {
            alerts.basicAlert(this.translate.instant('modules.userSetup.ui.alerts.nameTooLong'), this.translate.instant('modules.userSetup.ui.alerts.nameLimit'), 'error');
            return false;
          }
          const duplicateExists = this.rowData.some((row, index) =>
            index !== params.node.rowIndex && row.displayName === newValue
          );
          if (duplicateExists) {
            alerts.basicAlert(this.translate.instant('modules.userSetup.ui.alerts.duplicateName'), this.translate.instant('modules.userSetup.ui.alerts.nameAlreadyExists'), 'error');
            return false;
          }
          const empleadoInfo = this.empleadoCatalgos?.find(
            (item) => item.name.toUpperCase() === newValue
          );
          if (empleadoInfo) {
            this.dataEmpleado = empleadoInfo;
            params.data.idRol = 1;
          } else {
            this.dataEmpleado = null;
            params.data.idRol = 0;
          }
          params.data[params.colDef.field] = newValue;
          return true;
        }
      },
      {
        field: 'countEmpresas',
        headerName: this.translate.instant('modules.userSetup.ui.companies'),
        width: 120,
        editable: false,
        cellRenderer: ButtonCellRendererExpenditureComponent,
        cellRendererParams: {
          icon: 'bi bi-building',
          onClick: (node: any) => this.openEmpresasCascade(node)
        },
        valueGetter: (params) => params.data?.countEmpresas ?? 0,
        cellStyle: { backgroundColor: '#e8eaf6', cursor: 'pointer' }
      },
      {
        field: 'permisosMaestros',
        headerName: this.translate.instant('modules.userSetup.ui.masterPermissions'),
        width: 140,
        editable: false,
        cellRenderer: ButtonCellRendererExpenditureComponent,
        cellRendererParams: {
          icon: 'bi bi-shield-lock',
          onClick: (node: any) => this.openMasterPermissionsCascade(node)
        },
        valueGetter: (params) => params.data?.countPermisosMaestros ?? 0,
        cellStyle: { backgroundColor: '#fce4ec', cursor: 'pointer' }
      },
      {
        field: 'email',
        headerName: this.translate.instant('modules.userSetup.ui.grid.emailRequired'),
        cellEditor: 'agTextCellEditor',
        flex: 1,
        editable: () => !this.showDeletedUsers,
        cellEditorParams: { useFormatter: true },
        valueFormatter: (params) => params.value,
        valueSetter: (params) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailRegex.test(params.newValue)) {
            const duplicateExists = this.rowData.some((row, index) =>
              index !== params.node.rowIndex && row.email === params.newValue
            );
            if (duplicateExists) {
              alerts.basicAlert(this.translate.instant('modules.userSetup.ui.alerts.addUser'), this.translate.instant('modules.userSetup.ui.alerts.emailAlreadyExists'), 'error');
              return false;
            }
            params.data[params.colDef.field] = params.newValue;
            this.assignUsernameFromEmail(params.data, params.newValue);
            return true;
          } else {
            alerts.basicAlert(this.translate.instant('modules.userSetup.ui.alerts.editUser'), this.translate.instant('modules.userSetup.ui.alerts.invalidEmail'), 'error');
            return false;
          }
        },
        filter: true
      },
      {
        field: 'usersmall',
        headerName: this.translate.instant('modules.userSetup.ui.grid.username'),
        editable: () => !this.showDeletedUsers,
        width: 150,
        cellEditor: 'agTextCellEditor',
        cellEditorParams: { maxLength: 50 },
        headerTooltip: this.translate.instant('modules.userSetup.ui.grid.usernameTooltip'),
        valueSetter: (params) => {
          const username = String(params.newValue ?? '').toLowerCase().trim();
          if (username.length > 50) {
            alerts.basicAlert(this.translate.instant('modules.userSetup.ui.alerts.usernameTooLong'), this.translate.instant('modules.userSetup.ui.alerts.usernameLimit'), 'error');
            return false;
          }
          params.data.usersmall = username;
          return true;
        }
      },
      {
        headerName: this.translate.instant('modules.userSetup.ui.grid.passwordRequired'),
        field: 'password',
        flex: 1,
        valueGetter: () => '',
        valueSetter: (params) => {
          params.data.password = String(params.newValue ?? '');
          params.data.__passwordChanged = params.data.password.trim().length > 0;
          return true;
        },
        cellRenderer: () => `<span>••••••••</span>`,
        editable: () => !this.showDeletedUsers,
      },
      {
        field: 'telegramOnline',
        headerName: 'Telegram',
        width: 115,
        editable: false,
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
        cellRenderer: (params) => {
          const online = params.value === true || params.value === 1;
          return online
            ? `<span class="badge bg-success" style="font-size:.78rem;padding:4px 10px;border-radius:12px;">🟢 ${this.translate.instant('modules.userSetup.ui.grid.online')}</span>`
            : `<span class="badge bg-secondary" style="font-size:.78rem;padding:4px 10px;border-radius:12px;">⚫ ${this.translate.instant('modules.userSetup.ui.grid.offline')}</span>`;
        },
        onCellClicked: (params) => {
          if (this.showDeletedUsers) return;
          const current = params.data.telegramOnline === true || params.data.telegramOnline === 1;
          params.data.telegramOnline = !current;
          if (!params.data.__isNew) params.data.__modified = true;
          this.notSavedChanges = true;
          this.gridApi.refreshCells({ rowNodes: [params.node], columns: ['telegramOnline'] });
        }
      },
      {
        field: 'monitorTelegram',
        headerName: this.translate.instant('modules.userSetup.ui.grid.telegramAlerts'),
        width: 145,
        editable: false,
        tooltipValueGetter: () => this.translate.instant('modules.userSetup.ui.grid.telegramAlertsTooltip'),
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
        cellRenderer: (params) => {
          const enabled = params.value === true || params.value === 1 || params.value === 'true';
          return enabled
            ? `<span class="badge bg-success" style="font-size:.78rem;padding:4px 10px;border-radius:12px;">🔔 ${this.translate.instant('modules.userSetup.ui.grid.yes')}</span>`
            : `<span class="badge bg-secondary" style="font-size:.78rem;padding:4px 10px;border-radius:12px;">🔕 ${this.translate.instant('modules.userSetup.ui.grid.no')}</span>`;
        },
        onCellClicked: (params) => {
          if (this.showDeletedUsers) return;
          const current = params.data.monitorTelegram === true || params.data.monitorTelegram === 1 || params.data.monitorTelegram === 'true';
          params.data.monitorTelegram = !current;
          if (!params.data.__isNew) params.data.__modified = true;
          this.notSavedChanges = true;
          this.gridApi.refreshCells({ rowNodes: [params.node], columns: ['monitorTelegram'] });
        }
      },
      {
        field: 'idRol',
        headerName: this.translate.instant('modules.userSetup.ui.grid.security'),
        hide: !this.isAdvanced && this.idUser !== 42,
        cellStyle: { backgroundColor: '#d4edda' },
        onCellClicked: this.togglePermissions.bind(this)
      },
      {
        field: 'canAuthorizeProcesses',
        headerName: this.translate.instant('modules.userSetup.ui.grid.authorizeProcesses'),
        width: 145,
        editable: false,
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
        cellRenderer: (params) => {
          const allowed = params.value === true || params.value === 1 || params.value === 'true';
          return allowed
            ? `<span class="badge bg-success">${this.translate.instant('modules.userSetup.ui.grid.yes')}</span>`
            : `<span class="badge bg-light text-muted border">${this.translate.instant('modules.userSetup.ui.grid.no')}</span>`;
        },
        onCellClicked: (params) => {
          const current = params.data.canAuthorizeProcesses === true || params.data.canAuthorizeProcesses === 1 || params.data.canAuthorizeProcesses === 'true';
          params.data.canAuthorizeProcesses = !current;
          if (!params.data.__isNew) params.data.__modified = true;
          this.notSavedChanges = true;
          this.gridApi.refreshCells({ rowNodes: [params.node], columns: ['canAuthorizeProcesses'], force: true });
        }
      },
      {
        field: 'isRoot',
        headerName: this.translate.instant('modules.userSetup.ui.grid.root'),
        width: 100,
        editable: false,
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
        cellRenderer: (params) => {
          const isRoot = params.value === 1 || params.value === true;
          return isRoot
            ? `<span class="badge bg-warning text-dark" style="font-size:.78rem;padding:4px 10px;border-radius:12px;">⭐ ${this.translate.instant('modules.userSetup.ui.grid.root')}</span>`
            : `<span class="badge bg-light text-muted border" style="font-size:.78rem;padding:4px 10px;border-radius:12px;">— ${this.translate.instant('modules.userSetup.ui.grid.normal')}</span>`;
        },
        onCellClicked: (params) => {
          const current = params.data.isRoot === 1 || params.data.isRoot === true;
          params.data.isRoot = current ? 0 : 1;
          if (!params.data.__isNew) params.data.__modified = true;
          this.notSavedChanges = true;
          this.gridApi.refreshCells({ rowNodes: [params.node], columns: ['isRoot'] });
        }
      },
      {
        field: 'picture',
        headerName: this.translate.instant('modules.userSetup.ui.grid.profilePicture'),
        cellRenderer: (params) => {
          const imgSrc = params.value || './assets/img/profile.png';
          return `<img src="${imgSrc}" style="width: 50px; height: 50px; object-fit: cover; cursor: pointer;" title="${this.translate.instant('modules.userSetup.ui.alerts.changePicture')}"/>`;
        },
        onCellClicked: (params) => {
          setTimeout(() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/jpeg,image/png';
            input.style.display = 'none';
            document.body.appendChild(input);
            input.onchange = async (event) => {
              const file = (event.target as HTMLInputElement).files?.[0];
              if (file) {
                // Validar tipo de archivo
                if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
                  alerts.basicAlert(this.translate.instant('modules.userSetup.ui.alerts.invalidFileType'), this.translate.instant('modules.userSetup.ui.alerts.imagesOnly'), 'error');
                  document.body.removeChild(input);
                  return;
                }
                // Validar tamaño (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                  alerts.basicAlert(this.translate.instant('modules.userSetup.ui.alerts.fileTooLarge'), this.translate.instant('modules.userSetup.ui.alerts.pictureSizeLimit'), 'error');
                  document.body.removeChild(input);
                  return;
                }
                try {
                  // Mostrar indicador de carga
                  alerts.showLoading(this.translate.instant('modules.userSetup.ui.alerts.uploadingPicture'), this.translate.instant('modules.userSetup.ui.alerts.waitForPicture'));
                  // Subir imagen a Firebase y obtener la URL
                  const url = await this.imageHandlerService.uploadFileToFirebase(file, 'images/users-profile');
                  params.data.picture = url;
                  params.data.__modified = true;
                  this.gridApi.refreshCells({ rowNodes: [params.node] });
                  this.notSavedChanges = true;
                  // Cerrar loading y mostrar éxito
                  alerts.closeLoading();
                  alerts.basicAlert(this.translate.instant('modules.userSetup.ui.alerts.pictureUploaded'), this.translate.instant('modules.userSetup.ui.alerts.pictureUploadedSuccessfully'), 'success');
                } catch (error: any) {
                  console.error('Error al subir imagen:', error);
                  alerts.closeLoading();
                  const msg = error?.code || error?.message || this.translate.instant('modules.userSetup.ui.alerts.pictureUploadFailed');
                  alerts.basicAlert(this.translate.instant('error'), msg, 'error');
                }
              }
              document.body.removeChild(input);
            };
            input.click();
          }, 0);
        },
        editable: false,
        flex: 1
      },
      {
        field: 'signature',
        headerName: this.translate.instant('modules.userSetup.ui.grid.signature'),
        cellRenderer: (params) => {
          const imgSrc = params.value || '';
          if (imgSrc) {
            return `<img src="${imgSrc}" style="width: 100px; height: 50px; object-fit: contain; cursor: pointer;" title="${this.translate.instant('modules.userSetup.ui.alerts.changeSignature')}"/>`;
          } else {
            return `<div style="width: 100px; height: 50px; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; cursor: pointer;" title="${this.translate.instant('modules.userSetup.ui.alerts.addSignature')}">${this.translate.instant('modules.userSetup.ui.grid.signature')}</div>`;
          }
        },
        onCellClicked: (params) => {
          setTimeout(() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/jpeg,image/png';
            input.style.display = 'none';
            document.body.appendChild(input);
            input.onchange = async (event) => {
              const file = (event.target as HTMLInputElement).files?.[0];
              if (file) {
                // Validar tipo de archivo
                if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
                  alerts.basicAlert(this.translate.instant('modules.userSetup.ui.alerts.invalidFileType'), this.translate.instant('modules.userSetup.ui.alerts.imagesOnly'), 'error');
                  document.body.removeChild(input);
                  return;
                }
                // Validar tamaño (max 2MB para firma)
                if (file.size > 2 * 1024 * 1024) {
                  alerts.basicAlert(this.translate.instant('modules.userSetup.ui.alerts.fileTooLarge'), this.translate.instant('modules.userSetup.ui.alerts.signatureSizeLimit'), 'error');
                  document.body.removeChild(input);
                  return;
                }
                try {
                  // Mostrar indicador de carga
                  alerts.showLoading(this.translate.instant('modules.userSetup.ui.alerts.uploadingSignature'), this.translate.instant('modules.userSetup.ui.alerts.waitForSignature'));
                  // Subir firma a Firebase y obtener la URL
                  const url = await this.imageHandlerService.uploadFileToFirebase(file, 'images/users-signatures');
                  params.data.signature = url;
                  params.data.__modified = true;
                  this.gridApi.refreshCells({ rowNodes: [params.node] });
                  this.notSavedChanges = true;
                  // Cerrar loading y mostrar éxito
                  alerts.closeLoading();
                  alerts.basicAlert(this.translate.instant('modules.userSetup.ui.alerts.signatureUploaded'), this.translate.instant('modules.userSetup.ui.alerts.signatureUploadedSuccessfully'), 'success');
                } catch (error: any) {
                  console.error('Error al subir firma:', error);
                  alerts.closeLoading();
                  const msg = error?.code || error?.message || this.translate.instant('modules.userSetup.ui.alerts.signatureUploadFailed');
                  alerts.basicAlert(this.translate.instant('error'), msg, 'error');
                }
              }
              document.body.removeChild(input);
            };
            input.click();
          }, 0);
        },
        editable: false,
        flex: 1
      }
    ];

    return this._columnDefs;
  }

  selectedRowData: any = null;

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
      if (!this.isAdvanced) {
        this.enviarSignal();
      }
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    if (!event.node.isSelected()) {
      event.node.setSelected(true);
    }
    this.notSavedChanges = true;
    if (!event.data.__isNew) {
      event.data.__modified = true;
    }
    if (event.colDef.field === 'email') {
      this.assignUsernameFromEmail(event.data, event.newValue);
    }
    if (event.colDef.field === 'displayName') {
      const selectedName = event.newValue?.toUpperCase();
      const empleadoInfo = this.empleadoCatalgos?.find(
        (item) => item.name.toUpperCase() === selectedName
      );
      if (empleadoInfo) {
        event.data.idEmployee = empleadoInfo.id;
        event.data.email = empleadoInfo.email;
        this.assignUsernameFromEmail(event.data, empleadoInfo.email);
      } else {
        event.data.idEmployee = null;
        event.data.idBranch = null;
      }
      if (this.selectedRowData) {
        this.enviarSignal();
      }
    }
  }

  /** Deriva el username inicial del correo sin sobrescribir uno personalizado. */
  private assignUsernameFromEmail(user: any, email: string): void {
    const value = String(email || '').trim().toLowerCase();
    const current = String(user?.usersmall || '').trim();
    if (!value.includes('@') || (current && current.toUpperCase() !== 'SINUSER')) return;
    const base = value.split('@', 1)[0].slice(0, 50);
    const used = new Set(this.rowData
      .filter((row: any) => row !== user)
      .map((row: any) => String(row.usersmall || '').trim().toLowerCase())
      .filter(Boolean));
    let username = base;
    let suffix = 2;
    while (used.has(username)) {
      const ending = String(suffix++);
      username = `${base.slice(0, 50 - ending.length)}${ending}`;
    }
    user.usersmall = username;
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      active: 1,
      displayName: '',
      country: '',
      email: '',
      password: '',
      idRol: 0,
      age: 0,
      id_company: this.idRoot,
      idDepartament: 1,
      invited: false,
      phone: '',
      id_position: 0,
      picture: './assets/img/profile.png',
      signature: '',
      usersmall: 'SINUSER',
      allowWhatsapp: true,
      isRoot: false,
      canAuthorizeProcesses: false,
      monitorTelegram: false,
      __isNew: true
    };

    this.rowData = [newItem, ...this.rowData];
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Add Registro en Usuarios',
      'Menu Administracion Usuarios',
      this.trackingService.getEmail()
    );
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
    setTimeout(() => {
      this.gridApi.ensureIndexVisible(0);
      this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'displayName' });
    }, 0);
  }

  async saveChanges() {
    if (this.showDeletedUsers) return;
    this.gridApi?.stopEditing();
    const newRows = this.rowData.filter(row => row.__isNew);
    const modifiedRows = this.rowData.filter(row => row.__modified && !row.__isNew);

    for (const row of [...newRows, ...modifiedRows]) {
      const invalidFields: string[] = [];
      if (String(row.usersmall ?? '').length > 50) invalidFields.push(this.translate.instant('modules.userSetup.ui.alerts.usernameLimit'));
      if (String(row.displayName ?? '').length > 150) invalidFields.push(this.translate.instant('modules.userSetup.ui.alerts.nameLimit'));
      if (invalidFields.length) {
        alerts.basicAlert(this.translate.instant('modules.userSetup.ui.alerts.reviewFieldLimits'), invalidFields.join(' '), 'error');
        return;
      }
    }

    const invalidNewRows = newRows.filter(item => !item.displayName || !item.email || !item.password);
    if (invalidNewRows.length > 0) {
      const invalidRow = invalidNewRows[0];
      let missingFields = [];
      if (!invalidRow.displayName) missingFields.push(this.translate.instant('modules.userSetup.ui.fields.name'));
      if (!invalidRow.email) missingFields.push(this.translate.instant('modules.userSetup.ui.fields.email'));
      if (!invalidRow.password) missingFields.push(this.translate.instant('modules.userSetup.ui.fields.password'));
      alerts.basicAlert(this.translate.instant('modules.userSetup.ui.alerts.newUserValidation'), `${this.translate.instant('modules.userSetup.ui.alerts.requiredFieldsMissing')} ${missingFields.join(', ')}`, 'error');
      return;
    }

    const invalidModifiedRows = modifiedRows.filter(item => !item.displayName || !item.email);
    if (invalidModifiedRows.length > 0) {
      const invalidRow = invalidModifiedRows[0];
      let missingFields = [];
      if (!invalidRow.displayName) missingFields.push(this.translate.instant('modules.userSetup.ui.fields.name'));
      if (!invalidRow.email) missingFields.push(this.translate.instant('modules.userSetup.ui.fields.email'));
      alerts.basicAlert(this.translate.instant('modules.userSetup.ui.alerts.updatedUserValidation'), `${this.translate.instant('modules.userSetup.ui.alerts.requiredFieldsMissing')} ${missingFields.join(', ')}`, 'error');
      return;
    }

    try {
      const addUserRequests = newRows.map((row, index) => {
        const cleanedData = this.cleanDataForServer(row);
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Add Registro en Usuarios',
          'Menu Administracion Usuarios',
          this.trackingService.getEmail()
        );
        return this.usersService.addUser(cleanedData).pipe(
          tap(response => {
            if (response.code !== 200 || !response.data?.id) {
              throw new Error(`Error del servidor: ${response.message || 'Respuesta inválida'}`);
            }
          })
        );
      });

      const updateUserRequests = modifiedRows.map(row => {
        const cleanedData = this.cleanDataForServer(row);
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Update Registro en Usuarios',
          'Menu Administracion Usuarios',
          this.trackingService.getEmail()
        );
        return this.usersService.updateUser(row.id, cleanedData);
      });

      const userResponses = await lastValueFrom(
        concat(...addUserRequests, ...updateUserRequests).pipe(toArray())
      );

      const newUserResponses = userResponses.slice(0, newRows.length);

      const permissionRequests = newUserResponses.map((response) => {
        const userId = response.data?.id;
        if (!userId) return null;

        const formattedRoot = {
          idUser: userId,
          idPermission: this.signalsService.getRootSelectedBySidebar()(),
          type: 'root',
          description: 'SIN DESCRIPCION',
          active: 1
        };

        const requests = [this.usersxrootService.addUserxPermission(formattedRoot)];

        const branchPermissionFromEmployee = this.procesoData(userId);
        if (branchPermissionFromEmployee && branchPermissionFromEmployee !== EMPTY) {
          requests.push(branchPermissionFromEmployee);
        } else {
          const branchId = this.signalsService.getBranchSelectedBySidebar()();
          if (branchId > 0) {
            requests.push(this.usersxrootService.addUserxPermission({
              idUser: userId,
              idPermission: branchId,
              type: 'branch',
              description: 'SIN DESCRIPCION',
              active: 1
            }));
          }
        }
        return requests;
      }).filter(req => req !== null);

      if (permissionRequests.length > 0) {
        await lastValueFrom(concat(...permissionRequests.flat()).pipe(toArray()));
      }

      alerts.basicAlert(this.translate.instant('modules.userSetup.ui.alerts.dataUpdated'), this.translate.instant('modules.userSetup.ui.alerts.dataUpdatedSuccessfully'), 'success');
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      setTimeout(() => this.obtenerDatos(), 500);

    } catch (error) {
      console.error('Error al guardar usuarios:', error);
      let errorMessage = this.translate.instant('modules.userSetup.ui.alerts.updateFailed');
      if (error?.error?.message) errorMessage = error.error.message;
      else if (error?.status === 400) errorMessage = this.translate.instant('modules.userSetup.ui.alerts.validationError');
      else if (error?.status === 409) errorMessage = this.translate.instant('modules.userSetup.ui.alerts.emailConflict');
      else if (error?.status === 500) errorMessage = this.translate.instant('modules.userSetup.ui.alerts.serverError');
      alerts.basicAlert(this.translate.instant('error'), errorMessage, 'error');
    }
  }

  async deleteUser() {
    if (this.showDeletedUsers) return;
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert(this.translate.instant('modules.userSetup.ui.alerts.deleteUser'), this.translate.instant('modules.userSetup.ui.alerts.selectUserToDelete'), 'error');
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    if (selectedData.isRoot === 1 || selectedData.isRoot === true) {
      alerts.basicAlert(this.translate.instant('modules.userSetup.ui.alerts.deleteUser'), this.translate.instant('modules.userSetup.ui.alerts.cannotDeleteAdministrator'), 'error');
      return;
    }

    alerts.confirmAlert(this.translate.instant('modules.userSetup.ui.alerts.deleteEmployee'), this.translate.instant('modules.userSetup.ui.alerts.confirmDeleteUser'), 'warning', this.translate.instant('modules.userSetup.ui.alerts.yesDelete'))
      .then((value) => {
        if (value.isConfirmed) {
          selectedData.active = 0;
          this.usersService.deleteUser(id, selectedData).pipe(
            catchError((error) => {
              alerts.basicAlert(this.translate.instant('modules.userSetup.ui.alerts.deleteUser'), this.translate.instant('modules.userSetup.ui.alerts.deleteFailed'), 'error');
              return EMPTY;
            })
          ).subscribe(() => {
            alerts.basicAlert(this.translate.instant('modules.userSetup.ui.alerts.deleteUser'), this.translate.instant('modules.userSetup.ui.alerts.userDeleted'), 'success');
            this.obtenerDatos();
            this.trackingService.addLog(
              this.trackingService.getnameComp(),
              'Delete Registro en Usuarios',
              'Menu Administracion Usuarios',
              this.trackingService.getEmail()
            );
            this.notSavedChanges = false;
            this.selectedRowData = null;
          });
        }
      });
  }

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Revertir Registro en Usuarios',
      'Menu Administracion Usuarios',
      this.trackingService.getEmail()
    );
  }

  togglePermissions() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert(this.translate.instant('modules.userSetup.ui.masterPermissions'), this.translate.instant('modules.userSetup.ui.alerts.selectUserPermissions'), 'warning');
      return;
    }

    const selectedNode = selectedNodes[0];
    const selectedData = selectedNode.data;
    const isCurrentlyExpanded = selectedNode.expanded && selectedData.detailType === 'permissions';

    if (isCurrentlyExpanded) {
      selectedNode.setExpanded(false);
      selectedData.detailType = null;
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
    } else {
      this.gridApi.forEachNode((node) => { if (node.expanded) node.setExpanded(false); });
      selectedData.detailType = 'permissions';
      this.gridApi.setFilterModel(null);
      this.gridApi.setFilterModel({ id: { filterType: 'number', type: 'equals', filter: selectedData.id } });
      this.gridApi.onFilterChanged();
      setTimeout(() => selectedNode.setExpanded(true), 50);
    }
  }

  openEmpresasCascade(node: any): void {
    if (!Number.isSafeInteger(Number(node?.data?.id)) || Number(node.data.id) <= 0) {
      alerts.basicAlert(this.translate.instant('modules.userSetup.ui.alerts.saveUser'), this.translate.instant('modules.userSetup.ui.alerts.saveBeforeAssignments'), 'info');
      return;
    }
    const data = node.data;
    if (!data) return;

    const isCurrentlyExpanded = node.expanded && data.detailType === 'empresas';

    if (isCurrentlyExpanded) {
      node.setExpanded(false);
      data.detailType = null;
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
      return;
    }

    this.gridApi.forEachNode((n: any) => { if (n.expanded) n.setExpanded(false); });
    data.detailType = 'empresas';
    this.gridApi.setFilterModel(null);
    this.gridApi.setFilterModel({ id: { filterType: 'number', type: 'equals', filter: data.id } });
    this.gridApi.onFilterChanged();
    setTimeout(() => node.setExpanded(true), 50);
  }

  closeUserDetail(node: any): void {
    if (node?.data) {
      node.setExpanded(false);
      node.data.detailType = null;
    }
    this.gridApi?.setFilterModel(null);
    this.gridApi?.onFilterChanged();
  }

  openMasterPermissionsCascade(node: any): void {
    this.openEmpresasCascade(node);
  }

  updateEmpresasCount(userId: number, count: number): void {
    if (!this.gridApi) return;
    this.gridApi.forEachNode((node) => {
      if (node.data?.id === userId) {
        node.data.countEmpresas = count;
        this.gridApi.refreshCells({ rowNodes: [node], columns: ['countEmpresas'], force: true });
      }
    });
  }

  getRoleColorEmoji(roleId: number): string {
    const colorEmojis = ['🔵', '🟢', '🔴', '🟡', '🟣', '🟠', '🟦', '🩷', '⚫', '🟦', '⚪', '🟤'];
    return colorEmojis[roleId % colorEmojis.length];
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    const passwordChanged = data.__isNew || data.__passwordChanged === true;
    delete cleanedData.__passwordChanged;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    // Una edición común nunca envía el password recibido del servidor; solo se manda
    // cuando el usuario capturó explícitamente una contraseña nueva en esta fila.
    if (!data.__isNew) {
      if (passwordChanged && String(cleanedData.password ?? '').trim()) {
        cleanedData.password = String(cleanedData.password).trim();
        cleanedData.changePassword = true;
      } else {
        delete cleanedData.password;
        delete cleanedData.changePassword;
      }
    }

    // Procesar imágenes - ahora son URLs de Firebase, no base64
    if (cleanedData.picture === './assets/img/profile.png' || !cleanedData.picture) {
      delete cleanedData.picture; // No enviar la imagen por defecto
    }
    // Si es base64 (legacy o error), advertir pero mantener para evitar pérdida de datos
    if (cleanedData.picture && cleanedData.picture.startsWith('data:')) {
      console.warn('Se detectó imagen en base64, debería ser URL de Firebase');
    }
    if (!cleanedData.signature) {
      delete cleanedData.signature; // No enviar si está vacío
    }
    // Si es base64 (legacy o error), advertir
    if (cleanedData.signature && cleanedData.signature.startsWith('data:')) {
      console.warn('Se detectó firma en base64, debería ser URL de Firebase');
    }
    cleanedData.id_company = Number(cleanedData.id_company) || this.idRoot;
    cleanedData.idRol = Number(cleanedData.idRol) || 0;
    cleanedData.idDepartament = Number(cleanedData.idDepartament) || 1;
    cleanedData.isRoot = Boolean(cleanedData.isRoot);
    cleanedData.canAuthorizeProcesses = cleanedData.canAuthorizeProcesses === true || cleanedData.canAuthorizeProcesses === 1 || cleanedData.canAuthorizeProcesses === 'true';
    cleanedData.monitorTelegram = cleanedData.monitorTelegram === true || cleanedData.monitorTelegram === 1 || cleanedData.monitorTelegram === 'true';
    cleanedData.active = Number(cleanedData.active) || 1;
    return cleanedData;
  }
}
