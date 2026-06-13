import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-enterprise';
import { BitacoraBaseComponent, BITACORA_STYLES } from './bitacora-base.component';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-bitacora-fotos',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
<div class="detail-grid-container">

  <!-- Barra de botones -->
  <div class="detail-actions d-flex align-items-center mb-2 gap-1">
    <button class="btn btn-outline-secondary btn-sm" (click)="closeDetail()"><i class="bi bi-x-lg"></i></button>
    <button class="btn btn-primary btn-sm"           (click)="addRow()"><i class="bi bi-plus-lg"></i></button>
    <button class="btn btn-warning btn-sm"           (click)="discardChanges()"><i class="bi bi-arrow-counterclockwise"></i></button>
    <button class="btn btn-danger btn-sm"            (click)="deleteSelected()"><i class="bi bi-trash"></i></button>
    <button class="btn btn-success btn-sm position-relative" (click)="saveChanges()">
      <i class="bi bi-floppy"></i>
      <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
            *ngIf="hasUnsavedChanges"></span>
    </button>
  </div>

  <!-- Modal editar foto -->
  <div *ngIf="modalOpen"
       class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
       style="background:rgba(0,0,0,0.75);z-index:9999;"
       (click)="closeModal()">
    <div class="bg-white rounded-3 shadow-lg p-3"
         style="max-width:460px;width:95%;max-height:90vh;overflow-y:auto;"
         (click)="$event.stopPropagation()">

      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="mb-0 fw-semibold"><i class="bi bi-camera me-1 text-primary"></i>Foto</h6>
        <button class="btn btn-sm btn-outline-secondary" (click)="closeModal()"><i class="bi bi-x-lg"></i></button>
      </div>

      <!-- Preview -->
      <div class="text-center mb-3 bg-light rounded"
           style="min-height:120px;display:flex;align-items:center;justify-content:center;padding:8px;">
        <img *ngIf="modalImageUrl" [src]="modalImageUrl"
             style="max-width:100%;max-height:200px;object-fit:contain;border-radius:4px;">
        <div *ngIf="!modalImageUrl" class="text-muted text-center">
          <i class="bi bi-image" style="font-size:3rem;display:block;"></i>
          <small>Sin foto</small>
        </div>
      </div>

      <!-- Input file real en el template Angular (nunca dinámico) -->
      <div class="mb-3">
        <label class="form-label small fw-semibold">Seleccionar foto</label>
        <input type="file" accept="image/jpeg,image/png,image/webp"
               class="form-control form-control-sm"
               [disabled]="uploading"
               (change)="onFileSelected($event)">
        <div *ngIf="uploading" class="mt-1 text-muted small">
          <span class="spinner-border spinner-border-sm me-1"></span>Subiendo...
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label small fw-semibold">Descripción</label>
        <textarea class="form-control form-control-sm" rows="2"
                  [(ngModel)]="modalDescription"
                  placeholder="Descripción de la foto..."></textarea>
      </div>

      <div class="d-flex justify-content-end gap-2">
        <button class="btn btn-sm btn-outline-secondary" (click)="closeModal()">Cancelar</button>
        <button class="btn btn-sm btn-primary" (click)="saveModal()" [disabled]="uploading">Guardar</button>
      </div>
    </div>
  </div>

  <!-- Grid -->
  <ag-grid-angular
    class="ag-theme-quartz small-text-ag-grid"
    [rowData]="rowData"
    [columnDefs]="colDefs"
    [defaultColDef]="defaultColDef"
    [gridOptions]="gridOptions"
    (gridReady)="onGridReady($event)"
    (cellValueChanged)="onCellValueChanged($event)"
    (cellClicked)="onCellClicked($event)"
    (cellDoubleClicked)="onCellDoubleClicked($event)"
    style="height: 350px; width: 100%;">
  </ag-grid-angular>
