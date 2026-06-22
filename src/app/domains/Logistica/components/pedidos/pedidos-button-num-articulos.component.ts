import { Component, ChangeDetectorRef, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams, IRowNode } from 'ag-grid-community';
import { CommonModule } from '@angular/common';

export interface INumArticulosRendererParams extends ICellRendererParams {
  onClick: (node: IRowNode) => void;
}

@Component({
  selector: 'app-num-articulos-renderer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      class="btn btn-link text-primary"
      (click)="onClick($event)"
      style="text-decoration: none; cursor: pointer; font-size: 11px;">
      <span>{{ value }}</span>
      <i class="bi bi-chevron-down ms-1" style="font-size: 9px;"></i>
    </button>
  `
})
export class NumArticulosRendererComponent implements ICellRendererAngularComp {
  private cdr = inject(ChangeDetectorRef);
  public params!: INumArticulosRendererParams;
  public value: string | number;

  agInit(params: INumArticulosRendererParams): void {
    this.params = params;
    this.value = this.params.value || 0;
  }

  refresh(params: INumArticulosRendererParams): boolean {
    this.params = params;
    this.value = this.params.value || 0;
    this.cdr.detectChanges();
    return true;
  }

  onClick(event: any): void {
    event.stopPropagation();
    console.log('🖱️ NumArticulosRenderer click - node:', this.params.node?.data?.id);
    if (this.params.onClick) {
      this.params.onClick(this.params.node);
    }
  }
}