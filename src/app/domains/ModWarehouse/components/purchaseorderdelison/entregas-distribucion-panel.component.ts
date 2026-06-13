import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { evaluateProvider } from 'app/domains/ModWarehouse/components/requisitionsdelison/presentaciones-composer.helper';

/**
 * Modal para repartir la cantidad pedida de un ítem OC entre sus N entregas. Cada entrega debe ser
 * ≥ mínimo efectivo (múltiplo de presentación más chico ≥ compra mínima) y, si hay presentaciones,
 * múltiplo válido. La suma debe ser EXACTAMENTE la cantidad pedida. Valores siempre en unidad base.
 *
 * Opción B (parcial): las entregas ya CERRADAS/recibidas (bloqueadas) se muestran en gris, son
 * solo-lectura y NO se pueden eliminar; solo se editan/agregan/quitan las pendientes. Agregar añade la
 * última (hasta `maxN`); Eliminar quita la última SOLO si es pendiente.
 */
@Component({
  selector: 'app-entregas-distribucion-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="ed-backdrop" (click)="cerrar.emit()">
    <div class="ed-modal" (click)="$event.stopPropagation()">
      <div class="ed-header">
        <div>
          <div class="ed-title">Repartir entregas</div>
          <div class="ed-sub">{{ articleName }} · {{ proveedorName }} · {{ rows.length }} entregas · mínimo {{ fmt(minEfectivo) }} {{ unidad }}</div>
        </div>
        <button class="ed-x" (click)="cerrar.emit()">✕</button>
      </div>

      <div class="ed-summary">
        <div class="ed-chip"><span>Cantidad pedida</span><strong>{{ fmt(total) }} {{ unidad }}</strong></div>
        <div class="ed-chip"><span>Repartido</span><strong [class.ed-bad]="excede">{{ fmt(repartido) }} {{ unidad }}</strong></div>
        <div class="ed-chip" [class.ed-chip-ok]="restante === 0" [class.ed-chip-bad]="restante !== 0">
          <span>Restante</span><strong>{{ fmt(restante) }} {{ unidad }}</strong>
        </div>
        <button type="button" class="ed-btn ed-ghost ed-suggest" (click)="sugerir()">Sugerir reparto</button>
      </div>

      <div class="ed-tools">
        <span class="ed-tools-hint">{{ rows.length }} de máx {{ maxN }} entregas<span *ngIf="bloqueadasCount > 0"> · {{ bloqueadasCount }} cerrada(s)</span></span>
        <div class="ed-tools-btns">
          <button type="button" class="ed-btn ed-add" (click)="agregar()" [disabled]="rows.length >= maxN">
            + Agregar
          </button>
          <button type="button" class="ed-btn ed-del" (click)="eliminarUltima()" [disabled]="!puedeEliminar">
            − Eliminar última
          </button>
        </div>
      </div>

      <div class="ed-body">
        <div class="ed-row" *ngFor="let r of rows; let i = index" [class.ed-row-locked]="r.bloqueada">
          <span class="ed-ent">E{{ i + 1 }}</span>
          <span class="ed-input">
            <button type="button" class="ed-step" (click)="dec(i)" [disabled]="r.bloqueada || r.cantidad <= 0">−</button>
            <input type="number" min="0" [(ngModel)]="r.cantidad" (ngModelChange)="onChange(i)" [disabled]="r.bloqueada" />
            <button type="button" class="ed-step" (click)="inc(i)" [disabled]="r.bloqueada">+</button>
            <span class="ed-unidad">{{ unidad }}</span>
          </span>
          <span class="ed-note">
            <small *ngIf="esBalancer(i)" class="ed-balancer-note">↻ esta entrada se re-calcula sola cuando mueve cualquier otra</small>
          </span>
          <span class="ed-flag" *ngIf="r.bloqueada">🔒 cerrada</span>
          <span class="ed-flag" *ngIf="!r.bloqueada" [class.ok]="filaValida(i)" [class.bad]="!filaValida(i)">
            {{ filaValida(i) ? '✓' : (r.cantidad < minEfectivo ? '< mínimo' : 'no múltiplo') }}
          </span>
        </div>
      </div>

      <div class="ed-foot">
        <div *ngIf="!valido" class="ed-warn">
          Cada entrega pendiente debe ser ≥ {{ fmt(minEfectivo) }} {{ unidad }}<span *ngIf="packages.length"> y múltiplo de presentación</span>, y la suma total debe ser exactamente {{ fmt(total) }} {{ unidad }}.
        </div>
        <div class="ed-actions">
          <button type="button" class="ed-btn ed-ghost" (click)="cerrar.emit()">Cancelar</button>
          <button type="button" class="ed-btn ed-primary" (click)="confirmar()" [disabled]="!valido">Confirmar</button>
        </div>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .ed-backdrop { position: fixed; inset: 0; background: oklch(0.2 0.02 262 / 0.45); z-index: 3000; display: flex; align-items: center; justify-content: center; }
    .ed-modal { background: oklch(0.995 0.002 255); border-radius: 14px; width: 560px; max-width: 94vw; max-height: 88vh; overflow: auto; box-shadow: 0 16px 48px oklch(0.2 0.02 262 / 0.28); color: oklch(0.34 0.022 262); }
    .ed-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 20px; border-bottom: 1px solid oklch(0.905 0.006 255); }
    .ed-title { font-weight: 650; font-size: 1rem; }
    .ed-sub { font-size: 0.8rem; color: oklch(0.55 0.016 262); margin-top: 2px; }
    .ed-x { background: transparent; border: none; color: oklch(0.55 0.016 262); font-size: 18px; cursor: pointer; line-height: 1; }
    .ed-summary { display: flex; gap: 8px; padding: 14px 20px 8px; flex-wrap: wrap; align-items: center; }
    .ed-chip { display: flex; flex-direction: column; gap: 2px; background: oklch(0.965 0.005 255); border: 1px solid oklch(0.905 0.006 255); border-radius: 10px; padding: 8px 12px; min-width: 110px; }
    .ed-chip span { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.05em; color: oklch(0.55 0.016 262); font-weight: 600; }
    .ed-chip strong { font-size: 0.95rem; font-variant-numeric: tabular-nums; }
    .ed-chip-ok { background: oklch(0.965 0.03 152); border-color: oklch(0.88 0.07 152); } .ed-chip-ok strong { color: oklch(0.46 0.1 152); }
    .ed-chip-bad { background: oklch(0.96 0.032 25); border-color: oklch(0.9 0.05 25); } .ed-chip-bad strong { color: oklch(0.55 0.16 25); }
    .ed-bad { color: oklch(0.55 0.16 25); }
    .ed-suggest { margin-left: auto; }
    .ed-tools { display: flex; align-items: center; justify-content: space-between; padding: 4px 20px 10px; border-bottom: 1px solid oklch(0.945 0.006 255); }
    .ed-tools-hint { font-size: 0.72rem; color: oklch(0.55 0.016 262); font-variant-numeric: tabular-nums; }
    .ed-tools-btns { display: flex; gap: 6px; }
    .ed-add { background: oklch(0.965 0.03 152); border-color: oklch(0.86 0.08 152); color: oklch(0.45 0.11 152); }
    .ed-add:hover:not(:disabled) { background: oklch(0.93 0.05 152); }
    .ed-del { background: oklch(0.96 0.032 25); border-color: oklch(0.88 0.06 25); color: oklch(0.52 0.16 25); }
    .ed-del:hover:not(:disabled) { background: oklch(0.93 0.05 25); }
    .ed-body { padding: 4px 20px 8px; display: flex; flex-direction: column; }
    .ed-row { display: grid; grid-template-columns: 56px auto minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid oklch(0.945 0.006 255); }
    .ed-note { min-width: 0; overflow: hidden; }
    .ed-balancer-note { display: block; font-size: 0.68rem; color: oklch(0.5 0.1 256); font-style: italic; line-height: 1.2; white-space: normal; overflow-wrap: anywhere; }
    .ed-row-locked { opacity: 0.85; }
    .ed-row-locked .ed-ent { color: oklch(0.6 0.012 262); }
    .ed-row-locked .ed-input input { background: oklch(0.945 0.004 255); color: oklch(0.6 0.012 262); border-color: oklch(0.9 0.006 255); }
    .ed-ent { font-weight: 650; }
    .ed-input { display: flex; align-items: center; gap: 4px; }
    .ed-input input { width: 90px; padding: 5px 6px; border: 1px solid oklch(0.88 0.008 255); border-radius: 8px; text-align: center; font-variant-numeric: tabular-nums; }
    .ed-input input:focus { outline: none; border-color: oklch(0.55 0.13 256); }
    .ed-input input:disabled { cursor: not-allowed; }
    .ed-step { width: 26px; height: 28px; border: 1px solid oklch(0.88 0.008 255); background: oklch(0.975 0.004 255); border-radius: 8px; cursor: pointer; font-size: 15px; color: oklch(0.45 0.02 262); }
    .ed-step:hover:not(:disabled) { background: oklch(0.94 0.006 255); }
    .ed-step:disabled { opacity: 0.4; cursor: not-allowed; }
    .ed-unidad { font-size: 0.78rem; color: oklch(0.55 0.016 262); }
    .ed-flag { font-size: 0.75rem; font-weight: 600; text-align: right; color: oklch(0.6 0.012 262); }
    .ed-flag.ok { color: oklch(0.5 0.12 152); } .ed-flag.bad { color: oklch(0.55 0.16 25); }
    .ed-foot { padding: 12px 20px 16px; border-top: 1px solid oklch(0.905 0.006 255); }
    .ed-warn { color: oklch(0.55 0.16 25); font-size: 0.78rem; background: oklch(0.96 0.032 25); border-radius: 8px; padding: 6px 10px; margin-bottom: 10px; }
    .ed-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .ed-btn { border-radius: 9px; font-weight: 600; font-size: 0.82rem; padding: 8px 16px; cursor: pointer; border: 1px solid transparent; }
    .ed-ghost { background: transparent; border-color: oklch(0.88 0.008 255); color: oklch(0.45 0.02 262); }
    .ed-ghost:hover { background: oklch(0.96 0.005 255); }
    .ed-primary { background: oklch(0.55 0.13 256); color: #fff; }
    .ed-primary:hover:not(:disabled) { background: oklch(0.47 0.13 256); }
    .ed-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  `]
})
export class EntregasDistribucionPanelComponent implements OnInit {
  @Input() articleName = '';
  @Input() proveedorName = '';
  @Input() unidad = '';
  @Input() esPieza = false;
  @Input() total = 0;
  @Input() minEfectivo = 0;
  @Input() numEntregas = 1;
  @Input() maxN = 1;
  @Input() packages: { base: number; descripcion: string; unidad: string }[] = [];
  @Input() cantidadesActuales: number[] = [];
  /** Paralelo a cantidadesActuales: true = entrega cerrada/recibida (gris, solo lectura, no se puede quitar). */
  @Input() bloqueadas: boolean[] = [];

  @Output() seleccionar = new EventEmitter<{ cantidades: number[]; numEntregas: number }>();
  @Output() cerrar = new EventEmitter<void>();

  rows: { cantidad: number; bloqueada: boolean }[] = [];

  ngOnInit(): void {
    const n = Math.max(1, Number(this.numEntregas) || 1);
    const actuales = (this.cantidadesActuales || []).map(v => Number(v) || 0);
    const bloq = this.bloqueadas || [];
    this.maxN = Math.max(this.maxN || 1, n);

    if (actuales.length === n) {
      this.rows = actuales.map((c, i) => ({ cantidad: c, bloqueada: !!bloq[i] }));
      // Si lo guardado no suma el total (y hay pendientes editables), sugerir sobre las pendientes.
      if (this.round(this.repartido) !== this.round(this.total) && this.rows.some(r => !r.bloqueada)) {
        this.sugerir();
      }
    } else {
      this.rows = Array.from({ length: n }, (_, i) => ({ cantidad: 0, bloqueada: !!bloq[i] }));
      this.sugerir();
    }
  }

  get repartido(): number { return this.round(this.rows.reduce((a, r) => a + (Number(r.cantidad) || 0), 0)); }
  get restante(): number { return this.round(this.total - this.repartido); }
  get excede(): boolean { return this.repartido > this.total + 1e-6; }
  get bloqueadasCount(): number { return this.rows.filter(r => r.bloqueada).length; }

  /** Mínimo de filas: no se puede bajar de la última entrega cerrada (ni de 1). */
  private get minRows(): number {
    let lastBlocked = -1;
    this.rows.forEach((r, i) => { if (r.bloqueada) lastBlocked = i; });
    return lastBlocked >= 0 ? lastBlocked + 1 : 1;
  }

  /** Solo se puede eliminar si la última es pendiente y queda por encima del mínimo de filas. */
  get puedeEliminar(): boolean {
    if (this.rows.length <= this.minRows) return false;
    return !this.rows[this.rows.length - 1]?.bloqueada;
  }

  get stepSize(): number {
    if (!this.packages.length) return 1;
    return Math.min(...this.packages.map(p => p.base).filter(b => b > 0));
  }

  /** ¿La cantidad es componible con las presentaciones? Sin presentaciones → libre. */
  private esComponible(v: number): boolean {
    if (!this.packages.length) return true;
    if (v <= 0) return false;
    const ev = evaluateProvider(v, 0, this.packages.map(p => ({ base: p.base, descripcion: '', unidad: '' })));
    return !!ev.exact;
  }

  filaValida(i: number): boolean {
    const r = this.rows[i];
    if (!r) return false;
    if (r.bloqueada) return true;   // cerradas se asumen válidas (ya recibidas)
    const v = Number(r.cantidad) || 0;
    return v >= this.minEfectivo - 1e-6 && this.esComponible(v);
  }

  get valido(): boolean {
    if (this.restante !== 0) return false;
    return this.rows.every((_, i) => this.filaValida(i));
  }

  agregar(): void {
    if (this.rows.length >= this.maxN) return;
    this.rows = [...this.rows, { cantidad: this.minEfectivo, bloqueada: false }];
  }

  eliminarUltima(): void {
    if (!this.puedeEliminar) return;
    this.rows = this.rows.slice(0, -1);
  }

  /** Índice de la última entrega PENDIENTE (la "balanceadora" que absorbe el restante). */
  get balancerIndex(): number {
    for (let i = this.rows.length - 1; i >= 0; i--) {
      if (!this.rows[i].bloqueada) return i;
    }
    return -1;
  }
  esBalancer(i: number): boolean { return i === this.balancerIndex && !this.rows[i]?.bloqueada; }

  /**
   * Tras editar una entrega que NO es la balanceadora: clampea su valor para que la balanceadora
   * no quede por debajo del mínimo (ni negativa) y recalcula la balanceadora = total − suma de las demás.
   */
  private rebalancearDesde(i: number): void {
    const b = this.balancerIndex;
    if (b < 0 || i === b) return;   // sin balanceadora, o se editó la propia balanceadora → no se reparte

    // Suma de todas las entregas excepto la editada y la balanceadora.
    let sumOtros = 0;
    this.rows.forEach((r, idx) => { if (idx !== i && idx !== b) sumOtros += Number(r.cantidad) || 0; });
    sumOtros = this.round(sumOtros);

    // Máximo permitido en la editada para que la balanceadora cumpla el mínimo.
    let maxV = this.round(this.total - this.minEfectivo - sumOtros);
    if (maxV < 0) maxV = 0;

    let v = Number(this.rows[i].cantidad) || 0;
    if (v < 0) v = 0;
    if (v > maxV) v = maxV;                          // valor más cercano que sí deja cumplir el mínimo
    if (this.packages.length) {                       // si hay presentaciones, bajar al múltiplo válido
      const step = this.stepSize;
      if (step > 0) v = Math.floor(v / step) * step;
    }
    if (this.esPieza) v = Math.floor(v);
    this.rows[i].cantidad = this.round(v);

    // Balanceadora = cantidad pedida − suma de todas las demás (incluye cerradas).
    const sumExceptoBal = this.round(this.rows.reduce((a, r, idx) => a + (idx === b ? 0 : (Number(r.cantidad) || 0)), 0));
    this.rows[b].cantidad = this.round(this.total - sumExceptoBal);
  }

  inc(i: number): void {
    if (this.rows[i]?.bloqueada) return;
    this.rows[i].cantidad = this.round((Number(this.rows[i].cantidad) || 0) + this.stepSize);
    this.rebalancearDesde(i);
  }
  dec(i: number): void {
    if (this.rows[i]?.bloqueada) return;
    this.rows[i].cantidad = Math.max(0, this.round((Number(this.rows[i].cantidad) || 0) - this.stepSize));
    this.rebalancearDesde(i);
  }
  onChange(i: number): void {
    if (this.rows[i]?.bloqueada) return;
    let v = Number(this.rows[i].cantidad) || 0;
    if (this.esPieza) v = Math.floor(v);
    if (v < 0) v = 0;
    this.rows[i].cantidad = v;
    this.rebalancearDesde(i);
  }

  /** Reparto sugerido SOLO sobre las entregas pendientes; las cerradas quedan fijas. */
  sugerir(): void {
    const pendientes = this.rows.map((r, i) => ({ r, i })).filter(x => !x.r.bloqueada);
    const m = pendientes.length;
    if (m === 0) return;
    const bloqueadoSum = this.round(
      this.rows.filter(r => r.bloqueada).reduce((a, r) => a + (Number(r.cantidad) || 0), 0)
    );
    let objetivo = this.round(this.total - bloqueadoSum);
    if (objetivo < 0) objetivo = 0;

    const arr = new Array(m).fill(this.minEfectivo);
    let remaining = this.round(objetivo - this.minEfectivo * m);
    if (remaining < 0) remaining = 0;
    if (this.packages.length) {
      const step = this.stepSize;
      let k = 0, guard = 0;
      while (remaining >= step - 1e-6 && guard < 100000) {
        arr[k % m] = this.round(arr[k % m] + step);
        remaining = this.round(remaining - step);
        k++; guard++;
      }
      if (remaining > 1e-6) arr[m - 1] = this.round(arr[m - 1] + remaining);
    } else {
      arr[m - 1] = this.round(arr[m - 1] + remaining);   // modo libre
    }
    pendientes.forEach((x, idx) => { this.rows[x.i].cantidad = arr[idx]; });
  }

  confirmar(): void {
    if (!this.valido) return;
    this.seleccionar.emit({
      cantidades: this.rows.map(r => this.round(Number(r.cantidad) || 0)),
      numEntregas: this.rows.length,
    });
  }

  fmt(n: any): string {
    const v = Number(n) || 0;
    return this.esPieza ? String(Math.round(v)) : (Math.round(v * 100) / 100).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  private round(n: number): number { return Math.round((Number(n) || 0) * 1000) / 1000; }
}
