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
import { RolesService } from 'app/services/roles.service';
import { alerts } from 'app/helpers/alerts';
import { AuthService } from 'app/services/auth.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray, forkJoin } from 'rxjs';
import { DetailPermissionsUserComponent } from './detail-permissions-user/detail-permissions-user.component';
import { PermissionsViewByUserComponent } from './detail-permissions-user/permissions-view.component';

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
            [disabled]="!warehousesGridApi"
            >
            <i class="bi bi-plus-lg"></i>
          </button>
          <button
            class="btn btn-success ms-1 position-relative"
            (click)="saveWarehouses()"
            [disabled]="!hasWarehouseChanges"
           >
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
            [disabled]="!selectedWarehouse"
            >
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


  // Warehouses grid properties
  warehousesRowData: any[] = [];
  catalogRoles: any[] = [];
  catalogPosiciones: any[] = [];
  rolesDefinidos: any[] = [];
  catalogGeneralPosiciones: any[] = [];
  hasWarehouseChanges: boolean = false;
  private collapseTimer: any = null;
  warehousesGridApi: any;
  idPosicionSelect: number;
  selectedWarehouse: any = null;

  // Data for dropdowns
  warehouses: any[] = [];
  warehousesMap: { [key: string]: string } = {};

  private tempIdCounter: number = 0;

  warehousesGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single',
    masterDetail: true,
    detailCellRendererSelector: (params) => {
    // Decide qué renderizador usar basado en la propiedad 'detailType'
    if (params.data.detailType === 'Permisos') {
      params.node.setRowHeight(20000);
      return {
        component: 'PermissionsViewByUserComponent',
        params: {
          idUser: this.userId,
          idBranch: this.branchId,
          idRole: params.data.idRole,
          idPosicion: params.data.idPosicion,
          onMouseEnter: () => {clearTimeout(this.collapseTimer)},
          onMouseLeave: () => {
            this.collapseTimer = setTimeout(() => {
              params.node.setExpanded(false);
            }, 300);
          },
        }
      };
    } else
    return undefined;
  },
    detailRowHeight: 20000,
    onRowClicked: (event) => {
      event.node.setSelected(true);
      this.selectedWarehouse = event.data;
    },
    rowClass: (params) => {
      // Verificar si la fila está seleccionada
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
      {
        field: 'idRole',
        headerName: 'Departamento',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true
        },
        suppressMovable: true,
        filter: false,
        flex: 1,
        cellEditor: 'agSelectCellEditor',
        onCellValueChanged: (params) => {
          const newRolId = params.newValue;
          if (newRolId && newRolId !== params.oldValue) {
            // Llama al método que recarga las posiciones válidas para ese rol
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

          // Guardar el rol original antes de sobreescribir
          if (!params.data.__originalIdRole && params.data.idRole) {
            params.data.__originalIdRole = params.data.idRole;
          }
          if (!params.data.__originalIdPosicion && params.data.idPosicion) {
            params.data.__originalIdPosicion = params.data.idPosicion;
          }

          params.data.idRole = newDeptId;

          this.getPoscionesbyRole(newDeptId).then((posiciones) => {
            // Guardar las posiciones directamente en la fila
            params.data.posicionesDisponibles = posiciones;
          
            // Resetear idPosicion si es necesario
            params.data.idPosicion = null;
          
            // Refrescar celdas
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
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true
        },
        suppressMovable: true,
        filter: 'agNumberColumnFilter', // Opcional: Ocultar el botón de filtro si no es para el usuario
        flex: 1,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => {
          // Ensure catalogPosiciones data is available when creating editor
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

          // Verificar si la combinación de rol y posición ya existe
          const duplicateExists = this.warehousesRowData.some(
            (row, index) => row.idRole === currentRoleId && row.idPosicion === newPosicionId && params.node.rowIndex !== index
          );

          if (duplicateExists) {
            alerts.basicAlert('Permiso Duplicado', 'Esta combinación de Departamento y Posición ya ha sido asignada.', 'error');
            return false;
          }

          // Guardar la posición original antes de sobreescribir (para el update del backend)
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
        cellRenderer: (params) => {
          // Hacemos que el texto parezca un enlace para indicar que es clickeable.
          return `<span style="cursor: pointer; text-decoration: underline; color: #0d6efd;">Ver Permisos2</span>`;
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
    // Cargar catálogos y datos
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

  getCRUD(idPosicion: number): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.rolesService.getCatalogCRUD(idPosicion).subscribe({
        next: (data: any) => {
          console.log(data)
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
  obternerDatos(){
    
    this.permitionsService.getRolYPosicion(this.userId, this.branchId).subscribe(
      (data: any) => {
        console.log(data)
        this.warehousesRowData =data 
      })
  }

  async loadCatalogs() {
    // No longer needed as we are not loading warehouse permissions here.
    // This component now handles Role and Position permissions per branch.
  }

  loadWarehousesData() {
    // This method is no longer needed as data is fetched in obternerDatos()
  }

  onWarehousesGridReady(params: any) {
    this.warehousesGridApi = params.api;
    params.api.sizeColumnsToFit();

    params.api.addEventListener('selectionChanged', () => {
      const selectedNodes = params.api.getSelectedNodes();
      this.selectedWarehouse = selectedNodes.length > 0 ? selectedNodes[0].data : null;
    });
  }

  onWarehousesCellValueChanged(event: any) {
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
      this.warehousesGridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'idRole'
      });
    }, 100);
  }

  async saveWarehouses() {
    const newRows = this.warehousesRowData.filter((row) => row.__isNew);
    const modifiedRows = this.warehousesRowData.filter((row) => row.__modified && !row.__isNew);

    // Validar solo las filas que se van a guardar (nuevas y modificadas)
    const rowsToValidate = [...newRows, ...modifiedRows];
    const invalidRow = rowsToValidate.find((item) => !item.idRole || !item.idPosicion);

    if (invalidRow) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe seleccionar un Departamento y una Posición antes de guardar.',
        'error'
      );
      return;
    }

    const addObservables = newRows.flatMap((row) => {
      const observables = [];
      // Main permission entry
      const cleanedData = this.cleanDataForServer(row);      
      // Eliminar la propiedad 'posicionesDisponibles' del objeto.
      delete cleanedData.posicionesDisponibles;
      // Llamar al servicio con el objeto 'cleanedData' ya modificado.
      observables.push(this.permitionsService.addPermitionsDetailBydescription(cleanedData));
      //observables.push(this.permitionsService.addPermitions(cleanedData));
      // Detailed permissions if they exist
      console.log(this.rolesDefinidos)
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
          console.log(detailData)
          return this.permitionsService.addPermitionsDetail(detailData);
        });
        observables.push(...detailObservables);
      }
      return observables;
    });

    // Para modificados: eliminar el registro viejo y crear el nuevo
    const updateObservables = modifiedRows.flatMap((row) => {
      const originalRole = row.__originalIdRole || row.idRole;
      const originalPosicion = row.__originalIdPosicion || row.idPosicion;

      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Update Registro de Permisos por Departamento',
        'Menu Administracion Usuarios',
        this.trackingService.getEmail()
      );

      // 1. Eliminar el registro viejo
      const deleteOld$ = this.permitionsService.deleteRoles(this.userId, this.branchId, originalRole, originalPosicion).pipe(
        catchError(() => EMPTY)
      );

      // 2. Crear el nuevo registro
      const cleanedData = this.cleanDataForServer(row);
      delete cleanedData.posicionesDisponibles;
      const createNew$ = this.permitionsService.addPermitionsDetailBydescription(cleanedData);

      return [deleteOld$, createNew$];
    });

    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );
      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.hasWarehouseChanges = false;
      this.signalsService.setRefresCantidadPermisos(true);
      this.obternerDatos();
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  deleteSelectedWarehouse() {
    if (!this.selectedWarehouse) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Por favor, seleccione un departamento para eliminar.',
        'warning'
      );
      return;
    }

    const { idRole, idPosicion } = this.selectedWarehouse;

    if (!idRole || !idPosicion) {
      alerts.basicAlert(
        'Eliminar entrada',
        'El registro seleccionado no tiene Departamento o Posición asignada.',
        'error'
      );
      return;
    }

    alerts.confirmAlert(
      'Eliminar permiso',
      '¿Está seguro que desea eliminar este permiso de departamento?',
      'warning',
      'Sí, eliminar'
    ).then((value) => {
      if (value.isConfirmed) {
        this.permitionsService.deleteRoles(this.userId, this.branchId, idRole, idPosicion).pipe(
          catchError((error) => {
            alerts.basicAlert(
              'Eliminar entrada',
              'Error al eliminar la entrada.',
              'error'
            );
            console.error(error);
            return EMPTY;
          })
        ).subscribe(() => {
          alerts.basicAlert(
            'Eliminar entrada',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );

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
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  async onCellClicked(event: any): Promise<void> {
    const colId = event.column.getColId();
    if (colId === 'idRole') {
      const roleId = event.data.idRole;
      console.log(event.data)
      if (roleId) {
        this.catalogPosiciones = await this.getPoscionesbyRole(roleId);
      } else {
        this.catalogPosiciones = [];
      }
    }
    if (colId === 'idPosicion') {
      const selectedData = event.data;
      const roleId = event.data.idRole;
      this.idPosicionSelect = event.data.idPosicion
      if (roleId) {
        this.catalogPosiciones = await this.getPoscionesbyRole(roleId);
      } else {
        this.catalogPosiciones = [];
      }
    }
    if (colId === 'Permisos') {
      const selectedData = event.data;
      const node = event.node;
      const api = event.api;
      const detailType = 'Permisos';
      const isCurrentlyExpanded = node.expanded && event.data.detailType === detailType;

      if (node.expanded) {
        node.setExpanded(false);
        // Limpiar el filtro al colapsar
        api.setFilterModel(null);
        api.onFilterChanged();
      } else {
        // Colapsar cualquier otra fila que esté expandida
        api.forEachNode(otherNode => {
          if (otherNode.expanded && otherNode.id !== node.id) {
            otherNode.setExpanded(false);
          }
        });
      
        // Asignar el tipo de detalle
        event.data.detailType = detailType;
      
        // Aplicar filtro por idPosicion para enfocar la fila actual
        const filterModel = {
          idPosicion: { filterType: 'number', type: 'equals', filter: selectedData.idPosicion }
        };
      
        api.setFilterModel(filterModel);
      
        // Diferir la expansión del nodo para evitar conflicto con el render actual
        requestAnimationFrame(() => {
          node.setExpanded(true);
        });
      }
    }
  }
}
