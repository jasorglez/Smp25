import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CostoIvaTooltipService {
  private renderer: Renderer2;
  private tooltipEl: HTMLElement | null = null;

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  show(cellRect: DOMRect, costoUnitario: number): void {
    this.hide();

    const el = this.renderer.createElement('div') as HTMLElement;

    const styles: Record<string, string> = {
      position: 'fixed',
      'z-index': '10001',
      'pointer-events': 'none',
      'min-width': '220px',
      background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
      'border-radius': '8px',
      'box-shadow': '0 8px 24px rgba(0,0,0,0.4)',
      border: '1px solid rgba(255,255,255,0.1)',
      padding: '12px 14px',
      color: '#ffffff',
      'font-size': '12px',
      'line-height': '1.6',
      opacity: '0',
      visibility: 'hidden',
      transition: 'opacity 0.25s ease, visibility 0.25s ease'
    };
    Object.entries(styles).forEach(([k, v]) => this.renderer.setStyle(el, k, v));

    // Título
    const title = this.renderer.createElement('div');
    this.renderer.setStyle(title, 'font-weight', '600');
    this.renderer.setStyle(title, 'font-size', '13px');
    this.renderer.setStyle(title, 'margin-bottom', '8px');
    this.renderer.appendChild(title, this.renderer.createText('Costo Unitario'));
    this.renderer.appendChild(el, title);

    // Separador
    const sep = this.renderer.createElement('div');
    this.renderer.setStyle(sep, 'border-top', '1px solid rgba(255,255,255,0.25)');
    this.renderer.setStyle(sep, 'margin-bottom', '8px');
    this.renderer.appendChild(el, sep);

    // Fila: Incluye IVA
    const row = this.renderer.createElement('div');
    this.renderer.setStyle(row, 'display', 'flex');
    this.renderer.setStyle(row, 'gap', '8px');
    this.renderer.setStyle(row, 'align-items', 'center');

    const label = this.renderer.createElement('span');
    this.renderer.setStyle(label, 'color', 'rgba(255,255,255,0.8)');
    this.renderer.setStyle(label, 'font-weight', '600');
    this.renderer.setStyle(label, 'min-width', '100px');
    this.renderer.appendChild(label, this.renderer.createText('Original (sin IVA):'));
    this.renderer.appendChild(row, label);

    const value = this.renderer.createElement('span');
    this.renderer.setStyle(value, 'color', '#ffffff');
    const formatted = `$${Number(costoUnitario).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    this.renderer.appendChild(value, this.renderer.createText(formatted));
    this.renderer.appendChild(row, value);

    this.renderer.appendChild(el, row);
    this.renderer.appendChild(document.body, el);
    this.tooltipEl = el;

    // Posición: arriba de la celda
    const top = cellRect.top - 8;
    const left = cellRect.left;
    this.renderer.setStyle(el, 'top', `${top}px`);
    this.renderer.setStyle(el, 'left', `${left}px`);
    this.renderer.setStyle(el, 'transform', 'translateY(-100%)');

    setTimeout(() => {
      if (this.tooltipEl) {
        this.renderer.setStyle(this.tooltipEl, 'opacity', '1');
        this.renderer.setStyle(this.tooltipEl, 'visibility', 'visible');
      }
    }, 10);
  }

  hide(): void {
    if (this.tooltipEl) {
      this.renderer.removeChild(document.body, this.tooltipEl);
      this.tooltipEl = null;
    }
  }
}
