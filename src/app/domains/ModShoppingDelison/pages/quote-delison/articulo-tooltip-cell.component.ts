import { Component, OnDestroy, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ArticuloTooltipService } from './articulo-tooltip.service';

@Component({
  selector: 'app-articulo-tooltip-cell',
  standalone: true,
  template: `<span class="articulo-cell" (mouseenter)="onMouseEnter($event)" (mouseleave)="onMouseLeave()">{{ value }}</span>`,
  styles: [`
    .articulo-cell {
      display: block;
      word-break: break-word;
      cursor: pointer;
    }
  `]
})
export class ArticuloTooltipCellComponent implements ICellRendererAngularComp, OnDestroy {
  private tooltipService = inject(ArticuloTooltipService);
  value: string = '';
  private params: any;

  agInit(params: any): void {
    this.params = params;
    this.value = params.value || '';
  }

  refresh(): boolean {
    return false;
  }

  ngOnDestroy(): void {
    this.tooltipService.hideTooltip();
  }

  onMouseEnter(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const rect = target.getBoundingClientRect();

    const data = this.params.data;
    if (!data) return;

    this.tooltipService.showTooltip(rect, {
      nuevoRecurrente: data.nuevoRecurrente || '—',
      numArticuloInterno: data.numArticuloInterno || '—',
      numArticuloExterno: data.numArticuloExterno || '—',
      prioridad: data.prioridad || '—'
    });
  }

  onMouseLeave(): void {
    this.tooltipService.hideTooltip();
  }
}
