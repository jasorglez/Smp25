import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-sub-detail-cell-renderer-quote-items',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <div class="sub-detail-grid-container">
      <div class="sub-detail-actions d-flex justify-content-end mb-2">
    
        <button class="btn btn-warning btn-sm me-2" (click)="discardChanges()">
          <i class="bi bi-arrow-counterclockwise"></i> Deshacer
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
        style="height: 150px; width: 100%;">
      </ag-grid-angular>
    </div>
  `,
  styles: [`
    .sub-detail-grid-container {
      padding: 5px;
      background-color: #f0f0f0;
    }
  `]
})
export class SubDetailCellRendererQuoteItemsComponent implements OnInit {

  @Input() params: any;
  private gridApi!: GridApi;
  rowData: any[] = [];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit(): void {
    this.rowData = this.params.data.items || [];
  }

  agInit(params: ICellRendererParams): void {
    // For compatibility
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  colDefs: ColDef[] = [
    {
      field: 'article',
      headerName: 'Articulo',
      editable: true,
      width: 150
    },
    {
      headerName: '# Articulo',
      width: 80,
      valueGetter: (params) => params.node!.rowIndex! + 1
    },
    {
      field: 'quantity',
      headerName: 'Cantidad',
      editable: true,
      width: 100,
      type: 'numericColumn'
    },
    {
      field: 'tipo',
      headerName: 'Tipo',
      editable: true,
      width: 100
    },
    {
      field: 'proveedorInterno',
      headerName: 'Proveedor Interno2',
      editable: true,
      width: 150
    },
    {
      field: 'priority',
      headerName: 'Tipo Prioridad',
      editable: true,
      width: 120,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['Alta', 'Media', 'Baja']
      }
    },
    {
      field: 'observaciones',
      headerName: 'Observaciones',
      editable: true,
      width: 200
    },
    {
      field: 'pedimento',
      headerName: 'Pedimento',
      width: 100,
      cellRenderer: 'agCheckboxCellRenderer',
      cellEditor: 'agCheckboxCellEditor'
    }
  ];

  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    animateRows: true,
    rowSelection: 'single',
    singleClickEdit: true,
  };

  // --- Lógica de botones CRUD ---

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
