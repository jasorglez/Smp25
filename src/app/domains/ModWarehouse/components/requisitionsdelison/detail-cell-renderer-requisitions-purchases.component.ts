import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-detail-cell-renderer-requisitions-purchases',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
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
export class DetailCellRendererRequisitionsPurchasesComponent implements OnInit {

  private params!: any;
  private gridApi!: GridApi;
  private context: any;
  private ocAndReqsService = inject(OcAndReqsService);

  rowData: any[] = [];
  originalRowData: any[] = []; // Para poder deshacer cambios
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  requisitionId: number = 0;

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    this.loadData();
  }

  agInit(params: any): void {
    this.params = params;
    this.context = params.context;
    this.loadData();
  }

  loadData() {
    if (!this.params || !this.params.data) {
      console.warn('⚠️ No hay params disponibles para cargar items');
      return;
    }

    this.requisitionId = this.params.data.id;


    // ✅ Llamar al servicio real
    this.ocAndReqsService.getReqItems(this.requisitionId).subscribe({
      next: (data: any) => {

        // Mapear los datos del servidor al formato del grid
        this.rowData = Array.isArray(data) ? data.map((item: any) => ({
          id: item.id,
          idRequisition: item.idMovement, // El servidor usa idMovement
          idSupplie: item.idSupplie,
          code: item.code || '',
          description: item.description || '',
          measure: item.measure || '',
          quantity: item.quantity || 0,
          price: item.price || 0,
          total: item.total || 0,
          type: item.type || 'REQUIS',
          idProvider: item.idProvider || 0,
          comment: item.comment || '',
          dateuse: item.dateuse || new Date().toISOString(),
          active: item.active !== undefined ? item.active : true,
          __isNew: false,
          __modified: false
        })) : [];

        this.originalRowData = JSON.parse(JSON.stringify(this.rowData));

        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }

      },
      error: (error) => {
        console.error('❌ Error al cargar items:', error);
        this.rowData = [];
        this.originalRowData = [];

        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', []);
        }
      }
    });
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
        field: 'code',
        headerName: 'Código',
        width: 100,
        editable: true,
        valueSetter: (params: any) => {
          params.data.code = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'description',
        headerName: 'Descripción',
        width: 250,
        editable: true,
        valueSetter: (params: any) => {
          params.data.description = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'measure',
        headerName: 'Unidad',
        width: 100,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['PZA', 'KG', 'LT', 'MT', 'CJA', 'PAQ']
        },
        valueSetter: (params: any) => {
          params.data.measure = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'quantity',
        headerName: 'Cantidad',
        width: 100,
        editable: true,
        type: 'numericColumn',
        valueFormatter: (params: any) => {
          if (!params.value && params.value !== 0) return '';
          return params.value.toLocaleString();
        }
      },
      {
        field: 'price',
        headerName: 'Precio',
        width: 120,
        editable: true,
        type: 'numericColumn',
        valueFormatter: (params: any) => {
          if (!params.value && params.value !== 0) return '';
          return `$${params.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
      },
      {
        field: 'total',
        headerName: 'Total',
        width: 120,
        editable: false,
        type: 'numericColumn',
        valueGetter: (params: any) => {
          const quantity = params.data.quantity || 0;
          const price = params.data.price || 0;
          return quantity * price;
        },
        valueFormatter: (params: any) => {
          if (!params.value && params.value !== 0) return '';
          return `$${params.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
      },
      {
        field: 'comment',
        headerName: 'Comentario',
        width: 200,
        editable: true,
        valueSetter: (params: any) => {
          params.data.comment = params.newValue || '';
          return true;
        }
      },
      {
        field: 'dateuse',
        headerName: 'Fecha de Uso',
        width: 120,
        editable: true,
        valueFormatter: (params: any) => {
          if (!params.value) return '';
          return new Date(params.value).toLocaleDateString();
        },
        valueSetter: (params: any) => {
          params.data.dateuse = params.newValue;
          return true;
        }
      },
      {
        field: 'active',
        headerName: 'Activo',
        width: 80,
        editable: true,
        cellRenderer: (params: any) => {
          return params.value ? '✓' : '✗';
        },
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: [true, false]
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

  addItem() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idMovement: this.requisitionId,
      idSupplie: 0,
      code: '',
      description: '',
      measure: 'PZA',
      quantity: 0,
      price: 0,
      total: 0,
      type: 'REQUIS',
      idProvider: 0,
      comment: '',
      dateuse: new Date().toISOString(),
      active: true,
      __isNew: true,
      __modified: false
    };

    this.rowData = [...this.rowData, newItem];
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    setTimeout(() => {
      const lastRowIndex = this.rowData.length - 1;
      this.gridApi.ensureIndexVisible(lastRowIndex);
      this.gridApi.startEditingCell({
        rowIndex: lastRowIndex,
        colKey: 'code'
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

    // Si es un item nuevo (no guardado), solo eliminarlo del grid
    if (selectedItem.__isNew) {
      this.rowData = this.rowData.filter(item => item.id !== selectedItem.id);
      this.gridApi.setGridOption('rowData', this.rowData);
      this.hasUnsavedChanges = true;
      return;
    }

    // Si es un item guardado, eliminarlo del servidor
    try {
      await this.ocAndReqsService.deleteReqItem(selectedItem.id).toPromise();
      this.rowData = this.rowData.filter(item => item.id !== selectedItem.id);
      this.gridApi.setGridOption('rowData', this.rowData);
      alerts.basicAlert('Eliminado', 'El item ha sido eliminado correctamente', 'success');
    } catch (error) {
      console.error('❌ Error al eliminar item:', error);
      alerts.basicAlert('Error', 'No se pudo eliminar el item', 'error');
    }
  }

  async saveChanges() {
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    try {
      // Separar items nuevos de items modificados
      const newItems = this.rowData.filter(item => item.__isNew);
      const modifiedItems = this.rowData.filter(item => item.__modified && !item.__isNew);

      // Guardar items nuevos
      for (const item of newItems) {
        const itemData = {
          idMovement: this.requisitionId,
          idSupplie: item.idSupplie || 0,
          code: item.code || '',
          description: item.description || '',
          measure: item.measure || 'PZA',
          quantity: item.quantity || 0,
          price: item.price || 0,
          total: (item.quantity || 0) * (item.price || 0),
          type: 'REQUIS',
          idProvider: item.idProvider || 0,
          comment: item.comment || '',
          dateuse: item.dateuse || new Date().toISOString(),
          active: item.active !== undefined ? item.active : true
        };

        await this.ocAndReqsService.addReqItem(itemData).toPromise();
      }

      // Actualizar items modificados
      for (const item of modifiedItems) {
        const itemData = {
          id: item.id,
          idMovement: this.requisitionId,
          idSupplie: item.idSupplie || 0,
          code: item.code || '',
          description: item.description || '',
          measure: item.measure || 'PZA',
          quantity: item.quantity || 0,
          price: item.price || 0,
          total: (item.quantity || 0) * (item.price || 0),
          type: 'REQUIS',
          idProvider: item.idProvider || 0,
          comment: item.comment || '',
          dateuse: item.dateuse || new Date().toISOString(),
          active: item.active !== undefined ? item.active : true
        };

        await this.ocAndReqsService.updateReqItem(item.id, itemData).toPromise();
      }

      alerts.basicAlert('Guardado', 'Los cambios han sido guardados correctamente', 'success');
      this.hasUnsavedChanges = false;

      // Recargar datos desde el servidor
      this.loadData();
    } catch (error) {
      console.error('❌ Error al guardar cambios:', error);
      alerts.basicAlert('Error', 'No se pudieron guardar los cambios', 'error');
    }
  }

  discardChanges() {
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por descartar', 'info');
      return;
    }

    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.gridApi.setGridOption('rowData', this.rowData);
    this.hasUnsavedChanges = false;
    alerts.basicAlert('Cambios descartados', 'Los cambios han sido descartados', 'info');
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }
}
