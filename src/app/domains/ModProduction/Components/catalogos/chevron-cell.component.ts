import { Component, inject, ChangeDetectorRef} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';

@Component({
  selector: 'app-chevron-cell',
  standalone: true,
  template: `
    <div style="display: flex; align-items: center;">
      <span
        *ngIf="nodeLevel === 'category' || nodeLevel === 'family'"
        (click)="onChevronClick($event)"
        style="cursor: pointer; margin-right: 8px; color: #2196f3; font-weight: bold; font-size: 14px;">
        {{ isExpanded ? '▼' : '▶' }}
      </span>
      <span [style.margin-left.px]="nodeLevel === 'subfamily' ? 32 : 0" style="color: #1f3a93;">
        {{ description }}
      </span>
    </div>
  `
})
export class ChevronCellComponent implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);
  nodeLevel: string = '';
  description: string = '';
  isExpanded: boolean = false;
  data: any;

  private callbacks: any = {};

  agInit(params: any): void {
    this.data = params.data;
    this.nodeLevel = params.data.nodeLevel || '';
    this.description = params.data.description || '';
    this.isExpanded = params.data.isExpanded || false;
    this.callbacks = params.callbacks || {};
  
    this.cdr.detectChanges();}

  refresh(params: any): boolean {
    this.data = params.data;
    this.nodeLevel = params.data.nodeLevel || '';
    this.description = params.data.description || '';
    this.isExpanded = params.data.isExpanded || false;
    return true;
  }

  onChevronClick(event: Event): void {
    event.stopPropagation();

    if (this.nodeLevel === 'category' && this.callbacks.toggleCategory) {
      this.callbacks.toggleCategory(this.data);
    } else if (this.nodeLevel === 'family' && this.callbacks.toggleFamily) {
      this.callbacks.toggleFamily(this.data);
    }
  }
}
