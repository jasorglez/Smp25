import { Component, OnInit, OnChanges, SimpleChanges, Input, inject, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { ParametrosComponent } from './parametros.component';
import { ProductionService } from 'app/services/production.service';
import { MaterialsService } from 'app/services/materials.service';
import { SignalsService } from 'app/services/signals.service';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-detalle-jarabe',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, ParametrosComponent, SelectWithTooltipEditorV2Component],
  template: `
    <div style="padding: 5px; background-color: #e3f2fd; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;">
      
      <div style="margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
        <strong>Ingredientes de Preparación</strong>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-success" (click)="addItem()" title="Agregar">
            <i class="bi bi-plus-lg"></i> Agregar
          </button>
          <button class="btn btn-sm btn-warning" (click)="discardChanges()" title="Deshacer">
            <i class="bi bi-arrow-counterclockwise"></i> Deshacer
          </button>
          <button class="btn btn-sm btn-danger" (click)="deleteSelectedItem()" [disabled]="!hasRowSelected" title="Eliminar">
            <i class="bi bi-trash"></i> Eliminar
          </button>
          <button class="btn btn-sm btn-primary position-relative" (click)="saveChanges()" [disabled]="!hasUnsavedChanges" title="Guardar">
            <i class="bi bi-floppy"></i> Guardar
            <span class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle"
              *ngIf="hasUnsavedChanges">
            </span>
          </button>
        </div>
      </div>

      <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
        <ag-grid-angular
          #agGrid
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          [localeText]="AG_GRID_LOCALE_ES"
          (gridReady)="onGridReady($event)"
          (cellValueChanged)="onCellValueChanged($event)"
          (cellClicked)="onCellClicked($event)"
          (selectionChanged)="onSelectionChanged($event)"
          style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
        </ag-grid-angular>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
  `]
})
export class DetalleJarabeComponent implements OnInit, OnChanges {
  private preparacionService = inject(ProductionService);
  private readonly cdr = inject(ChangeDetectorRef);
  private materialsService = inject(MaterialsService);
  private signalsService = inject(SignalsService);

  @Input() params: any;
  private internalParams: any;
  private gridApi!: GridApi;
  private dataLoaded: boolean = false;
  expandedParametrosRowId: string | null = null;

  rowData: any[] = [];
  originalRowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  hasRowSelected: boolean = false;
  tempIdCounter: number = 0;
  rawMaterialNames: string[] = [];
  frequentIngredientes: any[] = [];
  totalPreparaciones: number = 0;

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    const idCompany = this.signalsService.getRootSelectedBySidebar()();
    const materialsObs = idCompany
      ? lastValueFrom(this.materialsService.getMaterialsxview(idCompany)).catch(() => [])
      : Promise.resolve([]);
    const frequentObs = lastValueFrom(this.preparacionService.getFrequentIngredientes()).catch(() => ({ ingredientes: [], totalPreparaciones: 0 }));

    Promise.all([materialsObs, frequentObs]).then(([materialsData, frequentData]) => {
      const list: any[] = Array.isArray(materialsData) ? materialsData : [];
      this.rawMaterialNames = list.map(m => m.articulo || m.description || m.insumo || '').filter(Boolean);
      this.frequentIngredientes = frequentData?.ingredientes ?? [];
      this.totalPreparaciones = frequentData?.totalPreparaciones ?? 0;
      this._colDefs = [];
      if (this.gridApi) this.gridApi.setGridOption('columnDefs', this.colDefs);
    });

