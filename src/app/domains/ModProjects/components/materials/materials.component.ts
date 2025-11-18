import {
  Component,
  effect,
  HostListener,
  inject,
} from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';
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
import { MaterialsService } from 'app/services/materials.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'custom-group-renderer',
  standalone: true,
  template: `
    <div class="ag-group-row">
      <span
        class="ag-group-expanded"
        [class.ag-group-contracted]="!params.node.expanded"
        (click)="onToggleExpand()"
      ></span>
      <span>{{ displayText }}</span>
    </div>
  `,
  styles: [`
    .ag-group-row {
      display: flex;
      align-items: center;
    }
    .ag-group-expanded {
      width: 12px;
      height: 12px;
      margin-right: 4px;
      cursor: pointer;
      background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path d="M4 6L0 2h8z"/></svg>') no-repeat center;
      background-size: 12px;
    }
    .ag-group-contracted {
      transform: rotate(-90deg);
    }
  `]
})
export class CustomGroupRendererComponent implements ICellRendererAngularComp {
  params: any;
  displayText: string = '';

  agInit(params: any): void {
    this.params = params;
    const field = params.node.rowGroupColumn?.getColDef()?.field;
    if (field === 'familiaDescription') {
      this.displayText = `Familia: ${params.value}`;
    } else if (field === 'subfamiliaDescription') {
      this.displayText = `Subfamilia: ${params.value}`;
    } else {
      this.displayText = params.value;
    }
  }

  onToggleExpand(): void {
    this.params.node.setExpanded(!this.params.node.expanded);
  }

  refresh(params: any): boolean {
    this.params = params;
    return true;
  }
}

@Component({
  selector: 'storeComponent',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, CustomGroupRendererComponent],
  templateUrl: './materials.component.html',
  styles: `
    ::ng-deep .small-text-ag-grid {
      font-size: 12px;
    }
    ::ng-deep .small-text-ag-grid .ag-header-cell-text {
      font-size: 11px;
    }
    ::ng-deep .small-text-ag-grid .ag-cell-value {
      font-size: 11px;
    }
  `
})
export class MaterialsComponent implements CanComponentDeactivate {
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
  unitsCatalog: any[] = [];
  selectedImage: string = '';


  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private materialsService = inject(MaterialsService);
  private catalogsService = inject(CatalogsService);
  private isOpen: boolean = false;

  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent,
    customGroupRenderer: CustomGroupRendererComponent,
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
    delete cleanedData.id;

