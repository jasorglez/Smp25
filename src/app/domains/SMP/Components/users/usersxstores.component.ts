import { Component, computed, effect, HostListener, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { UsersProfileComponent } from './users-profile.component';
import { catchError, concat, EMPTY, lastValueFrom, toArray, forkJoin } from 'rxjs';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { SignalsService } from 'app/services/signals.service';
import { StoresService } from 'app/services/stores.service';

@Component({
  selector: 'app-usersxstores',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, UsersProfileComponent],
  templateUrl: './usersxpermissions.component.html'
})
export class UsersXStoresComponent {

  private signalsService = inject(SignalsService);
  private storesService = inject(StoresService);
  private usersxstoresService = inject(UsersxpermissionsService);

  constructor() {
    effect(() => {
      this.idBranch = this.signalsService.getBranchFromPermissions()();

      if (!this.idBranch) {
        this.rowData = [];
        this.warehouses = {};
        alerts.basicAlert('Tiendas', 'Debe elegir una sucursal primero para poder ver sus tiendas.', 'error');
      } else {
        this.obtenerDatos();
      }
    });
  }

  ngOnInit() {
    this.obtenerDatos();
    this.idBranch = this.signalsService.getBranchFromPermissions()();
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  // Signals con correo
  profile = computed(() => this.signalsService.profile);
  idUser: any = this.profile().idUser();

  notSavedChanges: boolean = false;
  rowData: any;
  warehouses: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  id: string;
  idBranch: number;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  private permissionType: string = 'store';

  obtenerDatos() {
    forkJoin({
      users: this.usersxstoresService.getDataUsersxPermissions(this.permissionType),
      stores: this.storesService.getStoreList(this.idBranch)
    }).subscribe(({ users, stores }) => {
      // Filtrar sucursales por idCompany
      const filteredBranches = stores.filter(branch => branch.idBranch === this.idBranch);
      
      // Crear el diccionario de sucursales filtradas
      this.warehouses = filteredBranches.reduce((acc, branch) => {
        acc[branch.id] = branch.description;
        return acc;
      }, {});

      // Filtrar usuarios por idUser y que coincidan con las sucursales filtradas
      this.rowData = Array.isArray(users) ? users.filter((row: any) => 
          row.idUser === this.idUser && 
          Object.keys(this.warehouses).includes(row.idPermission.toString())
        ) : [];
    });
  }

  get columnDefs(): ColDef[] {
    return [
      {
        field: 'idUser',
        headerName: 'ID del Usuario',
        hide: true,
      },
      {
        field: 'idPermission',
        headerName: 'Tienda',
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: Object.keys(this.warehouses).sort((a, b) => this.warehouses[a].localeCompare(this.warehouses[b])),
        },
        valueFormatter: (params) => this.warehouses[params.value] || '',
        valueSetter: (params) => {
          const newValue = params.newValue;
          if (this.warehouses.hasOwnProperty(newValue)) {
            params.data[params.colDef.field] = newValue;
            return true;
          }
          return false;
        },
        valueParser: (params) => params.newValue,
        editable: true,
        flex: 2,
      },
    ];
  }

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    // Verificar si el campo modificado es 'id_company'
    if (event.colDef.field === 'id_company') {
      const selectedCompany = this.warehouses[event.data.id_company];
      if (selectedCompany) {
        event.data.company = selectedCompany;
      }

      // Forzar actualización de la celda de 'company'
      this.gridApi.refreshCells({
        rowNodes: [event.node],
        columns: ['company'],
        force: true,
      });
    }

    this.notSavedChanges = true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idUser: this.idUser,
      idPermission: 0,
      type: this.permissionType,
      active: 1,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) => item.idPermission);

    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe seleccionar una sucursal antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.usersxstoresService.addUserxPermission(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.usersxstoresService.updateUserxPermission(row.id, cleanedData);
    });

    // Using concat to combine observables and lastValueFrom for async/await
    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );
      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      this.obtenerDatos(); // Refrescar los datos
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  async deleteEntry() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Por favor, seleccione una entrada para eliminar.',
        'error'
      );
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;
    selectedData.active = 0;
    this.usersxstoresService.deleteUserxPermission(id).pipe(
      catchError((error) => {
        alerts.basicAlert(
          'Eliminar entrada',
          'Error al eliminar la entrada.',
          'error'
        );
        console.error(error);
        return EMPTY;
      })
    )
      .subscribe(
        () => {
          alerts.basicAlert(
            'Eliminar entrada',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );
          this.obtenerDatos();

          alerts.basicAlert(
            'Eliminar entrada',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );
          this.notSavedChanges = false;
          this.selectedRowData = null;
        }
      );
  }

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }
}
