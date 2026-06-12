import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

@Component({
  selector: 'app-detalle-button-renderer',
  standalone: true,
  template: `<button class="btn btn-sm btn-link p-0" (click)="onClick($event)" [title]="label">
    <i [class]="icon" [style.color]="color" style="font-size:14px;"></i>
  </button>`,
  styles: [`:host { display: flex; justify-content: center; align-items: center; height: 100%; }`]
})
export class DetalleButtonRendererComponent implements ICellRendererAngularComp {
  private params: any;
  icon = 'bi bi-list-ul';
  color = '#0d6efd';
  label = 'Detalle';

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.icon = (params as any).icon ?? 'bi bi-list-ul';
    this.color = (params as any).color ?? '#0d6efd';
    this.label = (params as any).label ?? 'Detalle';
  }

  refresh(params: ICellRendererParams): boolean {
    this.params = params;
    return true;
  }

  onClick(event: Event): void {
    event.stopPropagation();
    if (this.params.onDetalleClick) {
      this.params.onDetalleClick(this.params.data);
    }
  }
}
