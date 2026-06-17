import { inject, Component, ChangeDetectorRef} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams, IRowNode } from 'ag-grid-community';
import { CommonModule } from '@angular/common';

export interface IButtonCellRendererParams extends ICellRendererParams {
  onClick: (node: IRowNode) => void;
  icon?: string;
  title?: string;
}

@Component({
  selector: 'app-button-cell-renderer-income',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      class="btn btn-sm btn-outline-primary w-100"
      (click)="onClick($event)"
      [title]="params.title || 'Hacer clic para ver los conceptos'">
      <i [class]="iconClass" class="me-1"></i>
      <span>{{ value }}</span>
    </button>
  `
})
export class ButtonCellRendererIncomeComponent implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);
  public params!: IButtonCellRendererParams;
  public value: string | number;
  public iconClass: string;

  agInit(params: IButtonCellRendererParams): void {
    this.params = params;
    this.value = this.params.value ?? '';
    this.iconClass = this.params.icon || 'bi-list-ul';
  
    this.cdr.detectChanges();}

  refresh(params: IButtonCellRendererParams): boolean {
    this.params = params;
    this.value = this.params.value ?? '';
    return true;
  }

  onClick(event: any): void {
    this.params.onClick(this.params.node);
  }
}
