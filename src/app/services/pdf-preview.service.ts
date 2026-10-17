import { Injectable, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export interface PdfPreviewState {
  open: boolean;
  loading: boolean;
  title: string;
  viewerUrl: SafeResourceUrl | null;
  error: string;
  zoom: number;
  fileName: string;
}

const EMPTY_STATE: PdfPreviewState = {
  open: false,
  loading: false,
  title: 'Vista previa PDF',
  viewerUrl: null,
  error: '',
  zoom: 100,
  fileName: 'reporte.pdf',
};

@Injectable({ providedIn: 'root' })
export class PdfPreviewService {
  private sanitizer = inject(DomSanitizer);
  private stateSignal = signal<PdfPreviewState>({ ...EMPTY_STATE });
  readonly state = this.stateSignal.asReadonly();

  private objectUrl: string | null = null;
  private requestId = 0;
  private fileName = 'reporte.pdf';
  private pdfBlob: Blob | null = null;

  show(pdf: any, title = 'Vista previa PDF', fileName?: string): Promise<void> {
    const requestId = ++this.requestId;
    this.releaseObjectUrl();
    this.fileName = this.normalizeFileName(fileName || title);
    this.pdfBlob = null;
    this.stateSignal.set({ open: true, loading: true, title, viewerUrl: null, error: '', zoom: 100, fileName: this.fileName });

    if (!pdf || typeof pdf.getBlob !== 'function') {
      this.stateSignal.set({ open: true, loading: false, title, viewerUrl: null, error: 'El generador no entregó un PDF válido.', zoom: 100, fileName: this.fileName });
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      try {
        pdf.getBlob((blob: Blob) => {
          if (requestId !== this.requestId) {
            resolve();
            return;
          }
          if (!(blob instanceof Blob) || blob.size === 0) {
            this.stateSignal.set({ open: true, loading: false, title, viewerUrl: null, error: 'No se pudo crear el archivo PDF.', zoom: 100, fileName: this.fileName });
            resolve();
            return;
          }

          this.pdfBlob = blob;
          this.objectUrl = URL.createObjectURL(blob);
          this.updateViewerUrl(100);
          resolve();
        });
      } catch (error) {
        if (requestId === this.requestId) {
          const detail = error instanceof Error ? error.message : String(error || 'Error desconocido');
          this.stateSignal.set({ open: true, loading: false, title, viewerUrl: null, error: detail, zoom: 100, fileName: this.fileName });
        }
        resolve();
      }
    });
  }

  close(): void {
    this.requestId++;
    this.stateSignal.set({ ...EMPTY_STATE });
    this.releaseObjectUrl();
  }

  download(): void {
    if (!this.objectUrl) return;
    const link = document.createElement('a');
    link.href = this.objectUrl;
    link.download = this.fileName;
    link.click();
  }

  zoomBy(delta: number): void {
    const state = this.stateSignal();
    if (!this.objectUrl || !state.open) return;
    this.updateViewerUrl(Math.min(200, Math.max(50, state.zoom + delta)));
  }

  async getPdfBlob(): Promise<Blob> {
    if (this.pdfBlob) return this.pdfBlob;
    throw new Error('El PDF todavía no está listo.');
  }

  private updateViewerUrl(zoom: number): void {
    const state = this.stateSignal();
    const viewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      `${this.objectUrl}#toolbar=0&navpanes=0&pagemode=none&zoom=${zoom}`
    );
    this.stateSignal.set({ ...state, open: true, loading: false, viewerUrl, error: '', zoom, fileName: this.fileName });
  }

  private releaseObjectUrl(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    this.pdfBlob = null;
  }

  private normalizeFileName(value: string): string {
    const safe = value.replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]+/g, '-').trim();
    return `${safe || 'reporte'}.pdf`;
  }
}