    // Mapear campos requeridos por el servidor
    cleanedData.material = cleanedData.insumo || cleanedData.materialDescription || '';

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
    return this.materialsService.getAllMaterialsxFamilyview(this.idcompany).subscribe(
      (data: any) => {
        this.rowData = data;
        console.log(this.rowData)
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  obtenerUnidades(){
    return this.catalogsService.getUnits(this.idcompany).subscribe(
      (data: any) => {
        this.unitsCatalog = data;
        console.log(this.unitsCatalog)
      },
      (error) => console.error('Error fetching data:', error)
    );
  }
  

 
  public gridOptions: any = {
    headerHeight: 50,
    rowHeight: 20,
    groupDefaultExpanded: -1, // -1 significa expandir todos los niveles
    suppressDragLeaveHidesColumns: true,
    suppressMakeColumnVisibleAfterUnGroup: true,
    rowBuffer: 20,
    masterDetail: false, // No master-detail por ahora
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
    if (event.data && event.data.id) {
      this.id = event.data.id;
    }
  }

  async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
    const colId = event.column.getColId();
    const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
    const selectedId = selectedRowData.id; // Obtener el ID del registro

    if (colId === 'picture' && selectedRowData.picture) {
      if (this.notSavedChanges) {
        alerts.basicAlert('Cambios sin guardar', 'Guarde los cambios antes de ver la imagen.', 'warning');
        return;
      }
      this.selectedImage = selectedRowData.picture;
      // Open modal using Bootstrap
      const modal = new (window as any).bootstrap.Modal(document.getElementById('imageModal'));
      modal.show();
      return;
    }

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
        field: 'familiaDescription',
        headerName: 'Familia',
        rowGroup: true,
        hide: true,
      },
      {
        field: 'subfamiliaDescription',
        headerName: 'Subfamilia',
        rowGroup: true,
        hide: true,
      },
      {
        field: 'insumo',
        headerName: 'Insumo',
        editable: true,
        width: 150,
      },
      {
        field: 'materialDescription',
        headerName: 'Descripción del Material',
        editable: true,
        width: 250,
      },
      {
        field: 'barcode',
        headerName: 'Código de Barras',
        editable: true,
        width: 150,
      },
      {
        field: 'picture',
        headerName: 'Imagen',
        cellRenderer: (params: ICellRendererParams) => {
          if (params.value) {
            return `<img src="${params.value}" style="width: 50px; height: 50px; object-fit: cover;" />`;
          }
          return '';
        },
        width: 80,
      },
      {
        field: 'costoMN',
        headerName: 'Costo MN',
        editable: true,
        width: 100,
        valueFormatter: (params) => params.value ? `$${params.value.toFixed(2)}` : '$0.00',
      },
      {
        field: 'ventaMN',
        headerName: 'Venta MN',
        editable: true,
        width: 100,
        valueFormatter: (params) => params.value ? `$${params.value.toFixed(2)}` : '$0.00',
      },
      {
        field: 'stockMin',
        headerName: 'Stock Mínimo',
        editable: true,
        width: 120,
      },
      {
        field: 'stockMax',
        headerName: 'Stock Máximo',
        editable: true,
        width: 120,
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
      insumo: '',
      materialDescription: '',
      familiaDescription: '',
      subfamiliaDescription: '',
      barcode: '',
      picture: '',
      costoMN: 0,
      ventaMN: 0,
      stockMin: 1,
      stockMax: 30,
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
        colKey: 'insumo'
      });
    }, 0);
  }

  async saveMasterChanges() {
    /*const isValid = this.rowData.every(
      (item) => item.barCode && item.description && item.idMedida && item.date
    );
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar los campos obligatorios antes de guardar.',
        'error'
      );
      return;
    }*/

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables: Promise<any>[] = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log(cleanedData);
      //this.trackingService.addLog(this.trackingService.getnameComp(),'Save Registro en Tiendas', 'Menu Administracion Tiendas',  this.trackingService.getEmail());
      return lastValueFrom(this.materialsService.addMaterial(cleanedData));
    });

    const updateObservables: Promise<any>[] = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log(cleanedData);
      //this.trackingService.addLog(this.trackingService.getnameComp(),'Update Registro en Tiendas', 'Menu Administracion Tiendas',  this.trackingService.getEmail());
      return lastValueFrom(this.materialsService.updateMaterial(row.id, cleanedData));
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
        'Eliminar un Material',
        '¿Está seguro que desea eliminar este material?',
        'warning',
        'Sí, eliminar'
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.materialsService
            .deleteMaterial(id)
            .pipe(
              catchError((error) => {
                alerts.basicAlert(
                  'Eliminar material',
                  'Error al eliminar el material.',
                  'error'
                );
                console.error(error);
                return EMPTY;
              })
            )
            .subscribe(() => {
              alerts.basicAlert(
                'Material eliminado',
                'El material se eliminó correctamente',
                'success'
              );
              this.trackingService.addLog(this.trackingService.getnameComp(),'Delete Registro en Materiales', 'Menu Administracion Materiales',  this.trackingService.getEmail());
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
    this.trackingService.addLog(this.trackingService.getnameComp(),'Cancelar Salvar Registro en Materiales', 'Menu Administracion Materiales',  this.trackingService.getEmail());
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

  onAdd() {
    this.addMasterRow();
  }

  onEdit() {
    this.saveMasterChanges();
  }

  onDelete() {
    this.deleteMasterEntry();
  }

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.notSavedChanges);
  }
}