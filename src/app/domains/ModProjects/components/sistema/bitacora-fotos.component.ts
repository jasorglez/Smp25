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
<section class="photo-detail">
  <div class="photo-toolbar">
    <div class="photo-toolbar-title">
      <span class="photo-toolbar-icon"><i class="bi bi-images"></i></span>
      <span><strong>Fotos del reporte</strong><small>{{ rowData.length }} foto(s)</small></span>
    </div>
    <div class="photo-toolbar-actions">
      <button class="btn btn-primary btn-sm" (click)="addRow()"><i class="bi bi-camera me-1"></i>Agregar foto</button>
      <button class="btn btn-success btn-sm" (click)="saveChanges()" [disabled]="!hasUnsavedChanges">
        <i class="bi bi-floppy me-1"></i>Guardar cambios
        <span class="photo-dirty-dot" *ngIf="hasUnsavedChanges"></span>
      </button>
      <button class="btn btn-outline-secondary btn-sm" (click)="discardChanges()" [disabled]="!hasUnsavedChanges" title="Descartar cambios">
        <i class="bi bi-arrow-counterclockwise"></i>
      </button>
      <button class="btn btn-outline-danger btn-sm" (click)="deleteSelected()" [disabled]="!selectedRow" title="Eliminar foto seleccionada">
        <i class="bi bi-trash"></i>
      </button>
      <button class="btn btn-outline-secondary btn-sm" (click)="closeDetail()" title="Cerrar fotos">
        <i class="bi bi-x-lg"></i>
      </button>
    </div>
  </div>

  <div class="photo-empty-hint" *ngIf="!rowData.length">
    <i class="bi bi-camera"></i><span>Aún no hay fotos. Agrega una para documentar este reporte.</span>
  </div>

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
    style="height: 330px; width: 100%;">
  </ag-grid-angular>

  <div *ngIf="modalOpen" class="photo-modal-backdrop" (click)="closeModal()">
    <section class="photo-modal" role="dialog" aria-modal="true" aria-labelledby="photo-modal-title" (click)="$event.stopPropagation()">
      <header class="photo-modal-header">
        <div class="photo-modal-heading">
          <span class="photo-modal-icon"><i class="bi bi-camera-fill"></i></span>
          <div><h5 id="photo-modal-title">{{ modalImageUrl ? 'Actualizar foto' : 'Agregar foto' }}</h5>
            <p>Reporte {{ reportData?.numReporte || ('#' + reportData?.id) }}<span *ngIf="reportData?.date"> · {{ reportData.date | date:'dd/MM/yyyy' }}</span></p></div>
        </div>
        <button type="button" class="photo-close" (click)="closeModal()" aria-label="Cerrar"><i class="bi bi-x-lg"></i></button>
      </header>

      <div class="photo-modal-body">
        <div class="photo-preview" [class.photo-preview-filled]="modalImageUrl">
          <img *ngIf="modalImageUrl" [src]="modalImageUrl" alt="Vista previa de la foto">
          <div *ngIf="!modalImageUrl" class="photo-preview-empty">
            <span><i class="bi bi-image"></i></span><strong>Tu foto aparecerá aquí</strong>
            <small>Selecciona una imagen para comenzar</small>
          </div>
        </div>

        <div class="photo-dropzone" [class.photo-dropzone-active]="draggingFile" [class.photo-dropzone-disabled]="uploading"
             (dragover)="onDragOver($event)" (dragleave)="onDragLeave($event)" (drop)="onFileDrop($event)">
          <input #photoInput type="file" accept="image/jpeg,image/png,image/webp" [disabled]="uploading"
                 (change)="onFileSelected($event)" aria-label="Seleccionar foto">
          <span class="photo-upload-icon"><i class="bi bi-cloud-arrow-up"></i></span>
          <strong>{{ selectedFileName || 'Arrastra una foto aquí' }}</strong>
          <small *ngIf="!selectedFileName">o elige un archivo desde tu dispositivo</small>
          <small *ngIf="selectedFileName && !uploading">Imagen lista para usar</small>
          <button type="button" class="btn btn-outline-primary btn-sm" (click)="photoInput.click()" [disabled]="uploading">
            {{ modalImageUrl ? 'Cambiar foto' : 'Seleccionar foto' }}
          </button>
          <div class="photo-uploading" *ngIf="uploading" aria-live="polite">
            <div class="photo-progress"><span></span></div><small>Subiendo foto al almacenamiento…</small>
          </div>
        </div>

        <div class="photo-upload-error" *ngIf="uploadError" role="alert">
          <i class="bi bi-exclamation-triangle-fill"></i><span>{{ uploadError }}</span>
        </div>

        <label class="photo-description-label" for="photo-description">Descripción <span>Opcional</span></label>
        <textarea id="photo-description" class="form-control" rows="3" maxlength="500"
                  [(ngModel)]="modalDescription" placeholder="¿Qué muestra esta foto? Agrega un detalle para el reporte…"></textarea>
        <div class="photo-description-count">{{ modalDescription.length || 0 }}/500</div>
      </div>

      <footer class="photo-modal-footer">
        <span><i class="bi bi-info-circle me-1"></i>La foto se adjunta al reporte al guardar los cambios.</span>
        <div><button type="button" class="btn btn-light" (click)="closeModal()">Cancelar</button>
          <button type="button" class="btn btn-primary" (click)="saveModal()" [disabled]="uploading || !modalImageUrl">
            <i class="bi bi-check-lg me-1"></i>Usar foto</button></div>
      </footer>
    </section>
  </div>
