import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ArticuloTooltipService {
  private renderer: Renderer2;
  private tooltipElement: HTMLElement | null = null;

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  showTooltip(
    cellRect: DOMRect,
    info: { nuevoRecurrente: string; numArticuloInterno: string; numArticuloExterno: string; prioridad: string }
  ): void {
    this.hideTooltip();

    this.tooltipElement = this.renderer.createElement('div');
    this.renderer.setStyle(this.tooltipElement, 'position', 'fixed');
    this.renderer.setStyle(this.tooltipElement, 'z-index', '10001');
    this.renderer.setStyle(this.tooltipElement, 'pointer-events', 'none');
    this.renderer.setStyle(this.tooltipElement, 'min-width', '300px');
    this.renderer.setStyle(this.tooltipElement, 'max-width', '400px');
    this.renderer.setStyle(this.tooltipElement, 'background', 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)');
    this.renderer.setStyle(this.tooltipElement, 'border-radius', '8px');
    this.renderer.setStyle(this.tooltipElement, 'box-shadow', '0 8px 24px rgba(0, 0, 0, 0.4)');
    this.renderer.setStyle(this.tooltipElement, 'border', '1px solid rgba(255, 255, 255, 0.1)');
    this.renderer.setStyle(this.tooltipElement, 'padding', '12px 14px');
    this.renderer.setStyle(this.tooltipElement, 'color', '#ffffff');
    this.renderer.setStyle(this.tooltipElement, 'font-size', '12px');
    this.renderer.setStyle(this.tooltipElement, 'line-height', '1.6');
    this.renderer.setStyle(this.tooltipElement, 'opacity', '0');
    this.renderer.setStyle(this.tooltipElement, 'visibility', 'hidden');
    this.renderer.setStyle(this.tooltipElement, 'transition', 'opacity 0.3s ease, visibility 0.3s ease');

    const content = this.buildTooltipContent(info);
    this.renderer.appendChild(this.tooltipElement, content);
    this.renderer.appendChild(document.body, this.tooltipElement);

    const top = cellRect.top;
    const left = cellRect.right + 8;
    this.renderer.setStyle(this.tooltipElement, 'top', `${top}px`);
    this.renderer.setStyle(this.tooltipElement, 'left', `${left}px`);

    setTimeout(() => {
      if (this.tooltipElement) {
        this.renderer.setStyle(this.tooltipElement, 'opacity', '1');
        this.renderer.setStyle(this.tooltipElement, 'visibility', 'visible');
      }
    }, 10);
  }

  hideTooltip(): void {
    if (this.tooltipElement) {
      this.renderer.removeChild(document.body, this.tooltipElement);
      this.tooltipElement = null;
    }
  }

  private buildTooltipContent(info: any): HTMLElement {
    const container = this.renderer.createElement('div');

    const title = this.renderer.createElement('div');
    this.renderer.setStyle(title, 'font-weight', '600');
    this.renderer.setStyle(title, 'font-size', '13px');
    this.renderer.setStyle(title, 'margin-bottom', '8px');
    const titleText = this.renderer.createText('Información del Artículo');
    this.renderer.appendChild(title, titleText);
    this.renderer.appendChild(container, title);

    const rows = [
      { label: 'Nuevo/Recurrente:', value: info.nuevoRecurrente },
      { label: '# Artículo Interno:', value: info.numArticuloInterno },
      { label: '# Artículo Externo:', value: info.numArticuloExterno },
      { label: 'Prioridad:', value: info.prioridad }
    ];

    rows.forEach((row, idx) => {
      const rowEl = this.renderer.createElement('div');
      this.renderer.setStyle(rowEl, 'display', 'flex');
      this.renderer.setStyle(rowEl, 'gap', '8px');
      this.renderer.setStyle(rowEl, 'margin-bottom', idx < rows.length - 1 ? '6px' : '0');
      this.renderer.setStyle(rowEl, 'align-items', 'flex-start');

      const label = this.renderer.createElement('span');
      this.renderer.setStyle(label, 'color', 'rgba(255, 255, 255, 0.8)');
      this.renderer.setStyle(label, 'font-weight', '600');
      this.renderer.setStyle(label, 'min-width', '140px');
      this.renderer.setStyle(label, 'flex-shrink', '0');
      const labelText = this.renderer.createText(row.label);
      this.renderer.appendChild(label, labelText);
      this.renderer.appendChild(rowEl, label);

      const value = this.renderer.createElement('span');
      this.renderer.setStyle(value, 'color', '#ffffff');
      this.renderer.setStyle(value, 'word-break', 'break-word');
      const valueText = this.renderer.createText(row.value);
      this.renderer.appendChild(value, valueText);
      this.renderer.appendChild(rowEl, value);

      this.renderer.appendChild(container, rowEl);
    });

    return container;
  }
}
