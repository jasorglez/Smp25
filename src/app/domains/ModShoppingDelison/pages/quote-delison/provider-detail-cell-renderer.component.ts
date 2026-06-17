import { inject, Component, Input, OnInit, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';

@Component({
  selector: 'app-provider-detail-cell-renderer',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <div class="provider-detail-grid-container">
      <ag-grid-angular
        #agGrid
        class="ag-theme-quartz small-text-ag-grid"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [gridOptions]="gridOptions"
        [localeText]="AG_GRID_LOCALE_ES"
        (gridReady)="onGridReady($event)"
        style="height: 200px; width: 100%;">
      </ag-grid-angular>
    </div>
  `,
  styles: [`
    .provider-detail-grid-container {
      padding: 5px;
      background-color: #e0e0e0;
    }
  `]
})
export class ProviderDetailCellRendererComponent implements OnInit {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() params: any;
  private gridApi!: GridApi;
  rowData: any[] = [];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit(): void {
    // Show providers from parent data
    this.rowData = this.params.data.providers || [];
  }

  agInit(params: ICellRendererParams): void {
    // For compatibility
  
    this.cdr.detectChanges();}

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  colDefs: ColDef[] = [
    { field: 'name', headerName: 'Nombre', width: 120 },
    { field: 'receptionDate', headerName: 'Fecha Recepción', width: 140, valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString('es-ES') : '' },
    { field: 'unitCost', headerName: 'Costo Unitario', width: 120, type: 'numericColumn' },
    { field: 'minPurchase', headerName: 'Compra Mínima', width: 120, type: 'numericColumn' },
    { field: 'deliveryTime', headerName: 'Tiempo Entrega', width: 120 },
    { field: 'status', headerName: 'Estado', width: 100 },
    { field: 'confirmedQuantity', headerName: 'Cantidad Confirmada', width: 150, type: 'numericColumn' },
    { field: 'totalCost', headerName: 'Costo Total', width: 120, type: 'numericColumn' },
    { field: 'authorized', headerName: 'Autorizado', width: 100 },
    { field: 'oc', headerName: 'OC', width: 100 }
  ];

  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    animateRows: true,
    rowSelection: 'single',
  };
}
