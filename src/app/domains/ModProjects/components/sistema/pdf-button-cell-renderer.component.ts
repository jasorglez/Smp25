import { inject, Component, ChangeDetectorRef} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams, IRowNode } from 'ag-grid-community';
import { CommonModule } from '@angular/common';

export interface IPdfButtonCellRendererParams extends ICellRendererParams {
  onClick: (node: IRowNode) => void;
  icon?: string;
  iconColor?: string;
  title?: string;
}

@Component({
  selector: 'app-pdf-button-cell-renderer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="d-flex justify-content-center align-items-center h-100">
      <i
        [class]="iconClass"
        [style.color]="iconColor"
        [title]="params.title || 'Generar reporte PDF'"
        (click)="onClick($event)"
        style="font-size: 1.2rem; cursor: pointer;">
      </i>
    </div>
  `
})
export class PdfButtonCellRendererComponent implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);
  public params!: IPdfButtonCellRendererParams;
  public iconClass: string = 'bi bi-file-earmark-pdf';
  public iconColor: string = '#dc3545';

  agInit(params: IPdfButtonCellRendererParams): void {
    this.params = params;
    this.iconClass = 'bi ' + (this.params.icon || 'bi-file-earmark-pdf');
    this.iconColor = this.params.iconColor || '#dc3545';
  
    this.cdr.detectChanges();}

  refresh(params: IPdfButtonCellRendererParams): boolean {
    this.params = params;
    return true;
  }

  onClick(event: any): void {
    event.stopPropagation();
    this.params.onClick(this.params.node);
  }
}
