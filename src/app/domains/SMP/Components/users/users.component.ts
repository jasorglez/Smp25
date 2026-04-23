import { CommonModule } from '@angular/common';
import { Component, computed, effect, HostListener, inject, Injectable, OnDestroy, ViewChild } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { UsersService } from 'app/services/users.service';
import { alerts } from 'app/helpers/alerts';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { catchError, concat, concatMap, EMPTY, forkJoin, lastValueFrom, of, toArray, tap, Observable, from, mergeMap, Subscription } from 'rxjs';
import { BranchsService } from 'app/services/branchs.service';
import { map } from 'rxjs/operators';
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
import { MasterPermissions2Service } from 'app/services/master-permissions-2.service';

@Injectable({
  providedIn: 'root',
})

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
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
  gridHeight: string = '100%';
  newlyAddedRows: string[] = [];
  entrada: any;
  departamentos: any[] = [];
  position: any[] = [];
  rowData: any[] = [];
  
  paginationPageSize = 20;
  pagination = true;
  notSavedChanges: boolean = false;
  hasDetailExpanded: boolean = false;
  paginationPageSizeSelector = false;
  id: string;
  userRoot: number = 0;
  authorizedPass: boolean = false;
  dataEmpleado: any = null;
  empleadoCatalgos: any[] = [];
  idUser: number = null;
  isAdvanced: boolean = false;
  invited: boolean = false;

  // --- Modal ---
  showPermissionsModal: boolean = false;
  modalUserName: string = '';
  modalPermissions: { idUser: number | string, idBranch: number, idRole: number, idPosicion: number, scope?: 'userSystem' | 'position', seedFromRolePosition?: boolean, roleTemplateOnly?: boolean, idCompany?: number } | null = null;
  private modalSubscription: Subscription;

  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  private permissionType: string = 'root';

  private editableColumnOrder = ['displayName', 'email', 'password', 'isRoot'];
  private enterPressed: boolean = false;
  private _revertingIsRoot = false;

  private usersService        = inject(UsersService);
  private imageHandlerService = inject(ImageHandlerService);
  private usersxrootService   = inject(UsersxpermissionsService);
  private trackingService     = inject(TrackingService);
  private catalogService      = inject(CatalogsService);
  private signalsService      = inject(SignalsService);
  private rolesService        = inject(RolesService);  
  private employeeService     = inject(EmployeesService);
  private permitionsService   = inject(PermitionsService);
  private modalService        = inject(ModalService);
  private masterPermissions2Service = inject(MasterPermissions2Service);
  private branchsService = inject(BranchsService);
  authService                 = inject(AuthService);

  /** UserSystem › Setup Usuarios (Departamento / Security) por fila de usuario. */
  private userSetupFlagsById = new Map<number, { department: boolean; security: boolean }>();

  profile = computed(() => this.signalsService.profile);

  /** Si el usuario logueado tiene el switch "Security" encendido, puede dar clic en la columna Security. */
  private sessionSecurityEnabled(): boolean {
    // Root (super usuario) no debe verse restringido por este switch.
    if (this.authService.isCurrentUserRoot()) {
      return true;
    }
    return this.authService.hasUsersMenuSecurityAccess();
  }

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
    this.signalsService.nameCompany.set(null);
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue = 'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  /**
   * Espacio reservado encima del panel Security (menú SMP, pestaña interna, botonera, cabecera grid, ~1 fila maestra).
   * Alineado con .users-tab-panel { height: calc(100vh - 228px) }.
   */
  private readonly detailPanelTopReservePx = 302;

  /** Altura del panel «Sucursales» para que llegue hasta el fondo del área útil (sin franja gris). */
  private computeDetailPanelHeight(): number {
    if (typeof window === 'undefined') {
      return 560;
    }
    const h = window.innerHeight;
    return Math.max(380, h - this.detailPanelTopReservePx);
  }

  private applyDetailRowHeight(): void {
    if (!this.gridApi) {
      return;
    }
    const dh = this.computeDetailPanelHeight();
    (this.gridApi as any).setGridOption('detailRowHeight', dh);
    try {
      this.gridApi.resetRowHeights();
    } catch {
      /* noop */
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.applyDetailRowHeight();
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

      // Evita llamadas con idRoot null/undefined (provoca 400 con id=null / idCompany=null)
      if (typeof this.idRoot === 'number' && this.idRoot > 0) {
        this.obtenerDatos();
        this.getRoles();
        this.obtenerEmpleados();
      }
      this.verification();
      if (this.signalsService.getRefresSecurity()()) {
        if (this.authService.isCurrentUserRoot() || (typeof this.idRoot === 'number' && this.idRoot > 0)) {
          this.obtenerDatos();
          this.signalsService.setRefresSecurity(false);
        }
      }
    });

    effect(() => {
      const delta = this.signalsService.getSecurityDelta()();
      if (delta && delta.userId > 0 && this.gridApi) {
        const row = this.rowData?.find((r: any) => r.id === delta.userId);
        if (row) {
          row.idRol = (Number(row.idRol) || 0) + delta.delta;
          this.gridApi.applyTransaction({ update: [row] });
        }
        this.signalsService.clearSecurityDelta();
      }
    });

    effect(() => {
      this.signalsService.guardRefreshTick();
      if (typeof this.idRoot === 'number' && this.idRoot > 0 && this.rowData?.length) {
        this.refreshUserSetupFlagsCache();
      }
    });

    this.modalSubscription = this.modalService.openPermissions$.subscribe(data => {
      this.modalPermissions = {
        idUser: data.idUser,
        idBranch: data.idBranch,
        idRole: data.idRole,
        idPosicion: data.idPosicion,
        scope: data.scope,
        seedFromRolePosition: data.seedFromRolePosition,
        roleTemplateOnly: data.roleTemplateOnly,
        idCompany: data.idCompany,
      };
      this.modalUserName = data.modalTitleDetail ?? data.userName;
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

  /**
   * Conteo de filas Usersxpermission tipo branch por usuario, solo si idPermission es sucursal de `idCompany`
   * (misma lógica que la tabla «Sucursales de: …» del detalle).
   */
  private buildBranchCountByUserForCompany(branchPermsRaw: any, branchesRaw: any): Map<number, number> {
    const branchList = Array.isArray(branchesRaw)
      ? branchesRaw
      : Array.isArray(branchesRaw?.data)
        ? branchesRaw.data
        : [];
    const branchIds = new Set(
      branchList
        .map((b: any) => Number(b?.id ?? b?.Id))
        .filter((n: number) => Number.isFinite(n) && n > 0)
    );
    const perms = Array.isArray(branchPermsRaw) ? branchPermsRaw : [];
    const countByUser = new Map<number, number>();
    for (const p of perms) {
      const uid = Number(p?.idUser ?? p?.IdUser);
      const bid = Number(p?.idPermission ?? p?.IdPermission);
      if (!Number.isFinite(uid) || uid <= 0 || !Number.isFinite(bid) || bid <= 0) {
        continue;
      }
      if (!branchIds.has(bid)) {
        continue;
      }
      const act = p?.active ?? p?.Active ?? 1;
      if (act === 0 || act === false) {
        continue;
      }
      countByUser.set(uid, (countByUser.get(uid) ?? 0) + 1);
    }
    return countByUser;
  }

  private applyUsersListResponse(response: any, securityCountByUser: Map<number, number> | null): void {
    if (!response || response.code !== 200 || !response.data) {
      console.error('Respuesta inválida del servidor');
      return;
    }
    this.rowData = response.data
      .filter((item: any) => item.active !== 0 && item.active !== false)
      .map((item: any) => {
        const idNum = Number(item.id);
        const uid = Number.isFinite(idNum) && idNum > 0 ? idNum : Number(item.id);
        const n = Number(uid);
        const idRolDisplay =
          securityCountByUser != null && Number.isFinite(n) && n > 0
            ? securityCountByUser.get(n) ?? 0
            : Number(item.idRol ?? item.IdRol ?? 0) || 0;
        return {
          ...item,
          id: Number.isFinite(idNum) && idNum > 0 ? idNum : item.id,
          idRol: idRolDisplay,
        };
      });
    this.refreshUserSetupFlagsCache();
  }

  obtenerDatos() {
    if (!this.authService.isCurrentUserRoot() && !(typeof this.idRoot === 'number' && this.idRoot > 0)) {
      // Todavía no hay compañía/root seleccionado; evita request con id=null
      return;
    }

    const logFetch = () =>
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Get Registro en Usuarios',
        'Menu Recursos Humanos Usuarios',
        this.trackingService.getEmail()
      );

    if (this.authService.isCurrentUserRoot()) {
      forkJoin({
        users: this.usersService.getAllUsers(),
        branchPerms: this.usersxrootService.getDataUsersxPermissions('branch').pipe(catchError(() => of([]))),
      }).subscribe({
        next: ({ users, branchPerms }: any) => {
          // Para root: contar permisos de tipo branch por usuario sin filtrar por empresa
          const perms = Array.isArray(branchPerms) ? branchPerms : [];
          const countByUser = new Map<number, number>();
          for (const p of perms) {
            const uid = Number(p?.idUser ?? p?.IdUser);
            const bid = Number(p?.idPermission ?? p?.IdPermission);
            const act = p?.active ?? p?.Active ?? 1;
            if (!Number.isFinite(uid) || uid <= 0 || !Number.isFinite(bid) || bid <= 0) continue;
            if (act === 0 || act === false) continue;
            countByUser.set(uid, (countByUser.get(uid) ?? 0) + 1);
          }
          this.applyUsersListResponse(users, countByUser);
          logFetch();
        },
        error: (error) => console.error('Error al obtener los datos:', error),
      });
    } else {
      forkJoin({
        users: this.usersService.getDataUsers(this.idRoot),
        branches: this.branchsService.getBranches(this.idRoot).pipe(catchError(() => of([]))),
        branchPerms: this.usersxrootService.getDataUsersxPermissions('branch').pipe(catchError(() => of([]))),
      }).subscribe({
        next: ({ users, branches, branchPerms }) => {
          const countByUser = this.buildBranchCountByUserForCompany(branchPerms, branches);
          this.applyUsersListResponse(users, countByUser);
          logFetch();
        },
        error: (error) => console.error('Error al obtener los datos:', error),
      });
    }
  }

  getRoles() {
    if (!(typeof this.idRoot === 'number' && this.idRoot > 0)) {
      // Evita request con idCompany=null
      this.departamentos = [];
      return;
    }
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

    const addBranchPermission$ = this.usersxrootService.addUserxPermission(sucursal).pipe(
      concatMap(() => this.usersService.updateActulizarSecurity(userId, 'SUMA'))
    );

    const normalizeCrudArray = (data: any): any[] => {
      if (Array.isArray(data)) return data;
      if (data && typeof data === 'object') {
        const o = data as Record<string, any>;
        if (Array.isArray(o['data'])) return o['data'];
        if (Array.isArray(o['project'])) return o['project'];
        if (Array.isArray(o['permissions'])) return o['permissions'];
      }
      return [];
    };

    /**
     * Para encender switches (panel derecho y UserSystemPermissions) solo cuenta lectura.
     * Create/Update/Delete NO deben activar módulos/tarjetas por sí solos.
     */
    const anyReadOn = (r: any): boolean => {
      return (
        r?.detailedRead === true ||
        r?.DetailedRead === true ||
        r?.masterRead === true ||
        r?.MasterRead === true ||
        r?.canRead === true ||
        r?.CanRead === true
      );
    };

    const idCompany = Number(this.signalsService.getRootSelectedBySidebar()() ?? this.idRoot);
    const idRole = Number(this.dataEmpleado.idDepto);
    const idPosicion = Number(this.dataEmpleado.idPosition);

    const templateRows$ = this.rolesService.getPermissionsByRoles(
      idCompany,
      idRole,
      idPosicion
    ).pipe(
      map((raw: any) => normalizeCrudArray(raw)),
      catchError(() => of([]))
    );

    // 1) Se inserta CrudPremissionsDelison desde el template Departamento+Posición.
    const addDetailedPermissions$ = templateRows$.pipe(
      mergeMap((rolesDefinidos: any[]) => {
        if (!rolesDefinidos || rolesDefinidos.length === 0) {
          return EMPTY;
        }

        // Dedupe por (idDetailedPermission + idShowPermition): mantener la estructura completa del template.
        const changesMap = new Map<string, any>();
        for (const r of rolesDefinidos) {
          const did = Number(r?.idDetailedPermission ?? r?.IdDetailedPermission);
          const sid = Number(r?.idShowPermition ?? r?.IdShowPermition);
          if (!Number.isFinite(did) || did <= 0 || !Number.isFinite(sid) || sid <= 0) continue;
          const subd =
            String(
              r?.subdetailedPermissionName ??
                r?.SubdetailedPermissionName ??
                r?.name ??
                r?.Name ??
                ''
            ).trim();
          const key = `${did}-${sid}-${subd}`;
          if (changesMap.has(key)) continue;

          const canRead = r?.canRead ?? r?.CanRead ?? r?.detailedRead ?? r?.DetailedRead ?? false;
          const masterRead =
            r?.masterRead ?? r?.MasterRead ?? (r?.masterRead === false ? false : anyReadOn(r));
          const detailedRead =
            r?.detailedRead ?? r?.DetailedRead ?? (canRead === true ? true : false);
          const canCreate = r?.canCreate ?? r?.CanCreate ?? (canRead ? true : false);
          const canUpdate = r?.canUpdate ?? r?.CanUpdate ?? (canRead ? true : false);
          const canDelete = r?.canDelete ?? r?.CanDelete ?? (canRead ? true : false);

          changesMap.set(key, {
            idUser: userId,
            idBranch: this.dataEmpleado.idBranch,
            idMasterPermission: Number(r?.idMasterPermission ?? r?.IdMasterPermission) || undefined,
            masterRead: masterRead ?? undefined,
            idDetailedPermission: did,
            detailedRead: detailedRead ?? undefined,
            subdetailedPermissionName:
              r?.subdetailedPermissionName ??
              r?.SubdetailedPermissionName ??
              r?.name ??
              r?.Name ??
              null,
            idShowPermition: sid,
            showColumn: r?.showColumn ?? r?.ShowColumn ?? undefined,
            idRole: idRole,
            idPosicion: idPosicion,
            canCreate: canCreate === false ? false : true,
            canRead: canRead === false ? false : true,
            canUpdate: canUpdate === false ? false : true,
            canDelete: canDelete === false ? false : true,
            active: r?.active ?? r?.Active ?? 1,
          });
        }

        const requests = Array.from(changesMap.values()).map((payload) =>
          this.permitionsService.addPermitions(payload)
        );
        // Optimización: enviar CRUD en paralelo con límite de concurrencia.
        return requests.length
          ? from(requests).pipe(
              mergeMap((req$) => req$, 8),
              toArray()
            )
          : EMPTY;
      })
    );

    // 2) Se actualiza UserSystemPermissions para que el sidebar al iniciar sesión refleje compras/almacenes.
    //    Esto usa los mismos “permissionId” que el modal de permisos.
    const seedUserSystem$ = forkJoin({
      templateRows: templateRows$,
      catalog: this.masterPermissions2Service.getMasterPermissions(idCompany).pipe(
        catchError(() => of([]))
      )
    }).pipe(
      mergeMap(({ templateRows, catalog }: any) => {
        const normalizar = (texto: any): string =>
          String(texto ?? '')
            .toLowerCase()
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

        const enabledIds = new Set<number>();
        for (const r of Array.isArray(templateRows) ? templateRows : []) {
          const id = Number(r?.idDetailedPermission ?? r?.IdDetailedPermission);
          if (!Number.isFinite(id) || id <= 0) continue;
          if (anyReadOn(r)) {
            enabledIds.add(id);
          }
        }

        // Ajuste homónimo: Almacenes (switch maestro) necesita el id detallado “Almacenes” homónimo.
        // Si en el template el master Almacenes está ON, forzamos que el id homónimo entre al set.
        const almacenesOn = (Array.isArray(templateRows) ? templateRows : []).some((r: any) => {
          const mn = normalizar(r?.masterPermissionName ?? r?.MasterPermissionName ?? '');
          return mn.includes('almacen') && anyReadOn(r);
        });

        if (almacenesOn && Array.isArray(catalog) && catalog.length > 0) {
          // Buscamos el master “Almacenes” en el catálogo de UserSystemPermissions
          const masterName = (Array.isArray(catalog) ? catalog : []).find((m: any) => {
            const n = normalizar(m?.permissionName ?? m?.PermissionName ?? '');
            return n.includes('almacen');
          })?.permissionName;

          const target = normalizar(masterName);
          const masterEntry =
            (Array.isArray(catalog) ? catalog : []).find((m: any) => {
              const n = normalizar(m?.permissionName ?? m?.PermissionName ?? '');
              return n === target || (n.length >= 3 && target.length >= 3 && (n.includes(target) || target.includes(n)));
            }) ?? null;

          const sameNameDetail = masterEntry?.detailedPermissions?.find((d: any) => {
            const dn = normalizar(d?.permissionName ?? d?.PermissionName ?? '');
            return dn === target;
          });

          const hid = Number(sameNameDetail?.id ?? sameNameDetail?.Id);
          if (Number.isFinite(hid) && hid > 0) {
            enabledIds.add(hid);
          }
        }

        return this.masterPermissions2Service.updateUserPermissions(userId, Array.from(enabledIds));
      })
    );

    const addPrincipalDept$ = (idRole > 0 && idPosicion > 0)
      ? this.permitionsService.addPermitionsDetailBydescription({
          idUser: userId,
          idBranch: this.dataEmpleado.idBranch,
          idRole,
          idPosicion,
          principal: true,
          active: true,
          permissionsInitialized: false,
        }).pipe(catchError(() => of(null)))
      : of(null);

    return concat(addBranchPermission$, addPrincipalDept$, addDetailedPermissions$, seedUserSystem$);
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
    const showSecurity = this.isAdvanced || this.idUser === 42 || this.idRoot === 9;
    this.gridApi.setColumnsVisible(['idRol'], showSecurity);
    this.applyDetailRowHeight();
  }

  onRowGroupOpened(event: any) {
    let anyExpanded = false;
    this.gridApi?.forEachNode((node: any) => {
      if (node.expanded) anyExpanded = true;
    });
    this.hasDetailExpanded = anyExpanded;
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
    /** Valor inicial; onGridReady ajusta con computeDetailPanelHeight() al alto de ventana. */
    detailRowHeight: 560,
    context: { componentParent: null },
    getRowClass: (params: any) => {
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
      {
        field: 'active',
        headerName: 'Activo',
        width: 90,
        cellRenderer: (params: any) => {
          const val = params.value === true || params.value === 1;
          const disabled = !this.authService.isCurrentUserRoot() ? 'disabled' : '';
          return `<input type="checkbox" ${val ? 'checked' : ''} ${disabled} style="width:16px;height:16px;cursor:pointer;" />`;
        },
        onCellClicked: (params: any) => {
          if (!this.authService.isCurrentUserRoot()) return;
          params.node.setDataValue('active', !params.value);
          params.node.data.__modified = true;
          this.notSavedChanges = true;
        },
      },
      {
        field: 'displayName',
        headerName: 'Nombre *',
        editable: () => true,
        filter: true,
        cellEditor: 'autocompleteEditor',
        flex: 1,
        cellEditorParams: (params) => ({
          filterList: this.empleadoCatalgos.map(e => e.name),
          filterKey: 'name',
          placeholder: 'Nombre',
          minLength: 1,
          onEnterPressed: () => { this.enterPressed = true; }
        }),
        valueSetter: (params) => {
          const newValue = params.newValue?.toUpperCase() ?? '';
          const duplicateExists = this.rowData.some((row, index) =>
            index !== params.node.rowIndex && row.displayName === newValue
          );
          if (duplicateExists) {
            alerts.userBasicAlert('Nombre duplicado', 'Ya existe un usuario con ese nombre.', 'error');
            return false;
          }
          const empleadoInfo = this.empleadoCatalgos?.find(
            (item) => item.name.toUpperCase() === newValue
          );
          if (empleadoInfo) {
            this.dataEmpleado = empleadoInfo;
            if (params.data.__isNew) {
              params.data.idRol = 1;
            }
          } else {
            this.dataEmpleado = null;
            if (params.data.__isNew) {
              params.data.idRol = 0;
            }
          }
          params.data[params.colDef.field] = newValue;
          return true;
        }
      },
      {
        field: 'email',
        headerName: 'Email *',
        cellEditor: 'agTextCellEditor',
        flex: 1,
        editable: () => true,
        cellEditorParams: { useFormatter: true },
        valueFormatter: (params) => params.value,
        valueSetter: (params) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailRegex.test(params.newValue)) {
            const duplicateExists = this.rowData.some((row, index) =>
              index !== params.node.rowIndex && row.email === params.newValue
            );
            if (duplicateExists) {
              alerts.userBasicAlert('Añadir usuario', 'Ya existe un usuario con ese correo electrónico.', 'error');
              return false;
            }
            params.data[params.colDef.field] = params.newValue;
            return true;
          } else {
            alerts.userBasicAlert('Editar usuario', 'Correo electrónico no válido.', 'error');
            return false;
          }
        },
        filter: true
      },
      {
        headerName: 'Contraseña *',
        field: 'password',
        flex: 1,
        cellRenderer: () => `<span>••••••••</span>`,
        editable: () => true,
      },
      {
        field: 'idRol',
        headerName: 'Security',
        hide: !this.isAdvanced && this.idUser !== 42,
        cellStyle: (params: any) => {
          const sessionOk = this.sessionSecurityEnabled();
          if (!sessionOk) {
            return { backgroundColor: '#e2e3e5', cursor: 'not-allowed', opacity: 0.85 };
          }
          if (!(typeof this.idRoot === 'number' && this.idRoot > 0)) {
            return { backgroundColor: '#d4edda', cursor: 'pointer' };
          }
          const ok = this.userSetupFlagsById.get(params.data?.id)?.security === true;
          // El color indica el estado del usuario de la fila, pero el clic depende del usuario logueado (sessionOk).
          return ok
            ? { backgroundColor: '#d4edda', cursor: 'pointer' }
            : { backgroundColor: '#e2e3e5', cursor: 'pointer' };
        },
        onCellClicked: (params: any) => this.onSecurityColumnClicked(params),
      },
      {
        field: 'isRoot',
        headerName: 'Root',
        editable: () => true,
        width: 90,
      },
      {
        field: 'picture',
        headerName: 'Imagen de perfil',
        cellRenderer: (params) => {
          const imgSrc = params.value || './assets/img/profile.png';
          return `<img src="${imgSrc}" style="width: 50px; height: 50px; object-fit: cover; cursor: pointer;" title="Clic para cambiar imagen"/>`;
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
                  alerts.userBasicAlert('Tipo no válido', 'Solo se permiten imágenes JPG o PNG', 'error');
                  document.body.removeChild(input);
                  return;
                }
                // Validar tamaño (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                  alerts.userBasicAlert('Archivo muy grande', 'La imagen no puede superar 5MB', 'error');
                  document.body.removeChild(input);
                  return;
                }
                try {
                  // Mostrar indicador de carga
                  alerts.showLoading('Subiendo imagen', 'Por favor espere mientras se sube la imagen de perfil...');
                  // Subir imagen a Firebase y obtener la URL
                  const url = await this.imageHandlerService.uploadFileToFirebase(file, 'users/profile');
                  params.data.picture = url;
                  params.data.__modified = true;
                  this.gridApi.refreshCells({ rowNodes: [params.node] });
                  this.notSavedChanges = true;
                  // Cerrar loading y mostrar éxito
                  alerts.closeLoading();
                  alerts.userBasicAlert('Imagen subida', 'La imagen de perfil se subió correctamente', 'success');
                } catch (error) {
                  console.error('Error al subir imagen:', error);
                  alerts.closeLoading();
                  alerts.userBasicAlert('Error', 'No se pudo subir la imagen a Firebase', 'error');
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
        headerName: 'Firma',
        cellRenderer: (params) => {
          const imgSrc = params.value || '';
          if (imgSrc) {
            return `<img src="${imgSrc}" style="width: 100px; height: 50px; object-fit: contain; cursor: pointer;" title="Clic para cambiar firma"/>`;
          } else {
            return `<div style="width: 100px; height: 50px; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; cursor: pointer;" title="Clic para agregar firma">Firma</div>`;
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
                  alerts.userBasicAlert('Tipo no válido', 'Solo se permiten imágenes JPG o PNG', 'error');
                  document.body.removeChild(input);
                  return;
                }
                // Validar tamaño (max 2MB para firma)
                if (file.size > 2 * 1024 * 1024) {
                  alerts.userBasicAlert('Archivo muy grande', 'La firma no puede superar 2MB', 'error');
                  document.body.removeChild(input);
                  return;
                }
                try {
                  // Mostrar indicador de carga
                  alerts.showLoading('Subiendo firma', 'Por favor espere mientras se sube la firma...');
                  // Subir firma a Firebase y obtener la URL
                  const url = await this.imageHandlerService.uploadFileToFirebase(file, 'users/signatures');
                  params.data.signature = url;
                  params.data.__modified = true;
                  this.gridApi.refreshCells({ rowNodes: [params.node] });
                  this.notSavedChanges = true;
                  // Cerrar loading y mostrar éxito
                  alerts.closeLoading();
                  alerts.userBasicAlert('Firma subida', 'La firma se subió correctamente', 'success');
                } catch (error) {
                  console.error('Error al subir firma:', error);
                  alerts.closeLoading();
                  alerts.userBasicAlert('Error', 'No se pudo subir la firma a Firebase', 'error');
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
    if (event.colDef.field === 'isRoot' && !this._revertingIsRoot) {
      const newVal = event.newValue === true || event.newValue === 1 || event.newValue === 'true';
      const oldVal = event.oldValue === true || event.oldValue === 1 || event.oldValue === 'true';
      if (oldVal && !newVal) {
        const rootCount = (this.rowData || []).filter(
          (r: any) => (r.isRoot === true || r.isRoot === 1) && r.id !== event.data.id
        ).length;
        if (rootCount === 0) {
          alerts.userBasicAlert('Root obligatorio', 'Debe existir al menos un usuario Root.', 'warning');
          this._revertingIsRoot = true;
          event.node.setDataValue('isRoot', event.oldValue);
          this._revertingIsRoot = false;
          return;
        }
      }
    }

    if (!event.node.isSelected()) {
      event.node.setSelected(true);
    }
    this.notSavedChanges = true;
    if (!event.data.__isNew) {
      event.data.__modified = true;
    }
    if (event.colDef.field === 'displayName') {
      const selectedName = event.newValue?.toUpperCase();
      const empleadoInfo = this.empleadoCatalgos?.find(
        (item) => item.name.toUpperCase() === selectedName
      );
      if (empleadoInfo) {
        event.data.idEmployee = empleadoInfo.id;
        event.data.email = empleadoInfo.email;
      } else {
        event.data.idEmployee = null;
        event.data.idBranch = null;
      }
      if (this.selectedRowData) {
        this.enviarSignal();
      }
    }
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      active: true,
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
    const newRows = this.rowData.filter(row => row.__isNew);
    const modifiedRows = this.rowData.filter(row => row.__modified && !row.__isNew);

    const invalidNewRows = newRows.filter(item => !item.displayName || !item.email || !item.password);
    if (invalidNewRows.length > 0) {
      const invalidRow = invalidNewRows[0];
      let missingFields = [];
      if (!invalidRow.displayName) missingFields.push('Nombre');
      if (!invalidRow.email) missingFields.push('Correo electrónico');
      if (!invalidRow.password) missingFields.push('Contraseña');
      alerts.userBasicAlert('Validación - Nuevo Usuario', `Faltan campos obligatorios: ${missingFields.join(', ')}`, 'error');
      return;
    }

    const invalidModifiedRows = modifiedRows.filter(item => !item.displayName || !item.email);
    if (invalidModifiedRows.length > 0) {
      const invalidRow = invalidModifiedRows[0];
      let missingFields = [];
      if (!invalidRow.displayName) missingFields.push('Nombre');
      if (!invalidRow.email) missingFields.push('Correo electrónico');
      alerts.userBasicAlert('Validación - Usuario Modificado', `Faltan campos obligatorios: ${missingFields.join(', ')}`, 'error');
      return;
    }

    try {
      alerts.userSaveLoading('Guardando usuario', 'Espera un momento, el usuario se está creando…');
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

      // Optimización: crear/actualizar usuarios en paralelo (reduce tiempo total).
      const addResponses = addUserRequests.length > 0 ? await lastValueFrom(forkJoin(addUserRequests)) : [];
      const updateResponses = updateUserRequests.length > 0 ? await lastValueFrom(forkJoin(updateUserRequests)) : [];
      const newUserResponses = addResponses;

      // Sync displayName → employee name for modified rows with a linked employee
      for (const row of modifiedRows) {
        const employeeId = Number(row.idEmployee ?? row.idEmpleado ?? 0);
        if (employeeId <= 0 || !row.displayName) continue;
        await this.syncEmployeeName(employeeId, row.displayName);
      }

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

        const requests = [
          this.usersxrootService.addUserxPermission(formattedRoot).pipe(
            concatMap(() => this.usersService.updateActulizarSecurity(userId, 'SUMA'))
          ),
        ];

        const branchPermissionFromEmployee = this.procesoData(userId);
        if (branchPermissionFromEmployee && branchPermissionFromEmployee !== EMPTY) {
          requests.push(branchPermissionFromEmployee);
        } else {
          const branchId = this.signalsService.getBranchSelectedBySidebar()();
          if (branchId > 0) {
            requests.push(
              this.usersxrootService
                .addUserxPermission({
                  idUser: userId,
                  idPermission: branchId,
                  type: 'branch',
                  description: 'SIN DESCRIPCION',
                  active: 1,
                })
                .pipe(concatMap(() => this.usersService.updateActulizarSecurity(userId, 'SUMA')))
            );
          }
        }
        return requests;
      }).filter(req => req !== null);

      if (permissionRequests.length > 0) {
        // Optimización: permisos en paralelo con límite de concurrencia (no saturar el backend).
        const all = permissionRequests.flat();
        await lastValueFrom(
          from(all).pipe(
            mergeMap((req$) => req$, 8),
            toArray()
          )
        );
      }

      alerts.closeLoading();
      alerts.userSaveSuccessToast('Datos actualizados', 'Se han actualizado los datos correctamente.');
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      setTimeout(() => this.obtenerDatos(), 500);

    } catch (error) {
      alerts.closeLoading();
      console.error('Error al guardar usuarios:', error);
      let errorMessage = 'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.';
      if (error?.error?.message) errorMessage = error.error.message;
      else if (error?.status === 400) errorMessage = 'Error de validación: Verifique que todos los campos obligatorios estén completos.';
      else if (error?.status === 409) errorMessage = 'Conflicto: El correo electrónico ya está en uso.';
      else if (error?.status === 500) errorMessage = 'Error del servidor: Contacte al administrador.';
      alerts.userSaveErrorToast('Error', errorMessage);
    }
  }

  async deleteUser() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.userBasicAlert('Eliminar entrada', 'Por favor, seleccione una entrada para eliminar.', 'error');
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    if (selectedData.isRoot === 1 || selectedData.isRoot === true) {
      alerts.userBasicAlert('Eliminar entrada', 'No se puede eliminar un usuario administrador', 'error');
      return;
    }

    const who = (selectedData?.displayName || selectedData?.email || 'este usuario').toString().trim();
    alerts.userConfirmDelete(`Eliminar a ${who}`, '¿Está seguro que desea eliminar este usuario?')
      .then((value) => {
        if (value.isConfirmed) {
          selectedData.active = false;
          this.usersService.deleteUser(id, selectedData).pipe(
            catchError((error) => {
              alerts.userBasicAlert('Eliminar entrada', 'Error al eliminar la entrada.', 'error');
              return EMPTY;
            })
          ).subscribe(() => {
            alerts.userDeleteSuccessToast('Eliminar entrada', 'Entrada eliminada satisfactoriamente.');
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

onSecurityColumnClicked(params: any): void {
    if (!params?.api || !params?.node) {
      return;
    }
    if (!this.authService.isCurrentUserRoot()) {
      if (!this.authService.hasUsersMenuSecurityAccess()) {
        alerts.userBasicAlert(
          'Sin acceso',
          'No tienes el permiso «Security» en Setup Usuarios.',
          'info'
        );
        return;
      }
    }
    params.api.deselectAll();
    params.node.setSelected(true);
    this.togglePermissions();
  }

  private refreshUserSetupFlagsCache(): void {
    if (!(typeof this.idRoot === 'number' && this.idRoot > 0)) {
      this.userSetupFlagsById.clear();
      this.gridApi?.refreshCells({ force: true });
      return;
    }
    const rows = (this.rowData || []).filter((r: any) => r?.id > 0);
    if (rows.length === 0) {
      this.userSetupFlagsById.clear();
      this.gridApi?.refreshCells({ force: true });
      return;
    }
    const requests = rows.map((r: any) =>
      this.masterPermissions2Service.getSetupUsuarioDepartmentAndSecurityFlags(r.id, this.idRoot).pipe(
        map((flags) => ({ id: r.id as number, flags })),
        catchError(() => of({ id: r.id as number, flags: { department: false, security: false } }))
      )
    );
    forkJoin(requests).subscribe((results) => {
      this.userSetupFlagsById.clear();
      for (const { id, flags } of results) {
        this.userSetupFlagsById.set(id, flags);
      }
      this.gridApi?.refreshCells({ force: true });
    });
  }

  /**
   * Localiza el nodo actual en el grid (tras refrescos de rowData el RowNode anterior puede quedar huérfano).
   */
  private findUserRowNodeById(userId: number): any | null {
    let found: any = null;
    this.gridApi.forEachNode((node: any) => {
      const nid = Number(node?.data?.id);
      if (Number.isFinite(nid) && nid === userId) {
        found = node;
      }
    });
    return found;
  }

  togglePermissions() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.userBasicAlert('Permisos', 'Por favor, seleccione un usuario para ver sus permisos.', 'warning');
      return;
    }

    const selectedNode = selectedNodes[0];
    const selectedData = selectedNode.data;
    const isCurrentlyExpanded = selectedNode.expanded && selectedData.detailType === 'permissions';

    if (!isCurrentlyExpanded) {
      if (!this.authService.isCurrentUserRoot()) {
        if (!this.authService.hasUsersMenuSecurityAccess()) {
          alerts.userBasicAlert(
            'Sin acceso',
            'No tienes el permiso «Security» en Setup Usuarios.',
            'info'
          );
          return;
        }
      }
    }

    if (isCurrentlyExpanded) {
      selectedNode.setExpanded(false);
      selectedData.detailType = null;
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
    } else {
      const uid = Number(selectedData?.id);
      if (!Number.isFinite(uid) || uid <= 0) {
        alerts.userBasicAlert(
          'Security',
          'Este usuario aún no tiene ID numérico (p. ej. fila nueva sin guardar). Guarde antes de abrir permisos por sucursal.',
          'warning'
        );
        return;
      }

      this.gridApi.forEachNode((node) => {
        if (node.expanded) {
          node.setExpanded(false);
        }
      });
      selectedData.detailType = 'permissions';

      // El filtro numérico debe usar número; si id venía como string, equals a veces no coincide y la fila
      // desaparece del modelo: el detalle queda en blanco hasta recargar sesión / datos.
      this.gridApi.setFilterModel(null);
      this.gridApi.setFilterModel({
        id: { filterType: 'number', type: 'equals', filter: uid },
      });
      this.gridApi.onFilterChanged();

      setTimeout(() => {
        const node = this.findUserRowNodeById(uid);
        if (node?.data) {
          node.data.detailType = 'permissions';
        }
        if (node) {
          node.setExpanded(true);
          this.applyDetailRowHeight();
        } else {
          selectedData.detailType = null;
          this.gridApi.setFilterModel(null);
          this.gridApi.onFilterChanged();
          alerts.userBasicAlert(
            'Security',
            'No se pudo abrir el detalle (filtro interno). Los filtros se limpiaron; pulse de nuevo en Security o recargue la lista de usuarios.',
            'warning'
          );
        }
      }, 80);
    }
  }

  openEmpresasCascade(node: any): void {
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

    const uid = Number(data?.id);
    if (!Number.isFinite(uid) || uid <= 0) {
      alerts.userBasicAlert(
        'Empresas',
        'Este usuario aún no tiene ID numérico. Guarde antes de abrir el detalle.',
        'warning'
      );
      return;
    }

    this.gridApi.forEachNode((n: any) => {
      if (n.expanded) {
        n.setExpanded(false);
      }
    });
    data.detailType = 'empresas';
    this.gridApi.setFilterModel(null);
    this.gridApi.setFilterModel({
      id: { filterType: 'number', type: 'equals', filter: uid },
    });
    this.gridApi.onFilterChanged();
    setTimeout(() => {
      const fresh = this.findUserRowNodeById(uid);
      if (fresh?.data) {
        fresh.data.detailType = 'empresas';
      }
      if (fresh) {
        fresh.setExpanded(true);
        this.applyDetailRowHeight();
      } else {
        data.detailType = null;
        this.gridApi.setFilterModel(null);
        this.gridApi.onFilterChanged();
        alerts.userBasicAlert(
          'Empresas',
          'No se pudo abrir el detalle. Los filtros se limpiaron; inténtelo de nuevo.',
          'warning'
        );
      }
    }, 80);
  }

  openPermisosMaestros(node: any): void {
    const data = node?.data;
    if (!data?.id) return;
    const idUser = data.id;
    const userName = data.displayName || data.email || 'Usuario';

    this.permitionsService.getInfoByUser(idUser).pipe(
      catchError(() => of([]))
    ).subscribe((branchesData: any) => {
      let idBranch = 0;
      const arr = Array.isArray(branchesData) ? branchesData : [];
      if (arr.length > 0) {
        idBranch = arr[0].Id ?? arr[0].id ?? 0;
      }
      if (!idBranch) {
        this.usersxrootService.getUsersxPermissionsGeneral('branch', idUser).pipe(
          catchError(() => of([]))
        ).subscribe((branchPerms: any) => {
          const perms = Array.isArray(branchPerms) ? branchPerms : [];
          idBranch = perms.length > 0 ? (perms[0].idPermission ?? perms[0].IdPermission) : 0;
          if (!idBranch) {
            alerts.userBasicAlert('Permisos maestros', 'El usuario no tiene sucursales asignadas. Asigne sucursales y departamentos primero.', 'warning');
            return;
          }
          this.continuarAbrirPermisos(idUser, idBranch, userName);
        });
      } else {
        this.continuarAbrirPermisos(idUser, idBranch, userName);
      }
    });
  }

  private continuarAbrirPermisos(idUser: number, idBranch: number, userName: string): void {
    this.permitionsService.getRolYPosicion(idUser, idBranch).pipe(
      catchError(() => of([]))
    ).subscribe((rolesData: any) => {
      const rolesArr = Array.isArray(rolesData) ? rolesData : [];
      const first = rolesArr.length > 0 ? rolesArr[0] : null;
      const idRole = first?.idRole ?? first?.IdRole ?? 0;
      const idPosicion = first?.idPosicion ?? first?.IdPosicion ?? 0;
      if (!idRole || !idPosicion) {
        alerts.userBasicAlert('Permisos maestros', 'El usuario tiene sucursales pero no tiene departamentos/roles asignados. Expanda una sucursal y configure departamentos primero.', 'warning');
        return;
      }
      this.modalService.openPermissions({
        idUser,
        idBranch,
        idRole,
        idPosicion,
        userName
      });
    });
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

  private async syncEmployeeName(employeeId: number, displayName: string): Promise<void> {
    try {
      const empResponse = await lastValueFrom(
        this.employeeService.getEmployeeById(employeeId).pipe(catchError(() => of(null)))
      );
      // API returns List<object> (array), extract first element
      const raw = empResponse?.data ?? empResponse;
      const emp = Array.isArray(raw) ? raw[0] : raw;
      if (!emp) return;
      const empName = (emp.name ?? emp.Name ?? '').trim();
      if (empName.toUpperCase() === displayName.trim().toUpperCase()) return;
      await lastValueFrom(
        this.employeeService.updateEmployee(employeeId, { ...emp, name: displayName.trim() }).pipe(catchError(() => of(null)))
      );
    } catch {
      // name sync is best-effort
    }
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    if (!cleanedData.password || cleanedData.password === '') {
      console.warn('El campo password está vacío, esto puede causar el error');
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
    cleanedData.active = cleanedData.active !== undefined ? Boolean(cleanedData.active) : true;
    // Normalize employee link: frontend uses idEmployee, backend expects idEmpleado
    if ('idEmployee' in cleanedData) {
      cleanedData.idEmpleado = cleanedData.idEmployee != null ? Number(cleanedData.idEmployee) || null : null;
      delete cleanedData.idEmployee;
    }
    return cleanedData;
  }
}