import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

@Component({
  selector: 'app-detalle-button-renderer',
  standalone: true,
  template: `<button class="btn btn-sm btn-link p-0" (click)="onClick($event)">
    <i class="bi bi-list-ul" style="color:#0d6efd; font-size:14px;"></i>
  </button>`,
  styles: [`:host { display: flex; justify-content: center; align-items: center; height: 100%; }`]
})
export class DetalleButtonRendererComponent implements ICellRendererAngularComp {
  private params: any;

  agInit(params: ICellRendererParams): void {
    this.params = params;
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
