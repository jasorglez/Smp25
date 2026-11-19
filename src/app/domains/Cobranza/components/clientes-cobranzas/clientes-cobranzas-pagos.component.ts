import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomersService } from 'app/services/customers.service';
import { alerts } from 'app/helpers/alerts';
import { firstValueFrom } from 'rxjs';
import { AgGridModule } from 'ag-grid-angular';
import { NgSelectModule } from '@ng-select/ng-select';
import { ColDef } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ButtonCellRendererExpenditureComponent } from 'app/domains/ModAdmon/components/egresos-palacio/button-cell-renderer-expenditure.component';
import { CatalogsService } from 'app/services/catalogs.service';
import { UsersService } from 'app/services/users.service';
import { SignalsService } from 'app/services/signals.service';
import { CajeroTurnoService } from 'app/services/cajero-turno.service';
import { PosTicketService } from 'app/services/pos-ticket.service';
import { PdfPreviewService } from 'app/services/pdf-preview.service';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';

@Component({
  selector: 'app-clientes-cobranzas-pagos',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, NgSelectModule, ButtonCellRendererExpenditureComponent],
  styles: [`
    :host ::ng-deep ng-select.cobranza-select {
      font-size: 0.75rem;
    }
    :host ::ng-deep ng-select.cobranza-select .ng-select-container {
      color: #174d80;
      background-color: #edf6ff;
      border: 1px solid #8ab8e4;
      border-radius: 0.5rem;
      min-height: 31px;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    :host ::ng-deep ng-select.cobranza-select.ng-select-focused .ng-select-container {
      border-color: #397fbe;
      box-shadow: 0 0 0 0.2rem rgba(57, 127, 190, 0.18);
    }
    :host ::ng-deep ng-select.cobranza-select .ng-arrow-wrapper .ng-arrow { border-color: #397fbe transparent transparent; }
    ::ng-deep .ng-dropdown-panel.cobranza-select {
      z-index: 1080;
      overflow: hidden;
      border: 1px solid #8ab8e4;
      border-radius: 0.5rem;
      box-shadow: 0 6px 18px rgba(28, 79, 130, 0.18);
      background: #f4f9ff;
      font-size: 0.75rem;
    }
    ::ng-deep .ng-dropdown-panel.cobranza-select .ng-option {
      padding: 7px 10px;
      color: #174d80;
      background: #f4f9ff;
    }
    ::ng-deep .ng-dropdown-panel.cobranza-select .ng-option.ng-option-marked,
    ::ng-deep .ng-dropdown-panel.cobranza-select .ng-option.ng-option-selected {
      color: #0c4172;
      background: #d9ecff;
    }
  `],
  template: `
    <section class="p-3 border-top bg-light">
      <div class="d-flex justify-content-between align-items-center gap-2 mb-3 flex-wrap">
        <div><strong>Préstamos — {{ customer?.nameContact || customer?.company }}</strong><span class="badge bg-success ms-2">Abonado: {{ totalPaid | currency:'MXN' }}</span><small class="text-muted ms-2"><i class="bi bi-arrow-repeat"></i> Actualización automática</small></div>
        <button class="btn btn-sm btn-primary" (click)="showLoanForm = !showLoanForm"><i class="bi bi-plus-lg"></i> Nuevo préstamo</button>
      </div>

      <div *ngIf="showLoanForm" class="card card-body mb-3 p-3">
        <div class="row g-2 align-items-end">
          <div class="col-md-3"><label class="form-label small">Monto del préstamo</label><input class="form-control form-control-sm" type="number" min="0.01" step="0.01" [(ngModel)]="loanForm.montoTotal"></div>
          <div class="col-md-3"><label class="form-label small">Interés fijo mensual (%)</label><input class="form-control form-control-sm" type="number" min="0" max="100" step="0.01" [(ngModel)]="loanForm.tasaInteresMensual"></div>
          <div class="col-md-3"><label class="form-label small">Fecha del préstamo</label><input class="form-control form-control-sm" type="date" [(ngModel)]="loanForm.fechaInicio"></div>
          <div class="col-md-3"><label class="form-label small">Primer pago</label><input class="form-control form-control-sm" type="date" [(ngModel)]="loanForm.fechaPrimerPago"></div>
          <div class="col-md-3"><label class="form-label small">Número de pagos mensuales</label><input class="form-control form-control-sm" type="number" min="1" step="1" [(ngModel)]="loanForm.numeroCuotas"></div>
          <div class="col-12"><label class="form-label small">Comentario</label><input class="form-control form-control-sm" maxlength="500" [(ngModel)]="loanForm.comentario"></div>
          <div class="col-12" *ngIf="loanPreviewRows.length">
            <div class="small mb-2">Capital: <strong>{{ money(loanCapital) }}</strong> · Interés total: <strong>{{ money(loanInterestTotal) }}</strong> · Total a pagar: <strong>{{ money(loanCapital + loanInterestTotal) }}</strong></div>
            <div class="table-responsive" style="max-height:220px"><table class="table table-sm table-bordered bg-white mb-0"><thead class="table-light"><tr><th>Pago</th><th>Fecha</th><th>Capital</th><th>Interés</th><th>Total</th></tr></thead><tbody><tr *ngFor="let row of loanPreviewRows"><td>{{ row.numero }}</td><td>{{ row.fecha | date:'dd/MM/yyyy' }}</td><td>{{ row.capital | currency:'MXN' }}</td><td>{{ row.interes | currency:'MXN' }}</td><td>{{ row.total | currency:'MXN' }}</td></tr></tbody></table></div>
          </div>
          <div class="col-12 d-flex gap-2"><button class="btn btn-sm btn-success" (click)="createLoan()" [disabled]="saving"><i class="bi bi-floppy"></i> Crear préstamo y calendario</button><button class="btn btn-sm btn-secondary" (click)="showLoanForm = false">Cancelar</button></div>
        </div>
      </div>

      <article *ngFor="let loan of loans" class="card mb-3">
        <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div><strong>Préstamo #{{ loan.id }}</strong><span class="ms-2">Capital {{ loan.montoTotal | currency:'MXN' }}</span><small class="text-muted ms-2">{{ loan.numeroCuotas || loan.cuotas?.length || 0 }} pagos desde {{ loan.fechaPrimerPago | date:'dd/MM/yyyy' }} · Interés {{ loan.tasaInteresMensual || 0 }}% mensual</small></div>
          <div class="d-flex align-items-center gap-2"><span class="badge" [class.bg-success]="loanBalance(loan) <= 0" [class.bg-warning]="loanBalance(loan) > 0">Saldo {{ loanBalance(loan) | currency:'MXN' }}</span>
            <button class="btn btn-sm btn-outline-primary" (click)="toggleLoanDetail(loan)" [attr.aria-expanded]="isLoanExpanded(loan)" [attr.aria-label]="(isLoanExpanded(loan) ? 'Ocultar' : 'Ver') + ' detalle del préstamo ' + loan.id"><i class="bi" [class.bi-chevron-down]="!isLoanExpanded(loan)" [class.bi-chevron-up]="isLoanExpanded(loan)"></i> {{ isLoanExpanded(loan) ? 'Ocultar detalle' : 'Ver detalle' }}</button>
            <button class="btn btn-sm btn-primary position-relative" (click)="saveChanges(loan)" [disabled]="saving || !hasChanges(loan)"><i class="bi bi-floppy"></i> Guardar<span *ngIf="hasChanges(loan)" class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"></span></button>
            <button class="btn btn-sm btn-warning" (click)="revertChanges(loan)" [disabled]="saving || !hasChanges(loan)"><i class="bi bi-arrow-clockwise"></i> Deshacer</button>
          </div>
        </div>
        <div class="card-body" *ngIf="isLoanExpanded(loan)"><div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2"><span class="small">Interés total: {{ loan.totalInteres || 0 | currency:'MXN' }} · A pagar: {{ payableTotal(loan) | currency:'MXN' }}</span><button class="btn btn-sm btn-outline-danger" (click)="generatePromissoryNote(loan)" title="Previsualizar el pagaré de este préstamo"><i class="bi bi-file-earmark-pdf"></i> PDF de este préstamo</button></div><ag-grid-angular class="ag-theme-quartz small-text-ag-grid d-block" style="width:100%;height:320px" [rowData]="loan.cuotas" [columnDefs]="installmentColumns" [defaultColDef]="defaultColDef" [localeText]="AG_GRID_LOCALE_ES" [rowSelection]="'single'" [stopEditingWhenCellsLoseFocus]="true" (cellValueChanged)="onDateChanged($event)"></ag-grid-angular>
          <div *ngFor="let installment of loan.cuotas"><div *ngIf="activeInstallmentId === installment.id" class="border rounded p-2 mt-2"><strong>Abonos de la cuota {{ installment.numeroCuota }}</strong><div class="row g-2 align-items-end py-2">
              <div class="col-md-2"><label class="form-label small">Fecha recibida</label><input class="form-control form-control-sm" type="date" [(ngModel)]="abonoForm.fechaPago"></div>
              <div class="col-md-2"><label class="form-label small">Monto recibido (saldo préstamo: {{ loanBalance(loan) | currency:'MXN' }})</label><input class="form-control form-control-sm" type="number" min="0.01" step="0.01" [max]="loanBalance(loan)" [(ngModel)]="abonoForm.monto"></div>
              <div class="col-md-2"><label class="form-label small" [for]="'cobranza-tipo-' + installment.id">Tipo de pago <button type="button" class="btn btn-link btn-sm p-0" (click)="addPaymentType()" [disabled]="savingPaymentType" title="Agregar tipo de pago"><i class="bi bi-plus-circle"></i></button></label><ng-select class="cobranza-select" [labelForId]="'cobranza-tipo-' + installment.id" [(ngModel)]="abonoForm.idTipoPago" [clearable]="false" [searchable]="false" appendTo="body" placeholder="Seleccionar" notFoundText="Sin tipos de pago"><ng-option *ngFor="let type of paymentTypes" [value]="type.id">{{ type.description }}</ng-option></ng-select></div>
              <div class="col-md-2"><label class="form-label small" [for]="'cobranza-responsable-' + installment.id">Responsable del cobro</label><ng-select class="cobranza-select" [labelForId]="'cobranza-responsable-' + installment.id" [(ngModel)]="abonoForm.idUsuarioCobrador" [clearable]="true" [searchable]="true" appendTo="body" placeholder="Sin asignar" notFoundText="Sin usuarios"><ng-option *ngFor="let user of users" [value]="user.id">{{ user.displayName || user.usersmall || user.email || ('Usuario ' + user.id) }}</ng-option></ng-select></div>
              <div class="col-md-2"><label class="form-label small" [for]="'cobranza-origen-' + installment.id">Recibido en</label><ng-select class="cobranza-select" [labelForId]="'cobranza-origen-' + installment.id" [(ngModel)]="abonoForm.origenCobro" [clearable]="false" [searchable]="false" appendTo="body"><ng-option value="DOMICILIO">Domicilio del cliente</ng-option><ng-option value="NEGOCIO">Caja del negocio</ng-option></ng-select></div>
              <div class="col-md-3" *ngIf="abonoForm.origenCobro === 'NEGOCIO'"><label class="form-label small" [for]="'cobranza-turno-' + installment.id">Turno abierto</label><ng-select class="cobranza-select" [labelForId]="'cobranza-turno-' + installment.id" [(ngModel)]="abonoForm.idCajeroTurno" [clearable]="false" [searchable]="false" appendTo="body" placeholder="Seleccionar caja abierta" notFoundText="Sin cajas abiertas"><ng-option *ngFor="let turn of openCashTurns" [value]="turn.id">Caja {{ turn.idCashRegister }} · {{ turn.fechaInicio | date:'shortTime' }}</ng-option></ng-select></div>
              <div class="col-md-2"><label class="form-label small">Comentario</label><input class="form-control form-control-sm" maxlength="500" [(ngModel)]="abonoForm.comentario"></div>
              <div class="col-md-2"><button class="btn btn-sm btn-success w-100" (click)="recordPayment(installment)" [disabled]="saving">Guardar abono</button></div>
            </div><div *ngIf="installment.abonos?.length" class="small mt-2"><strong>Abonos registrados:</strong><span *ngFor="let payment of installment.abonos" class="ms-2">{{ payment.fechaPago | date:'dd/MM/yyyy' }} — {{ payment.monto | currency:'MXN' }}<button class="btn btn-link btn-sm text-danger p-0 ms-1" (click)="deactivatePayment(payment)" title="Quitar abono"><i class="bi bi-x-circle"></i></button><span *ngIf="payment.comentario"> ({{ payment.comentario }})</span></span></div></div></div>
        </div>
      </article>
      <div *ngIf="!loading && !loans.length" class="text-center text-muted py-3">Sin préstamos registrados. Usa “Nuevo préstamo” para definir el número de pagos mensuales.</div>
    </section>
  `
})
export class ClientesCobranzasPagosComponent implements OnChanges, OnDestroy {
  @Input() customer: any;
  @Input() idCompany = 0;
  @Output() balancesChanged = new EventEmitter<void>();
  private customersService = inject(CustomersService);
  private catalogsService = inject(CatalogsService);
  private usersService = inject(UsersService);
  private signalsService = inject(SignalsService);
  private cajeroTurnoService = inject(CajeroTurnoService);
  private posTicket = inject(PosTicketService);
  private pdfPreview = inject(PdfPreviewService);
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);
  paymentTypes: any[] = [];
  savingPaymentType = false;
  private paymentTypesRequest = 0;
  private usersRequest = 0;
  private loanRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private refreshingLoans = false;
  users: any[] = [];
  openCashTurns: any[] = [];
  loans: any[] = [];
  expandedLoanIds = new Set<number>();
  loading = false;
  saving = false;
  showLoanForm = false;
  activeInstallmentId: number | null = null;
  loanForm: any = { montoTotal: null, tasaInteresMensual: 0, fechaInicio: this.today(), fechaPrimerPago: this.nextMonth(), numeroCuotas: 10, comentario: '' };
  abonoForm: any = { fechaPago: this.today(), monto: null, comentario: '' };
  AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  originalDates = new Map<number, string>();
  defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1 };
  installmentColumns: ColDef[] = [
    { field: 'numeroCuota', headerName: '#', width: 70, flex: 0, editable: false },
    { field: 'fechaProgramada', headerName: 'Fecha programada', editable: true, cellEditor: 'agDateStringCellEditor', cellDataType: 'dateString', minWidth: 170 },
    { field: 'montoCapital', headerName: 'Capital', editable: false, valueFormatter: p => this.money(p.value) },
    { field: 'montoInteres', headerName: 'Interés', editable: false, valueFormatter: p => this.money(p.value) },
    { field: 'montoProgramado', headerName: 'Pago total', editable: false, valueFormatter: p => this.money(p.value) },
    { headerName: 'Abonado', valueGetter: p => this.installmentPaid(p.data), valueFormatter: p => this.money(p.value) },
    { headerName: 'Saldo', valueGetter: p => this.installmentBalance(p.data), valueFormatter: p => this.money(p.value) },
    { headerName: 'Estado', valueGetter: p => this.installmentBalance(p.data) <= 0 ? 'Pagada' : 'Pendiente' },
    { headerName: 'Abonos', width: 110, flex: 0, sortable: false, filter: false, valueGetter: () => 'Abonos', cellRenderer: ButtonCellRendererExpenditureComponent, cellRendererParams: { onClick: (node: any) => this.toggleAbonoForm(node.data), icon: 'bi-cash-coin', title: 'Ver y registrar abonos de la cuota' } },
    { headerName: 'Borrar letra', width: 125, flex: 0, sortable: false, filter: false, valueGetter: () => 'Borrar', cellRendererSelector: params => this.canDeleteInstallment(params.data) ? { component: ButtonCellRendererExpenditureComponent, params: { icon: 'bi-trash', title: 'Borrar letra sin abonos de un préstamo liquidado', onClick: (node: any) => this.deactivateInstallment(node.data) } } : undefined }
  ];
  money(value: any): string { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value || 0)); }
  get loanCapital(): number { return Number(this.loanForm.montoTotal || 0); }
  get loanInterestTotal(): number { return Math.round(this.loanCapital * Number(this.loanForm.tasaInteresMensual || 0) * Number(this.loanForm.numeroCuotas || 0)) / 100; }
  get loanPreviewRows(): Array<{ numero: number; fecha: string; capital: number; interes: number; total: number }> {
    const capital = this.loanCapital, count = Number(this.loanForm.numeroCuotas), rate = Number(this.loanForm.tasaInteresMensual || 0);
    if (!(capital > 0) || !Number.isInteger(count) || count < 1 || !this.loanForm.fechaPrimerPago || rate < 0) return [];
    const regularCapital = Math.round(capital / count * 100) / 100;
    const regularInterest = Math.round(capital * rate) / 100;
    const totalInterest = Math.round(capital * rate * count) / 100;
    let capitalScheduled = 0, interestScheduled = 0;
    return Array.from({ length: count }, (_, index) => {
      const amountCapital = index === count - 1 ? Math.round((capital - capitalScheduled) * 100) / 100 : regularCapital;
      const amountInterest = index === count - 1 ? Math.round((totalInterest - interestScheduled) * 100) / 100 : regularInterest;
      capitalScheduled += amountCapital; interestScheduled += amountInterest;
      const first = new Date(`${this.loanForm.fechaPrimerPago}T12:00:00`);
      const date = new Date(first.getFullYear(), first.getMonth() + index, Math.min(first.getDate(), new Date(first.getFullYear(), first.getMonth() + index + 1, 0).getDate()));
      return { numero: index + 1, fecha: this.formatDate(date), capital: amountCapital, interes: amountInterest, total: amountCapital + amountInterest };
    });
  }
  payableTotal(loan: any): number { return (loan.cuotas || []).reduce((sum: number, item: any) => sum + Number(item.montoProgramado || 0), 0); }
  onDateChanged(event: any): void { if (!/^\d{4}-\d{2}-\d{2}$/.test(event.newValue || '')) { event.node.setDataValue('fechaProgramada', event.oldValue); alerts.basicAlert('Fecha inválida', 'Selecciona una fecha válida.', 'warning'); } }
  hasChanges(loan: any): boolean { return (loan.cuotas || []).some((item: any) => item.fechaProgramada !== this.originalDates.get(item.id)); }
  revertChanges(loan: any): void { loan.cuotas = loan.cuotas.map((item: any) => ({ ...item, fechaProgramada: this.originalDates.get(item.id) })); }
  async saveChanges(loan: any): Promise<void> { const changed = loan.cuotas.filter((item: any) => item.fechaProgramada !== this.originalDates.get(item.id)); if (!changed.length) return; this.saving = true; try { for (const item of changed) await firstValueFrom(this.customersService.updateCobranzaInstallmentDate(item.id, { fechaProgramada: item.fechaProgramada })); this.saving = false; this.loadLoans(); this.balancesChanged.emit(); alerts.basicAlert('Fechas guardadas', 'Se actualizó el calendario de pagos.', 'success'); } catch (error) { console.error(error); this.saving = false; alerts.basicAlert('Error', 'No se pudieron guardar todas las fechas. Recarga el detalle para revisar cuáles se guardaron.', 'error'); } }

  get totalPaid(): number { return this.loans.reduce((sum, loan) => sum + loan.cuotas.reduce((s: number, q: any) => s + this.installmentPaid(q), 0), 0); }
  isLoanExpanded(loan: any): boolean { return this.expandedLoanIds.has(Number(loan?.id)); }
  toggleLoanDetail(loan: any): void {
    const id = Number(loan?.id);
    if (!id) return;
    if (this.expandedLoanIds.has(id)) this.expandedLoanIds.delete(id);
    else this.expandedLoanIds.add(id);
  }
  ngOnChanges(): void {
    this.loadLoans(); this.loadPaymentTypes(); this.loadUsers(); this.loadOpenCashTurns();
    if (!this.loanRefreshTimer) this.loanRefreshTimer = setInterval(() => void this.refreshLoansIfChanged(), 5000);
  }
  ngOnDestroy(): void { if (this.loanRefreshTimer) clearInterval(this.loanRefreshTimer); }
  private get paymentCompanyId(): number {
    return [this.customer?.idRoot, this.idCompany, this.signalsService.getRootSelectedBySidebar()()]
      .map(value => Number(value)).find(value => Number.isInteger(value) && value > 0) || 0;
  }

  async loadPaymentTypes(): Promise<boolean> {
    const companyId = this.paymentCompanyId;
    const request = ++this.paymentTypesRequest;
    if (!companyId) { this.paymentTypes = []; return false; }
    try {
      const types = await firstValueFrom(this.catalogsService.getCatalogsFromAdmon(companyId, 'COBRO_PAGO'));
      if (request !== this.paymentTypesRequest || companyId !== this.paymentCompanyId) return false;
      this.paymentTypes = Array.isArray(types) ? types : [];
      return true;
    } catch (error: any) {
      if (request !== this.paymentTypesRequest) return false;
      this.paymentTypes = [];
      if (error?.status === 404) return true;
      console.error('Error al cargar los tipos de pago:', error);
      alerts.basicAlert('Error', 'No se pudieron cargar los tipos de pago de la empresa.', 'error');
      return false;
    }
  }

  async addPaymentType(): Promise<void> {
    if (this.savingPaymentType) return;
    const companyId = this.paymentCompanyId;
    if (!companyId) { alerts.basicAlert('Empresa requerida', 'Selecciona una empresa antes de agregar un tipo de pago.', 'warning'); return; }
    const result = await alerts.inputAlert('Nuevo tipo de pago', 'Nombre del medio de pago', 'text', '', { inputAttributes: { maxlength: '100' } });
    if (!result.isConfirmed || companyId !== this.paymentCompanyId) return;
    const name = String(result.value || '').trim().toUpperCase();
    if (!name) return;
    if (this.paymentTypes.some(type => String(type.description || '').trim().toUpperCase() === name)) { alerts.basicAlert('Tipo existente', 'Ese tipo de pago ya está en el catálogo.', 'info'); return; }
    this.savingPaymentType = true;
    try {
      const response: any = await firstValueFrom(this.catalogsService.addCatalogToAdmon({ idCompany: companyId, description: name, type: 'COBRO_PAGO', active: 1 }));
      if (companyId !== this.paymentCompanyId) return;
      const loaded = await this.loadPaymentTypes();
      if (!loaded) { alerts.basicAlert('Tipo guardado', 'El tipo de pago se guardó, pero no se pudo actualizar la lista. Vuelve a abrir el detalle.', 'warning'); return; }
      const saved = this.paymentTypes.find(type => Number(type.id) === Number(response?.id));
      this.abonoForm.idTipoPago = saved?.id ?? null;
      alerts.basicAlert('Tipo agregado', 'El medio de pago quedó disponible para esta empresa.', 'success');
    } catch (error) { console.error(error); alerts.basicAlert('Error', 'No se pudo agregar el tipo de pago.', 'error'); }
    finally { this.savingPaymentType = false; }
  }
  loadUsers(): void {
    const companyId = this.paymentCompanyId;
    const request = ++this.usersRequest;
    this.users = [];
    if (!companyId) return;
    this.usersService.get2fieldsUsers(companyId).subscribe({
      next: (result: any) => {
        if (request !== this.usersRequest || companyId !== this.paymentCompanyId) return;
        if (result?.status === false) {
          alerts.basicAlert('Error', 'No se pudieron cargar los usuarios de la empresa.', 'error');
          return;
        }
        this.users = (Array.isArray(result?.data) ? result.data : [])
          .slice().sort((a: any, b: any) => String(a.displayName || a.usersmall || a.email || '').localeCompare(String(b.displayName || b.usersmall || b.email || ''), 'es'));
        if (this.abonoForm.idUsuarioCobrador && !this.users.some(user => Number(user.id) === Number(this.abonoForm.idUsuarioCobrador))) {
          this.abonoForm.idUsuarioCobrador = null;
        }
      },
      error: error => {
        if (request !== this.usersRequest) return;
        console.error('Error al cargar los responsables del cobro:', error);
        alerts.basicAlert('Error', 'No se pudieron cargar los usuarios de la empresa.', 'error');
      }
    });
  }
  loadOpenCashTurns(): void { const rootId = this.paymentCompanyId; if (!rootId) { this.openCashTurns = []; return; } const cashier = 'COBRANZA: ' + Number(this.signalsService.getIdUSer()()); this.cajeroTurnoService.getByCompany(rootId).subscribe({ next: (items: any[]) => this.openCashTurns = (items || []).filter(item => item.active && !item.fechaCierre && String(item.cajero || '') === cashier), error: () => this.openCashTurns = [] }); }
  private today(): string { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  private nextMonth(): string { const date = new Date(); const day = date.getDate(); date.setDate(1); date.setMonth(date.getMonth() + 1); const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(); date.setDate(Math.min(day, lastDay)); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  private dateForInput(value: string | Date): string { return typeof value === 'string' ? value.slice(0, 10) : this.formatDate(value); }
  private formatDate(value: Date): string { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
  installmentPaid(item: any): number { return Number.isFinite(Number(item?.montoAplicado)) ? Number(item.montoAplicado) : (item.abonos || []).filter((p: any) => p.active !== false).reduce((sum: number, p: any) => sum + Number(p.monto || 0), 0); }
  installmentBalance(item: any): number { return Math.max(0, Number(item.montoProgramado || 0) - this.installmentPaid(item)); }
  loanTotalPaid(loan: any): number { return (loan.cuotas || []).reduce((sum: number, item: any) => sum + (item.abonos || []).filter((payment: any) => payment.active !== false).reduce((part: number, payment: any) => part + Number(payment.monto || 0), 0), 0); }
  loanBalance(loan: any): number { return Math.max(0, this.payableTotal(loan) - this.loanTotalPaid(loan)); }
  canDeleteInstallment(item: any): boolean {
    const loan = this.loans.find(current => Number(current.id) === Number(item?.idPrestamo));
    return !!loan && this.loanBalance(loan) <= 0 && !(item.abonos || []).some((payment: any) => payment.active !== false);
  }

  loadLoans(): void {
    if (!this.customer?.id) { this.loans = []; return; }
    this.loading = true;
    this.customersService.getCobranzaLoans(this.customer.id).subscribe({
      next: (items: any[]) => { this.setLoans(items); this.loading = false; },
      error: error => { console.error(error); this.loading = false; alerts.basicAlert('Error', 'No se pudieron cargar los préstamos.', 'error'); }
    });
  }

  private setLoans(items: any[]): void {
    this.loans = (items || []).map(loan => ({ ...loan, cuotas: (loan.cuotas || []).map((installment: any) => ({ ...installment, fechaProgramada: this.dateForInput(installment.fechaProgramada) })) }));
    this.originalDates.clear();
    this.loans.forEach(loan => loan.cuotas.forEach((item: any) => this.originalDates.set(item.id, item.fechaProgramada)));
  }

  private async refreshLoansIfChanged(): Promise<void> {
    const customerId = Number(this.customer?.id);
    if (!customerId || document.hidden || this.loading || this.saving || this.refreshingLoans || this.showLoanForm || this.activeInstallmentId !== null || this.loans.some(loan => this.hasChanges(loan))) return;
    this.refreshingLoans = true;
    try {
      const items = await firstValueFrom(this.customersService.getCobranzaLoans(customerId));
      if (Number(this.customer?.id) !== customerId) return;
      const updatedLoans = (items || []).map(loan => ({ ...loan, cuotas: (loan.cuotas || []).map((installment: any) => ({ ...installment, fechaProgramada: this.dateForInput(installment.fechaProgramada) })) }));
      if (JSON.stringify(updatedLoans) === JSON.stringify(this.loans)) return;
      this.setLoans(items);
      this.balancesChanged.emit();
    } catch (error) {
      console.warn('No se pudo sincronizar Cobranza automáticamente:', error);
    } finally {
      this.refreshingLoans = false;
    }
  }

  async createLoan(): Promise<void> {
    const amount = Number(this.loanForm.montoTotal);
    const monthlyRate = Number(this.loanForm.tasaInteresMensual || 0);
    const numberOfPayments = Number(this.loanForm.numeroCuotas);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(monthlyRate) || monthlyRate < 0 || monthlyRate > 100 || !Number.isInteger(numberOfPayments) || numberOfPayments < 1 || !this.loanForm.fechaInicio || !this.loanForm.fechaPrimerPago) { alerts.basicAlert('Datos requeridos', 'Captura un capital mayor a cero, interés mensual entre 0 y 100%, número de pagos entero mayor a cero y fechas válidas.', 'warning'); return; }
    this.saving = true;
    try {
      const saved: any = await firstValueFrom(this.customersService.createCobranzaLoan({ idCustomer: this.customer.id, montoTotal: amount, tasaInteresMensual: monthlyRate, fechaInicio: this.loanForm.fechaInicio, fechaPrimerPago: this.loanForm.fechaPrimerPago, numeroCuotas: numberOfPayments, comentario: this.loanForm.comentario }));
      this.saving = false; this.showLoanForm = false; this.loanForm = { montoTotal: null, tasaInteresMensual: 0, fechaInicio: this.today(), fechaPrimerPago: this.nextMonth(), numeroCuotas: 10, comentario: '' }; this.balancesChanged.emit();
      let createdLoan = saved;
      try {
        const refreshed = await firstValueFrom(this.customersService.getCobranzaLoans(this.customer.id));
        this.setLoans(refreshed);
        createdLoan = refreshed.find((loan: any) => Number(loan.id) === Number(saved?.id)) || refreshed.sort((a: any, b: any) => Number(b.id) - Number(a.id))[0] || saved;
      } catch (refreshError) {
        console.warn('El préstamo se guardó, pero no se actualizó el listado:', refreshError);
        if (saved) this.setLoans([...this.loans, saved]);
      }
      if (createdLoan?.id) this.expandedLoanIds.add(Number(createdLoan.id));
    } catch (error: any) { console.error(error); this.saving = false; alerts.basicAlert('Error', error?.error?.error || 'No se pudo crear el préstamo y su calendario de pagos.', 'error'); }
  }

  async generatePromissoryNote(loan: any): Promise<void> {
    try {
      const pdfMake = (await import('pdfmake/build/pdfmake')).default;
      const pdfFonts = await import('pdfmake/build/vfs_fonts');
      (pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;
      const company: any = await firstValueFrom(this.rootService.getRootbyId(this.paymentCompanyId));
      const logo = company?.picture ? await this.base64EncodeService.convertImageToBase64(company.picture) : null;
      const logo2 = company?.picture2 ? await this.base64EncodeService.convertImageToBase64(company.picture2) : null;
      const money = (value: any) => this.money(value);
      const date = (value: any) => value ? String(value).slice(0, 10).split('-').reverse().join('/') : '';
      const installments = [...(loan.cuotas || [])].sort((a: any, b: any) => a.numeroCuota - b.numeroCuota);
      const principal = Number(loan.montoTotal || 0);
      const interest = Number(loan.totalInteres ?? installments.reduce((sum: number, item: any) => sum + Number(item.montoInteres || 0), 0));
      const due = installments.reduce((sum: number, item: any) => sum + Number(item.montoProgramado || 0), 0);
      const receiptFolio = `PR-${String(loan.id).padStart(6, '0')}`;
      const navy = '#00003F';
      const gray = '#D3D3D3';
      const grid = { hLineWidth: () => 0.6, vLineWidth: () => 0.6, hLineColor: () => navy, vLineColor: () => navy, paddingLeft: () => 5, paddingRight: () => 5, paddingTop: () => 4, paddingBottom: () => 4 };
      const scheduleGrid = { ...grid, paddingLeft: () => 3, paddingRight: () => 3, paddingTop: () => 1, paddingBottom: () => 1 };
      const scheduleFontSize = installments.length > 16 ? 6.5 : installments.length > 10 ? 7 : 7.5;
      const customerName = this.customer?.nameContact || this.customer?.company || `Cliente #${this.customer?.id || loan.idCustomer}`;
      const customerAddress = [this.customer?.address, this.customer?.neighborhood, this.customer?.city, this.customer?.state, this.customer?.cp ? `C.P. ${this.customer.cp}` : ''].filter(Boolean).join(', ');
      const companyAddress = [company?.address, company?.city, company?.state, company?.cp ? `C.P. ${company.cp}` : ''].filter(Boolean).join(', ');
      const serviceRows: any[][] = [[
        ...['CANT', 'UNIDAD', 'CÓDIGO', 'DESCRIPCIÓN', 'P.UNITARIO', 'D1', 'D2', 'D3', 'IMPORTE'].map(label => ({ text: label, bold: true, color: '#FFFFFF', fillColor: navy, alignment: ['P.UNITARIO', 'IMPORTE'].includes(label) ? 'right' : 'center', fontSize: 7.5 })),
      ], [
        { text: '1', alignment: 'center' }, { text: 'SER', alignment: 'center' }, { text: String(loan.id), alignment: 'center' },
        { text: `PRÉSTAMO · Capital ${money(principal)} · ${Number(loan.tasaInteresMensual || 0)}% mensual`, bold: true },
        { text: money(principal), alignment: 'right' }, { text: `${Number(loan.tasaInteresMensual || 0)}%`, alignment: 'center' },
        { text: `${installments.length} pagos`, alignment: 'center' }, { text: '—', alignment: 'center' },
        { text: money(due), alignment: 'right', bold: true },
      ]];
      const rows: any[][] = [[
        ...['PAGO', 'FECHA', 'CAPITAL', 'INTERÉS', 'IMPORTE'].map((label, index) => ({ text: label, bold: true, color: '#FFFFFF', fillColor: navy, alignment: index > 1 ? 'right' : 'center', fontSize: 8 })),
      ]];
      for (const item of installments) rows.push([
        { text: String(item.numeroCuota), alignment: 'center' }, date(item.fechaProgramada),
        { text: money(item.montoCapital ?? item.montoProgramado), alignment: 'right' },
        { text: money(item.montoInteres || 0), alignment: 'right' },
        { text: money(item.montoProgramado), alignment: 'right', bold: true },
      ]);
      const text = (value: any) => String(value || '').trim();
      const content: any[] = [
        { columns: [logo ? { image: logo, fit: [72, 58] } : { text: text(company?.name), bold: true, fontSize: 12, color: navy, margin: [0, 12, 0, 0] }, { text: `${text(company?.name)}${companyAddress ? `\n${companyAddress}` : ''}${company?.phone ? `\nTEL.: ${company.phone}` : ''}${company?.rfc ? `\nR.F.C.: ${company.rfc}` : ''}`, alignment: 'center', fontSize: 8, margin: [0, 8, 0, 0] }, logo2 ? { image: logo2, fit: [60, 50], alignment: 'right' } : { text: '' }, { table: { widths: ['*'], body: [[{ text: 'N° NOTA DE VENTA', bold: true, color: '#FFFFFF', fillColor: navy, alignment: 'center' }], [{ text: 'SERIE-FOLIO', bold: true, alignment: 'center', fontSize: 8 }], [{ text: receiptFolio, bold: true, alignment: 'center', fontSize: 13 }], [{ text: 'FECHA Y HORA DE EMISIÓN', bold: true, alignment: 'center', fontSize: 7 }], [{ text: `${date(loan.fechaInicio)}  ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`, alignment: 'center', fontSize: 8 }]] }, layout: grid }], columnGap: 5, margin: [0, 0, 0, 12] },
        { table: { widths: ['*'], body: [[{ text: 'CLIENTE:', bold: true, color: '#FFFFFF', fillColor: navy, fontSize: 9 }], [{ columns: [{ width: '60%', stack: [{ text: customerName, bold: true }, ...(this.customer?.rfc ? [{ text: `R.F.C.: ${this.customer.rfc}` }] : []), ...(customerAddress ? [{ text: customerAddress }] : [])] }, { width: '40%', stack: [...(this.customer?.phone ? [{ text: `Teléfono: ${this.customer.phone}` }] : []), { text: `Vendedor: ${text(company?.name)}` }, { text: `Observaciones: Préstamo #${loan.id}` }] }], fillColor: gray, margin: [6, 6, 6, 6] }]] }, layout: grid, margin: [0, 0, 0, 7] },
        { table: { headerRows: 1, widths: [28, 40, 40, '*', 60, 34, 47, 26, 68], body: serviceRows }, layout: grid, fontSize: 8 },
        { table: { widths: ['*'], body: [[{ text: 'DETALLE DE PAGOS', bold: true, color: '#FFFFFF', fillColor: navy, fontSize: 8 }]] }, layout: grid, margin: [0, 7, 0, 0] },
        { table: { headerRows: 1, widths: [42, 78, '*', '*', '*'], body: rows }, layout: scheduleGrid, fontSize: scheduleFontSize },
        { table: { widths: ['68%', '32%'], body: [[
          { stack: [{ text: 'PAGO EN PARCIALIDADES', bold: true }, { text: 'MÉTODO DE PAGO: POR DEFINIR' }, { text: `CONDICIONES DE PAGO: CRÉDITO A ${installments.length} ${installments.length === 1 ? 'PAGO' : 'PAGOS'}` }, { text: `PRIMER PAGO: ${date(installments[0]?.fechaProgramada)}` }] , fillColor: '#FFFFFF', margin: [6, 7, 6, 7] },
          { table: { widths: ['*', 'auto'], body: [[{ text: 'TOTAL', bold: true, color: '#FFFFFF', fillColor: navy, colSpan: 2, alignment: 'center' }, {}], [{ text: 'CAPITAL:' }, { text: money(principal), alignment: 'right' }], [{ text: `INTERÉS (${Number(loan.tasaInteresMensual || 0)}% mensual):` }, { text: money(interest), alignment: 'right' }], [{ text: 'TOTAL A PAGAR:', bold: true }, { text: money(due), alignment: 'right', bold: true }]].map(row => row.map(cell => Object.keys(cell).length ? { ...cell, fillColor: cell.fillColor || gray } : cell)) }, layout: grid, fontSize: 8 },
        ]] }, layout: { hLineWidth: () => 0, vLineWidth: () => 0 }, margin: [0, 7, 0, 7] },
        { text: `CANTIDAD CON LETRA: (${this.amountInWords(due)} PESOS ${String(Math.round((due - Math.floor(due)) * 100)).padStart(2, '0')}/100 M.N.)`, bold: true, margin: [3, 2, 3, 8], fontSize: 8 },
        { table: { widths: ['*'], body: [
          [{ text: `PAGARÉ: BUENO POR ${money(due)}`, bold: true, color: '#FFFFFF', fillColor: navy, alignment: 'center', fontSize: 10 }],
          [{ text: `LUGAR Y FECHA: ${text(company?.city || company?.location || '')} ${date(loan.fechaInicio)}\n\nPOR ESTE PAGARÉ PROMETO INCONDICIONALMENTE PAGAR A LA ORDEN DE ${text(company?.name) || '________________'} LA CANTIDAD DE ${money(due)} (${this.amountInWords(due)} PESOS ${String(Math.round((due - Math.floor(due)) * 100)).padStart(2, '0')}/100 M.N.) CONFORME AL CALENDARIO DE PAGOS. El capital prestado es ${money(principal)} y genera un interés ordinario fijo de ${Number(loan.tasaInteresMensual || 0)}% mensual, calculado sobre el capital original; este interés está desglosado por pago en la nota. El vencimiento final es el ${date(installments[installments.length - 1]?.fechaProgramada)}. En caso de incumplimiento, se aplicará una tasa moratoria del 3% mensual sobre los saldos insolutos vencidos, desde la fecha de incumplimiento y hasta el pago total, sin que por ello se entienda prorrogado el plazo.\n\nNOMBRE Y DATOS DEL DEUDOR:\nNOMBRE: ${customerName}${customerAddress ? `\nDIRECCIÓN: ${customerAddress}` : ''}${this.customer?.phone ? `\nTELÉFONO: ${this.customer.phone}` : ''}\n\nACEPTO (AMOS)\n\n____________________________________________`, fillColor: gray, alignment: 'justify', margin: [8, 5, 8, 5], fontSize: 7.5 }],
        ] }, layout: grid, margin: [0, 0, 0, 0] },
      ];
      await this.pdfPreview.show((pdfMake as any).createPdf({ pageSize: 'LETTER', pageMargins: [20, 14, 20, 16], background: () => ({ canvas: [{ type: 'rect', x: 0, y: 0, w: 612, h: 792, color: '#FFFFFF' }] }), content, defaultStyle: { font: 'Roboto', fontSize: 7.5 } }), `Nota de venta y pagaré #${loan.id}`, `Nota_venta_pagare_${loan.id}.pdf`);
    } catch (error) {
      console.error('No se pudo generar el pagaré:', error);
      alerts.basicAlert('Préstamo guardado', 'El préstamo se guardó, pero no se pudo generar el pagaré PDF.', 'warning');
    }
  }

  private amountInWords(value: number): string {
    const whole = Math.floor(Math.max(0, value));
    if (whole === 0) return 'CERO';
    const units = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const tens = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const underTwenty = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const hundreds = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
    const group = (n: number): string => {
      if (n === 100) return 'CIEN';
      const h = Math.floor(n / 100), rest = n % 100;
      let result = hundreds[h];
      if (rest >= 10 && rest < 20) return [result, underTwenty[rest - 10]].filter(Boolean).join(' ');
      const t = Math.floor(rest / 10), u = rest % 10;
      const tenText = t === 2 && u ? `VEINTI${units[u].toLowerCase()}`.toUpperCase() : t > 2 && u ? `${tens[t]} Y ${units[u]}` : tens[t] || units[u];
      return [result, tenText].filter(Boolean).join(' ');
    };
    const millions = Math.floor(whole / 1_000_000), thousands = Math.floor((whole % 1_000_000) / 1000), remainder = whole % 1000;
    const parts = [];
    if (millions) parts.push(millions === 1 ? 'UN MILLÓN' : `${group(millions)} MILLONES`);
    if (thousands) parts.push(thousands === 1 ? 'MIL' : `${group(thousands)} MIL`);
    if (remainder) parts.push(group(remainder));
    return parts.join(' ');
  }

  toggleAbonoForm(installment: any): void {
    const opening = this.activeInstallmentId !== installment.id;
    this.activeInstallmentId = opening ? installment.id : null;
    const currentUserId = Number(this.signalsService.getIdUSer()());
    this.abonoForm = { fechaPago: this.today(), monto: opening ? this.installmentBalance(installment) : null, idTipoPago: this.paymentTypes[0]?.id ?? null, idUsuarioCobrador: this.users.some(user => Number(user.id) === currentUserId) ? currentUserId : null, origenCobro: 'DOMICILIO', idCajeroTurno: null, comentario: '' };
    if (this.activeInstallmentId !== null) { void this.loadPaymentTypes(); this.loadUsers(); }
  }

  async recordPayment(installment: any): Promise<void> {
    const amount = Number(this.abonoForm.monto);
    const loan = this.loans.find(item => Number(item.id) === Number(installment.idPrestamo));
    const loanBalance = loan ? this.loanBalance(loan) : 0;
    if (!this.abonoForm.fechaPago || !Number.isFinite(amount) || amount <= 0 || amount > loanBalance) { alerts.basicAlert('Monto no válido', `Captura un monto mayor a cero que no supere el saldo del préstamo (${this.money(loanBalance)}).`, 'warning'); return; }
    if (!this.abonoForm.idTipoPago) { alerts.basicAlert('Tipo de pago requerido', 'Selecciona cómo se recibió el abono.', 'warning'); return; }
    if (this.abonoForm.origenCobro === 'NEGOCIO' && !this.abonoForm.idCajeroTurno) { alerts.basicAlert('Caja requerida', 'Abre y selecciona una caja de cobranza para registrar este pago.', 'warning'); return; }
    this.saving = true;
    let saved: any;
    try {
      saved = await firstValueFrom(this.customersService.addCobranzaInstallmentPayment(installment.id, { fechaPago: this.abonoForm.fechaPago, monto: amount, idTipoPago: this.abonoForm.idTipoPago, idUsuarioCobrador: this.abonoForm.idUsuarioCobrador, origenCobro: this.abonoForm.origenCobro, idCajeroTurno: this.abonoForm.origenCobro === 'NEGOCIO' ? this.abonoForm.idCajeroTurno : null, comentario: this.abonoForm.comentario }));
    } catch (error: any) { console.error(error); this.saving = false; alerts.basicAlert('Error', error?.error?.error || 'No se pudo registrar el abono.', 'error'); return; }
    try {
      await this.posTicket.printCobranza({ id: saved?.id, fecha: this.abonoForm.fechaPago, monto: amount, saldoPendiente: Math.max(0, loanBalance - amount), tipoPago: this.paymentTypes.find(item => item.id === this.abonoForm.idTipoPago)?.description || 'Pago', cliente: this.customer?.nameContact || this.customer?.company || 'Cliente', prestamo: installment.idPrestamo, cuota: installment.numeroCuota, origen: this.abonoForm.origenCobro, empresaId: this.paymentCompanyId });
    } catch (error) {
      console.error('El abono se guardó, pero no se pudo abrir el ticket:', error);
      alerts.basicAlert('Abono guardado', 'El abono se guardó, pero no se pudo abrir el ticket.', 'warning');
    } finally {
      this.saving = false; this.activeInstallmentId = null; this.loadLoans(); this.balancesChanged.emit();
    }
  }

  async deactivatePayment(payment: any): Promise<void> {
    const result = await alerts.confirmAlert('Quitar abono', 'El abono se conservará inactivo en el historial.', 'warning', 'Sí, quitar');
    if (!result.isConfirmed) return;
    this.customersService.deactivateCobranzaInstallmentPayment(payment.id).subscribe({ next: () => { this.loadLoans(); this.balancesChanged.emit(); }, error: error => { console.error(error); alerts.basicAlert('Error', error?.error?.error || 'No se pudo quitar el abono.', 'error'); } });
  }

  async deactivateInstallment(installment: any): Promise<void> {
    const result = await alerts.confirmAlert('Borrar letra', `La letra ${installment.numeroCuota} no tiene abonos y el préstamo está liquidado. Se conservará inactiva en el historial.`, 'warning', 'Sí, borrar');
    if (!result.isConfirmed) return;
    this.customersService.deactivateCobranzaInstallment(installment.id).subscribe({
      next: () => { this.loadLoans(); this.balancesChanged.emit(); },
      error: error => { console.error(error); alerts.basicAlert('Error', error?.error?.error || 'No se pudo borrar la letra.', 'error'); }
    });
  }
}
