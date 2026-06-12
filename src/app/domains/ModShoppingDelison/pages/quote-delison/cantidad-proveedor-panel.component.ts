import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { evaluateProvider, Denom, Composition } from 'app/domains/ModWarehouse/components/requisitionsdelison/presentaciones-composer.helper';

interface DenomVM { base: number; descripcion: string; unidad: string; count: number; }

/**
 * Modal para asignar la "Cantidad x Proveedor" en el comparador usando las presentaciones del
 * proveedor (bultos/cajas/etc.). El usuario captura CUÁNTOS contenedores le da al proveedor; el
 * valor que se confirma SIEMPRE es en unidad base (kg / L / pz). Es consciente del restante:
 * no permite asignar más que (cantidad requerida − asignado a otros proveedores).
 */
@Component({
  selector: 'app-cantidad-proveedor-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="cp-backdrop" (click)="cerrar.emit()">
    <div class="cp-modal" (click)="$event.stopPropagation()">
      <div class="cp-header">
        <div>
          <div class="cp-title">Cantidad por proveedor</div>
          <div class="cp-sub">{{ articleName }} · {{ proveedorName }}</div>
        </div>
        <button class="cp-x" (click)="cerrar.emit()">✕</button>
      </div>

      <!-- Resumen -->
      <div class="cp-summary">
        <div class="cp-chip"><span>Requerido</span><strong>{{ fmt(cantidadRequerida) }} {{ unidad }}</strong></div>
        <div class="cp-chip"><span>Asignado a otros</span><strong>{{ fmt(yaAsignadoOtros) }} {{ unidad }}</strong></div>
        <div class="cp-chip cp-chip-accent"><span>Disponible</span><strong>{{ fmt(restanteMax) }} {{ unidad }}</strong></div>
        <button type="button" class="cp-btn cp-ghost cp-suggest" (click)="sugerir()" [disabled]="denoms.length === 0">
          <span>Sugerir mejor</span>
          <span>combinación</span>
        </button>
      </div>

      <!-- Presentaciones del proveedor -->
      <div class="cp-body">
        <div class="cp-rowhead">
          <span>Presentación</span><span>Rinde</span><span>Cantidad</span><span class="cp-r">Subtotal</span>
        </div>
        <div class="cp-row" *ngFor="let d of denoms; let i = index">
          <span class="cp-desc">{{ d.descripcion || 'Empaque' }}</span>
          <span class="cp-rinde">{{ fmt(d.base) }} {{ unidad }}</span>
          <span class="cp-input">
            <button type="button" class="cp-step" (click)="dec(i)" [disabled]="d.count <= 0">−</button>
            <input type="number" min="0" [step]="esPieza ? 1 : 1" [(ngModel)]="d.count" (ngModelChange)="onCountChange(d)" />
            <button type="button" class="cp-step" (click)="inc(i)">+</button>
          </span>
          <span class="cp-r cp-sub">{{ fmt(d.count * d.base) }} {{ unidad }}</span>
        </div>

        <div *ngIf="denoms.length === 0" class="cp-empty">Este proveedor no tiene presentaciones para este artículo.</div>
      </div>

      <!-- Totales -->
      <div class="cp-totals">
        <div class="cp-total-line">
          <span>Asignado a {{ proveedorName }}</span>
          <strong [class.cp-bad]="excede">{{ fmt(total) }} {{ unidad }}</strong>
        </div>
        <div class="cp-total-line cp-muted">
          <span>Quedaría por asignar</span>
          <strong [class.cp-bad]="excede">{{ fmt(restanteDespues) }} {{ unidad }}</strong>
        </div>
        <div *ngIf="excede" class="cp-warn">No puedes asignar más de lo disponible ({{ fmt(restanteMax) }} {{ unidad }}).</div>
        <div *ngIf="!excede && bajoMinimo" class="cp-warn">La cantidad asignada está por debajo de la compra mínima ({{ fmt(minCompra) }} {{ unidad }}).</div>
      </div>

      <!-- Acciones -->
      <div class="cp-actions">
        <button type="button" class="cp-btn cp-ghost" (click)="limpiar()">Limpiar</button>
        <span style="flex:1 1 auto;"></span>
        <button type="button" class="cp-btn cp-ghost" (click)="cerrar.emit()">Cancelar</button>
        <button type="button" class="cp-btn cp-primary" (click)="confirmar()" [disabled]="excede || bajoMinimo">Confirmar</button>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .cp-backdrop { position: fixed; inset: 0; background: oklch(0.2 0.02 262 / 0.45); z-index: 3000; display: flex; align-items: center; justify-content: center; }
    .cp-modal { background: oklch(0.995 0.002 255); border-radius: 14px; width: 620px; max-width: 94vw; max-height: 88vh; overflow: auto; box-shadow: 0 16px 48px oklch(0.2 0.02 262 / 0.28); color: oklch(0.34 0.022 262); }
    .cp-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 20px; border-bottom: 1px solid oklch(0.905 0.006 255); }
    .cp-title { font-weight: 650; font-size: 1rem; letter-spacing: -0.01em; }
    .cp-sub { font-size: 0.8rem; color: oklch(0.55 0.016 262); margin-top: 2px; }
    .cp-x { background: transparent; border: none; color: oklch(0.55 0.016 262); font-size: 18px; cursor: pointer; line-height: 1; }
    .cp-x:hover { color: oklch(0.34 0.022 262); }

    .cp-summary { display: flex; gap: 8px; padding: 14px 20px; flex-wrap: wrap; align-items: stretch; }
    .cp-suggest { margin-left: auto; align-self: stretch; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.25; text-align: center; white-space: nowrap; }
    .cp-chip { display: flex; flex-direction: column; gap: 2px; background: oklch(0.965 0.005 255); border: 1px solid oklch(0.905 0.006 255); border-radius: 10px; padding: 8px 12px; min-width: 120px; }
    .cp-chip span { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.05em; color: oklch(0.55 0.016 262); font-weight: 600; }
    .cp-chip strong { font-size: 0.95rem; font-variant-numeric: tabular-nums; }
    .cp-chip-accent { background: oklch(0.965 0.022 256); border-color: oklch(0.88 0.04 256); }
    .cp-chip-accent strong { color: oklch(0.47 0.13 256); }

    .cp-body { padding: 4px 20px 8px; }
    .cp-rowhead, .cp-row { display: grid; grid-template-columns: 1.6fr 1fr 1.5fr 1fr; align-items: center; gap: 8px; }
    .cp-rowhead { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.05em; color: oklch(0.55 0.016 262); font-weight: 600; padding: 8px 0; border-bottom: 1px solid oklch(0.905 0.006 255); }
    .cp-row { padding: 9px 0; border-bottom: 1px solid oklch(0.945 0.006 255); }
    .cp-desc { font-weight: 600; font-size: 0.85rem; }
    .cp-rinde { font-size: 0.82rem; color: oklch(0.55 0.016 262); font-variant-numeric: tabular-nums; }
    .cp-r { text-align: right; }
    .cp-sub { font-weight: 650; font-variant-numeric: tabular-nums; font-size: 0.85rem; }
    .cp-input { display: flex; align-items: center; gap: 4px; }
    .cp-input input { width: 64px; padding: 5px 6px; border: 1px solid oklch(0.88 0.008 255); border-radius: 8px; text-align: center; font-variant-numeric: tabular-nums; }
    .cp-input input:focus { outline: none; border-color: oklch(0.55 0.13 256); }
    .cp-step { width: 26px; height: 28px; border: 1px solid oklch(0.88 0.008 255); background: oklch(0.975 0.004 255); border-radius: 8px; cursor: pointer; font-size: 15px; line-height: 1; color: oklch(0.45 0.02 262); }
    .cp-step:hover:not(:disabled) { background: oklch(0.94 0.006 255); }
    .cp-step:disabled { opacity: 0.4; cursor: not-allowed; }
    .cp-empty { padding: 22px; text-align: center; color: oklch(0.6 0.012 262); font-size: 0.85rem; }

    .cp-totals { padding: 12px 20px; border-top: 1px solid oklch(0.905 0.006 255); display: flex; flex-direction: column; gap: 4px; }
    .cp-total-line { display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; font-weight: 600; }
    .cp-total-line strong { font-variant-numeric: tabular-nums; }
    .cp-muted { color: oklch(0.55 0.016 262); font-size: 0.82rem; }
    .cp-bad { color: oklch(0.55 0.16 25); }
    .cp-warn { color: oklch(0.55 0.16 25); font-size: 0.78rem; background: oklch(0.96 0.032 25); border-radius: 8px; padding: 6px 10px; margin-top: 4px; }

    .cp-actions { display: flex; align-items: center; gap: 8px; padding: 14px 20px; border-top: 1px solid oklch(0.905 0.006 255); }
    .cp-btn { border-radius: 9px; font-weight: 600; font-size: 0.82rem; padding: 8px 16px; cursor: pointer; border: 1px solid transparent; transition: background-color 0.15s ease, border-color 0.15s ease; }
    .cp-ghost { background: transparent; border-color: oklch(0.88 0.008 255); color: oklch(0.45 0.02 262); }
    .cp-ghost:hover:not(:disabled) { background: oklch(0.96 0.005 255); }
    .cp-primary { background: oklch(0.55 0.13 256); color: #fff; }
    .cp-primary:hover:not(:disabled) { background: oklch(0.47 0.13 256); }
    .cp-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  `]
})
export class CantidadProveedorPanelComponent implements OnInit {
  @Input() articleName = '';
  @Input() proveedorName = '';
  @Input() unidad = '';
  @Input() esPieza = false;
  @Input() minCompra = 0;
  @Input() cantidadRequerida = 0;
  @Input() yaAsignadoOtros = 0;
  @Input() cantidadActual = 0;
  /** Denoms efectivos del proveedor en unidad base. */
  @Input() set presentaciones(v: { base: number; descripcion: string; unidad: string }[]) {
    this.denoms = (v ?? []).map(d => ({ base: d.base, descripcion: d.descripcion, unidad: d.unidad, count: 0 }));
  }

  @Output() seleccionar = new EventEmitter<{ cantidad: number; texto: string }>();
  @Output() cerrar = new EventEmitter<void>();

  denoms: DenomVM[] = [];
  restanteMax = 0;

  ngOnInit(): void {
    this.restanteMax = this.round(Math.max(0, (Number(this.cantidadRequerida) || 0) - (Number(this.yaAsignadoOtros) || 0)));
    // Pre-relleno: si edito un valor existente compongo ese valor; si es nuevo, sugiero el restante.
    const objetivo = (Number(this.cantidadActual) || 0) > 0
      ? Math.min(Number(this.cantidadActual), this.restanteMax)
      : this.restanteMax;
    this.aplicarComposicionPara(objetivo);
  }

  get total(): number { return this.round(this.denoms.reduce((s, d) => s + (Number(d.count) || 0) * d.base, 0)); }
  get restanteDespues(): number { return this.round(this.restanteMax - this.total); }
  get excede(): boolean { return this.total > this.restanteMax + 1e-6; }
  get bajoMinimo(): boolean { return this.total > 0 && this.minCompra > 0 && this.total < this.minCompra - 1e-6; }

  inc(i: number): void { this.denoms[i].count = (Number(this.denoms[i].count) || 0) + 1; }
  dec(i: number): void { this.denoms[i].count = Math.max(0, (Number(this.denoms[i].count) || 0) - 1); }
  onCountChange(d: DenomVM): void {
    let n = Math.floor(Number(d.count) || 0);   // los contenedores siempre son enteros
    if (n < 0) n = 0;
    d.count = n;
  }

  limpiar(): void { this.denoms.forEach(d => d.count = 0); }

  sugerir(): void { this.aplicarComposicionPara(this.restanteMax); }

  /** Aplica la mejor combinación ≤ objetivo (opción A: exacta o la más cercana por debajo). */
  private aplicarComposicionPara(objetivo: number): void {
    this.denoms.forEach(d => d.count = 0);
    if (objetivo <= 0 || this.denoms.length === 0) return;
    const composerDenoms: Denom[] = this.denoms.map(d => ({ base: d.base, descripcion: d.descripcion, unidad: d.unidad }));
    const evalR = evaluateProvider(objetivo, 0, composerDenoms);
    const comp: Composition | null = evalR.exact ?? evalR.below ?? null;   // nunca 'above' (no exceder)
    if (!comp) return;
    for (const line of comp.lines) {
      const idx = this.denoms.findIndex(d => Math.abs(d.base - line.base) < 1e-6 && d.descripcion === line.descripcion);
      const target = idx >= 0 ? idx : this.denoms.findIndex(d => Math.abs(d.base - line.base) < 1e-6);
      if (target >= 0) this.denoms[target].count += line.count;
    }
  }

  confirmar(): void {
    if (this.excede || this.bajoMinimo) return;
    const texto = `${this.fmt(this.total)} ${this.unidad} con ${this.proveedorName}: ${this.breakdownText()}`;
    this.seleccionar.emit({ cantidad: this.total, texto });
  }

  breakdownText(): string {
    const parts = this.denoms.filter(d => (Number(d.count) || 0) > 0)
      .map(d => `${d.count}×${this.fmt(d.base)} ${this.unidad}`);
    return parts.length ? parts.join(' + ') : '—';
  }

  fmt(n: any): string {
    const v = Number(n) || 0;
    return this.esPieza ? String(Math.round(v)) : (Math.round(v * 100) / 100).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  private round(n: number): number { return Math.round((Number(n) || 0) * 1000) / 1000; }
}
