import { Component, OnInit, OnChanges, SimpleChanges, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-historial-jarabe',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <div style="padding: 5px; background-color: #fff3e0; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;">
      
      <div style="margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
        <strong>Historial de Gastos</strong>
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
export class HistorialJarabeComponent implements OnInit, OnChanges {

  @Input() params: any;
  private internalParams: any;
  private gridApi!: GridApi;
  private dataLoaded: boolean = false;

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
  }

  loadData(): void {
    if (!this.internalParams || this.dataLoaded) return;
    
    const historialData = this.internalParams?.data?.historialData || [];
    this.rowData = historialData.map((item: any, index: number) => ({
      ...item,
      id: item.id || `temp_${Date.now()}_${index}`,
      __isNew: item.__isNew || false,
      __modified: item.__modified || false,
      saved: item.saved !== false
    }));
    this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
    this.dataLoaded = true;

    if (this.gridApi) {
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
        field: 'pdf',
        headerName: 'PDF',
        width: 60,
        editable: false,
        cellStyle: { backgroundColor: '#fff3e0', textAlign: 'center' },
        cellRenderer: () => {
          return '<i class="bi bi-file-earmark-pdf" style="color: #dc3545; font-size: 16px; cursor: pointer;"></i>';
        }
      },
      {
        field: 'fechaSalida',
        headerName: 'Fecha de Salida',
        width: 130,
        editable: true,
        cellEditor: 'agDateCellEditor',
        valueFormatter: (params) => {
          if (!params.value) return '';
          const [y, m, d] = String(params.value).split('-');
          return d && m && y ? `${d}/${m}/${y}` : params.value;
        },
        valueSetter: (params) => {
          if (!params.newValue) return false;
          if (params.newValue instanceof Date) {
            const d = params.newValue;
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            params.data.fechaSalida = `${y}-${m}-${day}`;
          } else {
            params.data.fechaSalida = String(params.newValue).substring(0, 10);
          }
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      },
      {
        field: 'quienUso',
        headerName: 'Quien Uso',
        width: 150,
        editable: true,
        cellEditor: 'agTextCellEditor',
        valueSetter: (params) => {
          params.data.quienUso = params.newValue ? params.newValue.toUpperCase() : '';
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      },
      {
        field: 'cantidadSalida',
        headerName: 'Cantidad Salida',
        width: 130,
        editable: true,
        type: 'numericColumn',
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: { min: 0, precision: 2 },
        valueSetter: (params) => {
          params.data.cantidadSalida = params.newValue;
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      },
      {
        field: 'cantidadExistencia',
        headerName: 'Cantidad Existencia',
        width: 140,
        editable: true,
        type: 'numericColumn',
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: { min: 0, precision: 2 },
        valueSetter: (params) => {
          params.data.cantidadExistencia = params.newValue;
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      },
      {
        field: 'loteProductoUso',
        headerName: 'Lote Producto Uso',
        width: 150,
        editable: true,
        cellEditor: 'agTextCellEditor',
        valueSetter: (params) => {
          params.data.loteProductoUso = params.newValue ? params.newValue.toUpperCase() : '';
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      },
      {
        field: 'nombreIngreso',
        headerName: 'Nombre de Ingreso',
        width: 160,
        editable: true,
        cellEditor: 'agTextCellEditor',
        valueSetter: (params) => {
          params.data.nombreIngreso = params.newValue ? params.newValue.toUpperCase() : '';
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      },
      {
        field: 'numeroReporte',
        headerName: 'Numero del Reporte',
        width: 150,
        editable: true,
        cellEditor: 'agTextCellEditor',
        valueSetter: (params) => {
          params.data.numeroReporte = params.newValue ? params.newValue.toUpperCase() : '';
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      },
      {
        field: 'adicional',
        headerName: 'Adicional',
        flex: 1,
        editable: true,
        cellEditor: 'agLargeTextCellEditor',
        cellEditorPopup: true,
        valueSetter: (params) => {
          params.data.adicional = params.newValue ? params.newValue.toUpperCase() : '';
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
    const tempId = `temp_historial_${Date.now()}_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      fechaSalida: new Date().toISOString().split('T')[0],
      quienUso: '',
      cantidadSalida: 0,
      cantidadExistencia: 0,
      loteProductoUso: '',
      nombreIngreso: '',
      numeroReporte: '',
      adicional: '',
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
        colKey: 'fechaSalida'
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
      `¿Está seguro de eliminar el registro del ${selectedItem.fechaSalida}?`,
      'warning',
      'Sí, eliminar'
    );

    if (!result.isConfirmed) return;

    this.rowData = this.rowData.filter(item => item.id !== selectedItem.id);
    this.originalRowData = this.originalRowData.filter(item => item.id !== selectedItem.id);
    this.gridApi.setGridOption('rowData', this.rowData);
    this.hasUnsavedChanges = this.rowData.some(item => item.__isNew || item.__modified);

    alerts.basicAlert('Eliminado', 'Item eliminado correctamente', 'success');
  }

  saveChanges() {
    const newItems = this.rowData.filter(item => item.__isNew);
    const modifiedItems = this.rowData.filter(item => item.__modified && !item.__isNew);

    if (newItems.length === 0 && modifiedItems.length === 0) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    this.rowData.forEach(item => {
      if (item.__isNew || item.__modified) {
        item.__isNew = false;
        item.__modified = false;
        item.saved = true;
      }
    });

    this.hasUnsavedChanges = false;
    this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
    this.gridApi.redrawRows();

    const totalSaved = newItems.length + modifiedItems.length;
    alerts.basicAlert('Guardado', `Se guardaron ${totalSaved} item(s) exitosamente.`, 'success');
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
