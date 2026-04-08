import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { ItemCommentsService, ItemComment } from 'app/services/item-comments.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-item-comments-cell-renderer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div (click)="openChat()" style="cursor:pointer; display:flex; align-items:center; gap:4px;">
      <i class="bi bi-chat-dots" [style.color]="count ? '#0d6efd' : '#aaa'"></i>
      <span *ngIf="count" style="font-size:11px; color:#0d6efd; font-weight:600;">{{ count }}</span>
      <span *ngIf="!count" style="font-size:11px; color:#aaa;">+</span>
    </div>
  `
})
export class ItemCommentsCellRendererComponent implements ICellRendererAngularComp, OnDestroy {
  private commentsService = inject(ItemCommentsService);
  private signalsService  = inject(SignalsService);

  count = 0;
  numArticle = '';
  documentType = '';
  idDocument = 0;

  agInit(params: ICellRendererParams & { documentType?: string; idDocument?: number }): void {
    this.numArticle   = String(params.data?.numArticulo || params.data?.numeroArticulo || params.data?.numArticle || '');
    this.documentType = params.documentType || '';
    this.idDocument   = params.idDocument   || 0;
    this.loadCount();
  }

  refresh(): boolean { return false; }
  ngOnDestroy(): void {}

  loadCount() {
    if (!this.documentType || !this.idDocument || !this.numArticle) return;
    this.commentsService.getComments(this.documentType, this.idDocument, this.numArticle).subscribe({
      next: (data: ItemComment[]) => { this.count = data.length; },
      error: () => { this.count = 0; }
    });
  }

  openChat() {
    this.commentsService.openChatFor$.next({
      documentType: this.documentType,
      idDocument:   this.idDocument,
      numArticle:   this.numArticle
    });
  }
}
