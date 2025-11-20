import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { SelectMaterialEditorComponent } from '../../../ModWareHousesTD/components/entry-st/select-material-editor.component';

@Component({
  selector: 'app-detail-cell-renderer-requisitions-items',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, SelectMaterialEditorComponent],
  template: `
    <div class="detail-grid-container">
      <div class="detail-actions d-flex justify-content-end mb-2">
        <button class="btn btn-primary btn-sm me-2" (click)="addItem()">
          <i class="bi bi-plus-lg"></i> Agregar
        </button>
        <button class="btn btn-warning btn-sm me-2" (click)="discardChanges()">
          <i class="bi bi-arrow-counterclockwise"></i> Deshacer
        </button>
        <button class="btn btn-danger btn-sm me-2" (click)="deleteSelectedItem()">
          <i class="bi bi-trash"></i> Eliminar
        </button>
        <button class="btn btn-success btn-sm position-relative" (click)="saveChanges()">
          <i class="bi bi-floppy"></i> Guardar
          <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
            *ngIf="hasUnsavedChanges">
            <span class="visually-hidden">Hay cambios sin guardar</span>
          </span>
        </button>
      </div>
      <ag-grid-angular
        #agGrid
        class="ag-theme-quartz small-text-ag-grid"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [gridOptions]="gridOptions"
        [localeText]="AG_GRID_LOCALE_ES"
        (gridReady)="onGridReady($event)"
        (cellValueChanged)="onCellValueChanged($event)"
        [components]="components"
        style="height: 300px; width: 100%;">
      </ag-grid-angular>
    </div>
  `,
  styles: [`
    .detail-grid-container {
      padding: 10px;
    }
  `]
})
export class DetailCellRendererRequisitionsItemsComponent implements OnInit {

  private params!: any;
  private gridApi!: GridApi;
  private context: any;

  rowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  materials: any[] = [];

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    this.loadData();
  }

  agInit(params: any): void {
    this.params = params;
    this.context = params.context;
    this.loadMaterials();
    this.loadData();
  }

  loadData() {
    if (this.context && this.context.ITEMS && this.context.ITEMS.load) {
      const requisitionId = this.params.data.id;
      this.context.ITEMS.load(requisitionId, (data: any[]) => {
        this.rowData = data.map(item => ({
          ...item,
          __isNew: false,
          __modified: false
        }));
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }
        if (this.context && this.context.ITEMS && this.context.ITEMS.updateCount) {
          this.context.ITEMS.updateCount(requisitionId, this.rowData.length);
        }
      });
    }
  }

  loadMaterials() {
    // Mock data for 20 materials
    this.materials = [
      { id: 1, description: 'Tornillos M8 x 50mm', code: 'TOR-M8-50', measure: 'Pieza', active: true },
      { id: 2, description: 'Tuercas M8', code: 'TUE-M8', measure: 'Pieza', active: true },
      { id: 3, description: 'Arandelas planas M8', code: 'ARA-PL-M8', measure: 'Pieza', active: true },
      { id: 4, description: 'Cemento Portland 50kg', code: 'CEM-POR-50', measure: 'Saco', active: true },
      { id: 5, description: 'Arena fina', code: 'ARE-FIN', measure: 'm³', active: true },
      { id: 6, description: 'Grava 3/4"', code: 'GRA-34', measure: 'm³', active: true },
      { id: 7, description: 'Varilla de acero 1/2"', code: 'VAR-12', measure: 'Metro', active: true },
      { id: 8, description: 'Varilla de acero 3/8"', code: 'VAR-38', measure: 'Metro', active: true },
      { id: 9, description: 'Alambre recocido #16', code: 'ALA-REC-16', measure: 'Kg', active: true },
      { id: 10, description: 'Clavo 2"', code: 'CLA-2', measure: 'Kg', active: true },
      { id: 11, description: 'Pintura latex blanca 1L', code: 'PIN-LAT-BLA-1L', measure: 'Litro', active: true },
      { id: 12, description: 'Pintura latex blanca 5L', code: 'PIN-LAT-BLA-5L', measure: 'Litro', active: true },
      { id: 13, description: 'Brocha 2"', code: 'BRO-2', measure: 'Pieza', active: true },
      { id: 14, description: 'Rodillo para pintura 6"', code: 'ROD-PIN-6', measure: 'Pieza', active: true },
      { id: 15, description: 'Pegamento PVC 1L', code: 'PEG-PVC-1L', measure: 'Litro', active: true },
      { id: 16, description: 'Tubo PVC 1/2" x 3m', code: 'TUB-PVC-12-3M', measure: 'Pieza', active: true },
      { id: 17, description: 'Codo PVC 1/2"', code: 'COD-PVC-12', measure: 'Pieza', active: true },
      { id: 18, description: 'Cable eléctrico 12 AWG', code: 'CAB-ELE-12', measure: 'Metro', active: true },
      { id: 19, description: 'Interruptor simple', code: 'INT-SIM', measure: 'Pieza', active: true },
      { id: 20, description: 'Toma corriente', code: 'TOM-COR', measure: 'Pieza', active: true }
    ];
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  get colDefs(): ColDef[] {
    return [
      {
        headerName: '#',
        width: 50,
        valueGetter: (params) => params.node.rowIndex + 1,
        pinned: 'left',
        cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' }
      },

       {
        field: 'recurrent',
        headerName: 'Recurrente',
        width: 120,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Recurrente', 'Nuevo']
        },
        valueSetter: (params: any) => {
          params.data.recurrent = params.newValue;
          return true;
        }
      },

      {
        field: 'article',
        headerName: 'Articulos',
        width: 300,
        cellDataType: false, // Desactivar auto-detección de tipo
        editable: true,
        cellEditor: 'selectMaterialEditor',
        cellEditorParams: (params: any) => {
          return {
            options: (this.materials || [])
              .filter(m => m.active)
              .map(m => ({ id: m.id, description: m.description }))
          };
        },
        valueFormatter: (params: any) => {
          // Preferir el nombre guardado en la fila si existe
          if (params?.data?.article) return params.data.article;
          const material = this.materials?.find(m => String(m.id) === String(params.value) || m.description === params.value);
          return material ? material.description : (params.value ?? '');
        },
        valueSetter: (params: any) => {
          let newValue = params.newValue;

          // Si el editor devuelve un objeto { id, description }
          if (newValue && typeof newValue === 'object' && newValue.id && newValue.description) {
            const selectedMaterial = this.materials?.find(m => m.id === newValue.id);
            if (selectedMaterial) {
              params.data.materialId = selectedMaterial.id;
              params.data.article = selectedMaterial.description;
              params.data.code = selectedMaterial.code || '';
              params.data.measure = selectedMaterial.measure || '';
            }
            return true;
          }

          // Fallback for other cases
          const selectedMaterial = this.materials?.find(m => String(m.id) === String(newValue) || m.description === newValue);
          if (selectedMaterial) {
            params.data.materialId = selectedMaterial.id;
            params.data.article = selectedMaterial.description;
            params.data.code = selectedMaterial.code || '';
            params.data.measure = selectedMaterial.measure || '';
          }

          return true;
        },
        cellStyle: (params: any) => {
          if (!params.value && !params?.data?.article) {
            return { backgroundColor: '#f9f9f9', color: '#777' };
          }
          return null;
        },
        suppressMovable: true,
        filter: true,
        filterParams: {
          defaultToNothingSelected: true
        }
      },
      {
        field: 'articleNumber',
        headerName: '# del Articulo',
        width: 120,
        editable: true,
        valueSetter: (params: any) => {
          params.data.articleNumber = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'quantity',
        headerName: 'cantidad',
        width: 100,
        editable: true,
        type: 'numericColumn'
      },
      {
        field: 'type',
        headerName: 'Tipo',
        width: 100,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Interno', 'Externo']
        },
        valueSetter: (params: any) => {
          params.data.type = params.newValue;
          return true;
        }
      },
      {
        field: 'comment',
        headerName: 'Observaciones',
        width: 300,
        editable: true,
        valueSetter: (params: any) => {
          params.data.comment = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      }
    ];
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    rowSelection: 'single',
    onCellValueChanged: (event: any) => {
      event.data.__modified = true;
      this.hasUnsavedChanges = true;
    }
  };

  components = {
    selectMaterialEditor: SelectMaterialEditorComponent
  };

  addItem() {
    const tempId = `temp_item_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      article: '',
      quantity: 1,
      recurrent: 'Recurrente',
      type: 'Interno',
      comment: '',
      __isNew: true,
      __modified: false
    };

    this.rowData = [...this.rowData, newItem];
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    if (this.context && this.context.ITEMS && this.context.ITEMS.updateCount) {
      this.context.ITEMS.updateCount(this.params.data.id, this.rowData.length);
    }

    setTimeout(() => {
      const lastRowIndex = this.rowData.length - 1;
      this.gridApi.ensureIndexVisible(lastRowIndex);
      this.gridApi.startEditingCell({
        rowIndex: lastRowIndex,
        colKey: 'article'
      });
    }, 0);
  }

  deleteSelectedItem() {
    const selectedRows = this.gridApi.getSelectedRows();
    if (selectedRows.length === 0) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un item para eliminar', 'warning');
      return;
    }

    const selectedItem = selectedRows[0];
    if (this.context && this.context.ITEMS && this.context.ITEMS.delete) {
      this.context.ITEMS.delete({ data: selectedItem, api: this.gridApi }, () => {
        this.rowData = this.rowData.filter(item => item.id !== selectedItem.id);
        this.gridApi.setGridOption('rowData', this.rowData);
        this.hasUnsavedChanges = true;

        if (this.context && this.context.ITEMS && this.context.ITEMS.updateCount) {
          this.context.ITEMS.updateCount(this.params.data.id, this.rowData.length);
        }
      });
    }
  }

  saveChanges() {
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    if (this.context && this.context.ITEMS && this.context.ITEMS.save) {
      const requisitionId = this.params.data.id;
      this.context.ITEMS.save(requisitionId, this.rowData);
      this.hasUnsavedChanges = false;
    }
  }

  discardChanges() {
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por descartar', 'info');
      return;
    }

    this.loadData();
    this.hasUnsavedChanges = false;
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }
}