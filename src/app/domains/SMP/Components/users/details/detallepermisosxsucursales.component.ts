import { Component, effect, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { SignalsService } from 'app/services/signals.service';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { BranchsService } from 'app/services/branchs.service';
import { RootService } from 'app/services/root.service';
import { TrackingService } from 'app/services/tracking.service';
import { alerts } from 'app/helpers/alerts';
import { catchError, concat, EMPTY, forkJoin, lastValueFrom, of, toArray, concatMap } from 'rxjs';
import { environment } from '@env/environment';
import { DetailPermisosXDeptosComponent } from './detail-permisos-x-deptos.component';
import { DetailBranchesRendererComponent } from './detail-branches-renderer.component';
import { AuthService } from 'app/services/auth.service';
import { PermitionsService } from 'app/services/permitions.service';
import { UsersService } from 'app/services/users.service';
import { MasterPermissions2Service } from 'app/services/master-permissions-2.service';
import { RolesService } from 'app/services/roles.service';


@Component({
  selector: 'app-detalle-permisos-x-sucursales',
  standalone: true,
  imports: [AgGridModule, CommonModule, DetailPermisosXDeptosComponent, DetailBranchesRendererComponent],
  template: `
    <div style="padding: 10px; background-color: #e9ecef; height: 100%; display: flex; flex-direction: column; position: relative;">
      <div
        *ngIf="sessionSecurityAllowed !== true"
        style="position: absolute; inset: 0; z-index: 2; background: rgba(255,255,255,0.94); display: flex; align-items: center; justify-content: center; text-align: center; padding: 16px;">
        <span class="small">
          No tienes el permiso <strong>Security</strong> en Setup Usuarios para gestionar empresas y sucursales.
        </span>
      </div>
      <div
        [style.pointer-events]="sessionSecurityAllowed === true ? 'auto' : 'none'"
        [style.opacity]="sessionSecurityAllowed === true ? 1 : 0.55"
        style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>{{ isRootUser ? 'Empresas' : 'Sucursales' }} de: {{ userName }}</strong>
          <div class="d-flex">
            <button                      
              class="btn btn-primary ms-1"
              (click)="addPermission()"
              [disabled]="!permissionsGridApi || sessionSecurityAllowed !== true">
              <i class="bi bi-plus-lg"></i>
            </button>
            <button
              class="btn btn-success ms-1 position-relative"
              (click)="savePermissions()"
              [disabled]="!hasPermissionChanges || sessionSecurityAllowed !== true">
              <i class="bi bi-floppy"></i>
              <span
                class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
                *ngIf="hasPermissionChanges">
                <span class="visually-hidden">Hay cambios sin guardar</span>
              </span>
            </button>
            <button
              class="btn btn-danger ms-1"
              (click)="deleteSelectedPermission()"
              [disabled]="!selectedPermission || sessionSecurityAllowed !== true">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
        <div style="flex-grow: 1; display: flex; flex-direction: column; min-height: 0;">
          <ag-grid-angular
            class="ag-theme-quartz small-text-ag-grid"
            style="width: 100%; height: 100%;"
            [columnDefs]="permissionsColumnDefs"
            [rowData]="permissionsRowData"
            [gridOptions]="permissionsGridOptions"
            [components]="components"
            (gridReady)="onPermissionsGridReady($event)"
            (cellValueChanged)="onPermissionsCellValueChanged($event)"
            [stopEditingWhenCellsLoseFocus]="true">
          </ag-grid-angular>
        </div>
      </div>
    </div>
  `
})
export class DetallePermisosXSucursalesComponent implements ICellRendererAngularComp {
  private signalsService = inject(SignalsService);
  private usersxpermissionsService = inject(UsersxpermissionsService);
  private branchesService = inject(BranchsService);
  private rootService = inject(RootService);
  private usersService = inject(UsersService);
  private trackingService = inject(TrackingService);
  private permitionsService = inject(PermitionsService);
  private rolesService = inject(RolesService);
  authService = inject(AuthService);

  params: any;
  userId: number;
  userName: string;
  userEmail: string;
  isRootUser: boolean = false;
  showRoot: boolean = false;
  canSeeBranches: boolean = false;
  permiso: any[] = [];
  /**
   * Por sucursal: rol/posición principal (tooltip) y conteo de asignaciones distintas (misma lógica que el grid hijo).
   */
  private deptPosByBranchId = new Map<
    number,
    { idRole: number; idPosicion: number; detailPairCount: number }
  >();
  catalogRoles: any[] = [];
  catalogGeneralPosiciones: any[] = [];

  permissionsRowData: any[] = [];
  hasPermissionChanges: boolean = false;
  permissionsGridApi: any;
  selectedPermission: any = null;

  branches: any[] = [];
  allBranches: any[] = [];
  roots: any[] = [];
  idRoot: number;

  private tempIdCounter: number = 0;

  private masterPermissions2Service = inject(MasterPermissions2Service);

  /**
   * Ids UserSystem del permiso detallado «Departamento» bajo Setup Usuarios para `userId`
   * (mismo criterio que la pestaña Permisos maestros).
   */
  editedUserDepartmentAllowed: boolean | null = null;

  /** Switch «Security» en Setup Usuarios (Permisos maestros) para `userId`. */
  editedUserSecurityAllowed: boolean | null = null;

  /** Permiso Security del usuario logueado (sesión). */
  sessionSecurityAllowed: boolean = false;

  components = {
    detailPermisosXDeptos: DetailPermisosXDeptosComponent,
    detailBranchesRenderer: DetailBranchesRendererComponent
  };

  permissionsGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single',
    masterDetail: true,
    // El master-detail interno depende de que el usuario de sesión pueda gestionar Security/Deptos,
    // no de los switches del usuario editado.
    isRowMaster: () => this.sessionSecurityAllowed === true,
    detailCellRendererSelector: (params: any) => {
      if (this.isRootUser) {
        return { component: 'detailBranchesRenderer' };
      } else {
        return { component: 'detailPermisosXDeptos' };
      }
    },
    detailCellRendererParams: {
      getDepartmentAllowed: () => this.sessionSecurityAllowed === true,
    },
    detailRowHeight: 21000
  };

  get permissionsColumnDefs(): any[] {
    if (this.isRootUser) {
      return [
        {
          field: 'id',
          headerName: 'ID',
          hide: true,
          filter: 'agNumberColumnFilter',
          width: 80
        },
        {
          field: 'idPermission',
          headerName: 'Empresa',
          cellEditor: 'agRichSelectCellEditor',
          cellEditorParams: {
            values: Object.keys(this.roots).sort((a, b) => this.roots[a].localeCompare(this.roots[b])),
          },
          valueFormatter: (params: any) => this.roots[params.value] || '',
          valueSetter: (params: any) => {
            const selectedId = params.newValue;
            if (this.roots.hasOwnProperty(selectedId)) {
              const duplicateExists = this.permissionsRowData.some(
                (row, index) => row.idPermission === selectedId && params.node.rowIndex !== index
              );
              if (duplicateExists) {
                alerts.basicAlert('Empresa Duplicada', 'Esta empresa ya ha sido asignada al usuario.', 'error');
                return false;
              }
              params.data[params.colDef.field] = selectedId;
              return true;
            }
            return false;
          },
          valueParser: (params: any) => params.newValue,
          editable: (params) => {
            if (this.sessionSecurityAllowed !== true) {
              return false;
            }
            if (params.data.__isNew) return true;
            return true;
          },
          flex: 1
        }
      ];
    } else {
      return [
        {
          field: 'id',
          headerName: 'ID',
          hide: true,
          filter: 'agNumberColumnFilter',
          width: 80
        },
        {
          field: 'name',
          headerName: 'Sucursal',
          editable: (params) => {
            if (this.sessionSecurityAllowed !== true) {
              return false;
            }
            if (params.data.__isNew) return true;
            return true;
          },
          suppressMovable: true,
          filter: false,
          flex: 1,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: {
            values: this.branches ? this.branches.map((item: any) => item.name) : []
          },
          valueFormatter: (params: any) => {
            if (params.data?.name) {
              return params.data.name;
            }
            if (params.data?.idPermission) {
              const source = this.allBranches.length > 0 ? this.allBranches : this.branches;
              const foundBranch = source.find((item: any) => item.id === params.data.idPermission);
              return foundBranch ? foundBranch.name : `ID: ${params.data.idPermission}`;
            }
            return params.value || '';
          },
          valueSetter: (params: any) => {
            if (params.newValue && this.branches) {
              const selectedBranch = this.branches.find((b: any) => b.name === params.newValue);
              if (selectedBranch) {
                const duplicateExists = this.permissionsRowData.some(
                  (row, index) => row.idPermission === selectedBranch.id && params.node.rowIndex !== index
                );
                if (duplicateExists) {
                  alerts.basicAlert('Sucursal Duplicada', 'Esta sucursal ya ha sido asignada al usuario.', 'error');
                  return false;
                }
                params.data.idPermission = selectedBranch.id;
                params.data[params.colDef.field] = params.newValue;
                return true;
              }
            }
            return false;
          }
        },
        // ✅ Departamento ANTES de Principal
        {
          field: 'department',
          headerName: 'Departamento',
          valueFormatter: (params) => {
            const branchId = Number(params.data?.idPermission);
            const meta = Number.isFinite(branchId) && branchId > 0 ? this.deptPosByBranchId.get(branchId) : undefined;
            if (meta != null) {
              return meta.detailPairCount;
            }
            const found = this.permiso.find(
              (p: any) => Number(p?.id ?? p?.Id) === branchId
            );
            return found ? Number(found.departmentCount ?? found.DepartmentCount ?? 0) : 0;
          },
          tooltipValueGetter: (params: any) => {
            // Mostrar el nombre real (rol) como tooltip
            const branchId = Number(params.data?.idPermission);
            const ids = this.deptPosByBranchId.get(branchId);
            if (!ids?.idRole) return '';
            const found = this.catalogRoles?.find((r: any) => Number(r.id) === Number(ids.idRole));
            return found?.description ?? '';
          },
          cellStyle: (params: any) =>
            this.sessionSecurityAllowed === true
              ? { backgroundColor: '#d4edda', cursor: 'pointer' }
              : { backgroundColor: '#e2e3e5', cursor: 'not-allowed', opacity: 0.85 },
          onCellClicked: this.toggleBranches.bind(this)
        },
        {
          field: 'position',
          headerName: 'Posición',
          valueFormatter: (params) => {
            const branchId = Number(params.data?.idPermission);
            const meta = Number.isFinite(branchId) && branchId > 0 ? this.deptPosByBranchId.get(branchId) : undefined;
            if (meta != null) {
              return meta.detailPairCount;
            }
            const found = this.permiso.find(
              (p: any) => Number(p?.id ?? p?.Id) === branchId
            );
            return found ? Number(found.positionCount ?? found.PositionCount ?? 0) : 0;
          },
          tooltipValueGetter: (params: any) => {
            // Mostrar el nombre real (posición) como tooltip
            const branchId = Number(params.data?.idPermission);
            const ids = this.deptPosByBranchId.get(branchId);
            if (!ids?.idPosicion) return '';
            const found = this.catalogGeneralPosiciones?.find((p: any) => Number(p.id) === Number(ids.idPosicion));
            return found?.description ?? '';
          }
        },
        // ✅ Principal DESPUÉS de Posición
        {
          field: 'principal',
          headerName: 'Principal',
          width: 110,
          editable: false,
          valueGetter: (params: any) => {
            const sidebarBranchId = this.signalsService.getBranchSelectedBySidebar()();
            return params.data.idPermission === sidebarBranchId;
          },
          cellRenderer: (params: any) => {
            const checked = !!params.value;
            return checked
              ? '<span class="text-primary" style="pointer-events:none;user-select:none;font-size:1rem;line-height:1;" aria-label="Principal"><i class="bi bi-check-square-fill"></i></span>'
              : '<span class="text-secondary" style="pointer-events:none;user-select:none;opacity:.45;font-size:1rem;line-height:1;" aria-label="No principal"><i class="bi bi-square"></i></span>';
          },
        },
      ];
    }
  }

  getInfoByUser() {
    this.permitionsService.getInfoByUser(this.userId)
      .subscribe((data: any) => {
        this.permiso = data;
        console.log('🔵 getInfoByUser - permiso:', this.permiso);
        queueMicrotask(() => this.permissionsGridApi?.refreshCells({ force: true }));
      });
  }

  constructor() {
    effect(() => {
      if (this.signalsService.getRefresCantidadPermisos()()) {
        this.loadCatalogs();
        this.getInfoByUser();
        this.signalsService.setRefresCantidadPermisos(false);
        if (this.userId > 0 && this.idRoot > 0) {
          this.refreshEditedUserSetupFlags();
        }
      }
    });
    effect(() => {
      this.signalsService.guardRefreshTick();
      if (this.userId > 0 && this.idRoot > 0) {
        this.refreshEditedUserSetupFlags();
      }
    });
  }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.userId = params.data.id;
    this.userName = params.data.displayName || params.data.email;
    this.userEmail = params.data.email || '';
    this.getInfoByUser();
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();

    const userEmail = this.signalsService.getemailChoose();
    this.showRoot = userEmail === environment.root;
    this.sessionSecurityAllowed =
      this.showRoot || this.authService.hasUsersMenuSecurityAccess();

    const hasCompaniesPermission =
      this.authService.hasDetailedPermission('setup', 'companies') ||
      this.authService.hasDetailedPermission('users-setup', 'companies');
    const hasBranchesPermission =
      this.authService.hasDetailedPermission('setup', 'branches') ||
      this.authService.hasDetailedPermission('users-setup', 'branches');

    this.isRootUser = false;
    this.canSeeBranches = this.showRoot || hasBranchesPermission;

    this.loadCatalogs();
    this.refreshEditedUserSetupFlags();
  }

  refresh(): boolean {
    return false;
  }

  private refreshEditedUserSetupFlags(): void {
    if (!this.userId || !this.idRoot) {
      return;
    }
    this.masterPermissions2Service
      .getSetupUsuarioDepartmentAndSecurityFlags(this.userId, this.idRoot)
      .subscribe((flags) => {
        this.editedUserDepartmentAllowed = flags.department;
        this.editedUserSecurityAllowed = flags.security;
        queueMicrotask(() => {
          if (this.permissionsGridApi) {
            if (this.editedUserDepartmentAllowed !== true || this.editedUserSecurityAllowed !== true) {
              this.permissionsGridApi.forEachNode((node: any) => {
                if (node.expanded) {
                  node.setExpanded(false);
                }
              });
            }
            this.permissionsGridApi.refreshCells({ force: true });
          }
        });
      });
  }

  async loadCatalogs() {
    if (this.isRootUser) {
      this.rootService.getRoot().subscribe((data: any[]) => {
        this.roots = data.reduce((acc, dep) => {
          acc[dep.id] = dep.name;
          return acc;
        }, {});
        this.loadPermissionsData();
      });
    } else {
      // Catálogos para mostrar descripciones en Dept/Pos
      if (typeof this.idRoot === 'number' && this.idRoot > 0) {
        this.rolesService.getCatalogRoles(this.idRoot).subscribe({
          next: (data: any) => {
            this.catalogRoles = Array.isArray(data) ? data : [];
            this.permissionsGridApi?.refreshCells({ force: true });
          },
          error: () => {
            this.catalogRoles = [];
          },
        });
        this.rolesService.getGeneralPosicion(this.idRoot).subscribe({
          next: (data: any) => {
            this.catalogGeneralPosiciones = Array.isArray(data) ? data : [];
            this.permissionsGridApi?.refreshCells({ force: true });
          },
          error: () => {
            this.catalogGeneralPosiciones = [];
          },
        });
      }

      this.branchesService.getBranches(this.idRoot).subscribe(
        (data: any) => {
          this.allBranches = data;
          this.branches = data;
          this.loadPermissionsData();
        },
        (error) => {
          if (error.status == 404) this.branches = [];
          console.error('Error fetching branches:', error);
        }
      );
    }
  }

  loadPermissionsData() {
    const permissionType = this.isRootUser ? 'root' : 'branch';

    if (this.isRootUser) {
      this.usersxpermissionsService.getDataUsersxPermissions(permissionType).subscribe((data: any) => {
        this.permissionsRowData = data.filter((row: any) => row.idUser === this.userId);
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Get Registro en Usuarios por Empresa',
          'Menu Administracion Usuarios por Empresa',
          this.trackingService.getEmail()
        );
      });
    } else {
      this.branchesService.getBranchesByUserAndCompany(this.userId, this.idRoot).subscribe(
        (data: any) => {
          console.log('🔴 RAW data.project:', data.project);

          const sidebarBranchId = this.signalsService.getBranchSelectedBySidebar()();
          this.permissionsRowData = (data.project || []).map((row: any) => {
            // Deducción segura de branchId:
            // 1) preferir idPermission/idBranch
            // 2) si no viene, usar row.id SOLO si existe en el catálogo de sucursales (allBranches)
            // 3) si hay name, buscar por nombre en el catálogo.
            const direct =
              row.idPermission ??
              row.IdPermission ??
              row.idBranch ??
              row.IdBranch ??
              null;

            let inferred: number | null = null;
            const maybeRowId = Number(row.id ?? row.Id ?? row.internalId ?? row.InternalId);
            if (!direct && Number.isFinite(maybeRowId) && maybeRowId > 0) {
              const existsInCatalog = (this.allBranches || []).some(
                (b: any) => Number(b.id) === maybeRowId
              );
              if (existsInCatalog) {
                inferred = maybeRowId;
              }
            }
            if (!direct && inferred == null && row.name && (this.allBranches || []).length > 0) {
              const foundByName = this.allBranches.find(
                (b: any) =>
                  String(b.name ?? '').toUpperCase().trim() ===
                  String(row.name ?? '').toUpperCase().trim()
              );
              if (foundByName?.id != null) {
                inferred = Number(foundByName.id);
              }
            }

            const branchId = Number(direct ?? inferred ?? 0) || null;

            return {
              ...row,
              idPermission: branchId,
              principal: branchId != null && branchId === sidebarBranchId,
              // Pasar userId y userName al detail renderer de departamentos
              idUser: row.idUser ?? this.userId,
              userName: row.userName ?? this.userName,
              userEmail: row.userEmail ?? this.userEmail,
            };
          });

          console.log('🟢 permissionsRowData mapeado:', this.permissionsRowData);

          // Cargar depto/posición por sucursal para pintar columnas Departamento/Posición.
          this.loadDeptPosForBranches();

          if (this.allBranches.length > 0) {
            const assignedIds = this.permissionsRowData.map((p: any) => p.idPermission);
            this.branches = this.allBranches.filter((b: any) => !assignedIds.includes(b.id));
            if (this.permissionsGridApi) {
              this.permissionsGridApi.setGridOption('columnDefs', this.permissionsColumnDefs);
            }
          }

          this.trackingService.addLog(
            this.trackingService.getnameComp(),
            'Get Registro en Usuarios por Sucursal',
            'Menu Administracion Usuarios por Sucursal',
            this.trackingService.getEmail()
          );

          setTimeout(() => {
            if (this.permissionsGridApi && this.branches.length > 0) {
              this.permissionsGridApi.refreshCells();
            }
          }, 100);
        },
        (error) => {
          if (error.status == 404) this.permissionsRowData = [];
          console.error('Error fetching branches data:', error);
        }
      );
    }
  }

  private loadDeptPosForBranches(): void {
    const ids = (this.permissionsRowData || [])
      .map((r: any) => Number(r?.idPermission))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      this.deptPosByBranchId.clear();
      this.permissionsGridApi?.refreshCells({ force: true });
      return;
    }

    const requests: Record<string, any> = {};
    for (const bid of unique) {
      requests[String(bid)] = this.permitionsService.getRolYPosicion(this.userId, bid).pipe(
        catchError(() => of([]))
      );
    }

    forkJoin(requests).subscribe({
      next: (resp: any) => {
        this.deptPosByBranchId.clear();
        for (const [bidStr, raw] of Object.entries(resp || {})) {
          const bid = Number(bidStr);
          const arr: any[] = Array.isArray(raw)
            ? raw
            : Array.isArray((raw as any)?.data)
              ? (raw as any).data
              : Array.isArray((raw as any)?.project)
                ? (raw as any).project
                : Array.isArray((raw as any)?.permissions)
                  ? (raw as any).permissions
                  : [];
          const normalized = arr.map((p: any) => ({
            ...p,
            idRole:
              p?.idRole ?? p?.IdRole ?? p?.idDepto ?? p?.IdDepto ?? p?.idDepartament ?? p?.IdDepartament ?? null,
            idPosicion:
              p?.idPosicion ?? p?.IdPosicion ?? p?.idPosition ?? p?.IdPosition ?? p?.id_position ?? p?.Id_position ?? null,
            principal:
              p?.principal ?? p?.Principal ?? p?.isPrincipal ?? p?.IsPrincipal ?? false,
          }));
          const principal = normalized.find((p: any) => p.principal === true || p.principal === 1) ?? normalized[0];
          const idRole = Number(principal?.idRole ?? 0) || 0;
          const idPosicion = Number(principal?.idPosicion ?? 0) || 0;
          const pairKeys = new Set<string>();
          for (const p of normalized) {
            const r = Number(p?.idRole ?? 0);
            const pos = Number(p?.idPosicion ?? 0);
            if (r > 0 && pos > 0) {
              pairKeys.add(`${r}|${pos}`);
            }
          }
          const detailPairCount = pairKeys.size;
          if (idRole > 0 || idPosicion > 0 || detailPairCount > 0) {
            this.deptPosByBranchId.set(bid, { idRole, idPosicion, detailPairCount });
          }
        }
        this.permissionsGridApi?.refreshCells({ force: true });
      },
      error: () => {
        this.deptPosByBranchId.clear();
        this.permissionsGridApi?.refreshCells({ force: true });
      },
    });
  }

  onPermissionsGridReady(params: any) {
    this.permissionsGridApi = params.api;
    params.api.sizeColumnsToFit();

    params.api.addEventListener('selectionChanged', () => {
      const selectedNodes = params.api.getSelectedNodes();
      this.selectedPermission = selectedNodes.length > 0 ? selectedNodes[0].data : null;
    });
  }

  onPermissionsCellValueChanged(event: any) {
    if (!event.data.__isNew) {
      event.data.__modified = true;
    }
    this.hasPermissionChanges = true;
  }

  addPermission() {
    if (!this.permissionsGridApi) {
      console.error('Permissions grid API not ready');
      return;
    }

    const tempId = `temp_${this.tempIdCounter++}`;
    const permissionType = this.isRootUser ? 'root' : 'branch';
    const defaultPermissionId = this.isRootUser
      ? (Object.keys(this.roots)[0] || 0)
      : (this.branches.length > 0 ? this.branches[0].id : 0);

    const newPermission = {
      id: tempId,
      idUser: this.userId,
      idPermission: defaultPermissionId,
      type: permissionType,
      principal: false,
      advanced: null,
      active: 1,
      __isNew: true
    };

    this.permissionsRowData = [newPermission, ...this.permissionsRowData];
    this.permissionsGridApi.setRowData(this.permissionsRowData);
    this.hasPermissionChanges = true;

    const logMessage = this.isRootUser
      ? 'Add Registro en Usuarios por Empresa'
      : 'Add Registro en Usuarios por Sucursal';
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      logMessage,
      'Menu Administracion Usuarios',
      this.trackingService.getEmail()
    );

    setTimeout(() => {
      this.permissionsGridApi.startEditingCell({
        rowIndex: 0,
        colKey: this.isRootUser ? 'idPermission' : 'name'
      });
    }, 100);
  }

  async savePermissions() {
    const isValid = this.permissionsRowData.every((item) => item.idPermission);

    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        `Debe seleccionar ${this.isRootUser ? 'una empresa' : 'una sucursal'} antes de guardar.`,
        'error'
      );
      return;
    }

    const newRows = this.permissionsRowData.filter((row) => row.__isNew);
    const modifiedRows = this.permissionsRowData.filter((row) => row.__modified && !row.__isNew);

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      const logMessage = this.isRootUser
        ? 'Add Registro en Usuarios por Empresa'
        : 'Add Registro en Usuarios por Sucursal';
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        logMessage,
        'Menu Administracion Usuarios',
        this.trackingService.getEmail()
      );
      return this.usersxpermissionsService.addUserxPermission(cleanedData).pipe(
        concatMap(() => this.usersService.updateActulizarSecurity(cleanedData.idUser, 'SUMA'))
      );
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      const logMessage = this.isRootUser
        ? 'Update Registro en Usuarios por Empresa'
        : 'Update Registro en Usuarios por Sucursal';
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        logMessage,
        'Menu Administracion Usuarios',
        this.trackingService.getEmail()
      );
      return this.usersxpermissionsService.updateUserxPermission(row.id, cleanedData);
    });

    try {
      await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );
      alerts.basicAlert('Datos actualizados', 'Se han actualizado los datos correctamente.', 'success');
      this.hasPermissionChanges = false;
      this.signalsService.setRefresSecurity(true);
      this.loadPermissionsData();
    } catch (error) {
      console.error(error);
      alerts.basicAlert('Error', 'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.', 'error');
    }
  }

  deleteSelectedPermission() {
    if (!this.selectedPermission) return;

    const permissionId = this.selectedPermission.internalId;
    this.usersxpermissionsService.deleteUserxPermission(permissionId).pipe(
      concatMap(() => this.usersService.updateActulizarSecurity(this.userId, 'RESTA')),
      catchError((error) => {
        alerts.basicAlert('Eliminar entrada', 'Error al eliminar la entrada.', 'error');
        console.error(error);
        return EMPTY;
      })
    ).subscribe(() => {
      alerts.basicAlert('Eliminar entrada', 'Entrada eliminada satisfactoriamente.', 'success');

      const logMessage = this.isRootUser
        ? 'Delete Registro en Usuarios por Empresa'
        : 'Delete Registro en Usuarios por Sucursal';
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        logMessage,
        'Menu Administracion Usuarios',
        this.trackingService.getEmail()
      );

      this.loadPermissionsData();
      this.selectedPermission = null;
      this.signalsService.setRefresSecurity(true);
    });
  }

  toggleBranches() {
    if (this.signalsService.getemailChoose() !== environment.root) {
      if (!this.authService.hasUsersMenuDepartmentAccess()) {
        alerts.basicAlert(
          'Sin acceso',
          'No tienes permiso para gestionar departamentos en Setup Usuarios.',
          'info'
        );
        return;
      }
      if (!this.authService.hasUsersMenuSecurityAccess()) {
        alerts.basicAlert(
          'Sin acceso',
          'No tienes permiso «Security» en Setup Usuarios.',
          'info'
        );
        return;
      }
    }

    const selectedNodes = this.permissionsGridApi.getSelectedNodes();

    if (selectedNodes.length === 0) {
      alerts.basicAlert('Sucursales', 'Por favor, seleccione una empresa para ver sus sucursales.', 'warning');
      return;
    }

    const selectedNode = selectedNodes[0];
    const selectedData = selectedNode.data;
    const isCurrentlyExpanded = selectedNode.expanded;

    selectedData.idUser = this.userId;
    selectedData.userName = this.userName;
    selectedData.companyName = this.roots[selectedData.idPermission] || '';

    if (isCurrentlyExpanded) {
      selectedNode.setExpanded(false);
      this.permissionsGridApi.setFilterModel(null);
      this.permissionsGridApi.onFilterChanged();
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Ocultar Sucursales',
        'Menu Administracion Usuarios',
        this.trackingService.getEmail()
      );
    } else {
      this.permissionsGridApi.forEachNode((node: any) => {
        if (node.expanded) node.setExpanded(false);
      });

      this.permissionsGridApi.setFilterModel(null);
      const filterModel = {
        id: { filterType: 'number', type: 'equals', filter: selectedData.id }
      };
      this.permissionsGridApi.setFilterModel(filterModel);
      this.permissionsGridApi.onFilterChanged();

      setTimeout(() => {
        selectedNode.setExpanded(true);
      }, 50);

      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Mostrar Sucursales',
        'Menu Administracion Usuarios',
        this.trackingService.getEmail()
      );
    }
  }

  toggleWarehouses() {
    const selectedNodes = this.permissionsGridApi.getSelectedNodes();

    if (selectedNodes.length === 0) {
      alerts.basicAlert('Almacenes', 'Por favor, seleccione una sucursal para ver sus almacenes.', 'warning');
      return;
    }

    const selectedNode = selectedNodes[0];
    const selectedData = selectedNode.data;
    const isCurrentlyExpanded = selectedNode.expanded;

    selectedData.idUser = this.userId;
    selectedData.userName = this.userName;

    if (isCurrentlyExpanded) {
      selectedNode.setExpanded(false);
      this.permissionsGridApi.setFilterModel(null);
      this.permissionsGridApi.onFilterChanged();
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Ocultar Almacenes',
        'Menu Administracion Usuarios',
        this.trackingService.getEmail()
      );
    } else {
      this.permissionsGridApi.forEachNode((node: any) => {
        if (node.expanded) node.setExpanded(false);
      });

      this.permissionsGridApi.setFilterModel(null);
      const filterModel = {
        id: { filterType: 'number', type: 'equals', filter: selectedData.id }
      };
      this.permissionsGridApi.setFilterModel(filterModel);
      this.permissionsGridApi.onFilterChanged();

      setTimeout(() => {
        selectedNode.setExpanded(true);
      }, 50);

      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Mostrar Almacenes',
        'Menu Administracion Usuarios',
        this.trackingService.getEmail()
      );
    }
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.name;
    delete cleanedData.userName;
    delete cleanedData.principal;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }
}
