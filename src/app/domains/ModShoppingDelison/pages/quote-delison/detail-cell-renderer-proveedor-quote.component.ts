import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';

@Component({
  selector: 'app-detail-cell-renderer-proveedor-quote',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <div class="detail-grid-container">
      <div class="mb-2 d-flex justify-content-end">
        <div style="width: 50%;">
          <label for="providerSelect" class="form-label">Seleccionar Proveedor:</label>
          <select id="providerSelect" class="form-select" [(ngModel)]="selectedProviderId" (ngModelChange)="onProviderChange()">
            <option value="1">Proveedor A</option>
            <option value="2">Proveedor B</option>
            <option value="3">Proveedor C</option>
          </select>
        </div>
      </div>
      <ag-grid-angular
        class="ag-theme-quartz small-text-ag-grid"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [gridOptions]="gridOptions"
        [localeText]="AG_GRID_LOCALE_ES"
        style="height: 200px; width: 100%;">
      </ag-grid-angular>
    </div>
  `,
  styles: [`
    .detail-grid-container {
      padding: 8px;
      background-color: #f8f9fa;
      border-radius: 8px;
    }
  `]
})
export class DetailCellRendererProveedorQuoteComponent {
  private params!: ICellRendererParams;
  providers: any[] = [];
  selectedProviderId: number;
  rowData: any[] = [];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.providers = this.params.context?.providers || [];
    // Ensure we have at least 3 providers for the combo
    if (this.providers.length < 3) {
      this.providers = [
        ...this.providers,
        { id: 3, name: 'Proveedor C', receptionDate: new Date().toISOString(), unitCost: 0, minPurchase: 0, deliveryTime: '', status: '', confirmedQuantity: 0, totalCost: 0, authorized: '', oc: '' }
      ];
    }
    this.selectedProviderId = this.params.context?.selectedProviderIndex !== undefined ?
      (this.params.context.selectedProviderIndex + 1) : 1;
    this.updateRowData();
  }

  onProviderChange() {
    this.updateRowData();
  }

  updateRowData() {
    const selectedProvider = this.providers.find(p => p.id === this.selectedProviderId);
    this.rowData = selectedProvider ? [selectedProvider] : [];
  }

  get colDefs(): ColDef[] {
    return [
      {
        field: 'name',
        headerName: 'Nombre',
        width: 150
      },
      {
        field: 'receptionDate',
        headerName: 'Fecha Recepción',
        width: 150,
        valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString() : ''
      },
      {
        field: 'unitCost',
        headerName: 'Costo Unitario',
        width: 120
      },
      {
        field: 'minPurchase',
        headerName: 'Compra Mínima',
        width: 120
      },
      {
        field: 'deliveryTime',
        headerName: 'Tiempo Entrega',
        width: 120
      },
      {
        field: 'status',
        headerName: 'Estado',
        width: 100
      },
      {
        field: 'confirmedQuantity',
        headerName: 'Cantidad Confirmada',
        width: 150
      },
      {
        field: 'totalCost',
        headerName: 'Costo Total',
        width: 120
      },
      {
        field: 'authorized',
        headerName: 'Autorizado',
        width: 100
      },
      {
        field: 'oc',
        headerName: 'OC',
        width: 100
      }
    ];
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true
  };
}