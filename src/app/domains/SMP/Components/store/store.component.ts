import {
  ChangeDetectionStrategy,
  Component,
  effect,
  HostListener,
  inject,
} from '@angular/core';
import { StoresService } from 'app/services/stores.service';
import { SignalsService } from 'app/services/signals.service';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { catchError, concat, EMPTY, lastValueFrom, toArray, tap } from 'rxjs';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import {
  CellDoubleClickedEvent,
  IFilterComp,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { InegiService } from 'app/services/inegi.service';
import { States } from 'app/interface/states';
import { BranchsService } from 'app/services/branchs.service';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';

@Component({
  selector: 'storeComponent',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './store.component.html',
})
export class StoreComponent implements CanComponentDeactivate {
  store: any[] = [];
  idcompany: number = null;
  rowData: any[] = [];
  masterSelectedRowData: any = null;
  newlyAddedMasterRows: string[] = [];
  gridHeight: string = '85vh';
  id: number = null;
  branchs: any[] = [];
  idBranch: number;
  idUser: number = null;
  notSavedChanges: boolean = false;
  showLoansTab: boolean = false;
  selectedRowData: any = null;
  showSavingsTab: boolean = false;
  authorizedPass: boolean = false;
  private lastEditedRowId: number | string | null = null;
  newlyAddedRows: string[] = [];

  private estados: string[] = [];
  private inegiService = inject(InegiService);
  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  private signalsService = inject(SignalsService);
  private storesService = inject(StoresService);
  private branchesService = inject(BranchsService);
  private isOpen: boolean = false;

  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent,
  };

  public defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: true,
    lockPosition: false,
    enableRowGroup: true, // Enable row grouping for all columns
    flex: 1,
  };
  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  constructor() {
    effect(() => {
      this.idUser = this.signalsService.getIdUSer()();
      this.idcompany = this.signalsService.getRootSelectedBySidebar()();
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.obtenerBranchs();
      this.obtenerDatos();
      this.getStates();
    });
  }
  obtenerBranchs() {
    if (this.idUser === 42) {
      this.branchesService.getAllBranches().subscribe(
        (data: any) => {
          this.branchs = data;
          console.log('All Branchs', this.branchs);
        },
        (error) => console.error('Error fetching data:', error)
      );
    } else {
      this.branchesService.getBrancheswoa(this.idcompany).subscribe(
        (data: any) => {
          this.branchs = data;
          console.log('Branchs', this.branchs);
        },
        (error) => console.error('Error fetching data:', error)
      );
    }
  }

  obtenerDatos() {
    if (this.idUser == 42) {
      return this.storeByRoot();
    }
    if (this.idBranch <= 0) {
      return this.storeByCompany();
    }
    return this.storeByBranch();
  }
  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }
  storeByRoot() {
    this.storesService.getStoreAll().subscribe({
      next: (data: any) => {
        this.rowData = data;
        console.log(this.rowData);
      },
      error: (error) => {
        if (error.status === 404) this.store = [];
        console.error('Error fetching data:', error);
      },
    });
  }

  storeByCompany() {
    this.idcompany = Math.abs(this.idcompany);
    this.storesService.getStoreCompany(this.idcompany).subscribe({
      next: (data: any) => {
        this.rowData = data;
        console.log(this.rowData);
      },
      error: (error) => {
        if (error.status === 404) this.store = [];
        console.error('Error fetching data:', error);
      },
    });
  }
  storeByBranch() {
    this.storesService.getStoreList(this.idBranch).subscribe({
      next: (data: any) => {
        this.rowData = data;
        console.log(this.rowData);
      },
      error: (error) => {
        if (error.status === 404) this.store = [];
        console.error('Error fetching data:', error);
      },
    });
  }

  getStates() {
    this.inegiService.getEstados().subscribe({
      next: (data: { datos: States[] }) => {
        console.log(data);
        this.estados = data.datos.map((estado) => estado.nom_agee);
        this.estados.unshift('Sin estado');
      },
      error: (error) => {
        console.error('Error fetching states', error);
      },
    });
  }
  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    groupDefaultExpanded: -1, // -1 significa expandir todos los niveles
    suppressDragLeaveHidesColumns: true,
    suppressMakeColumnVisibleAfterUnGroup: true,
    rowBuffer: 20,
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
    onCellKeyDown: (params) => {
      if (params.event.key === 'Enter') {
        // Obtener todas las columnas editables
        const editableColumns = this.colMaster.filter((col) => col.editable);
        const currentColIndex = editableColumns.findIndex(
          (col) => col.field === params.column.getColDef().field
        );

        if (currentColIndex < editableColumns.length - 1) {
          // Añadir delay de 50ms antes de mover el foco
          requestAnimationFrame(() => {
            // Mover a la siguiente columna editable
            params.api.startEditingCell({
              rowIndex: params.node.rowIndex,
              colKey: editableColumns[currentColIndex + 1].field,
            });
          }); // Retraso para permitir que termine la edición actual
        }
        params.event.preventDefault(); // Prevenir comportamiento por defecto
      }
    },
    onCellDoubleClicked: this.onCellDoubleClicked.bind(this),
  };
  onMasterSelectionChanged(event: any) { }

  onMasterCellValueChanged(event: any) {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onMasterGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onMasterRowSelected(event: any) {
    this.id = event.data.id;
  }

  async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
    const colId = event.column.getColId();
    const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
    const selectedId = selectedRowData.id; // Obtener el ID del registro

    this.notSavedChanges = true;

    if (colId === 'loan' || colId === 'saving') {
      // Filtrar el grid para mostrar solo el registro con el ID seleccionado
      const filterModel = {
        id: {
          type: 'equals',
          filter: selectedId,
        },
      };

      this.gridApi.setFilterModel(filterModel);
      this.gridApi.onFilterChanged();
    }

    if (colId === 'loan') {
      await this.activateLoansTab();
    }

    if (colId === 'saving') {
      await this.activateSavingsTab();
    }

    // Puedes agregar lógica adicional aquí si necesitas guardar los datos seleccionados
    this.selectedRowData = selectedRowData;
  }
  async activateLoansTab() {
    if (!this.isOpen || this.showSavingsTab) {
      await this.adjustGridSize();
      this.showLoansTab = true;
      this.showSavingsTab = false;
      this.isOpen = true;
    } else {
      await this.resetGridSize();
      this.isOpen = false;
    }
  }

  async activateSavingsTab() {
    if (!this.isOpen || this.showLoansTab) {
      await this.adjustGridSize();
      this.showLoansTab = false;
      this.showSavingsTab = true;
      this.isOpen = true;
    } else {
      await this.resetGridSize();
      this.isOpen = false;
    }
  }

  async adjustGridSize() {
    this.gridHeight = '20vh'; // Adjust as needed
  }

  get colMaster(): ColDef[] {
    return [
      {
        field: 'companyName',
        headerName: 'Empresa',
        editable: false,
        //showRowGroup: true,
        width: 100,
        hide: this.idUser != 42,
        rowGroup: this.idUser == 42,
        rowGroupIndex: 1,
      },
      /*       {
              field: 'idBranch',
              headerName: 'Sucursal',
              editable: false,
              width: 100,
              hide: this.idBranch >= 0 || this.idUser != 42 ? true: false,
              rowGroup: this.idBranch <= 0 || this.idUser == 42,
              valueFormatter: (params) => {
                const branch = this.branchs?.find((item) => item.id === params.value);
                return branch ? branch.name : '';
              },
            }, */
      {
        field: 'idBranch',
        headerName: 'Sucursal',
        editable: true,
        width: 150,
        hide: this.idBranch >= 0,
        rowGroup: this.idBranch <= 0 || this.idUser == 42,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.branchs
            ? this.branchs.map((item) => item.id)  // <--- usar ID aquí
            : [],
        },
        valueFormatter: (params) => {
          const branch = this.branchs?.find(item => item.id === params.value);
          return branch ? branch.name : '';
        },
      },
      {
        field: 'description',
        headerName: 'Tienda',
        editable: true,
        width: 250,
      },
      {
        field: 'address',
        headerName: 'Direccion',
        editable: true,
        width: 250,
      },
      {
        field: 'city',
        headerName: 'Municipio',
        editable: true,
        width: 250,
      },
      {
        field: 'state',
        headerName: 'Estado',
        editable: true,
        width: 250,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.estados,
        },
      },
      {
        field: 'cp',
        headerName: 'Codigo Postal',
        editable: true,
        width: 250,
      },
      {
        field: 'phone',
        headerName: 'Telefono',
        editable: true,
        width: 250,
      },
      {
        field: 'active',
        headerName: 'Valiado',
        editable: true,
        width: 250,
      },
    ];
  }

  resetGridSize() {
    this.gridHeight = '80vh'; // Reset to default height
    this.showLoansTab = false;
    this.showSavingsTab = false;
    if (this.gridApi) {
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
    }
  }

  addMasterRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const selectedNodes = this.gridApi.getSelectedNodes();
    let selectedCompany = null;
    let selectedBranch = null;

    // Verificar si hay un nodo seleccionado
    if (selectedNodes.length > 0) {
      const selectedNode = selectedNodes[0];
      if (selectedNode.group) {
        // Si es un grupo, obtener sus datos
        selectedCompany = selectedNode.key;
        const groupData = this.rowData.find(row => row.companyName === selectedCompany);
        if (groupData) {
          selectedBranch = groupData.idBranch;
        }
      } else {
        // Si es una fila individual, obtener sus datos
        const selectedData = selectedNode.data;
        if (selectedData) {
          selectedCompany = selectedData.companyName;
          selectedBranch = selectedData.idBranch;
        }
      }
    }

    const newItem = {
      id: tempId,
      idBranch: this.idUser === 42
        ? selectedBranch || this.rowData[0]?.idBranch
        : this.idBranch,
      companyName: this.idUser === 42
        ? selectedCompany || this.rowData[0]?.companyName || ''
        : this.rowData[0]?.companyName || '',
      description: '',
      address: '',
      city: '',
      state: '',
      cp: '',
      phone: '',
      active: true,
      __isNew: true,
    };

    // Actualizar el estado
    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;

    // Forzar la actualización de la cuadrícula y seleccionar la nueva fila
    this.gridApi.setGridOption('rowData', this.rowData);
    setTimeout(() => {
      const firstRowIndex = 0;
      this.gridApi.ensureIndexVisible(firstRowIndex);
      this.gridApi.startEditingCell({
        rowIndex: firstRowIndex,
        colKey: 'description'
      });
    }, 0);

    // Asegurarnos de que la fila nueva esté seleccionada
    requestAnimationFrame(() => {
      const rowNode = this.gridApi.getRowNode(tempId);
      if (rowNode) {
        rowNode.setSelected(true);
        this.selectedRowData = newItem;
      }
    });
  }
  async saveMasterChanges() {
    const isValid = this.rowData.every(
      (item) => item.description && item.address && item.state
    );
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar los campos obligatorios antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables: Promise<any>[] = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log(cleanedData);
      return lastValueFrom(this.storesService.addStore(cleanedData));
    });

    const updateObservables: Promise<any>[] = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return lastValueFrom(this.storesService.updateStore(row.id, cleanedData));
    });

    try {
      const allResponses = await Promise.all([
        ...addObservables,
        ...updateObservables,
      ]);

      //console.log('Promise.all completado. Respuestas:', allResponses);
      for (const response of allResponses) {
        // Verificar si es una nueva creación comparando con los IDs temporales
        const correspondingNewRow = newRows.find(
          (row) => !row.id || row.id.toString().startsWith('temp_')
        );

        if (response.id && correspondingNewRow) {
          //console.log(response)

          try {
            await lastValueFrom(
              this.branchesService.assignPermissionAfterCreation(
                this.idUser, //id user
                response.id,
                'store'
              )
            );
          } catch (permError) {
            console.error('Error asignando permiso:', permError);
            // Opcional: Mostrar alerta pero no interrumpir el flujo principal
            alerts.basicAlert(
              'Advertencia',
              'Se creó la sucursal pero hubo un problema asignando los permisos.',
              'warning'
            );
          }
        }
      }
      // Determinar qué ID vamos a seleccionar después de recargar
      if (modifiedRows.length > 0) {
        // Si hay filas modificadas, guardamos el ID de la última modificada
        this.lastEditedRowId = modifiedRows[modifiedRows.length - 1].id;
      } else if (newRows.length > 0) {
        // Si hay filas nuevas, marcaremos que necesitamos seleccionar el ID máximo
        this.lastEditedRowId = 'SELECT_MAX_ID';
      }

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.newlyAddedRows = [];

      await this.obtenerDatos(); // Esperar a que se actualicen los datos

      // Seleccionar la fila apropiada después de recargar
      if (this.lastEditedRowId) {
        if (this.lastEditedRowId === 'SELECT_MAX_ID') {
          // Encontrar el ID máximo en los datos actuales
          const maxId = Math.max(...this.rowData.map((row) => Number(row.id)));
          this.selectRowById(maxId);
        } else {
          this.selectRowById(this.lastEditedRowId);
        }
        this.lastEditedRowId = null; // Resetear el ID
      }
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  deleteMasterEntry() {
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
    console.log('Datos del empleado a eliminar:', selectedData);

    // Validar que el préstamo sea 0 o no exista
    if (selectedData.loan && selectedData.loan !== 0) {
      alerts.basicAlert(
        'Error al eliminar',
        'No se puede eliminar el empleado mientras tenga préstamos activos',
        'error'
      );
      return;
    }

    const id = selectedData.id;
    selectedData.active = 0;
    alerts
      .confirmAlert(
        'Eliminar Tienda',
        '¿Está seguro que desea eliminar esta tienda?',
        'warning',
        'Sí, eliminar'
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.storesService
            .deleteStore(id)
            .pipe(
              catchError((error) => {
                alerts.basicAlert(
                  'Eliminar tienda',
                  'Error al eliminar la tienda.',
                  'error'
                );
                console.error(error);
                return EMPTY;
              })
            )
            .subscribe(() => {
              alerts.basicAlert(
                'Tienda eliminada',
                'La tienda se eliminó correctamente',
                'success'
              );
              this.obtenerDatos();
              this.notSavedChanges = false;
              this.selectedRowData = null;
            });
        }
      });
  }

  revertMasterData() {
    this.obtenerDatos();
    this.notSavedChanges = false;
  }
  private selectRowById(id: number | string) {
    // Dar tiempo al grid para que se actualice
    setTimeout(() => {
      this.gridApi.forEachNode((node) => {
        // Convertir ambos IDs a número para la comparación
        const nodeId =
          typeof node.data.id === 'string'
            ? parseInt(node.data.id)
            : node.data.id;
        const searchId = typeof id === 'string' ? parseInt(id) : id;

        if (nodeId === searchId) {
          node.setSelected(true);
          this.gridApi.ensureNodeVisible(node, 'middle');
        }
      });
    }, 100);
  }

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.notSavedChanges);
  }
}
