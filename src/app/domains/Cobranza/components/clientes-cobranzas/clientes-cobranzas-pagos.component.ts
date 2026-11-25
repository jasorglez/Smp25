import { navigateEditableCellOnEnter } from 'app/helpers/ag-grid-enter-navigation';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { LoanInstallmentsDetailComponent } from './loan-installments-detail.component';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, TemplateRef, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomersService } from 'app/services/customers.service';
import { alerts } from 'app/helpers/alerts';
import { firstValueFrom } from 'rxjs';
import { AgGridModule } from 'ag-grid-angular';
import { NgSelectModule } from '@ng-select/ng-select';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
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
import { ConsecutivosService, ConsecutivoConfig } from 'app/services/consecutivos.service';
import { CobranzaOfflineService } from 'app/services/cobranza-offline.service';

@Component({
  selector: 'app-clientes-cobranzas-pagos',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, NgSelectModule, ButtonCellRendererExpenditureComponent],
  styles: [`
    :host ::ng-deep .ag-cell-focus { background-color: #fff3a3 !important; }
    :host ::ng-deep .cobranza-compact-modal .modal-content { border: 0; border-radius: 14px; box-shadow: 0 18px 50px rgba(15, 35, 72, 0.22); overflow: hidden; }
    :host ::ng-deep .cobranza-compact-modal .modal-header { align-items: start; padding: 13px 18px; color: #fff; border: 0; background: linear-gradient(120deg, #12294b 0%, #195793 100%); }
    :host ::ng-deep .cobranza-compact-modal .modal-title { font-weight: 600; }
    :host ::ng-deep .cobranza-compact-modal .modal-title small { color: #d5e8f8 !important; }
    :host ::ng-deep .cobranza-compact-modal .btn-close { filter: invert(1) grayscale(100%) brightness(200%); }
    :host ::ng-deep .cobranza-compact-modal .modal-body { max-height: min(70vh, 660px); overflow-y: auto; padding: 15px 18px; background: #f6f8fc; }
    :host ::ng-deep .cobranza-compact-modal .form-control, :host ::ng-deep .cobranza-compact-modal .form-select { border-color: #d8e1ec; border-radius: 7px; }
    :host ::ng-deep .cobranza-compact-modal .form-control:focus, :host ::ng-deep .cobranza-compact-modal .form-select:focus { border-color: #3c88ca; box-shadow: 0 0 0 3px rgba(45, 126, 196, 0.13); }
    :host ::ng-deep .cobranza-compact-modal .modal-footer { padding: 12px 18px; border-top: 1px solid #e5ebf2; background: #fff; }
    :host ::ng-deep .cobranza-compact-modal .form-label { margin-bottom: 0.2rem; }
    :host ::ng-deep .cobranza-compact-modal .form-control, :host ::ng-deep .cobranza-compact-modal .form-select { min-height: 32px; font-size: 0.82rem; }
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
    <section class="p-3 border-top bg-light" [attr.aria-busy]="saving">
      <div class="d-flex justify-content-between align-items-center gap-2 mb-3 flex-wrap">
        <div><strong>Préstamos — {{ customer?.nameContact || customer?.company }}</strong><span class="badge bg-success ms-2">Abonado: {{ totalPaid | currency:'MXN' }}</span><small class="text-muted ms-2"><i class="bi bi-arrow-repeat"></i> Actualización automática</small></div>
        <button class="btn btn-sm btn-primary" (click)="beginNewLoan()" [disabled]="reservingLoanFolio || saving || hasPendingEdits"><i class="bi" [class.bi-plus-lg]="!reservingLoanFolio" [class.bi-hourglass-split]="reservingLoanFolio"></i> {{ reservingLoanFolio ? 'Preparando folio…' : 'Nuevo préstamo' }}</button>
      </div>

      <div class="d-flex align-items-center gap-3 flex-wrap mb-3">
        <label class="small mb-0">Préstamos
          <select class="form-select form-select-sm" [(ngModel)]="loanFilter" (ngModelChange)="applyLoanFilter()" [disabled]="saving || hasPendingEdits">
            <option value="ALL">Todos</option><option value="BALANCE">Con saldo</option><option value="OVERDUE">Con atraso</option><option value="PAID">Liquidados</option>
          </select>
        </label>
        <label class="form-check-label small"><input class="form-check-input me-2" type="checkbox" [(ngModel)]="autoShowInstallments" (ngModelChange)="setAutomaticDetails()" [disabled]="saving || hasPendingEdits">Mostrar cuotas automáticamente</label>
        <span class="small text-muted">{{ visibleLoans.length }} de {{ loans.length }} préstamos · Selecciona Abonos en una cuota para consultar o registrar pagos.</span>
      </div>
      <div *ngIf="loading" class="small text-muted mb-2" role="status">Actualizando préstamos…</div>
      <ag-grid-angular class="ag-theme-quartz d-block" style="width:100%;height:650px"
        [rowData]="visibleLoans" [columnDefs]="loanColumns" [defaultColDef]="defaultColDef" [localeText]="AG_GRID_LOCALE_ES"
        [getRowId]="rowId" [masterDetail]="true" [detailRowAutoHeight]="true" [isRowMaster]="isRowMaster"
        [detailCellRenderer]="loanDetailRenderer" [detailCellRendererParams]="loanDetailParams"
        (gridReady)="onLoanGridReady($event)" (firstDataRendered)="restoreExpandedLoans()" (rowDataUpdated)="restoreExpandedLoans()"
        (rowGroupOpened)="onLoanExpansion($event)" [overlayNoRowsTemplate]="noLoansMessage">
      </ag-grid-angular>
      <ng-template #installmentsTemplate let-loan>
        <div class="p-2 bg-light">
          <div class="d-flex align-items-center flex-wrap gap-2"><span class="badge" [class.bg-success]="loanBalance(loan) <= 0" [class.bg-warning]="loanBalance(loan) > 0">Saldo {{ loanBalance(loan) | currency:'MXN' }}</span>

            <ng-container>
            <button class="btn btn-sm" [class.btn-warning]="isScheduleEditing(loan)" [class.btn-outline-primary]="!isScheduleEditing(loan)" (click)="toggleScheduleEditing(loan)" [disabled]="saving"><i class="bi" [class.bi-calendar2-check]="isScheduleEditing(loan)" [class.bi-calendar2-date]="!isScheduleEditing(loan)"></i> {{ isScheduleEditing(loan) ? 'Dejar de editar fechas' : 'Modificar fechas' }}</button>
            <button class="btn btn-sm btn-outline-danger" (click)="generatePromissoryNote(loan)" [disabled]="saving" title="Ver pagaré PDF"><i class="bi bi-file-earmark-pdf"></i> PDF</button>
            <button class="btn btn-sm btn-outline-secondary" (click)="editingLoanId = editingLoanId === loan.id ? null : loan.id">{{ editingLoanId === loan.id ? 'Cerrar cabecera' : 'Editar cabecera' }}</button>
            <button class="btn btn-sm btn-primary position-relative" (click)="saveSchedule(loan)" [disabled]="saving || (!hasChanges(loan) && !hasActiveEditor(loan))"><i class="bi bi-floppy"></i> Guardar<span *ngIf="hasChanges(loan)" class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"></span></button>
            <button class="btn btn-sm btn-warning" (click)="revertChanges(loan)" [disabled]="saving || !hasChanges(loan)"><i class="bi bi-arrow-clockwise"></i> Deshacer</button>
            </ng-container>
          </div>
        </div>
        <div class="p-2">
          <ng-container>
          <div *ngIf="editingLoanId === loan.id" class="row g-2 align-items-end mb-3">
            <div class="col-md-2"><label class="form-label small mb-1">Consecutivo nota</label><input class="form-control form-control-sm" type="text" maxlength="50" [(ngModel)]="loan.editForm.numeroNotaVenta" placeholder="Ej. 000123"></div>
            <div class="col-md-2"><label class="form-label small mb-1">Capital</label><input class="form-control form-control-sm" type="number" min="0.01" step="0.01" [(ngModel)]="loan.editForm.montoTotal" [disabled]="hasLoanPayments(loan)"></div>
            <div class="col-md-2"><label class="form-label small mb-1">Interés total</label><input class="form-control form-control-sm" type="number" min="0" step="0.01" [(ngModel)]="loan.editForm.montoInteresTotal" [disabled]="hasLoanPayments(loan)"></div>
            <div class="col-md-2"><label class="form-label small mb-1">Frecuencia</label><select class="form-select form-select-sm" [(ngModel)]="loan.editForm.frecuenciaPago" [disabled]="hasLoanPayments(loan)"><option value="DIARIO">Diario</option><option value="SEMANAL">Semanal</option><option value="QUINCENAL">Quincenal</option><option value="MENSUAL">Mensual</option></select></div>
            <div class="col-md-2"><label class="form-label small mb-1">Fecha préstamo</label><input class="form-control form-control-sm" type="date" [(ngModel)]="loan.editForm.fechaInicio" [disabled]="hasLoanPayments(loan)"></div>
            <div class="col-md-2"><label class="form-label small mb-1">Primer pago</label><input class="form-control form-control-sm" type="date" [(ngModel)]="loan.editForm.fechaPrimerPago" [disabled]="hasLoanPayments(loan)"></div>
            <div class="col-md-2"><label class="form-label small mb-1">Número de pagos</label><input class="form-control form-control-sm" type="number" min="1" step="1" [(ngModel)]="loan.editForm.numeroCuotas" [disabled]="hasLoanPayments(loan)"></div>
            <div class="col-md-6"><label class="form-label small mb-1">Comentario</label><input class="form-control form-control-sm" maxlength="500" [(ngModel)]="loan.editForm.comentario"></div>
            <div class="col-md-6 d-flex gap-2"><button class="btn btn-sm btn-success" (click)="saveLoanRecord(loan)" [disabled]="saving || !hasLoanRecordChanges(loan)"><i class="bi bi-floppy"></i> Guardar préstamo</button></div>
            <div class="col-12 small text-warning" *ngIf="hasLoanPayments(loan)">Este préstamo ya tiene abonos. Para conservar el historial, capital, interés, fechas y número de pagos están bloqueados; puedes cambiar la nota y el comentario.</div>
            <div class="col-12 small">Interés total: {{ loan.totalInteres || 0 | currency:'MXN' }} · A pagar: {{ payableTotal(loan) | currency:'MXN' }}</div>
          </div>
          <div *ngIf="isScheduleEditing(loan)" class="alert alert-warning py-2 mb-2 small"><i class="bi bi-info-circle me-1"></i>Haz clic en una fecha programada para cambiarla. El calendario permanecerá abierto mientras eliges el día. Después selecciona <strong>Guardar</strong> para aplicar los cambios o <strong>Deshacer</strong> para restaurarlos.</div>
          <ag-grid-angular class="ag-theme-quartz small-text-ag-grid d-block" style="width:100%;height:320px" [rowData]="loan.cuotas" [getRowId]="rowId" [columnDefs]="installmentColumns" [defaultColDef]="defaultColDef" [localeText]="AG_GRID_LOCALE_ES" [rowSelection]="'single'" [singleClickEdit]="isScheduleEditing(loan)" [stopEditingWhenCellsLoseFocus]="false" (gridReady)="onInstallmentGridReady($event, loan)" (gridPreDestroyed)="onInstallmentGridDestroyed($event, loan)" (cellValueChanged)="onDateChanged($event)" (cellKeyDown)="navigateEditableCellOnEnter($event)"></ag-grid-angular>
          </ng-container>

        </div>
      </ng-template>
      <ng-template #newLoanTemplate>
        <div class="modal-header"><h5 class="modal-title fs-6"><i class="bi bi-cash-stack me-2"></i>Nuevo préstamo <small class="fw-normal text-muted">· {{ customer?.nameContact || customer?.company }}</small></h5><button type="button" class="btn-close" aria-label="Cerrar" (click)="closeLoanModal()" [disabled]="saving"></button></div>
      <div class="modal-body">
        <div class="row g-2 align-items-end">
          <div class="col-md-4"><label class="form-label small">Consecutivo de nota de venta</label><input class="form-control form-control-sm" type="text" maxlength="50" [(ngModel)]="loanForm.numeroNotaVenta" placeholder="Ej. 000123" required></div>
          <div class="col-md-4"><label class="form-label small">Monto del préstamo</label><input class="form-control form-control-sm" type="number" min="0.01" step="0.01" [(ngModel)]="loanForm.montoTotal"></div>
          <div class="col-md-4"><label class="form-label small">{{ loanForm.frecuenciaPago === 'DIARIO' ? 'Días de pago' : 'Número de pagos' }}</label><input class="form-control form-control-sm" type="number" min="1" step="1" [(ngModel)]="loanForm.numeroCuotas"></div>
          <div class="col-md-4"><label class="form-label small">Periodo</label><select class="form-select form-select-sm" [(ngModel)]="loanForm.frecuenciaPago"><option value="DIARIO">Diario</option><option value="SEMANAL">Semanal</option><option value="QUINCENAL">Quincenal</option><option value="MENSUAL">Mensual</option></select></div>
          <div class="col-md-4"><label class="form-label small">Interés</label><select class="form-select form-select-sm" [(ngModel)]="loanForm.porcentajeInteres"><option *ngFor="let rate of loanInterestRateOptions" [ngValue]="rate">{{ rate }}%</option></select></div>
          <div class="col-md-4"><label class="form-label small">Interés total calculado</label><input class="form-control form-control-sm" type="text" [value]="money(loanInterestTotal)" readonly></div>
          <div class="col-md-6"><label class="form-label small">Fecha del préstamo</label><input class="form-control form-control-sm" type="date" [(ngModel)]="loanForm.fechaInicio"></div>
          <div class="col-md-6"><label class="form-label small">Primer pago</label><input class="form-control form-control-sm" type="date" [(ngModel)]="loanForm.fechaPrimerPago"></div>
          <div class="col-12"><label class="form-label small">Comentario</label><input class="form-control form-control-sm" maxlength="500" [(ngModel)]="loanForm.comentario"></div>
          <div class="col-12" *ngIf="loanPreviewRows.length">
            <div class="small mb-2">Capital: <strong>{{ money(loanCapital) }}</strong> · Interés total: <strong>{{ money(loanInterestTotal) }}</strong> ({{ loanInterestPercentage | number:'1.0-2' }}%) · Total a pagar: <strong>{{ money(loanCapital + loanInterestTotal) }}</strong></div>
            <div class="table-responsive" style="max-height:220px"><table class="table table-sm table-bordered bg-white mb-0"><thead class="table-light"><tr><th>Pago</th><th>Fecha</th><th>Capital</th><th>Interés</th><th>Total</th></tr></thead><tbody><tr *ngFor="let row of loanPreviewRows"><td>{{ row.numero }}</td><td>{{ row.fecha | date:'dd/MM/yyyy' }}</td><td>{{ row.capital | currency:'MXN' }}</td><td>{{ row.interes | currency:'MXN' }}</td><td>{{ row.total | currency:'MXN' }}</td></tr></tbody></table></div>
          </div>
          <div class="col-12 d-flex justify-content-end gap-2 mt-2"><button class="btn btn-sm btn-outline-secondary" (click)="closeLoanModal()" [disabled]="saving">Cancelar</button><button class="btn btn-sm btn-success" (click)="createLoan()" [disabled]="saving"><i class="bi bi-floppy"></i> Crear préstamo y calendario</button></div>
        </div>
      </div>

      </ng-template>
      <ng-template #paymentTemplate>
        <div class="modal-header"><h5 class="modal-title fs-6"><i class="bi bi-receipt-cutoff me-2"></i>Registrar abono <small class="fw-normal text-muted" *ngIf="selectedLoan as loan">· Préstamo #{{ loan.id }}</small></h5><button type="button" class="btn-close" aria-label="Cerrar" (click)="cancelPayment()" [disabled]="saving"></button></div>
        <div class="modal-body" *ngIf="selectedLoan as loan"><div *ngIf="selectedInstallment as installment"><div class="small text-muted mb-2">{{ customer?.nameContact || customer?.company }} · Cuota {{ installment.numeroCuota }} · Saldo {{ loanBalance(loan) | currency:'MXN' }}</div><div class="row g-2 align-items-end">
              <div class="col-md-4"><label class="form-label small">Fecha recibida</label><input class="form-control form-control-sm" type="date" [(ngModel)]="abonoForm.fechaPago"></div>
              <div class="col-md-4"><label class="form-label small">Monto recibido (saldo préstamo: {{ loanBalance(loan) | currency:'MXN' }})</label><input class="form-control form-control-sm" type="number" min="0.01" step="0.01" [max]="loanBalance(loan)" [(ngModel)]="abonoForm.monto"></div>
              <div class="col-md-4"><label class="form-label small" [for]="'cobranza-tipo-' + installment.id">Tipo de pago <button type="button" class="btn btn-link btn-sm p-0" (click)="addPaymentType()" [disabled]="savingPaymentType" title="Agregar tipo de pago"><i class="bi bi-plus-circle"></i></button></label><ng-select class="cobranza-select" [labelForId]="'cobranza-tipo-' + installment.id" [(ngModel)]="abonoForm.idTipoPago" [clearable]="false" [searchable]="false" appendTo="body" placeholder="Seleccionar" notFoundText="Sin tipos de pago"><ng-option *ngFor="let type of paymentTypes" [value]="type.id">{{ type.description }}</ng-option></ng-select></div>
              <div class="col-md-6"><label class="form-label small" [for]="'cobranza-responsable-' + installment.id">Responsable del cobro</label><ng-select class="cobranza-select" [labelForId]="'cobranza-responsable-' + installment.id" [(ngModel)]="abonoForm.idUsuarioCobrador" [clearable]="true" [searchable]="true" appendTo="body" placeholder="Sin asignar" notFoundText="Sin usuarios"><ng-option *ngFor="let user of users" [value]="user.id">{{ user.displayName || user.usersmall || user.email || ('Usuario ' + user.id) }}</ng-option></ng-select></div>
              <div class="col-md-6"><label class="form-label small" [for]="'cobranza-origen-' + installment.id">Recibido en</label><ng-select class="cobranza-select" [labelForId]="'cobranza-origen-' + installment.id" [(ngModel)]="abonoForm.origenCobro" (change)="onPaymentOriginChange()" [clearable]="false" [searchable]="false" appendTo="body"><ng-option value="DOMICILIO">Domicilio del cliente</ng-option><ng-option value="NEGOCIO">Caja del negocio</ng-option></ng-select></div>
              <div class="col-md-3" *ngIf="abonoForm.origenCobro === 'NEGOCIO' && openCashTurns.length === 1"><label class="form-label small">Caja asignada automáticamente</label><div class="form-control form-control-sm bg-light"><i class="bi bi-check-circle-fill text-success me-1"></i>Caja {{ openCashTurns[0].idCashRegister }} · {{ openCashTurns[0].fechaInicio | date:'shortTime' }}</div></div>
              <div class="col-md-3" *ngIf="abonoForm.origenCobro === 'NEGOCIO' && openCashTurns.length > 1"><label class="form-label small" [for]="'cobranza-turno-' + installment.id">Selecciona la caja abierta</label><ng-select class="cobranza-select" [labelForId]="'cobranza-turno-' + installment.id" [(ngModel)]="abonoForm.idCajeroTurno" [clearable]="false" [searchable]="false" appendTo="body" placeholder="Seleccionar caja abierta" notFoundText="Sin cajas abiertas"><ng-option *ngFor="let turn of openCashTurns" [value]="turn.id">Caja {{ turn.idCashRegister }} · {{ turn.fechaInicio | date:'shortTime' }}</ng-option></ng-select></div>
              <div class="col-md-3" *ngIf="abonoForm.origenCobro === 'NEGOCIO' && !openCashTurns.length"><label class="form-label small">Caja abierta</label><div class="form-control form-control-sm text-danger">No tienes cajas abiertas</div></div>
              <div class="col-md-2"><label class="form-label small">Comentario</label><input class="form-control form-control-sm" maxlength="500" [(ngModel)]="abonoForm.comentario"></div>
              <div class="col-md-6"><button class="btn btn-success w-100" (click)="recordPayment(installment)" [disabled]="saving || loading || loanBalance(loan) <= 0"><i class="bi bi-floppy me-1"></i>{{ saving ? 'Guardando…' : 'Guardar abono' }}</button></div>
            </div><div *ngIf="activePayments(installment).length" class="mt-2 pt-2 border-top"><div class="small fw-semibold text-primary mb-1">Abonos registrados</div><span *ngFor="let payment of activePayments(installment)" class="d-block border-bottom py-2">{{ payment.fechaPago | date:'dd/MM/yyyy' }} — {{ payment.monto | currency:'MXN' }}<button class="btn btn-link btn-sm text-danger p-0 ms-1" (click)="deactivatePayment(payment)" [disabled]="saving" title="Quitar abono"><i class="bi bi-x-circle"></i></button><span *ngIf="payment.comentario"> ({{ payment.comentario }})</span></span></div></div></div>      </ng-template>

      <div *ngIf="!loading && !loans.length" class="text-center text-muted py-3">Sin préstamos registrados. Usa “Nuevo préstamo” para definir la frecuencia y el número de pagos.</div>
    </section>
  `
})
export class ClientesCobranzasPagosComponent implements OnChanges, OnDestroy {
  @Input() customer: any;
  @Input() idCompany = 0;
  @Output() balancesChanged = new EventEmitter<void>();
  private customersService = inject(CustomersService);
  private modalService = inject(NgbModal);
  private loanModal: NgbModalRef | null = null;
  private paymentModal: NgbModalRef | null = null;
  @ViewChild('newLoanTemplate', { static: true }) newLoanTemplate!: TemplateRef<any>;
  @ViewChild('paymentTemplate', { static: true }) paymentTemplate!: TemplateRef<any>;
  @ViewChild('installmentsTemplate', { static: true }) installmentsTemplate!: TemplateRef<any>;
  selectedLoan: any = null;
  selectedInstallment: any = null;
  editingLoanId: number | null = null;
  loanFilter: 'ALL' | 'BALANCE' | 'OVERDUE' | 'PAID' = 'BALANCE';
  autoShowInstallments = true;
  visibleLoans: any[] = [];
  private loanGridApi?: GridApi;
  readonly rowId = (params: any) => String(params.data.id);
  readonly isRowMaster = () => true;
  readonly loanDetailRenderer = LoanInstallmentsDetailComponent;
  readonly loanDetailParams = (params: any) => ({ template: this.installmentsTemplate });
  readonly noLoansMessage = '<span>No hay préstamos para este filtro.</span>';
  loanColumns: ColDef[] = [
    { field: 'numeroNotaVenta', headerName: 'Nota / Préstamo', cellRenderer: 'agGroupCellRenderer', minWidth: 190, valueGetter: p => p.data?.numeroNotaVenta || ('Préstamo #' + p.data?.id) },
    { field: 'montoTotal', headerName: 'Capital', minWidth: 115, valueFormatter: p => this.money(p.value) },
    { headerName: 'Interés', minWidth: 115, valueGetter: p => p.data?.montoInteresTotal ?? p.data?.totalInteres, valueFormatter: p => this.money(p.value) },
    { headerName: 'Abonado', minWidth: 115, valueGetter: p => this.loanTotalPaid(p.data), valueFormatter: p => this.money(p.value) },
    { headerName: 'Saldo', minWidth: 115, valueGetter: p => this.loanBalance(p.data), valueFormatter: p => this.money(p.value) },
    { headerName: 'Estado', minWidth: 110, valueGetter: p => this.loanBalance(p.data) <= 0 ? 'Liquidado' : this.hasOverdueInstallments(p.data) ? 'Con atraso' : 'Al corriente' },
    { field: 'frecuenciaPago', headerName: 'Frecuencia', minWidth: 110, valueFormatter: p => this.frequencyLabel(p.value) },
    { headerName: 'Cuotas', minWidth: 85, valueGetter: p => p.data?.cuotas?.length || 0 }
  ];
  private catalogsService = inject(CatalogsService);
  private usersService = inject(UsersService);
  private signalsService = inject(SignalsService);
  private cajeroTurnoService = inject(CajeroTurnoService);
  private posTicket = inject(PosTicketService);
  private pdfPreview = inject(PdfPreviewService);
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);
  private consecutivosService = inject(ConsecutivosService);
  private cobranzaOffline = inject(CobranzaOfflineService);
  paymentTypes: any[] = [];
  savingPaymentType = false;
  private paymentTypesRequest = 0;
  private usersRequest = 0;
  private loanRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private refreshingLoans = false;
  private loansRequest = 0;
  private destroyed = false;
  private installmentGridApis = new Map<number, GridApi>();
  users: any[] = [];
  openCashTurns: any[] = [];
  loans: any[] = [];
  private loansSnapshot = '';
  expandedLoanIds = new Set<number>();
  loading = false;
  saving = false;
  reservingLoanFolio = false;
  private loanConsecutivePrefix = '';
  showLoanForm = false;
  activeInstallmentId: number | null = null;
  editingScheduleLoanId: number | null = null;
  loanForm: any = { numeroNotaVenta: '', montoTotal: null, porcentajeInteres: 20, frecuenciaPago: 'DIARIO', fechaInicio: this.today(), fechaPrimerPago: this.nextMonth(), numeroCuotas: 15, comentario: '' };
  readonly loanInterestRateOptions = [10, 20, 30, 40, 50];
  abonoForm: any = { fechaPago: this.today(), monto: null, comentario: '' };
  AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  originalDates = new Map<number, string>();
  defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1 };
  installmentColumns: ColDef[] = [
    { field: 'numeroCuota', headerName: '#', width: 70, flex: 0, editable: false },
    { field: 'fechaProgramada', headerName: 'Fecha programada', editable: params => this.editingScheduleLoanId === Number(params.data?.idPrestamo), cellEditor: 'agDateStringCellEditor', cellDataType: 'dateString', minWidth: 170 },
    { field: 'montoCapital', headerName: 'Capital', editable: false, valueFormatter: p => this.money(p.value) },
    { field: 'montoInteres', headerName: 'Interés', editable: false, valueFormatter: p => this.money(p.value) },
    { field: 'montoProgramado', headerName: 'Pago total', editable: false, valueFormatter: p => this.money(p.value) },
    { headerName: 'Abonado', valueGetter: p => this.installmentPaid(p.data), valueFormatter: p => this.money(p.value) },
    { headerName: 'Saldo', valueGetter: p => this.installmentBalance(p.data), valueFormatter: p => this.money(p.value) },
    { headerName: 'Estado', valueGetter: p => this.installmentStatus(p.data), cellClass: p => this.installmentStatus(p.data) === 'Vencida' ? 'text-danger fw-bold' : '' },
    { headerName: 'Abonos', width: 110, flex: 0, sortable: false, filter: false, valueGetter: () => 'Abonos', cellRenderer: ButtonCellRendererExpenditureComponent, cellRendererParams: { onClick: (node: any) => this.toggleAbonoForm(node.data), icon: 'bi-cash-coin', title: 'Ver y registrar abonos de la cuota' } },
    { headerName: 'Borrar letra', width: 125, flex: 0, sortable: false, filter: false, valueGetter: () => 'Borrar', cellRendererSelector: params => this.canDeleteInstallment(params.data) ? { component: ButtonCellRendererExpenditureComponent, params: { icon: 'bi-trash', title: 'Borrar letra sin abonos de un préstamo liquidado', onClick: (node: any) => this.deactivateInstallment(node.data) } } : undefined }
  ];
  readonly navigateEditableCellOnEnter = navigateEditableCellOnEnter;
  get hasPendingEdits(): boolean { return this.loans.some(loan => this.hasChanges(loan) || this.hasLoanRecordChanges(loan) || this.hasActiveEditor(loan)); }
  hasOverdueInstallments(loan: any): boolean { return (loan?.cuotas || []).some((item: any) => item.active !== false && this.installmentStatus(item) === 'Vencida'); }
  activePayments(installment: any): any[] { return (installment?.abonos || []).filter((item: any) => item.active !== false); }
  applyLoanFilter(): void {
    this.visibleLoans = this.loans.filter(loan => this.loanFilter === 'ALL'
      || (this.loanFilter === 'BALANCE' && this.loanBalance(loan) > 0)
      || (this.loanFilter === 'OVERDUE' && this.hasOverdueInstallments(loan))
      || (this.loanFilter === 'PAID' && this.loanBalance(loan) <= 0));
  }
  onLoanGridReady(event: GridReadyEvent): void { this.loanGridApi = event.api; this.restoreExpandedLoans(); }
  restoreExpandedLoans(): void {
    queueMicrotask(() => {
      if (!this.loanGridApi || this.loanGridApi.isDestroyed()) return;
      this.loanGridApi.forEachNode(node => {
        if (node.data) node.setExpanded(this.expandedLoanIds.has(Number(node.data.id)));
      });
      this.loanGridApi.refreshCells({ force: true });
    });
  }
  onLoanExpansion(event: any): void {
    const id = Number(event.node.data?.id);
    if (event.node.expanded) this.expandedLoanIds.add(id);
    else this.expandedLoanIds.delete(id);
  }
  setAutomaticDetails(): void {
    this.loans.forEach(loan => {
      if (this.autoShowInstallments) this.expandedLoanIds.add(Number(loan.id));
      else this.expandedLoanIds.delete(Number(loan.id));
    });
    this.restoreExpandedLoans();
  }
  onInstallmentGridDestroyed(event: any, loan: any): void {
    if (this.installmentGridApis.get(Number(loan.id)) === event.api) this.installmentGridApis.delete(Number(loan.id));
  }
  closeLoanModal(): void { if (this.saving) return; this.loanModal?.close(); this.loanModal = null; this.showLoanForm = false; }
  money(value: any): string { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value || 0)); }
  get loanCapital(): number { return Number(this.loanForm.montoTotal || 0); }
  get loanInterestTotal(): number { return Math.round(this.loanCapital * Number(this.loanForm.porcentajeInteres || 0)) / 100; }
  get loanInterestPercentage(): number { return Number(this.loanForm.porcentajeInteres || 0); }
  loanInterestPercent(loan: any): number { const capital = Number(loan?.montoTotal || 0); return capital > 0 ? Math.round(Number(loan?.totalInteres || 0) / capital * 10000) / 100 : 0; }
  private rateFor(interest: number, capital: number): number { return capital > 0 ? Math.round(interest / capital * 10000) / 100 : 0; }
  frequencyLabel(frequency: string): string { return ({ DIARIO: 'Diario', SEMANAL: 'Semanal', QUINCENAL: 'Quincenal', MENSUAL: 'Mensual' } as any)[frequency] || 'Mensual'; }
  get loanPreviewRows(): Array<{ numero: number; fecha: string; capital: number; interes: number; total: number }> {
    const capital = this.loanCapital, count = Number(this.loanForm.numeroCuotas), totalInterest = this.loanInterestTotal;
    if (!(capital > 0) || !Number.isInteger(count) || count < 1 || !this.loanForm.fechaPrimerPago || totalInterest < 0) return [];
    const regularCapital = Math.round(capital / count * 100) / 100;
    const regularInterest = Math.round(totalInterest / count * 100) / 100;
    let capitalScheduled = 0, interestScheduled = 0;
    return Array.from({ length: count }, (_, index) => {
      const amountCapital = index === count - 1 ? Math.round((capital - capitalScheduled) * 100) / 100 : regularCapital;
      const amountInterest = index === count - 1 ? Math.round((totalInterest - interestScheduled) * 100) / 100 : regularInterest;
      capitalScheduled += amountCapital; interestScheduled += amountInterest;
      const first = new Date(`${this.loanForm.fechaPrimerPago}T12:00:00`);
      const frequency = this.loanForm.frecuenciaPago || 'MENSUAL';
      const date = frequency === 'DIARIO' ? new Date(first.getFullYear(), first.getMonth(), first.getDate() + index)
        : frequency === 'SEMANAL' ? new Date(first.getFullYear(), first.getMonth(), first.getDate() + index * 7)
        : frequency === 'QUINCENAL' ? new Date(first.getFullYear(), first.getMonth(), first.getDate() + index * 14)
        : new Date(first.getFullYear(), first.getMonth() + index, Math.min(first.getDate(), new Date(first.getFullYear(), first.getMonth() + index + 1, 0).getDate()));
      return { numero: index + 1, fecha: this.formatDate(date), capital: amountCapital, interes: amountInterest, total: amountCapital + amountInterest };
    });
  }
  payableTotal(loan: any): number { return (loan.cuotas || []).reduce((sum: number, item: any) => sum + Number(item.montoProgramado || 0), 0); }
  installmentStatus(item: any): string {
    if (this.installmentBalance(item) <= 0) return 'Pagada';
    const due = this.normalizeScheduledDate(item?.fechaProgramada);
    return due && due < this.formatDate(new Date()) ? 'Vencida' : 'Pendiente';
  }
  onDateChanged(event: any): void {
    const date = this.normalizeScheduledDate(event.newValue);
    if (!date) {
      event.node.setDataValue('fechaProgramada', this.normalizeScheduledDate(event.oldValue) || event.oldValue);
      alerts.basicAlert('Fecha inválida', 'Selecciona una fecha válida.', 'warning');
      return;
    }
    if (date !== event.newValue) event.node.setDataValue('fechaProgramada', date);
  }
  private normalizeScheduledDate(value: unknown): string | null {
    if (value instanceof Date && Number.isFinite(value.getTime())) return this.formatDate(value);
    if (typeof value !== 'string') return null;
    const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (!match) return null;
    const [year, month, day] = match[1].split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day ? match[1] : null;
  }
  isScheduleEditing(loan: any): boolean { return this.editingScheduleLoanId === Number(loan?.id); }
  onInstallmentGridReady(event: GridReadyEvent, loan: any): void { this.installmentGridApis.set(Number(loan?.id), event.api); }
  hasActiveEditor(loan: any): boolean { const api = this.installmentGridApis.get(Number(loan?.id)); return !!api && !api.isDestroyed() && api.getEditingCells().length > 0; }
  toggleScheduleEditing(loan: any): void {
    const loanId = Number(loan?.id);
    if (this.editingScheduleLoanId === loanId) {
      this.installmentGridApis.get(loanId)?.stopEditing();
      this.editingScheduleLoanId = null;
      return;
    }
    this.editingScheduleLoanId = loanId;
  }
  saveSchedule(loan: any): void {
    this.installmentGridApis.get(Number(loan?.id))?.stopEditing();
    // AG Grid commits the editor synchronously; defer the save so Angular has
    // applied cellValueChanged to the bound loan row before reading its dates.
    setTimeout(() => void this.saveChanges(loan), 0);
  }
  hasChanges(loan: any): boolean { return (loan.cuotas || []).some((item: any) => item.fechaProgramada !== this.originalDates.get(item.id)); }
  revertChanges(loan: any): void {
    this.installmentGridApis.get(Number(loan?.id))?.stopEditing(true);
    loan.cuotas = loan.cuotas.map((item: any) => ({ ...item, fechaProgramada: this.originalDates.get(item.id) }));
    this.editingScheduleLoanId = null;
  }
  async saveChanges(loan: any): Promise<void> {
    const changed = loan.cuotas.map((item: any) => ({ item, date: this.normalizeScheduledDate(item.fechaProgramada) }))
      .filter((entry: any) => entry.date && entry.date !== this.originalDates.get(entry.item.id));
    if (!changed.length) {
      alerts.basicAlert('Sin cambios', 'Cambia una fecha programada antes de guardar.', 'info');
      return;
    }
    this.saving = true;
    try {
      for (const entry of changed) await firstValueFrom(this.customersService.updateCobranzaInstallmentDate(entry.item.id, { fechaProgramada: entry.date }));
      const refreshedLoans = await firstValueFrom(this.customersService.getCobranzaLoans(Number(this.customer.id)));
      const refreshedInstallments = new Map<number, string>();
      for (const refreshedLoan of refreshedLoans || []) {
        for (const installment of refreshedLoan.cuotas || []) refreshedInstallments.set(Number(installment.id), this.dateForInput(installment.fechaProgramada));
      }
      const notPersisted = changed.find((entry: any) => refreshedInstallments.get(Number(entry.item.id)) !== entry.date);
      if (notPersisted) throw new Error(`La API no devolvió la fecha guardada para la cuota ${notPersisted.item.numeroCuota}.`);
      this.setLoans(refreshedLoans);
      this.saving = false; this.editingScheduleLoanId = null; this.balancesChanged.emit();
      alerts.basicAlert('Fechas guardadas', 'Se actualizó el calendario de pagos.', 'success');
    } catch (error) {
      console.error('No se pudo confirmar el guardado de las fechas programadas:', error); this.saving = false;
      alerts.basicAlert('Error', error instanceof Error && error.message.startsWith('La API no devolvió') ? error.message : 'No se pudieron guardar las fechas. Verifica la conexión con Cobranza e inténtalo de nuevo.', 'error');
    }
  }

  get totalPaid(): number { return this.loans.reduce((sum, loan) => sum + loan.cuotas.reduce((s: number, q: any) => s + this.installmentPaid(q), 0), 0); }
  hasLoanPayments(loan: any): boolean { return (loan?.cuotas || []).some((installment: any) => (installment.abonos || []).some((payment: any) => payment.active !== false && Number(payment.monto) > 0)); }
  hasLoanFinancialChanges(loan: any): boolean {
    const form = loan?.editForm || {};
    return Number(form.montoTotal) !== Number(loan?.montoTotal)
      || Number(form.montoInteresTotal) !== Number(loan?.montoInteresTotal ?? loan?.totalInteres ?? 0)
      || String(form.frecuenciaPago || 'MENSUAL') !== String(loan?.frecuenciaPago || 'MENSUAL')
      || this.dateForInput(form.fechaInicio) !== this.dateForInput(loan?.fechaInicio)
      || this.dateForInput(form.fechaPrimerPago) !== this.dateForInput(loan?.fechaPrimerPago)
      || Number(form.numeroCuotas) !== Number(loan?.numeroCuotas || loan?.cuotas?.length || 1);
  }
  hasLoanRecordChanges(loan: any): boolean {
    const form = loan?.editForm || {};
    return String(form.numeroNotaVenta || '').trim() !== String(loan?.numeroNotaVenta || '').trim()
      || this.hasLoanFinancialChanges(loan)
      || String(form.comentario || '').trim() !== String(loan?.comentario || '').trim();
  }
  async saveLoanRecord(loan: any): Promise<void> {
    const form = loan?.editForm || {};
    const receiptNumber = String(form.numeroNotaVenta || '').trim();
    const amount = Number(form.montoTotal);
    const totalInterest = Number(form.montoInteresTotal);
    const paymentCount = Number(form.numeroCuotas);
    if (!receiptNumber || receiptNumber.length > 50 || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(totalInterest) || totalInterest < 0 || !Number.isInteger(paymentCount) || paymentCount < 1 || !form.fechaInicio || !form.fechaPrimerPago) {
      alerts.basicAlert('Datos requeridos', 'Revisa el consecutivo, capital, interés total, frecuencia, fechas y número de pagos.', 'warning');
      return;
    }
    if (this.hasLoanPayments(loan) && this.hasLoanFinancialChanges(loan)) {
      alerts.basicAlert('Préstamo con abonos', 'No se pueden cambiar las condiciones financieras porque ya existen abonos. Puedes actualizar el consecutivo y el comentario.', 'warning');
      return;
    }
    if (!this.hasLoanRecordChanges(loan) || this.saving) return;
    this.saving = true;
    try {
      await firstValueFrom(this.customersService.updateCobranzaLoan(Number(loan.id), {
        numeroNotaVenta: receiptNumber, montoTotal: amount, montoInteresTotal: totalInterest, tasaInteresMensual: this.rateFor(totalInterest, amount), frecuenciaPago: form.frecuenciaPago || 'MENSUAL',
        fechaInicio: form.fechaInicio, fechaPrimerPago: form.fechaPrimerPago,
        numeroCuotas: paymentCount, comentario: String(form.comentario || '').trim()
      }));
      const loans = await firstValueFrom(this.customersService.getCobranzaLoans(Number(this.customer.id)));
      const savedLoan = (loans || []).find((item: any) => Number(item.id) === Number(loan.id));
      if (!savedLoan) throw new Error('La API no devolvió el préstamo actualizado.');
      if (String(savedLoan.numeroNotaVenta || '').trim() !== receiptNumber
        || this.dateForInput(savedLoan.fechaInicio) !== this.dateForInput(form.fechaInicio)
        || this.dateForInput(savedLoan.fechaPrimerPago) !== this.dateForInput(form.fechaPrimerPago)) {
        throw new Error('La API respondió, pero los datos del encabezado del préstamo no cambiaron.');
      }
      this.setLoans(loans);
      this.balancesChanged.emit();
      alerts.basicAlert('Préstamo actualizado', 'Se guardaron los datos y el calendario actualizado.', 'success');
    } catch (error) {
      console.error('No se pudo actualizar el préstamo:', error);
      const apiMessage = (error as any)?.error?.error || (error as any)?.error?.message || (error as any)?.message;
      alerts.basicAlert('No se pudo guardar el préstamo', apiMessage || 'La API de Cobranza rechazó la actualización. Revisa la conexión y vuelve a intentarlo.', 'error');
    } finally { this.saving = false; }
  }
  cancelPayment(): void { if (this.saving) return; this.paymentModal?.close(); this.paymentModal = null; this.activeInstallmentId = null; this.selectedInstallment = null; this.selectedLoan = null; }
  onPaymentOriginChange(): void {
    if (this.abonoForm.origenCobro === 'NEGOCIO' && this.openCashTurns.length === 1) this.abonoForm.idCajeroTurno = this.openCashTurns[0].id;
    if (this.abonoForm.origenCobro !== 'NEGOCIO') this.abonoForm.idCajeroTurno = null;
  }
  ngOnChanges(): void {
    this.loadLoans(); this.loadPaymentTypes(); this.loadUsers(); this.loadOpenCashTurns();
    if (!this.loanRefreshTimer) this.loanRefreshTimer = setInterval(() => void this.refreshLoansIfChanged(), 5000);
  }
  ngOnDestroy(): void {
    this.destroyed = true; ++this.loansRequest;
    if (this.loanRefreshTimer) clearInterval(this.loanRefreshTimer);
    this.loanModal?.close(); this.paymentModal?.close(); this.installmentGridApis.clear();
  }
  private get paymentCompanyId(): number {
    return [this.customer?.idRoot, this.idCompany, this.signalsService.getRootSelectedBySidebar()()]
      .map(value => Number(value)).find(value => Number.isInteger(value) && value > 0) || 0;
  }

  async beginNewLoan(): Promise<void> {
    if (this.showLoanForm || this.reservingLoanFolio || this.saving) return;
    const companyId = this.paymentCompanyId;
    if (!companyId) { alerts.basicAlert('Empresa requerida', 'No se pudo identificar la empresa para generar el consecutivo.', 'warning'); return; }
    this.reservingLoanFolio = true;
    try {
      let config: ConsecutivoConfig | null = null;
      let folio = '';
      if (this.cobranzaOffline.isOffline) {
        config = await this.cobranzaOffline.readSnapshot<ConsecutivoConfig>(this.cobranzaOffline.snapshotKey('loan-consecutive', companyId));
        if (!config || !config.consecutivoTexto) throw new Error('No hay un consecutivo de préstamos guardado en esta computadora. Conéctate a internet y abre Nuevo préstamo para prepararlo.');
        const number = Math.max(1, Math.trunc(Number(config.campoAuxiliar || 1)));
        folio = `${config.consecutivoTexto}${number}`;
        await this.cobranzaOffline.saveSnapshot(this.cobranzaOffline.snapshotKey('loan-consecutive', companyId), companyId, 'consecutivo de préstamos', { ...config, campoAuxiliar: number + 1 });
      } else {
        const configs = await firstValueFrom(this.consecutivosService.getByRoot(companyId));
        config = (configs || [])[0] || null;
        if (!config?.consecutivoTexto) throw new Error('Configura primero el prefijo y el siguiente número en Cobranza > Configuración.');
        const reserved = await firstValueFrom(this.consecutivosService.reserveNext(companyId, config.consecutivoTexto));
        folio = reserved.folio;
        await this.cobranzaOffline.saveSnapshot(this.cobranzaOffline.snapshotKey('loan-consecutive', companyId), companyId, 'consecutivo de préstamos', { ...config, campoAuxiliar: reserved.numero + 1 });
      }
      this.loanConsecutivePrefix = config.consecutivoTexto;
      this.loanForm = { numeroNotaVenta: folio, montoTotal: null, porcentajeInteres: 20, frecuenciaPago: 'DIARIO', fechaInicio: this.today(), fechaPrimerPago: this.nextMonth(), numeroCuotas: 15, comentario: '' };
      if (this.destroyed) return;
      this.showLoanForm = true;
      this.loanModal = this.modalService.open(this.newLoanTemplate, { size: 'lg', centered: true, windowClass: 'cobranza-compact-modal', backdrop: 'static', keyboard: false, scrollable: true });
      this.loanModal.result.then(() => this.showLoanForm = false, () => this.showLoanForm = false);
    } catch (error: any) {
      console.error('No se pudo preparar el consecutivo del préstamo:', error);
      alerts.basicAlert('No se pudo generar el consecutivo', error?.error?.error || error?.message || 'Revisa la configuración de consecutivos de esta empresa.', 'error');
    } finally { this.reservingLoanFolio = false; }
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
        this.users = (Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : Array.isArray(result?.items) ? result.items : [])
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
  loadOpenCashTurns(): void { const rootId = this.paymentCompanyId; if (!rootId) { this.openCashTurns = []; return; } const cashier = 'COBRANZA: ' + Number(this.signalsService.getIdUSer()()); this.cajeroTurnoService.getByCompany(rootId).subscribe({ next: (items: any[]) => { this.openCashTurns = (items || []).filter(item => item.active && !item.fechaCierre && String(item.cajero || '') === cashier); if (this.abonoForm.origenCobro === 'NEGOCIO' && this.openCashTurns.length === 1) this.abonoForm.idCajeroTurno = this.openCashTurns[0].id; }, error: () => this.openCashTurns = [] }); }
  private today(): string { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  private nextMonth(): string { const date = new Date(); const day = date.getDate(); date.setDate(1); date.setMonth(date.getMonth() + 1); const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(); date.setDate(Math.min(day, lastDay)); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  private dateForInput(value: string | Date): string { if (!value) return ''; return typeof value === 'string' ? value.slice(0, 10) : this.formatDate(value); }
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
    if (!this.customer?.id) { this.loans = []; this.visibleLoans = []; return; }
    const request = ++this.loansRequest;
    const customerId = Number(this.customer.id);
    this.loading = true;
    this.customersService.getCobranzaLoans(this.customer.id).subscribe({
      next: (items: any[]) => { if (this.destroyed || request !== this.loansRequest || Number(this.customer?.id) !== customerId) return; this.setLoans(items); this.loading = false; },
      error: error => { if (this.destroyed || request !== this.loansRequest) return; console.error(error); this.loading = false; alerts.basicAlert('Error', 'No se pudieron cargar los préstamos.', 'error'); }
    });
  }

  private setLoans(items: any[]): void {
    this.loansSnapshot = JSON.stringify(items || []);
    const previous = new Map(this.loans.map(loan => [Number(loan.id), loan]));
    this.loans = (items || []).filter(loan => loan.active !== false).map(loan => ({ ...loan, editForm: {
      numeroNotaVenta: loan.numeroNotaVenta || '', montoTotal: loan.montoTotal,
      montoInteresTotal: Number(loan.montoInteresTotal ?? loan.totalInteres ?? 0), frecuenciaPago: loan.frecuenciaPago || 'MENSUAL',
      fechaInicio: this.dateForInput(loan.fechaInicio), fechaPrimerPago: this.dateForInput(loan.fechaPrimerPago),
      numeroCuotas: loan.numeroCuotas || loan.cuotas?.length || 1, comentario: loan.comentario || ''
    }, cuotas: (loan.cuotas || []).map((installment: any) => ({ ...installment, fechaProgramada: this.dateForInput(installment.fechaProgramada) })) }));
    this.loans = this.loans.map(loan => {
      const old = previous.get(Number(loan.id));
      if (!old && this.autoShowInstallments) this.expandedLoanIds.add(Number(loan.id));
      return old ? Object.assign(old, loan) : loan;
    });
    if (this.selectedLoan) {
      this.selectedLoan = this.loans.find(loan => Number(loan.id) === Number(this.selectedLoan.id));
      this.selectedInstallment = this.selectedLoan?.cuotas.find((item: any) => Number(item.id) === Number(this.activeInstallmentId));
    }
    this.applyLoanFilter();
    this.restoreExpandedLoans();
    this.originalDates.clear();
    this.loans.forEach(loan => loan.cuotas.forEach((item: any) => this.originalDates.set(item.id, item.fechaProgramada)));
  }

  private async refreshLoansIfChanged(): Promise<void> {
    const customerId = Number(this.customer?.id);
    if (!customerId || document.hidden || this.loading || this.saving || this.refreshingLoans || this.showLoanForm || this.activeInstallmentId !== null || this.editingScheduleLoanId !== null || this.loans.some(loan => this.hasChanges(loan) || this.hasLoanRecordChanges(loan))) return;
    this.refreshingLoans = true;
    try {
      const items = await firstValueFrom(this.customersService.getCobranzaLoans(customerId));
      if (this.destroyed || this.loading || this.saving || this.hasPendingEdits || this.showLoanForm || this.activeInstallmentId !== null || Number(this.customer?.id) !== customerId) return;
      if (JSON.stringify(items || []) === this.loansSnapshot) return;
      this.setLoans(items);
      this.balancesChanged.emit();
    } catch (error) {
      console.warn('No se pudo sincronizar Cobranza automáticamente:', error);
    } finally {
      this.refreshingLoans = false;
    }
  }

  async createLoan(): Promise<void> {
    if (this.saving) return;
    const amount = Number(this.loanForm.montoTotal);
    const totalInterest = this.loanInterestTotal;
    const numberOfPayments = Number(this.loanForm.numeroCuotas);
    const receiptNumber = String(this.loanForm.numeroNotaVenta || '').trim();
    if (!receiptNumber || receiptNumber.length > 50 || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(totalInterest) || totalInterest < 0 || !Number.isInteger(numberOfPayments) || numberOfPayments < 1 || !this.loanForm.fechaInicio || !this.loanForm.fechaPrimerPago) { alerts.basicAlert('Datos requeridos', 'Captura el consecutivo de la nota de venta, capital mayor a cero, porcentaje de interés, periodo, número de pagos y fechas válidas.', 'warning'); return; }
    this.saving = true;
    try {
      const saved: any = await firstValueFrom(this.customersService.createCobranzaLoan({ idCustomer: this.customer.id, numeroNotaVenta: receiptNumber, __consecutivoPrefijo: this.loanConsecutivePrefix, montoTotal: amount, montoInteresTotal: totalInterest, tasaInteresMensual: this.rateFor(totalInterest, amount), frecuenciaPago: this.loanForm.frecuenciaPago || 'MENSUAL', fechaInicio: this.loanForm.fechaInicio, fechaPrimerPago: this.loanForm.fechaPrimerPago, numeroCuotas: numberOfPayments, comentario: this.loanForm.comentario }));
      this.saving = false; this.closeLoanModal(); this.loanForm = { numeroNotaVenta: '', montoTotal: null, porcentajeInteres: 20, frecuenciaPago: 'DIARIO', fechaInicio: this.today(), fechaPrimerPago: this.nextMonth(), numeroCuotas: 15, comentario: '' }; this.balancesChanged.emit();
      let createdLoan = saved;
      try {
        const refreshed = await firstValueFrom(this.customersService.getCobranzaLoans(this.customer.id));
        this.setLoans(refreshed);
        createdLoan = refreshed.find((loan: any) => Number(loan.id) === Number(saved?.id)) || refreshed.sort((a: any, b: any) => Number(b.id) - Number(a.id))[0] || saved;
      } catch (refreshError) {
        console.warn('El préstamo se guardó, pero no se actualizó el listado:', refreshError);
        if (saved) this.setLoans([...this.loans, saved]);
      }
      if (createdLoan?.id) {
        this.loanFilter = 'BALANCE'; this.applyLoanFilter();
        this.expandedLoanIds.add(Number(createdLoan.id)); this.restoreExpandedLoans();
      }
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
      const interestRate = principal > 0 ? Math.round(interest / principal * 10000) / 100 : 0;
      const frequency = this.frequencyLabel(loan.frecuenciaPago).toLowerCase();
      const due = installments.reduce((sum: number, item: any) => sum + Number(item.montoProgramado || 0), 0);
      const receiptFolio = String(loan.numeroNotaVenta || '').trim() || '—';
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
        { text: `PRÉSTAMO · Capital ${money(principal)} · Interés total ${money(interest)} (${interestRate}%)`, bold: true },
        { text: money(principal), alignment: 'right' }, { text: `${interestRate}%`, alignment: 'center' },
        { text: `${installments.length} pagos ${frequency}`, alignment: 'center' }, { text: '—', alignment: 'center' },
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
        { columns: [logo ? { width: 80, image: logo, fit: [72, 58] } : { width: 80, text: text(company?.name), bold: true, fontSize: 10, color: navy, margin: [0, 12, 0, 0] }, { text: `${text(company?.name)}${companyAddress ? `\n${companyAddress}` : ''}${company?.phone ? `\nTEL.: ${company.phone}` : ''}${company?.rfc ? `\nR.F.C.: ${company.rfc}` : ''}`, alignment: 'center', fontSize: 8, margin: [0, 8, 0, 0] }, logo2 ? { width: 65, image: logo2, fit: [60, 50], alignment: 'right' } : { width: 65, text: '' }, { width: 188, table: { widths: [78, '*'], body: [[{ text: 'N° NOTA DE VENTA', bold: true, color: '#FFFFFF', fillColor: navy, alignment: 'center', colSpan: 2 }, {}], [{ text: 'SERIE-FOLIO', bold: true, alignment: 'center', fontSize: 7 }, { text: 'FECHA Y HORA DE EMISIÓN', bold: true, alignment: 'center', fontSize: 6 }], [{ text: receiptFolio, bold: true, alignment: 'center', fontSize: 12 }, { text: `${date(loan.fechaInicio)}  ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`, alignment: 'center', fontSize: 7 }]] }, layout: grid }], columnGap: 5, margin: [0, 0, 0, 12] },
        { table: { widths: ['*'], body: [[{ text: 'CLIENTE:', bold: true, color: '#FFFFFF', fillColor: navy, fontSize: 9 }], [{ columns: [{ width: '60%', stack: [{ text: customerName, bold: true }, ...(this.customer?.rfc ? [{ text: `R.F.C.: ${this.customer.rfc}` }] : []), ...(customerAddress ? [{ text: customerAddress }] : [])] }, { width: '40%', stack: [...(this.customer?.phone ? [{ text: `Teléfono: ${this.customer.phone}` }] : []), { text: `Vendedor: ${text(company?.name)}` }, { text: `Observaciones: Préstamo #${loan.id}${text(loan.comentario) ? ` · ${text(loan.comentario)}` : ''}` }] }], fillColor: gray, margin: [6, 6, 6, 6] }]] }, layout: grid, margin: [0, 0, 0, 7] },
        { table: { headerRows: 1, widths: [28, 40, 40, '*', 60, 34, 47, 26, 68], body: serviceRows }, layout: grid, fontSize: 8 },
        { table: { widths: ['*'], body: [[{ text: 'DETALLE DE PAGOS', bold: true, color: '#FFFFFF', fillColor: navy, fontSize: 8 }]] }, layout: grid, margin: [0, 7, 0, 0] },
        { table: { headerRows: 1, widths: [42, 78, '*', '*', '*'], body: rows }, layout: scheduleGrid, fontSize: scheduleFontSize },
        { table: { widths: ['68%', '32%'], body: [[
          { stack: [{ text: 'PAGO EN PARCIALIDADES', bold: true }, { text: 'MÉTODO DE PAGO: POR DEFINIR' }, { text: `CONDICIONES DE PAGO: CRÉDITO A ${installments.length} ${installments.length === 1 ? 'PAGO' : 'PAGOS'}` }, { text: `PRIMER PAGO: ${date(installments[0]?.fechaProgramada)}` }] , fillColor: '#FFFFFF', margin: [6, 7, 6, 7] },
          { table: { widths: ['*', 'auto'], body: [[{ text: 'TOTAL', bold: true, color: '#FFFFFF', fillColor: navy, colSpan: 2, alignment: 'center' }, {}], [{ text: 'CAPITAL:' }, { text: money(principal), alignment: 'right' }], [{ text: `INTERÉS TOTAL (${interestRate}%):` }, { text: money(interest), alignment: 'right' }], [{ text: `FRECUENCIA: ${frequency.toUpperCase()}` }, { text: `${installments.length} pagos`, alignment: 'right' }], [{ text: 'TOTAL A PAGAR:', bold: true }, { text: money(due), alignment: 'right', bold: true }]].map(row => row.map(cell => Object.keys(cell).length ? { ...cell, fillColor: cell.fillColor || gray } : cell)) }, layout: grid, fontSize: 8 },
        ]] }, layout: { hLineWidth: () => 0, vLineWidth: () => 0 }, margin: [0, 7, 0, 7] },
        { text: `CANTIDAD CON LETRA: (${this.amountInWords(due)} PESOS ${String(Math.round((due - Math.floor(due)) * 100)).padStart(2, '0')}/100 M.N.)`, bold: true, margin: [3, 2, 3, 8], fontSize: 8 },
        { table: { widths: ['*'], body: [
          [{ text: `PAGARÉ: BUENO POR ${money(due)}`, bold: true, color: '#FFFFFF', fillColor: navy, alignment: 'center', fontSize: 10 }],
          [{ text: `LUGAR Y FECHA: ${text(company?.city || company?.location || '')} ${date(loan.fechaInicio)}\n\nPOR ESTE PAGARÉ PROMETO INCONDICIONALMENTE PAGAR A LA ORDEN DE ${text(company?.name) || '________________'} LA CANTIDAD DE ${money(due)} (${this.amountInWords(due)} PESOS ${String(Math.round((due - Math.floor(due)) * 100)).padStart(2, '0')}/100 M.N.) CONFORME AL CALENDARIO DE PAGOS. El capital prestado es ${money(principal)} y genera un interés ordinario total fijo de ${money(interest)}, equivalente al ${interestRate}% del capital; se distribuye en ${installments.length} pagos con frecuencia ${frequency}, conforme al calendario adjunto. El vencimiento final es el ${date(installments[installments.length - 1]?.fechaProgramada)}. En caso de incumplimiento, se aplicará una tasa moratoria del 3% mensual sobre los saldos insolutos vencidos, desde la fecha de incumplimiento y hasta el pago total, sin que por ello se entienda prorrogado el plazo.\n\nNOMBRE Y DATOS DEL DEUDOR:\nNOMBRE: ${customerName}${customerAddress ? `\nDIRECCIÓN: ${customerAddress}` : ''}${this.customer?.phone ? `\nTELÉFONO: ${this.customer.phone}` : ''}\n\nACEPTO (AMOS)\n\n____________________________________________`, fillColor: gray, alignment: 'justify', margin: [8, 5, 8, 5], fontSize: 7.5 }],
        ] }, layout: grid, margin: [0, 0, 0, 0] },
      ];
      const safeReceiptFolio = receiptFolio.replace(/[^\w.-]+/g, '_');
      await this.pdfPreview.show((pdfMake as any).createPdf({ pageSize: 'LETTER', pageMargins: [20, 14, 20, 16], background: () => ({ canvas: [{ type: 'rect', x: 0, y: 0, w: 612, h: 792, color: '#FFFFFF' }] }), content, defaultStyle: { font: 'Roboto', fontSize: 7.5 } }), `Nota de venta ${receiptFolio} · Préstamo #${loan.id}`, `Nota_venta_pagare_${safeReceiptFolio}.pdf`);
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
    if (this.saving || this.paymentModal) return;
    if (this.hasPendingEdits) { alerts.basicAlert('Cambios pendientes', 'Guarda o deshaz los cambios del préstamo antes de registrar un abono.', 'info'); return; }
    this.selectedLoan = this.loans.find(loan => Number(loan.id) === Number(installment.idPrestamo));
    if (!this.selectedLoan) return;
    this.selectedInstallment = installment;
    this.activeInstallmentId = installment.id;
    const currentUserId = Number(this.signalsService.getIdUSer()());
    this.abonoForm = { fechaPago: this.today(), monto: this.installmentBalance(installment), idTipoPago: this.paymentTypes[0]?.id ?? null, idUsuarioCobrador: this.users.some(user => Number(user.id) === currentUserId) ? currentUserId : null, origenCobro: 'DOMICILIO', idCajeroTurno: null, comentario: '' };
    this.loadOpenCashTurns();
    this.paymentModal = this.modalService.open(this.paymentTemplate, { size: 'lg', centered: true, windowClass: 'cobranza-compact-modal', backdrop: 'static', keyboard: false, scrollable: true });
    this.paymentModal.result.then(() => this.resetPaymentSelection(), () => this.resetPaymentSelection());
  }
  private resetPaymentSelection(): void { this.paymentModal = null; this.activeInstallmentId = null; this.selectedLoan = null; this.selectedInstallment = null; }

  async recordPayment(installment: any): Promise<void> {
    if (this.saving || this.loading) return;
    const paymentForm = { ...this.abonoForm };
    const amount = Number(paymentForm.monto);
    const loan = this.loans.find(item => Number(item.id) === Number(installment.idPrestamo));
    const loanBalance = loan ? this.loanBalance(loan) : 0;
    if (!paymentForm.fechaPago || !Number.isFinite(amount) || amount <= 0 || amount > loanBalance) { alerts.basicAlert('Monto no válido', `Captura un monto mayor a cero que no supere el saldo del préstamo (${this.money(loanBalance)}).`, 'warning'); return; }
    if (!paymentForm.idTipoPago) { alerts.basicAlert('Tipo de pago requerido', 'Selecciona cómo se recibió el abono.', 'warning'); return; }
    if (paymentForm.origenCobro === 'NEGOCIO' && !paymentForm.idCajeroTurno) { alerts.basicAlert('Caja requerida', 'Abre y selecciona una caja de cobranza para registrar este pago.', 'warning'); return; }
    this.saving = true;
    let saved: any;
    try {
      saved = await firstValueFrom(this.customersService.addCobranzaInstallmentPayment(installment.id, { fechaPago: paymentForm.fechaPago, monto: amount, idTipoPago: paymentForm.idTipoPago, idUsuarioCobrador: paymentForm.idUsuarioCobrador, origenCobro: paymentForm.origenCobro, idCajeroTurno: paymentForm.origenCobro === 'NEGOCIO' ? paymentForm.idCajeroTurno : null, comentario: paymentForm.comentario }));
    } catch (error: any) { console.error(error); this.saving = false; alerts.basicAlert('Error', error?.error?.error || 'No se pudo registrar el abono.', 'error'); return; }
    // Close the capture before showing the PDF; keep saving locked until completion.
    this.paymentModal?.close(); this.paymentModal = null;
    try {
      await this.posTicket.printCobranza({ id: saved?.id, fecha: paymentForm.fechaPago, monto: amount, saldoPendiente: Math.max(0, loanBalance - amount), tipoPago: this.paymentTypes.find(item => item.id === paymentForm.idTipoPago)?.description || 'Pago', cliente: this.customer?.nameContact || this.customer?.company || 'Cliente', prestamo: installment.idPrestamo, cuota: installment.numeroCuota, origen: paymentForm.origenCobro, empresaId: this.paymentCompanyId });
    } catch (error) {
      console.error('El abono se guardó, pero no se pudo abrir el ticket:', error);
      alerts.basicAlert('Abono guardado', 'El abono se guardó, pero no se pudo abrir el ticket.', 'warning');
    } finally {
      this.saving = false;
      this.activeInstallmentId = null;
      this.loadLoans();
      this.balancesChanged.emit();
    }
  }

  async deactivatePayment(payment: any): Promise<void> {
    if (this.saving || this.loading) return;
    const result = await alerts.confirmAlert('Quitar abono', 'El abono se conservará inactivo en el historial.', 'warning', 'Sí, quitar');
    if (!result.isConfirmed) return;
    this.saving = true;
    this.customersService.deactivateCobranzaInstallmentPayment(payment.id).subscribe({ next: () => { this.saving = false; this.loadLoans(); this.balancesChanged.emit(); }, error: error => { this.saving = false; console.error(error); alerts.basicAlert('Error', error?.error?.error || 'No se pudo quitar el abono.', 'error'); } });
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
