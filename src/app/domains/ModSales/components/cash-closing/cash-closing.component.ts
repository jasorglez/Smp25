import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { PosDbService, PosSession } from 'app/services/pos-db.service';
import { CashClosingService, CorteResumen, MovimientoCaja, CorteDeCaja } from 'app/services/cash-closing.service';
import { firstValueFrom } from 'rxjs';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-cash-closing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cash-closing.component.html',
})
export class CashClosingComponent implements OnInit {
  private posDb = inject(PosDbService);
  private cashClosingService = inject(CashClosingService);
  private router = inject(Router);

  session: PosSession | null = null;
  loading = false;
  saving = false;
  errorMsg = '';

  // Resumen de ventas por forma de pago
  resumen: CorteResumen[] = [];
  movimientos: MovimientoCaja[] = [];

  // Totales calculados
  totalEfectivo = 0;
  totalCheque = 0;
  totalVales = 0;
  totalTarjeta = 0;
  totalVentas = 0;
  numVentas = 0;
  totalRetiros = 0;
  apertura = 0;

  // Nuevo retiro
  showRetiroForm = false;
  nuevoRetiro = { monto: 0, descripcion: '' };

  // Corte
  observaciones = '';
  cajero = '';

  get saldoFinal(): number {
    return this.apertura + this.totalEfectivo - this.totalRetiros;
  }

  async ngOnInit() {
    this.session = await this.posDb.getSession();
    if (!this.session) return;
    await this.loadData();
  }

  private async loadData() {
    if (!this.session) return;
    this.loading = true;
    this.errorMsg = '';
    try {
      const [resumen, movimientos] = await Promise.all([
        firstValueFrom(this.cashClosingService.getResumen(
          this.session.idCashRegister,
          this.session.startedAt
        )),
        firstValueFrom(this.cashClosingService.getMovimientos(this.session.idCashRegister)),
      ]);

      this.resumen = resumen;
      this.movimientos = movimientos;
      this.calcularTotales();
    } catch {
      this.errorMsg = 'No se pudieron cargar los datos. Verifica tu conexión.';
    } finally {
      this.loading = false;
    }
  }

  private calcularTotales() {
    this.totalEfectivo = 0;
    this.totalCheque = 0;
    this.totalVales = 0;
    this.totalTarjeta = 0;
    this.totalVentas = 0;
    this.numVentas = 0;

    for (const r of this.resumen) {
      this.totalVentas += r.total;
      this.numVentas += r.numVentas;
      switch (r.paymentType) {
        case 'EFECTIVO': this.totalEfectivo += r.total; break;
        case 'CHEQUE':   this.totalCheque   += r.total; break;
        case 'VALES':    this.totalVales    += r.total; break;
        case 'TARJETA':  this.totalTarjeta  += r.total; break;
      }
    }

    this.apertura = this.movimientos
      .filter(m => m.tipo === 'APERTURA')
      .reduce((s, m) => s + m.monto, 0);

    this.totalRetiros = this.movimientos
      .filter(m => m.tipo === 'RETIRO')
      .reduce((s, m) => s + m.monto, 0);
  }

  async agregarRetiro() {
    if (!this.session || !this.nuevoRetiro.monto || this.nuevoRetiro.monto <= 0) return;
    this.saving = true;
    try {
      await firstValueFrom(this.cashClosingService.saveMovimiento({
        idCashRegister: this.session.idCashRegister,
        tipo: 'RETIRO',
        monto: this.nuevoRetiro.monto,
        descripcion: this.nuevoRetiro.descripcion,
        cajero: this.cajero,
      }));
      this.nuevoRetiro = { monto: 0, descripcion: '' };
      this.showRetiroForm = false;
      await this.loadData();
    } catch {
      this.errorMsg = 'Error al registrar el retiro.';
    } finally {
      this.saving = false;
    }
  }

  async realizarCorte() {
    if (!this.session) return;

    const result = await alerts.confirmAlert(
      '¿Realizar corte de caja?',
      'Esta acción cerrará el turno activo. Asegúrate de haber sincronizado todas las ventas.',
      'warning',
      'Sí, realizar corte',
    );
    if (!result.isConfirmed) return;

    this.saving = true;
    try {
      const corte: CorteDeCaja = {
        idCashRegister: this.session.idCashRegister,
        idStore: this.session.idStore,
        fechaApertura: this.session.startedAt,
        apertura: this.apertura,
        totalEfectivo: this.totalEfectivo,
        totalCheque: this.totalCheque,
        totalVales: this.totalVales,
        totalTarjeta: this.totalTarjeta,
        totalRetiros: this.totalRetiros,
        totalVentas: this.totalVentas,
        saldoFinal: this.saldoFinal,
        numVentas: this.numVentas,
        cajero: this.cajero,
        observaciones: this.observaciones,
      };

      await firstValueFrom(this.cashClosingService.saveCorte(corte));
      await this.posDb.clearSession();
      this.router.navigate(['/procsales/before-pos']);
    } catch {
      this.errorMsg = 'Error al guardar el corte. Intenta de nuevo.';
    } finally {
      this.saving = false;
    }
  }

  formatCurrency(v: number) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0);
  }

  formatDate(d: string) {
    return new Date(d).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
  }

  getPaymentLabel(type: string): string {
    const labels: Record<string, string> = {
      EFECTIVO: 'Efectivo',
      CHEQUE: 'Cheque',
      VALES: 'Vales/Cupones',
      TARJETA: 'Tarjeta',
    };
    return labels[type] ?? type;
  }

  getPaymentIcon(type: string): string {
    const icons: Record<string, string> = {
      EFECTIVO: 'bi-cash-coin',
      CHEQUE: 'bi-file-earmark-text',
      VALES: 'bi-ticket-perforated',
      TARJETA: 'bi-credit-card',
    };
    return icons[type] ?? 'bi-question';
  }

  volverAlPOS() {
    this.router.navigate(['/procsales/pos']);
  }
}
