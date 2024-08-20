import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalService } from 'app/services/modal.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-multi-line-editor',
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div *ngIf="isVisible" class="modal fade show" tabindex="-1" style="display: block;">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
          <h1 class="modal-title fs-5">Editar Comentario</h1>
            <button type="button" class="btn-close" data-bs-dismiss="modal" (click)="onCancel()"></button>
          </div>
          <div class="modal-body">
            <textarea class="form-control" [(ngModel)]="value" rows="5"></textarea>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="onCancel()">Cancelar</button>
            <button type="button" class="btn btn-primary" (click)="onSave()">Guardar</button>
          </div>
        </div>
      </div>
    </div>
    <div *ngIf="isVisible" class="modal-backdrop fade show"></div>
  `
})
export class MultiLineEditorComponent implements OnInit, OnDestroy {
  isVisible = false;
  value: string = '';
  private params: any;
  private subscription: Subscription;

  constructor(private modalService: ModalService) { }

  ngOnInit() {
    this.subscription = this.modalService.modalVisible$.subscribe(
      visible => this.isVisible = visible
    );
    this.modalService.modalData$.subscribe(data => {
      if (data) {
        this.params = data.params;
        this.value = data.params.value;
      }
    });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  onSave() {
    // Utilizamos el método correcto para actualizar el valor de la celda
    if (this.params && this.params.api && this.params.column) {
      this.params.api.stopEditing();
      this.params.node.setDataValue(this.params.column.colId, this.value);
    }
    this.modalService.hideModal();
  }

  onCancel() {
    if (this.params && this.params.api) {
      this.params.api.stopEditing();
    }
    this.modalService.hideModal();
  }
}