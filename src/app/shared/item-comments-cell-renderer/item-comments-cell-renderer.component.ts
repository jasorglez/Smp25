import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { ItemCommentsService, ItemComment } from 'app/services/item-comments.service';
import { SignalsService } from 'app/services/signals.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-item-comments-cell-renderer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div (click)="openChat()" [style.cursor]="locked ? 'default' : 'pointer'" style="display:flex; align-items:center; gap:4px;" [style.opacity]="locked ? '0.4' : '1'">
      <i class="bi bi-chat-dots" [style.color]="count ? '#0d6efd' : '#aaa'"></i>
      <span *ngIf="count" style="font-size:11px; color:#0d6efd; font-weight:600;">{{ count }}</span>
      <span *ngIf="!count" style="font-size:11px; color:#aaa;">+</span>
    </div>
  `
})
export class ItemCommentsCellRendererComponent implements ICellRendererAngularComp, OnDestroy {
  private commentsService = inject(ItemCommentsService);
  private signalsService  = inject(SignalsService);
  private destroy$ = new Subject<void>();

  count = 0;
  numArticle = '';
  documentType = '';
  idDocument = 0;
  locked = false;
  private lastLoadKey = '';

  agInit(params: ICellRendererParams & { documentType?: string; idDocument?: number; numArticle?: string; locked?: boolean }): void {
    this.numArticle   = params.numArticle
      ? String(params.numArticle)
      : String(params.data?.numArticulo || params.data?.numeroArticulo || params.data?.numArticle || '');
    this.documentType = params.documentType || '';
    this.idDocument   = params.idDocument   || 0;
    this.locked       = params.locked       || false;
    console.log('[ItemComments] documentType:', this.documentType, 'idDocument:', this.idDocument, 'numArticle:', this.numArticle);
    this.loadCount();

    this.commentsService.commentSaved$
      .pipe(takeUntil(this.destroy$))
      .subscribe((saved: ItemComment) => {
        if (
          saved.documentType === this.documentType &&
          String(saved.idDocument) === String(this.idDocument) &&
          String(saved.numArticle) === String(this.numArticle)
        ) {
          this.lastLoadKey = '';
          this.loadCount();
        }
      });
  }

  refresh(params: ICellRendererParams & { documentType?: string; idDocument?: number; numArticle?: string; locked?: boolean }): boolean {
    const newNumArticle   = params.numArticle
      ? String(params.numArticle)
      : String(params.data?.numArticulo || params.data?.numeroArticulo || params.data?.numArticle || '');
    const newDocumentType = params.documentType || '';
    const newIdDocument   = params.idDocument   || 0;
    const newLocked       = params.locked       || false;

    // Si alguno de los parámetros cambió, actualizar sin destruir el componente
    if (newNumArticle !== this.numArticle || newDocumentType !== this.documentType || newIdDocument !== this.idDocument || newLocked !== this.locked) {
      this.numArticle   = newNumArticle;
      this.documentType = newDocumentType;
      this.idDocument   = newIdDocument;
      this.locked       = newLocked;
      this.loadCount();
    }
    return true;  // Retorna true para que AG Grid NO destruya el componente
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCount() {
    if (!this.documentType || !this.idDocument || !this.numArticle) return;

    // Evitar peticiones duplicadas
    const loadKey = `${this.documentType}:${this.idDocument}:${this.numArticle}`;
    if (loadKey === this.lastLoadKey) return;
    this.lastLoadKey = loadKey;

    this.commentsService.getComments(this.documentType, this.idDocument, this.numArticle)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: ItemComment[]) => { this.count = data.length; },
        error: () => { this.count = 0; }
      });
  }

  openChat() {
    if (this.locked) return;
    this.commentsService.openChatFor$.next({
      documentType: this.documentType,
      idDocument:   this.idDocument,
      numArticle:   this.numArticle
    });
  }
}
