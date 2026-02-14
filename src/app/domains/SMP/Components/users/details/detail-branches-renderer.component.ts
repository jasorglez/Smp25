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
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { DetailWarehousesRendererComponent } from './detail-warehouses-renderer.component';

@Component({
  selector: 'app-detail-branches-renderer',
  standalone: true,
  imports: [AgGridModule, CommonModule, DetailWarehousesRendererComponent],
  template: `
    <div style="padding: 10px; background-color: #f0f0f0; height: 100%; display: flex; flex-direction: column;">
      <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
        <strong>ssSucursales de: {{ userName }} ({{companyName}})</strong>
        <div class="d-flex">
          <button
            class="btn btn-primary ms-1"
            (click)="addBranch()"
            [disabled]="!branchesGridApi">
            <i class="bi bi-plus-lg"></i>
          </button>
          <button
            class="btn btn-success ms-1 position-relative"
            (click)="saveBranches()"
            [disabled]="!hasBranchChanges">
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
            [disabled]="!selectedBranch">
            <i class="bi bi-trash"></i>
          </button>
          <button
            class="btn btn-info ms-1"
            (click)="toggleWarehouses()">
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
          [components]="components"
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

  params: any;
  userId: number;
  userName: string;
  companyId: number;
  companyName: string;

  // Branches grid properties
  branchesRowData: any[] = [];
  hasBranchChanges: boolean = false;
  branchesGridApi: any;
  selectedBranch: any = null;

  // Data for dropdowns
  branches: any[] = [];

  private tempIdCounter: number = 0;

  components = {
    detailWarehousesRenderer: DetailWarehousesRendererComponent
  };

  branchesGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single',
    masterDetail: true,
    isRowMaster: (dataItem: any) => true,
    detailCellRenderer: 'detailWarehousesRenderer',
    detailRowHeight: 350
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
        editable: true,
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
      }
    ];
  }

  agInit(params: ICellRendererParams): void {
    this.params = params;
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
    // Cargar sucursales de la empresa
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
    const permissionType = 'branch';

    this.branchesService.getBranchesByUserAndCompany(this.userId, this.companyId).subscribe(
      (data: any) => {
        this.branchesRowData = (data.project || []).map((row: any) => ({
          ...row,
          idPermission: row.idPermission || row.idBranch || row.id,
          idUser: this.userId,
          userName: this.userName
        }));

        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Get Registro en Usuarios por Sucursal (desde empresa)',
          'Menu Administracion Usuarios',
          this.trackingService.getEmail()
        );

        setTimeout(() => {
          if (this.branchesGridApi && this.branches.length > 0) {
            this.branchesGridApi.refreshCells();
          }
        }, 100);
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