</section>
  `,
  styles: [...BITACORA_STYLES, `
    .photo-detail { padding: 10px; background: #f6f8fb; border: 1px solid #e5eaf1; border-radius: 10px; }
    .photo-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; padding:8px 10px; background:#fff; border:1px solid #e8edf3; border-radius:8px; }
    .photo-toolbar-title,.photo-modal-heading { display:flex; align-items:center; gap:10px; }
    .photo-toolbar-title strong { display:block; color:#223047; font-size:13px; }
    .photo-toolbar-title small { display:block; margin-top:2px; color:#7a8798; font-size:11px; }
    .photo-toolbar-icon,.photo-modal-icon { display:grid; place-items:center; width:36px; height:36px; border-radius:10px; color:#1769aa; background:#eaf4ff; font-size:17px; }
    .photo-toolbar-actions { display:flex; gap:6px; align-items:center; }
    .photo-dirty-dot { width:7px; height:7px; margin-left:4px; display:inline-block; border-radius:50%; background:#ffb020; }
    .photo-empty-hint { display:flex; align-items:center; gap:8px; padding:10px 12px; margin-bottom:8px; color:#66758a; background:#fff; border:1px dashed #cbd6e2; border-radius:8px; font-size:12px; }
    .photo-empty-hint i { color:#4c91cc; font-size:16px; }
    .photo-modal-backdrop { position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center; padding:18px; background:rgba(17,28,45,.66); backdrop-filter:blur(3px); }
    .photo-modal { width:min(620px,100%); max-height:94vh; overflow:auto; background:#fff; border:1px solid rgba(255,255,255,.6); border-radius:16px; box-shadow:0 24px 80px rgba(0,0,0,.28); animation:photoModalIn .16s ease-out; }
    @keyframes photoModalIn { from { opacity:0; transform:translateY(8px) scale(.99); } to { opacity:1; transform:translateY(0) scale(1); } }
    .photo-modal-header { display:flex; justify-content:space-between; align-items:center; padding:17px 20px; border-bottom:1px solid #edf0f4; }
    .photo-modal-icon { width:42px; height:42px; border-radius:12px; font-size:19px; }
    .photo-modal-heading h5 { margin:0; color:#1d2a3a; font-size:16px; font-weight:700; }
    .photo-modal-heading p { margin:3px 0 0; color:#7a8798; font-size:12px; }
    .photo-close { display:grid; place-items:center; width:34px; height:34px; color:#6e7a89; background:#f3f5f8; border:0; border-radius:9px; }
    .photo-close:hover { color:#26384d; background:#e8edf3; }
    .photo-modal-body { padding:18px 20px 8px; }
    .photo-preview { display:flex; justify-content:center; align-items:center; height:220px; overflow:hidden; margin-bottom:14px; background:linear-gradient(135deg,#f3f7fb,#e9eff6); border:1px solid #e3eaf2; border-radius:12px; }
    .photo-preview img { width:100%; height:100%; object-fit:contain; }
    .photo-preview-empty { display:flex; flex-direction:column; align-items:center; gap:5px; color:#8290a2; text-align:center; }
    .photo-preview-empty span { display:grid; place-items:center; width:54px; height:54px; margin-bottom:5px; color:#4d91c8; background:#fff; border-radius:16px; box-shadow:0 4px 14px rgba(39,91,135,.1); font-size:24px; }
    .photo-preview-empty strong { color:#516176; font-size:13px; }
    .photo-preview-empty small { font-size:11px; }
    .photo-dropzone { position:relative; display:flex; flex-direction:column; align-items:center; gap:5px; padding:14px; margin-bottom:16px; text-align:center; background:#fbfdff; border:1.5px dashed #b9c9d9; border-radius:12px; transition:all .15s ease; }
    .photo-dropzone-active { background:#eef7ff; border-color:#1675bd; box-shadow:0 0 0 3px rgba(22,117,189,.1); }
    .photo-dropzone-disabled { opacity:.72; }
    .photo-dropzone input { position:absolute; width:1px; height:1px; opacity:0; pointer-events:none; }
    .photo-upload-icon { display:grid; place-items:center; width:34px; height:34px; color:#337fb7; background:#eaf4ff; border-radius:10px; font-size:18px; }
    .photo-dropzone strong { max-width:100%; overflow:hidden; color:#33465d; font-size:12px; text-overflow:ellipsis; white-space:nowrap; }
    .photo-dropzone small { color:#8491a1; font-size:11px; }
    .photo-dropzone .btn { margin-top:5px; }
    .photo-uploading { width:min(320px,100%); margin-top:7px; }
    .photo-progress { height:5px; overflow:hidden; margin-bottom:6px; background:#dfeaf4; border-radius:9px; }
    .photo-progress span { display:block; width:38%; height:100%; background:#2084ca; border-radius:9px; animation:photoProgress 1.15s ease-in-out infinite alternate; }
    @keyframes photoProgress { from { transform:translateX(-30%); } to { transform:translateX(195%); } }
    .photo-upload-error { display:flex; align-items:flex-start; gap:9px; padding:10px 12px; margin:-4px 0 14px; color:#842029; background:#fff0f1; border:1px solid #f1c6ca; border-radius:9px; font-size:12px; line-height:1.4; }
    .photo-upload-error i { margin-top:1px; }
    .photo-description-label { display:flex; justify-content:space-between; margin-bottom:6px; color:#3a4a5d; font-size:12px; font-weight:650; }
    .photo-description-label span { color:#8b97a6; font-weight:400; }
    .photo-modal-body textarea { resize:vertical; font-size:12px; }
    .photo-description-count { margin-top:4px; color:#8b97a6; font-size:10px; text-align:right; }
    .photo-modal-footer { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:13px 20px 16px; border-top:1px solid #edf0f4; }
    .photo-modal-footer > span { color:#8290a0; font-size:10px; }
    .photo-modal-footer > div { display:flex; gap:8px; }
    @media (max-width:560px) { .photo-toolbar { align-items:flex-start; flex-direction:column; } .photo-toolbar-actions { width:100%; flex-wrap:wrap; } .photo-modal-backdrop { padding:8px; } .photo-modal-header,.photo-modal-body { padding-left:14px; padding-right:14px; } .photo-preview { height:180px; } .photo-modal-footer { align-items:flex-start; flex-direction:column; padding:12px 14px; } .photo-modal-footer > div { width:100%; justify-content:flex-end; } }
  `],
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
  selectedFileName = '';
  draggingFile = false;
  uploadError = '';
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
    this.selectedFileName = '';
    this.uploadError = '';
    this.modalOpen       = true;
  }

  closeModal(): void {
    if (this.editingRow?.__isNew && !this.modalImageUrl) {
      this.rowData = this.rowData.filter(row => row !== this.editingRow);
      this.gridApi?.setGridOption('rowData', this.rowData);
      this.hasUnsavedChanges = this.rowData.some(row => row.__isNew || row.__modified);
    }
    this.modalOpen  = false;
    this.editingRow = null;
  }

  onDragOver(event: DragEvent): void { event.preventDefault(); this.draggingFile = true; }
  onDragLeave(event: DragEvent): void { event.preventDefault(); this.draggingFile = false; }
  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    this.draggingFile = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.uploadSelectedFile(file);
  }

  onFileSelected(event: any): void {
    const file: File = event.target.files?.[0];
    if (!file) return;
    this.uploadSelectedFile(file, event.target);
  }

  private uploadSelectedFile(file: File, input?: HTMLInputElement): void {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      if (input) input.value = '';
      this.uploadError = 'Selecciona una imagen JPG, PNG o WebP.';
      alerts.basicAlert('Formato no válido', 'Selecciona una imagen JPG, PNG o WebP.', 'warning');
      return;
    }
    this.uploadError = '';
    this.selectedFileName = file.name;
    this.uploading = true;
    // La carpeta raíz "images" se usa en otras cargas vigentes del sistema;
    // evita el 403 que devuelve Storage al escribir en "fotos-bitacora".
    this.imageHandlerService.uploadFileToFirebase(file, 'images')
      .then(url => {
        if (url.length > 320) throw new Error('La URL generada excede el límite permitido para el reporte.');
        this.modalImageUrl = url;
        this.uploading = false;
      })
      .catch((error: any) => {
        this.uploading = false;
        console.error('Error subiendo foto de bitácora:', error);
        const reason = error?.code === 'storage/unauthorized'
          ? 'Firebase Storage rechazó el permiso de escritura (403). Verifica que las reglas permitan guardar en la carpeta images.'
          : error?.message || error?.code || 'Error desconocido';
        this.uploadError = `No se pudo subir la foto. ${reason}`;
        alerts.basicAlert('Error al subir foto', this.uploadError, 'error');
      })
      .finally(() => { if (input) input.value = ''; });
  }

  // Mismo patrón que bitacora-notas: cellClicked y cellDoubleClicked sí corren en Angular zone
  override onCellClicked(event: any): void {
    this.selectedRow = event.data;
  }

  override onCellDoubleClicked(event: any): void {
    this.openModal(event.data);
  }

  saveModal(): void {
    if (!this.modalImageUrl) {
      this.uploadError = 'Selecciona y sube una foto antes de continuar.';
      return;
    }
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
