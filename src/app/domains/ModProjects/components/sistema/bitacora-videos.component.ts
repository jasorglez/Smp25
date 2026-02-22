import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-enterprise';
import { BitacoraBaseComponent, BITACORA_STYLES } from './bitacora-base.component';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-bitacora-videos',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
<div class="detail-grid-container">
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
    <span *ngIf="uploading" class="ms-2 text-muted" style="font-size:0.75rem;">
      <span class="spinner-border spinner-border-sm me-1"></span>Subiendo video...
    </span>
  </div>

  <!-- Modal de previsualización -->
  <div *ngIf="previewUrl"
       class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
       style="background:rgba(0,0,0,0.85);z-index:9999;"
       (click)="closePreview()">
    <div class="bg-white rounded-3 shadow-lg p-3"
         style="max-width:90vw;width:700px;"
         (click)="$event.stopPropagation()">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="fw-semibold text-dark"><i class="bi bi-camera-video-fill me-1 text-primary"></i>Vista previa</span>
        <button class="btn btn-sm btn-outline-secondary" (click)="closePreview()">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <video [src]="previewUrl" controls autoplay
             style="width:100%;max-height:70vh;border-radius:6px;display:block;background:#000;">
      </video>
    </div>
  </div>

  <ag-grid-angular
    class="ag-theme-quartz small-text-ag-grid"
    [rowData]="rowData"
    [columnDefs]="colDefs"
    [defaultColDef]="defaultColDef"
    [gridOptions]="gridOptions"
    (gridReady)="onGridReady($event)"
    (cellValueChanged)="onCellValueChanged($event)"
    (cellEditingStopped)="onCellEditingStopped($event)"
    (cellClicked)="onGridCellClicked($event)"
    style="height: 350px; width: 100%;">
  </ag-grid-angular>
</div>
  `,
  styles: [
    ...BITACORA_STYLES,
    `.vid-cell { width:100%;height:100%;display:flex;align-items:center;gap:8px; }`,
    `.vid-play { color:#198754;font-size:0.8rem;cursor:pointer;text-decoration:underline;white-space:nowrap; }`,
    `.vid-play:hover { color:#146c43; }`,
  ],
})
export class BitacoraVideosComponent extends BitacoraBaseComponent {
  private imageHandlerService = inject(ImageHandlerService);
  private currentRow: any = null;

  uploading  = false;
  previewUrl: string | null = null;

  readonly bitacoraType   = 'videos';
  readonly typeNoteValue  = 'Video';
  readonly editableCols   = ['description'];
  readonly requiredFields = [{ field: 'imageUrl', label: 'Video' }];

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
        field: 'imageUrl',
        headerName: 'Video',
        width: 170,
        editable: false,
        cellRenderer: (params: any) => {
          const div = document.createElement('div');
          div.className = 'vid-cell';
          if (params.value) {
            div.innerHTML = `
              <i class="bi bi-camera-video-fill" style="font-size:1.4rem;color:#0d6efd;" title="Clic para subir otro video"></i>
              <span class="vid-play" data-action="preview">
                <i class="bi bi-play-circle-fill"></i> Ver video
              </span>`;
          } else {
            div.innerHTML = `
              <i class="bi bi-camera-video" style="font-size:1.4rem;color:#adb5bd;"></i>
              <small class="text-muted">Clic para subir</small>`;
          }
          return div;
        },
      },
      {
        field: 'description',
        headerName: 'Descripción',
        editable: true,
        flex: 1,
      },
    ];
  }

  onGridCellClicked(event: any): void {
    if (event.colDef?.field !== 'imageUrl') return;

    // Si hizo clic en el botón "Ver video" → abrir preview
    const target = event.event?.target as Element;
    if (target?.closest('[data-action="preview"]')) {
      this.previewUrl = event.data?.imageUrl || null;
      return;
    }

    // Clic en el ícono/resto de la celda → subir video
    this.currentRow = event.node.data;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.style.cssText = 'position:fixed;top:-200px;left:-200px;opacity:0;';
    document.body.appendChild(input);
    input.onchange = (e: any) => {
      this.onFileSelected(e);
      document.body.removeChild(input);
    };
    input.click();
  }

  private onFileSelected(event: any): void {
    const file: File = event.target.files?.[0];
    if (!file || !this.currentRow) return;

    if (!file.type.startsWith('video/')) {
      alerts.basicAlert('Formato inválido', 'Solo se permiten archivos de video', 'warning');
      return;
    }
    const maxMB = 200;
    if (file.size > maxMB * 1024 * 1024) {
      alerts.basicAlert('Archivo muy grande', `El tamaño máximo permitido es ${maxMB} MB`, 'warning');
      return;
    }

    this.uploading = true;
    alerts.basicAlert('Subiendo video...', 'Por favor espera, esto puede tardar unos segundos', 'info');

    this.imageHandlerService.uploadFileToFirebase(file, 'videos-bitacora')
      .then(url => {
        this.currentRow.imageUrl = url;
        if (!this.currentRow.__isNew) this.currentRow.__modified = true;
        this.hasUnsavedChanges = true;
        this.uploading = false;
        this.gridApi.refreshCells({ force: true });
        alerts.basicAlert('Listo', 'Video subido correctamente', 'success');
      })
      .catch(() => {
        this.uploading = false;
        alerts.basicAlert('Error', 'No se pudo subir el video', 'error');
      });
  }

  closePreview(): void { this.previewUrl = null; }

  buildPayload(item: any): any {
    return {
      ...this.basePayload(item),
      description: item.description?.trim() || null,
      imageUrl:    item.imageUrl ?? null,
    };
  }
}
