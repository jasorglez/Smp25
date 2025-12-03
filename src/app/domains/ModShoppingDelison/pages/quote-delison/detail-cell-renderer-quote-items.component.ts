import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-detail-cell-renderer-quote-items',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <div class="detail-grid-container">
      <div class="detail-actions d-flex justify-content-end mb-2">
        <button class="btn btn-primary btn-sm me-2" (click)="addItem()">
          <i class="bi bi-plus-lg"></i> Agregar Item
        </button>
        <button class="btn btn-warning btn-sm me-2" (click)="discardChanges()">
          <i class="bi bi-arrow-counterclockwise"></i> Deshacer
        </button>
        <button class="btn btn-danger btn-sm me-2" (click)="deleteSelectedItem()">
          <i class="bi bi-trash"></i> Eliminar Item
        </button>
        <button class="btn btn-success btn-sm" (click)="saveChanges()">
          <i class="bi bi-floppy"></i> Guardar Cambios
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
        style="height: 220px; width: 100%;">
      </ag-grid-angular>
    </div>
  `,
  styles: [`
    .detail-grid-container {
      padding: 10px;
      background-color: #f8f9fa;
    }
  `]
})
export class DetailCellRendererQuoteItemsComponent {

  private params!: ICellRendererParams;
  private gridApi!: GridApi;
  rowData: any[] = [];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  agInit(params: ICellRendererParams): void {
    this.params = params;
    // Aplanamos los items de todos los pedimentos en una sola lista
    if (params.data.pedimentos && Array.isArray(params.data.pedimentos)) {
      this.rowData = params.data.pedimentos.flatMap((p: any) => p.items || []);
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  colDefs: ColDef[] = [
    {
      headerName: '#',
      width: 60,
      valueGetter: (params) => params.node!.rowIndex! + 1,
      pinned: 'left'
    },
    {
      field: 'article',
      headerName: 'Artículo del Pedimento',
      editable: true,
      width: 300
    },
    {
      field: 'quantity',
      headerName: 'Cantidad',
      editable: true,
      width: 120,
      type: 'numericColumn'
    }
  ];

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    rowSelection: 'single',
    singleClickEdit: true,
  };

  // --- Lógica de botones CRUD (ejemplos) ---

  addItem() {
    alerts.basicAlert('Función no implementada', 'La lógica para agregar un nuevo item aún no se ha implementado.', 'info');
  }

  deleteSelectedItem() {
    alerts.basicAlert('Función no implementada', 'La lógica para eliminar un item aún no se ha implementado.', 'info');
  }

  saveChanges() {
    alerts.basicAlert('Función no implementada', 'La lógica para guardar cambios en los items aún no se ha implementado.', 'info');
  }

  discardChanges() {
    alerts.basicAlert('Función no implementada', 'La lógica para deshacer cambios aún no se ha implementado.', 'info');
  }
}