</div>
  `,
  styles: BITACORA_STYLES,
})
export class BitacoraFotosComponent extends BitacoraBaseComponent {
  private imageHandlerService = inject(ImageHandlerService);

  readonly bitacoraType   = 'fotos';
  readonly typeNoteValue  = 'Photo';
  readonly editableCols   = [];
  readonly requiredFields = [{ field: 'imageUrl', label: 'Foto' }];

  uploading        = false;
  selectedRow: any = null;
  modalOpen        = false;
  modalDescription = '';
  modalImageUrl: string | null = null;
  private editingRow: any = null;

  override readonly gridOptions: any = {
    headerHeight: 30, rowHeight: 60, rowSelection: 'single',
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
  };

  get colDefs(): ColDef[] {
    return [
      {
        headerName: '#', width: 45, pinned: 'left', editable: false,
        valueGetter: (p) => p.node!.rowIndex! + 1,
      },
      {
        field: 'imageUrl', headerName: 'Foto', width: 130, editable: false,
        cellRenderer: (params: any) => {
          const div = document.createElement('div');
          div.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;';
          div.title = 'Doble clic para editar';
          if (params.value) {
            const img = document.createElement('img');
            img.src = params.value;
            img.style.cssText = 'max-width:100%;max-height:56px;object-fit:contain;border-radius:4px;pointer-events:none;';
            div.appendChild(img);
          } else {
            div.innerHTML = '<i class="bi bi-camera" style="font-size:1.5rem;color:#adb5bd;pointer-events:none;"></i>' +
                            '<small class="ms-1 text-muted" style="pointer-events:none;">2x clic</small>';
          }
          return div;
        },
      },
      {
        field: 'description', headerName: 'Descripción', editable: false, flex: 1,
        valueFormatter: (p: any) => p.value || 'Doble clic para editar...',
        cellStyle: (p: any) => p.value
          ? { color: '#212529' }
          : { color: '#adb5bd', fontStyle: 'italic' },
      },
    ];
  }

  override addRow(): void {
    const newRow = {
      id: `temp_${this.tempIdCounter++}`,
      idReporte: this.reportData?.id,
      date: new Date().toISOString().split('T')[0],
      active: true, __isNew: true, __modified: false,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasUnsavedChanges = true;
    setTimeout(() => {
      this.gridApi?.setGridOption('rowData', this.rowData);
      this.openModal(newRow);
    }, 50);
  }

  openModal(row: any): void {
    if (!row) return;
    this.editingRow      = row;
    this.modalDescription = row.description || '';
    this.modalImageUrl   = row.imageUrl || null;
    this.modalOpen       = true;
  }

  closeModal(): void {
    this.modalOpen  = false;
    this.editingRow = null;
  }

  onFileSelected(event: any): void {
    const file: File = event.target.files?.[0];
    if (!file) return;
    this.uploading = true;
    this.imageHandlerService.uploadFileToFirebase(file, 'fotos-bitacora')
      .then(url => { this.modalImageUrl = url; this.uploading = false; })
      .catch(() => { this.uploading = false; alerts.basicAlert('Error', 'No se pudo subir la foto', 'error'); });
  }

  // Mismo patrón que bitacora-notas: cellClicked y cellDoubleClicked sí corren en Angular zone
  override onCellClicked(event: any): void {
    this.selectedRow = event.data;
  }

  override onCellDoubleClicked(event: any): void {
    this.openModal(event.data);
  }

  saveModal(): void {
    if (this.editingRow) {
      this.editingRow.imageUrl    = this.modalImageUrl;
      this.editingRow.description = this.modalDescription.trim() || null;
      if (!this.editingRow.__isNew) this.editingRow.__modified = true;
      this.hasUnsavedChanges = true;
      this.gridApi.refreshCells({ force: true });
    }
    this.closeModal();
  }

  buildPayload(item: any): any {
    return {
      ...this.basePayload(item),
      description: item.description?.trim() || null,
      imageUrl:    item.imageUrl ?? null,
    };
  }
}
