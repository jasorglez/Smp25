import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomersService } from 'app/services/customers.service';
import { alerts } from 'app/helpers/alerts';
import { firstValueFrom } from 'rxjs';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ButtonCellRendererExpenditureComponent } from 'app/domains/ModAdmon/components/egresos-palacio/button-cell-renderer-expenditure.component';
import { CatalogsService } from 'app/services/catalogs.service';
import { UsersService } from 'app/services/users.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-clientes-cobranzas-pagos',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, ButtonCellRendererExpenditureComponent],
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
          <div class="d-flex align-items-center gap-2"><span class="badge" [class.bg-success]="loanBalance(loan) <= 0" [class.bg-warning]="loanBalance(loan) > 0">Saldo {{ loanBalance(loan) | currency:'MXN' }}</span>
            <button class="btn btn-sm btn-primary position-relative" (click)="saveChanges(loan)" [disabled]="saving || !hasChanges(loan)"><i class="bi bi-floppy"></i> Guardar<span *ngIf="hasChanges(loan)" class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"></span></button>
            <button class="btn btn-sm btn-warning" (click)="revertChanges(loan)" [disabled]="saving || !hasChanges(loan)"><i class="bi bi-arrow-clockwise"></i> Deshacer</button>
          </div>
        </div>
        <div class="card-body"><ag-grid-angular class="ag-theme-quartz small-text-ag-grid d-block" style="width:100%;height:320px" [rowData]="loan.cuotas" [columnDefs]="installmentColumns" [defaultColDef]="defaultColDef" [localeText]="AG_GRID_LOCALE_ES" [rowSelection]="'single'" [stopEditingWhenCellsLoseFocus]="true" (cellValueChanged)="onDateChanged($event)"></ag-grid-angular>
          <div *ngFor="let installment of loan.cuotas"><div *ngIf="activeInstallmentId === installment.id" class="border rounded p-2 mt-2"><strong>Abonos de la cuota {{ installment.numeroCuota }}</strong><div class="row g-2 align-items-end py-2">
              <div class="col-md-2"><label class="form-label small">Fecha recibida</label><input class="form-control form-control-sm" type="date" [(ngModel)]="abonoForm.fechaPago"></div>
              <div class="col-md-2"><label class="form-label small">Monto recibido (máx. {{ installmentBalance(installment) | currency:'MXN' }})</label><input class="form-control form-control-sm" type="number" min="0.01" step="0.01" [max]="installmentBalance(installment)" [(ngModel)]="abonoForm.monto"></div>
              <div class="col-md-2"><label class="form-label small">Tipo de pago <button class="btn btn-link btn-sm p-0" (click)="addPaymentType()" title="Agregar tipo de pago"><i class="bi bi-plus-circle"></i></button></label><select class="form-select form-select-sm" [(ngModel)]="abonoForm.idTipoPago"><option [ngValue]="null">Seleccionar</option><option *ngFor="let type of paymentTypes" [ngValue]="type.id">{{ type.description }}</option></select></div>
              <div class="col-md-2"><label class="form-label small">Responsable del cobro</label><select class="form-select form-select-sm" [(ngModel)]="abonoForm.idUsuarioCobrador"><option [ngValue]="null">Sin asignar</option><option *ngFor="let user of users" [ngValue]="user.id">{{ user.usersmall || user.displayName || user.email }}</option></select></div>
              <div class="col-md-2"><label class="form-label small">Comentario</label><input class="form-control form-control-sm" maxlength="500" [(ngModel)]="abonoForm.comentario"></div>
              <div class="col-md-2"><button class="btn btn-sm btn-success w-100" (click)="recordPayment(installment)" [disabled]="saving">Guardar abono</button></div>
            </div><div *ngIf="installment.abonos?.length" class="small mt-2"><strong>Abonos registrados:</strong><span *ngFor="let payment of installment.abonos" class="ms-2">{{ payment.fechaPago | date:'dd/MM/yyyy' }} — {{ payment.monto | currency:'MXN' }}<button class="btn btn-link btn-sm text-danger p-0 ms-1" (click)="deactivatePayment(payment)" title="Quitar abono"><i class="bi bi-x-circle"></i></button><span *ngIf="payment.comentario"> ({{ payment.comentario }})</span></span></div></div></div>
        </div>
      </article>
      <div *ngIf="!loading && !loans.length" class="text-center text-muted py-3">Sin préstamos registrados. Usa “Nuevo préstamo” para programar 10 pagos mensuales.</div>
    </section>
  `
})
export class ClientesCobranzasPagosComponent implements OnChanges {
  @Input() customer: any;
  private customersService = inject(CustomersService);
  private catalogsService = inject(CatalogsService);
  private usersService = inject(UsersService);
  private signalsService = inject(SignalsService);
  paymentTypes: any[] = [];
  users: any[] = [];
  loans: any[] = [];
  loading = false;
  saving = false;
  showLoanForm = false;
  activeInstallmentId: number | null = null;
  loanForm: any = { montoTotal: null, fechaInicio: this.today(), fechaPrimerPago: this.nextMonth(), comentario: '' };
  abonoForm: any = { fechaPago: this.today(), monto: null, comentario: '' };
  AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  originalDates = new Map<number, string>();
  defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1 };
  installmentColumns: ColDef[] = [
    { field: 'numeroCuota', headerName: '#', width: 70, flex: 0, editable: false },
    { field: 'fechaProgramada', headerName: 'Fecha programada', editable: true, cellEditor: 'agDateStringCellEditor', cellDataType: 'dateString', minWidth: 170 },
    { field: 'montoProgramado', headerName: 'Cuota', editable: false, valueFormatter: p => this.money(p.value) },
    { headerName: 'Abonado', valueGetter: p => this.installmentPaid(p.data), valueFormatter: p => this.money(p.value) },
    { headerName: 'Saldo', valueGetter: p => this.installmentBalance(p.data), valueFormatter: p => this.money(p.value) },
    { headerName: 'Estado', valueGetter: p => this.installmentBalance(p.data) <= 0 ? 'Pagada' : 'Pendiente' },
    { headerName: 'Abonos', width: 110, flex: 0, sortable: false, filter: false, valueGetter: () => 'Abonos', cellRenderer: ButtonCellRendererExpenditureComponent, cellRendererParams: { onClick: (node: any) => this.toggleAbonoForm(node.data), icon: 'bi-cash-coin', title: 'Ver y registrar abonos de la cuota' } }
  ];
  private money(value: any): string { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value || 0)); }
  onDateChanged(event: any): void { if (!/^\d{4}-\d{2}-\d{2}$/.test(event.newValue || '')) { event.node.setDataValue('fechaProgramada', event.oldValue); alerts.basicAlert('Fecha inválida', 'Selecciona una fecha válida.', 'warning'); } }
  hasChanges(loan: any): boolean { return (loan.cuotas || []).some((item: any) => item.fechaProgramada !== this.originalDates.get(item.id)); }
  revertChanges(loan: any): void { loan.cuotas = loan.cuotas.map((item: any) => ({ ...item, fechaProgramada: this.originalDates.get(item.id) })); }
  async saveChanges(loan: any): Promise<void> { const changed = loan.cuotas.filter((item: any) => item.fechaProgramada !== this.originalDates.get(item.id)); if (!changed.length) return; this.saving = true; try { for (const item of changed) await firstValueFrom(this.customersService.updateCobranzaInstallmentDate(item.id, { fechaProgramada: item.fechaProgramada })); this.saving = false; this.loadLoans(); alerts.basicAlert('Fechas guardadas', 'Se actualizó el calendario de pagos.', 'success'); } catch (error) { console.error(error); this.saving = false; alerts.basicAlert('Error', 'No se pudieron guardar todas las fechas. Recarga el detalle para revisar cuáles se guardaron.', 'error'); } }

  get totalPaid(): number { return this.loans.reduce((sum, loan) => sum + loan.cuotas.reduce((s: number, q: any) => s + this.installmentPaid(q), 0), 0); }
  ngOnChanges(): void { this.loadLoans(); this.loadPaymentTypes(); this.loadUsers(); }
  loadPaymentTypes(): void { const rootId = Number(this.customer?.idRoot); if (!rootId) return; this.catalogsService.getCatalogsFromAdmon(rootId, 'COBRO_PAGO').subscribe({ next: types => { this.paymentTypes = types || []; }, error: () => { this.paymentTypes = []; } }); }
  async addPaymentType(): Promise<void> { const result = await alerts.inputAlert('Nuevo tipo de pago', 'Nombre del medio de pago', 'text', '', { inputAttributes: { maxlength: '100' } }); if (!result.isConfirmed) return; const name = String(result.value || '').trim().toUpperCase(); if (!name) return; if (this.paymentTypes.some(type => String(type.description).toUpperCase() === name)) { alerts.basicAlert('Tipo existente', 'Ese tipo de pago ya está en el catálogo.', 'info'); return; } try { const response: any = await firstValueFrom(this.catalogsService.addCatalogToAdmon({ idCompany: this.customer.idRoot, description: name, type: 'COBRO_PAGO', active: 1 })); this.loadPaymentTypes(); this.abonoForm.idTipoPago = response?.id ?? null; alerts.basicAlert('Tipo agregado', 'El medio de pago quedó disponible para esta empresa.', 'success'); } catch (error) { console.error(error); alerts.basicAlert('Error', 'No se pudo agregar el tipo de pago.', 'error'); } }
  loadUsers(): void { const rootId = Number(this.customer?.idRoot); if (!rootId) return; this.usersService.getDataUsers(rootId).subscribe({ next: (result: any) => { this.users = result?.data || []; }, error: () => { this.users = []; } }); }
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
      next: (items: any[]) => { this.loans = (items || []).map(loan => ({ ...loan, cuotas: (loan.cuotas || []).map((installment: any) => ({ ...installment, fechaProgramada: this.dateForInput(installment.fechaProgramada) })) })); this.originalDates.clear(); this.loans.forEach(loan => loan.cuotas.forEach((item: any) => this.originalDates.set(item.id, item.fechaProgramada))); this.loading = false; },
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

  toggleAbonoForm(installment: any): void {
    this.activeInstallmentId = this.activeInstallmentId === installment.id ? null : installment.id;
    this.abonoForm = { fechaPago: this.today(), monto: null, idTipoPago: this.paymentTypes[0]?.id ?? null, idUsuarioCobrador: Number(this.signalsService.getIdUSer()()) || null, comentario: '' };
  }

  async recordPayment(installment: any): Promise<void> {
    const amount = Number(this.abonoForm.monto);
    if (!this.abonoForm.fechaPago || !Number.isFinite(amount) || amount <= 0 || amount > this.installmentBalance(installment)) { alerts.basicAlert('Monto no válido', 'Captura un abono mayor a cero que no supere el saldo de la cuota.', 'warning'); return; }
    if (!this.abonoForm.idTipoPago) { alerts.basicAlert('Tipo de pago requerido', 'Selecciona cómo se recibió el abono.', 'warning'); return; }
    this.saving = true;
    try {
      await firstValueFrom(this.customersService.addCobranzaInstallmentPayment(installment.id, { fechaPago: this.abonoForm.fechaPago, monto: amount, idTipoPago: this.abonoForm.idTipoPago, idUsuarioCobrador: this.abonoForm.idUsuarioCobrador, comentario: this.abonoForm.comentario }));
      this.saving = false; this.activeInstallmentId = null; this.loadLoans();
    } catch (error: any) { console.error(error); this.saving = false; alerts.basicAlert('Error', error?.error?.error || 'No se pudo registrar el abono.', 'error'); }
  }

  async deactivatePayment(payment: any): Promise<void> {
    const result = await alerts.confirmAlert('Quitar abono', 'El abono se conservará inactivo en el historial.', 'warning', 'Sí, quitar');
    if (!result.isConfirmed) return;
    this.customersService.deactivateCobranzaInstallmentPayment(payment.id).subscribe({ next: () => this.loadLoans(), error: error => { console.error(error); alerts.basicAlert('Error', error?.error?.error || 'No se pudo quitar el abono.', 'error'); } });
  }
}
