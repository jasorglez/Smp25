import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';

@Component({
  selector: 'app-detail-cell-renderer-quotes-providers',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <div class="detail-grid-container">
      <div class="detail-actions d-flex justify-content-end mb-2">
        <button class="btn btn-primary btn-sm me-2" (click)="addProvider()">
          <i class="bi bi-plus-lg"></i> Agregar Proveedor
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
      background-color: #fce4ec;
    }
  `]
})
export class DetailCellRendererQuotesProvidersComponent implements OnInit {

  private params!: any;
  private gridApi!: GridApi;
  private context: any;

  rowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;

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
    if (this.context && this.context.componentParent) {
      // Load providers data from parent
      this.rowData = this.params.data.providers || [];
    }
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
        width: 130,
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
        width: 140,
        editable: true,
        type: 'numericColumn'
      },
      {
        field: 'totalCost',
        headerName: 'Costo Total',
        width: 120,
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
        width: 100,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Sí', 'No']
        }
      },
      {
        field: 'oc',
        headerName: 'OC',
        width: 100,
        editable: true
      },
      {
        field: 'name',
        headerName: 'PDF Cotizacion',
        width: 120,
        editable: true
      }
    ];
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    rowSelection: 'single'
  };

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addProvider() {
    const tempId = `temp_provider_${this.tempIdCounter++}`;
    const newProvider = {
      id: tempId,
      name: '',
      receptionDate: new Date().toISOString(),
      unitCost: 0,
      minPurchase: 0,
      deliveryTime: '',
      status: 'Pendiente',
      confirmedQuantity: 0,
      totalCost: 0,
      authorized: 'No',
      oc: '',
      __isNew: true
    };

    this.rowData = [...this.rowData, newProvider];
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    setTimeout(() => {
      const lastRowIndex = this.rowData.length - 1;
      this.gridApi.ensureIndexVisible(lastRowIndex);
      this.gridApi.startEditingCell({
        rowIndex: lastRowIndex,
        colKey: 'name'
      });
    }, 0);
  }

  saveChanges() {
    // Save logic here
    this.hasUnsavedChanges = false;
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }
}
