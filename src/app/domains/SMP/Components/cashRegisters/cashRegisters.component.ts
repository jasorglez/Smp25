import { ChangeDetectionStrategy, Component , effect, HostListener, inject} from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { catchError, concat, EMPTY, lastValueFrom, toArray, tap } from 'rxjs';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import {
  CellDoubleClickedEvent, IFilterComp,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { InegiService } from 'app/services/inegi.service';
import { States } from 'app/interface/states';
import { BranchsService } from 'app/services/branchs.service';
import { CashRegistersService } from 'app/services/cash-registers.service';
import { StoresService } from 'app/services/stores.service';

@Component({
  selector: 'cashRegistersComponent',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './cashRegisters.component.html',
})
export class CashRegistersComponent { 
  store: any[] = [];
  idcompany: number = null;
  // esta es la data que se va a mostrar en el grid
  rowData: any[] = [];

  masterSelectedRowData: any = null;
  newlyAddedMasterRows: string[] = [];
  //masterNotSavedChanges: boolean = false;
  gridHeight: string = '85vh';
  id: number = null;
  branchs: any[] = [];
  idBranch: number;
  idUser: number = null;
  notSavedChanges: boolean = false;
  showLoansTab: boolean = false;
  selectedRowData: any = null;
  showSavingsTab: boolean = false;
  authorizedPass:boolean = false;
  private lastEditedRowId: number | string | null = null;
  newlyAddedRows: string[] = []; 

  private storeCatalog: string[] = [];
  private inegiService = inject(InegiService);
  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  private signalsService = inject(SignalsService);
  private branchesService = inject(BranchsService);
  private cashRegistersService = inject(CashRegistersService);
  private storesService = inject(StoresService);
  private isOpen: boolean = false; 

  components = {
      multiLineEditor: MultiLineEditorComponent,
      autocompleteEditor: AutocompleteEditorComponent,
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
      this.getStore();
      
    });
  }
  obtenerBranchs() {
    // alert('this.branchs'+ this.idBranch)
    this.branchesService.getBrancheswoa(this.idcompany).subscribe(
      (data: any) => {
        this.branchs = data;
        //console.log("Branchs",this.branchs)
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  obtenerDatos(){
    if(this.idUser == 42)
    {
        this.cashRegistersService.getCashRegisterAll().subscribe({
          next: (data: any) => {
            this.rowData = data;
            console.log(this.rowData)
          },
          error: (error) => {
            if (error.status === 404) this.store = [];
            console.error('Error fetching data:', error);
          }
        });
    }else{
      if(this.idBranch <= 0){ 
        this.idcompany= Math.abs(this.idcompany);
        this.cashRegistersService.getCashRegisterByCompany(this.idcompany).subscribe({
          next: (data: any) => {
            this.rowData = data;
            console.log(this.rowData)
          },
          error: (error) => {
            if (error.status === 404) this.store = [];
            console.error('Error fetching data:', error);
          }
        });
      }else{
      this.cashRegistersService.getCashRegisterByBranch(this.idBranch).subscribe({
        next: (data: any) => {
          this.rowData = data;
          //console.log(this.rowData)
        },
        error: (error) => {
          if (error.status === 404) this.store = [];
          console.error('Error fetching data:', error);
        }
      });}
    //}
    
  }
  /*@HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.masterNotSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }*/
  }

  getStore() {
      this.storesService.getStoreList(this.idBranch).subscribe({
        next: (data: any) => {
          this.storeCatalog = data.map((store: any) => store.description) || [];
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
  onMasterSelectionChanged(event: any) {
  }

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
      }
      else {
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
      }
      else {
        await this.resetGridSize();
        this.isOpen = false;
      }
    }
  
    async adjustGridSize() {
      this.gridHeight = '20vh'; // Adjust as needed
    }

  get colMaster(): ColDef[]{
    return [
      {
        field: 'nameSmall',
        headerName: 'Empresa',
        editable: false,
        width:100,
        hide: this.idUser != 42,
        rowGroup: this.idUser == 42,
        rowGroupIndex: 1,
      },
      {
        field: 'name',
        headerName: 'Sucursal',
        editable: false,
        width:100,
        hide: this.idBranch >= 0 || this.idUser != 42,
        rowGroup:  this.idBranch <= 0 || this.idUser == 42 ,
        rowGroupIndex: 2,
      },
      {
        field: 'description',
        headerName: 'Tienda',
        editable: true,
        width:200,
        rowGroup:  true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.storeCatalog,
        },
      },
      
      {
        field: 'descCashRegister',
        headerName: 'Numero de caja',
        editable: true,
        width: 250,
      },
    ]
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
    const newItem = {
      //id: tempId,
      idStore: 0,
      description: '',
      comment: '',
      active: true,
      __isNew: true,
    };
  
    this.rowData = [newItem, ...this.rowData];
    this.notSavedChanges = true;
  }



async saveMasterChanges() {
    console.log('El original', this.rowData);
    const isValid = this.rowData.every((item) => item.description);
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
      console.log('El modificado (para agregar)', cleanedData);
      return this.cashRegistersService.addCashRegister(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log('El modificado (para actualizar)', cleanedData);
      return this.cashRegistersService.updateCashRegister(row.id, cleanedData);
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
        alert(id)
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
              this.cashRegistersService
               .deleteCashRegister(id)
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
    

      revertMasterData() {
        this.obtenerDatos();
        this.notSavedChanges = false;
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

}
