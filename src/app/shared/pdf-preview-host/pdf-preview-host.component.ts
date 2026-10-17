import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PdfPreviewService } from 'app/services/pdf-preview.service';
import { PdfShareButtonsComponent } from 'app/shared/components/pdf-share-buttons/pdf-share-buttons.component';

@Component({
  selector: 'app-pdf-preview-host',
  standalone: true,
  imports: [CommonModule, PdfShareButtonsComponent],
  template: `
    <ng-container *ngIf="preview.state() as state">
      <div *ngIf="state.open" class="pdf-preview-backdrop" (click)="preview.close()"></div>
      <section *ngIf="state.open" class="pdf-preview-window" role="dialog" aria-modal="true" [attr.aria-label]="state.title">
        <header class="pdf-preview-header">
          <div class="pdf-preview-title"><i class="bi bi-file-earmark-pdf me-2"></i>{{ state.title }}</div>
          <div class="pdf-preview-actions">
            <div class="pdf-preview-zoom" *ngIf="state.viewerUrl">
              <button type="button" class="btn btn-sm btn-light" (click)="preview.zoomBy(-10)" [disabled]="state.zoom <= 50" aria-label="Reducir zoom" title="Reducir zoom"><i class="bi bi-zoom-out"></i></button>
              <span>{{ state.zoom }}%</span>
              <button type="button" class="btn btn-sm btn-light" (click)="preview.zoomBy(10)" [disabled]="state.zoom >= 200" aria-label="Aumentar zoom" title="Aumentar zoom"><i class="bi bi-zoom-in"></i></button>
            </div>
            <app-pdf-share-buttons *ngIf="state.viewerUrl" [getPdfBlob]="getPdfBlobFn" [fileName]="state.fileName" [subject]="state.title"></app-pdf-share-buttons>
            <button *ngIf="state.viewerUrl" type="button" class="btn btn-sm btn-light" (click)="preview.download()">
              <i class="bi bi-download me-1"></i>Descargar
            </button>
            <button type="button" class="btn btn-sm btn-light" (click)="preview.close()" aria-label="Cerrar visor">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
        </header>
        <div class="pdf-preview-content">
          <div *ngIf="state.loading" class="pdf-preview-message">
            <span class="spinner-border spinner-border-sm me-2" role="status"></span>Preparando reporte PDF…
          </div>
          <div *ngIf="state.error" class="alert alert-danger m-3">{{ state.error }}</div>
          <iframe *ngIf="state.viewerUrl" [src]="state.viewerUrl" [title]="state.title"></iframe>
        </div>
      </section>
    </ng-container>
  `,
  styles: [`
    .pdf-preview-backdrop { position: fixed; inset: 0; z-index: 2200; background: rgba(12, 23, 38, .62); }
    .pdf-preview-window { position: fixed; inset: 3vh 3vw; z-index: 2201; display: flex; flex-direction: column; overflow: hidden; border-radius: 10px; background: #fff; box-shadow: 0 18px 60px rgba(0,0,0,.35); }
    .pdf-preview-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 48px; padding: 7px 12px; color: #fff; background: #123b5b; }
    .pdf-preview-title { overflow: hidden; font-size: .9rem; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .pdf-preview-actions { display: flex; align-items: center; flex-shrink: 0; gap: 8px; }
    .pdf-preview-zoom { display: flex; align-items: center; gap: 5px; color: #fff; font-size: .75rem; }
    .pdf-preview-content { position: relative; flex: 1; min-height: 0; background: #e8edf3; }
    .pdf-preview-content iframe { width: 100%; height: 100%; border: 0; background: #fff; }
    .pdf-preview-message { position: absolute; inset: 0; z-index: 1; display: flex; align-items: center; justify-content: center; color: #526171; }
    @media (max-width: 767px) { .pdf-preview-window { inset: 1vh 1vw; } .pdf-preview-title { font-size: .78rem; } }
  `],
})
export class PdfPreviewHostComponent {
  readonly preview = inject(PdfPreviewService);
  readonly getPdfBlobFn = () => this.preview.getPdfBlob();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.preview.state().open) this.preview.close();
  }
}
