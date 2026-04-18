import { Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { SignalsService } from 'app/services/signals.service';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { WarehousesService } from 'app/services/warehouses.service';
import { TrackingService } from 'app/services/tracking.service';
import { PermitionsService } from 'app/services/permitions.service';
import { EmployeesService } from 'app/services/employees.service';
import { RolesService } from 'app/services/roles.service';
import { MasterPermissions2Service } from 'app/services/master-permissions-2.service';
import { alerts } from 'app/helpers/alerts';
import { AuthService } from 'app/services/auth.service';
import { catchError, concat, EMPTY, forkJoin, lastValueFrom, map, of, toArray } from 'rxjs';
import { DetailPermissionsUserComponent } from './detail-permissions-user/detail-permissions-user.component';
import { PermissionsViewByUserComponent } from './detail-permissions-user/permissions-view.component';
import { ModalService } from 'app/services/permissions-modal.service';
import { environment } from '@env/environment';

@Component({
  selector: 'app-detail-permisos-x-deptos',
  standalone: true,
  imports: [AgGridModule, CommonModule, DetailPermissionsUserComponent, PermissionsViewByUserComponent],
  template: `
    <div style="padding: 10px; background-color: #f8f9fa; height: 100%; display: flex; flex-direction: column; box-sizing: border-box;">
      <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
        <strong>Departamentos de putos: {{ userName }} ({{ branchName }})</strong>
        <div class="d-flex">
          <button
            class="btn btn-primary ms-1"
            (click)="addWarehouse()"
            [disabled]="!warehousesGridApi">
            <i class="bi bi-plus-lg"></i>
          </button>
          <button
            class="btn btn-success ms-1 position-relative"
            (click)="saveWarehouses()"
            [disabled]="!hasWarehouseChanges">
            <i class="bi bi-floppy"></i>
            <span
              class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
              *ngIf="hasWarehouseChanges">
              <span class="visually-hidden">Hay cambios sin guardar</span>
            </span>
          </button>
          <button
            class="btn btn-warning ms-1"
            (click)="revertWarehouses()"
            [disabled]="!hasWarehouseChanges">
            <i class="bi bi-arrow-clockwise"></i>
          </button>
          <button
            class="btn btn-danger ms-1"
            (click)="deleteSelectedWarehouse()"
            [disabled]="!selectedWarehouse">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>

      <div style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; height: 100%;"
          [columnDefs]="warehousesColumnDefs"
          [rowData]="warehousesRowData"
          [gridOptions]="warehousesGridOptions"
          [components]="components"
          (gridReady)="onWarehousesGridReady($event)"
          (cellValueChanged)="onWarehousesCellValueChanged($event)"
          (cellClicked)="onCellClicked($event)"
          [stopEditingWhenCellsLoseFocus]="false">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailPermisosXDeptosComponent implements ICellRendererAngularComp {
  private signalsService = inject(SignalsService);
  private usersxpermissionsService = inject(UsersxpermissionsService);
  private warehousesService = inject(WarehousesService);
  private trackingService = inject(TrackingService);
  private rolesService = inject(RolesService);
  private permitionsService = inject(PermitionsService);
  private systemPermissionsService = inject(MasterPermissions2Service);
  private employeeService = inject(EmployeesService);
  private modalService = inject(ModalService);
  authService = inject(AuthService);

  components = {
    DetailPermissionsUserComponent: DetailPermissionsUserComponent,
    PermissionsViewByUserComponent: PermissionsViewByUserComponent,
  };

  params: any;
  userId: number;
  userName: string;
  userEmail: string;
  branchId: number;
  isBranchPrincipal: boolean = false;
  branchName: string;
  idCompany: number;

  warehousesRowData: any[] = [];
  catalogRoles: any[] = [];
  catalogPosiciones: any[] = [];
  rolesDefinidos: any[] = [];
  catalogGeneralPosiciones: any[] = [];
  hasWarehouseChanges: boolean = false;
  private warehousesRowDataOriginal: any[] = [];
  warehousesGridApi: any;
  idPosicionSelect: number;
  selectedWarehouse: any = null;
  private pendingPrincipal: { idRole: number; idPosicion: number } | null = null;

  warehouses: any[] = [];
  warehousesMap: { [key: string]: string } = {};

  private tempIdCounter: number = 0;

  /** Posiciones por id de departamento/rol; evita que una fila pise el combo de otra. */
  private positionsByRoleIdCache = new Map<number, any[]>();

  private normalizeRoleId(id: unknown): number | null {
    if (id == null || id === '') return null;
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }

  /** id numérico de ítems de catálogo (API camelCase o PascalCase). */
  private catalogEntryId(entry: any): number | null {
    if (!entry) return null;
    const raw = entry.id ?? entry.Id;
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  private catalogEntryDescription(entry: any): string {
    return entry?.description ?? entry?.Description ?? '';
  }

  private getPosicionesListForRow(row: any): any[] {
    const rid = this.normalizeRoleId(row?.idRole);
    if (row?.posicionesDisponibles?.length) {
      return row.posicionesDisponibles;
    }
    if (rid != null && this.positionsByRoleIdCache.has(rid)) {
      return this.positionsByRoleIdCache.get(rid) ?? [];
    }
    return this.catalogPosiciones ?? [];
  }

  /** Rellena `catalogPosiciones` desde fila/caché o pide al API sin bloquear el clic (evita lentitud al abrir el editor). */
  private primePosicionesForRow(row: any): void {
    const roleId = row?.idRole;
    if (roleId == null || roleId === '') {
      this.catalogPosiciones = [];
      return;
    }
    const rid = this.normalizeRoleId(roleId);
    if (row?.posicionesDisponibles?.length) {
      this.catalogPosiciones = row.posicionesDisponibles;
      return;
    }
    if (rid != null && this.positionsByRoleIdCache.has(rid)) {
      this.catalogPosiciones = this.positionsByRoleIdCache.get(rid) ?? [];
      return;
    }
    void this.getPoscionesbyRole(roleId).then((list) => {
      this.catalogPosiciones = list;
      if (rid != null) {
        this.positionsByRoleIdCache.set(rid, list);
      }
      if (row) {
        row.posicionesDisponibles = list;
      }
    });
  }

  /**
   * Si el depto/posición del empleado (maestro) no viene en PermissionBydescription pero el usuario
   * añade otro departamento y guarda, el GET solo devuelve lo nuevo. Insertamos la fila "desde empleado"
   * cuando falte esa pareja para que no desaparezca la asignación principal.
   */
  private mergeEmpleadoPrincipalRowIfMissing(): void {
    const ep = this.empleadoPrincipal;
    if (ep?.idDepto == null || ep?.idPosition == null) return;
    const d = Number(ep.idDepto);
    const p = Number(ep.idPosition);
    if (!Number.isFinite(d) || !Number.isFinite(p)) return;
    const already = this.warehousesRowData.some(
      (r: any) => Number(r.idRole) === d && Number(r.idPosicion) === p
    );
    if (already) return;
    this.warehousesRowData = [
      {
        id: 'from_employee',
        idUser: this.userId,
        idBranch: this.branchId,
        idRole: ep.idDepto,
        idPosicion: ep.idPosition,
        principal: true,
        __readOnly: true,
      },
      ...this.warehousesRowData,
    ];
  }

  empleadoPrincipal: any = null;

  warehousesGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single',
    /** Select en popup: con true el grid cierra el editor al hacer clic en la lista (típico dentro de master-detail). */
    popupParent: typeof document !== 'undefined' ? document.body : undefined,
    onRowClicked: (event) => {
      event.node.setSelected(true);
      this.selectedWarehouse = event.data;
    },
    getRowClass: (params: any) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
  };

  private _warehousesColumnDefs: any[] = [];

  get warehousesColumnDefs(): any[] {
    if (this._warehousesColumnDefs.length > 0) {
      return this._warehousesColumnDefs;
    }

    this._warehousesColumnDefs = [
      {
        field: 'id',
        headerName: 'ID',
        filter: 'agNumberColumnFilter',
        hide: true,
      },
      // ✅ Principal ANTES de Departamento — clickeable, comportamiento radio (solo uno activo)
      {
        field: 'principal',
        headerName: 'Principal',
        width: 110,
        editable: false,
        valueGetter: (params: any) => {
          if (params.data.principal === true || params.data.principal === 1) return true;
          // Fallback de empleado solo cuando ninguna fila tiene principal explícito en DB/memoria
          const hasExplicit = (this.warehousesRowData ?? []).some(
            (r: any) => r.principal === true || r.principal === 1
          );
          if (hasExplicit) return false;
          if (!this.empleadoPrincipal) return false;
          return params.data.idRole == this.empleadoPrincipal.idDepto &&
                 params.data.idPosicion == this.empleadoPrincipal.idPosition;
        },
        cellRenderer: (params: any) => {
          const checked = !!params.value;
          const isLocked = this.isBranchPrincipal || !!params.data?.__isNew;

          // Sucursal principal: mostrar ícono de solo lectura (azul si marcado, gris si no)
          if (isLocked) {
            const span = document.createElement('span');
            span.style.display = 'inline-flex';
            span.style.alignItems = 'center';
            span.style.justifyContent = 'center';
            span.style.fontSize = '1rem';
            span.style.lineHeight = '1';
            span.style.pointerEvents = 'none';
            span.style.userSelect = 'none';
            span.title = this.isBranchPrincipal ? 'No editable en sucursal principal' : '';
            span.innerHTML = checked
              ? '<i class="bi bi-check-square-fill" style="color:#0d6efd;"></i>'
              : '<i class="bi bi-square" style="color:#6c757d;opacity:.45;"></i>';
            return span;
          }

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = checked;
          checkbox.title = checked ? 'Principal actual' : 'Marcar como principal';
          checkbox.style.cursor = 'pointer';
          checkbox.disabled = false;

          checkbox.addEventListener('change', () => {
            checkbox.checked = checked;
            if (params.data?.__isNew) return;
            if (checked) return; // Ya es principal

            const { idRole, idPosicion } = params.data;
            if (!idRole || !idPosicion) return;

            // Actualizar en memoria
            this.warehousesRowData = this.warehousesRowData.map((row: any) => ({
              ...row,
              principal: row.idRole === idRole && row.idPosicion === idPosicion,
            }));
            this.pendingPrincipal = { idRole, idPosicion };
            this.hasWarehouseChanges = true;

            // Actualizar cada nodo directamente para forzar re-render visual confiable
            if (this.warehousesGridApi) {
              this.warehousesGridApi.forEachNode((node: any) => {
                if (node.data) {
                  const isSelected =
                    node.data.idRole === idRole && node.data.idPosicion === idPosicion;
                  node.setData({ ...node.data, principal: isSelected });
                }
              });
            }
          });

          return checkbox;
        },
      },
      {
        field: 'idRole',
        headerName: 'Departamento',
        editable: () => true,
        suppressMovable: true,
        filter: false,
        flex: 1,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: (params) => {
          const usedRoles = this.warehousesRowData
            .filter((row) => row !== params.data && this.normalizeRoleId(row.idRole) != null)
            .map((row) => this.normalizeRoleId(row.idRole) as number);
          const filteredRoles = Array.isArray(this.catalogRoles)
            ? this.catalogRoles.filter((item) => {
                const cid = this.catalogEntryId(item);
                return cid != null && !usedRoles.some((u) => u === cid);
              })
            : [];
          filteredRoles.sort((a, b) =>
            this.catalogEntryDescription(a).localeCompare(this.catalogEntryDescription(b), 'es', {
              sensitivity: 'base',
              numeric: true,
            })
          );
          const values = filteredRoles
            .map((item) => this.catalogEntryId(item))
            .filter((id): id is number => id != null);
          return {
            values,
            formatValue: (value: number | null | undefined) => {
              if (value == null) return '';
              const id = Number(value);
              if (!Number.isFinite(id)) return '';
              const found = this.catalogRoles?.find((item) => this.catalogEntryId(item) === id);
              const label = this.catalogEntryDescription(found);
              if (label) return label;
              return `ID: ${id}`;
            },
            valueListMaxHeight: 320,
            /** Solo selección desde la lista (sin texto libre). */
            allowTyping: false,
            filterList: false,
          };
        },
        valueFormatter: (params) => {
          const raw = params.value;
          if (raw == null || raw === '') return '';
          const id = Number(raw);
          const found = this.catalogRoles?.find((item) => this.catalogEntryId(item) === id);
          const fromCat = this.catalogEntryDescription(found);
          if (fromCat) return fromCat;
          return (
            params.data?.departmentName ??
            params.data?.roleName ??
            (Number.isFinite(id) ? `ID: ${id}` : String(raw))
          );
        },
        valueSetter: (params) => {
          const newDeptId = params.newValue;
          if (params.data.idRole === newDeptId) return false;

          const duplicateExists = this.warehousesRowData.some(
            (row) =>
              row !== params.data &&
              this.normalizeRoleId(row.idRole) === this.normalizeRoleId(newDeptId)
          );
          if (duplicateExists) {
            alerts.basicAlert('Departamento Duplicado', 'Este departamento ya ha sido asignado.', 'error');
            return false;
          }

          if (!params.data.__originalIdRole && params.data.idRole) {
            params.data.__originalIdRole = params.data.idRole;
          }
          if (!params.data.__originalIdPosicion && params.data.idPosicion) {
            params.data.__originalIdPosicion = params.data.idPosicion;
          }

          params.data.idRole = newDeptId;

          this.getPoscionesbyRole(newDeptId).then((posiciones) => {
            const rid = this.normalizeRoleId(newDeptId);
            if (rid != null) {
              this.positionsByRoleIdCache.set(rid, posiciones);
            }
            this.catalogPosiciones = posiciones;
            params.data.posicionesDisponibles = posiciones;
            params.data.idPosicion = null;
            if (this.warehousesGridApi) {
              this.warehousesGridApi.refreshCells({ rowNodes: [params.node], force: true });
            }
          });

          return true;
        },
      },
      {
        field: 'idPosicion',
        headerName: 'Posición',
        editable: () => true,
        suppressMovable: true,
        filter: 'agNumberColumnFilter',
        flex: 1,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: (params) => {
          const currentRole = params.data.idRole;
          const source = this.getPosicionesListForRow(params.data);
          const assignedPositions = this.warehousesRowData
            .filter((row) => row.idRole == currentRole && row !== params.data)
            .map((row) => row.idPosicion);
          const filteredPosiciones = (Array.isArray(source) ? source : []).filter((item) => {
            const pid = this.catalogEntryId(item);
            return (
              pid != null &&
              !assignedPositions.some((ap) => Number(ap) === pid)
            );
          });
          filteredPosiciones.sort((a, b) =>
            this.catalogEntryDescription(a).localeCompare(this.catalogEntryDescription(b), 'es', {
              sensitivity: 'base',
              numeric: true,
            })
          );
          const values = filteredPosiciones
            .map((item) => this.catalogEntryId(item))
            .filter((id): id is number => id != null);
          const rowData = params.data;
          return {
            values,
            formatValue: (value: number | null | undefined) => {
              if (value == null) return '';
              const id = Number(value);
              if (!Number.isFinite(id)) return '';
              const rowList = this.getPosicionesListForRow(rowData);
              const foundInRow =
                Array.isArray(rowList) && rowList.find((item) => this.catalogEntryId(item) === id);
              const found =
                foundInRow ??
                this.catalogGeneralPosiciones?.find((item) => this.catalogEntryId(item) === id);
              const label = this.catalogEntryDescription(found);
              if (label) return label;
              return `ID: ${id}`;
            },
            valueListMaxHeight: 320,
            allowTyping: false,
            filterList: false,
          };
        },
        valueFormatter: (params) => {
          const raw = params.value;
          if (raw == null || raw === '') return '';
          const id = Number(raw);
          const rowList = this.getPosicionesListForRow(params.data);
          const foundInRow =
            Array.isArray(rowList) && rowList.find((item) => this.catalogEntryId(item) === id);
          const found =
            foundInRow ??
            this.catalogGeneralPosiciones?.find((item) => this.catalogEntryId(item) === id);
          const fromCat = this.catalogEntryDescription(found);
          if (fromCat) return fromCat;
          return (
            params.data?.positionName ??
            params.data?.posicionName ??
            (Number.isFinite(id) ? `ID: ${id}` : String(raw))
          );
        },
        valueSetter: (params) => {
          const newPosicionId = params.newValue;
          const currentRoleId = params.data.idRole;

          if (params.data.idPosicion === newPosicionId) return false;

          const duplicateExists = this.warehousesRowData.some(
            (row, index) => row.idRole === currentRoleId && row.idPosicion === newPosicionId && params.node.rowIndex !== index
          );
          if (duplicateExists) {
            alerts.basicAlert('Permiso Duplicado', 'Esta combinación de Departamento y Posición ya ha sido asignada.', 'error');
            return false;
          }

          if (!params.data.__originalIdPosicion && params.data.idPosicion) {
            params.data.__originalIdPosicion = params.data.idPosicion;
          }

          params.data.idPosicion = newPosicionId;

          this.getCRUD(newPosicionId).then((posiciones) => {
            this.rolesDefinidos = posiciones;
          });

          return true;
        },
      },
      {
        field: 'Permisos',
        headerName: 'Permisos',
        cellStyle: (p: any) => ({
          backgroundColor: (!p.data?.__isNew && this.canOpenVerPermisosModal()) ? '#d4edda' : '#e9ecef',
        }),
        cellRenderer: (p: any) => {
          if (p.data?.__isNew) {
            return `<span class="text-muted" style="cursor: not-allowed;" title="Guarda el registro antes de ver permisos">—</span>`;
          }
          if (!this.canOpenVerPermisosModal()) {
            return `<span class="text-muted" style="cursor: not-allowed;" title="Sin permiso (Setup Usuarios › Permisos)">—</span>`;
          }
          return `<span style="cursor: pointer; text-decoration: underline; color: #0d6efd;">Ver Permisos</span>`;
        },
      },
    ];

    return this._warehousesColumnDefs;
  }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.userId = params.data.idUser;
    this.userName = params.data.userName || '';
    this.userEmail = params.data.userEmail || '';
    this.branchId = params.data.idPermission;
    this.branchName = params.data.name || '';
    this.isBranchPrincipal = !!params.data.principal;
    this.idCompany = Number(params.data.idCompany ?? this.signalsService.getRootSelectedBySidebar()());
    this.loadCatalogs();
    this.getGeneralPosicion();
    this.getRoles();
    this.obternerDatos();
  }

  refresh(): boolean {
    return false;
  }

  getRoles() {
    this.rolesService.getCatalogRoles(this.idCompany).subscribe(
      (data: any) => {
        this.catalogRoles = Array.isArray(data) ? data : [];
        if (this.warehousesGridApi) {
          this.warehousesGridApi.refreshCells({ force: true });
        }
      },
      (error) => {
        if (error.status == 404) this.catalogRoles = [];
        console.error('Error fetching data:', error);
      }
    );
  }

  getGeneralPosicion() {
    this.rolesService.getGeneralPosicion(this.idCompany).subscribe(
      (data: any) => {
        this.catalogGeneralPosiciones = Array.isArray(data) ? data : [];
        if (this.warehousesGridApi) {
          this.warehousesGridApi.refreshCells({ force: true });
        }
      },
      (error) => {
        if (error.status == 404) this.catalogGeneralPosiciones = [];
        console.error('Error fetching data:', error);
      }
    );
  }

  getPoscionesbyRole(roles: number): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.rolesService.getCatalogPosiciones(this.idCompany, roles).subscribe({
        next: (data: any) => resolve(data || []),
        error: (error) => {
          if (error.status === 404) resolve([]);
          else { console.error('Error fetching posiciones:', error); reject(error); }
        }
      });
    });
  }

  getCRUD(idPosicion: number): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.rolesService.getCatalogCRUD(idPosicion).subscribe({
        next: (data: any) => {resolve(data || []); },
        error: (error) => {
          if (error.status === 404) resolve([]);
          else { console.error('Error fetching posiciones:', error); reject(error); }
        }
      });
    });
  }

  obternerDatos() {
    forkJoin({
      permisos: this.permitionsService.getRolYPosicion(this.userId, this.branchId),
      empleados: this.employeeService.getEmployees(this.branchId)
    }).subscribe({
      next: ({ permisos, empleados }: any) => {
        const permisosArr =
          Array.isArray(permisos)
            ? permisos
            : Array.isArray(permisos?.data)
              ? permisos.data
              : Array.isArray(permisos?.project)
                ? permisos.project
                : Array.isArray(permisos?.permissions)
                  ? permisos.permissions
                  : [];
        const empleadosArr = Array.isArray(empleados) ? empleados : [];

        // Normalizar nombres de campos que varían por backend (camelCase/PascalCase)
        // para que el grid SIEMPRE tenga idRole/idPosicion y pueda formatear con catálogos.
        this.warehousesRowDataOriginal = [];
        this.warehousesRowData = (permisosArr || []).map((r: any) => {
          const idRole =
            r?.idRole ??
            r?.IdRole ??
            r?.idDepto ??
            r?.IdDepto ??
            r?.idDepartament ??
            r?.IdDepartament ??
            null;
          const idPosicion =
            r?.idPosicion ??
            r?.IdPosicion ??
            r?.idPosition ??
            r?.IdPosition ??
            r?.id_position ??
            r?.Id_position ??
            null;
          const principal =
            r?.principal ??
            r?.Principal ??
            r?.isPrincipal ??
            r?.IsPrincipal ??
            false;

          return {
            ...r,
            idRole,
            idPosicion,
            principal,
          };
        });

        this.warehousesRowDataOriginal = JSON.parse(JSON.stringify(this.warehousesRowData));

        // 1) Si el backend envía una fila con principal === true/1, usarla para marcar el checkbox
        const rowPrincipal = this.warehousesRowData.find(
          (r: any) => r?.principal === true || r?.principal === 1
        );
        if (rowPrincipal && rowPrincipal.idRole != null && rowPrincipal.idPosicion != null) {
          this.empleadoPrincipal = {
            idDepto: rowPrincipal.idRole,
            idPosition: rowPrincipal.idPosicion,
          };
        } else {
          const normalize = (s: any) =>
            String(s ?? '')
              .toUpperCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/\s+/g, ' ')
              .trim();

          // 2) Fallback robusto: buscar empleado por email primero; si no, por nombre normalizado.
          const userEmailNorm = normalize(this.userEmail);
          const userNameNorm = normalize(this.userName);

          const emp =
            (userEmailNorm
              ? empleadosArr.find((e: any) => normalize(e.email) === userEmailNorm)
              : null) ??
            (userNameNorm
              ? empleadosArr.find((e: any) => {
                  const n = normalize(e.name ?? e.displayName);
                  return n === userNameNorm || (n && userNameNorm && n.includes(userNameNorm));
                })
              : null);

          const empDepto =
            emp?.idRole ??
            emp?.IdRole ??
            emp?.idDepto ??
            emp?.IdDepto ??
            emp?.idDepartament ??
            emp?.IdDepartament ??
            emp?.id_departament ??
            emp?.Id_departament ??
            null;
          const empPos =
            emp?.idPosition ??
            emp?.IdPosition ??
            emp?.idPosicion ??
            emp?.IdPosicion ??
            emp?.id_position ??
            emp?.Id_position ??
            null;

          if (emp && empDepto != null && empPos != null) {
            this.empleadoPrincipal = {
              idDepto: empDepto,
              idPosition: empPos,
            };
          } else {
            this.empleadoPrincipal = null;
          }
        }

        this.mergeEmpleadoPrincipalRowIfMissing();

        const roleIds = [
          ...new Set(
            this.warehousesRowData
              .map((r: any) => this.normalizeRoleId(r.idRole))
              .filter((id): id is number => id != null)
          ),
        ];

        if (roleIds.length === 0) {
          setTimeout(() => {
            if (this.warehousesGridApi) this.warehousesGridApi.refreshCells({ force: true });
          }, 100);
        } else {
          forkJoin(
            roleIds.map((rid) =>
              this.rolesService.getCatalogPosiciones(this.idCompany, rid).pipe(
                catchError(() => of([])),
                map((data: any) => ({ rid, list: Array.isArray(data) ? data : [] }))
              )
            )
          ).subscribe({
            next: (pairs) => {
              for (const { rid, list } of pairs) {
                this.positionsByRoleIdCache.set(rid, list);
              }
              for (const row of this.warehousesRowData) {
                const rid = this.normalizeRoleId(row.idRole);
                if (rid != null) {
                  row.posicionesDisponibles = this.positionsByRoleIdCache.get(rid) ?? [];
                }
              }
              setTimeout(() => {
                if (this.warehousesGridApi) this.warehousesGridApi.refreshCells({ force: true });
              }, 0);
            },
            error: (err) => console.error('Error cargando posiciones por departamento:', err),
          });
        }
      },
      error: (err) => console.error('Error cargando datos de departamentos:', err)
    });
  }

  async loadCatalogs() {}

  loadWarehousesData() {}

  onWarehousesGridReady(params: any) {
    this.warehousesGridApi = params.api;
    params.api.sizeColumnsToFit();
    params.api.addEventListener('selectionChanged', () => {
      const selectedNodes = params.api.getSelectedNodes();
      this.selectedWarehouse = selectedNodes.length > 0 ? selectedNodes[0].data : null;
    });
  }

  onWarehousesCellValueChanged(event: any) {
    // No marcar como modificado si solo cambió Principal (es solo visual; evitar DELETE+POST innecesario)
    const colId = event.column?.getColId();
    if (colId === 'principal') return;

    if (!event.data.__isNew) {
      event.data.__modified = true;
    }
    this.hasWarehouseChanges = true;
  }

  revertWarehouses() {
    this.warehousesRowData = JSON.parse(JSON.stringify(this.warehousesRowDataOriginal));
    this.warehousesGridApi.setGridOption('rowData', this.warehousesRowData);
    this.hasWarehouseChanges = false;
    this.selectedWarehouse = null;
    this.pendingPrincipal = null;
  }

  addWarehouse() {
    if (!this.warehousesGridApi) {
      console.error('Warehouses grid API not ready');
      return;
    }

    const tempId = `temp_${this.tempIdCounter++}`;
    const newWarehouse = {
      id: tempId,
      idUser: this.userId,
      idBranch: this.branchId,
      principal: false,
      __isNew: true
    };

    this.warehousesRowData = [newWarehouse, ...this.warehousesRowData];
    this.warehousesGridApi.setGridOption('rowData', this.warehousesRowData);
    setTimeout(() => {
      this.warehousesGridApi?.refreshCells({ force: true, columns: ['Permisos'] });
    }, 0);
    this.hasWarehouseChanges = true;

    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Add Registro de Permisos por Departamento',
      'Menu Administracion Usuarios',
      this.trackingService.getEmail()
    );

    setTimeout(() => {
      this.warehousesGridApi.startEditingCell({ rowIndex: 0, colKey: 'idRole' });
    }, 100);
  }

  async saveWarehouses() {
    const newRows = this.warehousesRowData.filter((row) => row.__isNew);
    const modifiedRows = this.warehousesRowData.filter((row) => row.__modified && !row.__isNew);
    const rowsToValidate = [...newRows, ...modifiedRows];
    const invalidRow = rowsToValidate.find((item) => !item.idRole || !item.idPosicion);

    if (invalidRow) {
      alerts.basicAlert('Añadir entrada', 'Debe seleccionar un Departamento y una Posición antes de guardar.', 'error');
      return;
    }

    // Auto-guardar la fila virtual del empleado (from_employee) si existe y aún no está en DB
    const fromEmployeeRow = this.warehousesRowData.find((r: any) => r.id === 'from_employee');
    if (fromEmployeeRow) {
      const cleanedFromEmployee = this.cleanDataForServer(fromEmployeeRow);
      delete cleanedFromEmployee.posicionesDisponibles;
      await lastValueFrom(
        this.permitionsService.addPermitionsDetailBydescription(cleanedFromEmployee)
          .pipe(catchError(() => of(null)))
      );
    }

    // Para filas nuevas: primero guardar la fila dept/posición, luego obtener plantilla y guardar CRUD permissions
    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      delete cleanedData.posicionesDisponibles;
      const { idRole, idPosicion } = row;

      return this.permitionsService.addPermitionsDetailBydescription(cleanedData).pipe(
        catchError(() => of(null)),
        map(() => ({ idRole, idPosicion }))
      );
    });

    const updateObservables = modifiedRows.flatMap((row) => {
      const originalRole = row.__originalIdRole ?? row.idRole;
      const originalPosicion = row.__originalIdPosicion ?? row.idPosicion;

      // Si no cambió realmente Departamento ni Posición, no hacer DELETE+POST (evita 500)
      if (originalRole === row.idRole && originalPosicion === row.idPosicion) {
        return [];
      }

      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Update Registro de Permisos por Departamento',
        'Menu Administracion Usuarios',
        this.trackingService.getEmail()
      );

      const deleteOld$ = this.permitionsService.deleteRoles(this.userId, this.branchId, originalRole, originalPosicion).pipe(
        catchError(() => EMPTY)
      );
      const cleanedData = this.cleanDataForServer(row);
      delete cleanedData.posicionesDisponibles;
      // No enviar id para que el backend cree un registro nuevo (evita duplicate key)
      delete cleanedData.id;
      const createNew$ = this.permitionsService.addPermitionsDetailBydescription(cleanedData);

      return [deleteOld$, createNew$];
    });

    try {
      // 1. Guardar filas dept/posición (nuevas y modificadas)
      const addResults: { idRole: number; idPosicion: number }[] = newRows.length > 0
        ? await lastValueFrom(forkJoin(addObservables))
        : [];
      if (updateObservables.length > 0) {
        await lastValueFrom(concat(...updateObservables).pipe(toArray()));
      }

      // 2. Para cada fila nueva guardada, aplicar la plantilla de permisos del rol+posición
      if (addResults.length > 0) {
        const templateSaves$ = addResults
          .filter((r) => r?.idRole && r?.idPosicion)
          .map(({ idRole, idPosicion }) =>
            this.rolesService.getPermissionsByRoles(this.idCompany, idRole, idPosicion).pipe(
              catchError(() => of([])),
              map((templateRows: any[]) => {
                if (!Array.isArray(templateRows) || templateRows.length === 0) return [];
                const seen = new Set<string>();
                return templateRows
                  .filter((r: any) => {
                    const key = `${r?.idDetailedPermission ?? r?.IdDetailedPermission}-${r?.idShowPermition ?? r?.IdShowPermition}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  })
                  .map((r: any) => ({
                    idUser: this.userId,
                    idBranch: this.branchId,
                    idMasterPermission: r?.idMasterPermission ?? r?.IdMasterPermission,
                    masterRead: r?.masterRead ?? r?.MasterRead ?? false,
                    idDetailedPermission: r?.idDetailedPermission ?? r?.IdDetailedPermission,
                    detailedRead: r?.detailedRead ?? r?.DetailedRead ?? false,
                    subdetailedPermissionName: r?.subdetailedPermissionName ?? r?.SubdetailedPermissionName ?? '',
                    idShowPermition: r?.idShowPermition ?? r?.IdShowPermition,
                    idRole,
                    idPosicion,
                    canCreate: r?.canCreate ?? r?.CanCreate ?? false,
                    canRead: r?.canRead ?? r?.CanRead ?? false,
                    canUpdate: r?.canUpdate ?? r?.CanUpdate ?? false,
                    canDelete: r?.canDelete ?? r?.CanDelete ?? false,
                    active: true,
                  }));
              }),
              map((payloads) => payloads.map((p) => this.permitionsService.addPermitions(p))),
              map((obs) => obs.length > 0 ? forkJoin(obs).pipe(catchError(() => of([]))) : of([]))
            )
          );

        for (const save$ of templateSaves$) {
          const inner$ = await lastValueFrom(save$);
          await lastValueFrom(inner$);
        }

        // 3. Merge UserSystem permissions: actuales del usuario + ids ON del template
        for (const { idRole, idPosicion } of addResults.filter((r) => r?.idRole && r?.idPosicion)) {
          const templateRows: any[] = await lastValueFrom(
            this.rolesService.getPermissionsByRoles(this.idCompany, idRole, idPosicion).pipe(catchError(() => of([])))
          );
          if (!Array.isArray(templateRows) || templateRows.length === 0) continue;

          // Extraer ids ON del template
          const templateIds = new Set<number>();
          for (const r of templateRows) {
            const id = Number(r?.idDetailedPermission ?? r?.IdDetailedPermission);
            if (!Number.isFinite(id)) continue;
            const anyOn = !!(r?.detailedRead ?? r?.DetailedRead) || !!(r?.masterRead ?? r?.MasterRead)
              || !!(r?.canRead ?? r?.CanRead) || !!(r?.canCreate ?? r?.CanCreate)
              || !!(r?.canUpdate ?? r?.CanUpdate) || !!(r?.canDelete ?? r?.CanDelete);
            if (anyOn) templateIds.add(id);
          }
          if (templateIds.size === 0) continue;

          // Obtener permisos actuales del usuario y hacer merge
          const currentPerms: any[] = await lastValueFrom(
            this.systemPermissionsService.getUserPermissions(this.userId).pipe(catchError(() => of([])))
          );
          const currentIds = new Set<number>(
            (Array.isArray(currentPerms) ? currentPerms : [])
              .map((p: any) => Number(p?.permissionId ?? p?.PermissionId ?? p?.id))
              .filter(Number.isFinite)
          );
          for (const id of templateIds) currentIds.add(id);

          await lastValueFrom(
            this.systemPermissionsService.updateUserPermissions(this.userId, [...currentIds]).pipe(catchError(() => of(null)))
          );
        }
      }

      // Guardar cambio de principal si hubo
      if (this.pendingPrincipal) {
        const { idRole, idPosicion } = this.pendingPrincipal;
        await lastValueFrom(
          this.permitionsService.setPrincipal(this.userId, this.branchId, idRole, idPosicion).pipe(catchError(() => of(null)))
        );
        // Actualizar el registro de empleado en la sucursal (si no existe, el backend devuelve 404 silencioso)
        if (this.userName) {
          await lastValueFrom(
            this.employeeService.updateEmployeeDeptPos(this.branchId, this.userName, idRole, idPosicion)
              .pipe(catchError(() => of(null)))
          );
        }
        this.pendingPrincipal = null;
      }

      alerts.basicAlert('Datos actualizados', 'Se han actualizado los datos correctamente.', 'success');
      this.hasWarehouseChanges = false;
      this.signalsService.setRefresCantidadPermisos(true);
      this.obternerDatos();
      // Recargar guard para que el sidebar refleje los permisos de la sucursal activa
      this.authService.reloadCurrentSessionGuard().subscribe();
    } catch (error) {
      console.error(error);
      alerts.basicAlert('Error', 'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.', 'error');
    }
  }

  deleteSelectedWarehouse() {
    if (!this.selectedWarehouse) {
      alerts.basicAlert('Eliminar entrada', 'Por favor, seleccione un departamento para eliminar.', 'warning');
      return;
    }

    const { idRole, idPosicion } = this.selectedWarehouse;

    if (!idRole || !idPosicion) {
      alerts.basicAlert('Eliminar entrada', 'El registro seleccionado no tiene Departamento o Posición asignada.', 'error');
      return;
    }

    alerts.userConfirmDelete(
      '¿Eliminar departamento?',
      'Se eliminará el departamento/posición y todos sus permisos configurados para este usuario.'
    ).then((value) => {
      if (value.isConfirmed) {
        forkJoin([
          this.permitionsService.deleteRolesBydescription(this.userId, this.branchId, idRole, idPosicion).pipe(catchError(() => of(null))),
          this.permitionsService.deleteRoles(this.userId, this.branchId, idRole, idPosicion).pipe(catchError(() => of(null))),
        ]).subscribe(() => {
          this.trackingService.addLog(
            this.trackingService.getnameComp(),
            'Delete Registro de Permisos por Departamento',
            'Menu Administracion Usuarios',
            this.trackingService.getEmail()
          );
          this.obternerDatos();
          this.signalsService.setRefresCantidadPermisos(true);
          this.selectedWarehouse = null;
          // Recargar guard para que el sidebar refleje los permisos de la sucursal activa
          this.authService.reloadCurrentSessionGuard().subscribe();
        });
      }
    });
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.__originalIdRole;
    delete cleanedData.__originalIdPosicion;
    delete cleanedData.principal;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  onCellClicked(event: any): void {
    const colId = event.column.getColId();

    if (colId === 'idPosicion') {
      this.idPosicionSelect = event.data.idPosicion;
      this.primePosicionesForRow(event.data);
    }

    if (colId === 'Permisos') {
      if (event.data?.__isNew) return;
      if (!this.canOpenVerPermisosModal()) {
        alerts.userBasicAlert(
          'Sin acceso',
          'No tienes el permiso «Permisos» en Setup Usuarios (Permisos maestros).',
          'info'
        );
        return;
      }
      this.modalService.openPermissions({
        idUser: this.userId,
        idBranch: this.branchId,
        idRole: event.data.idRole,
        idPosicion: event.data.idPosicion,
        userName: this.userName,
        modalTitleDetail: this.buildPermissionsModalTitle(event.data.idPosicion, event.data.idRole),
        seedFromRolePosition: true,
        scope: 'userSystem',
        idCompany: this.idCompany,
      });
    }
  }

  /** Título del modal: nombre del usuario y posición (no departamento ni sucursal). */
  private buildPermissionsModalTitle(idPosicion: number, idRole?: number): string {
    const pid = Number(idPosicion);
    const pos = this.catalogGeneralPosiciones?.find((p: any) => this.catalogEntryId(p) === pid);
    const posName = this.catalogEntryDescription(pos) || `Posición ${pid}`;
    const u = (this.userName ?? '').trim() || 'Usuario';
    const branch = (this.branchName ?? '').trim();
    const rid = Number(idRole);
    const role = rid > 0 ? this.catalogRoles?.find((r: any) => this.catalogEntryId(r) === rid) : null;
    const deptName = role ? this.catalogEntryDescription(role) : '';
    const parts = [u, branch, deptName, posName].filter(Boolean);
    return parts.join(' — ');
  }

  /** Mismo switch que «Permisos» bajo Setup Usuarios en Permisos maestros (`identifier`: permissions). */
  private canOpenVerPermisosModal(): boolean {
    const email = this.signalsService.getemailChoose();
    if (email === environment.root) {
      return true;
    }
    return this.authService.hasUsersMenuPermissionsAccess();
  }
}
