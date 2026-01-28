import { Component, effect, HostListener, inject } from '@angular/core';

import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { alerts } from '../../../../helpers/alerts';
import { States } from 'app/interface/states';
import { InegiService } from '../../../../services/inegi.service';
import { WarehousesService } from 'app/services/warehouses.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { BranchsService } from 'app/services/branchs.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { ModalService } from 'app/services/modal.service';
import { SignalsService } from 'app/services/signals.service';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';

interface Branch {
  id: number;
  name: string;
}

@Component({
  selector: 'app-warehouses',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, MultiLineEditorComponent],
  templateUrl: './warehouses.component.html',
  styleUrl: './warehouses.component.scss',
})
export class WarehousesComponent implements CanComponentDeactivate {
  selectedRoot: string = '';

  ngOnInit() {
    this.obtenerDatos();
    this.obtenerStates();
  }

  constructor() {
    effect(() => {
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.obtenerDatos();
    });
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
  private estados: string[] = [];
  branches: any;
  id: string;
  idBranch: number;
  private tempIdCounter: number = 0;

  private gridApi: GridApi;

  currentIndex = 0;

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  frameworkComponents = {
    multiLineEditor: MultiLineEditorComponent,
  };

  // Inject of new way for Angular 18
  private warehouseService = inject(WarehousesService);
  private inegiService = inject(InegiService);
  private branchesService = inject(BranchsService);
  private modalServiceTable = inject(ModalService);
  private signalsService = inject(SignalsService);

  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
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

  private _colMaster: ColDef[] = [];

  get colMaster(): ColDef[] {
    if (this._colMaster.length > 0) {
      return this._colMaster;
    }

    this._colMaster = [
      {
        field: 'name',
        headerName: 'Nombre',
        editable: true,
        filter: true,
        width: 200,
      },
      {
        field: 'address',
        headerName: 'Direccion',
        editable: false,
        width: 285,
        filter: true,
        cellEditor: 'agPopupTextCellEditor',
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
        },
      },
      {
        field: 'state',
        headerName: 'Estado',
        editable: true,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: this.estados,
        }),
      },
      { field: 'city', headerName: 'Ciudad', editable: true, width: 100 },
      {
        field: 'codePostal',
        headerName: 'CP',
        editable: true,
        width: 70,
      },
      { field: 'place', headerName: 'Lugar', editable: true, width: 185 },
      {
        field: 'phone',
        headerName: 'Telefono',
        editable: true,
        width: 105,
        cellEditorParams: {
          maxLength: 10,
        },
      },
      { field: 'leader', headerName: 'Lider', editable: true, width: 238 },
      {
        field: 'principal',
        headerName: 'Principal',
        editable: true,
        width: 100,
        cellEditor: 'agCheckboxCellEditor'
      },
    ];

    return this._colMaster;
  }

  obtenerDatos() {
    this.warehouseService.getWarehouses(this.idBranch).subscribe({
      next: (data: any) => {
        this.rowData = data;
      },
      error: (error) => {
        if (error.status === 404) {
          this.rowData = [];
        }
      },
    });
  }

  obtenerStates() {
    this.inegiService.getEstados().subscribe({
      next: (data: { datos: States[] }) => {
        this.estados = data.datos.map((estado) => estado.nom_agee);
        this._colMaster = [];
      },
      error: () => {
        // Fallback con estados de México predefinidos
        this.estados = [
          'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche',
          'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila de Zaragoza',
          'Colima', 'Durango', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco',
          'México', 'Michoacán de Ocampo', 'Morelos', 'Nayarit', 'Nuevo León',
          'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí',
          'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala',
          'Veracruz de Ignacio de la Llave', 'Yucatán', 'Zacatecas'
        ];
        this._colMaster = [];
      },
    });
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
    if (event.colDef.field === 'principal' && event.newValue === true) {
      // Ensure only one warehouse is principal
      this.rowData.forEach(row => {
        if (row.id !== event.data.id) {
          row.principal = false;
          row.__modified = true; // Mark others as modified too
        }
      });
      this.gridApi.refreshCells();
    }

    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
    if (!this.idBranch) {
      alerts.basicAlert('Error', 'Debe seleccionar una sucursal primero.', 'error');
      return;
    }

    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idBranch: this.idBranch,
      name: '',
      address: '',
      state: '',
      city: '',
      codePostal: '',
      place: '',
      phone: '',
      active: true,
      leader: '',
      principal: false,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) => item.name && item.address);
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
      return this.warehouseService.addWarehouse(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.warehouseService.updateWarehouse(row.id, cleanedData);
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
    } catch (error: any) {
      const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
      alerts.basicAlert(
        'Error',
        `Ocurrió un error al actualizar los datos: ${errorMsg}`,
        'error'
      );
    }
  }

  async Delete() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar Almacen',
        'Por favor, seleccione Almacen para eliminar.',
        'error'
      );
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;
    selectedData.active = 0;
    this.warehouseService
      .deleteWarehouse(id)
      .pipe(
        catchError(() => {
          alerts.basicAlert(
            'Eliminar Almacen',
            'Error al eliminar Almacen.',
            'error'
          );
          return EMPTY;
        })
      )
      .subscribe(() => {
        alerts.basicAlert(
          'Eliminar Almacen',
          'Almacen Eliminado satisfactoriamente.',
          'success'
        );
        this.obtenerDatos();

        alerts.basicAlert(
          'Eliminar Almacen',
          'Almacen eliminado satisfactoriamente.',
          'success'
        );
        this.notSavedChanges = false;
        this.selectedRowData = null;
      });
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

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.notSavedChanges);
  }
}
