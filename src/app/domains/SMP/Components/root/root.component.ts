import { Component, HostListener, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AgGridModule } from 'ag-grid-angular';
import { ContractsService } from 'app/services/contracts.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RootService } from 'app/services/root.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: '../oil-provider-root-project.html'
})
export class RootComponent {

  
  private rootService = inject(RootService);
  private contractsService = inject(ContractsService);

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

  notSavedChanges: boolean = false;
  rowData: any;
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  id: string;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;

  obtenerDatos() {
    this.rootService
      .getRoot()
      .subscribe((data: any) => {
        this.rowData = data;
        console.log(data)
      });
  }

  obtenerContracts() {

  }

  get columnDefs(): ColDef[] {
    return [
      {
        field: 'name',
        headerName: 'Nombre',
        editable: true,
        flex: 2
      },
      {
        field: 'nameSmall',
        headerName: 'Nombre Corto',
        editable: true,
        flex: 1
      },
      {
        field: 'email',
        headerName: 'Email',
        cellEditor: 'agTextCellEditor',
        editable: true,
        // editable: (params) => params.data.__isNew,
        cellEditorParams: {
          useFormatter: true,
        },
        valueFormatter: (params) => params.value,
        valueSetter: (params) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailRegex.test(params.newValue)) {
            // Verificar si el email ya existe
            const duplicateExists = this.rowData.some((row, index) =>
              index !== params.node.rowIndex && row.email === params.newValue
            );

            if (duplicateExists) {
              alerts.basicAlert(
                'Añadir usuario',
                'Ya existe un usuario con ese correo electrónico.',
                'error'
              );
              return false;
            }

            params.data[params.colDef.field] = params.newValue;
            return true;
          } else {
            alerts.basicAlert(
              'Editar usuario',
              'Correo electrónico no válido.',
              'error'
            );
            return false;
          }
        },
        filter: true
      },
      {
        field: 'phone',
        headerName: 'Teléfono',
        editable: true,
        flex: 1
      },
      {
        field: 'city',
        headerName: 'Ciudad',
        editable: true,
        flex: 1
      },
      {
        field: 'state',
        headerName: 'Estado',
        editable: true,
        flex: 1
      },
      {
        field: 'country',
        headerName: 'País',
        editable: true,
        flex: 1
      },
      {
        field: 'picture',
        headerName: 'Foto Root',
        cellEditor: 'agTextCellEditor',
        cellRenderer: (params: any) => {
          if (params.value) {
            return `<img src="${params.value}" class="text-center" style="height:100%;">`;
          } else {
            return '';
          }
        },
        flex: 1,
        editable: true,
      },
      {
        field: 'picture2',
        headerName: 'Header',
        cellEditor: 'agTextCellEditor',
        cellRenderer: (params: any) => {
          if (params.value) {
            return `<img src="${params.value}" class="text-center" style="height:100%;">`;
          } else {
            return '';
          }
        },
        flex: 1,
        editable: true,
      },
      {
        field: 'picture3',
        headerName: 'Footer',
        cellEditor: 'agTextCellEditor',
        cellRenderer: (params: any) => {
          if (params.value) {
            return `<img src="${params.value}" class="text-center" style="height:100%;">`;
          } else {
            return '';
          }
        },
        flex: 1,
        editable: true,
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
    this.notSavedChanges = true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      name: '',
      nameSmall: '',
      picture: '',
      picture2: '',
      picture3: '',
      phone: '',
      consortium: 'NO',
      formatRep: '',
      city: '',
      state: '',
      country: '',
      active: 1,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) => item.name && item.nameSmall);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar los campos Nombre y Nombre Corto antes de guardar.',
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

      return this.rootService.addRoot(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);      console.log('Datos enviados a addRoot:', cleanedData); 
      return this.rootService.updateRoot(row.id, cleanedData);
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
    this.rootService.deleteRoot(id).pipe(
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
