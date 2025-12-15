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
      <div class="mb-2 d-flex justify-content-between align-items-end gap-3">
        <div style="flex: 1;">
          <label for="pdfQuote" class="form-label">PDF Cotización:</label>
          <div class="input-group">
            <input type="text" id="pdfQuote" class="form-control" [(ngModel)]="pdfFileName" placeholder="Seleccione archivo PDF" readonly>
            <input type="file" #fileInput accept=".pdf" style="display: none;" (change)="onFileSelected($event)">
            <button class="btn btn-outline-secondary" type="button" (click)="fileInput.click()">
              <i class="bi bi-folder"></i>
            </button>
          </div>
        </div>
        <div style="flex: 0 0 auto;">
          <label for="receptionDate" class="form-label">Fecha Proveedor:</label>
          <input type="date" id="receptionDate" class="form-control" [(ngModel)]="receptionDate">
        </div>
        <div style="flex: 1;">
          <label for="providerSelect" class="form-label">Seleccionar Proveedor:</label>
          <select id="providerSelect" class="form-select" [(ngModel)]="selectedProviderId" (ngModelChange)="onProviderChange()">
            <option value="1">Proveedor A</option>
            <option value="2">Proveedor B</option>
            <option value="3">Proveedor C</option>
          </select>
        </div>
        <div class="d-flex gap-2" style="flex: 0 0 auto;">
          <button type="button" class="btn btn-sm btn-success position-relative" (click)="saveItem()" title="Guardar cambios">
            <i class="bi bi-floppy"></i>
            <span
              class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
              *ngIf="masterNotSavedChanges">
              <span class="visually-hidden">Hay cambios sin guardar</span>
            </span>
          </button>
          <button type="button" class="btn btn-sm btn-warning" (click)="revertItem()" title="Deshacer cambios">
            <i class="bi bi-arrow-clockwise"></i>
          </button>
          <button type="button" class="btn btn-sm btn-danger" (click)="deleteItem()" title="Eliminar requisición">
            <i class="bi bi-trash"></i>
          </button>
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
  receptionDate: string = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
  pdfFileName: string = '';
  selectedFile: File | null = null;
      masterNotSavedChanges: boolean = false;
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

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      this.selectedFile = file;
      this.pdfFileName = file.name;
    } else if (file) {
      alert('Por favor seleccione un archivo PDF válido');
      this.pdfFileName = '';
      this.selectedFile = null;
    }
  }

  get colDefs(): ColDef[] {
    return [
      {
        field: 'active',
        headerName: 'Activo',
        width: 90,
        
      },

      {
        field: 'numarticle',
        headerName: '# Articulo',
        width: 150,
        
      },

      {
        field: 'name',
        headerName: 'Articulo',
        width: 150
      },
      
      {
        field: 'unitCost',
        headerName: 'Codigo Externo',
        width: 120
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

saveItem() {

}

deleteItem()
{

}

revertItem(){

}

}