import { Component, HostListener, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AgGridModule } from 'ag-grid-angular';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProvidersService } from 'app/services/providers.service';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';

@Component({
  selector: 'app-providers',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: '../oil-provider-project.html'
})
export class ProvidersComponent {

  private providersService = inject(ProvidersService);
  private imageHandlerService = inject(ImageHandlerService);

  ngOnInit() {
    this.obtenerDatos();
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  notSavedChanges: boolean = false;
  rowData: any[] = [];
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  id: string;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;

  obtenerDatos() {
    this.providersService
      .getProviders()
      .subscribe((data: any) => {
        this.rowData = data;
        // console.log(data)
      });
  }

  components = {
    autocompleteEditor: AutocompleteEditorComponent
  }

  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    rowClass: (params) => {
      // Verificar si la fila está seleccionada
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowClicked: (event) => {
      // Seleccionar la fila al hacer clic en cualquier celda
      event.node.setSelected(true);
    },
    onRowSelected: (event) => {
      // Deseleccionar otras filas cuando se selecciona una nueva
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
  };

  get columnDefs(): ColDef[] {
    return [
      {
        field: 'name',
        headerName: 'Nombre',
        editable: true,
        flex: 2,
        cellEditor: 'autocompleteEditor',
        cellEditorParams: {
          filterList: this.rowData.map(e => e.name),
          filterKey: 'name',
          placeholder: 'Nombre...',
          minLength: 1
        },
        valueSetter: (params) => {
          const duplicateExists = this.rowData.some((row, index) =>
            index !== params.node.rowIndex && row.name === params.newValue
          );

          if (duplicateExists) {
            alerts.basicAlert(
              'Código duplicado',
              'Ya existe una empresa con ese nombre.',
              'error'
            );
            return false;
          }

          params.data[params.colDef.field] = params.newValue;
          return true;
        }
      },
      {
        field: 'nameShort',
        headerName: 'Nombre Corto',
        editable: true,
        flex: 1,
        cellEditor: 'autocompleteEditor',
        cellEditorParams: {
          filterList: this.rowData.map(e => e.nameShort),
          filterKey: 'nameShort',
          placeholder: 'Nombre corto...',
          minLength: 1
        },
        valueSetter: (params) => {
          const duplicateExists = this.rowData.some((row, index) =>
            index !== params.node.rowIndex && row.nameShort === params.newValue
          );

          if (duplicateExists) {
            alerts.basicAlert(
              'Código duplicado',
              'Ya existe una empresa con ese nombre.',
              'error'
            );
            return false;
          }

          params.data[params.colDef.field] = params.newValue;
          return true;
        }
      },
      {
        field: 'rfc',
        headerName: 'RFC',
        editable: true,
        flex: 1,
        cellEditor: 'autocompleteEditor',
        cellEditorParams: {
          filterList: this.rowData.map(e => e.rfc),
          filterKey: 'rfc',
          placeholder: 'RFC...',
          minLength: 1
        },
        valueSetter: (params) => {
          const duplicateExists = this.rowData.some((row, index) =>
            index !== params.node.rowIndex && row.rfc === params.newValue
          );

          if (duplicateExists) {
            alerts.basicAlert(
              'Código duplicado',
              'Ya existe una empresa con ese RFC.',
              'error'
            );
            return false;
          }

          params.data[params.colDef.field] = params.newValue;
          return true;
        }
      },
      {
        field: 'address',
        headerName: 'Dirección',
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
        headerName: 'Pais',
        editable: true,
        flex: 1
      },
      {
        field: 'phone',
        headerName: 'Teléfono',
        editable: true,
        flex: 1
      },
      {
        field: 'picture',
        headerName: 'Foto',
        cellEditor: 'agTextCellEditor',
        cellRenderer: this.imageHandlerService.imageCellRenderer.bind(this.imageHandlerService),
        cellRendererParams: {
          clicked: this.imageHandlerService.onImageCellClicked.bind(this.imageHandlerService),
          field: 'picture'
        },
        editable: false,
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
      nameShort: '',
      address: '',
      stateId: null,
      phone: '',
      consortium: 'NO',
      picture: 'SIN FOTO',
      city: '',
      staste: '',
      country: 'MEXICO',
      active: 1,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;

    // Encontrar el índice de la nueva fila
    const newRowIndex = this.rowData.findIndex((row) => row.id === tempId);

    // Encontrar la primera columna editable
    const firstEditableCol = this.columnDefs.find(col => col.editable);
    const firstEditableColKey = firstEditableCol ? firstEditableCol.field : null;

    // Usar setTimeout para asegurar que el grid haya renderizado la nueva fila
    setTimeout(() => {
      if (firstEditableColKey) {
        this.gridApi.startEditingCell({
          rowIndex: newRowIndex,
          colKey: firstEditableColKey, // Editar la primera columna editable
        });
      }
    }, 50); // Un pequeño retraso de 50ms
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) => item.name && item.nameShort && item.rfc);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar todos los campos antes de guardar.',
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
      return this.providersService.addProvider(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.providersService.updateProvider(row.id, cleanedData);
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
    this.providersService.deleteProvider(id).pipe(
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
