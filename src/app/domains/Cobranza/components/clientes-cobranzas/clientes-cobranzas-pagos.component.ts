import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomersService } from 'app/services/customers.service';
import { alerts } from 'app/helpers/alerts';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-clientes-cobranzas-pagos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="p-3 border-top bg-light">
      <div class="d-flex justify-content-between align-items-center gap-2 mb-3 flex-wrap">
        <div><strong>Préstamos — {{ customer?.nameContact || customer?.company }}</strong><span class="badge bg-success ms-2">Abonado: {{ totalPaid | currency:'MXN' }}</span></div>
        <button class="btn btn-sm btn-primary" (click)="showLoanForm = !showLoanForm"><i class="bi bi-plus-lg"></i> Nuevo préstamo</button>
      </div>

      <div *ngIf="showLoanForm" class="card card-body mb-3 p-3">
        <div class="row g-2 align-items-end">
          <div class="col-md-3"><label class="form-label small">Monto del préstamo</label><input class="form-control form-control-sm" type="number" min="0.01" step="0.01" [(ngModel)]="loanForm.montoTotal"></div>
          <div class="col-md-3"><label class="form-label small">Fecha del préstamo</label><input class="form-control form-control-sm" type="date" [(ngModel)]="loanForm.fechaInicio"></div>
          <div class="col-md-3"><label class="form-label small">Primer pago</label><input class="form-control form-control-sm" type="date" [(ngModel)]="loanForm.fechaPrimerPago"></div>
          <div class="col-md-3"><label class="form-label small">Número de pagos</label><input class="form-control form-control-sm" value="10 pagos mensuales" readonly></div>
          <div class="col-12"><label class="form-label small">Comentario</label><input class="form-control form-control-sm" maxlength="500" [(ngModel)]="loanForm.comentario"></div>
          <div class="col-12 d-flex gap-2"><button class="btn btn-sm btn-success" (click)="createLoan()" [disabled]="saving"><i class="bi bi-floppy"></i> Crear préstamo y calendario</button><button class="btn btn-sm btn-secondary" (click)="showLoanForm = false">Cancelar</button></div>
        </div>
      </div>

      <article *ngFor="let loan of loans" class="card mb-3">
        <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div><strong>Préstamo #{{ loan.id }}</strong><span class="ms-2">{{ loan.montoTotal | currency:'MXN' }}</span><small class="text-muted ms-2">10 pagos desde {{ loan.fechaPrimerPago | date:'dd/MM/yyyy' }}</small></div>
          <span class="badge" [class.bg-success]="loanBalance(loan) <= 0" [class.bg-warning]="loanBalance(loan) > 0">Saldo {{ loanBalance(loan) | currency:'MXN' }}</span>
        </div>
        <div class="table-responsive"><table class="table table-sm table-striped align-middle mb-0">
          <thead><tr><th>#</th><th>Fecha programada</th><th class="text-end">Cuota</th><th class="text-end">Abonado</th><th class="text-end">Saldo</th><th>Estado</th><th></th></tr></thead>
          <tbody><ng-container *ngFor="let installment of loan.cuotas">
            <tr><td>{{ installment.numeroCuota }}</td><td><div class="d-flex align-items-center gap-1"><input class="form-control form-control-sm" style="min-width:145px" type="date" [(ngModel)]="installment.fechaProgramada" [attr.aria-label]="'Fecha programada de cuota ' + installment.numeroCuota"><button class="btn btn-sm btn-outline-success" (click)="saveInstallmentDate(installment)" [disabled]="saving" title="Guardar fecha"><i class="bi bi-floppy"></i></button></div></td><td class="text-end">{{ installment.montoProgramado | currency:'MXN' }}</td><td class="text-end">{{ installmentPaid(installment) | currency:'MXN' }}</td><td class="text-end">{{ installmentBalance(installment) | currency:'MXN' }}</td><td><span class="badge" [class.bg-success]="installmentBalance(installment) <= 0" [class.bg-secondary]="installmentBalance(installment) > 0">{{ installmentBalance(installment) <= 0 ? 'Pagada' : 'Pendiente' }}</span></td><td class="text-end"><button class="btn btn-sm btn-outline-primary" (click)="toggleAbonoForm(installment)"><i class="bi bi-cash-coin"></i> Registrar abono</button></td></tr>
            <tr *ngIf="activeInstallmentId === installment.id"><td colspan="7" class="bg-white"><div class="row g-2 align-items-end py-2">
              <div class="col-md-3"><label class="form-label small">Fecha recibida</label><input class="form-control form-control-sm" type="date" [(ngModel)]="abonoForm.fechaPago"></div>
              <div class="col-md-3"><label class="form-label small">Monto recibido (máx. {{ installmentBalance(installment) | currency:'MXN' }})</label><input class="form-control form-control-sm" type="number" min="0.01" step="0.01" [max]="installmentBalance(installment)" [(ngModel)]="abonoForm.monto"></div>
              <div class="col-md-4"><label class="form-label small">Comentario</label><input class="form-control form-control-sm" maxlength="500" [(ngModel)]="abonoForm.comentario"></div>
              <div class="col-md-2"><button class="btn btn-sm btn-success w-100" (click)="recordPayment(installment)" [disabled]="saving">Guardar abono</button></div>
            </div><div *ngIf="installment.abonos?.length" class="small mt-2"><strong>Abonos registrados:</strong><span *ngFor="let payment of installment.abonos" class="ms-2">{{ payment.fechaPago | date:'dd/MM/yyyy' }} — {{ payment.monto | currency:'MXN' }}<button class="btn btn-link btn-sm text-danger p-0 ms-1" (click)="deactivatePayment(payment)" title="Quitar abono"><i class="bi bi-x-circle"></i></button><span *ngIf="payment.comentario"> ({{ payment.comentario }})</span></span></div></td></tr>
          </ng-container>
          <tr *ngIf="!loan.cuotas?.length"><td colspan="7" class="text-center text-muted">Sin cuotas generadas</td></tr></tbody>
        </table></div>
      </article>
      <div *ngIf="!loading && !loans.length" class="text-center text-muted py-3">Sin préstamos registrados. Usa “Nuevo préstamo” para programar 10 pagos mensuales.</div>
    </section>
  `
})
export class ClientesCobranzasPagosComponent implements OnChanges {
  @Input() customer: any;
  private customersService = inject(CustomersService);
  loans: any[] = [];
  loading = false;
  saving = false;
  showLoanForm = false;
  activeInstallmentId: number | null = null;
  loanForm: any = { montoTotal: null, fechaInicio: this.today(), fechaPrimerPago: this.nextMonth(), comentario: '' };
  abonoForm: any = { fechaPago: this.today(), monto: null, comentario: '' };

  get totalPaid(): number { return this.loans.reduce((sum, loan) => sum + loan.cuotas.reduce((s: number, q: any) => s + this.installmentPaid(q), 0), 0); }
  ngOnChanges(): void { this.loadLoans(); }
  private today(): string { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  private nextMonth(): string { const date = new Date(); const day = date.getDate(); date.setDate(1); date.setMonth(date.getMonth() + 1); const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(); date.setDate(Math.min(day, lastDay)); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  private dateForInput(value: string | Date): string { return typeof value === 'string' ? value.slice(0, 10) : this.formatDate(value); }
  private formatDate(value: Date): string { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
  installmentPaid(item: any): number { return (item.abonos || []).filter((p: any) => p.active !== false).reduce((sum: number, p: any) => sum + Number(p.monto || 0), 0); }
  installmentBalance(item: any): number { return Math.max(0, Number(item.montoProgramado || 0) - this.installmentPaid(item)); }
  loanBalance(loan: any): number { return (loan.cuotas || []).reduce((sum: number, item: any) => sum + this.installmentBalance(item), 0); }

  loadLoans(): void {
    if (!this.customer?.id) { this.loans = []; return; }
    this.loading = true;
    this.customersService.getCobranzaLoans(this.customer.id).subscribe({
      next: (items: any[]) => { this.loans = (items || []).map(loan => ({ ...loan, cuotas: (loan.cuotas || []).map((installment: any) => ({ ...installment, fechaProgramada: this.dateForInput(installment.fechaProgramada) })) })); this.loading = false; },
      error: error => { console.error(error); this.loading = false; alerts.basicAlert('Error', 'No se pudieron cargar los préstamos.', 'error'); }
    });
  }

  async createLoan(): Promise<void> {
    const amount = Number(this.loanForm.montoTotal);
    if (!Number.isFinite(amount) || amount <= 0 || !this.loanForm.fechaInicio || !this.loanForm.fechaPrimerPago) { alerts.basicAlert('Datos requeridos', 'Captura monto y fechas válidas.', 'warning'); return; }
    this.saving = true;
    try {
      await firstValueFrom(this.customersService.createCobranzaLoan({ idCustomer: this.customer.id, montoTotal: amount, fechaInicio: this.loanForm.fechaInicio, fechaPrimerPago: this.loanForm.fechaPrimerPago, numeroCuotas: 10, comentario: this.loanForm.comentario }));
      this.saving = false; this.showLoanForm = false; this.loanForm = { montoTotal: null, fechaInicio: this.today(), fechaPrimerPago: this.nextMonth(), comentario: '' }; this.loadLoans();
    } catch (error) { console.error(error); this.saving = false; alerts.basicAlert('Error', 'No se pudo crear el préstamo y sus 10 cuotas.', 'error'); }
  }

  async saveInstallmentDate(installment: any): Promise<void> {
    if (!installment.fechaProgramada || !/^\d{4}-\d{2}-\d{2}$/.test(installment.fechaProgramada)) { alerts.basicAlert('Fecha no válida', 'Selecciona una fecha para esta cuota.', 'warning'); return; }
    this.saving = true;
    try {
      await firstValueFrom(this.customersService.updateCobranzaInstallmentDate(installment.id, { fechaProgramada: installment.fechaProgramada }));
      this.saving = false;
      alerts.basicAlert('Fecha actualizada', 'Se guardó la nueva fecha programada.', 'success');
      this.loadLoans();
    } catch (error) { console.error(error); this.saving = false; alerts.basicAlert('Error', 'No se pudo guardar la fecha de la cuota.', 'error'); }
  }

  toggleAbonoForm(installment: any): void {
    this.activeInstallmentId = this.activeInstallmentId === installment.id ? null : installment.id;
    this.abonoForm = { fechaPago: this.today(), monto: null, comentario: '' };
  }

  async recordPayment(installment: any): Promise<void> {
    const amount = Number(this.abonoForm.monto);
    if (!this.abonoForm.fechaPago || !Number.isFinite(amount) || amount <= 0 || amount > this.installmentBalance(installment)) { alerts.basicAlert('Monto no válido', 'Captura un abono mayor a cero que no supere el saldo de la cuota.', 'warning'); return; }
    this.saving = true;
    try {
      await firstValueFrom(this.customersService.addCobranzaInstallmentPayment(installment.id, { fechaPago: this.abonoForm.fechaPago, monto: amount, comentario: this.abonoForm.comentario }));
      this.saving = false; this.activeInstallmentId = null; this.loadLoans();
    } catch (error) { console.error(error); this.saving = false; alerts.basicAlert('Error', 'No se pudo registrar el abono.', 'error'); }
  }

  async deactivatePayment(payment: any): Promise<void> {
    const result = await alerts.confirmAlert('Quitar abono', 'El abono se conservará inactivo en el historial.', 'warning', 'Sí, quitar');
    if (!result.isConfirmed) return;
    this.customersService.deactivateCobranzaInstallmentPayment(payment.id).subscribe({ next: () => this.loadLoans(), error: error => { console.error(error); alerts.basicAlert('Error', 'No se pudo quitar el abono.', 'error'); } });
  }
}
