import { Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { SignalsService } from 'app/services/signals.service';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { WarehousesService } from 'app/services/warehouses.service';
import { TrackingService } from 'app/services/tracking.service';
import { alerts } from 'app/helpers/alerts';
import { catchError, concat, EMPTY, lastValueFrom, toArray, forkJoin } from 'rxjs';

@Component({
  selector: 'app-detail-warehouses-renderer',
  standalone: true,
  imports: [AgGridModule, CommonModule],
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
          (gridReady)="onWarehousesGridReady($event)"
          (cellValueChanged)="onWarehousesCellValueChanged($event)">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailWarehousesRendererComponent implements ICellRendererAngularComp {
  private signalsService = inject(SignalsService);
  private usersxpermissionsService = inject(UsersxpermissionsService);
  private warehousesService = inject(WarehousesService);
  private trackingService = inject(TrackingService);

  params: any;
  userId: number;
  userName: string;
  branchId: number;
  branchName: string;

  // Warehouses grid properties
  warehousesRowData: any[] = [];
  hasWarehouseChanges: boolean = false;
  warehousesGridApi: any;
  selectedWarehouse: any = null;

  // Data for dropdowns
  warehouses: any[] = [];
  warehousesMap: { [key: string]: string } = {};

  private tempIdCounter: number = 0;

  warehousesGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single'
  };

  get warehousesColumnDefs(): any[] {
    return [
      {
        field: 'name',
        headerName: 'Almacén',
        editable: true,
        suppressMovable: true,
        filter: false,
        flex: 1,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.warehouses ? this.warehouses.map((item: any) => item.name) : []
        },
        valueFormatter: (params: any) => {
          if (params.data?.name) {
            return params.data.name;
          }
          if (params.data?.idPermission) {
            const foundWarehouse = this.warehouses.find((item: any) => item.id === params.data.idPermission);
            return foundWarehouse ? foundWarehouse.name : `ID: ${params.data.idPermission}`;
          }
          return params.value || '';
        },
        valueSetter: (params: any) => {
          if (params.newValue && this.warehouses) {
            const selectedWarehouse = this.warehouses.find((w: any) => w.name === params.newValue);
            if (selectedWarehouse) {
              params.data.idPermission = selectedWarehouse.id;
              params.data[params.colDef.field] = params.newValue;
              return true;
            }
          }
          return false;
        }
      }
    ];
  }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.userId = params.data.idUser;
    this.userName = params.data.userName || '';
    this.branchId = params.data.idPermission;
    this.branchName = params.data.name || '';

    // Cargar catálogos y datos
    this.loadCatalogs();
  }

  refresh(): boolean {
    return false;
  }

  async loadCatalogs() {
    // Cargar almacenes de la sucursal
    this.warehousesService.getSimpleWarehouses(this.branchId).subscribe(
      (data: any) => {
        this.warehouses = data;
        this.warehousesMap = data.reduce((acc: any, warehouse: any) => {
          acc[warehouse.id] = warehouse.name;
          return acc;
        }, {});
        this.loadWarehousesData();
      },
      (error) => {
        if (error.status == 404) {
          this.warehouses = [];
          this.warehousesRowData = [];
        } else {
          console.error('Error fetching warehouses:', error);
        }
      }
    );
  }

  loadWarehousesData() {
    const permissionType = 'warehouse';

    this.usersxpermissionsService.getDataUsersxPermissions(permissionType).subscribe({
      next: (data: any) => {
        // Filtrar por usuario y que el warehouse pertenezca a esta branch
        this.warehousesRowData = data.filter((row: any) =>
          row.idUser === this.userId &&
          this.warehouses.some((w: any) => w.id === row.idPermission && w.idBranch === this.branchId)
        );

        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Get Registro en Usuarios por Almacén',
          'Menu Administracion Usuarios por Almacén',
          this.trackingService.getEmail()
        );

        setTimeout(() => {
          if (this.warehousesGridApi && this.warehouses.length > 0) {
            this.warehousesGridApi.refreshCells();
          }
        }, 100);
      },
      error: (error) => {
        console.error('Error fetching warehouses data:', error);
        this.warehousesRowData = [];
      }
    });
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
    const defaultWarehouseId = this.warehouses.length > 0 ? this.warehouses[0].id : 0;

    const newWarehouse = {
      id: tempId,
      idUser: this.userId,
      idPermission: defaultWarehouseId,
      type: 'warehouse',
      active: 1,
      __isNew: true
    };

    this.warehousesRowData = [newWarehouse, ...this.warehousesRowData];
    this.warehousesGridApi.setRowData(this.warehousesRowData);
    this.hasWarehouseChanges = true;

    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Add Registro en Usuarios por Almacén',
      'Menu Administracion Usuarios',
      this.trackingService.getEmail()
    );

    setTimeout(() => {
      this.warehousesGridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'name'
      });
    }, 100);
  }

  async saveWarehouses() {
    const isValid = this.warehousesRowData.every((item) => item.idPermission);

    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe seleccionar un almacén antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.warehousesRowData.filter((row) => row.__isNew);
    const modifiedRows = this.warehousesRowData.filter((row) => row.__modified && !row.__isNew);

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Add Registro en Usuarios por Almacén',
        'Menu Administracion Usuarios',
        this.trackingService.getEmail()
      );
      return this.usersxpermissionsService.addUserxPermission(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Update Registro en Usuarios por Almacén',
        'Menu Administracion Usuarios',
        this.trackingService.getEmail()
      );
      return this.usersxpermissionsService.updateUserxPermission(row.id, cleanedData);
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
      this.loadWarehousesData();
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
      return;
    }

    const warehouseId = this.selectedWarehouse.id;

    this.usersxpermissionsService.deleteUserxPermission(warehouseId).pipe(
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
        'Delete Registro en Usuarios por Almacén',
        'Menu Administracion Usuarios',
        this.trackingService.getEmail()
      );

      this.loadWarehousesData();
      this.selectedWarehouse = null;
    });
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.name;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }
}
