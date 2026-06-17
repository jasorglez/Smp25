import { Component, OnInit, OnChanges, SimpleChanges, Input, inject, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { ProductionService } from 'app/services/production.service';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-parametros',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <div style="padding: 5px; background-color: #f3e5f5; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;">
      
      <div style="margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
        <strong>Parámetros de Ingrediente</strong>
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
export class ParametrosComponent implements OnInit, OnChanges {
  private preparacionService = inject(ProductionService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() params: any;
  private internalParams: any;
  private gridApi!: GridApi;
  private dataLoaded: boolean = false;
  private currentIdDetalle: number | null = null;

  rowData: any[] = [];
  originalRowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  hasRowSelected: boolean = false;
  tempIdCounter: number = 0;

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
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

    const idDetalle = this.internalParams?.data?.id;
    if (!idDetalle || typeof idDetalle === 'string') return;

    // Cargar directamente desde la API
    this.loadFromServer(idDetalle);
  }

  private async loadFromServer(idDetalle: number): Promise<void> {
    this.currentIdDetalle = idDetalle;
    try {
      const params = await lastValueFrom(this.preparacionService.getParams(idDetalle));
      console.log('[parametros.loadFromServer] Datos recibidos del servidor:', params);
      this.rowData = params.map((item: any) => ({
        id: item.id,
        idDetalle: item.idDetalle,
        parametro1: item.parametro1 || '',
        parametro2: item.parametro2 || '',
        parametro3: item.parametro3 || '',
        parametro4: item.parametro4 || '',
        parametro5: item.parametro5 || '',
        __isNew: false,
        __modified: false
      }));
      console.log('[parametros.loadFromServer] rowData mapeado:', this.rowData);
      this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
      this.dataLoaded = true;

      if (this.gridApi && !this.gridApi.isDestroyed()) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.gridApi.redrawRows();
      }
    } catch (error) {
      console.error('Error loading params:', error);
      this.dataLoaded = true;
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
        field: 'parametro1',
        headerName: 'Brix Prep',
        width: 120,
        editable: true,
        type: 'numericColumn',
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: { min: 0, precision: 2 },
        valueSetter: (params) => {
          params.data.parametro1 = params.newValue;
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      },
      {
        field: 'parametro2',
        headerName: 'Ph Prep',
        width: 120,
        editable: true,
        type: 'numericColumn',
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: { min: 0, precision: 2 },
        valueSetter: (params) => {
          params.data.parametro2 = params.newValue;
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      },
      {
        field: 'parametro3',
        headerName: 'Brix Cor',
        width: 120,
        editable: true,
        type: 'numericColumn',
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: { min: 0, precision: 2 },
        valueSetter: (params) => {
          params.data.parametro3 = params.newValue;
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      },
      {
        field: 'parametro4',
        headerName: 'Ph Cor',
        width: 120,
        editable: true,
        type: 'numericColumn',
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: { min: 0, precision: 2 },
        valueSetter: (params) => {
          params.data.parametro4 = params.newValue;
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      },
      {
        field: 'parametro5',
        headerName: 'Comentarios',
        flex: 1,
        editable: true,
        cellEditor: 'agTextCellEditor',
        valueSetter: (params) => {
          params.data.parametro5 = params.newValue ? params.newValue.toUpperCase() : '';
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      }
    ];

    return this._colDefs;
  }

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 25,
    animateRows: true,
    rowSelection: 'multiple',
    singleClickEdit: true,
    domLayout: 'normal',
    suppressHorizontalScroll: false
  };

  addItem() {
    if (!this.currentIdDetalle) {
      alerts.basicAlert('Error', 'No se pudo determinar el detalle', 'error');
      return;
    }

    const tempId = `temp_parametros_${Date.now()}_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idDetalle: this.currentIdDetalle,
      parametro1: 0,
      parametro2: 0,
      parametro3: 0,
      parametro4: 0,
      parametro5: '',
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
        colKey: 'parametro1'
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
      `¿Está seguro de eliminar este parámetro?`,
      'warning',
      'Sí, eliminar'
    );

    if (!result.isConfirmed) return;

    try {
      // Delete from database
      await lastValueFrom(this.preparacionService.deleteParams(selectedItem.id));

      this.rowData = this.rowData.filter(item => item.id !== selectedItem.id);
      this.originalRowData = this.originalRowData.filter(item => item.id !== selectedItem.id);
      this.gridApi.setGridOption('rowData', this.rowData);
      this.hasUnsavedChanges = this.rowData.some(item => item.__isNew || item.__modified);

      alerts.basicAlert('Eliminado', 'Item eliminado correctamente', 'success');
    } catch (error: any) {
      // Extract error message from backend response
      let errorMessage = 'Error al eliminar el parámetro.';

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
  }

  async saveChanges() {
    const newItems = this.rowData.filter(item => item.__isNew);
    const modifiedItems = this.rowData.filter(item => item.__modified && !item.__isNew);

    if (newItems.length === 0 && modifiedItems.length === 0) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    try {
      // Create new items
      const createPromises = newItems.map(item =>
        lastValueFrom(this.preparacionService.createParams({
          idDetalle: item.idDetalle,
          parametro1: item.parametro1,
          parametro2: item.parametro2,
          parametro3: item.parametro3,
          parametro4: item.parametro4,
          parametro5: item.parametro5
        }))
      );

      // Update modified items
      const updatePromises = modifiedItems.map(item =>
        lastValueFrom(this.preparacionService.updateParams(item.id, {
          idDetalle: item.idDetalle,
          parametro1: item.parametro1,
          parametro2: item.parametro2,
          parametro3: item.parametro3,
          parametro4: item.parametro4,
          parametro5: item.parametro5
        }))
      );

      await Promise.all([...createPromises, ...updatePromises]);

      const totalSaved = newItems.length + modifiedItems.length;
      alerts.basicAlert('Guardado', `Se guardaron ${totalSaved} item(s) exitosamente.`, 'success');

      // Reload from server instead of just redrawRows
      if (this.currentIdDetalle) {
        this.reloadFromServer(this.currentIdDetalle);
      }
    } catch (error) {
      console.error('Error saving params:', error);
      alerts.basicAlert('Error', 'Error al guardar los parámetros', 'error');
    }
  }

  private async reloadFromServer(idDetalle: number): Promise<void> {
    try {
      const params = await lastValueFrom(this.preparacionService.getParams(idDetalle));
      console.log('[parametros.reloadFromServer] Datos recibidos:', params);
      console.log('[parametros.reloadFromServer] Cantidad de parámetros:', params.length);

      this.rowData = params.map((item: any) => ({
        id: item.id,
        idDetalle: item.idDetalle,
        parametro1: item.parametro1 || '',
        parametro2: item.parametro2 || '',
        parametro3: item.parametro3 || '',
        parametro4: item.parametro4 || '',
        parametro5: item.parametro5 || '',
        __isNew: false,
        __modified: false
      }));
      this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
      this.hasUnsavedChanges = false;

      if (this.gridApi && !this.gridApi.isDestroyed()) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.gridApi.redrawRows();
      }

      // Update parent row's parametros count
      if (this.internalParams?.data) {
        console.log('[parametros.reloadFromServer] Actualizando contador en fila padre');
        console.log('[parametros.reloadFromServer] Nuevo contador:', this.rowData.length);
        this.internalParams.data.parametrosCount = this.rowData.length;

        // Redraw the entire parent grid to reflect the updated count
        if (this.internalParams.api && this.internalParams.node) {
          console.log('[parametros.reloadFromServer] Redibujando fila del grid padre');
          this.internalParams.api.redrawRows({ rowNodes: [this.internalParams.node] });
        }
      }
    } catch (error) {
      console.error('Error reloading params:', error);
    }
  }

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

  onCellClicked(event: any) {}

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    this.hasRowSelected = selectedNodes.length > 0;
  }
}
