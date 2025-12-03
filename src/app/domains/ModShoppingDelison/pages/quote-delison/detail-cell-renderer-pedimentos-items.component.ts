import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';

@Component({
  selector: 'app-detail-cell-renderer-pedimentos-items',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <div class="detail-grid-container">
      <div class="detail-header mb-2">
        <h6>{{ getHeaderText() }}</h6>
      </div>
      <div class="detail-actions d-flex justify-content-end mb-2" *ngIf="shouldShowActions()">
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
        style="height: 300px; width: 100%;">
      </ag-grid-angular>
    </div>
  `,
  styles: [`
    .detail-grid-container {
      padding: 10px;
      background-color: #fce4ec;
    }
    .detail-header {
      border-bottom: 1px solid #dee2e6;
      padding-bottom: 5px;
    }
  `]
})
export class DetailCellRendererPedimentosItemsComponent implements OnInit {

  private params!: any;
  private gridApi!: GridApi;

  rowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  materials: any[] = [];

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    this.loadMaterials();
    this.loadData();
  }

  agInit(params: any): void {
    this.params = params;
    this.loadMaterials();
    this.loadData();
  }

  loadData() {
    if (this.params && this.params.data) {
      const cascadeType = this.params.cascadeType || this.params.data.cascadeType;

      if (cascadeType === 'items' && this.params.data.items) {
        this.rowData = this.params.data.items.map((item: any) => ({
          ...item,
          pedimiento: false // Initialize pedimiento checkbox
        }));
      } else if (cascadeType === 'provider') {
        const providerIndex = this.params.selectedProviderIndex || this.params.data.selectedProviderIndex;
        if (this.params.data.providers && this.params.data.providers[providerIndex]) {
          this.rowData = [this.params.data.providers[providerIndex]];
        }
      }
    }
  }

  loadMaterials() {
    // Mock data for materials - same as requisitions
    this.materials = [
      { id: 1, description: 'Tornillos M8 x 50mm', code: 'TOR-M8-50', measure: 'Pieza', active: true },
      { id: 2, description: 'Jugo de Fresa', code: 'TUE-M8', measure: 'Pieza', active: true },
      { id: 3, description: 'Jugo de Naranja', code: 'ARA-PL-M8', measure: 'Pieza', active: true },
      { id: 4, description: 'Jugo de Blue Berry', code: 'CEM-POR-50', measure: 'Saco', active: true },
      { id: 5, description: 'Arena fina', code: 'ARE-FIN', measure: 'm³', active: true },
      { id: 6, description: 'Jugo Manzana', code: 'GRA-34', measure: 'm³', active: true },
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

  get colDefs(): ColDef[] {
    const cascadeType = this.params?.cascadeType || this.params?.data?.cascadeType;

    if (cascadeType === 'provider') {
      return this.getProviderColDefs();
    } else {
      return this.getItemsColDefs();
    }
  }

  getItemsColDefs(): ColDef[] {
    return [
      {
        headerName: '#',
        width: 50,
        valueGetter: (params) => params.node.rowIndex + 1,
        pinned: 'left',
        cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' }
      },

      {
        field: 'receptionDate',
        headerName: 'Fecha Recepcion',
        width: 120,
        editable: true,
        valueFormatter: (params) => {
          if (params.value) {
            return new Date(params.value).toLocaleDateString();
          }
          return '';
        }
      },
      {
        field: 'unitCost',
        headerName: 'Costo Unitario',
        width: 120,
        editable: true,
        type: 'numericColumn'
      },
      {
        field: 'minPurchase',
        headerName: 'Minimo de Compra',
        width: 130,
        editable: true,
        type: 'numericColumn'
      },
      {
        field: 'deliveryTime',
        headerName: 'Tiempo de Entrega',
        width: 160,
        editable: true
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 100,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Pendiente', 'Aprobado', 'Rechazado']
        }
      },
      {
        field: 'confirmedQuantity',
        headerName: 'Confirmar Cantidad',
        width: 150,
        editable: true,
        type: 'numericColumn'
      },
      {
        field: 'totalCost',
        headerName: 'Costo Total',
        width: 140,
        editable: true,
        type: 'numericColumn',
        valueFormatter: (params) => {
          if (params.value) {
            return `$${params.value.toLocaleString()}`;
          }
          return '';
        }
      },
      {
        field: 'authorized',
        headerName: 'Autorizo',
        width: 120,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Sí', 'No']
        }
      },
  
      {
        field: 'name',
        headerName: 'PDF Cotizacion',
        width: 140,
        editable: true
      }
    ];
  }

  getProviderColDefs(): ColDef[] {
    return [
      
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

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }


  deleteSelectedItem() {
    const selectedRows = this.gridApi.getSelectedRows();
    if (selectedRows.length === 0) {
      alert('Por favor seleccione un item para eliminar');
      return;
    }

    const selectedItem = selectedRows[0];
    this.rowData = this.rowData.filter(item => item.id !== selectedItem.id);
    this.gridApi.setGridOption('rowData', this.rowData);
    this.hasUnsavedChanges = true;
  }

  saveChanges() {
    if (!this.hasUnsavedChanges) {
      alert('No hay cambios pendientes por guardar');
      return;
    }

    // Mark items as saved
    this.rowData.forEach(item => {
      if (item.__isNew) {
        item.__isNew = false;
      }
      if (item.__modified) {
        item.__modified = false;
      }
    });

    this.hasUnsavedChanges = false;
    alert('Los items han sido guardados correctamente');
  }

  discardChanges() {
    if (!this.hasUnsavedChanges) {
      alert('No hay cambios pendientes por descartar');
      return;
    }

    this.loadData();
    this.hasUnsavedChanges = false;
  }

  getHeaderText(): string {
    const cascadeType = this.params?.cascadeType || this.params?.data?.cascadeType;
    if (cascadeType === 'provider') {
      return 'Detalles del Proveedor';
    } else {
      return 'Items del Pedimento';
    }
  }

  shouldShowActions(): boolean {
    const cascadeType = this.params?.cascadeType || this.params?.data?.cascadeType;
    return cascadeType === 'items'; // Only show actions for items cascade
  }

}