import { CommonModule } from '@angular/common';
import { Component, effect, HostListener, inject } from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { FormsModule } from '@angular/forms';
import { BranchsService } from 'app/services/branchs.service';
import { alerts } from 'app/helpers/alerts';
import { ModalService } from 'app/services/modal.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { InegiService } from 'app/services/inegi.service';
import { States } from 'app/interface/states';

@Component({
  selector: 'app-branches',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, MultiLineEditorComponent],
  templateUrl: './branches.component.html',
  styleUrl: './branches.component.scss'
})
export class BranchesComponent {

  private signalsService = inject(SignalsService);
  private branchesService = inject(BranchsService);
  private modalServiceTable = inject(ModalService);
  private inegiService = inject(InegiService);

  //Variables master
  masterRowData: any[] = [];
  masterSelectedRowData: any = null;
  newlyAddedMasterRows: string[] = [];
  masterNotSavedChanges: boolean = false;
  idRoot: number = null;
  id: number = null;
  private masterGridApi: GridApi;
  private tempIdCounter: number = 0;
  private estados: any;

  // Configuración Grid
  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];

  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();

      if (this.idRoot == null) {
        this.masterRowData = [];
        alerts.basicAlert('Sucursales', 'Debe elegir una empresa primero para poder ver sus sucursales.', 'error');
      }
      else {
        this.obtenerDatos();
      }
    }
    );
  }

  ngOnInit() {
    this.obtenerDatos();
    this.obtenerStates();
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.masterNotSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  // ==================== MASTER METHODS ====================

  obtenerDatos() {
    this.branchesService.getBranches(this.idRoot).subscribe((data: any) => {
      this.masterRowData = data;
    },
      (error) => console.error('Error fetching data:', error)
    );
  }

  obtenerStates() {
    this.inegiService.getEstados().subscribe({
      next: (data: { datos: States[] }) => {
        this.estados = data.datos.map((estado, index) => ({
          ...estado,
          id: index + 1
        }));
        console.log(this.estados);
      },
      error: (error) => {
        console.error('Error fetching states', error);
      }
    });
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
      this.masterGridApi.forEachNode((node) => {
        if (node.id !== event.node.id) {
          node.setSelected(false);
        }
      });
    }
  },
};
  
  get colMaster(): ColDef[] {
    return [
      { field: 'orden', headerName: 'Orden', editable: true, filter: true, flex: 1 },
      { field: 'name', headerName: 'Nombre', editable: true, filter: true, flex: 2 },
      
      { field: 'description', headerName: 'Descripción', editable: true, filter: true, flex: 2 },
      
      { field: 'idEstado', headerName: 'Estado', editable: true, filter: true, flex: 1, cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.estados ? this.estados.map(item => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.estados ? this.estados.find(item => item.id === params.value) : null;
          return foundItem ? `${foundItem.nom_agee}` : params.value;
        }
      },
      
      { field: 'address', headerName: 'Dirección', editable: false, filter: true, flex: 2, cellEditor: 'agPopupTextCellEditor',
        cellEditorParams: {
          maxLength: 100,
          cols: 50,
          rows: 3,
          onKeyDown: (event: KeyboardEvent) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.stopPropagation();
            }
          },
        },
        onCellDoubleClicked: (event: CellDoubleClickedEvent) => {
          if (!event.node.group) {
            this.modalServiceTable.showModal({
              params: event,
              value: event.value,
            });
          }
        },
        cellRenderer: (params: ICellRendererParams) => {
          if (params.node.group) {
            return params.value;
          }
          return params.value;
        }
      },

    ]
  };

  onMasterSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      // Crear una copia profunda del dato seleccionado
      this.masterSelectedRowData = { ...selectedNodes[0].data };

    } else {
      this.masterSelectedRowData = null;
    }
  }

  onMasterCellValueChanged(event: any) {
    const updatedData = { ...event.data };

    // Preservar el estado temporal y la selección
    if (this.newlyAddedMasterRows.includes(updatedData.id)) {
      updatedData.__isNew = true;
    }

    updatedData.__modified = true;
    this.masterNotSavedChanges = true;

    // Actualizar el array de datos
    this.masterRowData = this.masterRowData.map(row =>
      row.id === updatedData.id ? updatedData : row
    );

    // Actualizar la fila en la cuadrícula
    const rowNode = this.masterGridApi.getRowNode(updatedData.id);
    if (rowNode) {
      rowNode.setData(updatedData);
      // Mantener la selección si es necesario
      if (this.masterSelectedRowData && this.masterSelectedRowData.id === updatedData.id) {
        rowNode.setSelected(true);
      }
    }
  }

  onMasterGridReady(params: GridReadyEvent) {
    this.masterGridApi = params.api;
  }

  onMasterRowSelected(event: any) {
    this.id = event.data.id;
  }

  addMasterRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idCompany: this.idRoot,
      idEstado: null,
      name: '',
      description: '',
      address: '',
      orden : 0,
      active: true,
      __isNew: true,
    };

    // Actualizar el estado
    this.masterRowData = [newItem, ...this.masterRowData];
    this.newlyAddedMasterRows.push(tempId);
    this.masterNotSavedChanges = true;

    // Forzar la actualización de la cuadrícula y seleccionar la nueva fila
    this.masterGridApi.setGridOption("rowData", this.masterRowData);

    // Asegurarnos de que la fila nueva esté seleccionada
    requestAnimationFrame(() => {
      const rowNode = this.masterGridApi.getRowNode(tempId);
      if (rowNode) {
        rowNode.setSelected(true);
        this.masterSelectedRowData = newItem;
      }
    });
  }

  async saveMasterChanges() {
    const isValid = this.masterRowData.every((item) => item.name && item.description && item.address);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar todos los campos antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.masterRowData.filter((row) => row.__isNew);
    const modifiedRows = this.masterRowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log(cleanedData);
      return this.branchesService.addBranch(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log(cleanedData);
      return this.branchesService.updateBranch(row.id, cleanedData);
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
      this.masterNotSavedChanges = false;
      this.newlyAddedMasterRows = [];
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

  revertMasterData() {
    this.obtenerDatos();
    this.masterNotSavedChanges = false;
  }

  // ==================== UTILITY METHODS ====================

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
