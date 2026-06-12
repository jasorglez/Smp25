import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmpaqueDescripcionService, ProveedorPresentaciones } from 'app/services/empaque-descripcion.service';
import { evaluateProvider, ProviderEval, Denom, Composition } from './presentaciones-composer.helper';
import { baseEfectiva, resolverUnidadArticulo } from './presentaciones-unidad.helper';

interface ProvViewModel {
  idProvider: number;
  nombre: string;
  minCompra: number;
  base: string;            // 'L' | 'kg' | ''
  presentaciones: { label: string; base: number }[];
  evalResult: ProviderEval;
  // modo dividir (informativo)
  splitInput: number | null;
  splitEval: ProviderEval | null;
}

@Component({
  selector: 'app-presentaciones-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="pp-backdrop" (click)="cerrar.emit()">
    <div class="pp-modal" (click)="$event.stopPropagation()">
      <div class="pp-header">
        <div>
          <div class="pp-title"><i class="bi bi-calculator"></i> Presentaciones — {{ articleName || 'Artículo' }}</div>
          <div class="pp-sub">Arma la cantidad requerida con los envases de cada proveedor.</div>
        </div>
        <button class="pp-x" (click)="cerrar.emit()">✕</button>
      </div>

      <div class="pp-qty">
        <label>Cantidad requerida</label>
        <input #cantidadInput type="number" min="0" step="0.01" [(ngModel)]="cantidad" (ngModelChange)="recompute()" />
        <span class="pp-base">{{ baseGlobal }}</span>
        <div class="pp-modes" *ngIf="permitirDividir">
          <button [class.active]="modo==='uno'" (click)="modo='uno'">Un proveedor</button>
          <button [class.active]="modo==='dividir'" (click)="modo='dividir'">Dividir (informativo)</button>
        </div>
      </div>

      <div *ngIf="loading" class="pp-empty">Cargando…</div>
      <div *ngIf="!loading && provs.length===0" class="pp-empty">Este artículo no tiene proveedores con presentaciones.</div>

      <!-- MODO UN PROVEEDOR -->
      <div *ngIf="!loading && modo==='uno'" class="pp-list">
        <div class="pp-card" *ngFor="let p of provs">
          <div class="pp-card-head">
            <strong>{{ p.nombre }}</strong>
            <span class="pp-min" [class.bad]="cantidad < p.minCompra">Mínimo: {{ p.minCompra }} {{ p.base }}</span>
          </div>
          <div class="pp-pres">
            <span class="pp-chip" *ngFor="let x of p.presentaciones">{{ x.label }}</span>
          </div>

          <div *ngIf="p.evalResult.belowMin" class="pp-warn">⚠ Cantidad por debajo del mínimo de este proveedor.</div>

          <ng-container *ngIf="!p.evalResult.belowMin">
            <!-- exacta -->
            <div *ngIf="p.evalResult.exact" class="pp-opt ok">
              <div class="pp-opt-l">✓ Exacto: {{ p.evalResult.exact.total }} {{ p.base }}</div>
              <div class="pp-break">{{ breakdownText(p.evalResult.exact) }}</div>
              <button class="pp-pick" (click)="elegir(p, p.evalResult.exact.total, p.evalResult.exact)">Elegir</button>
            </div>
            <!-- no exacta: cercanas -->
            <ng-container *ngIf="!p.evalResult.exact">
              <div class="pp-noexact">No hay combinación exacta. Opciones más cercanas:</div>
              <div *ngIf="p.evalResult.below" class="pp-opt">
                <div class="pp-opt-l">↓ {{ p.evalResult.below.total }} {{ p.base }} ({{ diff(p.evalResult.below.total) }})</div>
                <div class="pp-break">{{ breakdownText(p.evalResult.below) }}</div>
                <button class="pp-pick" (click)="elegir(p, p.evalResult.below!.total, p.evalResult.below!)">Elegir</button>
              </div>
              <div *ngIf="p.evalResult.above" class="pp-opt">
                <div class="pp-opt-l">↑ {{ p.evalResult.above.total }} {{ p.base }} ({{ diff(p.evalResult.above.total) }})</div>
                <div class="pp-break">{{ breakdownText(p.evalResult.above) }}</div>
                <button class="pp-pick" (click)="elegir(p, p.evalResult.above!.total, p.evalResult.above!)">Elegir</button>
              </div>
            </ng-container>
          </ng-container>
        </div>
      </div>

      <!-- MODO DIVIDIR (informativo) -->
      <div *ngIf="!loading && modo==='dividir'" class="pp-list">
        <div class="pp-split-head">
          Reparte la cantidad entre proveedores. Restante:
          <strong [class.bad]="restante!==0">{{ restante }} {{ baseGlobal }}</strong>
        </div>
        <div class="pp-card" *ngFor="let p of provs">
          <div class="pp-card-head">
            <strong>{{ p.nombre }}</strong>
            <span class="pp-min">Mínimo: {{ p.minCompra }} {{ p.base }}</span>
          </div>
          <div class="pp-split-row">
            <input type="number" min="0" step="0.01" [(ngModel)]="p.splitInput" (ngModelChange)="recomputeSplit(p)" placeholder="0" />
            <span>{{ p.base }}</span>
          </div>
          <div *ngIf="p.splitEval" class="pp-split-eval">
            <span *ngIf="p.splitEval.belowMin" class="pp-warn">⚠ Bajo mínimo</span>
            <span *ngIf="!p.splitEval.belowMin && p.splitEval.exact" class="pp-ok">✓ {{ breakdownText(p.splitEval.exact) }}</span>
            <span *ngIf="!p.splitEval.belowMin && !p.splitEval.exact" class="pp-warn">✗ No componible exacto</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .pp-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:3000;display:flex;align-items:center;justify-content:center;}
    .pp-modal{background:#fff;border-radius:10px;width:680px;max-width:94vw;max-height:88vh;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,.3);}
    .pp-header{display:flex;justify-content:space-between;align-items:flex-start;padding:14px 18px;background:linear-gradient(135deg,#1565c0,#1e88e5);color:#fff;border-radius:10px 10px 0 0;}
    .pp-title{font-weight:700;font-size:15px;} .pp-sub{font-size:12px;opacity:.9;margin-top:2px;}
    .pp-x{background:transparent;border:none;color:#fff;font-size:18px;cursor:pointer;}
    .pp-qty{display:flex;align-items:center;gap:10px;padding:12px 18px;border-bottom:1px solid #eee;flex-wrap:wrap;}
    .pp-qty label{font-weight:600;font-size:13px;} .pp-qty input{width:120px;padding:6px 8px;border:1px solid #cfd8dc;border-radius:6px;}
    .pp-base{color:#607d8b;font-weight:600;}
    .pp-modes{margin-left:auto;display:flex;gap:6px;}
    .pp-modes button{border:1px solid #1e88e5;background:#fff;color:#1565c0;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:12px;}
    .pp-modes button.active{background:#1e88e5;color:#fff;}
    .pp-list{padding:12px 18px;display:flex;flex-direction:column;gap:12px;}
    .pp-card{border:1px solid #e0e0e0;border-radius:8px;padding:10px 12px;}
    .pp-card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;}
    .pp-min{font-size:12px;color:#2e7d32;} .pp-min.bad{color:#c62828;font-weight:700;}
    .pp-pres{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;}
    .pp-chip{background:#e3f2fd;color:#1565c0;border-radius:12px;padding:2px 10px;font-size:12px;}
    .pp-warn{color:#e65100;font-size:13px;background:#fff3e0;padding:6px 8px;border-radius:6px;}
    .pp-noexact{color:#e65100;font-size:12px;margin:4px 0;}
    .pp-opt{display:flex;flex-direction:column;gap:2px;border-top:1px dashed #eee;padding:6px 0;position:relative;}
    .pp-opt.ok{background:#f1f8e9;border-radius:6px;padding:8px;}
    .pp-opt-l{font-weight:600;} .pp-break{font-size:12px;color:#546e7a;}
    .pp-pick{align-self:flex-start;margin-top:4px;background:#43a047;color:#fff;border:none;border-radius:6px;padding:5px 14px;cursor:pointer;font-size:12px;}
    .pp-empty{padding:24px;text-align:center;color:#90a4ae;}
    .pp-split-head{font-size:13px;color:#37474f;} .pp-split-head .bad{color:#c62828;}
    .pp-split-row{display:flex;align-items:center;gap:6px;} .pp-split-row input{width:120px;padding:5px 8px;border:1px solid #cfd8dc;border-radius:6px;}
    .pp-split-eval{margin-top:6px;font-size:12px;} .pp-ok{color:#2e7d32;}
  `]
})
export class PresentacionesPanelComponent implements OnInit, AfterViewInit {
  @Input() idMaterial!: number;
  @Input() cantidad = 0;
  @Input() articleName = '';
  @Input() providerNames: Map<number, string> | null = null;
  /** Muestra el modo "Dividir" (solo Compras decide la división; en Requisiciones = false). */
  @Input() permitirDividir = true;

  /** Emite la cantidad elegida + texto del desglose + proveedor. */
  @Output() seleccionar = new EventEmitter<{ cantidad: number; idProvider: number; proveedor: string; texto: string }>();
  @Output() cerrar = new EventEmitter<void>();

  @ViewChild('cantidadInput') cantidadInput!: ElementRef<HTMLInputElement>;

  private svc = inject(EmpaqueDescripcionService);

  loading = true;
  modo: 'uno' | 'dividir' = 'uno';
  baseGlobal = '';        // L o kg (según el tipo de las presentaciones)
  provs: ProvViewModel[] = [];
  private raw: ProveedorPresentaciones[] = [];

  ngAfterViewInit(): void {
    setTimeout(() => this.cantidadInput?.nativeElement?.focus(), 50);
  }

  ngOnInit(): void {
    if (!this.permitirDividir) this.modo = 'uno';   // sin modo dividir → siempre un proveedor
    this.svc.getPresentacionesByMaterial(this.idMaterial).subscribe({
      next: (data) => { this.raw = data ?? []; this.build(); this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  private baseUnit(tipo: string | null | undefined): string {
    return tipo === 'PESO' ? 'kg' : tipo === 'VOLUMEN' ? 'L' : '';
  }

  private build(): void {
    // Unidad base del artículo según la regla piezas>1 → pz, si no kg/L (consistente con el comparador).
    const u = resolverUnidadArticulo(this.raw);
    this.baseGlobal = u.unidad;

    this.provs = this.raw.map(p => {
      const efectivas = p.presentaciones
        .map(x => ({ e: baseEfectiva(x), x }))
        .filter(o => o.e.base > 0 && o.e.unidad);
      const denoms: Denom[] = efectivas.map(o => ({ base: o.e.base, descripcion: o.x.descripcionEmpaque ?? '', unidad: o.e.unidad }));
      return {
        idProvider: p.idProvider,
        nombre: this.providerNames?.get(p.idProvider) ?? `Proveedor ${p.idProvider}`,
        minCompra: p.minCompra,
        base: u.unidad,
        presentaciones: efectivas.map(o => ({ label: `${o.e.base} ${o.e.unidad}`, base: o.e.base })),
        evalResult: evaluateProvider(this.cantidad, p.minCompra, denoms),
        splitInput: null,
        splitEval: null,
      };
    });
  }

  recompute(): void {
    for (const p of this.provs) {
      const denoms: Denom[] = this.denomsOf(p);
      p.evalResult = evaluateProvider(this.cantidad || 0, p.minCompra, denoms);
    }
  }

  recomputeSplit(p: ProvViewModel): void {
    const denoms = this.denomsOf(p);
    p.splitEval = (p.splitInput && p.splitInput > 0) ? evaluateProvider(p.splitInput, p.minCompra, denoms) : null;
  }

  private denomsOf(p: ProvViewModel): Denom[] {
    return p.presentaciones.filter(x => x.base > 0).map(x => ({ base: x.base, descripcion: '', unidad: p.base }));
  }

  get restante(): number {
    const sum = this.provs.reduce((a, p) => a + (Number(p.splitInput) || 0), 0);
    return Math.round(((this.cantidad || 0) - sum) * 1000) / 1000;
  }

  diff(total: number): string {
    const d = Math.round((total - (this.cantidad || 0)) * 1000) / 1000;
    return (d > 0 ? '+' : '') + d + ' ' + this.baseGlobal;
  }

  breakdownText(c: Composition): string {
    return c.lines.map(l => `${l.count}×${l.base}${this.baseGlobal ? ' ' + this.baseGlobal : ''}`).join(' + ');
  }

  elegir(p: ProvViewModel, cantidad: number, c: Composition): void {
    const texto = `${cantidad} ${this.baseGlobal} con ${p.nombre}: ${this.breakdownText(c)}`;
    this.seleccionar.emit({ cantidad, idProvider: p.idProvider, proveedor: p.nombre, texto });
  }
}
