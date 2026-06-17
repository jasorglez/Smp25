import { Component, inject, OnDestroy, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { ItemCommentsService, ItemComment } from 'app/services/item-comments.service';
import { SignalsService } from 'app/services/signals.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

type CellParams = ICellRendererParams & {
  documentType?: string;
  idDocument?: number;
  numArticle?: string;
  idProvider?: number;
  locked?: boolean;
  articleName?: string;
  providerName?: string;
};

@Component({
  selector: 'app-item-comments-cell-renderer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div (click)="openChat()" [style.cursor]="locked ? 'default' : 'pointer'"
         style="display:flex; align-items:center; justify-content:center; gap:3px; width:100%;"
         [style.opacity]="locked ? '0.4' : '1'">

      <!-- Modo simple (sin proveedor) -->
      <ng-container *ngIf="!idProvider">
        <i class="bi bi-chat-dots" [style.color]="count ? '#0d6efd' : '#aaa'"></i>
        <span *ngIf="count"  style="font-size:11px; color:#0d6efd; font-weight:600;">{{ count }}</span>
        <span *ngIf="!count" style="font-size:11px; color:#aaa;">+</span>
      </ng-container>

      <!-- Modo dual: artículo / proveedor -->
      <ng-container *ngIf="idProvider">
        <i class="bi bi-chat-dots" style="color:#0d6efd; font-size:12px;"></i>
        <span style="font-size:11px; color:#0d6efd; font-weight:700;">{{ articleCount }}</span>
        <span style="font-size:10px; color:#bbb; font-weight:400;">/</span>
        <span style="font-size:11px; color:#e65100; font-weight:700;">{{ providerCount }}</span>
      </ng-container>
    </div>
  `
})
export class ItemCommentsCellRendererComponent implements ICellRendererAngularComp, OnDestroy {
  private commentsService = inject(ItemCommentsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private signalsService  = inject(SignalsService);
  private destroy$ = new Subject<void>();

  articleCount = 0;
  providerCount = 0;
  get count() { return this.articleCount; }

  numArticle = '';
  documentType = '';
  idDocument = 0;
  idProvider = 0;
  locked = false;
  articleName = '';
  providerName = '';
  private lastLoadKey = '';
  private lastProviderLoadKey = '';

  agInit(params: CellParams): void {
    this.numArticle   = params.numArticle
      ? String(params.numArticle)
      : String(params.data?.numArticulo || params.data?.numeroArticulo || params.data?.numArticle || '');
    this.documentType = params.documentType || '';
    this.idDocument   = params.idDocument   || 0;
    this.idProvider   = Number(params.idProvider ?? 0);
    this.locked       = params.locked       || false;
    this.articleName  = params.articleName  || '';
    this.providerName = params.providerName || '';
    this.loadCount();
    if (this.idProvider) this.loadProviderCount();

    this.commentsService.commentSaved$
      .pipe(takeUntil(this.destroy$))
      .subscribe((saved: ItemComment) => {
        const sameDoc = saved.documentType === this.documentType &&
                        String(saved.idDocument) === String(this.idDocument);
        if (sameDoc && String(saved.numArticle) === String(this.numArticle) && !saved.idProvider) {
          this.lastLoadKey = '';
          this.loadCount();
        }
        if (sameDoc && saved.idProvider && Number(saved.idProvider) === this.idProvider) {
          this.lastProviderLoadKey = '';
          this.loadProviderCount();
        }
      });
  
    this.cdr.detectChanges();}

  refresh(params: CellParams): boolean {
    const newNumArticle   = params.numArticle
      ? String(params.numArticle)
      : String(params.data?.numArticulo || params.data?.numeroArticulo || params.data?.numArticle || '');
    const newDocumentType = params.documentType || '';
    const newIdDocument   = params.idDocument   || 0;
    const newIdProvider   = Number(params.idProvider ?? 0);
    const newLocked       = params.locked       || false;
    const newArticleName  = params.articleName  || '';
    const newProviderName = params.providerName || '';

    // Actualizar siempre articleName y providerName (no requieren recarga de datos)
    this.articleName  = newArticleName;
    this.providerName = newProviderName;

    if (newNumArticle !== this.numArticle || newDocumentType !== this.documentType ||
        newIdDocument !== this.idDocument || newLocked !== this.locked || newIdProvider !== this.idProvider) {
      this.numArticle   = newNumArticle;
      this.documentType = newDocumentType;
      this.idDocument   = newIdDocument;
      this.idProvider   = newIdProvider;
      this.locked       = newLocked;
      this.loadCount();
      if (this.idProvider) this.loadProviderCount();
    }
    return true;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCount() {
    if (!this.documentType || !this.idDocument || !this.numArticle) return;

    const loadKey = `${this.documentType}:${this.idDocument}:${this.numArticle}`;
    if (loadKey === this.lastLoadKey) return;
    this.lastLoadKey = loadKey;

    this.commentsService.getComments(this.documentType, this.idDocument, this.numArticle)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: ItemComment[]) => {
          // Defensivo: contar solo comentarios SIN proveedor (idProvider null)
          this.articleCount = (data || []).filter(c => !c.idProvider).length;
        },
        error: () => { this.articleCount = 0; }
      });
  }

  private loadProviderCount() {
    if (!this.documentType || !this.idDocument || !this.idProvider) return;

    const loadKey = `${this.documentType}:${this.idDocument}:prov:${this.idProvider}:${this.numArticle}`;
    if (loadKey === this.lastProviderLoadKey) return;
    this.lastProviderLoadKey = loadKey;

    this.commentsService.getProviderComments(this.documentType, this.idDocument, this.idProvider, this.numArticle)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: ItemComment[]) => {
          // Defensivo: contar solo comentarios del proveedor seleccionado
          this.providerCount = (data || []).filter(c => Number(c.idProvider) === this.idProvider).length;
        },
        error: () => { this.providerCount = 0; }
      });
  }

  openChat() {
    if (this.locked) return;
    this.commentsService.openChatFor$.next({
      documentType: this.documentType,
      idDocument:   this.idDocument,
      numArticle:   this.numArticle,
      articleName:  this.articleName,
      providerMessages: this.idProvider > 0
        ? { idProvider: this.idProvider, providerName: this.providerName }
        : undefined
    });
  }
}
