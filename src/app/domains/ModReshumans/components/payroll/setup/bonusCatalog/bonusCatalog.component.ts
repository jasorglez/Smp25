import { ChangeDetectionStrategy, Component, inject, ChangeDetectorRef} from '@angular/core';
import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { alerts } from 'app/helpers/alerts';
import { SignalsService } from 'app/services/signals.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { retry } from 'rxjs';
import { catchError, concat, EMPTY, lastValueFrom, toArray, tap } from 'rxjs';

@Component({
  selector: 'app-bonus-catalog',
  standalone: true,
  imports: [CommonModule,AgGridModule],
  templateUrl: './bonusCatalog.component.html',
})
export class BonusCatalogComponent { 
  private signalsService = inject(SignalsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private catalogsService = inject(CatalogsService);
  private gridApi: GridApi;
  idBranch: number;
  rowData: any;
  tempIdCounter: number = 0;
  notSavedChanges: boolean = false;
  gridHeight: string = '80vh';
  showLoansTab: boolean = false;
  showSavingsTab: boolean = false;
  selectedRowData: any = null;
  private isOpen: boolean = false;
  newlyAddedRows: string[] = [];
  id: number;
  // Agregar esta nueva variable para almacenar el ID de la última fila editada
  private lastEditedRowId: number | string | null = null;

  components = {
      multiLineEditor: MultiLineEditorComponent,
      autocompleteEditor: AutocompleteEditorComponent,
    };

  ngOnInit() {
    this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
    this.obtenerDatos();
  }
  
  obtenerDatos() {
    this.catalogsService.getCatalogs(this.idBranch, "BONUS").subscribe({
      next: (data: any[]) => {
        const nuevoArray = data.map((item) => {
          return {
            ...item,
            valueAddition2: item.valueAddition2 === "true"
          };
        });
  
        this.rowData = nuevoArray;
      },
      error: () => {
        this.rowData = [];
        console.error("Error al obtener datos del catálogo BONUS.");
      }
    });
  }
  onMasterSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    this.selectedRowData = selectedNodes[0].data;

  /*if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
      this.idEmployee = this.selectedRowData.id;


      this.signalsService.setIdEmployee(this.idEmployee);
    } else {
      this.selectedRowData = null;
    }*/
  }

  onMasterCellValueChanged(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;
    
  }

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    rowBuffer: 20,
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
  async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
    const colId = event.column.getColId();
    const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
    const selectedId = selectedRowData.id; // Obtener el ID del registro

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
  
    this.cdr.detectChanges();}
  async activateSavingsTab() {
    if (!this.isOpen || this.showLoansTab) {
      await this.adjustGridSize();
      this.showLoansTab = false;
      this.showSavingsTab = true;
      this.isOpen = true;
    }
    else {
      await this.resetGridSize();
      this.isOpen = false;
    }
  
    this.cdr.detectChanges();}

  async activateLoansTab() {
    if (!this.isOpen || this.showSavingsTab) {
      await this.adjustGridSize();
      this.showLoansTab = true;
      this.showSavingsTab = false;
      this.isOpen = true;
    }
    else {
      await this.resetGridSize();
      this.isOpen = false;
    }
  
    this.cdr.detectChanges();}
  async adjustGridSize() {
    this.gridHeight = '20vh'; // Adjust as needed
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
  onMasterRowSelected(event: any) {
    this.id = event.data.id;
  }
  onMasterGridReady(params: GridReadyEvent) {
      this.gridApi = params.api;
    }
  


  get colMaster(): ColDef[] {
    return[
    {
      field: 'id',
      headerName: 'Id',
      editable: true,
      filter: true,
      width: 100,
    },
    {
      field: 'description',
      headerName: 'Descripcion',
      editable: true,
      filter: true,
      width: 200,
    },
    {
      field: 'valueAddition',
      headerName: 'Costo',
      editable: true,
      filter: true,
      width: 150,
    },
    {
      field: 'valueAddition2',
      headerName: 'Validacion',
      editable: true,
      filter: true,
      width: 100,
    }
  ]}

  addRow(){
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      description: '',
      valueAddition: '',
      valueAddition2: true  
    }
    this.rowData = [newItem, ...this.rowData];
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

  private selectRowById(id: number | string) {
    // Dar tiempo al grid para que se actualice
    setTimeout(() => {
      this.gridApi.forEachNode((node) => {
        // Convertir ambos IDs a número para la comparación
        const nodeId = typeof node.data.id === 'string' ? parseInt(node.data.id) : node.data.id;
        const searchId = typeof id === 'string' ? parseInt(id) : id;

        if (nodeId === searchId) {
          node.setSelected(true);
          this.gridApi.ensureNodeVisible(node, 'middle');
        }
      });
    }, 100);
  }
  async saveChanges(){
    const isValid = this.rowData.every((item) => item.description && item.valueAddition);
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
    
        const addObservables = newRows.map((row) => {
          const cleanedData = this.cleanDataForServer(row);
          cleanedData.valueAddition2 = String(cleanedData.valueAddition2);
          return this.catalogsService.addCatalog(cleanedData);
        });
        
        const updateObservables = modifiedRows.map((row) => {
          const cleanedData = this.cleanDataForServer(row);
          cleanedData.valueAddition2 = String(cleanedData.valueAddition2);
          return this.catalogsService.updateCatalog(row.id, cleanedData);
        });
        
    
        try {
          const responses = await lastValueFrom(
            concat(
              ...addObservables,
              ...updateObservables
            ).pipe(toArray())
          );
    
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
              const maxId = Math.max(...this.rowData.map(row => Number(row.id)));
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
  
    this.cdr.detectChanges();}

  revert(){
    this.obtenerDatos();
    this.notSavedChanges = false;
  }
  deleteEntry(){
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
        'Eliminar empleado',
        '¿Está seguro que desea eliminar este empleado?',
        'warning',
        'Sí, eliminar'
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.catalogsService.deleteCatalog(id)
            .pipe(
              catchError((error) => {
                alerts.basicAlert(
                  'Eliminar empleado',
                  'Error al eliminar el empleado.',
                  'error'
                );
                console.error(error);
                return EMPTY;
              })
            )
            .subscribe(() => {
              alerts.basicAlert(
                'Empleado eliminado',
                'El empleado se eliminó correctamente',
                'success'
              );
              this.obtenerDatos();
              this.notSavedChanges = false;
              this.selectedRowData = null;
            });
        }
      });
  }
}
