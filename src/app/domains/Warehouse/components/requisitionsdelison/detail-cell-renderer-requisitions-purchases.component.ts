import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
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
    if (this.context && this.context.PURCHASES && this.context.PURCHASES.load) {
      const requisitionId = this.params.data.id;
      this.context.PURCHASES.load(requisitionId, (data: any[]) => {
        this.rowData = data.map(item => ({
          ...item,
          __isNew: false,
          __modified: false
        }));
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }
        if (this.context && this.context.PURCHASES && this.context.PURCHASES.updateCount) {
          this.context.PURCHASES.updateCount(requisitionId, this.rowData.length);
        }
      });
    }
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
        field: 'quoteRequestDate',
        headerName: 'Fecha Pedido Cot',
        width: 140,
        editable: true,
        valueFormatter: (params: any) => {
          if (!params.value) return '';
          return new Date(params.value).toLocaleDateString();
        },
        valueSetter: (params: any) => {
          params.data.quoteRequestDate = params.newValue;
          return true;
        }
      },
      {
        field: 'quoteReceptionDate',
        headerName: 'Fecha Recepcion Cot',
        width: 150,
        editable: true,
        valueFormatter: (params: any) => {
          if (!params.value) return '';
          return new Date(params.value).toLocaleDateString();
        },
        valueSetter: (params: any) => {
          params.data.quoteReceptionDate = params.newValue;
          return true;
        }
      },
      {
        field: 'supplier',
        headerName: 'Proveedor',
        width: 200,
        editable: true,
        valueSetter: (params: any) => {
          params.data.supplier = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'unitCost',
        headerName: 'Costo Unitario',
        width: 130,
        editable: true,
        type: 'numericColumn',
        valueFormatter: (params: any) => {
          if (!params.value) return '';
          return `$${params.value.toLocaleString()}`;
        }
      },
      {
        field: 'minimumPurchase',
        headerName: 'Minimo de Compra',
        width: 140,
        editable: true,
        type: 'numericColumn'
      },
      {
        field: 'deliveryTime',
        headerName: 'Tiempo de Entrega',
        width: 140,
        editable: true,
        valueSetter: (params: any) => {
          params.data.deliveryTime = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 100,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Pendiente', 'Aprobado', 'Rechazado', 'Confirmado']
        },
        valueSetter: (params: any) => {
          params.data.status = params.newValue;
          return true;
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
        width: 120,
        editable: true,
        type: 'numericColumn',
        valueFormatter: (params: any) => {
          if (!params.value) return '';
          return `$${params.value.toLocaleString()}`;
        }
      },
      {
        field: 'authorized',
        headerName: 'Autorizo',
        width: 120,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Sí', 'No', 'Pendiente']
        },
        valueSetter: (params: any) => {
          params.data.authorized = params.newValue;
          return true;
        }
      },
      {
        field: 'confirmedQuantity',
        headerName: 'Orden Compra',
        width: 150,
        editable: true,
        type: 'stringColumn'
      },
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
    const tempId = `temp_purchase_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      quoteRequestDate: new Date().toISOString(),
      quoteReceptionDate: '',
      supplier: '',
      unitCost: 0,
      minimumPurchase: 0,
      deliveryTime: '',
      status: 'Pendiente',
      confirmedQuantity: 0,
      totalCost: 0,
      authorized: 'Pendiente',
      __isNew: true,
      __modified: false
    };

    this.rowData = [...this.rowData, newItem];
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    if (this.context && this.context.PURCHASES && this.context.PURCHASES.updateCount) {
      this.context.PURCHASES.updateCount(this.params.data.id, this.rowData.length);
    }

    setTimeout(() => {
      const lastRowIndex = this.rowData.length - 1;
      this.gridApi.ensureIndexVisible(lastRowIndex);
      this.gridApi.startEditingCell({
        rowIndex: lastRowIndex,
        colKey: 'supplier'
      });
    }, 0);
  }

  deleteSelectedItem() {
    const selectedRows = this.gridApi.getSelectedRows();
    if (selectedRows.length === 0) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un item para eliminar', 'warning');
      return;
    }

    const selectedItem = selectedRows[0];
    if (this.context && this.context.PURCHASES && this.context.PURCHASES.delete) {
      this.context.PURCHASES.delete({ data: selectedItem, api: this.gridApi }, () => {
        this.rowData = this.rowData.filter(item => item.id !== selectedItem.id);
        this.gridApi.setGridOption('rowData', this.rowData);
        this.hasUnsavedChanges = true;

        if (this.context && this.context.PURCHASES && this.context.PURCHASES.updateCount) {
          this.context.PURCHASES.updateCount(this.params.data.id, this.rowData.length);
        }
      });
    }
  }

  saveChanges() {
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    if (this.context && this.context.PURCHASES && this.context.PURCHASES.save) {
      const requisitionId = this.params.data.id;
      this.context.PURCHASES.save(requisitionId, this.rowData);
      this.hasUnsavedChanges = false;
    }
  }

  discardChanges() {
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por descartar', 'info');
      return;
    }

    this.loadData();
    this.hasUnsavedChanges = false;
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }
}