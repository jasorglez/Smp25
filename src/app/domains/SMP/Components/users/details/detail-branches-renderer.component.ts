import { Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { SignalsService } from 'app/services/signals.service';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { BranchsService } from 'app/services/branchs.service';
import { TrackingService } from 'app/services/tracking.service';
import { alerts } from 'app/helpers/alerts';
import { catchError, concat, EMPTY, forkJoin, lastValueFrom, of, toArray } from 'rxjs';
import { EmployeesService } from 'app/services/employees.service';
import { DetailPermisosXDeptosComponent } from './detail-permisos-x-deptos.component';
import { AuthService } from 'app/services/auth.service';
import { environment } from '@env/environment';
import { PermitionsService } from 'app/services/permitions.service';
import { RolesService } from 'app/services/roles.service';

@Component({
  selector: 'app-detail-branches-renderer',
  standalone: true,
  imports: [AgGridModule, CommonModule, DetailPermisosXDeptosComponent],
  template: `
    <div style="padding: 10px; background-color: #f0f0f0; height: 100%; display: flex; flex-direction: column;">
      <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
        <strong>Sucursales de: {{ userName }} ({{companyName}})</strong>
        <div class="d-flex">
          <button
            class="btn btn-primary ms-1"
            (click)="addBranch()"
            [disabled]="!branchesGridApi || !canInteractSucursalesSegundoNivel()">
            <i class="bi bi-plus-lg"></i>
          </button>
          <button
            class="btn btn-success ms-1 position-relative"
            (click)="saveBranches()"
            [disabled]="!hasBranchChanges || !canInteractSucursalesSegundoNivel()">
            <i class="bi bi-floppy"></i>
            <span
              class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
              *ngIf="hasBranchChanges">
              <span class="visually-hidden">Hay cambios sin guardar</span>
            </span>
          </button>
          <button
            class="btn btn-danger ms-1"
            (click)="deleteSelectedBranch()"
            [disabled]="!selectedBranch || !canInteractSucursalesSegundoNivel()">
            <i class="bi bi-trash"></i>
          </button>
          <button
            class="btn btn-info ms-1"
            (click)="toggleWarehouses()"
            [disabled]="!canInteractSucursalesSegundoNivel()">
            <i class="bi bi-shield-lock"></i>
          </button>
        </div>
      </div>
      <div style="flex-grow: 1; display: flex; flex-direction: column; min-height: 0;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; height: 100%;"
          [columnDefs]="branchesColumnDefs"
          [rowData]="branchesRowData"
          [gridOptions]="branchesGridOptions"
          [defaultColDef]="defaultColDef"
          [components]="components"
          [detailRowAutoHeight]="true"
          (gridReady)="onBranchesGridReady($event)"
          (cellValueChanged)="onBranchesCellValueChanged($event)"
          [stopEditingWhenCellsLoseFocus]="true">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailBranchesRendererComponent implements ICellRendererAngularComp {
  private signalsService = inject(SignalsService);
  private usersxpermissionsService = inject(UsersxpermissionsService);
  private branchesService = inject(BranchsService);
  private trackingService = inject(TrackingService);
  private employeeService = inject(EmployeesService);
  private authService = inject(AuthService);
  private permitionsService = inject(PermitionsService);
  private rolesService = inject(RolesService);

  /** Venía del maestro: si el usuario editado tiene «Departamento» en UserSystem (Permisos maestros). */
  private getDepartmentAllowed: (() => boolean) | undefined;

  params: any;
  userId: number;
  userName: string;
  companyId: number;
  companyName: string;

  branchesRowData: any[] = [];
  hasBranchChanges: boolean = false;
  branchesGridApi: any;
  selectedBranch: any = null;

  branches: any[] = [];
  catalogRoles: any[] = [];
  catalogGeneralPosiciones: any[] = [];

  private tempIdCounter: number = 0;

  components = {
    detailPermisosXDeptos: DetailPermisosXDeptosComponent
  };

  // Evita que AG Grid genere columnas automáticas desde los datos
  defaultColDef = {
    suppressMovable: true,
    filter: false,
  };

  branchesGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single',
    masterDetail: true,
    isRowMaster: () => this.canInteractSucursalesSegundoNivel(),
    detailCellRenderer: 'detailPermisosXDeptos',
    detailRowHeight: 350,
    suppressAutoSize: true,
    detailCellRendererParams: {
      autoHeight: true,
    },
    getRowStyle: () => {
      if (!this.canInteractSucursalesSegundoNivel()) {
        return {
          width: '100%',
          opacity: 0.65,
          cursor: 'not-allowed',
          pointerEvents: 'none' as const,
        };
      }
      return { width: '100%' };
    },
  };

  get branchesColumnDefs(): any[] {
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
        editable: () => this.canInteractSucursalesSegundoNivel(),
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
            const foundBranch = this.branches.find((item: any) => item.id === params.data.idPermission);
            return foundBranch ? foundBranch.name : `ID: ${params.data.idPermission}`;
          }
          return params.value || '';
        },
        valueSetter: (params: any) => {
          if (params.newValue && this.branches) {
            const selectedBranch = this.branches.find((b: any) => b.name === params.newValue);
            if (selectedBranch) {
              params.data.idPermission = selectedBranch.id;
              params.data[params.colDef.field] = params.newValue;
              return true;
            }
          }
          return false;
        }
      },
      {
        field: 'idRole',
        headerName: 'Departamento',
        suppressMovable: true,
        filter: false,
        flex: 1,
        valueFormatter: (params: any) => {
          const raw = params.value;
          if (raw == null || raw === '' || Number(raw) === 0) return '';
          const id = Number(raw);
          const found = this.catalogRoles?.find((r: any) => Number(r.id) === id);
          return found?.description ?? (Number.isFinite(id) ? `ID: ${id}` : String(raw));
        },
      },
      {
        field: 'idPosicion',
        headerName: 'Posición',
        suppressMovable: true,
        filter: false,
        flex: 1,
        valueFormatter: (params: any) => {
          const raw = params.value;
          if (raw == null || raw === '' || Number(raw) === 0) return '';
          const id = Number(raw);
          const found = this.catalogGeneralPosiciones?.find((p: any) => Number(p.id) === id);
          return found?.description ?? (Number.isFinite(id) ? `ID: ${id}` : String(raw));
        },
      },
      // ✅ Principal DESPUÉS de Posición
      {
        field: 'principal',
        headerName: 'Principal',
        width: 110,
        editable: () => this.canInteractSucursalesSegundoNivel(),
        cellEditor: 'agCheckboxCellEditor',
        cellRenderer: 'agCheckboxCellRenderer',
        valueSetter: (params: any) => {
          params.data.principal = params.newValue;
          return true;
        }
      },
    ];
  }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.getDepartmentAllowed = (params as unknown as { getDepartmentAllowed?: () => boolean })
      .getDepartmentAllowed;
    this.userId = params.data.idUser;
    this.userName = params.data.userName || '';
    this.companyId = params.data.idPermission;
    this.companyName = params.data.companyName || '';

    this.loadCatalogs();
  }

  refresh(): boolean {
    return false;
  }

  async loadCatalogs() {
    // Catálogos para renderizar descripciones (igual que “Sucursal” -> nombre)
    this.rolesService.getCatalogRoles(this.companyId).subscribe({
      next: (data: any) => {
        this.catalogRoles = Array.isArray(data) ? data : [];
        this.branchesGridApi?.refreshCells({ force: true });
      },
      error: () => {
        this.catalogRoles = [];
      },
    });
    this.rolesService.getGeneralPosicion(this.companyId).subscribe({
      next: (data: any) => {
        this.catalogGeneralPosiciones = Array.isArray(data) ? data : [];
        this.branchesGridApi?.refreshCells({ force: true });
      },
      error: () => {
        this.catalogGeneralPosiciones = [];
      },
    });

    this.branchesService.getBranches(this.companyId).subscribe(
      (data: any) => {
        this.branches = data;
        this.loadBranchesData();
      },
      (error) => {
        if (error.status == 404) {
          this.branches = [];
          this.branchesRowData = [];
        }
        console.error('Error fetching branches:', error);
      }
    );
  }

  loadBranchesData() {
    this.branchesService.getBranchesByUserAndCompany(this.userId, this.companyId).subscribe(
      (data: any) => {
        const rows = (data.project || []).map((row: any) => ({
          ...row,
          // idPermission aquí DEBE ser el id real de la sucursal.
          // No usar fallback row.id porque normalmente es el id interno del registro Usersxpermission
          // y rompe las consultas a permisos por sucursal (deptos/posiciones).
          idPermission:
            row.idPermission ??
            row.IdPermission ??
            row.idBranch ??
            row.IdBranch ??
            null,
          idUser: this.userId,
          userName: this.userName
        }));

        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Get Registro en Usuarios por Sucursal (desde empresa)',
          'Menu Administracion Usuarios',
          this.trackingService.getEmail()
        );

        if (rows.length === 0) {
          this.branchesRowData = [];
          return;
        }

        // Build maps: branchId -> employees + permisos(roles/posiciones) (errors return empty array)
        const uniqueBranchIds: number[] = [...new Set<number>(rows.map((r: any) => r.idPermission as number))];
        const employeeRequests: Record<string, any> = {};
        const permisosRequests: Record<string, any> = {};
        uniqueBranchIds.forEach((branchId: number) => {
          employeeRequests[String(branchId)] = this.employeeService.getEmployees(branchId).pipe(
            catchError(() => of([]))
          );
          permisosRequests[String(branchId)] = this.permitionsService.getRolYPosicion(this.userId, branchId).pipe(
            catchError(() => of([]))
          );
        });

        forkJoin({ employeesByBranch: forkJoin(employeeRequests), permisosByBranch: forkJoin(permisosRequests) }).subscribe({
          next: ({ employeesByBranch, permisosByBranch }: any) => {
            this.branchesRowData = rows.map((row: any) => {
              const employees: any[] = Array.isArray(employeesByBranch[String(row.idPermission)])
                ? employeesByBranch[String(row.idPermission)]
                : [];
              const empleado = employees.find(
                (e: any) => e.name?.toUpperCase() === this.userName?.toUpperCase()
              );

              const permisosRaw: any[] = Array.isArray(permisosByBranch[String(row.idPermission)])
                ? permisosByBranch[String(row.idPermission)]
                : [];
              const permisos: any[] = permisosRaw.map((p: any) => ({
                ...p,
                idRole:
                  p?.idRole ??
                  p?.IdRole ??
                  p?.idDepto ??
                  p?.IdDepto ??
                  null,
                idPosicion:
                  p?.idPosicion ??
                  p?.IdPosicion ??
                  p?.idPosition ??
                  p?.IdPosition ??
                  null,
                principal:
                  p?.principal ??
                  p?.Principal ??
                  p?.isPrincipal ??
                  p?.IsPrincipal ??
                  false,
              }));
              const principalPerm =
                permisos.find((p: any) => p?.principal === true || p?.principal === 1) ?? null;
              const anyPerm = permisos.length > 0 ? permisos[0] : null;
              const idRoleReal = Number(principalPerm?.idRole ?? anyPerm?.idRole ?? 0) || 0;
              const idPosicionReal = Number(principalPerm?.idPosicion ?? anyPerm?.idPosicion ?? 0) || 0;

              return {
                ...row,
                // Si no hay permisos por depto/posición en esta sucursal, debe mostrarse 0 (no 1).
                idRole: permisos.length > 0 ? idRoleReal : 0,
                idPosicion: permisos.length > 0 ? idPosicionReal : 0,
                // Principal: prioridad a lo guardado en permisos; fallback al match con empleado si existe.
                principal: principalPerm
                  ? true
                  : empleado
                    ? idRoleReal == (empleado.idDepto ?? empleado.idRole) && idPosicionReal == (empleado.idPosition ?? empleado.idPosicion)
                    : false
              };
            });

            setTimeout(() => {
              if (this.branchesGridApi && this.branches.length > 0) {
                this.branchesGridApi.refreshCells();
              }
            }, 100);
          },
          error: (err) => {
            console.error('Error cargando empleados para sucursales:', err);
            this.branchesRowData = rows;
          }
        });
      },
      (error) => {
        if (error.status == 404) this.branchesRowData = [];
        console.error('Error fetching branches data:', error);
      }
    );
  }

  onBranchesGridReady(params: any) {
    this.branchesGridApi = params.api;
    params.api.sizeColumnsToFit();

    params.api.addEventListener('selectionChanged', () => {
      const selectedNodes = params.api.getSelectedNodes();
      this.selectedBranch = selectedNodes.length > 0 ? selectedNodes[0].data : null;
    });
  }

  onBranchesCellValueChanged(event: any) {
    if (!event.data.__isNew) {
      event.data.__modified = true;
    }
    this.hasBranchChanges = true;
  }

  addBranch() {
    if (!this.canInteractSucursalesSegundoNivel()) {
      alerts.basicAlert(
        'Sin acceso',
        'Se requiere «Departamento» y «Security» activos en Setup Usuarios (Permisos maestros) para este usuario, y permisos equivalentes en tu sesión.',
        'info'
      );
      return;
    }
    if (!this.branchesGridApi) {
      console.error('Branches grid API not ready');
      return;
    }

    const tempId = `temp_${this.tempIdCounter++}`;
    const defaultBranchId = this.branches.length > 0 ? this.branches[0].id : 0;

    const newBranch = {
      id: tempId,
      idUser: this.userId,
      idPermission: defaultBranchId,
      type: 'branch',
      active: 1,
      __isNew: true
    };

    this.branchesRowData = [newBranch, ...this.branchesRowData];
    this.branchesGridApi.setRowData(this.branchesRowData);
    this.hasBranchChanges = true;

    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Add Registro en Usuarios por Sucursal',
      'Menu Administracion Usuarios',
      this.trackingService.getEmail()
    );

    setTimeout(() => {
      this.branchesGridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'name'
      });
    }, 100);
  }

  async saveBranches() {
    if (!this.canInteractSucursalesSegundoNivel()) {
      alerts.basicAlert(
        'Sin acceso',
        'Se requiere «Departamento» y «Security» activos en Setup Usuarios (Permisos maestros) para este usuario, y permisos equivalentes en tu sesión.',
        'info'
      );
      return;
    }
    const isValid = this.branchesRowData.every((item) => item.idPermission);

    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe seleccionar una sucursal antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.branchesRowData.filter((row) => row.__isNew);
    const modifiedRows = this.branchesRowData.filter((row) => row.__modified && !row.__isNew);

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.usersxpermissionsService.addUserxPermission(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.usersxpermissionsService.updateUserxPermission(row.id, cleanedData);
    });

    try {
      await lastValueFrom(concat(...addObservables, ...updateObservables).pipe(toArray()));
      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.hasBranchChanges = false;
      this.loadBranchesData();
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos.',
        'error'
      );
    }
  }

  deleteSelectedBranch() {
    if (!this.canInteractSucursalesSegundoNivel()) {
      alerts.basicAlert(
        'Sin acceso',
        'Se requiere «Departamento» y «Security» activos en Setup Usuarios (Permisos maestros) para este usuario, y permisos equivalentes en tu sesión.',
        'info'
      );
      return;
    }
    if (!this.selectedBranch) {
      return;
    }

    const branchId = this.selectedBranch.id;

    this.usersxpermissionsService.deleteUserxPermission(branchId).pipe(
      catchError((error) => {
        alerts.basicAlert('Eliminar entrada', 'Error al eliminar la entrada.', 'error');
        console.error(error);
        return EMPTY;
      })
    ).subscribe(() => {
      alerts.basicAlert('Eliminar entrada', 'Entrada eliminada satisfactoriamente.', 'success');
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Delete Registro en Usuarios por Sucursal',
        'Menu Administracion Usuarios',
        this.trackingService.getEmail()
      );
      this.loadBranchesData();
      this.selectedBranch = null;
    });
  }

  toggleWarehouses() {
    if (!this.canInteractSucursalesSegundoNivel()) {
      alerts.basicAlert(
        'Sin acceso',
        'Se requiere «Departamento» y «Security» activos en Setup Usuarios (Permisos maestros) para este usuario, y permisos equivalentes en tu sesión.',
        'info'
      );
      return;
    }
    const selectedNodes = this.branchesGridApi.getSelectedNodes();

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
      this.branchesGridApi.setFilterModel(null);
      this.branchesGridApi.onFilterChanged();
    } else {
      this.branchesGridApi.forEachNode((node: any) => {
        if (node.expanded) node.setExpanded(false);
      });

      this.branchesGridApi.setFilterModel(null);

      const filterModel = {
        id: { filterType: 'number', type: 'equals', filter: selectedData.id }
      };

      this.branchesGridApi.setFilterModel(filterModel);
      this.branchesGridApi.onFilterChanged();

      setTimeout(() => {
        selectedNode.setExpanded(true);
      }, 50);
    }
  }

  /**
   * Operador (o root) + el usuario editado debe tener el id UserSystem de «Departamento» activo
   * (mismo switch que en Permisos maestros › Setup Usuarios).
   */
  canInteractSucursalesSegundoNivel(): boolean {
    const email = this.signalsService.getemailChoose();
    if (email === environment.root) {
      return true;
    }
    if (!this.authService.hasUsersMenuDepartmentAccess()) {
      return false;
    }
    if (!this.authService.hasUsersMenuSecurityAccess()) {
      return false;
    }
    return this.getDepartmentAllowed?.() ?? false;
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.name;
    delete cleanedData.userName;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }
}