import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { CustomersService } from 'app/services/customers.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { concat, toArray } from 'rxjs';

@Component({
  selector: 'app-provider-detail-cell-renderer',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <div class="provider-detail-container" style="background-color: #f0f8ff; padding: 15px; border: 1px solid #ccc;">
      <div style="margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h5 style="color: #333; margin: 0;">🚀 Precios Proveedor {{providerNumber}}</h5>
          <select
            class="form-select form-select-sm"
            [(ngModel)]="selectedProviderId"
            (ngModelChange)="onProviderChange($event)"
            style="width: 200px; font-size: 12px;">
            <option value="">-- Seleccionar Proveedor --</option>
            <option *ngFor="let provider of availableProviders" [value]="provider.id">
              {{provider.company}}
            </option>
          </select>
        </div>

        <div style="display: flex; gap: 5px; justify-content: flex-end;">
          <button type="button" class="btn btn-success btn-sm" (click)="saveChanges()">
            💾 Guardar
          </button>
          <button type="button" class="btn btn-warning btn-sm" (click)="revertChanges()">
            ↻ Deshacer
          </button>
          <button type="button" class="btn btn-danger btn-sm" (click)="deleteSelectedRow()">
            🗑️ Eliminar
          </button>
        </div>
      </div>

      <ag-grid-angular
        style="width: 100%; height: 300px;"
        class="ag-theme-quartz small-text-ag-grid"
        [rowData]="pricingData"
        [columnDefs]="colPricing"
        [gridOptions]="gridOptions"
        (gridReady)="onGridReady($event)"
        [rowSelection]="'single'"
        [stopEditingWhenCellsLoseFocus]="true">
      </ag-grid-angular>
    </div>
  `,
  styles: [`
    .provider-detail-container {
      min-height: 300px;
      background-color: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 5px;
    }
  `]
})
export class ProviderDetailCellRendererComponent {
  private params: any;
  private gridApi!: GridApi;
  private tempIdCounter: number = 0;
  private customersService = inject(CustomersService);
  private ocAndReqsService = inject(OcAndReqsService);

  pricingData: any[] = [];
  providerNumber: number = 1;
  quoteData: any = null;
  productos: any[] = [];
  availableProviders: any[] = [];
  selectedProviderId: number | null = null;
  availableMaterials: any[] = [];

  gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
  };

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.providerNumber = params.data.providerNumber || 1;
    this.quoteData = params.data;
    this.productos = params.context?.productos || [];
    this.availableMaterials = params.context?.quoteDetails || [];

    console.log('ProviderDetailCellRenderer agInit called with:', {
      providerNumber: this.providerNumber,
      quoteData: this.quoteData,
      productos: this.productos,
      availableMaterials: this.availableMaterials,
      context: params.context
    });

    // Load available providers
    this.loadProviders();

    // Initialize pricing data from quote data
    const providerKey = `proveedor${this.providerNumber}`;
    this.pricingData = this.quoteData[`${providerKey}Data`] || [];

    console.log(`Initializing cascade ${this.providerNumber} with ${this.pricingData.length} items:`, this.pricingData);

    // Initialize with empty rows for user to fill
    if (this.pricingData.length === 0) {
      console.log('No pricing data, initializing with empty rows');
      this.initializeEmptyRows();
    }
  }

  loadProviders() {
    const idRoot = this.params?.context?.idRoot;

    if (idRoot) {
      this.customersService.getProviders(idRoot, 'PROVIDERS').subscribe({
        next: (data: any[]) => {
          this.availableProviders = data;
          console.log('Providers loaded for cascade:', this.availableProviders);
        },
        error: (error) => {
          console.error('Error loading providers:', error);
          this.availableProviders = [];
        }
      });
    }
  }

  onProviderChange(providerId: number) {
    console.log('Provider changed to:', providerId);
    // Here you could update the pricing data based on the selected provider
    // For now, just store the selection
    this.selectedProviderId = providerId;
  }

  initializeEmptyRows() {
    // Create a few empty rows for the user to fill
    const emptyRows = [];
    for (let i = 0; i < 5; i++) {
      emptyRows.push({
        id: `empty_${this.tempIdCounter++}_${i}`,
        idQuoteItem: null,
        productName: '',
        quantity: 0,
        price: 0,
        comment: '',
        __isNew: true,
        __isEmpty: true
      });
    }
    this.pricingData = emptyRows;
  }

  getMaterialDisplayName(item: any): string {
    const product = this.productos.find((p: any) => p.id === item.idSupplie);
    const productName = product ? product.description : `Producto ${item.idSupplie}`;
    return `${productName} (Cant: ${item.quantity})`;
  }

  onMaterialSelectionChanged(params: any) {
    const selectedMaterialId = params.newValue;
    const rowData = params.data;

    if (!selectedMaterialId) {
      // Clear the row if no material selected
      rowData.quantity = 0;
      rowData.comment = '';
      rowData.productName = '';
      rowData.idSupplie = null;
      rowData.dateuse = null;
      return;
    }

    // Find the selected material
    const selectedMaterial = this.availableMaterials.find(item => item.id === selectedMaterialId);
    if (!selectedMaterial) {
      console.error('Selected material not found:', selectedMaterialId);
      return;
    }

    // Find product details
    const product = this.productos.find((p: any) => p.id === selectedMaterial.idSupplie);

    // Auto-fill the row
    rowData.quantity = selectedMaterial.quantity;
    rowData.comment = selectedMaterial.comment || '';
    rowData.productName = product ? product.description : `Producto ${selectedMaterial.idSupplie}`;
    rowData.idSupplie = selectedMaterial.idSupplie;
    rowData.dateuse = selectedMaterial.dateuse;
    rowData.__isEmpty = false;

    // Refresh the grid to show changes
    if (this.gridApi) {
      this.gridApi.refreshCells({
        rowNodes: [params.node],
        force: true
      });
    }

    console.log('Material selected and row auto-filled:', rowData);
  }

  initializePricingFromDetails(details: any[]) {
    this.pricingData = details.map((detail: any, index: number) => {
      const product = this.productos.find((p: any) => p.id === detail.idSupplie);
      return {
        id: `temp_${this.tempIdCounter++}_${index}`,
        idQuoteItem: detail.id,
        productName: product ? product.description : `Producto ${detail.idSupplie}`,
        quantity: detail.quantity,
        price: 0,
        comment: '',
        __isNew: true
      };
    });
  }

  get colPricing(): ColDef[] {
    return [
      {
        field: 'idQuoteItem',
        headerName: 'Material Requisición',
        editable: true,
        flex: 3,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.availableMaterials.map(item => item.id),
        },
        valueFormatter: (params) => {
          if (!params.value) return '-- Seleccionar --';
          const material = this.availableMaterials.find(item => item.id === params.value);
          return material ? this.getMaterialDisplayName(material) : params.value;
        },
        onCellValueChanged: (params) => {
          this.onMaterialSelectionChanged(params);
        }
      },
      {
        field: 'quantity',
        headerName: 'Cantidad',
        editable: false,
        flex: 1,
      },
      {
        field: 'price',
        headerName: 'Precio',
        editable: true,
        flex: 2,
        valueFormatter: (params) => {
          return params.value ? `$${params.value.toFixed(2)}` : '$0.00';
        },
        valueSetter: (params) => {
          params.data.price = parseFloat(params.newValue) || 0;
          return true;
        }
      },
      {
        field: 'comment',
        headerName: 'Comentarios',
        editable: true,
        flex: 2,
        cellEditor: 'agTextCellEditor'
      }
    ];
  }


  saveChanges() {
    if (!this.selectedProviderId) {
      alerts.basicAlert('Proveedor requerido', 'Por favor selecciona un proveedor antes de guardar', 'warning');
      return;
    }

    // Filter out empty rows (rows without material selected) and validate data
    const validRows = this.pricingData.filter(row =>
      row.idQuoteItem && !row.__isEmpty && row.quantity > 0
    );

    if (validRows.length === 0) {
      alerts.basicAlert('Datos requeridos', 'No hay filas con materiales seleccionados para guardar', 'warning');
      return;
    }

    // Validate that all valid rows have prices
    const invalidRows = validRows.filter(row => row.price <= 0);
    if (invalidRows.length > 0) {
      alerts.basicAlert('Precio requerido', 'Todas las filas deben tener un precio mayor a 0', 'warning');
      return;
    }

    // Mark rows as modified
    validRows.forEach(row => {
      row.__modified = true;
      row.providerId = this.selectedProviderId; // Associate with selected provider
    });

    // Update the quote data with the pricing information
    const providerKey = `proveedor${this.providerNumber}`;
    this.quoteData[`${providerKey}Data`] = validRows;
    this.quoteData[`${providerKey}Count`] = validRows.length;

    // Mark quote as modified
    this.quoteData.__modified = true;

    console.log(`Saved ${validRows.length} pricing items for provider ${this.providerNumber}`);
    alerts.basicAlert('Datos guardados', `Se guardaron ${validRows.length} precios para el proveedor`, 'success');
  }

  revertChanges() {
    // Reload the original data from quote data
    const providerKey = `proveedor${this.providerNumber}`;
    this.pricingData = this.quoteData[`${providerKey}Data`] || [];

    // Refresh the grid
    this.gridApi.setGridOption('rowData', this.pricingData);

    alerts.basicAlert('Deshecho', 'Los cambios han sido revertidos', 'info');
  }

  deleteSelectedRow() {
    const selectedRows = this.gridApi.getSelectedRows();
    if (selectedRows.length === 0) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione una fila para eliminar', 'warning');
      return;
    }

    // Remove from data array
    const selectedRow = selectedRows[0];
    const index = this.pricingData.indexOf(selectedRow);
    if (index > -1) {
      this.pricingData.splice(index, 1);
      this.gridApi.setGridOption('rowData', this.pricingData);

      // Update count
      const providerKey = `proveedor${this.providerNumber}`;
      this.quoteData[`${providerKey}Count`] = this.pricingData.length;

      // Update master grid
      if (this.params?.api) {
        this.params.api.refreshCells({
          rowNodes: [this.params.node],
          columns: [`${providerKey}`],
          force: true
        });
      }
    }

    alerts.basicAlert('Eliminado', 'La fila ha sido eliminada', 'success');
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  refresh(params: ICellRendererParams): boolean {
    return false;
  }
}