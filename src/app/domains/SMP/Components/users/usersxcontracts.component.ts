import { Component, computed, HostListener, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { UsersService } from 'app/services/users.service';
import { AgGridModule } from 'ag-grid-angular';
import { ContractsService } from 'app/services/contracts.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { UsersProfileComponent } from './users-profile/users-profile.component';
import { concat, lastValueFrom, toArray } from 'rxjs';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';

@Component({
  selector: 'app-usersxcontracts',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, UsersProfileComponent],
  templateUrl: './usersxpermissions.component.html'
})
export class UsersxcontractsComponent {

  private usersService = inject(UsersService);
  private contractsService = inject(ContractsService);
  private usersxcontractsService = inject(UsersxpermissionsService);

  ngOnInit() {
    this.obtenerDatos();
    this.obtenerContracts();
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  // Signals con correo
  profile = computed(() => this.usersService.profile);
  idUser: any = this.profile().idUser();

  notSavedChanges: boolean = false;
  rowData: any;
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  id: string;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  private permissionType: string = 'contract';

  obtenerDatos() {
    this.usersxcontractsService
      .getDataUsersxPermissions(this.permissionType)
      .subscribe((data: any) => {
        this.rowData = data.filter((row: any) => row.idUser === this.idUser);
      });
  }

  obtenerContracts() {
    this.contractsService.getContracts().subscribe((data: any[]) => {
      this.contracts = data.reduce((acc, dep) => {
        acc[dep.id] = dep.descripSmall; // Cambia la estructura para que solo almacene el nombre
        return acc;
      }, {});
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
        headerName: 'Contrato',
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: Object.keys(this.contracts).sort((a, b) => this.contracts[a].localeCompare(this.contracts[b])),
        },
        valueFormatter: (params) => this.contracts[params.value] || '',
        valueSetter: (params) => {
          const newValue = params.newValue;
          if (this.contracts.hasOwnProperty(newValue)) {
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
      const selectedCompany = this.contracts[event.data.id_company];
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
        'Debe seleccionar una compañía antes de guardar.',
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
      return this.usersxcontractsService.addUserxPermission(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.usersxcontractsService.updateUserxPermission(row.id, cleanedData);
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
    try {
      const selectedNodes = this.gridApi.getSelectedNodes();
      if (selectedNodes.length === 0) {
        alerts.basicAlert(
          'Eliminar entrada',
          'Por favor, seleccione una entrada para eliminar.',
          'warning'
        );
        return;
      }

      const selectedData = selectedNodes[0].data;
      const id = selectedData.id;
      selectedData.active = 0;

      // Elimina la entrada de la DB
      try {
        await this.usersxcontractsService.deleteUserxPermission(id, selectedData).toPromise();
      } catch (err) {
        console.error(err);
      }

      // Refrescar los datos después de eliminar
      this.obtenerDatos();

      alerts.basicAlert(
        'Eliminar entrada',
        'Entrada eliminada satisfactoriamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.selectedRowData = null;
    } catch (error) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Error al eliminar la entrada.',
        'error'
      );
    }
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
