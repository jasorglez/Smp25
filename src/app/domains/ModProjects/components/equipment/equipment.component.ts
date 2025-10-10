import {
  ChangeDetectionStrategy,
  Component,
  effect,
  HostListener,
  inject,
} from '@angular/core';
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
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { TrackingService } from 'app/services/tracking.service';
import { EquipmentService } from 'app/services/equipment.service';
import { CatalogsService } from 'app/services/catalogs.service';

@Component({
  selector: 'storeComponent',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './equipment.component.html',
})
export class EquipmentComponent implements CanComponentDeactivate {
  idcompany: number = null;
  rowData: any[] = [];
  masterSelectedRowData: any = null;
  newlyAddedMasterRows: string[] = [];
  gridHeight: string = '85vh';
  id: number = null;
  idBranch: number;
  idUser: number = null;
  notSavedChanges: boolean = false;
  showLoansTab: boolean = false;
  selectedRowData: any = null;
  showSavingsTab: boolean = false;
  authorizedPass: boolean = false;
  private lastEditedRowId: number | string | null = null;
  newlyAddedRows: string[] = [];
  typeEquipmentCatalog: any[] = [];


  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private catalogsService = inject(CatalogsService);
  private equipmentService = inject(EquipmentService);
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
    
    // Eliminar siempre estos campos internos
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    
    // Eliminar SIEMPRE el ID para updates (el servidor no lo necesita)
    
    // Mapear campos requeridos por el servidor
    if (cleanedData.articulo) {
      cleanedData.material = cleanedData.articulo;
    } else if (cleanedData.insumo) {
      cleanedData.material = cleanedData.insumo;
    } else {
      cleanedData.material = cleanedData.description || '';
    }
    
    
    // Eliminar campos que no acepta el servidor
    delete cleanedData.idBranch;
    delete cleanedData.idCustomer;
    delete cleanedData.pricePresentations;
    delete cleanedData.barcode; // Eliminar el campo duplicado incorrecto
    
