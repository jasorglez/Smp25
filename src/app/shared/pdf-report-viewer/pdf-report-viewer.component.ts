import { CommonModule } from '@angular/common';
import { Component, Input, SecurityContext, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { pdfPreviewUrl } from 'app/helpers/pdf-viewer';
import { PdfShareButtonsComponent } from 'app/shared/components/pdf-share-buttons/pdf-share-buttons.component';

@Component({
  selector: 'app-pdf-report-viewer',
  standalone: true,
  imports: [CommonModule, PdfShareButtonsComponent],
  template: `
    <div class="pdf-report-viewer">
      <div class="pdf-report-toolbar">
        <div class="pdf-zoom-controls" aria-label="Controles de zoom del PDF">
          <button type="button" class="btn btn-sm btn-outline-secondary" (click)="zoomBy(-10)" [disabled]="zoom <= 50" title="Reducir zoom" aria-label="Reducir zoom">
            <i class="bi bi-zoom-out"></i>
          </button>
          <span>{{ zoom }}%</span>
          <button type="button" class="btn btn-sm btn-outline-secondary" (click)="zoomBy(10)" [disabled]="zoom >= 200" title="Aumentar zoom" aria-label="Aumentar zoom">
            <i class="bi bi-zoom-in"></i>
          </button>
        </div>
        <app-pdf-share-buttons
          *ngIf="viewerUrl && showShare"
          [getPdfBlob]="getPdfBlobFn"
          [fileName]="fileName"
          [subject]="title">
        </app-pdf-share-buttons>
      </div>
      <iframe *ngIf="viewerUrl" [src]="viewerUrl" [title]="title"></iframe>
      <div *ngIf="!viewerUrl" class="pdf-viewer-empty">No hay un PDF disponible para mostrar.</div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; min-height: 220px; }
    .pdf-report-viewer { display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 220px; overflow: hidden; border: 1px solid #dee2e6; border-radius: .375rem; background: #fff; }
    .pdf-report-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 42px; padding: 4px 8px; border-bottom: 1px solid #dee2e6; background: #f8fafc; }
    .pdf-zoom-controls { display: flex; align-items: center; gap: 6px; color: #475569; font-size: .8rem; }
    .pdf-report-viewer iframe { flex: 1; width: 100%; min-height: 0; border: 0; }
    .pdf-viewer-empty { display: flex; flex: 1; align-items: center; justify-content: center; color: #64748b; }
  `],
})
export class PdfReportViewerComponent {
  private sanitizer = inject(DomSanitizer);
  private rawUrl = '';

  @Input() title = 'Reporte PDF';
  @Input() fileName = 'reporte.pdf';
  @Input() showShare = true;
  @Input() getPdfBlob?: () => Promise<Blob>;
  @Input() set sourceUrl(value: string | SafeResourceUrl | null | undefined) {
    this.rawUrl = typeof value === 'string'
      ? value
      : value ? this.sanitizer.sanitize(SecurityContext.RESOURCE_URL, value) || '' : '';
    this.updateViewerUrl();
  }

  zoom = 100;
  viewerUrl: SafeResourceUrl | null = null;
  readonly getPdfBlobFn = (): Promise<Blob> => {
    if (this.getPdfBlob) return this.getPdfBlob();
    if (!this.rawUrl) return Promise.reject(new Error('El PDF no está disponible.'));
    return fetch(this.rawUrl, { credentials: 'same-origin' }).then(response => {
      if (!response.ok) throw new Error('No se pudo leer el PDF.');
      return response.blob();
    });
  };

  zoomBy(delta: number): void {
    this.zoom = Math.min(200, Math.max(50, this.zoom + delta));
    this.updateViewerUrl();
  }

  private updateViewerUrl(): void {
    this.viewerUrl = this.rawUrl
      ? this.sanitizer.bypassSecurityTrustResourceUrl(pdfPreviewUrl(this.rawUrl, this.zoom))
      : null;
  }
}