    setTimeout(() => {
      if (!this.dataLoaded && this.internalParams && this.gridApi) {
        this.loadData();
      }
    }, 200);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['params'] && this.params) {
      this.internalParams = this.params;
      if (this.gridApi) {
        this.dataLoaded = false;
        this.loadData();
      }
    }
  }

  agInit(params: any): void {
    this.internalParams = params;
  
    this.cdr.detectChanges();}

  loadData(): void {
    if (!this.internalParams) return;

    const idPreparacion = this.internalParams?.data?.id;
    if (!idPreparacion || typeof idPreparacion === 'string') return;

    // Cargar directamente desde la API en lugar del snapshot del padre
    this.loadFromServer(idPreparacion);
  }

  private async loadFromServer(idPreparacion: number): Promise<void> {
    this.rowData = [
      { id: 1, idPreparacion, ingrediente: 'Azúcar',         prep: 12.50, correccion: 0.25, parametrosCount: 2, __isNew: false, __modified: false },
      { id: 2, idPreparacion, ingrediente: 'Ácido Cítrico',  prep:  3.75, correccion: 0.10, parametrosCount: 1, __isNew: false, __modified: false },
      { id: 3, idPreparacion, ingrediente: 'Benzoato',       prep:  0.80, correccion: 0.05, parametrosCount: 0, __isNew: false, __modified: false },
      { id: 4, idPreparacion, ingrediente: 'Colorante Rojo', prep:  0.30, correccion: 0.02, parametrosCount: 0, __isNew: false, __modified: false },
      { id: 5, idPreparacion, ingrediente: 'Saborizante',    prep:  1.20, correccion: 0.15, parametrosCount: 1, __isNew: false, __modified: false },
    ];
    this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
    this.dataLoaded = true;
    if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.gridApi.setGridOption('rowData', this.rowData);
      this.gridApi.redrawRows();
    }
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    if (this.internalParams) {
      this.loadData();
    }
  }

  private _colDefs: ColDef[] = [];

  get colDefs(): ColDef[] {
    if (this._colDefs.length > 0) {
      return this._colDefs;
    }

    this._colDefs = [
      {
        headerName: '#',
        width: 50,
        valueGetter: (params) => params.node.rowIndex + 1,
        pinned: 'left',
        cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' }
      },
      {
        field: 'ingrediente',
        headerName: 'Ingrediente',
        width: 180,
        editable: true,
        cellDataType: false,
        cellEditor: 'selectV2',
        cellEditorParams: (params: any) => {
          const currentValue = params.data?.ingrediente ?? '';
          const usedNames = new Set(
            this.rowData
              .filter(row => row.id !== params.data?.id && row.ingrediente)
              .map((row: any) => row.ingrediente)
          );
          const frequentNames = new Set(this.frequentIngredientes.map((f: any) => f.ingrediente));
          const frequentOptions = this.frequentIngredientes
            .filter((f: any) => !usedNames.has(f.ingrediente) || f.ingrediente === currentValue)
            .map((f: any) => ({
              id: f.ingrediente,
              description: this.totalPreparaciones > 0
                ? `⭐ ${f.ingrediente} (${Math.round((f.countUsed / this.totalPreparaciones) * 100)}%)`
                : `⭐ ${f.ingrediente}`
            }));
          const restOptions = this.rawMaterialNames
            .filter(name => !frequentNames.has(name) && (!usedNames.has(name) || name === currentValue))
            .map(name => ({ id: name, description: name }));
          return { options: [...frequentOptions, ...restOptions] };
        },
        valueSetter: (params) => {
          params.data.ingrediente = params.newValue ?? '';
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      },

      {
        field: 'prep',
        headerName: 'Cant. Prep',
        width: 130,
        editable: true,
        type: 'numericColumn',
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: { min: 0, precision: 2 },
        valueFormatter: (params) => {
          const n = parseFloat(params.value);
          return !isNaN(n) ? n.toFixed(2) : '';
        },
        valueSetter: (params) => {
          const n = parseFloat(params.newValue);
          params.data.prep = !isNaN(n) ? n : null;
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      },
      {
        field: 'correccion',
        headerName: 'Cant. Corrección',
        width: 140,
        editable: true,
        type: 'numericColumn',
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: { min: 0, precision: 2 },
        valueFormatter: (params) => {
          const n = parseFloat(params.value);
          return !isNaN(n) ? n.toFixed(2) : '';
        },
        valueSetter: (params) => {
          const n = parseFloat(params.newValue);
          params.data.correccion = !isNaN(n) ? n : null;
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      },

      {
        field: 'comentarios',
        headerName: 'Comentarios',
        flex: 1,
        minWidth: 160,
        editable: true,
        cellEditor: 'agLargeTextCellEditor',
        cellEditorPopup: true,
        valueSetter: (params: any) => {
          params.data.comentarios = params.newValue || '';
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      },
  
    ];

    return this._colDefs;
  }

  public gridOptions: any = {
    components: {
      selectV2: SelectWithTooltipEditorV2Component
    },
    headerHeight: 25,
    rowHeight: 25,
    animateRows: true,
    rowSelection: 'multiple',
    singleClickEdit: true,
    domLayout: 'normal',
    suppressHorizontalScroll: false,
    masterDetail: true,
    detailRowHeight: 250,
    detailCellRenderer: ParametrosComponent,
    isRowMaster: () => true
  };

  addItem() {
    const tempId = `temp_jarabe_${Date.now()}_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      ingrediente: '',
      prep: null,
      correccion: null,
      parametrosCount: 0,
      __isNew: true,
      __modified: false,
      saved: false
    };

    this.rowData = [...this.rowData, newItem];
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    setTimeout(() => {
      const lastRowIndex = this.rowData.length - 1;
      this.gridApi.ensureIndexVisible(lastRowIndex);
      this.gridApi.startEditingCell({
        rowIndex: lastRowIndex,
        colKey: 'ingrediente'
      });
    }, 0);
  }

  async deleteSelectedItem() {
    const selectedRows = this.gridApi.getSelectedRows();
    if (selectedRows.length === 0) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un item para eliminar', 'warning');
      return;
    }

    const selectedItem = selectedRows[0];

    if (selectedItem.__isNew) {
      this.rowData = this.rowData.filter(item => item.id !== selectedItem.id);
      this.gridApi.setGridOption('rowData', this.rowData);
      this.hasUnsavedChanges = this.rowData.some(item => item.__isNew || item.__modified);
      alerts.basicAlert('Eliminado', 'Item eliminado del listado', 'success');
      return;
    }

    const result = await alerts.confirmAlert(
      '¿Eliminar item?',
      `¿Está seguro de eliminar "${selectedItem.ingrediente}"?`,
      'warning',
      'Sí, eliminar'
    );

    if (!result.isConfirmed) return;

    try {
      await lastValueFrom(this.preparacionService.deleteDetalle(selectedItem.id));
      this.rowData = this.rowData.filter(item => item.id !== selectedItem.id);
      this.originalRowData = this.originalRowData.filter(item => item.id !== selectedItem.id);
      this.gridApi.setGridOption('rowData', this.rowData);
      this.hasUnsavedChanges = this.rowData.some(item => item.__isNew || item.__modified);
      this.updateParentCount();
      alerts.basicAlert('Eliminado', 'Item eliminado correctamente', 'success');
    } catch (error: any) {
      // Extract error message from backend response
      let errorMessage = 'Ocurrió un error al eliminar el item.';

      if (error?.error?.message) {
        errorMessage = error.error.message;
      } else if (error?.error) {
        errorMessage = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
      } else if (error?.message) {
        errorMessage = error.message;
      }

      // Show minimal toast error notification
      alerts.preparacionErrorToast(errorMessage);
    }
  
    this.cdr.detectChanges();}

  async saveChanges() {
    const newItems = this.rowData.filter(item => item.__isNew);
    const modifiedItems = this.rowData.filter(item => item.__modified && !item.__isNew);

    if (newItems.length === 0 && modifiedItems.length === 0) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    const itemsSinIngrediente = this.rowData.filter(item =>
      (item.__isNew || item.__modified) && !item.ingrediente
    );

    if (itemsSinIngrediente.length > 0) {
      alerts.basicAlert('Campo obligatorio', 'La columna "Ingrediente" es obligatoria.', 'warning');
      return;
    }

    const idPreparacion = this.internalParams?.data?.id;

    // Validar que el ID sea un número real, no temporal
    if (!idPreparacion || typeof idPreparacion === 'string') {
      alerts.basicAlert('Error', 'Debe guardar el registro principal antes de agregar detalles.', 'warning');
      return;
    }

    try {
      for (const item of newItems) {
        const payload = {
          idPreparacion,
          ingrediente: item.ingrediente,
          prep: item.prep,
          correccion: item.correccion
        };
        const created = await lastValueFrom(this.preparacionService.createDetalle(payload));
        item.id = created.id;
        item.__isNew = false;
        item.__modified = false;
        item.saved = true;
      }

      for (const item of modifiedItems) {
        const payload = {
          idPreparacion,
          ingrediente: item.ingrediente,
          prep: item.prep,
          correccion: item.correccion
        };
        await lastValueFrom(this.preparacionService.updateDetalle(item.id, payload));
        item.__modified = false;
        item.saved = true;
      }

      this.hasUnsavedChanges = false;
      this.updateParentCount();

      // Recargar datos desde el servidor
      await this.reloadFromServer();

      const totalSaved = newItems.length + modifiedItems.length;
      alerts.basicAlert('Guardado', `Se guardaron ${totalSaved} item(s) exitosamente.`, 'success');
    } catch (error) {
      alerts.basicAlert('Error', 'Ocurrió un error al guardar los cambios.', 'error');
    }
  
    this.cdr.detectChanges();}

  private updateParentCount() {
    if (this.internalParams?.node) {
      this.internalParams.node.data.preparacion = this.rowData.length;
      if (this.internalParams.api) {
        this.internalParams.api.refreshCells({ rowNodes: [this.internalParams.node], force: true });
      }
    }
  }

  private async reloadFromServer() {
    try {
      const idPreparacion = this.internalParams?.data?.id;
      console.log('[reloadFromServer] idPreparacion:', idPreparacion, 'type:', typeof idPreparacion);

      if (!idPreparacion || typeof idPreparacion === 'string') {
        console.warn('[reloadFromServer] Invalid ID - debe ser un número');
        return;
      }

      console.log('[reloadFromServer] Cargando detalles...');
      const detalles = await lastValueFrom(this.preparacionService.getDetalles(idPreparacion));
      console.log('[reloadFromServer] Detalles obtenidos:', detalles);

      this.rowData = detalles.map((item: any) => ({
        id: item.id,
        idPreparacion: item.idPreparacion,
        ingrediente: item.ingrediente || '',
        prep: item.prep || '',
        correccion: item.correccion || '',
        parametrosCount: item.parametrosCount || 0,
        __isNew: false,
        __modified: false
      }));
      console.log('[reloadFromServer] rowData después de mapeo:', this.rowData);

      this.originalRowData = JSON.parse(JSON.stringify(this.rowData));

      if (this.gridApi && !this.gridApi.isDestroyed()) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.gridApi.redrawRows();
        console.log('[reloadFromServer] Grid actualizado');
      } else {
        console.warn('[reloadFromServer] Grid está destruido, no se puede actualizar');
      }

      // Actualizar el contador en el padre
      this.updateParentCount();
    } catch (error) {
      console.error('[reloadFromServer] Error:', error);
    }
  
    this.cdr.detectChanges();}

  discardChanges() {
    if (this.hasUnsavedChanges) {
      this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
      this.hasUnsavedChanges = false;
      this.gridApi.setGridOption('rowData', this.rowData);
      this.gridApi.redrawRows();
      alerts.basicAlert('Deshacer', 'Cambios descartados', 'info');
    } else {
      alerts.basicAlert('Sin cambios', 'No hay cambios por deshacer', 'info');
    }
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }

  toggleParametrosCascade(node: any) {
    if (this.expandedParametrosRowId === node.id) {
      node.setExpanded(false);
      this.expandedParametrosRowId = null;
      node.data.detailType = null;

      this.gridApi.forEachNode((otherNode: any) => {
        otherNode.setRowHeight(undefined);
      });
      this.gridApi.onRowHeightChanged();
      this.gridApi.redrawRows();
    } else {
      if (this.expandedParametrosRowId) {
        this.gridApi.forEachNode((otherNode: any) => {
          if (otherNode.id === this.expandedParametrosRowId) {
            otherNode.setExpanded(false);
          }
        });
      }

      this.gridApi.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id) {
          otherNode.setRowHeight(0);
        }
      });

      node.data.detailType = 'parametros';
      this.expandedParametrosRowId = node.id;

      this.gridApi.onRowHeightChanged();
      this.gridApi.redrawRows();

      setTimeout(() => {
        node.setExpanded(true);
      }, 0);
    }
  }

  onCellClicked(event: any) {
    event.node.setSelected(true);
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    this.hasRowSelected = selectedNodes.length > 0;
  }
}
