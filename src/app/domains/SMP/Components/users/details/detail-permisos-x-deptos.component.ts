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
import { alerts } from 'app/helpers/alerts';
import { AuthService } from 'app/services/auth.service';
import { catchError, concat, EMPTY, forkJoin, lastValueFrom, toArray } from 'rxjs';
import { DetailPermissionsUserComponent } from './detail-permissions-user/detail-permissions-user.component';
import { PermissionsViewByUserComponent } from './detail-permissions-user/permissions-view.component';
import { ModalService } from 'app/services/permissions-modal.service';

@Component({
  selector: 'app-detail-permisos-x-deptos',
  standalone: true,
  imports: [AgGridModule, CommonModule, DetailPermissionsUserComponent, PermissionsViewByUserComponent],
  template: `
    <div style="padding: 10px; background-color: #f8f9fa; height: 100%; display: flex; flex-direction: column;">
      <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
        <strong>Departamentos de: {{ userName }} ({{ branchName }})</strong>
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
            class="btn btn-danger ms-1"
            (click)="deleteSelectedWarehouse()"
            [disabled]="!selectedWarehouse">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>

      <div style="flex-grow: 1; display: flex; flex-direction: column;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="warehousesColumnDefs"
          [rowData]="warehousesRowData"
          [gridOptions]="warehousesGridOptions"
          [components]="components"
          (gridReady)="onWarehousesGridReady($event)"
          (cellValueChanged)="onWarehousesCellValueChanged($event)"
          (cellClicked)="onCellClicked($event)"
          [stopEditingWhenCellsLoseFocus]="true">
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
  branchId: number;
  branchName: string;
  idCompany: number;

  warehousesRowData: any[] = [];
  catalogRoles: any[] = [];
  catalogPosiciones: any[] = [];
  rolesDefinidos: any[] = [];
  catalogGeneralPosiciones: any[] = [];
  hasWarehouseChanges: boolean = false;
  warehousesGridApi: any;
  idPosicionSelect: number;
  selectedWarehouse: any = null;

  warehouses: any[] = [];
  warehousesMap: { [key: string]: string } = {};

  private tempIdCounter: number = 0;
  empleadoPrincipal: any = null;

  warehousesGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single',
    onRowClicked: (event) => {
      event.node.setSelected(true);
      this.selectedWarehouse = event.data;
    },
    rowClass: (params) => {
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
      // ✅ Principal ANTES de Departamento (selección exclusiva: solo una fila marcada)
      {
        field: 'principal',
        headerName: 'Principal',
        width: 110,
        editable: true,
        cellEditor: 'agCheckboxCellEditor',
        cellRenderer: 'agCheckboxCellRenderer',
        valueGetter: (params: any) => {
          // Si la fila viene con principal del backend, mostrarla marcada
          if (params.data.principal === true || params.data.principal === 1) return true;
          if (!this.empleadoPrincipal) return false;
          return params.data.idRole == this.empleadoPrincipal.idDepto &&
                 params.data.idPosicion == this.empleadoPrincipal.idPosition;
        },
        valueSetter: (params: any) => {
          const newValue = !!params.newValue;
          params.data.principal = newValue;

          if (newValue) {
            if (params.data.idRole == null || params.data.idPosicion == null) {
              alerts.basicAlert(
                'Principal',
                'Debe seleccionar Departamento y Posición en esta fila antes de marcarla como principal.',
                'warning'
              );
              params.data.principal = false;
              return false;
            }
            // Solo actualizar el estado visual (principal es solo visual, no se guarda en backend)
            this.empleadoPrincipal = {
              idDepto: params.data.idRole,
              idPosition: params.data.idPosicion,
            };
          } else {
            this.empleadoPrincipal = null;
          }

          // Refrescar la columna Principal para que los checkboxes se redibujen
          setTimeout(() => {
            if (this.warehousesGridApi) {
              this.warehousesGridApi.refreshCells({ columns: ['principal'], force: true });
            }
          }, 0);
          return true;
        }
      },
      {
        field: 'idRole',
        headerName: 'Departamento',
        editable: () => true,
        suppressMovable: true,
        filter: false,
        flex: 1,
        cellEditor: 'agSelectCellEditor',
        onCellValueChanged: (params) => {
          const newRolId = params.newValue;
          if (newRolId && newRolId !== params.oldValue) {
            this.getPoscionesbyRole(newRolId);
          }
        },
        cellEditorParams: (params) => {
          const usedRoles = this.warehousesRowData
            .filter(row => row !== params.data && row.idRole)
            .map(row => row.idRole);
          const filteredRoles = this.catalogRoles
            ? this.catalogRoles.filter(item => !usedRoles.includes(item.id))
            : [];
          return {
            values: filteredRoles.map(item => item.id)
          };
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          const found = this.catalogRoles?.find(item => item.id === params.value);
          return found ? found.description : params.value;
        },
        valueSetter: (params) => {
          const newDeptId = params.newValue;
          if (params.data.idRole === newDeptId) return false;

          const duplicateExists = this.warehousesRowData.some(
            (row) => row !== params.data && row.idRole === newDeptId
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
        headerName: 'Posicion',
        editable: () => true,
        suppressMovable: true,
        filter: 'agNumberColumnFilter',
        flex: 1,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => {
          const currentRole = params.data.idRole;
          const assignedPositions = this.warehousesRowData
            .filter(row => row.idRole === currentRole && row !== params.data)
            .map(row => row.idPosicion);
          const filteredPosiciones = this.catalogPosiciones
            ? this.catalogPosiciones.filter(item => !assignedPositions.includes(item.id))
            : [];
          return {
            values: filteredPosiciones.map(item => item.id)
          };
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          const found = this.catalogGeneralPosiciones?.find(item => item.id === params.value);
          return found ? found.description : params.value;
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
        cellStyle: { backgroundColor: '#d4edda' },
        cellRenderer: () => {
          return `<span style="cursor: pointer; text-decoration: underline; color: #0d6efd;">Ver Permisos</span>`;
        }
      },
    ];

    return this._warehousesColumnDefs;
  }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.userId = params.data.idUser;
    this.userName = params.data.userName || '';
    this.branchId = params.data.idPermission;
    this.branchName = params.data.name || '';
    this.idCompany = this.signalsService.getRootSelectedBySidebar()();
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
        this.catalogRoles = data;
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
        this.catalogGeneralPosiciones = data;
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
        next: (data: any) => { console.log(data); resolve(data || []); },
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
        const permisosArr = Array.isArray(permisos) ? permisos : [];
        const empleadosArr = Array.isArray(empleados) ? empleados : [];

        this.warehousesRowData = permisosArr;

        // 1) Si el backend envía una fila con principal === true/1, usarla para marcar el checkbox
        const rowPrincipal = permisosArr.find((r: any) => r.principal === true || r.principal === 1);
        if (rowPrincipal && rowPrincipal.idRole != null && rowPrincipal.idPosicion != null) {
          this.empleadoPrincipal = {
            idDepto: rowPrincipal.idRole,
            idPosition: rowPrincipal.idPosicion,
          };
        } else {
          // 2) Fallback: buscar empleado por nombre (soporta idDepto/idRole e idPosition/idPosicion)
          const emp = empleadosArr.find(
            (e: any) => (e.name?.toUpperCase() || e.displayName?.toUpperCase()) === this.userName?.toUpperCase()
          );
          if (emp && (emp.idDepto != null || emp.idRole != null) && (emp.idPosition != null || emp.idPosicion != null)) {
            this.empleadoPrincipal = {
              idDepto: emp.idRole ?? emp.idDepto,
              idPosition: emp.idPosition ?? emp.idPosicion,
            };
          } else {
            this.empleadoPrincipal = null;
          }
        }

        setTimeout(() => {
          if (this.warehousesGridApi) this.warehousesGridApi.refreshCells({ force: true });
        }, 100);
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
    this.warehousesGridApi.setRowData(this.warehousesRowData);
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

    const addObservables = newRows.flatMap((row) => {
      const observables = [];
      const cleanedData = this.cleanDataForServer(row);
      delete cleanedData.posicionesDisponibles;
      observables.push(this.permitionsService.addPermitionsDetailBydescription(cleanedData));

      console.log(this.rolesDefinidos);
      if (this.rolesDefinidos && this.rolesDefinidos.length > 0) {
        const detailObservables = this.rolesDefinidos.map((permiso) => {
          const detailData = {
            ...cleanedData,
            idMasterPermission: permiso.idMasterPermission,
            masterRead: permiso.masterRead,
            idDetailedPermission: permiso.idDetailedPermission,
            detailedRead: permiso.detailedRead,
            idShowPermition: permiso.idShowPermition,
            showColumn: permiso.showColumn,
            canCreate: permiso.canCreate,
            canRead: permiso.canRead,
            canUpdate: permiso.canUpdate,
            canDelete: permiso.canDelete,
            active: permiso.active,
          };
          console.log(detailData);
          return this.permitionsService.addPermitionsDetail(detailData);
        });
        observables.push(...detailObservables);
      }
      return observables;
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
      await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );
      alerts.basicAlert('Datos actualizados', 'Se han actualizado los datos correctamente.', 'success');
      this.hasWarehouseChanges = false;
      this.signalsService.setRefresCantidadPermisos(true);
      this.obternerDatos();
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

    alerts.confirmAlert(
      'Eliminar permiso',
      '¿Está seguro que desea eliminar este permiso de departamento?',
      'warning',
      'Sí, eliminar'
    ).then((value) => {
      if (value.isConfirmed) {
        this.permitionsService.deleteRolesBydescription(this.userId, this.branchId, idRole, idPosicion).pipe(
          catchError((error) => {
            alerts.basicAlert('Eliminar entrada', 'Error al eliminar la entrada.', 'error');
            console.error(error);
            return EMPTY;
          })
        ).subscribe(() => {
          alerts.basicAlert('Eliminar entrada', 'Entrada eliminada satisfactoriamente.', 'success');
          this.trackingService.addLog(
            this.trackingService.getnameComp(),
            'Delete Registro de Permisos por Departamento',
            'Menu Administracion Usuarios',
            this.trackingService.getEmail()
          );
          this.obternerDatos();
          this.signalsService.setRefresCantidadPermisos(true);
          this.selectedWarehouse = null;
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

  async onCellClicked(event: any): Promise<void> {
    const colId = event.column.getColId();

    if (colId === 'idRole') {
      const roleId = event.data.idRole;
      console.log(event.data);
      this.catalogPosiciones = roleId ? await this.getPoscionesbyRole(roleId) : [];
    }

    if (colId === 'idPosicion') {
      const roleId = event.data.idRole;
      this.idPosicionSelect = event.data.idPosicion;
      this.catalogPosiciones = roleId ? await this.getPoscionesbyRole(roleId) : [];
    }

    if (colId === 'Permisos') {
      this.modalService.openPermissions({
        idUser: this.userId,
        idBranch: this.branchId,
        idRole: event.data.idRole,
        idPosicion: event.data.idPosicion,
        userName: this.userName,
      });
    }
  }
}