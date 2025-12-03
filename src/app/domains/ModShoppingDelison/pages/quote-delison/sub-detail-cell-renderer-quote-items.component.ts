import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';

@Component({
  selector: 'app-sub-detail-cell-renderer-quote-items',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <div class="sub-detail-grid-container">
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
export class SubDetailCellRendererQuoteItemsComponent {

  private params!: ICellRendererParams;
  private gridApi!: GridApi;
  rowData: any[] = [];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.rowData = params.data.items || [];
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
      headerName: 'Proveedor Interno',
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
}