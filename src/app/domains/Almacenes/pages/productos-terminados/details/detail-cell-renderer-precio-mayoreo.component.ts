import { Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-detail-cell-renderer-precio-mayoreo',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  template: `
    <div
      style="padding: 10px; background-color: #e3f2fd; height: 100%; display: flex; flex-direction: column;">
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Detalles de Precio Mayoreo - {{ productoName }}</strong>
          <div class="d-flex gap-2">
            <button
              class="btn btn-sm btn-success me-2"
              (click)="addDescuento()"
              [disabled]="!descuentoGridApi">
              <i class="bi bi-plus-lg"></i> Agregar
            </button>
            <button
              class="btn btn-sm btn-primary me-2 position-relative"
              (click)="saveDescuentos()"
              [disabled]="!hasDescuentoChanges">
              <i class="bi bi-floppy"></i> Guardar
              <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
                *ngIf="hasDescuentoChanges">
                <span class="visually-hidden">Hay cambios sin guardar</span>
              </span>
            </button>
            <button
              class="btn btn-sm btn-warning me-2"
              (click)="revertChanges()">
              <i class="bi bi-arrow-clockwise"></i> Deshacer
            </button>
            <button
              class="btn btn-sm btn-danger"
              (click)="deleteSelectedDescuento()"
              [disabled]="!selectedDescuento">
              <i class="bi bi-trash"></i> Borrar
            </button>
          </div>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="descuentoColumnDefs"
          [rowData]="descuentoRowData"
          [gridOptions]="descuentoGridOptions"
          (gridReady)="onDescuentoGridReady($event)"
          (cellValueChanged)="onDescuentoCellValueChanged($event)"
          (selectionChanged)="onDescuentoSelectionChanged($event)">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererPrecioMayoreoComponent implements ICellRendererAngularComp {
  private trackingService = inject(TrackingService);

  private signalsService = inject(SignalsService);

  params: any;
  productoId: number;
  productoName: string;
  descuentoRowData: any[] = [];
  descuentoGridApi: any;
  selectedDescuento: any = null;
  hasDescuentoChanges: boolean = false;

  descuentoGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    rowSelection: 'single'
  };

  descuentoColumnDefs = [
    {
      field: 'columna1',
      headerName: 'OC',
      editable: true,
      width: 150
    },
    {
      field: 'columna2',
      headerName: 'Fecha',
      editable: true,
      width: 150
    },
    {
      field: 'columna3',
      headerName: 'Precio',
      editable: true,
      width: 150,
      type: 'numericColumn',
      valueFormatter: (params: any) => {
        return params.value ? `$${params.value}` : '$0';
      }
    },
    {
      field: 'columna4',
      headerName: 'Proveedor',
      editable: true,
      width: 150,
      flex: 1
    }
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.productoId = params.data.id;
    this.productoName = params.data.producto || 'Producto';

    // Cargar datos de descuentos existentes o crear datos por defecto
    this.loadDescuentoData();
  }

  refresh(): boolean {
    return false;
  }

  loadDescuentoData() {
    // Por ahora datos de ejemplo - en producción vendrían de un servicio
    this.descuentoRowData = [
      {
        id: 1, columna1: 'OC-2024-001', columna2: '2024-07-15', columna3: 88, columna4: 'Proveedor Alfa'
      },
      {
        id: 2, columna1: 'OC-2024-002', columna2: '2024-06-20', columna3: 85, columna4: 'Proveedor Beta'
      },
    ];
  }

  onDescuentoGridReady(params: any) {
    this.descuentoGridApi = params.api;
    params.api.sizeColumnsToFit();
  }

  onDescuentoCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasDescuentoChanges = true;
  }

  onDescuentoSelectionChanged(event: any): void {
    const selectedRows = event.api.getSelectedRows();
    this.selectedDescuento = selectedRows.length > 0 ? selectedRows[0] : null;
  }

  addDescuento(): void {
    if (!this.descuentoGridApi) {
      console.error('Descuento grid API not ready');
      return;
    }

    const tempId = `temp_descuento_${Date.now()}`;
    const newDescuento = {
      id: tempId,
      columna1: '',
      columna2: '',
      columna3: '',
      columna4: '',
      __isNew: true
    };

    this.descuentoRowData = [newDescuento, ...this.descuentoRowData];
    this.hasDescuentoChanges = true;

    setTimeout(() => {
      this.descuentoGridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'columna1'
      });
    }, 100);
  }

  saveDescuentos() {
    // Aquí iría la lógica para guardar los descuentos
    console.log('Guardando descuentos:', this.descuentoRowData);
    this.hasDescuentoChanges = false;
    // En producción, llamar a un servicio para guardar
  }

  revertChanges() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Deshizo cambios en detail cell renderer precio mayoreo', 'Almacenes', this.trackingService.getEmail());
    this.loadDescuentoData();
    this.hasDescuentoChanges = false;
    this.selectedDescuento = null;
  }

  deleteSelectedDescuento(): void {
    if (!this.selectedDescuento) {
      return;
    }

    this.descuentoRowData = this.descuentoRowData.filter(row => row.id !== this.selectedDescuento.id);
    this.selectedDescuento = null;
    this.hasDescuentoChanges = true;
  }
}
