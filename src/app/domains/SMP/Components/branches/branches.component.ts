import { CommonModule } from '@angular/common';
import { Component, effect, HostListener, inject } from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { FormsModule } from '@angular/forms';
import { BranchsService } from 'app/services/branchs.service';
import { alerts } from 'app/helpers/alerts';
import { ModalService } from 'app/services/modal.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { InegiService } from 'app/services/inegi.service';
import { States } from 'app/interface/states';
import { environment } from '@env/environment';
import { Ibranch } from 'app/interface/ibranch';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';

@Component({
  selector: 'app-branches',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, MultiLineEditorComponent],
  templateUrl: './branches.component.html',
  styleUrl: './branches.component.scss',
})
export class BranchesComponent implements CanComponentDeactivate {
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
  idUser: number = null;
  gridHeight: string = '85vh';

  //idRoot = this.signalsService.getRootSelectedBySidebar(); // Asignar directamente la Signal

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
      this.idUser = this.signalsService.getIdUSer()();
      console.log(this.masterRowData);
      if (this.idRoot == null) {
        this.masterRowData = [];
        alerts.basicAlert(
          'Sucursales',
          'Debe elegir una empresa primero para poder ver sus sucursales.',
          'error'
        );
      } else {
        this.obtenerDatos();
      }
    });
  }

  ngOnInit() {
    this.idUser = this.signalsService.getIdUSer()();
    this.obtenerDatos();
    this.obtenerEstados();

    //alert(this.idUser)
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
    if (this.signalsService.getemailChoose() === environment.root) {
      this.branchesService.getAllBranches().subscribe(
        (data: Ibranch[]) => {
          this.masterRowData = data;
          this.masterNotSavedChanges = false;
        },
        (error) => {
          console.error('Error fetching all branches:', error);
        }
      );
    } else {
      this.branchesService.getBranches(this.idRoot).subscribe(
        (data: Ibranch[]) => {
          this.masterRowData = data.sort((a, b) =>
            a.name.localeCompare(b.name)
          );
          this.masterNotSavedChanges = false;
        },
        (error) => {
          console.error('Error fetching branches:', error);
        }
      );
    }
  }

  obtenerEstados() {
    this.inegiService.getEstados().subscribe({
      next: (data: { datos: States[] }) => {
        this.estados = data.datos.map((estado, index) => ({
          ...estado,
          id: index + 1,
        }));
        //console.log(this.estados);
      },
      error: (error) => {
        console.error('Error fetching states', error);
      },
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
    const columns: ColDef[] = [];
    
    // Agregar columna condicional
    if (this.signalsService.getemailChoose() === environment.root) {
        columns.push({          
            field: 'rootName', 
            headerName: 'Empresa', 
            editable: false, 
            filter: true,
            width: 200,
            enableRowGroup: true,  // Permite agrupar por esta columna
            enablePivot: true,    // Permite usar esta columna como pivote
            rowGroup: true,      // Inicialmente no agrupado (puedes cambiarlo a true si quieres que se agrupe por defecto)
            pivot: true,
            headerCheckboxSelection: false,
            checkboxSelection: false       // Inicialmente no como pivote
        })
    }

    // Agregar el resto de las columnas
    columns.push(
        {
            field: 'name',
            headerName: 'Nombre *',
            editable: true,
            filter: true,
            width: 250,
            valueSetter: (params) => {
              const rawValue = params.newValue;
              if (!rawValue || typeof rawValue !== 'string') {
                alerts.basicAlert('Campo requerido', 'El nombre es obligatorio', 'error');
                return false;
              }
          
              const normalizedValue = rawValue.trim().toUpperCase();
          
              if (!normalizedValue) {
                alerts.basicAlert('Campo requerido', 'El nombre es obligatorio', 'error');
                return false;
              }
          
              const duplicateExists = this.masterRowData.some(
                (row, index) =>
                  index !== params.node.rowIndex &&
                  row.name?.toUpperCase() === normalizedValue
              );
          
              if (duplicateExists) {
                alerts.basicAlert(
                  'Nombre duplicado',
                  'Ya existe una sucursal con ese nombre.',
                  'error'
                );
                return false;
              }
          
              params.data[params.colDef.field] = normalizedValue;
              return true;
            },
            
        },
        {
            field: 'description',
            headerName: 'Descripción *',
            editable: true,
            filter: true,
            width: 400,
            valueSetter: (params) => {
                params.data[params.colDef.field] = params.newValue?.toUpperCase();
                return true;
            },
        },
        {
            field: 'idEstado',
            headerName: 'Estado *',
            editable: true,
            filter: true,
            cellEditor: 'agSelectCellEditor',
            width: 200,
            cellEditorParams: {
                values: this.estados ? this.estados.map((item) => item.id) : [],
            },
            valueFormatter: (params) => {
                const foundItem = this.estados
                    ? this.estados.find((item) => item.id === params.value)
                    : null;
                return foundItem ? `${foundItem.nom_agee}` : params.value;
            },
        },
        {
            field: 'address',
            headerName: 'Dirección *',
            editable: true,
            filter: true,
            width: 400,
             /*cellEditor: 'agPopupTextCellEditor',
           cellEditorParams: {
                maxLength: 100,
                cols: 50,
                rows: 3,
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
                return params.node.group ? params.value : params.value;
            },*/
            valueSetter: (params) => {
                params.data[params.colDef.field] = params.newValue?.toUpperCase();
                return true;
            },
        },
        {
            field: 'vigente',
            headerName: 'Activo',
            editable: true,
            suppressMovable: true,
            filter: true,
            width: 150,
            cellRenderer: (params) => {
                return `<input type="checkbox" ${
                    params.value ? 'checked' : ''
                } disabled />`;
            },
        }
    );

    return columns;
}

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
    this.masterRowData = this.masterRowData.map((row) =>
      row.id === updatedData.id ? updatedData : row
    );

    // Actualizar la fila en la cuadrícula
    const rowNode = this.masterGridApi.getRowNode(updatedData.id);
    if (rowNode) {
      rowNode.setData(updatedData);
      // Mantener la selección si es necesario
      if (
        this.masterSelectedRowData &&
        this.masterSelectedRowData.id === updatedData.id
      ) {
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
      orden: 0,
      active: true,
      __isNew: true,
    };

    // Actualizar el estado
    this.masterRowData = [newItem, ...this.masterRowData];
    this.newlyAddedMasterRows.push(tempId);
    this.masterNotSavedChanges = true;

    // Forzar la actualización de la cuadrícula y seleccionar la nueva fila
    this.masterGridApi.setGridOption('rowData', this.masterRowData);
    setTimeout(() => {
      const firstRowIndex = 0;
  
      this.masterGridApi.ensureIndexVisible(firstRowIndex);
  
      this.masterGridApi.startEditingCell({
        rowIndex: firstRowIndex,
        colKey: 'name'
      });
    }, 0);

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
    const isValid = this.masterRowData.every(
      (item) => item.name && item.description && item.address
    );
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

    // Tipamos explícitamente las promesas
    const addPromises: Promise<Ibranch>[] = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return lastValueFrom(this.branchesService.addBranch(cleanedData));
    });

    const updatePromises: Promise<Ibranch>[] = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return lastValueFrom(
        this.branchesService.updateBranch(row.id, cleanedData)
      );
    });

    try {
      const allResponses = await Promise.all([
        ...addPromises,
        ...updatePromises,
      ]);

      // Asignar permisos para los nuevos Branchs creados
      console.log(allResponses);
      for (const response of allResponses) {
        // Verificar si es una nueva creación comparando con los IDs temporales
        const correspondingNewRow = newRows.find(
          (row) => !row.id || row.id.toString().startsWith('temp_')
        );
        console.log(response.id);

        if (response.id && correspondingNewRow) {
          try {
            await lastValueFrom(
              this.branchesService.assignPermissionAfterCreation(
                this.idUser,
                response.id,
                'branch'
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

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.masterNotSavedChanges = false;
      this.newlyAddedMasterRows = [];

      if (allResponses.length > 0) {
        await this.obtenerDatos();
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

  async deleteBranch() {
    const selectedNodes = this.masterGridApi.getSelectedNodes();
    const selectedData = selectedNodes[0].data;
    if (selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Por favor, seleccione una entrada para eliminar.',
        'error'
      );
      return;
    }

    alerts
      .confirmAlert(
        'Eliminar Sucursal',
        'Está seguro de que desea eliminar esta sucursal?',
        'warning',
        'Sí, Eliminar'
      )
      .then((result) => {
        if (result.isConfirmed) {
          selectedData.active = 0;
          this.branchesService
            .deleteBranch(selectedData.id)
            .pipe(
              catchError((error) => {
                alerts.basicAlert(
                  'Eliminar sucursal',
                  error.error.message,
                  'error'
                );
                console.error('este es el error:', error.error);
                return EMPTY;
              })
            )
            .subscribe(() => {
              alerts.basicAlert(
                'Eliminar sucursal',
                'La sucursal ha sido eliminada correctamente.',
                'success'
              );
              this.obtenerDatos(); // Refrescar los datos después de eliminar
              this.masterNotSavedChanges = false;
              this.masterSelectedRowData = null;
            });
        }
      });
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

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.masterNotSavedChanges);
  }
}
