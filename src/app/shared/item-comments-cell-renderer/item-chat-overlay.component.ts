import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, firstValueFrom } from 'rxjs';
import { ItemCommentsService, ItemComment } from 'app/services/item-comments.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-item-chat-overlay',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <ng-container *ngIf="showChat">
      <div class="chat-backdrop" (click)="close()"></div>
      <div class="chat-panel">
        <div class="chat-header">
          <span class="chat-title"><i class="bi bi-chat-dots me-1"></i>{{ numArticle }}</span>
          <button class="btn-close btn-close-white btn-sm" (click)="close()"></button>
        </div>
        <div class="chat-messages">
          <div *ngIf="!comments.length" class="chat-empty">Sin comentarios aún</div>
          <div *ngFor="let c of comments" class="chat-bubble"
               [class.chat-bubble-own]="c.idUser === currentUserId"
               [class.chat-bubble-tag]="getTag(c.text)">
            <div class="chat-bubble-meta">
              <span class="chat-user">{{ c.userName }}</span>
              <span class="chat-date">{{ formatDate(c.createdAt) }}</span>
              <span *ngIf="getTag(c.text)" class="chat-tag-inline">{{ getTag(c.text) }}</span>
              <button *ngIf="c.idUser === currentUserId && editingId !== c.id"
                      class="btn-edit" (click)="startEdit(c)">
                <i class="bi bi-pencil-fill"></i>
              </button>
            </div>
            <div *ngIf="editingId !== c.id" class="chat-text">{{ getBody(c.text) }}</div>
            <div *ngIf="editingId === c.id" class="chat-edit-row">
              <textarea class="form-control form-control-sm" [(ngModel)]="editingText" rows="2"
                        (click)="$event.stopPropagation()"></textarea>
              <div class="chat-edit-actions">
                <button class="btn btn-sm btn-primary" (click)="saveEdit(c)" [disabled]="saving">Guardar</button>
                <button class="btn btn-sm btn-secondary" (click)="cancelEdit()">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
        <div class="chat-input-row">
          <div *ngIf="pendingTag" class="chat-pending-tag">
            <i class="bi bi-tag-fill me-1"></i>{{ pendingTag }}
          </div>
          <textarea class="form-control form-control-sm" [(ngModel)]="newText"
                    placeholder="Escribe un comentario..."
                    rows="2" (click)="$event.stopPropagation()"
                    (keydown.enter)="$event.preventDefault(); send()"></textarea>
          <button class="btn btn-sm btn-primary mt-1 w-100"
                  (click)="send()" [disabled]="!newText.trim() || saving">
            <i class="bi bi-send me-1"></i>Enviar
          </button>
        </div>
      </div>
    </ng-container>
  `,
  styles: [`
    .chat-backdrop {
      position: fixed; inset: 0; z-index: 9040;
    }
    .chat-panel {
      position: fixed;
      top: 70px;
      right: 24px;
      width: 420px;
      max-height: 480px;
      background: #fff;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0,0,0,.25);
      z-index: 9050;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .chat-header {
      background: #0d6efd; color: #fff; padding: 10px 12px;
      display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
    }
    .chat-title { font-size: 11px; font-weight: 600; }
    .chat-bubble-tag { background: #fff0f0; border-left: 3px solid #c0392b; }
    .chat-tag-inline { color: #c0392b; font-weight: 700; font-size: 10px; margin-left: 4px; }
    .chat-messages {
      flex: 1; overflow-y: auto; padding: 8px;
      display: flex; flex-direction: column; gap: 6px;
      min-height: 80px; max-height: 270px;
    }
    .chat-empty { color: #aaa; font-size: 10px; text-align: center; padding: 12px 0; }
    .chat-bubble { background: #f1f3f5; border-radius: 6px; padding: 6px 8px; font-size: 10px; }
    .chat-bubble-own { background: #dbeafe; }
    .chat-bubble-meta { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
    .chat-user { font-weight: 600; color: #0d6efd; font-size: 10px; }
    .chat-date { color: #aaa; font-size: 9px; flex: 1; }
    .btn-edit { background: none; border: none; cursor: pointer; color: #aaa; font-size: 9px; padding: 0; }
    .btn-edit:hover { color: #0d6efd; }
    .chat-text { color: #333; white-space: pre-wrap; font-size: 10px; }
    .chat-edit-row { display: flex; flex-direction: column; gap: 4px; }
    .chat-edit-actions { display: flex; gap: 4px; }
    .chat-input-row { padding: 10px; border-top: 1px solid #dee2e6; flex-shrink: 0; }
    .chat-pending-tag { font-size: 9px; font-weight: 700; color: #c0392b; margin-bottom: 4px; }
  `]
})
export class ItemChatOverlayComponent implements OnInit, OnDestroy {
  private commentsService = inject(ItemCommentsService);
  private signalsService  = inject(SignalsService);
  private sub?: Subscription;

  showChat = false;
  comments: ItemComment[] = [];
  newText = '';
  editingId: number | null = null;
  editingText = '';
  saving = false;
  currentUserId = 0;
  currentUserName = '';
  numArticle = '';
  documentType = '';
  idDocument = 0;
  pendingTag = '';   // tag pendiente que se adhiere al próximo mensaje del usuario

  ngOnInit() {
    this.sub = this.commentsService.openChatFor$.subscribe(req => {
      this.currentUserId   = this.signalsService.getIdUSer()();
      this.currentUserName = this.signalsService.getDisplayName()() || '';
      this.documentType    = req.documentType;
      this.idDocument      = req.idDocument;
      this.numArticle      = req.numArticle;
      this.pendingTag      = req.autoMessage || '';
      this.newText = '';
      this.cancelEdit();
      this.showChat = true;
      this.commentsService.getComments(req.documentType, req.idDocument, req.numArticle).subscribe({
        next: d => { this.comments = d; },
        error: () => { this.comments = []; }
      });
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  loadComments() {
    if (!this.documentType || !this.idDocument || !this.numArticle) return;
    this.commentsService.getComments(this.documentType, this.idDocument, this.numArticle).subscribe({
      next: d => this.comments = d,
      error: () => this.comments = []
    });
  }

  close() { this.showChat = false; }

  async send() {
    if (!this.newText.trim() || this.saving) return;
    this.saving = true;
    // Si hay tag pendiente, lo codifica junto con el texto: "TAG\nMensaje"
    const textToSave = this.pendingTag
      ? `${this.pendingTag}\n${this.newText.trim()}`
      : this.newText.trim();
    try {
      const saved = await firstValueFrom(this.commentsService.addComment({
        documentType: this.documentType,
        idDocument:   this.idDocument,
        numArticle:   this.numArticle,
        idUser:       this.currentUserId,
        userName:     this.currentUserName,
        text:         textToSave
      }));
      this.comments = [...this.comments, saved];
      this.commentsService.commentSaved$.next(saved);
      this.newText = '';
      this.pendingTag = '';  // consumido
    } finally { this.saving = false; }
  }

  startEdit(c: ItemComment) { this.editingId = c.id!; this.editingText = c.text; }
  cancelEdit() { this.editingId = null; this.editingText = ''; }

  async saveEdit(c: ItemComment) {
    if (!this.editingText.trim() || this.saving) return;
    this.saving = true;
    try {
      const updated = await firstValueFrom(this.commentsService.editComment(c.id!, this.editingText.trim()));
      const idx = this.comments.findIndex(x => x.id === c.id);
      if (idx !== -1) this.comments[idx] = { ...this.comments[idx], text: updated.text };
      this.commentsService.commentSaved$.next(updated);
      this.cancelEdit();
    } finally { this.saving = false; }
  }

  getTag(text: string): string {
    if (!text) return '';
    const nl = text.indexOf('\n');
    return nl > 0 ? text.substring(0, nl).trim() : '';
  }

  getBody(text: string): string {
    if (!text) return '';
    const nl = text.indexOf('\n');
    return nl > 0 ? text.substring(nl + 1).trim() : text;
  }

  formatDate(d?: string): string {
    if (!d) return '';
    const dt = new Date(d);
    return `${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')} ${dt.getHours().toString().padStart(2,'0')}:${dt.getMinutes().toString().padStart(2,'0')}`;
  }
}
