import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams, IRowNode } from 'ag-grid-community';
import { CommonModule } from '@angular/common';

export interface IDeleteButtonCellRendererParams extends ICellRendererParams {
  onClick: (node: IRowNode) => void;
  icon?: string;
  iconColor?: string;
  title?: string;
  disabledTitle?: string;
}

@Component({
  selector: 'app-delete-button-cell-renderer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="d-flex justify-content-center align-items-center h-100">
      <i
        [class]="iconClass"
        [style.color]="isDisabled ? '#ccc' : iconColor"
        [style.cursor]="isDisabled ? 'not-allowed' : 'pointer'"
        [title]="isDisabled ? disabledTitle : title"
        (click)="onClick($event)"
        style="font-size: 1rem;">
      </i>
    </div>
  `
})
export class DeleteButtonCellRendererComponent implements ICellRendererAngularComp {
  public params!: IDeleteButtonCellRendererParams;
  public iconClass: string = 'bi bi-trash';
  public iconColor: string = '#dc3545';
  public title: string = 'Eliminar registro';
  public disabledTitle: string = 'No se puede eliminar, tiene detalles';
  public isDisabled: boolean = false;

  agInit(params: IDeleteButtonCellRendererParams): void {
    this.params = params;
    this.iconClass = 'bi ' + (this.params.icon || 'bi-trash');
    this.iconColor = this.params.iconColor || '#dc3545';
    this.title = this.params.title || 'Eliminar registro';
    this.disabledTitle = this.params.disabledTitle || 'No se puede eliminar, tiene detalles';
    this.updateDisabledState();
  }

  refresh(params: IDeleteButtonCellRendererParams): boolean {
    this.params = params;
    this.updateDisabledState();
    return true;
  }

  private updateDisabledState(): void {
    const countrow = this.params.data?.countrow || 0;
    this.isDisabled = countrow > 0;
  }

  onClick(event: any): void {
    event.stopPropagation();
    if (!this.isDisabled) {
      this.params.onClick(this.params.node);
    }
  }
}
