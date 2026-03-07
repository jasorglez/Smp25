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
import { catchError, concat, EMPTY, lastValueFrom, toArray, concatMap } from 'rxjs';
import { environment } from '@env/environment';
import { DetailPermisosXDeptosComponent } from './detail-permisos-x-deptos.component';
import { DetailBranchesRendererComponent } from './detail-branches-renderer.component';
import { AuthService } from 'app/services/auth.service';
import { PermitionsService } from 'app/services/permitions.service';
import { UsersService } from 'app/services/users.service';


@Component({
  selector: 'app-detalle-permisos-x-sucursales',
  standalone: true,
  imports: [AgGridModule, CommonModule, DetailPermisosXDeptosComponent, DetailBranchesRendererComponent],
  template: `
    <div style="padding: 10px; background-color: #e9ecef; height: 100%; display: flex; flex-direction: column;">
      <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
        <strong>{{ isRootUser ? 'Empresas' : 'Sucursales' }} de: {{ userName }}</strong>
        <div class="d-flex">
          <button
            class="btn btn-primary ms-1"
            (click)="addPermission()"
            [disabled]="!permissionsGridApi">
            <i class="bi bi-plus-lg"></i>
          </button>
          <button
            class="btn btn-success ms-1 position-relative"
            (click)="savePermissions()"
            [disabled]="!hasPermissionChanges">
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
            [disabled]="!selectedPermission">
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
  authService = inject(AuthService);

  params: any;
  userId: number;
  userName: string;
  isRootUser: boolean = false;
  showRoot: boolean = false;
  canSeeBranches: boolean = false;
  permiso: any[] = [];

  permissionsRowData: any[] = [];
  hasPermissionChanges: boolean = false;
  permissionsGridApi: any;
  selectedPermission: any = null;

  branches: any[] = [];
  allBranches: any[] = [];
  roots: any[] = [];
  idRoot: number;

  private tempIdCounter: number = 0;

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
    isRowMaster: (dataItem: any) => true,
    detailCellRendererSelector: (params: any) => {
      if (this.isRootUser) {
        return { component: 'detailBranchesRenderer' };
      } else {
        return { component: 'detailPermisosXDeptos' };
      }
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
            const found = this.permiso.find((p: any) => p.id === params.data.idPermission);
            return found ? found.departmentCount ?? 0 : 0;
          },
          cellStyle: { backgroundColor: '#d4edda' },
          onCellClicked: this.toggleBranches.bind(this)
        },
        {
          field: 'position',
          headerName: 'Posición',
          valueFormatter: (params) => {
            const found = this.permiso.find((p: any) => p.id === params.data.idPermission);
            return found ? found.positionCount ?? 0 : 0;
          }
        },
        // ✅ Principal DESPUÉS de Posición
        {
          field: 'principal',
          headerName: 'Principal',
          width: 110,
          editable: true,
          cellEditor: 'agCheckboxCellEditor',
          cellRenderer: 'agCheckboxCellRenderer',
          valueGetter: (params: any) => {
            const sidebarBranchId = this.signalsService.getBranchSelectedBySidebar()();
            return params.data.idPermission === sidebarBranchId;
          },
          valueSetter: (params: any) => {
            params.data.advanced = params.newValue ? 1 : null;
            params.data.principal = params.newValue;
            return true;
          }
        },
      ];
    }
  }

  getInfoByUser() {
    this.permitionsService.getInfoByUser(this.userId)
      .subscribe((data: any) => {
        this.permiso = data;
        console.log('🔵 getInfoByUser - permiso:', this.permiso);
      });
  }

  constructor() {
    effect(() => {
      if (this.signalsService.getRefresCantidadPermisos()()) {
        this.loadCatalogs();
        this.getInfoByUser();
        this.signalsService.setRefresCantidadPermisos(false);
      }
    });
  }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.userId = params.data.id;
    this.userName = params.data.displayName || params.data.email;
    this.getInfoByUser();
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();

    const userEmail = this.signalsService.getemailChoose();
    this.showRoot = userEmail === environment.root;

    const hasCompaniesPermission = this.authService.hasDetailedPermission('users-setup', 'companies');
    const hasBranchesPermission = this.authService.hasDetailedPermission('users-setup', 'branches');

    this.isRootUser = false;
    this.canSeeBranches = this.showRoot || hasBranchesPermission;

    this.loadCatalogs();
  }

  refresh(): boolean {
    return false;
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
          this.permissionsRowData = (data.project || []).map((row: any) => ({
            ...row,
            idPermission: row.idPermission || row.idBranch || row.id,
            principal: (row.idPermission || row.idBranch || row.id) === sidebarBranchId
          }));

          console.log('🟢 permissionsRowData mapeado:', this.permissionsRowData);

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
