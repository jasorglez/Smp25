import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-enterprise';
import { BitacoraBaseComponent, BITACORA_STYLES } from './bitacora-base.component';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-bitacora-videos',
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
    <!-- Botón play: lee la fila seleccionada del grid (sin hooks en cell renderer) -->
    <button class="btn btn-info btn-sm" (click)="playSelected()" title="Ver video seleccionado">
      <i class="bi bi-play-circle-fill"></i>
    </button>
  </div>

  <!-- Modal editar video -->
  <div *ngIf="modalOpen"
       class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
       style="background:rgba(0,0,0,0.75);z-index:9999;"
       (click)="closeModal()">
    <div class="bg-white rounded-3 shadow-lg p-3"
         style="max-width:560px;width:95%;max-height:90vh;overflow-y:auto;"
         (click)="$event.stopPropagation()">

      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="mb-0 fw-semibold"><i class="bi bi-camera-video me-1 text-primary"></i>Video</h6>
        <button class="btn btn-sm btn-outline-secondary" (click)="closeModal()"><i class="bi bi-x-lg"></i></button>
      </div>

      <!-- Preview en el modal -->
      <div class="text-center mb-3 bg-light rounded"
           style="min-height:120px;display:flex;align-items:center;justify-content:center;padding:8px;">
        <video *ngIf="modalVideoUrl" [src]="modalVideoUrl" controls
               style="max-width:100%;max-height:280px;border-radius:6px;background:#000;display:block;"></video>
        <div *ngIf="!modalVideoUrl" class="text-muted text-center">
          <i class="bi bi-camera-video" style="font-size:3rem;display:block;"></i>
          <small>Sin video</small>
        </div>
      </div>

      <!-- Input file real en el template Angular -->
      <div class="mb-3">
        <label class="form-label small fw-semibold">Seleccionar video</label>
        <input type="file" accept="video/*"
               class="form-control form-control-sm"
               [disabled]="uploading"
               (change)="onFileSelected($event)">
        <div class="form-text">Máximo 200 MB</div>
        <div *ngIf="uploading" class="mt-1 text-muted small">
          <span class="spinner-border spinner-border-sm me-1"></span>Subiendo video...
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label small fw-semibold">Descripción</label>
        <textarea class="form-control form-control-sm" rows="2"
                  [(ngModel)]="modalDescription"
                  placeholder="Descripción del video..."></textarea>
      </div>

      <div class="d-flex justify-content-end gap-2">
        <button class="btn btn-sm btn-outline-secondary" (click)="closeModal()">Cancelar</button>
        <button class="btn btn-sm btn-primary" (click)="saveModal()" [disabled]="uploading">Guardar</button>
      </div>
    </div>
  </div>

  <!-- Modal solo ver video -->
  <div *ngIf="previewUrl"
       class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
       style="background:rgba(0,0,0,0.85);z-index:10000;"
       (click)="previewUrl = null">
    <div class="bg-white rounded-3 shadow-lg p-3"
         style="max-width:90vw;width:700px;"
         (click)="$event.stopPropagation()">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="fw-semibold"><i class="bi bi-camera-video-fill me-1 text-primary"></i>Vista previa</span>
        <button class="btn btn-sm btn-outline-secondary" (click)="previewUrl = null"><i class="bi bi-x-lg"></i></button>
      </div>
      <video [src]="previewUrl" controls autoplay
             style="width:100%;max-height:70vh;border-radius:6px;display:block;background:#000;"></video>
    </div>
  </div>

  <!-- Grid: mismo patrón que bitacora-notas (cellClicked + cellDoubleClicked) -->
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
export class BitacoraVideosComponent extends BitacoraBaseComponent {
  private imageHandlerService = inject(ImageHandlerService);

  readonly bitacoraType   = 'videos';
  readonly typeNoteValue  = 'Video';
  readonly editableCols   = [];
  readonly requiredFields = [{ field: 'imageUrl', label: 'Video' }];

  uploading        = false;
  selectedRow: any = null;
  previewUrl: string | null = null;
  modalOpen        = false;
  modalDescription = '';
  modalVideoUrl: string | null = null;
  private editingRow: any = null;

  override readonly gridOptions: any = {
    headerHeight: 30, rowHeight: 48, rowSelection: 'single',
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
  };

  get colDefs(): ColDef[] {
    return [
      {
        headerName: '#', width: 45, pinned: 'left', editable: false,
        valueGetter: (p) => p.node!.rowIndex! + 1,
      },
      {
        field: 'imageUrl', headerName: 'Video', width: 170, editable: false,
        cellRenderer: (params: any) => {
          const div = document.createElement('div');
          div.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;gap:6px;';
          div.title = 'Doble clic para editar';
          if (params.value) {
            div.innerHTML =
              '<i class="bi bi-camera-video-fill" style="font-size:1.4rem;color:#0d6efd;pointer-events:none;"></i>' +
              '<small class="text-muted" style="pointer-events:none;">2x clic editar</small>';
          } else {
            div.innerHTML =
              '<i class="bi bi-camera-video" style="font-size:1.4rem;color:#adb5bd;pointer-events:none;"></i>' +
              '<small class="text-muted" style="pointer-events:none;">2x clic</small>';
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

  // Mismo patrón que bitacora-notas: cellClicked y cellDoubleClicked sí corren en Angular zone
  override onCellClicked(event: any): void {
    this.selectedRow = event.data;
  }

  override onCellDoubleClicked(event: any): void {
    this.openModal(event.data);
  }

  // Botón play: usa selectedRow rastreado por onCellClicked
  playSelected(): void {
    if (!this.selectedRow) {
      alerts.basicAlert('Sin selección', 'Haga clic en una fila primero', 'warning');
      return;
    }
    const url = this.selectedRow.imageUrl;
    if (!url) {
      alerts.basicAlert('Sin video', 'La fila seleccionada no tiene video', 'warning');
      return;
    }
    this.previewUrl = url;
  }

  openModal(row: any): void {
    if (!row) return;
    this.editingRow       = row;
    this.modalDescription = row.description || '';
    this.modalVideoUrl    = row.imageUrl || null;
    this.modalOpen        = true;
  }

  closeModal(): void {
    this.modalOpen  = false;
    this.editingRow = null;
  }

  onFileSelected(event: any): void {
    const file: File = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      alerts.basicAlert('Formato inválido', 'Solo se permiten archivos de video', 'warning');
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      alerts.basicAlert('Archivo muy grande', 'El tamaño máximo es 200 MB', 'warning');
      return;
    }
    this.uploading = true;
    this.imageHandlerService.uploadFileToFirebase(file, 'videos-bitacora')
      .then(url => { this.modalVideoUrl = url; this.uploading = false; })
      .catch(() => { this.uploading = false; alerts.basicAlert('Error', 'No se pudo subir el video', 'error'); });
  }

  saveModal(): void {
    if (this.editingRow) {
      this.editingRow.imageUrl    = this.modalVideoUrl;
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
