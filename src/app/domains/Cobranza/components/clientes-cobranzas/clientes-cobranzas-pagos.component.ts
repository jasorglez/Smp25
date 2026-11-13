import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomersService } from 'app/services/customers.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-clientes-cobranzas-pagos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="p-3 border-top bg-light">
      <div class="d-flex align-items-center gap-2 mb-3">
        <strong>Historial de pagos — {{ customer?.nameContact || customer?.company }}</strong>
        <span class="badge bg-success">Total abonado: {{ totalAbonado | currency:'MXN' }}</span>
      </div>
      <div class="row g-2 align-items-end mb-3">
        <div class="col-sm-3"><label class="form-label small">Fecha de pago</label><input class="form-control form-control-sm" type="date" [(ngModel)]="newPayment.fechaPago"></div>
        <div class="col-sm-3"><label class="form-label small">Monto</label><input class="form-control form-control-sm" type="number" min="0.01" step="0.01" [(ngModel)]="newPayment.monto"></div>
        <div class="col-sm-4"><label class="form-label small">Comentario</label><input class="form-control form-control-sm" maxlength="500" [(ngModel)]="newPayment.comentario" placeholder="Comentario del cobro"></div>
        <div class="col-sm-2"><button class="btn btn-sm btn-primary w-100" (click)="addPayment()" [disabled]="saving"><i class="bi bi-plus-lg"></i> Registrar pago</button></div>
      </div>
      <div class="table-responsive"><table class="table table-sm table-striped align-middle mb-0">
        <thead><tr><th>Fecha de pago</th><th>Comentario</th><th class="text-end">Monto</th><th></th></tr></thead>
        <tbody><tr *ngFor="let payment of payments"><td>{{ payment.fechaPago | date:'dd/MM/yyyy' }}</td><td>{{ payment.comentario || '—' }}</td><td class="text-end">{{ payment.monto | currency:'MXN' }}</td><td class="text-end"><button class="btn btn-sm btn-outline-danger" (click)="deactivate(payment)" title="Quitar del historial"><i class="bi bi-trash"></i></button></td></tr>
          <tr *ngIf="!loading && !payments.length"><td colspan="4" class="text-center text-muted">Sin pagos registrados</td></tr>
        </tbody>
      </table></div>
    </section>
  `
})
export class ClientesCobranzasPagosComponent implements OnChanges {
  @Input() customer: any;
  private customersService = inject(CustomersService);
  payments: any[] = [];
  loading = false;
  saving = false;
  newPayment: any = { fechaPago: this.today(), monto: null, comentario: '' };
  get totalAbonado(): number { return this.payments.reduce((sum, item) => sum + Number(item.monto || 0), 0); }

  ngOnChanges(): void { this.loadPayments(); }
  private today(): string { return new Date().toISOString().slice(0, 10); }

  loadPayments(): void {
    if (!this.customer?.id) return;
    this.loading = true;
    this.customersService.getCobranzaPayments(this.customer.id).subscribe({
      next: (rows: any[]) => { this.payments = rows || []; this.loading = false; },
      error: error => { console.error(error); this.loading = false; alerts.basicAlert('Error', 'No se pudo cargar el historial de pagos.', 'error'); }
    });
  }

  addPayment(): void {
    const amount = Number(this.newPayment.monto);
    if (!this.customer?.id || !this.newPayment.fechaPago || !Number.isFinite(amount) || amount <= 0) {
      alerts.basicAlert('Datos requeridos', 'Indica la fecha de pago y un monto mayor a cero.', 'warning'); return;
    }
    this.saving = true;
    this.customersService.addCobranzaPayment({ idCustomer: this.customer.id, fechaPago: this.newPayment.fechaPago, comentario: this.newPayment.comentario, monto: amount }).subscribe({
      next: () => { this.saving = false; this.newPayment = { fechaPago: this.today(), monto: null, comentario: '' }; this.loadPayments(); },
      error: error => { console.error(error); this.saving = false; alerts.basicAlert('Error', 'No se pudo guardar el pago.', 'error'); }
    });
  }

  deactivate(payment: any): void {
    alerts.confirmAlert('Quitar pago', '¿Deseas quitar este pago del historial? El registro se conservará inactivo.', 'warning', 'Sí, quitar').then(result => {
      if (!result.isConfirmed) return;
      this.customersService.deactivateCobranzaPayment(payment.id).subscribe({
        next: () => this.loadPayments(),
        error: error => { console.error(error); alerts.basicAlert('Error', 'No se pudo quitar el pago.', 'error'); }
      });
    });
  }
}
