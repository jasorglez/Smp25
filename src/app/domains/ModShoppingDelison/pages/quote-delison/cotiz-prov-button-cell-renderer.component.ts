import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

/**
 * Renderer de la columna "COTIZACIÓN PROVEEDOR" (botón "N prov").
 *
 * ¿Por qué un componente propio en vez del tooltip nativo de AG Grid?
 * - El renderer DEBE ser un componente Angular (referencia estable) para que NO parpadee: el
 *   `colDefs` del grid es un getter que se reconstruye en cada ciclo de detección; con un renderer
 *   de función/DOM AG Grid re-ejecuta el renderer y recrea el botón sin parar (parpadeo). Con un
 *   componente Angular, AG Grid reutiliza la instancia → sin parpadeo.
 * - Pero el tooltip NATIVO de AG Grid no dispara sobre un componente Angular como renderer (y en
 *   este grid master-detail anidado además se recortaría por el overflow). Por eso el tooltip se
 *   maneja MANUALMENTE: un panel FLOTANTE (position:fixed, z-index alto) anexado a document.body,
 *   con el diseño azul estándar (StyledTooltipComponent).
 */
@Component({
  selector: 'app-cotiz-prov-button-cell-renderer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button class="btn btn-xs btn-outline-primary w-100 py-0 px-1"
            style="font-size:0.7rem;line-height:1.2;"
            (click)="onClick($event)"
            (mouseenter)="scheduleShow($event)"
            (mousemove)="reposition($event)"
            (mouseleave)="hide()">
      <i class="bi bi-people-fill" style="font-size:0.7rem;"></i>
      <span style="font-size:0.7rem;">{{ count }} prov</span>
    </button>
  `,
  styles: [`
    .btn-xs { padding: 1px 4px; font-size: 0.7rem; line-height: 1.2; }
  `]
})
export class CotizProvButtonCellRendererComponent implements ICellRendererAngularComp, OnDestroy {
  public params!: ICellRendererParams;
  public count = 0;

  private tipEl: HTMLElement | null = null;
  private showTimer: any = null;

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.count = this.computeCount(params);
  }

  refresh(params: ICellRendererParams): boolean {
    this.params = params;
    this.count = this.computeCount(params);
    return true;
  }

  ngOnDestroy(): void {
    this.hide();
  }

  private computeCount(params: ICellRendererParams): number {
    const slots = (params.data?.providerSlots || []) as any[];
    return slots.filter((s: any) => Number(s?.idProvider) > 0).length;
  }

  onClick(_event: MouseEvent): void {
    this.hide();
    const parent = (this.params.context as any)?.componentParent;
    if (parent?.toggleProvidersListCascade) {
      parent.toggleProvidersListCascade(this.params.node);
    }
  }

  /** Programa mostrar el tooltip flotante tras un pequeño retraso (como tooltipShowDelay). */
  scheduleShow(event: MouseEvent): void {
    this.clearTimer();
    const x = event.clientX, y = event.clientY;
    this.showTimer = setTimeout(() => this.show(x, y), 350);
  }

  private show(x: number, y: number): void {
    if (this.tipEl) return;
    const el = document.createElement('div');
    el.innerHTML = this.buildHtml();
    el.style.cssText = 'position:fixed;z-index:100000;pointer-events:none;';
    document.body.appendChild(el);
    this.tipEl = el;
    this.place(x, y);
  }

  /** Reposiciona si ya está visible (sigue al cursor). */
  reposition(event: MouseEvent): void {
    if (this.tipEl) this.place(event.clientX, event.clientY);
  }

  private place(x: number, y: number): void {
    if (!this.tipEl) return;
    const rect = this.tipEl.getBoundingClientRect();
    let left = x + 14;
    let top = y + 16;
    // Evitar que se salga de la pantalla por la derecha / abajo.
    if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
    if (top + rect.height > window.innerHeight - 8) top = y - rect.height - 12;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    this.tipEl.style.left = `${left}px`;
    this.tipEl.style.top = `${top}px`;
  }

  hide(): void {
    this.clearTimer();
    if (this.tipEl) {
      this.tipEl.remove();
      this.tipEl = null;
    }
  }

  private clearTimer(): void {
    if (this.showTimer) { clearTimeout(this.showTimer); this.showTimer = null; }
  }

  /** Construye el panel azul estándar (mismo look que StyledTooltipComponent) con la tabla. */
  private buildHtml(): string {
    // Solo los artículos SOLICITADOS en este pedimento (item.pedimento === true); los demás son de
    // contexto de la requisición y no deben mostrarse aquí.
    const allItems = (this.params.data?.articulos || []) as any[];
    const items = allItems.filter((it: any) => it?.pedimento === true || it?.pedimento === 1);
    const wrap = (inner: string) => `
      <div style="background:linear-gradient(135deg,#1e3a8a 0%,#3b82f6 100%);border-radius:8px;
        box-shadow:0 8px 24px rgba(0,0,0,.35);color:#fff;font-size:12px;min-width:200px;
        max-width:460px;overflow:hidden;">${inner}</div>`;

    if (!items.length) {
      return wrap(`<div style="padding:8px 12px;line-height:1.5;">-</div>`);
    }

    const header = `<div style="font-weight:700;padding:8px 12px;background:rgba(255,255,255,.10);
      border-bottom:1px solid rgba(255,255,255,.15);letter-spacing:.02em;text-transform:uppercase;">
      ARTÍCULOS DEL PEDIMENTO</div>`;

    const esc = (s: any) => String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const rows = items.map((it: any) => {
      const art = esc((it.article || it.nameArticle || '-')).toUpperCase();
      const qty = esc(it.quantity ?? '-');
      return `<tr>
        <td style="padding:3px 8px;white-space:nowrap;color:rgba(255,255,255,.92);">${art}</td>
        <td style="padding:3px 8px;white-space:nowrap;text-align:right;color:rgba(255,255,255,.92);">${qty}</td>
      </tr>`;
    }).join('');

    const table = `<div style="padding:8px 12px;">
      <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
        <thead><tr>
          <th style="padding:3px 8px;white-space:nowrap;text-align:left;font-weight:700;border-bottom:1px solid rgba(255,255,255,.35);">Artículo</th>
          <th style="padding:3px 8px;white-space:nowrap;text-align:right;font-weight:700;border-bottom:1px solid rgba(255,255,255,.35);">Cant. Requerida</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

    return wrap(header + table);
  }
}
