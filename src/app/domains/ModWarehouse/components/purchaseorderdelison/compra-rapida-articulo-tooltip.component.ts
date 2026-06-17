import { inject, Component, ChangeDetectorRef} from '@angular/core';
import { ITooltipAngularComp } from 'ag-grid-angular';
import { ITooltipParams } from 'ag-grid-community';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-compra-rapida-articulo-tooltip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cr-tooltip">
      <div class="cr-title">{{ articulo }}</div>
      <div class="cr-row"><span class="cr-label">Precio unitario</span><span class="cr-val">{{ precioUnitario }}</span></div>
      <div class="cr-row"><span class="cr-label">Total</span><span class="cr-val">{{ total }}</span></div>
      <div class="cr-row"><span class="cr-label">Nota / Factura</span><span class="cr-val">{{ notaFactura }}</span></div>
      <div class="cr-row"><span class="cr-label">Fecha entrada almacén</span><span class="cr-val">{{ fechaEntradaAlmacen }}</span></div>
      <div class="cr-row"><span class="cr-label">Cad. Min. Req</span><span class="cr-val">{{ cadMinReq }}</span></div>
    </div>
  `,
  styles: [`
    .cr-tooltip {
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      padding: 12px 14px;
      min-width: 260px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px;
      color: #ffffff;
      pointer-events: none;
    }
    .cr-title {
      font-weight: 600; font-size: 13px; margin-bottom: 8px; color: #ffffff;
      border-bottom: 1px solid rgba(255,255,255,0.25); padding-bottom: 6px;
    }
    .cr-row {
      display: flex; justify-content: space-between; gap: 16px; padding: 3px 0; line-height: 1.5;
    }
    .cr-label { color: rgba(255,255,255,0.8); }
    .cr-val { color: #ffffff; font-weight: 600; text-align: right; }
  `]
})
export class CompraRapidaArticuloTooltipComponent implements ITooltipAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);
  articulo = 'Artículo';
  precioUnitario = '—';
  total = '—';
  notaFactura = '—';
  fechaEntradaAlmacen = '—';
  cadMinReq = '—';

  agInit(params: ITooltipParams): void {
    const d: any = params.data || {};
    this.articulo = d.article || 'Artículo';
    this.precioUnitario = this.fmtMoneda(d.price);
    this.total = this.fmtMoneda(d.total);
    this.notaFactura = d.notaFactura || '—';
    this.fechaEntradaAlmacen = this.fmtFecha(d.fechaEntradaAlmacen);
    this.cadMinReq = (d.caducidadMinimaRequerida != null && d.caducidadMinimaRequerida !== '')
      ? String(d.caducidadMinimaRequerida) : '—';
  
    this.cdr.detectChanges();}

  private fmtMoneda(v: any): string {
    const n = Number(v);
    return Number.isFinite(n) && n > 0
      ? n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })
      : '—';
  }

  private fmtFecha(v: any): string {
    if (!v) return '—';
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v);
  }
}
