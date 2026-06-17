import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { SalidasMpService, LoteDisponible } from 'app/services/salidas-mp.service';
import { EmployeesService } from 'app/services/employees.service';
import { lastValueFrom } from 'rxjs';

/**
 * Modal para elegir DE QUÉ LOTE(S) se gasta un artículo en Molienda (consumo de materia prima).
 * Lista los lotes disponibles en orden FEFO (menor caducidad restante primero), permite repartir
 * la cantidad entre varios lotes, avisa si no se gasta del de menor caducidad. Solo lectura de origen.
 */
@Component({
  selector: 'app-salida-lotes-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="slm-overlay" (click)="cancelar()">
      <div class="slm-modal" (click)="$event.stopPropagation()">
        <div class="slm-head">
          <h6 class="m-0 fw-bold text-success">Gastar materia prima por lote</h6>
          <button class="btn-close" (click)="cancelar()"></button>
        </div>

        <div class="slm-body">
          <!-- Artículo -->
          <div class="d-flex align-items-center gap-2 mb-2">
            <span style="font-size:0.85rem; font-weight:600; white-space:nowrap;">Artículo</span>
            <select class="slm-input" [(ngModel)]="selectedArticulo" (ngModelChange)="onArticuloChange()" style="flex:1;">
              <option [ngValue]="null" disabled>Selecciona artículo…</option>
              <option *ngFor="let a of articuloOptions" [ngValue]="a.id">
                {{ a.name }}{{ a.cantidad != null ? ' (disp: ' + fmt(a.cantidad) + ')' : '' }}
              </option>
            </select>
          </div>

          <!-- Quién gasta -->
          <div class="d-flex align-items-center gap-2 mb-2">
            <span style="font-size:0.85rem; font-weight:600; white-space:nowrap;">Quién gasta</span>
            <select class="slm-input" [(ngModel)]="selectedEmpleadoName" style="flex:1;"
                    [disabled]="cargandoEmpleados">
              <option [ngValue]="null" disabled>
                {{ cargandoEmpleados ? 'Cargando…' : 'Selecciona persona…' }}
              </option>
              <option *ngFor="let e of empleados" [ngValue]="e.name">{{ e.name }}</option>
            </select>
          </div>

          <div *ngIf="cargando" class="text-center text-muted py-2">
            <span class="spinner-border spinner-border-sm me-2"></span> Cargando lotes…
          </div>

          <div *ngIf="!cargando && selectedArticulo && lotes.length === 0" class="text-center text-muted py-2">
            Este artículo no tiene lotes disponibles en este almacén.
          </div>

          <!-- Reparto rápido -->
          <div *ngIf="!cargando && lotes.length > 0" class="d-flex align-items-center gap-2 mb-2">
            <span style="font-size:0.8rem; white-space:nowrap;">Cantidad total a gastar</span>
            <input type="number" min="0" class="slm-input" [(ngModel)]="totalAGastar" style="width:120px;">
            <button class="btn btn-sm btn-outline-success" (click)="sugerirFEFO()">Sugerir FEFO</button>
            <span class="ms-auto" style="font-size:0.8rem;">
              Repartido: <b>{{ fmt(sumTomar()) }}</b>
            </span>
          </div>

          <!-- Lotes (FEFO) -->
          <table *ngIf="!cargando && lotes.length > 0" class="slm-table">
            <thead>
              <tr>
                <th>Folio entrada</th>
                <th>Lote</th>
                <th class="num">Disponible</th>
                <th>Fecha entrada</th>
                <th class="num">Caducidad (meses)</th>
                <th>Proveedor</th>
                <th class="num">Cantidad a tomar</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let l of lotes; let i = index" [class.slm-row-first]="i === 0">
                <td>{{ l.folioEntrada }}</td>
                <td>{{ l.lote }}</td>
                <td class="num">{{ fmt(l.cantidadDisponible) }}</td>
                <td>{{ fmtFecha(l.fechaEntrada) }}</td>
                <td class="num" [class.text-danger]="(l.caducidadRestanteMeses ?? 99) <= 0">
                  {{ l.caducidadRestanteMeses != null ? l.caducidadRestanteMeses : '—' }}
                </td>
                <td>{{ l.proveedor }}</td>
                <td class="num">
                  <input type="number" min="0" [max]="l.cantidadDisponible"
                         [(ngModel)]="l.tomar" (ngModelChange)="onTomarChange(l)"
                         class="slm-input" style="width:90px; text-align:right;">
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="slm-foot">
          <button class="btn btn-sm btn-secondary" (click)="cancelar()">Cancelar</button>
          <button class="btn btn-sm btn-success" (click)="confirmar()"
                  [disabled]="!selectedArticulo || sumTomar() <= 0 || !selectedEmpleadoName">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .slm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; z-index: 1080; }
    .slm-modal { background:#fff; border-radius:12px; width:min(880px,95vw); max-height:90vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 18px 50px rgba(0,0,0,0.25); }
    .slm-head { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-bottom:1px solid #e8eef5; background:#f7fbf8; }
    .slm-body { padding:14px 18px; overflow:auto; }
    .slm-foot { display:flex; justify-content:flex-end; gap:8px; padding:12px 18px; border-top:1px solid #e8eef5; }
    .slm-input { border:1px solid #d4e0f0; border-radius:8px; padding:6px 10px; font-size:0.85rem; }
    .slm-table { width:100%; border-collapse:collapse; font-size:0.82rem; }
    .slm-table th, .slm-table td { border:1px solid #e0e6ee; padding:5px 8px; text-align:left; }
    .slm-table thead th { background:#e8f5e9; font-weight:600; }
    .slm-table .num { text-align:right; }
    .slm-row-first { background:#f1f8e9; }
  `],
})
export class SalidaLotesModalComponent implements OnInit {
  private salidasService    = inject(SalidasMpService);
  private employeesService  = inject(EmployeesService);

  @Input() articuloOptions: { id: number; name: string; cantidad?: number }[] = [];
  @Input() idSucursal!: number;
  @Input() idDepartamento!: number;
  @Input() set idArticuloActual(v: number | null) { this._preselect = v ?? null; }
  /** Consumos previos ya guardados para esta fila: { idDatoExterno → cantidad }. Al abrir en modo edición,
   *  se devuelven al disponible y se pre-llenan en "Cantidad a tomar". */
  @Input() salidasPrevias: { [idDatoExterno: number]: number } = {};

  @Input() idDepto: number = 62;
  @Input() empleadoActual: string | null = null;

  @Output() resolve = new EventEmitter<{ idArticulo: number; cantidad: number; empleado: string; lotes: { idDatoExterno: number; cantidad: number }[] }>();
  @Output() cancel = new EventEmitter<void>();

  private _preselect: number | null = null;
  selectedArticulo: number | null = null;
  lotes: (LoteDisponible & { tomar?: number })[] = [];
  totalAGastar: number | null = null;
  cargando = false;

  empleados: { id: number; name: string }[] = [];
  selectedEmpleadoName: string | null = null;
  cargandoEmpleados = false;

  ngOnInit() {
    if (this._preselect) { this.selectedArticulo = this._preselect; this.onArticuloChange(); }
    if (this.empleadoActual) this.selectedEmpleadoName = this.empleadoActual;
    this.loadEmpleados();
  }

  private async loadEmpleados() {
    this.cargandoEmpleados = true;
    try {
      const res = await lastValueFrom(this.employeesService.getEmployeesByDepto(this.idDepto)).catch(() => []);
      this.empleados = Array.isArray(res) ? res : [];
    } catch { this.empleados = []; }
    this.cargandoEmpleados = false;
  }

  fmtFecha(v: any): string {
    if (!v) return '—';
    try {
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}/${d.getFullYear()}`;
    } catch { return String(v); }
  }

  fmt(v: any): string {
    const n = Number(v ?? 0);
    return isFinite(n) ? n.toLocaleString('es-MX', { maximumFractionDigits: 2 }) : '0';
  }

  onArticuloChange() {
    this.lotes = [];
    this.totalAGastar = null;
    if (!this.selectedArticulo) return;
    this.cargando = true;
    this.salidasService.getDisponibles(this.selectedArticulo, this.idDepartamento, this.idSucursal).subscribe({
      next: (d) => {
        this.lotes = (Array.isArray(d) ? d : []).map(x => {
          const previo = Number(this.salidasPrevias?.[x.idDatoExterno] ?? 0);
          return {
            ...x,
            // Devolver el consumo previo al disponible para que el usuario redistribuya libremente.
            cantidadDisponible: x.cantidadDisponible + previo,
            tomar: previo,
          };
        });
        const totalPrevio = this.lotes.reduce((s, l) => s + (Number(l.tomar) || 0), 0);
        if (totalPrevio > 0) this.totalAGastar = totalPrevio;
        this.cargando = false;
      },
      error: () => { this.lotes = []; this.cargando = false; },
    });
  }

  onTomarChange(l: LoteDisponible & { tomar?: number }) {
    const v = Number(l.tomar) || 0;
    if (v < 0) l.tomar = 0;
    else if (v > l.cantidadDisponible) l.tomar = l.cantidadDisponible;
  }

  sumTomar(): number {
    return this.lotes.reduce((acc, l) => acc + (Number(l.tomar) || 0), 0);
  }

  // Reparte `totalAGastar` entre los lotes en orden FEFO (los primeros = menor caducidad).
  sugerirFEFO() {
    let restante = Number(this.totalAGastar) || 0;
    for (const l of this.lotes) {
      if (restante <= 0) { l.tomar = 0; continue; }
      const toma = Math.min(restante, l.cantidadDisponible);
      l.tomar = toma;
      restante -= toma;
    }
    if (restante > 0) {
      alerts.reqErrorToast(`Faltan ${this.fmt(restante)} sin cubrir (no hay suficiente disponible).`);
    }
  }

  /** True si hay cantidad en un lote teniendo otro de MENOR caducidad sin agotar (no-FEFO). */
  private violaFEFO(): boolean {
    for (let i = 0; i < this.lotes.length; i++) {
      const libre = this.lotes[i].cantidadDisponible - (Number(this.lotes[i].tomar) || 0);
      if (libre <= 0) continue; // este (más temprano) ya está agotado
      // ¿algún lote POSTERIOR (mayor caducidad) tiene cantidad?
      for (let k = i + 1; k < this.lotes.length; k++) {
        if ((Number(this.lotes[k].tomar) || 0) > 0) return true;
      }
    }
    return false;
  }

  async confirmar() {
    if (!this.selectedArticulo) return;
    const total = this.sumTomar();
    if (total <= 0) { alerts.reqErrorToast('Captura cuánto tomar de algún lote.'); return; }
    if (!this.selectedEmpleadoName) { alerts.reqErrorToast('Selecciona quién gasta el material.'); return; }

    // Validar topes por lote.
    for (const l of this.lotes) {
      if ((Number(l.tomar) || 0) > l.cantidadDisponible) {
        alerts.reqErrorToast(`No puedes tomar más de ${this.fmt(l.cantidadDisponible)} del lote ${l.lote}.`);
        return;
      }
    }

    // Aviso FEFO.
    if (this.violaFEFO()) {
      const r = await alerts.confirmAlert(
        'Caducidad',
        'Estás gastando de un lote que NO es el de menor caducidad (hay otro que vence antes). ¿Seguro que deseas continuar?',
        'warning', 'Sí, continuar'
      );
      if (!r.isConfirmed) return;
    }

    const lotes = this.lotes
      .filter(l => (Number(l.tomar) || 0) > 0)
      .map(l => ({ idDatoExterno: l.idDatoExterno, cantidad: Number(l.tomar) }));

    this.resolve.emit({ idArticulo: this.selectedArticulo, cantidad: total, empleado: this.selectedEmpleadoName, lotes });
  }

  cancelar() { this.cancel.emit(); }
}
