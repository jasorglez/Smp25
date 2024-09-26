import { Component, computed, HostListener, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { UsersService } from 'app/services/users.service';
import { AgGridModule } from 'ag-grid-angular';
import { ContractsService } from 'app/services/contracts.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { UsersProfileComponent } from './users-profile.component';
import { catchError, concat, EMPTY, forkJoin, lastValueFrom, map, toArray } from 'rxjs';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';

@Component({
  selector: 'app-usersxcontracts',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, UsersProfileComponent],
  templateUrl: './usersxcontracts.component.html'
})
export class UsersxcontractsComponent {

  private usersService = inject(UsersService);
  private contractsService = inject(ContractsService);
  public usersxcontractsService = inject(UsersxpermissionsService);


  ngOnInit() {
    this.filteredData();
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
  idCompany = this.usersxcontractsService.idCompany();
  idUser: any = this.profile().idUser();
  companyChecked = computed(() => this.usersxcontractsService.companyChecked());

  notSavedChanges: boolean = false;
  rowData: any;
  contracts: { [key: string]: string } = {};
  contractsByIdProvider: any;
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  id: string;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  private permissionType: string = 'contract';

  obtenerDatos() {
    forkJoin({
      usersxcontracts: this.usersxcontractsService.getDataUsersxPermissions(this.permissionType),
      contracts: this.contractsService.getContracts(parseInt(localStorage.getItem('company')))
    }).pipe(
      map(({ usersxcontracts, contracts }) => {
        // Convertimos a array si no lo es
        const usersxcontractsArray = Array.isArray(usersxcontracts) ? usersxcontracts : Object.values(usersxcontracts);
        const contractsArray = Array.isArray(contracts) ? contracts : Object.values(contracts);

        return usersxcontractsArray.filter(uxc =>
          contractsArray.some(c => c.idContrato === uxc.idPermission)
        ).map(uxc => {
          const matchingContract = contractsArray.find(c => c.idContrato === uxc.idPermission);
          return {
            ...uxc,
            idProvider: matchingContract ? matchingContract.idProvider : null
          };
        });
      })
    ).subscribe(
      data => {
        this.rowData = [];
        if (this.companyChecked()() == true) {
          this.rowData = data.filter((row: any) => row.idUser === this.idUser && row.idProvider === this.idCompany);
        }
        else {
          this.rowData = data.filter((row: any) => row.idUser === this.idUser);
        }
      },
      error => {
        console.error('Error:', error);
      }
    );
  }

  obtenerContracts(contract: number) {
    if (this.companyChecked()() == true) {
      this.contractsService.getContractsByProvider(this.idCompany).subscribe((data: any[]) => {
        this.contracts = data.reduce((acc, dep) => {
          acc[dep.id] = dep.numberContract + ' - ' + dep.descripSmall; // Cambia la estructura para que solo almacene el nombre
          return acc;
        }, {});
      });
    }
    else {
      this.contractsService.getContracts(contract).subscribe((data: any[]) => {
        this.contracts = data.reduce((acc, dep) => {
          acc[dep.idContrato] = dep.numberContract + ' - ' + dep.descripSmall; // Cambia la estructura para que solo almacene el nombre
          return acc;
        }, {});
      });
    }
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
      this.filteredData(); // Refrescar los datos
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
    this.usersxcontractsService.deleteUserxPermission(id).pipe(
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
          this.filteredData();

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
    this.filteredData();
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

  // Obtiene los datos cada vez que se activa o no el checkbox
  onCheckboxChange(event: any) {
    this.usersxcontractsService.companyChecked().set(event.target.checked);
    this.filteredData();
  }

  // Este metodo obtiene los datos filtrados o no
  filteredData() {
    this.obtenerDatos();
    this.obtenerContracts(parseInt(localStorage.getItem('company')));
  }
}

