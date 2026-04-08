import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { ItemCommentsService, ItemComment } from 'app/services/item-comments.service';
import { SignalsService } from 'app/services/signals.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-item-comments-cell-renderer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Celda -->
    <div (click)="openChat()" style="cursor:pointer; display:flex; align-items:center; gap:4px;">
      <i class="bi bi-chat-dots" [style.color]="comments.length ? '#0d6efd' : '#aaa'"></i>
      <span *ngIf="comments.length" style="font-size:11px; color:#0d6efd; font-weight:600;">
        {{ comments.length }}
      </span>
      <span *ngIf="!comments.length" style="font-size:11px; color:#aaa;">+</span>
    </div>

    <!-- Mini-chat panel -->
    <div *ngIf="showChat" class="chat-backdrop" (click)="closeChat()"></div>
    <div *ngIf="showChat" class="chat-panel">
      <!-- Header -->
      <div class="chat-header">
        <span class="chat-title">
          <i class="bi bi-chat-dots me-1"></i>{{ numArticle }}
        </span>
        <button class="btn-close btn-close-white btn-sm" (click)="closeChat()"></button>
      </div>

      <!-- Mensajes -->
      <div class="chat-messages" #messagesContainer>
        <div *ngIf="!comments.length" class="chat-empty">Sin comentarios aún</div>
        <div *ngFor="let c of comments" class="chat-bubble"
             [class.chat-bubble-own]="c.idUser === currentUserId">
          <div class="chat-bubble-meta">
            <span class="chat-user">{{ c.userName }}</span>
            <span class="chat-date">{{ formatDate(c.createdAt) }}</span>
            <button *ngIf="c.idUser === currentUserId && editingId !== c.id"
                    class="btn-edit" (click)="startEdit(c)" title="Editar">
              <i class="bi bi-pencil-fill"></i>
            </button>
          </div>
          <!-- Modo lectura -->
          <div *ngIf="editingId !== c.id" class="chat-text">{{ c.text }}</div>
          <!-- Modo edición -->
          <div *ngIf="editingId === c.id" class="chat-edit-row">
            <textarea class="form-control form-control-sm" [(ngModel)]="editingText" rows="2"
                      (click)="$event.stopPropagation()"></textarea>
            <div class="chat-edit-actions">
              <button class="btn btn-sm btn-primary" (click)="saveEdit(c)" [disabled]="saving">
                Guardar
              </button>
              <button class="btn btn-sm btn-secondary" (click)="cancelEdit()">Cancelar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Input nuevo -->
      <div class="chat-input-row">
        <textarea class="form-control form-control-sm" [(ngModel)]="newText"
                  placeholder="Escribe un comentario..."
                  rows="2" (click)="$event.stopPropagation()"
                  (keydown.enter)="$event.preventDefault(); sendComment()"></textarea>
        <button class="btn btn-sm btn-primary mt-1 w-100"
                (click)="sendComment()" [disabled]="!newText.trim() || saving">
          <i class="bi bi-send me-1"></i>Enviar
        </button>
      </div>
    </div>
  `,
  styles: [`
    .chat-backdrop {
      position: fixed; inset: 0; z-index: 1040;
    }
    .chat-panel {
      position: fixed;
      width: 300px;
      max-height: 420px;
      background: #fff;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,.18);
      z-index: 1050;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .chat-header {
      background: #0d6efd;
      color: #fff;
      padding: 8px 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .chat-title { font-size: 12px; font-weight: 600; }
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-height: 80px;
      max-height: 220px;
    }
    .chat-empty { color: #aaa; font-size: 11px; text-align: center; padding: 12px 0; }
    .chat-bubble {
      background: #f1f3f5;
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 11px;
    }
    .chat-bubble-own { background: #dbeafe; }
    .chat-bubble-meta {
      display: flex; align-items: center; gap: 6px; margin-bottom: 2px;
    }
    .chat-user { font-weight: 600; color: #0d6efd; }
    .chat-date { color: #aaa; font-size: 10px; flex: 1; }
    .btn-edit {
      background: none; border: none; cursor: pointer;
      color: #aaa; font-size: 10px; padding: 0;
    }
    .btn-edit:hover { color: #0d6efd; }
    .chat-text { color: #333; white-space: pre-wrap; }
    .chat-edit-row { display: flex; flex-direction: column; gap: 4px; }
    .chat-edit-actions { display: flex; gap: 4px; }
    .chat-input-row { padding: 8px; border-top: 1px solid #dee2e6; }
  `]
})
export class ItemCommentsCellRendererComponent implements ICellRendererAngularComp, OnDestroy {
  private commentsService = inject(ItemCommentsService);
  private signalsService = inject(SignalsService);

  comments: ItemComment[] = [];
  showChat = false;
  newText = '';
  editingId: number | null = null;
  editingText = '';
  saving = false;

  currentUserId = 0;
  currentUserName = '';
  numArticle = '';
  idRequisicion = 0;

  private panelTop = 0;
  private panelLeft = 0;

  agInit(params: ICellRendererParams): void {
    this.currentUserId   = this.signalsService.getIdUSer()();
    this.currentUserName = this.signalsService.getDisplayName()() || '';
    this.numArticle      = String(params.data?.numArticulo || params.data?.numeroArticulo || params.data?.numArticle || '');
    this.idRequisicion   = params.data?.requisitionId || 0;
    this.loadComments();
  }

  refresh(params: ICellRendererParams): boolean { return false; }
  ngOnDestroy(): void { this.showChat = false; }

  loadComments() {
    if (!this.idRequisicion || !this.numArticle) return;
    this.commentsService.getComments(this.idRequisicion, this.numArticle).subscribe({
      next: (data) => { this.comments = data; },
      error: () => { this.comments = []; }
    });
  }

  openChat() {
    this.showChat = true;
  }

  closeChat() {
    this.showChat = false;
    this.cancelEdit();
  }

  async sendComment() {
    if (!this.newText.trim() || this.saving) return;
    this.saving = true;
    const comment: ItemComment = {
      idRequisicion: this.idRequisicion,
      numArticle: this.numArticle,
      idUser: this.currentUserId,
      userName: this.currentUserName,
      text: this.newText.trim()
    };
    try {
      const saved = await firstValueFrom(this.commentsService.addComment(comment));
      this.comments = [...this.comments, saved];
      this.newText = '';
    } finally {
      this.saving = false;
    }
  }

  startEdit(c: ItemComment) {
    this.editingId = c.id!;
    this.editingText = c.text;
  }

  cancelEdit() {
    this.editingId = null;
    this.editingText = '';
  }

  async saveEdit(c: ItemComment) {
    if (!this.editingText.trim() || this.saving) return;
    this.saving = true;
    try {
      const updated = await firstValueFrom(this.commentsService.editComment(c.id!, this.editingText.trim()));
      const idx = this.comments.findIndex(x => x.id === c.id);
      if (idx !== -1) this.comments[idx] = { ...this.comments[idx], text: updated.text };
      this.cancelEdit();
    } finally {
      this.saving = false;
    }
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  }
}
