import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ICellEditorAngularComp } from 'ag-grid-angular';

export interface MonedaOpt { id: number; abreviatura: string; nombre: string; }

/**
 * Editor compuesto para "Precio Unitario": input numérico + dropdown de moneda en la misma celda.
 * Devuelve el número (campo9) por getValue() y escribe la moneda elegida en params.data.idCurrency.
 */
@Component({
  selector: 'app-precio-moneda-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pm-wrap">
      <input #inp type="number" min="0" step="0.01" class="pm-num" [(ngModel)]="valor"
             (keydown.enter)="onValorEnter($event)" />
      <select #sel class="pm-cur" [(ngModel)]="idCurrency"
              (keydown.enter)="onMonedaEnter($event)">
        <option *ngFor="let m of monedas" [ngValue]="m.id">{{ m.abreviatura || m.nombre }}</option>
      </select>
    </div>
  `,
  styles: [`
    .pm-wrap{display:flex;align-items:center;gap:4px;height:100%;padding:0 4px;background:#fff;}
    .pm-num{width:70px;border:1px solid #cfd8dc;border-radius:4px;padding:2px 4px;text-align:right;}
    .pm-cur{border:1px solid #cfd8dc;border-radius:4px;padding:2px 2px;background:#fff;}
  `]
})
export class PrecioMonedaEditorComponent implements ICellEditorAngularComp {
  @ViewChild('inp') inpRef!: ElementRef<HTMLInputElement>;
  @ViewChild('sel') selRef!: ElementRef<HTMLSelectElement>;

  valor = 0;
  idCurrency: number | null = null;
  monedas: MonedaOpt[] = [];
  private params: any;

  agInit(params: any): void {
    this.params = params;
    this.valor = Number(params.value) || 0;
    this.monedas = params.monedas || params.colDef?.cellEditorParams?.monedas || [];
    // Moneda actual de la fila, o el default (MXN) provisto por params.
    const fromRow = params.data?.idCurrency;
    this.idCurrency = (fromRow !== undefined && fromRow !== null)
      ? Number(fromRow)
      : (params.defaultCurrencyId ?? params.colDef?.cellEditorParams?.defaultCurrencyId ?? null);
  }

  /** Al abrir el editor: foco directo en el input del valor, listo para modificar. */
  afterGuiAttached(): void {
    const el = this.inpRef?.nativeElement;
    if (el) { el.focus(); el.select(); }
  }

  /** Enter en el valor → no cierra el editor; pasa el foco al dropdown de moneda y lo despliega. */
  onValorEnter(event: any): void {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const sel: any = this.selRef?.nativeElement;
    if (!sel) return;
    sel.focus();
    // showPicker() abre el desplegable nativo (requiere el gesto del Enter). Fallback silencioso.
    try { sel.showPicker?.(); } catch { /* navegador sin soporte: queda enfocado */ }
  }

  /** Enter en la moneda → cierra el editor confirmando valor + moneda. */
  onMonedaEnter(event: any): void {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.params?.api?.stopEditing();
  }

  getValue(): number {
    const n = parseFloat(String(this.valor));
    const precio = isNaN(n) || n < 0 ? 0 : n;
    // Persistir la moneda en la fila (el campo de la columna es campo9 = precio).
    if (this.params?.data) {
      const prev = this.params.data.idCurrency;
      this.params.data.idCurrency = this.idCurrency ?? null;
      if (prev !== this.params.data.idCurrency) this.params.data.__modified = true;
    }
    return precio;
  }

  isPopup(): boolean { return false; }
}
