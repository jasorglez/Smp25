import { Component, effect, HostListener, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AgGridModule } from 'ag-grid-angular';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProvidersService } from 'app/services/providers.service';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { SignalsService } from 'app/services/signals.service';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';

@Component({
  selector: 'app-providers',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: '../oil-provider-project.html'
})
export class ProvidersComponent {

  private providersService = inject(ProvidersService);
  private imageHandlerService = inject(ImageHandlerService);
  private signalsService = inject(SignalsService);
  private incomesAndExpensesService = inject(IncomesAndExpensesService);


  ngOnInit() {
    this.obtenerDatos();
  }

  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.obtenerDatos();
    }
  )
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
  idRoot: number;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;

  private editableColumnOrder = ['name', 'nameShort', 'rfc', 'address', 'city', 'state', 'country', 'phone'];
  private enterPressed: boolean = false;

  public defaultColDef: ColDef = {
    suppressKeyboardEvent: (params) => {
      if (params.event.key === 'Enter' && params.editing) {
        this.enterPressed = true;
        setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
        return true;
      }
      return false;
    }
  };

  onCellEditingStopped(event: any) {
    if (!this.enterPressed) return;
    this.enterPressed = false;
    const currentIndex = this.editableColumnOrder.indexOf(event.column.getColId());
    if (currentIndex !== -1 && currentIndex < this.editableColumnOrder.length - 1) {
      setTimeout(() => {
        this.gridApi.startEditingCell({ rowIndex: event.rowIndex, colKey: this.editableColumnOrder[currentIndex + 1] });
      }, 100);
    }
  }

  obtenerDatos() {
    this.providersService
      .getProviders(this.idRoot)
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
    rowClassRules: {
      'new-row-highlight': (params: any) => !!params.data?.__isNew
    },
    getRowClass: (params) => {
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

  private _columnDefs: ColDef[] = [];

  get columnDefs(): ColDef[] {
    if (this._columnDefs.length > 0) {
      return this._columnDefs;
    }

    this._columnDefs = [
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
          minLength: 1,
          onEnterPressed: () => { this.enterPressed = true; }
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
          minLength: 1,
          onEnterPressed: () => { this.enterPressed = true; }
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
          minLength: 1,
          onEnterPressed: () => { this.enterPressed = true; }
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

    return this._columnDefs;
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
    const providerName = selectedData.name || selectedData.nameShort || 'este proveedor';

    // Preguntar confirmación antes de eliminar
    const result = await alerts.confirmAlert(
      '¿Eliminar proveedor?',
      `¿Está seguro que desea eliminar a "${providerName}"?`,
      'warning',
      'Sí, eliminar'
    );

    if (!result.isConfirmed) {
      return;
    }

    const id = selectedData.id;

    // Verificar si el proveedor está siendo usado en egresos
    try {
      const incomesAndExpenses = await lastValueFrom(
        this.incomesAndExpensesService.getIncomesAndExpenses(this.idRoot)
      );

      const isBeingUsed = incomesAndExpenses?.some(
        (record: any) => record.idCustomer === id && record.active !== false
      );

      if (isBeingUsed) {
        alerts.basicAlert(
          'No se puede eliminar',
          'Este proveedor está siendo utilizado en registros de egresos. Debe eliminar o modificar esos registros primero.',
          'error'
        );
        return;
      }
    } catch (error) {
      console.error('Error verificando uso del proveedor:', error);
    }

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
