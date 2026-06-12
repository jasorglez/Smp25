import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface ProvMinimo {
  idProvider: number;
  providerName: string;
  minCompra: number;
}

/**
 * Modal para artículos SIN flag valida_presentaciones.
 * Arriba: cantidad. Abajo: proveedores del artículo con su mínimo de compra.
 * No deja aceptar si la cantidad está por debajo del mínimo de TODOS los proveedores.
 * Si solo un proveedor cumple, se devuelve como sugerido por default.
 */
@Component({
  selector: 'app-cantidad-minimos-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="cm-backdrop" (click)="cerrar.emit()">
    <div class="cm-modal" (click)="$event.stopPropagation()">
      <div class="cm-header">
        <div>
          <div class="cm-title"><i class="bi bi-123"></i> Cantidad requerida — {{ articleName || 'Artículo' }}</div>
          <div class="cm-sub">Escribe la cantidad. Debe alcanzar el mínimo de al menos un proveedor.</div>
        </div>
        <button class="cm-x" (click)="cerrar.emit()">✕</button>
      </div>

      <div class="cm-qty">
        <label>Cantidad</label>
        <input type="number" min="0" step="0.01" [(ngModel)]="cantidad" autofocus />
      </div>

      <!-- Sin proveedores → bloqueo (opción B) -->
      <div *ngIf="providers.length === 0" class="cm-block">
        Este artículo no tiene proveedores con mínimo de compra.
      </div>

      <div *ngIf="providers.length > 0" class="cm-list">
        <div class="cm-card" *ngFor="let p of providers" [class.ok]="cumple(p)" [class.bad]="cantidad > 0 && !cumple(p)">
          <strong>{{ p.providerName }}</strong>
          <span class="cm-min" [class.bad]="cantidad > 0 && !cumple(p)">
            Mínimo: {{ p.minCompra }}
            <ng-container *ngIf="cantidad > 0">{{ cumple(p) ? '· ✓ cumple' : '· ✗ por debajo' }}</ng-container>
          </span>
        </div>
      </div>

      <!-- Letrero: por debajo del mínimo de TODOS -->
      <div *ngIf="providers.length > 0 && cantidad > 0 && pasan.length === 0" class="cm-warn">
        ⚠ La cantidad que está poniendo está por debajo del mínimo de compra de todos los proveedores.
      </div>

      <div class="cm-footer">
        <button class="cm-cancel" (click)="cerrar.emit()">Cancelar</button>
        <button class="cm-accept" [disabled]="!puedeAceptar" (click)="aceptar()">Aceptar</button>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .cm-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:3000;display:flex;align-items:center;justify-content:center;}
    .cm-modal{background:#fff;border-radius:10px;width:520px;max-width:94vw;max-height:88vh;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,.3);}
    .cm-header{display:flex;justify-content:space-between;align-items:flex-start;padding:14px 18px;background:linear-gradient(135deg,#2e7d32,#43a047);color:#fff;border-radius:10px 10px 0 0;}
    .cm-title{font-weight:700;font-size:15px;} .cm-sub{font-size:12px;opacity:.9;margin-top:2px;}
    .cm-x{background:transparent;border:none;color:#fff;font-size:18px;cursor:pointer;}
    .cm-qty{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #eee;}
    .cm-qty label{font-weight:600;font-size:13px;} .cm-qty input{width:140px;padding:7px 9px;border:1px solid #cfd8dc;border-radius:6px;font-size:14px;}
    .cm-list{padding:12px 18px;display:flex;flex-direction:column;gap:8px;}
    .cm-card{display:flex;justify-content:space-between;align-items:center;border:1px solid #e0e0e0;border-radius:8px;padding:9px 12px;}
    .cm-card.ok{border-color:#a5d6a7;background:#f1f8e9;}
    .cm-card.bad{border-color:#ef9a9a;background:#ffebee;}
    .cm-min{font-size:12px;color:#2e7d32;} .cm-min.bad{color:#c62828;font-weight:700;}
    .cm-block{padding:18px;text-align:center;color:#c62828;background:#ffebee;margin:12px 18px;border-radius:8px;font-size:13px;}
    .cm-warn{margin:0 18px 8px;color:#c62828;background:#ffebee;border:1px solid #ef9a9a;padding:8px 10px;border-radius:6px;font-size:13px;}
    .cm-footer{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid #eee;}
    .cm-cancel{background:#fff;border:1px solid #b0bec5;color:#455a64;border-radius:6px;padding:7px 16px;cursor:pointer;}
    .cm-accept{background:#43a047;border:none;color:#fff;border-radius:6px;padding:7px 18px;cursor:pointer;}
    .cm-accept:disabled{background:#c8e6c9;cursor:not-allowed;}
  `]
})
export class CantidadMinimosPanelComponent {
  @Input() articleName = '';
  @Input() cantidad = 0;
  @Input() providers: ProvMinimo[] = [];

  /** Emite la cantidad + proveedor sugerido (idProvider=0 si varios cumplen o ninguno aplica). */
  @Output() seleccionar = new EventEmitter<{ cantidad: number; idProvider: number; proveedor: string }>();
  @Output() cerrar = new EventEmitter<void>();

  /**
   * Proveedores cuyo mínimo de compra ≤ cantidad (los que "pasan"). Calculado EN VIVO (getter)
   * para que esté sincronizado tanto al teclear como al RE-ABRIR el modal con una cantidad ya
   * cargada (antes solo se recalculaba en ngModelChange → al reentrar quedaba vacío y bloqueaba).
   */
  get pasan(): ProvMinimo[] {
    const q = Number(this.cantidad) || 0;
    return q > 0 ? this.providers.filter(p => Number(p.minCompra || 0) <= q) : [];
  }

  cumple(p: ProvMinimo): boolean {
    const q = Number(this.cantidad) || 0;
    return q > 0 && Number(p.minCompra || 0) <= q;
  }

  /** Solo se puede aceptar si hay proveedores y al menos uno cumple el mínimo. */
  get puedeAceptar(): boolean {
    return this.providers.length > 0 && (Number(this.cantidad) || 0) > 0 && this.pasan.length > 0;
  }

  aceptar(): void {
    if (!this.puedeAceptar) return;
    // Si solo un proveedor cumple → se sugiere por default; si varios, sin sugerido (0).
    const sugerido = this.pasan.length === 1 ? this.pasan[0] : null;
    this.seleccionar.emit({
      cantidad: Number(this.cantidad) || 0,
      idProvider: sugerido ? sugerido.idProvider : 0,
      proveedor: sugerido ? sugerido.providerName : ''
    });
  }
}