    console.log('Datos limpiados para servidor:', cleanedData);
    return cleanedData;
  }

  constructor() {
    effect(() => {
      this.idUser = this.signalsService.getIdUSer()();
      this.idcompany = this.signalsService.getRootSelectedBySidebar()();
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.obtenerDatos();
      this.obtenerUnidades();
    });
  }
  obtenerDatos(){
    return this.equipmentService.getEquipment(this.idcompany).subscribe(
      (data: any) => {
        this.rowData = data;
        console.log(this.rowData)
      },
      (error) => console.error('Error fetching data:', error)
    );
  
  }

  obtenerUnidades(){
    return this.catalogsService.getTypeEquipment(this.idcompany).subscribe(
      (data: any) => {
        this.typeEquipmentCatalog = data;
        console.log(this.typeEquipmentCatalog)
      },
      (error) => console.error('Error fetching data:', error)
    );
  
  }
  

 
  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    groupDefaultExpanded: -1, // -1 significa expandir todos los niveles
    suppressDragLeaveHidesColumns: true,
    suppressMakeColumnVisibleAfterUnGroup: true,
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
  onMasterSelectionChanged(event: any) {}

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
        field: 'description',
        headerName: 'Descripción',
        editable: true,
        width: 250,
      },
      /*{
        field: 'date',
        headerName: 'Fecha',
        editable: true,
        filter: 'agDateColumnFilter',
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
        width: 150,
        cellRenderer: 'agDateCellRenderer',
        cellEditor: 'agDateCellEditor',
        valueGetter: (params) => {
          // Si no hay fecha, usar fecha actual
          if (!params.data.date) {
            return new Date().toISOString();
          }
          return params.data.date;
        },
        valueSetter: (params) => {
          if (!params.newValue) {
            params.data.date = new Date().toISOString();
            return true;
          }
        
          let date;
          // Si viene en formato "2025-07-29T00:00:00" del agDateCellEditor
          console.log('Valor recibido en valueSetter:', params.newValue);
          if (typeof params.newValue === 'string' && params.newValue.includes('T') && !params.newValue.includes('Z')) {
            // Agregar 'Z' para que sea UTC y crear la fecha
            date = new Date(params.newValue + 'Z');
          } else {
            date = new Date(params.newValue);
          }
          
          if (isNaN(date.getTime())) {
            alerts.basicAlert('Error', 'Fecha inválida', 'error');
            return false;
          } 
        
          // Asegurar que la fecha se guarde en el formato ISO correcto
          params.data.date = date.toISOString();
          // Marcar como modificado para que se incluya en el save
          params.data.__modified = true;
          return true;
        },
        valueFormatter: (params) => {
          try {
            // Si no hay valor, usar fecha actual
            const dateValue = params.value || new Date().toISOString();
            const date = new Date(dateValue);
            if (isNaN(date.getTime())) return '';
            return `${('0' + date.getDate()).slice(-2)}-${('0' + (date.getMonth() + 1)).slice(-2)}-${date.getFullYear()}`;
          } catch {
            return '';
          }
        },


      },*/
      {
      field: 'idTypeEquipment',
      headerName: 'Tipo de equipo',
      editable: true,
      width: 250,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: this.typeEquipmentCatalog ? this.typeEquipmentCatalog.map((item) => item.id) : [],
      },
      valueFormatter: (params) => {
        const foundItem = this.typeEquipmentCatalog?.find(item => item.id === params.value);
        return foundItem ? foundItem.description : params.value;
      },
    
      // Este valor es el que edita la celda (id)
      valueGetter: (params) => {
        return params.data?.idTypeEquipment ?? ''; // id_medida es el valor real
      },
    
      // Cuando el usuario selecciona un description, lo convertimos a id
      valueParser: (params) => {
        const foundItem = this.typeEquipmentCatalog?.find(item => item.description === params.newValue);
        return foundItem ? foundItem.id : params.newValue;
      }
    },
    {
        field: 'print',
        headerName: 'Imprimir en ot',
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
    const newItem = {
      id: tempId,
      idCompany: this.idcompany,
      description: '',
      //date: new Date().toISOString(), // Formato completo DateTime
      aplicaResg: false,
      costoMN: 0.00,
      costoDLL: 0.00,
      ventaMN: 0.00,
      ventaDLL: 0.00,
      stockMin: 0,
      stockMax: 0,
      print: true,
      typeMaterial: 'CONSUMABLE',
      vigente: true,
      active: true,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    setTimeout(() => {
      const firstRowIndex = 0;

      this.gridApi.ensureIndexVisible(firstRowIndex);

      this.gridApi.startEditingCell({
        rowIndex: firstRowIndex,
        colKey: 'barCode'
      });
    }, 0);// Un pequeño retraso de 50ms 
  
  }

  async saveMasterChanges() {
    const isValid = this.rowData.every(
      (item) => item.description && item.idTypeEquipment && item.print
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
      //this.trackingService.addLog(this.trackingService.getnameComp(),'Save Registro en Tiendas', 'Menu Administracion Tiendas',  this.trackingService.getEmail());
      return lastValueFrom(this.equipmentService.addEquipment(cleanedData));
    });

    const updateObservables: Promise<any>[] = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log(cleanedData);
      //this.trackingService.addLog(this.trackingService.getnameComp(),'Update Registro en Tiendas', 'Menu Administracion Tiendas',  this.trackingService.getEmail());
      return lastValueFrom(this.equipmentService.updateEquipment(row.id, cleanedData));
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

       /* if (response && response.id && correspondingNewRow) {
          //console.log(response)

          try {
          } catch (permError) {
            console.error('Error asignando permiso:', permError);
            // Opcional: Mostrar alerta pero no interrumpir el flujo principal
            alerts.basicAlert(
              'Advertencia',
              'Se creó la sucursal pero hubo un problema asignando los permisos.',
              'warning'
            );
          }
        }*/
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
    /*if (selectedData.loan && selectedData.loan !== 0) {
      alerts.basicAlert(
        'Error al eliminar',
        'No se puede eliminar el empleado mientras tenga préstamos activos',
        'error'
      );
      return;
    }*/

    const id = selectedData.id;
    selectedData.active = 0;
    alerts
      .confirmAlert(
        'Eliminar un Equipo',
        '¿Está seguro que desea eliminar este equipo?',
        'warning',
        'Sí, eliminar'
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.equipmentService
            .deleteEquipment(id)
            .pipe(
              catchError((error) => {
                alerts.basicAlert(
                  'Eliminar equipo',
                  'Error al eliminar el equipo.',
                  'error'
                );
                console.error(error);
                return EMPTY;
              })
            )
            .subscribe(() => {
              alerts.basicAlert(
                'Equipo eliminado',
                'El equipo se eliminó correctamente',
                'success'
              );
              this.trackingService.addLog(this.trackingService.getnameComp(),'Delete Registro en Equipos', 'Menu Administracion Equipos',  this.trackingService.getEmail());
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
    this.trackingService.addLog(this.trackingService.getnameComp(),'Cancelar Salvar Registro en Equipos', 'Menu Administracion Equipos',  this.trackingService.getEmail());
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