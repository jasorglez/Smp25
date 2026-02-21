import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { LogbookService } from 'app/services/logbook.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-bitacora-fotos',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div class="detail-grid-container">
      <div class="detail-actions d-flex align-items-center mb-1 gap-1">
        <button class="btn btn-outline-secondary btn-sm" (click)="closeDetail()">
          <i class="bi bi-x-lg"></i>
        </button>
        <button class="btn btn-primary btn-sm" (click)="addRow()">
          <i class="bi bi-plus-lg"></i>
        </button>
        <button class="btn btn-warning btn-sm" (click)="discardChanges()">
          <i class="bi bi-arrow-counterclockwise"></i>
        </button>
        <button class="btn btn-danger btn-sm" (click)="deleteSelected()">
          <i class="bi bi-trash"></i>
        </button>
        <button class="btn btn-success btn-sm position-relative" (click)="saveChanges()">
          <i class="bi bi-floppy"></i>
          <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
            *ngIf="hasUnsavedChanges"></span>
        </button>
      </div>
      <ag-grid-angular
        class="ag-theme-quartz small-text-ag-grid"
        [rowData]="rowData"
        [columnDefs]="columnDefs"
        [gridOptions]="gridOptions"
        (gridReady)="onGridReady($event)"
        (cellValueChanged)="onCellValueChanged($event)"
        style="height: 300px; width: 100%;">
      </ag-grid-angular>
    </div>
  `,
  styles: [`.detail-grid-container { padding: 5px; background-color: #f8f9fa; border-radius: 4px; }`, `.gap-1 { gap: 4px !important; }`]
})
export class BitacoraFotosComponent {
  private logbookService = inject(LogbookService);
  private gridApi!: GridApi;
  private context: any;

  rowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  reportData: any = null;
  tempIdCounter: number = 0;

  columnDefs: ColDef[] = [
    { headerName: '#', width: 50, valueGetter: (p) => p.node!.rowIndex! + 1, pinned: 'left' },
    { field: 'date', headerName: 'Fecha', editable: true, width: 120 },
    { field: 'imageUrl', headerName: 'URL Imagen', editable: true, width: 250 },
    { field: 'description', headerName: 'Descripción', editable: true, flex: 1 },
  ];

  gridOptions: any = { headerHeight: 30, rowHeight: 30, rowSelection: 'single' };

  agInit(params: ICellRendererParams): void {
    this.context = params.context;
    this.reportData = params.data;
    this.loadData();
  }

  private loadData() {
    if (!this.reportData?.id) return;
    this.logbookService.getInfoByReporte(this.reportData.id, 'Photo').subscribe({
      next: (resp: any) => {
        this.rowData = resp.success ? (resp.data || []).map((item: any, i: number) => ({
          ...item,
          id: item.id || `temp_${Date.now()}_${i}`,
          __isNew: false, __modified: false
        })) : [];
      },
      error: () => this.rowData = []
    });
  }

  onGridReady(params: GridReadyEvent) { this.gridApi = params.api; }

  addRow() {
    this.rowData = [{
      id: `temp_${this.tempIdCounter++}`,
      idReporte: this.reportData?.id,
      date: new Date().toISOString().split('T')[0],
      imageUrl: '', description: '', active: true, __isNew: true, __modified: false
    }, ...this.rowData];
    this.hasUnsavedChanges = true;
  }

  deleteSelected() {
    const rows = this.gridApi.getSelectedRows();
    if (!rows.length) { alerts.basicAlert('Error', 'Seleccione un registro', 'warning'); return; }
    this.rowData = this.rowData.filter(r => r !== rows[0]);
    this.hasUnsavedChanges = true;
  }

  saveChanges() {
    alerts.basicAlert('Guardar', 'Funcionalidad en desarrollo', 'info');
    this.hasUnsavedChanges = false;
    if (this.context?.componentParent?.updateBitacoraCount) {
      this.context.componentParent.updateBitacoraCount(this.reportData?.id, 'fotos', this.rowData.length);
    }
  }

  discardChanges() {
    this.loadData();
    this.hasUnsavedChanges = false;
  }

  onCellValueChanged(event: any) {
    if (!event.data.__isNew) event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }

  closeDetail() {
    if (this.context?.componentParent?.collapseBitacoraDetail) {
      this.context.componentParent.collapseBitacoraDetail(this.reportData?.id);
    }
  }
}
